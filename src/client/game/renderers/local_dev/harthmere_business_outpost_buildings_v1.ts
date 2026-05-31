import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  type HarthmereBusinessOutpostProceduralBuildingRecordV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import * as THREE from "three";

export const HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1 =
  "harthmere-business-outpost-backend-voxel-render-v1" as const;

function harthmereBusinessOutpostRuntimeOffsetXV1() {
  return Number.parseInt(
    process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ??
      process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ??
      "512",
    10,
  );
}

function harthmereBusinessOutpostRuntimeOffsetZV1() {
  return Number.parseInt(
    process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ??
      process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ??
      "0",
    10,
  );
}

function shouldUseHarthmereBusinessOutpostRuntimeOffsetV1() {
  if (
    process.env.NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET === "1" ||
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

const STYLE_MATERIAL_COLORS_V1: Record<string, number> = {
  carved_limestone: 0xc9c0ad,
  clean_stone_tile: 0x8f969b,
  dark_workshop_stone: 0x59616a,
  green_roof_sod: 0x4e7c43,
  polished_glass: 0xa8d9e8,
  purple_canvas: 0x8d43c9,
  red_canvas: 0xb34f47,
  red_clay_roof: 0x8f453c,
  stone_foundation: 0x6f7478,
  warm_wood_plank: 0xb08458,
  white_canvas: 0xe5dcc8,
  wood_floor: 0xc39a61,
};

function styleMaterialColorV1(
  material: keyof typeof STYLE_MATERIAL_COLORS_V1 | string | undefined,
  fallback: number,
) {
  return material ? STYLE_MATERIAL_COLORS_V1[material] ?? fallback : fallback;
}

function paletteForRecordV1(record: HarthmereBusinessOutpostProceduralBuildingRecordV1) {
  const primary = parseHexColorV1(record.primaryBikkieGraphic?.visual.primaryHex, 0x4b9fd8);
  const accent = parseHexColorV1(record.primaryBikkieGraphic?.visual.accentHex, 0xf5c56d);
  const style = record.buildingStyleKit;
  return {
    foundation: styleMaterialColorV1(style.foundation, 0x6f7478),
    safe_ground: 0x4f7e45,
    floor: styleMaterialColorV1(style.floor, 0xc39a61),
    wall: styleMaterialColorV1(style.exteriorWall, 0xb08458),
    roof: styleMaterialColorV1(style.roof, 0x4e7c43),
    stair: styleMaterialColorV1(style.trim, 0xc9c0ad),
    interior: 0x675a48,
    primary,
    accent,
    trim: styleMaterialColorV1(style.trim, 0x4b3224),
    wallShadow: style.referenceLanguage === "grove_workshop_warehouse" ? 0x39424b : 0x6a5038,
    glass: styleMaterialColorV1("polished_glass", 0xa8d9e8),
    darkWood: 0x4b3224,
    parchment: 0xf1d59c,
  };
}

function materialForLabelV1(
  label: string,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  return new THREE.MeshBasicMaterial({
    color: (palette as Record<string, number>)[label] ?? 0x8f8f8f,
  });
}

function parseHexColorV1(hex: string | undefined, fallback: number) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  return Number.parseInt(hex.slice(1), 16);
}

function solidMatV1(color: number) {
  return new THREE.MeshBasicMaterial({ color });
}

function glassMatV1(color = 0xa8d9e8) {
  return new THREE.MeshBasicMaterial({ color });
}

function addBoxV1(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  part: string,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.harthmereBusinessOutpostPart = part;
  mesh.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  group.add(mesh);
  return mesh;
}

type VoxelPositionV1 = readonly [number, number, number];

function visualLotBoundsForRecordV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const width = record.blueprint.footprint.width;
  const depth = record.blueprint.footprint.depth;
  return {
    xMin: Math.min(record.origin.x - 3, record.entrance.x - 4, record.jobsBoardPosition.x - 3),
    xMax: Math.max(record.origin.x + width + 3, record.entrance.x + 4, record.jobsBoardPosition.x + 3),
    zMin: Math.min(record.origin.z - 5, record.entrance.z - 4, record.jobsBoardPosition.z - 2),
    zMax: Math.max(record.origin.z + depth + 3, record.jobsBoardPosition.z + 2),
  };
}

function withinBoundsV1(
  position: VoxelPositionV1,
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number },
) {
  const [x, , z] = position;
  return x >= bounds.xMin && x <= bounds.xMax && z >= bounds.zMin && z <= bounds.zMax;
}

