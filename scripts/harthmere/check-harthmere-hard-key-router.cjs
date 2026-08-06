#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const text = fs.readFileSync(file, "utf8");
const checks = [
  "HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION",
  "hardCombatActionForCode",
  'basic: "Mouse0"',
  'code === "KeyH"',
  'return "heavy"',
  'code === "KeyL"',
  'return "spark"',
  "stopImmediatePropagation",
  "performHarthmereKeyedAttack(action)",
  "__harthmereHardCombatKeyRouter",
];
let ok = true;
for (const check of checks) {
  const found = text.includes(check);
  console.log(`${found ? "OK" : "MISSING"} ${check}`);
  ok &&= found;
}
const keyBFree = !/code\s*===\s*["']KeyB["'][\s\S]{0,90}return\s+["']basic["']/.test(text);
console.log(`${keyBFree ? "OK" : "MISSING"} KeyB remains free for Bank`);
ok &&= keyBFree;
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
