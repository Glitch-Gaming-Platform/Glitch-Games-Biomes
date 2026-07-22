import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zBiomesId, type BiomesId } from "@/shared/ids";
import { zVec3f } from "@/shared/math/types";
import { z } from "zod";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_BIBLE_DISTRICTS } from "@/shared/harthmere/harthmere_district_bible_layout";
import { HARTHMERE_EXTENSION_ROAD } from "@/shared/harthmere/world_extension";

export const zLandmark = z.object({
  id: zBiomesId,
  name: z.string(),
  importance: z.number(),
  position: zVec3f,
});

export type Landmark = z.infer<typeof zLandmark>;

export const zLandmarksResponse = zLandmark.array();

export type LandmarksResponse = z.infer<typeof zLandmarksResponse>;

export const SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_VERSION =
  "snapshot-mission-world-map-landmarks";
export const SNAPSHOT_GROVE_WORLD_MAP_LANDMARKS_VERSION =
  "snapshot-grove-world-map-landmarks";
export const HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS_VERSION =
  "harthmere-connector-world-map-landmarks";
export const HARTHMERE_EXTENSION_WORLD_MAP_LANDMARKS_VERSION =
  "harthmere-additive-extension-world-map-landmarks-v1";
export const HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS_VERSION =
  "harthmere-bible-world-map-landmarks-v1";

const SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS: Landmark[] = [
  {
    id: 8997551883502310 as BiomesId,
    importance: 0,
    name: "Old Grove Road Post",
    position: [500, 54, -140],
  },
  {
    id: 8997551883502311 as BiomesId,
    importance: 0,
    name: "Muckwad Patch",
    position: [512, 54, -152],
  },
  {
    id: 8997551883502312 as BiomesId,
    importance: 0,
    name: "Building Practice Spot",
    position: [528, 54, -152],
  },
  {
    id: 8997551883502313 as BiomesId,
    importance: 0,
    name: "Road Jump Stretch",
    position: [548, 54, -170],
  },
  {
    id: 8997551883502314 as BiomesId,
    importance: 0,
    name: "Selfie Overlook",
    position: [560, 54, -182],
  },
  {
    id: 8997551883502307 as BiomesId,
    importance: 0,
    name: "The Grove - Jackie",
    position: [425, 54, -96],
  },
  {
    id: 8997551883502308 as BiomesId,
    importance: 0,
    name: "The Grove",
    position: [425, 54, -96],
  },
  {
    id: 8810000000007101 as BiomesId,
    importance: 1,
    name: "Road to Harthmere",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldBoundaryHandoff[0],
      54,
      HARTHMERE_EXTENSION_ROAD.worldBoundaryHandoff[1],
    ],
  },
  {
    id: 8810000000007102 as BiomesId,
    importance: 1,
    name: "Sergeant Bram Holt",
    position: shiftHarthmereAuthoredPositionToWorld([486, 54, -277]),
  },
];

const SNAPSHOT_GROVE_WORLD_MAP_LANDMARKS: Landmark[] =
  SNAPSHOT_GROVE_LANDMARKS.filter((landmark) => landmark.visibleOnWorldMap).map(
    (landmark, index): Landmark => ({
      id: (8997551883502400 + index) as BiomesId,
      importance:
        landmark.kind === "safe_zone" || landmark.kind === "connector" ? 1 : 0,
      name: landmark.label,
      position: [...landmark.position],
    })
  );

function connectorWorldMapLandmark(
  landmarkId: string,
  mapId: BiomesId
): Landmark {
  const landmark = SNAPSHOT_GROVE_LANDMARKS.find(
    (candidate) => candidate.id === landmarkId
  );
  if (!landmark) {
    throw new Error(`Missing connector world-map landmark: ${landmarkId}`);
  }
  return {
    id: mapId,
    importance: 1,
    name: landmark.label,
    position: [...landmark.position],
  };
}

// These two pins are navigation infrastructure, not optional mission markers.
// They remain available even when the snapshot mission bridge is disabled.
export const HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS: Landmark[] = [
  connectorWorldMapLandmark(
    "harthmere_road_grove_trailhead",
    8997551883502315 as BiomesId
  ),
  connectorWorldMapLandmark(
    "harthmere_road_west_gate",
    8997551883502316 as BiomesId
  ),
];

