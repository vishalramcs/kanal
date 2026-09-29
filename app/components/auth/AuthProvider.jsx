"use client";
// The single auth state for the whole app: { user, session, loading, isAuthenticated, signOut }.
// The server passes the verified user in (no flash); Supabase keeps it in sync after that.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const AuthContext = createContext({ user: null, session: null, loading: true, isAuthenticated: false, signOut: async () => {} });

export function AuthProvider({ initialUser, children }) {
  const [user, setUser] = useState(initialUser || null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      // Signed out elsewhere (another tab, expired refresh token): leave private pages.
      if (event === "SIGNED_OUT" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.assign("/login?error=session");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: Boolean(user),
      signOut: async () => {
        // Server route clears the auth cookies; a full reload drops all in-memory state.
        await fetch("/auth/signout", { method: "POST", redirect: "manual" }).catch(() => {});
        await getBrowserClient().auth.signOut().catch(() => {});
        window.location.assign("/login?signedout=1");
      },
    }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
