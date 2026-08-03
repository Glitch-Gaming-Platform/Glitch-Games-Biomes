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
  soundVolumeMultiplier: number;
  soundRefDistance: number;
  soundMaxDistance: number;
  soundRolloffFactor: number;
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
  const footprintMeters = Math.max(visual.worldSize[0], visual.worldSize[2]);
  return {
    bossId: visual.id,
    strideMeters,
    minimumIntervalSeconds: 0.55,
    teleportResetMeters: Math.max(10, strideMeters * 4),
    // Generated Harthmere paths do not pass through the Galois "footsteps"
    // asset class, so they do not receive its 6x boost. A generic 2 m
    // reference distance also made a giant stomp nearly vanish at normal boss
    // ranges even though the clip loaded and played successfully.
    soundVolumeMultiplier: 4,
    soundRefDistance: Math.max(8, Math.min(18, footprintMeters * 1.1)),
    soundMaxDistance: Math.max(96, footprintMeters * 10),
    soundRolloffFactor: 0.85,
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
