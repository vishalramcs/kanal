"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import OptionWheel from "@/components/ui/OptionWheel";
import Button from "@/components/ui/Button";
import TopicFields from "./TopicFields";
import { DIFFICULTY, SUBJECT_COLORS, blankTopic } from "@/lib/subjects";

const field = "min-h-11 w-full rounded-xl border-2 border-ink bg-paper px-3 font-semibold aria-[invalid=true]:border-weak aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-bubble-soft";
const FieldError = ({ children }) => (children ? <span className="text-sm font-bold text-weak">{children}</span> : null);

/** Subject form: name, exam date, difficulty (React Bits OptionWheel), colour, topics. */
export default function SubjectEditor({ value, onChange, errors = {} }) {
  const [wheelKey] = useState(value.id);
  const set = (patch) => onChange({ ...value, ...patch });
  const setTopic = (t) => set({ topics: value.topics.map((x) => (x.id === t.id ? t : x)) });

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 font-extrabold">
          Subject
          <input className={field} value={value.name} maxLength={60} placeholder="e.g. Data Structures" aria-invalid={!!errors.name} onChange={(e) => set({ name: e.target.value })} />
          <FieldError>{errors.name}</FieldError>
        </label>
        <label className="grid gap-1.5 font-extrabold">
          Exam date
          <input type="date" className={field} value={value.examDate} aria-invalid={!!errors.examDate} onChange={(e) => set({ examDate: e.target.value })} />
          <FieldError>{errors.examDate}</FieldError>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="font-extrabold">Difficulty · <span className="text-ink-soft">{DIFFICULTY[value.difficulty - 1]}</span></span>
          <div className="relative h-40 overflow-hidden rounded-2xl border-2 border-ink bg-ink">
            <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 rounded-xl border-2 border-sun/60" />
            <OptionWheel key={wheelKey} label="Difficulty" items={DIFFICULTY} defaultSelected={value.difficulty - 1} onChange={(i) => set({ difficulty: i + 1 })} activeColor="#ffd12b" />
          </div>
          <span className="text-sm text-ink-soft">Scroll, drag or use the arrow keys.</span>
        </div>
        <div className="grid content-start gap-2">
          <span className="font-extrabold">Colour</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={value.color === c} onClick={() => set({ color: c })}
                className="size-9 rounded-full border-2 border-ink aria-pressed:ring-4 aria-pressed:ring-ink/30" style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <span className="font-extrabold">Topics <span className="font-semibold text-ink-soft">· how strong you feel in each</span></span>
        <FieldError>{errors.topics}</FieldError>
        {value.topics.map((t) => (
          <TopicFields key={t.id} topic={t} onChange={setTopic} canRemove={value.topics.length > 1} onRemove={() => set({ topics: value.topics.filter((x) => x.id !== t.id) })} />
        ))}
        <Button size="sm" className="justify-self-start" onClick={() => set({ topics: [...value.topics, blankTopic(value.topics.length)] })}>
          <Plus size={14} /> Add topic
        </Button>
      </div>
    </div>
  );
}
