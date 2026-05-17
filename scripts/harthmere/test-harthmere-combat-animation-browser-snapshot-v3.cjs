#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const sharedPath = path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts");
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const shared = fs.readFileSync(sharedPath, "utf8");
const renderer = fs.existsSync(rendererPath) ? fs.readFileSync(rendererPath, "utf8") : "";
function finish(name) { if (!ok) process.exit(1); console.log(`RESULT: PASS ${name}`); }

check("browser visual snapshot exposes required fields", () => {
  assert(shared.includes("browserVisualSnapshotFields"), "missing shared snapshot field list");
  for (const field of ["playerWeaponHand", "npcWeaponHand", "hiltWorld", "tipWorld", "tipDirection", "currentAnimationFrame", "currentAttackVariation", "currentBodyPose", "currentTrailType", "currentVfxType", "anchorDistanceMeters", "frameTimingMs", "impactFrameWindow"]) {
    assert(shared.includes(`"${field}"`), `missing snapshot field ${field}`);
  }
});
check("renderer debug bridge publishes production visual snapshot", () => {
  assert(renderer.includes("productionVisualSnapshot"), "missing renderer production visual snapshot");
  assert(renderer.includes("productionVisualTestContracts"), "missing renderer shared contracts");
  assert(renderer.includes("harthmereWeaponTipHiltDirectionV2"), "missing hilt/tip data in runtime");
  assert(renderer.includes("harthmereWeaponHandTrackingV10"), "missing hand tracking data in runtime");
});
finish("combat animation browser-snapshot v3");
