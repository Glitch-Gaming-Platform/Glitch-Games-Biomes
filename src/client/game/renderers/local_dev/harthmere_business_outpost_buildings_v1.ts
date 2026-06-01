import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  type HarthmereBusinessOutpostProceduralBuildingRecordV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import * as THREE from "three";

export const HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1 =
  "harthmere-business-outpost-guide-constructed-v2" as const;

function harthmereBusinessOutpostRuntimeOffsetXV1() {
  return Number.parseInt(
    process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ??
      process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ??
      "512",
    10
  );
}

function harthmereBusinessOutpostRuntimeOffsetZV1() {
  return Number.parseInt(
    process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ??
      process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ??
      "0",
    10
  );
}

function shouldUseHarthmereBusinessOutpostRuntimeOffsetV1() {
  if (
    process.env.NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET ===
      "1" ||
    process.env.BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET === "1" ||
    process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_STANDALONE_TOWN === "1" ||
    process.env.BIOMES_HARTHMERE_STANDALONE_TOWN === "1"
  ) {
    return false;
  }
  return (
    process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    process.env.NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1" ||
    process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1" ||
    process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN === "1" ||
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1"
  );
}

export function harthmereBusinessOutpostRuntimeOffsetForTestV1() {
  return shouldUseHarthmereBusinessOutpostRuntimeOffsetV1()
    ? {
        x: harthmereBusinessOutpostRuntimeOffsetXV1(),
        z: harthmereBusinessOutpostRuntimeOffsetZV1(),
      }
    : { x: 0, z: 0 };
}

const GUIDE_MATERIAL_COLORS_V1: Record<string, number> = {
  arch_wall_window_glass: 0xa8d9e8,
  carved_limestone: 0xc9c0ad,
  clean_stone_tile: 0x8f969b,
  cobblestone: 0x6f7478,
  dark_workshop_stone: 0x59616a,
  dirt: 0x4f7e45,
  green_roof_sod: 0x4e7c43,
  oakLog: 0x6a4527,
  purple_canvas: 0x8d43c9,
  red_canvas: 0xb34f47,
  red_clay_roof: 0x8f453c,
  smallOakSign: 0x8b642f,
  stone: 0x8f969b,
  stone_foundation: 0x6f7478,
  warm_wood_plank: 0xb08458,
  white_canvas: 0xe5dcc8,
  woodContainer: 0x76502f,
  wood_floor: 0xc39a61,
  woodenStepper: 0xc9c0ad,
};

type GuideBuildingMathV1 = {
  depth: number;
  doorX: number;
  height: number;
  roofY: number;
  wallTop: number;
  width: number;
  x0: number;
  x1: number;
  y0: number;
  z0: number;
  z1: number;
};

type GuideAssetRoleV1 = "structure" | "interior" | "exterior" | "fixture";

const TILE_TEXTURE_CACHE_V1 = new Map<string, THREE.DataTexture>();

function colorChannelV1(color: number, shift: number) {
  return (color >> shift) & 0xff;
}

function mixColorChannelV1(channel: number, target: number, amount: number) {
  return Math.max(
    0,
    Math.min(255, Math.round(channel * (1 - amount) + target * amount))
  );
}

function mixColorV1(color: number, target: number, amount: number) {
  const r = mixColorChannelV1(colorChannelV1(color, 16), target, amount);
  const g = mixColorChannelV1(colorChannelV1(color, 8), target, amount);
  const b = mixColorChannelV1(colorChannelV1(color, 0), target, amount);
  return (r << 16) | (g << 8) | b;
}

function guideTileTextureForMaterialV1(token: string, color: number) {
  const cacheKey = `${token}:${color.toString(16)}`;
  const cached = TILE_TEXTURE_CACHE_V1.get(cacheKey);
  if (cached) return cached;

  const size = 16;
  const data = new Uint8Array(size * size * 4);
  const edge = mixColorV1(color, 0x00, 0.26);
  const highlight = mixColorV1(color, 0xff, 0.12);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const isEdge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const isInnerLine = x === 7 || y === 7;
      const shaded = isEdge ? edge : isInnerLine ? highlight : color;
      data[index] = colorChannelV1(shaded, 16);
      data[index + 1] = colorChannelV1(shaded, 8);
      data[index + 2] = colorChannelV1(shaded, 0);
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  TILE_TEXTURE_CACHE_V1.set(cacheKey, texture);
  return texture;
}

