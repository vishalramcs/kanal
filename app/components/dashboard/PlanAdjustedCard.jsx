"use client";
import { ArrowRight, RefreshCw, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Disclosure from "@/components/ui/Disclosure";
import AiAnswer from "@/components/ui/AiAnswer";
import { actions, findTopic } from "@/lib/store";
import { changeContext, useAI } from "@/lib/ai";
import { fmtMinutes, relDay } from "@/lib/dates";

/** Shown after a missed session: what moved where, with the reason one tap away. */
export default function PlanAdjustedCard({ state, today, showLink = true }) {
  const change = state.plan?.lastChange;
  const ai = useAI("adapt");
  if (!change) return null;
  const { subject, topic } = findTopic(state, change.subjectId, change.topicId);
  if (!subject || !topic) return null;

  return (
    <Card tone="bubble" className="relative" aria-live="polite">
      <button type="button" onClick={actions.dismissChange} aria-label="Dismiss" className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-2 border-ink bg-paper">
        <X size={16} />
      </button>
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em]"><RefreshCw size={14} /> Plan adjusted</p>
      <h2 className="mt-2 pr-10 text-3xl leading-tight">
        {fmtMinutes(change.missed)} of {topic.name}, moved — not lost.
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {change.redistributed.map((r) => (
          <span key={r.date} className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-extrabold">
            {relDay(today, r.date)} <span className="text-strong">+{r.minutes} min</span>
          </span>
        ))}
        {change.unplaced > 0 && <span className="rounded-full border-2 border-ink bg-sun px-3 py-1 text-sm font-extrabold">{fmtMinutes(change.unplaced)} didn&apos;t fit</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-start gap-3">
        <Disclosure label="Why did my plan change?" className="grow" onOpen={() => ai.run(changeContext(change, state, today), { change })}>
          <div className="max-w-2xl rounded-2xl border-2 border-ink bg-paper p-4">
            <AiAnswer {...ai} render={(d) => <p className="font-semibold">{d.message}</p>} />
          </div>
        </Disclosure>
        {showLink && <Button href="/planner" size="sm">Updated plan <ArrowRight size={14} /></Button>}
      </div>
      {change.warning && <p className="mt-3 font-bold">{change.warning}</p>}
    </Card>
  );
}
