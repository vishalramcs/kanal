"use client";
// Client side of the AI layer: builds compact, privacy-safe contexts, calls /api/gemini,
// and falls back to the local engine so every AI feature always returns something useful.
import { useCallback, useState } from "react";
import { daysBetween, fmtMinutes, relDay } from "@/lib/dates.js";
import { namesOf, plannerDigest } from "@/lib/digest.js";
import { priorityOf, requiredMinutes, subjectConfidence, explainPriority } from "@/lib/priority.js";

export { plannerDigest };

// ---------- contexts (no names, no personal data) ----------
export function focusContext(task, today) {
  const p = priorityOf(task.topic, task.subject, today);
  return {
    subject: task.subject.name,
    topic: task.topic.name,
    minutes: task.minutes,
    sessionType: task.block?.kind || "learn",
    daysToExam: p.daysLeft,
    confidencePercent: task.topic.confidence,
    priority: task.score,
    reasons: task.reasons,
  };
}

export function changeContext(change, state, today) {
  const subject = state.subjects.find((s) => s.id === change.subjectId);
  const topic = subject?.topics.find((t) => t.id === change.topicId);
  return {
    subject: subject?.name,
    topic: topic?.name,
    missedMinutes: change.missed,
    movedTo: change.redistributed.map((r) => ({ day: relDay(today, r.date), minutes: r.minutes })),
    couldNotPlaceMinutes: change.unplaced,
    examDate: subject?.examDate,
  };
}

export function planContext(state, today) {
  return {
    today,
    hoursPerDay: { weekday: state.profile.weekdayHours, weekend: state.profile.weekendHours },
    bufferPercent: Math.round(state.profile.bufferPct * 100),
    exams: state.subjects.map((s) => ({
      subject: s.name,
      examDate: s.examDate,
      daysLeft: daysBetween(today, s.examDate),
      confidencePercent: subjectConfidence(s),
      weakTopics: s.topics.filter((t) => t.confidence < 45).map((t) => t.name).slice(0, 4),
      hoursNeeded: Math.round(s.topics.reduce((a, t) => a + Math.max(0, requiredMinutes(t, s) - t.doneMinutes), 0) / 60),
    })),
    shortfallMinutes: (state.plan?.shortfall || []).reduce((a, x) => a + x.minutes, 0),
  };
}


/** Everything the global chatbot needs: the digest plus the conversation and recent activity. */
export function chatContext(state, today, messages) {
  const change = state.plan?.lastChange;
  return {
    ...plannerDigest(state, today),
    question: messages.at(-1)?.text || "",
    history: messages.slice(-7, -1).map((m) => ({ role: m.role, text: m.text.slice(0, 240) })),
    recentSessions: state.history.slice(-5).map((h) => ({ day: relDay(today, h.date), ...namesOf(state, h), minutes: h.minutes, status: h.status })),
    planAdjustment: change ? { missedMinutes: change.missed, ...namesOf(state, change), movedTo: change.redistributed.map((r) => `${relDay(today, r.date)} +${r.minutes} min`) } : null,
    crunchMode: !!state.crunch,
  };
}

const FOLLOW_UPS = ["What should I study tonight?", "Which topics are my weakest?", "When is my next exam?"];

/** Offline chat: answers the common study questions straight from the plan data. */
function localChat(ctx) {
  const q = ctx.question.toLowerCase();
  const now = ctx.recommendedNow;
  const next = ctx.exams[0];
  const pending = ctx.todaySessions.filter((s) => s.status === "planned");
  let reply;
  if (/weak|struggl|hard|worst/.test(q)) {
    reply = ctx.weakTopics.length ? `Your weakest topics right now: ${ctx.weakTopics.slice(0, 4).join("; ")}. They get extra time automatically, and short, frequent sessions work best for them.` : "No weak topics at the moment. Nice work; keep revising so it stays that way.";
  } else if (/exam|when|days left|test|deadline/.test(q)) {
    reply = ctx.exams.length ? `Coming up: ${ctx.exams.slice(0, 4).map((e) => `${e.subject} in ${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} (${e.confidencePercent}% ready)`).join(", ")}.` : "You have no upcoming exams in the planner.";
  } else if (/miss|behind|skip|couldn|late|fell/.test(q)) {
    reply = ctx.planAdjustment
      ? `You missed ${ctx.planAdjustment.missedMinutes} min of ${ctx.planAdjustment.topic}. It's already moved: ${ctx.planAdjustment.movedTo.join(", ")}, paid from your buffers so nothing else gets squeezed.`
      : "If you can't finish a session, open Focus and tap “I couldn't complete this session”. ADAPT spreads the missed time over the next few days' buffers.";
  } else if (/progress|how am i|doing|streak|covered/.test(q)) {
    const p = ctx.progress;
    reply = `You've covered ${p.syllabusCoveredPercent}% of the syllabus, done ${fmtMinutes(p.todayDoneMinutes)} of ${fmtMinutes(p.todayPlannedMinutes)} today, and you're on a ${p.streakDays}-day streak.`;
  } else if (/crunch|panic|stress|cram|overwhelm/.test(q)) {
    reply = next && next.daysLeft <= 5 ? `${next.subject} is ${next.daysLeft} days away. Exam Crunch Mode (on the Planner) adds mock tests and parks low-priority topics, and it keeps your breaks. Breathe; one session at a time.` : "You're not in crunch territory yet. Stick to today's plan and protect your buffer.";
  } else if (now) {
    const after = pending.find((s) => s.topic !== now.topic);
    reply = `Start with ${now.topic} (${now.subject}) for ${fmtMinutes(now.minutes)}: ${now.reasons.slice(0, 2).join(", ").toLowerCase()}.${after ? ` After a short break, move to ${after.topic} at ${after.time}.` : ""}`;
  } else {
    reply = "You're all caught up. Add a subject or exam and I'll help you plan it.";
  }
  return { reply, followUps: FOLLOW_UPS };
}

