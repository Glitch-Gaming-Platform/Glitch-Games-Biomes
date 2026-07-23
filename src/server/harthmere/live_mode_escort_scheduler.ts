import { buildHarthmereEscortCompanionNpcProposedChanges } from "@/server/harthmere/escort_companion_npc_ecs";
import { connectToRedis } from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeSharedWorldState,
  reduceHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";

export const HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER_VERSION =
  "harthmere-live-mode-escort-scheduler-v1" as const;
export const HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER_INTERVAL_MS = 1_000;

export interface HarthmereLiveModeEscortRedis {
  primary: {
    get(key: string): Promise<string | null>;
    watch(...keys: string[]): Promise<unknown>;
    unwatch(): Promise<unknown>;
    multi(): {
      set(key: string, value: string): unknown;
      exec(): Promise<unknown[] | null>;
    };
  };
}

function numericActorId(actorId: string | undefined) {
  return actorId ? safeParseBiomesId(actorId) : undefined;
}

async function actorPosition(worldApi: WorldApi, actorId: BiomesId) {
  const position = (await worldApi.get(actorId))?.position()?.v;
  if (!position) return undefined;
  const [x, y, z] = position.map(Number);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? { x, y, z }
    : undefined;
}

async function syncEscortCompanionsToEcs(input: {
  worldApi: WorldApi;
  state: ReturnType<typeof defaultHarthmereLiveModeBackendState>;
  nowMs: number;
}) {
  const companions = Object.values(input.state.jobsBoard.postings)
    .map((job) => job.escortCompanion)
    .filter((companion): companion is NonNullable<typeof companion> =>
      Boolean(companion)
    );
  if (!companions.length) return 0;
  const existingIds = new Set(
    await input.worldApi.has(companions.map((companion) => companion.entityId))
  );
  const changes = buildHarthmereEscortCompanionNpcProposedChanges({
    companions,
    existingIds,
    nowSeconds: input.nowMs / 1000,
  });
  if (!changes.length) return 0;
  const applied = await input.worldApi.apply({ changes });
  if (applied.outcome !== "success") {
    throw new Error(`escort_ecs_apply_${applied.outcome}`);
  }
  return changes.length;
}

/**
 * Advance every active escort from shared Redis job state using only the
 * authenticated player's native ECS position. Browser AI ticks are rejected;
 * this one server loop owns follow movement, arrival, quest completion, and
 * the companion's ECS projection.
 */
