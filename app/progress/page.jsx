"use client";
import { useStore } from "@/lib/store";
import { progressStats } from "@/lib/planner";
import { requiredMinutes } from "@/lib/priority";
import { fmtMinutes, relDay } from "@/lib/dates";
import Card from "@/components/ui/Card";
import Disclosure from "@/components/ui/Disclosure";
import { Bar, Ring, Strength } from "@/components/ui/Meters";
import { Container, Loading, PageHeader } from "@/components/ui/Page";

function Stat({ label, value, tone = "paper", index }) {
  return (
    <Card tone={tone} index={index} className="!p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 font-display text-4xl font-extrabold leading-none tracking-[-0.03em]">{value}</p>
    </Card>
  );
}

export default function ProgressPage() {
  const state = useStore();
  const today = state?.plan?.generatedFor;
  if (!state || !today) return <Loading />;
  const st = progressStats(state, state.plan, today);
  const recent = [...state.history].reverse().slice(0, 8);

  return (
    <Container>
      <PageHeader eyebrow="Progress" title="How it's going" />
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <Card tone="sun" className="grid place-items-center gap-3 text-center">
          <Ring value={st.coverage} size={200} stroke={18}>
            <span className="font-display text-5xl font-extrabold">{Math.round(st.coverage * 100)}%</span>
            <span className="block text-sm font-bold">of the syllabus</span>
          </Ring>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat index={1} label="Studied" value={fmtMinutes(st.studied)} />
          <Stat index={2} label="Still to go" value={fmtMinutes(st.remaining)} />
          <Stat index={3} label="Streak" value={`${st.streak} days`} tone="bubble" />
          <Stat index={4} label="Buffer this week" value={fmtMinutes(st.bufferWeek)} tone="cobalt" />
        </div>
      </div>

      <Card index={5} className="mt-6">
        <h2 className="mb-5 text-3xl">By subject</h2>
        <div className="grid gap-5">
          {state.subjects.map((s) => {
            const req = s.topics.reduce((a, t) => a + requiredMinutes(t, s), 0);
            const done = s.topics.reduce((a, t) => a + Math.min(t.doneMinutes, requiredMinutes(t, s)), 0);
            return (
              <div key={s.id}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm font-extrabold">
                  <span>{s.name}</span><span className="text-ink-soft">{Math.round((done / Math.max(req, 1)) * 100)}%</span>
                </div>
                <Bar value={done / Math.max(req, 1)} color={s.color} label={`${s.name} coverage`} />
                <Disclosure label="Topics" className="mt-2" triggerClassName="!px-2.5 !py-0.5 !text-xs">
                  <div className="flex flex-wrap gap-2">{s.topics.map((t) => <span key={t.id} className="inline-flex items-center gap-1.5 text-sm font-bold">{t.name} <Strength confidence={t.confidence} showValue={false} /></span>)}</div>
                </Disclosure>
              </div>
            );
          })}
        </div>
      </Card>

      {recent.length > 0 && (
        <Card index={6} className="mt-6">
          <h2 className="mb-4 text-3xl">Recent sessions</h2>
          <ul className="divide-y-2 divide-ink/10">
            {recent.map((h) => {
              const s = state.subjects.find((x) => x.id === h.subjectId);
              const t = s?.topics.find((x) => x.id === h.topicId);
              if (!s || !t) return null;
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-bold">{t.name} <span className="font-semibold text-ink-soft">· {s.name} · {relDay(today, h.date)}</span></span>
                  <span className="text-sm font-extrabold">
                    {h.status === "done" ? `${fmtMinutes(h.minutes)} done${h.confidenceAfter != null ? ` · now ${h.confidenceAfter}%` : ""}` : `${h.status === "skipped" ? "Skipped" : "Moved"} · ${fmtMinutes(h.missed || 0)} rescheduled`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Container>
  );
}
