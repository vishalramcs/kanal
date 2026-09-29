// Planning engine: PLAN -> STUDY -> TRACK -> ADAPT. Pure and deterministic (`today` passed in).
//   generatePlan()       day-by-day blocks, keeping a 15-25% buffer each day
//   layoutDay()          clock times inside preferred periods, with breaks
//   redistributeMissed() spreads a missed session over the next days' buffers
//   workloadCheck()      burnout + realism warnings
//   rightNow()           the single best thing to study now
//   progressStats()      totals for the progress page
import { addDays, daysBetween, fmtMinutes, parseISODate } from "./dates.js";
import { ceil5, priorityOf, remainingMinutes, requiredMinutes, round5, explainPriority } from "./priority.js";

export const PERIODS = {
  morning: { label: "Morning", start: 7 * 60, end: 12 * 60 },
  afternoon: { label: "Afternoon", start: 13 * 60, end: 17 * 60 + 30 },
  night: { label: "Night", start: 18 * 60 + 30, end: 23 * 60 },
};

const BLOCK = 45;
const CRUNCH_BLOCK = 40;
const BREAK = 10;
const LONG_BREAK = 20;

export const isWeekend = (iso) => [0, 6].includes(parseISODate(iso).getDay());
export const dayCapacity = (profile, iso) => Math.round((isWeekend(iso) ? profile.weekendHours : profile.weekdayHours) * 60);

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function* allTopics(subjects) {
  for (const s of subjects) for (const t of s.topics) yield { s, t };
}

/** Crunch mode parks low-priority topics of exams within 7 days when time is short. */
function crunchTrim(subjects, today, profile) {
  const trimmed = new Set();
  for (const s of subjects) {
    const dl = daysBetween(today, s.examDate);
    if (dl < 1 || dl > 7) continue;
    let cap = 0;
    for (let i = 0; i < dl; i++) cap += dayCapacity(profile, addDays(today, i)) * 0.9;
    const scored = s.topics
      .map((t) => ({ t, rem: remainingMinutes(t, s), p: priorityOf(t, s, today, { crunch: true }).score }))
      .filter((x) => x.rem > 0)
      .sort((a, b) => b.p - a.p || a.t.order - b.t.order);
    let used = 0;
    for (const x of scored) {
      if (used + x.rem > cap * 0.5 && used > 0 && x.p < 60) trimmed.add(x.t.id);
      else used += x.rem;
    }
  }
  return trimmed;
}

/**
 * Build the plan from `today` to the last exam. Each day keeps `bufferPct` free (10% in crunch);
 * the rest is filled block by block with the highest-priority topic, re-scored after every block
 * so subjects interleave. Today's finished blocks (done/missed/skipped) are kept as history.
 */
