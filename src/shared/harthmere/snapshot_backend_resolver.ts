// SNAPSHOT_BACKEND_RESOLVER
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
//   - Grove terrain Y (authored current vs live current) is selectable via
//     GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE so future snapshot rebakes can
//     change the canonical ground height without re-editing every callsite.

import { SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y } from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_BACKEND_RESOLVER_VERSION =
  "snapshot-backend-resolver" as const;

export type SnapshotBackendMode =
  | "local"
  | "disabled"
  | "remote"
  | "laravel"
  | "custom";

export type SnapshotGroveTerrainMode = "authored" | "live";

export interface SnapshotBackendEnvironment {
  mode: SnapshotBackendMode;
  isProduction: boolean;
  backendUrl?: string;
  progressEndpoint: string;
  healthEndpoint: string;
  source: "env" | "default";
  version: typeof SNAPSHOT_BACKEND_RESOLVER_VERSION;
}

function normalizeBackendMode(value: unknown): SnapshotBackendMode | undefined {
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string) {
  const cleanBase = trimTrailingSlash(baseUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function resolveSnapshotBackendEnvironment(env: {
  NODE_ENV?: string;
  GLITCH_SNAPSHOT_BACKEND_MODE?: string;
  GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL?: string;
  GLITCH_SNAPSHOT_PROGRESS_ENDPOINT?: string;
  GLITCH_SNAPSHOT_HEALTH_ENDPOINT?: string;
}): SnapshotBackendEnvironment {
  const isProduction = env.NODE_ENV === "production";
  const configuredMode = normalizeBackendMode(env.GLITCH_SNAPSHOT_BACKEND_MODE);
  const configuredUrl = env.GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL?.trim();
  const mode: SnapshotBackendMode =
    configuredMode ??
    (configuredUrl ? "remote" : isProduction ? "disabled" : "local");
  const source: "env" | "default" =
    configuredMode || configuredUrl ? "env" : "default";

  const defaultProgressPath = "/api/glitch/snapshot_progress";
  const defaultHealthPath = "/api/glitch/runtime_environment";
  const configuredProgressPath =
    env.GLITCH_SNAPSHOT_PROGRESS_ENDPOINT?.trim() || defaultProgressPath;
  const configuredHealthPath =
    env.GLITCH_SNAPSHOT_HEALTH_ENDPOINT?.trim() || defaultHealthPath;

  const progressEndpoint = configuredUrl
    ? joinUrl(configuredUrl, configuredProgressPath)
    : configuredProgressPath;
  const healthEndpoint = configuredUrl
    ? joinUrl(configuredUrl, configuredHealthPath)
    : configuredHealthPath;

  return {
    mode,
    isProduction,
    backendUrl: configuredUrl ? trimTrailingSlash(configuredUrl) : undefined,
    progressEndpoint,
    healthEndpoint,
    source,
    version: SNAPSHOT_BACKEND_RESOLVER_VERSION,
  };
}

export function snapshotBackendAllowsRemoteProgress(
  environment: SnapshotBackendEnvironment
) {
  return (
    environment.mode === "remote" ||
    environment.mode === "laravel" ||
    environment.mode === "custom"
  );
}

export function snapshotBackendUsesLocalProgress(
  environment: SnapshotBackendEnvironment
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
export function resolveSnapshotProgressEndpoint(
  environment: SnapshotBackendEnvironment
): string {
  return environment.progressEndpoint;
}

export function resolveSnapshotHealthEndpoint(
  environment: SnapshotBackendEnvironment
): string {
  return environment.healthEndpoint;
}

// ---------------------------------------------------------------------------
// Grove terrain mode resolution.
//
// The authored Grove bible (current) anchors NPCs at world ground y=52. The
// production snapshot terrain that the browser actually loads places the
// visible courtyard around y=69 (current). Picking the wrong constant at a
// callsite is the root cause of the historical "buried NPCs" bug. Code
// that needs to ground or marker-place anything in the Grove should call
// the resolver rather than reading raw constants — that way a future
// snapshot rebake only has to flip one env var.
// ---------------------------------------------------------------------------
function normalizeGroveTerrainMode(
  value: unknown
): SnapshotGroveTerrainMode | undefined {
  if (typeof value !== "string") return undefined;
  const mode = value.trim().toLowerCase();
  if (mode === "authored") {
    return "authored";
  }
  if (mode === "live" || mode === "current") {
    return "live";
  }
  return undefined;
}

export function resolveSnapshotGroveTerrainMode(env: {
  GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE?: string;
}): SnapshotGroveTerrainMode {
  // Default to live because that is what production snapshot terrain
  // actually loads. Set GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE=authored
  // only when comparing against the bible's authored coordinates.
  return (
    normalizeGroveTerrainMode(env.GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE) ?? "live"
  );
}

export interface SnapshotGroveGroundYResolution {
  mode: SnapshotGroveTerrainMode;
  worldGroundY: number;
  npcFeetY: number;
  markerY: number;
}

export function resolveSnapshotGroveGroundY(env: {
  GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE?: string;
}): SnapshotGroveGroundYResolution {
  const mode = resolveSnapshotGroveTerrainMode(env);
  const worldGroundY =
    mode === "live" ? SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y : 52;
  return {
    mode,
    worldGroundY,
    npcFeetY: worldGroundY + 1,
    markerY: worldGroundY + 2,
  };
}
