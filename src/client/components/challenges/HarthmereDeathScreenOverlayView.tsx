import React from "react";

export const HARTHMERE_DEATH_SCREEN_VERSION =
  "harthmere-death-screen-grove-respawn" as const;

export const HarthmereDeathScreenOverlayView: React.FunctionComponent<{
  cause: string;
  consequence: string;
  downedSeconds: number;
  groveRespawnBlock?: string;
  onRespawn: () => void;
}> = ({
  cause,
  consequence,
  downedSeconds,
  groveRespawnBlock,
  onRespawn,
}) => {
  return (
    <div
      className="bg-black/45 pointer-events-none fixed inset-0 z-[70] flex items-center justify-center text-white"
      data-harthmere-death-screen-version={HARTHMERE_DEATH_SCREEN_VERSION}
      style={{
        textShadow: "0 2px 5px rgba(0,0,0,0.95)",
        backdropFilter: "grayscale(1) brightness(0.72)",
      }}
    >
      <div className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] text-center">
        <div className="text-lg font-black tracking-tight text-white">
          {cause}
        </div>
        <div className="text-base text-white/55 mx-auto mt-1 max-w-[22rem] font-bold leading-snug">
          {consequence}
        </div>
        {downedSeconds > 0 && (
          <div className="mt-2 text-xs font-semibold text-white/60">
            Forced spirit release in {downedSeconds}s.
          </div>
        )}
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <button
            className="rounded-lg border-violet-200/80 text-base disabled:opacity-45 min-w-[19rem] border-2 bg-[#6f3cff] px-5 py-3 font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.55),0_0_22px_rgba(111,60,255,0.65)] outline outline-1 outline-black/60 hover:bg-[#8357ff] focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed"
            data-harthmere-death-respawn-grove="true"
            disabled={Boolean(groveRespawnBlock)}
            onClick={onRespawn}
            title={groveRespawnBlock}
          >
            Resurrect at The Grove Safe Point
          </button>
          <div className="text-[11px] font-bold text-white/70">
            Return to the safe respawn marker and recover control.
          </div>
        </div>
      </div>
    </div>
  );
};
