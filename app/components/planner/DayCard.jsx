"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import DayTimeline from "./DayTimeline";
import { fmtMinutes, relDay, weekdayShort } from "@/lib/dates";

/** A collapsible day: a one-line summary first, the full timeline on demand. */
export default function DayCard({ day, state, today, onStart, showBreaks, defaultOpen = false, index = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  const exams = state.subjects.filter((s) => s.examDate === day.date);
  const study = day.blocks.reduce((a, b) => a + b.minutes, 0);
  const changed = day.blocks.some((b) => b.changed);
  const topics = day.blocks.length;
  const mocks = day.blocks.filter((b) => b.kind === "mock").length;

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}
      className={`rounded-3xl border-2 border-ink bg-paper ${changed ? "shadow-hard-lg" : "shadow-hard"}`}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left sm:px-6">
        <span className="min-w-28">
          <span className="block font-display text-2xl font-extrabold leading-none">{relDay(today, day.date)}</span>
          <span className="text-sm font-bold text-ink-soft">{weekdayShort(day.date)}</span>
        </span>
        <span className="grow text-sm font-bold text-ink-soft">
          {topics ? `${topics} session${topics > 1 ? "s" : ""} · ${fmtMinutes(study)}` : "Rest day"} · {fmtMinutes(day.buffer)} buffer
        </span>
        <span className="flex flex-wrap gap-2">
          {exams.map((s) => <span key={s.id} className="rounded-full border-2 border-ink bg-bubble px-3 py-0.5 text-xs font-extrabold">{s.name} exam</span>)}
          {mocks > 0 && <span className="rounded-full border-2 border-ink bg-cobalt px-3 py-0.5 text-xs font-extrabold text-cream">Mock test</span>}
          {changed && <span className="rounded-full border-2 border-ink bg-sun px-3 py-0.5 text-xs font-extrabold">Adjusted</span>}
        </span>
        <ChevronDown size={20} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t-2 border-dashed border-ink/20 px-4 pb-5 pt-4 sm:px-6">
              <DayTimeline day={day} state={state} onStart={onStart} showBreaks={showBreaks} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