function visibleVoxelPositionsForLabelV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  label: string,
  positions: readonly VoxelPositionV1[],
) {
  if (label === "safe_ground") {
    return positions.filter((position) =>
      withinBoundsV1(position, visualLotBoundsForRecordV1(record)),
    );
  }

  if (label === "foundation") {
    const visibleFoundationBounds = {
      xMin: record.origin.x - 1,
      xMax: record.origin.x + record.blueprint.footprint.width,
      zMin: record.origin.z - 1,
      zMax: record.origin.z + record.blueprint.footprint.depth,
    };
    return positions.filter((position) =>
      withinBoundsV1(position, visibleFoundationBounds),
    );
  }

  return [...positions];
}

function addVoxelInstancesForLabelV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  label: string,
  positions: readonly VoxelPositionV1[],
) {
  const visiblePositions = visibleVoxelPositionsForLabelV1(record, label, positions);
  if (visiblePositions.length === 0) return;
  const geometry =
    label === "safe_ground"
      ? new THREE.BoxGeometry(1, 0.08, 1)
      : new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(
    geometry,
    materialForLabelV1(label, record),
    visiblePositions.length,
  );
  mesh.name = `${record.displayName} ${label} backend voxel instances`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.harthmereBusinessOutpostId = record.outpostId;
  mesh.userData.harthmereBusinessOutpostPart = label;
  mesh.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  mesh.userData.sourceOfTruth = record.sourceOfTruth;
  mesh.userData.rawBackendVoxelCount = positions.length;
  mesh.userData.visibleBackendVoxelCount = visiblePositions.length;
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < visiblePositions.length; index += 1) {
    const [x, y, z] = visiblePositions[index];
    matrix.makeTranslation(x + 0.5, y + (label === "safe_ground" ? 0.04 : 0.5), z + 0.5);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}

function addSafeZoneOutlineV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  if (!record.materializationPlan.safeZone) return;
  const { xMin, xMax, zMin, zMax } = visualLotBoundsForRecordV1(record);
  const width = Math.max(1, xMax - xMin);
  const depth = Math.max(1, zMax - zMin);
  const xMid = xMin + width / 2;
  const zMid = zMin + depth / 2;
  const y = record.origin.y + 0.08;
  const material = new THREE.MeshBasicMaterial({ color: 0x4f8f68 });
  const rails: Array<{
    side: string;
    size: [number, number, number];
    position: [number, number, number];
  }> = [
    { side: "north", size: [width, 0.16, 0.16], position: [xMid, y, zMin] },
    { side: "south", size: [width, 0.16, 0.16], position: [xMid, y, zMax] },
    { side: "west", size: [0.16, 0.16, depth], position: [xMin, y, zMid] },
    { side: "east", size: [0.16, 0.16, depth], position: [xMax, y, zMid] },
  ];
  for (const { side, size, position } of rails) {
    addBoxV1(
      group,
      `${record.displayName} safe zone ${side} rail`,
      size,
      position,
      material,
      "safe_zone_outline",
    );
  }
}

function addProceduralJobsBoardV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const x = record.jobsBoardPosition.x + 0.5;
  const y = record.jobsBoardPosition.y;
  const z = record.jobsBoardPosition.z + 0.5;
  const wood = new THREE.MeshBasicMaterial({ color: 0x4b3224 });
  const rail = new THREE.MeshBasicMaterial({ color: 0xc08d4e });
  const paper = new THREE.MeshBasicMaterial({ color: 0xf1d59c });
  addBoxV1(group, `${record.displayName} jobs board base`, [2.8, 0.28, 0.7], [x, y + 0.14, z], rail, "procedural_jobs_board");
  addBoxV1(group, `${record.displayName} jobs board left post`, [0.22, 2.3, 0.22], [x - 1.12, y + 1.26, z], wood, "procedural_jobs_board");
  addBoxV1(group, `${record.displayName} jobs board right post`, [0.22, 2.3, 0.22], [x + 1.12, y + 1.26, z], wood, "procedural_jobs_board");
  addBoxV1(group, `${record.displayName} jobs board notice backing`, [2.55, 1.45, 0.18], [x, y + 1.62, z + 0.02], wood, "procedural_jobs_board");
  for (let index = 0; index < 4; index += 1) {
    addBoxV1(
      group,
      `${record.displayName} jobs board posted notice ${index + 1}`,
      [0.44 + (index % 2) * 0.18, 0.48, 0.06],
      [x - 0.78 + index * 0.52, y + 1.66 + (index % 2) * 0.14, z + 0.16],
      paper,
      "procedural_jobs_board_notice",
    );
  }
}

