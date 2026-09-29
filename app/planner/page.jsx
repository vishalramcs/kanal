"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Zap } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { workloadCheck } from "@/lib/planner";
import { fmtMinutes } from "@/lib/dates";
import { notify } from "@/lib/toast";
import Button from "@/components/ui/Button";
import { Banner, Container, Loading, PageHeader } from "@/components/ui/Page";
import PlanAdjustedCard from "@/components/dashboard/PlanAdjustedCard";
import StrategyCard from "@/components/planner/StrategyCard";
import DayCard from "@/components/planner/DayCard";

export default function PlannerPage() {
  const state = useStore();
  const router = useRouter();
  const [showBreaks, setShowBreaks] = useState(false);
  const plan = state?.plan;
  if (!plan) return <Loading />;
  const today = plan.generatedFor;
  const study = plan.days.reduce((a, d) => a + d.blocks.reduce((x, b) => x + b.minutes, 0), 0);
  const warnings = workloadCheck(state, plan);
  const onStart = (b) => { actions.startSession(b); router.push("/focus"); };

  return (
    <Container>
      <PageHeader eyebrow={`${plan.days.length} days · ${fmtMinutes(study)} of study`} title={plan.crunch ? "Crunch plan" : "Your plan"}>
        <Button size="sm" onClick={() => { actions.replan(); notify("Plan re-optimised from your latest progress."); }}><RefreshCw size={14} /> Re-optimise</Button>
        <Button size="sm" variant={plan.crunch ? "sun" : "bubble"} onClick={() => actions.setCrunch(!plan.crunch)} aria-pressed={plan.crunch}>
          <Zap size={14} /> {plan.crunch ? "Crunch mode on" : "Exam crunch mode"}
        </Button>
      </PageHeader>

      <div className="grid gap-5">
        {warnings.map((w) => <Banner key={w.text} level={w.level}>{w.text}</Banner>)}
        <PlanAdjustedCard state={state} today={today} showLink={false} />
        <StrategyCard state={state} today={today} />
        <div className="flex items-center justify-between pt-4">
          <h2 className="text-3xl">Day by day</h2>
          <label className="flex items-center gap-2 text-sm font-extrabold">
            <input type="checkbox" className="size-4 accent-[var(--color-cobalt)]" checked={showBreaks} onChange={(e) => setShowBreaks(e.target.checked)} />
            Show breaks
          </label>
        </div>
        <ol className="grid gap-4">
          {plan.days.map((d, i) => (
            <DayCard
              key={`${d.date}-${plan.crunch}`} day={d} state={state} today={today} index={i} showBreaks={showBreaks}
              onStart={d.date === today ? onStart : null}
              defaultOpen={d.date === today || d.blocks.some((b) => b.changed)}
            />
          ))}
        </ol>
      </div>
    </Container>
  );
}
