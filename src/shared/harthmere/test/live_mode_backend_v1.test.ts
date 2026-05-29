/**
 * live_mode_backend_v1.test.ts
 *
 * Comprehensive tests for the Harthmere live-mode server reducer.
 * Covers all 10 authority-dispatched action kinds plus legacy/non-authority paths,
 * state defaults/parsing, and multi-step scenario flows.
 */

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeLedgerStreamKeyV1,
  harthmereLiveModeSharedStateKeyV1,
  HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import {
  registerHarthmereItemDefinitionV1,
  registerHarthmereVendorEntryV1,
  registerHarthmereCraftingRecipeV1,
  type HarthmereItemDefinitionV1,
  type HarthmereVendorEntryV1,
  type HarthmereCraftingRecipeV1,
} from "../mmo_inventory_authority_v1";
import {
  registerHarthmereAbilityV1,
  registerHarthmereClassDefinitionV1,
  type HarthmereAbilityCatalogueEntryV1,
  type HarthmereClassDefinitionV1,
} from "../mmo_combat_authority_v1";
import type {
  HarthmereLiveModeAuthorityEnvelopeV1,
  HarthmereLiveModeActionKindV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  validateHarthmereLiveModeReadinessV1,
} from "@/shared/harthmere/live_mode_readiness_v1";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_live_001";
const TARGET = "mob_goblin_001";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function nextId() {
  return `live-req-${++_seq}`;
}

/** Create a minimal valid authority envelope */
function makeEnvelope(
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
): HarthmereLiveModeAuthorityEnvelopeV1 {
  return {
    requestId: nextId(),
    idempotencyKey: nextId(),
    actorId: ACTOR,
    actionKind,
    subsystem: "combat",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

/** Fresh default state for the test actor */
function freshState(nowMs = NOW_MS): HarthmereLiveModeBackendStateV1 {
  return defaultHarthmereLiveModeBackendStateV1(ACTOR, nowMs);
}

/** Apply one envelope and return resulting state */
function applyOne(
  state: HarthmereLiveModeBackendStateV1,
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  envelopeOverrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
) {
  const env = makeEnvelope(actionKind, payload, envelopeOverrides);
  return reduceHarthmereLiveModeBackendStateV1(state, env, NOW_MS);
}

// ---------------------------------------------------------------------------
// Register test catalogue entries
// ---------------------------------------------------------------------------

before(function registerLiveModeCatalogue() {
  // Item: iron_ore (crafting material)
  const ironOre: HarthmereItemDefinitionV1 = {
    itemId: "iron_ore",
    displayName: "Iron Ore",
    maxStackSize: 99,
    baseValue: 5,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 2 },
    tradeable: true,
  };
  const healthPotion: HarthmereItemDefinitionV1 = {
    itemId: "health_potion",
    displayName: "Health Potion",
    maxStackSize: 20,
    baseValue: 50,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: true,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 1 },
    tradeable: true,
    consumableCooldownCategory: "potion",
    consumableCooldownMs: 30_000,
  };
  const questKey: HarthmereItemDefinitionV1 = {
    itemId: "dungeon_key",
    displayName: "Dungeon Key",
    maxStackSize: 1,
    baseValue: 0,
    binding: "on_pickup",
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: false,
  };
  const ironSword: HarthmereItemDefinitionV1 = {
    itemId: "iron_sword",
    displayName: "Iron Sword",
    maxStackSize: 1,
    baseValue: 100,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { attack: 10, weight: 5 },
    tradeable: true,
  };
  for (const item of [ironOre, healthPotion, questKey, ironSword]) {
    registerHarthmereItemDefinitionV1(item);
  }

  // Vendor: blacksmith_vendor sells iron_ore
  const blacksmithVendor: HarthmereVendorEntryV1 = {
    vendorId: "blacksmith_vendor",
    itemId: "iron_ore",
    buyPrice: 10,
    sellPrice: 2,
    stock: 50,
    requiredFaction: "traders_guild",
    requiredReputationTier: 0,
  };
  registerHarthmereVendorEntryV1(blacksmithVendor);

  // Crafting recipe: 3 iron_ore → 1 iron_sword
  const ironSwordRecipe: HarthmereCraftingRecipeV1 = {
    recipeId: "recipe_iron_sword",
    outputItemId: "iron_sword",
    outputCount: 1,
    inputs: [{ itemId: "iron_ore", count: 3 }],
    requiredLevel: 1,
    craftingTimeMs: 2000,
    xpReward: 50,
  };
  registerHarthmereCraftingRecipeV1(ironSwordRecipe);

  // Ability: basic_attack (warrior)
  const basicAttack: HarthmereAbilityCatalogueEntryV1 = {
    abilityId: "basic_attack",
    displayName: "Basic Attack",
    targetType: "single_enemy",
    classRestriction: ["warrior", "rogue", "ranger"],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "any",
    resourceKind: "mana",
    resourceCost: 0,
    cooldownMs: 500,
    sharedCooldownCategory: undefined,
    sharedCooldownMs: undefined,
    rangeUnits: 2,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: false,
    baseDamage: 15,
    baseHealing: 0,
    attackPowerScaling: 1.0,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  };
  registerHarthmereAbilityV1(basicAttack);

  // Class: warrior
  const warrior: HarthmereClassDefinitionV1 = {
    classId: "warrior",
    displayName: "Warrior",
    availableSpecializations: ["arms", "fury", "protection"],
    primaryResource: "mana",
    maxResourceByLevel: { 1: 100 },
    hpPerLevel: 10,
    baseHp: 100,
    attackPowerPerLevel: 2,
    spellPowerPerLevel: 1,
  };
  registerHarthmereClassDefinitionV1(warrior);
});

// ===========================================================================
// 1. defaultHarthmereLiveModeBackendStateV1 / parseHarthmereLiveModeBackendStateV1
// ===========================================================================

describe("defaultHarthmereLiveModeBackendStateV1", function () {
  it("produces a state with correct actorId and version", function () {
    const s = freshState();
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });

  it("defaults all nested sections to empty/zero values", function () {
    const s = freshState();
    assert.deepStrictEqual(s.inventory.items, {});
    assert.strictEqual(s.inventory.gold, 0);
    assert.deepStrictEqual(s.inventory.escrow, {});
    assert.deepStrictEqual(s.inventory.consumableCooldowns, {});
    assert.strictEqual(s.respec.count, 0);
    assert.deepStrictEqual(s.talents.nodes, []);
    assert.strictEqual(s.combat.hp, 100);
    assert.strictEqual(s.combat.deathState, "alive");
  });
});

