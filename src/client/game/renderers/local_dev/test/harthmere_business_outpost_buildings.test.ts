/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  createHarthmereBusinessOutpostBuildingMesh,
  harthmereBusinessOutpostRuntimeOffsetForTest,
  HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION,
  makeHarthmereBusinessOutpostBuildingsRenderer,
} from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings";
import {
  createHarthmereBusinessOutpostInteriorDecorSpecs,
  HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_COLLISION,
  HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_VERSION,
} from "@/shared/harthmere/business_outpost_visual_decor";
import { createNewScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  harthmereBusinessOutpostGroundY,
  type HarthmereBusinessOutpostProceduralBuildingRecord,
} from "@/shared/harthmere/business_customer_simulator";
import * as THREE from "three";

const STRUCTURAL_RENDERING = "guide_report_math_prefab_construction";

const GUIDE_STRUCTURE_ASSETS = new Set([
  "arch_wall_stone",
  "arch_wall_window_stone",
  "arch_wall_window_glass",
  "arch_wall_wood_door",
  "arch_roof_flat",
  "arch_stairs_wide_stone",
  "obj_wall_stairs",
  "stone_foundation",
  "clean_stone_tile",
]);

const GUIDE_INTERIOR_ASSETS = new Set([
  "table_small",
  "table_medium",
  "table_long",
  "chair",
  "stool_fp",
  "bench_fp",
  "bed_twin1",
  "nightstand",
  "cabinet",
  "bookcase_2",
  "rack",
  "shelf_large",
  "shelf_small_bottles",
  "book_stack_2",
  "candle_triple",
  "obj_lamp_ground_small",
  "crate_wooden_fp",
  "chest",
]);

const GUIDE_EXTERIOR_ASSETS = new Set([
  "obj_sign_post",
  "scroll_1_fp",
  "logs",
  "rock_small",
  "tree_crooked",
  "tree_high",
]);

const GUIDE_MATERIAL_TOKENS = new Set([
  "arch_wall_window_glass",
  "carved_limestone",
  "clean_stone_tile",
  "cobblestone",
  "dark_workshop_stone",
  "dirt",
  "green_roof_sod",
  "oakLog",
  "purple_canvas",
  "red_canvas",
  "red_clay_roof",
  "smallOakSign",
  "stone",
  "stone_foundation",
  "warm_wood_plank",
  "white_canvas",
  "woodContainer",
  "wood_floor",
  "woodenStepper",
]);

const LEGACY_RENDER_PARTS = new Set([
  "foundation",
  "floor",
  "wall",
  "roof",
  "stair",
  "frame",
  "interior",
  "safe_ground",
  "storage_container",
  "business_marker",
  "safe_zone_outline",
  "biomes_style_stone_foundation_band",
  "biomes_style_wall_paneling",
  "biomes_style_roof_overhang",
  "front_door_accessible",
  "front_door_open_leaf",
  "front_door_open_leaf_glass",
  "business_sign_plaque",
  "business_sign_icon",
  "front_awning",
  "front_awning_stripe",
  "front_window",
  "front_window_trim",
  "side_window",
  "side_window_trim",
  "scan_reference_low_boundary_wall",
  "biomes_style_retaining_wall",
  "biomes_style_customer_path",
  "inside_business_dashboard_access",
  "primary_bikkie_station",
  "interior_business_decor",
  "interior_business_decor_accent",
  "procedural_jobs_board",
  "visible_business_access_point",
  "exterior_bikkie_improvement",
]);

