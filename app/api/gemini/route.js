// Planner AI tasks (signed-in users on the allowed domain only).
// POST /api/gemini  { task, context }  ->  { available, source, data }
// GET  /api/gemini                      ->  { configured }
import { HttpError, json, withUser } from "@/lib/auth/server";
import { TASKS, cleanContext, isConfigured, rateLimited, runTask } from "@/lib/gemini";

const MAX_CONTEXT_CHARS = 9000;

export const GET = withUser(async () => json({ configured: isConfigured() }));

export const POST = withUser(async (request, { user }) => {
  const body = await request.json().catch(() => null);
  const { task, context } = body || {};
  if (!TASKS[task] || typeof context !== "object" || context === null) throw new HttpError(400, "bad_request", "Unknown task or missing context.");
  if (JSON.stringify(context).length > MAX_CONTEXT_CHARS) throw new HttpError(413, "too_large", "Context too large.");
  if (rateLimited(user.id)) return json({ available: false, source: "local", reason: "rate_limited" }, 429);

  try {
    return json({ available: true, source: "gemini", data: await runTask(task, cleanContext(context)) });
  } catch (err) {
    // Never leak details; the browser falls back to the local engine.
    console.warn(`[gemini] ${task} unavailable: ${err.message}`);
    return json({ available: false, source: "local", reason: err.message === "not_configured" ? "not_configured" : "error" });
  }
});
