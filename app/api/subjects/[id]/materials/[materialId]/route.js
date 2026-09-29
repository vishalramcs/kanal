// GET    /api/subjects/:id/materials/:materialId?page=N -> opens the original file (short-lived signed link; PDFs jump to the page)
// DELETE /api/subjects/:id/materials/:materialId        -> deletes the file, its chunks and the material
import { NextResponse } from "next/server";
import { HttpError, json, requireSubject, withUser } from "@/lib/auth/server";
import * as db from "@/lib/notebook/db";

async function ownedMaterial(params, supabase, user) {
  const { id, materialId } = await params;
  await requireSubject(supabase, user, id);
  if (!db.isUuid(materialId)) throw new HttpError(404, "not_found", "Material not found.");
  return { subjectId: id, materialId };
}

export const GET = withUser(async (request, { params, supabase, user }) => {
  const { subjectId, materialId } = await ownedMaterial(params, supabase, user);
  const material = await db.getMaterial(supabase, user.id, subjectId, materialId);
  if (!material) throw new HttpError(404, "not_found", "Material not found.");
  const url = await db.signedUrl(supabase, material.storage_path);
  const page = Number(request.nextUrl.searchParams.get("page"));
  return NextResponse.redirect(material.file_type === "pdf" && page > 0 ? `${url}#page=${page}` : url);
});

export const DELETE = withUser(async (_request, { params, supabase, user }) => {
  const { subjectId, materialId } = await ownedMaterial(params, supabase, user);
  if (!(await db.deleteMaterial(supabase, user.id, subjectId, materialId))) throw new HttpError(404, "not_found", "Material not found.");
  return json({ ok: true });
});