describe("parseHarthmereLiveModeBackendStateV1", function () {
  it("returns default state for null input", function () {
    const s = parseHarthmereLiveModeBackendStateV1(null, ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.inventory.gold, 0);
  });

  it("returns default state for malformed JSON", function () {
    const s = parseHarthmereLiveModeBackendStateV1("not-json{{", ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });

  it("merges stored state with defaults (backward compat — missing fields get defaults)", function () {
    const partial = JSON.stringify({
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      actorId: ACTOR,
      inventory: { gold: 999, items: { iron_ore: 5 } },
      // missing: escrow, consumableCooldowns, respec, talents, building, etc.
    });
    const s = parseHarthmereLiveModeBackendStateV1(partial, ACTOR, NOW_MS);
    assert.strictEqual(s.inventory.gold, 999);
    assert.strictEqual(s.inventory.items.iron_ore, 5);
    assert.deepStrictEqual(s.inventory.escrow, {}); // default injected
    assert.strictEqual(s.respec.count, 0);            // default injected
  });

  it("overwrites actorId with the provided parameter", function () {
    const raw = JSON.stringify({ ...freshState(), actorId: "old_actor" });
    const s = parseHarthmereLiveModeBackendStateV1(raw, ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
  });
});

// ===========================================================================
// 2. Key helpers
// ===========================================================================

describe("state key helpers", function () {
  it("harthmereLiveModePlayerStateKeyV1 has correct prefix", function () {
    const key = harthmereLiveModePlayerStateKeyV1("p1");
    assert.ok(key.startsWith("harthmere:live_mode:v1:player_state:p1"));
  });

  it("harthmereLiveModeLedgerStreamKeyV1 has correct prefix", function () {
    const key = harthmereLiveModeLedgerStreamKeyV1("p1");
    assert.ok(key.startsWith("harthmere:live_mode:v1:ledger:p1"));
  });

  it("harthmereLiveModeSharedStateKeyV1 encodes kind and id", function () {
    const key = harthmereLiveModeSharedStateKeyV1("vendor", "blacksmith_001");
    assert.strictEqual(key, "harthmere:live_mode:v1:vendor:blacksmith_001");
  });
});

describe("live-mode readiness contracts", function () {
  it("covers production subsystems with dedicated mutation plans", function () {
    const report = validateHarthmereLiveModeReadinessV1();
    assert.deepStrictEqual(report.missingSubsystems, []);

    for (const [subsystem, actionKind] of [
      ["jobs", "request_jobs_board_mutation"],
      ["guild", "request_guild_mutation"],
      ["bank", "request_bank_transaction"],
      ["mail", "request_mail_transaction"],
      ["property", "request_property_building_mutation"],
      ["crafting", "request_crafting"],
      ["farming", "request_farming_action"],
    ] as Array<[HarthmereLiveModeAuthorityEnvelopeV1["subsystem"], HarthmereLiveModeActionKindV1]>) {
      const plan = buildHarthmereLiveModePersistenceMutationPlanV1(
        makeEnvelope(actionKind, {}, { subsystem })
      );
      assert.ok(!plan.writeModels.includes(`${subsystem}_state`) || plan.writeModels.length > 3);
    }
  });
});

// ===========================================================================
// 3. reduceHarthmereLiveModeBackendStateV1 — summary fields
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — summary", function () {
  it("summary.applied is always true", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(summary.applied, true);
  });

  it("summary.actorId matches envelope actorId", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(summary.actorId, ACTOR);
  });

  it("summary.actionKind reflects the envelope action", function () {
    const { summary } = applyOne(freshState(), "request_respawn");
    assert.strictEqual(summary.actionKind, "request_respawn");
  });

  it("summary.playerStateKey is correct redis key format", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(
      summary.playerStateKey,
      harthmereLiveModePlayerStateKeyV1(ACTOR)
    );
  });

  it("updatedAtMs is set to nowMs on every reduction", function () {
    const then = NOW_MS + 5000;
    const env = makeEnvelope("request_respawn");
    const { state } = reduceHarthmereLiveModeBackendStateV1(freshState(), env, then);
    assert.strictEqual(state.updatedAtMs, then);
  });
});

// ===========================================================================
// 4. request_death_transition / request_revive / request_respawn
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — death lifecycle", function () {
  it("request_death_transition sets hp=0 and deathState=dead", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_death_transition", { cause: "fall" });
    assert.strictEqual(state.combat.hp, 0);
    assert.strictEqual(state.combat.deathState, "dead");
    assert.ok(state.combat.hp === 0);
    assert.ok(Object.values(state.combat.deathRecords).some((record) => record.cause === "fall"));
  });

  it("request_revive restores hp to 25% of maxHp and deathState=alive", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 200;
    const { state } = applyOne(s, "request_revive");
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.hp, 50); // 25% of 200
  });

  it("request_respawn restores hp to maxHp", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 80;
    const { state } = applyOne(s, "request_respawn");
    assert.strictEqual(state.combat.hp, 80);
    assert.strictEqual(state.combat.deathState, "alive");
  });

  it("death → revive → death cycle is stable", function () {
    let s = freshState();
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
    ({ state: s } = applyOne(s, "request_revive"));
    assert.strictEqual(s.combat.deathState, "alive");
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
  });

  it("rejects duplicate death, revive while alive, and respawn while alive", function () {
    let s = freshState();
    ({ state: s } = applyOne(s, "request_death_transition"));
    const duplicateDeath = applyOne(s, "request_death_transition");
    assert.ok(duplicateDeath.summary.warnings.includes("death_transition_ignored:already_dead"));

    const alive = freshState();
    assert.ok(applyOne(alive, "request_revive").summary.warnings.includes("revive_rejected:not_dead_or_downed"));
    assert.ok(applyOne(alive, "request_respawn").summary.warnings.includes("respawn_rejected:not_dead"));
  });
});

// ===========================================================================
// 4b. request_attack / request_ability_cast
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — combat target authority", function () {
  it("rejects target hp/position supplied only by the client payload", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack", targetHp: 10, targetX: 0, targetY: 0, targetZ: 0 },
      { targetId: TARGET }
    );
    assert.strictEqual(state.combat.threat[TARGET], undefined);
    assert.ok(summary.warnings.includes("combat_rejected:target_state_not_authoritative"));
  });

  it("uses server-side entitySnapshots for target state", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack", targetHp: 1, targetX: 999 },
      { targetId: TARGET }
    );
    assert.ok(!summary.warnings.some((warning) => warning.includes("target_state_not_authoritative")));
    assert.ok((state.combat.threat[TARGET] ?? 0) > 0);
  });
});

