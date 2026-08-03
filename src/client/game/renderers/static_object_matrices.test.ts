import { freezeStaticObjectMatrices } from "@/client/game/renderers/static_object_matrices";
import assert from "assert";
import * as THREE from "three";

describe("freezeStaticObjectMatrices", () => {
  it("preserves final authored world transforms and freezes the hierarchy", () => {
    const root = new THREE.Group();
    root.position.set(10, 2, -4);
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    child.position.set(3, 5, 7);
    root.add(child);

    freezeStaticObjectMatrices(root);

    const worldPosition = child.getWorldPosition(new THREE.Vector3());
    assert.deepStrictEqual(worldPosition.toArray(), [13, 7, 3]);
    assert.strictEqual(root.matrixAutoUpdate, false);
    assert.strictEqual(child.matrixAutoUpdate, false);
    assert.strictEqual(root.matrixWorldNeedsUpdate, false);
    assert.strictEqual(child.matrixWorldNeedsUpdate, false);

    child.visible = false;
    assert.strictEqual(child.visible, false);
    assert.deepStrictEqual(
      child.getWorldPosition(new THREE.Vector3()).toArray(),
      [13, 7, 3]
    );
  });
});
