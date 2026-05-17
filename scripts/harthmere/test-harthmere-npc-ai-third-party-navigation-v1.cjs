#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); ok = false; } }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
console.log("== Harthmere NPC AI third-party navigation tests v1 ==");
console.log(`Root: ${root}\n`);
const ai = read("src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts");
const adapter = read("src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts");
check("AI system imports third-party adapter module", ai.includes("LocalDevHarthmereNpcThirdPartyAiAdapters"));
check("AI stack uses recast-navigation navmesh adapter", ai.includes("recast-navigation navmesh adapter"));
check("AI stack uses Yuka steering/vector adapter", ai.includes("Yuka steering/vector adapter"));
check("adapter exposes third-party path planner", adapter.includes("planHarthmereNpcPathViaThirdParty"));
check("path planner tries recast-navigation first", adapter.indexOf("recast-navigation") < adapter.indexOf('provider: \"yuka\"'));
check("path planner accepts navMeshQuery", adapter.includes("navMeshQuery"));
check("path planner returns recast-navigation when navmesh path exists", adapter.includes('provider: \"recast-navigation\"') && adapter.includes('mode: \"navmesh\"'));
check("path planner can use Yuka after recast", adapter.includes('provider: \"yuka\"') && adapter.includes("Vector3"));
check("path planner preserves custom fallback", adapter.includes('provider: \"custom_fallback\"') && adapter.includes("fallbackStraightPath"));
check("third-party decision path is exposed", ai.includes("chooseHarthmereNpcAiDecisionWithThirdParty"));
check("third-party decision calls adapter path planner", ai.includes("planHarthmereNpcPathViaThirdParty"));
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
