// Runs before every request: refreshes the Supabase session cookie and protects private routes.
// Signed out -> /login (APIs: 401). Signed in with a non-institutional email -> signed out, /login?error=domain (APIs: 403).
// API routes also re-check with requireUser(), and the database re-checks with RLS.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail } from "./app/lib/auth/domain.js";

const PUBLIC = new Set(["/", "/login", "/auth/callback"]);

export async function proxy(request) {
  // If the callback URL isn't on Supabase's allow-list, Supabase falls back to the Site URL ("/?code=…").
  // Forward any stray OAuth result to the real callback so sign-in still completes (or shows a clear error).
  const params = request.nextUrl.searchParams;
  if (request.nextUrl.pathname !== "/auth/callback") {
    if (params.get("code")) {
      const to = new URL("/auth/callback", request.url);
      to.searchParams.set("code", params.get("code"));
      return NextResponse.redirect(to);
    }
    if (params.get("error") && params.get("error_description")) {
      const to = new URL(`/login?error=${params.get("error") === "access_denied" ? "cancelled" : "oauth"}`, request.url);
      to.searchParams.set("reason", params.get("error_description").slice(0, 200));
      console.warn(`[auth] sign-in failed: ${params.get("error_description")}`);
      return NextResponse.redirect(to);
    }
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { pathname, search } = request.nextUrl;
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const isApi = pathname.startsWith("/api/");

  // Keep refreshed/cleared session cookies on any redirect we return.
  const redirect = (path) => {
    const to = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => to.cookies.set(c));
    return to;
  };
  const deny = (status, code, message) => {
    const res = NextResponse.json({ error: { code, message } }, { status });
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    if (isApi) return deny(403, "domain_not_allowed", "This app is limited to PSG Tech accounts.");
    return pathname === "/login" ? response : redirect("/login?error=domain");
  }
  if (PUBLIC.has(pathname)) {
    return pathname === "/login" && user ? redirect("/dashboard") : response;
  }
  if (!user) {
    if (isApi) return deny(401, "unauthenticated", "Please sign in again.");
    return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  return response;
}

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
