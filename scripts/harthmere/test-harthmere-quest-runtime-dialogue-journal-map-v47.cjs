#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const runtime = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime_v47.ts"), "utf8");
const bridgePath = path.join(root, "src/client/components/challenges/LocalDevHarthmereQuestRuntimeV47.tsx");
const bridge = fs.existsSync(bridgePath) ? fs.readFileSync(bridgePath, "utf8") : "";
check("dialogue links exported", runtime.includes("HARTHMERE_QUEST_DIALOGUE_LINKS_V47"));
for (const npc of ["sergeant_bram_holt", "father_aldren_mell", "nessa_crowe", "thaedryn_bellbound"]) check(`dialogue link for ${npc}`, runtime.includes(npc));
for (const fn of ["getHarthmereDialogueQuestOffersV47", "getHarthmereQuestJournalEntryV47", "getHarthmereQuestMapHintV47"]) check(`exports ${fn}`, runtime.includes(`function ${fn}`));
check("journal exposes objectives", runtime.includes("activeObjectives"));
check("map hint exposes compass label", runtime.includes("compassLabel"));
check("map hints distinguish giver objective turn-in hidden trigger", runtime.includes("hidden_world_trigger") && runtime.includes("turn_in") && runtime.includes("objective"));
check("local dev quest bridge exists", bridge.includes("HARTHMERE_LOCAL_DEV_QUEST_RUNTIME_BRIDGE_VERSION_V47"));
check("bridge exposes accept/progress/complete/fail/abandon/retry", ["accept", "progress", "complete", "fail", "abandon", "retry"].every((word) => bridge.includes(`${word}:`)));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime dialogue journal map v47");
