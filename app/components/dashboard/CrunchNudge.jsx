"use client";
import { Zap } from "lucide-react";
import Button from "@/components/ui/Button";
import { actions } from "@/lib/store";
import { daysBetween, inDays } from "@/lib/dates";
import { notify } from "@/lib/toast";

/** Only appears when an exam is close: offers Exam Crunch Mode in context instead of a permanent button. */
export default function CrunchNudge({ state, today }) {
  const soon = state.subjects.filter((s) => s.examDate > today).sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
  const dl = soon ? daysBetween(today, soon.examDate) : 99;
  if (!state.crunch && dl > 5) return null;
  const toggle = () => {
    actions.setCrunch(!state.crunch);
    notify(state.crunch ? "Back to your regular plan." : "Crunch mode on: mock tests added, low-priority topics parked.");
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-ink bg-paper px-5 py-4 shadow-hard">
      <p className="flex items-center gap-3 font-semibold">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-bubble"><Zap size={18} /></span>
        {state.crunch
          ? "Exam crunch mode is on. Mock tests and extra revision are in your plan."
          : `${soon.name} is ${inDays(dl)}. Crunch mode focuses you on weak, high-weight topics.`}
      </p>
      <Button size="sm" variant={state.crunch ? "paper" : "bubble"} onClick={toggle}>{state.crunch ? "Turn off" : "Turn on crunch mode"}</Button>
    </div>
  );
}
