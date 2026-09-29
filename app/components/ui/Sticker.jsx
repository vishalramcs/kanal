"use client";
import { motion } from "framer-motion";

const TONES = { bubble: "bg-bubble text-ink", cobalt: "bg-cobalt text-cream", sun: "bg-sun text-ink", paper: "bg-paper text-ink" };

/** Rotated sticker badge that drops in and wobbles on hover. Position it with `className`. */
export default function Sticker({ children, rotate = -8, tone = "bubble", delay = 0.5, className = "" }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ y: -30, rotate: 0, opacity: 0 }}
      animate={{ y: 0, rotate, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 16, delay }}
      whileHover={{ rotate: [rotate, rotate - 6, rotate + 6, rotate], transition: { duration: 0.5 } }}
      className={`absolute z-10 inline-block select-none rounded-full border-2 border-ink px-3.5 py-1.5 text-[13px] font-extrabold whitespace-nowrap shadow-hard-sm max-md:scale-75 ${TONES[tone]} ${className}`}
    >
      {children}
    </motion.span>
  );
}
