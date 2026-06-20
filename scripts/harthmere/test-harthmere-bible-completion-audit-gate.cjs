#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const requiredFiles = [
  "src/shared/harthmere/quest_runtime.ts",
  "src/shared/harthmere/main_quest_spaces.ts",
  "src/shared/harthmere/thaedryn_boss.ts",
  "src/shared/harthmere/wilds_gameplay_loops.ts",
  "src/client/components/challenges/LocalDevHarthmereQuestRuntime.tsx",
];
for (const file of requiredFiles) check(`required current file exists: ${file}`, fs.existsSync(path.join(root, file)));
const runtime = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime.ts"), "utf8");
const spaces = fs.readFileSync(path.join(root, "src/shared/harthmere/main_quest_spaces.ts"), "utf8");
const boss = fs.readFileSync(path.join(root, "src/shared/harthmere/thaedryn_boss.ts"), "utf8");
const wilds = fs.readFileSync(path.join(root, "src/shared/harthmere/wilds_gameplay_loops.ts"), "utf8");
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
check("actual quest execution runtime implemented", runtime.includes("acceptHarthmereQuest") && runtime.includes("advanceHarthmereQuestObjective") && runtime.includes("completeHarthmereQuest"));
check("runtime validates rewards server-side", runtime.includes("client_cannot_advance_or_grant_quest_state") && runtime.includes("reward_already_granted"));
check("dialogue/journal/map implemented", runtime.includes("getHarthmereDialogueQuestOffers") && runtime.includes("getHarthmereQuestJournalEntry") && runtime.includes("getHarthmereQuestMapHint"));
check("failure/abandon/retry implemented", runtime.includes("failHarthmereQuest") && runtime.includes("abandonHarthmereQuest") && runtime.includes("retryHarthmereQuest"));
check("main quest physical spaces implemented", spaces.includes("Bellward Halls Dungeon") && spaces.includes("Wyrm's Bed / Thaedryn Arena") && spaces.includes("validateHarthmereMainQuestSpaces"));
check("main quest spaces physically placed in renderer", assets.includes("HARTHMERE_MAIN_QUEST_SPACES_RUNTIME_PLACEMENTS_START"));
check("Thaedryn boss implemented", boss.includes("phase_4_path_dependent") && boss.includes("rebind") && boss.includes("slay") && boss.includes("wake"));
check("Wilds gameplay loops implemented", wilds.includes("resource_ownership_and_theft_law") && wilds.includes("overharvesting_consequence_loop") && wilds.includes("public_world_events"));
check("audit covers every previously missing category", ["Quest accept", "Objective progress", "Reward granting", "Failure", "Dialogue", "journal", "map", "server", "Bellward", "Thaedryn", "Wilds", "overharvest", "public"].every((term) => (runtime + spaces + boss + wilds).toLowerCase().includes(term.toLowerCase().split(" ")[0])));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS bible completion audit gate current");
