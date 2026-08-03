import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import assert from "assert";
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function runtime() {
  const root = new THREE.Group();
  const loader = {
    loadAsync: () => new Promise(() => {}),
  } as unknown as GLTFLoader;
  return {
    root,
    runtime: new HarthmereProjectileVisualRuntime(root, loader),
  };
}

describe("Harthmere projectile visual runtime", () => {
  it("advances hostile projectile contact by wall time at low FPS", () => {
    const test = runtime();
    assert.equal(
      test.runtime.spawn({
        projectileId: "fireball",
        origin: new THREE.Vector3(0, 1, 0),
        target: new THREE.Vector3(10, 1, 0),
        authoritativeImpactSecs: 1,
        windupSecs: 1,
        result: "hit",
      }),
      true
    );
    assert.equal((test.runtime as any).active.length, 1);

    // One rendered frame arrived one wall-clock second later. Particle and
    // mixer integration remains capped internally, but contact must resolve
    // now because Anima's damage clock has also advanced by one second.
    test.runtime.update(1);

    assert.equal((test.runtime as any).active.length, 0);
    assert.equal((test.runtime as any).impactCount, 1);
    assert.ok((test.runtime as any).impacts.length > 0);
  });

  it("turns an already-resolved delayed shape update into an immediate visible impact", () => {
    const test = runtime();
    assert.equal(
      test.runtime.spawn({
        projectileId: "helix_projector_beam",
        attackShape: "beam",
        origin: new THREE.Vector3(0, 2, 0),
        target: new THREE.Vector3(12, 1, 0),
        authoritativeImpactSecs: 0,
        windupSecs: 0.95,
        hitRadius: 1.1,
        result: "hit",
      }),
      true
    );
    assert.equal((test.runtime as any).activeShapes.length, 1);

    test.runtime.update(1 / 60);

    assert.equal((test.runtime as any).activeShapes.length, 0);
    assert.equal((test.runtime as any).impactCount, 1);
    assert.ok((test.runtime as any).impacts.length > 0);
  });
});
