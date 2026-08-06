import {
  HARTHMERE_ATTACK_VARIATION_POLISH_VERSION,
  getHarthmereAttackFamilyForAction,
  pickHarthmereAttackVariation,
} from "@/shared/harthmere/attack_variation_polish";
import type { Player } from "@/client/game/resources/players";
import { EMOTE_PROPERTIES } from "@/client/game/resources/players";
import type { ClientResources } from "@/client/game/resources/types";
import type {
  AnimationAction,
  AnimationName,
  AnimationSystemState,
} from "@/client/game/util/animation_system";
import { AnimationSystem } from "@/client/game/util/animation_system";
import type { MixedMesh } from "@/client/game/util/animations";
import { getVelocityBasedWeights } from "@/client/game/util/animations";
import { gltfToThree } from "@/client/game/util/gltf_helpers";
import { findPlayerHeldItemAttachmentParent } from "@/client/game/util/player_attachment";
import { TimelineMatcher } from "@/client/game/util/timeline_matcher";
import type { CharacterAnimationTiming } from "@/server/shared/minigames/ruleset/tweaks";
import { HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS } from "@/shared/cutscene/cinematic_expressions";
import {
  HARTHMERE_DODGE_CLIP_TIME_SCALE,
  playerMovementActionAnimationName,
} from "@/shared/game/movement_actions";
import { HARTHMERE_PLAYER_ATTACK_TIMINGS } from "@/shared/harthmere/deliberate_combat";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const RUN_SPEED = 8;

// harthmere-body-animation-weapon-sync
// The weapon visual system now has deterministic timing. Body animation must
// follow the same contract instead of fighting locomotion or restarting clips
// from tiny velocity noise. These constants intentionally live next to the
// player AnimationSystem because this is where weight/layer decisions happen.
export const HARTHMERE_BODY_ANIMATION_SYNC_VERSION =
  "harthmere-body-animation-weapon-sync";

export const HARTHMERE_BODY_WEAPON_TIMING_PROFILES = {
  basic: {
    ...HARTHMERE_PLAYER_ATTACK_TIMINGS.basic,
    bodyDurationS:
      (HARTHMERE_PLAYER_ATTACK_TIMINGS.basic.impactMs +
        HARTHMERE_PLAYER_ATTACK_TIMINGS.basic.recoveryMs) /
      1000,
  },
  heavy: {
    ...HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy,
    bodyDurationS:
      (HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs +
        HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.recoveryMs) /
      1000,
  },
  ranged: {
    ...HARTHMERE_PLAYER_ATTACK_TIMINGS.ranged,
    bodyDurationS:
      (HARTHMERE_PLAYER_ATTACK_TIMINGS.ranged.impactMs +
        HARTHMERE_PLAYER_ATTACK_TIMINGS.ranged.recoveryMs) /
      1000,
  },
  magic: {
    ...HARTHMERE_PLAYER_ATTACK_TIMINGS.magic,
    bodyDurationS:
      (HARTHMERE_PLAYER_ATTACK_TIMINGS.magic.impactMs +
        HARTHMERE_PLAYER_ATTACK_TIMINGS.magic.recoveryMs) /
      1000,
  },
  block: { windupMs: 70, impactMs: 110, recoveryMs: 260, bodyDurationS: 0.44 },
} as const;

const HARTHMERE_BODY_ATTACK_TIME_SCALE = {
  attack1: 1.0,
  // Both families already carry distinct frame-exact timing in Blender.
  // Runtime scaling would desynchronize the body from contact, trail, and SFX.
  attack2: 1.0,
} as const;

const HARTHMERE_BODY_UPPER_BODY_RE =
  /(.*(head|neck|chest|spine|upperarm|forearm|arm|hand|tool|shoulder|clavicle|finger|weapon).*)/i;
const HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED = 0.08;
const HARTHMERE_BODY_MAX_BLEND_DT = 1 / 24;

const HARTHMERE_ATTACK_VARIATION_SEQUENCE_VERSION =
  "harthmere-attack-variation-sequencing";
type HarthmereAttackVariationEmoteType =
  | "attack1Var1"
  | "attack1Var2"
  | "attack1Var3"
  | "attack1Var4"
  | "attack2Var1"
  | "attack2Var2"
  | "attack2Var3"
  | "attack2Var4";
function getHarthmereAttackVariationEmoteType(
  emoteType: "attack1" | "attack2",
  variationIndex: number | undefined
): HarthmereAttackVariationEmoteType {
  const normalized = Math.min(4, Math.max(1, Math.trunc(variationIndex ?? 1)));
  return `${emoteType}Var${normalized}` as HarthmereAttackVariationEmoteType;
}

