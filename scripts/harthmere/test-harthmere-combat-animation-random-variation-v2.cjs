#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const renderer = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const shared = fs.readFileSync(path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts"), "utf8");
check("shared exposes randomized no-repeat variation selector", () => assert(shared.includes("harthmereCombatAnimationProfileForRandomizedActionV2") && shared.includes("lastShape") && shared.includes("requestedShape"), "missing randomized selector"));
check("selector preserves attack type families", () => assert(/attackType === "magic"[\s\S]{0,160}magicSequence[\s\S]{0,160}attackType === "heavy"[\s\S]{0,160}heavyWeaponSequence[\s\S]{0,120}basicWeaponSequence/.test(shared), "selector does not preserve basic/heavy/magic families"));
check("selector prevents immediate repeated shapes", () => assert(/options\.lastShape === sequence\[index\][\s\S]{0,260}index =/.test(shared), "missing no-immediate-repeat guard"));
check("runtime uses random seed rather than deterministic counter only", () => assert(/Math\.random\(\)[\s\S]{0,260}harthmereCombatAnimationProfileForRandomizedActionV2/.test(renderer), "runtime is not using randomized selector"));
check("runtime stores recent shapes for debugging", () => assert(renderer.includes("harthmereCombatPolishRecentShapesV2") && renderer.includes("recentShapes"), "missing recent shape debug history"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation randomized variations v2");
