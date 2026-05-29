/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
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

  it("keeps the legacy OBJ jobs-board helpers retired so they cannot leave blockers or blue-white pole props", () => {
    assert.ok(SOURCE.includes("createGroveJobsBoardKioskPlacementV141()"));
    assert.ok(SOURCE.includes("createHarthmereTownJobsBoardKioskPlacementV141()"));
    assert.ok(SOURCE.includes("harthmere_jobs_board_marker_v144.ts"));

    const groveBlock = SOURCE.match(
      /function createGroveJobsBoardKioskPlacementV141\(\)[\s\S]+?\n\}/,
    );
    const harthmereBlock = SOURCE.match(
      /function createHarthmereTownJobsBoardKioskPlacementV141\(\)[\s\S]+?\n\}/,
    );
    assert.ok(groveBlock, "Grove legacy helper must remain as an intentional no-op");
    assert.ok(harthmereBlock, "Harthmere legacy helper must remain as an intentional no-op");

    for (const [label, body] of [
      ["Grove", groveBlock?.[0] ?? ""],
      ["Harthmere", harthmereBlock?.[0] ?? ""],
    ] as const) {
      assert.ok(body.includes("return [];"), `${label} helper must not emit legacy OBJ placements`);
      for (const legacyAsset of [
        "\"obj_shop_simple\"",
        "\"obj_kiosk\"",
        "\"obj_sign_post\"",
        "\"obj_flag_large_blue\"",
        "\"obj_lamp_ground_small\"",
        "\"scroll_1_fp\"",
        "\"scroll_2_fp\"",
      ]) {
        assert.equal(
          body.includes(legacyAsset),
          false,
          `${label} helper must not emit ${legacyAsset}; those props caused path blockers or blue-white pole clutter`,
        );
      }
    }

    assert.equal(
      SOURCE.includes("if (/jobs board/.test(label)) return false"),
      false,
      "snapshot-built filtering should not special-case legacy jobs-board OBJ props anymore",
    );
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

  it("pins the procedural Grove board to the player-reported feet column (501.59, 70, -133.35)", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    assert.equal(location?.x, GROVE_BOARD_X, "Grove X must match the player's reported feet position");
    assert.equal(location?.y, GROVE_BOARD_Y, "Grove Y must match the player's reported feet Y");
    assert.equal(location?.z, GROVE_BOARD_Z, "Grove Z must match the player's reported feet position");
  });

  it("draws the procedural Grove kiosk BIG so the player cannot miss it", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMeshV144(location!);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    assert.ok(size.x >= 6, `Grove procedural board width should be at least 6m, got ${size.x}`);
    assert.ok(size.y >= 6, `Grove procedural board height should be at least 6m, got ${size.y}`);
    assert.ok(size.z >= 4, `Grove procedural board depth should be at least 4m, got ${size.z}`);

    let pointLightCount = 0;
    mesh.traverse((child) => {
      if (child instanceof THREE.PointLight) pointLightCount += 1;
      assert.equal(
        child.userData?.harthmereCollision,
        undefined,
        "procedural jobs-board meshes must not register player collision; interaction is handled by the proximity gate",
      );
    });
    assert.ok(pointLightCount >= 1, "procedural board should still light its own area without legacy lamp props");
  });

  it("plants both kiosks on the live snapshot terrain so the player can see them", () => {
    const grove = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    const harthmere = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
      (candidate) => candidate.id === "harthmere_town_market_jobs_board",
    );
    assert.equal(grove?.y, GROVE_BOARD_Y, "Grove board must use the player-reported live ground Y");
    assert.equal(
      harthmere?.y,
      65,
      "Harthmere Town kiosk Y must use the measured live market-district ground (65)",
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
    assert.equal(
      grove?.radius,
      HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
      "Grove board prompt radius should require standing next to the kiosk",
    );
    assert.equal(
      harthmere?.radius,
      HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
      "Harthmere board prompt radius should match the tight kiosk interaction",
    );

    const grovePrompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: GROVE_BOARD_X,
      y: GROVE_BOARD_Y,
      z: GROVE_BOARD_Z,
    });
    assert.equal(grovePrompt?.boardId, "harthmere_grove_market_jobs_board");
    assert.equal(grovePrompt?.displayName, "Jobs Board");

    const acrossFountainPrompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: GROVE_BOARD_X + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 + 0.25,
      y: GROVE_BOARD_Y,
      z: GROVE_BOARD_Z,
    });
    assert.equal(acrossFountainPrompt, undefined);

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

    assert.ok(
      groveBlock?.[0].includes("return [];"),
      "Grove legacy helper should stay retired instead of choosing any placement Y",
    );
    assert.ok(
      harthmereBlock?.[0].includes("return [];"),
      "Harthmere legacy helper should stay retired instead of choosing any placement Y",
    );

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
