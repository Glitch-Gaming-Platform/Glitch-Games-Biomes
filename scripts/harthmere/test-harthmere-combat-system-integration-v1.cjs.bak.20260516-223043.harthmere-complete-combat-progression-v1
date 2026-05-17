#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let failures = 0;
function fail(label, details = []) { failures += 1; console.log(`FAIL ${label}`); for (const d of details) console.log(`  - ${d}`); }
function ok(label, condition, details = []) { if (condition) console.log(`OK ${label}`); else fail(label, details); }
function read(rel) { const p = path.join(root, rel); if (!fs.existsSync(p)) { fail(`${rel} exists`, [`Missing ${p}`]); return ""; } return fs.readFileSync(p, "utf8"); }
function includesAll(text, items) { return items.every((item) => text.includes(item)); }

console.log("== Harthmere combat system integration tests v1 ==");
console.log(`Root: ${root}\n`);

const source = read("src/shared/harthmere/combat_system_v1.ts");
const server = read("src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const combat = read("src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const death = read("src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx");
const multiplayer = read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const leveling = read("src/client/components/challenges/LocalDevHarthmereLevelingSystem.tsx");

ok("server authority mutation list includes combat/death/respawn/pvp/party/raid", includesAll(server, ['"combat"', '"death"', '"respawn"', '"pvp"', '"party"', '"raid"']));
ok("server authority models include combat action, death/respawn, and contribution", includesAll(server, ["combatAction", "combatDeathRespawn", "combatContribution"]));
ok("server authority rejects client-decided combat fields", includesAll(server, [
  "validateHarthmereServerCombatAuthority", "clientHitResult", "clientFinalDamage", "clientTargetHpAfter", "clientDeathState", "clientXpGranted", "clientLootGranted", "clientPvpLegal", "clientContributionCredit",
]));
ok("full suite includes new combat tests", includesAll(suite, [
  "test-harthmere-combat-system-core-v1.cjs", "test-harthmere-combat-system-integration-v1.cjs",
]));
ok("current runtime has existing attack/damage/death hooks preserved", includesAll(combat, [
  "performHarthmereCombatAttack", "performHarthmereForwardArcAttack", "calculateDamage", "rollHitResult", "markPlayerDownedFromCombat", "respawnHarthmerePlayer",
]));
ok("current death UI module remains available", includesAll(death, ["HarthmereDeathState", "readHarthmereDeathState", "HarthmereDeathHUD", "protectionUntil"]));
ok("current multiplayer module remains available", includesAll(multiplayer, ["setHarthmerePvpFlag", "simulateHarthmereAllySupport", "startHarthmereReadyCheck", "startHarthmerePullTimer"]));
ok("current leveling module remains available for level modifiers", includesAll(leveling, ["levelDamageModifier", "levelHitModifier", "scaleHarthmereNpcCombatStats", "applyHarthmereLevelingToPlayerCombatStats"]));
ok("shared combat engine has no React/localStorage dependency", !source.includes("import React") && !source.includes("localStorage") && !source.includes("useState"));

console.log("");
if (failures) { console.log(`RESULT: FAIL (${failures})`); process.exit(1); }
console.log("RESULT: PASS");

