import type { LoadProgress } from "@/client/game/load_progress";

export const PARTIAL_TERRAIN_RECOVERY_KEY =
  "biomes.harthmere.partialTerrainRecoveryReloaded";

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserRecoveryStorage(): RecoveryStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function hasPartialTerrainRecoveryMarker(
  storage: RecoveryStorage | undefined = browserRecoveryStorage()
) {
  try {
    return storage?.getItem(PARTIAL_TERRAIN_RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

export function armPartialTerrainRecovery(
  storage: RecoveryStorage | undefined = browserRecoveryStorage()
) {
  if (!storage) {
    return false;
  }
  try {
    if (storage.getItem(PARTIAL_TERRAIN_RECOVERY_KEY) === "1") {
      return false;
    }
    storage.setItem(PARTIAL_TERRAIN_RECOVERY_KEY, "1");
    return true;
  } catch {
    // Never reload without a durable per-tab guard. Privacy-restricted embeds
    // can reject sessionStorage access, and retrying there would create a loop.
    return false;
  }
}

export function clearPartialTerrainRecoveryMarker(
  storage: RecoveryStorage | undefined = browserRecoveryStorage()
) {
  try {
    storage?.removeItem(PARTIAL_TERRAIN_RECOVERY_KEY);
  } catch {
    // Recovery state is best-effort and must never break a successful load.
  }
}

export function shouldAutoReloadForPartialTerrainRecovery(input: {
  progress: LoadProgress;
  staleProgress?: LoadProgress;
  alreadyReloaded?: boolean;
}) {
  if (input.alreadyReloaded) {
    return false;
  }
  const progress = input.staleProgress ?? input.progress;
  if (!progress.startedLoading || !progress.earlyContextLoader?.loaded) {
    return false;
  }
  if (
    !progress.bootstrapped ||
    progress.entitiesLoaded <= 0 ||
    !progress.playerMeshLoaded ||
    progress.terrainMeshLoaded
  ) {
    return false;
  }
  return (
    progress.channelStats.status === "ready" ||
    progress.channelStats.status === "unhealthy" ||
    progress.channelStats.status === "reconnecting" ||
    progress.channelStats.status === "interrupted"
  );
}