function styleMaterialColorV1(material: string | undefined, fallback: number) {
  return material ? GUIDE_MATERIAL_COLORS_V1[material] ?? fallback : fallback;
}

function guideMaterialV1(token: string, fallback = 0x8f8f8f) {
  const color = styleMaterialColorV1(token, fallback);
  const material = new THREE.MeshBasicMaterial({
    map: guideTileTextureForMaterialV1(token, color),
  });
  material.userData.harthmereGuideMaterialToken = token;
  material.userData.harthmereGuideVoxelTiling = "one_texture_tile_per_voxel";
  return material;
}

function guideGlassMaterialV1() {
  const color = styleMaterialColorV1("arch_wall_window_glass", 0xa8d9e8);
  const material = new THREE.MeshBasicMaterial({
    map: guideTileTextureForMaterialV1("arch_wall_window_glass", color),
  });
  material.userData.harthmereGuideMaterialToken = "arch_wall_window_glass";
  material.userData.harthmereGuideVoxelTiling = "one_texture_tile_per_voxel";
  return material;
}

function guideMathForRecordV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
): GuideBuildingMathV1 {
  const width = record.blueprint.footprint.width;
  const depth = record.blueprint.footprint.depth;
  const height = record.blueprint.footprint.height;
  const x0 = record.origin.x;
  const y0 = record.origin.y;
  const z0 = record.origin.z;
  const wallTop = y0 + Math.max(3, height - 1);
  return {
    depth,
    doorX: x0 + Math.floor(width / 2),
    height,
    roofY: wallTop,
    wallTop,
    width,
    x0,
    x1: x0 + width,
    y0,
    z0,
    z1: z0 + depth,
  };
}

function addBoxV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  part: string,
  guide: {
    fixtureId?: string;
    fixturePosition?: { x: number; y: number; z: number };
    fixtureSize?: readonly [number, number, number];
    materialToken?: string;
    sourceAssetKey?: string;
    sourceAssetRole?: GuideAssetRoleV1;
  } = {}
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = `${record.displayName} ${name}`;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.harthmereBusinessOutpostId = record.outpostId;
  mesh.userData.harthmereBusinessOutpostPart = part;
  mesh.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  if (guide.sourceAssetKey) {
    mesh.userData.harthmereGuideSourceAssetKey = guide.sourceAssetKey;
  }
  if (guide.sourceAssetRole) {
    mesh.userData.harthmereGuideSourceAssetRole = guide.sourceAssetRole;
  }
  if (guide.materialToken) {
    mesh.userData.harthmereGuideMaterialToken = guide.materialToken;
  }
  if (guide.fixtureId) {
    mesh.userData.harthmereBusinessFixtureId = guide.fixtureId;
  }
  if (guide.fixturePosition) {
    mesh.userData.harthmereBusinessFixturePosition = {
      ...guide.fixturePosition,
    };
  }
  if (guide.fixtureSize) {
    mesh.userData.harthmereBusinessFixtureSize = [...guide.fixtureSize];
  }
  group.add(mesh);
  return mesh;
}

