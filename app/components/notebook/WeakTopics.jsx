"use client";
import { CalendarPlus, Layers, ListChecks, MessageCircle } from "lucide-react";
import { Strength } from "@/components/ui/Meters";
import { actions } from "@/lib/store";
import { quizStats } from "@/lib/digest";
import { relDay } from "@/lib/dates";
import { notify } from "@/lib/toast";

/** This subject's weak topics (real confidence + stored quiz accuracy) with the next best actions. */
export default function WeakTopics({ subject, state, today, onAsk, onFlashcards, onQuiz }) {
  const weak = subject.topics
    .map((t) => ({ t, quiz: quizStats(state.history, subject.id, t.id) }))
    .filter(({ t, quiz }) => t.confidence < 45 || (quiz.accuracy !== null && quiz.accuracy < 60))
    .sort((a, b) => a.t.confidence - b.t.confidence)
    .slice(0, 4);

  if (!weak.length) {
    return (
      <section className="rounded-3xl border-2 border-ink bg-paper p-5 shadow-hard" aria-label="Weak topics">
        <h2 className="text-xl">Weak topics</h2>
        <p className="mt-1 font-semibold text-ink-soft">{subject.topics.length ? "No weak topics right now. Nice." : "Add topics to this subject to track weak spots."}</p>
      </section>
    );
  }

  const revise = (t) => {
    const date = actions.addRevisionSession({ subjectId: subject.id, topicId: t.id, minutes: 30, reason: `Weak topic: revise ${t.name} with your ${subject.name} materials` });
    notify(date ? `30-min ${t.name} revision added ${relDay(today, date).toLowerCase()}.` : `No free buffer before the ${subject.name} exam.`);
  };
  const btn = "grid size-9 place-items-center rounded-full border-2 border-ink bg-paper hover:bg-sun-soft";

  return (
    <section className="rounded-3xl border-2 border-ink bg-bubble-soft p-5 shadow-hard" aria-label="Weak topics">
      <h2 className="text-xl">Weak topics</h2>
      <p className="text-sm font-semibold text-ink-soft">Read it, ask, practise, then schedule revision.</p>
      <ul className="mt-3 grid gap-2">
        {weak.map(({ t, quiz }) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink bg-paper px-3 py-2.5">
            <span className="min-w-0 grow">
              <span className="block truncate font-extrabold">{t.name}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft">
                <Strength confidence={t.confidence} />
                {quiz.accuracy !== null && <span>Quiz accuracy {quiz.accuracy}%</span>}
              </span>
            </span>
            <span className="flex gap-1.5">
              <button type="button" className={btn} aria-label={`Ask the notebook about ${t.name}`} title="Explain from my materials" onClick={() => onAsk(t.name)}><MessageCircle size={15} /></button>
              <button type="button" className={btn} aria-label={`Flashcards for ${t.name}`} title="Flashcards" onClick={() => onFlashcards(t.name)}><Layers size={15} /></button>
              <button type="button" className={btn} aria-label={`Quiz me on ${t.name}`} title="Quiz" onClick={() => onQuiz(t.name)}><ListChecks size={15} /></button>
              <button type="button" className={btn} aria-label={`Add 30 minutes of ${t.name} revision`} title="Add 30-min revision" onClick={() => revise(t)}><CalendarPlus size={15} /></button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
