// Server-side Supabase clients. The user client carries the signed-in user's session (RLS applies).
// The admin client uses SUPABASE_SECRET_KEY and must only be used for narrow admin tasks on the server.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createUserClient() {
  const store = await cookies();
  return createServerClient(url(), publishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component (read-only cookies). The proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/** Admin client: bypasses RLS. Only used to remove accounts that fail the domain check. */
export function createAdminClient() {
  return createClient(url(), process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
