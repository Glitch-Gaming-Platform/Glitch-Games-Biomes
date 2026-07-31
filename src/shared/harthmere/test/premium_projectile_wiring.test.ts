import assert from "assert";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { harthmereNativeNpcProjectilePresentation } from "@/shared/harthmere/harthmere_native_combat";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_DIRECT_RANGED_ATTACK_VISUAL_IDS,
  HARTHMERE_PROJECTILE_VISUALS,
  HARTHMERE_PROJECTILE_VISUAL_VERSION,
  HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS,
  getHarthmereProjectileVisual,
  harthmereNativeNpcProjectileVisualId,
  resolveHarthmereProjectileVisual,
} from "@/shared/harthmere/projectile_visual_manifest";
import { validateHarthmereBossAttackCatalog } from "@/shared/harthmere/boss_attack_catalog";

describe("premium projectile native wiring", () => {
  it("keeps a complete unique 29-projectile premium registry", () => {
    assert.equal(
      HARTHMERE_PROJECTILE_VISUAL_VERSION,
      "harthmere-premium-projectiles-v2"
    );
    assert.equal(HARTHMERE_PROJECTILE_VISUALS.length, 29);
    assert.equal(
      new Set(HARTHMERE_PROJECTILE_VISUALS.map(({ id }) => id)).size,
      29
    );
    for (const id of HARTHMERE_DIRECT_RANGED_ATTACK_VISUAL_IDS) {
      assert.ok(getHarthmereProjectileVisual(id), id);
    }
  });

  it("resolves every premium ranged weapon to an authored projectile", () => {
    for (const itemId of [
      "hunter_bow",
      "golden_bow",
      "strung_bow",
      "one_handed_crossbow",
      "two_handed_crossbow",
      "steel_dart",
      "golden_dart",
      "photon_sidearm",
      "pulse_carbine",
      "helix_projector",
      "nova_cannon",
      "singularity_lance",
    ]) {
      assert.ok(getHarthmereProjectileVisual(itemId), itemId);
    }
  });

  it("round-trips native ECS ranged item ids into projectile visuals", () => {
    for (const itemId of [
      "hunter_bow",
      "golden_bow",
      "strung_bow",
      "one_handed_crossbow",
      "two_handed_crossbow",
      "steel_dart",
      "golden_dart",
      "photon_sidearm",
      "pulse_carbine",
      "helix_projector",
      "nova_cannon",
      "singularity_lance",
    ]) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(nativeId, itemId);
      const semanticId = harthmereNativeItemIdForBiomesId(nativeId);
      assert.equal(semanticId, itemId);
      assert.ok(getHarthmereProjectileVisual(semanticId), itemId);
    }
  });

  it("maps native Anima attacker identities to their exact projectile", () => {
    assert.equal(
      harthmereNativeNpcProjectileVisualId({
        key: "bandit_archer",
        displayName: "Bandit Hedge Archer",
        banditRole: "archer",
      }),
      "bandit_archer_shot"
    );
    assert.equal(
      harthmereNativeNpcProjectileVisualId({
        key: "monster_lesser_hexer",
        combatKind: "hex",
      }),
      "hex_bolt"
    );
    assert.equal(
      harthmereNativeNpcProjectileVisualId({
        key: "boss_thaedryn_bellbound",
      }),
      "thaedryn_resonance"
    );
  });

  it("carries projectile identity on the canonical native combat profiles", () => {
    const profiles = allHarthmereNativeNpcCombatProfiles();
    const archer = profiles.find(({ key }) => key === "bandit_archer");
    const thaedryn = profiles.find(
      ({ key }) => key === "boss_thaedryn_bellbound"
    );
    const hexers = profiles.filter(({ key, displayName }) =>
      /hex/i.test(`${key} ${displayName}`)
    );
    assert.equal(archer?.projectileVisualId, "bandit_archer_shot");
    assert.equal(thaedryn?.projectileVisualId, "thaedryn_resonance");
    assert.ok(hexers.length > 0);
    assert.ok(
      hexers.every(
        ({ projectileVisualId }) => projectileVisualId === "hex_bolt"
      )
    );
  });

  it("adds Fireball to ordinary Hexes and gives native Hex bosses five authored attacks", () => {
    const profiles = allHarthmereNativeNpcCombatProfiles();
    const hexes = profiles.filter(({ key, displayName }) =>
      /hex|thaedryn|muck_scarred_helix/i.test(`${key} ${displayName}`)
    );
    const standardHexes = hexes.filter(({ isBoss }) => !isBoss);
    const hexBosses = hexes.filter(({ isBoss }) => isBoss);
    assert.ok(standardHexes.length > 0);
    assert.ok(hexBosses.length >= 2);
    assert.ok(
      standardHexes.every(
        ({ rangedAttacks }) =>
          rangedAttacks?.length === 1 &&
          rangedAttacks[0].abilityId === "fireball" &&
          rangedAttacks[0].cooldownSecs === 20
      )
    );
    for (const boss of hexBosses) {
      assert.equal(boss.rangedAttacks?.length, 5, boss.key);
      assert.ok(
        boss.rangedAttacks?.some(({ damageType }) =>
          [
            "fire",
            "ice",
            "lightning",
            "holy",
            "dark",
            "arcane",
            "nature",
            "sonic",
            "gravity",
          ].includes(String(damageType))
        ),
        boss.key
      );
      assert.ok(
        boss.rangedAttacks?.every(({ projectileVisualId }) =>
          Boolean(getHarthmereProjectileVisual(projectileVisualId))
        ),
        boss.key
      );
    }
    assert.deepEqual(validateHarthmereBossAttackCatalog(), {
      ok: true,
      failures: [],
    });
  });

  it("selects the exact ranged cast graphic and suppresses projectiles for Hex melee", () => {
    const profile = allHarthmereNativeNpcCombatProfiles().find(
      ({ rangedAttacks, isBoss }) => !isBoss && rangedAttacks?.length
    );
    assert.ok(profile);
    assert.equal(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: 50,
        rangedState: {
          abilityId: "fireball",
          projectileVisualId: "fireball",
          castTime: 50,
          aimPoint: [8, 1, 0],
        },
      })?.projectileVisualId,
      "fireball"
    );
    assert.equal(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: 60,
        rangedState: undefined,
      }),
      undefined
    );
  });

  it("carries attack geometry and bespoke body animation through native presentation", () => {
    const profile = allHarthmereNativeNpcCombatProfiles().find(
      ({ displayName }) => displayName === "Muck-Scarred Helix"
    );
    assert.ok(profile);
    const attack = profile.rangedAttacks?.find(
      ({ abilityId }) => abilityId === "helix_resonance_pulse"
    );
    assert.ok(attack);
    assert.deepEqual(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: 50,
        rangedState: {
          abilityId: attack.abilityId,
          projectileVisualId: attack.projectileVisualId,
          castTime: 50,
          aimPoint: [8, 1, 0],
        },
      }),
      {
        projectileVisualId: "helix_projector_beam",
        abilityId: "helix_resonance_pulse",
        displayName: "Helix Pulse",
        attackShape: "beam",
        damageType: "arcane",
        animationClip: "RangedAttack",
        specialAnimationClip: "HelixPulse",
        attackDistance: 24,
        hitRadius: 1.1,
        coneAngleDeg: undefined,
        windupSecs: 0.95,
        aimPoint: [8, 1, 0],
        result: undefined,
      }
    );
  });

  it("resolves authoritative event payloads without label-only guessing", () => {
    assert.equal(
      resolveHarthmereProjectileVisual({ projectileVisualId: "fireball" })?.id,
      "fireball"
    );
    assert.equal(
      resolveHarthmereProjectileVisual({ itemId: "two_handed_crossbow" })?.id,
      "ranged_shot"
    );
    assert.equal(
      resolveHarthmereProjectileVisual({ attacker: "Thaedryn" })?.id,
      "thaedryn_resonance"
    );
  });

  it("keeps Gaia out of transient projectile presentation", () => {
    assert.deepEqual(HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS, []);
  });
});
