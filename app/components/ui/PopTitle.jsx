"use client";
import { motion } from "framer-motion";

/**
 * Big headline whose words pop in one by one. Each entry in `lines` is one line;
 * wrap a word in *asterisks* to give it the highlighter treatment.
 */
export default function PopTitle({ lines, className = "" }) {
  let i = 0;
  return (
    <h1 className={`text-[clamp(48px,7.5vw,104px)] leading-[0.9] tracking-[-0.04em] ${className}`}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((word) => {
            const em = word.startsWith("*") && word.endsWith("*");
            const delay = 0.08 * i++;
            return (
              <motion.span
                key={`${li}-${word}-${delay}`}
                className={`mr-[0.2em] inline-block ${em ? "rounded-[0.18em] bg-bubble px-[0.1em]" : ""}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay }}
              >
                {em ? word.slice(1, -1) : word}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
