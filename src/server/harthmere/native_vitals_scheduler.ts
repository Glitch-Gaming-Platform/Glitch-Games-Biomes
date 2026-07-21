import type { AskApi } from "@/server/ask/api";
import { serverDerivedHarthmereUnderwater } from "@/server/harthmere/native_vitals_environment";
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
  if (!ids.length) return { playerCount: 0, changedPlayerIds: [] };
  const deriveUnderwater =
    input.deriveUnderwater ?? serverDerivedHarthmereUnderwater;
  const editor = input.worldApi.edit();
  const players = await editor.get(ids);
  const changedPlayerIds: number[] = [];
  for (const player of players) {
    const position = player?.position()?.v;
    const health = player?.health();
    if (!player || !position || !health) continue;
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
    if (
      tick.vitals.stamina !== before.stamina ||
      tick.vitals.breath !== before.breath ||
      tick.vitals.underwater !== before.underwater ||
      mutableHealth.hp !== previousHp
    ) {
      changedPlayerIds.push(player.id);
    }
  }
  await editor.commit();
  return { playerCount: players.length, changedPlayerIds };
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
  if (!enabled) return { enabled: false, stop: () => (stopped = true) };
  const intervalMs = Math.max(
    500,
    input.intervalMs ?? HARTHMERE_NATIVE_VITALS_SCHEDULER_INTERVAL_MS
  );
  const run = async () => {
    if (stopped) return;
    try {
      await runHarthmereNativeVitalsSchedulerTick({
        askApi: input.askApi,
        worldApi: input.worldApi,
        voxeloo: input.voxeloo,
        nowMs: input.nowMs?.() ?? Date.now(),
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
    },
  };
}
