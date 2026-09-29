"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Progressive disclosure: a small trigger that reveals details.
 * `onOpen` runs the first time it opens (e.g. to fetch an AI explanation).
 */
export default function Disclosure({ label, children, onOpen, className = "", triggerClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const id = useId();
  const toggle = () => {
    if (!open && !opened) { setOpened(true); onOpen?.(); }
    setOpen((o) => !o);
  };
  return (
    <div className={className}>
      <button
        type="button" onClick={toggle} aria-expanded={open} aria-controls={id}
        className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink/80 bg-paper/70 px-3 py-1 text-sm font-extrabold hover:bg-paper ${triggerClassName}`}
      >
        {label}
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
