/// <reference types="mocha" />
import assert from "assert";
import { createHarthmereLootDropMesh } from "../harthmere_loot_drop_markers";
import * as THREE from "three";

describe("Harthmere loot drop marker renderer", () => {
  it("keeps every marker mesh in one opaque scene classification", () => {
    const marker = createHarthmereLootDropMesh({
      dropId: "drop-test",
      position: { x: 2, y: 67, z: -3 },
    } as any);
    const materials: THREE.Material[] = [];
    marker.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const rows = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.push(...rows);
    });

    assert.ok(materials.length >= 3);
    assert.ok(materials.every((material) => material.transparent === false));
  });
});
