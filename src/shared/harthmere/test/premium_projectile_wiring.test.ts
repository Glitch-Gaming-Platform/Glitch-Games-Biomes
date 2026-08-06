import assert from "assert";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import {
  HARTHMERE_HEX_FIREBALL_CAST_TIME_SECS,
  harthmereNativeNpcProjectileAttackTime,
  harthmereNativeNpcProjectilePresentation,
} from "@/shared/harthmere/harthmere_native_combat";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_DIRECT_RANGED_ATTACK_VISUAL_IDS,
  HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
  HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS,
  HARTHMERE_PROJECTILE_VISUALS,
  HARTHMERE_PROJECTILE_VISUAL_VERSION,
  HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS,
  getHarthmereProjectileVisual,
  harthmereAuthoritativeImpactRemainingSecs,
  harthmereProjectileFlightDurationSecs,
  harthmereNativeNpcProjectileVisualId,
  resolveHarthmereProjectileVisual,
} from "@/shared/harthmere/projectile_visual_manifest";
import {
  HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS,
  validateHarthmereBossAttackCatalog,
} from "@/shared/harthmere/boss_attack_catalog";
import {
  HARTHMERE_MAGIC_CHARGE_MAX_SECS,
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
  harthmereMagicChargeDurationSecs,
} from "@/shared/harthmere/magic_charge";

