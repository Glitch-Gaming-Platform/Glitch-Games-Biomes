import assert from "assert";
import {
  applyHarthmereClassChoiceV1,
  applyHarthmereSpecializationChoiceV1,
  canLearnHarthmereAbilityV1,
  createHarthmereProgressionClientSnapshotV1,
  HARTHMERE_ABILITY_DEFINITIONS_V1,
  HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1,
  HARTHMERE_CLASS_DEFINITIONS_V1,
  HARTHMERE_COLLECTIBLE_DEFINITIONS_V1,
  HARTHMERE_SKILL_XP_PER_LEVEL_V1,
} from "../mmo_class_ability_collectibles_v1";
import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES_V1,
  defaultHarthmereProductionEconomyStateV1,
  type HarthmereEconomyBusinessTypeIdV1,
} from "../mmo_economy_authority_v1";
import { SNAPSHOT_GROVE_NPCS_V75 } from "../snapshot_grove_content_v75";

const ACTOR = "player_progression_001";

function economyWithBusiness(typeId: HarthmereEconomyBusinessTypeIdV1) {
  const economy = defaultHarthmereProductionEconomyStateV1();
  const def = HARTHMERE_ECONOMY_BUSINESS_TYPES_V1[typeId];
  economy.businesses[`business_${typeId}`] = {
    businessId: `business_${typeId}`,
    ownerKind: "player",
    ownerId: ACTOR,
    typeId,
    name: `${def.displayName} Test`,
    status: "open",
    licenseClass: def.requiredLicense,
    licenseLevel: def.minimumLicenseLevel,
    regionId: "harthmere_grove",
    inventory: {},
    storageMaxSlots: def.baseStorageSlots,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 0,
    customerSatisfaction: 50,
    sanitationRating: 50,
    safetyRating: 50,
    serviceRadius: 1,
    priceModifiers: {},
    balanceGold: 0,
    debtGold: 0,
    upkeepGoldPerDay: def.baseUpkeepGoldPerDay,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: 0,
    lastTickAtMs: 0,
    createdAtMs: 0,
    updatedAtMs: 0,
    flags: {},
  };
  return economy;
}

