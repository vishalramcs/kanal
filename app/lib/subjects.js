// Subjects: colour palette, blank subject/topic, and form validation (no UI here).
import { addDays } from "./dates.js";

export const SUBJECT_COLORS = ["#ffd12b", "#f7839d", "#2f5fe0", "#4fc48f", "#ff9a3c", "#a98bff", "#3fc1d9", "#e2e8c0"];

/** Ink or cream text depending on how light a subject colour is (WCAG relative luminance). */
export function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "var(--color-ink)" : "var(--color-cream)";
}

export const DIFFICULTY = ["Easy", "Manageable", "Moderate", "Hard", "Brutal"];
export const WEIGHTS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

let seq = 0;
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export const blankTopic = (order = 0) => ({
  id: newId("t"), name: "", weight: 2, confidence: 50, estMinutes: 120, doneMinutes: 0, lastStudied: null, missedMinutes: 0, order,
});

export const blankSubject = (today, index = 0) => ({
  id: newId("s"), name: "", color: SUBJECT_COLORS[index % SUBJECT_COLORS.length], difficulty: 3, examDate: addDays(today, 10), topics: [blankTopic(0)],
});

export function validateSubject(subject, today, others = []) {
  const errors = {};
  const name = subject.name.trim().toLowerCase();
  if (!name) errors.name = "Give the subject a name";
  else if (others.some((o) => o.id !== subject.id && o.name.trim().toLowerCase() === name)) errors.name = "You already have this subject";
  if (!subject.examDate) errors.examDate = "Pick the exam date";
  else if (subject.examDate < today) errors.examDate = "That date is in the past";
  if (!subject.topics.some((t) => t.name.trim())) errors.topics = "Add at least one topic";
  return errors;
}

/** Trim names, drop empty topics, renumber order. */
export const cleanSubject = (s) => ({
  ...s,
  name: s.name.trim(),
  topics: s.topics.filter((t) => t.name.trim()).map((t, i) => ({ ...t, name: t.name.trim(), order: i })),
});
