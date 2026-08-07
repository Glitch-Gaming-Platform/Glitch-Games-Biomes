import type { HarthmereCrosshairCombatActor } from "@/client/components/challenges/harthmereCrosshairCombatTarget";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import type { ReadonlyVec2, Vec2 } from "@/shared/math/types";
import { normalizeAngle } from "@/shared/math/angles";
import { pitchAndYaw, sub } from "@/shared/math/linear";
import { clamp } from "@/shared/math/math";

export const HARTHMERE_COMBAT_LOCK_ON_VERSION =
  "harthmere-combat-lock-on-v1" as const;
export const HARTHMERE_COMBAT_LOCK_ON_EVENT =
  "biomes:harthmere-combat-lock-on-changed";
export const HARTHMERE_COMBAT_LOCK_ACQUIRE_RANGE = 28;
export const HARTHMERE_COMBAT_LOCK_HOLD_RANGE = 36;
export const HARTHMERE_COMBAT_LOCK_LOST_GRACE_MS = 1_250;
export const HARTHMERE_COMBAT_LOCK_TARGET_RESPONSE_PER_SECOND = 8;
export const HARTHMERE_COMBAT_LOCK_MAX_YAW_RATE_RADIANS_PER_SECOND = 3.2;
export const HARTHMERE_COMBAT_LOCK_MAX_PITCH_RATE_RADIANS_PER_SECOND = 1.8;
export const HARTHMERE_COMBAT_LOCK_ANGLE_DEAD_ZONE_RADIANS = 0.006;

export type HarthmereCombatLockCandidate = HarthmereCrosshairCombatActor & {
  world: Vec3;
  screenX: number;
  screenY: number;
  screenVisible: boolean;
  distance: number;
  boss: boolean;
  hostile: boolean;
};

export type HarthmereCombatLockTarget = {
  offset: number;
  entityId?: number;
  targetId?: string;
  label: string;
  world: Vec3;
  screenX: number;
  screenY: number;
  screenVisible: boolean;
  radius: number;
  distance: number;
  boss: boolean;
  hostile: boolean;
  behavior?: string;
  socialRole?: string;
  acquiredAt: number;
  lastSeenAt: number;
  lostAt?: number;
};

export type HarthmereCombatLockState = {
  version: typeof HARTHMERE_COMBAT_LOCK_ON_VERSION;
  active: boolean;
  sequence: number;
  updatedAt: number;
  reason: string;
  target?: HarthmereCombatLockTarget;
};

