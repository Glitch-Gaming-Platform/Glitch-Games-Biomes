// CHAPTER_1_WORLD_BUILDINGS
//
// Canonical solid-voxel locations for the Grove Road-House and Watch House.
// Both are story locations, not decorative marker clusters. The plans use the
// same building-system materialization outbox as the Grove/Harthmere business
// buildings, so floors, walls, roofs, stairs, collision, terrain shards and
// map-facing markers share one production path.

import {
  BUILDING_SYSTEM_TERRAIN_BLOCKS,
  createBuildingSystemMaterializationPlan,
  type BuildingSystemBlueprintDefinition,
  type BuildingSystemMaterializationPlan,
  type BuildingSystemPlotDefinition,
  type BuildingSystemVoxelEditSpec,
} from "@/shared/harthmere/building_system";

export const CH1_WORLD_BUILDINGS_VERSION =
  "chapter-1-world-buildings-v1" as const;

const AUTHOR = "chapter_1_world";
const CREATED_AT_MS = 1;

const ROADHOUSE_PLOT: BuildingSystemPlotDefinition = {
  plotId: "ch1_grove_roadhouse_plot",
  displayName: "Grove Road-House",
  area: "the_grove",
  district: "The Grove",
  plotType: "commercial",
  allowedUses: ["business"],
  allowedBlueprintIds: ["ch1_grove_roadhouse"],
  claimPriceGold: 0,
  taxRate: 0,
  bounds: { xMin: 466, xMax: 483, zMin: -139, zMax: -121 },
  // Existing Grove terrain top is Y=69. Building-system default origin is
  // groundY + 1, so 68 produces a flush Y=69 floor and Y=70 feet.
  groundY: 68,
  startsMucked: false,
  safeAfterPurchase: true,
  maxStructureHeight: 12,
  maxCoveredAreaFraction: 0.9,
  requiresRoadAccess: false,
  terrainType: "grass",
  description:
    "Jackie's two-storey road-house with a common room below and enclosed spare room above.",
};

const ROADHOUSE_BLUEPRINT: BuildingSystemBlueprintDefinition = {
  blueprintId: "ch1_grove_roadhouse",
  displayName: "Grove Road-House",
  source: "harthmere_catalog",
  materializationKind: "solid_structure",
  plotType: "commercial",
  use: "business",
  structureTypeId: "large_house",
  goldCost: 0,
  storageSlots: 0,
  service: "Chapter 1 home base, meals, storage and sleeping room.",
  footprint: { width: 12, depth: 14, height: 8 },
  materialStages: {},
  laborStages: {},
  description:
    "A real two-storey voxel building: common room, hearth, stores, stairs and an upstairs spare room.",
};

const WATCH_HOUSE_PLOT: BuildingSystemPlotDefinition = {
  plotId: "ch1_grove_watch_house_plot",
  displayName: "Grove Watch House",
  area: "the_grove",
  district: "The Grove",
  plotType: "public",
  allowedUses: ["public_service"],
  allowedBlueprintIds: ["ch1_grove_watch_house"],
  claimPriceGold: 0,
  taxRate: 0,
  bounds: { xMin: 466, xMax: 480, zMin: -154, zMax: -141 },
  groundY: 68,
  startsMucked: false,
  safeAfterPurchase: true,
  maxStructureHeight: 8,
  maxCoveredAreaFraction: 0.8,
  requiresRoadAccess: false,
  terrainType: "grass",
  description: "The enclosed Grove watch office used by Chapter 1.",
};

const WATCH_HOUSE_BLUEPRINT: BuildingSystemBlueprintDefinition = {
  blueprintId: "ch1_grove_watch_house",
  displayName: "Grove Watch House",
  source: "harthmere_catalog",
  materializationKind: "solid_structure",
  plotType: "public",
  use: "public_service",
  structureTypeId: "small_house",
  goldCost: 0,
  storageSlots: 0,
  service: "Grove watch office and Chapter 1 holding room.",
  footprint: { width: 8, depth: 8, height: 4 },
  materialStages: {},
  laborStages: {},
  description: "A separate enclosed watch office with a reachable door.",
};

function edit(
  position: [number, number, number],
  value: BuildingSystemVoxelEditSpec["value"],
  label: BuildingSystemVoxelEditSpec["label"]
): BuildingSystemVoxelEditSpec {
  return { kind: "editEvent", position, value, label };
}