describe("premium projectile native wiring", () => {
  it("keeps a complete unique 31-projectile premium registry", () => {
    assert.equal(
      HARTHMERE_PROJECTILE_VISUAL_VERSION,
      "harthmere-premium-projectiles-v2"
    );
    assert.equal(HARTHMERE_PROJECTILE_VISUALS.length, 31);
    assert.equal(
      new Set(HARTHMERE_PROJECTILE_VISUALS.map(({ id }) => id)).size,
      31
    );
    for (const id of HARTHMERE_DIRECT_RANGED_ATTACK_VISUAL_IDS) {
      assert.ok(getHarthmereProjectileVisual(id), id);
    }
  });

  it("keeps every projectile readable while preserving authoritative impact timing", () => {
    const speeds = HARTHMERE_PROJECTILE_VISUALS.map(({ speed }) => speed);
    assert.equal(Math.min(...speeds), 15);
    assert.equal(Math.max(...speeds), 58);
    assert.equal(HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS, 0.4);
    assert.equal(HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS, 1.8);

    const fireball = getHarthmereProjectileVisual("fireball");
    assert.ok(fireball);
    assert.equal(
      harthmereProjectileFlightDurationSecs({
        distanceMeters: 12,
        speedMetersPerSecond: fireball.speed,
      }),
      12 / 17
    );
    assert.equal(
      harthmereProjectileFlightDurationSecs({
        distanceMeters: 2,
        speedMetersPerSecond: 58,
      }),
      0.4
    );
    assert.equal(
      harthmereProjectileFlightDurationSecs({
        distanceMeters: 12,
        speedMetersPerSecond: fireball.speed,
        authoritativeImpactSecs: 1,
      }),
      1
    );
    assert.equal(
      harthmereProjectileFlightDurationSecs({
        distanceMeters: 12,
        speedMetersPerSecond: fireball.speed,
        authoritativeImpactSecs: 0.1,
      }),
      HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS
    );
    assert.equal(
      harthmereProjectileFlightDurationSecs({
        distanceMeters: 12,
        speedMetersPerSecond: fireball.speed,
        authoritativeImpactSecs: 0,
      }),
      HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS
    );
    assert.equal(
      harthmereAuthoritativeImpactRemainingSecs({
        releaseTime: 100,
        impactDelaySecs: 1,
        now: 100.75,
      }),
      0.25
    );
    assert.equal(
      harthmereAuthoritativeImpactRemainingSecs({
        releaseTime: 100,
        impactDelaySecs: 1,
        now: 102,
      }),
      0
    );
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
      "smoke_bomb",
      "arcane_staff",
      "arcane_wand",
      "arcane_spellbook_closed",
      "arcane_spellbook_open",
      "sealed_scroll",
      "crystal_focus",
      "star_focus",
      "snowflake_focus",
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
      "smoke_bomb",
      "arcane_staff",
      "arcane_wand",
      "arcane_spellbook_closed",
      "arcane_spellbook_open",
      "sealed_scroll",
      "crystal_focus",
      "star_focus",
      "snowflake_focus",
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
    assert.equal(archer?.attackStrikeMomentSecs, 1.1);
    assert.deepEqual(
      harthmereNativeNpcProjectilePresentation({
        profile: archer,
        attackTime: 10,
        rangedState: undefined,
      }),
      {
        projectileVisualId: "bandit_archer_shot",
        windupSecs: 1.1,
      }
    );
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
    assert.equal(HARTHMERE_HEX_FIREBALL_CAST_TIME_SECS, 1.3);
    assert.ok(
      standardHexes.every(
        ({ rangedAttacks }) =>
          rangedAttacks?.length === 1 &&
          rangedAttacks[0].abilityId === "fireball" &&
          rangedAttacks[0].cooldownSecs === 10 &&
          rangedAttacks[0].castTimeSecs ===
            HARTHMERE_HEX_FIREBALL_CAST_TIME_SECS &&
          harthmereMagicChargeDurationSecs({
            damageType: rangedAttacks[0].damageType,
            projectileVisualId: rangedAttacks[0].projectileVisualId,
            attackDamage: rangedAttacks[0].attackDamage,
            cooldownSecs: rangedAttacks[0].cooldownSecs,
            attackShape: rangedAttacks[0].attackShape,
          }) >= HARTHMERE_MAGIC_CHARGE_MIN_SECS
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
      assert.ok(
        boss.rangedAttacks?.every(
          ({ attackShape = "projectile", castTimeSecs }) =>
            castTimeSecs >= HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS[attackShape]
        ),
        `${boss.key} needs readable dodge telegraphs`
      );
      assert.ok(
        boss.rangedAttacks?.every((attack) => {
          const chargeTimeSecs = harthmereMagicChargeDurationSecs({
            damageType: attack.damageType,
            projectileVisualId: attack.projectileVisualId,
            attackDamage: attack.attackDamage,
            cooldownSecs: attack.cooldownSecs,
            attackShape: attack.attackShape,
          });
          return (
            chargeTimeSecs === 0 ||
            (chargeTimeSecs >= HARTHMERE_MAGIC_CHARGE_MIN_SECS &&
              chargeTimeSecs <= HARTHMERE_MAGIC_CHARGE_MAX_SECS)
          );
        }),
        `${boss.key} magic charge is outside the shared bounds`
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
    const attack = profile.rangedAttacks?.[0];
    assert.ok(attack);
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: attack.damageType,
      projectileVisualId: attack.projectileVisualId,
      attackDamage: attack.attackDamage,
      cooldownSecs: attack.cooldownSecs,
      attackShape: attack.attackShape,
    });
    const releaseTime = 50 + chargeTimeSecs;
    assert.equal(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: releaseTime,
        rangedState: {
          abilityId: "fireball",
          projectileVisualId: "fireball",
          castTime: 50,
          chargeTimeSecs,
          releaseTime,
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

  it("uses Anima's ranged cast time ahead of unrelated melee presentation markers", () => {
    const profile = allHarthmereNativeNpcCombatProfiles().find(
      ({ rangedAttacks, isBoss }) => !isBoss && rangedAttacks?.length
    );
    assert.ok(profile);
    const attack = profile.rangedAttacks?.[0];
    assert.ok(attack);
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: attack.damageType,
      projectileVisualId: attack.projectileVisualId,
      attackDamage: attack.attackDamage,
      cooldownSecs: attack.cooldownSecs,
      attackShape: attack.attackShape,
    });
    const rangedCastTime = harthmereNativeNpcProjectileAttackTime({
      isDead: false,
      activeEvade: false,
      emoteAttackTime: 73,
      retaliationAttackTime: 74,
      rangedCastTime: 75,
      rangedReleaseTime: 75 + chargeTimeSecs,
    });
    assert.equal(
      harthmereNativeNpcProjectileAttackTime({
        isDead: false,
        activeEvade: false,
        rangedCastTime: 75,
      }),
      75
    );
    assert.equal(rangedCastTime, 75 + chargeTimeSecs);
    assert.equal(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: rangedCastTime,
        rangedState: {
          abilityId: "fireball",
          projectileVisualId: "fireball",
          castTime: 75,
          chargeTimeSecs,
          releaseTime: 75 + chargeTimeSecs,
          aimPoint: [8, 1, 0],
        },
      })?.projectileVisualId,
      "fireball"
    );
    assert.equal(
      harthmereNativeNpcProjectileAttackTime({
        isDead: true,
        activeEvade: false,
        rangedCastTime: 75,
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
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: attack.damageType,
      projectileVisualId: attack.projectileVisualId,
      attackDamage: attack.attackDamage,
      cooldownSecs: attack.cooldownSecs,
      attackShape: attack.attackShape,
    });
    const releaseTime = 50 + chargeTimeSecs;
    assert.deepEqual(
      harthmereNativeNpcProjectilePresentation({
        profile,
        attackTime: releaseTime,
        rangedState: {
          abilityId: attack.abilityId,
          projectileVisualId: attack.projectileVisualId,
          castTime: 50,
          chargeTimeSecs,
          releaseTime,
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
        windupSecs: attack.castTimeSecs,
        magic: true,
        chargeTimeSecs,
        chargeStartedAt: 50,
        releaseTime,
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
    assert.equal(
      resolveHarthmereProjectileVisual({ attacker: "Indisworm" })?.id,
      "indisworm_poison_spit"
    );
  });

  it("keeps Gaia out of transient projectile presentation", () => {
    assert.deepEqual(HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS, []);
  });
});
