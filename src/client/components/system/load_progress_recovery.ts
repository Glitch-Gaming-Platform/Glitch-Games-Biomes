import type { LoadProgress } from "@/client/game/load_progress";

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
