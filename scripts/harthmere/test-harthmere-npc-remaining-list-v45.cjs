#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const v44Path = path.join(root, "src/shared/harthmere/npc_compendium_v44.ts");
const v45Path = path.join(root, "src/shared/harthmere/npc_compendium_v45.ts");
const v44Text = fs.readFileSync(v44Path, "utf8");
const v45Text = fs.readFileSync(v45Path, "utf8");
function parseArray(text, name) {
  const re = new RegExp(String.raw`export const ${name} = (\[[\s\S]*?\]) as const;`);
  const match = text.match(re);
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}
const named = parseArray(v44Text, "HARTHMERE_NAMED_NPCS_V44");
const remaining = parseArray(v45Text, "HARTHMERE_REMAINING_NPCS_V45");
const all = [...named, ...remaining];
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); process.exitCode = 1; }
  else { console.log("OK", msg); }
}

const required = [
  "tessen_hark",
  "mira_holt",
  "bree_thistle",
  "corvin_bree_friend",
  "harlo_grain_merchant",
  "rinna_fishmonger",
  "drathmar_envoy",
  "crown_auditor_selwyn",
  "noble_widow_avelina",
  "barge_captain_orren",
  "merrit_apprentice_pell",
  "veska_brother_alen",
  "evicted_couple_hobb",
  "vera_harth",
  "old_harth",
  "thaedryn_bellbound",
  "vyrahel_chapel_wyrmling",
  "outside_gate_father",
  "outside_gate_mother",
  "outside_gate_child",
  "north_gate_day_guard",
  "north_gate_night_guard",
  "toll_clerk",
  "gate_peddler",
  "gate_farmer",
  "caravan_hand",
  "beggar_child_gate",
  "food_seller",
  "cloth_trader",
  "spice_trader",
  "market_clerk",
  "gossip_elder",
  "fountain_child",
  "market_performer",
  "stock_keeper",
  "inn_cook",
  "room_attendant",
  "traveler_patron",
  "roleplay_patron",
  "mail_runner",
  "forge_apprentice",
  "carpenter_apprentice",
  "porter",
  "tanner",
  "alchemy_runner",
  "chapel_pilgrim",
  "mourner",
  "candle_server",
  "charity_worker",
  "noble_clerk",
  "house_servant",
  "debt_shaken_debtor",
  "private_guard",
  "docker",
  "ferryman",
  "fishmonger",
  "bargeman",
  "dock_inspector",
  "mudden_laborer",
  "mudden_widow",
  "mudden_child",
  "rat_catcher",
  "informal_trader",
  "mudden_lookout",
  "old_well_scavenger",
  "secretive_figure",
  "last_watch_tired_guard_a",
  "last_watch_tired_guard_b",
  "miller",
  "orchard_worker",
  "shepherd",
  "woodcutter",
  "hunter_marker_keeper",
  "quarry_miner",
  "wild_rabbit",
  "greenmere_deer",
  "red_squirrel",
  "hedge_songbird",
  "briarfen_frog",
  "river_duck",
  "red_fox",
  "river_otter",
  "field_mouse",
  "wild_boar",
  "black_bear",
  "water_snake",
  "old_badger",
  "rutting_stag",
  "farm_dog",
  "angry_goose",
  "gray_wolf",
  "dire_wolf",
  "reed_cat",
  "river_lurker",
  "web_spider",
  "carrion_crow",
  "rot_sick_deer",
  "pale_wolf",
  "moss_boar",
  "black_eyed_crow",
  "thornback_spider",
  "root_bound_bear",
  "bell_mad_hound",
  "gate_chicken",
  "pasture_sheep",
  "pasture_cow",
  "stable_horse",
  "bandit_road_scout",
  "bandit_hedge_archer",
  "bandit_knife_thief",
  "bandit_snare_setter",
  "bandit_wagon_raider",
  "bandit_false_beggar",
  "bandit_outlaw_brute",
  "bandit_quartermaster",
  "bandit_former_guard_captain",
  "bandit_smuggler_liaison",
  "undead_fresh_risen",
  "undead_grave_caked_walker",
  "undead_bell_woken_dead",
  "undead_drowned_corpse",
  "undead_bone_crawler",
  "undead_mourning_wraith",
  "undead_hollow_sexton",
  "undead_root_bound_dead",
  "undead_old_soldier_wight",
  "monster_rootling",
  "monster_thorn_imp",
  "monster_webbed_matron",
  "monster_rot_stag",
  "monster_witch_crow",
  "monster_hollow_treant",
  "monster_mossback_bear",
  "monster_root_crowned_dead",
  "smuggler_reed_runner",
  "smuggler_lantern_signalman",
  "smuggler_false_fisherman",
  "smuggler_crate_guard",
  "smuggler_dock_knife",
  "smuggler_river_fence",
  "smuggler_captain"
];
assert(named.length >= 44, `v44 named NPCs remain present, found ${named.length}`);
assert(remaining.length === required.length, `expected ${required.length} remaining v45 NPCs, found ${remaining.length}`);
const ids = new Set(remaining.map((npc) => npc.id));
for (const id of required) assert(ids.has(id), `remaining NPC implemented: ${id}`);
for (const npc of remaining) {
  assert(npc.implementationStatus === "implemented_v45_remaining_npc", `${npc.id} marked implemented_v45_remaining_npc`);
  assert(npc.name && npc.category && npc.role && npc.district && npc.home, `${npc.id} has identity, category, role, district, home`);
}
const allIds = all.map((npc) => npc.id);
assert(new Set(allIds).size === allIds.length, "v44+v45 NPC ids are globally unique");
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc remaining list v45");
