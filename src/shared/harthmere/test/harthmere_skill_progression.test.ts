import assert from "assert";
import { TriggerState } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_SKILL_ACTION_COVERAGE,
  HARTHMERE_SKILL_IDS,
  awardHarthmereNativeSkillXp,
  createHarthmereSkillClientProjection,
  harthmereCraftingSkillAwards,
  harthmereNativeCombatSkillAwards,
  harthmereNativeFarmingSkillAwards,
  harthmereNativeGatheringSkillAwards,
  harthmereNativeMedicalSkillAwards,
  harthmereNativeSkillTriggerKey,
  harthmereNativeShieldSkillAwards,
  harthmereWorldInteractionSkillAwards,
  hasHarthmereNativeSkillProgression,
  normalizeHarthmereSkillId,
  readAllHarthmereNativeSkillTotalXp,
  readHarthmereNativeSkillTotalXp,
  writeHarthmereNativeSkillTotalXp,
} from "@/shared/harthmere/harthmere_skill_progression";
import {
  HARTHMERE_SKILL_DEFINITIONS,
  harthmereSkillTotalXpCap,
} from "@/shared/harthmere/mmo_class_ability_collectibles";
import {
  ensureHarthmereProductionCraftingCatalogue,
  harthmereProductionCraftingRecipeIds,
} from "@/shared/harthmere/mmo_crafting_catalogue";
import { getHarthmereCraftingRecipe } from "@/shared/harthmere/mmo_inventory_authority";

