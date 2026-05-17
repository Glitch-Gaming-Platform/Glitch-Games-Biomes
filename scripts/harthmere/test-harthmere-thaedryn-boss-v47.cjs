#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
function readJsonExport(src, name) { const re = new RegExp(`${name} = ` + "`([\\s\\S]*?)`;", "m"); const m = src.match(re); if (!m) throw new Error(`missing ${name}`); return JSON.parse(m[1]); }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/thaedryn_boss_v47.ts"), "utf8");
const phases = readJsonExport(src, "HARTHMERE_THAEDRYN_PHASES_V47_JSON");
const paths = readJsonExport(src, "HARTHMERE_THAEDRYN_PATHS_V47_JSON");
check("exactly four boss phases", phases.length === 4);
for (const phase of ["phase_1_sleeper", "phase_2_half_waking", "phase_3_bellbound", "phase_4_path_dependent"]) check(`phase present: ${phase}`, phases.some((p) => p.id === phase));
for (const p of phases) {
  check(`${p.id} has mechanics`, p.mechanics.length >= 3);
  check(`${p.id} has readable telegraph`, p.requiredTelegraphSeconds >= 1.5);
}
for (const pathId of ["rebind", "slay", "wake"]) {
  const p = paths.find((item) => item.id === pathId);
  check(`path present: ${pathId}`, !!p);
  check(`${pathId} has requirements`, p && p.requires.length >= 3);
  check(`${pathId} has item rewards`, p && p.rewards.items.length > 0);
  check(`${pathId} has town phasing`, p && !!p.townPhase);
  check(`${pathId} has cinematic`, p && !!p.cinematic);
}
for (const fn of ["createThaedrynBossStateV47", "applyThaedrynBossEventV47", "resolveThaedrynPathV47", "completeThaedrynBossV47", "validateThaedrynBossContractV47"]) check(`exports ${fn}`, src.includes(`function ${fn}`));
check("wake path can collapse into slay by attack threshold", src.includes("wake_collapsed_into_slay_by_attack_threshold"));
check("solo and group tuning present", src.includes("solo_story") && src.includes("group"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS Thaedryn boss v47");
