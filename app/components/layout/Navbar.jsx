"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, LogOut, Menu, Settings, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

export const NAV_LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/planner", label: "Planner" },
  { href: "/subjects", label: "Subjects" },
  { href: "/progress", label: "Progress" },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-[-0.04em]" aria-label="ADAPT home">
      <span className="grid size-9 -rotate-6 place-items-center rounded-xl border-2 border-ink bg-sun shadow-hard-sm">
        <BookOpen size={18} strokeWidth={2.6} />
      </span>
      adapt.
    </Link>
  );
}

function Avatar({ user, size = "size-10" }) {
  const initials = (user.name || user.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  return user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full border-2 border-ink object-cover`} />
  ) : (
    <span className={`${size} grid place-items-center rounded-full border-2 border-ink bg-bubble text-sm font-extrabold`}>{initials}</span>
  );
}

/** Avatar button with the signed-in account, Settings and Log out. Escape or outside click closes it. */
function AccountMenu({ user, signOut }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);
  return (
    <div ref={ref} className="relative hidden md:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className="rounded-full">
        <Avatar user={user} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-12 z-40 w-64 rounded-2xl border-2 border-ink bg-paper p-2 shadow-hard">
            <div className="border-b-2 border-dashed border-ink/20 px-3 pb-3 pt-2">
              <p className="truncate font-extrabold">{user.name}</p>
              <p className="truncate text-sm font-semibold text-ink-soft">{user.email}</p>
            </div>
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 font-extrabold hover:bg-sun-soft"><Settings size={16} /> Settings</Link>
            <button role="menuitem" type="button" disabled={leaving} onClick={() => { setLeaving(true); signOut(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-extrabold hover:bg-bubble-soft">
              <LogOut size={16} /> {leaving ? "Logging out…" : "Log out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const path = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const current = (href) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <header className="relative z-30 border-b-2 border-ink bg-cream">
      <nav className="mx-auto flex h-[76px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-8" aria-label="Main">
        <Wordmark />
        {isAuthenticated && (
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href} href={l.href} aria-current={current(l.href)}
                className="rounded-full px-4 py-2 text-[15px] font-extrabold hover:bg-sun-soft aria-[current=page]:bg-ink aria-[current=page]:text-cream"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <Button href="/focus" variant="sun" className="hidden md:inline-flex">Start studying</Button>
            <AccountMenu user={user} signOut={signOut} />
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
              className="grid size-11 place-items-center rounded-full border-2 border-ink bg-sun shadow-hard-sm md:hidden">
              <Menu size={20} />
            </button>
          </div>
        ) : (
          path !== "/login" && <Button href="/login" variant="sun">Sign in</Button>
        )}
      </nav>

      <AnimatePresence>
        {open && isAuthenticated && (
          <motion.div
            role="dialog" aria-modal="true" aria-label="Menu"
            className="fixed inset-0 z-50 flex flex-col gap-2 overflow-y-auto bg-sun p-5"
            initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <Wordmark />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-full border-2 border-ink bg-paper">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-ink bg-paper p-3">
              <Avatar user={user} size="size-11" />
              <div className="min-w-0">
                <p className="truncate font-extrabold">{user.name}</p>
                <p className="truncate text-sm font-semibold text-ink-soft">{user.email}</p>
              </div>
            </div>
            {[...NAV_LINKS, { href: "/focus", label: "Focus" }, { href: "/settings", label: "Settings" }].map((l) => (
              <Link key={l.href} href={l.href} className="font-display text-5xl font-extrabold tracking-[-0.04em]">{l.label}</Link>
            ))}
            <button type="button" onClick={signOut} className="mt-6 flex items-center gap-2 self-start rounded-full border-2 border-ink bg-paper px-5 py-3 text-lg font-extrabold shadow-hard-sm">
              <LogOut size={18} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
