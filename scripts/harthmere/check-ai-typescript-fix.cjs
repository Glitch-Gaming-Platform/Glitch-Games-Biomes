const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const classPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx");
const combat = fs.readFileSync(combatPath, "utf8");
const klass = fs.readFileSync(classPath, "utf8");
const checks = [
  ["combat state includes dead", combat.includes('| "dead"')],
  ["counter branch uses HP death gate comment", combat.includes("HP is the authoritative death gate")],
  ["counter branch does not re-check narrowed dead state", !combat.includes('combatState: (target.combatState === "dead" ? "dead" : "in_combat")')],
  ["skill seeds explicit record return", klass.includes("function skillSeedsForClass(classId: HarthmereClassId): Record<string, HarthmereSkillState>")],
  ["restricted ability reputation uses label", klass.includes('label: "Restricted ability used"')],
  ["restricted ability reputation uses harthmere delta", klass.includes("harthmere: { legal: -8, likeability: -3, notoriety: 2 }")],
];
let ok = true;
for (const [label, passed] of checks) {
  if (passed) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); ok = false; }
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
