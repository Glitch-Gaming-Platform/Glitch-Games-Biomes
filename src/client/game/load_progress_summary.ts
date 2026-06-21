import type { LoadProgress } from "@/client/game/load_progress";

export const REQUIRED_FRAMES = 30;

export type LoadProgressSummary =
  | "no_progress"
  | "no_early_context_loader"
  | "early_context"
  | "connecting"
  | "waiting_for_heartbeat"
  | "problems_connecting"
  | "bootstrapping"
  | "game_entities"
  | "player_mesh"
  | "terrain_meshing"
  | "scene_rendered"
  | "ready"
  | "broken";

export function progressSummary(
  loadProgress: LoadProgress
): LoadProgressSummary {
  if (!loadProgress.startedLoading) {
    return "no_progress";
  }
  if (!loadProgress.earlyContextLoader) {
    return "no_early_context_loader";
  }
  if (!loadProgress.earlyContextLoader.loaded) {
    return "early_context";
  }

  switch (loadProgress.channelStats.status) {
    case "disconnected":
    case "closing":
      return "broken";
    case "connecting":
      return "connecting";
    case "waitingOnHeartbeat":
      return "waiting_for_heartbeat";
    case "reconnecting":
    case "interrupted":
      return "problems_connecting";
    case "unhealthy":
      // "unhealthy" means the websocket is open but has not received a
      // message inside its short heartbeat freshness window. After bootstrap,
      // a quiet stream should not keep the loading screen up if the world can
      // finish meshing and render frames.
      if (!loadProgress.bootstrapped) {
        return "problems_connecting";
      }
      break;
    case "ready":
      break;
  }

  if (!loadProgress.bootstrapped) {
    return "bootstrapping";
  }

  if (loadProgress.entitiesLoaded === 0) {
    return "game_entities";
  }

  if (!loadProgress.playerMeshLoaded) {
    return "player_mesh";
  }

  if (!loadProgress.terrainMeshLoaded) {
    return "terrain_meshing";
  }

  if (loadProgress.sceneRendered < REQUIRED_FRAMES) {
    return "scene_rendered";
  }

  return "ready";
}

export function descriptionForSummary(summary: LoadProgressSummary): string {
  switch (summary) {
    case "no_progress":
      return "Pulling the big lever...";
    case "no_early_context_loader":
      return "Tuning...";
    case "early_context":
      return "Scanning frequencies...";
    case "connecting":
      return "Starting transmission...";
    case "waiting_for_heartbeat":
      return "Checking pulse...";
    case "problems_connecting":
      return "Problems while connecting to server, retrying...";
    case "broken":
      return "Can't connect to server right now. Try again later.";
    case "bootstrapping":
      return "Pulling up bootstraps...";
    case "game_entities":
      return "Learning about the world...";
    case "player_mesh":
      return "Acquiring some style...";
    case "terrain_meshing":
      return "Getting grounded...";
    case "scene_rendered":
      return "Lets see what's out there...";
    case "ready":
      return "Let's go!";
  }
}

export function progressForSummary(summary: LoadProgressSummary): number {
  switch (summary) {
    case "no_progress":
      return 0;
    case "no_early_context_loader":
      return 1;
    case "early_context":
      return 2;
    case "connecting":
      return 3;
    case "waiting_for_heartbeat":
      return 4;
    case "problems_connecting":
      return 5;
    case "broken":
      return 6;
    case "bootstrapping":
      return 7;
    case "game_entities":
      return 8;
    case "player_mesh":
      return 9;
    case "terrain_meshing":
      return 10;
    case "scene_rendered":
      return 11;
    case "ready":
      return 12;
  }
}
