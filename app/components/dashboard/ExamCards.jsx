"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Strength } from "@/components/ui/Meters";
import { daysBetween } from "@/lib/dates";
import { subjectConfidence } from "@/lib/priority";
import { textOn } from "@/lib/subjects";

/** "Coming up": chunky colour cards, one per upcoming exam (like the reference's shop-by-pet row). */
export default function ExamCards({ subjects, today, limit = 4 }) {
  const upcoming = subjects.filter((s) => s.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate)).slice(0, limit);
  if (!upcoming.length) return null;
  return (
    <section>
      <h2 className="mb-5 text-[clamp(30px,4vw,44px)]">Coming up</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {upcoming.map((s, i) => {
          const dl = daysBetween(today, s.examDate);
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 * i }} whileHover={{ y: -6 }}>
              <Link href="/subjects" className="flex h-full flex-col rounded-3xl border-2 border-ink p-5 shadow-hard" style={{ background: s.color, color: textOn(s.color) }}>
                <span className="font-display text-6xl font-extrabold leading-none tracking-[-0.05em]">{dl === 0 ? "Today" : dl}</span>
                <span className="text-sm font-extrabold">{dl === 0 ? "" : dl === 1 ? "day left" : "days left"}</span>
                <span className="mt-6 font-extrabold leading-tight">{s.name}</span>
                <span className="mt-2"><Strength confidence={subjectConfidence(s)} /></span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
