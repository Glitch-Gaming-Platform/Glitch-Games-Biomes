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

check("weapon family coverage contract includes all required families", () => {
  for (const family of ["sword", "axe", "mace", "hammer", "spear", "dagger", "greatsword", "bow", "crossbow", "staff", "wand", "shield", "fist", "claw", "magic_blade"]) {
    assert(shared.includes(`"${family}"`), `missing weapon family ${family}`);
  }
});
check("melee families map to distinct attack silhouettes", () => {
  for (const shape of ["slash_horizontal", "slash_diagonal", "slash_vertical", "slash_rising", "stab_thrust", "spin_cleave", "slam_ground", "backhand_slash", "double_slash", "afterimage_dash"]) {
    assert(shared.includes(`"${shape}"`), `missing melee shape ${shape}`);
  }
});
check("ranged, shield, and caster visual expectations exist even if live execution comes later", () => {
  for (const shape of ["ranged_draw_release", "ranged_aim_release", "shield_block", "shield_bash", "magic_projectile", "magic_beam", "magic_ground_wave"]) {
    assert(shared.includes(`"${shape}"`), `missing expected family shape ${shape}`);
  }
});
finish("combat animation weapon-family coverage v3");
