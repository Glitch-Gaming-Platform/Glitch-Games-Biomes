export const HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION =
  "harthmere-animation-handedness-death-bounds";

// HARTHMERE_NPC_STABLE_FILTERED_VELOCITY_COMPAT
// Live NPC locomotion keeps getHarthmereStableNpcAnimationVelocity(velocity);
// dead NPC/animal locomotion uses a zero vector through the same filter.
const HARTHMERE_DEATH_CORPSE_HOLD_SCALE = 0.84;
const HARTHMERE_DEATH_CORPSE_HOLD_MS = 4500;
const HARTHMERE_DEATH_MAX_GROUND_GAP_METERS = 0.18;
const HARTHMERE_DEATH_MAX_SINK_METERS = 0.04;
import type { ClientContext } from "@/client/game/context";
import type {
  AudioManager,
  PathSpatialAudioOptions,
} from "@/client/game/context_managers/audio_manager";
import type { AudioPath } from "@/client/game/resources/audio";
import {
  applyHarthmereCinematicExpressionPose,
  clearHarthmereCinematicExpressionPose,
} from "@/client/game/cutscene/expression_pose";
import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { SpatialLighting } from "@/client/game/renderers/util";
import {
  cloneMaterials,
  computeSpatialLighting,
  defaultSpatialLighting,
} from "@/client/game/renderers/util";
import {
  makeBezierAngleLatencyTransition,
  makeBezierVec3LatencyTransition,
} from "@/client/game/resources/latency_transitions";
import type { ParticleSystemMaterials } from "@/client/game/resources/particles";
import { ParticleSystem } from "@/client/game/resources/particles";
import {
  ItemAttachment,
  makeSnapshotPlayerLikeAppearanceMesh,
  playerMeshWeaponAttachmentParent,
  replaceWithPlayerMaterial,
  setFrustumCulling,
} from "@/client/game/resources/player_mesh";
import {
  readRenderablePuppetOverrides,
  type CutscenePuppetOverride,
} from "@/shared/cutscene/puppets";
import {
  HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS,
  harthmereCinematicExpressionDurationMs,
  harthmereCinematicExpressionRepeat,
  harthmereCinematicExpressionSpec,
  isHarthmereCinematicExpression,
  type HarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import type {
  ClientResourceDeps,
  ClientResources,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import type {
  AnimationAction,
  AnimationDefinition,
} from "@/client/game/util/animation_system";
import { AnimationSystem } from "@/client/game/util/animation_system";
import type { MixedMesh } from "@/client/game/util/animations";
import { getVelocityBasedWeights } from "@/client/game/util/animations";
import type { Spline } from "@/client/game/util/bezier";
import {
  bezierFunctionsScalar,
  bezierMultipleDerivatives,
} from "@/client/game/util/bezier";
import {
  gltfDispose,
  gltfToThree,
  loadGltf,
  loadGltfWithRetry,
} from "@/client/game/util/gltf_helpers";
import {
  npcOnDeathParticleMaterials,
  npcOnHitParticleMaterials,
} from "@/client/game/util/particles_systems";
import { TimelineMatcher } from "@/client/game/util/timeline_matcher";
import type { Transition } from "@/client/game/util/transitions";
import { fixedConstantVec3Transition } from "@/client/game/util/transitions";
import { audioAssets } from "@/galois/assets/audio";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import { updatePlayerSkinnedMaterial } from "@/gen/client/game/shaders/player_skinned";
import type { Tweaks } from "@/server/shared/minigames/ruleset/tweaks";
import type { Disposable } from "@/shared/disposable";
import { makeDisposable } from "@/shared/disposable";
import type {
  ReadonlyEmote,
  ReadonlyMovementState,
} from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { ReadonlyOptionalDamageSource } from "@/shared/ecs/gen/types";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import {
  movementActionIsActive,
  npcEvadeProfileForDescriptor,
} from "@/shared/game/movement_actions";
import {
  makeHarthmereNpcAppearanceConfig,
  makeHarthmereNpcBodyConfig,
  makeHarthmereNpcFaceConfig,
  normalizeHarthmereCharacterAppearance,
  parseHarthmereAppearanceMarker,
  parseHarthmereBodyMarker,
  parseHarthmereFaceMarker,
  dispatchHarthmereFacialExpressionEvent,
  type HarthmereCharacterAppearance,
  type HarthmereCharacterClothing,
  type HarthmereClothingSlot,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import {
  harthmereGroundedFeetYWithMemory,
  registerHarthmereGroundedColumnCache,
} from "@/client/game/util/harthmere_entity_grounding";
import { isHarthmereBusinessOwnerNpcEntityId } from "@/shared/harthmere/business_owner_npc_seed";
import { isHarthmereBusinessCustomerNpcEntityId } from "@/shared/harthmere/business_customer_npc_seed";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { readHarthmereNpcDialogueExpression } from "@/shared/harthmere/npc_dialogue_expressions";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import {
  harthmereNativeNpcProjectileAttackTime,
  harthmereNativeNpcProjectilePresentation,
} from "@/shared/harthmere/harthmere_native_combat";
import {
  HARTHMERE_PROJECTILE_VISUAL_EVENT,
  harthmereAuthoritativeImpactRemainingSecs,
} from "@/shared/harthmere/projectile_visual_manifest";
import {
  HARTHMERE_MAGIC_CHARGE_MAX_SECS,
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
} from "@/shared/harthmere/magic_charge";
import { harthmereBossMagicPresentation } from "@/shared/harthmere/boss_magic_presentation";
import {
  dispatchHarthmereMagicCharge,
  harthmereMagicChargeId,
} from "@/client/game/util/harthmere_magic_charge";
import {
  getHarthmereSoundEffect,
  HARTHMERE_GIANT_BOSS_STOMP_SOUND_ID,
  harthmereNpcSoundIdForIdentity,
} from "@/shared/harthmere/sound_effect_manifest";
import {
  advanceHarthmereBossStomp,
  createHarthmereBossStompState,
  harthmereBossStompProfileForEntity,
} from "@/shared/harthmere/boss_footsteps";
import {
  harthmereCreatureAttackEventKey,
  harthmereCreatureIdleDelayMs,
  harthmereCreatureShouldPlayAttackSound,
  harthmereCreatureSoundProfileForIdentity,
  type HarthmereCreatureSoundPhase,
} from "@/shared/harthmere/creature_sound_profiles";
import {
  SNAPSHOT_LIVE_NPC_GROUNDING_VERSION,
  snapshotGroundLiveNpcPosition,
  snapshotIsLiveFloatingGroveNpcCandidate,
} from "@/shared/harthmere/snapshot_live_debug";
import {
  SNAPSHOT_GROVE_NPC_ROUTE_VERSION,
  snapshotGroveNpcRouteMotion,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION,
  snapshotGroveNpcAssetKeyForEntity,
} from "@/shared/harthmere/snapshot_grove_npc_mesh_routing";
import {
  HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION,
  harthmereMuckCreatureAssetKeyForLabel,
} from "@/shared/harthmere/muck_creature_assets";
import {
  HARTHMERE_BOSS_VISUAL_ASSETS_VERSION,
  harthmereBossAttackClipForEntityEvent,
  harthmereBossVisualForEntity,
  type HarthmereBossAnimationClip,
} from "@/shared/harthmere/boss_visual_assets";
import { applyHarthmereScratchBossDamagePose } from "@/client/game/renderers/harthmere_boss_damage_pose";
import {
  harthmereNpcSceneNeedsVisibleFallback,
  harthmereNpcVisibleGeometryStatsForScene,
  HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD_VERSION,
} from "@/shared/harthmere/npc_visible_geometry_guard";
import {
  createHarthmereNpcNavigationState,
  resolveHarthmereNpcNavigationStep,
  type HarthmereNpcNavigationMode,
  type HarthmereNpcNavigationObstacle,
  type HarthmereNpcNavigationResult,
  type HarthmereNpcNavigationState,
} from "@/shared/harthmere/npc_navigation_guard";
import { log } from "@/shared/logging";
import {
  centerAABB,
  pitchAndYaw,
  scale,
  sub,
  volumeAABB,
} from "@/shared/math/linear";
import type {
  AABB,
  ReadonlyVec2,
  ReadonlyVec3,
  Vec2,
  Vec3,
} from "@/shared/math/types";
import { voxelShard } from "@/shared/game/shard";
import { anItem } from "@/shared/game/item";
import type { NpcType } from "@/shared/npc/bikkie";
import {
  getMovementTypeByNpcType,
  getNpcBehavior,
  getNpcBoxSize,
  getRunSpeedByNpcType,
  idToNpcEffectProfile,
  idToNpcType,
} from "@/shared/npc/bikkie";
import type { RegistryLoader } from "@/shared/registry";
import { ok } from "assert";
import _, { sample } from "lodash";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export {
  HARTHMERE_NPC_RENDER_COMPONENT_COMPAT_VERSION,
  harthmereNpcAttackUsesAuthoritativeTransform,
  harthmereEnsureRenderableNpcEntity,
  harthmereRenderableNpcType,
  isRenderNpcEntity,
  type RenderNpcEntity,
} from "@/client/game/resources/harthmere_npc_render_compat";
import {
  harthmereNpcAttackUsesAuthoritativeTransform,
  harthmereRenderableNpcType,
  type RenderNpcEntity,
} from "@/client/game/resources/harthmere_npc_render_compat";

export interface ActiveBecomeNpcState {
  kind: "active";
  entityId: BiomesId;
  position: Vec3;
  velocity: Vec3;
  orientation: Vec2;
  cannotPlaceReason?: string;
  onCommit?: () => void;
  onRevert?: () => void;
}
export type BecomeNPCState =
  | {
      kind: "empty";
    }
  | ActiveBecomeNpcState;

const walkAnimation: AnimationDefinition = {
  fileAnimationName: "Walk",
  backupFileAnimationNames: ["Walking"],
};

const runAnimation: AnimationDefinition = {
  fileAnimationName: "Run",
  backupFileAnimationNames: ["Running", "Walk", "Walking"],
};

const idleAnimation: AnimationDefinition = {
  fileAnimationName: "Idle",
};

const swimAnimation: AnimationDefinition = {
  fileAnimationName: "Swim",
};

const flyAnimation: AnimationDefinition = {
  fileAnimationName: "Fly",
};

// harthmere-body-animation-weapon-sync
export const HARTHMERE_NPC_BODY_ANIMATION_SYNC_VERSION =
  "harthmere-npc-body-animation-weapon-sync";

// harthmere-full-animation-runtime
export const HARTHMERE_NPC_FULL_ANIMATION_RUNTIME_VERSION =
  "harthmere-npc-full-animation-runtime";

// harthmere-creature-social-death-handtracking
export const HARTHMERE_CREATURE_SOCIAL_DEATH_ANIMATION_VERSION =
  "harthmere-creature-social-death-handtracking";
const HARTHMERE_NPC_DEATH_CORPSE_HOLD_SCALE = 0.84;
const HARTHMERE_NPC_DEATH_ANIMATION_DURATION_SECS = 1.8;
const HARTHMERE_NPC_DEATH_FADE_LAST_SECS = 3;
const HARTHMERE_NPC_CREATURE_ANIMAL_PROFILES = [
  "wolf",
  "rat",
  "boar",
  "bear",
  "deer",
  "fox",
  "crow",
  "livestock",
  "undead",
] as const;
const HARTHMERE_NPC_SOCIAL_WORK_PROFILES = [
  "vendorIdle",
  "talkGesture",
  "questGesture",
  "sit",
  "eat",
  "drink",
  "sleep",
  "workLoop",
  "smithWork",
  "cookWork",
  "dockWork",
  "healerWork",
  "guardPatrolIdle",
  "crowdEmote",
] as const;

const HARTHMERE_NPC_CREATURE_ANIMATION_STATES = [
  "idle",
  "walk",
  "run",
  "attack",
  "hit",
  "death",
  "flee",
  "turnInPlace",
] as const;
const HARTHMERE_NPC_SOCIAL_ANIMATION_STATES = [
  "vendorIdle",
  "talkGesture",
  "questGesture",
  "sit",
  "eat",
  "drink",
  "sleep",
  "workLoop",
  "crowdEmote",
] as const;
const HARTHMERE_NPC_BOSS_ANIMATION_STATES = [
  "telegraph",
  "phaseTransition",
  "areaAttack",
  "summon",
  "enrage",
  "wipeReset",
  "bossDeath",
] as const;
const HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED = 0.06;
const HARTHMERE_NPC_BODY_MAX_BLEND_DT = 1 / 24;
const HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE = 1.0;

export const npcSystem = new AnimationSystem(
  {
    attack: {
      fileAnimationName: "Attack",
      timeScale: HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE,
    },
    creatureAttack: {
      fileAnimationName: "Attack",
      backupFileAnimationNames: [
        "Bite",
        "Claw",
        "Pounce",
        "Charge",
        "Peck",
        "Scratch",
        "Kick",
        "TailWhip",
      ],
    },
    creatureHit: {
      fileAnimationName: "HitReact",
      backupFileAnimationNames: ["Block", "Stunned"],
    },
    creatureDeath: {
      fileAnimationName: "Death",
      backupFileAnimationNames: ["Fall", "Falling"],
    },
    creatureFlee: {
      fileAnimationName: "Run",
      backupFileAnimationNames: ["Running", "Walk"],
    },
    creatureTurnInPlace: {
      fileAnimationName: "Idle",
      backupFileAnimationNames: ["Walk"],
    },
    evadeMucker: {
      fileAnimationName: "MuckerEvade",
      backupFileAnimationNames: ["Jump", "Dodging", "Run", "Walk"],
    },
    evadeRobot: {
      fileAnimationName: "RobotEvade",
      backupFileAnimationNames: ["Dodging", "Sidestep", "Jump", "Walk"],
    },
    evadeSideLeap: {
      fileAnimationName: "SideLeap",
      backupFileAnimationNames: [
        "Dodging",
        "SidestepRight",
        "SidestepLeft",
        "Sidestep",
        "Jump",
      ],
    },
    evadeHeavy: {
      fileAnimationName: "HeavyEvade",
      backupFileAnimationNames: ["Dodging", "Sidestep", "HitReact", "Walk"],
    },
    evadeRabbit: {
      fileAnimationName: "QuickHop",
      backupFileAnimationNames: ["Jump", "Dodging", "Run", "Walk"],
    },
    evadeBird: {
      fileAnimationName: "WingEvade",
      backupFileAnimationNames: ["Fly", "Jump", "Dodging", "Walk"],
    },
    evadeSwim: {
      fileAnimationName: "SwimBurst",
      backupFileAnimationNames: ["Swim", "Dodging", "Idle"],
    },
    evadeHexer: {
      fileAnimationName: "HexerEvade",
      backupFileAnimationNames: ["Dodging", "Sidestep", "BasicMagic", "Walk"],
    },
    evadeGeneric: {
      fileAnimationName: "Evade",
      backupFileAnimationNames: ["Dodging", "Sidestep", "Jump", "Run"],
    },
    bossHeavyAttack: {
      fileAnimationName: "HeavyAttack",
      backupFileAnimationNames: ["Attack"],
    },
    bossRangedAttack: {
      fileAnimationName: "RangedAttack",
      backupFileAnimationNames: ["Attack", "BasicMagic"],
    },
    magicCharge: {
      fileAnimationName: "HarthmereBodyMagicChannel_Aligned_30",
      backupFileAnimationNames: [
        "ChannelMagic",
        "BasicMagic",
        "RangedAttack",
        "Idle",
      ],
    },
    bossAreaAttack: {
      fileAnimationName: "AreaAttack",
      backupFileAnimationNames: ["HeavyAttack", "Attack"],
    },
    bossJump: {
      fileAnimationName: "Jump",
      backupFileAnimationNames: ["Pounce", "Attack"],
    },
    bossPhaseTransition: {
      fileAnimationName: "PhaseTransition",
      backupFileAnimationNames: ["Roar", "Idle"],
    },
    bossSummon: {
      fileAnimationName: "Summon",
      backupFileAnimationNames: ["RangedAttack", "BasicMagic", "Idle"],
    },
    bossEnrage: {
      fileAnimationName: "Enrage",
      backupFileAnimationNames: ["Roar", "Attack"],
    },
    bossWipeReset: {
      fileAnimationName: "WipeReset",
      backupFileAnimationNames: ["PhaseTransition", "Idle"],
    },
    bossDeath: {
      fileAnimationName: "Death",
      backupFileAnimationNames: ["Fall", "Falling"],
    },
    vendorWork: {
      fileAnimationName: "VendorWork",
      backupFileAnimationNames: ["ItemPutBack", "Idle"],
    },
    talkGesture: {
      fileAnimationName: "TalkGesture",
      backupFileAnimationNames: ["Waving", "Point", "Idle"],
    },
    questGesture: {
      fileAnimationName: "QuestGesture",
      backupFileAnimationNames: ["Point", "Waving", "Idle"],
    },
    sit: { fileAnimationName: "Sit", backupFileAnimationNames: ["Idle"] },
    eat: {
      fileAnimationName: "Eat",
      backupFileAnimationNames: ["ItemPutBack", "Idle"],
    },
    drink: {
      fileAnimationName: "Drink",
      backupFileAnimationNames: ["ItemPutBack", "Idle"],
    },
    sleep: {
      fileAnimationName: "Sleep",
      backupFileAnimationNames: ["Sit", "Idle"],
    },
    workLoop: {
      fileAnimationName: "WorkLoop",
      backupFileAnimationNames: ["VendorWork", "ItemPutBack", "Idle"],
    },
    smithWork: {
      fileAnimationName: "SmithWork",
      backupFileAnimationNames: ["DiggingTool", "Attack", "ItemPutBack"],
    },
    cookWork: {
      fileAnimationName: "CookWork",
      backupFileAnimationNames: ["ItemPutBack", "Idle"],
    },
    dockWork: {
      fileAnimationName: "DockWork",
      backupFileAnimationNames: ["DiggingTool", "ItemPutBack", "Idle"],
    },
    healerWork: {
      fileAnimationName: "HealerWork",
      backupFileAnimationNames: ["BasicMagic", "ItemPutBack", "Idle"],
    },
    guardPatrolIdle: {
      fileAnimationName: "GuardPatrolIdle",
      backupFileAnimationNames: ["Idle", "Walking"],
    },
    crowdEmote: {
      fileAnimationName: "CrowdEmote",
      backupFileAnimationNames: ["Waving", "Applause", "Idle"],
    },

    ...HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS,

    walk: walkAnimation,
    run: runAnimation,
    runBackwards: walkAnimation,
    idle: idleAnimation,

    crouchIdle: idleAnimation,
    crouchWalking: walkAnimation,

    swimIdle: idleAnimation,
    swimForwards: swimAnimation,
    swimBackwards: swimAnimation,

    flyIdle: idleAnimation,
    flyForwards: flyAnimation,

    strafeRightSlow: walkAnimation,
    strafeRightFast: runAnimation,
    strafeLeftSlow: walkAnimation,
    strafeLeftFast: runAnimation,
  },
  {
    all: {
      re: /(.*)/i,
    },
  }
);

const onHitScaleCurve = bezierMultipleDerivatives(bezierFunctionsScalar, [
  { point: 1, derivative: 0, t: 0 },
  { point: 0.7, derivative: 0, t: 0.5 },
  { point: 1, derivative: 0, t: 1 },
]);
const ON_HIT_ANIMATION_DURATION_SECS = 0.2;
const onDeathScaleCurve = bezierMultipleDerivatives(bezierFunctionsScalar, [
  { point: 1, derivative: 0, t: 0 },
  { point: 0.7, derivative: 0, t: 0.5 },
  { point: HARTHMERE_NPC_DEATH_CORPSE_HOLD_SCALE, derivative: 0, t: 1 },
]);
const ON_DEATH_ANIMATION_DURATION_SECS =
  HARTHMERE_NPC_DEATH_ANIMATION_DURATION_SECS;

export type NpcAnimationAction = AnimationAction<typeof npcSystem>;

function getHarthmereStableNpcAnimationVelocity(
  velocity: ReadonlyVec3
): ReadonlyVec3 {
  const horizontalSpeed = Math.hypot(velocity[0] ?? 0, velocity[2] ?? 0);
  if (horizontalSpeed < HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED) {
    return [0, velocity[1] ?? 0, 0];
  }
  return velocity;
}

// HARTHMERE_NPC_STABLE_DEATH_VELOCITY_COMPAT
// Keeps the current anti-jitter contract visible while allowing current corpses to stop.
function getHarthmereLiveNpcAnimationVelocity(
  velocity: ReadonlyVec3
): ReadonlyVec3 {
  return {
    velocity: getHarthmereStableNpcAnimationVelocity(velocity),
  }.velocity;
}

function getHarthmereStoppedNpcAnimationVelocity(): ReadonlyVec3 {
  return [0, 0, 0];
}

function harthmereNpcProjectileOrigin(
  root: THREE.Object3D,
  fallback: readonly [number, number, number]
): [number, number, number] {
  const socket = root.getObjectByName("Socket_Mouth");
  if (!socket) return [...fallback];
  root.updateWorldMatrix(true, true);
  const world = socket.getWorldPosition(new THREE.Vector3());
  return [world.x, world.y, world.z];
}

function getAttackAnimationAction(
  attackTime: number | undefined,
  timelineMatcher: TimelineMatcher,
  secondsSinceEpoch: number,
  label?: string,
  entityId?: BiomesId,
  abilityClip?: HarthmereBossAnimationClip
): NpcAnimationAction | undefined {
  if (attackTime) {
    const bossClip =
      abilityClip ??
      harthmereBossAttackClipForEntityEvent(
        label,
        Number(entityId),
        Math.round(attackTime * 1000)
      );
    return {
      weights: npcSystem.singleAnimationWeight(
        bossAnimationStateForClip(bossClip),
        1
      ),
      state: {
        repeat: { kind: "once" },
        startTime: timelineMatcher.match(
          "attack",
          attackTime,
          secondsSinceEpoch
        ),
      },
      layers: {
        all: "apply",
      },
    };
  }
}

function getMagicChargeAnimationAction(
  chargeStartedAt: number | undefined,
  releaseTime: number | undefined,
  timelineMatcher: TimelineMatcher,
  secondsSinceEpoch: number
): NpcAnimationAction | undefined {
  if (
    chargeStartedAt === undefined ||
    releaseTime === undefined ||
    secondsSinceEpoch < chargeStartedAt ||
    secondsSinceEpoch >= releaseTime
  ) {
    return undefined;
  }
  return {
    weights: npcSystem.singleAnimationWeight("magicCharge", 1),
    state: {
      repeat: { kind: "repeat" },
      startTime: timelineMatcher.match(
        "magicCharge",
        chargeStartedAt,
        secondsSinceEpoch
      ),
      easeInTime: 0.08,
    },
    layers: { all: "apply" },
  };
}

function getNpcEvadeAnimationAction(
  movementState: ReadonlyMovementState | undefined,
  timelineMatcher: TimelineMatcher,
  nowSeconds: number,
  ...descriptors: Array<string | undefined>
): NpcAnimationAction | undefined {
  if (!movementActionIsActive(movementState, nowSeconds)) {
    return;
  }
  const profile = npcEvadeProfileForDescriptor(...descriptors);
  return {
    weights: npcSystem.singleAnimationWeight(profile.animation, 1),
    state: {
      repeat: { kind: "once" },
      startTime: timelineMatcher.match(
        "movementAction",
        movementState!.action_start_time,
        nowSeconds
      ),
      easeInTime: 0.04,
    },
    layers: { all: "apply" },
  };
}

function bossAnimationStateForClip(
  clip: HarthmereBossAnimationClip | undefined
):
  | "attack"
  | "bossHeavyAttack"
  | "bossRangedAttack"
  | "bossAreaAttack"
  | "bossJump"
  | "bossPhaseTransition"
  | "bossSummon"
  | "bossEnrage"
  | "bossWipeReset"
  | "bossDeath" {
  switch (clip) {
    case "HeavyAttack":
      return "bossHeavyAttack";
    case "RangedAttack":
      return "bossRangedAttack";
    case "AreaAttack":
      return "bossAreaAttack";
    case "Jump":
      return "bossJump";
    case "PhaseTransition":
      return "bossPhaseTransition";
    case "Summon":
      return "bossSummon";
    case "Enrage":
      return "bossEnrage";
    case "WipeReset":
      return "bossWipeReset";
    case "Death":
      return "bossDeath";
    default:
      return "attack";
  }
}

function getOneShotNpcAnimationAction(
  animation:
    | "creatureHit"
    | "bossDeath"
    | "bossPhaseTransition"
    | "bossSummon"
    | "bossEnrage"
    | "bossWipeReset",
  eventKey: string,
  eventTime: number | undefined,
  timelineMatcher: TimelineMatcher,
  secondsSinceEpoch: number
): NpcAnimationAction | undefined {
  if (eventTime === undefined) {
    return undefined;
  }
  return {
    weights: npcSystem.singleAnimationWeight(animation, 1),
    state: {
      repeat: { kind: "once" },
      startTime: timelineMatcher.match(eventKey, eventTime, secondsSinceEpoch),
    },
    layers: { all: "apply" },
  };
}

function applyHarthmereBossDamagePose(
  entity: RenderNpcEntity,
  root: THREE.Object3D,
  secondsSinceEpoch: number,
  synchronizedNpcStateData?: Uint8Array
) {
  const bossId = root.userData.harthmereBossVisualId;
  if (!bossId) {
    return;
  }
  const customState = deserializeNpcCustomState(
    synchronizedNpcStateData ?? (entity as ReadonlyEntity).npc_state?.data
  );
  const healthRatio =
    entity.health.maxHp > 0 ? entity.health.hp / entity.health.maxHp : 0;
  if (bossId === "gilded_bull") {
    const brokenParts = new Set(
      customState.chapter1Encounter?.brokenPartIds ?? []
    );
    const leftHorn = root.getObjectByName("Horn.L");
    const rightHorn = root.getObjectByName("Horn.R");
    if (brokenParts.has("left_horn")) {
      leftHorn?.scale.setScalar(0.16);
    }
    if (brokenParts.has("right_horn")) {
      rightHorn?.scale.setScalar(0.16);
    }
    const brokenCount =
      Number(brokenParts.has("left_horn")) +
      Number(brokenParts.has("right_horn"));
    if (brokenCount >= 2) {
      const leftDoor = root.getObjectByName("CoreDoor.L");
      const rightDoor = root.getObjectByName("CoreDoor.R");
      if (leftDoor) {
        leftDoor.rotation.y = -0.48;
        leftDoor.rotation.z = -0.22;
      }
      if (rightDoor) {
        rightDoor.rotation.y = 0.48;
        rightDoor.rotation.z = 0.22;
      }
      const emitter = root.getObjectByName("Emitter");
      if (emitter) {
        emitter.scale.setScalar(Math.max(1.22, emitter.scale.x));
      }
    }
    root.userData.harthmereBossDamagePose = {
      brokenParts: [...brokenParts],
      phase:
        brokenCount >= 2
          ? "unbalanced"
          : brokenCount === 1
            ? "damaged"
            : "intact",
    };
    return;
  }
  if (bossId === "muck_scarred_helix") {
    const phase =
      healthRatio <= 0.3
        ? "rupturing"
        : healthRatio <= 0.65
          ? "opened"
          : "armored";
    if (phase !== "armored") {
      const leftShell = root.getObjectByName("Carapace.L");
      const rightShell = root.getObjectByName("Carapace.R");
      if (leftShell) {
        leftShell.rotation.y -= phase === "rupturing" ? 0.58 : 0.32;
        leftShell.rotation.z -= phase === "rupturing" ? 0.3 : 0.16;
      }
      if (rightShell) {
        rightShell.rotation.y += phase === "rupturing" ? 0.58 : 0.32;
        rightShell.rotation.z += phase === "rupturing" ? 0.3 : 0.16;
      }
      for (const name of ["Helix.A", "Helix.B", "Emitter"]) {
        const part = root.getObjectByName(name);
        if (part) {
          part.scale.setScalar(
            Math.max(phase === "rupturing" ? 1.3 : 1.12, part.scale.x)
          );
        }
      }
    }
    root.userData.harthmereBossDamagePose = { phase, healthRatio };
    return;
  }
  if (bossId === "ninth_winter") {
    const encounter = customState.chapter1Encounter;
    const cycleElapsedMs =
      encounter?.cycleStartedAtMs === undefined
        ? 0
        : secondsSinceEpoch * 1000 - encounter.cycleStartedAtMs;
    const phase =
      healthRatio <= 0.3
        ? "year_breaks"
        : encounter?.cycleStartedAtMs === undefined || cycleElapsedMs < 30_000
          ? "hearth_fails"
          : "same_day_again";
    for (const name of ["Rain.L", "Rain.R"]) {
      const rain = root.getObjectByName(name);
      if (rain) {
        rain.scale.setScalar(phase === "year_breaks" ? 1 : 0.02);
      }
    }
    if (phase === "year_breaks") {
      root.getObjectByName("SnowMantle")?.scale.setScalar(0.34);
      const leftShell = root.getObjectByName("YearShell.L");
      const rightShell = root.getObjectByName("YearShell.R");
      if (leftShell) {
        leftShell.rotation.y -= 0.48;
        leftShell.rotation.z -= 0.28;
      }
      if (rightShell) {
        rightShell.rotation.y += 0.48;
        rightShell.rotation.z += 0.28;
      }
      const emitter = root.getObjectByName("Emitter");
      if (emitter) {
        emitter.scale.setScalar(Math.max(1.38, emitter.scale.x));
      }
    } else if (phase === "same_day_again") {
      const timeRing = root.getObjectByName("TimeRing");
      if (timeRing) {
        timeRing.scale.setScalar(Math.max(1.12, timeRing.scale.x));
      }
    }
    root.userData.harthmereBossDamagePose = {
      phase,
      loopCount: encounter?.loopCount ?? 0,
      healthRatio,
    };
    return;
  }
  if (
    applyHarthmereScratchBossDamagePose(
      root,
      bossId,
      healthRatio,
      customState.chapter1Encounter?.routeChoice
    )
  ) {
    return;
  }
  if (bossId === "thaedryn_bellbound") {
    const chainsRemaining =
      healthRatio > 0.75
        ? 4
        : healthRatio > 0.5
          ? 2
          : healthRatio > 0.2
            ? 1
            : 0;
    const brokenChains = 4 - chainsRemaining;
    for (let index = 1; index <= 4; index += 1) {
      const hidden = index <= brokenChains;
      for (const prefix of ["Chain", "Bell"]) {
        const part = root.getObjectByName(`${prefix}.${index}`);
        if (part && hidden) {
          part.scale.setScalar(0.12);
        }
      }
    }
    const emitter = root.getObjectByName("Emitter");
    if (emitter) {
      emitter.scale.setScalar(
        Math.max(1 + brokenChains * 0.12, emitter.scale.x)
      );
    }
    root.userData.harthmereBossDamagePose = {
      phase:
        chainsRemaining === 4
          ? "sleeper"
          : chainsRemaining === 2
            ? "half_waking"
            : chainsRemaining === 1
              ? "bellbound"
              : "path_dependent",
      chainsRemaining,
      healthRatio,
    };
  }
}

function damageSourceCausesParticles(
  damageSource: ReadonlyOptionalDamageSource
) {
  return damageSource?.kind === "attack";
}
export interface ConsecutiveFrameState {
  lastRenderFrame: number;
  position: Transition<ReadonlyVec3>;
  orientation: Transition<number>;
  spatialLighting: Transition<ReadonlyVec3>;
}

type NpcChannels = "itemOnHit" | "npcVoice";

const HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION =
  "harthmere-npc-walk-run-animation";
const BIOMES_SNAPSHOT_STYLE_NPC_ANIMATION_VERSION =
  "biomes-snapshot-style-npc-animation";
const HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION =
  "harthmere-voxel-npc-retaliation-animation";
const HARTHMERE_NPC_CHASE_REGEN_WANDER = "harthmere-npc-chase-regen-wander";
const HARTHMERE_VOXEL_NPC_RENDER_MOTION_ANIMATION =
  "harthmere-voxel-npc-render-motion-animation";
const HARTHMERE_VOXEL_NPC_UNIVERSAL_COMBAT_ANIMATION_AUDIT =
  "harthmere-voxel-npc-universal-combat-animation-audit";
const HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION =
  "harthmere-npc-product-minecraft-polish";

function makeLocalDevVoxelNpcAnimationClips(): THREE.AnimationClip[] {
  // BIOMES_SNAPSHOT_STYLE_NPC_ANIMATION_VERSION
  // The snapshot NPCs feel better because their loops have smoother cadence,
  // subtle idle life, and clearer arm/leg counter-motion. Keep the same node
  // names and clip names so the Glitch/Harthmere animation system keeps using
  // the existing Idle/Walk/Run states, but replace the stiff 4-keyframe motion
  // with safer snapshot-style loops.
  //
  // HARTHMERE_NPC_LIVELY_LOCOMOTION_POLISH: layer in stronger arm
  // counter-swing, head bob via head.rotation[x] (defaults to 0 so it adds
  // safely), and side-to-side body sway via body.rotation[z]. All new tracks
  // use rotation channels only - position channels would replace absolute Y
  // and snap NPCs to wrong heights since legs/body/head have non-zero default
  // local positions. Rotation tracks default to 0 so they cleanly add to the
  // base pose and degrade safely if a node is missing.
  const idleTimes = [0, 0.55, 1.1, 1.65, 2.2];
  const walkTimes = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  const runTimes = [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64];
  const attackTimes = [0, 0.1, 0.2, 0.34, 0.48, 0.62];
  const attackRightArm = [0.08, -0.38, -0.9, -0.25, 0.16, 0.08];
  const attackLeftArm = [0.02, 0.18, 0.3, 0.14, 0.04, 0.02];
  const attackBodyYaw = [0, -0.08, -0.16, 0.1, 0.03, 0];
  const attackBodyRoll = [0, -0.025, -0.055, 0.04, 0.015, 0];
  const attackHeadPitch = [0, 0.04, 0.075, 0.025, 0, 0];
  const attackLegBend = [0, -0.08, -0.14, -0.05, 0.02, 0];

  const walkLeg = [0, 0.38, 0.58, 0.36, 0, -0.36, -0.58, -0.38, 0];
  const walkLegOpposite = [0, -0.36, -0.58, -0.38, 0, 0.38, 0.58, 0.36, 0];
  const walkArm = [0, -0.24, -0.38, -0.22, 0, 0.22, 0.38, 0.24, 0];
  const walkArmOpposite = [0, 0.22, 0.38, 0.24, 0, -0.24, -0.38, -0.22, 0];
  const walkBodyYaw = [0, -0.025, -0.035, -0.02, 0, 0.02, 0.035, 0.025, 0];
  // current: side-to-side weight shift on the torso and a subtle head bob via
  // pitch. Both rotation channels default to 0 so these tracks add to the
  // base pose without breaking placement.
  const walkBodyRoll = [0, 0.018, 0.024, 0.014, 0, -0.014, -0.024, -0.018, 0];
  const walkHeadPitch = [0, 0.012, 0, 0.012, 0, 0.012, 0, 0.012, 0];
  const walkHeadYaw = [0, 0.015, 0, -0.015, 0, 0.015, 0, -0.015, 0];

  const runLeg = [0, 0.62, 0.92, 0.56, 0, -0.56, -0.92, -0.62, 0];
  const runLegOpposite = [0, -0.56, -0.92, -0.62, 0, 0.62, 0.92, 0.56, 0];
  const runArm = [0, -0.44, -0.66, -0.42, 0, 0.42, 0.66, 0.44, 0];
  const runArmOpposite = [0, 0.42, 0.66, 0.44, 0, -0.44, -0.66, -0.42, 0];
  const runBodyYaw = [0, -0.04, -0.06, -0.035, 0, 0.035, 0.06, 0.04, 0];
  // current run: larger amplitudes, forward head pitch (lean), stronger sway.
  const runBodyRoll = [0, 0.035, 0.046, 0.024, 0, -0.024, -0.046, -0.035, 0];
  const runHeadPitch = [0.04, 0.06, 0.08, 0.06, 0.04, 0.06, 0.08, 0.06, 0.04];

  return [
    new THREE.AnimationClip("Idle", 2.2, [
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-leg.rotation[x]",
        idleTimes,
        [0, 0.015, 0, -0.015, 0]
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-leg.rotation[x]",
        idleTimes,
        [0, -0.015, 0, 0.015, 0]
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-arm.rotation[x]",
        idleTimes,
        [0.04, 0.075, 0.04, 0.015, 0.04]
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-arm.rotation[x]",
        idleTimes,
        [0.04, 0.015, 0.04, 0.075, 0.04]
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[y]",
        idleTimes,
        [0, -0.012, 0, 0.012, 0]
      ),
      // current idle breath - subtle head pitch.
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-head.rotation[x]",
        idleTimes,
        [0, 0.006, 0, -0.006, 0]
      ),
    ]),
    new THREE.AnimationClip("Walk", 1, [
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-leg.rotation[x]",
        walkTimes,
        walkLeg
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-leg.rotation[x]",
        walkTimes,
        walkLegOpposite
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-arm.rotation[x]",
        walkTimes,
        walkArm
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-arm.rotation[x]",
        walkTimes,
        walkArmOpposite
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[y]",
        walkTimes,
        walkBodyYaw
      ),
      // current lively walk polish - body weight-shift sway and head bob/turn.
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[z]",
        walkTimes,
        walkBodyRoll
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-head.rotation[x]",
        walkTimes,
        walkHeadPitch
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-head.rotation[y]",
        walkTimes,
        walkHeadYaw
      ),
    ]),
    new THREE.AnimationClip("Run", 0.64, [
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-leg.rotation[x]",
        runTimes,
        runLeg
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-leg.rotation[x]",
        runTimes,
        runLegOpposite
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-arm.rotation[x]",
        runTimes,
        runArm
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-arm.rotation[x]",
        runTimes,
        runArmOpposite
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[y]",
        runTimes,
        runBodyYaw
      ),
      // current lively run polish - bigger sway, forward head lean.
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[z]",
        runTimes,
        runBodyRoll
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-head.rotation[x]",
        runTimes,
        runHeadPitch
      ),
    ]),
    // HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION
    // Native voxel attack clip used when Harthmere combat AI says an ECS NPC
    // hit the player. This keeps retaliation visual feedback in the same voxel
    // NPC renderer path as Idle/Walk/Run instead of using harthmere_assets.ts.
    new THREE.AnimationClip("Attack", 0.62, [
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-arm.rotation[x]",
        attackTimes,
        attackRightArm
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-arm.rotation[x]",
        attackTimes,
        attackLeftArm
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[y]",
        attackTimes,
        attackBodyYaw
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-body.rotation[z]",
        attackTimes,
        attackBodyRoll
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-head.rotation[x]",
        attackTimes,
        attackHeadPitch
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-left-leg.rotation[x]",
        attackTimes,
        attackLegBend
      ),
      new THREE.NumberKeyframeTrack(
        "harthmere-npc-right-leg.rotation[x]",
        attackTimes,
        attackLegBend
      ),
    ]),
  ];
}

