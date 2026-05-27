#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh");

let failures = 0;
function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`OK    ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}`);
    if (detail) console.error(`      ${detail}`);
  }
}
function read(p) {
  try { return fs.readFileSync(p, "utf8"); }
  catch (e) { failures += 1; console.error(`FAIL  read ${p}: ${e.message}`); return ""; }
}

const combat = read(combatPath);
const deploy = fs.existsSync(deployPath) ? read(deployPath) : "";

ok("nearest diagnostics version marker exists", combat.includes("HARTHMERE_RETALIATION_NEAREST_DIAGNOSTICS_V184"));
ok("auto resolver for nearby NPC diagnostics exists", combat.includes("function autoResolveHarthmereNearbyNpcForDiagnostics"));
ok("auto resolver uses ranked forward arc targets", combat.includes("rankedHarthmereForwardArcTargets(state, targetingAbility, runtime)"));
ok("auto resolver chooses accepted forward target first", combat.includes("firstAccepted = arc.candidates[0]") && combat.includes("firstAccepted ? \"accepted_forward_target\""));
ok("auto resolver falls back to nearest alive attackable NPC", combat.includes("nearestAliveAttackable") && combat.includes("nearest_alive_attackable"));
ok("auto resolver reports no nearby target instead of silently using a fake one", combat.includes(": \"none\"") && combat.includes("No nearby attackable NPC is available"));
const currentFn = combat.slice(combat.indexOf("function currentHarthmereDebugTargetOffset"), combat.indexOf("function inspectHarthmereRetaliation"));
ok("default debug target uses nearby NPC before selected/fixed fallback", currentFn.includes("const auto = autoResolveHarthmereNearbyNpcForDiagnostics(ability)") && currentFn.indexOf("autoResolveHarthmereNearbyNpcForDiagnostics") < currentFn.indexOf("state.selectedNpcOffset"));
ok("diagnose uses ability-aware nearby target resolution", combat.includes("currentHarthmereDebugTargetOffset(offset, ability)"));
ok("async diagnose uses ability-aware nearby target resolution", combat.includes("currentHarthmereDebugTargetOffset(offset, ability);"));
ok("force retaliation defaults to nearby target", combat.includes("currentHarthmereDebugTargetOffset(offset, \"basic\")"));
ok("debug bridge exposes nearestTarget", combat.includes("nearestTarget: (ability: HarthmerePlayerAttackType = \"basic\")"));
ok("debug bridge exposes summaryNearest", combat.includes("summaryNearest: (ability: HarthmerePlayerAttackType = \"basic\")"));
ok("debug bridge exposes diagnoseNearest", combat.includes("diagnoseNearest: (ability: HarthmerePlayerAttackType = \"basic\")"));
ok("debug bridge exposes diagnoseNearestAsync", combat.includes("diagnoseNearestAsync: (ability: HarthmerePlayerAttackType = \"basic\")"));
ok("debug bridge diagnoseNearestAsync calls async diagnosis with undefined offset", combat.includes("diagnoseNearestAsync") && combat.includes("diagnoseHarthmereRetaliationAsync(undefined, ability)"));
ok("attack bridge no longer defaults to hardcoded bandit offset", !combat.includes("attackAndProbe: (offset = 9003") && !combat.includes("attack: (offset = 9003"));
ok("enable message tells user no offset is needed", combat.includes(".diagnoseNearestAsync()") && combat.includes("no offset needed"));
ok("summary includes targetSelection/auto target info", combat.includes("targetSelection") && combat.includes("autoResolveHarthmereNearbyNpcForDiagnostics(\"basic\")"));
if (deploy) {
  ok("deploy guardrails include nearest diagnostics test", deploy.includes("test-harthmere-retaliation-nearest-diagnostics-v184.cjs"));
}

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
