import { connectToRedis } from "@/server/shared/redis/connection";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1,
  parseHarthmereLiveModeSharedWorldStateV1,
  reduceHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1,
  type LiveEntityRobotEnergyStateV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";
import type { HarthmereLiveModeAuthorityEnvelopeV1 } from "@/shared/harthmere/live_mode_readiness_v1";
import { log } from "@/shared/logging";

export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_VERSION_V1 =
  "harthmere-live-mode-robot-energy-scheduler-v1" as const;
export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID_V1 =
  "system:harthmere-robot-energy-scheduler" as const;
export const HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_INTERVAL_MS_V1 =
  60_000;

export interface HarthmereLiveModeRobotEnergyRedisV1 {
  primary: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<unknown>;
  };
}

function changedRobotIdsV1(
  before: LiveEntityRobotEnergyStateV1,
  after: LiveEntityRobotEnergyStateV1
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

function changedAreaIdsV1(
  before: LiveEntityRobotEnergyStateV1,
  after: LiveEntityRobotEnergyStateV1
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

export async function readOrSeedHarthmereLiveModeRobotProtectionSharedStateV1(input: {
  redis: HarthmereLiveModeRobotEnergyRedisV1;
  nowMs: number;
  actorId?: string;
}) {
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKeyV1();
  const rawSharedState = await input.redis.primary.get(sharedWorldStateKey);
  const parsedShared = parseHarthmereLiveModeSharedWorldStateV1(
    rawSharedState,
    input.nowMs
  );
  if (parsedShared) {
    return {
      sharedWorldStateKey,
      seededSharedState: false,
      sharedWorldState: parsedShared,
      robotProtection: parsedShared.robotProtection,
    };
  }

  const backend = defaultHarthmereLiveModeBackendStateV1(
    input.actorId ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID_V1,
    input.nowMs
  );
  const sharedWorldState = createHarthmereLiveModeSharedWorldStateV1(
    backend,
    input.nowMs
  );
  await input.redis.primary.set(
    sharedWorldStateKey,
    JSON.stringify(sharedWorldState)
  );
  return {
    sharedWorldStateKey,
    seededSharedState: true,
    sharedWorldState,
    robotProtection: sharedWorldState.robotProtection,
  };
}

export async function runHarthmereLiveModeRobotEnergySchedulerTickV1(input: {
  redis: HarthmereLiveModeRobotEnergyRedisV1;
  nowMs: number;
  drainPerHour?: number;
  actorId?: string;
}) {
  const actorId =
    input.actorId ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_ACTOR_ID_V1;
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKeyV1();
  const rawSharedState = await input.redis.primary.get(sharedWorldStateKey);
  const parsedShared = parseHarthmereLiveModeSharedWorldStateV1(
    rawSharedState,
    input.nowMs
  );
  const backend = defaultHarthmereLiveModeBackendStateV1(actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
    backend,
    parsedShared,
    input.nowMs
  );
  const beforeRobotProtection = backend.robotProtection;
  const envelope: HarthmereLiveModeAuthorityEnvelopeV1 = {
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
        input.drainPerHour ?? LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1,
    },
  };
  const reduced = reduceHarthmereLiveModeBackendStateV1(
    backend,
    envelope,
    input.nowMs
  );
  const sharedWorldState = createHarthmereLiveModeSharedWorldStateV1(
    reduced.state,
    input.nowMs
  );
  await input.redis.primary.set(
    sharedWorldStateKey,
    JSON.stringify(sharedWorldState)
  );
  return {
    version: HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_VERSION_V1,
    sharedWorldStateKey,
    seededSharedState: !parsedShared,
    summary: reduced.summary,
    sharedWorldState,
    robotProtection: sharedWorldState.robotProtection,
    changedRobotIds: changedRobotIdsV1(
      beforeRobotProtection,
      sharedWorldState.robotProtection
    ),
    changedAreaIds: changedAreaIdsV1(
      beforeRobotProtection,
      sharedWorldState.robotProtection
    ),
  };
}

function shouldRunRobotEnergySchedulerV1() {
  if (process.env.HARTHMERE_LIVE_MODE_ROBOT_SCHEDULER === "0") {
    return false;
  }
  return (
    process.env.HARTHMERE_LIVE_MODE_ROBOT_SCHEDULER === "1" ||
    process.env.GLITCH_RUNTIME === "1"
  );
}

export function startHarthmereLiveModeRobotEnergySchedulerV1(input?: {
  intervalMs?: number;
  drainPerHour?: number;
  enabled?: boolean;
  nowMs?: () => number;
}) {
  const enabled = input?.enabled ?? shouldRunRobotEnergySchedulerV1();
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
    input?.intervalMs ?? HARTHMERE_LIVE_MODE_ROBOT_ENERGY_SCHEDULER_INTERVAL_MS_V1
  );
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  const schedulerRedis = () =>
    (redisPromise ??= connectToRedis("firehose"));
  const run = async () => {
    if (stopped) {
      return;
    }
    try {
      const redis = await schedulerRedis();
      const result = await runHarthmereLiveModeRobotEnergySchedulerTickV1({
        redis,
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
        ?.then((redis) => redis.quit("Harthmere robot energy scheduler stopped"))
        .catch((error) => {
          log.warn("Failed to close Harthmere robot energy scheduler Redis", {
            error,
          });
        });
    },
  };
}