// ---------- local fallbacks ----------
const fallbacks = {
  chat: (ctx) => localChat(ctx),
  explain: (_, extra) => ({ explanation: explainPriority(extra.topic, extra.subject, priorityOf(extra.topic, extra.subject, extra.today)) }),
  suggest: (ctx) => {
    const weak = ctx.confidencePercent < 45;
    const tips = {
      revise: ["Close your notes and write everything you remember first.", "Check gaps against the notes, then redo the weakest part.", "Finish with three exam-style questions against the clock."],
      mock: ["Set a strict timer and answer like it's the real exam.", "Mark honestly, then list the mistakes by type.", "Re-learn only the two most costly mistakes."],
      "catch-up": ["Start with the part you skipped last time, not the easy bits.", "Keep it short and focused; you only need the missed minutes.", "End by writing a 3-line summary to lock it in."],
      learn: [
        weak ? "Start with one worked example before reading theory." : "Skim the theory, then jump into problems.",
        "Explain the core idea aloud as if teaching a friend.",
        "Do three practice questions and note what tripped you up.",
      ],
    };
    return { tips: tips[ctx.sessionType] || tips.learn, encouragement: `${fmtMinutes(ctx.minutes)} of focus is enough. One topic, full attention.` };
  },
  adapt: (ctx, extra) => ({ message: extra.change.explanation }),
  plan: (ctx) => {
    const soonest = [...ctx.exams].sort((a, b) => a.daysLeft - b.daysLeft)[0];
    const weakest = [...ctx.exams].sort((a, b) => a.confidencePercent - b.confidencePercent)[0];
    return {
      headline: soonest ? `${soonest.subject} first, steady progress everywhere else.` : "Add your exams to get a strategy.",
      strategy: [
        soonest ? `${soonest.subject} is ${soonest.daysLeft} days away, so it gets the most time this week.` : "Add exam dates so the planner can prioritise.",
        weakest ? `Your weakest area is ${weakest.subject} (${weakest.confidencePercent}%): short, frequent sessions beat long ones.` : "Mark your weak topics so they get extra time.",
        `${ctx.bufferPercent}% of each day stays free, so a missed session never breaks the plan.`,
      ],
      risk: ctx.shortfallMinutes > 0 ? `About ${fmtMinutes(ctx.shortfallMinutes)} doesn't fit before the exams. Consider Crunch Mode or a little more time per day.` : "No big risks right now. Protect your streak.",
    };
  },
};

/** Ask Gemini (via our server route); on any failure use the local engine. */
export async function askAI(task, context, extra = {}) {
  try {
    const res = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, context }) });
    const json = await res.json();
    if (json.available && json.data) return { source: "gemini", data: json.data };
  } catch {
    /* network error: fall through */
  }
  return { source: "local", data: fallbacks[task](context, extra) };
}

/** React hook: { result, loading, run } for on-demand AI (progressive disclosure). */
export function useAI(task) {
  const [state, setState] = useState({ result: null, loading: false });
  const run = useCallback(
    async (context, extra) => {
      setState({ result: null, loading: true });
      const result = await askAI(task, context, extra);
      setState({ result, loading: false });
      return result;
    },
    [task],
  );
  return { ...state, run, reset: () => setState({ result: null, loading: false }) };
}
