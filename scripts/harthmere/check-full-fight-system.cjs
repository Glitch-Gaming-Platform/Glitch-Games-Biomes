#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const combat = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const text = fs.readFileSync(combat, "utf8");
const checks = [
  ["ruleset revision", text.includes('"harthmere-full-fight-system-v1"')],
  ["contact hit resolver", text.includes("function rollHarthmereContactHitResult(")],
  ["melee contact avoids miss/dodge", /deliberately never returns miss\/dodge\/parry/.test(text)],
  ["applyAttack accepts forcedHitResult", /forcedHitResult\?: HitResult/.test(text)],
  ["applyAttack uses forcedHitResult", /forcedHitResult \?\? rollHitResult/.test(text)],
  ["player melee uses forcedPlayerHitResult", text.includes("const forcedPlayerHitResult =")],
  ["counter uses forcedCounterHitResult", text.includes("const forcedCounterHitResult =")],
  ["AI uses forcedAiHitResult", text.includes("const forcedAiHitResult =")],
  ["broad forward sweep lane", text.includes("withinForwardLane") && text.includes("laneHalfWidth")],
  ["expanded melee range", text.includes('const range = ability === \\"heavy\\" ? 9.5 : 7.25;') || text.includes('const range = ability === "heavy" ? 9.5 : 7.25;')],
  ["NPC lunge reach", text.includes("lungeGrace")],
  ["debug shows geometry contact", text.includes('"fight.geometry_contact"')],
  ["debug shows AI retaliation", text.includes('"fight.ai.retaliate"')],
];
let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${name}`);
  ok = ok && pass;
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
