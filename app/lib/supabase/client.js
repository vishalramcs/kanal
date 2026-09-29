"use client";
// Browser Supabase client (publishable key only; never the secret key).
import { createBrowserClient } from "@supabase/ssr";

let client;
export function getBrowserClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
