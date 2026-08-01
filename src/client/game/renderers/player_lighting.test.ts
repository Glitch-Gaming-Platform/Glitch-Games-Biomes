import {
  DEFAULT_PLAYER_LIGHT_DIRECTION,
  safePlayerLightDirection,
  updateSnapshotPlayerMeshLighting,
} from "@/client/game/renderers/player_lighting";
import { makePlayerSkinnedMaterial } from "@/gen/client/game/shaders/player_skinned";
import assert from "assert";
import * as THREE from "three";

describe("player light direction", () => {
  it("preserves a valid authored sun direction", () => {
    assert.deepStrictEqual(
      safePlayerLightDirection([0.25, 0.9, -0.1]),
      [0.25, 0.9, -0.1]
    );
  });

  it("replaces a zero or invalid direction before shader normalization", () => {
    assert.deepStrictEqual(
      safePlayerLightDirection([0, 0, 0]),
      DEFAULT_PLAYER_LIGHT_DIRECTION
    );
    assert.deepStrictEqual(
      safePlayerLightDirection([Number.NaN, 0, 0]),
      DEFAULT_PLAYER_LIGHT_DIRECTION
    );
  });

  it("lights every player-skinned material on a snapshot cutscene actor", () => {
    const root = new THREE.Group();
    const playerMaterial = makePlayerSkinnedMaterial({
      light: [0, 0, 0],
      spatialLighting: [0, 0],
    });
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), playerMaterial));
    root.add(
      new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    );

    assert.strictEqual(
      updateSnapshotPlayerMeshLighting(
        root,
        [0.45, 0.8],
        [0.25, 0.9, -0.1]
      ),
      1
    );
    assert.deepStrictEqual(playerMaterial.uniforms.spatialLighting.value, [
      0.45, 0.8,
    ]);
    assert.deepStrictEqual(playerMaterial.uniforms.light.value, [
      0.25, 0.9, -0.1,
    ]);
  });
});
