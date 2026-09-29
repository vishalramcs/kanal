"use client";
import { Coffee, Play, ShieldCheck } from "lucide-react";
import Disclosure from "@/components/ui/Disclosure";
import { findTopic } from "@/lib/store";
import { layoutDay } from "@/lib/planner";
import { fmtMinutes, hhmm } from "@/lib/dates";

export const KIND_LABEL = { learn: "Learn", revise: "Revise", mock: "Mock test", "catch-up": "Catch-up" };
const STATUS = { done: "Done", missed: "Moved", skipped: "Skipped" };

const whyText = (b, topic, subject) =>
  b.reasons?.length
    ? `${topic.name} (${subject.name}) is here because: ${b.reasons.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join("; ")}.`
    : `${topic.name} keeps your ${subject.name} preparation on track.`;

/** One day's sessions with clock times, breaks and the protected buffer. */
export default function DayTimeline({ day, state, onStart, showBreaks = false }) {
  const items = layoutDay(day, state.profile);
  if (!day.blocks.length) return <p className="text-ink-soft">Rest day. Nothing scheduled.</p>;
  return (
    <ol className="grid gap-2.5">
      {items.map((it, i) => {
        if (it.type === "break") {
          return showBreaks ? (
            <li key={`b${i}`} className="flex items-center gap-2 pl-16 text-sm font-bold text-ink-soft"><Coffee size={13} /> {it.long ? "Long break" : "Break"} · {it.minutes} min</li>
          ) : null;
        }
        if (it.type === "buffer") {
          return (
            <li key="buffer" className="flex items-center justify-between rounded-2xl border-2 border-dashed border-ink/35 px-4 py-2.5 text-sm font-extrabold text-ink-soft">
              <span className="flex items-center gap-2"><ShieldCheck size={15} /> Buffer</span>
              <span>{fmtMinutes(it.minutes)} kept free</span>
            </li>
          );
        }
        const { subject, topic } = findTopic(state, it.subjectId, it.topicId);
        if (!subject || !topic) return null;
        const done = it.status !== "planned";
        return (
          <li key={it.id} className={`rounded-2xl border-2 bg-paper px-4 py-3 ${it.changed ? "border-ink shadow-hard-sm" : "border-ink/15"} ${done ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="w-12 shrink-0 pt-0.5 text-sm font-extrabold tabular-nums text-ink-soft">{hhmm(it.start)}</span>
              <span className="mt-1.5 size-3 shrink-0 rounded-full border-2 border-ink" style={{ background: subject.color }} aria-hidden="true" />
              <div className="min-w-0 grow">
                <p className={`font-extrabold leading-snug ${done ? "line-through" : ""}`}>{topic.name}</p>
                <p className="text-sm text-ink-soft">
                  {subject.name} · {fmtMinutes(it.minutes)} · {KIND_LABEL[it.kind]}
                  {it.changed && <span className="ml-1 rounded-full bg-sun px-2 py-0.5 text-xs font-extrabold text-ink">adjusted</span>}
                  {done && <span className="ml-1 font-extrabold text-ink">· {STATUS[it.status]}</span>}
                </p>
                <Disclosure label="Why?" className="mt-2" triggerClassName="!px-2.5 !py-0.5 !text-xs">
                  <p className="text-sm font-semibold">{whyText(it, topic, subject)}</p>
                </Disclosure>
              </div>
              {onStart && !done && (
                <button type="button" onClick={() => onStart(it)} aria-label={`Start ${topic.name}`} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun shadow-hard-sm">
                  <Play size={14} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
