"use client";
import { useStore } from "@/lib/store";
import { progressStats, rightNow } from "@/lib/planner";
import { Container, Empty, Loading } from "@/components/ui/Page";
import Button from "@/components/ui/Button";
import FocusHero from "@/components/dashboard/FocusHero";
import PlanAdjustedCard from "@/components/dashboard/PlanAdjustedCard";
import CrunchNudge from "@/components/dashboard/CrunchNudge";
import TodayList from "@/components/dashboard/TodayList";
import ExamCards from "@/components/dashboard/ExamCards";

export default function DashboardPage() {
  const state = useStore();
  const today = state?.plan?.generatedFor;
  if (!state || !today) return <Loading />;
  if (!state.subjects.length) {
    return (
      <Container className="py-16">
        <Empty title="Let's add your first subject" action={<Button href="/onboarding" variant="sun">Set up my plan</Button>}>
          ADAPT builds your plan from your exams, weak topics and free time.
        </Empty>
      </Container>
    );
  }
  const task = rightNow(state, state.plan, today);
  const stats = progressStats(state, state.plan, today);
  return (
    <>
      <FocusHero state={state} task={task} today={today} stats={stats} />
      <Container className="grid gap-8 pt-6">
        <PlanAdjustedCard state={state} today={today} />
        <CrunchNudge state={state} today={today} />
        <TodayList state={state} today={today} stats={stats} />
        <ExamCards subjects={state.subjects} today={today} />
      </Container>
    </>
  );
}
