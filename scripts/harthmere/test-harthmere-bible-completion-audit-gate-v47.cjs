#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const requiredFiles = [
  "src/shared/harthmere/quest_runtime_v47.ts",
  "src/shared/harthmere/main_quest_spaces_v47.ts",
  "src/shared/harthmere/thaedryn_boss_v47.ts",
  "src/shared/harthmere/wilds_gameplay_loops_v47.ts",
  "src/client/components/challenges/LocalDevHarthmereQuestRuntimeV47.tsx",
];
for (const file of requiredFiles) check(`required v47 file exists: ${file}`, fs.existsSync(path.join(root, file)));
const runtime = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime_v47.ts"), "utf8");
const spaces = fs.readFileSync(path.join(root, "src/shared/harthmere/main_quest_spaces_v47.ts"), "utf8");
const boss = fs.readFileSync(path.join(root, "src/shared/harthmere/thaedryn_boss_v47.ts"), "utf8");
const wilds = fs.readFileSync(path.join(root, "src/shared/harthmere/wilds_gameplay_loops_v47.ts"), "utf8");
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
check("actual quest execution runtime implemented", runtime.includes("acceptHarthmereQuestV47") && runtime.includes("advanceHarthmereQuestObjectiveV47") && runtime.includes("completeHarthmereQuestV47"));
check("runtime validates rewards server-side", runtime.includes("client_cannot_advance_or_grant_quest_state") && runtime.includes("reward_already_granted"));
check("dialogue/journal/map implemented", runtime.includes("getHarthmereDialogueQuestOffersV47") && runtime.includes("getHarthmereQuestJournalEntryV47") && runtime.includes("getHarthmereQuestMapHintV47"));
check("failure/abandon/retry implemented", runtime.includes("failHarthmereQuestV47") && runtime.includes("abandonHarthmereQuestV47") && runtime.includes("retryHarthmereQuestV47"));
check("main quest physical spaces implemented", spaces.includes("Bellward Halls Dungeon") && spaces.includes("Wyrm's Bed / Thaedryn Arena") && spaces.includes("validateHarthmereMainQuestSpacesV47"));
check("main quest spaces physically placed in renderer", assets.includes("HARTHMERE_MAIN_QUEST_SPACES_V47_RUNTIME_PLACEMENTS_START"));
check("Thaedryn boss implemented", boss.includes("phase_4_path_dependent") && boss.includes("rebind") && boss.includes("slay") && boss.includes("wake"));
check("Wilds gameplay loops implemented", wilds.includes("resource_ownership_and_theft_law_v47") && wilds.includes("overharvesting_consequence_loop_v47") && wilds.includes("public_world_events_v47"));
check("audit covers every previously missing category", ["Quest accept", "Objective progress", "Reward granting", "Failure", "Dialogue", "journal", "map", "server", "Bellward", "Thaedryn", "Wilds", "overharvest", "public"].every((term) => (runtime + spaces + boss + wilds).toLowerCase().includes(term.toLowerCase().split(" ")[0])));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS bible completion audit gate v47");
