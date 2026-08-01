import type { EmoteType } from "@/shared/ecs/gen/types";

export type CutscenePlayerAttackAnimation = Extract<
  EmoteType,
  "attack1" | "attack2"
>;

export interface CutscenePlayerAttackVisualPose {
  pitchRadians: number;
  rollRadians: number;
  yawRadians: number;
  liftMeters: number;
}

// Matches the existing basic Harthmere body-attack timing profile. This is a
// presentation-only cutscene lifetime; gameplay attack timing remains owned
// by the established attack path.
export const CUTSCENE_PLAYER_ATTACK_DURATION_SECONDS = 0.71;

function phase(
  progress: number,
  start: number,
  end: number,
  from: number,
  to: number
) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  const eased = t * t * (3 - 2 * t);
  return from + (to - from) * eased;
}

/**
 * Conservative root-level fallback for generated avatar shells that do not
 * expose the arm joints used by the real Harthmere weapon animation. The real
 * Attack/Attack2 clip still plays underneath; this only keeps the wind-up,
 * strike, and recovery readable in mutation-free cutscene previews.
 */
export function cutscenePlayerAttackVisualPose(
  animation: CutscenePlayerAttackAnimation | undefined,
  progress: number
): CutscenePlayerAttackVisualPose | undefined {
  if (!animation) {
    return;
  }
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  if (t === 0 || t === 1) {
    return {
      pitchRadians: 0,
      rollRadians: 0,
      yawRadians: 0,
      liftMeters: 0,
    };
  }
  const side = animation === "attack1" ? 1 : -1;
  const yaw =
    t < 0.28
      ? phase(t, 0, 0.28, 0, 0.38 * side)
      : t < 0.58
      ? phase(t, 0.28, 0.58, 0.38 * side, -0.42 * side)
      : phase(t, 0.58, 1, -0.42 * side, 0);
  const strikeEnvelope = Math.sin(Math.PI * t);
  return {
    pitchRadians: -0.16 * strikeEnvelope,
    rollRadians: -0.12 * side * strikeEnvelope,
    yawRadians: yaw,
    liftMeters: 0.035 * strikeEnvelope,
  };
}