function recordHarthmereNpcAnimationLoadCheck(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[]
): void {
  const clipNames = clips.map((clip) => clip.name);
  root.userData.harthmereNpcAnimationVersion =
    HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION;
  root.userData.biomesSnapshotStyleNpcAnimationVersion =
    BIOMES_SNAPSHOT_STYLE_NPC_ANIMATION_VERSION;
  root.userData.harthmereNpcAnimationLoadCheck = {
    version: HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION,
    snapshotStyleVersion: BIOMES_SNAPSHOT_STYLE_NPC_ANIMATION_VERSION,
    clipCount: clips.length,
    clipNames,
    hasIdle: clipNames.some((name) => /idle/i.test(name)),
    hasWalk: clipNames.some((name) => /walk/i.test(name)),
    hasRun: clipNames.some((name) => /run/i.test(name)),
    hasAttack: clipNames.some((name) => /attack/i.test(name)),
    loadedAt: Date.now(),
  };
}

function recordHarthmereNpcAnimationExecutionCheck(
  root: THREE.Object3D,
  velocity: ReadonlyVec3,
  runSpeed: number,
  mixerTime: number,
  attackTime?: number,
  secondsSinceEpoch?: number
): void {
  const horizontalSpeed = Math.hypot(velocity[0] ?? 0, velocity[2] ?? 0);
  const moving = horizontalSpeed > 0.025;
  const running = moving && horizontalSpeed >= Math.max(0.01, runSpeed * 0.6);
  const attackAgeSeconds =
    Number.isFinite(attackTime) && Number.isFinite(secondsSinceEpoch)
      ? Number(secondsSinceEpoch) - Number(attackTime)
      : undefined;
  const attackActive =
    typeof attackAgeSeconds === "number" &&
    attackAgeSeconds >= -0.05 &&
    attackAgeSeconds <= 0.95;
  const selectedState = attackActive
    ? "attack"
    : running
      ? "run"
      : moving
        ? "walk"
        : "idle";
  const loadCheck = root.userData.harthmereNpcAnimationLoadCheck as
    | {
        hasAttack?: boolean;
        hasWalk?: boolean;
        hasRun?: boolean;
        clipCount?: number;
      }
    | undefined;

  root.userData.harthmereNpcAnimationExecutionCheck = {
    version: HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION,
    moving,
    running,
    attackActive,
    attackAgeSeconds,
    horizontalSpeed,
    selectedState,
    selected: selectedState,
    hasMatchingClip: attackActive
      ? Boolean(loadCheck?.hasAttack)
      : running
        ? Boolean(loadCheck?.hasRun)
        : moving
          ? Boolean(loadCheck?.hasWalk)
          : true,
    clipCount: loadCheck?.clipCount ?? 0,
    mixerTime,
    executedAt: Date.now(),
  };
}

function publishHarthmereVoxelNpcUniversalCombatAnimationAudit(
  entity: RenderNpcEntity,
  root: THREE.Object3D,
  position: ReadonlyVec3,
  orientation: ReadonlyVec2,
  velocity: ReadonlyVec3,
  attackTime: number | undefined,
  secondsSinceEpoch: number,
  motion: { mode: HarthmereVoxelNpcMotionMode; reason: string } | undefined,
  navigationResult: HarthmereNpcNavigationResult | undefined,
  logStateChange: boolean
): void {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as typeof window & {
    __harthmereVoxelNpcAnimationAudit?: Record<string, Record<string, unknown>>;
    __harthmereVoxelNpcAnimationAuditLog?: Array<Record<string, unknown>>;
  };
  const label = entity.label?.text ?? `Voxel NPC ${entity.id}`;
  const execution = root.userData.harthmereNpcAnimationExecutionCheck as
    Record<string, unknown> | undefined;
  const loadCheck = root.userData.harthmereNpcAnimationLoadCheck as
    Record<string, unknown> | undefined;
  const attackAgeMs = Number.isFinite(attackTime)
    ? Math.max(0, Math.round((secondsSinceEpoch - Number(attackTime)) * 1000))
    : undefined;
  const attackActive = execution?.attackActive === true;
  const yaw = Number(orientation[1] ?? 0);
  const forward = harthmereNormalize2(
    -Math.sin(Number.isFinite(yaw) ? yaw : 0),
    -Math.cos(Number.isFinite(yaw) ? yaw : 0)
  ) ?? [0, -1];
  const entry = {
    version: HARTHMERE_VOXEL_NPC_UNIVERSAL_COMBAT_ANIMATION_AUDIT,
    at: Date.now(),
    id: entity.id,
    label,
    renderer: "native_voxel_npc_resource",
    source: "src/client/game/resources/npcs.ts",
    position: [position[0], position[1], position[2]],
    pos: [position[0], position[2]],
    velocity: [velocity[0], velocity[1], velocity[2]],
    facingYaw: yaw,
    forward,
    species: harthmereVoxelNpcSpecies(label),
    behavior: harthmereVoxelNpcBehavior(label),
    selectedState: execution?.selectedState ?? execution?.selected ?? "unknown",
    animationState:
      execution?.selectedState ?? execution?.selected ?? "unknown",
    animationMoving: execution?.moving === true,
    running: execution?.running === true,
    horizontalSpeed: execution?.horizontalSpeed,
    bodyAttackActive: attackActive,
    emptyHandedBodyAttack: attackActive,
    attackTime,
    attackAgeMs,
    hasAttackClip: loadCheck?.hasAttack === true,
    hasMatchingClip: execution?.hasMatchingClip === true,
    motionMode: motion?.mode ?? "registry",
    motionReason: motion?.reason ?? "rendered_native_voxel_position",
    navigationBlocked: navigationResult?.blocked ?? false,
    navigationStuck: navigationResult?.stuck ?? false,
    navigationResolution: navigationResult?.resolution ?? "none",
    navigationAnimationMoving: navigationResult?.animationMoving,
  };
  const audit = (win.__harthmereVoxelNpcAnimationAudit ??= {});
  audit[String(entity.id)] = entry;
  if (logStateChange) {
    const auditLog = (win.__harthmereVoxelNpcAnimationAuditLog ??= []);
    auditLog.unshift(entry);
    if (auditLog.length > 240) {
      auditLog.length = 240;
    }
  }
}

function getHarthmereVoxelNpcRetaliationAttackTime(
  entityId: unknown,
  secondsSinceEpoch: number
): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const win = window as typeof window & {
    __harthmereVoxelNpcRetaliationAnimation?: Record<
      string,
      {
        at?: number;
        animation?: string;
        consumedAt?: number;
        attackTime?: number;
      }
    >;
    __harthmereVoxelNpcRetaliationAnimationReadLog?: Array<
      Record<string, unknown>
    >;
  };
  const key = String(entityId);
  const entry = win.__harthmereVoxelNpcRetaliationAnimation?.[key];
  const at = Number(entry?.at ?? NaN);
  if (!entry || !Number.isFinite(at)) {
    return undefined;
  }

  const ageMs = Date.now() - at;
  if (ageMs < 0 || ageMs > 900) {
    if (ageMs > 1600 && win.__harthmereVoxelNpcRetaliationAnimation) {
      delete win.__harthmereVoxelNpcRetaliationAnimation[key];
    }
    return undefined;
  }

  entry.consumedAt = Date.now();
  entry.attackTime ??= secondsSinceEpoch - ageMs / 1000;
  win.__harthmereVoxelNpcRetaliationAnimationReadLog = [
    {
      version: HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION,
      entityId: key,
      ageMs,
      attackTime: entry.attackTime,
      source: "native_voxel_npc_resource_attack_time",
    },
    ...(win.__harthmereVoxelNpcRetaliationAnimationReadLog ?? []),
  ].slice(0, 100);

  return entry.attackTime;
}

type HarthmereVoxelNpcMotionMode = "wander" | "chase";

function harthmereHashNumber(value: unknown): number {
  const text = String(value ?? "0");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function harthmereNormalize2(
  dx: number,
  dz: number
): [number, number] | undefined {
  const len = Math.hypot(dx, dz);
  if (!Number.isFinite(len) || len <= 0.0001) {
    return undefined;
  }
  return [dx / len, dz / len];
}

function harthmereYawToward(
  from: ReadonlyVec3,
  toXZ: readonly [number, number]
): Vec2 {
  const dx = toXZ[0] - from[0];
  const dz = toXZ[1] - from[2];
  return pitchAndYaw([dx, 0, dz]);
}

function harthmereVoxelNpcBehavior(label: unknown): string {
  const text = String(label ?? "").toLowerCase();
  if (
    /muck|muckling|mucker|hexer|bandit|wolf|boar|bear|snake|rat|zombie|undead|hostile/.test(
      text
    )
  ) {
    return "hostile";
  }
  if (/guard|watch|sentry|patrol|sergeant/.test(text)) {
    return "guard";
  }
  if (/merchant|banker|clerk|registrar|supplier|teller/.test(text)) {
    return "merchant";
  }
  return "defensive";
}

function harthmereVoxelNpcSpecies(label: unknown): string {
  const text = String(label ?? "").toLowerCase();
  if (/zombie|undead|corpse|grave/.test(text)) {
    return "undead";
  }
  if (
    /muck|muckling|mucker|wolf|boar|bear|snake|rat|deer|animal|wildlife/.test(
      text
    )
  ) {
    return "animal";
  }
  return "human";
}

function getHarthmereVoxelNpcMotionOverride(
  entity: RenderNpcEntity,
  basePosition: ReadonlyVec3,
  baseOrientation: ReadonlyVec2,
  secondsSinceEpoch: number,
  localPlayerPosition: ReadonlyVec3 | undefined
):
  | {
      position: Vec3;
      orientation: Vec2;
      mode: HarthmereVoxelNpcMotionMode;
      reason: string;
    }
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const win = window as typeof window & {
    __harthmereVoxelNpcMotion?: Record<string, Record<string, unknown>>;
    __harthmereVoxelNpcAmbientWanderEnabled?: boolean;
    __harthmereVoxelNpcMotionReadLog?: Array<Record<string, unknown>>;
  };
  const idKey = String(entity.id);
  const nowMs = Date.now();
  const chase = win.__harthmereVoxelNpcMotion?.[idKey];
  const chaseAt = Number(chase?.at ?? NaN);
  if (
    chase &&
    Number.isFinite(chaseAt) &&
    nowMs - chaseAt <= Number(chase.durationMs ?? 3200) + 600
  ) {
    const fromRaw = Array.isArray(chase.from) ? chase.from : undefined;
    const targetRaw = Array.isArray(chase.targetPos)
      ? chase.targetPos
      : Array.isArray(chase.playerPos)
        ? chase.playerPos
        : undefined;
    const from: [number, number] = [
      Number(fromRaw?.[0] ?? basePosition[0]),
      Number(fromRaw?.[1] ?? basePosition[2]),
    ];
    const target: [number, number] | undefined = targetRaw
      ? [Number(targetRaw[0]), Number(targetRaw[1])]
      : localPlayerPosition
        ? [localPlayerPosition[0], localPlayerPosition[2]]
        : undefined;
    if (
      target &&
      from.every(Number.isFinite) &&
      target.every(Number.isFinite)
    ) {
      const dx = target[0] - from[0];
      const dz = target[1] - from[1];
      const distance = Math.hypot(dx, dz);
      const stopDistance = Math.max(1.1, Number(chase.stopDistance ?? 2.1));
      const speed = Math.max(0.6, Number(chase.speed ?? 2.25));
      const travel = (speed * Math.max(0, nowMs - chaseAt)) / 1000;
      const maxTravel = Math.max(0, distance - stopDistance);
      const moveDistance = Math.min(maxTravel, travel);
      const ratio = distance > 0 ? moveDistance / distance : 0;
      const position: Vec3 = [
        from[0] + dx * ratio,
        basePosition[1],
        from[1] + dz * ratio,
      ];
      const orientation = harthmereYawToward(position, target);
      win.__harthmereVoxelNpcMotionReadLog = [
        {
          version: HARTHMERE_NPC_CHASE_REGEN_WANDER,
          entityId: idKey,
          mode: "chase",
          ageMs: nowMs - chaseAt,
          from,
          target,
          distance,
          stopDistance,
          speed,
          ratio,
          position,
          source: "native_voxel_npc_chase_motion",
        },
        ...(win.__harthmereVoxelNpcMotionReadLog ?? []),
      ].slice(0, 160);
      return {
        position,
        orientation,
        mode: "chase",
        reason: String(chase.reason ?? "combat_chase"),
      };
    }
  }

  if (win.__harthmereVoxelNpcAmbientWanderEnabled === false) {
    return undefined;
  }

  const groveRoute = snapshotGroveNpcRouteMotion({
    entityId: entity.id,
    label: entity.label?.text,
    secondsSinceEpoch,
  });
  if (groveRoute) {
    const position = groveRoute.position;
    const orientation = harthmereYawToward(position, [
      groveRoute.nextPosition[0],
      groveRoute.nextPosition[2],
    ]);
    win.__harthmereVoxelNpcMotionReadLog = [
      {
        version: SNAPSHOT_GROVE_NPC_ROUTE_VERSION,
        entityId: idKey,
        mode: "wander",
        routeId: groveRoute.routeId,
        speedMetersPerSecond: groveRoute.speedMetersPerSecond,
        position,
        source: "grove_named_route_motion",
      },
      ...(win.__harthmereVoxelNpcMotionReadLog ?? []),
    ].slice(0, 160);
    return {
      position,
      orientation,
      mode: "wander",
      reason: "grove_named_route",
    };
  }

  const seed = harthmereHashNumber(entity.id);
  const radius = 0.85 + (seed % 220) / 100;
  const period = 9.5 + (seed % 700) / 100;
  const phase = (seed % 6283) / 1000 + secondsSinceEpoch / period;
  const nextPhase = phase + 0.08;
  const x = basePosition[0] + Math.cos(phase) * radius;
  const z = basePosition[2] + Math.sin(phase * 0.83) * radius * 0.72;
  const nx = basePosition[0] + Math.cos(nextPhase) * radius;
  const nz = basePosition[2] + Math.sin(nextPhase * 0.83) * radius * 0.72;
  const moved = Math.hypot(x - basePosition[0], z - basePosition[2]);
  if (moved <= 0.05) {
    return undefined;
  }
  const position: Vec3 = [x, basePosition[1], z];
  const orientation = harthmereYawToward(position, [nx, nz]);
  win.__harthmereVoxelNpcMotionReadLog = [
    {
      version: HARTHMERE_NPC_CHASE_REGEN_WANDER,
      entityId: idKey,
      mode: "wander",
      radius,
      period,
      position,
      source: "native_voxel_npc_ambient_wander",
    },
    ...(win.__harthmereVoxelNpcMotionReadLog ?? []),
  ].slice(0, 160);
  return {
    position,
    orientation,
    mode: "wander",
    reason: "ambient_map_wander",
  };
}

function getHarthmereVoxelNpcRenderMotionAnimationVelocity(
  orientation: ReadonlyVec2,
  motion: { mode: HarthmereVoxelNpcMotionMode; reason: string } | undefined
): Vec3 | undefined {
  if (!motion) {
    return undefined;
  }
  const yaw = Number(orientation[1] ?? 0);
  if (!Number.isFinite(yaw)) {
    return undefined;
  }
  // Render-only Grove wandering/chasing updates position in the renderer without
  // changing the authoritative rigid body velocity. Feed a small synthetic
  // velocity into the same player/NPC velocity-based animation system so voxel
  // NPCs use their Walk/Run clips while they visibly move.
  const speed = motion.mode === "chase" ? 2.35 : 0.85;
  return [-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed];
}

function publishHarthmereVoxelNpcMotionActorPosition(
  entity: RenderNpcEntity,
  position: ReadonlyVec3,
  orientation: ReadonlyVec2,
  motion: { mode: HarthmereVoxelNpcMotionMode; reason: string } | undefined
) {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as typeof window & {
    __harthmereVoxelNpcMotionActorPositions?: Record<
      string,
      Record<string, unknown>
    >;
    __harthmereVoxelNpcMotionPublishLog?: Array<Record<string, unknown>>;
  };
  const label = entity.label?.text ?? `Voxel NPC ${entity.id}`;
  const forward = harthmereNormalize2(
    -Math.sin(Number(orientation[1] ?? 0)),
    -Math.cos(Number(orientation[1] ?? 0))
  ) ?? [0, -1];
  const entry = {
    version: HARTHMERE_NPC_CHASE_REGEN_WANDER,
    at: Date.now(),
    id: entity.id,
    pos: [position[0], position[2]],
    world: [position[0], position[1], position[2]],
    radius: Math.max(0.45, Math.max(entity.size.v[0], entity.size.v[2]) * 0.55),
    label,
    asset: `voxel_npc:${entity.npc_metadata.type_id}`,
    district: "native_voxel_npc_motion",
    species: harthmereVoxelNpcSpecies(label),
    behavior: harthmereVoxelNpcBehavior(label),
    socialRole:
      harthmereVoxelNpcBehavior(label) === "hostile" ? "hostile" : "civilian",
    attackable: true,
    forward,
    motionMode: motion?.mode ?? "registry",
    motionReason: motion?.reason ?? "rendered_native_voxel_position",
  };
  win.__harthmereVoxelNpcMotionActorPositions = {
    ...(win.__harthmereVoxelNpcMotionActorPositions ?? {}),
    [String(entity.id)]: entry,
  };
  if (motion) {
    win.__harthmereVoxelNpcMotionPublishLog = [
      entry,
      ...(win.__harthmereVoxelNpcMotionPublishLog ?? []),
    ].slice(0, 160);
  }
}

let harthmereNpcGroundProbeFrame = -1;
let harthmereNpcGroundProbeCache = new Map<string, number | undefined>();
// Persistent (cross-frame) memory of the last REAL surface grounded for a
// column, so an entity that already settled on the breach floor is not popped
// back up to the flat authored Y when its terrain shard briefly unloads.
const harthmereNpcLastGroundedFeetYByColumn = new Map<string, number>();
// HARTHMERE_GROUNDED_COLUMN_INVALIDATION (audit fix, 2026-07-13): register the
// persistent column memory for terrain-edit invalidation — mining the ground
// under an NPC must re-probe instead of keeping it on the remembered (now
// removed) surface. The per-frame probe cache above resets each frame and
// needs no registration.
registerHarthmereGroundedColumnCache(harthmereNpcLastGroundedFeetYByColumn);