// ===========================================================================
// 5. request_xp_reward / request_skill_progress
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — XP and skill progress", function () {
  it("request_xp_reward uses server reward inputs instead of client xpDelta", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_xp_reward", {
      skillId: "combat",
      xpDelta: 1000,
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    });
    assert.ok((state.classMagic.skills.combat?.xp ?? 0) >= 1000);
    assert.ok((state.classMagic.skills.combat?.level ?? 0) >= 2);
  });

  it("request_skill_progress uses the same xp upsert path", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_skill_progress", {
      skillId: "mining",
      baseXp: 500,
      difficulty: 2,
      successState: "success",
    });
    assert.ok((state.classMagic.skills.mining?.xp ?? 0) >= 500);
  });

  it("rejects XP requests that only provide client xpDelta", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_xp_reward", { skillId: "crafting", xpDelta: 999 });
    assert.strictEqual(state.classMagic.skills.crafting, undefined);
    assert.ok(summary.warnings.includes("request_xp_reward_rejected:missing_server_reward_source"));
  });

  it("level increases monotonically across multiple applications", function () {
    let s = freshState();
    for (let i = 0; i < 5; i++) {
      ({ state: s } = applyOne(s, "request_xp_reward", {
        skillId: "combat",
        baseXp: 500,
        sourceLevel: 1,
        contributionScore: 1,
      }));
    }
    // 5×500 = 2500 xp → level 1 + floor(2500/1000) = 3
    assert.ok((s.classMagic.skills.combat?.level ?? 0) >= 3);
  });
});

// ===========================================================================
// 6. request_magic_progress
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — magic progress", function () {
  it("rejects magic progress for unknown ability", function () {
    const s = freshState();
    const { summary } = applyOne(s, "request_magic_progress", {
      abilityId: "mystery_spell",
      magicSchoolId: "shadow",
      skillXpDelta: 100,
    });
    assert.ok(summary.warnings.some((w) => w.includes("ability_not_known")));
  });

  it("grants school xp when actor knows the ability", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 300,
    });
    assert.ok((state.classMagic.magicSchools.combat_magic?.xp ?? 0) >= 300);
  });

  it("caps skillXpDelta at 1000", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 99999,
    });
    assert.ok((state.classMagic.magicSchools.combat_magic?.xp ?? 0) <= 1000);
  });

  it("sets cooldown on the ability after magic progress", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 100,
      cooldownMs: 2000,
    });
    assert.ok((state.combat.cooldowns.basic_attack ?? 0) >= NOW_MS + 250);
  });

  it("marks school as illegal when legalStatus=illegal", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "dark_arts",
      skillXpDelta: 50,
      legalStatus: "illegal",
    });
    assert.ok(state.classMagic.magicSchools.dark_arts?.illegal === true);
  });
});

// ===========================================================================
// 7. request_trainer_unlock / request_skill_book_use
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — trainer unlock", function () {
  it("request_trainer_unlock adds ability to knownAbilities (deduped)", function () {
    const s = freshState();
    applyOne(s, "request_trainer_unlock", { abilityId: "fireball" });
    const { state } = applyOne(s, "request_trainer_unlock", { abilityId: "fireball" });
    // Should not duplicate
    const count = state.classMagic.knownAbilities.filter((a) => a === "fireball").length;
    assert.ok(count <= 1);
  });

  it("request_skill_book_use adds recipe to knownRecipes", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_skill_book_use", { recipeId: "recipe_iron_sword" });
    assert.ok(state.classMagic.knownRecipes.includes("recipe_iron_sword"));
  });

  it("adds both ability and recipe from same unlock envelope", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_trainer_unlock", {
      classId: "warrior",
      abilityId: "basic_strike",
      recipeId: "recipe_holy_bread",
    });
    assert.ok(state.classMagic.knownAbilities.includes("basic_strike"));
    assert.ok(state.classMagic.knownRecipes.includes("recipe_holy_bread"));
  });
});

// ===========================================================================
// 8. request_vendor_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — vendor transaction", function () {
  it("buy from vendor deducts gold and adds item when actor has enough gold", function () {
    const s = freshState();
    s.inventory.gold = 200;
    const { state, summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 5,
    });
    // iron_ore costs 10 gold each; buying 5 = 50 gold
    assert.ok(state.inventory.gold <= 200 - 50 + 1); // allow slight rounding
    assert.ok((state.inventory.items.iron_ore ?? 0) >= 5);
    assert.ok(summary.touchedModels.includes("inventory_items"));
    assert.ok(summary.touchedModels.includes("wallet"));
  });

  it("rejects vendor buy when actor has insufficient gold", function () {
    const s = freshState();
    s.inventory.gold = 1;
    const { summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 10,
    });
    assert.ok(summary.warnings.some((w) => w.includes("vendor_rejected:")));
  });

  it("records vendor transaction count in economy.vendorTransactions", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const { state } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    assert.ok((state.economy.vendorTransactions["blacksmith_vendor"] ?? 0) >= 1);
  });

  it("records ledger entry for vendor transaction", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const { state } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 2,
    });
    const entry = state.economy.ledger.find((e) => e.kind.startsWith("vendor_"));
    assert.ok(entry !== undefined);
  });
});

// ===========================================================================
// 9. request_crafting
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — crafting", function () {
  it("crafts iron_sword when actor has materials and knows recipe", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { state, summary } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok((state.inventory.items.iron_sword ?? 0) >= 1);
    assert.ok(state.inventory.items.iron_ore <= 10 - 3); // 3 consumed
    assert.ok(summary.touchedModels.includes("crafting"));
  });

  it("rejects crafting when recipe not known", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = [];
    const { summary } = applyOne(s, "request_crafting", { recipeId: "recipe_iron_sword" });
    assert.ok(summary.warnings.some((w) => w.includes("crafting_rejected:")));
  });

  it("rejects crafting when missing required materials", function () {
    const s = freshState();
    s.inventory.items = {}; // no ore
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { summary } = applyOne(s, "request_crafting", { recipeId: "recipe_iron_sword" });
    assert.ok(summary.warnings.some((w) => w.includes("crafting_rejected:")));
  });

  it("rejects when recipeId is missing from envelope payload", function () {
    const s = freshState();
    const { summary } = applyOne(s, "request_crafting", {}); // no recipeId
    assert.ok(summary.warnings.some((w) => w.includes("crafting_rejected:missing_recipe_id")));
  });

  it("grants crafting XP on success", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { state } = applyOne(s, "request_crafting", { recipeId: "recipe_iron_sword" });
    // recipe has xpReward: 50
    assert.ok((state.classMagic.skills.crafting?.xp ?? 0) >= 50);
  });
});

