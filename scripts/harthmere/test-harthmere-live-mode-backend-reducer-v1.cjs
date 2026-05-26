#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");

const {
  registerHarthmereAbilityV1,
} = require("../../src/shared/harthmere/mmo_combat_authority_v1");

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function envelope(actionKind, subsystem, payload = {}, targetId) {
  return {
    requestId: `req-${actionKind}-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: `idem-${actionKind}-${Math.random().toString(36).slice(2)}`,
    actorId: "player-1",
    targetId,
    actionKind,
    subsystem,
    source: "client_request",
    clientSentAtMs: 1000,
    serverReceivedAtMs: 1001,
    serverTick: 44,
    actorEntityVersion: 1,
    targetEntityVersion: targetId ? 1 : undefined,
    zoneId: "grove",
    payload,
    clientClaims: {},
  };
}

function apply(state, actionKind, subsystem, payload, targetId) {
  return reduceHarthmereLiveModeBackendStateV1(
    state,
    envelope(actionKind, subsystem, payload, targetId),
    2000
  ).state;
}

console.log("== Harthmere live-mode backend reducer v1 ==");

// Seed the tiny server-authority catalogue needed by this standalone smoke test.
// The real game boots a fuller catalogue, but this script runs in isolation.
registerHarthmereAbilityV1({
  abilityId: "basic_attack",
  displayName: "Basic Attack",
  targetType: "single_enemy",
  classRestriction: [],
  specRestriction: [],
  levelRequirement: 1,
  requiredWeaponType: "any",
  resourceKind: "mana",
  resourceCost: 0,
  cooldownMs: 500,
  rangeUnits: 4,
  requiresLineOfSight: false,
  allowedInSafeZone: true,
  allowedInPvP: false,
  baseDamage: 20,
  baseHealing: 0,
  attackPowerScaling: 0,
  spellPowerScaling: 0,
  xpReward: 0,
  castTimeMs: 0,
  interruptible: false,
  unlocksMilestones: [],
});

let state = defaultHarthmereLiveModeBackendStateV1("player-1", 1000);

state = apply(state, "request_inventory_mutation", "inventory", {
  itemId: "mucker_tooth",
  count: 2,
  itemDeltas: { wheat_seed: 3 },
});
check(state.inventory.items.mucker_tooth === 2, "loot/item claim adds item count");
check(state.inventory.items.wheat_seed === 3, "inventory delta adds material count");

state = apply(state, "request_vendor_transaction", "vendor", {
  vendorId: "grove_trade_desk",
  goldDelta: -5,
});
check(state.inventory.gold === 0, "wallet cannot go below zero");
check(state.economy.vendorTransactions.grove_trade_desk === 1, "vendor transaction is persisted");

state = apply(state, "request_guild_mutation", "guild", {
  guildId: "road_builders",
  role: "member",
  treasuryDelta: 12,
  projectId: "north_gate_bridge",
  projectContribution: 4,
});
check(state.guild.guildId === "road_builders", "guild id is persisted");
check(state.guild.treasury === 12, "guild treasury is persisted");
check(state.guild.projectContributions.north_gate_bridge === 4, "guild project contribution is persisted");

state = apply(state, "request_law_reputation_mutation", "law", {
  factionId: "harthmere_watch",
  reputationDelta: -2,
  fineDelta: 10,
  crimeKind: "theft",
});
check(state.law.reputation.harthmere_watch === -2, "signed reputation delta is persisted");
check(state.law.fines.harthmere_watch === 10, "fine is persisted");
check(state.law.flags.theft === true, "law flag is persisted");

if (!state.classMagic.knownAbilities.includes("spark")) {
  state.classMagic.knownAbilities.push("spark");
}
state = apply(state, "request_magic_progress", "magic", {
  abilityId: "spark",
  magicSchoolId: "fire_magic",
  skillXpDelta: 1200,
  legalStatus: "illegal",
});
check(state.classMagic.knownAbilities.includes("spark"), "magic ability is known before progress is credited");
check(state.classMagic.magicSchools.fire_magic.level === 2, "magic school levels from XP");
check(state.classMagic.magicSchools.fire_magic.illegal === true, "illegal magic flag is persisted");

state = apply(state, "request_quest_state_update", "quest", {
  questId: "fountain_buttons_first",
  stepId: "step_2",
  progress: 2,
});
check(state.quests.active.fountain_buttons_first.progress === 2, "quest progress is persisted");
state = apply(state, "request_quest_state_update", "quest", {
  questId: "fountain_buttons_first",
  completed: true,
});
check(Boolean(state.quests.completed.fountain_buttons_first), "quest completion is persisted");
check(!state.quests.active.fountain_buttons_first, "completed quest leaves active map");

state = apply(state, "request_property_building_mutation", "property", {
  propertyId: "traveler_hearth",
  propertyValue: 25,
  buildingProgressDelta: 3,
});
check(state.property.owned.traveler_hearth.value === 25, "property ownership is persisted");
check(state.property.buildingProgress.traveler_hearth === 3, "building progress is persisted");

state = apply(state, "request_farming_action", "farming", {
  plotId: "plot-1",
  cropId: "wheat_seed",
  farmingState: "planted",
});
check(state.farming.plots["plot-1"].cropId === "wheat_seed", "farming plot is persisted");

if (!state.classMagic.knownAbilities.includes("basic_attack")) {
  state.classMagic.knownAbilities.push("basic_attack");
}
state.classMagic.loadout.main_hand = "basic_attack";

state = apply(state, "request_attack", "combat", {
  abilityId: "basic_attack",
  baseDamage: 20,
}, "npc-mucker-1");
check(state.combat.threat["npc-mucker-1"] === 20, "attack writes threat against target");
check(Boolean(state.combat.cooldowns.basic_attack), "attack writes cooldown");

state = apply(state, "request_death_transition", "death", {});
check(state.combat.deathState === "dead" && state.combat.hp === 0, "death transition persists death state");
state = apply(state, "request_respawn", "respawn", {});
check(state.combat.deathState === "alive" && state.combat.hp === state.combat.maxHp, "respawn restores player state");

const parsed = parseHarthmereLiveModeBackendStateV1(
  JSON.stringify({ version: "old", actorId: "other", inventory: { gold: 7 } }),
  "player-1",
  3000
);
check(parsed.version === HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1, "parser upgrades old state version");
check(parsed.actorId === "player-1", "parser preserves server-owned actor id");
check(parsed.inventory.gold === 7 && parsed.inventory.items, "parser deep-merges partial state");

const corrupted = parseHarthmereLiveModeBackendStateV1("{not-json", "player-1", 3000);
check(corrupted.version === HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1, "parser recovers corrupted state to defaults");

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