function addInstancedGuideBlocksV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  part: string,
  sourceAssetKey: string,
  sourceAssetRole: GuideAssetRoleV1,
  materialToken: string,
  positions: Array<readonly [number, number, number]>
) {
  if (positions.length === 0) return;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    guideMaterialV1(materialToken),
    positions.length
  );
  mesh.name = `${record.displayName} ${part} ${sourceAssetKey}`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.harthmereBusinessOutpostId = record.outpostId;
  mesh.userData.harthmereBusinessOutpostPart = part;
  mesh.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  mesh.userData.harthmereGuideSourceAssetKey = sourceAssetKey;
  mesh.userData.harthmereGuideSourceAssetRole = sourceAssetRole;
  mesh.userData.harthmereGuideMaterialToken = materialToken;
  mesh.userData.harthmereGuideConstructedFrom = "guide_report_math";
  mesh.userData.harthmereGuideInstanceCount = positions.length;
  const matrix = new THREE.Matrix4();
  positions.forEach(([x, y, z], index) => {
    matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}

function rectPositionsV1(
  x0: number,
  x1: number,
  y: number,
  z0: number,
  z1: number
) {
  const positions: Array<readonly [number, number, number]> = [];
  for (let x = x0; x < x1; x += 1) {
    for (let z = z0; z < z1; z += 1) {
      positions.push([x, y, z]);
    }
  }
  return positions;
}

function foundationSupportPositionsV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  math: GuideBuildingMathV1
) {
  const bounds = record.materializationPlan.safeZone?.bounds;
  if (!bounds) return [];
  const seen = new Set<string>();
  const positions: Array<readonly [number, number, number]> = [];
  const push = (x: number, y: number, z: number) => {
    const key = `${x}:${y}:${z}`;
    if (seen.has(key)) return;
    seen.add(key);
    positions.push([x, y, z]);
  };
  for (let y = math.y0 - 8; y < math.y0; y += 1) {
    for (let x = bounds.xMin; x < bounds.xMax; x += 4) {
      push(x, y, bounds.zMin);
      push(x, y, bounds.zMax - 1);
    }
    for (let z = bounds.zMin; z < bounds.zMax; z += 4) {
      push(bounds.xMin, y, z);
      push(bounds.xMax - 1, y, z);
    }
  }
  return positions;
}

function windowCellsV1(math: GuideBuildingMathV1) {
  const leftStart = math.x0 + Math.max(3, Math.floor(math.width / 4) - 1);
  const rightStart = math.x1 - Math.max(5, Math.floor(math.width / 4) + 2);
  const cells = new Set<string>();
  for (const start of [leftStart, rightStart]) {
    for (let x = start; x < start + 2; x += 1) {
      for (let y = math.y0 + 2; y < math.y0 + 4; y += 1) {
        if (x !== math.doorX) {
          cells.add(`${x}:${y}:${math.z0}`);
        }
      }
    }
  }
  return cells;
}

