"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { NAV_LINKS } from "./Navbar";

export default function Footer() {
  const { isAuthenticated } = useAuth();
  return (
    <footer className="mt-24 overflow-hidden bg-ink pb-8 pt-12 text-cream">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        {isAuthenticated && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-extrabold" aria-label="Footer">
            {[...NAV_LINKS, { href: "/focus", label: "Focus" }, { href: "/settings", label: "Settings" }].map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-sun">{l.label}</Link>
            ))}
          </nav>
        )}
        <p aria-hidden="true" className="mt-6 font-display text-[22vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-sun sm:text-[18vw] lg:text-[200px]">ADAPT</p>
        <p className="mt-6 text-sm text-cream/70">Plan · study · track · adapt. A calmer way to get ready for exams.</p>
      </div>
    </footer>
  );
}
