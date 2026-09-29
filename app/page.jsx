"use client";
import { motion } from "framer-motion";
import { CalendarCheck, Play, RefreshCw, Timer, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PopTitle from "@/components/ui/PopTitle";
import Sticker from "@/components/ui/Sticker";
import Wave from "@/components/ui/Wave";
import { Container } from "@/components/ui/Page";

const LOOP = [
  { title: "Plan", text: "Exams, weak topics and your real free time become a day-by-day plan.", icon: CalendarCheck, tone: "sun" },
  { title: "Study", text: "One clear focus at a time, with a timer and no decision fatigue.", icon: Timer, tone: "bubble" },
  { title: "Track", text: "Tell it how confident you feel. Priorities shift with you.", icon: TrendingUp, tone: "cobalt" },
  { title: "Adapt", text: "Missed a session? The time moves into buffers. Nothing collapses.", icon: RefreshCw, tone: "paper" },
];

export default function Home() {
  return (
    <>
      <section className="bg-sun">
        <Container className="grid items-center gap-12 pb-12 pt-12 md:grid-cols-[1.15fr_0.85fr] md:pt-20">
          <div>
            <PopTitle lines={["Study plans", "that *adapt*", "to real life."]} />
            <p className="mt-6 max-w-md text-lg font-semibold">
              ADAPT turns your exams, weak spots and free time into a calm plan, and quietly fixes it when a session slips.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/dashboard" variant="cobalt" size="lg"><Play size={18} /> Open my plan</Button>
              <Button href="/onboarding" size="lg">Start from scratch</Button>
            </div>
          </div>
          <motion.div className="relative" initial={{ rotate: -6, scale: 0.9, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
            <Sticker tone="bubble" rotate={-10} className="-left-3 -top-4">Powered by Gemini</Sticker>
            <div className="rounded-[32px] border-2 border-ink bg-paper p-7 shadow-hard-lg">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-soft">Plan adjusted</p>
              <p className="mt-3 font-display text-3xl font-extrabold leading-tight">45 min of Linked Lists, moved. Not lost.</p>
              <div className="mt-5 grid gap-2 font-extrabold">
                {[["Tomorrow", 20], ["Thursday", 15], ["Friday", 10]].map(([d, m]) => (
                  <div key={d} className="flex justify-between rounded-2xl border-2 border-ink bg-cream px-4 py-2.5"><span>{d}</span><span className="text-strong">+{m} min</span></div>
                ))}
              </div>
            </div>
            <Sticker tone="cobalt" rotate={7} delay={0.7} className="-bottom-4 right-6">No all-nighters</Sticker>
          </motion.div>
        </Container>
      </section>
      <Wave fill="var(--color-sun)" />

      <Container className="pt-16">
        <h2 className="text-[clamp(36px,5vw,64px)] leading-[0.95]">Plan. Study. Track. <span className="rounded-[0.15em] bg-bubble px-[0.1em]">Adapt.</span></h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((s, i) => (
            <Card key={s.title} tone={s.tone} index={i} lift>
              <s.icon size={26} strokeWidth={2.4} />
              <h3 className="mt-6 text-2xl">{s.title}</h3>
              <p className="mt-2 font-semibold opacity-90">{s.text}</p>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
