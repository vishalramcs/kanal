"use client";
import { useState } from "react";
import { BookOpenCheck, CalendarRange, Layers, ListChecks, Sparkles, Star, Wand2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { SourceDialog } from "./Sources";
import MaterialPlanDialog from "./MaterialPlanDialog";
import { runTool } from "@/lib/notebookApi";

const ACTIONS = [
  { id: "summary", label: "Summarize", icon: BookOpenCheck },
  { id: "simple", label: "Explain simply", icon: Wand2 },
  { id: "keypoints", label: "Important points", icon: Star },
  { id: "flashcards", label: "Generate flashcards", icon: Layers },
  { id: "explain", label: "Explain topic", icon: Sparkles, needsTopic: true },
  { id: "plan", label: "Create study plan", icon: CalendarRange },
];

function Cite({ n, sources, onOpen }) {
  const s = sources.find((x) => x.n === n);
  if (!s) return null;
  return <button type="button" onClick={() => onOpen(s)} className="ml-1 text-xs font-extrabold underline">{s.docName} — {s.location}</button>;
}

function Flashcard({ card, sources, onOpen }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-ink bg-paper">
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped} className="min-h-28 w-full p-4 text-left">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{flipped ? "Answer" : "Question"} · tap to flip</span>
        <span className="mt-1 block font-bold">{flipped ? card.back : card.front}</span>
      </button>
      {flipped && <div className="px-4 pb-3"><Cite n={card.source} sources={sources} onOpen={onOpen} /></div>}
    </div>
  );
}

/** One-click study material from this subject's selected materials. */
export default function NotebookActions({ subject, state, today, scope, scopeLabel, hasMaterials, topic, setTopic, onQuiz }) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);

  const run = async (action) => {
    setBusy(action.id);
    setError(null);
    setResult(null);
    try {
      const res = await runTool(subject.id, { tool: action.id, materialIds: scope ? [scope] : [], topic: action.needsTopic || action.id === "flashcards" ? topic : "" });
      setResult(res);
      if (action.id === "plan") setPlanOpen(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  };

  const d = result?.data;
  const src = result?.sources || [];
  return (
    <section className="grid content-start gap-4 rounded-3xl border-2 border-ink bg-paper p-5 shadow-hard" aria-label="Notebook actions">
      <div>
        <h2 className="text-xl">Notebook actions</h2>
        <p className="text-sm font-bold text-ink-soft">Using: {scopeLabel}</p>
      </div>
      <label className="grid gap-1 text-sm font-extrabold">
        Topic <span className="font-semibold text-ink-soft">(optional; needed for “Explain topic”)</span>
        <input value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. AVL rotations"
          className="min-h-11 rounded-xl border-2 border-ink bg-cream px-3 font-semibold" />
      </label>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button key={a.id} size="sm" variant={a.id === "plan" ? "sun" : "paper"} disabled={!hasMaterials || !!busy || (a.needsTopic && !topic.trim())} onClick={() => run(a)}>
            <a.icon size={15} /> {busy === a.id ? "Working…" : a.label}
          </Button>
        ))}
        <Button size="sm" variant="cobalt" disabled={!hasMaterials} onClick={onQuiz}><ListChecks size={15} /> Generate quiz</Button>
      </div>
      {!hasMaterials && <p className="text-sm font-semibold text-ink-soft">Upload your first study material to start your AI Notebook.</p>}
      {error && <p role="alert" className="rounded-2xl border-2 border-ink bg-bubble-soft px-4 py-2.5 font-bold">{error}</p>}

      {result && (
        <div className="grid gap-3" aria-live="polite">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{result.source === "gemini" ? `Gemini · from your ${subject.name} materials` : "Built from your materials"}</p>
          {result.tool === "summary" && (
            <div className="rounded-2xl border-2 border-ink bg-cream p-4">
              <h3 className="text-2xl">{d.title}</h3>
              <p className="mt-2 font-semibold">{d.summary}</p>
              <div className="mt-2 flex flex-wrap">{(d.sources || []).slice(0, 6).map((n) => <Cite key={n} n={n} sources={src} onOpen={setViewing} />)}</div>
            </div>
          )}
          {(result.tool === "explain" || result.tool === "simple") && <p className="whitespace-pre-line rounded-2xl border-2 border-ink bg-cream p-4 font-semibold">{d.explanation}</p>}
          {result.tool === "keypoints" && (
            <ol className="grid list-decimal gap-2 pl-6 font-semibold">{d.points.map((p, i) => <li key={i}>{p.point}<Cite n={p.source} sources={src} onOpen={setViewing} /></li>)}</ol>
          )}
          {result.tool === "flashcards" && (d.cards.length
            ? <div className="grid gap-3 sm:grid-cols-2">{d.cards.map((c, i) => <Flashcard key={i} card={c} sources={src} onOpen={setViewing} />)}</div>
            : <p className="font-semibold">No flashcards could be made from this selection. Try another material or topic.</p>)}
          {result.tool === "plan" && (
            <p className="font-semibold">Found {d.topics.length} topics. <button type="button" className="font-extrabold underline" onClick={() => setPlanOpen(true)}>Review and add to {subject.name}</button></p>
          )}
        </div>
      )}
      {planOpen && result?.tool === "plan" && <MaterialPlanDialog open subject={subject} topics={d.topics} onClose={() => setPlanOpen(false)} />}
      <SourceDialog subjectId={subject.id} source={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}
