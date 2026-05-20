#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.cwd();
const rel = "src/client/game/util/player_animations.ts";
const src = fs.readFileSync(path.join(repo, rel), "utf8");
let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failed = true;
  }
}
function entry(name) {
  const re = new RegExp(`${name}: \\{[^\\n]+\\}`);
  const m = src.match(re);
  return m ? m[0] : "";
}

ok(src.includes('walk: { fileAnimationName: "Walking" }'), "snapshot Walking locomotion clip is preserved");
ok(src.includes('idle: { fileAnimationName: "Idle" }'), "snapshot Idle clip is preserved");
ok(src.includes('run: { fileAnimationName: "Running" }'), "snapshot Running clip is preserved");

const attack1 = entry("attack1");
const attack2 = entry("attack2");
ok(attack1.includes('fileAnimationName: "HarthmereBodyWeaponBasic_Aligned_30"'), "Harthmere basic attack primary clip is preserved");
ok(attack1.includes('"Attack"'), "basic attack falls back to snapshot Attack clip");
ok(attack2.includes('fileAnimationName: "HarthmereBodyWeaponHeavy_Aligned_30"'), "Harthmere heavy attack primary clip is preserved");
ok(attack2.includes('"Attack2"') && attack2.includes('"Attack"'), "heavy attack falls back to snapshot Attack2/Attack clips");

for (let i = 1; i <= 4; i++) {
  ok(entry(`attack1Var${i}`).includes('"Attack"'), `attack1Var${i} has snapshot Attack fallback`);
  ok(entry(`attack2Var${i}`).includes('"Attack2"') && entry(`attack2Var${i}`).includes('"Attack"'), `attack2Var${i} has snapshot Attack2/Attack fallback`);
}

ok(src.includes("HARTHMERE_FULL_BODY_ANIMATION_RUNTIME_VERSION_V6"), "Glitch full-body animation runtime remains present");
ok(src.includes("HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_VERSION_V8"), "Glitch aligned weapon animation clips remain present");

if (failed) {
  console.error("snapshot animation compat v1 check failed");
  process.exit(1);
}
console.log("snapshot animation compat v1 check passed");
