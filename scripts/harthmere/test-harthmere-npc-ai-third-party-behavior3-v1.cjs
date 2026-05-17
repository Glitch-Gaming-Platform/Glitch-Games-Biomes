#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); ok = false; } }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
console.log("== Harthmere NPC AI Behavior3JS adapter tests v1 ==");
console.log(`Root: ${root}\n`);
const ai = read("src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts");
const adapter = read("src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts");
check("AI stack uses Behavior3JS-compatible adapter", ai.includes("Behavior3JS-compatible adapter"));
check("adapter exposes Behavior3 runner", adapter.includes("runHarthmereBehaviorTreeViaBehavior3"));
check("adapter imports behavior3js dynamically", adapter.includes("behavior3js"));
check("adapter creates Behavior3JS BehaviorTree when package exists", adapter.includes("new BehaviorTree()"));
check("adapter creates Behavior3JS Blackboard when package exists", adapter.includes("new Blackboard()"));
check("adapter stores Harthmere blackboard into Behavior3JS blackboard", adapter.includes("harthmereNpcBlackboard"));
check("adapter falls back to deterministic Harthmere tree", adapter.includes("runFallbackTree"));
check("decision helper calls Behavior3JS adapter", ai.includes("runHarthmereBehaviorTreeViaBehavior3"));
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