function addCustomerDashboardAndStationV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  const materialForFixture = (
    colorHint: HarthmereBusinessOutpostProceduralBuildingRecordV1["interiorFixtures"][number]["colorHint"],
  ) => new THREE.MeshBasicMaterial({
    color: {
      accent: palette.accent,
      floor: palette.floor,
      primary: palette.primary,
      safety: 0x8ad6ff,
      stock: 0x6f8f61,
      trim: palette.trim,
      wall: palette.wall,
      wood: 0x5a3a25,
    }[colorHint],
  });
  const partForFixture = (
    role: HarthmereBusinessOutpostProceduralBuildingRecordV1["interiorFixtures"][number]["role"],
  ) => {
    switch (role) {
      case "customer_queue_space": return "customer_queue_tile";
      case "dashboard_access": return "inside_business_dashboard_access";
      case "primary_station": return "primary_bikkie_station";
      case "service_counter": return "customer_service_counter";
      case "seating": return "interior_customer_seating";
      case "stock_storage": return "interior_stock_storage";
      case "business_decor":
      case "service_table":
      case "workstation":
        return "interior_business_decor";
    }
  };

  for (const fixture of record.interiorFixtures) {
    const material = materialForFixture(fixture.colorHint);
    const x = fixture.position.x + 0.5;
    const y = fixture.position.y;
    const z = fixture.position.z + 0.5;
    const part = partForFixture(fixture.role);
    if (fixture.role === "dashboard_access") {
      addBoxV1(
        group,
        `${record.displayName} business dashboard glow screen`,
        [fixture.size[0], fixture.size[1] * 0.55, 0.14],
        [x, y + fixture.size[1] * 0.68, z],
        material,
        part,
      );
      addBoxV1(
        group,
        `${record.displayName} business dashboard pedestal`,
        [0.62, 0.62, fixture.size[2]],
        [x, y + 0.31, z],
        materialForFixture("accent"),
        part,
      );
      addBoxV1(
        group,
        `${record.displayName} dashboard access floor cue`,
        [2.0, 0.08, 1.2],
        [x, y + 0.08, z - 0.65],
        materialForFixture("safety"),
        "visible_business_access_point",
      );
      continue;
    }
    const fixtureSize: [number, number, number] = [
      fixture.size[0],
      fixture.size[1],
      fixture.size[2],
    ];
    addBoxV1(
      group,
      `${record.displayName} ${fixture.label}`,
      fixtureSize,
      [x, y + fixture.size[1] / 2, z],
      material,
      part,
    );
    if (fixture.businessSpecific && fixture.role !== "primary_station") {
      addBoxV1(
        group,
        `${record.displayName} ${fixture.label} accent voxel`,
        [Math.min(0.7, fixture.size[0]), 0.28, Math.min(0.7, fixture.size[2])],
        [x, y + fixture.size[1] + 0.18, z],
        materialForFixture("accent"),
        "interior_business_decor_accent",
      );
    }
  }
}

function addWallSeamV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
) {
  addBoxV1(
    group,
    `${record.displayName} ${name}`,
    size,
    position,
    solidMatV1(paletteForRecordV1(record).wallShadow),
    "biomes_style_wall_paneling",
  );
}

