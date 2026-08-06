export const HARTHMERE_BOSS_ANIMATION_POLISH_VERSION =
  "harthmere-boss-animation-polish-v1" as const;

export const HARTHMERE_BOSS_ACTION_EASE_IN_SECS = 0.12;
export const HARTHMERE_BOSS_ACTION_EASE_OUT_SECS = 0.2;
export const HARTHMERE_BOSS_SPECIAL_EASE_IN_SECS = 0.14;
export const HARTHMERE_BOSS_SPECIAL_EASE_OUT_SECS = 0.22;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Symmetric, deterministic envelope for bespoke boss clips mixed outside the
 * shared animation system. It preserves the authored contact frame while
 * removing the hard pose cut at clip entry and recovery.
 */
export function harthmereBossSpecialAnimationBlendWeight(input: {
  elapsedSecs: number;
  durationSecs: number;
}) {
  const elapsed = Math.max(0, Number(input.elapsedSecs) || 0);
  const duration = Math.max(0, Number(input.durationSecs) || 0);
  if (duration <= 0 || elapsed >= duration) return 0;
  const easeIn = smoothstep(elapsed / HARTHMERE_BOSS_SPECIAL_EASE_IN_SECS);
  const remaining = duration - elapsed;
  const easeOut = smoothstep(remaining / HARTHMERE_BOSS_SPECIAL_EASE_OUT_SECS);
  return Math.min(easeIn, easeOut);
}
