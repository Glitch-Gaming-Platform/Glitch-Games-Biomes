import { assetDataToDataWithMimeType } from "@/galois/interface/asset_server/exports";
import type { WebServerContext } from "@/server/web/context";
import {
  DoNotSendResponse,
  biomesApiHandler,
  zDoNotSendResponse,
} from "@/server/web/util/api_middleware";
import type {
  SlotToWearableMap,
  SlotToWearableMapResults,
} from "@/shared/api/assets";
import {
  ASSET_EXPORTS_SERVER_VERSION,
  parsePlayerMeshUrl,
} from "@/shared/api/assets";
import { APIError } from "@/shared/api/errors";
import { BikkieIds } from "@/shared/bikkie/ids";
import { shouldForceLocalAssetRuntime } from "@/server/web/config";
import { log } from "@/shared/logging";
import { Timer } from "@/shared/metrics/timer";
import { z } from "zod";

const CDN_CACHE_TTL = 60 * 60 * 24 * 365;
const BROWSER_CACHE_TTL = CDN_CACHE_TTL;
const DEFAULT_PLAYER_MESH_MAX_ACTIVE_COMPUTES = 2;
const DEFAULT_PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES = 1;

export interface CachedPlayerMesh {
  data: Buffer;
  mime: string;
  computedAt: number;
  assetExportVersion: number;
}

type PlayerMeshRuntimeState = {
  activeComputes: number;
  waitingComputes: number;
  computeWaiters: (() => void)[];
  inflightComputes: Map<string, Promise<CachedPlayerMesh>>;
};

const globalForPlayerMeshRuntime = globalThis as typeof globalThis & {
  __playerMeshRuntimeState?: PlayerMeshRuntimeState;
};

function playerMeshRuntimeState() {
  return (
    globalForPlayerMeshRuntime.__playerMeshRuntimeState ??
    (globalForPlayerMeshRuntime.__playerMeshRuntimeState = {
      activeComputes: 0,
      waitingComputes: 0,
      computeWaiters: [] as (() => void)[],
      inflightComputes: new Map(),
    })
  );
}

function playerMeshMaxActiveComputes() {
  const value = Number(process.env.PLAYER_MESH_MAX_ACTIVE_COMPUTES);
  return Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : DEFAULT_PLAYER_MESH_MAX_ACTIVE_COMPUTES;
}

function playerMeshWarmupMaxActiveComputes() {
  const value = Number(process.env.PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES);
  return Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES;
}

export default biomesApiHandler(
  {
    auth: "optional",
    response: z.union([zDoNotSendResponse, z.instanceof(Buffer)]),
  },
  async ({ context, unsafeRequest, unsafeResponse }) => {
    const rawUrl = unsafeRequest.url ?? "";
    const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?")) : "";
    if (!unsafeRequest.url) {
      throw new APIError(
        "invalid_request",
        "There is no URL provided for an asset server request."
      );
    }

    const forceLocalAssetRuntime = shouldForceLocalAssetRuntime();
    if (
      !forceLocalAssetRuntime &&
      context.config.assetServerMode !== "lazy" &&
      context.config.assetServerMode !== "local"
    ) {
      throw new APIError(
        "killswitched",
        "Player mesh generation requires local or lazy asset server mode."
      );
    }

    const playerMeshParse = parsePlayerMeshUrl(unsafeRequest.url);

    if (playerMeshParse.kind === "UrlParseError") {
      throw new APIError("invalid_request", "Could not parse URL.");
    }
    const cacheKey = playerMeshSemanticCacheKey(playerMeshParse);
    const [cached] = await context.serverCache.get("player-mesh", cacheKey);
    const warmupRequest = isPlayerMeshWarmupRequest(
      unsafeRequest.headers["user-agent"]
    );
    const activeComputes = playerMeshRuntimeState().activeComputes;
    if (
      shouldSkipPlayerMeshWarmup({
        isWarmup: warmupRequest,
        hasCached: Boolean(cached),
        activeComputes,
        maxActiveComputes: playerMeshWarmupMaxActiveComputes(),
      })
    ) {
      log.info("Skipping player mesh warmup under compute load", {
        activeComputes,
        cacheKey,
      });
      unsafeResponse.status(202).end();
      return DoNotSendResponse;
    }

    const mesh = await fetchOrComputeMesh(
      context,
      unsafeRequest.url,
      cacheKey,
      playerMeshParse,
      cached
    );
    unsafeResponse.setHeader("X-Glitch-Player-Mesh-Mode", "computed-local");
    if (playerMeshParse.warning?.kind === "AssetVersionMismatch") {
      unsafeResponse.setHeader("Cache-Control", "no-cache");
    } else {
      unsafeResponse.setHeader(
        "Cache-Control",
        `s-maxage=${CDN_CACHE_TTL},public,max-age=${BROWSER_CACHE_TTL},immutable`
      );
    }
    unsafeResponse.setHeader("Content-Type", mesh.mime);
    unsafeResponse.setHeader("X-Glitch-Player-Mesh-Content-Type", mesh.mime);
    unsafeResponse.setHeader(
      "X-Glitch-Player-Mesh-Asset-Version",
      String(mesh.assetExportVersion)
    );
    return mesh.data;
  }
);

