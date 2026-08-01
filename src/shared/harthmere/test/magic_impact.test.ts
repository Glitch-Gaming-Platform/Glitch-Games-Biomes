import { strict as assert } from "assert";
import {
  HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS,
  HARTHMERE_MAGIC_IMPACT_MAX_DURATION_SECS,
  HARTHMERE_MAGIC_IMPACT_MAX_DUST,
  HARTHMERE_MAGIC_IMPACT_MAX_MIST,
  HARTHMERE_MAGIC_IMPACT_MAX_SPARKS,
  HARTHMERE_MAGIC_IMPACT_MIN_DURATION_SECS,
  HARTHMERE_MAGIC_IMPACT_VERSION,
  harthmereMagicImpactProfile,
  isHarthmereSuccessfulImpactResult,
} from "@/shared/harthmere/magic_impact";
import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";

describe("universal AAA magic impacts", () => {
  it("creates a bounded layered profile for every successful magic projectile", () => {
    const magicDefinitions = HARTHMERE_PROJECTILE_VISUALS.filter(
      ({ family }) => !["physical", "energy"].includes(family)
    );
    assert.ok(magicDefinitions.length > 0);

    for (const definition of magicDefinitions) {
      const profile = harthmereMagicImpactProfile({
        projectileVisualId: definition.id,
        family: definition.family,
        result: "hit",
        impactRadius: definition.impactRadius,
        lightIntensity: definition.lightIntensity,
        finalDamage: 80,
      });
      assert.ok(profile, definition.id);
      assert.equal(profile.version, HARTHMERE_MAGIC_IMPACT_VERSION);
      assert.ok(profile.ringCount >= 2, definition.id);
      assert.ok(profile.debrisCount >= 16, definition.id);
      assert.ok(profile.sparkCount >= 18, definition.id);
      assert.ok(profile.mistCount >= 6, definition.id);
      assert.ok(profile.dustCount >= 6, definition.id);
      assert.ok(profile.debrisCount <= HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS);
      assert.ok(profile.sparkCount <= HARTHMERE_MAGIC_IMPACT_MAX_SPARKS);
      assert.ok(profile.mistCount <= HARTHMERE_MAGIC_IMPACT_MAX_MIST);
      assert.ok(profile.dustCount <= HARTHMERE_MAGIC_IMPACT_MAX_DUST);
      assert.ok(
        profile.durationSecs >= HARTHMERE_MAGIC_IMPACT_MIN_DURATION_SECS
      );
      assert.ok(
        profile.durationSecs <= HARTHMERE_MAGIC_IMPACT_MAX_DURATION_SECS
      );
    }
  });

  it("keeps misses and non-magic projectile families on the lighter impact path", () => {
    for (const result of ["miss", "dodge", "evade", "out_of_range"]) {
      assert.equal(isHarthmereSuccessfulImpactResult(result), false);
      assert.equal(
        harthmereMagicImpactProfile({
          projectileVisualId: "fireball",
          family: "fire",
          result,
          impactRadius: 2,
          lightIntensity: 3,
        }),
        undefined
      );
    }
    for (const projectileVisualId of [
      "hunter_bow_shot",
      "photon_sidearm_pulse",
    ]) {
      const definition = HARTHMERE_PROJECTILE_VISUALS.find(
        ({ id }) => id === projectileVisualId
      );
      assert.ok(definition);
      assert.equal(
        harthmereMagicImpactProfile({
          projectileVisualId,
          family: definition.family,
          result: "hit",
          impactRadius: definition.impactRadius,
          lightIntensity: definition.lightIntensity,
        }),
        undefined
      );
    }
  });

  it("uses authoritative magic damage for bosses that reuse physical or energy meshes", () => {
    const helix = harthmereMagicImpactProfile({
      projectileVisualId: "helix_projector_beam",
      family: "energy",
      damageType: "arcane",
      result: "hit",
      impactRadius: 1.1,
      lightIntensity: 4.4,
      finalDamage: 105,
    });
    const seedBarrage = harthmereMagicImpactProfile({
      projectileVisualId: "multi_shot",
      family: "physical",
      damageType: "nature",
      result: "hit",
      impactRadius: 1.8,
      lightIntensity: 1.8,
      finalDamage: 76,
    });
    assert.equal(helix?.family, "arcane");
    assert.equal(seedBarrage?.family, "nature");
  });

  it("scales powerful impacts without exceeding the shared visual budget", () => {
    const modest = harthmereMagicImpactProfile({
      projectileVisualId: "fireball",
      family: "fire",
      result: "hit",
      impactRadius: 1,
      lightIntensity: 2,
      finalDamage: 20,
    });
    const powerful = harthmereMagicImpactProfile({
      projectileVisualId: "fireball",
      family: "fire",
      result: "hit",
      impactRadius: 8,
      lightIntensity: 8,
      finalDamage: 500,
    });
    assert.ok(modest && powerful);
    assert.ok(powerful.power > modest.power);
    assert.ok(powerful.radius > modest.radius);
    assert.ok(powerful.durationSecs > modest.durationSecs);
    assert.ok(powerful.lightIntensity > modest.lightIntensity);
    assert.ok(powerful.debrisCount <= HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS);
    assert.ok(powerful.sparkCount <= HARTHMERE_MAGIC_IMPACT_MAX_SPARKS);
  });

  it("gives schools intentionally different silhouettes", () => {
    const profile = (projectileVisualId: string) => {
      const definition = HARTHMERE_PROJECTILE_VISUALS.find(
        ({ id }) => id === projectileVisualId
      );
      assert.ok(definition);
      const result = harthmereMagicImpactProfile({
        projectileVisualId,
        family: definition.family,
        result: "hit",
        impactRadius: definition.impactRadius,
        lightIntensity: definition.lightIntensity,
        finalDamage: 60,
      });
      assert.ok(result);
      return result;
    };

    const fire = profile("fireball");
    const lightning = profile("lightning_bolt");
    const nature = profile("entangling_roots");
    const gravity = profile("singularity_lance_beam");
    assert.ok(fire.upwardBias > lightning.upwardBias);
    assert.ok(lightning.sparkCount > nature.sparkCount);
    assert.ok(nature.dustCount > fire.dustCount);
    assert.ok(gravity.ringCount > nature.ringCount);
  });
});