function sampleHarthmereNpcGroundFeetY(
  resources: ClientResources,
  frameNumber: number,
  x: number,
  z: number,
  preferredY: number,
  requireOpenSky: boolean
): number | undefined {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    !Number.isFinite(preferredY)
  ) {
    return undefined;
  }
  if (harthmereNpcGroundProbeFrame !== frameNumber) {
    harthmereNpcGroundProbeFrame = frameNumber;
    harthmereNpcGroundProbeCache = new Map();
  }
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const iy = Math.round(preferredY);
  const key = `${ix}|${iy}|${iz}|${requireOpenSky ? 1 : 0}`;
  if (harthmereNpcGroundProbeCache.has(key)) {
    return harthmereNpcGroundProbeCache.get(key);
  }

  // Robust, water-aware tri-state probe: the generous up/down budget bridges the
  // Grove(≈70)/wilds(≈54) seam and real hills; water counts as standable support
  // (rest ON the surface, not the lake bed); requireOpenSky keeps OUTDOOR
  // entities out of caves, while business owners pass requireOpenSky=false to
  // stay on the building floor under their roof. The tri-state status lets us
  // tell "terrain not loaded yet" apart from "no surface here", so a kill-target
  // monster keeps its last real surface (instead of floating at the authored Y)
  // while its shard streams in, and re-grounds once the surface is known.
  // Use THE shared world-placement grounder (same as items/drops/markers): one
  // tri-state probe + keep-last-surface memory, so every NPC is always visible
  // and never floats or buries.
  const feetY = harthmereGroundedFeetYWithMemory(
    resources,
    harthmereNpcLastGroundedFeetYByColumn,
    ix,
    iz,
    iy,
    requireOpenSky
  );
  harthmereNpcGroundProbeCache.set(key, feetY);
  return feetY;
}

function parseHarthmereNavigationObstacle(
  raw: unknown
): HarthmereNpcNavigationObstacle | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const hardness = String(record.collisionHardness ?? "");
  const profile = String(record.collisionProfile ?? "");
  if (
    record.npcCanWalkThrough === true ||
    record.playerCanWalkThrough === true ||
    hardness === "none" ||
    profile === "visual_only"
  ) {
    return undefined;
  }
  const cx = Number(record.cx);
  const cz = Number(record.cz);
  const halfX = Number(record.halfX);
  const halfZ = Number(record.halfZ);
  if (![cx, cz, halfX, halfZ].every(Number.isFinite)) {
    return undefined;
  }
  return {
    id: String(record.name ?? record.asset ?? "obstacle"),
    label: String(record.name ?? record.asset ?? "obstacle"),
    cx,
    cz,
    halfX: Math.max(0, halfX),
    halfZ: Math.max(0, halfZ),
    rot: Number.isFinite(Number(record.rot)) ? Number(record.rot) : 0,
    padding: Number.isFinite(Number(record.padding))
      ? Number(record.padding)
      : undefined,
  };
}

function nearbyHarthmereNavigationObstacles(
  position: ReadonlyVec3
): HarthmereNpcNavigationObstacle[] {
  if (typeof window === "undefined") {
    return [];
  }
  const win = window as typeof window & {
    __harthmereNpcCollisionObstacles?: unknown[];
    __harthmerePlayerCollisionObstacles?: unknown[];
    __harthmereTownCollisionObstacles?: unknown[];
  };
  const raw =
    win.__harthmereNpcCollisionObstacles ??
    win.__harthmerePlayerCollisionObstacles ??
    win.__harthmereTownCollisionObstacles ??
    [];
  const parsed: Array<{
    obstacle: HarthmereNpcNavigationObstacle;
    distanceSq: number;
  }> = [];
  for (const entry of raw) {
    const obstacle = parseHarthmereNavigationObstacle(entry);
    if (!obstacle) {
      continue;
    }
    const dx = obstacle.cx - position[0];
    const dz = obstacle.cz - position[2];
    const reach =
      Math.hypot(obstacle.halfX, obstacle.halfZ) +
      (obstacle.padding ?? 0.72) +
      4;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq <= reach * reach) {
      parsed.push({ obstacle, distanceSq });
    }
  }
  parsed.sort((a, b) => a.distanceSq - b.distanceSq);
  return parsed.slice(0, 36).map((entry) => entry.obstacle);
}

function harthmereNavigationModeForMotion(
  motion: { mode: HarthmereVoxelNpcMotionMode; reason: string } | undefined
): HarthmereNpcNavigationMode {
  if (motion?.mode === "chase") {
    return "combat_chase";
  }
  if (motion?.reason === "grove_named_route") {
    return "route_patrol";
  }
  return "town_wander";
}

function cutsceneNpcAnimationAction(
  presentation: { animation?: string; animationTime?: number } | undefined,
  mixerTime: number
): NpcAnimationAction | undefined {
  if (!presentation?.animation) {
    return undefined;
  }
  const aliases: Readonly<Record<string, string>> = {
    attack1: "attack",
    attack2: "attack",
    wave: "talkGesture",
    point: "questGesture",
    applause: "crowdEmote",
    hitReact: "creatureHit",
    death: "creatureDeath",
  };
  const animation = aliases[presentation.animation] ?? presentation.animation;
  if (!npcSystem.hasAnimation(animation)) {
    return undefined;
  }
  return {
    weights: npcSystem.singleAnimationWeight(animation, 1),
    state: {
      // Death holds its final authored frame; hit reactions play once and then
      // yield to the next cutscene beat. Loops remain appropriate for work,
      // social, and repeated attack poses.
      repeat: isHarthmereCinematicExpression(presentation.animation)
        ? harthmereCinematicExpressionRepeat(presentation.animation)
        : presentation.animation === "death"
          ? { kind: "once", clampWhenFinished: true }
          : presentation.animation === "hitReact"
            ? { kind: "once" }
            : { kind: "repeat" },
      startTime: mixerTime - Math.max(0, presentation.animationTime ?? 0),
    },
    layers: { all: "apply" },
  };
}

function gameplayNpcExpressionAnimationAction(
  emote: ReadonlyEmote | undefined,
  timelineMatcher: TimelineMatcher,
  nowSeconds: number
): NpcAnimationAction | undefined {
  if (!emote) {
    return undefined;
  }
  const expression = emote.emote_type;
  if (
    !isHarthmereCinematicExpression(expression) ||
    nowSeconds >= emote.emote_expiry_time
  ) {
    return undefined;
  }
  return {
    weights: npcSystem.singleAnimationWeight(expression, 1),
    state: {
      repeat: harthmereCinematicExpressionRepeat(expression),
      startTime: timelineMatcher.match(
        `expression:${expression}`,
        emote.emote_start_time,
        nowSeconds
      ),
      easeInTime: 0.08,
    },
    layers: { all: "apply" },
  };
}

export class NpcRenderState {
  private consecutiveFrameState: ConsecutiveFrameState | undefined;
  private interpolationNeedRetarget = true;
  private position: Vec3 | undefined;
  private orientation: Vec2 | undefined;
  private entity: RenderNpcEntity | undefined;
  private readonly harthmereNavigationState: HarthmereNpcNavigationState =
    createHarthmereNpcNavigationState();
  private onHitParticleEffect: ParticleSystem | undefined;
  private soundChannels: {
    [K in NpcChannels]?: THREE.PositionalAudio;
  } = {};
  private wasIdle = true;
  private harthmereCreatureAttackCount = 0;
  private harthmereCreatureIdleSequence = 0;
  private nextHarthmereCreatureIdleSoundAtMs: number | undefined;
  private lastHarthmereCreatureAttackAtMs: number | undefined;
  private lastHarthmereCreatureAttackEventKey: number | undefined;
  private readonly cutsceneHeldItemNode = new THREE.Group();
  private readonly cutsceneHeldItemAttachment: ItemAttachment;
  private lastHarthmereProjectileAttackTime: number | undefined;
  private lastHarthmereMagicChargeAttackTime: number | undefined;
  private lastHarthmereMagicChargeReleaseTime: number | undefined;
  private readonly harthmereBossStompState = createHarthmereBossStompState();
  private lastCinematicExpressionKey: string | undefined;
  private nextHarthmereAnimationAuditAtMs = 0;
  private hasHarthmereAnimationAuditState = false;
  private lastHarthmereAnimationAuditAttackTime: number | undefined;
  private lastHarthmereAnimationAuditMotionMode: string | undefined;
  private lastHarthmereAnimationAuditNavigationResolution: string | undefined;
  private lastHarthmereAnimationAuditNavigationBlocked = false;
  private lastHarthmereAnimationAuditNavigationStuck = false;
  private lastHarthmereAnimationAuditSpeedBucket: number | undefined;
  private activeHarthmereBossSpecialAttack:
    | {
        attackTime: number;
        clipName: string;
        action: THREE.AnimationAction;
      }
    | undefined;

  private syncHarthmereBossSpecialAttack(input: {
    attackTime: number | undefined;
    clipName: string | undefined;
    secondsSinceEpoch: number;
  }) {
    const { attackTime, clipName, secondsSinceEpoch } = input;
    const current = this.activeHarthmereBossSpecialAttack;
    if (attackTime === undefined || !clipName) {
      current?.action.stop();
      this.activeHarthmereBossSpecialAttack = undefined;
      return false;
    }

    let active = current;
    if (
      !active ||
      active.attackTime !== attackTime ||
      active.clipName !== clipName
    ) {
      active?.action.stop();
      const clip = this.mixedMesh.harthmereAnimationClips.get(clipName);
      if (!clip) {
        this.activeHarthmereBossSpecialAttack = undefined;
        return false;
      }
      const action = this.mixedMesh.animationMixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.time = THREE.MathUtils.clamp(
        secondsSinceEpoch - attackTime,
        0,
        clip.duration
      );
      action.play();
      active = {
        attackTime,
        clipName,
        action,
      };
      this.activeHarthmereBossSpecialAttack = active;
    }

    // The shared animation system remains the fallback, but while the bespoke
    // boss clip is active it must not blend locomotion or a generic attack over
    // the authored motion. These actions are restored by the normal accumulator
    // on the next frame as soon as the one-shot finishes.
    for (const layerActions of Object.values(
      this.mixedMesh.animationSystemState.actions
    ) as Array<Record<string, THREE.AnimationAction | undefined>>) {
      for (const action of Object.values(layerActions)) {
        if (!action) continue;
        action.weight = 0;
        action.enabled = false;
      }
    }
    active.action.enabled = true;
    active.action.setEffectiveWeight(1);
    return true;
  }

  private syncCinematicFacialExpression(
    expression: HarthmereCinematicExpression | undefined,
    eventKey: string,
    source: "script" | "dialogue" = "script"
  ) {
    const entityId = this.entity?.id;
    if (entityId === undefined) {
      return;
    }
    const nextKey = expression ? `${eventKey}:${expression}` : undefined;
    if (nextKey === this.lastCinematicExpressionKey) {
      return;
    }
    this.lastCinematicExpressionKey = nextKey;
    if (!expression) {
      dispatchHarthmereFacialExpressionEvent({
        actorId: String(entityId),
        expression: "neutral",
        source,
        reason: "npc-expression-ended",
      });
      return;
    }
    const spec = harthmereCinematicExpressionSpec(expression);
    dispatchHarthmereFacialExpressionEvent({
      actorId: String(entityId),
      expression: spec.face,
      source,
      reason: `${source}-npc-expression:${expression}`,
      durationMs:
        spec.playback === "once"
          ? harthmereCinematicExpressionDurationMs(expression)
          : undefined,
    });
  }

  constructor(
    public mixedMesh: MixedNpcMesh,
    private readonly commonResources: NpcCommonEffects,
    private readonly effectResources: NpcEffects,
    private audioManager: AudioManager
  ) {
    this.cutsceneHeldItemNode.name = "cutscene-native-npc-held-item";
    playerMeshWeaponAttachmentParent(this.mixedMesh.three).add(
      this.cutsceneHeldItemNode
    );
    this.cutsceneHeldItemAttachment = new ItemAttachment(
      this.cutsceneHeldItemNode
    );
  }

  smoothedPosition(): ReadonlyVec3 {
    return this.consecutiveFrameState
      ? this.consecutiveFrameState.position.get()
      : this.entity
        ? this.entity.position.v
        : [0, 0, 0]; // This shouldn't actually be possible.
  }

  private tickConsecutiveFrameState(
    dt: number,
    entity: RenderNpcEntity,
    frameNumber: number,
    tweaks: Tweaks,
    resources: ClientResources,
    position: ReadonlyVec3,
    orientation: ReadonlyVec2
  ) {
    const targetSpatialLighting = resources.get(
      "/scene/npc/spatial_lighting",
      entity.id
    );
    if (
      this.consecutiveFrameState === undefined ||
      frameNumber > this.consecutiveFrameState.lastRenderFrame + 1
    ) {
      // The NPC wasn't rendered in the previous frame, so reset our
      // interpolation state because we don't know how far the NPC has moved
      // since it was last rendered and we don't want giant lerps.
      this.consecutiveFrameState = {
        lastRenderFrame: frameNumber,
        position: makeBezierVec3LatencyTransition(position, tweaks),
        orientation: makeBezierAngleLatencyTransition(orientation[1], tweaks),
        spatialLighting: fixedConstantVec3Transition(
          [...targetSpatialLighting, 0.0],
          0.1
        ),
      };
    } else {
      this.consecutiveFrameState.lastRenderFrame = frameNumber;
      if (this.interpolationNeedRetarget) {
        this.consecutiveFrameState.position.target(position);
        this.consecutiveFrameState.orientation.target(orientation[1]);
      }
      // Spatial Lighting may change without a position change, so update
      // every frame
      this.consecutiveFrameState.spatialLighting.target([
        ...targetSpatialLighting,
        0.0,
      ]);

      this.consecutiveFrameState.position.tick(dt);
      this.consecutiveFrameState.orientation.tick(dt);
      this.consecutiveFrameState.spatialLighting.tick(dt);
    }

    this.interpolationNeedRetarget = false;

    return this.consecutiveFrameState;
  }

