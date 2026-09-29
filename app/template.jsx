"use client";
// Re-mounts on every navigation: a short, subtle page transition.
import { motion } from "framer-motion";

export default function Template({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
