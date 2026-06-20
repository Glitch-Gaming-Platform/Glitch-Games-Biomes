#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  HARTHMERE_LIVE_MODE_BACKEND_VERSION,
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} = require("../../src/shared/harthmere/live_mode_backend");

const {
  registerHarthmereAbility,
} = require("../../src/shared/harthmere/mmo_combat_authority");

const {
  registerHarthmereItemDefinition,
} = require("../../src/shared/harthmere/mmo_inventory_authority");

const {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
  liveEntityRobotDefaultRobotIdForArea,
} = require("../../src/shared/harthmere/live_entity_robot_energy_protection");

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function envelope(
  actionKind,
  subsystem,
  payload = {},
  targetId,
  overrides = {}
) {
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
    ...overrides,
  };
}

function apply(state, actionKind, subsystem, payload, targetId, overrides) {
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope(actionKind, subsystem, payload, targetId, overrides),
    2000
  ).state;
}

console.log("== Harthmere live-mode backend reducer current ==");

// Seed the tiny server-authority catalogue needed by this standalone smoke test.
// The real game boots a fuller catalogue, but this script runs in isolation.
registerHarthmereAbility({
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

registerHarthmereItemDefinition({
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
});
registerHarthmereItemDefinition({
  itemId: "wheat_seed",
  displayName: "Wheat Seed",
  maxStackSize: 999,
  baseValue: 1,
  binding: "none",
  isQuestItem: false,
  isCurrency: false,
  isConsumable: false,
  isCraftingMaterial: true,
  isSpellTome: false,
  levelRequirement: 1,
  classRestriction: [],
  stats: { weight: 0 },
  tradeable: true,
});

let state = defaultHarthmereLiveModeBackendState("player-1", 1000);

state = apply(
  state,
  "request_inventory_mutation",
  "inventory",
  {
    itemId: "health_potion",
    count: 2,
    itemDeltas: { wheat_seed: 3 },
  },
  undefined,
  { source: "admin_tool" }
);
check(
  state.inventory.items.health_potion === 2,
  "loot/item claim adds item count"
);
check(
  state.inventory.items.wheat_seed === 3,
  "inventory delta adds material count"
);

state = apply(state, "request_vendor_transaction", "vendor", {
  vendorId: "grove_trade_desk",
  goldDelta: -5,
});
check(state.inventory.gold === 0, "wallet cannot go below zero");
check(
  state.economy.vendorTransactions.grove_trade_desk === 1,
  "vendor transaction is persisted"
);

state.inventory.gold = 500;
state.classMagic.skills.character_level = { xp: 0, level: 10 };
state = apply(state, "request_guild_mutation", "guild", {
  operation: "create_guild",
  name: "Road Builders",
  tag: "ROAD",
  recruitment: "open",
});
const guildId = state.guild.guildId;
check(Boolean(guildId && state.guild.guilds[guildId]), "guild id is persisted");
state = apply(state, "request_guild_mutation", "guild", {
  operation: "treasury_deposit",
  amountGold: 12,
  reason: "north_gate_bridge",
});
const guildRecord = guildId ? state.guild.guilds[guildId] : undefined;
check(state.guild.treasury === 12, "guild treasury is persisted");
check(
  guildRecord?.treasuryGold === 12,
  "guild directory treasury is persisted"
);

// Enforced-fine model (hardening): a positive fine is charged to the wallet
// immediately; only the unpayable remainder is carried as outstanding debt in
// law.fines. Here the wallet covers the whole 10g fine, so it is paid in full
// and no debt remains.
const goldBeforeFine = state.inventory.gold;
state = apply(state, "request_law_reputation_mutation", "law", {
  factionId: "harthmere_watch",
  reputationDelta: -2,
  fineDelta: 10,
  crimeKind: "theft",
});
check(
  state.law.reputation.harthmere_watch === -2,
  "signed reputation delta is persisted"
);
check(
  state.inventory.gold === goldBeforeFine - 10,
  "affordable fine is charged to the wallet",
  `gold ${state.inventory.gold} expected ${goldBeforeFine - 10}`
);
check(
  (state.law.fines.harthmere_watch ?? 0) === 0,
  "affordable fine leaves no outstanding debt",
  `fines=${state.law.fines.harthmere_watch ?? 0}`
);
check(state.law.flags.theft === true, "law flag is persisted");

// A fine larger than the wallet pays what it can and persists the remainder as
// outstanding debt in law.fines (this is the path that writes a fine balance).
{
  let poor = defaultHarthmereLiveModeBackendState("player-2", 1000);
  poor.inventory.gold = 4;
  poor = apply(poor, "request_law_reputation_mutation", "law", {
    factionId: "harthmere_watch",
    reputationDelta: -2,
    fineDelta: 10,
    crimeKind: "theft",
  });
  check(
    poor.inventory.gold === 0,
    "over-wallet fine drains the wallet to zero",
    `gold=${poor.inventory.gold}`
  );
  check(
    poor.law.fines.harthmere_watch === 6,
    "over-wallet fine persists the unpayable remainder as debt",
    `fines=${poor.law.fines.harthmere_watch}`
  );
}

if (!state.classMagic.knownAbilities.includes("spark")) {
  state.classMagic.knownAbilities.push("spark");
}
state = apply(state, "request_magic_progress", "magic", {
  abilityId: "spark",
  magicSchoolId: "fire_magic",
  skillXpDelta: 1200,
  legalStatus: "illegal",
});
check(
  state.classMagic.knownAbilities.includes("spark"),
  "magic ability is known before progress is credited"
);
check(
  state.classMagic.magicSchools.fire_magic.level === 2,
  "magic school levels from XP"
);
check(
  state.classMagic.magicSchools.fire_magic.illegal === true,
  "illegal magic flag is persisted"
);

state = apply(state, "request_quest_state_update", "quest", {
  questId: "fountain_buttons_first",
  stepId: "step_2",
  progress: 2,
});
check(
  state.quests.active.fountain_buttons_first.progress === 2,
  "quest progress is persisted"
);
state = apply(state, "request_quest_state_update", "quest", {
  questId: "fountain_buttons_first",
  completed: true,
});
check(
  Boolean(state.quests.completed.fountain_buttons_first),
  "quest completion is persisted"
);
check(
  !state.quests.active.fountain_buttons_first,
  "completed quest leaves active map"
);

const robotArea = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
const robotId = liveEntityRobotDefaultRobotIdForArea(robotArea.areaId);
state.robotProtection.robots[robotId].lastTickAtMs = 2000 - 3_600_000;
state = apply(state, "request_quest_state_update", "quest", {
  operation: "live_entity_robot_energy_tick",
  robotId,
  drainPerHour: 100,
});
check(
  state.robotProtection.robots[robotId].energy === 0,
  "robot energy can deplete to zero"
);
check(
  state.robotProtection.areas[robotArea.areaId].safeFromMuck === false,
  "depleted robot turns protected area into Muck"
);
check(
  state.building.inWorldMarkers[robotArea.muckMarkerId]?.kind ===
    "muck_boundary",
  "depleted robot publishes a Muck boundary marker"
);

const muckNpcId = "npc:smoke_mossy_muckling";
state.combat.entitySnapshots[muckNpcId] = {
  hp: 300,
  maxHp: 300,
  position: {
    x: robotArea.anchor[0],
    y: robotArea.anchor[1],
    z: robotArea.anchor[2],
  },
  isHostile: true,
  isAlive: true,
  isAttackable: true,
  species: "muckling",
  level: 4,
};
state = apply(
  state,
  "request_npc_ai_tick",
  "npc_ai",
  { npcName: "Mossy Muckling" },
  muckNpcId,
  {
    source: "server_scheduled_tick",
    serverActorPosition: {
      x: robotArea.anchor[0] + 1,
      y: robotArea.anchor[1],
      z: robotArea.anchor[2],
    },
  }
);
check(
  /^muck_unprovoked:/.test(state.combat.npcAiTicks[muckNpcId]?.decision ?? ""),
  "Muck monster starts unprovoked aggression from server-known positions"
);
check(
  state.combat.threat["player-1"] === 1,
  "Muck aggression writes server threat"
);

state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID] = 1;
state = apply(state, "request_quest_state_update", "quest", {
  operation: "live_entity_robot_energy_recharge",
  robotId,
});
check(
  state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID] === undefined,
  "robot recharge consumes Stabilized Exotic Matter"
);
check(
  state.inventory.items.repair_voucher === 1,
  "robot recharge grants repair voucher reward"
);
check(
  state.inventory.items.minor_healing_salve === 2,
  "robot recharge grants salve reward"
);
check(
  state.robotProtection.robots[robotId].energy > 0,
  "robot recharge restores energy"
);
check(
  state.robotProtection.areas[robotArea.areaId].safeFromMuck === true,
  "recharged robot restores protected area"
);