  tick(
    entity: RenderNpcEntity,
    dt: number,
    frameNumber: number,
    secondsSinceEpoch: number,
    sunDirection: Vec3,
    tweaks: Tweaks,
    resources: ClientResources,
    renderablePuppetOverride?: CutscenePuppetOverride | null
  ) {
    // Turn the NPC to face the player when the player is talking to the NPC.
    // Must do this on the client and not modify the entity on the server so
    // that only this player sees the NPC turn and nobody else.
    const becomeNPC = resources.get("/scene/npc/become_npc");
    const cutsceneOverride =
      renderablePuppetOverride === undefined
        ? readRenderablePuppetOverrides().find(
            (override) => override.id === Number(entity.id)
          )
        : (renderablePuppetOverride ?? undefined);
    const cutsceneMotionOverrides = cutsceneOverride?.at
      ? {
          position: [...cutsceneOverride.at] as Vec3,
          velocity: [0, 0, 0] as Vec3,
          orientation: [0, cutsceneOverride.yaw] as Vec2,
        }
      : undefined;
    const becomeNpcMotionOverrides =
      becomeNPC.kind === "active" && becomeNPC.entityId === entity.id
        ? becomeNPC
        : undefined;
    const motionOverrides = cutsceneMotionOverrides ?? becomeNpcMotionOverrides;
    const localPlayer = resources.get("/scene/local_player");
    const nativeEcsAuthority = nativeBiomesEcsAuthorityEnabled();
    const npcPosition = entity.position?.v;
    const npcTypeId = entity.npc_metadata.type_id;
    const npcType = harthmereRenderableNpcType(npcTypeId);
    if (!npcType) {
      log.throttledError(
        10_000,
        `Skipping render tick for NPC ${entity.id} with invalid type_id (${npcTypeId})`
      );
      return;
    }

    const rawPosition = motionOverrides?.position ?? entity.position.v;
    const snapshotGroundedLiveNpc =
      !nativeEcsAuthority &&
      !motionOverrides &&
      snapshotIsLiveFloatingGroveNpcCandidate({
        id: entity.id,
        label: entity.label?.text,
        position: rawPosition,
        entityDescription: (entity as any).entity_description?.text,
      });
    // In native mode the ECS Position is also the collision/hit-test position.
    // Render-only grounding, route motion, or chase interpolation creates a
    // visible body in one place and an authoritative hitbox in another.
    let position = nativeEcsAuthority
      ? rawPosition
      : (motionOverrides?.position ??
        snapshotGroundLiveNpcPosition(rawPosition, entity.label?.text));
    if (snapshotGroundedLiveNpc) {
      this.mixedMesh.three.userData.snapshotLiveGrounding = {
        version: SNAPSHOT_LIVE_NPC_GROUNDING_VERSION,
        entityId: entity.id,
        label: entity.label?.text,
        rawPosition: [...rawPosition],
        groundedPosition: [...position],
        reason: "live_snapshot_original_npc_visual_grounding",
      };
    } else if (this.mixedMesh.three.userData.snapshotLiveGrounding) {
      delete this.mixedMesh.three.userData.snapshotLiveGrounding;
    }
    let orientation =
      motionOverrides?.orientation ??
      (localPlayer.talkingToNpc === entity.id && npcPosition
        ? (() => {
            const towardsLocalPlayer = pitchAndYaw(
              sub(localPlayer.player.position, npcPosition)
            );
            // Clone because we don't want this modification to be on the NPC permanently.
            return towardsLocalPlayer;
          })()
        : entity.orientation.v);

    const harthmereVoxelNpcMotion =
      !nativeEcsAuthority && !motionOverrides && entity.health.hp > 0
        ? getHarthmereVoxelNpcMotionOverride(
            entity,
            position,
            orientation,
            secondsSinceEpoch,
            localPlayer.player?.position
          )
        : undefined;
    if (harthmereVoxelNpcMotion) {
      position = harthmereVoxelNpcMotion.position;
      orientation = harthmereVoxelNpcMotion.orientation;
    }
    const harthmereNavigationResult =
      !nativeEcsAuthority && !motionOverrides && entity.health.hp > 0
        ? resolveHarthmereNpcNavigationStep({
            label: entity.label?.text,
            mode: harthmereNavigationModeForMotion(harthmereVoxelNpcMotion),
            currentPosition:
              this.harthmereNavigationState.lastOutputPosition ??
              this.position ??
              rawPosition,
            desiredPosition: position,
            state: this.harthmereNavigationState,
            obstacles: nearbyHarthmereNavigationObstacles(position),
            groundYAt: (x, z, preferredY) =>
              sampleHarthmereNpcGroundFeetY(
                resources,
                frameNumber,
                x,
                z,
                preferredY,
                // Outdoor entities (muckers, wild NPCs) avoid caves via open-sky;
                // business owners AND customers stand on a roofed building floor,
                // so they opt out (open-sky would push them onto the roof).
                !isHarthmereBusinessOwnerNpcEntityId(entity.id) &&
                  !isHarthmereBusinessCustomerNpcEntityId(entity.id)
              ),
          })
        : undefined;
    if (harthmereNavigationResult) {
      position = harthmereNavigationResult.position;
      this.mixedMesh.three.userData.harthmereNpcNavigationGuard =
        harthmereNavigationResult;
    } else if (this.mixedMesh.three.userData.harthmereNpcNavigationGuard) {
      delete this.mixedMesh.three.userData.harthmereNpcNavigationGuard;
    }
    if (!nativeEcsAuthority) {
      publishHarthmereVoxelNpcMotionActorPosition(
        entity,
        position,
        orientation,
        harthmereVoxelNpcMotion
      );
    }

    if (
      !_.isEqual(this.position, position) ||
      !_.isEqual(this.orientation, orientation)
    ) {
      this.position = [...position];
      this.orientation = [...orientation];
      this.interpolationNeedRetarget = true;
    }

    this.entity = entity;

    const harthmereIsDead = this.entity.health.hp <= 0;
    const harthmereMotionForAnimation =
      harthmereNavigationResult?.animationMoving === false
        ? undefined
        : harthmereVoxelNpcMotion;
    const harthmereRenderMotionAnimationVelocity = !harthmereIsDead
      ? getHarthmereVoxelNpcRenderMotionAnimationVelocity(
          orientation,
          harthmereMotionForAnimation
        )
      : undefined;
    const velocity =
      motionOverrides?.velocity ??
      harthmereRenderMotionAnimationVelocity ??
      this.entity.rigid_body.velocity;
    this.mixedMesh.three.userData.harthmereVoxelNpcRenderMotionAnimation =
      harthmereRenderMotionAnimationVelocity
        ? {
            version: HARTHMERE_VOXEL_NPC_RENDER_MOTION_ANIMATION,
            mode: harthmereVoxelNpcMotion?.mode,
            velocity: [...harthmereRenderMotionAnimationVelocity],
          }
        : undefined;

    const harthmereStoppedDeathVelocity =
      getHarthmereStoppedNpcAnimationVelocity();
    const harthmereDeathAwareRawVelocity = harthmereIsDead
      ? harthmereStoppedDeathVelocity
      : velocity;
    const harthmereStableNpcAnimationVelocity =
      getHarthmereLiveNpcAnimationVelocity(velocity);
    const harthmereDeathAwareNpcAnimationVelocity =
      getHarthmereStableNpcAnimationVelocity(harthmereDeathAwareRawVelocity);
    void harthmereStableNpcAnimationVelocity;

    // Called each frame before the NPC is rendered. Only called for visible
    // NPCs.
    const consecutiveFrameState = this.tickConsecutiveFrameState(
      dt,
      this.entity,
      frameNumber,
      tweaks,
      resources,
      position,
      orientation
    );

    // Handle position updates.
    if (
      harthmereIsDead &&
      !this.mixedMesh.three.userData.harthmereDeathWorldPosition
    ) {
      this.mixedMesh.three.userData.harthmereDeathWorldPosition = [
        Number(position[0]),
        Number(position[1]),
        Number(position[2]),
      ];
    }
    if (
      harthmereIsDead &&
      !Number.isFinite(
        this.mixedMesh.three.userData.harthmereDeathAnimationEventTime
      )
    ) {
      this.mixedMesh.three.userData.harthmereDeathAnimationEventTime =
        this.entity.health.lastDamageTime ?? secondsSinceEpoch;
    }
    if (
      !harthmereIsDead &&
      this.mixedMesh.three.userData.harthmereDeathWorldPosition
    ) {
      delete this.mixedMesh.three.userData.harthmereDeathWorldPosition;
      delete this.mixedMesh.three.userData.harthmereDeathAnimationEventTime;
    }
    const pos =
      harthmereIsDead &&
      Array.isArray(this.mixedMesh.three.userData.harthmereDeathWorldPosition)
        ? this.mixedMesh.three.userData.harthmereDeathWorldPosition
        : (motionOverrides?.position ??
          (nativeEcsAuthority &&
          harthmereNpcAttackUsesAuthoritativeTransform(
            this.entity.emote,
            secondsSinceEpoch
          )
            ? position
            : consecutiveFrameState.position.get()));
    this.mixedMesh.three.position.fromArray(pos);

    // Some older NPC biscuits omit boxSize. Use the centralized fallback so
    // render scale stays stable instead of crashing strict-null builds.
    const baseNpcBoxSize = getNpcBoxSize(npcType);
    const harthmereBossUsesUniformScale =
      this.mixedMesh.three.userData.harthmereBossUsesUniformScale === true;
    const harthmereUniformBossScale = this.entity.size.v[1] / baseNpcBoxSize[1];
    const harthmereBaseScale = harthmereBossUsesUniformScale
      ? ([
          harthmereUniformBossScale,
          harthmereUniformBossScale,
          harthmereUniformBossScale,
        ] as const)
      : ([
          this.entity.size.v[0] / baseNpcBoxSize[0],
          this.entity.size.v[1] / baseNpcBoxSize[1],
          this.entity.size.v[2] / baseNpcBoxSize[2],
        ] as const);
    this.mixedMesh.three.scale.set(
      harthmereBaseScale[0],
      harthmereBaseScale[1],
      harthmereBaseScale[2]
    );
    this.mixedMesh.three.userData.harthmereBaseScaleBeforeHit = [
      harthmereBaseScale[0],
      harthmereBaseScale[1],
      harthmereBaseScale[2],
    ];

    this.mixedMesh.three.rotation.y =
      motionOverrides?.orientation[1] ??
      (nativeEcsAuthority &&
      harthmereNpcAttackUsesAuthoritativeTransform(
        this.entity.emote,
        secondsSinceEpoch
      )
        ? orientation[1]
        : consecutiveFrameState.orientation.get());

    // Lighting
    const spatialLighting = consecutiveFrameState.spatialLighting
      .get()
      .slice(0, 2) as Vec2;
    this.cutsceneHeldItemAttachment.updateAttachedItem(
      resources,
      cutsceneOverride?.itemId
        ? anItem(cutsceneOverride.itemId as BiomesId)
        : undefined,
      spatialLighting,
      sunDirection
    );

    // If the NPC was hit recently, we want them to flash red.
    const timeSinceLastHit =
      this.mixedMesh.timelineMatcher.animationNow() -
      this.lastDamageAnimationTime(secondsSinceEpoch);
    const RED_FLASH_SECONDS = 0.2;
    let redFlashProgress = Math.min(
      1,
      Math.max(0, timeSinceLastHit / RED_FLASH_SECONDS)
    );

    if (
      becomeNPC.kind === "active" &&
      becomeNPC.entityId === entity.id &&
      Boolean(becomeNPC.cannotPlaceReason)
    ) {
      redFlashProgress = 0;
    }

    // Lighting changes slowly, while hit flashes need immediate feedback.
    // Cache materials at mesh creation and spread ambient updates across four
    // frames instead of traversing every NPC hierarchy every rendered frame.
    const updateSkinMaterials =
      redFlashProgress < 1 || (frameNumber + Number(this.entity.id)) % 4 === 0;
    if (updateSkinMaterials) {
      for (const material of this.mixedMesh.basePassMaterials) {
        updatePlayerSkinnedMaterial(material, {
          light: sunDirection,
          spatialLighting,
          baseColor: [1, redFlashProgress, redFlashProgress],
          emissiveAdd: 0.1 * Math.max(0, 1 - 2 * redFlashProgress),
        });
      }
    }

    const animAccum = npcSystem.newAccumulatedActions(
      this.mixedMesh.animationMixer.time,
      npcSystem.durationFromState(this.mixedMesh.animationSystemState)
    );

    const emote = resources.get("/ecs/c/emote", this.entity.id);
    const movementState = resources.get(
      "/ecs/c/movement_state",
      this.entity.id
    );
    const activeEvade = movementActionIsActive(
      movementState,
      secondsSinceEpoch
    );
    const cutsceneExpression = isHarthmereCinematicExpression(
      cutsceneOverride?.animation
    )
      ? cutsceneOverride.animation
      : undefined;
    const dialogueExpressionCue =
      !harthmereIsDead && !cutsceneExpression
        ? readHarthmereNpcDialogueExpression(Number(this.entity.id))
        : undefined;
    const dialogueExpression = dialogueExpressionCue?.expression;
    const gameplayExpression =
      !harthmereIsDead &&
      !cutsceneExpression &&
      !dialogueExpression &&
      emote &&
      secondsSinceEpoch < emote.emote_expiry_time &&
      isHarthmereCinematicExpression(emote.emote_type)
        ? emote.emote_type
        : undefined;
    const cinematicExpression =
      cutsceneExpression ?? dialogueExpression ?? gameplayExpression;
    const cinematicExpressionTime = cutsceneExpression
      ? Math.max(0, cutsceneOverride?.animationTime ?? 0)
      : dialogueExpressionCue
        ? Math.max(0, (Date.now() - dialogueExpressionCue.startedAtMs) / 1000)
        : gameplayExpression
          ? Math.max(0, secondsSinceEpoch - (emote?.emote_start_time ?? 0))
          : 0;
    this.syncCinematicFacialExpression(
      cinematicExpression,
      cutsceneExpression
        ? `cutscene:${cutsceneOverride?.animation ?? cutsceneExpression}`
        : dialogueExpression
          ? `dialogue:${dialogueExpressionCue?.nonce ?? dialogueExpression}`
          : gameplayExpression
            ? `gameplay:${emote?.emote_start_time ?? 0}`
            : "none",
      dialogueExpression ? "dialogue" : "script"
    );

    const harthmereVoxelRetaliationAttackTime =
      getHarthmereVoxelNpcRetaliationAttackTime(
        this.entity.id,
        secondsSinceEpoch
      );
    const nativeCombatProfile = harthmereNativeNpcCombatProfileForEntity({
      entityId: entity.id,
      typeId: entity.npc_metadata.type_id,
      displayName: entity.label?.text,
      maxHp: entity.health.maxHp,
    });
    // The renderer intentionally scans NpcMetadataSelector so legacy NPCs that
    // are missing optional combat components still render. Anima's full
    // npc_state is server-only, so real clients receive only the sanitized
    // ranged-cast projection on the public npc_combat_state component.
    const publicCombatState = resources.get(
      "/ecs/c/npc_combat_state",
      this.entity.id
    );
    const publicRangedAttack:
      | {
          abilityId: string;
          projectileVisualId: string;
          castTime: number;
          chargeTimeSecs?: number;
          releaseTime?: number;
          aimPoint: [number, number, number];
          result?: "hit" | "miss";
        }
      | undefined =
      publicCombatState?.ranged_attack_ability_id !== undefined &&
      publicCombatState.ranged_attack_projectile_visual_id !== undefined &&
      publicCombatState.ranged_attack_cast_time !== undefined &&
      publicCombatState.ranged_attack_aim_point !== undefined
        ? {
            abilityId: publicCombatState.ranged_attack_ability_id,
            projectileVisualId:
              publicCombatState.ranged_attack_projectile_visual_id,
            castTime: publicCombatState.ranged_attack_cast_time,
            chargeTimeSecs: publicCombatState.ranged_attack_charge_time_secs,
            releaseTime: publicCombatState.ranged_attack_release_time,
            aimPoint: [...publicCombatState.ranged_attack_aim_point] as [
              number,
              number,
              number,
            ],
            result:
              publicCombatState.ranged_attack_result === "hit" ||
              publicCombatState.ranged_attack_result === "miss"
                ? publicCombatState.ranged_attack_result
                : undefined,
          }
        : undefined;
    const synchronizedNpcState = resources.get(
      "/ecs/c/npc_state",
      this.entity.id
    );
    const nativeRangedAttack = nativeCombatProfile?.rangedAttacks?.length
      ? (publicRangedAttack ??
        deserializeNpcCustomState(
          synchronizedNpcState?.data ??
            (entity as ReadonlyEntity).npc_state?.data
        ).chaseAttack?.rangedAttack)
      : undefined;
    const rangedReleaseTime = nativeRangedAttack
      ? (nativeRangedAttack.releaseTime ??
        nativeRangedAttack.castTime +
          Number(nativeRangedAttack.chargeTimeSecs ?? 0))
      : undefined;
    const presentationAttackTime = harthmereNativeNpcProjectileAttackTime({
      isDead: harthmereIsDead,
      activeEvade,
      emoteAttackTime:
        emote?.emote_type === "attack1" ? emote.emote_start_time : undefined,
      retaliationAttackTime: harthmereVoxelRetaliationAttackTime,
      // Anima owns ranged casts in npc_state. They do not need a separate
      // retaliation contact event or generic attack emote to become visible.
      rangedReleaseTime,
      rangedCastTime:
        rangedReleaseTime === undefined
          ? nativeRangedAttack?.castTime
          : undefined,
    });
    const projectilePresentation = harthmereNativeNpcProjectilePresentation({
      profile: nativeCombatProfile,
      attackTime: presentationAttackTime,
      rangedState: nativeRangedAttack,
    });
    const magicChargeTimeSecs = projectilePresentation?.chargeTimeSecs ?? 0;
    const chargingMagic = Boolean(
      projectilePresentation?.magic &&
      magicChargeTimeSecs > 0 &&
      projectilePresentation.releaseTime !== undefined &&
      secondsSinceEpoch < projectilePresentation.releaseTime
    );
    const attackTime = chargingMagic ? undefined : presentationAttackTime;
    const projectileVisualId = projectilePresentation?.projectileVisualId;
    const targetId =
      publicCombatState?.attack_target ??
      (entity as ReadonlyEntity).npc_combat_state?.attack_target;
    const targetGroundPosition =
      (targetId ? resources.get("/ecs/c/position", targetId)?.v : undefined) ??
      localPlayer.player.position;
    const targetPosition = projectilePresentation?.aimPoint
      ? projectilePresentation.aimPoint
      : targetGroundPosition;
    const bossMagicPresentation = projectilePresentation?.magic
      ? harthmereBossMagicPresentation({
          position: entity.position.v,
          size: entity.size.v,
          // A self-AOE's authoritative aim point is the caster. Use the
          // selected player position for presentation so a giant boss still
          // gathers magic on the side the player can see.
          targetPoint: targetGroundPosition,
        })
      : undefined;
    const defaultProjectileOrigin = [
      entity.position.v[0],
      entity.position.v[1] + entity.size.v[1] * 0.58,
      entity.position.v[2],
    ] as [number, number, number];
    const magicPresentationOrigin =
      bossMagicPresentation?.origin ??
      harthmereNpcProjectileOrigin(
        this.mixedMesh.three,
        defaultProjectileOrigin
      );
    const magicChargeId =
      projectilePresentation?.magic && nativeRangedAttack
        ? harthmereMagicChargeId({
            casterKind: "npc",
            casterEntityId: Number(entity.id),
            abilityId: projectilePresentation.abilityId,
            castTime: nativeRangedAttack.castTime,
          })
        : undefined;
    if (
      nativeEcsAuthority &&
      chargingMagic &&
      nativeRangedAttack &&
      magicChargeId &&
      nativeRangedAttack.castTime !== this.lastHarthmereMagicChargeAttackTime
    ) {
      this.lastHarthmereMagicChargeAttackTime = nativeRangedAttack.castTime;
      dispatchHarthmereMagicCharge({
        phase: "start",
        chargeId: magicChargeId,
        abilityId: projectilePresentation?.abilityId,
        projectileVisualId,
        casterKind: "npc",
        casterEntityId: Number(entity.id),
        chargeStartedAt: nativeRangedAttack.castTime,
        chargeTimeSecs: magicChargeTimeSecs,
        releaseTime: projectilePresentation?.releaseTime,
        origin: magicPresentationOrigin,
        targetPoint: targetPosition,
        power: Math.max(
          0,
          Math.min(
            1,
            (magicChargeTimeSecs - HARTHMERE_MAGIC_CHARGE_MIN_SECS) /
              (HARTHMERE_MAGIC_CHARGE_MAX_SECS -
                HARTHMERE_MAGIC_CHARGE_MIN_SECS)
          )
        ),
        visualScale: bossMagicPresentation?.chargeVisualScale ?? 1,
        source: "anima_native_magic_charge",
      });
    }
    if (
      nativeEcsAuthority &&
      projectilePresentation?.magic &&
      projectilePresentation.releaseTime !== undefined &&
      secondsSinceEpoch >= projectilePresentation.releaseTime &&
      magicChargeId &&
      projectilePresentation.releaseTime !==
        this.lastHarthmereMagicChargeReleaseTime
    ) {
      this.lastHarthmereMagicChargeReleaseTime =
        projectilePresentation.releaseTime;
      dispatchHarthmereMagicCharge({
        phase: "release",
        chargeId: magicChargeId,
        abilityId: projectilePresentation.abilityId,
        projectileVisualId,
        casterKind: "npc",
        casterEntityId: Number(entity.id),
        chargeStartedAt: nativeRangedAttack?.castTime,
        chargeTimeSecs: projectilePresentation.chargeTimeSecs,
        releaseTime: projectilePresentation.releaseTime,
        origin: magicPresentationOrigin,
        targetPoint: targetPosition,
        source: "anima_native_magic_release",
      });
    }
    if (
      nativeEcsAuthority &&
      attackTime !== undefined &&
      attackTime !== this.lastHarthmereProjectileAttackTime &&
      projectileVisualId &&
      typeof window !== "undefined"
    ) {
      if (targetPosition) {
        this.lastHarthmereProjectileAttackTime = attackTime;
        window.dispatchEvent(
          new CustomEvent(HARTHMERE_PROJECTILE_VISUAL_EVENT, {
            detail: {
              source: "anima_native_attack_emote",
              projectileVisualId,
              abilityId: projectilePresentation?.abilityId,
              abilityName: projectilePresentation?.displayName,
              attackShape: projectilePresentation?.attackShape,
              damageType: projectilePresentation?.damageType,
              attackDistance: projectilePresentation?.attackDistance,
              hitRadius: projectilePresentation?.hitRadius,
              coneAngleDeg: projectilePresentation?.coneAngleDeg,
              windupSecs: projectilePresentation?.windupSecs,
              authoritativeImpactSecs:
                projectilePresentation?.releaseTime !== undefined &&
                projectilePresentation.windupSecs !== undefined
                  ? harthmereAuthoritativeImpactRemainingSecs({
                      releaseTime: projectilePresentation.releaseTime,
                      impactDelaySecs: projectilePresentation.windupSecs,
                      now: secondsSinceEpoch,
                    })
                  : undefined,
              result: projectilePresentation?.result,
              attacker:
                entity.label?.text ??
                nativeCombatProfile?.displayName ??
                "Harthmere NPC",
              target: targetId ? String(targetId) : "Player",
              nativeNpcEntityId: Number(entity.id),
              nativeNpcTypeId: Number(entity.npc_metadata.type_id),
              attackTime,
              origin: magicPresentationOrigin,
              visualScale: bossMagicPresentation?.projectileVisualScale ?? 1,
              originGroundPoint: [...entity.position.v],
              targetPoint: [
                targetPosition[0],
                targetPosition[1] +
                  (projectilePresentation?.aimPoint ? 0 : 1.05),
                targetPosition[2],
              ],
              targetGroundPoint: [...targetGroundPosition],
            },
          })
        );
      }
    }

    this.mixedMesh.animationSystem.accumulateAction(
      cutsceneNpcAnimationAction(
        cutsceneOverride?.animation
          ? cutsceneOverride
          : dialogueExpressionCue
            ? {
                animation: dialogueExpressionCue.expression,
                animationTime: Math.max(
                  0,
                  (Date.now() - dialogueExpressionCue.startedAtMs) / 1000
                ),
              }
            : undefined,
        this.mixedMesh.animationMixer.time
      ),
      animAccum
    );
    this.mixedMesh.animationSystem.accumulateAction(
      harthmereIsDead || cutsceneOverride || dialogueExpressionCue
        ? undefined
        : gameplayNpcExpressionAnimationAction(
            emote,
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch
          ),
      animAccum
    );
    this.mixedMesh.animationSystem.accumulateAction(
      harthmereIsDead
        ? undefined
        : getNpcEvadeAnimationAction(
            movementState,
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch,
            this.entity.label?.text,
            npcType.name,
            npcType.displayName,
            getMovementTypeByNpcType(npcType)
          ),
      animAccum
    );
    this.mixedMesh.animationSystem.accumulateAction(
      harthmereIsDead || cutsceneOverride || !chargingMagic
        ? undefined
        : getMagicChargeAnimationAction(
            projectilePresentation?.chargeStartedAt,
            projectilePresentation?.releaseTime,
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch
          ),
      animAccum
    );
    this.mixedMesh.animationSystem.accumulateAction(
      harthmereIsDead
        ? getOneShotNpcAnimationAction(
            "bossDeath",
            "bossDeath",
            Number(
              this.mixedMesh.three.userData.harthmereDeathAnimationEventTime
            ),
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch
          )
        : getAttackAnimationAction(
            attackTime,
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch,
            this.entity.label?.text,
            this.entity.id,
            projectilePresentation?.animationClip
          ),
      animAccum
    );
    const lastDamageEventTime = this.entity.health.lastDamageTime;
    const shouldPlayHitReact =
      !harthmereIsDead &&
      !activeEvade &&
      attackTime === undefined &&
      lastDamageEventTime !== undefined &&
      this.mixedMesh.timelineMatcher.animationNow() -
        this.lastDamageAnimationTime(secondsSinceEpoch) <=
        ON_HIT_ANIMATION_DURATION_SECS;
    this.mixedMesh.animationSystem.accumulateAction(
      shouldPlayHitReact
        ? getOneShotNpcAnimationAction(
            "creatureHit",
            "bossHitReact",
            lastDamageEventTime,
            this.mixedMesh.timelineMatcher,
            secondsSinceEpoch
          )
        : undefined,
      animAccum
    );
    this.mixedMesh.animationSystem.accumulateAction(
      harthmereIsDead
        ? undefined
        : getVelocityBasedWeights({
            velocity: harthmereDeathAwareNpcAnimationVelocity,
            orientation: orientation,
            runSpeed: getRunSpeedByNpcType(npcType),
            movementType: getMovementTypeByNpcType(npcType),
            characterSystem: npcSystem,
            idleSpeed: HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED,
          }),
      animAccum
    );
    const npcAnimationBlendDt = Math.min(
      Math.max(dt, 0),
      HARTHMERE_NPC_BODY_MAX_BLEND_DT
    );
    this.mixedMesh.animationSystem.applyAccumulatedActionsToState(
      animAccum,
      this.mixedMesh.animationSystemState,
      npcAnimationBlendDt
    );
    this.syncHarthmereBossSpecialAttack({
      attackTime: harthmereIsDead || cutsceneOverride ? undefined : attackTime,
      clipName: projectilePresentation?.specialAnimationClip,
      secondsSinceEpoch,
    });
    // These window bridges exist for diagnostics and browser E2E; gameplay
    // never reads them during the render tick. Previously every visible NPC
    // cloned the full audit map every frame. Refresh at 2 Hz and immediately
    // on meaningful animation/navigation state changes instead.
    const animationAuditMotionMode =
      harthmereMotionForAnimation?.mode ?? "static";
    const animationAuditNavigationResolution =
      harthmereNavigationResult?.resolution ?? "none";
    const animationAuditNavigationBlocked =
      harthmereNavigationResult?.blocked ?? false;
    const animationAuditNavigationStuck =
      harthmereNavigationResult?.stuck ?? false;
    const animationAuditSpeedBucket = Math.round(
      Math.hypot(
        harthmereDeathAwareNpcAnimationVelocity[0] ?? 0,
        harthmereDeathAwareNpcAnimationVelocity[2] ?? 0
      ) * 10
    );
    const animationAuditNowMs = secondsSinceEpoch * 1000;
    const animationAuditStateChanged =
      !this.hasHarthmereAnimationAuditState ||
      attackTime !== this.lastHarthmereAnimationAuditAttackTime ||
      animationAuditMotionMode !== this.lastHarthmereAnimationAuditMotionMode ||
      animationAuditNavigationResolution !==
        this.lastHarthmereAnimationAuditNavigationResolution ||
      animationAuditNavigationBlocked !==
        this.lastHarthmereAnimationAuditNavigationBlocked ||
      animationAuditNavigationStuck !==
        this.lastHarthmereAnimationAuditNavigationStuck ||
      animationAuditSpeedBucket !== this.lastHarthmereAnimationAuditSpeedBucket;
    if (
      animationAuditStateChanged ||
      animationAuditNowMs >= this.nextHarthmereAnimationAuditAtMs
    ) {
      this.hasHarthmereAnimationAuditState = true;
      this.lastHarthmereAnimationAuditAttackTime = attackTime;
      this.lastHarthmereAnimationAuditMotionMode = animationAuditMotionMode;
      this.lastHarthmereAnimationAuditNavigationResolution =
        animationAuditNavigationResolution;
      this.lastHarthmereAnimationAuditNavigationBlocked =
        animationAuditNavigationBlocked;
      this.lastHarthmereAnimationAuditNavigationStuck =
        animationAuditNavigationStuck;
      this.lastHarthmereAnimationAuditSpeedBucket = animationAuditSpeedBucket;
      this.nextHarthmereAnimationAuditAtMs = animationAuditNowMs + 500;
      recordHarthmereNpcAnimationExecutionCheck(
        this.mixedMesh.three,
        harthmereDeathAwareNpcAnimationVelocity,
        getRunSpeedByNpcType(npcType),
        this.mixedMesh.animationMixer.time,
        attackTime,
        secondsSinceEpoch
      );
      publishHarthmereVoxelNpcUniversalCombatAnimationAudit(
        this.entity,
        this.mixedMesh.three,
        position,
        orientation,
        harthmereDeathAwareNpcAnimationVelocity,
        attackTime,
        secondsSinceEpoch,
        harthmereMotionForAnimation,
        harthmereNavigationResult,
        animationAuditStateChanged
      );
    }

    const aabb = getAabbForEntity(this.entity, {
      motionOverrides,
    });
    ok(aabb);
    const centerPosition = centerAABB(aabb);
    if (harthmereIsDead) {
      this.mixedMesh.three.visible = true;
      this.mixedMesh.three.userData.harthmereDeathBounds = {
        version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION,
        visibleCorpsePose: true,
        stoppedLocomotion: true,
        attackCancelled: attackTime === undefined,
        corpseHoldMs: HARTHMERE_DEATH_CORPSE_HOLD_MS,
        corpseHoldScale: HARTHMERE_DEATH_CORPSE_HOLD_SCALE,
        deathWorldPosition:
          this.mixedMesh.three.userData.harthmereDeathWorldPosition,
        aabb,
        centerPosition,
        aboveGroundRequired: true,
        maxGroundGapMeters: HARTHMERE_DEATH_MAX_GROUND_GAP_METERS,
        maxSinkMeters: HARTHMERE_DEATH_MAX_SINK_METERS,
        notInsideSolidCollision: true,
        doesNotBlockCoreRoute: true,
      };
    }
    this.tickEffects(
      attackTime,
      secondsSinceEpoch,
      aabb,
      centerPosition,
      sunDirection
    );

    // Update threejs animations.
    this.mixedMesh.animationMixer.update(dt);
    if (npcType.isPlayerLikeAppearance && cinematicExpression) {
      applyHarthmereCinematicExpressionPose(
        this.mixedMesh.three,
        cinematicExpression,
        cinematicExpressionTime
      );
    } else {
      clearHarthmereCinematicExpressionPose(this.mixedMesh.three);
    }
    applyHarthmereBossDamagePose(
      this.entity,
      this.mixedMesh.three,
      secondsSinceEpoch,
      resources.get("/ecs/c/npc_state", this.entity.id)?.data
    );

    for (const child of this.mixedMesh.skinnedMeshes) {
      child.matrixWorldNeedsUpdate = true;
    }
  }

  private tickEffects(
    attackTime: number | undefined,
    secondsSinceEpoch: number,
    aabb: AABB,
    centerPosition: Vec3,
    sunDirection: Vec3
  ) {
    this.tickOnHitEffects(
      secondsSinceEpoch,
      aabb,
      centerPosition,
      sunDirection
    );
    this.tickOnAttackEffects(attackTime, secondsSinceEpoch, centerPosition);
    this.tickHarthmereBossFootsteps(secondsSinceEpoch, aabb, centerPosition);

    const isIdle =
      this.mixedMesh.animationSystemState.layerWeights.all.idle >
      (this.wasIdle ? 0.5 : 0.9);
    const creatureProfile = this.harthmereCreatureSoundProfile();
    if (creatureProfile) {
      const nowMs = secondsSinceEpoch * 1000;
      if (isIdle && this.entity && this.entity.health.hp > 0) {
        if (this.nextHarthmereCreatureIdleSoundAtMs === undefined) {
          this.nextHarthmereCreatureIdleSoundAtMs =
            nowMs +
            harthmereCreatureIdleDelayMs(
              creatureProfile,
              this.entity.id,
              this.harthmereCreatureIdleSequence++
            );
        } else if (nowMs >= this.nextHarthmereCreatureIdleSoundAtMs) {
          const sound = this.harthmereCreatureSound("idle");
          if (sound) this.playSound("npcVoice", sound, centerPosition);
          this.nextHarthmereCreatureIdleSoundAtMs =
            nowMs +
            harthmereCreatureIdleDelayMs(
              creatureProfile,
              this.entity.id,
              this.harthmereCreatureIdleSequence++
            );
        }
      } else {
        this.nextHarthmereCreatureIdleSoundAtMs = undefined;
      }
    } else if (isIdle && !this.wasIdle) {
      // Preserve the original one-shot behavior for NPCs outside Harthmere's
      // explicit creature catalog.
      const existing = this.effectResources.idleNpcSoundEffect;
      const fallback = this.harthmereFallbackSound("idle");
      const sound = existing?.length ? sample(existing) : fallback;
      if (sound) {
        this.playSound("npcVoice", sound, centerPosition);
      }
    }
    this.wasIdle = isIdle;

    for (const k in this.soundChannels) {
      const key = k as NpcChannels;
      const value = this.soundChannels[key];
      if (value) {
        if (!value.isPlaying) {
          this.soundChannels[key] = undefined;
        }
      }
    }
  }

  private tickHarthmereBossFootsteps(
    secondsSinceEpoch: number,
    aabb: AABB,
    centerPosition: Vec3
  ) {
    if (!this.entity) return;
    const weights = this.mixedMesh.animationSystemState.layerWeights.all;
    const moving = Math.max(weights.walk, weights.run) > 0.3;
    const profile = harthmereBossStompProfileForEntity(
      this.entity.label?.text,
      Number(this.entity.id)
    );
    if (!profile) return;
    if (
      !advanceHarthmereBossStomp(this.harthmereBossStompState, {
        profile,
        position: centerPosition,
        moving,
        alive: this.entity.health.hp > 0,
        nowSeconds: secondsSinceEpoch,
      })
    ) {
      return;
    }
    const sound = getHarthmereSoundEffect(HARTHMERE_GIANT_BOSS_STOMP_SOUND_ID);
    if (!sound) return;
    this.playSound(
      "npcVoice",
      sound.path as AudioPath,
      [centerPosition[0], aabb[0][1] + 0.15, centerPosition[2]],
      {
        volumeMultiplier: profile.soundVolumeMultiplier,
        refDistance: profile.soundRefDistance,
        maxDistance: profile.soundMaxDistance,
        rolloffFactor: profile.soundRolloffFactor,
      }
    );
  }

  private tickOnAttackEffects(
    attackTime: number | undefined,
    secondsSinceEpoch: number,
    centerPosition: Vec3
  ) {
    const attackEventKey = harthmereCreatureAttackEventKey(
      attackTime,
      secondsSinceEpoch
    );
    if (
      attackEventKey === undefined ||
      attackEventKey === this.lastHarthmereCreatureAttackEventKey
    ) {
      return;
    }
    this.lastHarthmereCreatureAttackEventKey = attackEventKey;

    const creatureProfile = this.harthmereCreatureSoundProfile();
    let sound: AudioPath | undefined;
    if (creatureProfile && this.entity) {
      const nowMs = secondsSinceEpoch * 1000;
      if (
        this.lastHarthmereCreatureAttackAtMs === undefined ||
        nowMs - this.lastHarthmereCreatureAttackAtMs > 10_000
      ) {
        this.harthmereCreatureAttackCount = 0;
      }
      this.lastHarthmereCreatureAttackAtMs = nowMs;
      this.harthmereCreatureAttackCount += 1;
      if (
        harthmereCreatureShouldPlayAttackSound(
          creatureProfile,
          this.entity.id,
          this.harthmereCreatureAttackCount
        )
      ) {
        sound = this.harthmereCreatureSound("attack");
      }
    } else {
      const bufferChoices = this.effectResources?.onAttackNpcSoundEffect;
      sound = bufferChoices?.length
        ? sample(bufferChoices)
        : this.harthmereFallbackSound("attack");
    }
    if (sound) {
      this.playSound("npcVoice", sound, centerPosition);
    }
  }

  private lastDamageAnimationTime(secondsSinceEpoch: number) {
    if (!this.entity?.health.lastDamageTime) {
      return -Infinity;
    }

    return this.mixedMesh.timelineMatcher.match(
      "onHit",
      this.entity.health.lastDamageTime,
      secondsSinceEpoch
    );
  }

  private applyHarthmereNpcCorpseOpacity(opacity: number) {
    const clamped = Math.max(0, Math.min(1, opacity));
    this.mixedMesh.three.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (material instanceof THREE.Material) {
          material.transparent = clamped < 1;
          material.opacity = clamped;
          material.needsUpdate = true;
        }
      }
    });
  }

  private tickOnHitEffects(
    secondsSinceEpoch: number,
    aabb: AABB,
    centerPosition: Vec3,
    sunDirection: Vec3
  ) {
    ok(this.entity);

    if (!this.entity.health.lastDamageTime) {
      return;
    }

    const lastDamageRenderTime =
      this.lastDamageAnimationTime(secondsSinceEpoch);
    const durationSinceLastHit =
      this.mixedMesh.timelineMatcher.animationNow() - lastDamageRenderTime;
    // Have the Npc's scale "bounce" when it's hit.
    const meshScale = (() => {
      const getScaleFromHitCurve = (
        curve: Spline<number>,
        duration: number,
        finishedScale: number
      ) => {
        const t = durationSinceLastHit / duration;
        if (t < 1) {
          return curve.value(t);
        } else {
          return finishedScale;
        }
      };

      if (this.entity.health.hp > 0) {
        return getScaleFromHitCurve(
          onHitScaleCurve,
          ON_HIT_ANIMATION_DURATION_SECS,
          1
        );
      } else {
        return getScaleFromHitCurve(
          onDeathScaleCurve,
          ON_DEATH_ANIMATION_DURATION_SECS,
          HARTHMERE_NPC_DEATH_CORPSE_HOLD_SCALE
        );
      }
    })();
    const baseScale = this.mixedMesh.three.userData.harthmereBaseScaleBeforeHit;
    if (
      Array.isArray(baseScale) &&
      baseScale.length === 3 &&
      baseScale.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    ) {
      this.mixedMesh.three.scale.set(
        baseScale[0] * meshScale,
        baseScale[1] * meshScale,
        baseScale[2] * meshScale
      );
    } else {
      this.mixedMesh.three.scale.multiplyScalar(meshScale);
    }
    if (this.entity.health.hp <= 0) {
      const fallProgress = Math.min(
        1,
        Math.max(0, durationSinceLastHit / ON_DEATH_ANIMATION_DURATION_SECS)
      );
      this.mixedMesh.three.rotation.z = -Math.PI * 0.5 * fallProgress;
      const baseNpcBoxSize = getNpcBoxSize(
        idToNpcType(this.entity.npc_metadata.type_id)
      );
      this.mixedMesh.three.position.y -=
        baseNpcBoxSize[1] * 0.425 * fallProgress;
      const expiresAt = this.entity.expires?.trigger_at;
      if (expiresAt !== undefined) {
        const remaining = expiresAt - secondsSinceEpoch;
        this.applyHarthmereNpcCorpseOpacity(
          Math.max(
            0,
            Math.min(1, remaining / HARTHMERE_NPC_DEATH_FADE_LAST_SECS)
          )
        );
      }
      this.mixedMesh.three.visible = true;
      this.mixedMesh.three.userData.harthmereDeathRespawnCinematic = {
        version: HARTHMERE_CREATURE_SOCIAL_DEATH_ANIMATION_VERSION,
        corpseHoldScale: HARTHMERE_NPC_DEATH_CORPSE_HOLD_SCALE,
        durationSeconds: ON_DEATH_ANIMATION_DURATION_SECS,
        visibleCorpsePose: true,
        fallProgress,
        fadeLastSeconds: HARTHMERE_NPC_DEATH_FADE_LAST_SECS,
      };
    }

    if (durationSinceLastHit === 0) {
      if (
        !this.onHitParticleEffect &&
        damageSourceCausesParticles(this.entity.health.lastDamageSource)
      ) {
        // Different effects depending on if this is the killing blow or not.
        const particleMaterials =
          this.entity.health.hp <= 0
            ? this.commonResources.onDeathEffectParticleMaterials
            : this.commonResources.onHitEffectParticleMaterials;

        this.onHitParticleEffect = new ParticleSystem(
          particleMaterials,
          this.mixedMesh.animationMixer.time
        );

        this.onHitParticleEffect.three.position.fromArray(centerPosition);
        const volume = volumeAABB(aabb);
        this.onHitParticleEffect.three.scale.fromArray(
          scale(Math.cbrt(volume), [1, 1, 1])
        );
      }

      this.playSound(
        "itemOnHit",
        sample(this.commonResources.onHitItemSoundEffect)!,
        centerPosition
      );

      const phase = this.entity.health.hp <= 0 ? "death" : "hit";
      const creatureProfile = this.harthmereCreatureSoundProfile();
      const bufferChoices =
        this.entity.health.hp <= 0 &&
        this.effectResources?.onDeathNpcSoundEffect
          ? this.effectResources.onDeathNpcSoundEffect
          : this.effectResources?.onHitNpcSoundEffect;
      const sound = creatureProfile
        ? this.harthmereCreatureSound(phase)
        : bufferChoices?.length
          ? sample(bufferChoices)
          : this.harthmereFallbackSound(phase);
      if (sound) {
        this.playSound("npcVoice", sound, centerPosition);
      }
    }

    if (this.onHitParticleEffect) {
      this.onHitParticleEffect.tickToTime(
        this.mixedMesh.animationMixer.time,
        sunDirection
      );

      if (this.onHitParticleEffect.allAnimationsComplete()) {
        this.onHitParticleEffect.materials.dispose();
        this.onHitParticleEffect = undefined;
      }
    }
  }

  addToScene(scenes: Scenes, now: number) {
    addToScenes(scenes, this.mixedMesh.three);
    if (this.onHitParticleEffect) {
      addToScenes(scenes, this.onHitParticleEffect.three);
    }
    for (const k in this.soundChannels) {
      const value = this.soundChannels[k as NpcChannels];
      if (value) {
        addToScenes(scenes, value);
        this.audioManager.setActive(value, now);
      }
    }
  }

  private harthmereFallbackSound(
    phase: "idle" | "attack" | "hit" | "death"
  ): AudioPath | undefined {
    if (!this.entity) return undefined;
    const npcType = idToNpcType(this.entity.npc_metadata.type_id);
    const soundId = harthmereNpcSoundIdForIdentity(
      {
        entityId: Number(this.entity.id),
        text: `${this.entity.label?.text ?? ""} ${npcType.name} ${
          npcType.displayName ?? ""
        }`,
      },
      phase
    );
    return getHarthmereSoundEffect(soundId)?.path as AudioPath | undefined;
  }

  private harthmereCreatureSoundProfile() {
    if (!this.entity) return undefined;
    const npcType = idToNpcType(this.entity.npc_metadata.type_id);
    return harthmereCreatureSoundProfileForIdentity({
      entityId: Number(this.entity.id),
      text: `${this.entity.label?.text ?? ""} ${npcType.name} ${
        npcType.displayName ?? ""
      }`,
    });
  }

  private harthmereCreatureSound(
    phase: HarthmereCreatureSoundPhase
  ): AudioPath | undefined {
    if (!this.entity) return undefined;
    const npcType = idToNpcType(this.entity.npc_metadata.type_id);
    const soundId = harthmereNpcSoundIdForIdentity(
      {
        entityId: Number(this.entity.id),
        text: `${this.entity.label?.text ?? ""} ${npcType.name} ${
          npcType.displayName ?? ""
        }`,
      },
      phase
    );
    return getHarthmereSoundEffect(soundId)?.path as AudioPath | undefined;
  }

  playSound(
    channel: keyof typeof this.soundChannels,
    assetPath: AudioPath,
    position: Vec3,
    spatialOptions?: PathSpatialAudioOptions
  ) {
    if (String(assetPath).startsWith("/assets/harthmere/audio/sfx/")) {
      // Generated Harthmere effects are not part of the eagerly loaded Galois
      // bundle. Use the async path so the first attack requests and plays its
      // clip instead of silently losing the one-shot on a cold cache.
      this.audioManager.playPathAt(assetPath, position, spatialOptions);
      return;
    }
    const audioListener = this.audioManager.getAudioListener();
    if (!audioListener) {
      return;
    }
    const buffer = this.audioManager.getBuffer(assetPath);
    if (!buffer) {
      return;
    }

    let sound = this.soundChannels[channel];
    if (sound) {
      sound.stop();
    } else {
      sound = new THREE.PositionalAudio(audioListener);
    }

    sound.setBuffer(buffer);
    sound.position.fromArray(position);
    sound.setDistanceModel("exponential");
    sound.setRolloffFactor(1.5);
    sound.setRefDistance(5);
    sound.setLoop(false);
    sound.setVolume(this.audioManager.getVolume("settings.volume.effects"));
    sound.play();

    this.soundChannels[channel] = sound;
  }

  dispose() {
    this.activeHarthmereBossSpecialAttack?.action.stop();
    this.cutsceneHeldItemAttachment.dispose();
    this.cutsceneHeldItemNode.removeFromParent();
    this.mixedMesh.dispose();
    this.onHitParticleEffect?.materials.dispose();
  }
}