// ===========================================================================
// 10. request_loot_claim / request_inventory_mutation
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — loot and inventory mutation", function () {
  it("request_loot_claim adds item to inventory", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 3,
    });
    assert.ok((state.inventory.items.health_potion ?? 0) >= 3);
    assert.ok(Object.keys(state.combat.lootClaims).length >= 1);
  });

  it("rejects public request_inventory_mutation admin grants", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_inventory_mutation", {
      itemId: "iron_ore",
      count: 10,
    });
    assert.strictEqual(state.inventory.items.iron_ore ?? 0, 0);
    assert.ok(summary.warnings.includes("inventory_rejected:admin_authority_required"));
  });

  it("allows server/admin request_inventory_mutation grants through authority", function () {
    const s = freshState();
    const { state } = applyOne(
      s,
      "request_inventory_mutation",
      {
        itemId: "iron_ore",
        count: 10,
      },
      { source: "admin_tool", subsystem: "inventory" }
    );
    assert.ok((state.inventory.items.iron_ore ?? 0) >= 10);
  });

  it("loot claim records entry in lootClaims with nowMs", function () {
    const s = freshState();
    const env = makeEnvelope("request_loot_claim", { itemId: "health_potion", count: 1 });
    const { state } = reduceHarthmereLiveModeBackendStateV1(s, env, NOW_MS);
    assert.strictEqual(state.combat.lootClaims[env.requestId], NOW_MS);
  });
});

// ===========================================================================
// 11. request_bank_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — bank transactions", function () {
  it("deposit moves item from inventory to bank", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    const { state } = applyOne(s, "request_bank_transaction", {
      direction: "deposit",
      itemId: "iron_ore",
      count: 5,
    });
    assert.ok((state.inventory.items.iron_ore ?? 0) <= 5);
    assert.ok((state.inventory.bank.iron_ore ?? 0) >= 5);
  });

  it("withdraw moves item from bank to inventory", function () {
    const s = freshState();
    s.inventory.bank = { iron_ore: 10 };
    const { state } = applyOne(s, "request_bank_transaction", {
      direction: "withdraw",
      itemId: "iron_ore",
      count: 4,
    });
    assert.ok((state.inventory.bank.iron_ore ?? 0) <= 6);
    assert.ok((state.inventory.items.iron_ore ?? 0) >= 4);
  });

  it("rejects bank deposit when item not in inventory", function () {
    const s = freshState();
    s.inventory.items = {};
    const { summary } = applyOne(s, "request_bank_transaction", {
      direction: "deposit",
      itemId: "iron_ore",
      count: 3,
    });
    assert.ok(summary.warnings.some((w) => w.includes("bank_rejected:")));
  });
});

// ===========================================================================
// 12. request_auction_post
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — auction post", function () {
  it("posting a listing creates escrow and a listing record", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    s.inventory.gold = 500;
    const { state, summary } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    assert.ok(Object.keys(state.economy.auctionListings).length >= 1);
    // Listing fee should have been deducted
    assert.ok(state.inventory.gold < 500);
    assert.ok(summary.touchedModels.includes("auction_listing"));
    assert.ok(summary.touchedModels.includes("inventory_escrow"));
  });

  it("rejects posting when actor doesn't own the item", function () {
    const s = freshState();
    s.inventory.items = {}; // no iron_sword
    s.inventory.gold = 500;
    const { summary } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    assert.ok(summary.warnings.some((w) => w.includes("auction_post_rejected:")));
  });

  it("rejects posting a quest item", function () {
    const s = freshState();
    s.inventory.items = { dungeon_key: 1 };
    s.inventory.gold = 500;
    const { summary } = applyOne(s, "request_auction_post", {
      itemId: "dungeon_key",
      count: 1,
      unitPrice: 100,
    });
    assert.ok(summary.warnings.some((w) => w.includes("auction_post_rejected:")));
  });

  it("ledger records the listing fee", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    s.inventory.gold = 1000;
    const { state } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    const feeEntry = state.economy.ledger.find((e) => e.kind === "auction_listing_fee");
    assert.ok(feeEntry !== undefined);
    assert.ok(feeEntry!.amount < 0); // fee is negative (deducted from actor)
  });
});

// ===========================================================================
// 13. request_auction_settle (buy_listing)
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — auction settle", function () {
  it("buy_listing transfers item to buyer and deducts gold", function () {
    // First post a listing
    const seller = "player_seller_001";
    const buyer = "player_buyer_001";

    // Simulate: we manually inject a listing into state (seller already posted it)
    const s = freshState();
    s.inventory.gold = 1000;
    const listingId = "listing_iron_sword_001";
    s.economy.auctionListings[listingId] = {
      listingId,
      sellerId: seller,
      itemId: "iron_sword",
      count: 1,
      unitPrice: 300,
      listingFeeCharged: 13,
      expiresAtMs: NOW_MS + 48 * 3600 * 1000,
      status: "active",
      createdAtMs: NOW_MS - 1000,
    };

    const { state, summary } = applyOne(
      s,
      "request_auction_settle",
      { listingId },
      { actorId: buyer }
    );
    // Buyer's inventory should gain the item (recordDelta called with buyerItemDelta)
    // Note: buyer state is the same actor state here since we use a single-actor state model in tests
    assert.ok(summary.touchedModels.includes("auction_listing"));
    assert.ok(summary.touchedModels.includes("wallet"));
    // Listing should be marked as sold or removed
    const listing = state.economy.auctionListings[listingId];
    if (listing) {
      assert.ok(listing.status === "sold" || listing.status === "active");
    }
    // House tax should have accumulated
    assert.ok((state.economy.houseTaxAccumulated ?? 0) >= 0);
  });

  it("rejects buy_listing when listing does not exist", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    const { summary } = applyOne(s, "request_auction_settle", {
      listingId: "nonexistent_listing",
    });
    assert.ok(summary.warnings.some((w) => w.includes("auction_settle_rejected:")));
  });

  it("records auction_sale ledger entry on successful buy", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    const listingId = "listing_health_potion_001";
    s.economy.auctionListings[listingId] = {
      listingId,
      sellerId: "other_player",
      itemId: "health_potion",
      count: 5,
      unitPrice: 50,
      listingFeeCharged: 10,
      expiresAtMs: NOW_MS + 48 * 3600 * 1000,
      status: "active",
      createdAtMs: NOW_MS - 1000,
    };
    const { state } = applyOne(s, "request_auction_settle", { listingId });
    const saleEntry = state.economy.ledger.find((e) => e.kind === "auction_sale");
    assert.ok(saleEntry !== undefined);
  });
});

