/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141,
  nearestHarthmereJobsBoardPhysicalPromptV141,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144,
  createHarthmereJobsBoardKioskMeshV144,
  makeHarthmereJobsBoardMarkerRendererV144,
} from "@/client/game/renderers/local_dev/harthmere_jobs_board_marker_v144";
import { createNewScenes } from "@/client/game/renderers/scenes";
import * as THREE from "three";

// HARTHMERE_JOBS_BOARD_GROVE_RELOCATION_V143:
// The board now sits exactly under the player's reported feet position so
// that the world-map pin, the proximity gate, the rendered voxel kiosk, and
// the in-world quest pin all share a single column. These tests assert that
// the renderer keeps the boards visible (correct Y + over-sized scales) and
// interactable (proximity radius covers a player at the placement XZ).
const GROVE_BOARD_X = 501.59;
const GROVE_BOARD_Z = -133.35;
const GROVE_BOARD_Y = 70;
const HARTHMERE_BOARD_X = 1046;
const HARTHMERE_BOARD_Z = -202;

describe("Harthmere jobs board kiosk placements V141/V143", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "../harthmere_assets.ts"),
    "utf8",
  );

  it("keeps both jobs boards wired as large voxel kiosks with nearby wayfinding pieces", () => {
    assert.ok(SOURCE.includes("createGroveJobsBoardKioskPlacementV141()"));
    assert.ok(SOURCE.includes("createHarthmereTownJobsBoardKioskPlacementV141()"));
    assert.ok(SOURCE.includes("\"Grove Jobs Board Monitor\""));
    assert.ok(SOURCE.includes("\"Grove Jobs Board Hut\""));
    assert.ok(SOURCE.includes("\"Harthmere Town Jobs Board\""));
    assert.ok(SOURCE.includes("\"obj_shop_simple\""));
    assert.ok(SOURCE.includes("\"obj_kiosk\""));
    assert.ok(SOURCE.includes("\"obj_sign_post\""));
    assert.ok(SOURCE.includes("\"obj_flag_large_blue\""));
    assert.ok(SOURCE.includes("\"scroll_1_fp\""));
    assert.ok(SOURCE.includes("\"obj_lamp_ground_small\""));
  });

  it("builds a dedicated procedural Grove board that does not depend on OBJ assets or lighting", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMeshV144(location!);
    assert.equal(mesh.position.x, GROVE_BOARD_X);
    assert.equal(mesh.position.y, GROVE_BOARD_Y);
    assert.equal(mesh.position.z, GROVE_BOARD_Z);
    assert.equal(
      mesh.userData.harthmereJobsBoardMarkerVersion,
      HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144,
    );

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    assert.ok(size.x >= 6, `procedural board width should be at least 6m, got ${size.x}`);
    assert.ok(size.y >= 6, `procedural board height should be at least 6m, got ${size.y}`);
    assert.ok(size.z >= 4, `procedural board depth should be at least 4m, got ${size.z}`);

    let meshCount = 0;
    mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshCount += 1;
      assert.equal(
        child.material instanceof THREE.MeshBasicMaterial,
        true,
        "procedural board meshes should use unlit materials so they remain visible in dim Grove lighting",
      );
      assert.equal(child.frustumCulled, false, "procedural board pieces should not be culled out near the camera");
    });
    assert.ok(meshCount >= 20, `procedural board should be made of many visible voxel pieces, got ${meshCount}`);
  });

  it("reattaches the procedural board after scene recreation so reconnects cannot hide it", () => {
    const renderer = makeHarthmereJobsBoardMarkerRendererV144();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144),
    );
    assert.ok(firstRoot, "procedural board root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144),
    );
    assert.ok(secondRoot, "procedural board root must attach to a recreated scene");
    assert.equal(secondRoot, firstRoot, "renderer should move the same lightweight root to the current scene");
    assert.equal(
      firstScenes.three.children.includes(firstRoot!),
      false,
      "root should not remain stuck on the stale scene after reattach",
    );
  });

  it("pins the Grove board to the player-reported feet column (501.59, 70, -133.35)", () => {
    assert.ok(
      SOURCE.includes(`HARTHMERE_JOBS_BOARD_GROVE_X_V143 = ${GROVE_BOARD_X}`),
      "Grove X must match the player's reported feet position",
    );
    assert.ok(
      SOURCE.includes(`HARTHMERE_JOBS_BOARD_GROVE_Z_V143 = ${GROVE_BOARD_Z}`),
      "Grove Z must match the player's reported feet position",
    );
    assert.ok(
      SOURCE.includes(`HARTHMERE_JOBS_BOARD_GROVE_LIVE_GROUND_Y_V142 = ${GROVE_BOARD_Y}`),
      "Grove Y must match the player's reported feet Y",
    );
  });

  it("draws the Grove kiosk BIG so the player cannot miss it", () => {
    const groveBlock = SOURCE.match(
      /function createGroveJobsBoardKioskPlacementV141\(\)[\s\S]+?\n\}/,
    );
    assert.ok(groveBlock, "Grove kiosk function must exist");
    const body = groveBlock?.[0] ?? "";
    // Main kiosk monitor must be at least 3.0 scale (was 1.95 — too small).
    const kioskScaleMatch = body.match(/"obj_kiosk"[\s\S]+?Math\.PI,\s*([\d.]+),\s*"Grove Jobs Board Monitor"/);
    assert.ok(kioskScaleMatch, "Grove kiosk scale must be parseable");
    const kioskScale = Number(kioskScaleMatch?.[1] ?? 0);
    assert.ok(
      kioskScale >= 3.0,
      `Grove kiosk monitor scale ${kioskScale} must be >= 3.0 (was 1.95 — player walked past it)`,
    );
    // The shop shell must be big enough to read as a building, not a sign.
    const shopScaleMatch = body.match(/"obj_shop_simple"[\s\S]+?Math\.PI,\s*([\d.]+),\s*"Grove Jobs Board Hut"/);
    assert.ok(shopScaleMatch);
    assert.ok(Number(shopScaleMatch?.[1] ?? 0) >= 1.3, "Grove shop hut must be >= 1.3 scale");
    // At least three large flags so the board reads from spawn distance.
    const flagCount = (body.match(/"obj_flag_large_blue"/g) ?? []).length;
    assert.ok(flagCount >= 3, `Grove board must have at least 3 large banners (found ${flagCount})`);
    // At least four ground lamps frame the board so it's visible at night.
    const lampCount = (body.match(/"obj_lamp_ground_small"/g) ?? []).length;
    assert.ok(lampCount >= 4, `Grove board must have at least 4 ground lamps (found ${lampCount})`);
  });

  it("plants both kiosks on the live snapshot terrain so the player can see them", () => {
    // The Grove kiosk uses the player-reported feet Y (=70), not GROUND_Y (=53).
    assert.ok(
      SOURCE.includes("const HARTHMERE_JOBS_BOARD_GROVE_LIVE_GROUND_Y_V142 = 70"),
    );
    assert.ok(
      SOURCE.includes("HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_LIVE_GROUND_Y_V142 = 65"),
      "Harthmere Town kiosk Y must use the measured live market-district ground (65)",
    );
    assert.ok(
      SOURCE.includes("const groveBoardY = HARTHMERE_JOBS_BOARD_GROVE_LIVE_GROUND_Y_V142"),
    );
    assert.ok(
      SOURCE.includes("const harthmereBoardY = HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_LIVE_GROUND_Y_V142"),
    );
  });

  it("keeps the rendered kiosks inside the proximity gate radius (player can interact)", () => {
    const grove = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141.find(
      (b) => b.boardId === "harthmere_grove_market_jobs_board",
    );
    const harthmere = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141.find(
      (b) => b.boardId === "harthmere_town_market_jobs_board",
    );
    assert.ok(grove, "Grove board must be registered in the proximity gate");
    assert.ok(harthmere, "Harthmere town board must be registered in the proximity gate");

    // Proximity gate XZ must match the rendered kiosk XZ.
    assert.equal(grove?.position.x, GROVE_BOARD_X);
    assert.equal(grove?.position.z, GROVE_BOARD_Z);
    assert.equal(harthmere?.position.x, HARTHMERE_BOARD_X);
    assert.equal(harthmere?.position.z, HARTHMERE_BOARD_Z);
    // Wider radius (>= 10) since the kiosk is much bigger now.
    assert.ok((grove?.radius ?? 0) >= 10, "Grove board radius must be >= 10");

    const grovePrompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: GROVE_BOARD_X,
      y: GROVE_BOARD_Y,
      z: GROVE_BOARD_Z,
    });
    assert.equal(grovePrompt?.boardId, "harthmere_grove_market_jobs_board");
    assert.equal(grovePrompt?.displayName, "Grove Jobs Board");

    const harthmerePrompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: HARTHMERE_BOARD_X,
      y: 66,
      z: HARTHMERE_BOARD_Z,
    });
    assert.equal(harthmerePrompt?.boardId, "harthmere_town_market_jobs_board");
    assert.equal(harthmerePrompt?.displayName, "Harthmere Jobs Board");
  });

  it("does not pin the kiosk back to the authored GROUND_Y (regression)", () => {
    const groveBlock = SOURCE.match(
      /function createGroveJobsBoardKioskPlacementV141\(\)[\s\S]+?\n\}/,
    );
    const harthmereBlock = SOURCE.match(
      /function createHarthmereTownJobsBoardKioskPlacementV141\(\)[\s\S]+?\n\}/,
    );
    assert.ok(groveBlock, "Grove kiosk function must exist");
    assert.ok(harthmereBlock, "Harthmere town kiosk function must exist");

    assert.ok(groveBlock?.[0].includes("groveBoardY"));
    assert.ok(harthmereBlock?.[0].includes("harthmereBoardY"));

    // Belt-and-braces: ensure no BARE `GROUND_Y` token sneaks back into
    // either jobs-board placement helper.
    const bareGroundYRe = /(?<![A-Za-z0-9_])GROUND_Y(?![A-Za-z0-9_])/;
    assert.equal(
      bareGroundYRe.test(groveBlock?.[0] ?? ""),
      false,
      "Grove kiosk must not pin Y to GROUND_Y",
    );
    assert.equal(
      bareGroundYRe.test(harthmereBlock?.[0] ?? ""),
      false,
      "Harthmere town kiosk must not pin Y to GROUND_Y",
    );
  });
});
