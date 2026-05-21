// SNAPSHOT_BACKEND_RESOLVER_V80
//
// Server-agnostic runtime resolver for Harthmere/Snapshot progress services.
// Local development can keep using browser/local-dev state, while production
// can point at Laravel, a standalone microservice, or any compatible backend
// without hard-coding the service implementation into client/game logic.

export const SNAPSHOT_BACKEND_RESOLVER_VERSION_V80 =
  "snapshot-backend-resolver-v80" as const;

export type SnapshotBackendModeV80 =
  | "local"
  | "disabled"
  | "remote"
  | "laravel"
  | "custom";

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
