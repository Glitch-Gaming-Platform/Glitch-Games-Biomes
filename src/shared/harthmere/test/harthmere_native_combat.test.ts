import { TriggerState } from "@/shared/ecs/gen/components";
import { anItem } from "@/shared/game/item";
import {
  applyHarthmereNativeAttackStats,
  awardHarthmereNativeCombatXp,
  harthmereNativeItemCombatProfile,
  mitigateHarthmereNativeIncomingDamage,
  nativeCombatArmorStats,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
  harthmereNativeNpcCombatProfileForSeed,
  harthmereNativeNpcBiscuit,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import assert from "assert";
import {
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_PREMIUM_WEAPONS } from "@/shared/harthmere/premium_weapon_catalog";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";

describe("Harthmere native ECS combat rules", () => {
  before(() => ensureHarthmereNativeItemCatalogue());

  it("derives melee, heavy, ranged, and non-combat item rules from exact ids", () => {
    const sword = harthmereNativeItemCombatProfile(
      anItem(harthmereNativeBiomesIdForItemId("iron_longsword")!)
    );
    const heavy = harthmereNativeItemCombatProfile(
      anItem(harthmereNativeBiomesIdForItemId("two_handed_sword")!)
    );
    const bow = harthmereNativeItemCombatProfile(
      anItem(harthmereNativeBiomesIdForItemId("hunter_bow")!)
    );
    const muckwad = harthmereNativeItemCombatProfile(
      anItem(harthmereNativeBiomesIdForItemId("muckwad")!)
    );
    const spellScroll = harthmereNativeItemCombatProfile(
      anItem(harthmereNativeBiomesIdForItemId("scroll_of_spark")!)
    );

    assert.equal(sword?.kind, "melee");
    assert.equal(sword?.damagePerHit, 18);
    assert.equal(sword?.levelRequirement, 2);
    assert.equal(heavy?.kind, "heavy");
    assert.ok((heavy?.reach ?? 0) > (sword?.reach ?? 0));
    assert.equal(bow?.kind, "ranged");
    assert.equal(bow?.reach, 24);
    assert.equal(muckwad?.damagePerHit, 0);
    assert.equal(spellScroll?.kind, "spell");
    assert.equal(spellScroll?.damagePerHit, 0);
  });

  it("classifies every premium weapon from its authored profile and gives every damaging ranged or magic attack a visual", () => {
    for (const weapon of HARTHMERE_PREMIUM_WEAPONS) {
      const nativeId = harthmereNativeBiomesIdForItemId(weapon.id);
      assert.ok(nativeId, weapon.id);
      const profile = harthmereNativeItemCombatProfile(anItem(nativeId));
      assert.ok(profile, weapon.id);

      const expectedKind =
        weapon.profile === "ranged" || weapon.profile === "thrown"
          ? "ranged"
          : weapon.profile === "magic" || weapon.profile === "magicBook"
            ? "spell"
            : weapon.profile === "shield"
              ? "melee"
              : weapon.twoHanded
                ? "heavy"
                : "melee";
      assert.equal(profile.kind, expectedKind, weapon.id);

      if (
        profile.damagePerHit > 0 &&
        (profile.kind === "ranged" || profile.kind === "spell")
      ) {
        assert.ok(getHarthmereProjectileVisual(weapon.id), weapon.id);
      }
    }
  });

  it("stores combat level, cooldown, boss credit, and XP in TriggerState", () => {
    const state = TriggerState.create();
    writeHarthmereNativeCombatProgression(state, {
      level: 2,
      xp: 95,
      lastAttackMs: 1234,
      migrationVersion: 1,
    });
    const awarded = awardHarthmereNativeCombatXp(state, 250, true);

    assert.ok(awarded.level >= 3);
    assert.equal(awarded.bossKills, 1);
    assert.equal(awarded.lastAttackMs, 1234);
    assert.equal(awarded.migrationVersion, 1);
    assert.deepEqual(readHarthmereNativeCombatProgression(state), awarded);
  });

  it("applies level, armor, defense, and evasion mitigation deterministically", () => {
    assert.equal(
      mitigateHarthmereNativeIncomingDamage({
        rawDamage: 0,
        armor: 0,
        defense: 0,
        attackerLevel: 1,
        defenderLevel: 1,
      }),
      0
    );
    const leather = anItem(harthmereNativeBiomesIdForItemId("leather_armor")!);
    const shield = anItem(harthmereNativeBiomesIdForItemId("wooden_shield")!);
    const stats = nativeCombatArmorStats([leather, shield]);
    const unarmored = mitigateHarthmereNativeIncomingDamage({
      rawDamage: 80,
      armor: 0,
      defense: 0,
      evasion: 0,
      attackerLevel: 3,
      defenderLevel: 3,
    });
    const armored = mitigateHarthmereNativeIncomingDamage({
      rawDamage: 80,
      ...stats,
      attackerLevel: 3,
      defenderLevel: 3,
    });

    assert.ok(stats.armor > 0);
    assert.ok(stats.defense > 0);
    assert.ok(armored < unarmored);
    assert.equal(
      armored,
      mitigateHarthmereNativeIncomingDamage({
        rawDamage: 80,
        ...stats,
        attackerLevel: 3,
        defenderLevel: 3,
      })
    );
  });

  it("routes magical boss damage through magic resistance instead of physical armor", () => {
    const physical = mitigateHarthmereNativeIncomingDamage({
      rawDamage: 100,
      armor: 120,
      defense: 0,
      magicResistance: 0,
      damageType: "blunt",
      attackerLevel: 10,
      defenderLevel: 10,
    });
    const unresistedMagic = mitigateHarthmereNativeIncomingDamage({
      rawDamage: 100,
      armor: 120,
      defense: 0,
      magicResistance: 0,
      damageType: "arcane",
      attackerLevel: 10,
      defenderLevel: 10,
    });
    const resistedMagic = mitigateHarthmereNativeIncomingDamage({
      rawDamage: 100,
      armor: 120,
      defense: 0,
      magicResistance: 120,
      damageType: "arcane",
      attackerLevel: 10,
      defenderLevel: 10,
    });

    assert.ok(physical < unresistedMagic);
    assert.ok(resistedMagic < unresistedMagic);
    assert.equal(resistedMagic, physical);
  });

  it("applies strength, dexterity, intelligence, spell power, accuracy, and crits", () => {
    const levelOne = harthmereNativeLevelStats(1);
    const neutral = applyHarthmereNativeAttackStats({
      baseDamage: 20,
      kind: "melee",
      stats: levelOne,
      criticalSeed: [1, 2, 0],
    });
    assert.equal(neutral.damage, 20);
    assert.equal(neutral.critical, false);

    const levelTwenty = {
      ...harthmereNativeLevelStats(20),
      criticalChance: 0,
    };
    const melee = applyHarthmereNativeAttackStats({
      baseDamage: 20,
      kind: "melee",
      stats: levelTwenty,
      criticalSeed: [1, 2, 0],
    });
    const ranged = applyHarthmereNativeAttackStats({
      baseDamage: 20,
      kind: "ranged",
      stats: levelTwenty,
      criticalSeed: [1, 2, 0],
    });
    const spell = applyHarthmereNativeAttackStats({
      baseDamage: 20,
      kind: "spell",
      stats: levelTwenty,
      criticalSeed: [1, 2, 0],
    });
    assert.ok(melee.damage > neutral.damage);
    assert.ok(ranged.damage > neutral.damage);
    assert.ok(spell.damage > neutral.damage);

    const critical = applyHarthmereNativeAttackStats({
      baseDamage: 20,
      kind: "melee",
      stats: { ...levelOne, criticalChance: 1 },
      criticalSeed: [1, 2, 0],
    });
    assert.equal(critical.critical, true);
    assert.equal(critical.damage, 30);
  });

  it("keeps the Road Ahead Muckwad patch retaliation-only", () => {
    const roadSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
      (seed) => seed.areaId === "road_muckwad_patch"
    );
    assert.ok(roadSeed);
    const profile = harthmereNativeNpcCombatProfileForSeed(roadSeed);
    assert.equal(profile.behaviorKind, "retaliate");
    assert.deepEqual(profile.aggroTrigger, { kind: "onlyIfAttacked" });
  });

  it("makes only cows and sheep retaliate and move a little faster", () => {
    const seeds = harthmereGroundedLivestockSeedsInTerritory();
    const profileFor = (species: "cow" | "sheep" | "rabbit") => {
      const seed = seeds.find((candidate) => candidate.species === species);
      assert.ok(seed, `expected a ${species} seed`);
      return harthmereNativeNpcCombatProfileForSeed(seed);
    };

    for (const species of ["cow", "sheep"] as const) {
      const profile = profileFor(species);
      assert.equal(profile.attackIntervalSecs, 2.35);
      assert.equal(profile.walkSpeed, 1.65);
      assert.equal(profile.runSpeed, 3.5);
      assert.equal(profile.behaviorKind, "retaliate");
      assert.deepEqual(profile.aggroTrigger, { kind: "onlyIfAttacked" });
      assert.equal(profile.galoisPath, `npcs/${species}`);
      assert.equal(profile.attackStrikeMomentSecs, 0.68);
    }

    const rabbit = profileFor("rabbit");
    assert.equal(rabbit.attackIntervalSecs, 2.7);
    assert.equal(rabbit.walkSpeed, 2.4);
    assert.equal(rabbit.runSpeed, 4.4);
    assert.equal(rabbit.galoisPath, "npcs/rabbit");
    assert.equal(rabbit.attackStrikeMomentSecs, 0.56);
  });

  it("keeps native humans on player meshes and creatures on snapshot GLTFs", () => {
    const bandit = harthmereNativeNpcCombatProfileForSeed({
      seedId: "test-bandit",
      displayName: "Road Scout",
      kind: "ambient_bandit",
      banditRole: "scout",
    });
    const banditBiscuit = harthmereNativeNpcBiscuit(bandit);
    assert.equal(bandit.isPlayerLikeAppearance, true);
    assert.equal(bandit.galoisPath, undefined);
    assert.equal(banditBiscuit.isPlayerLikeAppearance, true);

    const mucker = harthmereNativeNpcCombatProfileForSeed({
      seedId: "test-mucker",
      displayName: "Old Wood Mucker",
      kind: "ambient_muck_monster",
      combatKind: "mux",
    });
    assert.equal(mucker.isPlayerLikeAppearance, undefined);
    assert.equal(mucker.galoisPath, "npcs/tree_mucker");
    assert.equal(
      harthmereNativeNpcBiscuit(mucker).galoisPath,
      "npcs/tree_mucker"
    );
  });

  it("gives the Indisworm human-scale melee and biological poison-spit combat", () => {
    const profile = harthmereNativeNpcCombatProfileForSeed({
      seedId: "test-indisworm",
      displayName: "Indisworm 1",
      kind: "ambient_muck_monster",
      combatKind: "mux",
      combatLevel: 3,
      combatHp: 92,
      attackDamage: 34,
      killXp: 55,
    });
    const biscuit = harthmereNativeNpcBiscuit(profile);
    const poisonSpit = profile.rangedAttacks?.find(
      (attack) => attack.abilityId === "indisworm_poison_spit"
    );

    assert.equal(profile.key, "monster_indisworm");
    assert.equal(profile.galoisPath, "npcs/indisworm");
    assert.equal(profile.attackDamage, 34);
    assert.equal(profile.attackDistance, 2.35);
    assert.equal(profile.attackStrikeMomentSecs, 0.95);
    assert.equal(profile.attackIntervalSecs, 2.9);
    assert.deepEqual(biscuit.boxSize, [1.05, 1.9, 1.05]);
    assert.ok(poisonSpit);
    assert.equal(poisonSpit.projectileVisualId, "indisworm_poison_spit");
    assert.equal(poisonSpit.damageType, "nature");
    assert.equal(poisonSpit.magic, false);
    assert.equal(poisonSpit.animationClip, "RangedAttack");
    assert.equal(poisonSpit.castTimeSecs, 1.15);
    assert.ok(poisonSpit.minimumDistance > profile.attackDistance);
  });
});
