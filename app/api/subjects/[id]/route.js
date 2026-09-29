// DELETE /api/subjects/:id -> removes the subject with its materials, stored files, chunks and conversations.
import { json, requireSubject, withUser } from "@/lib/auth/server";
import { removeSubject } from "@/lib/notebook/db";

export const DELETE = withUser(async (_request, { params, supabase, user }) => {
  const { id } = await params;
  await requireSubject(supabase, user, id);
  await removeSubject(supabase, user.id, id);
  return json({ ok: true });
});