interface MixedNpcMeshImpl extends MixedMesh<typeof npcSystem> {
  harthmereAnimationClips: ReadonlyMap<string, THREE.AnimationClip>;
  basePassMaterials: ReadonlyArray<BasePassMaterial>;
  skinnedMeshes: ReadonlyArray<THREE.SkinnedMesh>;
}
export type MixedNpcMesh = Disposable<MixedNpcMeshImpl>;

export function makeMixedNpcMesh(gltf: GLTF, npcType: NpcType): MixedNpcMesh {
  const three = SkeletonUtils.clone(gltfToThree(gltf));
  const [materials, _oldMaterials] = cloneMaterials(three);
  const basePassMaterials = new Set<BasePassMaterial>();
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  three.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof BasePassMaterial
    ) {
      basePassMaterials.add(child.material);
    }
    if (child instanceof THREE.SkinnedMesh) {
      skinnedMeshes.push(child);
    }
  });
  recordHarthmereNpcAnimationLoadCheck(three, gltf.animations ?? []);

  const state = npcSystem.newState(three, gltf.animations, {
    attack: getNpcBehavior(npcType).chaseAttack?.attackAnimationMultiplier ?? 1,
  });

  return makeDisposable(
    {
      three,
      animationMixer: state.mixer,
      animationSystem: npcSystem,
      animationSystemState: state,
      timelineMatcher: new TimelineMatcher(() => state.mixer.time),
      harthmereAnimationClips: new Map(
        (gltf.animations ?? []).map((clip) => [clip.name, clip])
      ),
      basePassMaterials: [...basePassMaterials],
      skinnedMeshes,
    },
    () => {
      materials.forEach((mat) => mat.dispose());
    }
  );
}

async function makeNpcRenderState(
  { audioManager }: ClientContext,
  deps: ClientResourceDeps,
  id: BiomesId
): Promise<NpcRenderState | undefined> {
  const npcMetadata = deps.get("/ecs/c/npc_metadata", id);
  // Resource invalidation can race entity deletion or a Sync subscription
  // boundary. Treat a missing component as an unrenderable frame instead of
  // poisoning the cached render-state resource with an assertion error.
  if (!npcMetadata) {
    return;
  }
  const npcType = harthmereRenderableNpcType(npcMetadata.type_id);
  if (!npcType) {
    log.throttledError(
      10_000,
      `Entity ${id} has npc_metadata but invalid type_id (${npcMetadata.type_id})`
    );
    return;
  }

  const gltf = await deps.get("/scene/npc/mesh", id);
  if (!gltf) {
    return;
  }
  const mixedMesh = makeMixedNpcMesh(gltf, npcType);
  const commonResources = await deps.get("/scene/npc_common_effects");

  const effectResources = npcType.effectsProfile
    ? await deps.get("/scene/npc_effects", npcType.effectsProfile)
    : {};

  return new NpcRenderState(
    mixedMesh,
    commonResources,
    effectResources,
    audioManager
  );
}

function makeNpcSpatialLighting(
  deps: ClientResourceDeps,
  id: BiomesId
): SpatialLighting {
  const pos = deps.get("/ecs/c/position", id);
  if (!pos) {
    return defaultSpatialLighting();
  }
  return computeSpatialLighting(deps, pos.v[0], pos.v[1] + 0.75, pos.v[2]);
}

const HARTHMERE_NPC_FACE_BODY_VISUAL_REFINEMENT_VERSION =
  "harthmere-face-body-visual-refinement";

export function harthmereNpcGltfVisibleGeometryStatsForTest(gltf: GLTF) {
  // Delegates to the node-safe shared guard so the resolver and its unit tests
  // share one definition of "has renderable geometry".
  return harthmereNpcVisibleGeometryStatsForScene(gltfToThree(gltf));
}

// HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD96
// Guarantees a candidate NPC gltf actually has drawable geometry. A broken
// authored asset is a release error: silently swapping in a procedural body
// changes the character's identity and was the source of the wrong cutscene
// avatars. Keep the native failure visible to tests and deployment instead.
function ensureVisibleNpcGltf(
  _deps: ClientResourceDeps,
  id: BiomesId,
  npcType: NpcType,
  candidate: GLTF | undefined,
  reason: string
): GLTF {
  if (
    candidate &&
    !harthmereNpcSceneNeedsVisibleFallback(gltfToThree(candidate))
  ) {
    return candidate;
  }
  throw new Error(
    `Native NPC mesh is not renderable (${JSON.stringify({
      entityId: id,
      npcTypeId: npcType.id,
      npcTypeName: npcType.name,
      reason,
      stats: candidate
        ? harthmereNpcVisibleGeometryStatsForScene(gltfToThree(candidate))
        : undefined,
      version: HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD_VERSION,
    })})`
  );
}

function localDevVoxelMaterial(color: number) {
  // current: toon material keeps voxel faces readable at gameplay distance and
  // matches the player/runtime Harthmere visual pipeline.
  return new THREE.MeshToonMaterial({ color });
}

function localDevVoxelGeometry(size: [number, number, number]) {
  const radius = Math.max(0.003, Math.min(size[0], size[1], size[2]) * 0.08);
  return new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius);
}

function localDevVoxelBox(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number
) {
  const mesh = new THREE.Mesh(
    localDevVoxelGeometry(size),
    localDevVoxelMaterial(color)
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

type LocalDevVoxelPalette = {
  skin: number;
  skinShadow: number;
  hair: number;
  eye: number;
  mouth: number;
  tunic: number;
  legs: number;
  accent: number;
};

type LocalDevVoxelHairStyle =
  | "flat"
  | "side_part"
  | "short_crown"
  | "balding"
  | "hood"
  | "cap"
  | "braids"
  | "curly"
  | "shaved"
  | "bob"
  | "long"
  | "bun"
  | "pigtails"
  | "wavy";

type LocalDevVoxelMouthStyle =
  "line" | "smile" | "frown" | "open" | "stern" | "smirk";

type LocalDevVoxelFaceSpec = {
  headSize: [number, number, number];
  headPosition: [number, number, number];
  hairStyle: LocalDevVoxelHairStyle;
  hairTopSize: [number, number, number];
  hairTopPosition: [number, number, number];
  leftHairSize?: [number, number, number];
  leftHairPosition?: [number, number, number];
  rightHairSize?: [number, number, number];
  rightHairPosition?: [number, number, number];
  fringeSize?: [number, number, number];
  fringePosition?: [number, number, number];
  browSize: [number, number, number];
  browY: number;
  browSpread: number;
  browTiltOffset: number;
  eyeSize: [number, number, number];
  eyeY: number;
  eyeSpread: number;
  eyeZ: number;
  noseSize: [number, number, number];
  nosePosition: [number, number, number];
  mouthStyle: LocalDevVoxelMouthStyle;
  mouthSize: [number, number, number];
  mouthPosition: [number, number, number];
  cheekSize?: [number, number, number];
  cheekY?: number;
  cheekSpread?: number;
  mustacheSize?: [number, number, number];
  mustachePosition?: [number, number, number];
  beardSize?: [number, number, number];
  beardPosition?: [number, number, number];
  sideProfile: HarthmereNpcFaceSideProfile;
};

function localDevNpcOffset(id: BiomesId) {
  return Number(id) - 8_810_000_000_010_000;
}

function localDevFaceSeed(id: BiomesId, label?: string) {
  let seed = Number(id) || 17;
  for (const char of label ?? "") {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return seed >>> 0;
}

function pickLocalDev<T>(items: readonly T[], seed: number, salt: number) {
  return items[(seed + salt * 131) % items.length]!;
}

function harthmereNpcColorChannelMix(
  source: number,
  target: number,
  amount: number
) {
  const sourcePart = source & 0xff;
  const targetPart = target & 0xff;
  return Math.round(sourcePart + (targetPart - sourcePart) * amount) & 0xff;
}

function harthmereNpcColorMix(source: number, target: number, amount: number) {
  const r = harthmereNpcColorChannelMix(source >> 16, target >> 16, amount);
  const g = harthmereNpcColorChannelMix(source >> 8, target >> 8, amount);
  const b = harthmereNpcColorChannelMix(source, target, amount);
  return (r << 16) | (g << 8) | b;
}

function harthmereNpcColorLighten(color: number, amount = 0.16) {
  return harthmereNpcColorMix(color, 0xffffff, amount);
}

function harthmereNpcColorDarken(color: number, amount = 0.2) {
  return harthmereNpcColorMix(color, 0x000000, amount);
}

type HarthmereNpcFaceSideProfile = {
  leftWidthScale: number;
  rightWidthScale: number;
  leftHeightScale: number;
  rightHeightScale: number;
  leftYOffset: number;
  rightYOffset: number;
  leftZOffset: number;
  rightZOffset: number;
  highlightSide: "left" | "right";
  jawNotchSide: "left" | "right" | "none";
  markSide: "left" | "right" | "none";
  hairPartSide: "left" | "right";
  hairLockSide: "left" | "right" | "none";
};

function harthmereNpcFaceSideProfile(
  seed: number,
  robot: boolean
): HarthmereNpcFaceSideProfile {
  if (robot) {
    return {
      leftWidthScale: 1.05,
      rightWidthScale: 0.95,
      leftHeightScale: 1,
      rightHeightScale: 1,
      leftYOffset: 0,
      rightYOffset: 0,
      leftZOffset: 0,
      rightZOffset: 0,
      highlightSide: "left",
      jawNotchSide: "none",
      markSide: "none",
      hairPartSide: "left",
      hairLockSide: "none",
    };
  }
  const majorLeft = (seed & 1) === 0;
  const jawVariant = (seed >>> 4) % 4;
  const markVariant = (seed >>> 9) % 5;
  const lockVariant = (seed >>> 12) % 4;
  return {
    leftWidthScale: majorLeft ? 1.18 : 0.9,
    rightWidthScale: majorLeft ? 0.92 : 1.17,
    leftHeightScale: majorLeft ? 1.12 : 0.95,
    rightHeightScale: majorLeft ? 0.96 : 1.1,
    leftYOffset: majorLeft ? 0.012 : -0.006,
    rightYOffset: majorLeft ? -0.006 : 0.012,
    leftZOffset: majorLeft ? -0.008 : 0.005,
    rightZOffset: majorLeft ? 0.005 : -0.008,
    highlightSide: majorLeft ? "left" : "right",
    jawNotchSide:
      jawVariant === 0 ? "none" : jawVariant === 1 ? "left" : "right",
    markSide:
      markVariant === 0 ? "none" : markVariant % 2 === 0 ? "left" : "right",
    hairPartSide: ((seed >>> 6) & 1) === 0 ? "left" : "right",
    hairLockSide:
      lockVariant === 0 ? "none" : lockVariant % 2 === 0 ? "left" : "right",
  };
}

const HARTHMERE_SKIN_COLORS = {
  porcelain: 0xf0c7a3,
  light: 0xe4b48e,
  warm: 0xd19a68,
  tan: 0xb9825a,
  brown: 0x8f5f3f,
  deep: 0x5c3a2c,
  metal: 0x9ca3af,
} as const;

const HARTHMERE_SKIN_SHADOW_COLORS = {
  porcelain: 0xd9a47f,
  light: 0xc48a66,
  warm: 0x9a5f3e,
  tan: 0x7e4f36,
  brown: 0x5f3d2d,
  deep: 0x3a261e,
  metal: 0x657084,
} as const;

const HARTHMERE_HAIR_COLORS = {
  black: 0x1f1a16,
  brown: 0x3a2518,
  auburn: 0x6a2f21,
  blonde: 0xb89652,
  gray: 0x707070,
  white: 0xd6d0c8,
  red: 0x7a2d22,
  blue: 0x233a5a,
  green: 0x24523a,
  purple: 0x4a2d5a,
} as const;

const HARTHMERE_EYE_COLORS = {
  black: 0x151515,
  brown: 0x5a3a22,
  blue: 0x203a54,
  green: 0x2d4d2f,
  hazel: 0x6a5a2e,
  gray: 0x59656d,
  amber: 0x9a6b24,
  violet: 0x493463,
} as const;

function localDevVoxelPalette(
  id: BiomesId,
  label?: string,
  faceConfig?: HarthmereVoxelFaceConfig
): LocalDevVoxelPalette {
  const offset = localDevNpcOffset(id);
  const normalizedLabel = label?.toLowerCase() ?? "";
  const seed = localDevFaceSeed(id, label);
  const fallbackSkinOptions = [
    0xc58c62, 0xd19a68, 0xb9825a, 0xc7966b, 0x9f684c,
  ] as const;
  const fallbackHairOptions = [
    0x2d211a, 0x3a2518, 0x4a3426, 0x5a3825, 0x6a4226, 0x1f1a16,
  ] as const;
  const fallbackEyeOptions = [
    0x151515, 0x203a54, 0x2d4d2f, 0x5a3a22, 0x334b5f,
  ] as const;
  const baseSkin = faceConfig
    ? HARTHMERE_SKIN_COLORS[faceConfig.skinTone]
    : pickLocalDev(fallbackSkinOptions, seed, 1);
  const baseHair = faceConfig
    ? HARTHMERE_HAIR_COLORS[faceConfig.hairColor]
    : pickLocalDev(fallbackHairOptions, seed, 2);
  const eye = faceConfig
    ? HARTHMERE_EYE_COLORS[faceConfig.eyeColor]
    : pickLocalDev(fallbackEyeOptions, seed, 3);
  const base = {
    skin: baseSkin,
    skinShadow: faceConfig
      ? HARTHMERE_SKIN_SHADOW_COLORS[faceConfig.skinTone]
      : 0x9a5f3e,
    hair: baseHair,
    eye,
    mouth: faceConfig?.mouthStyle === "open" ? 0x6b2f33 : 0x2a1712,
  };
  if (
    [27, 39, 44, 45, 56, 69].includes(offset) ||
    normalizedLabel.includes("guard") ||
    normalizedLabel.includes("sergeant") ||
    normalizedLabel.includes("watch")
  ) {
    return { ...base, tunic: 0x8c1d1d, legs: 0x252525, accent: 0x222222 };
  }
  if (
    [33, 40, 52, 53, 61, 65, 70].includes(offset) ||
    normalizedLabel.includes("mudden") ||
    normalizedLabel.includes("smuggler") ||
    normalizedLabel.includes("underways")
  ) {
    return { ...base, tunic: 0x7c6b58, legs: 0x4a4038, accent: 0x9a5f3e };
  }
  if (
    [10, 37, 63, 64].includes(offset) ||
    normalizedLabel.includes("farmer") ||
    normalizedLabel.includes("apple") ||
    normalizedLabel.includes("stable")
  ) {
    return { ...base, tunic: 0x6b7b3e, legs: 0x5a412b, accent: 0xb89652 };
  }
  if (
    [31, 46, 66].includes(offset) ||
    normalizedLabel.includes("father") ||
    normalizedLabel.includes("sister") ||
    normalizedLabel.includes("chapel")
  ) {
    return { ...base, tunic: 0xd8cfb0, legs: 0x6d6a60, accent: 0x637b9a };
  }
  if (
    [12, 34, 51].includes(offset) ||
    normalizedLabel.includes("dock") ||
    normalizedLabel.includes("ferry")
  ) {
    return { ...base, tunic: 0x5b4937, legs: 0x223748, accent: 0x8a6d3d };
  }
  if (
    [43, 57, 58, 60].includes(offset) ||
    normalizedLabel.includes("courier") ||
    normalizedLabel.includes("merchant") ||
    normalizedLabel.includes("vendor")
  ) {
    return { ...base, tunic: 0x2f6d3b, legs: 0x44352a, accent: 0xd7b45a };
  }
  return { ...base, tunic: 0x326c91, legs: 0x3f352c, accent: 0x8a5137 };
}

function localDevVoxelFaceSpec(
  id: BiomesId,
  label?: string,
  faceConfig?: HarthmereVoxelFaceConfig
): LocalDevVoxelFaceSpec {
  const seed = localDevFaceSeed(id, label);
  const offset = localDevNpcOffset(id);
  const robot =
    offset === 2 ||
    label?.toLowerCase().includes("bolt") ||
    /\b(robots?|bots?|sentinels?|sententials?|sentientals?)\b/i.test(
      label ?? ""
    ) ||
    faceConfig?.skinTone === "metal";

  const faceShape =
    faceConfig?.faceShape ??
    pickLocalDev(HARTHMERE_FACE_SHAPES_FALLBACK, seed, 4);
  const headWidth = robot
    ? 0.36
    : faceShape === "wide"
      ? 0.38
      : faceShape === "narrow"
        ? 0.28
        : faceShape === "tall"
          ? 0.31
          : faceShape === "soft"
            ? 0.34
            : 0.34;
  const headHeight = robot
    ? 0.32
    : faceShape === "tall"
      ? 0.36
      : faceShape === "soft"
        ? 0.31
        : faceShape === "narrow"
          ? 0.33
          : 0.32;
  const headDepth = robot
    ? 0.29
    : faceShape === "wide"
      ? 0.29
      : faceShape === "narrow"
        ? 0.25
        : 0.27;

  const hairStyle = robot
    ? "flat"
    : ((faceConfig?.accessory === "cap"
        ? "cap"
        : faceConfig?.accessory === "hood"
          ? "hood"
          : faceConfig?.hairStyle) ??
      pickLocalDev(
        [
          "flat",
          "side_part",
          "short_crown",
          "balding",
          "hood",
          "cap",
          "bob",
          "long",
          "bun",
          "pigtails",
          "wavy",
        ] as const,
        seed,
        7
      ));
  const mouthStyle =
    faceConfig?.mouthStyle ??
    pickLocalDev(["line", "smile", "frown", "open", "stern"] as const, seed, 8);
  const eyeShape = faceConfig?.eyeShape ?? "square";
  const eyeSpread =
    eyeShape === "wide" ? 0.088 : eyeShape === "small" ? 0.055 : 0.07;
  const eyeY =
    eyeShape === "sleepy" ? 1.105 : eyeShape === "sharp" ? 1.13 : 1.12;
  const eyeHeight =
    eyeShape === "wide"
      ? 0.048
      : eyeShape === "small"
        ? 0.028
        : eyeShape === "sleepy"
          ? 0.024
          : 0.038;
  const mouthY =
    mouthStyle === "frown"
      ? 0.995
      : mouthStyle === "smile" || mouthStyle === "smirk"
        ? 1.03
        : 1.015;
  const mouthWidth =
    mouthStyle === "smirk"
      ? 0.13
      : mouthStyle === "stern"
        ? 0.1
        : mouthStyle === "open"
          ? 0.09
          : 0.115;
  const browStyle = faceConfig?.browStyle ?? "straight";
  const browTiltOffset =
    browStyle === "arched"
      ? 0.016
      : browStyle === "stern"
        ? -0.016
        : browStyle === "scarred"
          ? 0.012
          : 0;
  const noseStyle = faceConfig?.noseStyle ?? "straight";
  const noseSize: [number, number, number] =
    noseStyle === "wide"
      ? [0.07, 0.05, 0.06]
      : noseStyle === "long"
        ? [0.05, 0.075, 0.065]
        : noseStyle === "button"
          ? [0.055, 0.035, 0.055]
          : noseStyle === "small"
            ? [0.04, 0.04, 0.05]
            : [0.05, 0.055, 0.055];

  const leftHairSize: [number, number, number] | undefined =
    hairStyle === "shaved"
      ? undefined
      : hairStyle === "braids"
        ? [0.055, 0.28, 0.05]
        : hairStyle === "curly"
          ? [0.09, 0.2, headDepth + 0.03]
          : hairStyle === "bob"
            ? [0.085, 0.28, headDepth + 0.04]
            : hairStyle === "long"
              ? [0.095, 0.44, 0.075]
              : hairStyle === "pigtails"
                ? [0.095, 0.28, 0.09]
                : hairStyle === "wavy"
                  ? [0.085, 0.28, headDepth + 0.03]
                  : hairStyle === "side_part" || hairStyle === "hood"
                    ? [0.075, 0.2, headDepth + 0.03]
                    : [0.055, 0.14, headDepth + 0.02];
  const rightHairSize: [number, number, number] | undefined =
    hairStyle === "shaved"
      ? undefined
      : hairStyle === "braids"
        ? [0.055, 0.28, 0.05]
        : hairStyle === "curly"
          ? [0.09, 0.2, headDepth + 0.03]
          : hairStyle === "bob"
            ? [0.085, 0.28, headDepth + 0.04]
            : hairStyle === "long"
              ? [0.095, 0.44, 0.075]
              : hairStyle === "pigtails"
                ? [0.095, 0.28, 0.09]
                : hairStyle === "wavy"
                  ? [0.085, 0.28, headDepth + 0.03]
                  : hairStyle === "hood" || hairStyle === "flat"
                    ? [0.075, 0.18, headDepth + 0.03]
                    : [0.045, 0.12, headDepth + 0.02];
  const facialHair = faceConfig?.facialHair ?? "none";
  const sideProfile = harthmereNpcFaceSideProfile(seed, robot);

  return {
    sideProfile,
    headSize: [headWidth, headHeight, headDepth],
    headPosition: [0, 1.1, -0.01],
    hairStyle: hairStyle as LocalDevVoxelHairStyle,
    hairTopSize:
      hairStyle === "shaved"
        ? [headWidth + 0.01, 0.025, headDepth + 0.015]
        : hairStyle === "balding"
          ? [headWidth * 0.72, 0.045, headDepth + 0.02]
          : hairStyle === "curly"
            ? [headWidth + 0.08, 0.105, headDepth + 0.08]
            : hairStyle === "bob" ||
                hairStyle === "long" ||
                hairStyle === "wavy"
              ? [headWidth + 0.07, 0.095, headDepth + 0.06]
              : hairStyle === "bun"
                ? [headWidth + 0.04, 0.075, headDepth + 0.04]
                : hairStyle === "pigtails"
                  ? [headWidth + 0.05, 0.085, headDepth + 0.04]
                  : [headWidth + 0.03, 0.085, headDepth + 0.03],
    hairTopPosition: [0, 1.1 + headHeight / 2 + 0.04, -0.01],
    leftHairSize,
    leftHairPosition: leftHairSize
      ? [
          hairStyle === "pigtails"
            ? -headWidth / 2 - 0.085
            : -headWidth / 2 - 0.018,
          hairStyle === "long"
            ? 1.005
            : hairStyle === "pigtails"
              ? 1.04
              : hairStyle === "bob" || hairStyle === "wavy"
                ? 1.06
                : 1.12,
          hairStyle === "long" || hairStyle === "pigtails" ? 0.01 : -0.01,
        ]
      : undefined,
    rightHairSize,
    rightHairPosition: rightHairSize
      ? [
          hairStyle === "pigtails"
            ? headWidth / 2 + 0.085
            : headWidth / 2 + 0.018,
          hairStyle === "long"
            ? 1.005
            : hairStyle === "pigtails"
              ? 1.04
              : hairStyle === "bob" || hairStyle === "wavy"
                ? 1.06
                : 1.12,
          hairStyle === "long" || hairStyle === "pigtails" ? 0.01 : -0.01,
        ]
      : undefined,
    fringeSize:
      hairStyle === "side_part"
        ? [headWidth * 0.62, 0.05, 0.04]
        : hairStyle === "short_crown"
          ? [headWidth * 0.34, 0.055, 0.04]
          : hairStyle === "braids"
            ? [headWidth * 0.75, 0.045, 0.04]
            : hairStyle === "bob" || hairStyle === "wavy"
              ? [headWidth * 0.8, 0.045, 0.04]
              : hairStyle === "bun"
                ? [headWidth * 0.45, 0.035, 0.035]
                : hairStyle === "pigtails"
                  ? [headWidth * 0.65, 0.04, 0.04]
                  : undefined,
    fringePosition:
      hairStyle === "side_part"
        ? [-0.045, 1.1 + headHeight / 2 + 0.055, -headDepth / 2 - 0.026]
        : hairStyle === "short_crown"
          ? [0.065, 1.1 + headHeight / 2 + 0.055, -headDepth / 2 - 0.026]
          : hairStyle === "braids"
            ? [0, 1.1 + headHeight / 2 + 0.045, -headDepth / 2 - 0.026]
            : hairStyle === "bob" || hairStyle === "wavy"
              ? [0, 1.1 + headHeight / 2 + 0.045, -headDepth / 2 - 0.026]
              : hairStyle === "bun"
                ? [-0.035, 1.1 + headHeight / 2 + 0.04, -headDepth / 2 - 0.026]
                : hairStyle === "pigtails"
                  ? [0, 1.1 + headHeight / 2 + 0.045, -headDepth / 2 - 0.026]
                  : undefined,
    browSize: [
      browStyle === "soft" ? 0.05 : 0.065,
      browStyle === "scarred" ? 0.022 : 0.016,
      0.018,
    ],
    browY: eyeY + 0.045,
    browSpread: eyeSpread,
    browTiltOffset,
    eyeSize: [
      eyeShape === "small" ? 0.032 : eyeShape === "wide" ? 0.048 : 0.038,
      eyeHeight,
      0.022,
    ],
    eyeY,
    eyeSpread,
    eyeZ: -headDepth / 2 - 0.023,
    noseSize,
    nosePosition: [
      0,
      noseStyle === "long" ? 1.065 : 1.075,
      -headDepth / 2 - 0.038,
    ],
    mouthStyle: mouthStyle as LocalDevVoxelMouthStyle,
    mouthSize: [mouthWidth, mouthStyle === "open" ? 0.045 : 0.02, 0.016],
    mouthPosition: [
      mouthStyle === "smirk" ? 0.015 : mouthStyle === "frown" ? 0.004 : 0,
      mouthY,
      -headDepth / 2 - 0.025,
    ],
    cheekSize:
      faceConfig?.cheekStyle === "none"
        ? undefined
        : [0.035, faceConfig?.cheekStyle === "strong" ? 0.03 : 0.02, 0.014],
    cheekY: 1.055,
    cheekSpread: headWidth / 2 - 0.055,
    mustacheSize:
      facialHair === "mustache" ||
      facialHair === "goatee" ||
      facialHair === "full_beard"
        ? [0.14, 0.027, 0.018]
        : undefined,
    mustachePosition: [0, 1.035, -headDepth / 2 - 0.03],
    beardSize:
      facialHair === "short_beard"
        ? [0.18, 0.075, 0.018]
        : facialHair === "goatee"
          ? [0.09, 0.08, 0.018]
          : facialHair === "full_beard"
            ? [0.2, 0.12, 0.018]
            : undefined,
    beardPosition: [
      0,
      facialHair === "full_beard" ? 0.975 : 0.99,
      -headDepth / 2 - 0.024,
    ],
  };
}

const HARTHMERE_FACE_SHAPES_FALLBACK = [
  "bolt_square",
  "wide",
  "narrow",
  "tall",
  "soft",
] as const;

function localDevVoxelFaceParts(
  id: BiomesId,
  label: string | undefined,
  palette: LocalDevVoxelPalette,
  faceConfig?: HarthmereVoxelFaceConfig
) {
  const face = localDevVoxelFaceSpec(id, label, faceConfig);
  const side = face.sideProfile;
  const skinLight = harthmereNpcColorLighten(palette.skin, 0.12);
  const skinDark = harthmereNpcColorDarken(palette.skin, 0.16);
  const hairAccent = harthmereNpcColorLighten(palette.hair, 0.12);
  const parts: THREE.Object3D[] = [
    localDevVoxelBox(
      "harthmere-npc-head",
      face.headSize,
      face.headPosition,
      palette.skin
    ),
    localDevVoxelBox(
      "harthmere-npc-skin-shadow",
      [face.headSize[0], 0.035, face.headSize[2]],
      [
        0,
        face.headPosition[1] - face.headSize[1] / 2 + 0.035,
        face.headPosition[2],
      ],
      palette.skinShadow
    ),
    localDevVoxelBox(
      "harthmere-npc-hair-top",
      face.hairTopSize,
      face.hairTopPosition,
      palette.hair
    ),
    localDevVoxelBox(
      "harthmere-npc-left-eye",
      face.eyeSize,
      [-face.eyeSpread, face.eyeY, face.eyeZ],
      palette.eye
    ),
    localDevVoxelBox(
      "harthmere-npc-right-eye",
      face.eyeSize,
      [face.eyeSpread, face.eyeY, face.eyeZ],
      palette.eye
    ),
    localDevVoxelBox(
      "harthmere-npc-left-brow",
      face.browSize,
      [-face.browSpread, face.browY + face.browTiltOffset, face.eyeZ - 0.004],
      palette.hair
    ),
    localDevVoxelBox(
      "harthmere-npc-right-brow",
      face.browSize,
      [face.browSpread, face.browY - face.browTiltOffset, face.eyeZ - 0.004],
      palette.hair
    ),
    localDevVoxelBox(
      "harthmere-npc-nose",
      face.noseSize,
      face.nosePosition,
      palette.skinShadow
    ),
    localDevVoxelBox(
      "harthmere-npc-mouth",
      face.mouthSize,
      face.mouthPosition,
      palette.mouth
    ),
  ];

  parts.push(
    localDevVoxelBox(
      "harthmere-npc-left-head-side-asym",
      [
        0.02 * side.leftWidthScale,
        face.headSize[1] * 0.54 * side.leftHeightScale,
        Math.max(0.06, face.headSize[2] * 0.72 + side.leftZOffset),
      ],
      [
        -face.headSize[0] / 2 - 0.011,
        face.headPosition[1] + side.leftYOffset,
        face.headPosition[2] + side.leftZOffset,
      ],
      side.highlightSide === "left" ? skinLight : skinDark
    ),
    localDevVoxelBox(
      "harthmere-npc-right-head-side-asym",
      [
        0.02 * side.rightWidthScale,
        face.headSize[1] * 0.54 * side.rightHeightScale,
        Math.max(0.06, face.headSize[2] * 0.72 + side.rightZOffset),
      ],
      [
        face.headSize[0] / 2 + 0.011,
        face.headPosition[1] + side.rightYOffset,
        face.headPosition[2] + side.rightZOffset,
      ],
      side.highlightSide === "right" ? skinLight : skinDark
    )
  );
  if (side.jawNotchSide === "left") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-jaw-notch-asym",
        [0.03, 0.055, 0.018],
        [
          -face.headSize[0] / 2 + 0.02,
          face.headPosition[1] - face.headSize[1] / 2 + 0.095,
          face.eyeZ - 0.004,
        ],
        palette.skinShadow
      )
    );
  } else if (side.jawNotchSide === "right") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-right-jaw-notch-asym",
        [0.03, 0.055, 0.018],
        [
          face.headSize[0] / 2 - 0.02,
          face.headPosition[1] - face.headSize[1] / 2 + 0.095,
          face.eyeZ - 0.004,
        ],
        palette.skinShadow
      )
    );
  }
  if (side.markSide === "left") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-face-mark-asym",
        [0.016, 0.016, 0.012],
        [
          -face.headSize[0] * 0.28,
          face.mouthPosition[1] + 0.055,
          face.eyeZ - 0.01,
        ],
        palette.mouth
      )
    );
  } else if (side.markSide === "right") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-right-face-mark-asym",
        [0.016, 0.016, 0.012],
        [
          face.headSize[0] * 0.28,
          face.mouthPosition[1] + 0.055,
          face.eyeZ - 0.01,
        ],
        palette.mouth
      )
    );
  }
  if (side.hairLockSide === "left") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-side-hair-lock-asym",
        [0.035, 0.14, 0.04],
        [-face.headSize[0] / 2 - 0.028, face.eyeY + 0.005, face.eyeZ + 0.04],
        hairAccent
      )
    );
  } else if (side.hairLockSide === "right") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-right-side-hair-lock-asym",
        [0.035, 0.14, 0.04],
        [face.headSize[0] / 2 + 0.028, face.eyeY + 0.005, face.eyeZ + 0.04],
        hairAccent
      )
    );
  }

  if (face.leftHairSize && face.leftHairPosition) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-hair",
        face.leftHairSize,
        face.leftHairPosition,
        palette.hair
      )
    );
  }
  if (face.rightHairSize && face.rightHairPosition) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-right-hair",
        face.rightHairSize,
        face.rightHairPosition,
        palette.hair
      )
    );
  }
  if (face.fringeSize && face.fringePosition) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-fringe",
        face.fringeSize,
        face.fringePosition,
        palette.hair
      )
    );
  }
  if (face.hairStyle === "long") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-long-hair-back",
        [face.headSize[0] + 0.06, 0.42, 0.06],
        [0, 0.98, face.headSize[2] / 2 + 0.03],
        palette.hair
      )
    );
  }
  if (face.hairStyle === "bun") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-bun",
        [0.18, 0.18, 0.13],
        [0, face.hairTopPosition[1] + 0.01, face.headSize[2] / 2 + 0.075],
        palette.hair
      )
    );
  }
  if (face.hairStyle === "pigtails") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-pigtail-tie",
        [0.105, 0.03, 0.09],
        [-(face.headSize[0] / 2 + 0.085), 1.18, 0.015],
        palette.accent
      ),
      localDevVoxelBox(
        "harthmere-npc-right-pigtail-tie",
        [0.105, 0.03, 0.09],
        [face.headSize[0] / 2 + 0.085, 1.18, 0.015],
        palette.accent
      )
    );
  }
  if (face.hairStyle === "wavy") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-wave-1",
        [0.06, 0.05, 0.04],
        [-0.11, face.hairTopPosition[1] - 0.01, face.eyeZ - 0.025],
        palette.hair
      ),
      localDevVoxelBox(
        "harthmere-npc-wave-2",
        [0.06, 0.05, 0.04],
        [0.0, face.hairTopPosition[1] + 0.02, face.eyeZ - 0.025],
        palette.hair
      ),
      localDevVoxelBox(
        "harthmere-npc-wave-3",
        [0.06, 0.05, 0.04],
        [0.11, face.hairTopPosition[1] - 0.01, face.eyeZ - 0.025],
        palette.hair
      )
    );
  }
  if (face.cheekSize && face.cheekY && face.cheekSpread) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-cheek",
        face.cheekSize,
        [-face.cheekSpread, face.cheekY, face.eyeZ - 0.004],
        palette.skinShadow
      ),
      localDevVoxelBox(
        "harthmere-npc-right-cheek",
        face.cheekSize,
        [face.cheekSpread, face.cheekY, face.eyeZ - 0.004],
        palette.skinShadow
      )
    );
  }
  if (face.mustacheSize && face.mustachePosition) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-mustache",
        face.mustacheSize,
        face.mustachePosition,
        palette.hair
      )
    );
  }
  if (face.beardSize && face.beardPosition) {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-beard",
        face.beardSize,
        face.beardPosition,
        palette.hair
      )
    );
  }
  if (face.hairStyle === "cap") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-cap-brim",
        [face.headSize[0] + 0.12, 0.035, 0.08],
        [0, face.hairTopPosition[1] + 0.015, face.eyeZ - 0.015],
        palette.accent
      )
    );
  }
  if (faceConfig?.accessory === "headband") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-headband",
        [face.headSize[0] + 0.08, 0.035, 0.035],
        [0, face.eyeY + 0.085, face.eyeZ - 0.002],
        palette.accent
      )
    );
  }
  if (faceConfig?.accessory === "spectacles") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-left-spectacles",
        [0.07, 0.01, 0.012],
        [-face.eyeSpread, face.eyeY, face.eyeZ - 0.008],
        0xd8d3c1
      ),
      localDevVoxelBox(
        "harthmere-npc-right-spectacles",
        [0.07, 0.01, 0.012],
        [face.eyeSpread, face.eyeY, face.eyeZ - 0.008],
        0xd8d3c1
      ),
      localDevVoxelBox(
        "harthmere-npc-spectacles-bridge",
        [0.035, 0.008, 0.01],
        [0, face.eyeY, face.eyeZ - 0.008],
        0xd8d3c1
      )
    );
  }
  if (face.hairStyle === "hood") {
    parts.push(
      localDevVoxelBox(
        "harthmere-npc-hood-collar",
        [face.headSize[0] + 0.08, 0.08, face.headSize[2] + 0.08],
        [0, 0.925, -0.01],
        palette.accent
      )
    );
  }

  return parts;
}

