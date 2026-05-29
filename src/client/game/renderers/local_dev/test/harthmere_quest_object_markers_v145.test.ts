/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145,
  HARTHMERE_QUEST_OBJECT_MARKERS_V145,
  createHarthmereQuestObjectMarkerMeshV145,
  isRenderableHarthmereQuestObjectLandmarkV145,
  makeHarthmereQuestObjectMarkersRendererV145,
} from "@/client/game/renderers/local_dev/harthmere_quest_object_markers_v145";
import { createNewScenes } from "@/client/game/renderers/scenes";
import { SNAPSHOT_GROVE_LANDMARKS_V75 } from "@/shared/harthmere/snapshot_grove_content_v75";
import * as THREE from "three";

describe("Harthmere quest object procedural markers V145", () => {
  it("creates a visible procedural marker for every quest-linked non-NPC Grove-side objective", () => {
    const expected = SNAPSHOT_GROVE_LANDMARKS_V75.filter(
      isRenderableHarthmereQuestObjectLandmarkV145,
    );
    assert.ok(
      expected.length >= 25,
      `expected many quest object landmarks to be protected by procedural markers, got ${expected.length}`,
    );
    assert.equal(HARTHMERE_QUEST_OBJECT_MARKERS_V145.length, expected.length);

    for (const landmark of expected) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === landmark.id,
      );
      assert.ok(marker, `missing procedural marker for ${landmark.id}`);
      assert.equal(marker?.label, landmark.label);
      assert.equal(marker?.position[0], landmark.position[0]);
      assert.equal(marker?.position[2], landmark.position[2]);
      assert.equal(
        marker?.position[1],
        landmark.position[1] - 1,
        `${landmark.id} should render at feet/ground height, not at the hovering map-pin Y`,
      );
    }
  });

  it("does not duplicate the oversized jobs board renderer", () => {
    const ids = new Set(HARTHMERE_QUEST_OBJECT_MARKERS_V145.map((marker) => marker.id));
    assert.equal(ids.has("harthmere_market_posting_board"), false);
    assert.equal(ids.has("harthmere_town_market_posting_board"), false);
  });

  it("uses unlit non-culled meshes so quest props remain visible in dim or filtered scenes", () => {
    const sampleIds = [
      "grove_painted_route_flags",
      "grove_tool_crate",
      "grove_garden_edge_berries",
      "guild_project_table",
      "grove_drop_practice_stones",
    ];

    for (const id of sampleIds) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === id,
      );
      assert.ok(marker, `${id} should have a procedural marker`);
      const mesh = createHarthmereQuestObjectMarkerMeshV145(marker!);
      assert.equal(
        mesh.userData.harthmereQuestObjectMarkerVersion,
        HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145,
      );
      assert.equal(mesh.userData.harthmereQuestObjectMarkerId, id);

      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      assert.ok(size.x >= 0.7, `${id} should be wide enough to see, got ${size.x}`);
      assert.ok(size.y >= 1.7, `${id} should have a visible mast/beacon, got ${size.y}`);
      assert.ok(size.z >= 0.7, `${id} should have visible depth, got ${size.z}`);

      let meshCount = 0;
      mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        meshCount += 1;
        assert.equal(
          child.material instanceof THREE.MeshBasicMaterial,
          true,
          `${id} should use MeshBasicMaterial so local lighting cannot hide it`,
        );
        assert.equal(
          child.frustumCulled,
          false,
          `${id} should not be frustum-culled near the camera`,
        );
      });
      assert.ok(meshCount >= 4, `${id} should be a real voxel object, got ${meshCount} meshes`);
    }
  });

  it("reattaches to recreated scenes so reconnects cannot make quest props disappear", () => {
    const renderer = makeHarthmereQuestObjectMarkersRendererV145();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145),
    );
    assert.ok(firstRoot, "quest object root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145),
    );
    assert.ok(secondRoot, "quest object root must attach to a recreated scene");
    assert.equal(secondRoot, firstRoot);
    assert.equal(
      firstScenes.three.children.includes(firstRoot!),
      false,
      "root should move to the current scene instead of remaining on a stale scene",
    );
  });

  it("is registered in the main renderer list", () => {
    const renderersSource = fs.readFileSync(
      path.join(__dirname, "../../renderers.ts"),
      "utf8",
    );
    assert.ok(
      renderersSource.includes("makeHarthmereQuestObjectMarkersRendererV145"),
      "main renderer list should include quest object procedural markers",
    );
  });
});
