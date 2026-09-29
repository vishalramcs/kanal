// GET  /api/subjects/:id/materials -> this subject's materials (+ notebook conversation count)
// POST /api/subjects/:id/materials (multipart "file") -> validate, store in Supabase Storage, then process in the
//      background (extract -> chunk -> embed -> pgvector). Responds immediately with status "processing".
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { HttpError, json, requireSubject, withUser } from "@/lib/auth/server";
import * as db from "@/lib/notebook/db";
import { LIMITS, MIME, NotebookError, detectType, sanitizeFilename } from "@/lib/notebook/extract";
import { processMaterial } from "@/lib/notebook/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

export const GET = withUser(async (_request, { params, supabase, user }) => {
  const { id } = await params;
  await requireSubject(supabase, user, id);
  const [materials, conversationCount] = await Promise.all([db.listMaterials(supabase, user.id, id), db.countConversations(supabase, user.id, id)]);
  return json({ materials, conversationCount });
});

export const POST = withUser(async (request, { params, supabase, user }) => {
  const { id: subjectId } = await params;
  await requireSubject(supabase, user, subjectId);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "no_file", "Choose a file to upload.");
  if (file.size > LIMITS.maxBytes) throw new HttpError(413, "too_large", "That file is larger than 10 MB.");

  const existing = await db.listMaterials(supabase, user.id, subjectId);
  if (existing.length >= LIMITS.maxMaterials) throw new HttpError(400, "too_many", `A subject can hold up to ${LIMITS.maxMaterials} materials. Delete one to add another.`);

  const filename = sanitizeFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let type;
  try {
    type = detectType(filename, bytes);
  } catch (err) {
    if (err instanceof NotebookError) throw new HttpError(err.status, err.code, err.message);
    throw err;
  }

  const materialId = randomUUID();
  const path = db.storagePath(user.id, subjectId, materialId, filename);
  await db.uploadFile(supabase, path, bytes, MIME[type]);
  const material = await db.createMaterial(supabase, {
    id: materialId,
    user_id: user.id,
    subject_id: subjectId,
    filename,
    file_type: type,
    mime_type: MIME[type],
    file_size: bytes.length,
    storage_path: path,
    status: "processing",
  });

  // Extraction + embeddings can take a while: finish after responding; the page polls the status.
  after(() => processMaterial(supabase, { userId: user.id, subjectId, material, type, bytes }));
  return json({ material }, 202);
});
