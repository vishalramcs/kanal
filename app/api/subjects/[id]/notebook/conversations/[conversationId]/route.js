// GET    /api/subjects/:id/notebook/conversations/:conversationId -> messages with their sources
// DELETE /api/subjects/:id/notebook/conversations/:conversationId
import { HttpError, json, requireSubject, withUser } from "@/lib/auth/server";
import * as db from "@/lib/notebook/db";

async function ids(params, supabase, user) {
  const { id, conversationId } = await params;
  await requireSubject(supabase, user, id);
  if (!db.isUuid(conversationId)) throw new HttpError(404, "not_found", "Conversation not found.");
  return { subjectId: id, conversationId };
}

export const GET = withUser(async (_request, { params, supabase, user }) => {
  const { subjectId, conversationId } = await ids(params, supabase, user);
  const conversation = await db.getConversation(supabase, user.id, subjectId, conversationId);
  if (!conversation) throw new HttpError(404, "not_found", "Conversation not found.");
  return json({ conversation });
});

export const DELETE = withUser(async (_request, { params, supabase, user }) => {
  const { subjectId, conversationId } = await ids(params, supabase, user);
  if (!(await db.deleteConversation(supabase, user.id, subjectId, conversationId))) throw new HttpError(404, "not_found", "Conversation not found.");
  return json({ ok: true });
});
