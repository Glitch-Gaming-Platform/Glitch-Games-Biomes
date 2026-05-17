#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const lib = require("./harthmere-combat-animation-polish-test-lib-v1.cjs");
const { assert } = lib;
const root = process.argv[2] || process.cwd();
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const text = fs.readFileSync(rendererPath, "utf8");
let ok = true;
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
check("NPC polished weapon anchor exists", () => assert(text.includes("private ensureHarthmereNpcPolishedWeaponAnchorV1") && text.includes("this.ensureHarthmereNpcPolishedWeaponAnchorV1(actor)"), "missing NPC polished anchor"));
check("NPC combat pulse weapon polish exists", () => assert(text.includes("private applyHarthmereNpcCombatPolishPulseV1") && text.includes("this.applyHarthmereNpcCombatPolishPulseV1(actor, progress)"), "missing NPC pulse polish"));
check("player and NPC share manifest profiles", () => assert(text.includes("HARTHMERE_ATTACK_ANIMATION_PROFILES_V1"), "renderer not using shared profiles"));
check("attack pulses call NPC polish", () => assert(/pulse\.kind === "attack"[\s\S]{0,900}applyHarthmereNpcCombatPolishPulseV1/.test(text), "attack pulse does not drive NPC weapon polish"));
check("body color/type coverage present in shared catalog", () => assert(lib.BODY_VARIANTS.length >= 36, "missing body color/type combos"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation polish npc player runtime v1");