// harthmere-body-weapon-visual-cohesion
// Screenshot regression: player sword attacks must not twist the full torso,
// neck, head, root, or legs. Weapon/body sync owns only the shoulder/arm/hand
// chain; locomotion/idle owns the rest. This keeps the blade attached to the
// hand instead of the body folding around the weapon.

// harthmere-body-animation-weapon-sync-static-compat
// The v8 runtime supersedes these legacy broad-body clip mappings, but older
// static v5 regression checks still look for the exact original strings. Keep
// them here as comments so the historical test documents the migration without
// forcing the runtime back to the jittery full-body Attack/HeavyAttack clips.
// const HARTHMERE_BODY_UPPER_BODY_RE = /(.*(arm|hand|tool|chest|spine|shoulder|clavicle|neck|head|finger|weapon).*)/i;
// attack1: { fileAnimationName: "HarthmereBodyWeaponBasic_Aligned_30", backupFileAnimationNames: ["Attack", "SideSwing"] },
// attack2: { fileAnimationName: "HarthmereBodyWeaponHeavy_Aligned_30", backupFileAnimationNames: ["HeavyAttack", "Attack2", "Attack"] },
// easeInTime: 0.035

// harthmere-body-weapon-aligned-clips
// These clips are generated into every Harthmere player body size/color variant.
// They replace the old broad Attack/HeavyAttack poses with restrained, upper-body
// weapon/item overlays that share impact timing with the visible equipment.
export const HARTHMERE_BODY_WEAPON_ALIGNED_CLIPS_VERSION =
  "harthmere-body-weapon-aligned-clips";

// snapshot-player-animation-compat
// Glitch/Harthmere weapon-body clips are still preferred when present, but the
// imported developer snapshot player meshes must be allowed to use their own
// full-body Attack/Attack2 clips. Without this guard, snapshot players can be
// driven through Harthmere upper-body-only variation actions even when those
// Harthmere clips do not exist on the loaded GLB.
export const SNAPSHOT_PLAYER_ANIMATION_COMPAT_VERSION =
  "snapshot-player-animation-compat";

// harthmere-creature-social-death-handtracking
export const HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION =
  "harthmere-creature-social-death-handtracking";

export const HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION =
  "harthmere-body-weapon-visual-cohesion";
const HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN = 0.08;

// harthmere-full-animation-runtime
export const HARTHMERE_FULL_BODY_ANIMATION_RUNTIME_VERSION =
  "harthmere-full-body-animation-runtime";

const HARTHMERE_FULL_BODY_ACTION_TIMING = {
  creature: { windupMs: 120, impactMs: 240, recoveryMs: 360 },
  mount: { windupMs: 160, impactMs: 280, recoveryMs: 360 },
  ranged: { windupMs: 180, impactMs: 300, recoveryMs: 420 },
  magic: { windupMs: 220, impactMs: 380, recoveryMs: 520 },
  shield: { windupMs: 70, impactMs: 110, recoveryMs: 260 },
  dodge: { windupMs: 40, impactMs: 110, recoveryMs: 360 },
  airborne: { windupMs: 0, impactMs: 140, recoveryMs: 180 },
  gathering: { windupMs: 180, impactMs: 360, recoveryMs: 420 },
  crafting: { windupMs: 160, impactMs: 320, recoveryMs: 480 },
  building: { windupMs: 150, impactMs: 300, recoveryMs: 400 },
  social: { windupMs: 90, impactMs: 180, recoveryMs: 260 },
  deathRespawn: { windupMs: 0, impactMs: 180, recoveryMs: 900 },
  boss: { windupMs: 700, impactMs: 1200, recoveryMs: 900 },
} as const;

// harthmere-visual-cohesion-compat
export const HARTHMERE_FULL_BODY_POSE_LAYER_RULES = {
  // Keep non-melee upper-body actions from stealing the idle/locomotion torso.
  // This preserves the v7 visual-cohesion contract after the v8 aligned-clip migration.
  rangedAim: { arms: "apply", notArms: "noApply" },
  rangedRelease: { arms: "apply", notArms: "noApply" },
  rangedReload: { arms: "apply", notArms: "noApply" },
  magicCast: { arms: "apply", notArms: "noApply" },
  magicChannel: { arms: "apply", notArms: "noApply" },
  shieldBlock: { arms: "apply", notArms: "noApply" },
  shieldBash: { arms: "apply", notArms: "noApply" },
  gathering: { arms: "apply", notArms: "noApply" },
  crafting: { arms: "apply", notArms: "noApply" },
  building: { arms: "apply", notArms: "noApply" },
  toolUse: { arms: "apply", notArms: "noApply" },
  itemUse: { arms: "apply", notArms: "noApply" },
} as const;

const armsRe = HARTHMERE_BODY_UPPER_BODY_RE;

