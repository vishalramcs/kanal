"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ensurePlan, loadState } from "@/lib/store";
import Ticker from "./Ticker";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Toast from "@/components/ui/Toast";
import ChatBot from "@/components/ChatBot";

/** Site chrome. When signed in: loads the planner from the database and keeps the plan fresh. */
export default function AppShell({ children }) {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    loadState(user).then(ensurePlan);
    const onVisible = () => document.visibilityState === "visible" && ensurePlan();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isAuthenticated, user]);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-sun focus:px-4 focus:py-2 focus:font-extrabold">Skip to content</a>
      {isAuthenticated && <Ticker />}
      <Navbar />
      <main id="main">{children}</main>
      <Footer />
      <Toast />
      {isAuthenticated && <ChatBot />}
    </>
  );
}
