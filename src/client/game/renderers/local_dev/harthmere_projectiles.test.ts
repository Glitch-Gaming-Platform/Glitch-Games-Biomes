import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import { HARTHMERE_SOUND_EFFECT_EVENT } from "@/shared/harthmere/sound_effect_manifest";
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

class TestCustomEvent<T> extends Event {
  readonly detail: T;

  constructor(type: string, detailOrInit: T | { detail: T }) {
    super(type);
    this.detail =
      detailOrInit &&
      typeof detailOrInit === "object" &&
      "detail" in detailOrInit
        ? detailOrInit.detail
        : detailOrInit;
  }
}

describe("Harthmere projectile visual runtime", () => {
  const originalWindow = (globalThis as any).window;
  const originalCustomEvent = (globalThis as any).CustomEvent;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).CustomEvent = originalCustomEvent;
  });

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
    const impact = (test.runtime as any).impacts.find(
      ({ kind }: { kind: string }) => kind === "magic_explosion"
    );
    assert.ok(impact);
    assert.equal(impact.profile.silhouette, "eruption");
    assert.ok(impact.layers.length > impact.profile.ringCount + 2);
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

  it("prewarms and emits a distinct audible explosion on the production event path", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;
    const sounds: Array<Record<string, any>> = [];
    windowTarget.addEventListener(HARTHMERE_SOUND_EFFECT_EVENT, (event) => {
      sounds.push((event as TestCustomEvent<Record<string, any>>).detail);
    });

    const test = runtime();
    assert.equal(
      test.runtime.spawn({
        projectileId: "fireball",
        origin: new THREE.Vector3(0, 1, 0),
        target: new THREE.Vector3(4, 1, 0),
        authoritativeImpactSecs: 0.4,
        result: "hit",
        damageType: "fire",
      }),
      true
    );

    assert.ok(
      sounds.some(
        ({ id, preloadOnly }) =>
          id === "fireball_explosion" && preloadOnly === true
      )
    );
    assert.ok(sounds.some(({ id }) => id === "fireball_launch"));
    assert.ok(sounds.some(({ id }) => id === "fireball_flight"));

    test.runtime.update(0.4);

    assert.ok(sounds.some(({ id }) => id === "fireball_impact"));
    const explosion = [...sounds]
      .reverse()
      .find(
        ({ id, preloadOnly }) =>
          id === "fireball_explosion" && preloadOnly !== true
      );
    assert.ok(explosion);
    assert.ok(explosion.durationSeconds >= 0.95);
    assert.ok(explosion.fadeOutSeconds > 0);
    assert.equal(explosion.volumeMultiplier, 1.15);
    assert.equal(explosion.refDistance, 7);
    assert.equal(explosion.maxDistance, 96);
    assert.equal(explosion.rolloffFactor, 0.65);
  });
});