async function fetchOrComputeMesh(
  context: WebServerContext,
  url: string,
  cacheKey: string,
  playerMeshParse: SlotToWearableMapResults,
  cached: CachedPlayerMesh | null
) {
  const state = playerMeshRuntimeState();
  const generateNewMesh = async () => {
    const timer = new Timer();
    const releaseComputeSlot = await acquirePlayerMeshComputeSlot({
      url,
      cacheKey,
    });
    const state = playerMeshRuntimeState();
    log.info("Started generating player mesh asset", {
      url,
      cacheKey,
      activeComputes: state.activeComputes,
    });
    try {
      return await computePlayerMesh(context, playerMeshParse);
    } finally {
      releaseComputeSlot();
      log.info("Finished generating player mesh asset", {
        url,
        cacheKey,
        ms: timer.elapsed,
        activeComputes: state.activeComputes,
      });
    }
  };
  const computeOnce = (): Promise<CachedPlayerMesh> =>
    getOrStartPlayerMeshCompute(cacheKey, generateNewMesh);

  if (!cached) {
    return context.serverCache.getOrCompute(
      0,
      "player-mesh",
      cacheKey,
      computeOnce
    );
  }

  if (
    shouldRefreshPlayerMeshCache({
      cached,
      nowMs: Date.now(),
      assetExportVersion: ASSET_EXPORTS_SERVER_VERSION,
      recomputeIntervalMs: CONFIG.assetServerPlayerMeshRecomputeIntervalMs,
    }) &&
    !state.inflightComputes.has(cacheKey)
  ) {
    computeOnce()
      .then((mesh: CachedPlayerMesh) =>
        context.serverCache.set(0, "player-mesh", cacheKey, mesh)
      )
      .catch((err: unknown) => log.warn("Failed to generate player mesh", { err }));
  }
  return cached;
}

export function shouldRefreshPlayerMeshCache({
  cached,
  nowMs,
  assetExportVersion,
  recomputeIntervalMs,
}: {
  cached: Pick<CachedPlayerMesh, "assetExportVersion" | "computedAt">;
  nowMs: number;
  assetExportVersion: number;
  recomputeIntervalMs: number;
}) {
  return (
    cached.assetExportVersion !== assetExportVersion ||
    nowMs - cached.computedAt > recomputeIntervalMs
  );
}

function getOrStartPlayerMeshCompute(
  cacheKey: string,
  generateNewMesh: () => Promise<CachedPlayerMesh>
) {
  const state = playerMeshRuntimeState();
  const existing = state.inflightComputes.get(cacheKey);
  if (existing) {
    log.info("Joining in-flight player mesh compute", {
      cacheKey,
      activeComputes: state.activeComputes,
      waitingComputes: state.waitingComputes,
    });
    return existing;
  }
  const started = generateNewMesh().finally(() => {
    state.inflightComputes.delete(cacheKey);
  });
  state.inflightComputes.set(cacheKey, started);
  return started;
}

async function acquirePlayerMeshComputeSlot({
  url,
  cacheKey,
}: {
  url: string;
  cacheKey: string;
}) {
  const state = playerMeshRuntimeState();
  const maxActiveComputes = playerMeshMaxActiveComputes();
  if (
    shouldQueuePlayerMeshCompute({
      activeComputes: state.activeComputes,
      maxActiveComputes,
    })
  ) {
    const timer = new Timer();
    state.waitingComputes += 1;
    log.warn("Queueing player mesh compute under load", {
      url,
      cacheKey,
      activeComputes: state.activeComputes,
      waitingComputes: state.waitingComputes,
      maxActiveComputes,
    });
    await new Promise<void>((resolve) => {
      state.computeWaiters.push(resolve);
    });
    state.waitingComputes = Math.max(0, state.waitingComputes - 1);
    log.info("Dequeued player mesh compute", {
      url,
      cacheKey,
      waitMs: timer.elapsed,
      activeComputes: state.activeComputes,
      waitingComputes: state.waitingComputes,
      maxActiveComputes,
    });
  }

  state.activeComputes += 1;
  return () => {
    state.activeComputes = Math.max(0, state.activeComputes - 1);
    const nextWaiter = state.computeWaiters.shift();
    nextWaiter?.();
  };
}

