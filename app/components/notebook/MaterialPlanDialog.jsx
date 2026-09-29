"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { actions } from "@/lib/store";
import { notify } from "@/lib/toast";

/**
 * "Create study plan from this material": review the detected topics and add them to this subject.
 * The existing planner engine then schedules them around the exam date, free time and weak spots.
 */
export default function MaterialPlanDialog({ open, subject, topics, onClose }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => topics.map((t) => ({ ...t, include: true })));
  const [error, setError] = useState(null);
  const patch = (i, change) => setRows(rows.map((x, j) => (j === i ? { ...x, ...change } : x)));

  const confirm = () => {
    const chosen = rows.filter((r) => r.include && r.name.trim());
    if (!chosen.length) return setError("Pick at least one topic.");
    const added = actions.addMaterialTopics({ subject, topics: chosen.map((r) => ({ name: r.name, hours: Math.max(0.5, Math.min(20, Number(r.hours) || 1)) })) });
    notify(added ? `${added} topic${added > 1 ? "s" : ""} added to ${subject.name}. Your plan has been rebuilt.` : "Those topics were already in your plan.");
    onClose();
    router.push("/planner");
    return undefined;
  };

  return (
    <Modal open={open} wide title={`Study plan from your ${subject.name} material`} onClose={onClose}>
      <p className="text-ink-soft">These topics were found in your material. Adjust them and the planner schedules them before your exam on {subject.examDate}.</p>
      <ul className="mt-4 grid max-h-80 gap-2 overflow-auto">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink/20 bg-paper px-3 py-2">
            <input type="checkbox" checked={r.include} aria-label={`Include ${r.name}`} className="size-4 accent-[var(--color-cobalt)]" onChange={(e) => patch(i, { include: e.target.checked })} />
            <input value={r.name} maxLength={60} aria-label="Topic name" className="min-w-0 grow rounded-lg border-2 border-ink/30 bg-cream px-2 py-1 font-bold" onChange={(e) => patch(i, { name: e.target.value })} />
            <label className="flex items-center gap-1 text-sm font-extrabold">
              <input type="number" min="0.5" max="20" step="0.5" value={r.hours} aria-label={`Hours for ${r.name}`} className="w-16 rounded-lg border-2 border-ink/30 bg-cream px-1 py-1 font-bold" onChange={(e) => patch(i, { hours: e.target.value })} />h
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 font-bold text-weak">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="cobalt" onClick={confirm}>Add to {subject.name}</Button>
      </div>
    </Modal>
  );
}
