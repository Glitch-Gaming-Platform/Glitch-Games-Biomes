/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  createHarthmereBusinessOutpostBuildingMeshV1,
  harthmereBusinessOutpostRuntimeOffsetForTestV1,
  HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1,
  makeHarthmereBusinessOutpostBuildingsRendererV1,
} from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings_v1";
import { createNewScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import * as THREE from "three";

describe("Harthmere business outpost backend voxel renderer V1", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "../harthmere_assets.ts"),
    "utf8",
  );

  it("retires the floating legacy sign and scroll props from business outposts", () => {
    const start = SOURCE.indexOf("function createHarthmereBusinessOutpostPlacementsV1()");
    const end = SOURCE.indexOf("function row(", start);
    assert.ok(start >= 0 && end > start, "business outpost placement helper must remain auditable");
    const body = SOURCE.slice(start, end);
    for (const legacyAsset of [
      "\"obj_sign_post\"",
      "\"scroll_1_fp\"",
      "\"table_medium\"",
      "createHarthmereBlockBuiltServiceBuildingV43",
      "renderLocalScaffolds",
    ]) {
      assert.equal(
        body.includes(legacyAsset),
        false,
        `business outposts must not emit ${legacyAsset}; buildings now come from backend voxel plans`,
      );
    }
    assert.ok(
      body.includes("appearance: harthmereBusinessOutpostStaffAppearanceV1(outpost)"),
      "staff NPCs must carry the same procedural Harthmere appearance schema as other voxel NPCs",
    );
    assert.ok(
      SOURCE.includes("HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId]"),
      "staff NPCs must anchor to the same enlarged backend procedural building entrance as the rendered shell",
    );
    assert.ok(
      SOURCE.includes("record.entrance.z - 2"),
      "staff NPCs should stand just outside the generated doorway so the entrance stays visible and passable",
    );
  });

  it("builds one always-on procedural voxel mesh per backend outpost record", () => {
    assert.equal(
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1).length,
      HARTHMERE_BUSINESS_OUTPOSTS_V1.length,
    );

    for (const record of Object.values(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1)) {
      const mesh = createHarthmereBusinessOutpostBuildingMeshV1(record);
      assert.equal(
        mesh.userData.harthmereBusinessOutpostRenderVersion,
        HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1,
      );
      assert.equal(mesh.userData.sourceOfTruth, "backend_procedural_voxel_building");
      assert.equal(mesh.userData.serverOwned, true);
      assert.equal(
        mesh.userData.groveReferenceSourceScanVersion,
        record.buildingStyleKit.sourceScanVersion,
      );
      assert.ok(
        mesh.userData.groveReferenceSourceFeatures.includes("clear customer aisle"),
        `${record.outpostId} mesh should carry coordinate-scan style features for visual QA`,
      );

      const partCounts = new Map<string, number>();
      const instancedParts = new Map<string, THREE.InstancedMesh>();
      mesh.traverse((child) => {
        const part = child.userData.harthmereBusinessOutpostPart;
        if (typeof part === "string") {
          partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
          if (child instanceof THREE.InstancedMesh) {
            instancedParts.set(part, child);
          }
        }
        if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
          assert.equal(child.frustumCulled, false, `${child.name} should remain visible near the player`);
          assert.equal(
            child.material instanceof THREE.MeshBasicMaterial,
            true,
            `${child.name} should use unlit material so Grove night lighting cannot hide it`,
          );
        }
      });

      for (const requiredPart of ["foundation", "floor", "wall", "roof", "stair"]) {
        assert.equal(partCounts.get(requiredPart), 1, `${record.outpostId} should render ${requiredPart} voxel instances`);
      }
      assert.equal(
        partCounts.get("safe_ground"),
        1,
        `${record.outpostId} should render backend safe-ground voxels as a grounded storefront lot`,
      );
      const safeGroundMesh = instancedParts.get("safe_ground");
      assert.ok(safeGroundMesh, `${record.outpostId} should expose the safe-ground instanced mesh`);
      assert.ok(
        safeGroundMesh!.count < record.materializationPlan.edits.filter((edit) => edit.label === "safe_ground").length,
        `${record.outpostId} should visually trim the backend safe zone so it does not render as a huge floating slab`,
      );
      assert.ok(
        ((safeGroundMesh!.geometry as THREE.BoxGeometry).parameters?.height ?? 1) <= 0.12,
        `${record.outpostId} safe ground should render as a thin ground treatment, not a one-meter cube platform`,
      );
      const foundationMesh = instancedParts.get("foundation");
      assert.ok(foundationMesh, `${record.outpostId} should expose the foundation instanced mesh`);
      assert.ok(
        foundationMesh!.count < record.materializationPlan.edits.filter((edit) => edit.label === "foundation").length,
        `${record.outpostId} should hide far-lot retaining support voxels and render polished retaining walls instead`,
      );
      assert.ok((partCounts.get("safe_zone_outline") ?? 0) >= 4, `${record.outpostId} needs a visible safe-zone exterior`);
      assert.ok((partCounts.get("biomes_style_stone_foundation_band") ?? 0) >= 4, `${record.outpostId} needs Grove-style stone foundation bands`);
      assert.ok((partCounts.get("biomes_style_wall_paneling") ?? 0) >= 6, `${record.outpostId} needs wood or stone panel rhythm like the Grove references`);
      assert.ok((partCounts.get("biomes_style_roof_overhang") ?? 0) >= 2, `${record.outpostId} needs a real roof overhang`);
      assert.ok((partCounts.get("front_door_accessible") ?? 0) >= 4, `${record.outpostId} needs a readable open front door frame and threshold`);
      assert.equal(partCounts.get("front_door_open_leaf"), 1, `${record.outpostId} needs a visible open door leaf`);
      assert.equal(partCounts.get("front_door_open_leaf_glass"), 1, `${record.outpostId} needs a glass door inset`);
      assert.equal(partCounts.get("business_sign_plaque"), 1, `${record.outpostId} needs a visible business sign plaque`);
      assert.equal(partCounts.get("business_sign_icon"), 1, `${record.outpostId} needs a Bikkie-style readable sign icon`);
      assert.equal(partCounts.get("front_awning"), 1, `${record.outpostId} needs a polished entrance awning`);
      assert.ok((partCounts.get("front_awning_stripe") ?? 0) >= 5, `${record.outpostId} needs an awning with visible stripes like Grove storefronts`);
      assert.ok((partCounts.get("front_window") ?? 0) >= 2, `${record.outpostId} needs readable front windows`);
      assert.ok((partCounts.get("front_window_trim") ?? 0) >= 6, `${record.outpostId} needs framed front windows`);
      assert.ok((partCounts.get("side_window") ?? 0) >= 4, `${record.outpostId} needs side windows for a real shop shell`);
      assert.ok((partCounts.get("side_window_trim") ?? 0) >= 4, `${record.outpostId} needs framed side windows`);
      assert.equal(partCounts.get("biomes_style_customer_queue_rug"), 1, `${record.outpostId} needs an interior queue/service floor cue`);
      assert.equal(partCounts.get("biomes_style_interior_wall_panel"), 1, `${record.outpostId} needs an interior service wall panel`);
      assert.equal(partCounts.get("scan_reference_low_boundary_wall"), 2, `${record.outpostId} needs low stone boundary walls from the coordinate scan`);
      assert.ok((partCounts.get("scan_reference_grounded_notice_board") ?? 0) >= 2, `${record.outpostId} needs a grounded supported notice board from the scan`);
      assert.ok((partCounts.get("scan_reference_supported_notice") ?? 0) >= 3, `${record.outpostId} needs supported posted notices, not floating scrolls`);
      assert.ok((partCounts.get("scan_reference_supported_wall_storage") ?? 0) >= 3, `${record.outpostId} needs wall-backed cabinets and shelves from the scan`);
      assert.ok((partCounts.get("scan_reference_supported_wall_storage_detail") ?? 0) >= 6, `${record.outpostId} needs supported goods on those shelves`);
      assert.ok((partCounts.get("scan_reference_supported_tabletop_detail") ?? 0) >= 4, `${record.outpostId} needs supported counter items from the scan`);
      assert.equal(partCounts.get("scan_reference_customer_bench"), 4, `${record.outpostId} needs bench seating with aisle clearance from the scan`);
      assert.ok((partCounts.get("scan_reference_landscape_edge") ?? 0) >= 4, `${record.outpostId} needs Grove landscape edge details from the scan`);
      assert.equal(partCounts.get("inside_business_dashboard_access"), 2, `${record.outpostId} needs an obvious interior dashboard access point`);
      assert.equal(partCounts.get("primary_bikkie_station"), 1, `${record.outpostId} needs a Bikkie-based service station`);
      assert.ok((partCounts.get("interior_business_decor") ?? 0) >= 2, `${record.outpostId} needs business-specific interior decor`);
      assert.ok((partCounts.get("interior_business_decor_accent") ?? 0) >= 3, `${record.outpostId} needs readable interior accent props`);
      assert.ok((partCounts.get("procedural_jobs_board") ?? 0) >= 4, `${record.outpostId} needs a grounded procedural jobs board`);
      assert.ok((partCounts.get("exterior_bikkie_improvement") ?? 0) >= 4, `${record.outpostId} needs polished exterior Bikkie improvements`);
      assert.ok((partCounts.get("biomes_style_retaining_wall") ?? 0) >= 4, `${record.outpostId} needs retaining walls so the safe zone does not read as a floating platform`);
      assert.ok((partCounts.get("biomes_style_customer_path") ?? 0) >= 2, `${record.outpostId} needs a visible approach path to the door and jobs board`);
      assert.ok((partCounts.get("visible_business_access_point") ?? 0) >= 2, `${record.outpostId} needs visible exterior and interior dashboard access cues`);
    }
  });

  it("keeps all rendered building voxels grounded on the backend plan instead of floating", () => {
    for (const record of Object.values(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1)) {
      const solidEdits = record.materializationPlan.edits.filter((edit) => edit.label !== "safe_ground");
      assert.ok(solidEdits.length > 0, `${record.outpostId} needs solid building edits`);
      assert.ok(
        solidEdits
          .filter((edit) => edit.position[1] < record.origin.y - 1)
          .every((edit) => edit.label === "foundation"),
        `${record.outpostId} should only place below-grade retaining support as foundation voxels`,
      );
      assert.ok(
        solidEdits.some((edit) => edit.label === "foundation" && edit.position[1] < record.origin.y - 1),
        `${record.outpostId} needs below-grade retaining supports so safe-zone ground does not read as floating`,
      );
      assert.ok(
        solidEdits.some((edit) => edit.label === "floor" && edit.position[1] === record.origin.y),
        `${record.outpostId} needs a floor exactly on the building origin Y`,
      );
      assert.equal(record.entrance.y, record.origin.y + 1);
      assert.equal(record.serviceCounter.y, record.origin.y + 1);
      assert.equal(record.queueNode.y, record.origin.y + 1);
    }
  });

  it("reattaches the building renderer after scene recreation", () => {
    const renderer = makeHarthmereBusinessOutpostBuildingsRendererV1();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1),
    );
    assert.ok(firstRoot, "business outpost building root must attach to the first scene");
    assert.equal(firstRoot?.children.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1),
    );
    assert.ok(secondRoot, "business outpost building root must attach after scene recreation");
    assert.equal(secondRoot, firstRoot);
    assert.equal(firstScenes.three.children.includes(firstRoot!), false);
  });

  it("keeps backend business buildings aligned with shifted runtime NPC outposts", () => {
    const previousForceTown = process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN;
    const previousOffsetX = process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X;
    const previousOffsetZ = process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z;
    try {
      process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN = "1";
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X = "512";
      process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z = "0";

      assert.deepEqual(harthmereBusinessOutpostRuntimeOffsetForTestV1(), { x: 512, z: 0 });

      const renderer = makeHarthmereBusinessOutpostBuildingsRendererV1();
      const scenes = createNewScenes();
      renderer.draw(scenes, 0.016);
      const root = scenes.three.children.find((child) =>
        child.name.includes(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION_V1),
      );
      assert.ok(root, "business outpost building root must attach to the scene");
      for (const child of root!.children) {
        assert.equal(child.position.x, 512, `${child.name} should shift with Harthmere runtime outposts`);
        assert.equal(child.position.z, 0, `${child.name} should preserve the configured Z offset`);
        assert.deepEqual(child.userData.harthmereBusinessOutpostRuntimeOffset, { x: 512, z: 0 });
      }
    } finally {
      if (previousForceTown === undefined) delete process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN;
      else process.env.NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN = previousForceTown;
      if (previousOffsetX === undefined) delete process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X;
      else process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X = previousOffsetX;
      if (previousOffsetZ === undefined) delete process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z;
      else process.env.NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z = previousOffsetZ;
    }
  });
});
