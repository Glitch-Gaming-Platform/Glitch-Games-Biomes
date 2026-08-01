import { dist } from "@/shared/math/linear";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const MAX_FISHING_CAST_SECONDS = 8;
export const MIN_FISHING_CATCH_BAR_SIZE = 0.05;
export const MAX_FISHING_CATCH_BAR_SIZE = 1;
export const MAX_FISHING_TICK_DELTA_SECONDS = 0.1;
export const FISHING_MOVEMENT_RESET_DISTANCE = 0.2;

export function fishingCastExpired(elapsedSeconds: number): boolean {
  return (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    elapsedSeconds > MAX_FISHING_CAST_SECONDS
  );
}

export function normalizeFishingCatchBarSize(size: number): number {
  if (!Number.isFinite(size)) return MIN_FISHING_CATCH_BAR_SIZE;
  return Math.min(
    MAX_FISHING_CATCH_BAR_SIZE,
    Math.max(MIN_FISHING_CATCH_BAR_SIZE, size)
  );
}

export function boundedFishingTickDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, MAX_FISHING_TICK_DELTA_SECONDS);
}

export function fishingMovementRequiresReset(
  previous: ReadonlyVec3 | undefined,
  current: ReadonlyVec3
): boolean {
  return (
    previous !== undefined &&
    (!previous.every(Number.isFinite) ||
      !current.every(Number.isFinite) ||
      dist(current, previous) > FISHING_MOVEMENT_RESET_DISTANCE)
  );
}
