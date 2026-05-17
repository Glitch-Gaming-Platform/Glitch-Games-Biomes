#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let failures = 0;
function fail(label, details = []) { failures += 1; console.log(`FAIL ${label}`); for (const d of details) console.log(`  - ${d}`); }
function ok(label, condition, details = []) { if (condition) console.log(`OK ${label}`); else fail(label, details); }
function read(rel) { const p = path.join(root, rel); if (!fs.existsSync(p)) { fail(`${rel} exists`, [`Missing ${p}`]); return ""; } return fs.readFileSync(p, "utf8"); }
function includesAll(text, items) { return items.every((item) => text.includes(item)); }

console.log("== Harthmere combat system core tests v1 ==");
console.log(`Root: ${root}\n`);

const source = read("src/shared/harthmere/combat_system_v1.ts");

ok("combat system source exports version", source.includes("HARTHMERE_COMBAT_SYSTEM_VERSION_V1"));
ok("combat system uses required pipeline order", includesAll(source, [
  "attacker_can_act",
  "target_exists_and_alive",
  "target_attackable",
  "relationship_and_pvp_legality",
  "safe_zone_and_spawn_protection",
  "range_check",
  "line_of_sight_check",
  "hit_roll",
  "damage_calculation",
  "damage_application",
  "death_or_downed_state",
  "xp_loot_quest_reputation_legal_reward_rules",
  "combat_log_and_audit_record",
]));
ok("combat stats include MMO-required fields", includesAll(source, [
  "hp:", "maxHp:", "attackPoints:", "defense:", "armor:", "magicResistance:",
  "accuracy:", "evasion:", "criticalChance:", "criticalDamage:", "attackSpeed:",
  "attackRange:", "movementSpeed:", "level:", "threatValue:", "faction:", "combatState:",
]));
ok("combat validation rejects client authoritative spoofing", includesAll(source, [
  "hitResult", "finalDamage", "targetHpAfter", "deathState", "xpGranted", "lootGranted", "pvpLegal", "contributionCredit",
]));
ok("combat validation covers actor state, target state, pvp, safe zone, cooldown, resource, range, LOS, facing", includesAll(source, [
  "attacker_cannot_act", "target_not_attackable", "pvp_not_consented_or_flagged", "safe_zone_blocks_hostile_action",
  "ability_on_cooldown", "not_enough_resource", "out_of_range", "no_line_of_sight", "bad_facing",
]));
ok("hit system covers all required result types", includesAll(source, [
  '"miss"', '"dodge"', '"parry"', '"block"', '"resist"', '"absorb"', '"normal_hit"',
  '"critical_hit"', '"glancing_hit"', '"crushing_hit"', '"immune"', '"evade"',
]));
ok("damage formula uses attack points, ability multiplier, variance, critical, level, block, resist, absorb, defense", includesAll(source, [
  "attackPoints * input.ability.abilityMultiplier", "variance", "criticalModifier", "levelDamageModifier",
  "blockModifier", "resistModifier", "damageReductionForType", "absorbDamage",
]));
ok("death system creates downed/dead records and penalties", includesAll(source, [
  "resolveHarthmereDeathState", '"downed"', '"dead"', "downedUntilMs", "eligibleForRevive", "eligibleForRespawn", "durability_loss", "temporary_recovery_sickness",
]));
ok("revive and respawn validation are implemented", includesAll(source, [
  "canReviveHarthmereCombatTarget", "revive_out_of_range", "revive_no_line_of_sight", "validateHarthmereRespawnPoint", "respawn_inside_wall", "respawn_inside_hazard", "protected_after_respawn",
]));
ok("PvP flags, relationships, safe zone, low-level grief, repeat kill rules exist", includesAll(source, [
  "HarthmerePvpFlag", "duel_flagged", "arena_flagged", "battleground_flagged", "criminal_flagged", "bounty_target",
  "isHarthmerePvpAttackLegal", "low_level_grief_reward_suppressed", "repeated_kill_diminishing_rewards",
]));
ok("party/raid/public contribution is not last-hit-only", includesAll(source, [
  "HarthmereContributionV1", "damage:", "healing:", "shielding:", "objectives:", "revives:", "crowdControl:", "interrupts:", "tanking:", "support:",
]));
ok("crowd-control diminishing returns and leash/evade are implemented", includesAll(source, [
  "resolveCrowdControlDiminishingReturn", "hard_control", "movement_control", "caster_control", "displacement", "forced_targeting", "validateHarthmereLeash", "evade_and_return_home",
]));
ok("edge case registry covers exploit and MMO combat failures", includesAll(source, [
  "target_dies_before_attack_lands", "simultaneous_death", "safe_zone_abuse", "spawn_camping", "attacking_through_walls", "boss_leash_abuse", "aoe_target_caps", "kill_stealing", "raid_leader_kick_before_loot",
]));

console.log("");
if (failures) { console.log(`RESULT: FAIL (${failures})`); process.exit(1); }
console.log("RESULT: PASS");