// Route infrastructure is always visible. The old connector endpoints remain
// useful for players already following the Grove road, while these pins mark
// the exact beginning, old/new shard handoff, west gate, and north-gate end of
// the additive extension road.
export const HARTHMERE_EXTENSION_WORLD_MAP_LANDMARKS: Landmark[] = [
  {
    id: 8997551883600000 as BiomesId,
    importance: 1,
    name: "Harthmere Extension Road — Map Boundary Start",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldStart[0],
      54,
      HARTHMERE_EXTENSION_ROAD.worldStart[1],
    ],
  },
  {
    id: 8997551883600001 as BiomesId,
    importance: 1,
    name: "Harthmere West Gate",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldWestGate[0],
      54,
      HARTHMERE_EXTENSION_ROAD.worldWestGate[1],
    ],
  },
  {
    id: 8997551883600002 as BiomesId,
    importance: 1,
    name: "Harthmere North Gate — Road End",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldNorthGate[0],
      54,
      HARTHMERE_EXTENSION_ROAD.worldNorthGate[1],
    ],
  },
];

// Every district and every named landmark in the canonical bible gets a map
// pin. This keeps buildings such as the chapel, forge, inn, bank, warehouse,
// wells, barracks, residences, and civic offices discoverable without a second
// hand-maintained coordinate list drifting away from the generated town.
export const HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS: Landmark[] =
  HARTHMERE_BIBLE_DISTRICTS.flatMap((district, districtIndex) => {
    const districtAnchor: Landmark = {
      id: (8997551883600100 + districtIndex) as BiomesId,
      importance: 1,
      name: `Harthmere — ${district.label}`,
      position: shiftHarthmereAuthoredPositionToWorld(district.anchor),
    };
    const buildings = district.landmarks.map(
      (landmark, landmarkIndex): Landmark => ({
        id: (8997551883601000 + districtIndex * 32 + landmarkIndex) as BiomesId,
        importance: landmark.icon ? 1 : 0,
        name: `Harthmere — ${landmark.label}`,
        position: shiftHarthmereAuthoredPositionToWorld(landmark.position),
      })
    );
    return [districtAnchor, ...buildings];
  });

export function appendHarthmereExtensionWorldMapLandmarks(
  items: Landmark[]
): Landmark[] {
  const seen = new Set(items.map((item) => item.name));
  const appended = [...items];
  for (const item of [
    ...HARTHMERE_EXTENSION_WORLD_MAP_LANDMARKS,
    ...HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS,
  ]) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    appended.push(item);
  }
  return appended;
}

export function appendHarthmereConnectorWorldMapLandmarks(
  items: Landmark[]
): Landmark[] {
  const seen = new Set(items.map((item) => item.name));
  const appended = [...items];
  for (const item of HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    appended.push(item);
  }
  return appended;
}

function shouldExposeSnapshotMissionLandmarks() {
  return (
    process.env.BIOMES_ENABLE_SNAPSHOT_MISSION_BRIDGE === "1" ||
    process.env.SKIP_PROD_LOAD === "true" ||
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1" ||
    process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1"
  );
}

function appendSnapshotMissionLandmarks(items: Landmark[]): Landmark[] {
  if (!shouldExposeSnapshotMissionLandmarks()) {
    return items;
  }
  const seen = new Set(items.map((item) => item.name));
  const appended = [...items];
  for (const item of [
    ...SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS,
    ...SNAPSHOT_GROVE_WORLD_MAP_LANDMARKS,
  ]) {
    if (seen.has(item.name)) {
      continue;
    }
    seen.add(item.name);
    appended.push(item);
  }
  return appended;
}

export default biomesApiHandler(
  {
    auth: "optional",
    response: zLandmarksResponse,
  },
  async ({ context: { askApi } }) => {
    const ret = await askApi.scanAll("landmarks");
    const scanned = ret.flatMap((e): Array<Landmark> => {
      const lm = e.landmark();
      const label = e.label();
      const position = e.position();
      if (!lm || !position) {
        return [];
      }

      return [
        {
          id: e.id,
          importance: lm.importance ?? 0,
          name: lm.override_name ?? label?.text ?? "Landmark",
          position: [...position.v],
        },
      ];
    });
    return appendSnapshotMissionLandmarks(
      appendHarthmereExtensionWorldMapLandmarks(
        appendHarthmereConnectorWorldMapLandmarks(scanned)
      )
    );
  }
);
