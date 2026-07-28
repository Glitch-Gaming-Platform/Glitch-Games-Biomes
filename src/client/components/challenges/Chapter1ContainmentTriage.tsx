import {
  CH1_CONTAINMENT_STAGES,
  CH1_CONTAINMENT_TIMER_SECONDS,
} from "@/shared/harthmere/ch1_latent_skills";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface Chapter1ContainmentCompletion {
  automatic: boolean;
  elapsedMs: number;
}

export const Chapter1ContainmentTriage: React.FunctionComponent<{
  mode: "objective" | "reusable";
  onComplete: (completion: Chapter1ContainmentCompletion) => void;
  onClose?: () => void;
}> = ({ mode, onComplete, onClose }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(
    CH1_CONTAINMENT_TIMER_SECONDS * 1_000
  );
  const startedAtMs = useRef(Date.now());
  const completed = useRef(false);

  const finish = useCallback(
    (automatic: boolean) => {
      if (completed.current) return;
      completed.current = true;
      onComplete({
        automatic,
        elapsedMs: Math.max(0, Date.now() - startedAtMs.current),
      });
    },
    [onComplete]
  );

  useEffect(() => {
    const deadline =
      startedAtMs.current + CH1_CONTAINMENT_TIMER_SECONDS * 1_000;
    const tick = () => {
      const next = Math.max(0, deadline - Date.now());
      setRemainingMs(next);
      if (next === 0) finish(true);
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [finish]);

  const current = CH1_CONTAINMENT_STAGES[stageIndex];
  return (
    <div
      className="bg-slate-950/85 fixed inset-0 z-[1300] flex items-center justify-center px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Containment Triage"
      data-chapter1-containment-triage={mode}
      data-chapter1-containment-stage={current?.id ?? "complete"}
    >
      <div className="rounded-xl border-cyan-100/35 bg-slate-950 w-full max-w-2xl overflow-hidden border text-white shadow-[0_0_55px_rgba(34,211,238,0.22)]">
        <div className="border-cyan-100/20 bg-cyan-950/25 border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-cyan-200/75 text-[10px] font-bold uppercase tracking-[0.22em]">
                Containment Triage · Expert Interface
              </div>
              <div className="text-lg mt-1 font-semibold">
                The labels are already familiar.
              </div>
            </div>
            <div
              className="text-2xl text-amber-200 min-w-[5.5rem] text-right font-mono font-bold"
              data-chapter1-containment-timer={Math.ceil(remainingMs / 1000)}
            >
              {(remainingMs / 1000).toFixed(1)}s
            </div>
          </div>
          <div className="h-1.5 mt-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="from-cyan-300 to-amber-300 h-full bg-gradient-to-r transition-[width] duration-100"
              style={{
                width: `${
                  (remainingMs / (CH1_CONTAINMENT_TIMER_SECONDS * 1_000)) * 100
                }%`,
              }}
            />
          </div>
        </div>

        <div className="grid gap-2 p-5">
          {CH1_CONTAINMENT_STAGES.map((stage, index) => {
            const done = index < stageIndex;
            const active = index === stageIndex;
            return (
              <button
                key={stage.id}
                type="button"
                disabled={!active || completed.current}
                data-chapter1-containment-control={stage.id}
                data-state={done ? "complete" : active ? "active" : "queued"}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  done
                    ? "border-emerald-200/25 bg-emerald-950/20 text-emerald-100/65"
                    : active
                    ? "border-cyan-100/60 bg-cyan-950/30 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                    : "text-white/35 border-white/10 bg-black/20"
                }`}
                onClick={() => {
                  if (!active) return;
                  if (index >= CH1_CONTAINMENT_STAGES.length - 1) {
                    finish(false);
                  } else {
                    setStageIndex(index + 1);
                  }
                }}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">
                  {String(index + 1).padStart(2, "0")} ·{" "}
                  {done ? "locked" : active ? "execute" : "queued"}
                </span>
                <span className="mt-1 block font-mono text-sm font-semibold">
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-white/50">
          <span>There is no failure state. On timeout, your hands finish.</span>
          {mode === "reusable" && onClose && (
            <button
              type="button"
              className="rounded hover:border-white/45 border border-white/20 px-3 py-1 text-white/70"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
