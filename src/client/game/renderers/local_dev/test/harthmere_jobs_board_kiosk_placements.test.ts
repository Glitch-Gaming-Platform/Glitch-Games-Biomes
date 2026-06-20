/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS,
  HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION,
  HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION,
  createHarthmereJobsBoardKioskMesh,
  makeHarthmereJobsBoardMarkerRenderer,
} from "@/client/game/renderers/local_dev/harthmere_jobs_board_marker";
import { createNewScenes } from "@/client/game/renderers/scenes";
import * as THREE from "three";

// HARTHMERE_JOBS_BOARD_GROVE_RELOCATION:
// The board now sits exactly under the player's reported feet position so
// that the world-map pin, the proximity gate, the rendered voxel kiosk, and
// the in-world quest pin all share a single column. These tests assert that
// the renderer keeps the boards visible (correct Y + over-sized scales) and
// interactable (proximity radius covers a player at the placement XZ).
const GROVE_BOARD_X = 501.99486179104775;
const GROVE_BOARD_Z = -132.00350672753194;
const GROVE_BOARD_Y = 70;
const GROVE_FOUNTAIN_CENTER_X = 496;
const GROVE_FOUNTAIN_CENTER_Z = -126;
const HARTHMERE_BOARD_X = 1046;
const HARTHMERE_BOARD_Z = -202;

