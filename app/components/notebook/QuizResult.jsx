"use client";
import { useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import TopicPicker, { guessTopic } from "./TopicPicker";
import { actions } from "@/lib/store";
import { relDay } from "@/lib/dates";
import { notify } from "@/lib/toast";

/** Take the quiz, see the score, save it to the planner topic, and add revision if it went badly. */
export default function QuizResult({ questions, subject, today, context, onCite }) {
  const [answers, setAnswers] = useState({});
  const [topic, setTopic] = useState(() => guessTopic([subject], context));
  const [saved, setSaved] = useState(null);
  const done = Object.keys(answers).length === questions.length;
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  const [subjectId, topicId] = topic.split(":");

  const save = () => {
    const { before, after } = actions.recordQuiz({ subjectId, topicId, correct, total: questions.length, source: context });
    setSaved({ before, after });
    notify(`Score saved. Confidence ${before}% → ${after}%.`);
  };
  const addRevision = () => {
    const date = actions.addRevisionSession({ subjectId, topicId, minutes: 30, reason: `Quiz score ${correct}/${questions.length}: revise with your notes` });
    notify(date ? `30-min revision added ${relDay(today, date).toLowerCase()}.` : "No free buffer before that exam. Try Crunch Mode on the Planner.");
  };

  return (
    <div className="grid gap-4">
      {questions.map((q, i) => (
        <fieldset key={i} className="rounded-2xl border-2 border-ink bg-paper p-4">
          <legend className="sr-only">Question {i + 1}</legend>
          <p className="font-extrabold">{i + 1}. {q.question}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((o, j) => {
              const picked = answers[i] === j;
              const reveal = answers[i] !== undefined;
              const state_ = reveal && j === q.answer ? "bg-[hsl(150_55%_88%)]" : picked ? "bg-bubble-soft" : "bg-cream";
              return (
                <button key={j} type="button" disabled={reveal} onClick={() => setAnswers({ ...answers, [i]: j })}
                  className={`flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2 text-left font-bold ${state_}`}>
                  {reveal && j === q.answer && <Check size={15} className="shrink-0" />}
                  {reveal && picked && j !== q.answer && <X size={15} className="shrink-0" />}
                  {o}
                </button>
              );
            })}
          </div>
          {answers[i] !== undefined && q.explanation && (
            <p className="mt-2 text-sm font-semibold text-ink-soft">
              {q.explanation} {q.source && <button type="button" className="font-extrabold underline" onClick={() => onCite(q.source)}>Source {q.source}</button>}
            </p>
          )}
        </fieldset>
      ))}

      {done && (
        <div className="grid gap-3 rounded-2xl border-2 border-ink bg-sun p-4">
          <p className="font-display text-3xl font-extrabold">{correct}/{questions.length} correct · {Math.round((correct / questions.length) * 100)}%</p>
          {subject.topics.length > 0 && !saved && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 grow"><TopicPicker subjects={[subject]} value={topic} onChange={setTopic} label="Save this score to topic" /></div>
              <Button variant="cobalt" onClick={save}>Save to progress</Button>
            </div>
          )}
          {saved && <p className="font-bold">Saved. Confidence moved {saved.before}% → {saved.after}%, and your plan's priorities will follow.</p>}
          {correct / questions.length < 0.6 && subjectId && (
            <Button className="justify-self-start" onClick={addRevision}><CalendarPlus size={16} /> Add a 30-min revision session</Button>
          )}
        </div>
      )}
    </div>
  );
}
