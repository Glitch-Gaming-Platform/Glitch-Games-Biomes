#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assets = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
check("renderer imports main quest spaces", assets.includes("main_quest_spaces_v47"));
check("renderer has v47 placement start marker", assets.includes("HARTHMERE_MAIN_QUEST_SPACES_V47_RUNTIME_PLACEMENTS_START"));
check("renderer has v47 placement end marker", assets.includes("HARTHMERE_MAIN_QUEST_SPACES_V47_RUNTIME_PLACEMENTS_END"));
check("renderer places stone quest-space entry markers", assets.includes("arch_wall_stone") && assets.includes("playable quest-space entry marker"));
check("renderer places interactable anchors", assets.includes("interactable anchor"));
check("renderer places encounter spawn anchors", assets.includes("encounter spawn anchor"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS main quest space renderer placement v47");