function addBiomesStyleShellDetailsV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  const style = record.buildingStyleKit;
  const width = record.blueprint.footprint.width;
  const depth = record.blueprint.footprint.depth;
  const height = record.blueprint.footprint.height;
  const x0 = record.origin.x;
  const z0 = record.origin.z;
  const x1 = x0 + width;
  const z1 = z0 + depth;
  const y0 = record.origin.y;
  const centerX = x0 + width / 2 + 0.5;
  const frontZ = z0 - 0.1;
  const backZ = z1 - 0.9;
  const frontFacadeWidth = width + 0.45;
  const trim = solidMatV1(palette.trim);
  const foundation = solidMatV1(palette.foundation);
  const roof = solidMatV1(palette.roof);
  const wallAccent = solidMatV1(palette.wallShadow);

  addBoxV1(
    group,
    `${record.displayName} visible stone foundation band`,
    [frontFacadeWidth, 0.7, 0.24],
    [centerX, y0 + 0.36, frontZ - 0.04],
    foundation,
    "biomes_style_stone_foundation_band",
  );
  addBoxV1(
    group,
    `${record.displayName} front roof overhang`,
    [frontFacadeWidth + 0.9, 0.34, 1.15],
    [centerX, y0 + height + 0.18, z0 - 0.45],
    roof,
    "biomes_style_roof_overhang",
  );
  addBoxV1(
    group,
    `${record.displayName} front roof fascia`,
    [frontFacadeWidth + 1.0, 0.18, 0.16],
    [centerX, y0 + height - 0.05, z0 - 1.03],
    trim,
    "biomes_style_roof_trim",
  );
  addBoxV1(
    group,
    `${record.displayName} left storefront corner trim`,
    [0.28, Math.max(3.4, height - 1), 0.28],
    [x0 + 0.2, y0 + Math.max(3.4, height - 1) / 2 + 0.65, frontZ],
    trim,
    "biomes_style_storefront_trim",
  );
  addBoxV1(
    group,
    `${record.displayName} right storefront corner trim`,
    [0.28, Math.max(3.4, height - 1), 0.28],
    [x1 + 0.8, y0 + Math.max(3.4, height - 1) / 2 + 0.65, frontZ],
    trim,
    "biomes_style_storefront_trim",
  );

  if (style.exteriorWall === "warm_wood_plank") {
    for (let row = 0; row < 5; row += 1) {
      addWallSeamV1(
        group,
        record,
        `warm plank horizontal seam ${row + 1}`,
        [frontFacadeWidth - 2.2, 0.07, 0.09],
        [centerX, y0 + 1.35 + row * 0.55, frontZ - 0.05],
      );
    }
    for (let x = x0 + 2; x < x1 - 1; x += 3) {
      addWallSeamV1(
        group,
        record,
        `warm plank vertical seam ${x}`,
        [0.07, 2.5, 0.09],
        [x + 0.5, y0 + 2.35, frontZ - 0.06],
      );
    }
  } else {
    for (let x = x0 + 2; x < x1 - 1; x += 3) {
      addWallSeamV1(
        group,
        record,
        `stone tile vertical seam ${x}`,
        [0.06, 3.15, 0.09],
        [x + 0.5, y0 + 2.55, frontZ - 0.06],
      );
    }
    for (let row = 0; row < 4; row += 1) {
      addWallSeamV1(
        group,
        record,
        `stone tile horizontal seam ${row + 1}`,
        [frontFacadeWidth - 1.5, 0.06, 0.09],
        [centerX, y0 + 1.35 + row * 0.78, frontZ - 0.05],
      );
    }
  }

  for (const side of [
    { name: "west", x: x0 - 0.12, z: z0 + depth / 2, size: [0.18, 0.26, depth + 0.2] as [number, number, number] },
    { name: "east", x: x1 + 1.12, z: z0 + depth / 2, size: [0.18, 0.26, depth + 0.2] as [number, number, number] },
    { name: "back", x: centerX, z: backZ, size: [frontFacadeWidth, 0.26, 0.18] as [number, number, number] },
  ]) {
    addBoxV1(
      group,
      `${record.displayName} ${side.name} stone base trim`,
      side.size,
      [side.x, y0 + 0.35, side.z],
      foundation,
      "biomes_style_stone_foundation_band",
    );
  }

  addBoxV1(
    group,
    `${record.displayName} back roof cap`,
    [frontFacadeWidth + 0.6, 0.26, 0.5],
    [centerX, y0 + height + 0.12, z1 - 0.45],
    roof,
    "biomes_style_roof_overhang",
  );
  addBoxV1(
    group,
    `${record.displayName} storefront shadow under awning`,
    [Math.min(width - 2, 8.2), 0.13, 0.13],
    [centerX, y0 + 2.78, z0 - 0.92],
    wallAccent,
    "biomes_style_awning_shadow",
  );
}

function addBiomesStyleInteriorDetailsV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  const x0 = record.origin.x;
  const z0 = record.origin.z;
  const y0 = record.origin.y;
  const width = record.blueprint.footprint.width;
  const depth = record.blueprint.footprint.depth;
  const centerX = x0 + width / 2 + 0.5;
  const centerZ = z0 + depth / 2 + 0.5;
  const floorMat = solidMatV1(paletteForRecordV1(record).floor);
  const rugMat = solidMatV1(palette.accent);
  const trimMat = solidMatV1(palette.trim);
  const wallPanelMat = solidMatV1(palette.wallShadow);

  addBoxV1(
    group,
    `${record.displayName} customer lane floor inlay`,
    [Math.min(5.5, width - 5), 0.06, Math.max(7, depth - 9)],
    [centerX, y0 + 1.03, z0 + Math.max(6, depth / 2)],
    floorMat,
    "biomes_style_interior_floor_zone",
  );
  addBoxV1(
    group,
    `${record.displayName} service rug`,
    [Math.min(5.0, width - 6), 0.07, 2.2],
    [centerX, y0 + 1.08, record.queueNode.z + 0.5],
    rugMat,
    "biomes_style_customer_queue_rug",
  );
  for (let x = x0 + 3; x < x0 + width - 3; x += 4) {
    addBoxV1(
      group,
      `${record.displayName} interior floor seam ${x}`,
      [0.06, 0.08, Math.max(5, depth - 8)],
      [x + 0.5, y0 + 1.12, centerZ],
      trimMat,
      "biomes_style_interior_floor_seam",
    );
  }
  addBoxV1(
    group,
    `${record.displayName} back interior service wall panel`,
    [Math.min(width - 5, 10), 1.2, 0.12],
    [centerX, y0 + 2.65, z0 + depth - 1.12],
    wallPanelMat,
    "biomes_style_interior_wall_panel",
  );
  addBoxV1(
    group,
    `${record.displayName} back interior service wall trim`,
    [Math.min(width - 4, 11), 0.14, 0.14],
    [centerX, y0 + 3.35, z0 + depth - 1.2],
    trimMat,
    "biomes_style_interior_wall_trim",
  );
}

