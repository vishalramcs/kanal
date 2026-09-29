// GET /api/state -> the signed-in user's planner ({ subjects, profile, plan, history, ... }) or null for a new user.
// PUT /api/state { state, replaceSubjects? } -> saves it. Subjects go to the `subjects` table (so materials can
// reference them); everything else to `planner_state`. user_id always comes from the session, never the body.
import { HttpError, json, withUser } from "@/lib/auth/server";
import { removeSubject } from "@/lib/notebook/db";

const MAX_BYTES = 1_500_000;
const HEX = /^#[0-9a-fA-F]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function toRow(userId, s, position) {
  const ok = s && ID.test(s.id) && typeof s.name === "string" && s.name.trim().length > 0 && s.name.length <= 100 &&
    DATE.test(s.examDate) && Number.isInteger(s.difficulty) && s.difficulty >= 1 && s.difficulty <= 5 && Array.isArray(s.topics) && s.topics.length <= 100;
  if (!ok) throw new HttpError(400, "bad_subject", "One of the subjects is invalid.");
  return {
    user_id: userId,
    id: s.id,
    name: s.name.trim(),
    color: HEX.test(s.color) ? s.color : "#ffd12b",
    exam_date: s.examDate,
    difficulty: s.difficulty,
    topics: s.topics,
    position,
    updated_at: new Date().toISOString(),
  };
}

const fromRow = (r) => ({ id: r.id, name: r.name, color: r.color, examDate: r.exam_date, difficulty: r.difficulty, topics: r.topics });

export const GET = withUser(async (_request, { supabase, user }) => {
  const [subjects, planner] = await Promise.all([
    supabase.from("subjects").select("id, name, color, exam_date, difficulty, topics").eq("user_id", user.id).order("position"),
    supabase.from("planner_state").select("data").eq("user_id", user.id).maybeSingle(),
  ]);
  if (subjects.error) throw subjects.error;
  if (planner.error) throw planner.error;
  if (!planner.data && !subjects.data.length) return json({ state: null });
  return json({ state: { ...(planner.data?.data || {}), subjects: subjects.data.map(fromRow) } });
});

export const PUT = withUser(async (request, { supabase, user }) => {
  const text = await request.text();
  if (text.length > MAX_BYTES) throw new HttpError(413, "too_large", "Your planner data is too large to save.");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Invalid data.");
  }
  const state = body?.state;
  if (!state || typeof state !== "object" || !Array.isArray(state.subjects) || state.subjects.length > 50) {
    throw new HttpError(400, "bad_state", "Invalid planner data.");
  }
  const rows = state.subjects.map((s, i) => toRow(user.id, s, i));
  if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new HttpError(400, "bad_subject", "Duplicate subject ids.");

  if (rows.length) {
    const { error } = await supabase.from("subjects").upsert(rows, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  // Only onboarding / demo reset replaces the whole list. Normal saves never delete (deletes are explicit: DELETE /api/subjects/:id).
  if (body.replaceSubjects) {
    const keep = rows.map((r) => r.id);
    const { data: gone, error } = await supabase.from("subjects").select("id").eq("user_id", user.id);
    if (error) throw error;
    for (const { id } of gone.filter((g) => !keep.includes(g.id))) await removeSubject(supabase, user.id, id);
  }

  const { subjects, ...rest } = state;
  const { error } = await supabase.from("planner_state").upsert({ user_id: user.id, data: rest, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  return json({ ok: true });
});