export function isPlayerMeshWarmupRequest(
  userAgent: string | string[] | undefined
) {
  const value = Array.isArray(userAgent) ? userAgent.join(" ") : userAgent;
  return typeof value === "string" && value.includes("Biomes Warmup");
}

export function shouldSkipPlayerMeshWarmup({
  isWarmup,
  hasCached,
  activeComputes,
  maxActiveComputes,
}: {
  isWarmup: boolean;
  hasCached: boolean;
  activeComputes: number;
  maxActiveComputes: number;
}) {
  return isWarmup && !hasCached && activeComputes >= maxActiveComputes;
}

export function shouldQueuePlayerMeshCompute({
  activeComputes,
  maxActiveComputes,
}: {
  activeComputes: number;
  maxActiveComputes: number;
}) {
  return activeComputes >= Math.max(1, maxActiveComputes);
}

export function playerMeshSemanticCacheKey(
  playerMeshParse: SlotToWearableMapResults
) {
  const normalizedWearables = applyWearableAppearanceFilters(
    withDefaultStarterWearables(playerMeshParse.map)
  );
  const wearables = [...normalizedWearables.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([slot, value]) =>
        `${slot}:${value.id}:${value.primaryColor ?? ""}:${
          value.withHatVariant ? "with_hat" : ""
        }`
    )
    .join("|");
  return [
    `aev:${ASSET_EXPORTS_SERVER_VERSION}`,
    `wear:${wearables}`,
    `sc:${playerMeshParse.skinColorId ?? ""}`,
    `ec:${playerMeshParse.eyeColorId ?? ""}`,
    `hc:${playerMeshParse.hairColorId ?? ""}`,
  ].join(";");
}

// HARTHMERE_GENERATED_MESH_DEFAULT_WEARABLES:
// Server-side mirror of the client URL defaulting. This protects direct mesh
// requests and old clients from returning a bare base_model.vox GLB with the
// bright white default underclothes.
function withDefaultStarterWearables(
  slotToWearableMap: SlotToWearableMap
): SlotToWearableMap {
  const outMap: SlotToWearableMap = new Map(slotToWearableMap);
  if (!outMap.has("top")) {
    outMap.set("top", { id: BikkieIds.muckyTop });
  }
  if (!outMap.has("bottoms")) {
    outMap.set("bottoms", { id: BikkieIds.muckySkirt });
  }
  if (!outMap.has("feet")) {
    outMap.set("feet", { id: BikkieIds.boots });
  }
  return outMap;
}

async function computePlayerMesh(
  { assetExportsServer }: WebServerContext,
  {
    map: slotToWearableMap,
    skinColorId,
    eyeColorId,
    hairColorId,
  }: SlotToWearableMapResults
): Promise<CachedPlayerMesh> {
  const filteredWearableMap = applyWearableAppearanceFilters(
    withDefaultStarterWearables(slotToWearableMap)
  );

  const assetData = await assetExportsServer.build(
    "wearables/animated_player_mesh",
    filteredWearableMap,
    skinColorId,
    eyeColorId,
    hairColorId
  );
  if ((assetData as { kind: string }).kind === "Error") {
    const info = (assetData as { info?: string[] }).info?.join("") ?? "";
    log.error("Galois player mesh asset build returned an error", {
      info: info.slice(0, 2048),
    });
    throw new APIError(
      "internal_error",
      "Player mesh generation failed in the local asset server."
    );
  }
  const [data, mime] = assetDataToDataWithMimeType(assetData);
  return {
    data: data as Buffer,
    mime,
    computedAt: Date.now() + CONFIG.assetServerJitterIntervalMs * Math.random(),
    assetExportVersion: ASSET_EXPORTS_SERVER_VERSION,
  };
}

function applyWearableAppearanceFilters(
  slotToWearableMap: SlotToWearableMap
): SlotToWearableMap {
  const hatValue = slotToWearableMap.get("hat");
  if (!hatValue) {
    return slotToWearableMap;
  }

  const hairValue = slotToWearableMap.get("hair");
  if (!hairValue) {
    return slotToWearableMap;
  }

  const outMap: SlotToWearableMap = new Map(slotToWearableMap);
  outMap.set("hair_with_hat", { ...hairValue, withHatVariant: true });
  outMap.delete("hair");
  return outMap;
}
