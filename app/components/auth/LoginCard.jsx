"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/Page";
import PopTitle from "@/components/ui/PopTitle";
import Sticker from "@/components/ui/Sticker";
import Wave from "@/components/ui/Wave";
import { getBrowserClient } from "@/lib/supabase/client";

const MESSAGES = {
  cancelled: { tone: "info", text: "Google sign-in was cancelled. Please try again." },
  domain: { tone: "error", title: "This app is only for PSG Tech accounts.", text: "Please sign in with your @DOMAIN Google account." },
  oauth: { tone: "error", text: "We couldn't complete Google sign-in. Please try again." },
  session: { tone: "error", text: "Your session could not be restored. Please sign in again." },
  provider: { tone: "error", title: "Google sign-in isn't switched on yet.", text: "An administrator needs to enable the Google provider in Supabase (Authentication → Sign In / Providers → Google)." },
  signedout: { tone: "info", text: "You've been signed out." },
};

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Sign-in screen: one action, "Continue with Google". The domain rule is enforced on the server after Google returns. */
export default function LoginCard({ domain, next, error, reason }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const message = MESSAGES[localError || error];

  const signIn = async () => {
    if (loading) return;
    setLoading(true);
    setLocalError(null);
    // If Google isn't enabled in Supabase, the redirect would land on a raw JSON error page: check first.
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    }).then((r) => r.json()).catch(() => null);
    if (settings && !settings.external?.google) {
      setLocalError("provider");
      setLoading(false);
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/dashboard")}`;
    const { error: oauthError } = await getBrowserClient().auth.signInWithOAuth({
      provider: "google",
      // `hd` only pre-selects PSG accounts in Google's picker; the real check happens on our server.
      options: { redirectTo, queryParams: { hd: domain, prompt: "select_account" } },
    });
    if (oauthError) {
      setLocalError("oauth");
      setLoading(false);
    }
  };

  return (
    <>
      <section className="bg-sun">
        <Container className="grid items-center gap-10 pb-12 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pb-16 md:pt-16">
          <div>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.14em]">ADAPT · AI study planner</p>
            <PopTitle lines={["Your study", "space is", "*waiting.*"]} />
            <p className="mt-6 max-w-md text-lg font-semibold">
              Plans that adapt to real life, subject notebooks that answer from your own notes, and a coach that knows your exams.
            </p>
          </div>

          <motion.div
            className="relative"
            initial={{ rotate: -4, scale: 0.94, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.1 }}
          >
            <Sticker tone="bubble" rotate={-9} className="-left-3 -top-4">PSG Tech only</Sticker>
            <div className="rounded-[32px] border-2 border-ink bg-paper p-6 shadow-hard-lg sm:p-8">
              <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.02]">Sign in with your PSG Tech account</h1>
              <p className="mt-3 font-semibold text-ink-soft">Use your @{domain} Google account to continue.</p>

              {message && (
                <div role={message.tone === "error" ? "alert" : "status"}
                  className={`mt-5 rounded-2xl border-2 border-ink px-4 py-3 font-semibold ${message.tone === "error" ? "bg-bubble-soft" : "bg-sun-soft"}`}>
                  {message.title && <p className="font-extrabold">{message.title}</p>}
                  <p>{message.text.replace("DOMAIN", domain)}</p>
                  {reason && !localError && <p className="mt-1 break-words text-sm font-medium text-ink-soft">Details: {reason}</p>}
                </div>
              )}

              <button
                type="button" onClick={signIn} disabled={loading} aria-busy={loading}
                className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-ink bg-paper px-6 text-lg font-extrabold shadow-hard transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard"
              >
                {loading ? <span className="size-5 animate-spin rounded-full border-[3px] border-ink/25 border-t-ink" aria-hidden="true" /> : <GoogleMark />}
                {loading ? "Connecting to Google…" : error === "domain" ? "Use a different Google account" : "Continue with Google"}
              </button>

              <p className="mt-5 text-center text-sm font-bold text-ink-soft">Only @{domain} accounts are allowed.</p>
              <div className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm font-semibold">
                <span className="font-extrabold">New here?</span> Your account is created automatically the first time you sign in with your PSG Tech Google account.
              </div>
            </div>
            <Sticker tone="cobalt" rotate={6} delay={0.7} className="-bottom-4 right-6">No passwords</Sticker>
          </motion.div>
        </Container>
      </section>
      <Wave fill="var(--color-sun)" />
    </>
  );
}