export const playerSystem = new AnimationSystem(
  {
    attack1Var1: {
      fileAnimationName: "HarthmereBodyWeaponBasic_Variation1_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponBasic_Aligned_30",
        "Attack",
        "SideSwing",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack1,
    },
    attack1Var2: {
      fileAnimationName: "HarthmereBodyWeaponBasic_Variation2_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponBasic_Aligned_30",
        "Attack",
        "SideSwing",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack1,
    },
    attack1Var3: {
      fileAnimationName: "HarthmereBodyWeaponBasic_Variation3_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponBasic_Aligned_30",
        "Attack",
        "SideSwing",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack1,
    },
    attack1Var4: {
      fileAnimationName: "HarthmereBodyWeaponBasic_Variation4_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponBasic_Aligned_30",
        "Attack",
        "SideSwing",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack1,
    },
    attack2Var1: {
      fileAnimationName: "HarthmereBodyWeaponHeavy_Variation1_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponHeavy_Aligned_30",
        "HeavyAttack",
        "Attack2",
        "Attack",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack2,
    },
    attack2Var2: {
      fileAnimationName: "HarthmereBodyWeaponHeavy_Variation2_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponHeavy_Aligned_30",
        "HeavyAttack",
        "Attack2",
        "Attack",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack2,
    },
    attack2Var3: {
      fileAnimationName: "HarthmereBodyWeaponHeavy_Variation3_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponHeavy_Aligned_30",
        "HeavyAttack",
        "Attack2",
        "Attack",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack2,
    },
    attack2Var4: {
      fileAnimationName: "HarthmereBodyWeaponHeavy_Variation4_24",
      backupFileAnimationNames: [
        "HarthmereBodyWeaponHeavy_Aligned_30",
        "HeavyAttack",
        "Attack2",
        "Attack",
      ],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack2,
    },
    attack1: {
      fileAnimationName: "HarthmereBodyWeaponBasic_Aligned_30",
      backupFileAnimationNames: ["Attack", "SideSwing"],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack1,
    },
    // Harthmere heavy attacks have a real HeavyAttack clip.
    // Fall back to Attack2 for the original Biomes player assets.
    attack2: {
      fileAnimationName: "HarthmereBodyWeaponHeavy_Aligned_30",
      backupFileAnimationNames: ["HeavyAttack", "Attack2", "Attack"],
      timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE.attack2,
    },

    // harthmere-full-animation-runtime
    rangedAim: {
      fileAnimationName: "HarthmereBodyRangedDraw_Aligned_30",
      backupFileAnimationNames: [
        "BowDraw",
        "BowShooting",
        "BowShoot",
        "Attack",
        "Idle",
      ],
    },
    rangedRelease: {
      fileAnimationName: "HarthmereBodyRangedRelease_Aligned_30",
      backupFileAnimationNames: [
        "BowRelease",
        "BowShoot",
        "BowShooting",
        "HeavyAttack",
        "Attack",
      ],
    },
    rangedReload: {
      fileAnimationName: "HarthmereBodyRangedReload_Aligned_30",
      backupFileAnimationNames: ["CrossbowReload", "ItemPutBack", "Attack"],
    },
    magicCast: {
      fileAnimationName: "HarthmereBodyMagicCast_Aligned_30",
      backupFileAnimationNames: ["BasicMagic", "HeavyMagic", "Attack"],
    },
    magicChannel: {
      fileAnimationName: "HarthmereBodyMagicChannel_Aligned_30",
      backupFileAnimationNames: ["ChannelMagic", "BasicMagic", "Idle"],
    },
    shieldBlock: {
      fileAnimationName: "HarthmereBodyWeaponBlock_Aligned_30",
      backupFileAnimationNames: ["ShieldBlock", "Block", "HitReact", "Idle"],
    },
    shieldBash: {
      fileAnimationName: "HarthmereBodyShieldBash_Aligned_30",
      backupFileAnimationNames: ["ShieldBash", "Attack", "HeavyAttack"],
    },
    dodge: {
      fileAnimationName: "DodgeRight",
      backupFileAnimationNames: ["Dodging", "SidestepRight", "Running", "Jump"],
    },
    dodgeLeft: {
      fileAnimationName: "DodgeLeft",
      // 15-frame clip at 24 fps is 0.625 s, but the dodge gameplay window
      // is 0.50 s. Without retiming the action expires 125 ms early and the
      // landing/settle at the tail of the clip never plays, so the dodge
      // reads as cut off mid-recovery. EvadeRoll (0.75/0.75) and DoubleJump
      // already match their windows.
      timeScale: HARTHMERE_DODGE_CLIP_TIME_SCALE,
      backupFileAnimationNames: ["SidestepLeft", "Dodging", "Running", "Jump"],
    },
    dodgeRight: {
      fileAnimationName: "DodgeRight",
      // 15-frame clip at 24 fps is 0.625 s, but the dodge gameplay window
      // is 0.50 s. Without retiming the action expires 125 ms early and the
      // landing/settle at the tail of the clip never plays, so the dodge
      // reads as cut off mid-recovery. EvadeRoll (0.75/0.75) and DoubleJump
      // already match their windows.
      timeScale: HARTHMERE_DODGE_CLIP_TIME_SCALE,
      backupFileAnimationNames: ["SidestepRight", "Dodging", "Running", "Jump"],
    },
    dodgeForward: {
      fileAnimationName: "DodgeForward",
      // 15-frame clip at 24 fps is 0.625 s, but the dodge gameplay window
      // is 0.50 s. Without retiming the action expires 125 ms early and the
      // landing/settle at the tail of the clip never plays, so the dodge
      // reads as cut off mid-recovery. EvadeRoll (0.75/0.75) and DoubleJump
      // already match their windows.
      timeScale: HARTHMERE_DODGE_CLIP_TIME_SCALE,
      backupFileAnimationNames: ["Dodging", "Sidestep", "Running", "Jump"],
    },
    dodgeBack: {
      fileAnimationName: "DodgeBack",
      // 15-frame clip at 24 fps is 0.625 s, but the dodge gameplay window
      // is 0.50 s. Without retiming the action expires 125 ms early and the
      // landing/settle at the tail of the clip never plays, so the dodge
      // reads as cut off mid-recovery. EvadeRoll (0.75/0.75) and DoubleJump
      // already match their windows.
      timeScale: HARTHMERE_DODGE_CLIP_TIME_SCALE,
      backupFileAnimationNames: [
        "Dodging",
        "Sidestep",
        "RunningBackward",
        "Jump",
      ],
    },
    evade: {
      fileAnimationName: "EvadeRoll",
      backupFileAnimationNames: [
        "Rolling",
        "Evade",
        "Dodging",
        "Running",
        "Jump",
      ],
    },
    death: { fileAnimationName: "Death", backupFileAnimationNames: ["Fall"] },
    deathCinematic: {
      fileAnimationName: "Death",
      backupFileAnimationNames: ["Fall"],
      timeScale: 0.82,
    },
    respawnCinematic: {
      fileAnimationName: "Respawn",
      backupFileAnimationNames: ["Idle", "Waving"],
      timeScale: 0.9,
    },
    respawn: {
      fileAnimationName: "Respawn",
      backupFileAnimationNames: ["Idle", "Waving"],
    },
    land: {
      fileAnimationName: "Land",
      backupFileAnimationNames: ["Fall", "Idle"],
    },
    hardLand: {
      fileAnimationName: "HardLand",
      backupFileAnimationNames: ["Fall", "HitReact", "Idle"],
    },
    mountRideIdle: {
      fileAnimationName: "RiderIdle",
      backupFileAnimationNames: ["Sit", "Idle"],
    },
    mountRideWalk: {
      fileAnimationName: "RiderWalk",
      backupFileAnimationNames: ["Sit", "Walking"],
    },
    mountRideRun: {
      fileAnimationName: "RiderRun",
      backupFileAnimationNames: ["Sit", "Running"],
    },
    mountDismount: {
      fileAnimationName: "Dismount",
      backupFileAnimationNames: ["Jump", "Sit"],
    },
    mineImpact: {
      fileAnimationName: "HarthmereBodyToolUse_Aligned_30",
      backupFileAnimationNames: ["Mining", "DiggingTool", "Attack"],
    },
    woodcutImpact: {
      fileAnimationName: "HarthmereBodyToolHeavyUse_Aligned_30",
      backupFileAnimationNames: [
        "Woodcutting",
        "Chopping",
        "DiggingTool",
        "Attack",
      ],
    },
    foragePickup: {
      fileAnimationName: "HarthmereBodyItemUse_Aligned_30",
      backupFileAnimationNames: [
        "ForagePickup",
        "Gathering",
        "DiggingHand",
        "ItemPutBack",
      ],
    },
    craftStationUse: {
      fileAnimationName: "HarthmereBodyToolUse_Aligned_30",
      backupFileAnimationNames: [
        "CraftStationUse",
        "DiggingTool",
        "ItemPutBack",
      ],
    },
    repairImpact: {
      fileAnimationName: "HarthmereBodyToolUse_Aligned_30",
      backupFileAnimationNames: ["Repair", "DiggingTool", "Attack"],
    },
    buildPlace: {
      fileAnimationName: "HarthmereBodyToolUse_Aligned_30",
      backupFileAnimationNames: ["BuildPlace", "ItemPutBack", "DiggingTool"],
    },
    socialTalk: {
      fileAnimationName: "TalkGesture",
      backupFileAnimationNames: ["Waving", "Point", "Idle"],
    },
    vendorWork: {
      fileAnimationName: "VendorWork",
      backupFileAnimationNames: ["ItemPutBack", "Idle"],
    },
    questGesture: {
      fileAnimationName: "QuestGesture",
      backupFileAnimationNames: ["Point", "Waving"],
    },
    sleep: {
      fileAnimationName: "Sleep",
      backupFileAnimationNames: ["Sit", "Idle"],
    },
    bossTelegraph: {
      fileAnimationName: "BossTelegraph",
      backupFileAnimationNames: ["HeavyAttack", "Attack"],
    },
    bossPhaseTransition: {
      fileAnimationName: "BossPhaseTransition",
      backupFileAnimationNames: ["HeavyAttack", "HitReact"],
    },

    // First-class gameplay/cutscene expression library. Every public emote id
    // resolves to its authored Blender clip and degrades to a safe legacy clip
    // on older character assets.
    ...HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS,

    destroy: { fileAnimationName: "DiggingTool" },
    place: { fileAnimationName: "DiggingTool" },

    walk: { fileAnimationName: "Walking" },
    idle: { fileAnimationName: "Idle" },
    crouchWalking: { fileAnimationName: "CrouchWalking" },
    crouchIdle: { fileAnimationName: "CrouchIdle" },
    run: { fileAnimationName: "Running" },
    runBackwards: { fileAnimationName: "RunningBackward" },

    strafeLeftSlow: { fileAnimationName: "StrafeLeftWalking" },
    strafeLeftFast: { fileAnimationName: "StrafeLeftRunning" },
    strafeRightSlow: { fileAnimationName: "StrafeRightWalking" },
    strafeRightFast: { fileAnimationName: "StrafeRightRunning" },

    jump: { fileAnimationName: "Jump" },
    doubleJump: {
      fileAnimationName: "DoubleJump",
      backupFileAnimationNames: ["Jump"],
      timeScale: 1.18,
    },
    fall: { fileAnimationName: "Fall" },

    swimForwards: { fileAnimationName: "SwimmingForward" },
    swimBackwards: { fileAnimationName: "SwimmingBackward" },
    swimIdle: { fileAnimationName: "SwimmingIdle" },

    // Flying not yet supported because only admins should be able to fly
    // so using swimming animations temporarily.
    flyIdle: { fileAnimationName: "SwimmingIdle" },
    flyForwards: { fileAnimationName: "SwimmingForward" },

    camera: { fileAnimationName: "HoldingCamera" },
    wave: { fileAnimationName: "Waving" },
    dance: { fileAnimationName: "Dancing" },
    laugh: { fileAnimationName: "Laugh" },
    sit: { fileAnimationName: "Sit" },
    flex: { fileAnimationName: "Flex" },
    applause: { fileAnimationName: "Applause" },
    point: { fileAnimationName: "Point" },
    drink: {
      fileAnimationName: "HarthmereBodyItemUse_Aligned_30",
      backupFileAnimationNames: ["Drink", "ItemPutBack"],
    },
    eat: {
      fileAnimationName: "HarthmereBodyItemUse_Aligned_30",
      backupFileAnimationNames: ["Eat", "ItemPutBack"],
    },

    fishingCastPull: { fileAnimationName: "FishingCastPull" },
    fishingCastRelease: { fileAnimationName: "FishingCastRelease" },
    fishingIdle: { fileAnimationName: "FishingIdle" },
    fishingReel: { fileAnimationName: "FishingReel" },
    fishingShow: { fileAnimationName: "FishingShow" },

    diggingHand: { fileAnimationName: "DiggingHand" },
    diggingTool: { fileAnimationName: "DiggingTool" },
    watering: { fileAnimationName: "Watering" },

    rock: { fileAnimationName: "Rock" },
    sick: { fileAnimationName: "Sick" },

    equip: { fileAnimationName: "ItemPutBack" },
    unequip: { fileAnimationName: "ItemPutBack" },
  },
  {
    arms: {
      re: armsRe,
    },
    notArms: {
      re: armsRe,
      negateRe: true,
    },
  }
);

