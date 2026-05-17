#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

let failures = 0;

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const p = file(rel);
  if (!fs.existsSync(p)) {
    fail(`${rel} exists`, [`Missing file: ${p}`]);
    return "";
  }
  return fs.readFileSync(p, "utf8");
}

function ok(label, condition, details = []) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    fail(label, details);
  }
}

function fail(label, details = []) {
  failures += 1;
  console.log(`FAIL ${label}`);
  for (const detail of details) {
    console.log(`  - ${detail}`);
  }
}

function allPresent(text, values) {
  return values.every((value) => text.includes(value));
}

function numberFrom(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : NaN;
}

console.log("== Harthmere live animation scenario regression tests v11 ==");
console.log(`Root: ${root}\n`);

const contract = read("src/shared/harthmere/animation_live_scenario_contracts_v11.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const visualScenarios = [
  "player_weapon_sheathed_idle",
  "player_weapon_drawn_idle",
  "player_basic_attack_impact",
  "player_heavy_attack_impact",
  "player_block_contact",
  "player_tool_hit_rock",
  "player_tool_hit_grass",
  "player_tool_hit_dirt",
  "player_attack_north",
  "player_attack_east",
  "player_attack_south",
  "player_attack_west",
];

const handScenarios = [
  "weapon_grip_follows_right_hand_frame_0",
  "weapon_grip_follows_right_hand_frame_8_windup",
  "weapon_grip_follows_right_hand_frame_15_impact",
  "weapon_grip_follows_right_hand_frame_22_recovery",
  "weapon_grip_follows_right_hand_frame_30_return",
  "blade_forward_matches_body_forward",
  "weapon_trail_starts_near_blade",
  "weapon_not_inside_head",
  "weapon_not_inside_torso",
];

const twoHandedScenarios = [
  "two_handed_sword_right_hand_left_hand_spacing",
  "big_axe_weighted_follow_through",
  "two_handed_hammer_weighted_follow_through",
  "bow_left_hand_hold_right_hand_draw",
  "crossbow_shoulder_and_hand_alignment",
  "two_handed_weapon_does_not_clip_torso",
];

const locomotionScenarios = [
  "walk_basic_attack",
  "run_heavy_attack",
  "strafe_block",
  "turn_in_place_block",
  "jump_attack",
  "land_weapon_drawn",
  "walk_tool_use",
  "walk_bow_aim",
];

const npcInterruptionScenarios = [
  "npc_attack_then_hit_mid_swing",
  "npc_block_then_heavy_hit_recoil",
  "npc_death_during_attack_death_wins",
  "npc_death_near_wall_corpse_visible",
  "npc_resume_patrol_after_combat",
  "npc_weapon_trail_clears_after_death",
];

const playerDeathScenarios = [
  "player_death_animation_starts",
  "player_controls_lock_during_death",
  "player_body_visible_during_death_hold",
  "player_respawn_transition",
  "player_respawn_restores_body_collision_weapon_state",
  "player_death_clears_weapon_trails_and_effects",
  "player_death_clears_pending_impact_timer",
  "player_death_clears_resource_hit",
  "player_death_near_water_wall_door_keeps_corpse_visible",
];

const creatureScenarios = [
  "wolf_idle_chase_attack_hit_death",
  "rat_flee_corner_turn_continue_flee",
  "crow_idle_hop_or_fly",
  "livestock_idle_walk_loop",
  "creature_path_velocity_matches_animation_speed",
  "creature_turns_without_moonwalking",
  "creature_death_corpse_visible_hold",
];

const resourceScenarios = [
  "rock_hit_surface_reticle_before_impact",
  "tool_tip_line_points_to_actual_rock_hit_point",
  "impact_particles_spawn_at_hit_point_not_hand",
  "wrong_tool_shows_failure_reason",
  "out_of_range_resource_shows_range_ring_no_hit",
  "overlapping_grass_rock_selects_nearest_valid_target",
  "target_behind_player_does_not_get_hit",
  "moving_player_reticle_stays_readable",
];

const multiplayerScenarios = [
  "local_player_attack_replicates_to_remote_viewer",
  "remote_player_weapon_follows_remote_hand",
  "remote_player_death_does_not_vanish_immediately",
  "remote_player_gathering_shows_hit_telegraph",
  "late_joiner_sees_drawn_or_sheathed_weapon_state",
  "prediction_mismatch_corrects_without_large_snap",
];

