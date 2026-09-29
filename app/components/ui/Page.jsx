// Page scaffolding shared by every screen: container, heading, loading skeleton, banners.
import { AlertTriangle, Info } from "lucide-react";

export function Container({ children, className = "", ...props }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-8 ${className}`} {...props}>{children}</div>;
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-10 sm:pt-14">
      <div>
        {eyebrow && <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-ink-soft">{eyebrow}</p>}
        <h1 className="text-[clamp(38px,5vw,64px)] leading-[0.95]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <Container className="py-14" aria-busy="true">
      <span className="sr-only">Loading your plan…</span>
      <div className="mb-6 h-14 w-2/3 animate-pulse rounded-2xl bg-cream-deep" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-cream-deep" />
        <div className="h-48 animate-pulse rounded-3xl bg-cream-deep" />
      </div>
    </Container>
  );
}

const BANNER = {
  danger: "bg-bubble-soft",
  warn: "bg-sun-soft",
  info: "bg-paper",
};

export function Banner({ level = "info", children }) {
  const Icon = level === "info" ? Info : AlertTriangle;
  return (
    <div role={level === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border-2 border-ink px-4 py-3 font-semibold ${BANNER[level]}`}>
      <Icon size={18} className="mt-1 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-3xl border-2 border-dashed border-ink/40 px-6 py-12 text-center">
      <h2 className="text-2xl">{title}</h2>
      {children && <p className="max-w-md text-ink-soft">{children}</p>}
      {action}
    </div>
  );
}