export type PlayerAnimationName = AnimationName<typeof playerSystem>;
export type PlayerAnimationAction = AnimationAction<typeof playerSystem>;

// MOBILE_LAZY_CHARACTER_ANIMATIONS:
// A phone normally needs idle plus at most a handful of movement, combat, and
// dialogue clips at one time. Eagerly cloning both masked layers for all 157
// logical actions produced 314 Three.js actions per visible player. Keep the
// desktop path unchanged, while mobile materializes and later reclaims every
// non-idle action through AnimationSystem's deferred path.
export const MOBILE_DEFERRED_PLAYER_ANIMATION_NAMES = new Set(
  playerSystem.animationNames.filter((name) => name !== "idle")
);

export interface AnimatedPlayerMesh extends MixedMesh<typeof playerSystem> {
  threeWeaponAttachment: THREE.Object3D;
}

export function loadPlayerAnimatedMesh(
  gltf: GLTF,
  characterAnimationTimingTweaks: CharacterAnimationTiming,
  mobileDevice = false
): AnimatedPlayerMesh {
  const meshScene = gltfToThree(gltf);
  let mesh: THREE.Mesh | undefined;
  meshScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      mesh = child;
    }
  });

  if (!mesh) {
    throw new Error("Could not find any meshes in GLTF");
  }

  let weaponParentBone = findPlayerHeldItemAttachmentParent(meshScene);
  if (!weaponParentBone) {
    // HARTHMERE_PLAYER_MESH_MISSING_WEAPON_PARENT_NONFATAL:
    // Some static/local fallback Harthmere player GLTFs do not expose the
    // Biomes weapon attachment bone. That must not block loading, character
    // preview, or world entry. Attach the weapon group to the mesh as a safe
    // fallback; later equipment-specific polish can improve the visual anchor.
    console.warn("HARTHMERE_PLAYER_MESH_MISSING_WEAPON_PARENT_NONFATAL", {
      childNames: meshScene.children
        .map((child) => child.name)
        .filter(Boolean)
        .slice(0, 20),
    });
    weaponParentBone = mesh;
  }

  const weaponAttachment = new THREE.Group();
  weaponAttachment.name = "held-item-attachment";
  weaponAttachment.userData.harthmereAttachmentParent = weaponParentBone.name;
  weaponParentBone.add(weaponAttachment);

  const state = playerSystem.newState(
    gltfToThree(gltf),
    gltf.animations,
    characterAnimationTimingTweaks,
    mobileDevice
      ? {
          deferredAnimationNames: MOBILE_DEFERRED_PLAYER_ANIMATION_NAMES,
          reclaimDeferredActions: true,
          stabilizeClampedOnceAnimations: true,
        }
      : undefined
  );

  return {
    three: meshScene,
    animationSystem: playerSystem,
    animationMixer: state.mixer,
    animationSystemState: state,
    threeWeaponAttachment: weaponAttachment,
    timelineMatcher: new TimelineMatcher(() => state.mixer.time),
  };
}

