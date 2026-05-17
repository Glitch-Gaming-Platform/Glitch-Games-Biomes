#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue memory/reputation tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const type of ["short_term_memory", "personal_memory", "family_memory", "faction_memory", "town_memory", "regional_rumor", "world_news"]) {
  check(`memory type exists: ${type}`, src.includes(type));
}
for (const event of ["player_helped_npc", "player_lied_to_npc", "player_threatened_npc", "player_stole_from_npc", "player_saved_family", "player_killed_ally", "player_failed_quest", "player_completed_quest", "player_spared_enemy", "player_betrayed_faction"]) {
  check(`NPC memory event exists: ${event}`, src.includes(event));
}
check("dialogue context includes likeability", src.includes("likeability"));
check("dialogue context includes legal standing", src.includes("legalStanding"));
check("dialogue context includes notoriety", src.includes("notoriety"));
check("dialogue context includes faction reputation", src.includes("factionReputation"));
finish();
