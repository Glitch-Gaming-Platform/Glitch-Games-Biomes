#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const renderer = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const shared = fs.readFileSync(path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts"), "utf8");
check("shared hand policy switches sword/main weapon to left", () => assert(/HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2[\s\S]{0,260}mainWeaponHand:\s*"left"[\s\S]{0,220}shieldHand:\s*"right"/.test(shared), "missing left main-hand policy"));
check("runtime hand resolver locks non-shield weapons to left", () => assert(/activeWeaponProfile === "shield"[\s\S]{0,360}namedRightAnchor[\s\S]{0,520}return namedLeftAnchor/.test(renderer), "resolver does not force left main hand and right shield hand"));
check("player melee bone lookup prefers left hand", () => assert(/activeWeaponProfile === "shield"[\s\S]{0,200}\["righthand"[\s\S]{0,260}: \["lefthand"/.test(renderer), "bone candidates not switched"));
check("NPC weapon fallback anchor is left hand", () => assert(/ensureHarthmereNpcPolishedWeaponAnchorV1[\s\S]{0,700}harthmere-anchor-left-hand/.test(renderer) && /attachHarthmereNpcWeaponVisual[\s\S]{0,900}harthmere-anchor-left-hand[\s\S]{0,320}anchor\.add\(visual\)/.test(renderer), "NPC main weapon not on left anchor"));
check("runtime debug contracts say left", () => assert(/primaryAttackVisualSide:\s*"left"/.test(renderer) && /mainHandExpected:\s*"left"/.test(renderer), "debug contracts not left"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation left-hand policy v2");