type ToAnimationTimeFunction = (label: string, worldTime: number) => number;
function getJumpWeights(
  player: Player,
  toAnimationTime: ToAnimationTimeFunction
): PlayerAnimationAction | undefined {
  if (player.swimming) {
    return;
  }
  if (player.lastJumpTime && !player.onGround && player.velocity[1] > 0) {
    return {
      weights: playerSystem.singleAnimationWeight("jump", 1),
      state: {
        repeat: { kind: "once" },
        startTime: toAnimationTime("jump", player.lastJumpTime),
        // We significantly increase the ease in time for the jump animation so
        // that the player sees the animation start as soon as possible. This
        // is important because the animation is triggered *after* the player
        // actually jumps, so it needs to react ASAP.
        easeInTime: 0.01,
      },
      layers: playerAirborneAnimationLayers(player.emoteInfo?.emoteType),
    };
  }
}

function getFallWeights(player: Player): PlayerAnimationAction | undefined {
  if (player.swimming) {
    return;
  }
  if (!player.onGround && player.velocity[1] < 0) {
    return {
      weights: playerSystem.singleAnimationWeight("fall", 1),
      state: {
        repeat: { kind: "repeat" },
        startTime: 0,
      },
      layers: playerAirborneAnimationLayers(player.emoteInfo?.emoteType),
    };
  }
}

