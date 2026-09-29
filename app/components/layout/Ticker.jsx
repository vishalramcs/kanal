"use client";
import { useStore } from "@/lib/store";
import { daysBetween, inDays } from "@/lib/dates";

const DEFAULTS = ["Plan · study · track · adapt", "Missed a session? The plan adapts", "Buffers keep every day realistic", "Small sessions beat all-nighters"];

/** Cobalt marquee of upcoming exams (falls back to product lines before data loads). */
export default function Ticker() {
  const state = useStore();
  const today = state?.plan?.generatedFor;
  const items = today
    ? [...state.subjects]
        .filter((s) => s.examDate >= today)
        .sort((a, b) => a.examDate.localeCompare(b.examDate))
        .map((s) => `${s.name} exam ${inDays(daysBetween(today, s.examDate))}`)
    : DEFAULTS;
  const line = [...items, "Plan · study · track · adapt"];
  return (
    <div className="flex h-10 items-center overflow-hidden border-b-2 border-ink bg-cobalt text-cream" aria-label="Upcoming exams">
      <div className="flex animate-marquee whitespace-nowrap" aria-hidden="true">
        {[...line, ...line, ...line, ...line].map((t, i) => (
          <span key={i} className="px-5 text-[13px] font-extrabold uppercase tracking-[0.08em]">{t} ✦</span>
        ))}
      </div>
      <span className="sr-only">{items.join(". ")}</span>
    </div>
  );
}