describe("Harthmere jobs board kiosk placements V141/V143", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "../harthmere_assets.ts"),
    "utf8",
  );

  it("keeps the legacy OBJ jobs-board helpers retired so they cannot leave blockers or blue-white pole props", () => {
    assert.ok(SOURCE.includes("createGroveJobsBoardKioskPlacement()"));
    assert.ok(SOURCE.includes("createHarthmereTownJobsBoardKioskPlacement()"));
    assert.ok(SOURCE.includes("harthmere_jobs_board_marker.ts"));

    const groveBlock = SOURCE.match(
      /function createGroveJobsBoardKioskPlacement\(\)[\s\S]+?\n\}/,
    );
    const harthmereBlock = SOURCE.match(
      /function createHarthmereTownJobsBoardKioskPlacement\(\)[\s\S]+?\n\}/,
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
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMesh(location!);
    assert.equal(mesh.position.x, GROVE_BOARD_X);
    assert.equal(mesh.position.y, GROVE_BOARD_Y);
    assert.equal(mesh.position.z, GROVE_BOARD_Z);
    assert.equal(
      mesh.userData.harthmereJobsBoardMarkerVersion,
      HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION,
    );
    assert.equal(
      mesh.userData.harthmereJobsBoardPolishVersion,
      HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION,
    );
    assert.equal(
      mesh.userData.harthmereJobsBoardGraphicVersion,
      HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION,
    );
    assert.equal(
      mesh.userData.harthmereJobsBoardGraphicSource,
      "wanted_board_notice_graphic",
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

  it("renders as a polished public jobs board with readable notices and an obvious access point", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMesh(location!);

    const partCounts = new Map<string, number>();
    const letters = new Set<string>();
    mesh.traverse((child) => {
      const part = child.userData.harthmereJobsBoardPart;
      if (typeof part === "string") {
        partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
      }
      const letter = child.userData.harthmereJobsBoardLetter;
      if (typeof letter === "string") {
        letters.add(letter);
      }
      if (child instanceof THREE.Mesh) {
        assert.equal(
          child.userData.harthmereJobsBoardPolishVersion,
          HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION,
          `${child.name} should carry the production polish marker`,
        );
      }
    });

    assert.equal(partCounts.get("title_plaque"), 1, "board should have a title plaque");
    assert.equal(partCounts.get("title_letter"), 4, "board should spell its title with four voxel letters");
    assert.deepEqual([...letters].sort(), ["B", "J", "O", "S"], "title should spell JOBS");
    assert.ok((partCounts.get("title_letter_block") ?? 0) >= 40, "voxel letters should be readable blocks");
    assert.ok((partCounts.get("posted_notice") ?? 0) >= 10, "board should show several posted jobs");
    assert.ok((partCounts.get("notice_ink_line") ?? 0) >= 30, "posted notices should have visible ink rows");
    assert.ok((partCounts.get("notice_pin") ?? 0) >= 20, "posted notices should look pinned, not flat debug cards");
    assert.equal(partCounts.get("front_access_step"), 1, "board should have one obvious approach step");
    assert.equal(partCounts.get("interaction_glow"), 1, "board should have one visible interaction glow tile");
    assert.equal(partCounts.get("animated_banner"), 1, "board should keep a lightweight animated pennant");
    assert.equal(partCounts.get("lantern_glow"), 4, "board should be readable from both fountain path directions");
    assert.equal(partCounts.get("wanted_board_graphic_marker"), 1, "jobs boards should use the shared wanted-board notice graphic");
    assert.equal(partCounts.get("wanted_board_warrant_notice"), 1, "wanted-board graphic should include a red warrant notice");
    assert.equal(partCounts.get("wanted_board_blue_notice"), 1, "wanted-board graphic should include a blue pinned notice");
  });

  it("flips the posted face and access step onto the opposite world side", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMesh(location!);
    mesh.updateMatrixWorld(true);

    assert.equal(mesh.rotation.y, HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW);
    assert.equal(
      mesh.userData.harthmereJobsBoardFrontYaw,
      HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
    );

    let face: THREE.Object3D | undefined;
    let accessStep: THREE.Object3D | undefined;
    mesh.traverse((child) => {
      if (child.userData.harthmereJobsBoardPart === "notice_board_face") {
        face = child;
      }
      if (child.userData.harthmereJobsBoardPart === "front_access_step") {
        accessStep = child;
      }
    });

    assert.ok(face, "board should still have a posted face");
    assert.ok(accessStep, "board should still have a front access step");
    const faceWorld = new THREE.Vector3();
    const stepWorld = new THREE.Vector3();
    face!.getWorldPosition(faceWorld);
    accessStep!.getWorldPosition(stepWorld);
    assert.ok(
      faceWorld.z < mesh.position.z,
      `posted board face should be flipped behind the root on world Z, got ${faceWorld.z}`,
    );
    assert.ok(
      stepWorld.z < mesh.position.z,
      `front access step should move with the flipped face, got ${stepWorld.z}`,
    );
  });

  it("keeps the polished Grove board in the fountain area at the current production coordinate", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    assert.equal(location?.x, GROVE_BOARD_X);
    assert.equal(location?.y, GROVE_BOARD_Y);
    assert.equal(location?.z, GROVE_BOARD_Z);

    const distanceFromFountain = Math.hypot(
      (location?.x ?? 0) - GROVE_FOUNTAIN_CENTER_X,
      (location?.z ?? 0) - GROVE_FOUNTAIN_CENTER_Z,
    );
    assert.ok(
      distanceFromFountain <= 9,
      `Grove Jobs Board should remain visually in the fountain area, got ${distanceFromFountain}`,
    );
  });

  it("reattaches the procedural board after scene recreation so reconnects cannot hide it", () => {
    const renderer = makeHarthmereJobsBoardMarkerRenderer();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION),
    );
    assert.ok(firstRoot, "procedural board root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION),
    );
    assert.ok(secondRoot, "procedural board root must attach to a recreated scene");
    assert.equal(secondRoot, firstRoot, "renderer should move the same lightweight root to the current scene");
    assert.equal(
      firstScenes.three.children.includes(firstRoot!),
      false,
      "root should not remain stuck on the stale scene after reattach",
    );
  });

  it("pins the procedural Grove board to the player-reported feet column (501.99486179104775, 70, -132.00350672753194)", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    assert.equal(location?.x, GROVE_BOARD_X, "Grove X must match the player's reported feet position");
    assert.equal(location?.y, GROVE_BOARD_Y, "Grove Y must match the player's reported feet Y");
    assert.equal(location?.z, GROVE_BOARD_Z, "Grove Z must match the player's reported feet position");
  });

  it("draws the procedural Grove kiosk BIG so the player cannot miss it", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    assert.ok(location, "Grove procedural board location must exist");
    const mesh = createHarthmereJobsBoardKioskMesh(location!);
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
    const grove = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
    );
    const harthmere = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === "harthmere_town_market_jobs_board",
    );
    assert.equal(grove?.y, GROVE_BOARD_Y, "Grove board must use the player-reported live ground Y");
    assert.equal(
      harthmere?.y,
      65,
      "Harthmere Town kiosk Y must use the measured live market-district ground (65)",
    );
  });

  it("renders every physical jobs board with the shared wanted-board notice graphic", () => {
    const renderedIds = new Set(
      HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.map((location) => location.id)
    );
    for (const board of HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS) {
      assert.ok(
        renderedIds.has(board.boardId),
        `${board.boardId} should be drawn by the jobs-board renderer, not the generic quest-object marker`
      );
      const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
        (candidate) => candidate.id === board.boardId
      );
      assert.equal(location?.x, board.position.x);
      assert.equal(location?.y, board.position.y);
      assert.equal(location?.z, board.position.z);
      const mesh = createHarthmereJobsBoardKioskMesh(location!);
      assert.equal(
        mesh.userData.harthmereJobsBoardGraphicVersion,
        HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION
      );
    }
  });

  it("keeps the rendered kiosks inside the proximity gate radius (player can interact)", () => {
    const grove = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.find(
      (b) => b.boardId === "harthmere_grove_market_jobs_board",
    );
    const harthmere = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.find(
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
      HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
      "Grove board prompt radius should require standing next to the kiosk",
    );
    assert.equal(
      harthmere?.radius,
      HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
      "Harthmere board prompt radius should match the tight kiosk interaction",
    );

    const grovePrompt = nearestHarthmereJobsBoardPhysicalPrompt({
      x: GROVE_BOARD_X,
      y: GROVE_BOARD_Y,
      z: GROVE_BOARD_Z,
    });
    assert.equal(grovePrompt?.boardId, "harthmere_grove_market_jobs_board");
    assert.equal(grovePrompt?.displayName, "Jobs Board");

    const acrossFountainPrompt = nearestHarthmereJobsBoardPhysicalPrompt({
      x: GROVE_BOARD_X + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS + 0.25,
      y: GROVE_BOARD_Y,
      z: GROVE_BOARD_Z,
    });
    assert.equal(acrossFountainPrompt, undefined);

    const harthmerePrompt = nearestHarthmereJobsBoardPhysicalPrompt({
      x: HARTHMERE_BOARD_X,
      y: 66,
      z: HARTHMERE_BOARD_Z,
    });
    assert.equal(harthmerePrompt?.boardId, "harthmere_town_market_jobs_board");
    assert.equal(harthmerePrompt?.displayName, "Harthmere Jobs Board");
  });

  it("does not pin the kiosk back to the authored GROUND_Y (regression)", () => {
    const groveBlock = SOURCE.match(
      /function createGroveJobsBoardKioskPlacement\(\)[\s\S]+?\n\}/,
    );
    const harthmereBlock = SOURCE.match(
      /function createHarthmereTownJobsBoardKioskPlacement\(\)[\s\S]+?\n\}/,
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