function addScanDerivedGroveReferenceDetailsV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  const x0 = record.origin.x;
  const z0 = record.origin.z;
  const y0 = record.origin.y;
  const width = record.blueprint.footprint.width;
  const depth = record.blueprint.footprint.depth;
  const centerX = x0 + width / 2 + 0.5;
  const stoneMat = solidMatV1(palette.foundation);
  const woodMat = solidMatV1(palette.darkWood);
  const shelfMat = solidMatV1(palette.wallShadow);
  const paperMat = solidMatV1(palette.parchment);
  const accentMat = solidMatV1(palette.accent);
  const leafMat = solidMatV1(0x4f8f55);

  for (const offset of [-6.4, 6.4]) {
    addBoxV1(
      group,
      `${record.displayName} scan-derived low stone boundary wall ${offset}`,
      [4.2, 0.72, 0.34],
      [centerX + offset, y0 + 0.42, z0 - 2.2],
      stoneMat,
      "scan_reference_low_boundary_wall",
    );
  }

  const noticeX = record.jobsBoardPosition.x + 0.5;
  const noticeZ = record.jobsBoardPosition.z - 0.35;
  addBoxV1(
    group,
    `${record.displayName} scan-derived notice post`,
    [0.18, 1.9, 0.18],
    [noticeX - 1.05, y0 + 1.0, noticeZ],
    woodMat,
    "scan_reference_grounded_notice_board",
  );
  addBoxV1(
    group,
    `${record.displayName} scan-derived supported notice board`,
    [2.1, 1.05, 0.16],
    [noticeX, y0 + 1.65, noticeZ],
    woodMat,
    "scan_reference_grounded_notice_board",
  );
  for (const offset of [-0.48, 0.14, 0.66]) {
    addBoxV1(
      group,
      `${record.displayName} scan-derived supported posted notice ${offset}`,
      [0.42, 0.38, 0.06],
      [noticeX + offset, y0 + 1.68 + Math.abs(offset) * 0.08, noticeZ - 0.12],
      paperMat,
      "scan_reference_supported_notice",
    );
  }

  const storageRows = [
    { x: x0 + 2.3, z: z0 + depth * 0.56, side: "west" },
    { x: x0 + width - 1.2, z: z0 + depth * 0.56, side: "east" },
    { x: centerX, z: z0 + depth - 1.35, side: "back" },
  ] as const;
  for (const storage of storageRows) {
    const sideWall = storage.side === "back";
    addBoxV1(
      group,
      `${record.displayName} scan-derived ${storage.side} supported cabinet shelf`,
      sideWall ? [3.0, 1.55, 0.34] : [0.34, 1.55, 2.6],
      [storage.x, y0 + 2.1, storage.z],
      shelfMat,
      "scan_reference_supported_wall_storage",
    );
    for (const rowOffset of [-0.44, 0.44]) {
      addBoxV1(
        group,
        `${record.displayName} scan-derived ${storage.side} supported shelf goods ${rowOffset}`,
        sideWall ? [0.42, 0.32, 0.22] : [0.22, 0.32, 0.42],
        [
          storage.x + (sideWall ? rowOffset : 0),
          y0 + 2.55,
          storage.z + (sideWall ? 0 : rowOffset),
        ],
        accentMat,
        "scan_reference_supported_wall_storage_detail",
      );
    }
  }

  for (const offset of [-2.1, -0.7, 0.7, 2.1]) {
    addBoxV1(
      group,
      `${record.displayName} scan-derived supported counter item ${offset}`,
      [0.42, 0.22, 0.42],
      [record.serviceCounter.x + 0.5 + offset, y0 + 2.05, record.serviceCounter.z + 0.5],
      offset < 0 ? paperMat : accentMat,
      "scan_reference_supported_tabletop_detail",
    );
  }

  for (const offset of [-3.2, 3.2]) {
    addBoxV1(
      group,
      `${record.displayName} scan-derived customer bench seat ${offset}`,
      [2.2, 0.34, 0.78],
      [centerX + offset, y0 + 1.28, z0 + 3.7],
      woodMat,
      "scan_reference_customer_bench",
    );
    addBoxV1(
      group,
      `${record.displayName} scan-derived customer bench back ${offset}`,
      [2.2, 0.82, 0.18],
      [centerX + offset, y0 + 1.72, z0 + 4.02],
      woodMat,
      "scan_reference_customer_bench",
    );
  }

  for (const [index, offset] of [-7.2, 7.2].entries()) {
    addBoxV1(
      group,
      `${record.displayName} scan-derived Grove landscape shrub ${index + 1}`,
      [1.1, 0.74, 1.1],
      [centerX + offset, y0 + 0.48, z0 - 3.35],
      leafMat,
      "scan_reference_landscape_edge",
    );
    addBoxV1(
      group,
      `${record.displayName} scan-derived Grove landscape stone ${index + 1}`,
      [0.72, 0.24, 0.62],
      [centerX + offset * 0.94, y0 + 0.16, z0 - 4.15],
      stoneMat,
      "scan_reference_landscape_edge",
    );
  }
}