export function generatePlan(state, today) {
  const { profile, subjects } = state;
  const crunch = !!state.crunch;
  const active = subjects.filter((s) => daysBetween(today, s.examDate) >= 0);
  const lastExam = active.reduce((m, s) => (s.examDate > m ? s.examDate : m), today);
  const trimmed = crunch ? crunchTrim(active, today, profile) : new Set();
  const sim = new Map();
  for (const { s, t } of allTopics(active)) sim.set(t.id, { remaining: remainingMinutes(t, s), lastStudied: t.lastStudied });

  const days = [];
  for (let date = today, n = 0; date <= lastExam && n < 120; date = addDays(date, 1), n++) {
    const capacity = dayCapacity(profile, date);
    const buffer = round5(capacity * (crunch ? 0.1 : profile.bufferPct));
    let usable = capacity - buffer;
    const frozen = n === 0 ? (state.plan?.days.find((d) => d.date === date)?.blocks || []).filter((b) => b.status !== "planned") : [];
    const blocks = frozen.map((b) => ({ ...b, changed: false }));
    usable -= frozen.reduce((a, b) => a + b.minutes, 0);
    const scheduled = new Map();
    const ids = new Set(blocks.map((b) => b.id));
    const add = (s, t, minutes, kind, p) => {
      let k = blocks.length;
      while (ids.has(`${date}-${k}`)) k++;
      ids.add(`${date}-${k}`);
      blocks.push({ id: `${date}-${k}`, date, subjectId: s.id, topicId: t.id, minutes, kind, priority: p.score, reasons: p.reasons, status: "planned" });
      usable -= minutes;
      scheduled.set(t.id, (scheduled.get(t.id) || 0) + minutes);
      const st = sim.get(t.id);
      if (st) { st.remaining = Math.max(0, st.remaining - minutes); st.lastStudied = date; }
    };

    for (const s of active.filter((x) => x.examDate === date)) {
      const t = [...s.topics].sort((a, b) => a.confidence - b.confidence || a.order - b.order)[0];
      if (t && usable >= 30) add(s, t, 30, "revise", { score: 99, reasons: ["Exam is today: light warm-up only"] });
    }
    if (crunch) {
      for (const s of active) {
        const dl = daysBetween(date, s.examDate);
        if (dl >= 1 && dl <= 3 && usable >= 40) {
          const t = [...s.topics].sort((a, b) => b.weight - a.weight || a.confidence - b.confidence || a.order - b.order)[0];
          if (t) add(s, t, 40, "mock", { score: 97, reasons: [`Crunch mode: timed mock test ${dl === 1 ? "the day before" : `${dl} days before`} the exam`, "Retrieval practice beats re-reading"] });
        }
      }
    }
    const len = crunch ? CRUNCH_BLOCK : BLOCK;
    for (let guard = 0; usable >= 15 && guard < 40; guard++) {
      let best = null;
      for (const s of active) {
        if (s.examDate <= date) continue;
        for (const t of s.topics) {
          const st = sim.get(t.id);
          if (!st || st.remaining <= 0 || trimmed.has(t.id)) continue;
          const p = priorityOf({ ...t, lastStudied: st.lastStudied }, s, date, { crunch, remaining: st.remaining, scheduledToday: scheduled.get(t.id) || 0 });
          const key = [-p.score, s.examDate, s.id, t.order];
          if (!best || compareKeys(key, best.key) < 0) best = { s, t, p, key };
        }
      }
      if (!best) break;
      const st = sim.get(best.t.id);
      const minutes = Math.min(len, usable, Math.max(15, ceil5(st.remaining)));
      const dl = daysBetween(date, best.s.examDate);
      const doneShare = 1 - st.remaining / Math.max(requiredMinutes(best.t, best.s), 1);
      add(best.s, best.t, minutes, dl <= 3 || doneShare >= 0.7 ? "revise" : "learn", best.p);
    }
    days.push({ date, capacity, buffer, blocks });
  }

  const shortfall = [];
  for (const { s, t } of allTopics(active)) {
    const st = sim.get(t.id);
    if (st.remaining > 0 && !trimmed.has(t.id)) shortfall.push({ subjectId: s.id, topicId: t.id, minutes: st.remaining });
  }
  return { generatedFor: today, crunch, days, shortfall, trimmed: [...trimmed], lastChange: null };
}

/** Clock times: warm-ups first, then highest priority first; 10 min breaks, 20 min every ~2h. */
export function layoutDay(day, profile) {
  const windows = Object.entries(PERIODS).filter(([k]) => profile.periods.includes(k)).map(([, v]) => ({ ...v }));
  if (!windows.length) windows.push({ ...PERIODS.morning });
  const warm = (b) => (b.kind === "revise" && b.priority === 99 ? -1 : 0);
  const done = (b) => (b.status !== "planned" ? -1 : 0);
  const order = [...day.blocks].sort((a, b) => warm(a) - warm(b) || done(a) - done(b) || b.priority - a.priority || a.id.localeCompare(b.id));
  let w = 0;
  let t = windows[0].start;
  let sinceLong = 0;
  const items = [];
  for (const b of order) {
    while (w < windows.length - 1 && t + b.minutes > windows[w].end) { w += 1; t = windows[w].start; sinceLong = 0; }
    items.push({ ...b, start: t, end: t + b.minutes });
    t += b.minutes;
    sinceLong += b.minutes;
    const long = sinceLong >= 120;
    if (long) sinceLong = 0;
    items.push({ type: "break", start: t, minutes: long ? LONG_BREAK : BREAK, long });
    t += long ? LONG_BREAK : BREAK;
  }
  if (items.length && items.at(-1).type === "break") items.pop();
  if (day.buffer > 0) items.push({ type: "buffer", start: t, minutes: day.buffer });
  return items;
}

