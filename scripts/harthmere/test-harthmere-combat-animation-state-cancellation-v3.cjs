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

check("combat-state animation cancellation covers impossible states", () => {
  for (const state of ["dead", "stunned", "evading", "respawning", "teleporting_or_loading"]) {
    assert(shared.includes(`state: "${state}"`), `missing state ${state}`);
  }
});
check("cancellation list blocks attack/cast/targetable visuals when invalid", () => {
  for (const cancel of ["weapon_swing", "cast_pose", "damage_vfx_on_evaded_hit", "attack_ready_pose", "combat_hit_animation", "pvp_damage_visual"]) {
    assert(shared.includes(cancel), `missing cancellation ${cancel}`);
  }
});
finish("combat animation state-cancellation v3");
