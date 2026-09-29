// Engine tests: node --test tests/   (no extra libraries)
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../app/lib/demoData.js";
import { addDays } from "../app/lib/dates.js";
import { addSession, generatePlan, layoutDay, progressStats, redistributeMissed, rightNow, workloadCheck } from "../app/lib/planner.js";
import { confidenceAfterQuiz, priorityOf, requiredMinutes } from "../app/lib/priority.js";

const TODAY = "2026-10-05"; // a Monday
const fresh = () => {
  const s = demoState(TODAY);
  return { ...s, plan: generatePlan(s, TODAY) };
};

test("plan is deterministic", () => {
  const s = demoState(TODAY);
  assert.deepEqual(generatePlan(s, TODAY), generatePlan(s, TODAY));
});

test("every day keeps its buffer and never exceeds capacity", () => {
  const { plan } = fresh();
  for (const d of plan.days) {
    const used = d.blocks.reduce((a, b) => a + b.minutes, 0);
    assert.ok(used + d.buffer <= d.capacity, `${d.date}: ${used}+${d.buffer} > ${d.capacity}`);
    assert.ok(d.buffer >= Math.round(d.capacity * 0.15) - 5, `${d.date} buffer too small`);
  }
});

test("no study block after its exam; only a warm-up on exam day", () => {
  const s = fresh();
  for (const d of s.plan.days) {
    for (const b of d.blocks) {
      const exam = s.subjects.find((x) => x.id === b.subjectId).examDate;
      assert.ok(d.date <= exam);
      if (d.date === exam) assert.equal(b.minutes, 30);
    }
  }
});

test("timeline: blocks don't overlap and breaks separate them", () => {
  const s = fresh();
  for (const d of s.plan.days) {
    const items = layoutDay(d, s.profile);
    for (let i = 1; i < items.length; i++) assert.ok(items[i].start >= items[i - 1].start + items[i - 1].minutes);
  }
});

test("priority: urgent + weak + stale beats relaxed + strong", () => {
  const s = demoState(TODAY);
  const dm = s.subjects.find((x) => x.id === "dm");
  const en = s.subjects.find((x) => x.id === "en");
  const hot = priorityOf(dm.topics[3], dm, TODAY);
  const calm = priorityOf(en.topics[0], en, TODAY);
  assert.ok(hot.score > calm.score);
  assert.ok(hot.reasons.some((r) => r.startsWith("Exam in")));
  assert.ok(hot.reasons.includes("Not studied yet"));
});

test("weaker topics need more minutes", () => {
  const subject = { difficulty: 3 };
  const base = { estMinutes: 120, doneMinutes: 0 };
  assert.ok(requiredMinutes({ ...base, confidence: 20 }, subject) > requiredMinutes({ ...base, confidence: 90 }, subject));
});

test("missed 45 min is spread 20/15/10 over the next three days, from buffers", () => {
  const s = fresh();
  const next = redistributeMissed(s.plan, s, { subjectId: "dm", topicId: "dm-comb", date: TODAY }, 45, TODAY);
  const moved = next.lastChange.redistributed;
  assert.deepEqual(moved.map((r) => r.minutes), [20, 15, 10]);
  assert.deepEqual(moved.map((r) => r.date), [addDays(TODAY, 1), addDays(TODAY, 2), addDays(TODAY, 3)]);
  for (const r of moved) {
    const before = s.plan.days.find((d) => d.date === r.date);
    const after = next.days.find((d) => d.date === r.date);
    assert.equal(after.buffer, before.buffer - r.minutes);
  }
  assert.equal(next.lastChange.unplaced, 0);
});

test("crunch mode adds mock tests and a smaller buffer", () => {
  const s = { ...demoState(TODAY), crunch: true };
  const plan = generatePlan(s, TODAY);
  assert.ok(plan.days.some((d) => d.blocks.some((b) => b.kind === "mock")));
  assert.ok(plan.days[0].buffer <= Math.round(plan.days[0].capacity * 0.1) + 5);
});

test("replanning keeps today's finished blocks", () => {
  const s = fresh();
  const first = s.plan.days[0].blocks[0];
  const marked = { ...s, plan: { ...s.plan, days: s.plan.days.map((d, i) => (i ? d : { ...d, blocks: d.blocks.map((b) => (b.id === first.id ? { ...b, status: "done" } : b)) })) } };
  const replanned = generatePlan(marked, TODAY);
  assert.ok(replanned.days[0].blocks.some((b) => b.id === first.id && b.status === "done"));
});

test("notebook hooks: quiz score blends into confidence; extra session is paid from a buffer", () => {
  assert.equal(confidenceAfterQuiz(40, 1, 5), 30);
  assert.equal(confidenceAfterQuiz(40, 5, 5), 70);
  const s = fresh();
  const { plan, date } = addSession(s.plan, s, { subjectId: "ds", topicId: "ds-trees", minutes: 30, reason: "test" }, TODAY);
  assert.ok(date);
  const before = s.plan.days.find((d) => d.date === date);
  const after = plan.days.find((d) => d.date === date);
  assert.equal(after.buffer, before.buffer - 30);
  assert.ok(after.blocks.some((b) => b.topicId === "ds-trees" && b.changed && b.minutes === 30));
});

test("burnout warning above 8h a day", () => {
  const s = fresh();
  const heavy = { ...s, profile: { ...s.profile, weekdayHours: 10 } };
  assert.ok(workloadCheck(heavy, heavy.plan).some((w) => w.level === "danger" && w.text.includes("unrealistic")));
});

test("right-now picks today's highest-priority block and stats add up", () => {
  const s = fresh();
  const task = rightNow(s, s.plan, TODAY);
  assert.ok(task && task.minutes > 0 && task.reasons.length > 0);
  const st = progressStats(s, s.plan, TODAY);
  assert.ok(st.coverage > 0 && st.coverage < 1);
  assert.ok(st.streak >= 1);
});
