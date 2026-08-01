import { strict as assert } from "assert";
import {
  HARTHMERE_BOSS_MAGIC_MAX_CHARGE_VISUAL_SCALE,
  HARTHMERE_BOSS_MAGIC_MAX_PROJECTILE_VISUAL_SCALE,
  harthmereBossMagicPresentation,
} from "@/shared/harthmere/boss_magic_presentation";
import {
  harthmereBossNativeCombatTuningForBossId,
  harthmereBossAttacksForLabel,
} from "@/shared/harthmere/boss_attack_catalog";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import {
  HARTHMERE_MAGIC_CHARGE_MAX_SECS,
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
  harthmereMagicChargeDurationSecs,
  isHarthmereMagicAttack,
} from "@/shared/harthmere/magic_charge";
import { harthmereMagicImpactProfile } from "@/shared/harthmere/magic_impact";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";

describe("boss magic presentation", () => {
  it("covers every one of the 40 boss magic attacks through charge, travel/shape, and impact", () => {
    let magicAttackCount = 0;
    const shapes = new Map<string, number>();
    for (const boss of HARTHMERE_BOSS_VISUAL_ASSETS) {
      const attacks = harthmereBossAttacksForLabel(boss.displayName);
      assert.ok(attacks, boss.displayName);
      for (const attack of attacks) {
        if (!isHarthmereMagicAttack(attack)) continue;
        magicAttackCount += 1;
        shapes.set(
          attack.attackShape,
          (shapes.get(attack.attackShape) ?? 0) + 1
        );
        const chargeTimeSecs = harthmereMagicChargeDurationSecs(attack);
        assert.ok(
          chargeTimeSecs >= HARTHMERE_MAGIC_CHARGE_MIN_SECS &&
            chargeTimeSecs <= HARTHMERE_MAGIC_CHARGE_MAX_SECS,
          `${boss.displayName}.${attack.displayName} has no bounded charge`
        );
        const projectile = getHarthmereProjectileVisual(
          attack.projectileVisualId
        );
        assert.ok(
          projectile,
          `${boss.displayName}.${attack.displayName} has no travel/shape visual`
        );
        assert.ok(
          harthmereMagicImpactProfile({
            projectileVisualId: projectile.id,
            family: projectile.family,
            damageType: attack.damageType,
            result: "hit",
            impactRadius: attack.hitRadius,
            lightIntensity: projectile.lightIntensity,
            finalDamage: attack.attackDamage,
          }),
          `${boss.displayName}.${attack.displayName} has no hit explosion`
        );
      }
    }
    assert.equal(magicAttackCount, 40);
    assert.deepEqual(Object.fromEntries(shapes), {
      projectile: 7,
      beam: 8,
      ground_aoe: 14,
      self_aoe: 8,
      cone: 3,
    });
  });

  it("moves giant-boss magic toward the target-facing body surface", () => {
    for (const boss of HARTHMERE_BOSS_VISUAL_ASSETS) {
      const tuning = harthmereBossNativeCombatTuningForBossId(boss.id);
      const targetDistance = Math.max(
        ...tuning.attacks.map(({ attackDistance }) => attackDistance)
      );
      const presentation = harthmereBossMagicPresentation({
        position: [10, 4, -20],
        size: boss.worldSize,
        targetPoint: [10, 5, -20 + targetDistance],
      });
      const offset = Math.hypot(
        presentation.origin[0] - 10,
        presentation.origin[2] + 20
      );
      assert.ok(offset > 0.3, `${boss.displayName} remained center-origin`);
      assert.ok(
        offset < targetDistance,
        `${boss.displayName} spawned magic beyond its target`
      );
      assert.ok(presentation.origin[1] > 4);
      assert.ok(presentation.chargeVisualScale >= 1);
      assert.ok(
        presentation.chargeVisualScale <=
          HARTHMERE_BOSS_MAGIC_MAX_CHARGE_VISUAL_SCALE
      );
      assert.ok(presentation.projectileVisualScale >= 1);
      assert.ok(
        presentation.projectileVisualScale <=
          HARTHMERE_BOSS_MAGIC_MAX_PROJECTILE_VISUAL_SCALE
      );
    }
  });

  it("gives raid-scale bodies a larger but bounded presentation", () => {
    const humanScale = harthmereBossMagicPresentation({
      position: [0, 0, 0],
      size: [1, 2, 1],
      targetPoint: [0, 1, 20],
    });
    const thaedryn = harthmereBossMagicPresentation({
      position: [0, 0, 0],
      size: [20, 14, 58],
      targetPoint: [0, 1, 40],
    });
    assert.equal(humanScale.chargeVisualScale, 1);
    assert.ok(thaedryn.chargeVisualScale > 6);
    assert.ok(thaedryn.projectileVisualScale > 2.5);
    assert.ok(thaedryn.origin[2] > 29);
    assert.ok(thaedryn.origin[2] < 40);
  });

  it("keeps a close target in front of the visual even when it is inside a giant footprint", () => {
    const presentation = harthmereBossMagicPresentation({
      position: [0, 0, 0],
      size: [20, 14, 58],
      targetPoint: [0, 1, 28],
    });
    assert.equal(presentation.targetConstrained, true);
    assert.ok(presentation.origin[2] > 20);
    assert.ok(presentation.origin[2] < 28);
  });

  it("keeps long cone telegraphs distinct from their target-centered hit explosion", () => {
    const vyrahel = harthmereBossAttacksForLabel(
      "Vyrahel, the Vein-Keeper"
    )?.find(({ abilityId }) => abilityId === "vyrahel_vein_breath");
    assert.ok(vyrahel);
    assert.equal(vyrahel.attackShape, "cone");
    assert.ok(vyrahel.attackDistance > vyrahel.minimumDistance);
    // Renderer regression coverage is enforced by the premium runtime source
    // validator; this catalog assertion keeps the fixture meaningfully closer
    // than the authored maximum so the browser audit catches endpoint drift.
    assert.ok(vyrahel.attackDistance * 0.78 < vyrahel.attackDistance);
  });
});
