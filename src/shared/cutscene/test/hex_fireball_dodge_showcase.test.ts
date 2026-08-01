import {
  HARTHMERE_CUTSCENE_PROJECTILE_HOOK,
  HARTHMERE_HEX_FIREBALL_DODGE_DURATION_SECONDS,
  HARTHMERE_HEX_FIREBALL_DODGE_MAX_SCENE_SECONDS,
  HARTHMERE_HEX_FIREBALL_DODGE_SHOWCASE_ID,
  harthmereHexFireballDodgeShowcaseCutscene,
  type HarthmereCutsceneProjectilePayload,
} from "@/shared/cutscene/hex_fireball_dodge_showcase";
import assert from "assert";

describe("Harthmere Hex Fireball dodge cutscene", () => {
  it("stages a mutation-free three-Fireball fight with three directional dodges", () => {
    const scene = harthmereHexFireballDodgeShowcaseCutscene();
    assert.equal(scene.id, HARTHMERE_HEX_FIREBALL_DODGE_SHOWCASE_ID);
    assert.equal(scene.settings.mode, "clientPuppet");
    assert.deepEqual(scene.settings.commitOn, []);
    assert.deepEqual(scene.onEnd, { placements: [], commits: [] });
    assert.equal(
      scene.shots.reduce((sum, shot) => sum + shot.duration, 0),
      HARTHMERE_HEX_FIREBALL_DODGE_DURATION_SECONDS
    );
    assert.equal(
      scene.settings.maxSceneDurationSeconds,
      HARTHMERE_HEX_FIREBALL_DODGE_MAX_SCENE_SECONDS
    );
    assert.ok(
      scene.settings.maxSceneDurationSeconds >
        HARTHMERE_HEX_FIREBALL_DODGE_DURATION_SECONDS,
      "the director safety ceiling must not race natural completion"
    );
    assert.equal(
      scene.cast.find((member) => member.role === "hero")?.binding.kind,
      "player"
    );
    assert.equal(
      scene.cast.find((member) => member.role === "hex-wraith")?.binding.kind,
      "ghost"
    );
    const hexWraith = scene.cast.find((member) => member.role === "hex-wraith");
    assert.equal(hexWraith?.binding.kind, "ghost");
    if (hexWraith?.binding.kind === "ghost") {
      assert.equal(
        hexWraith.binding.asset,
        "/assets/harthmere/glb/bosses/hex_wraith.glb"
      );
      assert.equal(hexWraith.binding.height, 3.8);
    }

    const actions = scene.shots.flatMap((shot) => shot.actions);
    const projectiles = actions.filter(
      (action) =>
        action.kind === "custom" &&
        action.hook === HARTHMERE_CUTSCENE_PROJECTILE_HOOK
    );
    assert.equal(projectiles.length, 3);
    for (const action of projectiles) {
      assert.equal(action.kind, "custom");
      const payload = action.payload as HarthmereCutsceneProjectilePayload;
      assert.equal(payload.projectileId, "fireball");
      assert.equal(payload.result, "dodge");
      assert.equal(payload.visualScale, 2.25);
      assert.equal(payload.origin.length, 3);
      assert.equal(payload.target.length, 3);
    }

    const dodges = actions.flatMap((action) =>
      action.kind === "emote" && /^dodge/.test(action.emote)
        ? [action.emote]
        : []
    );
    assert.deepEqual(dodges, ["dodgeRight", "dodgeLeft", "dodgeBack"]);
    assert.ok(
      actions.some(
        (action) => action.kind === "emote" && action.emote === "attack2"
      ),
      "the hero must visibly counterattack"
    );
    assert.ok(
      actions.some(
        (action) => action.kind === "vfx" && action.effect === "combatImpact"
      ),
      "the counterattack must visibly connect"
    );
  });
});
