import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zBiomesId, type BiomesId } from "@/shared/ids";
import { zVec3f } from "@/shared/math/types";
import { z } from "zod";

export const zLandmark = z.object({
  id: zBiomesId,
  name: z.string(),
  importance: z.number(),
  position: zVec3f,
});

export type Landmark = z.infer<typeof zLandmark>;

export const zLandmarksResponse = zLandmark.array();

export type LandmarksResponse = z.infer<typeof zLandmarksResponse>;

export const SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_VERSION_V71 =
  "snapshot-mission-world-map-landmarks-v71";

const SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_V71: Landmark[] = [
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

function shouldExposeSnapshotMissionLandmarksV71() {
  return (
    process.env.BIOMES_ENABLE_SNAPSHOT_MISSION_BRIDGE === "1" ||
    process.env.SKIP_PROD_LOAD === "true" ||
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1" ||
    process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1"
  );
}

function appendSnapshotMissionLandmarksV71(items: Landmark[]): Landmark[] {
  if (!shouldExposeSnapshotMissionLandmarksV71()) {
    return items;
  }
  const existingNames = new Set(items.map((item) => item.name));
  return [
    ...items,
    ...SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_V71.filter(
      (item) => !existingNames.has(item.name),
    ),
  ];
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
    return appendSnapshotMissionLandmarksV71(scanned);
  }
);
