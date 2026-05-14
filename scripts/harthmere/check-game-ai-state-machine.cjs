const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const text = fs.readFileSync(combatPath, "utf8");
const checks = [
  ["ruleset revision", '"harthmere-game-ai-state-machine-v1"'],
  ["brain phase type", "type HarthmereNpcBrainPhase"],
  ["brain memory interface", "interface HarthmereNpcBrainMemory"],
  ["state has npcBrains", "npcBrains?: Record<string, HarthmereNpcBrainMemory>"],
  ["brain profile", "function harthmereNpcBrainProfile"],
  ["brain engage", "function harthmereEngageNpcBrain"],
  ["brain reach", "function harthmereNpcCanReachPlayerWithBrain"],
  ["counter uses brain reach", 'harthmereNpcCanReachPlayerWithBrain(state, targetOffset, target, "counter")'],
  ["attack engages brain", "player_damaged_npc"],
  ["AI windup phase", 'combat.ai.brain.windup'],
  ["AI attacks after windup", "State-machine AI reached attack phase"],
  ["AI recovery brain", 'phase: "recovering"'],
];
let ok = true;
for (const [label, needle] of checks) {
  if (text.includes(needle)) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    ok = false;
  }
}
if (!ok) {
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