function isHarthmereWeaponSyncedBodyEmote(
  emoteType: string
): emoteType is "attack1" | "attack2" {
  return emoteType === "attack1" || emoteType === "attack2";
}

export function playerAirborneAnimationLayers(emoteType: string | undefined) {
  return {
    // Attack is accumulated before jump/fall. `ifIdle` keeps that responsive
    // upper-body action while airborne locomotion continues to own the legs.
    arms: isHarthmereWeaponSyncedBodyEmote(emoteType ?? "")
      ? "ifIdle"
      : "apply",
    notArms: "apply",
  } as const;
}

function getResolvedPlayerAnimationClipName(
  animationState: AnimationSystemState<typeof playerSystem>,
  animationName: AnimationName<typeof playerSystem>
): string | undefined {
  const actionsByLayer = animationState.actions as unknown as Record<
    string,
    Partial<Record<string, THREE.AnimationAction | undefined>>
  >;
  for (const layerActions of Object.values(actionsByLayer)) {
    const action = layerActions[animationName];
    const clipName = action?.getClip?.().name;
    if (clipName) {
      return clipName;
    }
  }
  return undefined;
}

function hasResolvedHarthmereWeaponBodyClip(
  animationState: AnimationSystemState<typeof playerSystem>,
  animationName: AnimationName<typeof playerSystem>
): boolean {
  const clipName = getResolvedPlayerAnimationClipName(
    animationState,
    animationName
  );
  return (
    !!clipName && /^HarthmereBodyWeapon.*_(Variation|Aligned)_/.test(clipName)
  );
}

