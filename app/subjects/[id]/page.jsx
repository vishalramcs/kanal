"use client";
import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, ListChecks, MessageCircle, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { quizStats } from "@/lib/digest";
import { daysBetween, fmtMinutes, inDays, niceDate, relDay } from "@/lib/dates";
import { requiredMinutes, subjectConfidence } from "@/lib/priority";
import { textOn } from "@/lib/subjects";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Bar, Strength } from "@/components/ui/Meters";
import { Container, Empty, Loading } from "@/components/ui/Page";
import MaterialsPanel from "@/components/notebook/MaterialsPanel";
import NotebookChat from "@/components/notebook/NotebookChat";
import NotebookActions from "@/components/notebook/NotebookActions";
import QuizPanel from "@/components/notebook/QuizPanel";
import WeakTopics from "@/components/notebook/WeakTopics";
import { useMaterials } from "@/components/notebook/useMaterials";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Materials" },
  { id: "notebook", label: "Notebook" },
  { id: "quiz", label: "Quiz" },
  { id: "progress", label: "Progress" },
];

function Stat({ icon: Icon, label, value, index }) {
  return (
    <Card index={index} className="!p-4">
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-soft"><Icon size={14} /> {label}</p>
      <p className="mt-1.5 truncate font-display text-3xl font-extrabold leading-tight">{value}</p>
    </Card>
  );
}