describe("Harthmere unified native skill progression", () => {
  it("has a documented user action for every skill definition", () => {
    assert.deepEqual(
      [...HARTHMERE_SKILL_IDS].sort(),
      Object.keys(HARTHMERE_SKILL_DEFINITIONS).sort()
    );
    assert.deepEqual(
      Object.keys(HARTHMERE_SKILL_ACTION_COVERAGE).sort(),
      [...HARTHMERE_SKILL_IDS].sort()
    );
    for (const skillId of HARTHMERE_SKILL_IDS) {
      assert.ok(
        HARTHMERE_SKILL_ACTION_COVERAGE[skillId]?.length,
        `${skillId} must describe at least one in-game training action`
      );
    }
  });

  it("stores, reads, combines, and caps every specialized skill in TriggerState", () => {
    const state = TriggerState.create();
    assert.equal(hasHarthmereNativeSkillProgression(state), false);
    const specialized = HARTHMERE_SKILL_IDS.filter(
      (skillId) => skillId !== "character_level"
    );
    const triggerKeys = specialized.map((skillId) =>
      harthmereNativeSkillTriggerKey(skillId)
    );
    assert.ok(triggerKeys.every((key) => key !== undefined));
    assert.equal(new Set(triggerKeys).size, specialized.length);
    assert.equal(
      harthmereNativeSkillTriggerKey("combat"),
      8_740_000_000_000_200
    );
    assert.equal(
      harthmereNativeSkillTriggerKey("business_operations"),
      8_740_000_000_000_232
    );
    awardHarthmereNativeSkillXp(
      state,
      specialized.flatMap((skillId) => [
        { skillId, xp: 3, source: "first" },
        { skillId, xp: 4, source: "second" },
      ])
    );
    assert.equal(hasHarthmereNativeSkillProgression(state), true);
    assert.deepEqual(
      readAllHarthmereNativeSkillTotalXp(state),
      Object.fromEntries(specialized.map((skillId) => [skillId, 7]))
    );
    for (const skillId of specialized) {
      writeHarthmereNativeSkillTotalXp(state, skillId, Number.MAX_SAFE_INTEGER);
      assert.equal(
        readHarthmereNativeSkillTotalXp(state, skillId),
        harthmereSkillTotalXpCap(skillId)
      );
    }
    assert.equal(
      writeHarthmereNativeSkillTotalXp(state, "character_level", 99),
      undefined
    );
  });

  it("projects the complete skill catalogue from native ECS while the live API snapshot is absent", () => {
    const state = TriggerState.create();
    writeHarthmereNativeSkillTotalXp(state, "farming", 504);
    assert.equal(hasHarthmereNativeSkillProgression(state), false);
    const projected = createHarthmereSkillClientProjection({
      triggerState: state,
      progressionSkills: [{ id: "mining", level: 2, xp: 250 }],
      characterProgression: { level: 3, xp: 327, nextLevel: 492 },
    });

    assert.equal(projected.length, HARTHMERE_SKILL_IDS.length);
    assert.deepEqual(
      projected.map((skill) => skill.id).sort(),
      [...HARTHMERE_SKILL_IDS].sort()
    );
    assert.ok(
      projected.every((skill) => skill.trainingActions.length > 0),
      "every projected row must explain how the player trains it"
    );
    const character = projected.find((skill) => skill.id === "character_level");
    assert.equal(character?.level, 3);
    assert.equal(character?.xp, 327);
    assert.equal(character?.nextLevel, 492);
    const farming = projected.find((skill) => skill.id === "farming");
    assert.ok((farming?.level ?? 0) >= 1);
    assert.ok((farming?.xp ?? 0) > 0);
    const mining = projected.find((skill) => skill.id === "mining");
    assert.equal(mining?.level, 2);
    assert.equal(mining?.xp, 250);
  });

  it("uses native zeroes only after the complete skill ledger is initialized", () => {
    const state = TriggerState.create();
    for (const skillId of HARTHMERE_SKILL_IDS) {
      if (skillId !== "character_level") {
        writeHarthmereNativeSkillTotalXp(state, skillId, 0);
      }
    }
    writeHarthmereNativeSkillTotalXp(state, "farming", 504);
    assert.equal(hasHarthmereNativeSkillProgression(state), true);

    const projected = createHarthmereSkillClientProjection({
      triggerState: state,
      progressionSkills: [
        { id: "farming", level: 2, xp: 500 },
        { id: "mining", level: 3, xp: 250 },
      ],
      characterProgression: { level: 1, xp: 0, nextLevel: 100 },
    });
    const farming = projected.find((skill) => skill.id === "farming");
    const mining = projected.find((skill) => skill.id === "mining");
    assert.equal(farming?.level, 1);
    assert.equal(farming?.xp, 504);
    assert.equal(mining?.level, 1);
    assert.equal(mining?.xp, 0);
  });

  it("maps validated combat equipment and damage to the correct mastery rows", () => {
    const bowAwards = harthmereNativeCombatSkillAwards({
      itemId: "oak_longbow",
      kind: "ranged",
      damage: 24,
    });
    assert.equal(
      bowAwards.filter((award) => award.skillId === "archery").length,
      1,
      "one bow hit must produce exactly one Archery award"
    );
    const skillIds = new Set(
      [
        ...harthmereNativeCombatSkillAwards({
          itemId: "iron_dagger",
          kind: "melee",
          damage: 24,
        }),
        ...bowAwards,
        ...harthmereNativeCombatSkillAwards({
          itemId: "holy_smite_spell",
          kind: "spell",
          damage: 24,
        }),
        ...harthmereNativeCombatSkillAwards({
          itemId: "death_shadow_curse",
          kind: "spell",
          damage: 24,
        }),
        ...harthmereNativeCombatSkillAwards({
          itemId: "nature_thorn_spell",
          kind: "spell",
          damage: 24,
        }),
        ...harthmereNativeCombatSkillAwards({
          itemId: "fireball_spell",
          kind: "spell",
          damage: 24,
        }),
        ...harthmereNativeShieldSkillAwards({
          equippedItemIds: ["wooden_shield"],
          damagePrevented: 20,
        }),
      ].map((award) => award.skillId)
    );
    for (const skillId of [
      "combat",
      "melee_combat",
      "dagger_mastery",
      "ranged_combat",
      "archery",
      "holy_magic",
      "shadow_magic",
      "death_lore",
      "nature_magic",
      "fire_magic",
      "shield_mastery",
    ]) {
      assert.ok(skillIds.has(skillId), `${skillId} needs a combat action`);
    }
  });

  it("awards medicine only when a native medical consumable restores health", () => {
    assert.deepEqual(
      harthmereNativeMedicalSkillAwards({
        itemId: "health_potion",
        healthRestored: 25,
      }).map((award) => award.skillId),
      ["medicine"]
    );
    assert.deepEqual(
      harthmereNativeMedicalSkillAwards({
        itemId: "holy_revival_tonic",
        healthRestored: 25,
      }).map((award) => award.skillId),
      ["medicine", "holy_magic"]
    );
    assert.deepEqual(
      harthmereNativeMedicalSkillAwards({
        itemId: "health_potion",
        healthRestored: 0,
      }),
      []
    );
  });

  it("maps crafting professions and legacy aliases to real skill rows", () => {
    const professions = [
      "blacksmithing",
      "leatherworking",
      "carpentry",
      "tailoring",
      "alchemy",
      "enchanting",
      "exotic_refining",
      "bell_forging",
    ];
    for (const professionId of professions) {
      const awards = harthmereCraftingSkillAwards({
        professionId,
        xp: 20,
        source: "test_craft",
      });
      assert.equal(
        awards.find((award) => award.skillId === "crafting")?.xp,
        20
      );
      assert.equal(
        awards.find((award) => award.skillId === professionId)?.xp,
        20
      );
    }
    assert.equal(normalizeHarthmereSkillId("smithing"), "blacksmithing");
    assert.equal(normalizeHarthmereSkillId("logging"), "gathering");
    assert.equal(normalizeHarthmereSkillId("trading"), "business_operations");
    assert.equal(normalizeHarthmereSkillId("community"), "persuasion");
  });

  it("backs every crafting profession with at least one executable recipe", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const recipes = harthmereProductionCraftingRecipeIds()
      .map((recipeId) => getHarthmereCraftingRecipe(recipeId))
      .filter((recipe) => recipe !== undefined);
    for (const professionId of [
      "cooking",
      "blacksmithing",
      "leatherworking",
      "carpentry",
      "tailoring",
      "alchemy",
      "enchanting",
      "exotic_refining",
      "bell_forging",
    ]) {
      assert.ok(
        recipes.some(
          (recipe) =>
            normalizeHarthmereSkillId(
              recipe.professionId ?? recipe.requiredSkillId
            ) === professionId
        ),
        `${professionId} needs at least one real crafting recipe`
      );
    }
  });

  it("maps authored world and resource actions to exploration, social, and gathering skills", () => {
    const awards = [
      ...harthmereWorldInteractionSkillAwards({
        kind: "open_gate",
        label: "Locked garden gate",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "inspect",
        label: "Ancient arcane rune machine",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "inspect",
        label: "Grave crypt spirit",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "inspect",
        label: "Living grove tree",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "inspect",
        label: "Hoof track rubbing",
      }),
      ...harthmereWorldInteractionSkillAwards({ kind: "practice" }),
      ...harthmereWorldInteractionSkillAwards({ kind: "repair" }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "gather",
        label: "River fishing pool",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "gather",
        label: "Crystal ore deposit",
      }),
      ...harthmereNativeGatheringSkillAwards({
        sourceId: "wildlife_tracks",
        tracking: true,
      }),
    ];
    const skillIds = new Set(awards.map((award) => award.skillId));
    for (const skillId of [
      "lockpicking",
      "arcane_literacy",
      "death_lore",
      "shadow_magic",
      "nature_magic",
      "tracking",
      "performance",
      "crafting",
      "carpentry",
      "gathering",
      "fishing",
      "mining",
      "tracking",
    ]) {
      assert.ok(skillIds.has(skillId), `${skillId} needs a world action`);
    }
  });

  it("has an executable award path for every specialized skill", () => {
    const awards = [
      ...harthmereNativeCombatSkillAwards({
        itemId: "iron_dagger",
        kind: "melee",
        damage: 24,
      }),
      ...harthmereNativeCombatSkillAwards({
        itemId: "oak_longbow",
        kind: "ranged",
        damage: 24,
      }),
      ...harthmereNativeCombatSkillAwards({
        itemId: "holy_smite_spell",
        kind: "spell",
        damage: 24,
      }),
      ...harthmereNativeCombatSkillAwards({
        itemId: "death_shadow_curse",
        kind: "spell",
        damage: 24,
      }),
      ...harthmereNativeCombatSkillAwards({
        itemId: "nature_thorn_spell",
        kind: "spell",
        damage: 24,
      }),
      ...harthmereNativeCombatSkillAwards({
        itemId: "fireball_spell",
        kind: "spell",
        damage: 24,
      }),
      ...harthmereNativeShieldSkillAwards({
        equippedItemIds: ["wooden_shield"],
        damagePrevented: 20,
      }),
      ...harthmereNativeMedicalSkillAwards({
        itemId: "health_potion",
        healthRestored: 25,
      }),
      ...harthmereNativeFarmingSkillAwards("harvest"),
      ...harthmereNativeGatheringSkillAwards({
        sourceId: "tracked_crystal_fishing_pool",
        mining: true,
        fishing: true,
        tracking: true,
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "open_gate",
        label: "Locked garden gate",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "read",
        label: "Arcane runes",
      }),
      ...harthmereWorldInteractionSkillAwards({
        kind: "inspect",
        label: "Grave crypt spirit",
      }),
      ...harthmereWorldInteractionSkillAwards({ kind: "practice" }),
      ...harthmereWorldInteractionSkillAwards({ kind: "repair" }),
      ...harthmereWorldInteractionSkillAwards({ kind: "tend" }),
      ...[
        "cooking",
        "blacksmithing",
        "leatherworking",
        "carpentry",
        "tailoring",
        "alchemy",
        "enchanting",
        "exotic_refining",
        "bell_forging",
      ].flatMap((professionId) =>
        harthmereCraftingSkillAwards({
          professionId,
          xp: 20,
          source: "test_craft",
        })
      ),
    ];
    const executable = new Set(awards.map((award) => award.skillId));
    // These two are deliberately awarded by accepted live-mode reducer actions
    // and have dedicated reducer tests in live_mode_skill_progression.test.ts.
    executable.add("persuasion");
    executable.add("business_operations");

    assert.deepEqual(
      [...executable].sort(),
      HARTHMERE_SKILL_IDS.filter(
        (skillId) => skillId !== "character_level"
      ).sort()
    );
  });
});
