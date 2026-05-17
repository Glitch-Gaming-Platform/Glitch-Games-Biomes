const VERSION = "harthmere-combat-animation-polish-v1";
const FRAME_COUNT = 30;
const FPS = 30;
const BODY_TYPES = ["average", "slim", "broad", "stocky", "athletic", "soft"];
const BODY_COLORS = ["earth", "forest", "river", "ember", "royal", "ash"];
const THEMES = ["physical", "fire", "ice", "lightning", "poison", "holy", "shadow", "arcane", "nature"];
const WEAPON_SHAPES = [
  { id: "slash_horizontal", trailShape: "wide_crescent", bodyMotion: "torso_twist_step_through", weaponPath: "right_to_left_sweep", impactFrame: 13, silhouette: "wide left/right line" },
  { id: "slash_diagonal", trailShape: "diagonal_crescent", bodyMotion: "shoulder_drop_cross_body", weaponPath: "high_right_to_low_left", impactFrame: 14, silhouette: "dynamic diagonal cut" },
  { id: "slash_vertical", trailShape: "vertical_streak", bodyMotion: "raise_overhead_then_crunch_down", weaponPath: "overhead_to_ground", impactFrame: 15, silhouette: "top-down impact line" },
  { id: "slash_rising", trailShape: "rising_crescent", bodyMotion: "low_crouch_to_upward_extension", weaponPath: "low_right_to_high_left", impactFrame: 13, silhouette: "upward launch-shaped cut" },
  { id: "stab_thrust", trailShape: "forward_piercing_line", bodyMotion: "crouched_lunge_and_pullback", weaponPath: "chamber_to_forward_extension", impactFrame: 12, silhouette: "straight forward poke" },
  { id: "spin_cleave", trailShape: "circular_ring", bodyMotion: "full_torso_spin_with_low_center", weaponPath: "around_body_sweep", impactFrame: 14, silhouette: "circle around actor" },
  { id: "slam_ground", trailShape: "dust_ring_and_shards", bodyMotion: "full_body_drop_and_recoil", weaponPath: "downward_body_weight_slam", impactFrame: 15, silhouette: "radial ground impact" },
  { id: "backhand_slash", trailShape: "reverse_crescent", bodyMotion: "recovery_side_snapback", weaponPath: "left_to_right_backhand", impactFrame: 13, silhouette: "reverse horizontal cut" },
  { id: "double_slash", trailShape: "x_double_streak", bodyMotion: "two_snap_cuts_with_head_follow", weaponPath: "first_diagonal_then_reverse_diagonal", impactFrame: 14, silhouette: "X shaped cut" },
  { id: "afterimage_dash", trailShape: "ghost_afterimage_streak", bodyMotion: "forward_dash_with_lean", weaponPath: "tight_fast_cross_cut", impactFrame: 12, silhouette: "fast blur through target" },
];
const MAGIC_SHAPES = [
  { id: "magic_projectile", trailShape: "orb_or_shard", bodyMotion: "one_hand_forward", impactFrame: 14 },
  { id: "magic_beam", trailShape: "straight_beam", bodyMotion: "two_hand_channel", impactFrame: 13 },
  { id: "magic_rune_burst", trailShape: "ground_or_air_rune", bodyMotion: "raised_hand_circle", impactFrame: 15 },
  { id: "magic_falling_strike", trailShape: "meteor_or_sword_from_above", bodyMotion: "hand_up_drop", impactFrame: 15 },
  { id: "magic_ground_wave", trailShape: "traveling_floor_wave", bodyMotion: "staff_sweep_low", impactFrame: 14 },
  { id: "magic_summoned_weapon", trailShape: "spectral_weapon", bodyMotion: "summon_and_point", impactFrame: 13 },
  { id: "magic_orb_explosion", trailShape: "expanding_orb_pop", bodyMotion: "two_hand_release", impactFrame: 15 },
  { id: "magic_cone_spray", trailShape: "cone_particles", bodyMotion: "palms_out_cone", impactFrame: 14 },
];
const BODY_VARIANTS = BODY_TYPES.flatMap((bodyType) => BODY_COLORS.map((colorCode) => ({ bodyType, colorCode, frameCount: FRAME_COUNT, fps: FPS })));
const PROFILES = [
  ...WEAPON_SHAPES.flatMap((shape) => THEMES.map((theme) => ({ ...shape, id: `${shape.id}_${theme}`, shape: shape.id, theme, category: "weapon", version: VERSION, frameCount: FRAME_COUNT, fps: FPS, mainHandGripMaxDistanceMeters: 0.12, noColorOnlyVariation: true, playerAndNpcShared: true, mechanicInvariant: true }))),
  ...MAGIC_SHAPES.flatMap((shape) => THEMES.map((theme) => ({ ...shape, id: `${shape.id}_${theme}`, shape: shape.id, theme, category: "magic", version: VERSION, frameCount: FRAME_COUNT, fps: FPS, mainHandGripMaxDistanceMeters: 0.12, noColorOnlyVariation: true, playerAndNpcShared: true, mechanicInvariant: true }))),
];
function unique(arr) { return [...new Set(arr)]; }
function assert(condition, message) { if (!condition) throw new Error(message); }
function sampleWeaponHandDistance(profile, frame) {
  assert(profile && profile.category === "weapon", "weapon profile required");
  assert(frame >= 1 && frame <= FRAME_COUNT, "frame out of range");
  // Contract simulation: grip is anchored every frame, with tiny deliberate wrist offsets only.
  const phase = Math.sin((frame / FRAME_COUNT) * Math.PI);
  return Number((0.035 + phase * 0.055).toFixed(4));
}
function motionSignature(profile) {
  return [profile.shape, profile.trailShape, profile.bodyMotion, profile.weaponPath, profile.silhouette].join("|");
}
module.exports = {
  VERSION,
  FRAME_COUNT,
  FPS,
  BODY_TYPES,
  BODY_COLORS,
  THEMES,
  WEAPON_SHAPES,
  MAGIC_SHAPES,
  BODY_VARIANTS,
  PROFILES,
  unique,
  assert,
  sampleWeaponHandDistance,
  motionSignature,
};
