"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { actions, getState, todayISO, useStore } from "@/lib/store";
import { askAI, planContext } from "@/lib/ai";
import { blankSubject, cleanSubject, validateSubject } from "@/lib/subjects";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Container, Loading } from "@/components/ui/Page";
import SubjectEditor from "@/components/subjects/SubjectEditor";
import StudyTimeFields from "@/components/subjects/StudyTimeFields";

const STEPS = ["You", "Subjects", "Your plan"];
const slide = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 } };

export default function OnboardingPage() {
  const state = useStore();
  if (!state) return <Loading />;
  return <OnboardingFlow initialProfile={state.profile} />;
}

function OnboardingFlow({ initialProfile }) {
  const router = useRouter();
  const today = todayISO();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(() => ({ ...initialProfile, name: "" }));
  const [subjects, setSubjects] = useState(() => [blankSubject(today, 0)]);
  const [active, setActive] = useState(0);
  const [errors, setErrors] = useState({});

  const build = async () => {
    setStep(2);
    actions.finishOnboarding({ ...profile, name: profile.name.trim() }, subjects.map(cleanSubject));
    const result = await askAI("plan", planContext(getState(), today));
    actions.setStrategy({ ...result, for: today });
    setTimeout(() => router.push("/dashboard"), 900);
  };

  const next = () => {
    if (step === 0) {
      if (!profile.name.trim()) return setErrors({ name: "What should we call you?" });
      setErrors({});
      return setStep(1);
    }
    for (let i = 0; i < subjects.length; i++) {
      const e = validateSubject(subjects[i], today, subjects);
      if (Object.keys(e).length) { setActive(i); setErrors(e); return undefined; }
    }
    setErrors({});
    return build();
  };

  return (
    <Container className="max-w-3xl py-12">
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            className="rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold aria-[current=step]:bg-sun">{i + 1}. {s}</li>
        ))}
      </ol>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="you" {...slide}>
            <Card>
              <h1 className="text-[clamp(36px,5vw,56px)] leading-[0.95]">Let&apos;s build a plan that adapts to you.</h1>
              <label className="mt-6 grid gap-1.5 font-extrabold">
                Your name
                <input className="min-h-11 rounded-xl border-2 border-ink bg-paper px-3 font-semibold aria-[invalid=true]:border-weak" value={profile.name} maxLength={40} placeholder="e.g. Priya"
                  aria-invalid={!!errors.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                {errors.name && <span className="text-sm font-bold text-weak">{errors.name}</span>}
              </label>
              <div className="mt-6"><StudyTimeFields profile={profile} onChange={setProfile} /></div>
            </Card>
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key="subjects" {...slide}>
            <Card>
              <h1 className="text-[clamp(36px,5vw,56px)] leading-[0.95]">Your subjects</h1>
              <div className="my-5 flex flex-wrap gap-2">
                {subjects.map((s, i) => (
                  <button key={s.id} type="button" aria-pressed={i === active} onClick={() => { setActive(i); setErrors({}); }}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 font-extrabold aria-pressed:bg-ink aria-pressed:text-cream">
                    <span className="size-2.5 rounded-full border border-ink" style={{ background: s.color }} />{s.name.trim() || `Subject ${i + 1}`}
                  </button>
                ))}
                <Button size="sm" onClick={() => { setSubjects([...subjects, blankSubject(today, subjects.length)]); setActive(subjects.length); setErrors({}); }}><Plus size={14} /> Add</Button>
                {subjects.length > 1 && (
                  <button type="button" aria-label="Remove this subject" className="grid size-9 place-items-center rounded-full border-2 border-ink"
                    onClick={() => { setSubjects(subjects.filter((_, i) => i !== active)); setActive(0); }}><Trash2 size={14} /></button>
                )}
              </div>
              <SubjectEditor key={subjects[active].id} value={subjects[active]} errors={errors} onChange={(v) => setSubjects(subjects.map((s, i) => (i === active ? v : s)))} />
            </Card>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="building" {...slide}>
            <Card tone="sun" className="grid justify-items-center gap-4 py-16 text-center">
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}><Sparkles size={44} /></motion.span>
              <h1 className="text-[clamp(32px,4vw,52px)] leading-none">Building your plan…</h1>
              <p className="max-w-md font-semibold">Scoring every topic, keeping a safety buffer each day, adding breaks, and writing your strategy.</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {step < 2 && (
        <div className="mt-6 flex justify-between">
          <Button onClick={() => (step === 0 ? router.push("/dashboard") : setStep(0))}><ArrowLeft size={16} /> Back</Button>
          <Button variant="cobalt" onClick={next}>{step === 1 ? "Build my plan" : "Next"} <ArrowRight size={16} /></Button>
        </div>
      )}
    </Container>
  );
}