function addFacadePolishV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const palette = paletteForRecordV1(record);
  const trim = solidMatV1(palette.trim);
  const accent = solidMatV1(palette.accent);
  const glass = glassMatV1(palette.glass);
  const door = solidMatV1(palette.darkWood);
  const width = record.blueprint.footprint.width;
  const x0 = record.origin.x;
  const z = record.origin.z - 0.06;
  const y0 = record.origin.y;
  const centerX = x0 + width / 2;
  addBoxV1(group, `${record.displayName} front door left jamb`, [0.22, 2.45, 0.16], [centerX - 0.55, y0 + 1.25, z], door, "front_door_accessible");
  addBoxV1(group, `${record.displayName} front door right jamb`, [0.22, 2.45, 0.16], [centerX + 1.55, y0 + 1.25, z], door, "front_door_accessible");
  addBoxV1(group, `${record.displayName} front door lintel`, [2.32, 0.26, 0.16], [centerX + 0.5, y0 + 2.55, z], door, "front_door_accessible");
  addBoxV1(group, `${record.displayName} door threshold highlight`, [3.4, 0.16, 0.18], [centerX + 0.5, y0 + 0.12, z - 0.08], accent, "front_door_accessible");
  addBoxV1(group, `${record.displayName} open wooden door leaf`, [0.16, 2.0, 0.9], [centerX - 0.82, y0 + 1.18, z - 0.58], door, "front_door_open_leaf");
  addBoxV1(group, `${record.displayName} open door glass inset`, [0.08, 0.86, 0.48], [centerX - 0.91, y0 + 1.72, z - 0.58], glass, "front_door_open_leaf_glass");
  for (const offset of [-width * 0.28, width * 0.28]) {
    addBoxV1(group, `${record.displayName} front window`, [1.72, 1.42, 0.12], [centerX + offset + 0.5, y0 + 2.05, z], glass, "front_window");
    addBoxV1(group, `${record.displayName} front window top frame`, [2.02, 0.16, 0.16], [centerX + offset + 0.5, y0 + 2.86, z - 0.02], trim, "front_window_trim");
    addBoxV1(group, `${record.displayName} front window bottom frame`, [2.02, 0.16, 0.16], [centerX + offset + 0.5, y0 + 1.24, z - 0.02], trim, "front_window_trim");
    addBoxV1(group, `${record.displayName} front window center mullion`, [0.12, 1.5, 0.16], [centerX + offset + 0.5, y0 + 2.05, z - 0.03], trim, "front_window_trim");
  }
  const depth = record.blueprint.footprint.depth;
  for (const side of [
    { x: x0 - 0.06, z: record.origin.z + depth * 0.36, rot: "west" },
    { x: x0 + width + 1.06, z: record.origin.z + depth * 0.36, rot: "east" },
    { x: x0 - 0.06, z: record.origin.z + depth * 0.68, rot: "west" },
    { x: x0 + width + 1.06, z: record.origin.z + depth * 0.68, rot: "east" },
  ]) {
    addBoxV1(
      group,
      `${record.displayName} ${side.rot} service window`,
      [0.12, 0.9, 1.2],
      [side.x, y0 + 2.1, side.z],
      glass,
      "side_window",
    );
    addBoxV1(
      group,
      `${record.displayName} ${side.rot} window frame`,
      [0.14, 1.12, 1.46],
      [side.x, y0 + 2.1, side.z],
      trim,
      "side_window_trim",
    );
  }
  addBoxV1(group, `${record.displayName} Bikkie business sign plaque`, [4.2, 0.7, 0.2], [centerX + 0.5, y0 + 3.34, z - 0.08], solidMatV1(palette.darkWood), "business_sign_plaque");
  addBoxV1(group, `${record.displayName} Bikkie business sign icon`, [0.65, 0.46, 0.08], [centerX - 1.15, y0 + 3.36, z - 0.22], accent, "business_sign_icon");
  const awningMat = solidMatV1(styleMaterialColorV1(record.buildingStyleKit.awningMaterial, palette.accent));
  addBoxV1(group, `${record.displayName} front awning`, [Math.min(width - 2, 8.0), 0.34, 1.08], [centerX + 0.5, y0 + 3.02, z - 0.5], awningMat, "front_awning");
  for (const offset of [-2.8, -1.4, 0, 1.4, 2.8]) {
    addBoxV1(group, `${record.displayName} awning stripe ${offset}`, [0.62, 0.38, 1.12], [centerX + 0.5 + offset, y0 + 3.04, z - 0.51], solidMatV1(palette.trim), "front_awning_stripe");
  }
}

