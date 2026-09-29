// POST /api/subjects/:id/notebook/chat { question, conversationId?, materialIds?, today? }
// Streams newline-delimited JSON: {type:"meta", conversationId, sources, relevant, mode} -> {type:"delta", text}... -> {type:"done"}.
// Retrieval is restricted to this user + this subject (+ chosen materials) inside the database.
import { NextResponse } from "next/server";
import { HttpError, requireSubject, withUser } from "@/lib/auth/server";
import { subjectDigest } from "@/lib/digest";
import { isConfigured, streamText } from "@/lib/gemini";
import * as db from "@/lib/notebook/db";
import { buildChat, chatPrompt, extractiveAnswer, notFound, retrievalQuery, retrieve } from "@/lib/notebook/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const validDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date().toISOString().slice(0, 10));

export const POST = withUser(async (request, { params, supabase, user }) => {
  const { id: subjectId } = await params;
  const subject = await requireSubject(supabase, user, subjectId);
  const body = await request.json().catch(() => ({}));
  const question = clean(body.question, 1000);
  if (!question) throw new HttpError(400, "empty_question", "Type a question first.");

  let conversation = null;
  if (body.conversationId) {
    conversation = db.isUuid(body.conversationId) ? await db.getConversation(supabase, user.id, subjectId, body.conversationId) : null;
    if (!conversation) throw new HttpError(404, "not_found", "Conversation not found.");
  }
  const history = conversation?.messages || [];
  const materialIds = db.uuidList(body.materialIds);
  const materials = await db.listMaterials(supabase, user.id, subjectId);
  const hasReady = materials.some((m) => m.status === "ready" && (!materialIds.length || materialIds.includes(m.id)));

  const { sources, relevant } = hasReady
    ? await retrieve(supabase, { userId: user.id, subjectId, query: retrievalQuery(question, history), materialIds })
    : { sources: [], relevant: false };
  const planner = subjectDigest(await db.loadPlanner(supabase, user.id), subjectId, validDate(body.today));
  const conversationId = conversation?.id || (await db.createConversation(supabase, user.id, subjectId, question.slice(0, 60)));
  const mode = isConfigured() && hasReady ? "gemini" : "local";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: "meta", conversationId, sources, relevant, mode });
      let answer = "";
      if (!hasReady) {
        answer = materials.length ? "Your materials are still processing. Try again in a moment." : `Upload your first ${subject.name} material to start this notebook.`;
        send({ type: "delta", text: answer });
      } else if (mode === "gemini") {
        try {
          for await (const text of streamText({ prompt: chatPrompt(subject.name), contents: buildChat({ question, history, sources, relevant, planner }) })) {
            answer += text;
            send({ type: "delta", text });
          }
        } catch (err) {
          console.warn(`[notebook] chat stream failed: ${err.message}`);
          if (!answer) {
            answer = extractiveAnswer(sources, relevant, subject.name);
            send({ type: "delta", text: answer });
          } else send({ type: "error", message: "The answer was cut off. Please ask again." });
        }
      } else {
        answer = extractiveAnswer(sources, relevant, subject.name);
        send({ type: "delta", text: answer });
      }
      if (!answer.trim()) {
        answer = notFound(subject.name);
        send({ type: "delta", text: answer });
      }
      await db
        .addMessages(supabase, user.id, subjectId, conversationId, [
          { role: "user", text: question },
          { role: "assistant", text: answer, sources, mode, relevant },
        ])
        .catch((err) => console.error(`[notebook] saving messages failed: ${err.message}`));
      send({ type: "done" });
      controller.close();
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
});