state = apply(state, "request_property_building_mutation", "property", {
  operation: "legacy_property_mutation",
  propertyId: "property_grove_muckstead_cottage_lot",
  plotId: "grove_muckstead_cottage_lot",
  blueprintId: "grove_voxel_cottage_tier_1",
  propertyValue: 25,
  buildingProgressDelta: 3,
});
check(
  state.property.owned.property_grove_muckstead_cottage_lot.value === 25,
  "property ownership is persisted"
);
check(
  state.property.buildingProgress.property_grove_muckstead_cottage_lot === 3,
  "building progress is persisted"
);

state = apply(state, "request_farming_action", "farming", {
  plotId: "plot-1",
  cropId: "wheat_seed",
  farmingState: "planted",
});
check(
  state.farming.plots["plot-1"].cropId === "wheat_seed",
  "farming plot is persisted"
);

if (!state.classMagic.knownAbilities.includes("basic_attack")) {
  state.classMagic.knownAbilities.push("basic_attack");
}
state.classMagic.loadout.main_hand = "basic_attack";
state.combat.entitySnapshots["npc-mucker-1"] = {
  hp: 100,
  maxHp: 100,
  position: { x: 1, y: 0, z: 0 },
  isHostile: true,
  isAlive: true,
  isAttackable: true,
  level: 1,
};

