// Compact, privacy-safe study-plan context for AI features. Pure: used by the browser (planner chat)
// and by the server (subject notebook, which rebuilds it from the database instead of trusting the client).
import { daysBetween, hhmm } from "./dates.js";
import { layoutDay, progressStats, rightNow } from "./planner.js";
import { subjectConfidence } from "./priority.js";

export const namesOf = (state, b) => {
  const s = state.subjects.find((x) => x.id === b.subjectId);
  return { subject: s?.name, topic: s?.topics.find((t) => t.id === b.topicId)?.name };
};

/** Real quiz accuracy from the stored history (no invented analytics). */
export function quizStats(history, subjectId, topicId) {
  const quizzes = (history || []).filter((h) => h.status === "quiz" && h.score && (!subjectId || h.subjectId === subjectId) && (!topicId || h.topicId === topicId));
  const correct = quizzes.reduce((a, h) => a + h.score.correct, 0);
  const total = quizzes.reduce((a, h) => a + h.score.total, 0);
  return { quizzes: quizzes.length, correct, total, accuracy: total ? Math.round((correct / total) * 100) : null };
}

/** Exams, weak topics (with quiz accuracy), today's sessions, the recommended next task and progress. */
export function plannerDigest(state, today) {
  const task = state.plan ? rightNow(state, state.plan, today) : null;
  const stats = progressStats(state, state.plan, today);
  const day = state.plan?.days.find((d) => d.date === today);
  return {
    today,
    exams: state.subjects
      .filter((s) => s.examDate >= today)
      .sort((a, b) => a.examDate.localeCompare(b.examDate))
      .map((s) => ({ subject: s.name, daysLeft: daysBetween(today, s.examDate), confidencePercent: subjectConfidence(s) })),
    weakTopics: state.subjects
      .flatMap((s) => s.topics.filter((t) => t.confidence < 45).map((t) => `${t.name} (${s.name}, ${t.confidence}%${t.lastQuiz ? `, last quiz ${t.lastQuiz.correct}/${t.lastQuiz.total}` : ""})`))
      .slice(0, 6),
    todaySessions: (day ? layoutDay(day, state.profile).filter((i) => !i.type) : []).slice(0, 8).map((b) => ({ time: hhmm(b.start), ...namesOf(state, b), minutes: b.minutes, kind: b.kind, status: b.status })),
    recommendedNow: task && { subject: task.subject.name, topic: task.topic.name, minutes: task.minutes, priority: task.score, reasons: task.reasons },
    progress: { syllabusCoveredPercent: Math.round(stats.coverage * 100), todayDoneMinutes: stats.todayDone, todayPlannedMinutes: stats.todayPlanned, streakDays: stats.streak },
  };
}

/** Everything the notebook needs to know about one subject: exam, topics by strength, quiz accuracy, planned sessions. */
export function subjectDigest(state, subjectId, today) {
  const s = state.subjects.find((x) => x.id === subjectId);
  if (!s) return null;
  const sessions = (state.plan?.days || [])
    .flatMap((d) => d.blocks.filter((b) => b.subjectId === subjectId && b.status === "planned").map((b) => ({ date: d.date, topic: namesOf(state, b).topic, minutes: b.minutes, kind: b.kind })))
    .slice(0, 6);
  return {
    today,
    subject: s.name,
    examDate: s.examDate,
    daysToExam: daysBetween(today, s.examDate),
    confidencePercent: subjectConfidence(s),
    quizAccuracy: quizStats(state.history, subjectId).accuracy,
    topics: s.topics.map((t) => ({ name: t.name, confidencePercent: t.confidence, quizAccuracy: quizStats(state.history, subjectId, t.id).accuracy })),
    weakTopics: s.topics.filter((t) => t.confidence < 45).map((t) => t.name),
    upcomingSessions: sessions,
  };
}