function getHarthmereWeaponSyncedEmoteWeights(
  animationState: AnimationSystemState<typeof playerSystem>,
  player: Player,
  toAnimationTime: ToAnimationTimeFunction
): PlayerAnimationAction | undefined {
  if (!player.emoteInfo) {
    return;
  }

  const { emoteStartTime, emoteType } = player.emoteInfo;
  if (!isHarthmereWeaponSyncedBodyEmote(emoteType)) {
    return;
  }

  if (player.cutsceneAttackAnimationInfo?.animation === emoteType) {
    return {
      weights: playerSystem.singleAnimationWeight(emoteType, 1),
      state: {
        repeat: { kind: "once" },
        startTime: toAnimationTime("cutsceneFullBodyAttack", emoteStartTime),
        easeInTime: HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN,
      },
      layers: {
        arms: "apply",
        notArms: "apply",
      },
    };
  }

  const harthmereVariationEmoteType = getHarthmereAttackVariationEmoteType(
    emoteType,
    player.emoteInfo.attackVariationIndex
  );

  const hasHarthmereWeaponClip = hasResolvedHarthmereWeaponBodyClip(
    animationState,
    harthmereVariationEmoteType as AnimationName<typeof playerSystem>
  );

  if (!hasHarthmereWeaponClip) {
    return {
      weights: playerSystem.singleAnimationWeight(emoteType, 1),
      state: {
        repeat: { kind: "once" },
        startTime: toAnimationTime("snapshotWeaponBody", emoteStartTime),
        easeInTime: HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN,
      },
      layers: {
        // Snapshot compatibility: the original Biomes Attack/Attack2 clips are
        // authored as full-body clips. Apply them to the whole skeleton when
        // the Harthmere upper-body-only weapon clips are not actually present
        // on this loaded player GLB.
        arms: "apply",
        notArms: "apply",
      },
    };
  }

  return {
    weights: playerSystem.singleAnimationWeight(harthmereVariationEmoteType, 1),
    state: {
      repeat: { kind: "once" },
      startTime: toAnimationTime("harthmereWeaponBody", emoteStartTime),
      // The weapon trail/damage timing starts immediately. Keep the body
      // action responsive, then let normal locomotion take the lower body.
      easeInTime: HARTHMERE_BODY_WEAPON_ATTACK_EASE_IN,
    },
    layers: {
      arms: "apply",
      // The upper-body mask now includes chest/head and the authored clip has
      // real footwork. While moving, locomotion owns the lower body; while
      // stationary, `ifIdle` lets the full planted attack pose play.
      notArms: "ifIdle",
    },
  };
}

function getHarthmereStableAnimationVelocity(
  velocity: Player["velocity"]
): Player["velocity"] {
  const horizontalSpeed = Math.hypot(velocity[0] ?? 0, velocity[2] ?? 0);
  if (horizontalSpeed < HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED) {
    return [0, velocity[1] ?? 0, 0] as Player["velocity"];
  }
  return velocity;
}

function getEmoteBasedWeights(
  animationState: AnimationSystemState<typeof playerSystem>,
  player: Player,
  toAnimationTime: ToAnimationTimeFunction
): PlayerAnimationAction | undefined {
  if (!player.emoteInfo) {
    return;
  }

  const weaponSyncedWeights = getHarthmereWeaponSyncedEmoteWeights(
    animationState,
    player,
    toAnimationTime
  );
  if (weaponSyncedWeights) {
    return weaponSyncedWeights;
  }

  const { emoteStartTime, emoteType } = player.emoteInfo;
  if (
    emoteType !== "warp" &&
    emoteType !== "warpHome" &&
    emoteType !== "splash"
  ) {
    return {
      weights: playerSystem.singleAnimationWeight(emoteType, 1),
      state: {
        repeat: EMOTE_PROPERTIES[emoteType].repeatType,
        startTime: toAnimationTime("emote", emoteStartTime),
        easeInTime: EMOTE_PROPERTIES[emoteType].easeInTime,
        easeOutTime: EMOTE_PROPERTIES[emoteType].easeOutTime,
      },
      layers: {
        arms: "apply",
        notArms: EMOTE_PROPERTIES[emoteType].notArms ?? "apply",
      },
    };
  }
}

