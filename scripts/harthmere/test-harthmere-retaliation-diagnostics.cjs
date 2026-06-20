#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke.sh");

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

ok("retaliation diagnostics version marker exists", combat.includes("HARTHMERE_RETALIATION_DIAGNOSTICS"));
ok("realtime AI hook records mount status", combat.includes("__harthmereRealtimeCombatAiMountedAt") && combat.includes("combat.ai.hook.mounted"));
ok("AI tick records last tick/source", combat.includes("__harthmereRealtimeCombatAiLastTickAt") && combat.includes("__harthmereRealtimeCombatAiLastSource"));
ok("forward runtime hook records mount status", combat.includes("__harthmereForwardArcRuntimeMountedAt") && combat.includes("combat.forward_runtime.hook.mounted"));
ok("hook diagnostic function exists", combat.includes("function harthmereRetaliationHookStatus()"));
ok("diagnostic summary function exists", combat.includes("function summarizeHarthmereRetaliation(offset?: number)"));
ok("likely-cause inference checks missing AI hook", combat.includes("Realtime combat AI hook is not mounted"));
ok("likely-cause inference checks missing actor registry", combat.includes("Renderer has not published combat actors"));
ok("likely-cause inference checks animation-only/no combat log", combat.includes("only be playing an animation, not calling performHarthmereCombatAttack"));
ok("sync diagnosis performs contact-proven attack", combat.includes("function diagnoseHarthmereRetaliation(") && combat.includes("contactSource: \"retaliation_diagnostics\""));
ok("async diagnosis follows windup/recovery windows", combat.includes("async function diagnoseHarthmereRetaliationAsync") && combat.includes("retaliation_diagnostics_after_windup") && combat.includes("retaliation_diagnostics_after_recovery"));
ok("debug bridge exposes hooks", combat.includes("hooks: () => harthmereRetaliationHookStatus()"));
ok("debug bridge exposes summary", combat.includes("summary: (offset?: number) => summarizeHarthmereRetaliation(offset)"));
ok("debug bridge why uses full summary", combat.includes("why: (offset?: number) => summarizeHarthmereRetaliation(offset)"));
ok("debug bridge exposes diagnose", combat.includes("diagnose: (offset?: number, ability: HarthmerePlayerAttackType = \"basic\")"));
ok("debug bridge exposes diagnoseAsync", /diagnoseAsync:\s*\(\s*offset\?:\s*number,\s*ability:\s*HarthmerePlayerAttackType\s*=\s*"basic"/.test(combat));
ok("enable message points to diagnoseAsync", combat.includes(".diagnoseAsync(offset)"));
ok("existing countercheck/counter_skip logging remains", combat.includes("combat.countercheck") && combat.includes("combat.counter_skip"));
ok("existing forceRetaliate bridge remains", combat.includes("forceRetaliate: (offset?: number) => forceHarthmereNpcRetaliation(offset)"));
if (deploy) {
  ok("deploy guardrails include retaliation diagnostics test", deploy.includes("test-harthmere-retaliation-diagnostics.cjs"));
}

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