/**
 * Adaptive replanning: spread `missed` minutes over the next (up to 4) study days before the exam,
 * front-loaded 45/33/22%, paid from each day's buffer while keeping 5% free. Returns a new plan.
 */
export function redistributeMissed(plan, state, block, missed, today) {
  const subject = state.subjects.find((s) => s.id === block.subjectId);
  const topic = subject.topics.find((t) => t.id === block.topicId);
  const eligible = plan.days.filter((d) => d.date > today && d.date < subject.examDate).slice(0, 4);
  const weights = { 1: [1], 2: [0.6, 0.4], 3: [0.45, 0.33, 0.22], 4: [0.4, 0.3, 0.2, 0.1] }[eligible.length] || [];
  const days = plan.days.map((d) => ({ ...d, blocks: d.blocks.map((b) => ({ ...b, changed: false })) }));
  const redistributed = [];
  let left = missed;
  let carry = 0;
  eligible.forEach((d, i) => {
    const day = days.find((x) => x.date === d.date);
    const want = i === eligible.length - 1 ? left : Math.min(left, round5(missed * weights[i]) + carry);
    const room = Math.max(0, day.buffer - round5(day.capacity * 0.05));
    const give = Math.min(round5(want), room, left);
    carry = want - give;
    if (give <= 0) return;
    left -= give;
    day.buffer -= give;
    const p = priorityOf(topic, subject, day.date);
    const existing = day.blocks.find((b) => b.topicId === topic.id && b.kind === "catch-up");
    if (existing) { existing.minutes += give; existing.changed = true; }
    else day.blocks.push({
      id: `${day.date}-c${day.blocks.length}`, date: day.date, subjectId: subject.id, topicId: topic.id, minutes: give,
      kind: "catch-up", priority: Math.max(p.score, 80), status: "planned", changed: true,
      reasons: [`Recovering ${fmtMinutes(give)} from the missed ${topic.name} session`, ...p.reasons.slice(0, 2)],
    });
    redistributed.push({ date: day.date, minutes: give });
  });
  const explanation = redistributed.length
    ? `You missed ${fmtMinutes(missed)} of ${topic.name}. Instead of piling it onto one evening, it's spread over the next ${redistributed.length} study day${redistributed.length > 1 ? "s" : ""} before your ${subject.name} exam, front-loaded so it stays fresh, and paid for from each day's buffer so your other subjects keep their time.`
    : `There are no study days left before the ${subject.name} exam to recover this session.`;
  return {
    ...plan,
    days,
    lastChange: {
      subjectId: subject.id, topicId: topic.id, date: block.date, missed, redistributed, unplaced: left, explanation,
      warning: left > 0 ? `${fmtMinutes(left)} didn't fit without eating your safety buffer. Consider Exam Crunch Mode.` : null,
    },
  };
}

/**
 * Add one extra session (e.g. "revise AVL trees for 30 min") on the first day from today, before the
 * exam, whose buffer can pay for it while keeping 5% free. Same buffer rule as redistributeMissed.
 * Returns { plan, date } or { plan, date: null } if no day has room.
 */
export function addSession(plan, state, { subjectId, topicId, minutes, reason }, today) {
  const subject = state.subjects.find((s) => s.id === subjectId);
  const topic = subject?.topics.find((t) => t.id === topicId);
  if (!subject || !topic) return { plan, date: null };
  const day = plan.days.find((d) => d.date >= today && d.date < subject.examDate && d.buffer - round5(d.capacity * 0.05) >= minutes);
  if (!day) return { plan, date: null };
  const p = priorityOf(topic, subject, day.date);
  const days = plan.days.map((d) => (d.date !== day.date ? d : {
    ...d,
    buffer: d.buffer - minutes,
    blocks: [...d.blocks, {
      id: `${d.date}-x${d.blocks.length}`, date: d.date, subjectId, topicId, minutes, kind: "revise",
      priority: Math.max(p.score, 80), status: "planned", changed: true, reasons: [reason, ...p.reasons.slice(0, 2)],
    }],
  }));
  return { plan: { ...plan, days }, date: day.date };
}