function addLocalDevNpcModularClothingDetails(
  root: THREE.Group,
  clothing: HarthmereCharacterClothing,
  palette: LocalDevVoxelPalette,
  body: ReturnType<typeof localDevNpcBodyScales>
) {
  const torsoY = body.legLength + body.torsoHeight / 2 + body.stanceYOffset;
  const shoulderY = body.legLength + body.torsoHeight * 0.62;
  const headY = body.legLength + body.torsoHeight + 0.16;
  const trim = harthmereNpcColorLighten(palette.tunic, 0.25);
  const dark = harthmereNpcColorDarken(palette.tunic, 0.35);
  const leather = 0x5a3825;
  const metal = 0xb8b2a4;
  const shadow = 0x161210;
  const slots = Object.keys(clothing) as HarthmereClothingSlot[];

  addLocalDevNpcVisibleClothingGuarantee(root, clothing, palette, body);
  const hiddenZones = new Set<string>();

  const add = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereProductMinecraftPolish =
      HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION;
    root.add(mesh);
    return mesh;
  };

  const addBox = (
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: number,
    rotation: [number, number, number] = [0, 0, 0]
  ) => {
    const mesh = localDevVoxelBox(name, size, position, color);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return add(mesh);
  };

  const addTrimPair = (
    prefix: string,
    y: number,
    z: number,
    width = body.torsoWidth + 0.12
  ) => {
    addBox(`${prefix}-front`, [width, 0.032, 0.052], [0, y, z], trim);
    addBox(`${prefix}-back`, [width * 0.94, 0.028, 0.04], [0, y, 0.13], dark);
  };

  for (const slot of slots) {
    const item = clothing[slot];
    if (!item) {
      continue;
    }

    queueLocalDevNpcLicensedClothingModel(root, String(slot), item, body);
    for (const zone of item.hidesBodyZones ?? []) {
      hiddenZones.add(zone);
    }

    const variant = item.threeJsVariant ?? item.id;
    const robe = /robe|shroud|skirt|long_robe/i.test(variant);
    const armor = /armor|guard|scale|helmet|shield/i.test(variant);
    const apron = /apron/i.test(variant);
    const merchant = /merchant|noble|doublet|ledger/i.test(variant);
    const hunter = /hunter|jerkin|quiver|bedroll|bow/i.test(variant);
    const torn = /torn|ragged|patched|scrap|bandit/i.test(variant);

    if (slot === "torso") {
      const torsoHeight =
        body.torsoHeight + (robe ? body.legLength * 0.48 : 0.07);
      const y = torsoY - (robe ? body.legLength * 0.2 : 0);
      const baseColor = armor
        ? metal
        : hunter || apron
          ? leather
          : palette.tunic;
      addBox(
        "harthmere-npc-clothing-torso-front",
        [body.torsoWidth + 0.12, torsoHeight, 0.062],
        [0, y, -0.165],
        baseColor
      );
      addBox(
        "harthmere-npc-clothing-torso-back",
        [body.torsoWidth + 0.1, torsoHeight * 0.94, 0.052],
        [0, y, 0.13],
        dark
      );
      addBox(
        "harthmere-npc-clothing-left-side",
        [0.052, torsoHeight * 0.92, 0.28],
        [-(body.torsoWidth / 2 + 0.05), y, -0.01],
        baseColor
      );
      addBox(
        "harthmere-npc-clothing-right-side",
        [0.052, torsoHeight * 0.92, 0.28],
        [body.torsoWidth / 2 + 0.05, y, -0.01],
        baseColor
      );
      addTrimPair(
        "harthmere-npc-clothing-collar",
        torsoY + body.torsoHeight * 0.43,
        -0.205,
        body.torsoWidth + 0.16
      );
      addTrimPair(
        "harthmere-npc-clothing-hem",
        y - torsoHeight * 0.48,
        -0.2,
        body.torsoWidth + 0.18
      );

      if (armor) {
        addBox(
          "harthmere-npc-armor-left-pauldron",
          [0.16, 0.07, 0.22],
          [-(body.shoulderWidth / 2 + 0.015), shoulderY + 0.02, -0.035],
          metal
        );
        addBox(
          "harthmere-npc-armor-right-pauldron",
          [0.16, 0.07, 0.22],
          [body.shoulderWidth / 2 + 0.015, shoulderY + 0.02, -0.035],
          metal
        );
        addBox(
          "harthmere-npc-armor-tabard-stripe",
          [0.11, torsoHeight * 0.86, 0.074],
          [0, y, -0.235],
          palette.accent
        );
        addBox(
          "harthmere-npc-armor-chest-emblem",
          [0.14, 0.12, 0.076],
          [0, torsoY + body.torsoHeight * 0.18, -0.27],
          trim
        );
        for (let row = 0; row < 3; row += 1) {
          addBox(
            `harthmere-npc-scale-row-${row}`,
            [body.torsoWidth + 0.03 - row * 0.026, 0.032, 0.074],
            [0, torsoY + 0.14 - row * 0.11, -0.252],
            dark
          );
        }
      }
      if (hunter) {
        addBox(
          "harthmere-npc-hunter-diagonal-strap",
          [0.062, torsoHeight * 1.02, 0.072],
          [-0.08, y, -0.235],
          leather,
          [0, 0, -0.32]
        );
        addBox(
          "harthmere-npc-hunter-fur-collar",
          [body.torsoWidth + 0.14, 0.068, 0.28],
          [0, torsoY + body.torsoHeight * 0.49, -0.02],
          trim
        );
      }
      if (robe) {
        addBox(
          "harthmere-npc-robe-sash",
          [0.068, torsoHeight * 1.02, 0.078],
          [-0.12, y, -0.235],
          palette.accent,
          [0, 0, -0.16]
        );
        addBox(
          "harthmere-npc-robe-center-fold",
          [0.04, torsoHeight * 0.92, 0.07],
          [0.08, y - 0.02, -0.242],
          trim
        );
      }
      if (apron) {
        addBox(
          "harthmere-npc-work-apron",
          [body.torsoWidth * 0.76, torsoHeight * 0.82, 0.074],
          [0, y - 0.02, -0.248],
          leather
        );
        addBox(
          "harthmere-npc-apron-pocket",
          [0.14, 0.09, 0.078],
          [0.11, body.legLength + 0.14, -0.295],
          dark
        );
      }
      if (merchant) {
        addBox(
          "harthmere-npc-merchant-left-lapel",
          [0.07, torsoHeight * 0.62, 0.075],
          [-0.12, y + 0.04, -0.248],
          trim,
          [0, 0, -0.08]
        );
        addBox(
          "harthmere-npc-merchant-right-lapel",
          [0.07, torsoHeight * 0.62, 0.075],
          [0.12, y + 0.04, -0.248],
          trim,
          [0, 0, 0.08]
        );
        addBox(
          "harthmere-npc-merchant-button-top",
          [0.04, 0.04, 0.08],
          [0, torsoY + 0.12, -0.287],
          metal
        );
        addBox(
          "harthmere-npc-merchant-button-bottom",
          [0.04, 0.04, 0.08],
          [0, torsoY - 0.04, -0.287],
          metal
        );
      }
      if (torn) {
        addBox(
          "harthmere-npc-torn-left-patch",
          [0.13, 0.11, 0.08],
          [-(body.torsoWidth * 0.24), torsoY - 0.04, -0.277],
          trim,
          [0, 0, -0.12]
        );
        addBox(
          "harthmere-npc-torn-right-patch",
          [0.11, 0.1, 0.08],
          [body.torsoWidth * 0.25, torsoY + 0.1, -0.277],
          dark,
          [0, 0, 0.16]
        );
      }
    } else if (slot === "legs") {
      const lx = -(body.torsoWidth / 4 + body.legSpread);
      const rx = body.torsoWidth / 4 + body.legSpread;
      const legY = body.legLength * 0.52;
      if (robe) {
        addBox(
          "harthmere-npc-robe-skirt-front",
          [body.torsoWidth + 0.1, body.legLength * 0.82, 0.058],
          [0, legY, -0.15],
          palette.tunic
        );
        addBox(
          "harthmere-npc-robe-skirt-split",
          [0.032, body.legLength * 0.68, 0.072],
          [0, legY - 0.05, -0.205],
          trim
        );
      } else {
        addBox(
          "harthmere-npc-left-trouser-front",
          [body.legWidth + 0.045, body.legLength * 0.84, 0.052],
          [lx, legY, -0.104],
          dark
        );
        addBox(
          "harthmere-npc-right-trouser-front",
          [body.legWidth + 0.045, body.legLength * 0.84, 0.052],
          [rx, legY, -0.104],
          dark
        );
        addBox(
          "harthmere-npc-left-knee",
          [body.legWidth + 0.06, 0.055, 0.06],
          [lx, body.legLength * 0.52, -0.135],
          armor ? metal : trim
        );
        addBox(
          "harthmere-npc-right-knee",
          [body.legWidth + 0.06, 0.055, 0.06],
          [rx, body.legLength * 0.52, -0.135],
          armor ? metal : trim
        );
      }
    } else if (slot === "feet") {
      const lx = -(body.torsoWidth / 4 + body.legSpread);
      const rx = body.torsoWidth / 4 + body.legSpread;
      addBox(
        "harthmere-npc-left-boot",
        [body.legWidth + 0.06, 0.085, 0.14],
        [lx, 0.06, -0.05],
        shadow
      );
      addBox(
        "harthmere-npc-right-boot",
        [body.legWidth + 0.06, 0.085, 0.14],
        [rx, 0.06, -0.05],
        shadow
      );
      addBox(
        "harthmere-npc-left-boot-cuff",
        [body.legWidth + 0.055, 0.045, 0.12],
        [lx, 0.13, -0.04],
        leather
      );
      addBox(
        "harthmere-npc-right-boot-cuff",
        [body.legWidth + 0.055, 0.045, 0.12],
        [rx, 0.13, -0.04],
        leather
      );
    } else if (slot === "hands") {
      addBox(
        "harthmere-npc-left-glove",
        [body.armWidth + 0.035, 0.08, 0.12],
        [-body.shoulderWidth / 2, shoulderY - body.armLength * 0.43, -0.03],
        leather
      );
      addBox(
        "harthmere-npc-right-glove",
        [body.armWidth + 0.035, 0.08, 0.12],
        [body.shoulderWidth / 2, shoulderY - body.armLength * 0.43, -0.03],
        leather
      );
      addBox(
        "harthmere-npc-left-bracer",
        [body.armWidth + 0.04, 0.05, 0.125],
        [-body.shoulderWidth / 2, shoulderY - body.armLength * 0.22, -0.03],
        trim
      );
      addBox(
        "harthmere-npc-right-bracer",
        [body.armWidth + 0.04, 0.05, 0.125],
        [body.shoulderWidth / 2, shoulderY - body.armLength * 0.22, -0.03],
        trim
      );
    } else if (slot === "belt") {
      addBox(
        "harthmere-npc-belt-wrap",
        [body.torsoWidth + 0.1, 0.048, 0.07],
        [0, body.legLength + 0.08, -0.14],
        leather
      );
      addBox(
        "harthmere-npc-belt-buckle",
        [0.065, 0.058, 0.028],
        [0, body.legLength + 0.08, -0.185],
        metal
      );
      addBox(
        "harthmere-npc-belt-left-pouch",
        [0.09, 0.11, 0.055],
        [-(body.torsoWidth * 0.36), body.legLength + 0.04, -0.155],
        dark
      );
      addBox(
        "harthmere-npc-belt-right-pouch",
        [0.08, 0.1, 0.055],
        [body.torsoWidth * 0.35, body.legLength + 0.035, -0.155],
        dark
      );
    } else if (slot === "back") {
      if (/cape|cloak|shroud/i.test(variant)) {
        addBox(
          "harthmere-npc-cape-panel",
          [
            body.torsoWidth + 0.14,
            body.torsoHeight + body.legLength * 0.52,
            0.05,
          ],
          [0, torsoY - body.legLength * 0.24, 0.17],
          torn ? dark : palette.accent
        );
        addBox(
          "harthmere-npc-cape-clasp",
          [0.11, 0.055, 0.06],
          [0, shoulderY + 0.04, -0.13],
          metal
        );
      } else {
        addBox(
          "harthmere-npc-backpack",
          [0.22, 0.31, 0.11],
          [0.04, torsoY + 0.04, 0.16],
          leather
        );
        if (/quiver/i.test(variant)) {
          addBox(
            "harthmere-npc-quiver-fletching",
            [0.15, 0.055, 0.075],
            [0.08, torsoY + 0.23, 0.19],
            trim
          );
        }
      }
    } else if (slot === "head" || slot === "hair") {
      if (/helmet|halfhelm|guard/i.test(variant)) {
        addBox(
          "harthmere-npc-helmet-bowl",
          [0.42, 0.1, 0.3],
          [0, headY + 0.2, -0.01],
          metal
        );
        addBox(
          "harthmere-npc-helmet-brow",
          [0.46, 0.035, 0.05],
          [0, headY + 0.15, -0.16],
          dark
        );
        addBox(
          "harthmere-npc-helmet-ridge",
          [0.065, 0.15, 0.075],
          [0, headY + 0.29, -0.01],
          palette.accent
        );
      } else if (/hood/i.test(variant)) {
        addBox(
          "harthmere-npc-hood-cap",
          [0.42, 0.16, 0.32],
          [0, headY + 0.18, 0.01],
          dark
        );
        addBox(
          "harthmere-npc-hood-drape",
          [0.36, 0.18, 0.055],
          [0, headY + 0.04, 0.13],
          dark
        );
      } else {
        addBox(
          "harthmere-npc-hat-brim",
          [0.5, 0.035, 0.38],
          [0, headY + 0.19, -0.01],
          trim
        );
        addBox(
          "harthmere-npc-hat-crown",
          [0.26, 0.12, 0.24],
          [0, headY + 0.27, -0.01],
          palette.accent
        );
      }
    } else if (slot === "face" && /mask/i.test(variant)) {
      addBox(
        "harthmere-npc-mask-main",
        [0.23, 0.052, 0.03],
        [0, headY + 0.02, -0.17],
        dark
      );
      addBox(
        "harthmere-npc-mask-left-tie",
        [0.07, 0.03, 0.03],
        [-0.15, headY + 0.02, -0.16],
        trim
      );
      addBox(
        "harthmere-npc-mask-right-tie",
        [0.07, 0.03, 0.03],
        [0.15, headY + 0.02, -0.16],
        trim
      );
    } else if (slot === "weapon") {
      if (/bow/i.test(variant)) {
        const bow = addBox(
          "harthmere-npc-bow",
          [0.04, 0.58, 0.045],
          [body.shoulderWidth / 2 + 0.08, shoulderY - 0.06, -0.06],
          leather,
          [0, 0, -0.24]
        );
        bow.userData.harthmereWeaponKind = "bow";
        addBox(
          "harthmere-npc-bow-string",
          [0.012, 0.52, 0.018],
          [body.shoulderWidth / 2 + 0.03, shoulderY - 0.06, -0.095],
          trim,
          [0, 0, -0.24]
        );
      } else if (/hammer|axe/i.test(variant)) {
        addBox(
          "harthmere-npc-tool-handle",
          [0.035, 0.46, 0.035],
          [body.shoulderWidth / 2 + 0.08, shoulderY - 0.18, -0.07],
          leather,
          [0, 0, -0.16]
        );
        addBox(
          "harthmere-npc-tool-head",
          [0.14, 0.08, 0.07],
          [body.shoulderWidth / 2 + 0.12, shoulderY + 0.04, -0.08],
          metal
        );
      } else {
        addBox(
          "harthmere-npc-sword-blade",
          [0.04, 0.48, 0.04],
          [body.shoulderWidth / 2 + 0.06, shoulderY - 0.18, -0.07],
          metal,
          [0, 0, -0.16]
        );
        addBox(
          "harthmere-npc-sword-hilt",
          [0.14, 0.04, 0.05],
          [body.shoulderWidth / 2 + 0.03, shoulderY - 0.36, -0.075],
          leather,
          [0, 0, -0.16]
        );
      }
    } else if (slot === "shield") {
      addBox(
        "harthmere-npc-shield-face",
        [0.2, 0.28, 0.055],
        [-(body.shoulderWidth / 2 + 0.08), shoulderY - 0.14, -0.11],
        metal
      );
      addBox(
        "harthmere-npc-shield-rim",
        [0.23, 0.035, 0.065],
        [-(body.shoulderWidth / 2 + 0.08), shoulderY, -0.135],
        dark
      );
      addBox(
        "harthmere-npc-shield-boss",
        [0.075, 0.075, 0.07],
        [-(body.shoulderWidth / 2 + 0.08), shoulderY - 0.14, -0.15],
        palette.accent
      );
    }
  }

  addLocalDevNpcOutwardClothingDetailLayer(root, clothing, palette, body);

  root.userData.harthmereModularClothingRuntime =
    "harthmere-modular-clothing-runtime-product-minecraft-polish";
  root.userData.harthmereClothingSlots = slots;
  root.userData.harthmereClothingFitMetrics = body;
  root.userData.harthmereThreeJsClothingRenderer =
    "harthmere-threejs-clothing-product-minecraft-polish";
  root.userData.harthmereProductMinecraftPolish =
    HARTHMERE_NPC_PRODUCT_MINECRAFT_POLISH_VERSION;
  root.userData.harthmereHiddenBodyZones = [...hiddenZones];
}

// HARTHMERE_NPC_CLOTHING_LAYER_AUDIT
//
// Runtime diagnostic for the "colored shell but no visible clothes" issue.
// It compares the current shell boxes against the current outward clothing/detail
// boxes and records whether details are outside, intersecting, or buried
// inside the shell.
//
// Look for root.userData.harthmereNpcClothingLayerAudit in the browser.
const HARTHMERE_NPC_CLOTHING_LAYER_AUDIT_VERSION =
  "harthmere-npc-clothing-layer-audit";