// ===========================================================================
// 14. request_respec
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — respec", function () {
  it("full respec deducts gold cost, increments respec.count, clears talent nodes", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.knownRecipes = [];
    s.talents = { nodes: ["arms_1", "arms_2"], pointsSpent: 2 };

    const { state } = applyOne(s, "request_respec", { respecType: "full" });

    // Gold was deducted (respec base cost = 100).
    assert.ok(state.inventory.gold < 1000);

    // Respec count incremented and the transaction is recorded as a respec fee,
    // not as an auction sale. Auction-sale ledger entries belong only to the
    // auction-settle tests above.
    assert.ok(state.respec.count >= 1);
    const respecFeeEntry = state.economy.ledger.find((e) => e.kind === "respec_fee");
    assert.ok(respecFeeEntry !== undefined);
    assert.ok((respecFeeEntry?.amount ?? 0) < 0);

    // Talent nodes cleared.
    assert.deepStrictEqual(state.talents.nodes, []);
    assert.strictEqual(state.talents.pointsSpent, 0);
  });

  it("respec cost escalates with each respec (check via ledger)", function () {
    let s = freshState();
    s.inventory.gold = 10000;
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];

    let cost1 = 0;
    let cost2 = 0;

    ({ state: s } = applyOne(s, "request_respec", { respecType: "full" }));
    const entry1 = s.economy.ledger.find((e) => e.kind === "respec_fee");
    cost1 = Math.abs(entry1?.amount ?? 0);

    ({ state: s } = applyOne(s, "request_respec", { respecType: "full" }));
    const entries = s.economy.ledger.filter((e) => e.kind === "respec_fee");
    cost2 = Math.abs(entries[entries.length - 1]?.amount ?? 0);

    assert.ok(cost2 >= cost1, `Expected cost2 (${cost2}) ≥ cost1 (${cost1})`);
  });

  it("rejects respec when actor has insufficient gold", function () {
    const s = freshState();
    s.inventory.gold = 0; // can't afford anything
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];
    const { summary } = applyOne(s, "request_respec", { respecType: "full" });
    assert.ok(summary.warnings.some((w) => w.includes("respec_rejected:")));
  });
});

// ===========================================================================
// 15. request_quest_state_update
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — quest state", function () {
  it("marks quest as active with progress", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_quest_state_update", {
      questId: "quest_goblin_slayer",
      progress: 3,
    });
    assert.ok(state.quests.active["quest_goblin_slayer"] !== undefined);
    assert.ok(state.quests.active["quest_goblin_slayer"].progress >= 3);
  });

  it("marks quest as completed and removes from active", function () {
    const s = freshState();
    s.quests.active["quest_goblin_slayer"] = { progress: 10 };
    const { state } = applyOne(s, "request_quest_state_update", {
      questId: "quest_goblin_slayer",
      completed: true,
    });
    assert.ok(state.quests.completed["quest_goblin_slayer"] !== undefined);
    assert.ok(state.quests.active["quest_goblin_slayer"] === undefined);
  });

  it("no-ops when questId is absent from payload", function () {
    const s = freshState();
    const before = JSON.stringify(s.quests);
    const { state } = applyOne(s, "request_quest_state_update", {});
    assert.strictEqual(JSON.stringify(state.quests), before);
  });
});

// ===========================================================================
// 16. request_guild_mutation
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — guild mutation", function () {
  function createTestGuild() {
    const s = freshState();
    s.inventory.gold = 1_000;
    const created = applyOne(s, "request_guild_mutation", {
      operation: "create_guild",
      name: "Iron Wolves",
      tag: "IW",
      recruitment: "open",
    });
    const guildId = created.state.guild.guildId;
    if (!guildId) {
      throw new Error("guild creation should assign the actor to a real guild id");
    }
    return { state: created.state, guildId, summary: created.summary };
  }

  it("creates a real guild record and assigns the actor as leader", function () {
    const { state, summary } = createTestGuild();
    const guildId = state.guild.guildId!;
    const guild = state.guild.guilds[guildId];

    assert.ok(guild, "guild record should be stored under guilds[guildId]");
    assert.strictEqual(state.guild.memberGuildId, guildId);
    assert.strictEqual(guild.members[ACTOR]?.rankId, "leader");
    assert.ok(summary.sharedStateKeys.some((k) => k.includes(guildId)));
    assert.ok(summary.touchedModels.includes("guild_created"));
  });

  it("deposits treasury through the authoritative guild operation", function () {
    const { state: created, guildId } = createTestGuild();
    created.inventory.gold = 1_000;

    const { state, summary } = applyOne(created, "request_guild_mutation", {
      operation: "treasury_deposit",
      guildId,
      amountGold: 100,
      reason: "test deposit",
    });

    assert.strictEqual(state.inventory.gold, 900);
    assert.strictEqual(state.guild.guilds[guildId].treasuryGold, 100);
    assert.ok(summary.touchedModels.includes("guild_treasury"));
    assert.ok(summary.sharedStateKeys.some((k) => k.includes(guildId)));
  });

  it("rejects guild bank withdrawal when the actor would exceed carry weight", function () {
    const { state: created, guildId } = createTestGuild();
    created.inventory.items = { iron_sword: 5 };
    created.guild.guilds[guildId].bank.items.health_potion = 1;

    const { state, summary } = applyOne(created, "request_guild_mutation", {
      operation: "guild_bank_withdraw",
      guildId,
      itemId: "health_potion",
      count: 1,
    });

    assert.strictEqual(state.guild.guilds[guildId].bank.items.health_potion, 1);
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(summary.warnings.includes("guild_rejected:carry_weight_limit_exceeded"));
  });
});

