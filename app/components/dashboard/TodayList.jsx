"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play } from "lucide-react";
import Card from "@/components/ui/Card";
import { Ring } from "@/components/ui/Meters";
import { actions, findTopic } from "@/lib/store";
import { layoutDay } from "@/lib/planner";
import { fmtMinutes, hhmm } from "@/lib/dates";

const STATUS = { done: "Done", missed: "Moved", skipped: "Skipped" };

/** Today's sessions in a short list, plus a single progress ring. */
export default function TodayList({ state, today, stats }) {
  const router = useRouter();
  const day = state.plan.days.find((d) => d.date === today);
  const blocks = day ? layoutDay(day, state.profile).filter((i) => !i.type) : [];
  const visible = blocks.slice(0, 5);
  const start = (b) => { actions.startSession(b); router.push("/focus"); };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]">
      <Card index={1}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl">Today</h2>
          <Link href="/planner" className="inline-flex items-center gap-1 text-sm font-extrabold underline-offset-4 hover:underline">Full plan <ArrowRight size={14} /></Link>
        </div>
        {!visible.length && <p className="text-ink-soft">No sessions today.</p>}
        <ul className="grid gap-2">
          {visible.map((b) => {
            const { subject, topic } = findTopic(state, b.subjectId, b.topicId);
            if (!subject || !topic) return null;
            const done = b.status !== "planned";
            return (
              <li key={b.id} className={`flex items-center gap-3 rounded-2xl border-2 border-ink/15 px-3 py-2.5 ${done ? "opacity-60" : ""}`}>
                <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-ink-soft">{hhmm(b.start)}</span>
                <span className="size-3 shrink-0 rounded-full border-2 border-ink" style={{ background: subject.color }} aria-hidden="true" />
                <span className="min-w-0 grow">
                  <span className={`block truncate font-extrabold ${done ? "line-through" : ""}`}>{topic.name}</span>
                  <span className="block truncate text-sm text-ink-soft">{subject.name} · {fmtMinutes(b.minutes)}{b.changed ? " · adjusted" : ""}</span>
                </span>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold">{b.status === "done" && <Check size={14} />}{STATUS[b.status]}</span>
                ) : (
                  <button type="button" onClick={() => start(b)} aria-label={`Start ${topic.name}`} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun shadow-hard-sm transition-transform hover:-translate-y-0.5">
                    <Play size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {blocks.length > visible.length && <p className="mt-3 text-sm font-bold text-ink-soft">+{blocks.length - visible.length} more in the planner</p>}
      </Card>

      <Card index={2} tone="soft" className="grid place-items-center gap-3 self-start text-center">
        <Ring value={stats.todayPlanned ? stats.todayDone / stats.todayPlanned : 0} size={140}>
          <span className="font-display text-4xl font-extrabold">{stats.todayPlanned ? Math.round((stats.todayDone / stats.todayPlanned) * 100) : 0}%</span>
          <span className="block text-sm font-bold text-ink-soft">of today</span>
        </Ring>
        <p className="font-extrabold">{stats.streak}-day streak</p>
      </Card>
    </div>
  );
}
