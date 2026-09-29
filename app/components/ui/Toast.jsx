"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onNotify } from "@/lib/toast";

/** Listens to lib/toast notify() calls and shows one message at a time. */
export default function Toast() {
  const [message, setMessage] = useState(null);
  useEffect(() => onNotify(setMessage), []);
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(null), 3600);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] sm:bottom-6 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 20, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 20 }}
            className="rounded-2xl border-2 border-ink bg-sun px-5 py-3 font-extrabold shadow-hard"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
