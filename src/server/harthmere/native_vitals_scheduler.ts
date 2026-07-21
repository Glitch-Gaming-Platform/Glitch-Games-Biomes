import type { AskApi } from "@/server/ask/api";
import { serverDerivedHarthmereUnderwater } from "@/server/harthmere/native_vitals_environment";
import { connectToRedis } from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  readHarthmereNativeVitals,
  tickHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { log } from "@/shared/logging";
import type { VoxelooModule } from "@/shared/wasm/types";

export const HARTHMERE_NATIVE_VITALS_SCHEDULER_INTERVAL_MS = 1_000;
export const HARTHMERE_NATIVE_VITALS_TICK_CLAIM_PREFIX =
  "harthmere:native_vitals_scheduler:tick:" as const;

export interface HarthmereNativeVitalsTickClaimRedis {
  set(
    key: string,
    value: string,
    expiryMode: "PX",
    ttlMs: number,
    condition: "NX"
  ): Promise<unknown>;
}

/**
 * Claims one wall-clock interval for one replica. The key is not explicitly
 * released: its TTL covers late contenders in the same interval, while the
 * next interval uses a new key and can fail over immediately to any replica.
 */
export async function claimHarthmereNativeVitalsSchedulerTick(input: {
  redis: HarthmereNativeVitalsTickClaimRedis;
  nowMs: number;
  intervalMs: number;
}) {
  const intervalMs = Math.max(500, Math.trunc(input.intervalMs));
  const slot = Math.floor(input.nowMs / intervalMs);
  const result = await input.redis.set(
    `${HARTHMERE_NATIVE_VITALS_TICK_CLAIM_PREFIX}${slot}`,
    String(input.nowMs),
    "PX",
    Math.max(5_000, intervalMs * 3),
    "NX"
  );
  return result === "OK";
}

export async function runHarthmereNativeVitalsSchedulerTick(input: {
  askApi: Pick<AskApi, "scanAll" | "scanForExport">;
  worldApi: WorldApi;
  voxeloo: VoxelooModule;
  nowMs: number;
  deriveUnderwater?: typeof serverDerivedHarthmereUnderwater;
}) {
  if (!nativeBiomesEcsAuthorityEnabled()) {
    return { playerCount: 0, changedPlayerIds: [] };
  }
  const activePlayers = await input.askApi.scanAll("players");
  const ids = activePlayers.map((player) => player.id);
  if (!ids.length) {
    return {
      playerCount: 0,
      changedPlayerIds: [] as number[],
      conflictedPlayerIds: [] as number[],
    };
  }
  const deriveUnderwater =
    input.deriveUnderwater ?? serverDerivedHarthmereUnderwater;
  const changedPlayerIds: number[] = [];
  const conflictedPlayerIds: number[] = [];
  let playerCount = 0;
  for (const id of ids) {
    const editor = input.worldApi.edit();
    const player = await editor.get(id);
    const position = player?.position()?.v;
    const health = player?.health();
    if (!player || !position || !health) continue;
    playerCount += 1;
    const underwater = await deriveUnderwater({
      askApi: input.askApi,
      voxeloo: input.voxeloo,
      position: [position[0], position[1], position[2]],
      height: player.size()?.v[1],
    });
    const before = readHarthmereNativeVitals(player.triggerState());
    const tick = tickHarthmereNativeVitals(player.mutableTriggerState(), {
      nowMs: input.nowMs,
      gameplayActive: true,
      underwater,
      alive: health.hp > 0,
    });
    const mutableHealth = player.mutableHealth();
    const previousHp = mutableHealth.hp;
    if (tick.deathCause === "stamina") {
      mutableHealth.hp = 0;
    } else if (tick.damage > 0) {
      mutableHealth.hp = Math.max(0, mutableHealth.hp - tick.damage);
    }
    if (mutableHealth.hp !== previousHp) {
      mutableHealth.lastDamageSource =
        tick.deathCause === "drowning"
          ? { kind: "drown" }
          : { kind: "suicide" };
      mutableHealth.lastDamageAmount = Math.max(
        0,
        previousHp - mutableHealth.hp
      );
      mutableHealth.lastDamageTime = secondsSinceEpoch();
    }
    const changed =
      tick.vitals.stamina !== before.stamina ||
      tick.vitals.breath !== before.breath ||
      tick.vitals.underwater !== before.underwater ||
      mutableHealth.hp !== previousHp;
    try {
      // Commit each connected player independently. A simultaneous combat,
      // respawn, consumable, or heartbeat write may invalidate one optimistic
      // ECS edit; it must not discard the vitals tick for every other player.
      await editor.commit();
      if (changed) changedPlayerIds.push(player.id);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Failed to apply change to world")
      ) {
        conflictedPlayerIds.push(player.id);
        continue;
      }
      throw error;
    }
  }
  return { playerCount, changedPlayerIds, conflictedPlayerIds };
}

function shouldRunHarthmereNativeVitalsScheduler() {
  if (process.env.HARTHMERE_NATIVE_VITALS_SCHEDULER === "0") return false;
  return (
    process.env.HARTHMERE_NATIVE_VITALS_SCHEDULER === "1" ||
    process.env.GLITCH_RUNTIME === "1"
  );
}

export function startHarthmereNativeVitalsScheduler(input: {
  askApi: AskApi;
  worldApi: WorldApi;
  voxeloo: VoxelooModule;
  intervalMs?: number;
  enabled?: boolean;
  nowMs?: () => number;
}) {
  const enabled = input.enabled ?? shouldRunHarthmereNativeVitalsScheduler();
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  if (!enabled) return { enabled: false, stop: () => (stopped = true) };
  const intervalMs = Math.max(
    500,
    input.intervalMs ?? HARTHMERE_NATIVE_VITALS_SCHEDULER_INTERVAL_MS
  );
  const schedulerRedis = () => (redisPromise ??= connectToRedis("firehose"));
  const run = async () => {
    if (stopped) return;
    try {
      // Every production replica hosts this process. Claim the current time
      // slot so only one of them advances native vitals in this interval. A
      // per-slot key prevents both concurrent and sequential double ticks.
      const nowMs = input.nowMs?.() ?? Date.now();
      if (
        !(await claimHarthmereNativeVitalsSchedulerTick({
          redis: (await schedulerRedis()).primary,
          nowMs,
          intervalMs,
        }))
      ) {
        return;
      }
      await runHarthmereNativeVitalsSchedulerTick({
        askApi: input.askApi,
        worldApi: input.worldApi,
        voxeloo: input.voxeloo,
        nowMs,
      });
    } catch (error) {
      log.error("Harthmere native vitals scheduler tick failed", { error });
    } finally {
      if (!stopped) timeout = setTimeout(run, intervalMs);
    }
  };
  timeout = setTimeout(run, 0);
  return {
    enabled: true,
    stop: () => {
      stopped = true;
      if (timeout) clearTimeout(timeout);
      timeout = undefined;
      const closingRedis = redisPromise;
      redisPromise = undefined;
      void closingRedis
        ?.then((redis) =>
          redis.quit("Harthmere native vitals scheduler stopped")
        )
        .catch((error) =>
          log.warn("Failed to close Harthmere native vitals scheduler Redis", {
            error,
          })
        );
    },
  };
}
