/// <reference types="mocha" />
import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import assert from "assert";
import fs from "fs";
import path from "path";
import * as THREE from "three";

// HARTHMERE_COMBAT_VFX_ALWAYS_ON
//
// The projectile / magic-charge layer is parented to HarthmereRuntimeAssets'
// `root` and ticked from its `draw()`. Both lifecycle hooks used to sit behind
// `shouldRenderHarthmereRuntimeAssets()`, which is true only on localhost or
// with the `biomes.harthmereAssets` localStorage key set. In the shipped build a
// cast therefore spawned its charge into a group that was never advanced and
// never added to a scene -- "projectile and magic charging animation not
// showing".
describe("Harthmere combat VFX are independent of the town-asset gate", () => {
  const renderer = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/game/renderers/local_dev/harthmere_assets.ts"
    ),
    "utf8"
  );
  it("preloads projectile assets outside the town-asset gate on desktop only", () => {
    assert.match(renderer, /HARTHMERE_COMBAT_VFX_ALWAYS_ON/);
    assert.match(
      renderer,
      /if \(!this\.mobileDevice\) \{\s*this\.harthmereProjectileVisuals\.preloadAll\(\);\s*\}\s*if \(shouldRenderHarthmereRuntimeAssets\(\)\)/
    );
  });

  it("ticks and attaches the VFX layer on the not-ready draw path", () => {
    const notReadyBranch = renderer.slice(
      renderer.indexOf("draw(scenes: Scenes, dt: number)"),
      renderer.indexOf("this.elapsed += Math.min(dt, 0.05);")
    );
    assert.match(
      notReadyBranch,
      /this\.harthmereProjectileVisuals\.update\(dt\)/
    );
    assert.match(notReadyBranch, /hasHarthmereSceneAttachableContent\(\)/);
    assert.match(notReadyBranch, /scenes\.three\.add\(this\.root\)/);
  });

  it("also attaches the local player's third-person weapon rig", () => {
    // The weapon rig shares draw()'s frame clock and is updated before the
    // readiness gate, so production does not need an extra uncancelled rAF.
    assert.match(
      renderer,
      /hasHarthmereSceneAttachableContent\(\)[\s\S]{0,400}?harthmerePlayerSwordAnchorRoot !== undefined/
    );
    const drawStart = renderer.indexOf("draw(scenes: Scenes, dt: number)");
    const notReady = renderer.indexOf(
      "if (!this.ready || this.root.children.length === 0)",
      drawStart
    );
    assert.ok(
      renderer.indexOf("this.updateHarthmerePlayerSwordVisual();", drawStart) <
        notReady
    );
    assert.doesNotMatch(renderer, /requestAnimationFrame\(animateSword\)/);
  });

  it("creates, advances, and releases a visible magic charge immediately", async () => {
    const root = new THREE.Group();
    const loader = {
      loadAsync: async () => ({ scene: new THREE.Group(), animations: [] }),
    } as any;
    const runtime = new HarthmereProjectileVisualRuntime(root, loader);

    assert.equal(
      runtime.spawnMagicCharge({
        key: "player:test-charge",
        projectileId: "spark",
        origin: new THREE.Vector3(1, 2, 3),
        duration: 2,
        power: 0.6,
      }),
      true
    );
    assert.equal(runtime.hasActiveVisuals(), true);
    assert.ok(
      root.children.some((child) =>
        child.name.startsWith("harthmere-magic-charge-")
      )
    );

    runtime.update(0.25);
    await Promise.resolve();
    assert.equal(runtime.hasActiveVisuals(), true);
    assert.equal(runtime.endMagicCharge("player:test-charge", "release"), true);
    assert.equal(runtime.hasActiveVisuals(), false);
  });

  it("keeps a low-FPS projectile alive through impact presentation", async () => {
    const root = new THREE.Group();
    const loader = {
      loadAsync: async () => ({ scene: new THREE.Group(), animations: [] }),
    } as any;
    const runtime = new HarthmereProjectileVisualRuntime(root, loader);

    assert.equal(
      runtime.spawn({
        projectileId: "spark",
        origin: new THREE.Vector3(0, 1, 0),
        target: new THREE.Vector3(0, 1, 3),
        result: "hit",
        damageType: "magic",
      }),
      true
    );
    runtime.update(1);
    await Promise.resolve();
    assert.equal(
      runtime.hasActiveVisuals(),
      true,
      "impact VFX must survive the first long frame instead of spawning and disappearing unseen"
    );
  });
});
