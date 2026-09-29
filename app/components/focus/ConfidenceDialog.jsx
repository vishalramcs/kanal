"use client";
import Modal from "@/components/ui/Modal";
import { CONFIDENCE_LEVELS } from "@/lib/priority";

const FACES = ["😣", "😕", "🙂", "😊", "💪"];

/** After a completed session: "How confident are you now?" updates the topic's confidence. */
export default function ConfidenceDialog({ open, topic, onPick, onClose }) {
  return (
    <Modal open={open} title="How confident are you now?" onClose={onClose}>
      <p className="mb-5 text-ink-soft">{topic?.name} was at {topic?.confidence}%. Your answer reshapes what comes next.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CONFIDENCE_LEVELS.map((c, i) => (
          <button
            key={c.label} type="button" onClick={() => onPick(c.value)}
            className="grid justify-items-center gap-1 rounded-2xl border-2 border-ink bg-paper px-2 py-4 font-extrabold shadow-hard-sm transition-transform hover:-translate-y-1 hover:bg-sun-soft"
          >
            <span className="text-2xl" aria-hidden="true">{FACES[i]}</span>
            {c.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
