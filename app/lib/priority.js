// Priority engine: how much each topic needs, how urgent it is, and why.
// Pure and deterministic: `day` (ISO date) is always passed in; nothing reads the clock.
import { daysBetween, fmtMinutes } from "./dates.js";

export const CONFIDENCE_LEVELS = [
  { label: "Very weak", value: 15 },
  { label: "Weak", value: 35 },
  { label: "Okay", value: 55 },
  { label: "Good", value: 75 },
  { label: "Strong", value: 90 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const ceil5 = (m) => Math.max(0, Math.ceil(m / 5) * 5);
export const round5 = (m) => Math.max(0, Math.round(m / 5) * 5);

export const strength = (conf) => (conf < 45 ? "weak" : conf < 70 ? "medium" : "strong");

/** Total minutes a topic needs: weaker and harder topics need more. */
export function requiredMinutes(topic, subject) {
  const weakFactor = 1.5 - (topic.confidence / 100) * 0.7; // conf 0 -> 1.5x, conf 100 -> 0.8x
  const diffFactor = 0.85 + subject.difficulty * 0.05; // difficulty 1 -> 0.9x, 5 -> 1.1x
  return ceil5(topic.estMinutes * weakFactor * diffFactor);
}

export const remainingMinutes = (topic, subject) => Math.max(0, requiredMinutes(topic, subject) - topic.doneMinutes);

export function subjectConfidence(subject) {
  const total = subject.topics.reduce((a, t) => a + t.weight, 0) || 1;
  return Math.round(subject.topics.reduce((a, t) => a + t.confidence * t.weight, 0) / total);
}

/**
 * Priority 0-100 = urgency + weakness + syllabus weight + backlog + lack of recent revision - recent study.
 * Each factor is 0..1. Urgency is weighted more heavily in crunch mode. Returns reasons for "Why?".
 */
export function priorityOf(topic, subject, day, opts = {}) {
  const dl = daysBetween(day, subject.examDate);
  const staleDays = topic.lastStudied ? Math.max(0, daysBetween(topic.lastStudied, day)) : null;
  const remaining = opts.remaining ?? remainingMinutes(topic, subject);
  const required = requiredMinutes(topic, subject);
  const scheduled = opts.scheduledToday || 0;

  const f = {
    urgency: Math.exp(-(Math.max(dl, 1) - 1) / 5), // tomorrow 1.0, 4 days .55, 8 days .25
    weakness: 1 - topic.confidence / 100,
    weight: (topic.weight - 1) / 2,
    backlog: clamp(remaining / Math.max(required, 30) + (topic.missedMinutes > 0 ? 0.3 : 0), 0, 1),
    stale: staleDays === null ? 1 : clamp(staleDays / 7, 0, 1),
    recent: scheduled > 0 ? clamp(scheduled / 60, 0, 1) : staleDays === 0 ? 0.6 : staleDays === 1 ? 0.3 : 0,
  };
  const w = { urgency: opts.crunch && dl <= 7 ? 0.42 : 0.3, weakness: 0.24, weight: 0.12, backlog: 0.16, stale: 0.18, recent: 0.22 };
  const raw = w.urgency * f.urgency + w.weakness * f.weakness + w.weight * f.weight + w.backlog * f.backlog + w.stale * f.stale - w.recent * f.recent;
  const max = w.urgency + w.weakness + w.weight + w.backlog + w.stale;
  const score = Math.round(clamp(raw / max, 0.01, 0.99) * 100);

  const reasons = [];
  const push = (weight, text) => reasons.push({ weight, text });
  if (dl <= 0) push(1, "Exam is today");
  else push(w.urgency * f.urgency, dl === 1 ? "Exam is tomorrow" : `Exam in ${dl} days`);
  if (topic.confidence < 70) push(w.weakness * f.weakness, `Confidence ${topic.confidence}%`);
  if (staleDays === null) push(w.stale, "Not studied yet");
  else if (staleDays >= 3) push(w.stale * f.stale, `Not revised in ${staleDays} days`);
  if (topic.weight === 3) push(w.weight * 0.9, "High syllabus weight");
  if (topic.missedMinutes > 0) push(0.2, `${fmtMinutes(topic.missedMinutes)} backlog from a missed session`);
  else if (remaining >= 60) push(w.backlog * f.backlog * 0.8, `${fmtMinutes(remaining)} still to cover`);
  if (f.recent > 0) push(0.05, staleDays === 0 || scheduled > 0 ? "Already studied today, so ranked a bit lower" : "Studied yesterday, so ranked a bit lower");
  reasons.sort((a, b) => b.weight - a.weight);
  return { score, factors: f, daysLeft: dl, reasons: reasons.slice(0, 4).map((r) => r.text) };
}

/**
 * Confidence after a quiz: an even blend of what the student felt before and what they scored,
 * so one lucky or unlucky quiz moves the needle without overriding everything else.
 */
export function confidenceAfterQuiz(before, correct, total) {
  if (!total) return before;
  return Math.round(before * 0.5 + (correct / total) * 100 * 0.5);
}

/** Plain-language explanation. Used directly offline, and as Gemini's fallback. */
export function explainPriority(topic, subject, p) {
  const bits = p.reasons.filter((r) => !r.includes("ranked a bit lower")).map((r) => r.charAt(0).toLowerCase() + r.slice(1));
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}` : bits[0] || "it keeps your plan balanced";
  const lower = p.reasons.find((r) => r.includes("ranked a bit lower"));
  return `${topic.name} (${subject.name}) is recommended because ${list}.${lower ? ` ${lower}.` : ""}`;
}
