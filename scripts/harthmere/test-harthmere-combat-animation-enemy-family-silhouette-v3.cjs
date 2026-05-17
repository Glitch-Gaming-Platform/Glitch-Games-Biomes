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

check("enemy family silhouettes are explicitly distinct", () => {
  for (const family of ["bandit", "guard_knight", "undead_skeleton", "wolf_beast", "mage_caster", "boss", "civilian"]) {
    assert(shared.includes(`family: "${family}"`), `missing enemy family ${family}`);
  }
});
check("enemy silhouettes include body cues, not only colors", () => {
  for (const cue of ["low_aggressive_step", "upright_drilled_guard", "stiff_broken_joint_reach", "four_leg_pounce", "anchored_casting_pose", "large_readable_anticipation", "defensive_cower_turn"]) {
    assert(shared.includes(cue), `missing body cue ${cue}`);
  }
});
finish("combat animation enemy-family silhouette v3");