function addGuideBuildingStructureV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
) {
  const math = guideMathForRecordV1(record);
  const style = record.buildingStyleKit;

  addInstancedGuideBlocksV1(
    group,
    record,
    "guide_foundation_slab",
    "stone_foundation",
    "structure",
    style.foundation,
    rectPositionsV1(math.x0, math.x1, math.y0 - 1, math.z0, math.z1)
  );
  addInstancedGuideBlocksV1(
    group,
    record,
    "guide_retaining_foundation_supports",
    "stone_foundation",
    "structure",
    style.foundation,
    foundationSupportPositionsV1(record, math)
  );
  addInstancedGuideBlocksV1(
    group,
    record,
    "guide_floor_slab",
    "clean_stone_tile",
    "structure",
    style.floor,
    rectPositionsV1(math.x0, math.x1, math.y0, math.z0, math.z1)
  );

  const windowCells = windowCellsV1(math);
  const wallPositions: Array<readonly [number, number, number]> = [];
  for (let y = math.y0 + 1; y < math.wallTop; y += 1) {
    for (let x = math.x0; x < math.x1; x += 1) {
      const isDoor =
        x === math.doorX && (y === math.y0 + 1 || y === math.y0 + 2);
      const key = `${x}:${y}:${math.z0}`;
      if (!isDoor && !windowCells.has(key)) {
        wallPositions.push([x, y, math.z0]);
      }
      wallPositions.push([x, y, math.z1 - 1]);
    }
    for (let z = math.z0; z < math.z1; z += 1) {
      wallPositions.push([math.x0, y, z]);
      wallPositions.push([math.x1 - 1, y, z]);
    }
  }
  addInstancedGuideBlocksV1(
    group,
    record,
    "guide_wall_prefabs",
    "arch_wall_stone",
    "structure",
    style.exteriorWall,
    wallPositions
  );

  const wallHeight = math.wallTop - (math.y0 + 1);
  for (const [x, z] of [
    [math.x0, math.z0],
    [math.x1 - 1, math.z0],
    [math.x0, math.z1 - 1],
    [math.x1 - 1, math.z1 - 1],
  ] as Array<[number, number]>) {
    addBoxV1(
      group,
      record,
      `guide carved corner trim ${x}:${z}`,
      [0.36, wallHeight, 0.36],
      [x + 0.5, math.y0 + 1 + wallHeight / 2, z + 0.5],
      guideMaterialV1(style.trim),
      "guide_corner_trim_posts",
      {
        materialToken: style.trim,
        sourceAssetKey: "arch_wall_stone",
        sourceAssetRole: "structure",
      }
    );
  }

  for (const key of windowCells) {
    const [x, y, z] = key.split(":").map(Number) as [number, number, number];
    addBoxV1(
      group,
      record,
      `large framed shop window stone ${x}:${y}`,
      [1, 1, 0.16],
      [x + 0.5, y + 0.5, z - 0.04],
      guideMaterialV1(style.trim),
      "guide_window_frame",
      {
        materialToken: style.trim,
        sourceAssetKey: "arch_wall_window_stone",
        sourceAssetRole: "structure",
      }
    );
    addBoxV1(
      group,
      record,
      `large framed shop window glass ${x}:${y}`,
      [0.72, 0.72, 0.18],
      [x + 0.5, y + 0.5, z - 0.1],
      guideGlassMaterialV1(),
      "guide_window_glass",
      {
        materialToken: "arch_wall_window_glass",
        sourceAssetKey: "arch_wall_window_glass",
        sourceAssetRole: "structure",
      }
    );
    if (y === math.y0 + 2) {
      addBoxV1(
        group,
        record,
        `large framed shop window sill ${x}:${y}`,
        [0.86, 0.16, 0.28],
        [x + 0.5, y - 0.06, z - 0.16],
        guideMaterialV1(style.trim),
        "guide_window_sill",
        {
          materialToken: style.trim,
          sourceAssetKey: "arch_wall_window_stone",
          sourceAssetRole: "structure",
        }
      );
    }
  }

  addInstancedGuideBlocksV1(
    group,
    record,
    "guide_roof_slab",
    "arch_roof_flat",
    "structure",
    style.roof,
    rectPositionsV1(math.x0, math.x1, math.roofY, math.z0, math.z1)
  );
  for (const [name, size, position] of [
    [
      "front flat roof overhang",
      [math.width + 1, 0.24, 0.48],
      [math.x0 + math.width / 2, math.roofY + 0.88, math.z0 - 0.24],
    ],
    [
      "back flat roof overhang",
      [math.width + 1, 0.24, 0.48],
      [math.x0 + math.width / 2, math.roofY + 0.88, math.z1 + 0.24],
    ],
    [
      "west flat roof overhang",
      [0.48, 0.24, math.depth],
      [math.x0 - 0.24, math.roofY + 0.88, math.z0 + math.depth / 2],
    ],
    [
      "east flat roof overhang",
      [0.48, 0.24, math.depth],
      [math.x1 + 0.24, math.roofY + 0.88, math.z0 + math.depth / 2],
    ],
  ] as Array<[string, [number, number, number], [number, number, number]]>) {
    addBoxV1(
      group,
      record,
      name,
      size,
      position,
      guideMaterialV1(style.roof),
      "guide_roof_overhang_trim",
      {
        materialToken: style.roof,
        sourceAssetKey: "arch_roof_flat",
        sourceAssetRole: "structure",
      }
    );
  }

  addBoxV1(
    group,
    record,
    "wood glass panel door",
    [1, 2, 0.16],
    [math.doorX + 0.5, math.y0 + 2, math.z0 - 0.08],
    guideMaterialV1("warm_wood_plank"),
    "guide_door_prefab",
    {
      materialToken: "warm_wood_plank",
      sourceAssetKey: "arch_wall_wood_door",
      sourceAssetRole: "structure",
    }
  );
  addBoxV1(
    group,
    record,
    "wood glass panel door inset",
    [0.52, 0.76, 0.18],
    [math.doorX + 0.5, math.y0 + 2.25, math.z0 - 0.16],
    guideGlassMaterialV1(),
    "guide_door_glass",
    {
      materialToken: "arch_wall_window_glass",
      sourceAssetKey: "arch_wall_wood_door",
      sourceAssetRole: "structure",
    }
  );
  addBoxV1(
    group,
    record,
    "wide stone doorsill stair",
    [3, 0.5, 1],
    [math.doorX + 0.5, math.y0 + 0.25, math.z0 - 0.5],
    guideMaterialV1(style.trim),
    "guide_wide_stone_stair",
    {
      materialToken: style.trim,
      sourceAssetKey: "arch_stairs_wide_stone",
      sourceAssetRole: "structure",
    }
  );

  if (record.blueprint.footprint.height > 6) {
    addBoxV1(
      group,
      record,
      "wall mounted visual stair",
      [1.2, Math.max(3, math.height - 3), 0.6],
      [math.x1 - 2.2, math.y0 + math.height / 2, math.z0 + 3.5],
      guideMaterialV1(style.trim),
      "guide_internal_wall_stair",
      {
        materialToken: style.trim,
        sourceAssetKey: "obj_wall_stairs",
        sourceAssetRole: "structure",
      }
    );
  }
}

