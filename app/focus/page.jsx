"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { actions, findTopic, useStore } from "@/lib/store";
import { rightNow } from "@/lib/planner";
import { fmtMinutes } from "@/lib/dates";
import { notify } from "@/lib/toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Container, Empty, Loading, PageHeader } from "@/components/ui/Page";
import SessionTimer, { secondsLeft } from "@/components/focus/SessionTimer";
import ConfidenceDialog from "@/components/focus/ConfidenceDialog";
import IncompleteDialog from "@/components/focus/IncompleteDialog";
import DayTimeline from "@/components/planner/DayTimeline";

function ActiveSession({ session, state }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null); // "confidence" | "incomplete"
  const [elapsed, setElapsed] = useState(0);
  const { subject, topic } = findTopic(state, session.subjectId, session.topicId);
  if (!subject || !topic) return <Empty title="This session's topic no longer exists." />;
  const base = { subjectId: subject.id, topicId: topic.id, blockId: session.blockId };

  const pause = (left, paused) => paused
    ? actions.updateSession({ pausedLeft: null, startedAt: Date.now() - (session.minutes * 60 - session.pausedLeft) * 1000 })
    : actions.updateSession({ pausedLeft: left });
  const holdTimer = () => session.pausedLeft == null && actions.updateSession({ pausedLeft: secondsLeft(session) });

  const finish = (confidence) => {
    const { after } = actions.completeSession({ ...base, minutes: session.minutes, confidence });
    notify(`Nice work. ${topic.name} is now at ${after}% confidence.`);
    router.push("/dashboard");
  };
  const incomplete = (done) => {
    actions.missSession({ ...base, plannedMinutes: session.minutes, doneMinutes: done });
    notify("Plan adjusted. The missed time was spread over the next few days.");
    router.push("/dashboard");
  };
  const skip = () => {
    actions.missSession({ ...base, plannedMinutes: session.minutes, doneMinutes: 0, reason: "skipped" });
    notify("Skipped. This session moved into the coming days.");
    router.push("/dashboard");
  };

  return (
    <Container className="py-12">
      <Card tone="paper" className="relative mx-auto max-w-3xl !py-12" style={{ borderTop: `10px solid ${subject.color}` }}>
        <SessionTimer
          session={session} subject={subject} topic={topic}
          onPause={pause}
          onComplete={() => { holdTimer(); setDialog("confidence"); }}
          onSkip={skip}
          onIncomplete={(mins) => { holdTimer(); setElapsed(mins); setDialog("incomplete"); }}
        />
      </Card>
      <ConfidenceDialog open={dialog === "confidence"} topic={topic} onPick={finish} onClose={() => setDialog(null)} />
      <IncompleteDialog open={dialog === "incomplete"} planned={session.minutes} elapsed={elapsed} topic={topic} onConfirm={incomplete} onClose={() => setDialog(null)} />
    </Container>
  );
}

export default function FocusPage() {
  const state = useStore();
  const today = state?.plan?.generatedFor;
  if (!state || !today) return <Loading />;
  if (state.session) return <ActiveSession key={state.session.startedAt} session={state.session} state={state} />;

  const task = rightNow(state, state.plan, today);
  const day = state.plan.days.find((d) => d.date === today);
  return (
    <Container>
      <PageHeader eyebrow="Focus" title="Ready when you are." />
      {task ? (
        <Card tone="sun" className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em]">Recommended now · priority {task.score}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] leading-none">{task.topic.name}</h2>
          <p className="mt-2 font-semibold">{task.subject.name} · {fmtMinutes(task.minutes)} · {task.reasons.slice(0, 2).join(" · ")}</p>
          <Button variant="cobalt" size="lg" className="mt-6" onClick={() => actions.startSession(task.block || { subjectId: task.subject.id, topicId: task.topic.id, minutes: task.minutes })}>
            <Play size={18} /> Start focus session
          </Button>
        </Card>
      ) : (
        <Empty title="All caught up" />
      )}
      {day && (
        <Card index={1}>
          <h2 className="mb-4 text-3xl">Or pick from today</h2>
          <DayTimeline day={day} state={state} onStart={(b) => actions.startSession(b)} />
        </Card>
      )}
    </Container>
  );
}
