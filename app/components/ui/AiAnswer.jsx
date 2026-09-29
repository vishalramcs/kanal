import { Sparkles } from "lucide-react";

/** Shows an AI result (or a loading line) and where it came from: Gemini or the local engine. */
export default function AiAnswer({ loading, result, render }) {
  if (loading || !result) {
    return <p className="animate-pulse font-semibold text-ink-soft">Thinking it through…</p>;
  }
  return (
    <div className="grid gap-2">
      {render(result.data)}
      <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-ink-soft">
        <Sparkles size={12} /> {result.source === "gemini" ? "Gemini" : "ADAPT engine (offline)"}
      </p>
    </div>
  );
}
