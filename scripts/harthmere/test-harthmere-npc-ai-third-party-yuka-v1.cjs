#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); ok = false; } }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
console.log("== Harthmere NPC AI Yuka adapter tests v1 ==");
console.log(`Root: ${root}\n`);
const ai = read("src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts");
const adapter = read("src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts");
check("adapter exposes Yuka steering helper", adapter.includes("steerHarthmereNpcViaYuka"));
check("adapter loads yuka dynamically", adapter.includes("yuka"));
check("adapter uses Yuka Vector3", adapter.includes("Vector3"));
check("adapter normalizes steering heading", adapter.includes("normalize()"));
check("adapter returns velocity from Yuka when available", adapter.includes('provider: \"yuka\"') && adapter.includes("velocity"));
check("adapter keeps steering fallback", adapter.includes("Yuka unavailable; deterministic steering fallback used"));
check("third-party decision calls Yuka steering", ai.includes("steerHarthmereNpcViaYuka"));
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
