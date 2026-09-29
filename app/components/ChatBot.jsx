"use client";
// Global AI study assistant: floating button (bottom-right) that opens a small chat panel.
// Mounted once in the app shell; answers from the student's current plan and progress.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, MessageCircle, Minimize2, Send, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { askAI, chatContext } from "@/lib/ai";
import ChatBubble from "@/components/ui/ChatBubble";

const STARTERS = ["What should I study tonight?", "Which topics are my weakest?", "I missed a session. What now?"];
const MAX_LEN = 500;

export default function ChatBot() {
  const state = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const today = state?.plan?.generatedFor;

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text) => {
    const question = text.trim().slice(0, MAX_LEN);
    if (!question || busy || !today) return;
    const next = [...messages, { role: "user", text: question }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    const { source, data } = await askAI("chat", chatContext(state, today, next));
    setMessages([...next, { role: "assistant", text: data.reply, followUps: data.followUps?.slice(0, 3) || [], source }]);
    setBusy(false);
  };

  const last = messages.at(-1);
  const chips = !messages.length ? STARTERS : last?.role === "assistant" ? last.followUps : [];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog" aria-label="ADAPT study assistant"
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`flex flex-col overflow-hidden rounded-3xl border-2 border-ink bg-cream shadow-hard-lg transition-[width,height] duration-200 ${large ? "h-[calc(100vh-7rem)] w-[min(760px,calc(100vw-2.5rem))]" : "h-[min(700px,calc(100vh-7rem))] w-[min(460px,calc(100vw-2.5rem))]"}`}
          >
            <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-sun px-4 py-3">
              <p className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles size={18} /> Study assistant</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setLarge((l) => !l)} aria-label={large ? "Make the assistant smaller" : "Make the assistant bigger"} aria-pressed={large} className="hidden size-8 place-items-center rounded-full border-2 border-ink bg-paper sm:grid">
                  {large ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="grid size-8 place-items-center rounded-full border-2 border-ink bg-paper">
                  <X size={15} />
                </button>
              </div>
            </header>

            <div ref={listRef} className="grow space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {!messages.length && (
                <p className="rounded-2xl border-2 border-ink bg-paper px-4 py-3 font-semibold">
                  Hi{state?.profile?.name ? ` ${state.profile.name}` : ""}! Ask me anything about your plan: what to study next, your weak spots, or what to do after a missed session.
                </p>
              )}
              {messages.map((m, i) => (
                <ChatBubble
                  key={i} role={m.role} text={m.text}
                  footer={m.role === "assistant" && (
                    <span className="mt-1 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-soft">{m.source === "gemini" ? "Gemini" : "ADAPT engine (offline)"}</span>
                  )}
                />
              ))}
              {busy && <p className="w-fit animate-pulse rounded-2xl border-2 border-ink bg-paper px-3.5 py-2.5 font-semibold">Thinking…</p>}
            </div>

            {chips.length > 0 && !busy && (
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {chips.map((c) => (
                  <button key={c} type="button" onClick={() => send(c)} className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-left text-sm font-bold hover:bg-sun-soft">{c}</button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-center gap-2 border-t-2 border-ink bg-paper p-3">
              <input
                ref={inputRef} value={draft} maxLength={MAX_LEN} onChange={(e) => setDraft(e.target.value)} disabled={!today}
                placeholder="Ask about your plan…" aria-label="Message the study assistant"
                className="min-h-11 min-w-0 grow rounded-full border-2 border-ink bg-cream px-4 font-semibold"
              />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun shadow-hard-sm disabled:opacity-40">
                <Send size={17} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close study assistant" : "Open study assistant"}
        whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
        className="flex min-h-14 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 font-extrabold shadow-hard sm:px-5"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        <span className="hidden sm:inline">{open ? "Close" : "Ask ADAPT"}</span>
      </motion.button>
    </div>
  );
}
