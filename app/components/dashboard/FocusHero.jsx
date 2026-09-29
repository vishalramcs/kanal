"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import Button from "@/components/ui/Button";
import Disclosure from "@/components/ui/Disclosure";
import PopTitle from "@/components/ui/PopTitle";
import Sticker from "@/components/ui/Sticker";
import Wave from "@/components/ui/Wave";
import AiAnswer from "@/components/ui/AiAnswer";
import { Container } from "@/components/ui/Page";
import { actions } from "@/lib/store";
import { focusContext, useAI } from "@/lib/ai";
import { fmtMinutes, greeting, inDays } from "@/lib/dates";

const KIND = { learn: "Learn", revise: "Revise", mock: "Mock test", "catch-up": "Catch-up" };

/** Yellow hero: one clear recommendation. Details (why / how) are one tap away. */
export default function FocusHero({ state, task, today, stats }) {
  const router = useRouter();
  const why = useAI("explain");
  const how = useAI("suggest");

  const start = () => {
    actions.startSession(task.block || { subjectId: task.subject.id, topicId: task.topic.id, minutes: task.minutes });
    router.push("/focus");
  };

  return (
    <>
      <section className="bg-sun">
      <Container className="grid items-center gap-10 pb-10 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pt-14">
        <div>
          <p className="mb-4 font-extrabold">{greeting()}, {state.profile.name}.</p>
          <PopTitle lines={["One thing", "at a *time.*"]} />
          <p className="mt-5 max-w-md text-lg font-semibold">
            {stats.todayPlanned
              ? `${fmtMinutes(Math.max(0, stats.todayPlanned - stats.todayDone))} left today, with ${fmtMinutes(stats.bufferToday)} kept free in case life happens.`
              : "Nothing planned today. Enjoy the rest, or get ahead below."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {task && <Button variant="cobalt" size="lg" onClick={start}><Play size={18} /> Start session</Button>}
            <Button href="/planner" size="lg">See the plan</Button>
          </div>
        </div>

        {task ? (
          <motion.div
            className="relative"
            initial={{ rotate: -6, scale: 0.9, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 }}
          >
            <Sticker tone="bubble" rotate={-10} className="-left-3 -top-4">Priority {task.score}</Sticker>
            <div className="rounded-[32px] border-2 border-ink bg-paper p-6 shadow-hard-lg sm:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-soft">Today&apos;s focus</p>
              <p className="mt-4 flex items-center gap-2 font-extrabold">
                <span className="size-3 rounded-full border-2 border-ink" style={{ background: task.subject.color }} />
                {task.subject.name}
              </p>
              <h2 className="mt-1 text-[clamp(32px,4vw,46px)] leading-[0.95]">{task.topic.name}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-extrabold">
                <span className="rounded-full border-2 border-ink bg-sun-soft px-3 py-0.5">{fmtMinutes(task.minutes)}</span>
                <span className="rounded-full border-2 border-ink px-3 py-0.5">{KIND[task.block?.kind] || "Learn"}</span>
              </div>
              <div className="mt-6 grid gap-3 border-t-2 border-dashed border-ink/25 pt-5">
                <Disclosure label="Why this?" onOpen={() => why.run(focusContext(task, today), { topic: task.topic, subject: task.subject, today })}>
                  <AiAnswer {...why} render={(d) => <p className="font-semibold">{d.explanation}</p>} />
                </Disclosure>
                <Disclosure label="How should I study it?" onOpen={() => how.run(focusContext(task, today))}>
                  <AiAnswer
                    {...how}
                    render={(d) => (
                      <>
                        <ol className="grid list-decimal gap-1.5 pl-5 font-semibold">{d.tips.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ol>
                        <p className="text-ink-soft">{d.encouragement}</p>
                      </>
                    )}
                  />
                </Disclosure>
              </div>
            </div>
            {task.daysLeft >= 0 && <Sticker tone="cobalt" rotate={7} delay={0.7} className="-bottom-4 right-6">Exam {inDays(task.daysLeft)}</Sticker>}
          </motion.div>
        ) : (
          <div className="rounded-[32px] border-2 border-ink bg-paper p-8 shadow-hard-lg">
            <h2 className="text-4xl">All caught up.</h2>
            <p className="mt-2 text-ink-soft">No topics left to study before your exams. Add a subject to keep going.</p>
          </div>
        )}
      </Container>
      </section>
      <Wave fill="var(--color-sun)" />
    </>
  );
}
