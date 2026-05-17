#!/usr/bin/env node
const lib = require("./harthmere-combat-animation-polish-test-lib-v1.cjs");
const { assert, unique, motionSignature } = lib;
let ok = true;
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const weaponPhysical = lib.PROFILES.filter((p) => p.category === "weapon" && p.theme === "physical");
check("weapon variations differ by silhouette, not color only", () => {
  assert(unique(weaponPhysical.map(motionSignature)).length === weaponPhysical.length, "some weapon variations reuse same motion signature");
});
check("required silhouettes present", () => {
  for (const id of ["slash_horizontal", "slash_diagonal", "slash_vertical", "slash_rising", "stab_thrust", "spin_cleave", "slam_ground", "backhand_slash", "double_slash", "afterimage_dash"]) {
    assert(weaponPhysical.some((p) => p.shape === id), `missing ${id}`);
  }
});
check("trail shapes are varied", () => assert(unique(weaponPhysical.map((p) => p.trailShape)).length >= 8, "not enough trail shapes"));
check("body motions are varied", () => assert(unique(weaponPhysical.map((p) => p.bodyMotion)).length >= 8, "not enough body motions"));
check("weapon paths are varied", () => assert(unique(weaponPhysical.map((p) => p.weaponPath)).length >= 8, "not enough weapon paths"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation polish variation motion v1");
