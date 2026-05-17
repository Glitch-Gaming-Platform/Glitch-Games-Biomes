#!/usr/bin/env node
const lib = require("./harthmere-combat-animation-polish-test-lib-v1.cjs");
const { assert, unique } = lib;
let ok = true;
function check(label, fn) {
  try { fn(); console.log(`OK ${label}`); }
  catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); }
}
check("version exists", () => assert(lib.VERSION === "harthmere-combat-animation-polish-v1", "bad version"));
check("frame count is production 24-30", () => assert(lib.FRAME_COUNT >= 24 && lib.FRAME_COUNT <= 30 && lib.FPS === 30, "bad frame/fps"));
check("all body type/color variants covered", () => assert(lib.BODY_VARIANTS.length === lib.BODY_TYPES.length * lib.BODY_COLORS.length && lib.BODY_VARIANTS.length >= 36, "missing body variants"));
check("weapon shape families exceed minimum", () => assert(lib.WEAPON_SHAPES.length >= 8, "not enough weapon shapes"));
check("magic shape families covered", () => assert(lib.MAGIC_SHAPES.length >= 8, "not enough magic shapes"));
check("theme count supports color-coded visual language", () => assert(lib.THEMES.length >= 9, "not enough themes"));
check("profile count provides large variation set", () => assert(lib.PROFILES.length >= 72, `too few profiles ${lib.PROFILES.length}`));
check("all profiles preserve mechanics", () => assert(lib.PROFILES.every((p) => p.mechanicInvariant === true), "visual profile changed mechanics"));
check("all profiles shared by player and NPC", () => assert(lib.PROFILES.every((p) => p.playerAndNpcShared === true), "not shared"));
check("all impact frames are readable", () => assert(lib.PROFILES.every((p) => p.impactFrame >= 12 && p.impactFrame <= 15), "impact frame outside 12-15"));
check("shape ids are unique", () => assert(unique(lib.WEAPON_SHAPES.map((s) => s.id)).length === lib.WEAPON_SHAPES.length, "duplicate weapon shapes"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation polish catalog v1");
