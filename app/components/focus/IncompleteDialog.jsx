"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { fmtMinutes } from "@/lib/dates";

/** "No problem, let's adapt": pick how much was done; the rest is redistributed. */
export default function IncompleteDialog({ open, planned, elapsed, topic, onConfirm, onClose }) {
  const options = [0, 10, 15, 20, 30].filter((m) => m < planned);
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (open) setDone(options.reduce((best, m) => (m <= elapsed ? m : best), 0));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} title="No problem. Let's adapt." onClose={onClose}>
      <p className="text-ink-soft">How much of the {fmtMinutes(planned)} did you get done?</p>
      <div className="my-5 flex flex-wrap gap-2" role="group" aria-label="Minutes completed">
        {options.map((m) => (
          <button key={m} type="button" aria-pressed={done === m} onClick={() => setDone(m)}
            className="min-h-10 rounded-full border-2 border-ink px-4 font-extrabold aria-pressed:bg-ink aria-pressed:text-cream">
            {m} min
          </button>
        ))}
      </div>
      <p className="rounded-2xl border-2 border-ink bg-sun-soft px-4 py-3 font-semibold">
        The other <b>{fmtMinutes(planned - done)}</b> of {topic?.name} will move into the next few days&apos; buffers. Nothing else gets squeezed.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose}>Keep studying</Button>
        <Button variant="cobalt" onClick={() => onConfirm(done)}>Adapt my plan</Button>
      </div>
    </Modal>
  );
}
