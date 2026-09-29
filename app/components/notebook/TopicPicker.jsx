"use client";

/** Select a planner topic ("subjectId:topicId"). Used to link quiz scores and revision sessions to the plan. */
export default function TopicPicker({ subjects, value, onChange, label = "Planner topic" }) {
  return (
    <label className="grid gap-1 text-sm font-extrabold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 rounded-xl border-2 border-ink bg-paper px-2 font-bold">
        {subjects.map((s) => (
          <optgroup key={s.id} label={s.name}>
            {s.topics.map((t) => <option key={t.id} value={`${s.id}:${t.id}`}>{t.name} ({t.confidence}%)</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Best guess of which planner topic some text is about: name match first, then the weakest topic. */
export function guessTopic(subjects, text = "") {
  const hay = text.toLowerCase();
  const all = subjects.flatMap((s) => s.topics.map((t) => ({ s, t })));
  const hit = all.find(({ t }) => hay.includes(t.name.toLowerCase())) ||
    all.find(({ t }) => t.name.toLowerCase().split(/\W+/).some((w) => w.length > 4 && hay.includes(w))) ||
    [...all].sort((a, b) => a.t.confidence - b.t.confidence)[0];
  return hit ? `${hit.s.id}:${hit.t.id}` : "";
}