function clearVolume(input: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}) {
  const edits: BuildingSystemVoxelEditSpec[] = [];
  for (let x = input.x0; x < input.x1; x += 1) {
    for (let y = input.y0; y < input.y1; y += 1) {
      for (let z = input.z0; z < input.z1; z += 1) {
        edits.push(
          edit([x, y, z], 0 as BuildingSystemVoxelEditSpec["value"], "interior")
        );
      }
    }
  }
  return edits;
}

function withoutPrivateBuildingFixtures(
  plan: BuildingSystemMaterializationPlan
) {
  return {
    ...plan,
    edits: plan.edits.filter(
      (row) => row.label !== "door_lock" && row.label !== "business_marker"
    ),
    inWorldMarkers: (plan.inWorldMarkers ?? []).filter(
      (marker) =>
        marker.kind !== "door_lock" && marker.kind !== "business_marker"
    ),
  };
}

function roadHousePlan(): BuildingSystemMaterializationPlan {
  const base = withoutPrivateBuildingFixtures(
    createBuildingSystemMaterializationPlan({
      requestId: "ch1_world:grove_roadhouse:v1",
      actorId: AUTHOR,
      plot: ROADHOUSE_PLOT,
      blueprint: ROADHOUSE_BLUEPRINT,
      origin: { x: 468, y: 69, z: -137 },
      activatedAtMs: CREATED_AT_MS,
    })
  );
  const additions: BuildingSystemVoxelEditSpec[] = [];

  // Upper walkable floor at Y=73 (feet Y=74), with an open stairwell.
  for (let x = 469; x <= 478; x += 1) {
    for (let z = -136; z <= -125; z += 1) {
      const stairwell = x <= 471 && z >= -135 && z <= -131;
      if (!stairwell) {
        additions.push(
          edit([x, 73, z], BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber, "floor")
        );
      }
    }
  }
  for (const x of [470, 471]) {
    additions.push(
      edit(
        [x, 70, -134],
        BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished,
        "stair"
      ),
      edit(
        [x, 71, -133],
        BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished,
        "stair"
      ),
      edit(
        [x, 72, -132],
        BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished,
        "stair"
      ),
      edit([x, 73, -131], BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished, "stair")
    );
  }

  // Enclosed upstairs spare room. The two middle columns are its doorway.
  for (let x = 469; x <= 478; x += 1) {
    if (x === 473 || x === 474) continue;
    for (const y of [74, 75, 76]) {
      additions.push(
        edit([x, y, -130], BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber, "wall")
      );
    }
  }

  // Ground-floor and upstairs windows replace shell wall blocks after the
  // shell is authored. They keep both rooms readable from outside.
  for (const [x, y, z] of [
    [470, 71, -137],
    [477, 71, -137],
    [468, 71, -128],
    [479, 71, -128],
    [470, 75, -124],
    [477, 75, -124],
    [468, 75, -127],
    [479, 75, -127],
  ] as Array<[number, number, number]>) {
    additions.push(
      edit([x, y, z], BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass, "wall")
    );
  }

  return {
    ...base,
    edits: [
      ...clearVolume({ x0: 468, x1: 480, y0: 70, y1: 78, z0: -137, z1: -123 }),
      ...base.edits,
      ...additions,
    ],
  };
}

function watchHousePlan(): BuildingSystemMaterializationPlan {
  const base = withoutPrivateBuildingFixtures(
    createBuildingSystemMaterializationPlan({
      requestId: "ch1_world:grove_watch_house:v1",
      actorId: AUTHOR,
      plot: WATCH_HOUSE_PLOT,
      blueprint: WATCH_HOUSE_BLUEPRINT,
      origin: { x: 469, y: 69, z: -152 },
      activatedAtMs: CREATED_AT_MS,
    })
  );
  const windows = [
    [469, 71, -148],
    [476, 71, -148],
    [471, 71, -145],
    [474, 71, -145],
  ].map(([x, y, z]) =>
    edit([x, y, z], BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass, "wall")
  );
  return {
    ...base,
    edits: [
      ...clearVolume({ x0: 469, x1: 477, y0: 70, y1: 74, z0: -152, z1: -144 }),
      ...base.edits,
      ...windows,
    ],
  };
}

export const CH1_WORLD_BUILDING_PLANS: readonly BuildingSystemMaterializationPlan[] =
  Object.freeze([roadHousePlan(), watchHousePlan()]);

export function ch1WorldBuildingPlan(requestId: string) {
  return CH1_WORLD_BUILDING_PLANS.find((plan) => plan.requestId === requestId);
}