const EXPECTED_OUTPOSTS = [
  [
    "outpost_refinery_ashline",
    "Ashline Containment Works",
    "exotic_matter_refinery",
    "npc_outpost_ashline_foreman",
  ],
  [
    "outpost_biome_repair_north",
    "North Anchor Repair Shed",
    "biome_maintenance_repair",
    "npc_outpost_anchorwright",
  ],
  [
    "outpost_design_glassyard",
    "Glassyard Biome Studio",
    "biome_design_studio",
    "npc_outpost_glassyard_designer",
  ],
  [
    "outpost_security_redoubt",
    "Redoubt Contract Yard",
    "security_defense_contractor",
    "npc_outpost_redoubt_captain",
  ],
  [
    "outpost_portal_eastgate",
    "Eastgate Portal Office",
    "portal_transit_company",
    "npc_outpost_eastgate_operator",
  ],
  [
    "outpost_rare_foods_southplot",
    "Southplot Rare Foods",
    "biome_farming_rare_foods",
    "npc_outpost_southplot_grower",
  ],
  [
    "outpost_tools_cinderlane",
    "Cinderlane Tool Forge",
    "weapons_tools",
    "npc_outpost_cinderlane_smith",
  ],
  [
    "outpost_magic_moonstall",
    "Moonstall Ward Shop",
    "magic_goods",
    "npc_outpost_moonstall_warder",
  ],
  [
    "outpost_exploration_westtrail",
    "Westtrail Guide Table",
    "exploration_guide",
    "npc_outpost_westtrail_guide",
  ],
  [
    "outpost_property_keylot",
    "Keylot Property Office",
    "custom_home_property_development",
    "npc_outpost_keylot_builder",
  ],
  [
    "outpost_trader_brightcart",
    "Brightcart General House",
    "general_trader",
    "npc_outpost_brightcart_trader",
  ],
  [
    "outpost_hunter_ridgecooler",
    "Ridgecooler Larder",
    "hunter_wild_meat",
    "npc_outpost_ridgecooler_hunter",
  ],
  [
    "outpost_clinic_greenlamp",
    "Greenlamp Walk-In Clinic",
    "medical_doctor",
    "npc_outpost_greenlamp_doctor",
  ],
  [
    "outpost_teleport_returnstone",
    "Returnstone Pad Office",
    "teleport_owner",
    "npc_outpost_returnstone_keeper",
  ],
  [
    "outpost_sanitation_clearbarrel",
    "Clearbarrel Cleanup Yard",
    "waste_sanitation_cleanup",
    "npc_outpost_clearbarrel_boss",
  ],
  [
    "outpost_repair_hingehall",
    "Hingehall Repair Shop",
    "repair_maintenance_person",
    "npc_outpost_hingehall_fixer",
  ],
  [
    "outpost_restaurant_redpot",
    "Redpot Service Kitchen",
    "food_service_restaurant",
    "npc_outpost_redpot_cook",
  ],
  [
    "outpost_courier_stampspur",
    "Stampspur Courier Office",
    "courier",
    "npc_outpost_stampspur_dispatcher",
  ],
  [
    "outpost_hospitality_lanternrest",
    "Lanternrest Road Inn",
    "hospitality_inn_hotel_shelter",
    "npc_outpost_lanternrest_host",
  ],
] as const;