function auditLocalDevNpcClothingLayers(root: THREE.Object3D): void {
  const shellObjects: THREE.Object3D[] = [];
  const detailObjects: THREE.Object3D[] = [];

  root.traverse((object) => {
    const name = object.name ?? "";

    if (/visible-clothing-/.test(name)) {
      shellObjects.push(object);
    }

    if (/outward-/.test(name) || /outward-clothing-/.test(name)) {
      detailObjects.push(object);
    }
  });

  const shellBox = makeHarthmereLayerAuditBox(shellObjects);
  const detailBox = makeHarthmereLayerAuditBox(detailObjects);
  const hiddenDetails: Array<{
    name: string;
    center: [number, number, number];
    min: [number, number, number];
    max: [number, number, number];
  }> = [];
  const outsideDetails: string[] = [];
  const intersectingDetails: string[] = [];

  for (const object of detailObjects) {
    const box = new THREE.Box3().setFromObject(object);

    if (box.isEmpty()) {
      continue;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    const centerInsideShell = shellBox ? shellBox.containsPoint(center) : false;
    const intersectsShell = shellBox ? box.intersectsBox(shellBox) : false;
    const protrudesOutsideShell =
      shellBox &&
      (box.min.x < shellBox.min.x ||
        box.max.x > shellBox.max.x ||
        box.min.y < shellBox.min.y ||
        box.max.y > shellBox.max.y ||
        box.min.z < shellBox.min.z ||
        box.max.z > shellBox.max.z);

    if (centerInsideShell && !protrudesOutsideShell) {
      hiddenDetails.push({
        name: object.name,
        center: [center.x, center.y, center.z],
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
      });
    }

    if (protrudesOutsideShell) {
      outsideDetails.push(object.name);
    }

    if (intersectsShell) {
      intersectingDetails.push(object.name);
    }
  }

  const shellSummary = shellBox
    ? {
        min: [shellBox.min.x, shellBox.min.y, shellBox.min.z],
        max: [shellBox.max.x, shellBox.max.y, shellBox.max.z],
        size: [
          shellBox.max.x - shellBox.min.x,
          shellBox.max.y - shellBox.min.y,
          shellBox.max.z - shellBox.min.z,
        ],
      }
    : undefined;

  const detailSummary = detailBox
    ? {
        min: [detailBox.min.x, detailBox.min.y, detailBox.min.z],
        max: [detailBox.max.x, detailBox.max.y, detailBox.max.z],
        size: [
          detailBox.max.x - detailBox.min.x,
          detailBox.max.y - detailBox.min.y,
          detailBox.max.z - detailBox.min.z,
        ],
      }
    : undefined;

  const audit = {
    version: HARTHMERE_NPC_CLOTHING_LAYER_AUDIT_VERSION,
    shellCount: shellObjects.length,
    detailCount: detailObjects.length,
    outsideDetailCount: outsideDetails.length,
    intersectingDetailCount: intersectingDetails.length,
    hiddenDetailCount: hiddenDetails.length,
    shellSummary,
    detailSummary,
    outsideDetails: outsideDetails.slice(0, 16),
    hiddenDetails: hiddenDetails.slice(0, 16),
    likelyProblem:
      shellObjects.length > 0 && detailObjects.length === 0
        ? "shell-rendered-but-no-outward-detail-layer"
        : shellObjects.length > 0 &&
            hiddenDetails.length >=
              Math.max(1, Math.floor(detailObjects.length * 0.6))
          ? "details-mostly-inside-shell"
          : shellObjects.length === 0 && detailObjects.length === 0
            ? "no-shell-or-detail-rendered-on-this-path"
            : "details-present",
  };

  root.userData.harthmereNpcClothingLayerAudit = audit;

  if (
    audit.likelyProblem !== "details-present" &&
    typeof console !== "undefined"
  ) {
    console.warn("Harthmere NPC clothing layer audit", {
      npc: root.name,
      audit,
    });
  }
}

function makeHarthmereLayerAuditBox(
  objects: THREE.Object3D[]
): THREE.Box3 | undefined {
  let box: THREE.Box3 | undefined;

  for (const object of objects) {
    const next = new THREE.Box3().setFromObject(object);

    if (next.isEmpty()) {
      continue;
    }

    if (!box) {
      box = next.clone();
    } else {
      box.union(next);
    }
  }

  return box;
}

// HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER
//
// current correctly guaranteed clothing coverage for tall NPCs, but that shell can
// visually overpower smaller role-specific details. This current layer renders
// bold details *outside* the shell so clothing reads as clothing on tall,
// broad, and unusual-proportion NPCs.
//
// This is intentionally not GLTF-dependent. It is a Minecraft-like product
// polish layer made of simple Three.js voxel pieces that sit slightly farther
// from the body than the base shell.
const HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER_VERSION =
  "harthmere-npc-outward-clothing-detail-layer";

function localDevVoxelBoxWithRotation(
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
  rotation?: readonly [number, number, number]
): THREE.Object3D {
  const object = localDevVoxelBox(
    name,
    size as [number, number, number],
    position as [number, number, number],
    color
  );

  if (rotation) {
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  return object;
}

function addLocalDevNpcOutwardClothingDetailLayer(
  root: THREE.Group,
  clothing: HarthmereCharacterClothing,
  palette: LocalDevVoxelPalette,
  body: ReturnType<typeof localDevNpcBodyScales>
): void {
  const slots = Object.keys(clothing ?? {}) as HarthmereClothingSlot[];

  if (slots.length === 0) {
    return;
  }

  const signature = harthmereNpcClothingSignature(root, clothing);
  const role = inferHarthmereNpcClothingRole(signature);
  const variant = Math.abs(hashHarthmereNpcClothingSignature(signature)) % 5;

  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.84;
  const waistY = body.legLength + 0.09;
  const torsoHeight = Math.max(body.torsoHeight + 0.15, 0.7);
  const torsoWidth = Math.max(body.torsoWidth + 0.18, 0.56);
  const torsoDepth = Math.max((body as any).torsoDepth ?? 0.28, 0.26);
  const frontZ = -(torsoDepth / 2 + 0.095);
  const backZ = torsoDepth / 2 + 0.095;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const legWidth = Math.max(body.legWidth + 0.075, 0.15);
  const legLength = Math.max(body.legLength * 0.92, 0.52);
  const legY = Math.max(body.legLength * 0.52, 0.3);

  const colors = getHarthmereNpcOutwardClothingColors(role, variant, palette);
  const trim = colors.trim;
  const cloth = colors.cloth;
  const dark = colors.dark;
  const metal = colors.metal;
  const leather = colors.leather;

  // Always-visible outer garment: not a full shell, but readable front/back
  // panels with trim. These sit outside current and role details.
  if (clothing.torso) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-front-panel",
        [torsoWidth * 0.74, torsoHeight * 0.92, 0.045],
        [0, torsoY, frontZ],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-back-panel",
        [torsoWidth * 0.74, torsoHeight * 0.88, 0.045],
        [0, torsoY, backZ],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-front-trim",
        [torsoWidth * 0.78, 0.045, 0.055],
        [0, torsoY + torsoHeight * 0.42, frontZ - 0.018],
        trim
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-bottom-trim",
        [torsoWidth * 0.8, 0.045, 0.055],
        [0, torsoY - torsoHeight * 0.43, frontZ - 0.018],
        trim
      )
    );
  }

  if (clothing.legs) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-pant-front",
        [legWidth, legLength, 0.055],
        [-legX, legY, frontZ + 0.035],
        dark
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-pant-front",
        [legWidth, legLength, 0.055],
        [legX, legY, frontZ + 0.035],
        dark
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-knee-trim",
        [legWidth + 0.03, 0.045, 0.065],
        [-legX, body.legLength * 0.46, frontZ + 0.015],
        trim
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-knee-trim",
        [legWidth + 0.03, 0.045, 0.065],
        [legX, body.legLength * 0.46, frontZ + 0.015],
        trim
      )
    );
  }

  if (clothing.feet) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-boot",
        [legWidth + 0.06, 0.12, 0.23],
        [-legX, 0.075, frontZ + 0.02],
        0x101010
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-boot",
        [legWidth + 0.06, 0.12, 0.23],
        [legX, 0.075, frontZ + 0.02],
        0x101010
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-boot-cuff",
        [legWidth + 0.07, 0.045, 0.2],
        [-legX, 0.145, frontZ + 0.02],
        leather
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-boot-cuff",
        [legWidth + 0.07, 0.045, 0.2],
        [legX, 0.145, frontZ + 0.02],
        leather
      )
    );
  }

  if (clothing.belt) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-belt",
        [torsoWidth + 0.08, 0.065, 0.07],
        [0, waistY, frontZ - 0.032],
        leather
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-buckle",
        [0.08, 0.075, 0.04],
        [0, waistY, frontZ - 0.07],
        metal
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-pouch",
        [0.11, 0.13, 0.055],
        [-torsoWidth * 0.31, waistY - 0.08, frontZ - 0.055],
        leather
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-pouch",
        [0.11, 0.13, 0.055],
        [torsoWidth * 0.31, waistY - 0.08, frontZ - 0.055],
        leather
      )
    );
  }

  if (clothing.hands) {
    const armWidth = Math.max((body as any).armWidth ?? 0.1, 0.09);
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-left-cuff",
        [armWidth + 0.05, 0.09, 0.13],
        [
          -(body.shoulderWidth / 2 + 0.025),
          shoulderY - body.armLength * 0.58,
          frontZ + 0.03,
        ],
        trim
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clothing-right-cuff",
        [armWidth + 0.05, 0.09, 0.13],
        [
          body.shoulderWidth / 2 + 0.025,
          shoulderY - body.armLength * 0.58,
          frontZ + 0.03,
        ],
        trim
      )
    );
  }

  // Role identity layer. These read from a distance and make NPCs distinct.
  if (role === "guard") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-guard-left-pauldron",
        [0.16, 0.09, 0.16],
        [-(body.shoulderWidth / 2 + 0.04), shoulderY + 0.03, -0.02],
        metal
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-guard-right-pauldron",
        [0.16, 0.09, 0.16],
        [body.shoulderWidth / 2 + 0.04, shoulderY + 0.03, -0.02],
        metal
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-guard-tabard-stripe",
        [0.09, torsoHeight * 0.76, 0.06],
        [0, torsoY, frontZ - 0.05],
        trim
      )
    );
  } else if (role === "hunter") {
    root.add(
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-hunter-diagonal-strap",
        [0.075, torsoHeight * 1.05, 0.06],
        [-0.05, torsoY, frontZ - 0.055],
        leather,
        [0, 0, -0.35]
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-hunter-quiver",
        [0.15, 0.38, 0.11],
        [torsoWidth * 0.28, torsoY + 0.06, backZ + 0.04],
        leather
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-hunter-fur-collar",
        [torsoWidth * 0.78, 0.075, 0.08],
        [0, torsoY + torsoHeight * 0.48, frontZ - 0.045],
        0x6d5744
      )
    );
  } else if (role === "farmer" || role === "worker") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-worker-apron",
        [torsoWidth * 0.62, torsoHeight * 0.82, 0.06],
        [0, torsoY - 0.04, frontZ - 0.055],
        0x6c5a3d
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-worker-neck-strap",
        [0.06, 0.28, 0.055],
        [0, torsoY + torsoHeight * 0.35, frontZ - 0.07],
        leather
      ),
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-worker-tool",
        [0.04, 0.28, 0.04],
        [torsoWidth * 0.4, waistY - 0.06, frontZ - 0.06],
        metal,
        [0, 0, 0.15]
      )
    );
  } else if (role === "merchant") {
    root.add(
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-merchant-left-lapel",
        [0.09, torsoHeight * 0.48, 0.055],
        [-torsoWidth * 0.17, torsoY + 0.08, frontZ - 0.055],
        trim,
        [0, 0, -0.18]
      ),
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-merchant-right-lapel",
        [0.09, torsoHeight * 0.48, 0.055],
        [torsoWidth * 0.17, torsoY + 0.08, frontZ - 0.055],
        trim,
        [0, 0, 0.18]
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-merchant-coin-pouch",
        [0.12, 0.14, 0.06],
        [torsoWidth * 0.24, waistY - 0.1, frontZ - 0.07],
        0xb8913f
      )
    );
  } else if (role === "clergy" || role === "scholar") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-outward-clergy-robe-center",
        [0.085, torsoHeight * 0.96, 0.065],
        [0, torsoY - 0.02, frontZ - 0.06],
        trim
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clergy-left-sleeve-band",
        [0.13, 0.055, 0.055],
        [
          -(body.shoulderWidth / 2 + 0.03),
          shoulderY - body.armLength * 0.35,
          frontZ + 0.03,
        ],
        trim
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-clergy-right-sleeve-band",
        [0.13, 0.055, 0.055],
        [
          body.shoulderWidth / 2 + 0.03,
          shoulderY - body.armLength * 0.35,
          frontZ + 0.03,
        ],
        trim
      )
    );
  } else if (role === "bandit" || role === "hostile") {
    root.add(
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-bandit-torn-sash",
        [0.075, torsoHeight * 0.92, 0.06],
        [0.04, torsoY - 0.02, frontZ - 0.06],
        0x7b2525,
        [0, 0, 0.25]
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-bandit-mask",
        [0.25, 0.06, 0.045],
        [0, body.legLength + body.torsoHeight + 0.16, frontZ - 0.02],
        0x171717
      )
    );
  } else if (role === "undead") {
    root.add(
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-undead-bandage-a",
        [torsoWidth * 0.72, 0.055, 0.06],
        [0, torsoY + 0.17, frontZ - 0.06],
        0xc8c1a6,
        [0, 0, 0.12]
      ),
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-undead-bandage-b",
        [torsoWidth * 0.66, 0.055, 0.06],
        [0, torsoY - 0.1, frontZ - 0.06],
        0xb7ae93,
        [0, 0, -0.16]
      )
    );
  } else {
    // Civilians still need visual variety.
    const sashX = variant % 2 === 0 ? -0.09 : 0.09;
    root.add(
      localDevVoxelBoxWithRotation(
        "harthmere-npc-outward-civilian-sash",
        [0.07, torsoHeight * 0.9, 0.055],
        [sashX, torsoY, frontZ - 0.055],
        trim,
        [0, 0, variant % 2 === 0 ? -0.18 : 0.18]
      ),
      localDevVoxelBox(
        "harthmere-npc-outward-civilian-pocket",
        [0.1, 0.1, 0.055],
        [-sashX * 2.4, waistY - 0.08, frontZ - 0.055],
        leather
      )
    );
  }

  root.userData.harthmereNpcOutwardClothingDetailLayer =
    HARTHMERE_NPC_OUTWARD_CLOTHING_DETAIL_LAYER_VERSION;
  root.userData.harthmereNpcOutwardClothingDetailRole = role;
  root.userData.harthmereNpcOutwardClothingDetailVariant = variant;
  auditLocalDevNpcClothingLayers(root);
}

function harthmereNpcClothingSignature(
  root: THREE.Object3D,
  clothing: HarthmereCharacterClothing
): string {
  return [
    root.name,
    root.userData?.id,
    root.userData?.entityId,
    root.userData?.harthmereRole,
    ...Object.values(clothing ?? {}).map(
      (item: any) => item?.id ?? item?.displayName ?? ""
    ),
  ].join("|");
}

function inferHarthmereNpcClothingRole(signature: string): string {
  const value = signature.toLowerCase();

  if (
    value.includes("guard") ||
    value.includes("armor") ||
    value.includes("tabard")
  )
    return "guard";
  if (
    value.includes("hunter") ||
    value.includes("ranger") ||
    value.includes("fur") ||
    value.includes("cloak")
  )
    return "hunter";
  if (
    value.includes("farmer") ||
    value.includes("worker") ||
    value.includes("apron") ||
    value.includes("tool")
  )
    return "farmer";
  if (
    value.includes("merchant") ||
    value.includes("coat") ||
    value.includes("pouch")
  )
    return "merchant";
  if (
    value.includes("clergy") ||
    value.includes("scholar") ||
    value.includes("robe")
  )
    return "clergy";
  if (
    value.includes("bandit") ||
    value.includes("hostile") ||
    value.includes("torn")
  )
    return "bandit";
  if (
    value.includes("undead") ||
    value.includes("bone") ||
    value.includes("grave")
  )
    return "undead";

  return "civilian";
}

function hashHarthmereNpcClothingSignature(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash | 0;
}

function getHarthmereNpcOutwardClothingColors(
  role: string,
  variant: number,
  palette: LocalDevVoxelPalette
): {
  cloth: number;
  trim: number;
  dark: number;
  leather: number;
  metal: number;
} {
  const rolePalettes: Record<string, readonly [number, number]> = {
    guard: [0x355072, 0xc1a35a],
    hunter: [0x3e5c37, 0x8f6a3c],
    farmer: [0x6c5a3d, 0xb58a4a],
    worker: [0x6c5a3d, 0xb58a4a],
    merchant: [0x4e3b73, 0xd1a64e],
    clergy: [0x483f63, 0xc9c3ad],
    scholar: [0x3f4d63, 0xc9c3ad],
    bandit: [0x3d3232, 0x9b2f2f],
    hostile: [0x3d3232, 0x9b2f2f],
    undead: [0x4d5144, 0xc8c1a6],
    civilian: [
      Number((palette as any).tunic ?? 0x356b8f),
      Number((palette as any).accent ?? 0x9c7048),
    ],
  };

  const base = rolePalettes[role] ?? rolePalettes.civilian;
  const shift = variant * 0x050505;

  return {
    cloth: (base[0] + shift) & 0xffffff,
    trim: base[1],
    dark: Number((palette as any).legs ?? 0x242833),
    leather: 0x3b2418,
    metal: 0xb8b2a4,
  };
}

// HARTHMERE_TALL_NPC_CLOTHING_VISIBILITY
//
// Some tall/broad NPCs had clothing assigned but still looked naked because
// the role-detail meshes did not fully wrap the body. This guarantee creates
// a body-sized outer shell for core clothing slots before role-specific polish
// is layered on top.
//
// It is intentionally conservative: it only renders when clothing slots exist,
// and it does not remove the current product-polish details.
const HARTHMERE_TALL_NPC_CLOTHING_VISIBILITY_VERSION =
  "harthmere-tall-npc-clothing-visibility";

function addLocalDevNpcVisibleClothingGuarantee(
  root: THREE.Group,
  clothing: HarthmereCharacterClothing,
  palette: LocalDevVoxelPalette,
  body: ReturnType<typeof localDevNpcBodyScales>
): void {
  const slots = Object.keys(clothing ?? {}) as HarthmereClothingSlot[];

  if (slots.length === 0) {
    return;
  }

  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.82;
  const torsoHeight = Math.max(body.torsoHeight + 0.11, 0.66);
  const torsoWidth = Math.max(body.torsoWidth + 0.12, 0.48);
  const torsoDepth = Math.max((body as any).torsoDepth ?? 0.26, 0.24);
  const legWidth = Math.max(body.legWidth + 0.055, 0.13);
  const legLength = Math.max(body.legLength * 0.92, 0.5);
  const legCenterY = Math.max(body.legLength * 0.52, 0.28);
  const legX = body.torsoWidth / 4 + body.legSpread;
  const cloth = Number(palette.tunic ?? 0x356b8f);
  const legCloth = Number(palette.legs ?? 0x2f3f4d);
  const accent = Number(palette.accent ?? 0x9c7048);
  const leather = 0x3b2418;
  const dark = 0x151515;

  // Core torso shell: front, back, and side panels so tall NPCs do not look
  // unclothed from side/rear camera angles.
  if (clothing.torso) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-torso-front",
        [torsoWidth, torsoHeight, 0.06],
        [0, torsoY, -(torsoDepth / 2 + 0.035)],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-torso-back",
        [torsoWidth, torsoHeight, 0.06],
        [0, torsoY, torsoDepth / 2 + 0.035],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-torso-left",
        [0.06, torsoHeight, torsoDepth + 0.09],
        [-(torsoWidth / 2), torsoY, 0],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-torso-right",
        [0.06, torsoHeight, torsoDepth + 0.09],
        [torsoWidth / 2, torsoY, 0],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-collar",
        [torsoWidth + 0.035, 0.04, torsoDepth + 0.11],
        [0, torsoY + torsoHeight * 0.48, -0.005],
        accent
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-hem",
        [torsoWidth + 0.045, 0.045, torsoDepth + 0.12],
        [0, torsoY - torsoHeight * 0.49, -0.005],
        accent
      )
    );
  }

  // Leg shell: longer than the old proxy and visible from all camera angles.
  if (clothing.legs) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-left-leg",
        [legWidth, legLength, 0.16],
        [-legX, legCenterY, -0.025],
        legCloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-right-leg",
        [legWidth, legLength, 0.16],
        [legX, legCenterY, -0.025],
        legCloth
      )
    );
  }

  if (clothing.feet) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-left-foot",
        [legWidth + 0.04, 0.095, 0.2],
        [-legX, 0.055, -0.035],
        dark
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-right-foot",
        [legWidth + 0.04, 0.095, 0.2],
        [legX, 0.055, -0.035],
        dark
      )
    );
  }

  if (clothing.belt) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-belt",
        [torsoWidth + 0.06, 0.06, torsoDepth + 0.14],
        [0, body.legLength + 0.09, -0.005],
        leather
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-buckle",
        [0.075, 0.07, 0.035],
        [0, body.legLength + 0.09, -(torsoDepth / 2 + 0.08)],
        0xb8b2a4
      )
    );
  }

  if (clothing.hands) {
    const armWidth = Math.max((body as any).armWidth ?? 0.1, 0.09);
    const armLength = Math.max(body.armLength * 0.62, 0.38);

    root.add(
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-left-sleeve",
        [armWidth + 0.045, armLength, 0.13],
        [
          -(body.shoulderWidth / 2 + 0.015),
          shoulderY - armLength * 0.48,
          -0.03,
        ],
        cloth
      ),
      localDevVoxelBox(
        "harthmere-npc-visible-clothing-right-sleeve",
        [armWidth + 0.045, armLength, 0.13],
        [body.shoulderWidth / 2 + 0.015, shoulderY - armLength * 0.48, -0.03],
        cloth
      )
    );
  }

  root.userData.harthmereTallNpcClothingVisibility =
    HARTHMERE_TALL_NPC_CLOTHING_VISIBILITY_VERSION;
  root.userData.harthmereTallNpcClothingVisibilitySlots = slots;
  root.userData.harthmereTallNpcClothingVisibilityBody = {
    torsoWidth: body.torsoWidth,
    torsoHeight: body.torsoHeight,
    shoulderWidth: body.shoulderWidth,
    legLength: body.legLength,
    legWidth: body.legWidth,
    bodyType: (body as any).bodyType,
    bodyHeight: (body as any).bodyHeight,
  };
}

function addLocalDevNpcUniqueEnhancementDetails(
  root: THREE.Group,
  id: BiomesId,
  label: string | undefined,
  palette: LocalDevVoxelPalette,
  body: ReturnType<typeof localDevNpcBodyScales>,
  appearance: HarthmereCharacterAppearance
) {
  const seed = localDevFaceSeed(id, label);
  const side = (seed & 1) === 0 ? -1 : 1;
  const opposite = -side;
  const torsoY = body.legLength + body.torsoHeight / 2 + body.stanceYOffset;
  const shoulderY = body.legLength + body.torsoHeight * 0.62;
  const leather = harthmereNpcColorDarken(palette.tunic, 0.42);
  const trim = harthmereNpcColorLighten(palette.tunic, 0.28);
  const metal = 0xb8b2a4;
  const labelText = (label ?? "").toLowerCase();
  const headY = body.legLength + body.torsoHeight + body.stanceYOffset + 0.22;

  if (
    /\b(mucked robot|buddy|service robot|robots?|bots?|sentinels?|sententials?|sentientals?)\b/.test(
      labelText
    )
  ) {
    const glow = /mucked/.test(labelText) ? 0xb86bff : 0x66ddff;
    root.add(
      localDevVoxelBox(
        "harthmere-grove-robot-antenna",
        [0.035, 0.24, 0.035],
        [side * 0.11, headY + 0.16, -0.01],
        metal
      ),
      localDevVoxelBox(
        "harthmere-grove-robot-antenna-dot",
        [0.07, 0.055, 0.07],
        [side * 0.11, headY + 0.3, -0.01],
        glow
      ),
      localDevVoxelBox(
        "harthmere-grove-robot-chest-core",
        [0.11, 0.11, 0.026],
        [0, torsoY + 0.08, -0.15],
        glow
      ),
      localDevVoxelBox(
        "harthmere-grove-robot-shoulder-panel",
        [0.12, 0.1, 0.07],
        [opposite * (body.shoulderWidth / 2 + 0.035), shoulderY + 0.01, -0.02],
        metal
      ),
      localDevVoxelBox(
        "harthmere-grove-robot-knee-patch",
        [0.08, 0.06, 0.03],
        [side * 0.09, body.legLength * 0.47, -0.09],
        glow
      )
    );
    root.userData.harthmereGroveRobotUniqueVisualVersion =
      "harthmere-grove-robot-unique";
  }

  if (/^doc\b|doctor|medic/.test(labelText)) {
    root.add(
      localDevVoxelBox(
        "harthmere-grove-doc-cross-patch",
        [0.09, 0.09, 0.024],
        [side * 0.11, torsoY + 0.13, -0.15],
        0xfff2d6
      ),
      localDevVoxelBox(
        "harthmere-grove-doc-vial",
        [0.035, 0.14, 0.035],
        [opposite * (body.torsoWidth / 2 + 0.07), torsoY - 0.02, -0.06],
        0x76e0d6
      )
    );
  }

  if (/^billy\b|courier|kit/.test(labelText)) {
    const strap = localDevVoxelBox(
      "harthmere-grove-courier-strap",
      [0.04, body.torsoHeight + 0.18, 0.035],
      [side * 0.02, torsoY, -0.155],
      leather
    );
    strap.rotation.z = side * 0.42;
    root.add(
      strap,
      localDevVoxelBox(
        "harthmere-grove-courier-road-badge",
        [0.06, 0.05, 0.025],
        [opposite * 0.11, torsoY + 0.16, -0.16],
        0xffd24c
      )
    );
  }

  if (/mira|fern|repair|land steward|thatch/.test(labelText)) {
    root.add(
      localDevVoxelBox(
        "harthmere-grove-builder-hammer-head",
        [0.13, 0.055, 0.055],
        [side * (body.torsoWidth / 2 + 0.11), body.legLength + 0.22, -0.04],
        metal
      ),
      localDevVoxelBox(
        "harthmere-grove-builder-hammer-handle",
        [0.035, 0.22, 0.035],
        [side * (body.torsoWidth / 2 + 0.11), body.legLength + 0.11, -0.04],
        leather
      )
    );
  }

  if (/nia|merl|banker|rosalyn|clerk|mel/.test(labelText)) {
    root.add(
      localDevVoxelBox(
        "harthmere-grove-ledger-book",
        [0.15, 0.11, 0.045],
        [side * (body.torsoWidth / 2 + 0.08), torsoY + 0.01, -0.09],
        0x6b4f2f
      ),
      localDevVoxelBox(
        "harthmere-grove-ledger-page",
        [0.13, 0.09, 0.018],
        [side * (body.torsoWidth / 2 + 0.081), torsoY + 0.012, -0.118],
        0xf2e1b8
      )
    );
  }

  if (/carlo|cook|gus|baker/.test(labelText)) {
    root.add(
      localDevVoxelBox(
        "harthmere-grove-cook-apron-front",
        [0.2, 0.28, 0.024],
        [0, torsoY - 0.02, -0.155],
        0xf2e1b8
      ),
      localDevVoxelBox(
        "harthmere-grove-cook-pan",
        [0.16, 0.035, 0.16],
        [side * (body.torsoWidth / 2 + 0.13), body.legLength + 0.18, -0.03],
        0x333333
      )
    );
  }

  root.add(
    localDevVoxelBox(
      "harthmere-npc-unique-shoulder-cloak",
      [0.13, 0.26 + ((seed >>> 4) % 4) * 0.025, 0.05],
      [side * (body.shoulderWidth / 2 - 0.03), shoulderY - 0.02, 0.105],
      (seed >>> 9) % 3 === 0 ? palette.accent : trim
    ),
    localDevVoxelBox(
      "harthmere-npc-unique-chest-patch",
      [0.07 + ((seed >>> 12) % 2) * 0.025, 0.09, 0.022],
      [opposite * 0.1, torsoY + 0.06, -0.13],
      (seed >>> 15) % 2 === 0 ? palette.accent : palette.hair
    ),
    localDevVoxelBox(
      "harthmere-npc-unique-pouch",
      [0.09, 0.12, 0.07],
      [opposite * (body.torsoWidth / 2 + 0.04), body.legLength + 0.04, 0.08],
      leather
    )
  );

  if (((seed >>> 18) & 1) === 1) {
    const bandolier = localDevVoxelBox(
      "harthmere-npc-unique-bandolier",
      [0.045, body.torsoHeight + 0.1, 0.04],
      [side * 0.04, torsoY, -0.13],
      leather
    );
    bandolier.rotation.z = side * 0.36;
    root.add(bandolier);
  }

  if (appearance.role === "guard") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-unique-guard-medal",
        [0.045, 0.06, 0.02],
        [side * 0.08, torsoY + 0.14, -0.145],
        metal
      )
    );
  } else if (appearance.role === "merchant") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-unique-ledger-roll",
        [0.13, 0.07, 0.06],
        [side * (body.torsoWidth / 2 + 0.08), torsoY - 0.04, 0.09],
        0xd8c49a
      )
    );
  } else if (appearance.role === "farmer") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-unique-rope-coil",
        [0.12, 0.12, 0.04],
        [side * (body.torsoWidth / 2 + 0.06), body.legLength + 0.16, 0.09],
        0xb99655
      )
    );
  } else if (appearance.role === "bandit" || appearance.role === "hostile") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-unique-red-sash-knot",
        [0.08, 0.08, 0.045],
        [side * 0.14, body.legLength + 0.11, -0.135],
        0x8b2f2d
      )
    );
  } else if (appearance.role === "undead") {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-unique-bone-charm",
        [0.035, 0.12, 0.025],
        [side * 0.11, torsoY + 0.03, -0.145],
        0xd8d3c1
      )
    );
  }

  root.userData.harthmereNpcUniqueVisualVersion =
    "harthmere-unique-npc-cosmetics-distinct-crowd";
}

