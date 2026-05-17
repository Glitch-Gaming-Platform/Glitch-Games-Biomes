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

check("production contract requires every-frame weapon samples", () => {
  assert(/perFrameWeaponAttachment[\s\S]{0,300}sampleEveryFrame:\s*true/.test(shared), "missing sampleEveryFrame contract");
  assert(/Array\.from\([\s\S]{0,140}HARTHMERE_COMBAT_ANIMATION_FRAME_COUNT_V1/.test(shared), "does not enumerate all 30 frames");
});
check("contract validates hilt, tip, teleport, run blend, and NPC grip", () => {
  for (const key of ["hilt_stays_near_chosen_hand_anchor", "tip_remains_ahead_of_hilt", "weapon_never_flips_backward", "weapon_does_not_teleport_between_frames", "run_attack_blend_preserves_grip", "npc_attack_preserves_grip"]) {
    assert(shared.includes(key), `missing ${key}`);
  }
});
check("renderer exposes hand and tip/hilt runtime snapshots", () => {
  assert(renderer.includes("getHarthmereWeaponHandTrackingSnapshotV10"), "missing hand tracking snapshot helper");
  assert(renderer.includes("recordHarthmereWeaponTipHiltDirectionV2"), "missing tip/hilt recorder");
  assert(renderer.includes("productionVisualSnapshot"), "missing browser visual snapshot");
});
finish("combat animation per-frame attachment v3");
