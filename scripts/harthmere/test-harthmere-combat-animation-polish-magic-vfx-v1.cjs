#!/usr/bin/env node
const lib = require("./harthmere-combat-animation-polish-test-lib-v1.cjs");
const { assert, unique } = lib;
let ok = true;
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const magicPhysical = lib.PROFILES.filter((p) => p.category === "magic" && p.theme === "physical");
check("all eight magic shapes covered", () => assert(magicPhysical.length >= 8, "missing magic shapes"));
check("magic vfx silhouettes differ", () => assert(unique(magicPhysical.map((p) => `${p.shape}|${p.trailShape}|${p.bodyMotion}`)).length === magicPhysical.length, "magic variations are not distinct"));
check("projectile beam rune falling wave summoned orb cone are present", () => {
  for (const id of ["magic_projectile", "magic_beam", "magic_rune_burst", "magic_falling_strike", "magic_ground_wave", "magic_summoned_weapon", "magic_orb_explosion", "magic_cone_spray"]) {
    assert(magicPhysical.some((p) => p.shape === id), `missing ${id}`);
  }
});
check("magic profiles do not change mechanics", () => assert(lib.PROFILES.filter((p) => p.category === "magic").every((p) => p.mechanicInvariant), "magic changed mechanics"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation polish magic vfx v1");
