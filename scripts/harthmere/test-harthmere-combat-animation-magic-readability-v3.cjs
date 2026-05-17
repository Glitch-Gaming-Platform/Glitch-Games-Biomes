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

check("all magic silhouettes have readability contracts", () => {
  for (const shape of ["magic_projectile", "magic_beam", "magic_rune_burst", "magic_falling_strike", "magic_ground_wave", "magic_summoned_weapon", "magic_orb_explosion", "magic_cone_spray"]) {
    assert(shared.includes(`shape: "${shape}"`) || shared.includes(`"${shape}"`), `missing magic readability ${shape}`);
  }
});
check("magic tells include projectile path, beam line, rune telegraph, falling marker, ground direction, and cone direction", () => {
  for (const key of ["requiresVisibleTravelPath", "requiresCasterToTargetLine", "requiresPreImpactTelegraph", "requiresGroundMarkerBeforeHit", "requiresGroundTravelDirection", "requiresReadableConeDirection"]) {
    assert(shared.includes(key), `missing ${key}`);
  }
});
finish("combat animation magic-readability v3");
