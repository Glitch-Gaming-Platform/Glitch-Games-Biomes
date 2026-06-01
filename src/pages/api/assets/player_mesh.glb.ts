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
const DEFAULT_PLAYER_MESH_WARMUP_MAX_ACTIVE_COMPUTES = 1;

export interface CachedPlayerMesh {
  data: Buffer;
  mime: string;
  computedAt: number;
  assetExportVersion: number;
}

type PlayerMeshRuntimeStateV1 = {
  activeComputes: number;
};

const globalForPlayerMeshRuntimeV1 = globalThis as typeof globalThis & {
  __playerMeshRuntimeStateV1?: PlayerMeshRuntimeStateV1;
};

function playerMeshRuntimeStateV1() {
  return (
    globalForPlayerMeshRuntimeV1.__playerMeshRuntimeStateV1 ??
    (globalForPlayerMeshRuntimeV1.__playerMeshRuntimeStateV1 = {
      activeComputes: 0,
    })
  );
}

function playerMeshWarmupMaxActiveComputesV1() {
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
    const cacheKey = playerMeshSemanticCacheKeyV1(playerMeshParse);
    const [cached] = await context.serverCache.get("player-mesh", cacheKey);
    const warmupRequest = isPlayerMeshWarmupRequestV1(
      unsafeRequest.headers["user-agent"]
    );
    const activeComputes = playerMeshRuntimeStateV1().activeComputes;
    if (
      shouldSkipPlayerMeshWarmupV1({
        isWarmup: warmupRequest,
        hasCached: Boolean(cached),
        activeComputes,
        maxActiveComputes: playerMeshWarmupMaxActiveComputesV1(),
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
  const generateNewMesh = async () => {
    const timer = new Timer();
    const state = playerMeshRuntimeStateV1();
    state.activeComputes += 1;
    log.info("Started generating player mesh asset", {
      url,
      cacheKey,
      activeComputes: state.activeComputes,
    });
    try {
      return await computePlayerMesh(context, playerMeshParse);
    } finally {
      state.activeComputes = Math.max(0, state.activeComputes - 1);
      log.info("Finished generating player mesh asset", {
        url,
        cacheKey,
        ms: timer.elapsed,
        activeComputes: state.activeComputes,
      });
    }
  };

  if (!cached) {
    return context.serverCache.getOrCompute(
      0,
      "player-mesh",
      cacheKey,
      generateNewMesh
    );
  }

  if (
    cached.assetExportVersion !== ASSET_EXPORTS_SERVER_VERSION ||
    Date.now() - cached.computedAt >
      CONFIG.assetServerPlayerMeshRecomputeIntervalMs
  ) {
    generateNewMesh()
      .then((mesh) => context.serverCache.set(0, "player-mesh", cacheKey, mesh))
      .catch((err) => log.warn("Failed to generate player mesh", { err }));
  }
  return cached;
}

export function isPlayerMeshWarmupRequestV1(
  userAgent: string | string[] | undefined
) {
  const value = Array.isArray(userAgent) ? userAgent.join(" ") : userAgent;
  return typeof value === "string" && value.includes("Biomes Warmup");
}

export function shouldSkipPlayerMeshWarmupV1({
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

export function playerMeshSemanticCacheKeyV1(
  playerMeshParse: SlotToWearableMapResults
) {
  const normalizedWearables = applyWearableAppearanceFilters(
    withDefaultStarterWearablesV182(playerMeshParse.map)
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

// HARTHMERE_GENERATED_MESH_DEFAULT_WEARABLES_V182:
// Server-side mirror of the client URL defaulting. This protects direct mesh
// requests and old clients from returning a bare base_model.vox GLB with the
// bright white default underclothes.
function withDefaultStarterWearablesV182(
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
    withDefaultStarterWearablesV182(slotToWearableMap)
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