function Workspace({ subject, state }) {
  const today = state.plan?.generatedFor;
  const { materials, conversationCount, loading, error, refresh } = useMaterials(subject.id);
  const [tab, setTabState] = useState("overview");
  const [scope, setScope] = useState("");
  const [topic, setTopic] = useState("");
  const [prefill, setPrefill] = useState("");
  const clearPrefill = useCallback(() => setPrefill(""), []);

  // Tab lives in the URL (?tab=notebook) so it survives refresh and can be linked to.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((x) => x.id === t)) setTabState(t);
  }, []);
  const setTab = (t) => {
    setTabState(t);
    window.history.replaceState(null, "", `?tab=${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ready = materials.filter((m) => m.status === "ready");
  const scopeMaterial = ready.find((m) => m.id === scope);
  const scopeLabel = scopeMaterial ? scopeMaterial.filename : `All ${subject.name} materials (${ready.length})`;
  const quiz = quizStats(state.history, subject.id);
  const weakest = [...subject.topics].sort((a, b) => a.confidence - b.confidence).find((t) => t.confidence < 45);
  const dl = daysBetween(today, subject.examDate);
  const required = subject.topics.reduce((a, t) => a + requiredMinutes(t, subject), 0);
  const covered = subject.topics.reduce((a, t) => a + Math.min(t.doneMinutes, requiredMinutes(t, subject)), 0);
  const starters = [weakest ? `Explain ${weakest.name} simply` : "What are the main ideas?", "What are the most important points for the exam?", "Quiz me with 3 quick questions"];

  const ask = (name) => { setPrefill(`Explain ${name} using my materials, then tell me how to revise it for the exam.`); setTab("notebook"); };
  const flashcardsFor = (name) => { setTopic(name); setTab("notebook"); };
  const quizFor = (name) => { setTopic(name); setTab("quiz"); };

  return (
    <>
      <section className="border-b-2 border-ink" style={{ background: subject.color, color: textOn(subject.color) }}>
        <Container className="pb-5 pt-6">
          <Link href="/subjects" className="inline-flex items-center gap-1 text-sm font-extrabold hover:underline"><ArrowLeft size={15} /> Subjects</Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-[clamp(34px,5vw,60px)] leading-[0.95]">{subject.name}</h1>
            <p className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-extrabold text-ink">
              Exam {niceDate(subject.examDate)} · {dl >= 0 ? inDays(dl) : "passed"}
            </p>
          </div>
        </Container>
        <div className="border-t-2 border-ink bg-cream text-ink">
          <Container>
            <div role="tablist" aria-label={`${subject.name} workspace`} className="-mx-1 flex gap-1 overflow-x-auto py-2">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className="shrink-0 rounded-full border-2 border-transparent px-4 py-1.5 font-extrabold hover:border-ink aria-selected:border-ink aria-selected:bg-ink aria-selected:text-cream">
                  {t.label}
                </button>
              ))}
            </div>
          </Container>
        </div>
      </section>

      <Container className="py-8">
        {tab === "overview" && (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat index={0} icon={FileText} label="Materials" value={loading ? "…" : materials.length} />
              <Stat index={1} icon={MessageCircle} label="Notebook chats" value={loading ? "…" : conversationCount} />
              <Stat index={2} icon={ListChecks} label="Quiz accuracy" value={quiz.accuracy === null ? "—" : `${quiz.accuracy}%`} />
              <Stat index={3} icon={TriangleAlert} label="Weak topic" value={weakest?.name || "None"} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="sun" onClick={() => setTab("notebook")}><BookOpen size={16} /> Open notebook</Button>
              <Button onClick={() => setTab("materials")}><FileText size={16} /> View materials</Button>
              <Button onClick={() => setTab("quiz")}><ListChecks size={16} /> Generate quiz</Button>
            </div>
            {weakest && ready.length > 0 && (
              <Card index={4} tone="soft">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em]">Next best step</p>
                <p className="mt-1 text-lg font-bold">
                  Review {weakest.name} from your {subject.name} materials for 30 minutes, then attempt a 5-question quiz.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => ask(weakest.name)}>Explain {weakest.name}</Button>
                  <Button size="sm" onClick={() => quizFor(weakest.name)}>Quiz me</Button>
                </div>
              </Card>
            )}
            <WeakTopics subject={subject} state={state} today={today} onAsk={ask} onFlashcards={flashcardsFor} onQuiz={quizFor} />
          </div>
        )}

        {tab === "materials" && <MaterialsPanel subject={subject} materials={materials} loading={loading} error={error} onRetry={refresh} onChange={refresh} />}

        {tab === "notebook" && (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <NotebookChat subject={subject} materials={materials} scope={scope} setScope={setScope} prefill={prefill} onPrefillUsed={clearPrefill} starters={starters} onAnswered={refresh} />
            <NotebookActions subject={subject} state={state} today={today} scope={scope} scopeLabel={scopeLabel} hasMaterials={ready.length > 0} topic={topic} setTopic={setTopic} onQuiz={() => setTab("quiz")} />
          </div>
        )}

        {tab === "quiz" && <QuizPanel subject={subject} state={state} today={today} materials={materials} topic={topic} setTopic={setTopic} />}

        {tab === "progress" && (
          <div className="grid gap-6">
            <Card>
              <div className="mb-2 flex flex-wrap justify-between gap-2 font-extrabold">
                <span>Syllabus covered</span>
                <span>{Math.round((covered / Math.max(required, 1)) * 100)}% · {fmtMinutes(Math.max(0, required - covered))} left</span>
              </div>
              <Bar value={covered / Math.max(required, 1)} color={subject.color} label={`${subject.name} coverage`} />
              <p className="mt-3 flex flex-wrap items-center gap-2 font-semibold">Overall confidence <Strength confidence={subjectConfidence(subject)} /></p>
            </Card>
            <Card index={1}>
              <h2 className="mb-4 text-2xl">Topics</h2>
              {!subject.topics.length && <Empty title="No topics yet">Edit the subject to add topics, or create them from your material in the Notebook.</Empty>}
              <ul className="grid gap-2.5">
                {subject.topics.map((t) => {
                  const q = quizStats(state.history, subject.id, t.id);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/10 pb-2.5">
                      <span className="font-extrabold">{t.name} <span className="font-semibold text-ink-soft">· {fmtMinutes(t.doneMinutes)} studied</span></span>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        {q.accuracy !== null && <span>Quiz {q.accuracy}%</span>}
                        <Strength confidence={t.confidence} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card index={2}>
              <h2 className="mb-4 text-2xl">Recent activity</h2>
              <ul className="grid gap-2">
                {[...state.history].filter((h) => h.subjectId === subject.id).reverse().slice(0, 8).map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 text-sm font-bold">
                    <span className="min-w-0 truncate">{subject.topics.find((t) => t.id === h.topicId)?.name || "Topic"} · {relDay(today, h.date)}</span>
                    <span>{h.status === "quiz" ? `Quiz ${h.score.correct}/${h.score.total}` : h.status === "done" ? `${fmtMinutes(h.minutes)} studied` : "Rescheduled"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Container>
    </>
  );
}

export default function SubjectWorkspacePage({ params }) {
  const { id } = use(params);
  const state = useStore();
  if (!state?.plan) return <Loading />;
  const subject = state.subjects.find((s) => s.id === decodeURIComponent(id));
  if (!subject) {
    return (
      <Container className="py-16">
        <Empty title="Subject not found" action={<Button href="/subjects" variant="sun">Back to subjects</Button>}>It may have been deleted.</Empty>
      </Container>
    );
  }
  return <Workspace key={subject.id} subject={subject} state={state} />;
}
