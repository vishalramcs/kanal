// Google -> Supabase -> here. This is the trusted place where the institutional domain decision is made.
import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/domain";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";

/** Only allow same-site relative paths after login (prevents open redirects). */
function safeNext(value) {
  return typeof value === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(value) ? value : "/dashboard";
}

export async function GET(request) {
  const url = new URL(request.url);
  const toLogin = (error, reason) => {
    const to = new URL(`/login?error=${error}`, url.origin);
    if (reason) {
      console.warn(`[auth] sign-in failed (${error}): ${reason}`);
      to.searchParams.set("reason", String(reason).slice(0, 200));
    }
    return NextResponse.redirect(to);
  };

  // Google returns ?error=access_denied when the user cancels; Supabase adds error_description for other failures.
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return toLogin(providerError === "access_denied" ? "cancelled" : "oauth", url.searchParams.get("error_description") || providerError);
  }

  const code = url.searchParams.get("code");
  if (!code) return toLogin("oauth", "No sign-in code came back from Supabase.");

  const supabase = await createUserClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return toLogin("oauth", exchangeError.message);

  // Re-read the user from Supabase Auth (verified server-side), then apply the domain rule.
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return toLogin("session");

  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    // Remove the account Supabase just created so non-institutional users leave nothing behind.
    await createAdminClient().auth.admin.deleteUser(user.id).catch(() => {});
    return toLogin("domain");
  }

  // First sign-in creates the profile; later sign-ins just refresh it (same auth user id, no duplicates).
  const meta = user.user_metadata || {};
  await supabase.from("profiles").upsert(
    { user_id: user.id, email: user.email.toLowerCase(), display_name: meta.full_name || meta.name || user.email.split("@")[0], avatar_url: meta.avatar_url || meta.picture || null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin));
}

export const dynamic = "force-dynamic";
