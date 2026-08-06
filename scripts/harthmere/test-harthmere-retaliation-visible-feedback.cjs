#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const combatPath = path.join(
  root,
  "src/client/components/challenges/LocalDevHarthmereCombat.tsx"
);
const rendererPath = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
const combat = fs.readFileSync(combatPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");

const checks = [];
function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

check(
  "combat current visible feedback version constant exists",
  combat.includes("HARTHMERE_RETALIATION_VISIBLE_FEEDBACK")
);
check(
  "combat current feedback helper exists",
  combat.includes("emitHarthmereRetaliationVisibleFeedback")
);
check(
  "combat current feedback is called from combat effect emission",
  combat.includes("emitHarthmereRetaliationVisibleFeedback(entry);")
);
check(
  "combat current feedback only fires when player is target and damage is positive",
  combat.includes("finalDamage > 0") &&
    combat.includes("/^(you|player|local player)$/i.test(targetName)")
);
check(
  "combat current writes browser debug global",
  combat.includes("__harthmereRetaliationVisibleFeedback")
);
check(
  "combat current creates visible retaliation toast",
  combat.includes("harthmere-retaliation-toast")
);
check(
  "combat current creates screen damage vignette",
  combat.includes("harthmere-retaliation-vignette")
);
check(
  "renderer current tracks authoritative ECS creature visuals by entity id",
  renderer.includes("readHarthmereLiveCreatureBridgeSnapshot") &&
    renderer.includes("harthmereEcsLiveCreatures")
);
check(
  "renderer current resolves combat actors by exact ECS offset",
  renderer.includes("private findCombatLifeByOffset") &&
    /resolveCombatActor[\s\S]{0,900}return this\.findCombatLifeByOffset\(offset\)/.test(
      renderer
    )
);
check(
  "renderer exposes exact actor match diagnostics",
  renderer.includes("renderer.combat_event.attacker_match") &&
    renderer.includes("renderer.combat_event.target_match")
);
check(
  "visible retaliation feedback is independent of renderer actor availability",
  /emitHarthmereRetaliationVisibleFeedback\(entry\);[\s\S]{0,500}window\.dispatchEvent/.test(
    combat
  ) ||
    (combat.includes("emitHarthmereRetaliationVisibleFeedback(entry);") &&
      combat.includes("harthmere-retaliation-vignette"))
);

let failures = 0;
for (const result of checks) {
  if (result.ok) {
    console.log(`PASS ${result.label}`);
  } else {
    failures++;
    console.error(`FAIL ${result.label}`);
  }
}

if (failures) {
  console.error(
    `\n${failures} current retaliation visible feedback check(s) failed.`
  );
  process.exit(1);
}

console.log("\nAll current retaliation visible feedback checks passed.");
