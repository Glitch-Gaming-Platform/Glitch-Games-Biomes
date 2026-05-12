import { fetchSocialMetadata, fetchTileMetadata } from "@/server/web/db/map";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import type { ReadonlyWorldMetadata } from "@/shared/ecs/gen/components";
import { WorldMetadataId } from "@/shared/ecs/ids";
import type { WorldMapMetadataResponse } from "@/shared/types";
import { zWorldMapMetadataResponse } from "@/shared/types";

function localFallbackMapMetadata(
  worldMetadata?: ReadonlyWorldMetadata
): Omit<WorldMapMetadataResponse, "socialData"> {
  const v0 = worldMetadata?.aabb.v0 ?? [-2048, -256, -2048];
  const v1 = worldMetadata?.aabb.v1 ?? [2048, 512, 2048];

  let x0 = Math.min(v0[0], v1[0]);
  let x1 = Math.max(v0[0], v1[0]);
  let z0 = Math.min(v0[2], v1[2]);
  let z1 = Math.max(v0[2], v1[2]);

  // Extremely sparse local snapshots can still have a default zero-sized
  // metadata box. The map UI needs non-zero bounds even if no generated map
  // tiles exist, so keep the player-facing map bounded by the same conservative
  // local world size used by the sync observer fallback.
  if (x0 === x1 || z0 === z1) {
    x0 = -2048;
    x1 = 2048;
    z0 = -2048;
    z1 = 2048;
  }

  const boundsStart: [number, number] = [x0, z0];
  const boundsEnd: [number, number] = [x1, z1];

  return {
    id: "local",
    version: "local",
    fullImageURL: "/splash/black.png",
    fullImageWidth: Math.max(1, Math.ceil(x1 - x0)),
    fullImageHeight: Math.max(1, Math.ceil(z1 - z0)),
    fullTileImageURL: "/splash/black.png",
    boundsStart,
    boundsEnd,

    // Empty versionIndex makes mapTileURL fall back to the built-in black tile,
    // which is correct for local snapshots that have no generated world map.
    tileImageTemplateURL: "/splash/black.png",
    tileMaxZoomLevel: 4,
    tileMinZoomLevel: 0,
    tileSize: 512,
    versionIndex: {},
  };
}

export default biomesApiHandler(
  {
    auth: "optional",
    response: zWorldMapMetadataResponse,
  },
  async ({ context: { db, worldApi } }) => {
    const [tileMetadata, socialMetadata, worldMetadataEntity] =
      await Promise.all([
        fetchTileMetadata(db),
        fetchSocialMetadata(db),
        worldApi.get(WorldMetadataId),
      ]);

    return {
      ...(tileMetadata ??
        localFallbackMapMetadata(worldMetadataEntity?.worldMetadata())),
      socialData: socialMetadata,
    };
  }
);
