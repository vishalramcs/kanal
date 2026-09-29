"use client";
import { AlertTriangle } from "lucide-react";
import ElasticSlider from "@/components/ui/ElasticSlider";
import { PERIODS } from "@/lib/planner";

/** Hours per day (React Bits ElasticSlider) + preferred study periods. Shared by onboarding and settings. */
export default function StudyTimeFields({ profile, onChange }) {
  const set = (patch) => onChange({ ...profile, ...patch });
  const heavy = Math.max(profile.weekdayHours, profile.weekendHours) > 8;
  const togglePeriod = (k) => {
    const has = profile.periods.includes(k);
    if (has && profile.periods.length === 1) return;
    set({ periods: has ? profile.periods.filter((p) => p !== k) : [...profile.periods, k] });
  };
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[["weekdayHours", "Weekdays"], ["weekendHours", "Weekends"]].map(([key, label]) => (
          <div key={key} className="rounded-2xl border-2 border-ink bg-paper p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
            <ElasticSlider value={profile[key]} onChange={(v) => set({ [key]: v })} label={`${label} study hours`} format={(v) => `${v}h`} />
          </div>
        ))}
      </div>
      {heavy && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border-2 border-ink bg-bubble-soft px-4 py-3 font-semibold">
          <AlertTriangle size={18} className="mt-1 shrink-0" />
          That workload may be unrealistic. We recommend adding recovery time; breaks and a buffer are added automatically.
        </p>
      )}
      <div className="grid gap-2">
        <span className="font-extrabold">When do you focus best?</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preferred study periods">
          {Object.entries(PERIODS).map(([k, p]) => (
            <button key={k} type="button" aria-pressed={profile.periods.includes(k)} onClick={() => togglePeriod(k)}
              className="min-h-10 rounded-full border-2 border-ink px-4 font-extrabold aria-pressed:bg-ink aria-pressed:text-cream">
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-ink-soft">Your hardest topics go first in your earliest period.</span>
      </div>
    </div>
  );
}