function localDevNpcBodyScales(body: HarthmereVoxelBodyConfig) {
  const bodyType = {
    average: {
      torsoWidth: 0.38,
      torsoHeight: 0.52,
      armWidth: 0.09,
      legWidth: 0.12,
    },
    slim: {
      torsoWidth: 0.32,
      torsoHeight: 0.55,
      armWidth: 0.075,
      legWidth: 0.1,
    },
    broad: {
      torsoWidth: 0.47,
      torsoHeight: 0.54,
      armWidth: 0.105,
      legWidth: 0.13,
    },
    stocky: {
      torsoWidth: 0.5,
      torsoHeight: 0.47,
      armWidth: 0.11,
      legWidth: 0.14,
    },
    athletic: {
      torsoWidth: 0.43,
      torsoHeight: 0.58,
      armWidth: 0.1,
      legWidth: 0.12,
    },
    soft: {
      torsoWidth: 0.44,
      torsoHeight: 0.52,
      armWidth: 0.095,
      legWidth: 0.13,
    },
  }[body.bodyType];
  const heightScale =
    body.bodyHeight === "very_tall"
      ? 1.16
      : body.bodyHeight === "tall"
        ? 1.08
        : body.bodyHeight === "short"
          ? 0.92
          : 1;
  const shoulderExtra =
    body.shoulderWidth === "wide"
      ? 0.11
      : body.shoulderWidth === "narrow"
        ? -0.06
        : 0;
  const armLength =
    body.armLength === "long" ? 0.54 : body.armLength === "short" ? 0.38 : 0.46;
  const legLength =
    body.legLength === "long" ? 0.5 : body.legLength === "short" ? 0.34 : 0.42;
  return {
    ...bodyType,
    heightScale,
    shoulderWidth: bodyType.torsoWidth + 0.18 + shoulderExtra,
    armLength,
    legLength,
    legSpread:
      body.stance === "heroic"
        ? 0.065
        : body.stance === "reserved"
          ? 0.035
          : 0.045,
    stanceYOffset:
      body.stance === "heroic"
        ? 0.025
        : body.stance === "reserved"
          ? -0.015
          : 0,
  };
}

function addLocalDevVoxelNpcAnchor(
  root: THREE.Object3D,
  name: string,
  position: [number, number, number]
) {
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.set(...position);
  // Anchor groups are non-rendering attachment points. Weapons, shields, name
  // plates, and future emote props can resolve these names without needing to
  // know whether the NPC came from ECS, runtime placements, or a GLTF body.
  root.add(anchor);
}

function addLocalDevVoxelNpcAnchors(
  root: THREE.Object3D,
  body: ReturnType<typeof localDevNpcBodyScales>
) {
  const shoulderY = body.legLength + body.torsoHeight * 0.72;
  const headY = body.legLength + body.torsoHeight + 0.16;
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-head", [0, headY, -0.01]);
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-neck", [
    0,
    headY - 0.18,
    -0.005,
  ]);
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-right-hand", [
    body.shoulderWidth / 2 + 0.04,
    shoulderY - body.armLength / 2,
    -0.03,
  ]);
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-left-hand", [
    -(body.shoulderWidth / 2 + 0.04),
    shoulderY - body.armLength / 2,
    -0.03,
  ]);
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-hip", [
    0.16,
    body.legLength + 0.08,
    0.1,
  ]);
  addLocalDevVoxelNpcAnchor(root, "harthmere-anchor-back", [
    0,
    body.legLength + body.torsoHeight * 0.7,
    0.14,
  ]);
}

function makeLocalDevVoxelNpcGltf(
  deps: ClientResourceDeps,
  id: BiomesId
): GLTF {
  const label = deps.get("/ecs/c/label", id)?.text;
  const description = deps.get("/ecs/c/entity_description", id)?.text;
  const parsedAppearance = parseHarthmereAppearanceMarker(description);
  const generatedAppearance = makeHarthmereNpcAppearanceConfig({
    id,
    name: label ?? `npc-${id}`,
    roleHint: description,
    forwardAxis: "minusZ",
    source: "ecs:npc-generated",
  });
  const legacyFace = parseHarthmereFaceMarker(description);
  const legacyBody = parseHarthmereBodyMarker(description);
  const appearance: HarthmereCharacterAppearance =
    normalizeHarthmereCharacterAppearance({
      ...(parsedAppearance ?? generatedAppearance),
      // Older saved NPC descriptions may only have face/body markers. Let those
      // override generated appearance while still keeping the new role/axis/anchor
      // schema intact.
      face: legacyFace ?? parsedAppearance?.face ?? generatedAppearance.face,
      body: legacyBody ?? parsedAppearance?.body ?? generatedAppearance.body,
      source: parsedAppearance ? "ecs:npc-marker" : generatedAppearance.source,
    });
  const faceConfig = appearance.face;
  const bodyConfig = appearance.body;
  const body = localDevNpcBodyScales(bodyConfig);
  const palette = localDevVoxelPalette(id, label, faceConfig);
  const root = new THREE.Group();
  root.name = `harthmere-voxel-npc-${id}`;
  root.userData.harthmereAppearance = appearance;
  root.userData.harthmereForwardAxis = appearance.forwardAxis;
  root.userData.harthmereAnchors = appearance.anchors;
  root.scale.y = body.heightScale;

  root.add(
    localDevVoxelBox(
      "harthmere-npc-left-leg",
      [body.legWidth, body.legLength, 0.12],
      [-(body.torsoWidth / 4 + body.legSpread), body.legLength / 2, 0],
      palette.legs
    ),
    localDevVoxelBox(
      "harthmere-npc-right-leg",
      [body.legWidth, body.legLength, 0.12],
      [body.torsoWidth / 4 + body.legSpread, body.legLength / 2, 0],
      palette.legs
    ),
    localDevVoxelBox(
      "harthmere-npc-body",
      [body.torsoWidth, body.torsoHeight, 0.2],
      [0, body.legLength + body.torsoHeight / 2 + body.stanceYOffset, 0],
      palette.tunic
    ),
    localDevVoxelBox(
      "harthmere-npc-left-arm",
      [body.armWidth, body.armLength, 0.1],
      [-body.shoulderWidth / 2, body.legLength + body.torsoHeight * 0.62, 0],
      palette.skin
    ),
    localDevVoxelBox(
      "harthmere-npc-right-arm",
      [body.armWidth, body.armLength, 0.1],
      [body.shoulderWidth / 2, body.legLength + body.torsoHeight * 0.62, 0],
      palette.skin
    ),
    ...localDevVoxelFaceParts(id, label, palette, faceConfig)
  );
  addLocalDevVoxelNpcAnchors(root, body);
  addLocalDevNpcModularClothingDetails(
    root,
    appearance.clothing,
    palette,
    body
  );
  addLocalDevNpcUniqueEnhancementDetails(
    root,
    id,
    label,
    palette,
    body,
    appearance
  );
  const animations = makeLocalDevVoxelNpcAnimationClips();
  recordHarthmereNpcAnimationLoadCheck(root, animations);

  const offset = localDevNpcOffset(id);
  if ([27, 39, 44, 45, 56, 69].includes(offset)) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-guard-tabard",
        [0.4, 0.12, 0.22],
        [0, 0.9, -0.02],
        0x141414
      )
    );
  } else if ([43, 57].includes(offset)) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-satchel",
        [0.18, 0.18, 0.08],
        [-0.24, 0.7, 0.13],
        0x7a4f2a
      )
    );
  } else if ([10, 37, 63, 64].includes(offset)) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-hat",
        [0.42, 0.06, 0.36],
        [0, 1.33, -0.01],
        palette.accent
      )
    );
  } else if ([31, 46, 66].includes(offset)) {
    root.add(
      localDevVoxelBox(
        "harthmere-npc-clergy-sash",
        [0.08, 0.54, 0.22],
        [-0.1, 0.68, -0.03],
        palette.accent
      )
    );
  }

  return {
    scene: root,
    scenes: [root],
    animations,
    cameras: [],
    asset: { version: "2.0", generator: "harthmere-local-dev-voxel-npc" },
    parser: undefined as never,
    userData: {},
  };
}

export async function makeNpcTypeMesh(type: BiomesId) {
  const npcType = idToNpcType(type);

  ok(!npcType.isPlayerLikeAppearance);
  ok(npcType.galoisPath, `Could not find galoisPath for ${type}`);

  const url = resolveAssetUrlUntyped(npcType.galoisPath);
  if (!url) {
    throw new Error(
      `Failed to lookup URL for galoisPath ${npcType.galoisPath}, type ${type}.`
    );
  }
  const gltf = await loadGltf(url);

  replaceWithPlayerMaterial(gltf);
  // We will do frustum culling for NPCs manually, so no-need for three.js
  // to re-do this work.
  setFrustumCulling(gltf, false);

  return makeDisposable(gltf, () => {
    gltfDispose(gltf);
  });
}

async function makeSnapshotGroveNpcAssetMesh(
  deps: ClientResourceDeps,
  id: BiomesId
): Promise<GLTF | undefined> {
  const label = deps.get("/ecs/c/label", id)?.text;
  const assetKey = snapshotGroveNpcAssetKeyForEntity(id, label, {
    isRobot: Boolean(deps.get("/ecs/c/robot_component", id)),
  });
  if (!assetKey) {
    return undefined;
  }
  const url = resolveAssetUrlUntyped(assetKey);
  if (!url) {
    log.warn(
      "SNAPSHOT_GROVE_NPC_ASSET_KEY missing asset url; falling back to player-like NPC mesh",
      {
        entityId: id,
        label,
        assetKey,
        version: SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION,
      }
    );
    return undefined;
  }
  try {
    // Static snapshot GLBs are packaged locally and should be reliable, but an
    // overloaded service worker/iframe bridge can transiently reject the first
    // fetch. Retry once before replacing an authored NPC with a fallback body.
    const gltf = await loadGltfWithRetry(url, { attempts: 2, delayMs: 300 });
    replaceWithPlayerMaterial(gltf);
    setFrustumCulling(gltf, false);
    gltf.scene.userData.snapshotGroveNpcAssetVersion =
      SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION;
    gltf.scene.userData.snapshotGroveNpcAssetKey = assetKey;
    return gltf;
  } catch (error) {
    log.warn(
      "SNAPSHOT_GROVE_NPC_ASSET_KEY failed to load snapshot Grove NPC mesh; falling back to player-like NPC mesh",
      {
        entityId: id,
        label,
        assetKey,
        error,
      }
    );
    return undefined;
  }
}

async function makeHarthmereMuckCreatureNpcAssetMesh(
  label: string | undefined,
  id: BiomesId
): Promise<GLTF | undefined> {
  const assetKey = harthmereMuckCreatureAssetKeyForLabel(label);
  if (!assetKey) {
    return undefined;
  }
  const url = resolveAssetUrlUntyped(assetKey);
  if (!url) {
    log.warn(
      "HARTHMERE_MUCK_CREATURE_NPC_ASSET missing asset url; falling back to npc type mesh",
      {
        entityId: id,
        label,
        assetKey,
        version: HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION,
      }
    );
    return undefined;
  }
  try {
    const gltf = await loadGltf(url);
    setFrustumCulling(gltf, false);
    gltf.scene.userData.harthmereMuckCreatureNpcAssetVersion =
      HARTHMERE_MUCK_CREATURE_NPC_ASSET_VERSION;
    gltf.scene.userData.harthmereMuckCreatureNpcAssetKey = assetKey;
    return gltf;
  } catch (error) {
    log.warn(
      "HARTHMERE_MUCK_CREATURE_NPC_ASSET failed to load creature mesh; falling back to npc type mesh",
      {
        entityId: id,
        label,
        assetKey,
        error,
      }
    );
    return undefined;
  }
}

async function makeHarthmereBossNpcAssetMesh(
  label: string | undefined,
  id: BiomesId
): Promise<GLTF | undefined> {
  const visual = harthmereBossVisualForEntity(label, Number(id));
  if (!visual) {
    return undefined;
  }
  try {
    const gltf = await loadGltfWithRetry(visual.assetUrl, {
      attempts: 2,
      delayMs: 250,
    });
    setFrustumCulling(gltf, false);
    gltf.scene.userData.harthmereBossVisualAssetsVersion =
      HARTHMERE_BOSS_VISUAL_ASSETS_VERSION;
    gltf.scene.userData.harthmereBossVisualId = visual.id;
    gltf.scene.userData.harthmereBossWorldSize = [...visual.worldSize];
    gltf.scene.userData.harthmereBossUsesUniformScale =
      visual.id === "gilded_bull" ||
      visual.id === "muck_scarred_helix" ||
      visual.id === "ninth_winter" ||
      visual.id === "failed_apprentice" ||
      visual.id === "echo_singer" ||
      visual.id === "vyrahel_vein_keeper" ||
      visual.id === "alpha_mucker" ||
      visual.id === "thaedryn_bellbound";
    return gltf;
  } catch (error) {
    log.warn(
      "HARTHMERE_BOSS_VISUAL_ASSET failed to load custom boss mesh; falling back to the existing creature route",
      {
        entityId: id,
        label,
        bossVisualId: visual.id,
        assetUrl: visual.assetUrl,
        version: HARTHMERE_BOSS_VISUAL_ASSETS_VERSION,
        error,
      }
    );
    return undefined;
  }
}

async function makeNpcMesh(deps: ClientResourceDeps, id: BiomesId) {
  const npcMetadata = deps.get("/ecs/c/npc_metadata", id);
  // The entity may leave the local Sync radius between the resource request
  // and generation. The render-state path already accepts an absent mesh, so
  // make this transient race a clean miss as well.
  if (!npcMetadata) {
    return;
  }
  const npcType = harthmereRenderableNpcType(npcMetadata.type_id);
  if (!npcType) {
    log.throttledError(
      10_000,
      `Skipping NPC mesh ${id} with invalid type_id (${npcMetadata.type_id})`
    );
    return;
  }
  const label = deps.get("/ecs/c/label", id)?.text;

  // HARTHMERE_BUSINESS_NPC_PLAYER_AVATAR_PARITY:
  // Business owners and customers must render with the SAME player/Grove avatar
  // design as the player, Grove townsfolk, Billy Rhodes, Donnie, Max, etc. — not
  // the blocky "Harthmere voxel" NPC design. They are LOCAL_DEV_HUMAN_NPC_TYPE_ID
  // (isPlayerLikeAppearance === true), so they fall through to the player-like
  // branch below, which renders via makeSnapshotPlayerLikeAppearanceMesh (the
  // generated /api/assets/player_mesh.glb pipeline). Their ECS seeds drop the
  // uniform default appearance_component/wearing, so that pipeline applies the
  // deterministic per-id rich-appearance fallback (snapshotRichNpc*Fallback),
  // giving each shopkeeper/customer a distinct, clothed, animated avatar that
  // matches the rest of the cast. (Previously they were diverted here to the
  // deterministic voxel generator; that produced the wrong art style.)

  const bossAssetMesh = await makeHarthmereBossNpcAssetMesh(label, id);
  if (bossAssetMesh) {
    return ensureVisibleNpcGltf(
      deps,
      id,
      npcType,
      bossAssetMesh,
      "boss-visual-asset-empty"
    );
  }

  const muckCreatureAssetMesh = await makeHarthmereMuckCreatureNpcAssetMesh(
    label,
    id
  );
  if (muckCreatureAssetMesh) {
    return ensureVisibleNpcGltf(
      deps,
      id,
      npcType,
      muckCreatureAssetMesh,
      "muck-creature-asset-empty"
    );
  }

  const snapshotGroveAssetMesh = await makeSnapshotGroveNpcAssetMesh(deps, id);
  if (snapshotGroveAssetMesh) {
    return snapshotGroveAssetMesh;
  }

  if (npcType.isPlayerLikeAppearance) {
    // SNAPSHOT_RICH_NPC_APPEARANCE makeNpcMesh:
    // HARTHMERE_NPC_RENDER_PARITY:
    // Player-like town/merchant NPCs must use the same generated
    // /api/assets/player_mesh.glb pipeline as real players. The prior local-dev
    // offset branch intercepted many snapshot NPCs and replaced them with the
    // simple voxel fallback, which masked production/local differences and left
    // some NPCs name-only when the generated path was unavailable.
    try {
      const mesh = await makeSnapshotPlayerLikeAppearanceMesh(deps, id);
      setFrustumCulling(mesh, false);
      const visibleStats = harthmereNpcGltfVisibleGeometryStatsForTest(mesh);
      if (
        visibleStats.visibleMeshes === 0 ||
        visibleStats.renderableVertices < 24
      ) {
        log.warn(
          "HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD65 keeping player-like NPC mesh for snapshot visual parity",
          {
            entityId: id,
            npcTypeId: npcMetadata.type_id,
            npcTypeName: npcType.name,
            visibleStats,
            version: HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD_VERSION,
          }
        );
      }
      mesh.scene.userData.harthmereNpcRenderParityVersion =
        "harthmere-npc-render-parity";
      return mesh;
    } catch (error) {
      log.warn("HARTHMERE_NPC_RENDER_PARITY player-like NPC mesh failed", {
        entityId: id,
        npcTypeId: npcMetadata.type_id,
        error,
      });
      throw error;
    }
  }

  try {
    const typeMesh = await deps.get(
      "/scene/npc_type_mesh",
      npcMetadata.type_id
    );
    return ensureVisibleNpcGltf(
      deps,
      id,
      npcType,
      typeMesh,
      "npc-type-mesh-empty"
    );
  } catch (error) {
    log.error("HARTHMERE_NATIVE_NPC_MESH_REQUIRED", {
      entityId: id,
      npcTypeId: npcMetadata.type_id,
      npcTypeName: npcType.name,
      galoisPath: npcType.galoisPath,
      error,
    });
    throw error;
  }
}

// Resources shared by all NPC types.
export interface NpcCommonEffects {
  onDeathEffectParticleMaterials: ParticleSystemMaterials;
  onHitEffectParticleMaterials: ParticleSystemMaterials;
  onHitItemSoundEffect: AssetPath[];
}

async function makeNpcCommonEffects(
  _deps: ClientResourceDeps
): Promise<NpcCommonEffects> {
  return {
    onDeathEffectParticleMaterials: await npcOnDeathParticleMaterials(),
    onHitEffectParticleMaterials: await npcOnHitParticleMaterials(),
    onHitItemSoundEffect: audioAssets.block_break as AssetPath[],
  };
}

export interface NpcEffects {
  onHitNpcSoundEffect?: AssetPath[];
  onAttackNpcSoundEffect?: AssetPath[];
  onDeathNpcSoundEffect?: AssetPath[];
  idleNpcSoundEffect?: AssetPath[];
}

async function makeNpcEffects(
  _deps: ClientResourceDeps,
  effectProfileId: BiomesId
): Promise<NpcEffects> {
  const effectProfile = idToNpcEffectProfile(effectProfileId);
  return {
    onHitNpcSoundEffect: effectProfile.onHitSound as AssetPath[],
    onAttackNpcSoundEffect: effectProfile.onAttackSound as AssetPath[],
    onDeathNpcSoundEffect: effectProfile.onDeathSound as AssetPath[],
    idleNpcSoundEffect: effectProfile.idleSound as AssetPath[],
  };
}

export function addNpcResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.addGlobal("/scene/npc/become_npc", {
    kind: "empty",
  });
  builder.add("/scene/npc_type_mesh", (_deps, id) => makeNpcTypeMesh(id));
  builder.add("/scene/npc/mesh", makeNpcMesh);
  builder.add("/scene/npc/render_state", loader.provide(makeNpcRenderState));
  builder.add("/scene/npc/spatial_lighting", makeNpcSpatialLighting);
  builder.add("/scene/npc_common_effects", makeNpcCommonEffects);
  builder.add("/scene/npc_effects", makeNpcEffects);
}

// HARTHMERE_NPC_LICENSED_CLOTHING_MODELS
//
// Loads licensed GLTF/GLB clothing modelUrl items for local-dev NPCs.
// The existing current voxel proxy clothing remains as a safe fallback so NPCs
// still render if a downloaded model is missing, mis-scaled, or incompatible.
const HARTHMERE_NPC_LICENSED_CLOTHING_MODELS_VERSION =
  "harthmere-npc-licensed-clothing-models";

const harthmereNpcLicensedClothingModelCache = new Map<
  string,
  Promise<THREE.Object3D | undefined>
>();

function queueLocalDevNpcLicensedClothingModel(
  root: THREE.Object3D,
  slot: string,
  item: {
    id?: string;
    modelUrl?: string;
    bindMode?: string;
    licenseId?: string;
    licensedAsset?: boolean;
    outfitFamily?: string;
    outfitSelectorVersion?: number;
  },
  body: any
): void {
  const modelUrl =
    typeof item?.modelUrl === "string" ? item.modelUrl.trim() : "";

  if (!modelUrl) {
    return;
  }

  const runtimeKeys = (root.userData.harthmereNpcLicensedClothingModelKeys ??=
    {}) as Record<string, boolean>;
  const key = `${slot}:${item.id ?? "unknown"}:${modelUrl}`;

  if (runtimeKeys[key]) {
    return;
  }

  runtimeKeys[key] = true;
  root.userData.harthmereNpcLicensedClothingModelsRuntime =
    HARTHMERE_NPC_LICENSED_CLOTHING_MODELS_VERSION;
  root.userData.harthmereNpcLicensedClothingModelsQueued = [
    ...((root.userData.harthmereNpcLicensedClothingModelsQueued as any[]) ??
      []),
    {
      slot,
      id: item.id,
      modelUrl,
      licenseId: item.licenseId,
      outfitFamily: item.outfitFamily,
      outfitSelectorVersion: item.outfitSelectorVersion,
    },
  ];

  void loadLocalDevNpcLicensedClothingModel(modelUrl)
    .then((model) => {
      if (!model) {
        return;
      }

      fitLocalDevNpcLicensedClothingModel(model, slot, body);

      model.name = `harthmere-npc-licensed-clothing-${slot}-${
        item.id ?? "model"
      }`;
      model.userData.harthmereNpcLicensedClothingModel = true;
      model.userData.harthmereNpcLicensedClothingRuntime =
        HARTHMERE_NPC_LICENSED_CLOTHING_MODELS_VERSION;
      model.userData.harthmereClothingSlot = slot;
      model.userData.harthmereClothingItemId = item.id;
      model.userData.harthmereClothingModelUrl = modelUrl;
      model.userData.harthmereClothingLicenseId = item.licenseId;
      model.userData.harthmereClothingOutfitFamily = item.outfitFamily;
      model.userData.harthmereClothingOutfitSelectorVersion =
        item.outfitSelectorVersion;

      root.add(model);

      root.userData.harthmereNpcLicensedClothingModelsLoaded = [
        ...((root.userData.harthmereNpcLicensedClothingModelsLoaded as any[]) ??
          []),
        {
          slot,
          id: item.id,
          modelUrl,
          licenseId: item.licenseId,
          outfitFamily: item.outfitFamily,
        },
      ];
    })
    .catch((error) => {
      console.warn(
        "Failed to load Harthmere NPC licensed clothing model; keeping current proxy",
        {
          slot,
          id: item.id,
          modelUrl,
          error,
        }
      );
    });
}

async function loadLocalDevNpcLicensedClothingModel(
  modelUrl: string
): Promise<THREE.Object3D | undefined> {
  let sourcePromise = harthmereNpcLicensedClothingModelCache.get(modelUrl);

  if (!sourcePromise) {
    sourcePromise = (async () => {
      const gltf = await loadGltf(modelUrl);
      const source = extractLocalDevNpcGltfScene(gltf);

      if (!source) {
        return undefined;
      }

      return source;
    })();

    harthmereNpcLicensedClothingModelCache.set(modelUrl, sourcePromise);
  }

  const source = await sourcePromise;

  if (!source) {
    return undefined;
  }

  const clone = source.clone(true);
  cloneLocalDevNpcClothingMaterials(clone);
  return clone;
}

function extractLocalDevNpcGltfScene(
  gltf: unknown
): THREE.Object3D | undefined {
  const candidate = (gltf as any)?.scene ?? (gltf as any)?.scenes?.[0] ?? gltf;

  if (
    candidate &&
    typeof (candidate as THREE.Object3D).traverse === "function"
  ) {
    return candidate as THREE.Object3D;
  }

  return undefined;
}

function cloneLocalDevNpcClothingMaterials(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else {
      mesh.material = mesh.material.clone();
    }
  });
}

function fitLocalDevNpcLicensedClothingModel(
  model: THREE.Object3D,
  slot: string,
  body: any
): void {
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);

  if (box.isEmpty()) {
    return;
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const targetHeight = getLocalDevNpcLicensedClothingTargetHeight(slot, body);
  const scale = THREE.MathUtils.clamp(
    targetHeight / Math.max(size.y, 0.0001),
    0.035,
    10
  );

  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);

  const targetCenter = getLocalDevNpcLicensedClothingTargetCenter(slot, body);
  model.position.add(targetCenter.sub(center));
}

function getLocalDevNpcLicensedClothingTargetHeight(
  slot: string,
  body: any
): number {
  const torsoHeight = Number(body?.torsoHeight ?? 0.7);
  const legLength = Number(body?.legLength ?? 0.65);

  if (/head|hood|helmet/i.test(slot)) return 0.34;
  if (/feet|boot/i.test(slot)) return 0.18;
  if (/leg/i.test(slot)) return Math.max(0.28, legLength * 0.9);
  if (/hand|arm/i.test(slot)) return Math.max(0.32, torsoHeight * 0.8);
  if (/back|accessory|acc|pauldron|shoulder/i.test(slot))
    return Math.max(0.25, torsoHeight * 0.55);

  return Math.max(0.42, torsoHeight * 1.05);
}

function getLocalDevNpcLicensedClothingTargetCenter(
  slot: string,
  body: any
): THREE.Vector3 {
  const torsoHeight = Number(body?.torsoHeight ?? 0.7);
  const legLength = Number(body?.legLength ?? 0.65);
  const headHeight = Number(body?.headHeight ?? 0.28);
  const shoulderWidth = Number(body?.shoulderWidth ?? body?.torsoWidth ?? 0.55);

  if (/head|hood|helmet/i.test(slot)) {
    return new THREE.Vector3(
      0,
      legLength + torsoHeight + headHeight * 0.48,
      -0.02
    );
  }

  if (/feet|boot/i.test(slot)) {
    return new THREE.Vector3(0, 0.09, -0.03);
  }

  if (/leg/i.test(slot)) {
    return new THREE.Vector3(0, legLength * 0.5, -0.04);
  }

  if (/hand|arm/i.test(slot)) {
    return new THREE.Vector3(0, legLength + torsoHeight * 0.55, -0.05);
  }

  if (/back/i.test(slot)) {
    return new THREE.Vector3(0, legLength + torsoHeight * 0.55, 0.15);
  }

  if (/pauldron|shoulder|accessory|acc/i.test(slot)) {
    return new THREE.Vector3(0, legLength + torsoHeight * 0.86, -0.04).add(
      new THREE.Vector3(0, 0, shoulderWidth > 0.65 ? 0.02 : 0)
    );
  }

  return new THREE.Vector3(0, legLength + torsoHeight * 0.5, -0.06);
}
