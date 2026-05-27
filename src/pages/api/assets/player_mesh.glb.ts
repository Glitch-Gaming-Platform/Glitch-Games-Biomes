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

export interface CachedPlayerMesh {
  data: Buffer;
  mime: string;
  computedAt: number;
  assetExportVersion: number;
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
    const mesh = await fetchOrComputeMesh(
      context,
      unsafeRequest.url,
      playerMeshParse
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
    unsafeResponse.setHeader(
      "X-Glitch-Player-Mesh-Content-Type",
      mesh.mime
    );
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
  playerMeshParse: SlotToWearableMapResults
) {
  const generateNewMesh = async () => {
    const timer = new Timer();
    log.info("Started generating player mesh asset", { url });
    try {
      return await computePlayerMesh(context, playerMeshParse);
    } finally {
      log.info("Finished generating player mesh asset", {
        url,
        ms: timer.elapsed,
      });
    }
  };

  const [cached] = await context.serverCache.get("player-mesh", url);
  if (!cached) {
    return context.serverCache.getOrCompute(
      0,
      "player-mesh",
      url,
      generateNewMesh
    );
  }

  if (
    cached.assetExportVersion !== ASSET_EXPORTS_SERVER_VERSION ||
    Date.now() - cached.computedAt >
      CONFIG.assetServerPlayerMeshRecomputeIntervalMs
  ) {
    generateNewMesh()
      .then((mesh) => context.serverCache.set(0, "player-mesh", url, mesh))
      .catch((err) => log.warn("Failed to generate player mesh", { err }));
  }
  return cached;
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