/** Burnout + realism warnings. */
export function workloadCheck(state, plan) {
  const warnings = [];
  const peak = Math.max(state.profile.weekdayHours, state.profile.weekendHours);
  if (peak > 8) warnings.push({ level: "danger", text: `Your planned workload (${peak}h a day) may be unrealistic. We recommend adding recovery time. Breaks and a buffer have been added automatically.` });
  if (plan?.shortfall?.length) {
    const bySubject = new Map();
    for (const s of plan.shortfall) bySubject.set(s.subjectId, (bySubject.get(s.subjectId) || 0) + s.minutes);
    const names = [...bySubject].map(([id, m]) => `${state.subjects.find((s) => s.id === id)?.name} (${fmtMinutes(m)})`);
    warnings.push({ level: plan.crunch ? "danger" : "warn", text: `Not everything fits before the exams: ${names.join(", ")} short. ${plan.crunch ? "Even crunch mode can't fit this, so focus on the top topics." : "Try Exam Crunch Mode or add study hours."}` });
  }
  if (plan?.crunch && plan.trimmed?.length) warnings.push({ level: "info", text: `Crunch mode parked ${plan.trimmed.length} low-priority topic${plan.trimmed.length > 1 ? "s" : ""} to protect your weakest, highest-weight ones.` });
  return warnings;
}

/** The single best thing to study now: next unfinished block today, else the top topic. */
export function rightNow(state, plan, today) {
  const next = plan?.days.find((d) => d.date === today)?.blocks.filter((b) => b.status === "planned").sort((a, b) => b.priority - a.priority)[0];
  const pick = (s, t, minutes, block) => {
    const p = priorityOf(t, s, today);
    return { block, subject: s, topic: t, minutes, score: block?.priority === 99 ? 99 : p.score, reasons: block?.kind === "catch-up" ? block.reasons : p.reasons, why: explainPriority(t, s, p), daysLeft: p.daysLeft };
  };
  if (next) {
    const s = state.subjects.find((x) => x.id === next.subjectId);
    const t = s?.topics.find((x) => x.id === next.topicId);
    if (s && t) return pick(s, t, next.minutes, next);
  }
  let best = null;
  for (const s of state.subjects) {
    if (daysBetween(today, s.examDate) < 1) continue;
    for (const t of s.topics) {
      if (remainingMinutes(t, s) <= 0) continue;
      const p = priorityOf(t, s, today);
      if (!best || p.score > best.p.score) best = { s, t, p };
    }
  }
  return best ? pick(best.s, best.t, Math.min(BLOCK, ceil5(remainingMinutes(best.t, best.s))), null) : null;
}

export function progressStats(state, plan, today) {
  let required = 0;
  let covered = 0;
  for (const s of state.subjects) for (const t of s.topics) { const r = requiredMinutes(t, s); required += r; covered += Math.min(t.doneMinutes, r); }
  const studied = state.history.filter((h) => h.status === "done").reduce((a, h) => a + h.minutes, 0);
  const todayPlan = plan?.days.find((d) => d.date === today);
  const todayPlanned = todayPlan ? todayPlan.blocks.reduce((a, b) => a + b.minutes, 0) : 0;
  const todayDone = todayPlan ? todayPlan.blocks.filter((b) => b.status === "done").reduce((a, b) => a + (b.actual || b.minutes), 0) : 0;
  const days = new Set(state.history.filter((h) => h.status === "done").map((h) => h.date));
  let streak = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) streak++;
  return {
    coverage: required ? covered / required : 0,
    studied,
    remaining: Math.max(0, required - covered),
    todayPlanned,
    todayDone,
    streak,
    bufferToday: todayPlan?.buffer || 0,
    bufferWeek: (plan?.days.slice(0, 7) || []).reduce((a, d) => a + d.buffer, 0),
  };
}
