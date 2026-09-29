// Demo student so the app works the moment it opens. Dates are relative to `today`.
import { addDays } from "./dates.js";
import { SUBJECT_COLORS } from "./subjects.js";

const T = (id, name, weight, confidence, estMinutes, lastAgo, doneMinutes, order) => ({
  id, name, weight, confidence, estMinutes, lastAgo, doneMinutes, order, missedMinutes: 0,
});

const SUBJECTS = [
  { id: "dm", name: "Discrete Mathematics", color: SUBJECT_COLORS[1], exam: 4, difficulty: 4, topics: [
    T("dm-rel", "Relations & Functions", 3, 30, 150, 3, 30, 0),
    T("dm-graph", "Graph Theory", 3, 40, 180, 5, 60, 1),
    T("dm-logic", "Propositional Logic", 2, 62, 90, 1, 60, 2),
    T("dm-comb", "Combinatorics", 2, 25, 120, null, 0, 3),
  ] },
  { id: "ds", name: "Data Structures", color: SUBJECT_COLORS[2], exam: 7, difficulty: 4, topics: [
    T("ds-ll", "Linked Lists", 3, 45, 120, 2, 45, 0),
    T("ds-trees", "Trees", 3, 35, 180, 6, 30, 1),
    T("ds-sq", "Stacks & Queues", 2, 72, 90, 1, 75, 2),
    T("ds-hash", "Hashing", 2, 40, 120, null, 0, 3),
    T("ds-sort", "Sorting", 3, 55, 150, 4, 60, 4),
  ] },
  { id: "c", name: "C Programming", color: SUBJECT_COLORS[0], exam: 10, difficulty: 3, topics: [
    T("c-ptr", "Pointers", 3, 40, 150, 3, 45, 0),
    T("c-struct", "Structures & Unions", 2, 60, 90, 5, 30, 1),
    T("c-file", "File Handling", 1, 70, 60, null, 0, 2),
    T("c-mem", "Dynamic Memory", 3, 45, 120, 2, 30, 3),
  ] },
  { id: "co", name: "Computer Organization", color: SUBJECT_COLORS[3], exam: 13, difficulty: 3, topics: [
    T("co-num", "Number Systems", 1, 82, 60, 7, 60, 0),
    T("co-mem", "Memory Hierarchy", 3, 35, 150, null, 0, 1),
    T("co-pipe", "Pipelining", 3, 30, 150, null, 0, 2),
    T("co-isa", "Instruction Sets", 2, 50, 90, 8, 30, 3),
  ] },
  { id: "en", name: "English", color: SUBJECT_COLORS[5], exam: 16, difficulty: 2, topics: [
    T("en-gram", "Grammar", 2, 80, 60, 9, 45, 0),
    T("en-comp", "Comprehension", 2, 70, 60, null, 0, 1),
    T("en-essay", "Essay Writing", 3, 58, 90, 10, 30, 2),
  ] },
];

export function demoState(today) {
  const history = [];
  const subjects = SUBJECTS.map((s) => ({
    id: s.id, name: s.name, color: s.color, difficulty: s.difficulty, examDate: addDays(today, s.exam),
    topics: s.topics.map(({ lastAgo, ...t }) => {
      const lastStudied = lastAgo === null ? null : addDays(today, -lastAgo);
      if (lastStudied && t.doneMinutes) history.push({ id: `h-${t.id}`, date: lastStudied, subjectId: s.id, topicId: t.id, minutes: t.doneMinutes, status: "done" });
      return { ...t, lastStudied };
    }),
  }));
  history.sort((a, b) => a.date.localeCompare(b.date));
  return {
    version: 2,
    profile: { name: "Aarav", weekdayHours: 4, weekendHours: 6, periods: ["morning", "night"], bufferPct: 0.18 },
    subjects,
    history,
    crunch: false,
    plan: null,
    session: null,
    strategy: null,
  };
}
