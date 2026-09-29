// One chat message bubble, shared by the global assistant and the notebook.
// With `onCite`, inline markers like [2] become buttons that open that source.

function withCitations(text, onCite) {
  if (!onCite) return text;
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return part;
    return (
      <button key={i} type="button" onClick={() => onCite(Number(m[1]))} aria-label={`Open source ${m[1]}`}
        className="mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-sun px-1 align-middle text-[11px] font-extrabold leading-none">
        {m[1]}
      </button>
    );
  });
}

export default function ChatBubble({ role, text, onCite, footer, streaming = false }) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : ""}>
      <div className={`max-w-[88%] ${mine ? "" : "w-full sm:w-auto"}`}>
        <p className={`whitespace-pre-line rounded-2xl border-2 border-ink px-3.5 py-2.5 text-[15px] font-semibold ${mine ? "rounded-br-sm bg-cobalt text-cream" : "rounded-bl-sm bg-paper"}`}>
          {withCitations(text, onCite)}
          {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ink align-middle" aria-hidden="true" />}
        </p>
        {footer}
      </div>
    </div>
  );
}
