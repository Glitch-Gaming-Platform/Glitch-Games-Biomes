#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
  else pass(message);
}

function readModule(root) {
  const file = path.join(root, "src/shared/harthmere/complete_combat_progression_v1.ts");
  assert(fs.existsSync(file), "complete combat/progression module exists");
  return fs.readFileSync(file, "utf8");
}

function catalogBlock(text, name) {
  const marker = `export const ${name} = `;
  const start = text.indexOf(marker);
  assert(start >= 0, `${name} export exists`);
  if (start < 0) return "";
  const tail = text.slice(start + marker.length);
  const end = tail.indexOf(" as ");
  return end >= 0 ? tail.slice(0, end) : tail.slice(0, 1000);
}

function keyCount(text, name) {
  const block = catalogBlock(text, name);
  const matches = [...block.matchAll(/^\s{2}"([a-zA-Z0-9_]+)":\s\{/gm)];
  return { count: matches.length, keys: matches.map((m) => m[1]) };
}

function includesAll(text, label, values) {
  for (const value of values) {
    assert(text.includes(value), `${label} includes ${value}`);
  }
}

function assertCatalogs(root) {
  const text = readModule(root);
  const classes = keyCount(text, "HARTHMERE_CLASS_CATALOG_V1");
  assert(classes.count >= 12, "12+ core class definitions exist");
  includesAll(text, "class catalog", ["warrior","rogue","ranger","mage","priest","paladin","necromancer","druid","bard","monk","engineer","summoner"]);
  includesAll(text, "class definition fields", ["roles","primaryAttributes","secondaryAttributes","armorAccess","weaponAccess","resourceTypes","startingAbilities","specializations","classQuests","worldInteractions","npcReactionRules","progressionMilestones"]);
  const skills = keyCount(text, "HARTHMERE_SKILL_CATALOG_V1");
  assert(skills.count >= 55, "55+ skills exist across combat/progression");
  includesAll(text, "skill categories", ['"category": "combat"','"category": "weapon"','"category": "armor"','"category": "magic"','"category": "profession"','"category": "gathering"','"category": "crafting"','"category": "social"','"category": "exploration"','"category": "survival"','"category": "movement"','"category": "stealth"','"category": "leadership"']);
  includesAll(text, "skill definition fields", ["progressionMethod","improvesFrom","doesNotImproveFrom","unlockMilestones","passiveBonuses","relatedAbilities","worldInteractions","antiAbuseRules"]);
}

function assertAbilityEquipment(root) {
  const text = readModule(root);
  const abilities = keyCount(text, "HARTHMERE_ABILITY_CATALOG_V1");
  assert(abilities.count >= 35, "35+ active/passive/world/combat abilities exist");
  includesAll(text, "ability ids", ["basic_strike","power_strike","shield_bash","backstab","aimed_shot","fireball","frost_barrier","heal","resurrection","raise_skeleton","entangling_roots","song_of_courage","deploy_turret","summon_wisp"]);
  includesAll(text, "ability fields", ["classRequirements","specializationRequirements","skillRequirements","levelRequirement","resourceType","resourceCost","cooldownSeconds","castTimeSeconds","range","targetType","requiresLineOfSight","requiredWeaponTypes","effects","pvpModifiers","interruptRules","safeZonePolicy","tooltip","upgradePath","serverValidation"]);
  const equipment = keyCount(text, "HARTHMERE_EQUIPMENT_CATALOG_V1");
  assert(equipment.count >= 10, "10+ weapon/armor/equipment definitions exist");
  includesAll(text, "equipment ids", ["training_dagger","harthmere_iron_longsword","oaken_guard_shield","ashwood_hunting_bow","apprentices_wand","pilgrim_staff","militia_chain_hauberk","acolyte_robes"]);
  includesAll(text, "equipment rules", ["levelRequirement","classRequirements","bindingRule","tradeRule","sellValueCopper","durability","stats","equipEffects","stolenStateSupported","animationFamily","twoHanded"]);
  includesAll(text, "equipment validators", ["validateHarthmereEquipmentChangeV1","broken_weapon_cannot_attack_normally","two_handed_weapon_disables_offhand","equipment_changes_blocked_in_combat","player_changes_gear_mid_cast","repairCostCopperV1","applyHarthmereDurabilityLossV1"]);
}

function assertLevelSkillLoot(root) {
  const text = readModule(root);
  includesAll(text, "level/xp functions", ["xpRequiredForHarthmereLevelV1","levelDifferenceXpModifierV1","questXpRewardV1","enemyKillXpRewardV1","resolveHarthmereLevelGainV1"]);
  includesAll(text, "skill progression functions", ["validateHarthmereSkillProgressActionV1","applyHarthmereSkillProgressV1","grey_content_no_skill_progress","trivial_action_zero_progress","training_dummy_after_daily_cap"]);
  const loot = keyCount(text, "HARTHMERE_LOOT_TABLES_V1");
  assert(loot.count >= 6, "6+ loot tables exist");
  includesAll(text, "loot tables", ["wolf_common","bandit_common","undead_common","dungeon_boss","hardcore_pvp_resources","public_world_event"]);
  includesAll(text, "loot/drop rules", ["personalLoot","uniquePerKill","overflowPolicy","selectHarthmereLootDropsV1","resolveHarthmereKillRewardsV1","boss_loot_not_awarded_on_wipe","inventory_full_reward_routed_to_overflow_recovery","low_level_enemy_no_currency_or_power_loot"]);
  includesAll(text, "anti-farming rules", ["enemy_10_plus_levels_lower_no_xp","repeated_farming_no_xp","afk_public_event_leeching","high_level_carry_reduced_xp"]);
}

function assertServerPvpDeath(root) {
  const text = readModule(root);
  includesAll(text, "server authority", ["validateHarthmereServerAuthorityEnvelopeV1","client_authoritative_claim_rejected","stale_entity_version_rejected","duplicate_request_id_rejected","server_authoritative_validation","combat_audit_logs"]);
  includesAll(text, "ability server validation", ["validateHarthmereAbilityUseV1","ability_hits_through_wall","ability_double_casts_from_lag","player_uses_ability_without_required_weapon","player_uses_illegal_ability_in_town"]);
  includesAll(text, "PvP/group/death rules", ["resolveHarthmerePvpRewardEligibilityV1","resolveHarthmereGroupRewardEligibilityV1","low_level_grief_reward_suppressed","repeated_kill_farming_suppressed","no_meaningful_pvp_contribution","win_trading_suspected","spawn_camping","raid_kick_after_contribution_keeps_eligibility","resolveHarthmereDeathPenaltyV1","normal_pvp_death_no_inventory_destroy","drop_only_unbound_trade_goods_and_gathered_resources","bound_quest_spellbook_mount_pet_cosmetic_keyring_protected","unfair_death_no_harsh_penalty"]);
  const npcs = keyCount(text, "HARTHMERE_NPC_COMBAT_PROFILES_V1");
  assert(npcs.count >= 6, "6+ NPC combat profiles exist");
  includesAll(text, "npc combat profiles", ["town_guard","bandit_skirmisher","necromancer_caster","dungeon_boss_warlord","civilian","wolf"]);
  includesAll(text, "edge cases", ["player_switches_loadout_in_combat","player_respecs_while_ability_on_cooldown","pvp_crowd_control_chains","summon_pet_ai_griefing","boss_dragged_out_of_arena","safe_zone_abuse_after_attack","npc_dead_but_attacking","teleporting_takes_pvp_damage"]);
}

function assertRuntimeIntegration(root) {
  const text = readModule(root);
  const combatV1 = path.join(root, "src/shared/harthmere/combat_system_v1.ts");
  assert(fs.existsSync(combatV1), "combat_system_v1 shared engine still exists");
  assert(text.includes("buildHarthmereCombatStatsFromProgressionV1"), "progression can build combat stats for combat engine");
  assert(text.includes("resolveHarthmereNpcCombatProfileV1"), "NPC profile resolver exists for runtime AI");
  assert(text.includes("normalizeHarthmerePvpStatsV1"), "PvP bracket/stat normalization exists");
  assert(text.includes("HARTHMERE_COMPLETE_TDD_TESTS_V1"), "test manifest exists");
  const tests = ["test-harthmere-complete-progression-catalogs-v1.cjs","test-harthmere-complete-abilities-equipment-v1.cjs","test-harthmere-complete-level-skill-loot-v1.cjs","test-harthmere-complete-server-pvp-death-v1.cjs","test-harthmere-complete-runtime-integration-v1.cjs"];
  for (const test of tests) assert(fs.existsSync(path.join(root, "scripts/harthmere", test)), `${test} exists`);
  const suite = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
  if (fs.existsSync(suite)) {
    const suiteText = fs.readFileSync(suite, "utf8");
    assert(tests.every((test) => suiteText.includes(test)), "town placement suite references complete combat/progression tests");
  } else {
    pass("town placement suite not present; standalone tests are available");
  }
}

module.exports = {
  assertCatalogs,
  assertAbilityEquipment,
  assertLevelSkillLoot,
  assertServerPvpDeath,
  assertRuntimeIntegration,
};