function fixtureMaterialV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  colorHint: HarthmereBusinessOutpostProceduralBuildingRecordV1["interiorFixtures"][number]["colorHint"]
) {
  switch (colorHint) {
    case "accent":
      return guideMaterialV1(record.buildingStyleKit.awningMaterial);
    case "floor":
      return guideMaterialV1(record.buildingStyleKit.floor);
    case "primary":
      return guideMaterialV1(record.buildingStyleKit.trim);
    case "safety":
      return guideGlassMaterialV1();
    case "stock":
      return guideMaterialV1("woodContainer");
    case "trim":
      return guideMaterialV1(record.buildingStyleKit.trim);
    case "wall":
      return guideMaterialV1(record.buildingStyleKit.exteriorWall);
    case "wood":
      return guideMaterialV1("warm_wood_plank");
  }
}

function fixtureSourceAssetKeyV1(
  fixture: HarthmereBusinessOutpostProceduralBuildingRecordV1["interiorFixtures"][number]
) {
  const label = fixture.label.toLowerCase();
  if (fixture.role === "customer_queue_space") return undefined;
  if (fixture.role === "service_counter") return "table_long";
  if (fixture.role === "dashboard_access") return "table_small";
  if (fixture.role === "seating") return "bench_fp";
  if (fixture.role === "primary_station") return fixture.bikkieGraphicId;
  if (/book|blueprint|sample|shelf|rack|larder|pantry|storage|stock/.test(label)) {
    return "shelf_large";
  }
  if (/board|panel|display|meter|gauge|indicator|banner|cabinet|wall/.test(label)) return "cabinet";
  if (/crate|cart|chest|linen|bin/.test(label)) return "crate_wooden_fp";
  if (/candle|lantern|rune|ward|magic|steam|warning|anomaly|light/.test(label))
    return "candle_triple";
  if (/bench/.test(label)) return "bench_fp";
  if (/table|counter|scale|station|plinth|stand|desk/.test(label)) {
    return "table_small";
  }
  return "table_small";
}

function partForFixtureV1(
  role: HarthmereBusinessOutpostProceduralBuildingRecordV1["interiorFixtures"][number]["role"]
) {
  switch (role) {
    case "customer_queue_space":
      return "guide_customer_queue_space";
    case "dashboard_access":
      return "guide_dashboard_access";
    case "primary_station":
      return "guide_primary_station";
    case "service_counter":
      return "guide_service_counter";
    case "seating":
      return "guide_customer_seating";
    case "stock_storage":
      return "guide_stock_storage";
    case "business_decor":
    case "service_table":
    case "workstation":
      return "guide_business_specific_fixture";
  }
}

function addGuideInteriorFixturesV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
) {
  for (const fixture of record.interiorFixtures) {
    const sourceAssetKey = fixtureSourceAssetKeyV1(fixture);
    addBoxV1(
      group,
      record,
      fixture.label,
      [fixture.size[0], fixture.size[1], fixture.size[2]],
      [
        fixture.position.x + 0.5,
        fixture.position.y + fixture.size[1] / 2,
        fixture.position.z + 0.5,
      ],
      fixtureMaterialV1(record, fixture.colorHint),
      partForFixtureV1(fixture.role),
      {
        fixtureId: fixture.fixtureId,
        fixturePosition: fixture.position,
        fixtureSize: fixture.size,
        sourceAssetKey,
        sourceAssetRole: sourceAssetKey?.includes(":") ? "fixture" : "interior",
      }
    );
  }
}