state = apply(
  state,
  "request_attack",
  "combat",
  {
    abilityId: "basic_attack",
    baseDamage: 20,
  },
  "npc-mucker-1",
  { requestId: "req-basic-attack-hit" }
);
const attackDamageDone = 100 - state.combat.entitySnapshots["npc-mucker-1"].hp;
check(
  state.combat.threat["npc-mucker-1"] === attackDamageDone &&
    attackDamageDone > 0,
  "attack writes threat against target",
  `damage=${attackDamageDone} threat=${state.combat.threat["npc-mucker-1"]}`
);
check(Boolean(state.combat.cooldowns.basic_attack), "attack writes cooldown");

state = apply(state, "request_death_transition", "death", {});
check(
  state.combat.deathState === "dead" && state.combat.hp === 0,
  "death transition persists death state"
);
state = apply(state, "request_respawn", "respawn", {});
check(
  state.combat.deathState === "alive" && state.combat.hp === state.combat.maxHp,
  "respawn restores player state"
);

const parsed = parseHarthmereLiveModeBackendState(
  JSON.stringify({ version: "old", actorId: "other", inventory: { gold: 7 } }),
  "player-1",
  3000
);
check(
  parsed.version === HARTHMERE_LIVE_MODE_BACKEND_VERSION,
  "parser upgrades old state version"
);
check(parsed.actorId === "player-1", "parser preserves server-owned actor id");
check(
  parsed.inventory.gold === 7 && parsed.inventory.items,
  "parser deep-merges partial state"
);

const corrupted = parseHarthmereLiveModeBackendState(
  "{not-json",
  "player-1",
  3000
);
check(
  corrupted.version === HARTHMERE_LIVE_MODE_BACKEND_VERSION,
  "parser recovers corrupted state to defaults"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