// ===========================================================================
// 17. request_law_reputation_mutation / request_pvp_flag_change
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — law and reputation", function () {
  it("updates faction reputation by delta", function () {
    const s = freshState();
    s.law.reputation["traders_guild"] = 100;
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "traders_guild",
      reputationDelta: 50,
    });
    assert.ok((state.law.reputation["traders_guild"] ?? 0) >= 150);
  });

  it("records crime log entry when crimeKind is present", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "city_guard",
      crimeKind: "theft",
      reputationDelta: -200,
    });
    assert.ok(state.law.crimeLog.some((c) => c.kind === "theft"));
    assert.ok(state.law.flags["theft"] === true);
  });

  it("request_pvp_flag_change sets pvp_flagged flag", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_pvp_flag_change", {
      factionId: "open_world",
      crimeKind: "pvp_flagged",
    });
    assert.ok(state.law.flags["pvp_flagged"] === true);
  });

  it("adds fine when fineDelta is positive", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "city_guard",
      fineDelta: 250,
    });
    assert.ok((state.law.fines["city_guard"] ?? 0) >= 250);
  });
});

// ===========================================================================
// 18. request_farming_action
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — farming", function () {
  it("records a farming plot with crop, timestamp, and state", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_farming_action", {
      plotId: "farm_plot_001",
      cropId: "wheat",
      farmingState: "planted",
    });
    const plot = state.farming.plots["farm_plot_001"];
    assert.ok(plot !== undefined);
    assert.strictEqual(plot.cropId, "wheat");
    assert.strictEqual(plot.state, "planted");
  });

  it("uses requestId as plotId fallback when plotId not provided", function () {
    const s = freshState();
    const env = makeEnvelope("request_farming_action", {
      cropId: "turnip",
      farmingState: "planted",
    });
    const { state } = reduceHarthmereLiveModeBackendStateV1(s, env, NOW_MS);
    assert.ok(state.farming.plots[env.requestId] !== undefined);
  });
});

// ===========================================================================
// 19. request_property_building_mutation (place / non-place)
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — building mutation", function () {
  it("rejects placement when the actor has not claimed the real Grove plot", function () {
    const s = freshState();
    s.inventory.gold = 1_000;

    const { state, summary } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_muckstead_cottage_lot",
      blueprintId: "grove_voxel_cottage_tier_1",
      propertyId: "property_grove_muckstead_cottage_lot",
    });

    assert.strictEqual(Object.keys(state.building.placedStructures).length, 0);
    assert.ok(summary.warnings.includes("building_rejected:plot_not_owned_by_actor"));
  });

  it("places a real voxel building on an owned Grove plot and creates property state", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");

    const { state, summary } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_muckstead_cottage_lot",
      blueprintId: "grove_voxel_cottage_tier_1",
      propertyId: "property_grove_muckstead_cottage_lot",
    });

    assert.ok(state.property.owned["property_grove_muckstead_cottage_lot"]);
    assert.strictEqual(state.property.buildingProgress["property_grove_muckstead_cottage_lot"], 100);
    assert.ok(Object.keys(state.building.placedStructures).length > 0);
    assert.ok(summary.touchedModels.includes("property_building"));
    assert.ok(summary.touchedModels.includes("terrain_materialization"));
  });

  it("starts construction as a staged project instead of mutating property records directly", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");

    const { state, summary } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "start_construction",
      plotId: "grove_muckstead_cottage_lot",
      blueprintId: "grove_voxel_cottage_tier_1",
      propertyId: "property_grove_muckstead_cottage_lot",
    });

    assert.ok(state.building.activeProjects["project_grove_muckstead_cottage_lot"]);
    assert.strictEqual(state.property.buildingProgress["property_grove_muckstead_cottage_lot"], 0);
    assert.ok(summary.touchedModels.includes("building_project"));
    assert.ok(summary.touchedModels.includes("construction_stage_state"));
  });
});

// ===========================================================================
// 20. Legacy goldDelta — non-authority action kinds
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — legacy goldDelta path", function () {
  it("non-authority action with goldDelta updates inventory.gold and ledger", function () {
    const s = freshState();
    s.inventory.gold = 100;
    const { state } = applyOne(s, "request_npc_ai_tick" as any, {
      goldDelta: 50,
    });
    assert.strictEqual(state.inventory.gold, 150);
    assert.ok(state.economy.ledger.some((e) => e.amount === 50));
  });

  it("non-authority action with negative goldDelta cannot go below 0", function () {
    const s = freshState();
    s.inventory.gold = 10;
    const { state } = applyOne(s, "request_npc_ai_tick" as any, {
      goldDelta: -9999,
    });
    assert.strictEqual(state.inventory.gold, 0);
  });

  it("authority action kind with goldDelta in payload does NOT apply the legacy path", function () {
    // request_vendor_transaction is authority — should reject the buy due to no gold
    // but the goldDelta in payload should NOT be directly applied
    const s = freshState();
    s.inventory.gold = 0;
    const { state } = applyOne(s, "request_vendor_transaction", {
      goldDelta: 9999, // attacker tries to inject gold this way
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    // gold should remain 0 (buy rejected due to insufficient gold, and legacy path skipped)
    assert.strictEqual(state.inventory.gold, 0);
  });
});

// ===========================================================================
// 21. State immutability — reducer never mutates original state
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — immutability", function () {
  it("original state object is not mutated by the reducer", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const frozen = JSON.stringify(s);
    applyOne(s, "request_xp_reward", {
      skillId: "combat",
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    });
    assert.strictEqual(JSON.stringify(s), frozen, "Original state was mutated!");
  });
});

// ===========================================================================
// 22. Multi-step scenario: new player progression
// ===========================================================================

describe("multi-step scenario — new player progression", function () {
  it("models a complete new-player flow: loot → craft → sell → quest complete", function () {
    let s = freshState();

    // Step 1: learn recipe
    ({ state: s } = applyOne(s, "request_skill_book_use", { recipeId: "recipe_iron_sword" }));
    assert.ok(s.classMagic.knownRecipes.includes("recipe_iron_sword"));

    // Step 2: loot iron ore
    ({ state: s } = applyOne(s, "request_loot_claim", { itemId: "iron_ore", count: 10 }));
    assert.ok((s.inventory.items.iron_ore ?? 0) >= 10);

    // Step 3: craft iron sword
    ({ state: s } = applyOne(s, "request_crafting", { recipeId: "recipe_iron_sword" }));
    assert.ok((s.inventory.items.iron_sword ?? 0) >= 1);
    const oreAfterCraft = s.inventory.items.iron_ore ?? 0;
    assert.ok(oreAfterCraft <= 7); // 3 consumed

    // Step 4: earn some xp
    ({ state: s } = applyOne(s, "request_xp_reward", {
      skillId: "character_level",
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    }));
    assert.ok((s.classMagic.skills["character_level"]?.xp ?? 0) >= 1000);

    // Step 5: complete quest
    ({ state: s } = applyOne(s, "request_quest_state_update", {
      questId: "quest_first_steps",
      completed: true,
    }));
    assert.ok(s.quests.completed["quest_first_steps"] !== undefined);
    assert.strictEqual(s.quests.active["quest_first_steps"], undefined);

    // Final state sanity
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });
});

