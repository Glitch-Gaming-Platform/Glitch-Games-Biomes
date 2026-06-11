export interface HarthmereLocationVoiceMetadataV1 {
  id: string;
  name: string;
  story: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export const HARTHMERE_LOCATION_VOICE_METADATA_V1: readonly HarthmereLocationVoiceMetadataV1[] =
  [
    {
      id: "grove_job_board",
      name: "Grove Jobs Board",
      story:
        "The town's first stop for honest work, urgent notices, courier contracts, and public favors.",
      bounds: { minX: 455, maxX: 535, minZ: -250, maxZ: -150 },
    },
    {
      id: "grove_market_square",
      name: "Grove Market Square",
      story:
        "A busy trade square around the fountain where merchants, guards, travelers, and local gossip cross paths.",
      bounds: { minX: 430, maxX: 560, minZ: -160, maxZ: -60 },
    },
    {
      id: "grove_chapel_ward",
      name: "Grove Chapel Ward",
      story:
        "A quieter part of town shaped by healing work, careful charity, old bells, and uneasy local faith.",
      bounds: { minX: 540, maxX: 650, minZ: -240, maxZ: -110 },
    },
    {
      id: "grove_trade_row",
      name: "Grove Trade Row",
      story:
        "A practical stretch of workshops, counters, and ledgers where supply, debt, repair, and craft reputation matter.",
      bounds: { minX: 370, maxX: 455, minZ: -240, maxZ: -110 },
    },
    {
      id: "harthmere_wilds",
      name: "Harthmere Wilds",
      story:
        "The wider road-country beyond the Grove: muck trouble, scattered farms, outpost work, and routes that turn dangerous after dusk.",
      bounds: { minX: -2000, maxX: 2200, minZ: -2200, maxZ: 2200 },
    },
  ];

export function harthmereLocationVoiceMetadataForPositionV1(
  position: readonly [number, number, number] | undefined
): HarthmereLocationVoiceMetadataV1 | undefined {
  if (!position) {
    return undefined;
  }
  const [x, , z] = position;
  return HARTHMERE_LOCATION_VOICE_METADATA_V1.find(
    (location) =>
      x >= location.bounds.minX &&
      x <= location.bounds.maxX &&
      z >= location.bounds.minZ &&
      z <= location.bounds.maxZ
  );
}
