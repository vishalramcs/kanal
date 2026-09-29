"use client";
import { motion } from "framer-motion";

const TONES = {
  paper: "bg-paper text-ink",
  cream: "bg-cream text-ink",
  sun: "bg-sun text-ink",
  bubble: "bg-bubble text-ink",
  cobalt: "bg-cobalt text-cream",
  soft: "bg-sun-soft text-ink",
};

/** Chunky ink-bordered card with a hard shadow. `index` staggers the entrance. */
export default function Card({ tone = "paper", index = 0, lift = false, className = "", as = "section", children, ...props }) {
  const Tag = motion[as] || motion.section;
  return (
    <Tag
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 260, damping: 26 }}
      whileHover={lift ? { y: -6 } : undefined}
      className={`rounded-3xl border-2 border-ink p-5 shadow-hard sm:p-6 ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
