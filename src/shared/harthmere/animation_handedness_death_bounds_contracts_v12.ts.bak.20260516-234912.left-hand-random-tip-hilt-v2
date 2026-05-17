// Harthmere animation handedness/death/bounds contracts v12.
// This file captures the production requirements that were missed by earlier
// passing tests: the visible attacking arm must hold the weapon, dead actors
// must stop locomotion, and corpse bounds must stay visible/above ground.

export const HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12 =
  "harthmere-animation-handedness-death-bounds-v12" as const;

export const HARTHMERE_MAIN_HAND_VISUAL_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  primaryAttackVisualSide: "right",
  primaryFallbackAnchor: "harthmere-anchor-right-hand",
  shieldFallbackAnchor: "harthmere-anchor-left-hand",
  // The Harthmere blocky model's local fallback anchor names are mirrored in
  // the camera-facing rig. The important production rule is visual: the weapon
  // must sit on the same side as the arm that performs the attack.
  requirement:
    "One-handed melee weapons must attach to the visible attack hand, not the opposite side. Shields/offhand items use the opposite visual side.",
  sampleFrames: [0, 8, 15, 22, 30] as const,
  maxGripDistanceMeters: 0.22,
  maxBladeLagMeters: 0.18,
} as const;

export const HARTHMERE_DEATH_ALL_ACTOR_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  actorFamilies: [
    "player",
    "remote_player",
    "npc",
    "townsperson",
    "guard",
    "vendor",
    "hostile",
    "creature",
    "animal",
    "livestock",
    "wildlife",
    "boss",
    "training_dummy",
  ] as const,
  deathStates: [
    "death_animation_starts",
    "locomotion_velocity_zeroed",
    "ai_wander_route_stops",
    "attack_action_cancelled",
    "weapon_trail_cleared",
    "resource_hit_cancelled",
    "corpse_pose_visible",
    "corpse_hold_duration_enforced",
    "corpse_bounds_above_ground",
    "corpse_not_inside_solid_collision",
    "corpse_does_not_block_core_route",
    "despawn_after_hold_only",
  ] as const,
  minCorpseHoldMs: 4500,
  minCorpseScale: 0.72,
  maxCorpseGroundGapMeters: 0.18,
  maxCorpseSinkMeters: 0.04,
  requirement:
    "Dead actors must not keep walking, attacking, gathering, or pathing. They must remain visible as above-ground corpses until a deliberate despawn/respawn transition.",
} as const;

export const HARTHMERE_DEATH_BOUNDS_SPACING_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  tests: [
    "death_at_flat_ground",
    "death_on_slope",
    "death_near_wall",
    "death_near_door",
    "death_near_water",
    "death_on_road",
    "death_inside_town_crowd",
    "death_near_service_route",
    "death_next_to_resource_node",
    "death_inside_collision_escape",
    "large_creature_death_bounds",
    "tiny_animal_death_bounds",
    "remote_actor_death_bounds",
    "boss_death_bounds",
  ] as const,
  minSeparationFromServiceApproachMeters: 0.8,
  maxCorpseRadiusMeters: 1.8,
  requirement:
    "Corpse bounds should be based on the living actor footprint, clamped above ground, and checked against the same spacing/collision assumptions used by town placement tests.",
} as const;

export const HARTHMERE_WORLD_EFFECT_RANGE_VISIBILITY_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  objectFamilies: ["dirt", "grass", "rock", "ore", "tree", "crop", "water", "generic_resource"] as const,
  requiredSignals: [
    "pre_hit_range_ring",
    "valid_target_reticle",
    "invalid_target_reticle",
    "hand_or_tool_tip_line",
    "impact_frame_flash",
    "surface_decal_at_hit_point",
    "resource_specific_particles",
    "failure_reason_text",
    "nearest_valid_target_selection",
    "blocked_line_of_sight_feedback",
    "behind_player_rejection_feedback",
    "cooldown_feedback",
  ] as const,
  requirement:
    "Gathering and world-hit actions must make the exact hit location and effect range obvious before and at impact, and must visibly reject invalid targets.",
} as const;
