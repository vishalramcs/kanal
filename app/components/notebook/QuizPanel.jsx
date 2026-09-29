"use client";
import { useState } from "react";
import { ListChecks } from "lucide-react";
import Button from "@/components/ui/Button";
import { SourceDialog } from "./Sources";
import QuizResult from "./QuizResult";
import { runTool } from "@/lib/notebookApi";
import { quizStats } from "@/lib/digest";
import { relDay } from "@/lib/dates";

/** Quiz generator for one subject (count, difficulty, material, topic) + the subject's real quiz history. */
export default function QuizPanel({ subject, state, today, materials, topic, setTopic }) {
  const ready = materials.filter((m) => m.status === "ready");
  const [options, setOptions] = useState({ count: 5, difficulty: "medium", material: "" });
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setQuiz(null);
    try {
      setQuiz(await runTool(subject.id, { tool: "quiz", topic, materialIds: options.material ? [options.material] : [], options: { count: options.count, difficulty: options.difficulty } }));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const history = [...(state.history || [])].filter((h) => h.status === "quiz" && h.subjectId === subject.id).reverse().slice(0, 6);
  const stats = quizStats(state.history, subject.id);
  const field = "min-h-11 rounded-xl border-2 border-ink bg-cream px-3 font-bold";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="grid content-start gap-4 rounded-3xl border-2 border-ink bg-paper p-5 shadow-hard" aria-label="Generate quiz">
        <h2 className="text-2xl">Generate a quiz</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-extrabold">Material
            <select value={options.material} onChange={(e) => setOptions({ ...options, material: e.target.value })} className={field}>
              <option value="">Entire subject</option>
              {ready.map((m) => <option key={m.id} value={m.id}>{m.filename}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">Topic <span className="font-semibold text-ink-soft">(optional)</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="e.g. AVL trees" className={field} />
          </label>
          <label className="grid gap-1 text-sm font-extrabold">Questions
            <select value={options.count} onChange={(e) => setOptions({ ...options, count: Number(e.target.value) })} className={field}>
              {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">Difficulty
            <select value={options.difficulty} onChange={(e) => setOptions({ ...options, difficulty: e.target.value })} className={field}>
              {["easy", "medium", "hard"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
          </label>
        </div>
        <Button variant="cobalt" className="justify-self-start" disabled={!ready.length || busy} onClick={generate}>
          <ListChecks size={16} /> {busy ? "Writing your quiz…" : "Generate quiz"}
        </Button>
        {!ready.length && <p className="font-semibold text-ink-soft">Upload your first study material to generate quizzes from it.</p>}
        {error && <p role="alert" className="rounded-2xl border-2 border-ink bg-bubble-soft px-4 py-2.5 font-bold">{error}</p>}
        {quiz && (quiz.data.questions.length ? (
          <>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{quiz.source === "gemini" ? `Gemini · from your ${subject.name} materials` : "Built from your materials"}</p>
            <QuizResult key={JSON.stringify(quiz.data.questions[0])} questions={quiz.data.questions} subject={subject} today={today} context={`${topic} ${quiz.topic || ""}`}
              onCite={(n) => setViewing(quiz.sources.find((s) => s.n === n))} />
          </>
        ) : <p className="font-semibold">Not enough material for a quiz yet. Try the entire subject or another material.</p>)}
        <SourceDialog subjectId={subject.id} source={viewing} onClose={() => setViewing(null)} />
      </section>

      <aside className="grid content-start gap-3 rounded-3xl border-2 border-ink bg-sun-soft p-5 shadow-hard" aria-label="Quiz history">
        <h2 className="text-xl">Quiz history</h2>
        <p className="font-display text-4xl font-extrabold">{stats.accuracy === null ? "—" : `${stats.accuracy}%`}</p>
        <p className="text-sm font-bold text-ink-soft">{stats.quizzes ? `accuracy over ${stats.quizzes} quiz${stats.quizzes > 1 ? "zes" : ""}` : "No quizzes yet"}</p>
        <ul className="grid gap-2">
          {history.map((h) => {
            const t = subject.topics.find((x) => x.id === h.topicId);
            return (
              <li key={h.id} className="flex justify-between gap-2 rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm font-bold">
                <span className="min-w-0 truncate">{t?.name || "Topic"} · {relDay(today, h.date)}</span>
                <span>{h.score.correct}/{h.score.total}</span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
