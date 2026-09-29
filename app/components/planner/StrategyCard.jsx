"use client";
import { Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AiAnswer from "@/components/ui/AiAnswer";
import { actions } from "@/lib/store";
import { planContext, useAI } from "@/lib/ai";

/** Personalised strategy written by Gemini (or the local engine), generated on demand and remembered. */
export default function StrategyCard({ state, today }) {
  const ai = useAI("plan");
  const saved = state.strategy;
  const generate = async () => {
    const result = await ai.run(planContext(state, today));
    actions.setStrategy({ ...result, for: today });
  };
  const result = ai.result || saved;

  return (
    <Card tone="cobalt" index={1}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em]"><Sparkles size={14} /> Your strategy</p>
        <Button size="sm" variant="sun" onClick={generate} disabled={ai.loading}>{result ? "Refresh" : "Write my strategy"}</Button>
      </div>
      {!result && !ai.loading && <p className="mt-3 max-w-xl font-semibold text-cream/85">Get a short, personal game plan for your exams: what to focus on, and the one risk to watch.</p>}
      {(result || ai.loading) && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-5 text-ink">
          <AiAnswer
            loading={ai.loading}
            result={result}
            render={(d) => (
              <>
                <p className="font-display text-2xl font-extrabold leading-tight">{d.headline}</p>
                <ul className="mt-1 grid list-disc gap-1 pl-5 font-semibold">{d.strategy.slice(0, 4).map((s) => <li key={s}>{s}</li>)}</ul>
                <p className="font-bold"><span className="rounded bg-sun px-1">Watch out:</span> {d.risk}</p>
              </>
            )}
          />
        </div>
      )}
    </Card>
  );
}