export async function runHarthmereLiveModeEscortSchedulerTick(input: {
  redis: HarthmereLiveModeEscortRedis;
  worldApi: WorldApi;
  nowMs: number;
}) {
  const sharedKey = harthmereLiveModeSharedWorldStateKey();
  await input.redis.primary.watch(sharedKey);
  const raw = await input.redis.primary.get(sharedKey);
  const shared = parseHarthmereLiveModeSharedWorldState(raw, input.nowMs);
  if (!shared) {
    await input.redis.primary.unwatch();
    return { changedCompanionIds: [] as BiomesId[], syncedEcsCount: 0 };
  }

  let state = defaultHarthmereLiveModeBackendState(
    "system:harthmere-escort-scheduler",
    input.nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(state, shared, input.nowMs);
  const changedCompanionIds: BiomesId[] = [];
  for (const job of Object.values(state.jobsBoard.postings)) {
    const companion = job.escortCompanion;
    if (!companion || companion.status !== "following") continue;
    const acceptedActorId =
      companion.actorEntityId ?? numericActorId(job.acceptedByActorId);
    if (!acceptedActorId) continue;
    const position = await actorPosition(input.worldApi, acceptedActorId);
    if (!position) continue;
    const before = JSON.stringify(companion);
    // The reducer's NPC follow path compares the escort's actor to the
    // backend state's actor and resolves that actor's authoritative position
    // from the server envelope. This scheduler state starts as a system actor,
    // so bind it to the accepted player for each escort tick; otherwise the
    // companion falls through to idle patrol and never reaches its marker.
    state.actorId = companion.actorId;
    // Combat snapshots are intentionally actor-private and therefore absent
    // from the shared Redis projection. Reconstruct only this escort's server
    // AI input from the shared companion record before invoking the reducer.
    state.combat.entitySnapshots[String(companion.entityId)] = {
      hp: 20,
      maxHp: 20,
      position: { ...companion.position },
      homePosition: { ...companion.position },
      isHostile: false,
      isAlive: true,
      isAttackable: false,
      entityKind: "human",
      movementSpeed: 4.4,
      bodyRadius: 0.45,
      patrolRadius: 0.25,
      aggroRange: 0,
      leashRange: 5_000,
      requiresLineOfSight: false,
      aiEnabled: true,
      animationState: "idle",
      animationStartedAtMs: input.nowMs,
      animationMoving: false,
      combatProtection: "friendly_noncombatant",
      retaliatesWhenAttacked: false,
      escortJobId: companion.jobId,
      escortActorId: companion.actorId,
      escortCompanionId: companion.companionId,
      escortDisplayName: companion.displayName,
      escortDestination: { ...companion.destination },
      escortDestinationTargetId: companion.destinationTargetId,
      escortDestinationMarkerId: companion.destinationMarkerId,
      escortStatus: companion.status,
    };
    const envelope: HarthmereLiveModeAuthorityEnvelope = {
      requestId: `escort-scheduler:${job.jobId}:${input.nowMs}`,
      idempotencyKey: `escort-scheduler:${job.jobId}:${input.nowMs}`,
      actorId: companion.actorId,
      serverActorEntityId: acceptedActorId,
      targetId: String(companion.entityId),
      actionKind: "request_npc_ai_tick",
      subsystem: "npc_ai",
      source: "server_scheduled_tick",
      serverActorPosition: position,
      serverReceivedAtMs: input.nowMs,
      serverTick: input.nowMs,
      actorEntityVersion: 0,
      zoneId: "harthmere_wilderness",
      payload: {
        npcId: String(companion.entityId),
        thinkIntervalMs: HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER_INTERVAL_MS,
      },
    };
    state = reduceHarthmereLiveModeBackendState(
      state,
      envelope,
      input.nowMs
    ).state;
    const after = state.jobsBoard.postings[job.jobId]?.escortCompanion;
    if (after && JSON.stringify(after) !== before) {
      changedCompanionIds.push(after.entityId);
    }
  }

  if (!changedCompanionIds.length) {
    await input.redis.primary.unwatch();
    return { changedCompanionIds, syncedEcsCount: 0 };
  }
  const tx = input.redis.primary.multi();
  tx.set(
    sharedKey,
    JSON.stringify(createHarthmereLiveModeSharedWorldState(state, input.nowMs))
  );
  if ((await tx.exec()) === null) {
    return { changedCompanionIds: [] as BiomesId[], syncedEcsCount: 0 };
  }
  return {
    changedCompanionIds,
    syncedEcsCount: await syncEscortCompanionsToEcs({
      worldApi: input.worldApi,
      state,
      nowMs: input.nowMs,
    }),
  };
}

function shouldRunEscortScheduler() {
  if (process.env.HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER === "0") return false;
  return (
    process.env.HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER === "1" ||
    process.env.GLITCH_RUNTIME === "1"
  );
}

export function startHarthmereLiveModeEscortScheduler(input: {
  worldApi: WorldApi;
  intervalMs?: number;
  enabled?: boolean;
  nowMs?: () => number;
}) {
  const enabled = input.enabled ?? shouldRunEscortScheduler();
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  if (!enabled) {
    return { enabled: false, stop: () => void (stopped = true) };
  }
  const redis = () => (redisPromise ??= connectToRedis("firehose"));
  const run = async () => {
    if (stopped) return;
    try {
      await runHarthmereLiveModeEscortSchedulerTick({
        redis: await redis(),
        worldApi: input.worldApi,
        nowMs: input.nowMs?.() ?? Date.now(),
      });
    } catch (error) {
      log.error("Harthmere escort scheduler tick failed", { error });
    } finally {
      if (!stopped) {
        timeout = setTimeout(
          run,
          Math.max(
            250,
            input.intervalMs ?? HARTHMERE_LIVE_MODE_ESCORT_SCHEDULER_INTERVAL_MS
          )
        );
      }
    }
  };
  timeout = setTimeout(run, 0);
  return {
    enabled: true,
    stop: () => {
      stopped = true;
      if (timeout) clearTimeout(timeout);
      timeout = undefined;
      const closing = redisPromise;
      redisPromise = undefined;
      void closing
        ?.then((client) => client.quit("Harthmere escort scheduler stopped"))
        .catch((error) =>
          log.warn("Failed to close Harthmere escort scheduler Redis", {
            error,
          })
        );
    },
  };
}