const listeners = new Set<() => void>();
let latestCandidates: HarthmereCombatLockCandidate[] = [];
let state: HarthmereCombatLockState = {
  version: HARTHMERE_COMBAT_LOCK_ON_VERSION,
  active: false,
  sequence: 0,
  updatedAt: 0,
  reason: "initial",
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedText(actor: HarthmereCrosshairCombatActor) {
  return `${actor.label ?? ""} ${actor.asset ?? ""} ${actor.targetId ?? ""} ${
    actor.behavior ?? ""
  } ${actor.socialRole ?? ""}`.toLowerCase();
}

export function harthmereCombatLockActorIsBoss(
  actor: HarthmereCrosshairCombatActor
) {
  return /(?:^|[\s:_-])boss(?:$|[\s:_-])|alpha mucker|gilded bull|echo singer|failed apprentice|first choir|hex wraith|muck-scarred helix|ninth winter|root-crowned dead|thaedryn|vyrahel/.test(
    normalizedText(actor)
  );
}

export function harthmereCombatLockActorIsHostile(
  actor: HarthmereCrosshairCombatActor
) {
  const behavior = actor.behavior?.toLowerCase();
  const socialRole = actor.socialRole?.toLowerCase();
  return (
    behavior === "hostile" ||
    socialRole === "hostile" ||
    /muck|hex|bandit|outlaw|undead|zombie|monster|enemy|hostile|wyrm/.test(
      normalizedText(actor)
    )
  );
}

export function harthmereCombatLockActorEligible(input: {
  actor: HarthmereCrosshairCombatActor;
  distance: number;
  acquiring: boolean;
}) {
  const { actor, distance, acquiring } = input;
  if (
    actor.attackable === false ||
    !finite(actor.offset) ||
    !finite(distance) ||
    distance >
      (acquiring
        ? HARTHMERE_COMBAT_LOCK_ACQUIRE_RANGE
        : HARTHMERE_COMBAT_LOCK_HOLD_RANGE) +
        Math.max(0, finite(actor.radius) ? actor.radius : 0)
  ) {
    return false;
  }
  if (actor.health && finite(actor.health.hp) && actor.health.hp <= 0) {
    return false;
  }
  if (acquiring && actor.screenVisible === false) {
    return false;
  }
  const behavior = actor.behavior?.toLowerCase();
  const socialRole = actor.socialRole?.toLowerCase();
  if (
    behavior === "merchant" ||
    behavior === "passive" ||
    socialRole === "merchant" ||
    socialRole === "civilian"
  ) {
    return false;
  }
  return (
    harthmereCombatLockActorIsHostile(actor) ||
    harthmereCombatLockActorIsBoss(actor) ||
    behavior === "defensive" ||
    behavior === "guard" ||
    behavior === "training_dummy" ||
    socialRole === "wildlife" ||
    socialRole === "guard" ||
    socialRole === "training" ||
    (actor.species !== undefined && actor.species !== "human")
  );
}

export function scoreHarthmereCombatLockCandidate(input: {
  candidate: HarthmereCombatLockCandidate;
  viewportWidth: number;
  viewportHeight: number;
  previousOffset?: number;
}) {
  const { candidate } = input;
  const centerX = input.viewportWidth / 2;
  const centerY = input.viewportHeight / 2;
  const diagonal = Math.max(
    1,
    Math.hypot(input.viewportWidth, input.viewportHeight)
  );
  const screenDistance = Math.hypot(
    candidate.screenX - centerX,
    candidate.screenY - centerY
  );
  const screenScore = 1 - Math.min(1, screenDistance / (diagonal * 0.42));
  const distanceScore =
    1 - Math.min(1, candidate.distance / HARTHMERE_COMBAT_LOCK_ACQUIRE_RANGE);
  return (
    screenScore * 5 +
    distanceScore * 3 +
    (candidate.hostile ? 1.5 : 0) +
    (candidate.boss ? 1.25 : 0) +
    (candidate.offset === input.previousOffset ? 0.75 : 0) +
    (candidate.screenVisible ? 0.5 : 0)
  );
}

export function chooseHarthmereCombatLockCandidate(input: {
  candidates: readonly HarthmereCombatLockCandidate[];
  viewportWidth: number;
  viewportHeight: number;
  previousOffset?: number;
}) {
  return input.candidates
    .filter((candidate) =>
      harthmereCombatLockActorEligible({
        actor: candidate,
        distance: candidate.distance,
        acquiring: true,
      })
    )
    .map((candidate) => ({
      candidate,
      score: scoreHarthmereCombatLockCandidate({ ...input, candidate }),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.distance - right.candidate.distance ||
        left.candidate.offset - right.candidate.offset
    )[0]?.candidate;
}

export function cycleHarthmereCombatLockCandidate(input: {
  candidates: readonly HarthmereCombatLockCandidate[];
  currentOffset: number;
  direction: -1 | 1;
}) {
  const eligible = input.candidates
    .filter((candidate) =>
      harthmereCombatLockActorEligible({
        actor: candidate,
        distance: candidate.distance,
        acquiring: true,
      })
    )
    .sort(
      (left, right) =>
        left.screenX - right.screenX || left.distance - right.distance
    );
  if (eligible.length <= 1) return undefined;
  const index = eligible.findIndex(
    (candidate) => candidate.offset === input.currentOffset
  );
  const nextIndex =
    ((index < 0 ? 0 : index) + input.direction + eligible.length) %
    eligible.length;
  return eligible[nextIndex];
}

function targetFromCandidate(
  candidate: HarthmereCombatLockCandidate,
  now: number,
  previous?: HarthmereCombatLockTarget
): HarthmereCombatLockTarget {
  return {
    offset: candidate.offset,
    entityId: candidate.entityId,
    targetId: candidate.targetId,
    label: candidate.label?.trim() || "Target",
    world: [...candidate.world],
    screenX: candidate.screenX,
    screenY: candidate.screenY,
    screenVisible: candidate.screenVisible,
    radius: finite(candidate.radius) ? candidate.radius : 1.15,
    distance: candidate.distance,
    boss: candidate.boss,
    hostile: candidate.hostile,
    behavior: candidate.behavior,
    socialRole: candidate.socialRole,
    acquiredAt: previous?.acquiredAt ?? now,
    lastSeenAt: candidate.screenVisible ? now : (previous?.lastSeenAt ?? now),
    lostAt: candidate.screenVisible ? undefined : (previous?.lostAt ?? now),
  };
}

function publish(next: HarthmereCombatLockState) {
  state = next;
  if (typeof window !== "undefined") {
    const debugWindow = window as typeof window & {
      __harthmereCombatLockOnDebug?: HarthmereCombatLockState;
    };
    debugWindow.__harthmereCombatLockOnDebug = {
      ...next,
      target: next.target
        ? { ...next.target, world: [...next.target.world] }
        : undefined,
    };
    window.dispatchEvent(new CustomEvent(HARTHMERE_COMBAT_LOCK_ON_EVENT));
  }
  for (const listener of listeners) listener();
}

export function readHarthmereCombatLockState() {
  return state;
}

export function subscribeHarthmereCombatLockState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setHarthmereCombatLockCandidates(
  candidates: readonly HarthmereCombatLockCandidate[]
) {
  latestCandidates = candidates.map((candidate) => ({
    ...candidate,
    world: [...candidate.world],
  }));
}

export function readHarthmereCombatLockCandidates() {
  return latestCandidates;
}

export function clearHarthmereCombatLock(reason = "manual", now = Date.now()) {
  if (!state.active && !state.target) return;
  publish({
    version: HARTHMERE_COMBAT_LOCK_ON_VERSION,
    active: false,
    sequence: state.sequence + 1,
    updatedAt: now,
    reason,
  });
}

export function lockHarthmereCombatTarget(
  candidate: HarthmereCombatLockCandidate,
  reason = "manual",
  now = Date.now()
) {
  publish({
    version: HARTHMERE_COMBAT_LOCK_ON_VERSION,
    active: true,
    sequence: state.sequence + 1,
    updatedAt: now,
    reason,
    target: targetFromCandidate(candidate, now),
  });
}

export function toggleHarthmereCombatLock(input: {
  viewportWidth: number;
  viewportHeight: number;
  now?: number;
}) {
  if (state.active) {
    clearHarthmereCombatLock("tab_toggle_off", input.now);
    return undefined;
  }
  const candidate = chooseHarthmereCombatLockCandidate({
    candidates: latestCandidates,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    previousOffset: state.target?.offset,
  });
  if (!candidate) {
    publish({
      version: HARTHMERE_COMBAT_LOCK_ON_VERSION,
      active: false,
      sequence: state.sequence + 1,
      updatedAt: input.now ?? Date.now(),
      reason: "no_valid_target",
    });
    return undefined;
  }
  lockHarthmereCombatTarget(candidate, "tab_toggle_on", input.now);
  return candidate;
}

export function switchHarthmereCombatLock(direction: -1 | 1, now = Date.now()) {
  const target = state.target;
  if (!state.active || !target) return undefined;
  const candidate = cycleHarthmereCombatLockCandidate({
    candidates: latestCandidates,
    currentOffset: target.offset,
    direction,
  });
  if (!candidate) return undefined;
  lockHarthmereCombatTarget(candidate, "screen_relative_cycle", now);
  return candidate;
}

export function refreshHarthmereCombatLock(
  candidates: readonly HarthmereCombatLockCandidate[],
  now = Date.now()
) {
  setHarthmereCombatLockCandidates(candidates);
  const target = state.target;
  if (!state.active || !target) return state;
  const candidate = candidates.find((entry) => entry.offset === target.offset);
  if (
    candidate &&
    harthmereCombatLockActorEligible({
      actor: candidate,
      distance: candidate.distance,
      acquiring: false,
    })
  ) {
    const nextTarget = targetFromCandidate(candidate, now, target);
    if (
      nextTarget.lostAt !== undefined &&
      now - nextTarget.lostAt > HARTHMERE_COMBAT_LOCK_LOST_GRACE_MS
    ) {
      clearHarthmereCombatLock("occluded_too_long", now);
      return state;
    }
    publish({
      ...state,
      updatedAt: now,
      reason: nextTarget.lostAt ? "occlusion_grace" : "tracking",
      target: nextTarget,
    });
    return state;
  }
  const lostAt = target.lostAt ?? now;
  if (now - lostAt > HARTHMERE_COMBAT_LOCK_LOST_GRACE_MS) {
    clearHarthmereCombatLock("target_invalid_or_missing", now);
    return state;
  }
  publish({
    ...state,
    updatedAt: now,
    reason: "missing_grace",
    target: { ...target, lostAt, screenVisible: false },
  });
  return state;
}

export function harthmereCombatLockCameraTarget(playerPosition: ReadonlyVec3) {
  const target = state.target;
  if (!state.active || !target) return undefined;
  const distance = Math.hypot(
    target.world[0] - playerPosition[0],
    target.world[2] - playerPosition[2]
  );
  // Candidate refresh owns unlock timing. During its brief missing/occlusion
  // grace, keep feeding the last trustworthy world sample to the camera even
  // if the player or stale sample momentarily crosses the hold radius. Returning
  // undefined here while state remained active made camera.ts enable free-look
  // for a frame, visibly spin away, then snap back when the candidate returned.
  if (
    target.lostAt === undefined &&
    distance > HARTHMERE_COMBAT_LOCK_HOLD_RANGE + target.radius
  ) {
    return undefined;
  }
  return {
    ...target,
    world: [...target.world] as Vec3,
    distance,
  };
}

export function harthmereCombatLockCameraFrame(input: {
  currentOrientation: ReadonlyVec2;
  eye: ReadonlyVec3;
  target: ReadonlyVec3;
  targetRadius: number;
  distance: number;
  dt: number;
}) {
  const lookTarget: Vec3 = [
    input.target[0],
    input.target[1] + Math.max(0.55, input.targetRadius * 0.65),
    input.target[2],
  ];
  const desired = pitchAndYaw(sub(lookTarget, input.eye));
  desired[0] = clamp(desired[0], -0.34, 0.34);
  const blend = clamp(1 - Math.exp(-Math.max(0, input.dt) * 12), 0, 1);
  const dt = Math.max(0, input.dt);
  const pitchDelta = desired[0] - input.currentOrientation[0];
  const yawDelta = normalizeAngle(desired[1] - input.currentOrientation[1]);
  const pitchStep =
    Math.abs(pitchDelta) <= HARTHMERE_COMBAT_LOCK_ANGLE_DEAD_ZONE_RADIANS
      ? 0
      : clamp(
          pitchDelta * blend,
          -HARTHMERE_COMBAT_LOCK_MAX_PITCH_RATE_RADIANS_PER_SECOND * dt,
          HARTHMERE_COMBAT_LOCK_MAX_PITCH_RATE_RADIANS_PER_SECOND * dt
        );
  const yawStep =
    Math.abs(yawDelta) <= HARTHMERE_COMBAT_LOCK_ANGLE_DEAD_ZONE_RADIANS
      ? 0
      : clamp(
          yawDelta * blend,
          -HARTHMERE_COMBAT_LOCK_MAX_YAW_RATE_RADIANS_PER_SECOND * dt,
          HARTHMERE_COMBAT_LOCK_MAX_YAW_RATE_RADIANS_PER_SECOND * dt
        );
  const orientation: Vec2 = [
    input.currentOrientation[0] + pitchStep,
    normalizeAngle(input.currentOrientation[1] + yawStep),
  ];
  return {
    orientation,
    pullbackMeters: clamp((input.distance - 4) * 0.14, 0.35, 3.4),
    fovBoostDegrees: clamp((input.distance - 5) * 0.22, 0, 7),
  };
}

export function smoothHarthmereCombatLockTarget(input: {
  current: ReadonlyVec3;
  target: ReadonlyVec3;
  dt: number;
}): Vec3 {
  const blend = clamp(
    1 -
      Math.exp(
        -Math.max(0, input.dt) *
          HARTHMERE_COMBAT_LOCK_TARGET_RESPONSE_PER_SECOND
      ),
    0,
    1
  );
  return [
    input.current[0] + (input.target[0] - input.current[0]) * blend,
    input.current[1] + (input.target[1] - input.current[1]) * blend,
    input.current[2] + (input.target[2] - input.current[2]) * blend,
  ];
}

export function pickHarthmereLockedCombatActor(input: {
  actors: readonly HarthmereCrosshairCombatActor[];
  playerX?: number;
  playerZ?: number;
  worldReach: number;
}) {
  const target = state.target;
  if (!state.active || !target) return undefined;
  const actor = input.actors.find((entry) => entry.offset === target.offset);
  if (!actor || actor.attackable === false) return undefined;
  let worldDistance: number | undefined;
  if (
    finite(input.playerX) &&
    finite(input.playerZ) &&
    finite(actor.worldX) &&
    finite(actor.worldZ)
  ) {
    worldDistance = Math.hypot(
      actor.worldX - input.playerX,
      actor.worldZ - input.playerZ
    );
    if (
      worldDistance >
      input.worldReach + (finite(actor.radius) ? actor.radius : 1.15) + 0.2
    ) {
      return undefined;
    }
  }
  return {
    offset: actor.offset,
    targetId: actor.targetId,
    worldDistance,
    targetPosition:
      finite(actor.worldX) && finite(actor.worldY) && finite(actor.worldZ)
        ? ([actor.worldX, actor.worldY, actor.worldZ] as Vec3)
        : ([...target.world] as Vec3),
  };
}

export function shouldToggleHarthmereCombatLockForKey(input: {
  code: string;
  repeat?: boolean;
  defaultPrevented?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  editableTarget?: boolean;
}) {
  return Boolean(
    input.code === "Tab" &&
    !input.repeat &&
    !input.defaultPrevented &&
    !input.altKey &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.editableTarget
  );
}

export function resetHarthmereCombatLockForTest() {
  latestCandidates = [];
  state = {
    version: HARTHMERE_COMBAT_LOCK_ON_VERSION,
    active: false,
    sequence: 0,
    updatedAt: 0,
    reason: "test_reset",
  };
}