function addGuideJobsBoardV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
) {
  const x = record.jobsBoardPosition.x + 0.5;
  const y = record.jobsBoardPosition.y;
  const z = record.jobsBoardPosition.z + 0.5;
  addBoxV1(
    group,
    record,
    "grounded jobs sign post",
    [0.24, 2.2, 0.24],
    [x - 1, y + 1.1, z],
    guideMaterialV1("warm_wood_plank"),
    "guide_jobs_board",
    {
      materialToken: "warm_wood_plank",
      sourceAssetKey: "obj_sign_post",
      sourceAssetRole: "exterior",
    }
  );
  addBoxV1(
    group,
    record,
    "grounded jobs sign board",
    [2.4, 1.15, 0.18],
    [x, y + 1.55, z],
    guideMaterialV1("warm_wood_plank"),
    "guide_jobs_board",
    {
      materialToken: "warm_wood_plank",
      sourceAssetKey: "obj_sign_post",
      sourceAssetRole: "exterior",
    }
  );
  for (const offset of [-0.55, 0, 0.55]) {
    addBoxV1(
      group,
      record,
      `posted scroll ${offset}`,
      [0.42, 0.48, 0.08],
      [x + offset, y + 1.58 + Math.abs(offset) * 0.08, z - 0.12],
      guideMaterialV1("smallOakSign"),
      "guide_jobs_board_notice",
      {
        materialToken: "smallOakSign",
        sourceAssetKey: "scroll_1_fp",
        sourceAssetRole: "exterior",
      }
    );
  }
}

function addExteriorAssetV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  asset: string,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  materialToken: string
) {
  addBoxV1(
    group,
    record,
    name,
    size,
    position,
    guideMaterialV1(materialToken),
    "guide_exterior_dressing",
    {
      materialToken,
      sourceAssetKey: asset,
      sourceAssetRole: "exterior",
    }
  );
}

function addGuideExteriorDressingV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
) {
  const baseX = record.entrance.x + 0.5;
  const baseY = record.origin.y;
  const baseZ = record.entrance.z + 0.5;
  switch (record.buildingStyleKit.exteriorDressing) {
    case "arcane_lanterns":
      for (const offset of [-3.8, 3.8]) {
        addExteriorAssetV1(
          group,
          record,
          "candle_triple",
          `arcane lantern ${offset}`,
          [0.5, 1.2, 0.5],
          [baseX + offset, baseY + 0.6, baseZ - 1.2],
          record.buildingStyleKit.awningMaterial
        );
      }
      break;
    case "clean_clinic_lanterns":
      for (const offset of [-3.6, 3.6]) {
        addExteriorAssetV1(
          group,
          record,
          "candle_triple",
          `clinic lantern ${offset}`,
          [0.5, 1.0, 0.5],
          [baseX + offset, baseY + 0.5, baseZ - 1.2],
          "white_canvas"
        );
      }
      break;
    case "garden_planters":
      addExteriorAssetV1(
        group,
        record,
        "tree_crooked",
        "left Grove landscape tree",
        [1.4, 2.4, 1.4],
        [baseX - 5.2, baseY + 1.2, baseZ - 0.7],
        "dirt"
      );
      addExteriorAssetV1(
        group,
        record,
        "tree_high",
        "right Grove landscape tree",
        [1.3, 2.8, 1.3],
        [baseX + 5.2, baseY + 1.4, baseZ - 0.7],
        "dirt"
      );
      for (const offset of [-4.1, 4.1]) {
        addExteriorAssetV1(
          group,
          record,
          "rock_small",
          `Grove rock ${offset}`,
          [0.8, 0.35, 0.7],
          [baseX + offset, baseY + 0.18, baseZ - 1.8],
          "stone_foundation"
        );
      }
      break;
    case "market_baskets":
    case "workshop_crates":
      for (const offset of [-4.2, 4.2, 5.4]) {
        addExteriorAssetV1(
          group,
          record,
          "crate_wooden_fp",
          `guide crate ${offset}`,
          [0.95, 0.72, 0.95],
          [baseX + offset, baseY + 0.36, baseZ - 0.6],
          "woodContainer"
        );
      }
      break;
  }
}