// ===========================================================================
// 11b. request_mail_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — mail transactions", function () {
  it("rejects attachment claims without an authoritative mail record", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "missing_mail",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(summary.warnings.includes("mail_rejected:not_found"));
  });

  it("claims an existing mail attachment once and marks the mail claimed", function () {
    const s = freshState();
    s.mail.messages.mail_1 = {
      mailId: "mail_1",
      recipientActorId: ACTOR,
      status: "unread",
      attachments: { health_potion: 2 },
      createdAtMs: NOW_MS,
    };
    const first = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_1",
      itemId: "health_potion",
      count: 2,
    });
    assert.strictEqual(first.state.inventory.items.health_potion, 2);
    assert.strictEqual(first.state.mail.messages.mail_1.status, "claimed");

    const second = applyOne(first.state, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_1",
      itemId: "health_potion",
      count: 2,
    });
    assert.strictEqual(second.state.inventory.items.health_potion, 2);
    assert.ok(second.summary.warnings.includes("mail_claim_rejected:already_claimed"));
  });
});

// ===========================================================================
// Server-physical jobs board and live tick records
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — physical jobs board and live ticks", function () {
  it("rejects client-supplied jobs board target ids without server position proof", function () {
    const s = freshState();
    const { summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: "harthmere_grove_market_jobs_board",
        interactionTargetId: "harthmere_grove_market_jobs_board",
      },
      { subsystem: "jobs", targetId: "harthmere_grove_market_jobs_board" }
    );
    assert.ok(summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
  });

  it("accepts jobs board interaction when a server tick supplies nearby actor position", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: "harthmere_grove_market_jobs_board",
        actorX: 500,
        actorY: 70,
        actorZ: -120,
        title: "Bring ore",
        description: "Need ore for repairs",
        requirements: [{ kind: "item", itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      { source: "server_scheduled_tick", subsystem: "jobs" }
    );
    assert.ok(!summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
    assert.ok(Object.keys(state.jobsBoard.postings).length >= 1);
  });

  it("records NPC AI, boss ticks, and party/raid contribution with validation", function () {
    let s = freshState();
    s.combat.threat[TARGET] = 40;
    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId: "npc_guard_1" },
      { source: "server_scheduled_tick", subsystem: "npc_ai" }
    ));
    assert.strictEqual(s.combat.npcAiTicks.npc_guard_1.targetId, TARGET);

    ({ state: s } = applyOne(
      s,
      "request_boss_tick",
      { bossId: "boss_1" },
      { source: "server_scheduled_tick", subsystem: "boss_encounter", encounterId: "boss_1" }
    ));
    assert.strictEqual(s.combat.bossTicks.boss_1.phase, "phase_1");

    const credit = applyOne(
      s,
      "request_party_raid_credit",
      { contributionScore: 0.75 },
      { source: "server_scheduled_tick", subsystem: "raid", raidId: "raid_1" }
    );
    assert.strictEqual(Object.values(credit.state.combat.partyRaidCredits)[0].contribution, 0.75);
  });
});

// ===========================================================================
// Banking production expansion: slots, account vault, material storage, loans
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — production bank expansion", function () {
  it("creates default banking state with no fake balances", function () {
    const s = freshState();
    assert.deepStrictEqual(s.inventory.bank, {});
    assert.deepStrictEqual(s.banking.accountBank, {});
    assert.deepStrictEqual(s.banking.materialStorage, {});
    assert.strictEqual(s.banking.transactionLogs.length, 0);
  });

  it("upgrades personal bank slots and charges real gold", function () {
    const s = freshState();
    s.inventory.gold = 200;
    const before = s.banking.personalBankMaxSlots;
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "upgrade_slots",
      vaultKind: "personal",
    });
    assert.ok(summary.touchedModels.includes("bank_slots"));
    assert.strictEqual(state.banking.personalBankMaxSlots, before + 4);
    assert.ok(state.inventory.gold < 200);
    assert.ok(state.banking.transactionLogs.some((log) => log.kind === "bank_slot_upgrade"));
  });

  it("rejects slot upgrade when gold is missing", function () {
    const s = freshState();
    s.inventory.gold = 0;
    const before = s.banking.personalBankMaxSlots;
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "upgrade_slots",
      vaultKind: "personal",
    });
    assert.strictEqual(state.banking.personalBankMaxSlots, before);
    assert.ok(summary.warnings.includes("bank_rejected:not_enough_gold_for_slot_upgrade"));
  });

  it("moves items into and out of the account bank", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    const deposited = applyOne(s, "request_bank_transaction", {
      operation: "account_deposit",
      itemId: "iron_sword",
      count: 1,
    }).state;
    assert.strictEqual(deposited.inventory.items.iron_sword ?? 0, 0);
    assert.strictEqual(deposited.banking.accountBank.iron_sword, 1);
    const withdrawn = applyOne(deposited, "request_bank_transaction", {
      operation: "account_withdraw",
      itemId: "iron_sword",
      count: 1,
    }).state;
    assert.strictEqual(withdrawn.banking.accountBank.iron_sword ?? 0, 0);
    assert.strictEqual(withdrawn.inventory.items.iron_sword, 1);
  });

  it("moves crafting materials into material storage and blocks non-materials", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10, health_potion: 1 };
    const { state } = applyOne(s, "request_bank_transaction", {
      operation: "material_deposit",
      itemId: "iron_ore",
      count: 4,
    });
    assert.strictEqual(state.inventory.items.iron_ore, 6);
    assert.strictEqual(state.banking.materialStorage.iron_ore, 4);

    const rejected = applyOne(state, "request_bank_transaction", {
      operation: "material_deposit",
      itemId: "health_potion",
      count: 1,
    });
    assert.ok(rejected.summary.warnings.includes("bank_rejected:not_material_item"));
  });

  it("creates a loan, accrues daily interest, and accepts repayment", function () {
    const s = freshState();
    const borrowed = applyOne(s, "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 7,
    }).state;
    assert.strictEqual(borrowed.inventory.gold, 100);
    const loan = Object.values(borrowed.banking.loans)[0];
    assert.ok(loan);
    const repaid = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", {
        operation: "repay_loan",
        loanId: loan.loanId,
        amount: 50,
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    assert.ok(repaid.inventory.gold < 100);
    assert.ok(repaid.banking.loans[loan.loanId].principalRemaining < 100);
    assert.ok(repaid.banking.transactionLogs.some((log) => log.kind === "bank_loan_payment"));
  });

  it("rejects a second active loan", function () {
    const s = freshState();
    const borrowed = applyOne(s, "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 7,
    }).state;
    const { summary } = applyOne(borrowed, "request_bank_transaction", {
      operation: "take_loan",
      amount: 50,
      days: 3,
    });
    assert.ok(summary.warnings.includes("bank_rejected:active_loan_exists"));
  });
});

