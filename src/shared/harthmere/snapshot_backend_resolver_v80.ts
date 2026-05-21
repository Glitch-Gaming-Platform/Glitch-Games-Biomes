// SNAPSHOT_BACKEND_RESOLVER_V80
//
// Server-agnostic runtime resolver for Harthmere/Snapshot progress services.
// Local development can keep using browser/local-dev state, while production
// can point at Laravel, a standalone microservice, or any compatible backend
// without hard-coding the service implementation into client/game logic.
//
// CONTRACT (patch 04):
//   - Glitch-specific endpoints (install-id validation, save sync,
//     achievements, leaderboards) stay hard-wired in their existing modules
//     and are NOT routed through this resolver. They live at
//     `/api/glitch/harthmere` and `harthmere_glitch_bridge.ts`.
//   - Mission / quest / snapshot-progress state IS routed through this
//     resolver so production can swap the backing service (Laravel, a
//     bespoke microservice, anything that honours the wire shape) by
//     setting GLITCH_SNAPSHOT_BACKEND_MODE and GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL.
//   - Grove terrain Y (authored v75 vs live v83) is selectable via
//     GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE so future snapshot rebakes can
//     change the canonical ground height without re-editing every callsite.

import {
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83,
} from "@/shared/harthmere/snapshot_grove_content_v75";

export const SNAPSHOT_BACKEND_RESOLVER_VERSION_V80 =
  "snapshot-backend-resolver-v80" as const;

export type SnapshotBackendModeV80 =
  | "local"
  | "disabled"
  | "remote"
  | "laravel"
  | "custom";

export type SnapshotGroveTerrainModeV80 = "authored_v75" | "live_v83";

export interface SnapshotBackendEnvironmentV80 {
  mode: SnapshotBackendModeV80;
  isProduction: boolean;
  backendUrl?: string;
  progressEndpoint: string;
  healthEndpoint: string;
  source: "env" | "default";
  version: typeof SNAPSHOT_BACKEND_RESOLVER_VERSION_V80;
}

function normalizeBackendModeV80(value: unknown): SnapshotBackendModeV80 | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const mode = value.trim().toLowerCase();
  if (
    mode === "local" ||
    mode === "disabled" ||
    mode === "remote" ||
    mode === "laravel" ||
    mode === "custom"
  ) {
    return mode;
  }
  return undefined;
}

function trimTrailingSlashV80(value: string) {
  return value.replace(/\/+$/, "");
}

function joinUrlV80(baseUrl: string, path: string) {
  const cleanBase = trimTrailingSlashV80(baseUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function resolveSnapshotBackendEnvironmentV80(env: {
  NODE_ENV?: string;
  GLITCH_SNAPSHOT_BACKEND_MODE?: string;
  GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL?: string;
  GLITCH_SNAPSHOT_PROGRESS_ENDPOINT?: string;
  GLITCH_SNAPSHOT_HEALTH_ENDPOINT?: string;
}): SnapshotBackendEnvironmentV80 {
  const isProduction = env.NODE_ENV === "production";
  const configuredMode = normalizeBackendModeV80(env.GLITCH_SNAPSHOT_BACKEND_MODE);
  const configuredUrl = env.GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL?.trim();
  const mode: SnapshotBackendModeV80 =
    configuredMode ?? (configuredUrl ? "remote" : isProduction ? "disabled" : "local");
  const source: "env" | "default" = configuredMode || configuredUrl ? "env" : "default";

  const defaultProgressPath = "/api/glitch/snapshot_progress";
  const defaultHealthPath = "/api/glitch/runtime_environment";
  const configuredProgressPath =
    env.GLITCH_SNAPSHOT_PROGRESS_ENDPOINT?.trim() || defaultProgressPath;
  const configuredHealthPath =
    env.GLITCH_SNAPSHOT_HEALTH_ENDPOINT?.trim() || defaultHealthPath;

  const progressEndpoint = configuredUrl
    ? joinUrlV80(configuredUrl, configuredProgressPath)
    : configuredProgressPath;
  const healthEndpoint = configuredUrl
    ? joinUrlV80(configuredUrl, configuredHealthPath)
    : configuredHealthPath;

  return {
    mode,
    isProduction,
    backendUrl: configuredUrl ? trimTrailingSlashV80(configuredUrl) : undefined,
    progressEndpoint,
    healthEndpoint,
    source,
    version: SNAPSHOT_BACKEND_RESOLVER_VERSION_V80,
  };
}

export function snapshotBackendAllowsRemoteProgressV80(
  environment: SnapshotBackendEnvironmentV80,
) {
  return (
    environment.mode === "remote" ||
    environment.mode === "laravel" ||
    environment.mode === "custom"
  );
}

export function snapshotBackendUsesLocalProgressV80(
  environment: SnapshotBackendEnvironmentV80,
) {
  return environment.mode === "local";
}

// ---------------------------------------------------------------------------
// Snapshot progress endpoint resolution.
//
// Used by mission/quest progress writes. Glitch-specific endpoints
// (install validation, save sync, achievements, leaderboards) do NOT use
// this — they stay hard-wired in harthmere_glitch_bridge.ts and at
// /api/glitch/harthmere.
//
// When env.browser is true and the resolver is in "local" mode, this
// returns the same path the local Next API serves so dev-mode browsers
// keep working without a remote backend.
// ---------------------------------------------------------------------------
export function resolveSnapshotProgressEndpointV80(
  environment: SnapshotBackendEnvironmentV80,
): string {
  return environment.progressEndpoint;
}

export function resolveSnapshotHealthEndpointV80(
  environment: SnapshotBackendEnvironmentV80,
): string {
  return environment.healthEndpoint;
}

// ---------------------------------------------------------------------------
// Grove terrain mode resolution.
//
// The authored Grove bible (v75) anchors NPCs at world ground y=52. The
// production snapshot terrain that the browser actually loads places the
// visible courtyard around y=69 (v83). Picking the wrong constant at a
// callsite is the root cause of the historical "buried NPCs" bug. Code
// that needs to ground or marker-place anything in the Grove should call
// the resolver rather than reading raw constants — that way a future
// snapshot rebake only has to flip one env var.
// ---------------------------------------------------------------------------
function normalizeGroveTerrainModeV80(value: unknown): SnapshotGroveTerrainModeV80 | undefined {
  if (typeof value !== "string") return undefined;
  const mode = value.trim().toLowerCase();
  if (mode === "authored_v75" || mode === "authored" || mode === "v75") {
    return "authored_v75";
  }
  if (mode === "live_v83" || mode === "live" || mode === "v83") {
    return "live_v83";
  }
  return undefined;
}

export function resolveSnapshotGroveTerrainModeV80(env: {
  GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE?: string;
}): SnapshotGroveTerrainModeV80 {
  // Default to live_v83 because that is what production snapshot terrain
  // actually loads. Set GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE=authored_v75
  // only when comparing against the bible's authored coordinates.
  return normalizeGroveTerrainModeV80(env.GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE) ?? "live_v83";
}

export interface SnapshotGroveGroundYResolutionV80 {
  mode: SnapshotGroveTerrainModeV80;
  worldGroundY: number;
  npcFeetY: number;
  markerY: number;
}

export function resolveSnapshotGroveGroundYV80(env: {
  GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE?: string;
}): SnapshotGroveGroundYResolutionV80 {
  const mode = resolveSnapshotGroveTerrainModeV80(env);
  const worldGroundY = mode === "live_v83" ? SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 : 52;
  return {
    mode,
    worldGroundY,
    npcFeetY: worldGroundY + 1,
    markerY: worldGroundY + 2,
  };
}
