#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const sharedPath = path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts");
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const shared = fs.readFileSync(sharedPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
check("shared file exists with contracts", () => assert(shared.includes("HARTHMERE_COMBAT_POLISH_RUNTIME_RULES_V1") && shared.includes("attackVariationCannotBeColorOnly"), "shared contracts missing"));
check("renderer contains polished anchor pose application", () => assert(renderer.includes("private applyHarthmereCombatPolishAnchorPoseV1"), "missing anchor pose method"));
check("renderer contains polished trail profile application", () => assert(renderer.includes("private applyHarthmerePolishedTrailProfileV1"), "missing trail profile method"));
check("renderer exposes debug combat polish state", () => assert(renderer.includes("combatAnimationPolish"), "missing debug state hook"));
check("no stale transform wording in new manual swing", () => assert(renderer.includes("capturedBaseTransformAllowedDuringAttack: false"), "stale transform allowed"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation polish regression static v1");
