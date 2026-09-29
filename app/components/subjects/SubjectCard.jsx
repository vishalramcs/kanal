"use client";
import Link from "next/link";
import { BookOpen, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Disclosure from "@/components/ui/Disclosure";
import { Bar, Strength } from "@/components/ui/Meters";
import { daysBetween, fmtMinutes, inDays, niceDate } from "@/lib/dates";
import { requiredMinutes, subjectConfidence } from "@/lib/priority";
import { DIFFICULTY, textOn } from "@/lib/subjects";

/** Subject summary. Topic-level detail sits behind a disclosure to keep the page calm. */
export default function SubjectCard({ subject, today, index, onEdit, onDelete }) {
  const required = subject.topics.reduce((a, t) => a + requiredMinutes(t, subject), 0);
  const covered = subject.topics.reduce((a, t) => a + Math.min(t.doneMinutes, requiredMinutes(t, subject)), 0);
  const weak = subject.topics.filter((t) => t.confidence < 45).length;

  return (
    <Card index={index} className="!p-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink px-5 py-4" style={{ background: subject.color, color: textOn(subject.color) }}>
        <div>
          <h2 className="text-2xl leading-tight"><Link href={`/subjects/${encodeURIComponent(subject.id)}`} className="hover:underline">{subject.name}</Link></h2>
          <p className="text-sm font-extrabold">Exam {niceDate(subject.examDate)} · {inDays(daysBetween(today, subject.examDate))}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onEdit} aria-label={`Edit ${subject.name}`} className="grid size-9 place-items-center rounded-full border-2 border-ink bg-paper text-ink"><Pencil size={15} /></button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${subject.name}`} className="grid size-9 place-items-center rounded-full border-2 border-ink bg-paper text-ink"><Trash2 size={15} /></button>
        </div>
      </div>
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Strength confidence={subjectConfidence(subject)} />
          <span className="rounded-full border-2 border-ink/20 px-2.5 py-0.5 text-xs font-extrabold">{DIFFICULTY[subject.difficulty - 1]}</span>
          {weak > 0 && <span className="rounded-full bg-bubble-soft px-2.5 py-0.5 text-xs font-extrabold text-weak">{weak} weak topic{weak > 1 ? "s" : ""}</span>}
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-sm font-bold"><span className="text-ink-soft">Covered</span><span>{Math.round((covered / Math.max(required, 1)) * 100)}% · {fmtMinutes(Math.max(0, required - covered))} left</span></div>
          <Bar value={covered / Math.max(required, 1)} color={subject.color} label={`${subject.name} coverage`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="sun" href={`/subjects/${encodeURIComponent(subject.id)}`}><BookOpen size={14} /> Open workspace</Button>
          <Button size="sm" href={`/subjects/${encodeURIComponent(subject.id)}?tab=notebook`}>Notebook</Button>
          <Button size="sm" href={`/subjects/${encodeURIComponent(subject.id)}?tab=materials`}>Materials</Button>
        </div>
        <Disclosure label={`${subject.topics.length} topics`}>
          <ul className="grid gap-2">
            {subject.topics.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-bold">{t.name}{t.missedMinutes > 0 && <span className="font-semibold text-ink-soft"> · {fmtMinutes(t.missedMinutes)} backlog</span>}</span>
                <Strength confidence={t.confidence} />
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </Card>
  );
}
