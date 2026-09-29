"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { actions, useStore } from "@/lib/store";
import { notify } from "@/lib/toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Container, Loading, PageHeader } from "@/components/ui/Page";
import StudyTimeFields from "@/components/subjects/StudyTimeFields";

function SettingsForm({ initial }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [gemini, setGemini] = useState(null);
  const dirty = JSON.stringify(profile) !== JSON.stringify(initial);
  useEffect(() => {
    fetch("/api/gemini").then((r) => r.json()).then((j) => setGemini(j.configured)).catch(() => setGemini(false));
  }, []);
  const save = () => {
    actions.updateProfile({ ...profile, name: profile.name.trim() || "Student" });
    notify("Saved. Your plan has been rebuilt.");
  };

  return (
    <Container>
      <PageHeader eyebrow="Settings" title="Make it fit you">
        <Button variant="cobalt" onClick={save} disabled={!dirty}>Save & rebuild plan</Button>
      </PageHeader>
      <div className="grid max-w-3xl gap-6">
        <Card>
          <label className="grid gap-1.5 font-extrabold">
            Your name
            <input className="min-h-11 rounded-xl border-2 border-ink bg-paper px-3 font-semibold" value={profile.name} maxLength={40} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </label>
        </Card>
        <Card index={1}>
          <h2 className="mb-4 text-2xl">Study time</h2>
          <StudyTimeFields profile={profile} onChange={setProfile} />
          <label className="mt-6 grid gap-2 font-extrabold">
            Safety buffer · {Math.round(profile.bufferPct * 100)}% of each day
            <input type="range" min="0.15" max="0.25" step="0.01" className="accent-[var(--color-cobalt)]" value={profile.bufferPct} onChange={(e) => setProfile({ ...profile, bufferPct: Number(e.target.value) })} />
            <span className="text-sm font-semibold text-ink-soft">Missed sessions are paid back from this, so the rest of your plan never collapses.</span>
          </label>
        </Card>
        <Card index={2} tone="soft">
          <h2 className="text-2xl">AI</h2>
          <p className="mt-2 font-semibold">
            {gemini === null ? "Checking…" : gemini ? "Gemini is connected. Explanations, tips and strategies are written by Gemini." : "Gemini isn't configured (no GEMINI_API_KEY). The built-in ADAPT engine answers instead, so everything still works."}
          </p>
        </Card>
        <Card index={3}>
          <h2 className="text-2xl">Your data</h2>
          <p className="mt-1 text-ink-soft">Everything is stored in this browser only.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => setConfirm(true)}>Reload demo student</Button>
            <Button href="/onboarding">Start fresh</Button>
          </div>
        </Card>
      </div>
      <Modal open={confirm} title="Reload the demo student?" onClose={() => setConfirm(false)}>
        <p className="text-ink-soft">This replaces your subjects, history and plan.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="bubble" onClick={() => { actions.loadDemo(); notify("Demo student loaded."); router.push("/dashboard"); }}>Reload demo</Button>
        </div>
      </Modal>
    </Container>
  );
}

export default function SettingsPage() {
  const state = useStore();
  if (!state) return <Loading />;
  return <SettingsForm initial={state.profile} />;
}