function guideMathForTest(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const { width, depth, height } = record.blueprint.footprint;
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

function windowCellsForTest(math: ReturnType<typeof guideMathForTest>) {
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

function supportCountForTest(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  math: ReturnType<typeof guideMathForTest>
) {
  const bounds = record.materializationPlan.safeZone?.bounds;
  assert.ok(bounds, `${record.outpostId} needs safe-zone bounds`);
  const seen = new Set<string>();
  const push = (x: number, y: number, z: number) => {
    seen.add(`${x}:${y}:${z}`);
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
  return seen.size;
}

function wallCountForTest(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const math = guideMathForTest(record);
  const wallHeight = math.wallTop - (math.y0 + 1);
  const wallsWithDuplicatedCorners =
    wallHeight * (math.width * 2 + math.depth * 2);
  const doorwayGap = 2;
  return (
    wallsWithDuplicatedCorners - doorwayGap - windowCellsForTest(math).size
  );
}

function firstMaterialForTest(child: THREE.Object3D) {
  if (!(child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh)) {
    return undefined;
  }
  return Array.isArray(child.material) ? child.material[0] : child.material;
}

function collectRenderAudit(mesh: THREE.Group) {
  const partCounts = new Map<string, number>();
  const instanceCounts = new Map<string, number>();
  const assets = new Set<string>();
  const materialTokens = new Set<string>();
  const sourceRoles = new Set<string>();
  const childrenByPart = new Map<string, THREE.Object3D[]>();
  const fixtures = new Map<string, THREE.Object3D>();

  mesh.traverse((child) => {
    const part = child.userData.harthmereBusinessOutpostPart;
    if (typeof part === "string") {
      partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
      childrenByPart.set(part, [...(childrenByPart.get(part) ?? []), child]);
      if (child instanceof THREE.InstancedMesh) {
        instanceCounts.set(
          part,
          Number(child.userData.harthmereGuideInstanceCount ?? child.count)
        );
      }
    }

    const asset = child.userData.harthmereGuideSourceAssetKey;
    if (typeof asset === "string") assets.add(asset);
    const role = child.userData.harthmereGuideSourceAssetRole;
    if (typeof role === "string") sourceRoles.add(role);
    const fixture = child.userData.harthmereBusinessFixtureId;
    if (typeof fixture === "string") fixtures.set(fixture, child);

    const material = firstMaterialForTest(child);
    if (material) {
      const childToken = child.userData.harthmereGuideMaterialToken;
      const materialToken = material.userData.harthmereGuideMaterialToken;
      if (typeof childToken === "string") materialTokens.add(childToken);
      if (typeof materialToken === "string") materialTokens.add(materialToken);
      assert.equal(
        child.frustumCulled,
        false,
        `${child.name} should stay visible near the player`
      );
      assert.equal(
        material instanceof THREE.MeshBasicMaterial,
        true,
        `${child.name} should use unlit material`
      );
      assert.equal(
        material.map instanceof THREE.DataTexture,
        true,
        `${child.name} should render guide voxel tiling instead of a flat color`
      );
    }
  });

  return {
    assets,
    childrenByPart,
    fixtures,
    instanceCounts,
    materialTokens,
    partCounts,
    sourceRoles,
  };
}

function materialTokenForPart(
  audit: ReturnType<typeof collectRenderAudit>,
  part: string
) {
  const child = audit.childrenByPart.get(part)?.[0];
  assert.ok(child, `missing ${part}`);
  const material = firstMaterialForTest(child);
  assert.ok(material, `${part} must have a material`);
  return {
    childToken: child.userData.harthmereGuideMaterialToken,
    materialToken: material.userData.harthmereGuideMaterialToken,
  };
}

describe("Harthmere business outpost guide renderer current", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "../harthmere_assets.ts"),
    "utf8"
  );

  it("does not place visible guide proxy boxes — real buildings come from server voxel materialization", () => {
    // This test was added after the guide renderer was changed to visible=false.
    // Keeping it here ensures nobody re-enables the white boxes without noticing.
    const renderer = makeHarthmereBusinessOutpostBuildingsRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = scenes.three.children.find((c) =>
      c.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)
    );
    for (const child of root?.children ?? []) {
      assert.equal(
        child.visible,
        false,
        `${child.name} white proxy box must stay invisible`
      );
    }
  });

  it("builds every outpost at its terrain-pad ground Y, not at the Grove's 53.05 base", () => {
    const {
      harthmereBusinessOutpostGroundY,
    } = require("@/shared/harthmere/business_customer_simulator");
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const groundY: number = harthmereBusinessOutpostGroundY(outpost);
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      // The procedural building record's origin.y must equal the terrain-pad Y.
      assert.equal(
        record.origin.y,
        groundY,
        `${outpost.outpostId} origin.y must be terrain-pad ${groundY}, not Grove 53.05`
      );
      // Production captures span cliffs, lowlands, and shoreline pads; the
      // renderer should honor each captured Y instead of flattening them.
      assert.ok(
        Number.isFinite(groundY) && groundY >= 0,
        `${outpost.outpostId} ground Y=${groundY} must be a captured production pad height`
      );
    }
  });

  it("keeps the 19 requested businesses and owner NPCs unchanged", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    assert.equal(
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length,
      19
    );

    for (const [
      outpostId,
      displayName,
      businessType,
      ownerNpcId,
    ] of EXPECTED_OUTPOSTS) {
      const outpost = HARTHMERE_BUSINESS_OUTPOSTS.find(
        (candidate) => candidate.outpostId === outpostId
      );
      assert.ok(outpost, `${outpostId} must exist`);
      assert.equal(outpost.displayName, displayName);
      assert.equal(outpost.businessType, businessType);
      assert.equal(outpost.ownerNpcId, ownerNpcId);
      assert.ok(
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpostId],
        `${outpostId} must have a procedural building record`
      );
    }
  });

  it("places the owner NPC and visual-only furniture while boards are drawn by the dedicated procedural renderer", () => {
    const start = SOURCE.indexOf(
      "function createHarthmereBusinessOutpostPlacements()"
    );
    const end = SOURCE.indexOf("function row(", start);
    assert.ok(
      start >= 0 && end > start,
      "business outpost placement helper must remain auditable"
    );
    const body = SOURCE.slice(start, end);

    // Must NOT use GLTF building shell helper — buildings are voxel blocks.
    assert.equal(
      body.includes("createHarthmereBlockBuiltServiceBuilding"),
      false,
      "must not use GLTF shell helper — business buildings are server-materialized voxels"
    );
    // Must NOT use legacy floating props at Grove GROUND_Y.
    for (const banned of [
      '"table_medium"',
      '"scroll_1_fp"',
      '"obj_sign_post"',
      "renderLocalScaffolds",
    ]) {
      assert.equal(
        body.includes(banned),
        false,
        `must not emit legacy floating ${banned}`
      );
    }
    assert.equal(
      body.includes('"obj_kiosk"'),
      false,
      "business boards must not use filtered OBJ kiosk runtime placements"
    );
    assert.equal(
      body.includes("BIG BUSINESS BOARD"),
      false,
      "business boards must come from the procedural marker renderer, not the runtime placement list"
    );
    assert.ok(
      body.includes("createHarthmereBusinessOutpostInteriorDecorPlacements"),
      "business outposts must add real runtime furniture/decor placements after the server voxel shell"
    );
    // Must still place the owner NPC with proper cosmetics.
    assert.ok(
      body.includes(
        "appearance: harthmereBusinessOutpostStaffAppearance(outpost)"
      ),
      "staff NPC must carry the shared Grove/townsperson cosmetic appearance schema"
    );
    assert.ok(
      SOURCE.includes("@/shared/harthmere/business_npc_cosmetics"),
      "business outpost staff cosmetics must live in the shared Grove business NPC helper"
    );
    assert.equal(
      SOURCE.includes("harthmere-business-outpost-procedural-staff"),
      false,
      "must not use the old outpost-only appearance source"
    );
    assert.ok(
      SOURCE.includes(
        "HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId]"
      ),
      "staff NPC must anchor to the procedural voxel building record"
    );
    assert.ok(
      SOURCE.includes("record.serviceCounter.x + 4") &&
        SOURCE.includes("record.serviceCounter.z + 1"),
      "staff NPC must stand at a clear interior work point near the service counter"
    );
    assert.ok(
      body.includes("inside business staff NPC") &&
        body.includes('lodTier = "always"'),
      "staff NPC must be an always-visible inside-business placement"
    );
  });

  it("renders passable real furniture/decor placements for all 19 business interiors", () => {
    const polishedInteriorAssets = new Set([
      "anvil_fp",
      "barrel_apples",
      "barrel_fp",
      "barrel_holder_fp",
      "bed_twin1",
      "bed_twin2",
      "bench_fp",
      "book_group_1",
      "book_group_2",
      "book_stack_1",
      "book_stack_2",
      "bookcase_2",
      "bookstand_fp",
      "bucket_wood",
      "cabinet",
      "cauldron_fp",
      "crate_wooden_fp",
      "farmcrate_carrot",
      "lantern_wall_fp",
      "mug_fp",
      "potion_2_fp",
      "shelf_small_bottles",
      "stool_fp",
      "table_large_fp",
      "weaponstand_fp",
      "whetstone_fp",
      "workbench_drawers_fp",
    ]);

    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      const specs = createHarthmereBusinessOutpostInteriorDecorSpecs(record);
      const nonQueueFixtures = record.interiorFixtures.filter(
        (fixture) => fixture.role !== "customer_queue_space"
      );
      assert.ok(
        specs.length >= nonQueueFixtures.length,
        `${record.outpostId} must render at least one real prop for every non-queue interior fixture`
      );
      assert.ok(
        new Set(specs.map((spec) => spec.asset)).size >= 5,
        `${record.outpostId} must use a varied asset mix, not one repeated block-like prop`
      );
      for (const spec of specs) {
        assert.equal(
          polishedInteriorAssets.has(spec.asset),
          true,
          `${record.outpostId} uses non-polished interior asset ${spec.asset}`
        );
        assert.equal(spec.scale > 0, true);
        assert.ok(spec.support);
        assert.equal(
          HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_COLLISION.category,
          "none"
        );
        assert.equal(
          HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_COLLISION.blocksPlayer,
          false
        );
        assert.equal(
          HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_COLLISION.blocksNpc,
          false
        );
        assert.ok(
          HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_VERSION.includes(
            "visual-prop-interiors"
          )
        );
      }
    }

    const repairRecord =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[
        "outpost_repair_hingehall"
      ];
    assert.ok(
      createHarthmereBusinessOutpostInteriorDecorSpecs(repairRecord).some(
        (spec) => spec.asset === "workbench_drawers_fp"
      ),
      "Hingehall Repair Shop must render an actual workbench model"
    );
    const restaurantRecord =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[
        "outpost_restaurant_redpot"
      ];
    assert.ok(
      createHarthmereBusinessOutpostInteriorDecorSpecs(restaurantRecord).some(
        (spec) =>
          spec.asset === "cauldron_fp" ||
          spec.asset === "barrel_apples" ||
          spec.asset === "farmcrate_carrot"
      ),
      "Redpot restaurant must render food/kitchen props instead of voxel counters"
    );
    const sanitationRecord =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[
        "outpost_sanitation_clearbarrel"
      ];
    assert.ok(
      createHarthmereBusinessOutpostInteriorDecorSpecs(sanitationRecord).some(
        (spec) =>
          spec.asset === "bucket_wood" || spec.asset === "barrel_holder_fp"
      ),
      "Clearbarrel cleanup yard must render cleanup props instead of block stacks"
    );
  });

  it("renders guide-built structures from the report math instead of the old visible backend mesh", () => {
    for (const record of Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
    )) {
      const mesh = createHarthmereBusinessOutpostBuildingMesh(record);
      assert.equal(
        mesh.userData.harthmereBusinessOutpostRenderVersion,
        HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION
      );
      assert.equal(
        mesh.userData.sourceOfTruth,
        "backend_procedural_voxel_building"
      );
      assert.equal(mesh.userData.serverOwned, true);
      assert.equal(
        mesh.userData.structuralRendering,
        STRUCTURAL_RENDERING,
        `${record.outpostId} must use guide report construction math`
      );
      assert.equal(mesh.userData.renderedAsCollisionSource, false);

      const audit = collectRenderAudit(mesh);
      for (const legacyPart of LEGACY_RENDER_PARTS) {
        assert.equal(
          audit.partCounts.has(legacyPart),
          false,
          `${record.outpostId} must not draw legacy renderer part ${legacyPart}`
        );
      }
      assert.equal(
        audit.sourceRoles.has("shell"),
        false,
        `${record.outpostId} must not tag visible assets with the removed structure role`
      );

      mesh.traverse((child) => {
        assert.equal(
          "rawBackendVoxelCount" in child.userData,
          false,
          `${child.name} must not expose raw backend visual voxel counts`
        );
        assert.equal(
          "visibleBackendVoxelCount" in child.userData,
          false,
          `${child.name} must not expose trimmed backend visual voxel counts`
        );
      });

      for (const requiredGuidePart of [
        "guide_foundation_slab",
        "guide_retaining_foundation_supports",
        "guide_floor_slab",
        "guide_wall_prefabs",
        "guide_corner_trim_posts",
        "guide_window_frame",
        "guide_window_glass",
        "guide_window_sill",
        "guide_roof_slab",
        "guide_roof_overhang_trim",
        "guide_door_prefab",
        "guide_door_glass",
        "guide_wide_stone_stair",
        "guide_family_awning",
        "guide_family_sign",
        "guide_jobs_board",
        "guide_jobs_board_notice",
        "guide_customer_queue_space",
        "guide_service_counter",
        "guide_dashboard_access",
        "guide_primary_station",
        "guide_business_specific_fixture",
      ]) {
        assert.ok(
          audit.partCounts.has(requiredGuidePart),
          `${record.outpostId} must draw guide part ${requiredGuidePart}`
        );
      }

      const math = guideMathForTest(record);
      assert.equal(
        audit.instanceCounts.get("guide_foundation_slab"),
        math.width * math.depth,
        `${record.outpostId} foundation slab must match footprint math`
      );
      assert.equal(
        audit.instanceCounts.get("guide_floor_slab"),
        math.width * math.depth,
        `${record.outpostId} floor slab must match footprint math`
      );
      assert.equal(
        audit.instanceCounts.get("guide_roof_slab"),
        math.width * math.depth,
        `${record.outpostId} roof slab must match footprint math`
      );
      assert.equal(
        audit.instanceCounts.get("guide_wall_prefabs"),
        wallCountForTest(record),
        `${record.outpostId} walls must follow the centered doorway and window swap math`
      );
      assert.equal(
        audit.instanceCounts.get("guide_retaining_foundation_supports"),
        supportCountForTest(record, math),
        `${record.outpostId} supports must follow the every-four-voxels plot perimeter math`
      );

      for (const requiredAsset of [
        "stone_foundation",
        "clean_stone_tile",
        "arch_wall_stone",
        "arch_wall_window_stone",
        "arch_wall_window_glass",
        "arch_wall_wood_door",
        "arch_roof_flat",
        "arch_stairs_wide_stone",
        "obj_sign_post",
        "scroll_1_fp",
        "table_long",
        "table_small",
      ]) {
        assert.ok(
          audit.assets.has(requiredAsset),
          `${record.outpostId} must use guide asset ${requiredAsset}`
        );
      }
      if (record.blueprint.footprint.height > 6) {
        assert.ok(
          audit.assets.has("obj_wall_stairs"),
          `${record.outpostId} multi-level visual must use the guide wall stair asset`
        );
      }
      assert.equal(
        audit.assets.has("crate_wooden_fp"),
        false,
        `${record.outpostId} guide furniture should render as shelves, cabinets, counters, lamps, and seating, not crate assets`
      );

      for (const asset of audit.assets) {
        const isAllowedGuideAsset =
          GUIDE_STRUCTURE_ASSETS.has(asset) ||
          GUIDE_INTERIOR_ASSETS.has(asset) ||
          GUIDE_EXTERIOR_ASSETS.has(asset) ||
          record.interiorFixtures.some(
            (fixture) => fixture.bikkieGraphicId === asset
          );
        assert.equal(
          isAllowedGuideAsset,
          true,
          `${record.outpostId} uses non-guide asset ${asset}`
        );
      }
      for (const materialToken of audit.materialTokens) {
        assert.equal(
          GUIDE_MATERIAL_TOKENS.has(materialToken),
          true,
          `${record.outpostId} uses non-guide material ${materialToken}`
        );
      }

      for (const [part, expectedToken] of [
        ["guide_foundation_slab", record.buildingStyleKit.foundation],
        [
          "guide_retaining_foundation_supports",
          record.buildingStyleKit.foundation,
        ],
        ["guide_floor_slab", record.buildingStyleKit.floor],
        ["guide_wall_prefabs", record.buildingStyleKit.exteriorWall],
        ["guide_roof_slab", record.buildingStyleKit.roof],
      ] as const) {
        const tokens = materialTokenForPart(audit, part);
        assert.equal(tokens.childToken, expectedToken);
        assert.equal(tokens.materialToken, expectedToken);
      }

      assert.ok(
        record.interiorFixtures.length >= 8,
        `${record.outpostId} must publish queue, counter, dashboard, station, and a bespoke business-specific decor set`
      );
      for (const fixture of record.interiorFixtures) {
        const rendered = audit.fixtures.get(fixture.fixtureId);
        assert.ok(
          rendered,
          `${record.outpostId} must render ${fixture.fixtureId}`
        );
        assert.deepEqual(
          rendered!.userData.harthmereBusinessFixturePosition,
          fixture.position,
          `${fixture.fixtureId} must keep the report-derived position`
        );
        assert.deepEqual(
          rendered!.userData.harthmereBusinessFixtureSize,
          [...fixture.size],
          `${fixture.fixtureId} must keep the report-derived size`
        );
      }

      switch (record.buildingStyleKit.exteriorDressing) {
        case "arcane_lanterns":
        case "clean_clinic_lanterns":
          assert.ok(audit.assets.has("candle_triple"));
          break;
        case "garden_planters":
          assert.ok(audit.assets.has("tree_crooked"));
          assert.ok(audit.assets.has("tree_high"));
          assert.ok(audit.assets.has("rock_small"));
          break;
        case "market_baskets":
        case "workshop_crates":
          assert.ok(audit.assets.has("shelf_large"));
          assert.ok(audit.assets.has("logs"));
          break;
      }
    }
  });

  it("keeps guide building coordinates grounded and derived from production locations", () => {
    const groundYs = new Set<number>();
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      const width = record.blueprint.footprint.width;
      const depth = record.blueprint.footprint.depth;
      const expectedGroundY = harthmereBusinessOutpostGroundY(outpost);
      groundYs.add(expectedGroundY);
      const expectedOrigin = {
        x: Math.round(outpost.position.x - width / 2),
        y: expectedGroundY,
        z: Math.round(outpost.position.z - depth / 2),
      };
      assert.deepEqual(
        record.origin,
        expectedOrigin,
        `${outpost.outpostId} must keep its production XZ and terrain-derived Y origin`
      );
      assert.equal(record.terrainGrounding.padGroundY, expectedGroundY);
      assert.equal(record.terrainGrounding.maxTerrainY, expectedGroundY);
      assert.ok(record.terrainGrounding.samples.length >= 6);
      const doorX = record.origin.x + Math.floor(width / 2);
      assert.equal(record.entrance.x, doorX);
      assert.equal(record.entrance.y, record.origin.y + 1);
      assert.equal(record.entrance.z, record.origin.z - 1);
      assert.equal(record.queueNode.x, doorX);
      assert.equal(record.queueNode.y, record.origin.y + 1);
      assert.equal(record.queueNode.z, record.origin.z + 3);
      assert.equal(record.serviceCounter.x, doorX);
      assert.equal(record.serviceCounter.y, record.origin.y + 1);
      assert.equal(
        record.serviceCounter.z,
        record.origin.z + Math.max(8, depth - 6)
      );
      assert.equal(record.jobsBoardPosition.x, record.entrance.x + 3);
      assert.equal(record.jobsBoardPosition.y, record.origin.y);
      assert.equal(record.jobsBoardPosition.z, record.origin.z - 3);
    }
    assert.deepEqual(
      Array.from(groundYs).sort((a, b) => a - b),
      [26, 36, 40, 42, 43, 44, 45, 46, 47, 49, 51, 52, 53, 62, 64, 65, 66]
    );
  });

  it("marks every guide mesh invisible so server voxel outposts are not covered by white proxy boxes", () => {
    const renderer = makeHarthmereBusinessOutpostBuildingsRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = scenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)
    );
    assert.ok(
      root,
      "guide root must still attach so data/debug inspector works"
    );
    assert.equal(root?.children.length, HARTHMERE_BUSINESS_OUTPOSTS.length);
    for (const child of root!.children) {
      assert.equal(
        child.visible,
        false,
        `${child.name} guide proxy must be invisible; real building comes from server voxel materialization`
      );
      // userData must still be intact for the debug inspector and audit tools.
      assert.ok(child.userData.harthmereBusinessOutpostId);
      assert.ok(child.userData.structuralRendering);
    }
  });

  it("reattaches the building renderer after scene recreation", () => {
    const renderer = makeHarthmereBusinessOutpostBuildingsRenderer();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)
    );
    assert.ok(
      firstRoot,
      "business outpost building root must attach to the first scene"
    );
    assert.equal(
      firstRoot?.children.length,
      HARTHMERE_BUSINESS_OUTPOSTS.length
    );

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)
    );
    assert.ok(
      secondRoot,
      "business outpost building root must attach after scene recreation"
    );
    assert.equal(secondRoot, firstRoot);
    assert.equal(firstScenes.three.children.includes(firstRoot!), false);
  });

  it("keeps guide-rendered buildings on production coordinates in local dev", () => {
    const previousForceTown =
      process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN;
    const previousOffsetX =
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X;
    const previousOffsetZ =
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z;
    try {
      process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN = "1";
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X = "512";
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z = "0";

      assert.deepEqual(harthmereBusinessOutpostRuntimeOffsetForTest(), {
        x: 0,
        z: 0,
      });

      const renderer = makeHarthmereBusinessOutpostBuildingsRenderer();
      const scenes = createNewScenes();
      renderer.draw(scenes, 0.016);
      const root = scenes.three.children.find((child) =>
        child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)
      );
      assert.ok(
        root,
        "business outpost building root must attach to the scene"
      );
      for (const child of root!.children) {
        assert.equal(
          child.position.x,
          0,
          `${child.name} should use production/world business coordinates`
        );
        assert.equal(
          child.position.z,
          0,
          `${child.name} should preserve the configured Z offset`
        );
        assert.deepEqual(child.userData.harthmereBusinessOutpostRuntimeOffset, {
          x: 0,
          z: 0,
        });
      }
    } finally {
      if (previousForceTown === undefined)
        delete process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN;
      else
        process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN = previousForceTown;
      if (previousOffsetX === undefined)
        delete process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X;
      else
        process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X =
          previousOffsetX;
      if (previousOffsetZ === undefined)
        delete process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z;
      else
        process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z =
          previousOffsetZ;
    }
  });
});
