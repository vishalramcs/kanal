"use client";
import { useEffect, useState } from "react";
import { Check, CircleSlash, Pause, Play, SkipForward } from "lucide-react";
import Button from "@/components/ui/Button";
import { Ring } from "@/components/ui/Meters";
import { getState } from "@/lib/store";
import { fmtMinutes } from "@/lib/dates";

const pad = (n) => String(n).padStart(2, "0");

export function secondsLeft(session) {
  if (session.pausedLeft != null) return session.pausedLeft;
  return Math.max(0, Math.round(session.minutes * 60 - (Date.now() - session.startedAt) / 1000));
}

/** Countdown with pause / complete / skip / "couldn't complete". Survives reloads (state lives in the store). */
export default function SessionTimer({ session, subject, topic, onPause, onComplete, onSkip, onIncomplete }) {
  const total = session.minutes * 60;
  const [left, setLeft] = useState(() => secondsLeft(session));
  const paused = session.pausedLeft != null;

  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(getState()?.session || session)), 500);
    return () => clearInterval(id);
  }, [session]);
  useEffect(() => {
    document.title = `${pad(Math.floor(left / 60))}:${pad(left % 60)} · ${topic.name}`;
    return () => { document.title = "ADAPT · AI Study Planner"; };
  }, [left, topic.name]);
  useEffect(() => { if (left === 0) onComplete(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid justify-items-center gap-6 text-center">
      <p className="flex flex-wrap items-center justify-center gap-2 font-extrabold">
        <span className="size-3 rounded-full border-2 border-ink" style={{ background: subject.color }} />
        {subject.name} · {fmtMinutes(session.minutes)}
        {paused && <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs">Paused</span>}
      </p>
      <h1 className="text-[clamp(40px,6vw,76px)] leading-[0.95]">{topic.name}</h1>
      <Ring value={(total - left) / total} size={260} stroke={16} color={subject.color}>
        <span className="font-display text-6xl font-extrabold tabular-nums tracking-[-0.04em]">{pad(Math.floor(left / 60))}:{pad(left % 60)}</span>
        <span className="mt-1 block text-sm font-bold text-ink-soft">{Math.round(((total - left) / total) * 100)}% done</span>
      </Ring>
      <p className="text-ink-soft">Phone face down. One topic, full attention.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => onPause(left, paused)}>{paused ? <Play size={16} /> : <Pause size={16} />} {paused ? "Resume" : "Pause"}</Button>
        <Button variant="cobalt" onClick={onComplete}><Check size={16} /> Complete</Button>
        <Button onClick={onSkip}><SkipForward size={16} /> Skip</Button>
      </div>
      <Button variant="bubble" onClick={() => onIncomplete(Math.round((total - left) / 60))}>
        <CircleSlash size={16} /> I couldn&apos;t complete this session
      </Button>
    </div>
  );
}
