import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zBiomesId, type BiomesId } from "@/shared/ids";
import { zVec3f } from "@/shared/math/types";
import { z } from "zod";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";

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
    position: [640, 54, -209],
  },
  {
    id: 8810000000007102 as BiomesId,
    importance: 1,
    name: "Sergeant Bram Holt",
    position: [998, 54, -277],
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
    }),
  );

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
    return appendSnapshotMissionLandmarks(scanned);
  }
);
