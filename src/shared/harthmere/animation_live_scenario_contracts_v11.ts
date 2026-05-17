// Harthmere live animation scenario regression contracts v11.
// This file is intentionally data-only so tests, renderer debug probes,
// and future gameplay systems can agree on the same production animation scenarios.

export const HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11 =
  "harthmere-live-animation-scenario-regression-v11" as const;

export const HARTHMERE_LIVE_ANIMATION_SAMPLE_FRAMES_V11 = [0, 8, 15, 22, 30] as const;

export const HARTHMERE_LIVE_ANIMATION_GRIP_BUDGET_METERS_V11 = 0.22 as const;

export const HARTHMERE_PLAYER_VISUAL_REGRESSION_SCENARIOS_V11 = [
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
] as const;

export const HARTHMERE_HAND_TRACKING_SCENARIOS_V11 = [
  "weapon_grip_follows_right_hand_frame_0",
  "weapon_grip_follows_right_hand_frame_8_windup",
  "weapon_grip_follows_right_hand_frame_15_impact",
  "weapon_grip_follows_right_hand_frame_22_recovery",
  "weapon_grip_follows_right_hand_frame_30_return",
  "blade_forward_matches_body_forward",
  "weapon_trail_starts_near_blade",
  "weapon_not_inside_head",
  "weapon_not_inside_torso",
] as const;

export const HARTHMERE_TWO_HANDED_WEAPON_SCENARIOS_V11 = [
  "two_handed_sword_right_hand_left_hand_spacing",
  "big_axe_weighted_follow_through",
  "two_handed_hammer_weighted_follow_through",
  "bow_left_hand_hold_right_hand_draw",
  "crossbow_shoulder_and_hand_alignment",
  "two_handed_weapon_does_not_clip_torso",
] as const;

export const HARTHMERE_LOCOMOTION_ACTION_SCENARIOS_V11 = [
  "walk_basic_attack",
  "run_heavy_attack",
  "strafe_block",
  "turn_in_place_block",
  "jump_attack",
  "land_weapon_drawn",
  "walk_tool_use",
  "walk_bow_aim",
] as const;

export const HARTHMERE_NPC_INTERRUPTION_SCENARIOS_V11 = [
  "npc_attack_then_hit_mid_swing",
  "npc_block_then_heavy_hit_recoil",
  "npc_death_during_attack_death_wins",
  "npc_death_near_wall_corpse_visible",
  "npc_resume_patrol_after_combat",
  "npc_weapon_trail_clears_after_death",
] as const;

export const HARTHMERE_PLAYER_DEATH_RESPAWN_SCENARIOS_V11 = [
  "player_death_animation_starts",
  "player_controls_lock_during_death",
  "player_body_visible_during_death_hold",
  "player_respawn_transition",
  "player_respawn_restores_body_collision_weapon_state",
  "player_death_clears_weapon_trails_and_effects",
  "player_death_clears_pending_impact_timer",
  "player_death_clears_resource_hit",
  "player_death_near_water_wall_door_keeps_corpse_visible",
] as const;

export const HARTHMERE_CREATURE_ANIMATION_SCENARIOS_V11 = [
  "wolf_idle_chase_attack_hit_death",
  "rat_flee_corner_turn_continue_flee",
  "crow_idle_hop_or_fly",
  "livestock_idle_walk_loop",
  "creature_path_velocity_matches_animation_speed",
  "creature_turns_without_moonwalking",
  "creature_death_corpse_visible_hold",
] as const;

export const HARTHMERE_RESOURCE_HIT_VISIBILITY_SCENARIOS_V11 = [
  "rock_hit_surface_reticle_before_impact",
  "tool_tip_line_points_to_actual_rock_hit_point",
  "impact_particles_spawn_at_hit_point_not_hand",
  "wrong_tool_shows_failure_reason",
  "out_of_range_resource_shows_range_ring_no_hit",
  "overlapping_grass_rock_selects_nearest_valid_target",
  "target_behind_player_does_not_get_hit",
  "moving_player_reticle_stays_readable",
] as const;

export const HARTHMERE_MULTIPLAYER_ANIMATION_SCENARIOS_V11 = [
  "local_player_attack_replicates_to_remote_viewer",
  "remote_player_weapon_follows_remote_hand",
  "remote_player_death_does_not_vanish_immediately",
  "remote_player_gathering_shows_hit_telegraph",
  "late_joiner_sees_drawn_or_sheathed_weapon_state",
  "prediction_mismatch_corrects_without_large_snap",
] as const;

export const HARTHMERE_ANIMATION_PERFORMANCE_SCENARIOS_V11 = [
  "twenty_npcs_idle_work_loops",
  "twenty_npcs_walking_routes",
  "ten_npcs_five_combat_actors",
  "weapon_swaps_do_not_reload_duplicate_gltfs",
  "animation_mixer_count_under_budget",
  "trails_and_effects_cleanup_after_timeout",
  "death_corpses_despawn_only_after_hold_time",
] as const;

export const HARTHMERE_LOCATION_EFFECT_SCENARIOS_V11 = [
  "attack_hit_point_is_in_front_of_body_forward",
  "resource_effect_origin_is_surface_hit_point",
  "corpse_hold_location_matches_death_location",
  "npc_work_animation_plays_at_assigned_workstation",
  "vendor_social_animation_stays_inside_service_anchor",
  "projectile_release_origin_matches_hand_or_weapon_socket",
  "area_effect_radius_matches_debug_ring",
] as const;

export const HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11 = {
  version: HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11,
  sampleFrames: HARTHMERE_LIVE_ANIMATION_SAMPLE_FRAMES_V11,
  gripBudgetMeters: HARTHMERE_LIVE_ANIMATION_GRIP_BUDGET_METERS_V11,
  npcCorpseHoldMs: 4500,
  playerDeathHoldMs: 2500,
  maxWeaponSnapMeters: 0.35,
  maxReticleSnapMeters: 0.45,
  visualRegression: HARTHMERE_PLAYER_VISUAL_REGRESSION_SCENARIOS_V11,
  handTracking: HARTHMERE_HAND_TRACKING_SCENARIOS_V11,
  twoHanded: HARTHMERE_TWO_HANDED_WEAPON_SCENARIOS_V11,
  locomotionWhileActing: HARTHMERE_LOCOMOTION_ACTION_SCENARIOS_V11,
  npcInterruption: HARTHMERE_NPC_INTERRUPTION_SCENARIOS_V11,
  playerDeathRespawn: HARTHMERE_PLAYER_DEATH_RESPAWN_SCENARIOS_V11,
  creatureAnimation: HARTHMERE_CREATURE_ANIMATION_SCENARIOS_V11,
  resourceHitVisibility: HARTHMERE_RESOURCE_HIT_VISIBILITY_SCENARIOS_V11,
  multiplayerAnimation: HARTHMERE_MULTIPLAYER_ANIMATION_SCENARIOS_V11,
  performance: HARTHMERE_ANIMATION_PERFORMANCE_SCENARIOS_V11,
  locationEffects: HARTHMERE_LOCATION_EFFECT_SCENARIOS_V11,
} as const;
