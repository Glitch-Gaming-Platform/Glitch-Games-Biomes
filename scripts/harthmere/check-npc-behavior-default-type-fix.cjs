#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const file = path.join(root, "src/shared/npc/bikkie.ts");
const s = fs.readFileSync(file, "utf8");
const checks = [
  ["default behavior is empty object", /const DEFAULT_NPC_BEHAVIOR = \{\} as NonNullable<NpcType\["behavior"\]>;/],
  ["default behavior does not set boolean swim", !/DEFAULT_NPC_BEHAVIOR[\s\S]*?swim:\s*false/.test(s)],
  ["default behavior does not set boolean fly", !/DEFAULT_NPC_BEHAVIOR[\s\S]*?fly:\s*false/.test(s)],
  ["getNpcBehavior still centralizes fallback", /export function getNpcBehavior\([\s\S]*?return npcType\.behavior \?\? DEFAULT_NPC_BEHAVIOR;/.test(s)],
];

let ok = true;
for (const [name, rule] of checks) {
  const pass = rule instanceof RegExp ? rule.test(s) : !!rule;
  console.log(`${pass ? "OK" : "FAIL"} ${name}`);
  ok &&= pass;
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
