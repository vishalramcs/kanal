"use client";
// App state for the signed-in user, stored in the database (Supabase) through /api/state.
// Changes apply instantly in the browser and are saved in the background: debounced, one request at a time, in order.
// Every plan change still goes through lib/planner.js. Until the state loads, the snapshot is null (pages show a skeleton).
import { useSyncExternalStore } from "react";
import { demoState } from "@/lib/demoData.js";
import { toISODate } from "@/lib/dates.js";
import { addSession, generatePlan, redistributeMissed } from "@/lib/planner.js";
import { confidenceAfterQuiz } from "@/lib/priority.js";
import { blankTopic } from "@/lib/subjects.js";
import { notify } from "@/lib/toast.js";

const LEGACY_KEY = "adapt-state-v2"; // data saved in this browser before sign-in existed: imported once
export const todayISO = () => toISODate(new Date());

let state = null;
const subs = new Set();
let saveTimer = null;
let replaceSubjects = false; // true after onboarding / demo reset: the server removes subjects that are gone
let queue = Promise.resolve(); // serialises saves and deletes so they reach the server in order
let loading = null;

const emit = () => subs.forEach((fn) => fn());

function set(next, { replace = false } = {}) {
  state = next;
  if (replace) replaceSubjects = true;
  emit();
  scheduleSave();
}

function scheduleSave(delay = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, delay);
}

function flush() {
  saveTimer = null;
  if (!state) return queue;
  const replace = replaceSubjects;
  replaceSubjects = false;
  const body = JSON.stringify({ state, replaceSubjects: replace });
  queue = queue.then(async () => {
    const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60000 }).catch(() => null);
    if (res?.ok) return;
    if (res?.status === 401 || res?.status === 403) {
      window.location.assign("/login?error=session");
      return;
    }
    if (replace) replaceSubjects = true;
    notify("Couldn't save your changes. Retrying…");
    scheduleSave(4000);
  });
  return queue;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", () => saveTimer && flush());

/** Load the signed-in user's planner. First sign-in: import this browser's old data, or start empty. */
export function loadState(user) {
  if (state) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      window.location.assign("/login?error=session");
      return;
    }
    if (!res.ok) throw new Error("load_failed");
    const { state: saved } = await res.json();
    if (saved) {
      state = saved;
      emit();
      return;
    }
    let initial = null;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) initial = JSON.parse(raw);
    } catch {
      /* no old data */
    }
    initial ||= { ...demoState(todayISO()), subjects: [], history: [], plan: null };
    initial.profile = { ...initial.profile, name: user?.name?.split(" ")[0] || initial.profile.name };
    set(initial, { replace: true });
    await flush();
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  })()
    .catch(() => notify("Couldn't load your planner. Check your connection and refresh."))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export const getState = () => state;

const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export function useStore() {
  return useSyncExternalStore(subscribe, getState, () => null);
}

/** Regenerate when the plan is missing or a new day has started. */
export function ensurePlan() {
  const s = getState();
  const today = todayISO();
  if (s && (!s.plan || s.plan.generatedFor !== today)) set({ ...s, plan: generatePlan(s, today) });
}

function markBlock(plan, blockId, patch) {
  if (!plan || !blockId) return plan;
  return { ...plan, days: plan.days.map((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) })) };
}

function updateTopic(subjects, subjectId, topicId, fn) {
  return subjects.map((s) => (s.id !== subjectId ? s : { ...s, topics: s.topics.map((t) => (t.id !== topicId ? t : fn(t))) }));
}