describe("mmo_class_ability_collectibles_v1", () => {
  it("defines every playable class without placeholder fallbacks", () => {
    assert.equal(Object.keys(HARTHMERE_CLASS_DEFINITIONS_V1).length, 9);
    for (const cls of Object.values(HARTHMERE_CLASS_DEFINITIONS_V1)) {
      assert.ok(cls.name.length > 0);
      assert.ok(cls.tagline.length > 20);
      assert.ok(cls.specializations.length >= 3);
      assert.ok(cls.startingAbilities.length >= 3);
    }
  });

  it("creates exactly ten relevant business abilities for each economy business", () => {
    for (const typeId of Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1)) {
      const abilities = Object.values(HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1)
        .filter((ability) => ability.businessTypeId === typeId);
      assert.equal(abilities.length, 10, typeId);
      for (const ability of abilities) {
        assert.ok(ability.description.includes("Uses "), ability.id);
        assert.ok(ability.name.startsWith(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1[typeId as HarthmereEconomyBusinessTypeIdV1].displayName));
      }
    }
  });

  it("gates business abilities by owned business type and skill", () => {
    const courierAbility = Object.values(HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1)
      .find((ability) => ability.businessTypeId === "courier")!;
    const classMagic = {
      classId: "warrior",
      knownAbilities: [],
      skills: { business_operations: { xp: 0, level: 1 } },
      loadout: {},
    };
    assert.equal(canLearnHarthmereAbilityV1({ classMagic, actorId: ACTOR, abilityId: courierAbility.id }).ok, false);
    assert.equal(canLearnHarthmereAbilityV1({
      classMagic,
      actorId: ACTOR,
      economy: economyWithBusiness("courier"),
      abilityId: courierAbility.id,
    }).ok, true);
  });

  it("seeds a first class choice with starting abilities and skills", () => {
    const classMagic: any = { knownAbilities: [], skills: {}, loadout: {} };
    const result = applyHarthmereClassChoiceV1(classMagic, "mage");

    assert.equal(result.ok, true);
    assert.equal(classMagic.classId, "mage");
    assert.ok(classMagic.knownAbilities.includes("spark"));
    assert.equal(classMagic.skills.fire_magic.level, 1);
  });

  it("accepts only specializations available to the current class", () => {
    const classMagic: any = { classId: "warrior", knownAbilities: [], skills: {}, loadout: {} };

    const valid = applyHarthmereSpecializationChoiceV1(classMagic, "protection");
    assert.equal(valid.ok, true);
    assert.equal(classMagic.specializationId, "protection");

    const invalid = applyHarthmereSpecializationChoiceV1(classMagic, "pyromancer");
    assert.equal(invalid.ok, false);
    assert.equal(invalid.warning, "specialization_rejected:not_available_for_class");
    assert.equal(classMagic.specializationId, "protection");
  });

  it("clears stale specialization on authorized class change", () => {
    const classMagic: any = {
      classId: "warrior",
      specializationId: "protection",
      knownAbilities: ["power_strike"],
      skills: { melee_combat: { xp: 0, level: 1 } },
      loadout: { slot_0: "power_strike" },
    };
    const result = applyHarthmereClassChoiceV1(classMagic, "mage", { allowClassChange: true });

    assert.equal(result.ok, true);
    assert.equal(classMagic.classId, "mage");
    assert.equal(classMagic.specializationId, undefined);
  });

  it("rejects normal class switching and preserves the old class/loadout", () => {
    const classMagic = {
      classId: "warrior",
      knownAbilities: ["basic_strike", "power_strike"],
      skills: { melee_combat: { xp: 0, level: 1 } },
      loadout: { slot_0: "power_strike" },
    };
    const result = applyHarthmereClassChoiceV1(classMagic, "mage");

    assert.equal(result.ok, false);
    assert.equal(result.warning, "class_rejected:class_change_requires_respec_service");
    assert.equal(classMagic.classId, "warrior");
    assert.deepEqual(classMagic.loadout, { slot_0: "power_strike" });
  });

  it("cleans old class abilities and loadout when an authorized class change is applied", () => {
    const classMagic = {
      classId: "warrior",
      knownAbilities: ["basic_strike", "power_strike", "rumor_song"],
      skills: { melee_combat: { xp: 0, level: 1 } },
      loadout: { slot_0: "power_strike", slot_1: "rumor_song" },
    };
    const result = applyHarthmereClassChoiceV1(classMagic, "bard", { allowClassChange: true });

    assert.equal(result.ok, true);
    assert.equal(classMagic.classId, "bard");
    assert.ok(!classMagic.knownAbilities.includes("power_strike"));
    assert.ok(classMagic.knownAbilities.includes("song_of_courage"));
    assert.deepEqual(classMagic.loadout, { slot_1: "rumor_song" });
  });

  it("projects class, skills, abilities, loadout, and collections for the UI", () => {
    const abilityId = Object.keys(HARTHMERE_ABILITY_DEFINITIONS_V1)[0];
    const snapshot = createHarthmereProgressionClientSnapshotV1({
      actorId: ACTOR,
      classMagic: {
        classId: "warrior",
        knownAbilities: [abilityId],
        skills: { business_operations: { xp: 25, level: 1 } },
        loadout: { slot_0: abilityId },
      },
      economy: economyWithBusiness("courier"),
      collections: { discovered: { "npc:jackie": 1 } },
    });
    assert.equal(snapshot.currentClassId, "warrior");
    assert.equal(snapshot.classSelected, true);
    assert.equal(snapshot.classChoiceLocked, true);
    assert.ok(snapshot.classes.some((entry) => entry.id === "warrior" && entry.specializations.includes("protection")));
    assert.equal(snapshot.equipped[0], abilityId);
    assert.ok(snapshot.abilities.some((ability) => ability.id === abilityId && ability.known));
    assert.ok(snapshot.collections.some((entry) => entry.id === "npc:jackie" && entry.discovered));
    assert.ok(Object.keys(HARTHMERE_COLLECTIBLE_DEFINITIONS_V1).length > SNAPSHOT_GROVE_NPCS_V75.length);
  });

  it("projects skill XP as current-level progress instead of lifetime XP", () => {
    const snapshot = createHarthmereProgressionClientSnapshotV1({
      actorId: ACTOR,
      classMagic: {
        classId: "warrior",
        knownAbilities: [],
        skills: { combat: { xp: 1250, level: 1 } },
        loadout: {},
      },
    });
    const combat = snapshot.skills.find((skill) => skill.id === "combat")!;
    assert.equal(combat.level, 2);
    assert.equal(combat.xp, 250);
    assert.equal(combat.nextLevel, HARTHMERE_SKILL_XP_PER_LEVEL_V1);
  });

  it("keeps capped skills at a full but bounded progress bar", () => {
    const snapshot = createHarthmereProgressionClientSnapshotV1({
      actorId: ACTOR,
      classMagic: {
        classId: "warrior",
        knownAbilities: [],
        skills: { character_level: { xp: 999_999, level: 999 } },
        loadout: {},
      },
    });
    const characterLevel = snapshot.skills.find((skill) => skill.id === "character_level")!;
    assert.equal(characterLevel.level, 100);
    assert.equal(characterLevel.xp, HARTHMERE_SKILL_XP_PER_LEVEL_V1);
    assert.equal(characterLevel.nextLevel, HARTHMERE_SKILL_XP_PER_LEVEL_V1);
  });

  it("keeps every Grove NPC backed by a real backstory", () => {
    const missing = SNAPSHOT_GROVE_NPCS_V75
      .filter((npc) => npc.seedServerNpc && npc.homeArea === "the_grove")
      .filter((npc) => !npc.background || npc.background.trim().length < 20)
      .map((npc) => npc.id);
    assert.deepEqual(missing, []);
  });

  it("lets every class learn all of its own (non-business) starting abilities from its starting skills", () => {
    for (const [classId, classDef] of Object.entries(HARTHMERE_CLASS_DEFINITIONS_V1)) {
      const skills: Record<string, { level: number }> = {};
      for (const [skillId, level] of Object.entries(classDef.startingSkills)) {
        skills[skillId] = { level: level as number };
      }
      const classMagic = { classId, skills } as Parameters<typeof canLearnHarthmereAbilityV1>[0]["classMagic"];
      for (const abilityId of classDef.startingAbilities) {
        const ability = HARTHMERE_ABILITY_DEFINITIONS_V1[abilityId];
        // Skip business abilities (gated on business ownership, not class skills) and any
        // ability not in the core catalog.
        if (!ability || ability.businessTypeId) continue;
        const res = canLearnHarthmereAbilityV1({ classMagic, actorId: ACTOR, abilityId });
        assert.ok(res.ok, `${classId} cannot learn its starting ability ${abilityId}: ${res.warning}`);
      }
    }
  });
});
