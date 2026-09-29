"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/** Accessible dialog: focus trap, Escape closes, focus returns to the opener. */
export default function Modal({ open, title, onClose, children, dismissable = true, wide = false }) {
  const ref = useRef(null);
  // Keep the latest onClose in a ref: parents pass a new function every render, and re-running the
  // effect below on each keystroke would steal focus back to the first field.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = ref.current;
    requestAnimationFrame(() => node?.querySelector("input, select, textarea, button:not([data-close])")?.focus());
    const onKey = (e) => {
      if (e.key === "Escape" && dismissable) closeRef.current();
      if (e.key !== "Tab" || !node) return;
      const f = [...node.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [open, dismissable]); // only when the dialog opens or closes

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-label={title}
            initial={{ scale: 0.94, y: 16, rotate: -1 }} animate={{ scale: 1, y: 0, rotate: 0 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`max-h-[calc(100vh-2rem)] w-full overflow-auto rounded-[28px] border-2 border-ink bg-cream p-6 shadow-[8px_8px_0_var(--color-ink)] sm:p-7 ${wide ? "max-w-2xl" : "max-w-lg"}`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-2xl leading-tight sm:text-3xl">{title}</h2>
              {dismissable && (
                <button data-close type="button" onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper">
                  <X size={18} />
                </button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