function addGuideStyleFrontageV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
) {
  const math = guideMathForRecordV1(record);
  const centerX = math.doorX + 0.5;
  const z = math.z0 - 0.72;
  addBoxV1(
    group,
    record,
    "family awning",
    [Math.min(math.width - 2, 8), 0.34, 1.08],
    [centerX, math.y0 + 3.05, z],
    guideMaterialV1(record.buildingStyleKit.awningMaterial),
    "guide_family_awning",
    {
      materialToken: record.buildingStyleKit.awningMaterial,
      sourceAssetKey: "arch_wall_window_stone",
      sourceAssetRole: "structure",
    }
  );
  addBoxV1(
    group,
    record,
    `family sign ${record.buildingStyleKit.signIcon}`,
    [2.4, 0.65, 0.18],
    [centerX, math.y0 + 3.55, math.z0 - 0.18],
    guideMaterialV1(record.buildingStyleKit.trim),
    "guide_family_sign",
    {
      materialToken: record.buildingStyleKit.trim,
      sourceAssetKey: "obj_sign_post",
      sourceAssetRole: "exterior",
    }
  );
}

export function createHarthmereBusinessOutpostBuildingMeshV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${record.displayName} guide constructed business outpost ${HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1}`;
  group.userData.harthmereBusinessOutpostId = record.outpostId;
  group.userData.harthmereBusinessType = record.businessType;
  group.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  group.userData.sourceOfTruth = record.sourceOfTruth;
  group.userData.generationMode = record.generationMode;
  group.userData.serverOwned = record.serverOwned;
  group.userData.groveReferenceSourceScanVersion =
    record.buildingStyleKit.sourceScanVersion;
  group.userData.groveReferenceSourceFeatures =
    record.buildingStyleKit.sourceFeatureTags;
  group.userData.structuralRendering = "guide_report_math_prefab_construction";
  group.userData.renderedAsCollisionSource = false;

  addGuideBuildingStructureV1(group, record);
  addGuideStyleFrontageV1(group, record);
  addGuideInteriorFixturesV1(group, record);
  addGuideJobsBoardV1(group, record);
  addGuideExteriorDressingV1(group, record);

  return group;
}

export class HarthmereBusinessOutpostBuildingsRendererV1 implements Renderer {
  public readonly name = HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  private readonly root = new THREE.Group();

  constructor() {
    this.root.name = `harthmere-business-outpost-buildings root ${HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1}`;
    const offset = harthmereBusinessOutpostRuntimeOffsetForTestV1();
    for (const record of Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1
    )) {
      const mesh = createHarthmereBusinessOutpostBuildingMeshV1(record);
      mesh.position.set(offset.x, 0, offset.z);
      mesh.userData.harthmereBusinessOutpostRuntimeOffset = offset;
      // The guide mesh is a data/audit proxy only. Real buildings are GLTF
      // assets placed by createHarthmereBlockBuiltServiceBuildingV43 in
      // harthmere_assets.ts via createHarthmereBusinessOutpostPlacementsV1.
      // Making the guide group invisible prevents white proxy boxes from
      // overlapping the GLTF shells while keeping the mesh hierarchy intact
      // for test traversal and the window debug inspector.
      mesh.visible = false;
      this.root.add(mesh);
    }
  }

  draw(scenes: Scenes, _dt: number): void {
    addToScenes(scenes, this.root);
    if (typeof window !== "undefined") {
      (window as any).__harthmereBusinessOutpostBuildingsV1 = {
        version: HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1,
        count: this.root.children.length,
        buildings: () =>
          this.root.children.map((child) => {
            const parts: string[] = [];
            const guideAssets: string[] = [];
            const fixtures: string[] = [];
            child.traverse((part) => {
              const renderedPart = part.userData.harthmereBusinessOutpostPart;
              if (typeof renderedPart === "string") parts.push(renderedPart);
              const asset = part.userData.harthmereGuideSourceAssetKey;
              if (typeof asset === "string") guideAssets.push(asset);
              const fixture = part.userData.harthmereBusinessFixtureId;
              if (typeof fixture === "string") fixtures.push(fixture);
            });
            return {
              outpostId: child.userData.harthmereBusinessOutpostId,
              businessType: child.userData.harthmereBusinessType,
              sourceOfTruth: child.userData.sourceOfTruth,
              structuralRendering: child.userData.structuralRendering,
              parts,
              guideAssets,
              fixtures,
            };
          }),
      };
    }
  }
}

export function makeHarthmereBusinessOutpostBuildingsRendererV1() {
  return new HarthmereBusinessOutpostBuildingsRendererV1();
}
