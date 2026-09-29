"use client";
import { Trash2 } from "lucide-react";
import { Strength } from "@/components/ui/Meters";
import { WEIGHTS } from "@/lib/subjects";

/** One editable topic: name, hours, confidence, syllabus weight. */
export default function TopicFields({ topic, onChange, onRemove, canRemove }) {
  const set = (patch) => onChange({ ...topic, ...patch });
  return (
    <div className="grid gap-3 rounded-2xl border-2 border-ink/20 bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-h-11 min-w-40 grow rounded-xl border-2 border-ink bg-cream px-3 font-semibold"
          value={topic.name} maxLength={60} placeholder="Topic name" aria-label="Topic name"
          onChange={(e) => set({ name: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Hours
          <input
            type="number" min="0.5" max="20" step="0.5" className="min-h-11 w-20 rounded-xl border-2 border-ink bg-cream px-2 font-semibold"
            value={topic.estMinutes / 60}
            onChange={(e) => set({ estMinutes: Math.round(Math.max(0.5, Math.min(20, Number(e.target.value) || 0.5)) * 60) })}
          />
        </label>
        <button type="button" onClick={onRemove} disabled={!canRemove} aria-label={`Remove ${topic.name || "topic"}`} className="grid size-10 place-items-center rounded-full border-2 border-ink disabled:opacity-30">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid gap-3">
        <label className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm font-extrabold sm:flex">
          <span className="col-span-2">Confidence</span>
          <input
            type="range" min="0" max="100" step="5" className="min-w-0 grow accent-[var(--color-cobalt)]"
            value={topic.confidence} aria-label={`Confidence for ${topic.name || "topic"}`}
            onChange={(e) => set({ confidence: Number(e.target.value) })}
          />
          {/* Fixed-width slot: the badge text changes length while dragging ("Okay · 50%" → "Strong · 100%");
              without this the slider resizes under the cursor and jumps. */}
          <span className="w-[7.75rem] shrink-0 tabular-nums">
            <Strength confidence={topic.confidence} />
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Syllabus weight">
          <span className="mr-1 text-sm font-extrabold">Syllabus weight</span>
          {WEIGHTS.map((w) => (
            <button
              key={w.value} type="button" aria-pressed={topic.weight === w.value} onClick={() => set({ weight: w.value })}
              className="rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold aria-pressed:bg-ink aria-pressed:text-cream"
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