function addExteriorBikkiePolishV1(
  group: THREE.Group,
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
) {
  const primary = record.primaryBikkieGraphic;
  const color = parseHexColorV1(primary?.visual.primaryHex, 0xd78a46);
  const accent = parseHexColorV1(primary?.visual.accentHex, 0x8ad6ff);
  const palette = paletteForRecordV1(record);
  const propMat = solidMatV1(color);
  const accentMat = solidMatV1(accent);
  const pathMat = solidMatV1(0x9b764b);
  const stoneMat = solidMatV1(palette.foundation);
  const leafMat = solidMatV1(0x4f8f55);
  const crateMat = solidMatV1(0x76502f);
  const baseX = record.entrance.x + 0.5;
  const baseY = record.origin.y;
  const baseZ = record.entrance.z + 0.5;
  if (record.materializationPlan.safeZone) {
    const { xMin, xMax, zMin, zMax } = visualLotBoundsForRecordV1(record);
    const width = Math.max(1, xMax - xMin);
    const depth = Math.max(1, zMax - zMin);
    addBoxV1(
      group,
      `${record.displayName} front retaining wall`,
      [width, 0.9, 0.32],
      [xMin + width / 2, baseY - 0.25, zMin + 0.12],
      stoneMat,
      "biomes_style_retaining_wall",
    );
    addBoxV1(
      group,
      `${record.displayName} back retaining wall`,
      [width, 0.9, 0.32],
      [xMin + width / 2, baseY - 0.25, zMax - 0.12],
      stoneMat,
      "biomes_style_retaining_wall",
    );
    addBoxV1(
      group,
      `${record.displayName} west retaining wall`,
      [0.32, 0.9, depth],
      [xMin + 0.12, baseY - 0.25, zMin + depth / 2],
      stoneMat,
      "biomes_style_retaining_wall",
    );
    addBoxV1(
      group,
      `${record.displayName} east retaining wall`,
      [0.32, 0.9, depth],
      [xMax - 0.12, baseY - 0.25, zMin + depth / 2],
      stoneMat,
      "biomes_style_retaining_wall",
    );
  }
  addBoxV1(
    group,
    `${record.displayName} customer approach path`,
    [3.2, 0.07, 4.2],
    [baseX, baseY + 0.11, baseZ - 2.0],
    pathMat,
    "biomes_style_customer_path",
  );
  addBoxV1(
    group,
    `${record.displayName} jobs board side path`,
    [5.6, 0.07, 1.15],
    [record.jobsBoardPosition.x - 0.2, baseY + 0.12, record.jobsBoardPosition.z + 0.5],
    pathMat,
    "biomes_style_customer_path",
  );
  for (const offset of [-2.5, 2.5]) {
    addBoxV1(group, `${record.displayName} exterior planter`, [0.9, 0.48, 0.9], [baseX + offset, baseY + 0.24, baseZ], propMat, "exterior_bikkie_improvement");
    addBoxV1(group, `${record.displayName} exterior bright voxel bloom`, [0.52, 0.62, 0.52], [baseX + offset, baseY + 0.8, baseZ], accentMat, "exterior_bikkie_improvement");
  }
  if (record.buildingStyleKit.exteriorDressing === "workshop_crates") {
    for (const [index, offset] of [-4.2, 4.2, 5.35].entries()) {
      addBoxV1(
        group,
        `${record.displayName} practical exterior crate ${index + 1}`,
        [0.95, 0.72, 0.95],
        [baseX + offset, baseY + 0.38, baseZ - 0.25 - index * 0.35],
        crateMat,
        "exterior_bikkie_improvement",
      );
    }
  } else if (record.buildingStyleKit.exteriorDressing === "arcane_lanterns") {
    for (const offset of [-3.8, 3.8]) {
      addBoxV1(
        group,
        `${record.displayName} arcane lantern post ${offset}`,
        [0.16, 1.8, 0.16],
        [baseX + offset, baseY + 0.9, baseZ - 0.9],
        solidMatV1(palette.darkWood),
        "exterior_bikkie_improvement",
      );
      addBoxV1(
        group,
        `${record.displayName} arcane lantern glow ${offset}`,
        [0.48, 0.58, 0.48],
        [baseX + offset, baseY + 1.95, baseZ - 0.9],
        accentMat,
        "exterior_bikkie_improvement",
      );
    }
  } else {
    for (const offset of [-4.1, 4.1]) {
      addBoxV1(
        group,
        `${record.displayName} leafy exterior shrub ${offset}`,
        [1.0, 0.8, 1.0],
        [baseX + offset, baseY + 0.58, baseZ - 0.5],
        leafMat,
        "exterior_bikkie_improvement",
      );
    }
  }
  addBoxV1(group, `${record.displayName} entrance welcome mat`, [3.2, 0.08, 1.2], [baseX, baseY + 0.08, baseZ - 0.8], accentMat, "visible_business_access_point");
}

