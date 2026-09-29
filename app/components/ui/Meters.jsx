"use client";
// Small data displays: progress ring, bar, and topic strength badge (colour + label, never colour alone).
import { motion } from "framer-motion";
import { strength } from "@/lib/priority";

export function Ring({ value = 0, size = 120, stroke = 12, color = "var(--color-cobalt)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(v * 100)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-cream-deep)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute text-center leading-none">{children}</div>
    </div>
  );
}

export function Bar({ value = 0, color = "var(--color-cobalt)", label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
    </div>
  );
}

const LEVEL = {
  weak: { label: "Weak", cls: "bg-bubble-soft text-weak" },
  medium: { label: "Okay", cls: "bg-sun-soft text-medium" },
  strong: { label: "Strong", cls: "bg-[hsl(150_55%_90%)] text-strong" },
};

export function Strength({ confidence, showValue = true }) {
  const s = LEVEL[strength(confidence)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap ${s.cls}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}{showValue ? ` · ${confidence}%` : ""}
    </span>
  );
}