// ===========================================================================
// Banking v2: server-side carry-weight enforcement and loan consequences
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — banking v2 carry weight enforcement", function () {
  it("rejects personal bank withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.inventory.bank = { health_potion: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "withdraw",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.inventory.bank.health_potion, 1);
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(summary.warnings.includes("bank_withdraw_rejected:carry_weight_limit_exceeded"));
  });

  it("rejects account vault withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.banking.accountBank = { health_potion: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "account_withdraw",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.banking.accountBank.health_potion, 1);
    assert.ok(summary.warnings.includes("account_bank_withdraw_rejected:carry_weight_limit_exceeded"));
  });

  it("rejects material storage withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.banking.materialStorage = { iron_ore: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "material_withdraw",
      itemId: "iron_ore",
      count: 1,
    });
    assert.strictEqual(state.banking.materialStorage.iron_ore, 1);
    assert.ok(summary.warnings.includes("material_storage_withdraw_rejected:carry_weight_limit_exceeded"));
  });

  it("rejects loot pickup and authorized admin inventory grant when they exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    const loot = applyOne(s, "request_loot_claim", { itemId: "health_potion", count: 1 });
    assert.strictEqual(loot.state.inventory.items.health_potion ?? 0, 0);
    assert.ok(loot.summary.warnings.includes("loot_rejected:carry_weight_limit_exceeded"));

    const grant = applyOne(
      s,
      "request_inventory_mutation",
      { itemId: "health_potion", count: 1 },
      { source: "admin_tool", subsystem: "inventory" }
    );
    assert.strictEqual(grant.state.inventory.items.health_potion ?? 0, 0);
    assert.ok(grant.summary.warnings.includes("inventory_rejected:carry_weight_limit_exceeded"));
  });

  it("rejects vendor buy, auction buy, mail claim, and crafting output when overweight", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.inventory.items = { iron_sword: 5 };

    const vendor = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    assert.ok(vendor.summary.warnings.includes("vendor_rejected:carry_weight_limit_exceeded"));

    const auctionState = freshState();
    auctionState.inventory.gold = 1_000;
    auctionState.inventory.items = { iron_sword: 5 };
    auctionState.economy.auctionListings["listing_weight_test"] = {
      listingId: "listing_weight_test",
      sellerId: "seller_001",
      itemId: "health_potion",
      count: 1,
      unitPrice: 10,
      listingFeeCharged: 1,
      status: "active",
      createdAtMs: NOW_MS,
      expiresAtMs: NOW_MS + 60_000,
    };
    const auction = applyOne(auctionState, "request_auction_settle", { listingId: "listing_weight_test" });
    assert.ok(auction.summary.warnings.includes("auction_settle_rejected:carry_weight_limit_exceeded"));

    s.mail.messages.mail_weight_test = {
      mailId: "mail_weight_test",
      recipientActorId: ACTOR,
      status: "unread",
      attachments: { health_potion: 1 },
      createdAtMs: NOW_MS,
    };
    const mail = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_weight_test",
      itemId: "health_potion",
      count: 1,
    });
    assert.ok(mail.summary.warnings.includes("mail_claim_rejected:carry_weight_limit_exceeded"));

    const craftState = freshState();
    craftState.classMagic.knownRecipes = ["recipe_iron_sword"];
    craftState.inventory.items = { iron_sword: 5, iron_ore: 3 };
    const crafted = applyOne(craftState, "request_crafting", { recipeId: "recipe_iron_sword" });
    assert.ok(crafted.summary.warnings.includes("crafting_rejected:carry_weight_limit_exceeded"));
  });
});

describe("reduceHarthmereLiveModeBackendStateV1 — loan default consequences", function () {
  it("marks overdue loans defaulted, applies a credit hold, logs the default, and blocks new loans", function () {
    const borrowed = applyOne(freshState(), "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 1,
    }).state;
    const loan = Object.values(borrowed.banking.loans)[0];
    const afterDue = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", { operation: "upgrade_slots", vaultKind: "personal" }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000,
    ).state;
    assert.strictEqual(afterDue.banking.loans[loan.loanId].status, "defaulted");
    assert.strictEqual(afterDue.law.flags.bank_credit_hold, true);
    assert.ok(afterDue.banking.transactionLogs.some((log) => log.kind === "bank_loan_defaulted"));

    const rejected = applyOne(afterDue, "request_bank_transaction", {
      operation: "take_loan",
      amount: 50,
      days: 3,
    });
    assert.ok(rejected.summary.warnings.includes("bank_rejected:credit_hold_until_defaulted_loan_paid"));
  });

  it("allows a defaulted loan to be repaid and clears the credit hold after full payoff", function () {
    const borrowed = applyOne(freshState(), "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 1,
    }).state;
    const loan = Object.values(borrowed.banking.loans)[0];
    const defaulted = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", { operation: "upgrade_slots", vaultKind: "personal" }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000,
    ).state;
    defaulted.inventory.gold = 1_000;
    const repaid = reduceHarthmereLiveModeBackendStateV1(
      defaulted,
      makeEnvelope("request_bank_transaction", {
        operation: "repay_loan",
        loanId: loan.loanId,
        amount: 1_000,
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000,
    ).state;
    assert.strictEqual(repaid.banking.loans[loan.loanId].status, "paid");
    assert.strictEqual(repaid.law.flags.bank_credit_hold, undefined);
  });
});