const performanceScenarios = [
  "twenty_npcs_idle_work_loops",
  "twenty_npcs_walking_routes",
  "ten_npcs_five_combat_actors",
  "weapon_swaps_do_not_reload_duplicate_gltfs",
  "animation_mixer_count_under_budget",
  "trails_and_effects_cleanup_after_timeout",
  "death_corpses_despawn_only_after_hold_time",
];

const locationScenarios = [
  "attack_hit_point_is_in_front_of_body_forward",
  "resource_effect_origin_is_surface_hit_point",
  "corpse_hold_location_matches_death_location",
  "npc_work_animation_plays_at_assigned_workstation",
  "vendor_social_animation_stays_inside_service_anchor",
  "projectile_release_origin_matches_hand_or_weapon_socket",
  "area_effect_radius_matches_debug_ring",
];

ok("shared v11 scenario contract exists", contract.includes("HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11"));
ok("renderer exposes v11 debug bridge", assets.includes("__harthmereAnimationScenarioRegressionV11"));
ok("renderer aliases v11 debug bridge for live tests", assets.includes("__harthmereLiveAnimationScenarioRegressionV11"));
ok("full suite includes live animation scenario v11 test", suite.includes("test-harthmere-live-animation-scenario-regression-v11.cjs"));

ok("v11 contract samples frame 0 / 8 / 15 / 22 / 30 across the swing", allPresent(contract, ["[0, 8, 15, 22, 30]"]));
ok("v11 grip budget remains tight enough for blocky body scale", numberFrom(contract, /GRIP_BUDGET_METERS_V11\s*=\s*([0-9.]+)/) <= 0.22);

ok("visual regression scenarios cover player weapon and directional attack poses", allPresent(contract, visualScenarios));
ok("hand-to-weapon tracking is tested across windup, impact, recovery, and return", allPresent(contract, handScenarios));
ok("two-handed weapons require left/right hand participation", allPresent(contract, twoHandedScenarios));
ok("locomotion while acting scenarios are represented", allPresent(contract, locomotionScenarios));
ok("NPC interruption scenarios are represented", allPresent(contract, npcInterruptionScenarios));
ok("player death/respawn lifecycle scenarios are represented", allPresent(contract, playerDeathScenarios));
ok("creature/animal animation scenarios are represented", allPresent(contract, creatureScenarios));
ok("resource gathering hit visibility scenarios are represented", allPresent(contract, resourceScenarios));
ok("remote/multiplayer animation scenarios are represented", allPresent(contract, multiplayerScenarios));
ok("animation crowd/performance scenarios are represented", allPresent(contract, performanceScenarios));
ok("world-location/effect-origin animation scenarios are represented", allPresent(contract, locationScenarios));

ok("renderer v11 snapshot probes weapon hand tracking", assets.includes("weaponHandTracking"));
ok("renderer v11 snapshot probes resource hit telegraph state", assets.includes("resourceHitTelegraphState"));
ok("renderer v11 snapshot probes object/effect range", assets.includes("objectEffectRangeAudit"));
ok("renderer v11 snapshot probes creature animation audits", assets.includes("creatureAnimationAudit"));
ok("renderer v11 snapshot probes social/work animation audits", assets.includes("socialWorkAnimationAudit"));
ok("renderer v11 snapshot probes death/respawn audits", assets.includes("deathRespawnCinematicAudit"));

ok("v11 API exposes two-handed weapon probe", assets.includes("twoHandedProbe"));
ok("v11 API exposes locomotion/action probe", assets.includes("locomotionActionProbe"));
ok("v11 API exposes NPC interruption probe", assets.includes("npcInterruptionProbe"));
ok("v11 API exposes player death/respawn probe", assets.includes("playerDeathRespawnProbe"));
ok("v11 API exposes resource hit visibility probe", assets.includes("resourceHitVisibilityProbe"));
ok("v11 API exposes multiplayer animation probe", assets.includes("multiplayerAnimationProbe"));
ok("v11 API exposes animation performance probe", assets.includes("performanceProbe"));
ok("v11 API exposes location/effect probe", assets.includes("locationEffectProbe"));

ok("NPC corpse hold is long enough to prevent immediate disappearance", numberFrom(contract, /npcCorpseHoldMs:\s*([0-9]+)/) >= 3000);
ok("player death hold exists before respawn transition", numberFrom(contract, /playerDeathHoldMs:\s*([0-9]+)/) >= 1500);
ok("location tests require corpse location to match death location", contract.includes("corpse_hold_location_matches_death_location"));
ok("resource hit tests require impact particles at hit point, not hand", contract.includes("impact_particles_spawn_at_hit_point_not_hand"));

console.log("");
if (failures > 0) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