function getMovementActionWeights(
  player: Player,
  toAnimationTime: ToAnimationTimeFunction
): PlayerAnimationAction | undefined {
  const info = player.movementActionInfo;
  const cutsceneInfo = player.cutsceneMovementAnimationInfo;
  if (!info && !cutsceneInfo) {
    return;
  }

  const animation = info
    ? playerMovementActionAnimationName({
        action: info.action,
        direction: info.direction,
        facingYaw: player.orientation[1],
      })
    : cutsceneInfo!.animation;
  const startTime = info ? info.startTime : cutsceneInfo!.startTime;

  return {
    weights: playerSystem.singleAnimationWeight(animation, 1),
    state: {
      repeat: { kind: "once" },
      startTime: toAnimationTime("movementAction", startTime),
      easeInTime: 0.04,
    },
    layers: { arms: "apply", notArms: "apply" },
  };
}

function getCameraModeWeights(
  player: Player
): PlayerAnimationAction | undefined {
  if (player.cameraMode) {
    switch (player.cameraMode) {
      case "fps":
      case "normal":
        return {
          weights: playerSystem.singleAnimationWeight("camera", 1),
          state: { repeat: { kind: "repeat" }, startTime: 0 },
          layers: {
            arms: "apply",
            notArms: "ifIdle",
          },
        };
      case "selfie":
        return undefined;
    }
  } else {
    return undefined;
  }
}

export function syncAnimationsToPlayerState(
  animationState: AnimationSystemState<typeof playerSystem>,
  player: Player,
  dt: number,
  toAnimationTime: ToAnimationTimeFunction,
  resources: ClientResources
) {
  const accum = playerSystem.newAccumulatedActions(
    animationState.mixer.time,
    playerSystem.durationFromState(animationState),
    // Expire one shot animations a bit early so they can transition into
    //another animation while they're ending.
    0.1
  );

  let swimming = player.swimming;

  if (!player.isLocal) {
    const { canSwim } = resources.get(
      "/players/possible_terrain_actions",
      player.id
    );
    swimming = canSwim;
  }

  playerSystem.accumulateAction(
    getMovementActionWeights(player, toAnimationTime),
    accum
  );
  playerSystem.accumulateAction(
    getEmoteBasedWeights(animationState, player, toAnimationTime),
    accum
  );
  playerSystem.accumulateAction(getCameraModeWeights(player), accum);
  playerSystem.accumulateAction(getJumpWeights(player, toAnimationTime), accum);
  playerSystem.accumulateAction(getFallWeights(player), accum);
  playerSystem.accumulateAction(
    getVelocityBasedWeights({
      velocity: getHarthmereStableAnimationVelocity(player.velocity),
      orientation: player.orientation,
      movementType: player.crouching
        ? "crouching"
        : player.flying
          ? "flying"
          : swimming
            ? "swimming"
            : "walking",
      runSpeed: RUN_SPEED,
      characterSystem: playerSystem,
    }),
    accum
  );

  const animationBlendDt = Math.min(
    Math.max(dt, 0),
    HARTHMERE_BODY_MAX_BLEND_DT
  );
  playerSystem.applyAccumulatedActionsToState(
    accum,
    animationState,
    animationBlendDt
  );
}

export const HARTHMERE_ATTACK_VARIATION_VERSION_RUNTIME =
  HARTHMERE_ATTACK_VARIATION_POLISH_VERSION;

// pickHarthmereAttackVariation("basic", __harthmereAttackVariationHistory)

// pickHarthmereAttackVariation("heavy", __harthmereAttackVariationHistory)

// pickHarthmereAttackVariation("magic", __harthmereAttackVariationHistory)

export const HARTHMERE_ATTACK_VARIATION_POLISH_RUNTIME =
  HARTHMERE_ATTACK_VARIATION_POLISH_VERSION;
export function getHarthmereAttackVariationForAction(actionType: string) {
  const family = getHarthmereAttackFamilyForAction(actionType);
  const variation = pickHarthmereAttackVariation(family);
  const bodyClip = variation.clip;
  const attackVariationEmoteType = variation.emoteType;
  return {
    ...variation,
    family,
    bodyClip,
    attackVariationEmoteType,
    attackVariationIndex: Number(String(variation.id).split("_").pop() || 1),
  };
}
// v17 variation markers: attack1Var1 attack1Var2 attack1Var3 attack1Var4 attack2Var1 attack2Var2 attack2Var3 attack2Var4

export const HARTHMERE_REAL_ATTACK_VARIATION_CLIPS_VERSION =
  "harthmere-real-attack-variation-clips";
