"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { History, Plus, Send, Trash2 } from "lucide-react";
import ChatBubble from "@/components/ui/ChatBubble";
import { SourceDialog, SourceList } from "./Sources";
import { deleteConversation, getConversation, listConversations, streamChat } from "@/lib/notebookApi";
import { todayISO } from "@/lib/store";

/** Subject notebook chat: grounded answers from this subject's materials, persistent conversations, clickable citations. */
export default function NotebookChat({ subject, materials, scope, setScope, prefill, onPrefillUsed, starters, onAnswered }) {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const ready = materials.filter((m) => m.status === "ready");

  const refresh = useCallback(() => listConversations(subject.id).then(setConversations).catch(() => {}), [subject.id]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (prefill) { setDraft(prefill); inputRef.current?.focus(); onPrefillUsed(); }
  }, [prefill, onPrefillUsed]);

  const open = async (id) => {
    setError(null);
    if (!id) { setConversationId(null); setMessages([]); return; }
    try {
      const c = await getConversation(subject.id, id);
      setConversationId(c.id);
      setMessages(c.messages);
    } catch (err) {
      setError(err.message);
    }
  };

  const clear = async () => {
    if (conversationId) await deleteConversation(subject.id, conversationId).catch(() => {});
    setConversationId(null);
    setMessages([]);
    refresh();
  };

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "", sources: [], streaming: true }]);
    const patchLast = (fn) => setMessages((m) => [...m.slice(0, -1), fn(m.at(-1))]);
    try {
      await streamChat(subject.id, { question, conversationId, materialIds: scope ? [scope] : [], today: todayISO() }, (e) => {
        if (e.type === "meta") { setConversationId(e.conversationId); patchLast((a) => ({ ...a, sources: e.sources, relevant: e.relevant, mode: e.mode })); }
        if (e.type === "delta") patchLast((a) => ({ ...a, text: a.text + e.text }));
        if (e.type === "error") setError(e.message);
      });
      patchLast((a) => ({ ...a, streaming: false }));
      refresh();
      onAnswered?.();
    } catch (err) {
      setMessages((m) => m.slice(0, -2));
      setDraft(question);
      setError(err.message);
    }
    setBusy(false);
  };

  const sourceByNumber = (msg, n) => msg.sources?.find((s) => s.n === n);

  return (
    <section className="flex h-[min(760px,calc(100vh-10rem))] min-h-[520px] flex-col overflow-hidden rounded-3xl border-2 border-ink bg-cream shadow-hard" aria-label={`${subject.name} notebook chat`}>
      <header className="grid gap-3 border-b-2 border-ink bg-paper px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl leading-tight">{subject.name} — AI Notebook</h2>
            <p className="text-sm font-bold text-ink-soft">Materials: {ready.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm font-extrabold">
              <History size={15} /><span className="sr-only">Conversation history</span>
              <select value={conversationId || ""} onChange={(e) => open(e.target.value)} className="max-w-40 rounded-full border-2 border-ink bg-cream px-2 py-1 text-sm font-bold">
                <option value="">New conversation</option>
                {conversations.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => open(null)} className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold"><Plus size={14} /> New</button>
            {messages.length > 0 && <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold"><Trash2 size={14} /> Clear</button>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Source
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="min-w-0 grow rounded-xl border-2 border-ink bg-cream px-2 py-1.5 font-bold sm:max-w-sm">
            <option value="">All {subject.name} materials</option>
            {ready.map((m) => <option key={m.id} value={m.id}>{m.filename}</option>)}
          </select>
        </label>
      </header>

      <div ref={listRef} className="grow space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
        {!messages.length && (
          <div className="grid justify-items-start gap-3">
            <p className="max-w-lg font-semibold text-ink-soft">
              {ready.length
                ? `Answers come only from your ${subject.name} materials, with the exact page or slide cited.`
                : materials.length ? "Your materials are still processing…" : "Upload your first study material to start your AI Notebook."}
            </p>
            {ready.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-left text-sm font-bold hover:bg-sun-soft">{s}</button>)}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <ChatBubble
            key={i} role={m.role} text={m.text || (m.streaming ? `Searching your ${subject.name} materials…` : "")} streaming={m.streaming}
            onCite={m.role === "assistant" ? (n) => { const s = sourceByNumber(m, n); if (s) setViewing(s); } : undefined}
            footer={m.role === "assistant" && !m.streaming && (
              <>
                {m.relevant && <SourceList sources={m.sources?.filter((s) => m.text.includes(`[${s.n}]`))} onOpen={setViewing} />}
                <span className="mt-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-soft">
                  {m.mode === "gemini" ? `Gemini · grounded in your ${subject.name} materials` : "From your materials"}
                </span>
              </>
            )}
          />
        ))}
        {error && <p role="alert" className="rounded-2xl border-2 border-ink bg-bubble-soft px-4 py-2.5 font-bold">{error}</p>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-center gap-2 border-t-2 border-ink bg-paper p-3">
        <input
          ref={inputRef} value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} disabled={!ready.length}
          placeholder={ready.length ? "Ask anything about your materials…" : "Upload a material first"} aria-label={`Ask your ${subject.name} materials`}
          className="min-h-11 min-w-0 grow rounded-full border-2 border-ink bg-cream px-4 font-semibold disabled:opacity-60"
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun shadow-hard-sm disabled:opacity-40">
          <Send size={17} />
        </button>
      </form>
      <SourceDialog subjectId={subject.id} source={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}
