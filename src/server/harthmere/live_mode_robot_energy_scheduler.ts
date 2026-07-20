import { connectToRedis } from "@/server/shared/redis/connection";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeSharedWorldState,
  reduceHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR,
  type LiveEntityRobotEnergyState,
} from "@/shared/harthmere/live_entity_robot_energy_protection";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";
import { log } from "@/shared/logging";
import type { WorldApi } from "@/server/shared/world/api";
import { RobotComponent } from "@/shared/ecs/gen/components";
import { HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS } from "@/shared/harthmere/live_entity_production_seed";

export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_VERSION =
  "harthmere-live-mode-robot-energy-scheduler" as const;
export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID =
  "system:harthmere-robot-energy-scheduler" as const;
export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_INTERVAL_MS = 60_000;

export interface HarthmereLiveModeRobotEnergyRedis {
  primary: {
    get: (key: string) => Promise<string | null>;
    watch?: (...keys: string[]) => Promise<unknown>;
    unwatch?: () => Promise<unknown>;
    multi?: () => {
      set: (key: string, value: string) => unknown;
      exec: () => Promise<unknown[] | null>;
    };
  };
}

function assertHarthmereRobotRedisWriteTransaction(
  redis: HarthmereLiveModeRobotEnergyRedis
) {
  if (!supportsHarthmereRobotRedisWatch(redis)) {
    throw new Error(
      "Harthmere robot energy scheduler requires Redis WATCH/MULTI for backend-authority writes"
    );
  }
}

function supportsHarthmereRobotRedisWatch(
  redis: HarthmereLiveModeRobotEnergyRedis
) {
  return (
    typeof redis.primary.watch === "function" &&
    typeof redis.primary.multi === "function"
  );
}

function changedRobotIds(
  before: LiveEntityRobotEnergyState,
  after: LiveEntityRobotEnergyState
) {
  return Object.keys(after.robots).filter((robotId) => {
    const previous = before.robots[robotId];
    const next = after.robots[robotId];
    return (
      !previous ||
      previous.energy !== next.energy ||
      previous.status !== next.status ||
      previous.lastTickAtMs !== next.lastTickAtMs
    );
  });
}

function changedAreaIds(
  before: LiveEntityRobotEnergyState,
  after: LiveEntityRobotEnergyState
) {
  return Object.keys(after.areas).filter((areaId) => {
    const previous = before.areas[areaId];
    const next = after.areas[areaId];
    return (
      !previous ||
      previous.status !== next.status ||
      previous.safeFromMuck !== next.safeFromMuck ||
      previous.activeMarkerId !== next.activeMarkerId
    );
  });
}

/**
 * Mirror the scheduler's server-owned energy into the real robot ECS
 * components. Redis retains the MMO protection-area ledger, while native ECS
 * remains the source consumed by robot rendering, movement, overlays, and
 * ordinary Biomes subscriptions.
 */
export async function syncHarthmereRobotEnergyStateToEcs(input: {
  worldApi: WorldApi;
  robotProtection: LiveEntityRobotEnergyState;
  nowMs: number;
}) {
  const seeds = HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.filter((seed) =>
    Boolean(input.robotProtection.robots[seed.robotId])
  );
  const editor = input.worldApi.edit();
  const entities = await editor.get(seeds.map((seed) => seed.entityId));
  const syncedRobotIds: string[] = [];
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const entity = entities[index];
    const robot = input.robotProtection.robots[seed.robotId];
    if (!entity || !robot) continue;
    entity.setRobotComponent(
      RobotComponent.create({
        ...(entity.robotComponent() ?? {}),
        internal_battery_charge: robot.energy,
        internal_battery_capacity: robot.maxEnergy,
        last_update: input.nowMs / 1000,
      })
    );
    syncedRobotIds.push(seed.robotId);
  }
  await editor.commit();
  return syncedRobotIds;
}

export async function readOrSeedHarthmereLiveModeRobotProtectionSharedState(input: {
  redis: HarthmereLiveModeRobotEnergyRedis;
  nowMs: number;
  actorId?: string;
}) {
  assertHarthmereRobotRedisWriteTransaction(input.redis);
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKey();
  await input.redis.primary.watch?.(sharedWorldStateKey);
  const rawSharedState = await input.redis.primary.get(sharedWorldStateKey);
  const parsedShared = parseHarthmereLiveModeSharedWorldState(
    rawSharedState,
    input.nowMs
  );
  if (parsedShared) {
    await input.redis.primary.unwatch?.();
    return {
      sharedWorldStateKey,
      seededSharedState: false,
      sharedWorldState: parsedShared,
      robotProtection: parsedShared.robotProtection,
    };
  }

  const backend = defaultHarthmereLiveModeBackendState(
    input.actorId ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID,
    input.nowMs
  );
  const sharedWorldState = createHarthmereLiveModeSharedWorldState(
    backend,
    input.nowMs
  );
  const tx = input.redis.primary.multi?.();
  if (!tx) {
    throw new Error("Harthmere robot energy scheduler Redis MULTI unavailable");
  }
  tx.set(sharedWorldStateKey, JSON.stringify(sharedWorldState));
  const txResult = await tx.exec();
  if (txResult === null) {
    const latestRawSharedState = await input.redis.primary.get(
      sharedWorldStateKey
    );
    const latestSharedWorldState = parseHarthmereLiveModeSharedWorldState(
      latestRawSharedState,
      input.nowMs
    );
    if (latestSharedWorldState) {
      return {
        sharedWorldStateKey,
        seededSharedState: false,
        sharedWorldState: latestSharedWorldState,
        robotProtection: latestSharedWorldState.robotProtection,
      };
    }
  }
  return {
    sharedWorldStateKey,
    seededSharedState: true,
    sharedWorldState,
    robotProtection: sharedWorldState.robotProtection,
  };
}

