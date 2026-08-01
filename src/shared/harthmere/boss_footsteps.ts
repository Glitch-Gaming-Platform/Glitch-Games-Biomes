import {
  harthmereBossVisualForEntity,
  type HarthmereBossVisualId,
} from "@/shared/harthmere/boss_visual_assets";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const HARTHMERE_BOSS_FOOTSTEPS_VERSION =
  "harthmere-grounded-giant-boss-footsteps-v1" as const;

const GROUNDED_GIANT_BOSS_IDS = new Set<HarthmereBossVisualId>([
  "muck_scarred_helix",
  "gilded_bull",
  "ninth_winter",
  "alpha_mucker",
  "root_crowned_dead",
]);

export interface HarthmereBossStompProfile {
  bossId: HarthmereBossVisualId;
  strideMeters: number;
  minimumIntervalSeconds: number;
  teleportResetMeters: number;
}

export interface HarthmereBossStompState {
  previousPosition?: ReadonlyVec3;
  distanceSinceStomp: number;
  lastStompAtSeconds?: number;
}

export function createHarthmereBossStompState(): HarthmereBossStompState {
  return { distanceSinceStomp: 0 };
}

export function harthmereBossStompProfileForEntity(
  label: string | undefined,
  entityId: number | undefined
): HarthmereBossStompProfile | undefined {
  const visual = harthmereBossVisualForEntity(label, entityId);
  if (!visual || !GROUNDED_GIANT_BOSS_IDS.has(visual.id)) {
    return undefined;
  }
  const strideMeters = Math.max(1.4, Math.min(3, visual.worldSize[1] * 0.2));
  return {
    bossId: visual.id,
    strideMeters,
    minimumIntervalSeconds: 0.55,
    teleportResetMeters: Math.max(10, strideMeters * 4),
  };
}

export function advanceHarthmereBossStomp(
  state: HarthmereBossStompState,
  input: {
    position: ReadonlyVec3;
    moving: boolean;
    alive: boolean;
    nowSeconds: number;
    profile: HarthmereBossStompProfile | undefined;
  }
): boolean {
  const previous = state.previousPosition;
  state.previousPosition = [...input.position];
  if (!input.profile || !input.alive || !input.moving || !previous) {
    state.distanceSinceStomp = 0;
    return false;
  }

  const distance = Math.hypot(
    input.position[0] - previous[0],
    input.position[2] - previous[2]
  );
  if (
    !Number.isFinite(distance) ||
    distance > input.profile.teleportResetMeters
  ) {
    state.distanceSinceStomp = 0;
    return false;
  }
  state.distanceSinceStomp += distance;
  const intervalReady =
    state.lastStompAtSeconds === undefined ||
    input.nowSeconds - state.lastStompAtSeconds >=
      input.profile.minimumIntervalSeconds;
  if (state.distanceSinceStomp < input.profile.strideMeters || !intervalReady) {
    return false;
  }

  state.distanceSinceStomp %= input.profile.strideMeters;
  state.lastStompAtSeconds = input.nowSeconds;
  return true;
}
