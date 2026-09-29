// POST /auth/signout: end the Supabase session (clears auth cookies) and go back to the login page.
import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?signedout=1", request.url), { status: 303 });
}
