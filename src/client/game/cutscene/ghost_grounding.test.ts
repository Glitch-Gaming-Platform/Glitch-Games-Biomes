import {
  CUTSCENE_GHOST_GROUND_CLEARANCE,
  groundCutsceneGhost,
} from "@/client/game/cutscene/ghost_grounding";
import assert from "assert";
import * as THREE from "three";

describe("cutscene ghost grounding", () => {
  it("keeps the rendered lower bound above the encounter floor", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 3));
    mesh.position.y = 2;
    const { root, animationRoot, groundOffset } = groundCutsceneGhost(mesh);

    root.position.set(100, 44, -20);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true);

    assert.equal(animationRoot, mesh);
    assert.ok(groundOffset > 0);
    assert.ok(
      Math.abs(bounds.min.y - (44 + CUTSCENE_GHOST_GROUND_CLEARANCE)) < 1e-6
    );
  });

  it("uses a parent wrapper so later actor positioning cannot erase the correction", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.y = -3;
    const { root } = groundCutsceneGhost(mesh, 0.1);

    root.position.fromArray([7, 12, 9]);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true);
    assert.ok(Math.abs(bounds.min.y - 12.1) < 1e-6);
  });
});
