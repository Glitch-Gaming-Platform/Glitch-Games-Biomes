// harthmere-full-animation-runtime-v6
export const HARTHMERE_FULL_ANIMATION_RUNTIME_VERSION_V6 =
  "harthmere-full-animation-runtime-v6";

export type HarthmereAnimationFamilyV6 =
  | "creature" | "mount" | "ranged" | "magic" | "shield" | "dodge"
  | "airborne" | "gathering" | "crafting" | "building" | "social"
  | "deathRespawn" | "boss" | "screenshot";

export type HarthmereAnimationRequestV6 = {
  family: HarthmereAnimationFamilyV6;
  action: string;
  phase?: "idle" | "start" | "loop" | "impact" | "recover" | "end";
  actorId?: string | number;
  targetId?: string | number;
  itemId?: string;
  direction?: { x: number; y?: number; z: number };
  windupMs?: number;
  impactMs?: number;
  recoveryMs?: number;
  allowLowerBodyLocomotion?: boolean;
  screenshotLabel?: string;
};

export const HARTHMERE_ANIMATION_FAMILY_ORDER_V6: readonly HarthmereAnimationFamilyV6[] = [
  "creature", "mount", "ranged", "magic", "shield", "dodge", "airborne",
  "gathering", "crafting", "building", "social", "deathRespawn", "boss", "screenshot",
] as const;

export const HARTHMERE_FULL_ANIMATION_CLIP_FAMILIES_V6 = {
  creature: {
    required: ["Idle", "Walk", "Walking", "Run", "Running", "Attack", "Bite", "HitReact", "Death"],
    runtime: ["idle", "walk", "run", "attack", "hit", "death", "flee", "turnInPlace"],
    smoothing: { velocityDeadzone: 0.05, turnRate: 10, blendDtCap: 1 / 24 },
  },
  mount: {
    required: ["Idle", "Walk", "Walking", "Run", "Running", "Jump"],
    runtime: ["mountIdle", "mountWalk", "mountRun", "mountStart", "mountStop", "mount", "dismount", "riderSeat"],
    smoothing: { velocityDeadzone: 0.08, turnRate: 8, blendDtCap: 1 / 24 },
  },
  ranged: {
    required: ["Idle", "Attack", "HeavyAttack", "Draw_24", "Use_24", "HeavyUse_24", "IdleHeld_24"],
    runtime: ["equip", "aimDraw", "holdAim", "release", "reload", "quiverDraw", "projectileSpawn"],
    timing: { windupMs: 180, impactMs: 300, recoveryMs: 420 },
  },
  magic: {
    required: ["Idle", "Attack", "HeavyAttack", "BasicMagic", "HeavyMagic", "Use_24", "HeavyUse_24", "IdleHeld_24"],
    runtime: ["equipFocus", "castStart", "channel", "castRelease", "interrupt", "vfxSpawn"],
    timing: { windupMs: 220, impactMs: 380, recoveryMs: 520 },
  },
  shield: {
    required: ["Block", "ShieldBlock", "HitReact", "Idle"],
    runtime: ["raise", "hold", "walkGuard", "turnGuard", "bash", "parry", "recoil", "lower"],
    timing: { windupMs: 70, impactMs: 110, recoveryMs: 260 },
  },
  dodge: {
    required: ["Running", "Jump", "Fall", "HitReact"],
    runtime: ["dodge", "evade", "stagger", "knockback", "knockdown", "getUp", "interruptWindow"],
    timing: { windupMs: 40, impactMs: 110, recoveryMs: 360 },
  },
  airborne: {
    required: ["Jump", "Fall", "Idle"],
    runtime: ["jumpStart", "airborne", "fallLoop", "land", "hardLand", "armedJump", "blockingJump"],
    smoothing: { verticalDeadzone: 0.04, landingBlendMs: 120, blendDtCap: 1 / 24 },
  },
  gathering: {
    required: ["DiggingTool", "DiggingHand", "FishingCastPull", "FishingCastRelease", "FishingReel", "Watering"],
    runtime: ["mine", "woodcut", "fishCast", "fishReel", "foragePickup", "harvestImpact"],
    timing: { windupMs: 180, impactMs: 360, recoveryMs: 420 },
  },
  crafting: {
    required: ["DiggingTool", "ItemPutBack", "Idle"],
    runtime: ["stationUse", "blacksmithHammer", "tailorWork", "alchemyMix", "cookStir", "craftComplete"],
    timing: { windupMs: 160, impactMs: 320, recoveryMs: 480 },
  },
  building: {
    required: ["DiggingTool", "ItemPutBack", "Idle"],
    runtime: ["placePreview", "placeConfirm", "repair", "hammerImpact", "buildComplete"],
    timing: { windupMs: 150, impactMs: 300, recoveryMs: 400 },
  },
  social: {
    required: ["Idle", "Waving", "Sit", "Eat", "Drink", "Applause", "Point"],
    runtime: ["vendorIdle", "talkGesture", "questGesture", "sit", "eat", "drink", "sleep", "workLoop", "crowdEmote"],
    smoothing: { idleHoldMs: 450, gestureBlendMs: 140, blendDtCap: 1 / 24 },
  },
  deathRespawn: {
    required: ["Death", "Fall", "Idle"],
    runtime: ["playerDeath", "controlsLocked", "revive", "respawn", "npcDeath", "corpseHold", "despawn"],
    timing: { windupMs: 0, impactMs: 180, recoveryMs: 900 },
  },
  boss: {
    required: ["Idle", "Attack", "HeavyAttack", "HitReact", "Death"],
    runtime: ["telegraph", "phaseTransition", "areaAttack", "summon", "enrage", "wipeReset", "bossDeath"],
    timing: { windupMs: 700, impactMs: 1200, recoveryMs: 900 },
  },
  screenshot: {
    required: ["Idle", "Walking", "Running", "Attack", "HeavyAttack", "Block", "ShieldBlock", "Jump", "Fall", "Death"],
    runtime: ["baselineCapture", "poseNorth", "poseEast", "poseSouth", "poseWest", "compareDebugState"],
    smoothing: { stableFrames: 8, maxYawDriftDeg: 6, maxAttachmentDrift: 0.18 },
  },
} as const;

export const HARTHMERE_SCREENSHOT_BASELINES_V6 = [
  "creature_idle", "creature_attack", "mount_rider_idle", "ranged_aim", "ranged_release",
  "magic_channel", "magic_release", "shield_walk_guard", "shield_parry", "dodge_stagger",
  "jump_fall_land", "mine_impact", "woodcut_impact", "fish_cast", "craft_station",
  "build_repair", "vendor_talk", "npc_work_loop", "player_death", "respawn",
  "boss_telegraph", "boss_phase_transition", "facing_north", "facing_east",
  "facing_south", "facing_west",
] as const;

export function harthmereAnimationTimingForFamilyV6(family: HarthmereAnimationFamilyV6) {
  const profile = HARTHMERE_FULL_ANIMATION_CLIP_FAMILIES_V6[family] as {
    timing?: { windupMs: number; impactMs: number; recoveryMs: number };
  };
  return profile.timing ?? { windupMs: 120, impactMs: 240, recoveryMs: 360 };
}
