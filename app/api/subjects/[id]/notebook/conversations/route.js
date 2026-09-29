// GET /api/subjects/:id/notebook/conversations -> this subject's conversation history (newest first)
import { json, requireSubject, withUser } from "@/lib/auth/server";
import * as db from "@/lib/notebook/db";

export const GET = withUser(async (_request, { params, supabase, user }) => {
  const { id } = await params;
  await requireSubject(supabase, user, id);
  return json({ conversations: await db.listConversations(supabase, user.id, id) });
});
