#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let failures = 0;

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    fail(`${rel} exists`, [`Missing ${p}`]);
    return "";
  }
  return fs.readFileSync(p, "utf8");
}
function ok(label, condition, details = []) {
  if (condition) console.log(`OK ${label}`);
  else fail(label, details);
}
function fail(label, details = []) {
  failures += 1;
  console.log(`FAIL ${label}`);
  for (const detail of details) console.log(`  - ${detail}`);
}
function includesAll(text, arr) {
  return arr.every((x) => text.includes(x));
}

console.log("== Harthmere animation handedness/death/bounds tests v12 ==");
console.log(`Root: ${root}\n`);

const contract = read("src/shared/harthmere/animation_handedness_death_bounds_contracts_v12.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const actorFamilies = [
  "player", "remote_player", "npc", "townsperson", "guard", "vendor", "hostile",
  "creature", "animal", "livestock", "wildlife", "boss", "training_dummy",
];
const deathStates = [
  "death_animation_starts", "locomotion_velocity_zeroed", "ai_wander_route_stops",
  "attack_action_cancelled", "weapon_trail_cleared", "resource_hit_cancelled",
  "corpse_pose_visible", "corpse_hold_duration_enforced", "corpse_bounds_above_ground",
  "corpse_not_inside_solid_collision", "corpse_does_not_block_core_route", "despawn_after_hold_only",
];
const boundsTests = [
  "death_at_flat_ground", "death_on_slope", "death_near_wall", "death_near_door",
  "death_near_water", "death_on_road", "death_inside_town_crowd", "death_near_service_route",
  "death_next_to_resource_node", "death_inside_collision_escape", "large_creature_death_bounds",
  "tiny_animal_death_bounds", "remote_actor_death_bounds", "boss_death_bounds",
];
const worldSignals = [
  "pre_hit_range_ring", "valid_target_reticle", "invalid_target_reticle",
  "hand_or_tool_tip_line", "impact_frame_flash", "surface_decal_at_hit_point",
  "resource_specific_particles", "failure_reason_text", "nearest_valid_target_selection",
  "blocked_line_of_sight_feedback", "behind_player_rejection_feedback", "cooldown_feedback",
];

ok("shared v12 contract exists", contract.includes("HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12"));
ok("full suite includes v12 handedness/death/bounds test", suite.includes("test-harthmere-animation-handedness-death-bounds-v12.cjs"));

ok("main hand visual contract says visible attacking hand is right", contract.includes('primaryAttackVisualSide: "right"'));
ok("main-hand fallback anchor is on the visual attack side", contract.includes('primaryFallbackAnchor: "harthmere-anchor-right-hand"'));
ok("shield/offhand fallback anchor is opposite main-hand", contract.includes('shieldFallbackAnchor: "harthmere-anchor-left-hand"'));
ok("renderer melee fallback now uses visible attack-hand anchor", assets.includes('activeWeaponProfile === "shield" ? "harthmere-anchor-left-hand" : "harthmere-anchor-right-hand"'));
ok("renderer melee bone lookup follows visible attack hand", assets.includes('? ["lefthand"') && assets.includes(': ["righthand"'));
ok("renderer writes handedness debug payload on weapon", assets.includes("harthmereHandednessDeathBoundsV12"));
ok("renderer debug bridge exposes v12 handedness probe", assets.includes("handednessProbeV12"));

ok("death contract covers every actor family", includesAll(contract, actorFamilies));
ok("death contract covers every required death state", includesAll(contract, deathStates));
ok("death bounds contract covers slope/wall/door/water/crowd/resource/boss edge cases", includesAll(contract, boundsTests));
ok("death world interaction contract covers visible effect range signals", includesAll(contract, worldSignals));

ok("NPC death uses visible corpse hold scale instead of shrinking to zero", npcs.includes("HARTHMERE_DEATH_CORPSE_HOLD_SCALE_V12") && !/getScaleFromHitCurve\(\s*onDeathScaleCurve,\s*ON_DEATH_ANIMATION_DURATION_SECS,\s*0\s*\)/.test(npcs));
ok("NPC death freezes visible render position at death location", npcs.includes("harthmereDeathWorldPositionV12"));
ok("dead NPC/animal velocity is zeroed so corpses do not walk", npcs.includes("harthmereStoppedDeathVelocityV12") && npcs.includes("harthmereIsDeadV12 ? harthmereStoppedDeathVelocityV12 : velocity"));
ok("dead NPC/animal attack action is cancelled", npcs.includes("!harthmereIsDeadV12 && emote?.emote_type"));
ok("NPC death writes bounds metadata for above-ground/collision audits", npcs.includes("harthmereDeathBoundsV12") && npcs.includes("aboveGroundRequired") && npcs.includes("notInsideSolidCollision"));
ok("death bounds include service-route non-blocking requirement", npcs.includes("doesNotBlockCoreRoute") && contract.includes("minSeparationFromServiceApproachMeters"));
ok("renderer exposes death all-actor probe", assets.includes("deathAllActorsProbeV12"));
ok("renderer exposes death bounds probe", assets.includes("deathBoundsProbeV12"));
ok("renderer exposes world effect visibility probe", assets.includes("worldEffectVisibilityProbeV12"));

console.log("");
if (failures > 0) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