export async function runHarthmereLiveModeRobotEnergySchedulerTick(input: {
  redis: HarthmereLiveModeRobotEnergyRedis;
  worldApi?: WorldApi;
  nowMs: number;
  drainPerHour?: number;
  actorId?: string;
}) {
  assertHarthmereRobotRedisWriteTransaction(input.redis);
  const actorId =
    input.actorId ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID;
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKey();
  await input.redis.primary.watch?.(sharedWorldStateKey);
  const rawSharedState = await input.redis.primary.get(sharedWorldStateKey);
  const parsedShared = parseHarthmereLiveModeSharedWorldState(
    rawSharedState,
    input.nowMs
  );
  const backend = defaultHarthmereLiveModeBackendState(actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    backend,
    parsedShared,
    input.nowMs
  );
  const beforeRobotProtection = backend.robotProtection;
  const envelope: HarthmereLiveModeAuthorityEnvelope = {
    requestId: `robot-energy-scheduler:${input.nowMs}`,
    idempotencyKey: `robot-energy-scheduler:${input.nowMs}`,
    actorId,
    actionKind: "request_quest_state_update",
    subsystem: "quest",
    source: "server_scheduled_tick",
    serverReceivedAtMs: input.nowMs,
    serverTick: input.nowMs,
    actorEntityVersion: 0,
    zoneId: "harthmere_wilderness",
    payload: {
      operation: "live_entity_robot_energy_tick",
      drainPerHour:
        input.drainPerHour ?? LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR,
    },
  };
  const reduced = reduceHarthmereLiveModeBackendState(
    backend,
    envelope,
    input.nowMs
  );
  const sharedWorldState = createHarthmereLiveModeSharedWorldState(
    reduced.state,
    input.nowMs
  );
  const tx = input.redis.primary.multi?.();
  if (!tx) {
    throw new Error("Harthmere robot energy scheduler Redis MULTI unavailable");
  }
  tx.set(sharedWorldStateKey, JSON.stringify(sharedWorldState));
  const txResult = await tx.exec();
  if (txResult !== null) {
    const syncedEcsRobotIds = input.worldApi
      ? await syncHarthmereRobotEnergyStateToEcs({
          worldApi: input.worldApi,
          robotProtection: sharedWorldState.robotProtection,
          nowMs: input.nowMs,
        })
      : [];
    return {
      version: HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_VERSION,
      sharedWorldStateKey,
      seededSharedState: !parsedShared,
      summary: reduced.summary,
      sharedWorldState,
      robotProtection: sharedWorldState.robotProtection,
      changedRobotIds: changedRobotIds(
        beforeRobotProtection,
        sharedWorldState.robotProtection
      ),
      changedAreaIds: changedAreaIds(
        beforeRobotProtection,
        sharedWorldState.robotProtection
      ),
      syncedEcsRobotIds,
    };
  }
  return {
    version: HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_VERSION,
    sharedWorldStateKey,
    seededSharedState: !parsedShared,
    summary: {
      ...reduced.summary,
      warnings: [
        ...reduced.summary.warnings,
        "robot_energy_scheduler_conflicted:retry_next_tick",
      ],
    },
    sharedWorldState: parsedShared ?? sharedWorldState,
    robotProtection: (parsedShared ?? sharedWorldState).robotProtection,
    changedRobotIds: [],
    changedAreaIds: [],
    syncedEcsRobotIds: [],
  };
}

function shouldRunRobotEnergyScheduler() {
  if (process.env.HARTHMERE_LIVE_MODE_ROBOT_SCHEDULER === "0") {
    return false;
  }
  return (
    process.env.HARTHMERE_LIVE_MODE_ROBOT_SCHEDULER === "1" ||
    process.env.GLITCH_RUNTIME === "1"
  );
}

export function startHarthmereLiveModeRobotEnergyScheduler(input?: {
  worldApi?: WorldApi;
  intervalMs?: number;
  drainPerHour?: number;
  enabled?: boolean;
  nowMs?: () => number;
}) {
  const enabled = input?.enabled ?? shouldRunRobotEnergyScheduler();
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (!enabled) {
    return {
      enabled: false,
      stop: () => {
        stopped = true;
      },
    };
  }

  const intervalMs = Math.max(
    5_000,
    input?.intervalMs ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_INTERVAL_MS
  );
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  const schedulerRedis = () => (redisPromise ??= connectToRedis("firehose"));
  const run = async () => {
    if (stopped) {
      return;
    }
    try {
      const redis = await schedulerRedis();
      const result = await runHarthmereLiveModeRobotEnergySchedulerTick({
        redis,
        worldApi: input?.worldApi,
        nowMs: input?.nowMs?.() ?? Date.now(),
        drainPerHour: input?.drainPerHour,
      });
      if (result.changedRobotIds.length || result.seededSharedState) {
        log.info("Harthmere robot energy scheduler tick", {
          changedRobotIds: result.changedRobotIds,
          changedAreaIds: result.changedAreaIds,
          seededSharedState: result.seededSharedState,
        });
      }
    } catch (error) {
      log.error("Harthmere robot energy scheduler tick failed", { error });
    } finally {
      if (!stopped) {
        timeout = setTimeout(run, intervalMs);
      }
    }
  };
  timeout = setTimeout(run, 0);
  return {
    enabled: true,
    stop: () => {
      stopped = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      const closingRedis = redisPromise;
      redisPromise = undefined;
      void closingRedis
        ?.then((redis) =>
          redis.quit("Harthmere robot energy scheduler stopped")
        )
        .catch((error) => {
          log.warn("Failed to close Harthmere robot energy scheduler Redis", {
            error,
          });
        });
    },
  };
}