export const actions = {
  replan(extra = {}) {
    const next = { ...getState(), ...extra };
    set({ ...next, plan: generatePlan(next, todayISO()) });
  },
  setCrunch(on) {
    actions.replan({ crunch: on });
  },
  updateProfile(patch) {
    actions.replan({ profile: { ...getState().profile, ...patch } });
  },
  saveSubject(subject) {
    const { subjects } = getState();
    const exists = subjects.some((s) => s.id === subject.id);
    actions.replan({ subjects: exists ? subjects.map((s) => (s.id === subject.id ? subject : s)) : [...subjects, subject] });
  },
  /** Removes the subject, its materials, files and notebook conversations (server deletes in the database + storage). */
  deleteSubject(id) {
    actions.replan({ subjects: getState().subjects.filter((s) => s.id !== id) });
    queue = queue.then(() => fetch(`/api/subjects/${encodeURIComponent(id)}`, { method: "DELETE" })).catch(() => notify("Couldn't delete that subject on the server."));
  },
  finishOnboarding(profile, subjects) {
    set({ ...getState(), profile, subjects, history: [], crunch: false, session: null, strategy: null, plan: null }, { replace: true });
    actions.replan();
  },
  loadDemo() {
    set({ ...demoState(todayISO()), profile: { ...demoState(todayISO()).profile, name: getState()?.profile?.name || "Aarav" } }, { replace: true });
    ensurePlan();
  },
  setStrategy(strategy) {
    set({ ...getState(), strategy });
  },

  startSession(block) {
    set({ ...getState(), session: { blockId: block.id || null, subjectId: block.subjectId, topicId: block.topicId, minutes: block.minutes, startedAt: Date.now(), pausedLeft: null } });
  },
  updateSession(patch) {
    const s = getState();
    set({ ...s, session: s.session && { ...s.session, ...patch } });
  },

  /** Finished: credit minutes, move confidence toward the self-rating (40% old, 60% new). */
  completeSession({ subjectId, topicId, blockId, minutes, confidence }) {
    const s = getState();
    const today = todayISO();
    let before = 0;
    let after = 0;
    const subjects = updateTopic(s.subjects, subjectId, topicId, (t) => {
      before = t.confidence;
      after = Math.round(t.confidence * 0.4 + confidence * 0.6);
      return { ...t, doneMinutes: t.doneMinutes + minutes, lastStudied: today, missedMinutes: Math.max(0, t.missedMinutes - minutes), confidence: after };
    });
    set({
      ...s,
      subjects,
      plan: markBlock(s.plan, blockId, { status: "done", actual: minutes }),
      session: null,
      history: [...s.history, { id: `h-${Date.now()}`, date: today, subjectId, topicId, minutes, status: "done", confidenceBefore: before, confidenceAfter: after }],
    });
    return { before, after };
  },

  /** "I couldn't complete this session": credit what was done, spread the rest over the next days. */
  missSession({ subjectId, topicId, blockId, plannedMinutes, doneMinutes, reason = "missed" }) {
    const s = getState();
    const today = todayISO();
    const missed = Math.max(0, plannedMinutes - doneMinutes);
    const subjects = updateTopic(s.subjects, subjectId, topicId, (t) => ({
      ...t,
      doneMinutes: t.doneMinutes + doneMinutes,
      lastStudied: doneMinutes > 0 ? today : t.lastStudied,
      missedMinutes: t.missedMinutes + missed,
    }));
    const next = { ...s, subjects };
    let plan = markBlock(s.plan, blockId, { status: reason, actual: doneMinutes });
    if (missed > 0) plan = redistributeMissed(plan, next, { subjectId, topicId, date: today }, missed, today);
    set({ ...next, plan, session: null, history: [...s.history, { id: `h-${Date.now()}`, date: today, subjectId, topicId, minutes: doneMinutes, missed, status: reason }] });
  },
  /** Notebook quiz finished: store the score and blend it into the topic's confidence. */
  recordQuiz({ subjectId, topicId, correct, total, source }) {
    const s = getState();
    const today = todayISO();
    let before = 0;
    let after = 0;
    const subjects = updateTopic(s.subjects, subjectId, topicId, (t) => {
      before = t.confidence;
      after = confidenceAfterQuiz(t.confidence, correct, total);
      return { ...t, confidence: after, lastQuiz: { correct, total, date: today, source } };
    });
    set({
      ...s,
      subjects,
      history: [...s.history, { id: `h-${Date.now()}`, date: today, subjectId, topicId, minutes: 0, status: "quiz", score: { correct, total }, confidenceBefore: before, confidenceAfter: after }],
    });
    return { before, after };
  },

  /** Put one extra revision session into the plan (paid from a day's buffer). Returns the date or null. */
  addRevisionSession({ subjectId, topicId, minutes = 30, reason = "Revision you added from the notebook" }) {
    const s = getState();
    const { plan, date } = addSession(s.plan, s, { subjectId, topicId, minutes, reason }, todayISO());
    if (date) set({ ...s, plan });
    return date;
  },

  /** "Create study plan from this material": add topics to a subject (new or existing); the engine replans. */
  addMaterialTopics({ subject, topics }) {
    const s = getState();
    const existing = s.subjects.find((x) => x.id === subject.id);
    const base = existing || subject;
    const names = new Set(base.topics.map((t) => t.name.toLowerCase()));
    const added = topics
      .filter((t) => t.name.trim() && !names.has(t.name.trim().toLowerCase()))
      .map((t, i) => ({ ...blankTopic(base.topics.length + i), name: t.name.trim().slice(0, 60), estMinutes: Math.round(t.hours * 60), confidence: t.confidence ?? 50, weight: t.weight ?? 2 }));
    const merged = { ...base, topics: [...base.topics.filter((t) => t.name.trim()), ...added] };
    actions.saveSubject(merged);
    return added.length;
  },

  dismissChange() {
    const s = getState();
    set({ ...s, plan: s.plan && { ...s.plan, lastChange: null } });
  },
};

/** Convenience lookups used across pages. */
export function findTopic(state, subjectId, topicId) {
  const subject = state.subjects.find((s) => s.id === subjectId);
  return { subject, topic: subject?.topics.find((t) => t.id === topicId) };
}