export function createHarthmereBusinessOutpostBuildingMeshV1(
  record: HarthmereBusinessOutpostProceduralBuildingRecordV1,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${record.displayName} backend procedural business outpost ${HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1}`;
  group.userData.harthmereBusinessOutpostId = record.outpostId;
  group.userData.harthmereBusinessType = record.businessType;
  group.userData.harthmereBusinessOutpostRenderVersion =
    HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  group.userData.sourceOfTruth = record.sourceOfTruth;
  group.userData.generationMode = record.generationMode;
  group.userData.serverOwned = record.serverOwned;
  group.userData.groveReferenceSourceScanVersion = record.buildingStyleKit.sourceScanVersion;
  group.userData.groveReferenceSourceFeatures = record.buildingStyleKit.sourceFeatureTags;

  const positionsByLabel = new Map<string, Array<readonly [number, number, number]>>();
  for (const edit of record.materializationPlan.edits) {
    const list = positionsByLabel.get(edit.label) ?? [];
    list.push(edit.position);
    positionsByLabel.set(edit.label, list);
  }
  for (const [label, positions] of positionsByLabel) {
    addVoxelInstancesForLabelV1(group, record, label, positions);
  }

  addSafeZoneOutlineV1(group, record);
  addBiomesStyleShellDetailsV1(group, record);
  addFacadePolishV1(group, record);
  addBiomesStyleInteriorDetailsV1(group, record);
  addScanDerivedGroveReferenceDetailsV1(group, record);
  addCustomerDashboardAndStationV1(group, record);
  addProceduralJobsBoardV1(group, record);
  addExteriorBikkiePolishV1(group, record);

  const light = new THREE.PointLight(0xffe3a3, 0.9, 14, 1.6);
  light.name = `${record.displayName} warm business doorway light`;
  light.position.set(record.entrance.x + 0.5, record.origin.y + 3.1, record.entrance.z + 0.5);
  light.userData.harthmereBusinessOutpostPart = "doorway_light";
  group.add(light);

  return group;
}

export class HarthmereBusinessOutpostBuildingsRendererV1 implements Renderer {
  public readonly name = HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1;
  private readonly root = new THREE.Group();

  constructor() {
    this.root.name = `harthmere-business-outpost-buildings root ${HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1}`;
    const offset = harthmereBusinessOutpostRuntimeOffsetForTestV1();
    for (const record of Object.values(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1)) {
      const mesh = createHarthmereBusinessOutpostBuildingMeshV1(record);
      mesh.position.set(offset.x, 0, offset.z);
      mesh.userData.harthmereBusinessOutpostRuntimeOffset = offset;
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
          this.root.children.map((child) => ({
            outpostId: child.userData.harthmereBusinessOutpostId,
            businessType: child.userData.harthmereBusinessType,
            sourceOfTruth: child.userData.sourceOfTruth,
            parts: child.children.map((part) => part.userData.harthmereBusinessOutpostPart).filter(Boolean),
          })),
      };
    }
  }
}

export function makeHarthmereBusinessOutpostBuildingsRendererV1() {
  return new HarthmereBusinessOutpostBuildingsRendererV1();
}
