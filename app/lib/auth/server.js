// Server-side authorization used by every API route.
// getUser() asks Supabase Auth to verify the session token, so a forged cookie can't pass.
import { NextResponse } from "next/server";
import { createUserClient } from "../supabase/server.js";
import { isAllowedEmail } from "./domain.js";

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Returns { supabase, user } for a signed-in user on the allowed domain, otherwise throws 401/403. */
export async function requireUser() {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) throw new HttpError(401, "unauthenticated", "Please sign in again.");
  if (!isAllowedEmail(user.email)) throw new HttpError(403, "domain_not_allowed", "This app is limited to PSG Tech accounts.");
  return { supabase, user };
}

export const json = (body, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status, code, message) => json({ error: { code, message } }, status);

/** Wrap a route handler: authorize, then turn thrown errors into safe JSON (no stack traces or secrets). */
export function withUser(handler) {
  return async (request, context) => {
    try {
      const auth = await requireUser();
      return await handler(request, { ...context, ...auth });
    } catch (err) {
      if (err instanceof HttpError || (err?.status && err?.code)) return fail(err.status, err.code, err.message);
      console.error(`[api] ${request.method} ${request.nextUrl?.pathname}: ${err?.message}`);
      return fail(500, "server_error", "Something went wrong on our side. Please try again.");
    }
  };
}

/** Subject ids are the planner's own ids; validate their shape before any query. */
export function subjectIdFrom(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new HttpError(404, "not_found", "Subject not found.");
  return value;
}

/** 404 unless this subject belongs to the signed-in user (RLS also enforces this). */
export async function requireSubject(supabase, user, subjectId) {
  const { data, error } = await supabase.from("subjects").select("id, name, exam_date, difficulty, topics").eq("user_id", user.id).eq("id", subjectIdFrom(subjectId)).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "not_found", "Subject not found.");
  return data;
}
