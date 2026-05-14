#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const mpPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const hudPath = path.join(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");

const combat = fs.readFileSync(combatPath, "utf8");
const mp = fs.readFileSync(mpPath, "utf8");
const hud = fs.readFileSync(hudPath, "utf8");

let ok = true;
function check(label, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${label}`);
  if (!condition) ok = false;
}

check("combat has forward arc marker", combat.includes("harthmere-forward-arc-melee-v2"));
check("combat exports performHarthmereForwardArcAttack", combat.includes("export function performHarthmereForwardArcAttack"));
check("combat has target position registry", combat.includes("HARTHMERE_FORWARD_ARC_TARGET_POSITIONS"));
check("combat has runtime hook", combat.includes("harthmere-forward-arc-runtime-hook-v2") && combat.includes("export function useHarthmereForwardArcRuntime"));
check("combat debug includes forward_arc.start", combat.includes("forward_arc.start"));
check("combat emits player_swing visualKind", combat.includes('visualKind: "player_swing"'));
check("combat uses live runtime snapshot when available", combat.includes("__harthmereForwardArcRuntime"));
check("combat falls back to selected target if runtime unavailable", combat.includes("state.selectedNpcOffset"));
check("multiplayer imports forward arc attack", mp.includes("performHarthmereForwardArcAttack"));
check("multiplayer B/N use forward arc", mp.includes("performHarthmereForwardArcAttack(attack)"));
check("multiplayer Spark still uses selected target", mp.includes("No Spell Target") && mp.includes("performHarthmereCombatAttack(Number(targetOffset), attack)"));
check("multiplayer B/N do not require target", !/if\s*\(!targetOffset\)\s*\{[\s\S]{0,260}No Target/.test(mp));
check("HUD keeps forward arc runtime fresh", hud.includes("useHarthmereForwardArcRuntime();"));
check("no forbidden key changes", mp.includes("KeyB") && mp.includes("KeyN") && mp.includes("KeyL"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
