/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";
import * as THREE from "three";

import {
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  HARTHMERE_BUSINESS_JOBS_BOARD_FRONT_YAW,
  HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
  HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION,
  createHarthmereJobsBoardKioskMesh,
} from "@/client/game/renderers/local_dev/harthmere_jobs_board_marker";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostJobsBoardPosition,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_JOBS_BOARD_GRAPHICS,
  HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY,
} from "@/shared/harthmere/world_interaction_graphics";

describe("Harthmere Blender jobs-board placements", () => {
  it("keeps one rendered landmark aligned with every physical F-interaction board", () => {
    assert.equal(HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.length, 21);
    assert.equal(HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.length, 21);
    assert.deepEqual(
      HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.map((board) => board.id).sort(),
      HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.map((board) => board.boardId).sort()
    );
    for (const rendered of HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS) {
      const physical = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.find(
        (candidate) => candidate.boardId === rendered.id
      );
      assert.ok(physical, `${rendered.id} must keep its physical board`);
      assert.deepEqual(
        [rendered.x, rendered.y, rendered.z],
        [physical!.position.x, physical!.position.y, physical!.position.z]
      );
      assert.equal(physical!.radius, HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS);
      assert.equal(
        nearestHarthmereJobsBoardPhysicalPrompt(physical!.position)?.boardId,
        rendered.id
      );
    }
  });

  it("keeps all 19 business boards at their authoritative outpost coordinates", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const expected = harthmereBusinessOutpostJobsBoardPosition(outpost);
      const board = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
        (candidate) => candidate.id === `${outpost.outpostId}_jobs_board`
      );
      assert.ok(board, `${outpost.outpostId} board missing`);
      assert.deepEqual(
        [board!.x, board!.y, board!.z],
        [expected.x, expected.y, expected.z]
      );
      assert.equal(board!.yaw, HARTHMERE_BUSINESS_JOBS_BOARD_FRONT_YAW);
    }
  });

  it("flips only the 19 business boards and leaves Grove/town orientations untouched", () => {
    const businessIds = new Set(
      HARTHMERE_BUSINESS_OUTPOSTS.map(
        (outpost) => `${outpost.outpostId}_jobs_board`
      )
    );
    assert.equal(businessIds.size, 19);
    for (const board of HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS) {
      assert.equal(
        board.yaw,
        businessIds.has(board.id)
          ? HARTHMERE_BUSINESS_JOBS_BOARD_FRONT_YAW
          : HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
        `${board.id} has the wrong scoped orientation`
      );
    }
  });

  it("preserves the old large landmark scale in every optimized Blender variant", () => {
    assert.deepEqual(Object.keys(HARTHMERE_JOBS_BOARD_GRAPHICS).sort(), [
      "amber",
      "blue",
      "green",
      "rose",
      "violet",
    ]);
    for (const [variant, record] of Object.entries(
      HARTHMERE_JOBS_BOARD_GRAPHICS
    )) {
      const width = record.bounds.max[0] - record.bounds.min[0];
      const height = record.bounds.max[2] - record.bounds.min[2];
      assert.ok(
        width >= 6.5,
        `${variant} width ${width} should remain landmark-scale`
      );
      assert.ok(
        height >= 6.4,
        `${variant} height ${height} should remain landmark-scale`
      );
      for (const lod of ["lod0", "lod1"] as const) {
        assert.equal(record.stats[lod].meshoptCompressed, true);
        assert.equal(record.stats[lod].textureCount, 0);
        assert.equal(record.stats[lod].imageCount, 0);
        assert.ok(record.stats[lod].primitiveCount <= 7);
        assert.ok(record.stats[lod].bytes < 50_000);
      }
    }
    assert.deepEqual(HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY, {
      lod0MaxDistanceMeters: 22,
      lod1MaxDistanceMeters: 72,
      hiddenBeyondMeters: 110,
    });
  });

  it("keeps a cheap large fallback without runtime lights if a GLB fails", () => {
    const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS[0];
    const fallback = createHarthmereJobsBoardKioskMesh(location);
    assert.equal(fallback.rotation.y, location.yaw);
    assert.equal(fallback.userData.harthmereJobsBoardFallback, true);
    assert.deepEqual(fallback.position.toArray(), [
      location.x,
      location.y,
      location.z,
    ]);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(fallback).getSize(size);
    assert.ok(size.x >= 6.5);
    assert.ok(size.y >= 6.2);
    let meshCount = 0;
    let lightCount = 0;
    fallback.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount += 1;
        assert.equal(child.frustumCulled, true);
      }
      if (child instanceof THREE.Light) lightCount += 1;
    });
    assert.ok(
      meshCount <= 9,
      `fallback should stay cheap, got ${meshCount} meshes`
    );
    assert.equal(lightCount, 0);
  });

  it("loads the Blender renderer with client resources and keeps F/E interaction wiring", () => {
    const rendererRegistration = fs.readFileSync(
      path.resolve("src/client/game/renderers/renderers.ts"),
      "utf8"
    );
    const rendererSource = fs.readFileSync(
      path.resolve(
        "src/client/game/renderers/local_dev/harthmere_jobs_board_marker.ts"
      ),
      "utf8"
    );
    const interactionSource = fs.readFileSync(
      path.resolve(
        "src/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction.tsx"
      ),
      "utf8"
    );
    assert.ok(
      rendererRegistration.includes(
        "makeHarthmereJobsBoardMarkerRenderer(resources)"
      )
    );
    assert.ok(rendererSource.includes("loadGltf"));
    assert.ok(rendererSource.includes("frustumCulled = true"));
    assert.equal(rendererSource.includes("PointLight"), false);
    assert.ok(interactionSource.includes('keyCodes: ["KeyF", "KeyE"]'));
    assert.ok(
      interactionSource.includes(
        'data-testid="harthmere-jobs-board-world-prompt"'
      )
    );
    assert.ok(
      interactionSource.includes(
        '<span className="harthmere-jobs-prompt__key">F</span>'
      )
    );
    assert.match(HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION, /blender-lod/);
  });
});
