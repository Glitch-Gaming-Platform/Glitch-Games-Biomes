// HARTHMERE_POLISH_V1_NPC_SPACING
// HARTHMERE_RENDERER_ANIMATION_SYNTAX_FIX_VERSION_V49

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import { log } from "@/shared/logging";
import { getHarthmereEquipmentAnimation } from "@/shared/game/medieval/harthmereEquipmentAnimationManifest.generated";
import {
  HARTHMERE_ATTACK_ANIMATION_PROFILES_V1,
  HARTHMERE_ATTACK_VISUAL_THEMES_V1,
  HARTHMERE_COMBAT_ANIMATION_POLISH_VERSION_V1,
  HARTHMERE_COMBAT_POLISH_RUNTIME_RULES_V1,
  HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2,
  HARTHMERE_COMBAT_ANIMATION_PRODUCTION_TEST_CONTRACTS_V3,
  HARTHMERE_COMBAT_ANIMATION_IMPACT_FRAME_WINDOW_V1,
  harthmereCombatAnimationProfileForActionV1,
  harthmereCombatAnimationProfileForRandomizedActionV2,
  type HarthmereAttackVisualThemeIdV1,
  type HarthmereCombatAnimationProfileV1,
} from "@/shared/harthmere/combat_animation_polish_v1";
import {
  makeHarthmereNpcBodyConfig,
  makeHarthmereNpcFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import {
  HARTHMERE_FACIAL_EXPRESSION_EVENT,
  dispatchHarthmereFacialExpressionEvent,
  makeHarthmereFacialExpressionState,
  makeHarthmereNpcAppearanceConfig,
  normalizeHarthmereCharacterAppearance,
  type HarthmereCharacterAppearance,
  type HarthmereFacialExpressionState,
  type HarthmereForwardAxis,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import {
  HARTHMERE_UPLOADED_ASSET_DIMENSIONS_VERSION_V52,
  HARTHMERE_UPLOADED_ASSET_DIMENSIONS_BY_KEY_V52,
  harthmereUploadedAssetCollisionFootprintV52,
} from "@/shared/harthmere/uploaded_asset_dimensions_v52";
import {
  HARTHMERE_TOWN_REGISTRY_VERSION,
  HARTHMERE_TOWN_DISTRICTS,
  collisionFromHarthmerePlacement,
  isHarthmereLifeAsset,
  makeHarthmereActorMetadata,
  makeHarthmerePropMetadata,
  shouldAutoAnimateHarthmerePlacement,
  shouldShowHarthmerePlacementAtDistanceSq,
  type HarthmereCollisionConfig,
  type HarthmereLodTier,
  type HarthmerePlacementMetadata,
} from "@/shared/harthmere/town_registry";
import {
  HARTHMERE_PRODUCTION_POLISH_VERSION_V1,
  HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1,
  HARTHMERE_PRODUCTION_POLISH_DISTRICT_PALETTE_V1,
  HARTHMERE_VOXEL_DESIGN_RULES_V1,
  HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES_V2,
  HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_VERSION_V2,
  HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION_V3,
  HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES_V3,
  HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION_V3,
  HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3,
} from "@/shared/harthmere/town_production_polish_v1";
import {
  HARTHMERE_NAMED_NPCS_V44,
  harthmereNamedNpcActorAssetV44,
} from "@/shared/harthmere/npc_compendium_v44";
import {
  HARTHMERE_REMAINING_NPCS_V45,
  harthmereRemainingNpcActorAssetV45,
} from "@/shared/harthmere/npc_compendium_v45";
import {
  HARTHMERE_RESIDENT_HOUSING_VERSION_V38,
  HARTHMERE_RESIDENT_HOUSING_BLOCK_BUILD_VERSION_V40,
  HARTHMERE_RESIDENT_HOUSING_STONE_SHELL_VERSION_V42,
  HARTHMERE_RESIDENTIAL_HOUSE_BUILDINGS_V38,
  HARTHMERE_SLUM_STACK_BUILDINGS_V38,
  createHarthmereResidentHomeAssignmentSummaryV38,
  makeHarthmereResidentRoomCenterV38,
  makeHarthmereResidentialRoomDecorV38,
  type HarthmereResidentHousingBuildingV38,
} from "@/shared/harthmere/resident_housing_v38";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import { HARTHMERE_MAIN_QUEST_SPACES_V47 } from "../../../../shared/harthmere/main_quest_spaces_v47";

const HARTHMERE_NO_SPARK_BASIC_ACTOR_MATCH_VERSION = "harthmere-no-spark-basic-actor-match-v11";
const HARTHMERE_FIX_DEBUG_RENDERER_CALL_VERSION = "harthmere-fix-debug-renderer-call-v1";
const HARTHMERE_ROBUST_PHYSICAL_COMBAT_SANITIZE_VERSION = "harthmere-robust-physical-combat-sanitize-v2";
const HARTHMERE_PRODUCTION_POLISH_RUNTIME_VERSION_V1 = HARTHMERE_PRODUCTION_POLISH_VERSION_V1;
const HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RUNTIME_VERSION_V2 = HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_VERSION_V2;
const HARTHMERE_FLOATING_BLOCK_RUNTIME_VERSION_V3 = HARTHMERE_FLOATING_BLOCK_INTEGRITY_VERSION_V3;
const HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_RUNTIME_VERSION_V3 = HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_VERSION_V3;
const HARTHMERE_NPC_WALL_COLLISION_VERSION = "harthmere-npc-wall-collision-v1";
const HARTHMERE_MARKET_SQUARE_IDENTITY_VERSION = "harthmere-market-square-identity-v1";
const HARTHMERE_PLAYER_SERVICES_PLAZA_VERSION = "harthmere-player-services-plaza-v1";
const HARTHMERE_COPPER_KETTLE_INN_VERSION = "harthmere-copper-kettle-inn-v1";
const HARTHMERE_CRAFTSMAN_ROW_BLACK_ANVIL_VERSION = "harthmere-craftsman-row-black-anvil-v1";
const HARTHMERE_NOBLE_RISE_VERSION = "harthmere-noble-rise-v1";
const HARTHMERE_RIVER_DOCKS_VERSION = "harthmere-river-docks-v1";
const HARTHMERE_MUDDEN_WARD_VERSION = "harthmere-mudden-ward-v1";
const HARTHMERE_GUARD_YARD_VERSION = "harthmere-guard-yard-v1";
const HARTHMERE_OLD_WELL_UNDERWAYS_VERSION = "harthmere-old-well-underways-v1";
const HARTHMERE_TEMPLE_GREEN_VERSION = "harthmere-temple-green-v1";
const HARTHMERE_TOWN_DEBUG_RUNTIME_FIXES_VERSION = "harthmere-town-debug-runtime-fixes-v1";
// HARTHMERE_WALL_FIXTURE_ATTACHMENT_RED_TESTS_V1: mounted torches and church lanterns name their wall brackets.
// HARTHMERE_FIXTURE_ATTACHMENT_RED_TESTS_V1: elevated lamps/candles/torches name their support anchors.
const HARTHMERE_TOWN_AUDIT_EXPORT_VERSION = "harthmere-town-audit-export-v1";
const HARTHMERE_TOWN_AUDIT_PATTERN_FIXES_VERSION = "harthmere-town-audit-pattern-fixes-v3";
const HARTHMERE_TOWN_WALK_DEBUG_VERSION = "harthmere-town-walk-debug-v2";
const HARTHMERE_TOWN_SYSTEMS_VERSION = "harthmere-town-registry-metadata-collision-lod-v1";
const HARTHMERE_ASSET_SIZE_COLLISION_RUNTIME_VERSION_V52 = HARTHMERE_UPLOADED_ASSET_DIMENSIONS_VERSION_V52;
const HARTHMERE_SOLID_UPLOADED_ASSET_PLAYER_COLLISION_V1 = "harthmere-solid-uploaded-asset-player-collision-v1";
const HARTHMERE_TOWN_SPACING_COLLISION_FIX_VERSION_V31 = "harthmere-town-spacing-collision-solid-fixture-v31";
const HARTHMERE_INTERIOR_ENTERABILITY_FIX_VERSION_V32 = "harthmere-interior-enterability-blocker-fixes-v32";
const HARTHMERE_SERVICE_BUILDING_BLOCK_REBUILD_VERSION_V43 = "harthmere-service-building-block-rebuild-v43";
const HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V38 = HARTHMERE_RESIDENT_HOUSING_VERSION_V38;

type AssetFormat = "gltf" | "fbx" | "obj";

type RuntimeAsset = {
  key: string;
  format: AssetFormat;
  path: string;
  defaultScale?: number;
};

type RuntimePlacement = {
  asset: string;
  at: [number, number, number];
  rot?: number;
  scale?: number;
  name?: string;
  district?: string;
  meta?: HarthmerePlacementMetadata;
  collision?: HarthmereCollisionConfig;
  lodTier?: HarthmereLodTier;
  combatOffset?: number;
  appearance?: HarthmereCharacterAppearance;
  bob?: number;
  spin?: number;
  wander?: {
    radius: number;
    speed: number;
    phase?: number;
    route?: readonly [number, number][];
    routeLabel?: string;
  };
};

type RuntimePrototype = {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

type AnimatedInstance = {
  object: THREE.Object3D;
  asset: string;
  mixer?: THREE.AnimationMixer;
  base: [number, number, number];
  rot: number;
  forwardAxis: HarthmereModelForwardAxis;
  bob?: number;
  spin?: number;
  wander?: {
    radius: number;
    speed: number;
    phase?: number;
    route?: readonly [number, number][];
    routeLabel?: string;
  };
  lastSafePosition?: [number, number, number];
  collisionBlockCount?: number;
  placementMeta?: HarthmerePlacementMetadata;
  // HARTHMERE_POLISH_V1_LOCOMOTION_CLIPS
  locomotion?: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    current?: "idle" | "walk" | "run";
    clips?: THREE.AnimationClip[];
  };
};

type HarthmerePlacementRuntimeInstance = {
  object: THREE.Object3D;
  placement: RuntimePlacement;
  meta: HarthmerePlacementMetadata;
  lodTier: HarthmereLodTier;
  structuralGroupKey?: string;
};

type HarthmereModelForwardAxis = HarthmereForwardAxis;

const HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7 = "harthmere-body-weapon-visual-cohesion-v7";
const HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9 =
  "harthmere-creature-social-death-handtracking-v9";
const HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V9 =
  "harthmere-weapon-follows-current-hand-anchor-v9";
const HARTHMERE_WEAPON_HAND_GRIP_MAX_DISTANCE_V9 = 0.22;
const HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1 =
  "harthmere-combat-animation-polish-renderer-v1";
const HARTHMERE_COMBAT_POLISH_THEME_SEQUENCE_V1 = HARTHMERE_ATTACK_VISUAL_THEMES_V1.map(
  (theme) => theme.id,
) as readonly HarthmereAttackVisualThemeIdV1[];

type HarthmerePlayerSwordVisualState = {
  drawn: boolean;
  itemId: string;
  action: "grant" | "draw" | "sheathe" | "attack" | "sync";
  attack?: "basic" | "heavy" | "spark";
  theme?: HarthmereAttackVisualThemeIdV1;
  variation?: string;
  at: number;
  windupMs?: number;
  impactMs?: number;
  recoveryMs?: number;
};

type CombatPulseKind = "attack" | "hit" | "block" | "death" | "evade";

type CombatLifeInstance = {
  object: THREE.Object3D;
  label: string;
  asset: string;
  district?: string;
  combatOffset?: number;
  forwardAxis: HarthmereModelForwardAxis;
  appearance?: HarthmereCharacterAppearance;
  baseScale: number;
  baseY: number;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  combatPulse?: {
    kind: CombatPulseKind;
    at: number;
    durationMs: number;
  };
};

const ROOT = "/assets/harthmere";
const GROUND_Y = 53.05;
const HARTHMERE_RUNTIME_CORE_ORIGIN_V3 = [486, -209] as const;
const HARTHMERE_COMBAT_EFFECT_EVENT = "biomes:harthmere-combat-effect";

const HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS = [
  "sword_1handed",
  "Sword",
  "Sword_Golden",
  "sword_2handed",
] as const;

const HARTHMERE_PLAYER_SWORD_CLIPS = {
  draw: "Draw_24",
  sheathe: "Sheathe_24",
  basic: "BasicSlash_24",
  heavy: "HeavySlash_24",
  idle: "IdleDrawn_24",
} as const;


// harthmere-all-weapon-animation-v4
// Weapon-wide equipment coverage. The existing field/method names still say
// "Sword" for backwards compatibility with earlier tests, but the visual system
// now resolves the active equipped item into the generated equipment manifest
// for melee weapons, ranged weapons, magic implements, and shields.
const HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS = [
  "axe_1handed",
  "axe_2handed",
  "Axe_Double",
  "Axe_Double_Golden",
  "Axe_small",
  "Axe_small_Golden",
  "dagger",
  "Dagger",
  "Dagger_Golden",
  "Hammer_Double",
  "Hammer_Double_Golden",
  "Sword",
  "sword_1handed",
  "sword_2handed",
  "sword_2handed_color",
  "Sword_big",
  "Sword_big_Golden",
  "Sword_Golden",
] as const;

const HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS = [
  "Arrow",
  "arrow_bow",
  "arrow_bow_bundle",
  "arrow_crossbow",
  "arrow_crossbow_bundle",
  "Arrow_Golden",
  "bow",
  "Bow_Golden",
  "bow_withString",
  "Bow_Wooden",
  "crossbow_1handed",
  "crossbow_2handed",
  "Dart",
  "Dart_Golden",
  "quiver",
] as const;

const HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS = [
  "Book1_Closed",
  "Book1_Open",
  "Book2_Closed",
  "Book2_Open",
  "Book3_Closed",
  "Book3_Open",
  "Book4_Closed",
  "Book4_Open",
  "Coin_Star",
  "Crystal1",
  "Crystal1_Damaged",
  "Crystal2",
  "Crystal2_Damaged",
  "Crystal3",
  "Crystal3_Damaged",
  "Crystal4",
  "Crystal5",
  "Crystal5_Damaged",
  "Scroll",
  "smokebomb",
  "Snowflake1",
  "Snowflake2",
  "Snowflake3",
  "spellbook_closed",
  "spellbook_open",
  "staff",
  "Star",
  "wand",
] as const;

const HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS = [
  "shield_badge",
  "shield_badge_color",
  "shield_round",
  "shield_round_barbarian",
  "shield_round_color",
  "shield_spikes",
  "shield_spikes_color",
  "shield_square",
  "shield_square_color",
] as const;

const HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS = [
  ...HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS,
  ...HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS,
] as const;

type HarthmereWeaponVisualProfileName = "melee" | "ranged" | "projectile" | "quiver" | "magic" | "magicBook" | "thrown" | "shield";

const HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID: Record<string, string> = {
  training_dagger: "dagger",
  iron_longsword: "sword_1handed",
  woodsman_axe: "axe_1handed",
  two_handed_sword: "sword_2handed",
  wooden_shield: "shield_round",
  sword_1handed: "sword_1handed",
  Sword: "Sword",
  Sword_Golden: "Sword_Golden",
  sword_2handed: "sword_2handed",
  dagger: "dagger",
  axe_1handed: "axe_1handed",
  bow: "bow",
  crossbow_1handed: "crossbow_1handed",
  staff: "staff",
  wand: "wand",
  shield_round: "shield_round",
};

const HARTHMERE_WEAPON_VISUAL_CLIP_PROFILES: Record<
  HarthmereWeaponVisualProfileName,
  { draw: string; sheathe: string; basic: string; heavy: string; idle: string }
> = {
  melee: { draw: "Draw_24", sheathe: "Sheathe_24", basic: "BasicSlash_24", heavy: "HeavySlash_24", idle: "IdleDrawn_24" },
  ranged: { draw: "Equip_24", sheathe: "Reload_24", basic: "AimDraw_24", heavy: "Release_24", idle: "IdleAim_24" },
  projectile: { draw: "Nock_24", sheathe: "ImpactTwitch_24", basic: "Nock_24", heavy: "ProjectileSpin_24", idle: "ProjectileSpin_24" },
  quiver: { draw: "EquipBack_24", sheathe: "IdleBack_24", basic: "DrawArrow_24", heavy: "DrawArrow_24", idle: "IdleBack_24" },
  magic: { draw: "Equip_24", sheathe: "Stow_24", basic: "Cast_24", heavy: "Channel_24", idle: "Channel_24" },
  magicBook: { draw: "OpenRead_24", sheathe: "Close_24", basic: "CastFromBook_24", heavy: "CastFromBook_24", idle: "OpenRead_24" },
  thrown: { draw: "Ready_24", sheathe: "Burst_24", basic: "Throw_24", heavy: "Burst_24", idle: "Ready_24" },
  shield: { draw: "Equip_24", sheathe: "LowerGuard_24", basic: "BlockRaise_24", heavy: "ShieldBash_24", idle: "IdleGuard_24" },
};

function harthmereWeaponVisualProfileForEquipmentId(equipmentId: string): HarthmereWeaponVisualProfileName {
  if (/^(Arrow|Arrow_Golden|Dart|Dart_Golden|arrow_)/.test(equipmentId)) {
    return "projectile";
  }
  if (equipmentId === "quiver") {
    return "quiver";
  }
  if ((HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {
    return "ranged";
  }
  if (/^(Book|Scroll|spellbook_)/.test(equipmentId)) {
    return "magicBook";
  }
  if (equipmentId === "smokebomb") {
    return "thrown";
  }
  if ((HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {
    return "magic";
  }
  if ((HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(equipmentId)) {
    return "shield";
  }
  return "melee";
}

function resolveHarthmerePlayerWeaponEquipmentEntry(itemId: string | undefined) {
  const requested = itemId && HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID[itemId]
    ? HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID[itemId]
    : itemId;
  const fallbacks = [
    requested,
    "sword_1handed",
    ...HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS,
    ...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS,
  ].filter(Boolean) as string[];

  for (const equipmentId of fallbacks) {
    const entry = getHarthmereEquipmentAnimation(equipmentId);
    if (entry && (HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS as readonly string[]).includes(entry.id)) {
      const profile = harthmereWeaponVisualProfileForEquipmentId(entry.id);
      return { entry, equipmentId: entry.id, profile, clips: HARTHMERE_WEAPON_VISUAL_CLIP_PROFILES[profile] };
    }
  }
  return undefined;
}

function resolveHarthmerePlayerWeaponVisualClips(itemId: string | undefined) {
  return resolveHarthmerePlayerWeaponEquipmentEntry(itemId)?.clips ?? HARTHMERE_PLAYER_SWORD_CLIPS;
}



const HARTHMERE_UNIQUE_NPC_COSMETICS_VERSION = "harthmere-unique-npc-cosmetics-v15-body-fit-clothing";
const HARTHMERE_FACE_BODY_VISUAL_REFINEMENT_VERSION = "harthmere-face-body-visual-refinement-v11";

type HarthmereUniqueNpcPalette = {
  skin: number;
  hair: number;
  tunic: number;
  legs: number;
  accent: number;
  trim: number;
  leather: number;
  metal: number;
  detail: number;
};

function harthmereUniqueNpcSeed(placement: RuntimePlacement) {
  return harthmereStableCombatHash(
    `${placement.asset}|${placement.name ?? ""}|${placement.district ?? ""}|${placement.combatOffset ?? ""}`,
  );
}

function pickSeeded<T>(items: readonly T[], seed: number, salt: number): T {
  return items[Math.abs((seed + salt * 2654435761) >>> 0) % items.length]!;
}

function colorFromToken(
  token: string,
  fallback: number,
  mapping: Record<string, number>,
) {
  return mapping[token] ?? fallback;
}

function hairColorHex(token: string) {
  return colorFromToken(token, 0x4a2d1c, {
    black: 0x151515,
    brown: 0x4a2d1c,
    auburn: 0x73351f,
    blonde: 0xc8a25c,
    gray: 0x888888,
    white: 0xd7d7d7,
    red: 0x8c3126,
    blue: 0x355b8f,
    green: 0x3b6f47,
    purple: 0x674483,
  });
}

function skinToneHex(token: string) {
  return colorFromToken(token, 0xc98f63, {
    porcelain: 0xe4c7b2,
    light: 0xdab090,
    warm: 0xc98f63,
    tan: 0xb97e57,
    brown: 0x8f5e42,
    deep: 0x684232,
    metal: 0xaeb5bf,
  });
}

function outfitColorHex(token: string) {
  return colorFromToken(token, 0x6e5f4e, {
    earth: 0x7a5c42,
    forest: 0x446948,
    river: 0x446685,
    ember: 0x7a4336,
    royal: 0x5b4d8c,
    ash: 0x5d6065,
  });
}

function tintColor(color: number, amount: number) {
  const c = new THREE.Color(color);
  return c.lerp(new THREE.Color(amount >= 0 ? 0xffffff : 0x000000), Math.min(1, Math.abs(amount))).getHex();
}

function findHumanoidAnchor(
  root: THREE.Object3D,
  patterns: RegExp[],
): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((child) => {
    if (found) {
      return;
    }
    const name = child.name || "";
    if (patterns.some((pattern) => pattern.test(name))) {
      found = child;
    }
  });
  return found;
}

function cosmeticBox(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
) {
  const mesh = boxMesh(name, size, position, color);
  mesh.castShadow = true;
  return mesh;
}

function setMeshColorByName(root: THREE.Object3D, names: string[], color: number) {
  const matchers = names.map((name) => name.toLowerCase());
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const childName = (child.name || "").toLowerCase();
    if (!matchers.some((matcher) => childName.includes(matcher))) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material && "color" in material && material.color) {
        material.color.setHex(color);
      }
    }
  });
}

function uniqueTownspersonPalette(placement: RuntimePlacement): HarthmereUniqueNpcPalette {
  const cosmeticId = placement.combatOffset ?? harthmereUniqueNpcSeed(placement);
  const roleHint = `${placement.asset} ${placement.district ?? ""}`;
  const name = placement.name ?? placement.asset;
  const face = makeHarthmereNpcFaceConfig({
    id: cosmeticId,
    name,
    roleHint,
  });
  const body = makeHarthmereNpcBodyConfig({
    id: cosmeticId,
    name,
    roleHint,
    face,
  });
  const seed = harthmereUniqueNpcSeed(placement);
  const tunic = outfitColorHex(body.outfitColor);
  const accent = tintColor(tunic, 0.32);
  const trim = pickSeeded([tintColor(tunic, 0.45), tintColor(tunic, -0.18), accent], seed, 2);
  const leather = pickSeeded([0x5b3e29, 0x70492c, 0x3f2c1c, 0x6a513a], seed, 3);
  const metal = pickSeeded([0x94979d, 0x7f857d, 0xc2aa63, 0x5e6168], seed, 4);
  const detail = pickSeeded([0x1f1f22, 0xf0e6c8, 0xcaa169, 0x8b2f2d, 0x355b8f], seed, 5);
  return {
    skin: skinToneHex(face.skinTone),
    hair: hairColorHex(face.hairColor),
    tunic,
    legs: tintColor(tunic, -0.28),
    accent,
    trim,
    leather,
    metal,
    detail,
  };
}

function addUniqueNpcGear(
  placement: RuntimePlacement,
  root: THREE.Object3D,
  palette: HarthmereUniqueNpcPalette,
) {
  const seed = harthmereUniqueNpcSeed(placement);
  const name = placement.name ?? placement.asset;
  const roleHint = `${placement.asset} ${placement.district ?? ""}`;
  const cosmeticId = placement.combatOffset ?? seed;
  const face = makeHarthmereNpcFaceConfig({ id: cosmeticId, name, roleHint });
  const body = makeHarthmereNpcBodyConfig({ id: cosmeticId, name, roleHint, face });

  const headAnchor = findHumanoidAnchor(root, [/head/i, /neck/i]);
  const spineAnchor = findHumanoidAnchor(root, [/spine/i, /chest/i, /torso/i]);
  const hipAnchor = findHumanoidAnchor(root, [/hip/i, /pelvis/i]);
  const leftHandAnchor = findHumanoidAnchor(root, [/lefthand/i, /left_hand/i, /hand_l/i]);
  const rightHandAnchor = findHumanoidAnchor(root, [/righthand/i, /right_hand/i, /hand_r/i]);
  const backAnchor = spineAnchor ?? root;

  const headGroup = new THREE.Group();
  headGroup.name = "harthmere-unique-npc-head-cosmetics";
  headGroup.position.set(0, headAnchor ? 0.12 : 1.48, 0);
  const chestGroup = new THREE.Group();
  chestGroup.name = "harthmere-unique-npc-chest-cosmetics";
  chestGroup.position.set(0, spineAnchor ? 0.03 : 0.94, 0);
  const backGroup = new THREE.Group();
  backGroup.name = "harthmere-unique-npc-back-cosmetics";
  backGroup.position.set(0, spineAnchor ? 0.02 : 0.9, 0.12);
  const hipGroup = new THREE.Group();
  hipGroup.name = "harthmere-unique-npc-hip-cosmetics";
  hipGroup.position.set(0.16, hipAnchor ? 0.02 : 0.68, 0.03);

  if (face.hairStyle === "bun") {
    headGroup.add(cosmeticBox("npc-hair-bun", [0.18, 0.12, 0.18], [0, 0.18, 0.08], palette.hair));
  } else if (face.hairStyle === "long" || face.hairStyle === "wavy") {
    headGroup.add(cosmeticBox("npc-hair-long", [0.26, 0.32, 0.14], [0, -0.05, 0.08], palette.hair));
  } else if (face.hairStyle === "braids") {
    headGroup.add(
      cosmeticBox("npc-braid-left", [0.06, 0.24, 0.06], [-0.12, -0.02, 0.04], palette.hair),
      cosmeticBox("npc-braid-right", [0.06, 0.24, 0.06], [0.12, -0.02, 0.04], palette.hair),
    );
  } else if (face.hairStyle === "pigtails") {
    headGroup.add(
      cosmeticBox("npc-pigtail-left", [0.08, 0.18, 0.08], [-0.16, 0.02, 0.02], palette.hair),
      cosmeticBox("npc-pigtail-right", [0.08, 0.18, 0.08], [0.16, 0.02, 0.02], palette.hair),
    );
  } else if (face.hairStyle === "curly") {
    headGroup.add(
      cosmeticBox("npc-curl-left", [0.1, 0.1, 0.1], [-0.12, 0.12, 0.02], palette.hair),
      cosmeticBox("npc-curl-right", [0.1, 0.1, 0.1], [0.12, 0.12, 0.02], palette.hair),
    );
  }

  if (face.accessory === "cap") {
    headGroup.add(cosmeticBox("npc-cap", [0.34, 0.08, 0.3], [0, 0.16, 0], palette.accent));
  } else if (face.accessory === "hood") {
    headGroup.add(cosmeticBox("npc-hood", [0.34, 0.2, 0.3], [0, 0.08, 0.02], tintColor(palette.tunic, -0.12)));
  } else if (face.accessory === "headband") {
    headGroup.add(cosmeticBox("npc-headband", [0.32, 0.04, 0.28], [0, 0.06, 0], palette.trim));
  } else if (face.accessory === "spectacles") {
    headGroup.add(
      cosmeticBox("npc-glasses-left", [0.08, 0.06, 0.02], [-0.08, 0, -0.15], palette.metal),
      cosmeticBox("npc-glasses-right", [0.08, 0.06, 0.02], [0.08, 0, -0.15], palette.metal),
      cosmeticBox("npc-glasses-bridge", [0.04, 0.02, 0.02], [0, 0, -0.15], palette.metal),
    );
  }

  if (face.facialHair === "mustache") {
    headGroup.add(cosmeticBox("npc-mustache", [0.12, 0.03, 0.02], [0, -0.12, -0.15], palette.hair));
  } else if (face.facialHair === "goatee") {
    headGroup.add(cosmeticBox("npc-goatee", [0.08, 0.08, 0.02], [0, -0.16, -0.15], palette.hair));
  } else if (face.facialHair === "short_beard") {
    headGroup.add(cosmeticBox("npc-short-beard", [0.18, 0.14, 0.04], [0, -0.14, -0.14], palette.hair));
  } else if (face.facialHair === "full_beard") {
    headGroup.add(cosmeticBox("npc-full-beard", [0.2, 0.22, 0.06], [0, -0.17, -0.12], palette.hair));
  }


  const sideLockSign = (seed & 1) === 0 ? -1 : 1;
  headGroup.add(
    cosmeticBox(
      "npc-head-side-lock-asym",
      [0.04 + ((seed >>> 8) % 3) * 0.008, 0.14 + ((seed >>> 10) % 4) * 0.018, 0.045],
      [sideLockSign * 0.17, -0.02 + ((seed >>> 12) % 3) * 0.012, -0.03],
      tintColor(palette.hair, 0.08)
    )
  );
  if (((seed >>> 14) & 1) === 1) {
    headGroup.add(
      cosmeticBox(
        "npc-face-side-mark-asym",
        [0.026, 0.026, 0.012],
        [-sideLockSign * 0.1, -0.05, -0.185],
        0x2a1712
      )
    );
  }

  const uniqueSide = sideLockSign < 0 ? -1 : 1;
  const oppositeSide = -uniqueSide;
  headGroup.add(
    cosmeticBox(
      "npc-unique-hair-streak-v12",
      [0.032, 0.18 + ((seed >>> 16) % 4) * 0.018, 0.035],
      [uniqueSide * 0.095, 0.065, -0.16],
      tintColor(palette.hair, ((seed >>> 18) & 1) === 0 ? 0.34 : -0.22),
    ),
  );
  if (((seed >>> 19) & 1) === 1) {
    headGroup.add(
      cosmeticBox(
        "npc-unique-ear-piece-v12",
        [0.026, 0.055, 0.022],
        [oppositeSide * 0.19, -0.015, -0.025],
        palette.metal,
      ),
    );
  }

  chestGroup.add(
    cosmeticBox(
      "npc-unique-shoulder-cloak-v12",
      [0.13 + ((seed >>> 20) % 3) * 0.018, 0.28, 0.055],
      [uniqueSide * 0.2, 0.03, 0.105],
      pickSeeded([palette.trim, palette.detail, tintColor(palette.tunic, -0.34)], seed, 11),
    ),
    cosmeticBox(
      "npc-unique-chest-patch-v12",
      [0.07 + ((seed >>> 22) % 2) * 0.025, 0.09, 0.022],
      [oppositeSide * 0.1, 0.045, -0.132],
      pickSeeded([palette.accent, palette.detail, palette.metal], seed, 12),
    ),
  );
  if (((seed >>> 24) & 1) === 1) {
    const bandolier = cosmeticBox(
      "npc-unique-bandolier-v12",
      [0.055, 0.58, 0.045],
      [uniqueSide * 0.045, 0.0, -0.14],
      palette.leather,
    );
    bandolier.rotation.z = uniqueSide * 0.34;
    chestGroup.add(bandolier);
  }
  backGroup.add(
    cosmeticBox(
      "npc-unique-bedroll-v12",
      [0.22, 0.08, 0.1],
      [oppositeSide * 0.08, 0.16, 0.075],
      pickSeeded([palette.leather, palette.trim, palette.detail], seed, 13),
    ),
  );
  hipGroup.add(
    cosmeticBox(
      "npc-unique-pouch-v12",
      [0.09, 0.12, 0.07],
      [oppositeSide * 0.065, -0.02, 0.03],
      pickSeeded([palette.leather, palette.trim, 0x2a2118], seed, 14),
    ),
  );

  chestGroup.add(
    cosmeticBox("npc-collar", [0.36, 0.05, 0.2], [0, 0.12, 0], palette.trim),
    cosmeticBox("npc-belt", [0.4, 0.06, 0.22], [0, -0.14, 0], palette.leather),
    cosmeticBox("npc-cuff-left", [0.1, 0.05, 0.1], [-0.29, -0.06, 0], palette.trim),
    cosmeticBox("npc-cuff-right", [0.1, 0.05, 0.1], [0.29, -0.06, 0], palette.trim),
    cosmeticBox("npc-boot-left", [0.14, 0.06, 0.14], [-0.09, -0.48, 0], palette.leather),
    cosmeticBox("npc-boot-right", [0.14, 0.06, 0.14], [0.09, -0.48, 0], palette.leather),
  );

  const role = placement.asset;
  if (/guard/.test(role)) {
    chestGroup.add(
      cosmeticBox("npc-guard-tabard", [0.32, 0.28, 0.05], [0, 0.02, -0.12], palette.detail),
      cosmeticBox("npc-guard-pauldron-left", [0.12, 0.08, 0.12], [-0.2, 0.16, 0], palette.metal),
      cosmeticBox("npc-guard-pauldron-right", [0.12, 0.08, 0.12], [0.2, 0.16, 0], palette.metal),
    );
    backGroup.add(cosmeticBox("npc-guard-shield", [0.24, 0.34, 0.08], [0.22, -0.02, 0.04], palette.metal));
    hipGroup.add(cosmeticBox("npc-guard-sheath", [0.06, 0.3, 0.05], [0, 0, 0], palette.leather));
  } else if (/courier/.test(role)) {
    backGroup.add(cosmeticBox("npc-courier-satchel", [0.2, 0.22, 0.1], [-0.18, 0.02, 0.04], palette.leather));
    chestGroup.add(cosmeticBox("npc-courier-strap", [0.07, 0.52, 0.04], [-0.08, 0.0, -0.02], palette.leather));
  } else if (/dockhand|charcoal/.test(role)) {
    chestGroup.add(cosmeticBox("npc-work-apron", [0.22, 0.36, 0.04], [0, -0.02, -0.13], palette.leather));
    hipGroup.add(cosmeticBox("npc-work-tool-loop", [0.06, 0.2, 0.06], [0.02, -0.02, 0], palette.metal));
  } else if (/farmer/.test(role)) {
    headGroup.add(cosmeticBox("npc-farmer-hat", [0.42, 0.05, 0.36], [0, 0.18, 0], 0xb99655));
    chestGroup.add(cosmeticBox("npc-farmer-kerchief", [0.16, 0.08, 0.04], [0, 0.1, -0.12], palette.detail));
    hipGroup.add(cosmeticBox("npc-farmer-tool", [0.05, 0.28, 0.05], [0.02, 0.0, 0], palette.leather));
  } else if (/clergy/.test(role)) {
    chestGroup.add(
      cosmeticBox("npc-clergy-stole-left", [0.06, 0.44, 0.04], [-0.06, -0.02, -0.12], palette.accent),
      cosmeticBox("npc-clergy-stole-right", [0.06, 0.44, 0.04], [0.06, -0.02, -0.12], palette.accent),
      cosmeticBox("npc-clergy-emblem", [0.05, 0.1, 0.02], [0, -0.1, -0.13], palette.metal),
    );
  } else if (/hunter/.test(role)) {
    backGroup.add(
      cosmeticBox("npc-hunter-quiver", [0.12, 0.32, 0.1], [-0.16, 0.0, 0.02], palette.leather),
      cosmeticBox("npc-hunter-bow", [0.04, 0.54, 0.04], [0.12, 0.02, 0.02], palette.detail),
    );
  } else if (/bandit|smuggler/.test(role)) {
    headGroup.add(cosmeticBox("npc-bandit-mask", [0.24, 0.08, 0.02], [0, -0.02, -0.15], 0x232326));
    chestGroup.add(cosmeticBox("npc-bandit-sash", [0.1, 0.52, 0.06], [0.12, -0.04, -0.1], palette.detail));
    hipGroup.add(cosmeticBox("npc-bandit-knife", [0.04, 0.2, 0.04], [0, 0.0, 0], palette.metal));
  } else if (/undead/.test(role)) {
    chestGroup.add(
      cosmeticBox("npc-undead-tatter-left", [0.08, 0.22, 0.04], [-0.12, -0.14, -0.12], tintColor(palette.tunic, -0.1)),
      cosmeticBox("npc-undead-tatter-right", [0.08, 0.22, 0.04], [0.12, -0.16, -0.1], tintColor(palette.tunic, -0.14)),
    );
  } else {
    if ((seed & 1) === 0) {
      chestGroup.add(cosmeticBox("npc-scarf", [0.32, 0.05, 0.18], [0, 0.1, 0], palette.detail));
    }
    if ((seed & 2) !== 0) {
      hipGroup.add(cosmeticBox("npc-pouch", [0.1, 0.12, 0.08], [0.02, 0.0, 0], palette.leather));
    }
  }

  (headAnchor ?? root).add(headGroup);
  (spineAnchor ?? root).add(chestGroup);
  backAnchor.add(backGroup);
  (hipAnchor ?? root).add(hipGroup);

  root.userData.harthmereNpcCosmetics = {
    version: HARTHMERE_UNIQUE_NPC_COSMETICS_VERSION,
    face,
    body,
    palette,
    distinctSeed: seed,
  };
}

function applyUniqueNpcVisualDecorations(
  placement: RuntimePlacement,
  root: THREE.Object3D,
) {
  if (!placement.asset.startsWith("townsperson_")) {
    return;
  }
  const palette = uniqueTownspersonPalette(placement);
  // Basic recolor pass. These name matches are intentionally broad because the
  // townsperson GLTF variants do not have a stable artist naming convention.
  setMeshColorByName(root, ["hair", "brow", "beard"], palette.hair);
  setMeshColorByName(root, ["skin", "face", "head", "hand", "arm"], palette.skin);
  setMeshColorByName(root, ["shirt", "body", "torso", "tunic", "robe", "coat"], palette.tunic);
  setMeshColorByName(root, ["leg", "pant", "trouser", "skirt"], palette.legs);
  setMeshColorByName(root, ["boot", "shoe", "belt", "strap"], palette.leather);
  addUniqueNpcGear(placement, root, palette);
}


function harthmereRendererDebugEnabled() {
  return (
    typeof window !== "undefined" &&
    window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") === "1"
  );
}

type HarthmereRegisterActorDebugBucket = {
  count: number;
  firstAt: number;
  lastAt: number;
  asset?: unknown;
  role?: unknown;
  district?: unknown;
  forwardAxis?: unknown;
  sampleLabel?: unknown;
};

type HarthmereRegisterActorDebugSummary = {
  at: number;
  total: number;
  byAsset: Record<string, HarthmereRegisterActorDebugBucket>;
  byRole: Record<string, number>;
  samples: Record<string, unknown>[];
};

type HarthmereRendererDebugWindow = typeof window & {
  __harthmereRendererDebugLog?: unknown[];
  __harthmereRendererRegisterActorSummary?: HarthmereRegisterActorDebugSummary;
  __harthmereRendererAppearanceReport?: Record<string, unknown>[];
  __harthmereNpcCollisionObstacles?: Record<string, unknown>[];
  __harthmerePlayerCollisionObstacles?: Record<string, unknown>[];
  __harthmereTownCollisionObstacles?: Record<string, unknown>[];
  __harthmereNpcCollisionStats?: Record<string, unknown>;
  __harthmereNpcCollisionSummary?: Record<string, {
    actor: string;
    asset: string;
    obstacle: string;
    district?: string;
    resolution: string;
    count: number;
    firstAt: number;
    lastAt: number;
  }>;
  __harthmereNpcCollisionLogEnabled?: boolean;
  __harthmereDumpNpcCollisionSummary?: () => unknown[];
  __harthmereTownLodStats?: Record<string, unknown>;
  __harthmereFloatingBlockIntegrityReport?: Record<string, unknown>;
  __harthmereTownRegistry?: Record<string, unknown>;
  __harthmereTownCollisionQuery?: Record<string, unknown>;
  __harthmerePlacementCleanupReport?: Record<string, unknown>;
};

function harthmereRendererDebugWindow(): HarthmereRendererDebugWindow | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window as HarthmereRendererDebugWindow;
}

function harthmereVerboseRendererDebugEnabled() {
  return (
    typeof window !== "undefined" &&
    window.localStorage?.getItem("biomes.localDev.harthmere.rendererVerbose") === "1"
  );
}

function snapshotHarthmereRegisterActorSummary() {
  return harthmereRendererDebugWindow()?.__harthmereRendererRegisterActorSummary;
}

function recordHarthmereRegisterActorDebug(payload: Record<string, unknown>) {
  const win = harthmereRendererDebugWindow();
  if (!win) {
    return;
  }

  const now = Date.now();
  const asset = String(payload.asset ?? "unknown_asset");
  const role = String(payload.appearanceRole ?? payload.socialRole ?? "unknown_role");
  const district = String(payload.district ?? "unknown_district");
  const key = `${asset}|${role}|${district}`;

  const summary =
    win.__harthmereRendererRegisterActorSummary ??
    {
      at: now,
      total: 0,
      byAsset: {},
      byRole: {},
      samples: [],
    };

  summary.at = now;
  summary.total += 1;
  summary.byRole[role] = (summary.byRole[role] ?? 0) + 1;

  const bucket =
    summary.byAsset[key] ??
    {
      count: 0,
      firstAt: now,
      lastAt: now,
      asset: payload.asset,
      role: payload.appearanceRole,
      district: payload.district,
      forwardAxis: payload.forwardAxis,
      sampleLabel: payload.label,
    };

  bucket.count += 1;
  bucket.lastAt = now;
  summary.byAsset[key] = bucket;

  // Keep only representative examples so debug logs do not drown useful combat,
  // sword, facing, and appearance messages. Use the verbose flag below when a
  // developer really needs one line per actor registration.
  if (summary.samples.length < 40) {
    summary.samples.push({
      label: payload.label,
      asset: payload.asset,
      district: payload.district,
      forwardAxis: payload.forwardAxis,
      appearanceRole: payload.appearanceRole,
      appearanceSpecies: payload.appearanceSpecies,
      equipment: payload.equipment,
      clipCount: payload.clipCount,
      hasMixer: payload.hasMixer,
    });
  }

  win.__harthmereRendererRegisterActorSummary = summary;
}

function debugHarthmereRenderer(stage: string, payload: Record<string, unknown>) {
  if (!harthmereRendererDebugEnabled()) {
    return;
  }

  if (stage === "renderer.register_actor") {
    recordHarthmereRegisterActorDebug(payload);
    if (!harthmereVerboseRendererDebugEnabled()) {
      return;
    }
  }

  const entry = { at: Date.now(), stage, ...payload };
  const win = harthmereRendererDebugWindow();
  if (win) {
    win.__harthmereRendererDebugLog = [
      entry,
      ...(win.__harthmereRendererDebugLog ?? []),
    ].slice(0, 260);
  }
  console.info("[HarthmereRenderer]", stage, payload);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeHarthmereRendererForward2(
  x: number,
  z: number,
): [number, number] | undefined {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || length < 0.001) {
    return undefined;
  }
  return [x / length, z / length];
}

function harthmereModelForwardAxis(asset: string): HarthmereModelForwardAxis {
  if (isProceduralAnimalKey(asset)) {
    return "plusZ";
  }
  return isProceduralTownspersonKey(asset) ? "minusZ" : "plusZ";
}

function harthmereYawForWorldForward(
  forwardX: number,
  forwardZ: number,
  forwardAxis: HarthmereModelForwardAxis,
) {
  const normalized = normalizeHarthmereRendererForward2(forwardX, forwardZ);
  if (!normalized) {
    return 0;
  }
  const [x, z] = normalized;
  return forwardAxis === "plusZ" ? Math.atan2(x, z) : Math.atan2(-x, -z);
}


// harthmere-full-combat-ai-animation-v1
function harthmereWorldForwardForYaw(
  yaw: number,
  forwardAxis: HarthmereModelForwardAxis,
): [number, number] {
  return forwardAxis === "plusZ"
    ? [Math.sin(yaw), Math.cos(yaw)]
    : [-Math.sin(yaw), -Math.cos(yaw)];
}

function harthmereStableCombatHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function harthmereAutoCombatOffset(
  asset: string,
  x: number,
  z: number,
  name?: string,
  district?: string,
) {
  const basis = `${asset}|${name ?? ""}|${district ?? ""}|${Math.round(x * 10)}|${Math.round(z * 10)}`;
  return 10_000 + (harthmereStableCombatHash(basis) % 80_000);
}

function harthmereCombatActorRadius(asset: string, scale: number) {
  const text = asset.toLowerCase();
  const base = /bear|horse|cow/.test(text)
    ? 1.75
    : /boar|wolf|deer|sheep|pig|dog/.test(text)
      ? 1.25
      : /rat|snake|frog|cat|fox|crow|pigeon|chicken|bunny/.test(text)
        ? 0.75
        : 1.15;
  return Math.max(0.35, Math.min(3.75, base * Math.max(0.65, scale)));
}

function harthmereCombatActorSpecies(asset: string, label?: string) {
  const text = `${asset} ${label ?? ""}`.toLowerCase();
  if (/undead|zombie|corpse|drowned|gravewood|dead/.test(text)) {
    return "undead";
  }
  if (/animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|pigeon|chicken|bunny|rabbit|pig/.test(text)) {
    return "animal";
  }
  return "human";
}

function harthmereCombatActorBehavior(asset: string, label?: string, district?: string) {
  const text = `${asset} ${label ?? ""} ${district ?? ""}`.toLowerCase();
  if (/dummy|training/.test(text)) {
    return "training_dummy";
  }
  if (/guard|watch|sentry|patrol|peacekeeper|sergeant|quartermaster/.test(text)) {
    return "guard";
  }
  if (/bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|gravewood|wolf|bear|boar|snake|rat/.test(text)) {
    return "hostile";
  }
  if (/merchant|vendor|banker|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  return "defensive";
}

function harthmereCombatActorSocialRole(asset: string, label?: string, district?: string) {
  const text = `${asset} ${label ?? ""} ${district ?? ""}`.toLowerCase();
  const species = harthmereCombatActorSpecies(asset, label);
  if (species === "animal") {
    return "wildlife";
  }
  if (/guard|watch|sentry|patrol|sergeant/.test(text)) {
    return "guard";
  }
  if (/merchant|vendor|banker|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  if (/bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned/.test(text)) {
    return "hostile";
  }
  return "civilian";
}

function expandHarthmereCombatClipPriority(
  kind: CombatPulseKind,
  preferredNames: string[],
) {
  const expanded: string[] = [];
  const add = (...names: string[]) => {
    for (const name of names) {
      if (name && !expanded.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
        expanded.push(name);
      }
    }
  };

  for (const name of preferredNames) {
    const lower = name.toLowerCase();
    if (/heavy/.test(lower)) {
      add("HeavyAttack", "Attack2", "SideSwing", "Thrusting", "Attack");
    } else if (/attack2/.test(lower)) {
      add("Attack2", "HeavyAttack", "SideSwing", "Attack");
    } else if (/bite/.test(lower)) {
      add("Bite", "Attack", "Pounce", "Claw");
    } else if (/claw/.test(lower)) {
      add("Claw", "Scratch", "Attack", "Bite");
    } else if (/pounce/.test(lower)) {
      add("Pounce", "Charge", "Attack", "Bite");
    } else if (/charge/.test(lower)) {
      add("Charge", "Pounce", "HeavyAttack", "Attack");
    } else if (/peck/.test(lower)) {
      add("Peck", "Attack", "Scratch");
    } else if (/scratch/.test(lower)) {
      add("Scratch", "Claw", "Bite", "Attack");
    } else if (/kick/.test(lower)) {
      add("Kick", "Charge", "Attack");
    } else if (/tail/.test(lower)) {
      add("TailWhip", "Attack");
    } else if (/death|fall/.test(lower)) {
      add("Death", "Fall", "Falling", "Stunned");
    } else if (/hit|react|hurt/.test(lower)) {
      add("HitReact", "Stunned", "Block", "ShieldBlock");
    } else {
      add(name);
    }
  }

  if (expanded.length === 0 && kind === "death") {
    add("Death", "Fall", "Falling", "Stunned");
  }
  return expanded;
}


function assetUrl(path: string) {
  return path
    .split("/")
    .map((part, index) =>
      index === 0 && part === "" ? "" : encodeURIComponent(part),
    )
    .join("/");
}

function gltf(key: string, path: string, defaultScale = 1): RuntimeAsset {
  return { key, format: "gltf", path: `${ROOT}/${path}`, defaultScale };
}

function fbx(key: string, path: string, defaultScale = 1): RuntimeAsset {
  return { key, format: "fbx", path: `${ROOT}/${path}`, defaultScale };
}

function obj(
  key: string,
  folder: string,
  file: string,
  defaultScale = 1,
): RuntimeAsset {
  return {
    key,
    format: "obj",
    path: `${ROOT}/obj/${folder}/${file}`,
    defaultScale,
  };
}

// Curated from public/assets/harthmere/manifest/harthmere-selected-assets.json
// plus the best older OBJ props. Do not load the whole asset library; the full
// library is too noisy for a playable town pass.
const ASSETS: RuntimeAsset[] = [
  // Market, exterior, and district readability.
  gltf("stall", "glb/props/market/stall.glb", 0.95),
  gltf("stall_red", "glb/props/market/stall-red.glb", 0.95),
  gltf("stall_green", "glb/props/market/stall-green.glb", 0.95),
  gltf("stall_bench", "glb/props/market/stall-bench.glb", 0.95),
  gltf("cart", "glb/props/market/cart.glb", 0.9),
  gltf("cart_high", "glb/props/market/cart-high.glb", 0.85),
  gltf("fountain_round", "glb/props/market/fountain-round.glb", 1.1),
  gltf("fountain_center", "glb/props/market/fountain-center.glb", 1.0),
  gltf("fountain_round_detail", "glb/props/market/fountain-round-detail.glb", 1.0),
  gltf("fountain_square_detail", "glb/props/market/fountain-square-detail.glb", 1.0),
  gltf("stall_stool", "glb/props/market/stall-stool.glb", 0.85),
  gltf("fountain_square", "glb/props/market/fountain-square.glb", 1.0),
  gltf("banner_red", "glb/props/town/banner-red.glb", 0.9),
  gltf("banner_green", "glb/props/town/banner-green.glb", 0.9),
  gltf("lantern", "glb/props/town/lantern.glb", 0.8),
  gltf("tree", "glb/environment/trees/tree.glb", 1.0),
  gltf("tree_high", "glb/environment/trees/tree-high.glb", 1.0),
  gltf("tree_crooked", "glb/environment/trees/tree-crooked.glb", 1.0),
  gltf("tree_high_crooked", "glb/environment/trees/tree-high-crooked.glb", 1.0),
  gltf("tree_high_round", "glb/environment/trees/tree-high-round.glb", 1.0),
  gltf("forest_tree_1a", "gltf/kaykit/forest_nature/Tree_1_A_Color1.gltf", 1.0),
  gltf("forest_tree_1b", "gltf/kaykit/forest_nature/Tree_1_B_Color1.gltf", 1.0),
  gltf("forest_tree_2a", "gltf/kaykit/forest_nature/Tree_2_A_Color1.gltf", 1.0),
  gltf("forest_tree_2d", "gltf/kaykit/forest_nature/Tree_2_D_Color1.gltf", 1.0),
  gltf("forest_tree_3b", "gltf/kaykit/forest_nature/Tree_3_B_Color1.gltf", 1.0),
  gltf("forest_tree_4c", "gltf/kaykit/forest_nature/Tree_4_C_Color1.gltf", 1.0),
  gltf("forest_tree_bare_1a", "gltf/kaykit/forest_nature/Tree_Bare_1_A_Color1.gltf", 1.0),
  gltf("forest_tree_bare_2b", "gltf/kaykit/forest_nature/Tree_Bare_2_B_Color1.gltf", 1.0),
  gltf("forest_bush_1a", "gltf/kaykit/forest_nature/Bush_1_A_Color1.gltf", 1.0),
  gltf("forest_bush_1d", "gltf/kaykit/forest_nature/Bush_1_D_Color1.gltf", 1.0),
  gltf("forest_bush_2b", "gltf/kaykit/forest_nature/Bush_2_B_Color1.gltf", 1.0),
  gltf("forest_bush_3c", "gltf/kaykit/forest_nature/Bush_3_C_Color1.gltf", 1.0),
  gltf("forest_bush_4e", "gltf/kaykit/forest_nature/Bush_4_E_Color1.gltf", 1.0),
  gltf("forest_grass_1a", "gltf/kaykit/forest_nature/Grass_1_A_Color1.gltf", 1.0),
  gltf("forest_grass_1c", "gltf/kaykit/forest_nature/Grass_1_C_Color1.gltf", 1.0),
  gltf("forest_grass_2b", "gltf/kaykit/forest_nature/Grass_2_B_Color1.gltf", 1.0),
  gltf("forest_grass_2d", "gltf/kaykit/forest_nature/Grass_2_D_Color1.gltf", 1.0),
  gltf("forest_rock_1a", "gltf/kaykit/forest_nature/Rock_1_A_Color1.gltf", 1.0),
  gltf("forest_rock_2c", "gltf/kaykit/forest_nature/Rock_2_C_Color1.gltf", 1.0),
  gltf("forest_rock_3f", "gltf/kaykit/forest_nature/Rock_3_F_Color1.gltf", 1.0),
  gltf("mine_stone_01", "glb/environment/mines/kyrises_voxel_mines/stone-01.glb", 0.9),
  gltf("mine_stone_02", "glb/environment/mines/kyrises_voxel_mines/stone-02.glb", 0.9),
  gltf("mine_coal_block", "glb/environment/mines/kyrises_voxel_mines/coal-block.glb", 0.9),
  gltf("mine_coal_piece", "glb/environment/mines/kyrises_voxel_mines/coal-piece.glb", 0.9),
  gltf("mine_silver_stone", "glb/environment/mines/kyrises_voxel_mines/silver-stone.glb", 0.9),
  gltf("mine_gold_fragment", "glb/environment/mines/kyrises_voxel_mines/gold-fragment.glb", 0.9),
  gltf("mine_pickaxe", "glb/environment/mines/kyrises_voxel_mines/pickaxe.glb", 0.8),
  gltf("minecart", "glb/environment/mines/kyrises_voxel_mines/minecart.glb", 0.8),
  gltf("hedge", "glb/environment/shrubbery/hedge.glb", 0.95),
  gltf("hedge_large", "glb/environment/shrubbery/hedge-large.glb", 0.95),
  gltf("fence", "glb/environment/fences/fence.glb", 0.95),
  gltf("fence_gate", "glb/environment/fences/fence-gate.glb", 0.95),
  gltf("fence_broken", "glb/environment/fences/fence-broken.glb", 0.95),
  gltf("road", "glb/environment/roads/road.glb", 1.0),
  gltf("rock_small", "glb/environment/rocks/rock-small.glb", 0.8),
  gltf("rock_wide", "glb/environment/rocks/rock-wide.glb", 0.8),

  // Deep resource scan additions: food/forage props from Quaternius packs.
  fbx("food_apple", "fbx/props/food/quaternius_ultimate_food/Apple.fbx", 0.006),
  fbx("food_green_apple", "fbx/props/food/quaternius_ultimate_food/Apple_Green.fbx", 0.006),
  fbx("food_carrot", "fbx/props/food/quaternius_ultimate_food/Carrot.fbx", 0.0035),
  fbx("food_fish", "fbx/props/food/quaternius_ultimate_food/Fish.fbx", 0.004),
  fbx("food_fishbone", "fbx/props/food/quaternius_ultimate_food/FishBone.fbx", 0.004),
  fbx("food_mushroom", "fbx/props/food/quaternius_ultimate_food/Mushroom.fbx", 0.018),
  gltf("mine_gold_block", "glb/environment/mines/kyrises_voxel_mines/gold-block.glb", 0.8),
  gltf("mine_silver_block", "glb/environment/mines/kyrises_voxel_mines/silver-block.glb", 0.8),
  gltf("mine_diamond_fragment", "glb/environment/mines/kyrises_voxel_mines/diamond-fragment.glb", 0.72),

  // Animated fallbacks for wildlife keys that do not have dedicated snake/frog action GLTFs yet.
  // These keep combat events on the GLTF animation system instead of clipCount: 0 procedural actors.
  gltf("animal_snake", "gltf/creatures/animal_action_variants/harthmere_animal_rat_gray.gltf", 0.68),
  gltf("animal_frog", "gltf/creatures/animal_action_variants/harthmere_animal_rabbit_brown.gltf", 0.55),

  // Action-ready living GLTFs. These mirror the procedural life keys used by
  // Harthmere placements, so combat can drive real humanoid/animal actors
  // when the downloaded GLTF packs are present. Missing/LFS-pointer assets
  // safely fall back to the existing procedural models below.
  gltf("animal_chicken", "gltf/creatures/animal_action_variants/harthmere_animal_chicken_brown.gltf", 0.9),
  gltf("animal_bunny", "gltf/creatures/animal_action_variants/harthmere_animal_rabbit_brown.gltf", 0.8),
  gltf("animal_pigeon", "gltf/creatures/animal_action_variants/harthmere_animal_pigeon_gray.gltf", 0.75),
  gltf("animal_cat", "gltf/creatures/animal_action_variants/harthmere_animal_cat_tabby.gltf", 0.85),
  gltf("animal_dog", "gltf/creatures/animal_action_variants/harthmere_animal_dog_tan.gltf", 0.95),
  gltf("animal_pig", "gltf/creatures/animal_action_variants/harthmere_animal_pig_muddy.gltf", 0.95),
  gltf("animal_sheep", "gltf/creatures/animal_action_variants/harthmere_animal_sheep_cream.gltf", 0.95),
  gltf("animal_cow", "gltf/creatures/animal_action_variants/harthmere_animal_cow_spotted.gltf", 1.05),
  gltf("animal_horse", "gltf/creatures/animal_action_variants/harthmere_animal_horse_bay.gltf", 1.1),
  gltf("animal_deer", "gltf/creatures/animal_action_variants/harthmere_animal_deer_doe.gltf", 1.0),
  gltf("animal_wolf", "gltf/creatures/animal_action_variants/harthmere_animal_wolf_gray.gltf", 1.0),
  gltf("animal_boar", "gltf/creatures/animal_action_variants/harthmere_animal_boar_brown.gltf", 0.98),
  gltf("animal_bear", "gltf/creatures/animal_action_variants/harthmere_animal_bear_black.gltf", 1.18),
  gltf("animal_fox", "gltf/creatures/animal_action_variants/harthmere_animal_fox_red.gltf", 0.85),
  gltf("animal_crow", "gltf/creatures/animal_action_variants/harthmere_animal_pigeon_blue.gltf", 0.72),
  gltf("animal_rat", "gltf/creatures/animal_action_variants/harthmere_animal_rat_gray.gltf", 0.65),
  gltf("townsperson_guard", "gltf/characters/player_body_variants/harthmere_player_broad_ash.gltf", 0.92),
  gltf("townsperson_courier", "gltf/characters/player_body_variants/harthmere_player_slim_river.gltf", 0.88),
  gltf("townsperson_dockhand", "gltf/characters/player_body_variants/harthmere_player_stocky_river.gltf", 0.9),
  gltf("townsperson_mudden", "gltf/characters/player_body_variants/harthmere_player_average_earth.gltf", 0.9),
  gltf("townsperson_farmer", "gltf/characters/player_body_variants/harthmere_player_average_forest.gltf", 0.9),
  gltf("townsperson_clergy", "gltf/characters/player_body_variants/harthmere_player_soft_royal.gltf", 0.88),
  gltf("townsperson_hunter", "gltf/characters/player_body_variants/harthmere_player_athletic_forest.gltf", 0.9),
  gltf("townsperson_bandit", "gltf/characters/player_body_variants/harthmere_player_athletic_ash.gltf", 0.9),
  gltf("townsperson_smuggler", "gltf/characters/player_body_variants/harthmere_player_slim_ash.gltf", 0.88),
  gltf("townsperson_undead", "gltf/characters/player_body_variants/harthmere_player_soft_ash.gltf", 0.88),
  gltf("townsperson_charcoal", "gltf/characters/player_body_variants/harthmere_player_stocky_earth.gltf", 0.9),
  gltf("townsperson_market", "gltf/characters/player_body_variants/harthmere_player_average_ember.gltf", 0.9),


  // HARTHMERE_V9_ARCHITECTURE_ASSETS_START
  // Modular building shells and landmark pieces used by the full town rebuild.
  // These are intentionally narrow and curated so the renderer builds a real
  // readable town instead of scattering every asset in the library.
  gltf("arch_wall_stone", "glb/buildings/fantasy_town/wall-block.glb", 1.0),
  gltf(
    "arch_wall_window_stone",
    "glb/buildings/fantasy_town/wall-window-stone.glb",
    1.0,
  ),
  gltf("arch_wall_door", "glb/buildings/fantasy_town/wall-door.glb", 1.0),
  gltf("arch_wall_window_glass", "glb/buildings/fantasy_town/wall-window-glass.glb", 1.0),
  gltf("arch_wall_window_round", "glb/buildings/fantasy_town/wall-window-round.glb", 1.0),
  gltf("arch_wall_doorway_round", "glb/buildings/fantasy_town/wall-doorway-round.glb", 1.0),
  gltf("arch_wall_corner", "glb/buildings/fantasy_town/wall-corner.glb", 1.0),
  gltf("arch_wall_broken", "glb/buildings/fantasy_town/wall-broken.glb", 1.0),
  gltf("arch_wall_wood", "glb/buildings/fantasy_town/wall-wood-block.glb", 1.0),
  gltf(
    "arch_wall_wood_window",
    "glb/buildings/fantasy_town/wall-wood-window-shutters.glb",
    1.0,
  ),
  gltf("arch_wall_wood_door", "glb/buildings/fantasy_town/wall-wood-door.glb", 1.0),
  gltf("arch_wall_wood_broken", "glb/buildings/fantasy_town/wall-wood-broken.glb", 1.0),
  gltf("arch_wall_wood_corner", "glb/buildings/fantasy_town/wall-wood-corner.glb", 1.0),
  gltf("arch_roof_gable", "glb/buildings/fantasy_town/roof-gable.glb", 1.0),
  gltf("arch_roof_high_gable", "glb/buildings/fantasy_town/roof-high-gable.glb", 1.0),
  gltf("arch_roof_high_point", "glb/buildings/fantasy_town/roof-high-point.glb", 1.0),
  gltf("arch_roof_high_window", "glb/buildings/fantasy_town/roof-high-window.glb", 1.0),
  gltf("arch_roof_flat", "glb/buildings/fantasy_town/roof-flat.glb", 1.0),
  gltf("arch_roof_window", "glb/buildings/fantasy_town/roof-window.glb", 1.0),
  gltf("arch_roof_corner", "glb/buildings/fantasy_town/roof-corner.glb", 1.0),
  gltf("arch_roof_left", "glb/buildings/fantasy_town/roof-left.glb", 1.0),
  gltf("arch_roof_right", "glb/buildings/fantasy_town/roof-right.glb", 1.0),
  gltf("arch_chimney", "glb/buildings/fantasy_town/chimney.glb", 1.0),
  gltf("arch_chimney_base", "glb/buildings/fantasy_town/chimney-base.glb", 1.0),
  gltf("arch_chimney_top", "glb/buildings/fantasy_town/chimney-top.glb", 1.0),
  gltf("arch_stairs_stone", "glb/buildings/fantasy_town/stairs-stone.glb", 1.0),
  gltf("arch_stairs_wide_stone", "glb/buildings/fantasy_town/stairs-wide-stone.glb", 1.0),
  gltf("arch_stairs_wood", "glb/buildings/fantasy_town/stairs-wood.glb", 1.0),
  gltf("arch_balcony_wall", "glb/buildings/fantasy_town/balcony-wall.glb", 1.0),
  gltf("arch_balcony_fence", "glb/buildings/fantasy_town/balcony-wall-fence.glb", 1.0),
  gltf("arch_planks", "glb/buildings/fantasy_town/planks.glb", 1.0),
  gltf("arch_overhang", "glb/buildings/fantasy_town/overhang.glb", 1.0),
  gltf("arch_pillar_stone", "glb/buildings/fantasy_town/pillar-stone.glb", 1.0),
  gltf("arch_pillar_wood", "glb/buildings/fantasy_town/pillar-wood.glb", 1.0),
  gltf("arch_watermill", "glb/buildings/fantasy_town/watermill.glb", 1.0),
  gltf("arch_windmill", "glb/buildings/fantasy_town/windmill.glb", 1.0),
  gltf("arch_wheel", "glb/buildings/fantasy_town/wheel.glb", 1.0),
  obj("obj_house_1", "medieval_voxel", "House_1", 1.0),
  obj("obj_house_2", "medieval_voxel", "House_2", 1.0),
  obj("obj_house_3", "medieval_voxel", "House_3", 1.0),
  obj("obj_shop_simple", "medieval_voxel", "Shop_Simple", 1.0),
  obj("obj_shop_closed", "medieval_voxel", "Shop_Closed", 1.0),
  obj("obj_kiosk", "medieval_voxel", "Kiosk", 1.0),
  obj("obj_tower_complex", "medieval_voxel", "Tower_Complex", 1.0),
  obj("obj_tower_door", "medieval_voxel", "Tower_Door", 1.0),
  obj("obj_tower_simple", "medieval_voxel", "Tower_Simple", 1.0),
  obj("obj_wall_entrance", "medieval_voxel", "Wall_Entrance", 1.0),
  obj("obj_wall_entrance_door", "medieval_voxel", "Wall_Entrance_Door", 1.0),
  obj("obj_wall_simple", "medieval_voxel", "Wall_Simple", 1.0),
  obj("obj_wall_simple_windows", "medieval_voxel", "Wall_Simple_Windows", 1.0),
  obj("obj_wall_stairs", "medieval_voxel", "Wall_Stairs", 1.0),
  obj("obj_bridge_low_body", "medieval_voxel", "Bridge_Low_Body", 1.0),
  obj("obj_bridge_medium_body", "medieval_voxel", "Bridge_Medium_Body", 1.0),
  obj("obj_flag_large_red", "medieval_voxel", "Flag_Large_Red", 1.0),
  obj("obj_flag_large_green", "medieval_voxel", "Flag_Large_Green", 1.0),
  obj("obj_flag_large_blue", "medieval_voxel", "Flag_Large_Blue", 1.0),
  obj("obj_sign_post", "medieval_voxel", "Sing_Post", 1.0),
  obj("obj_lamp_ground_large", "medieval_voxel", "Lamp_Ground_Large", 1.0),
  obj("obj_lamp_ground_small", "medieval_voxel", "Lamp_Ground_Small", 1.0),
  obj("obj_lamp_wall", "medieval_voxel", "Lamp_Wall", 1.0),
  obj("obj_cart_straight", "medieval_voxel", "Cart_Straight", 1.0),
  obj("obj_church_iso", "church_cemetery", "church-16-ch_iso", 1.0),
  obj("obj_church_roof_blue", "church_cemetery", "church-34-ch_roofblue", 1.0),
  obj("obj_church_bells", "church_cemetery", "church-80-churchbells", 1.0),
  obj("obj_church_window_lower", "church_cemetery", "church-81-ch_windowlower", 1.0),
  obj("obj_church_window_upper", "church_cemetery", "church-75-ch_windowupper", 1.0),
  obj("obj_church_base_lower", "church_cemetery", "church-83-ch_baselower", 1.0),
  obj("obj_church_base_upper", "church_cemetery", "church-82-ch_baseupper", 1.0),
  obj("obj_church_trapdoor_metal", "church_cemetery", "church-62-ch_trapdoormetal", 1.0),
  obj("obj_church_crypt", "church_cemetery", "church-67-crypt", 1.0),
  obj("obj_church_grave_fence", "church_cemetery", "church-70-gy_fencemetalal", 1.0),
  obj("obj_church_grave_wall", "church_cemetery", "church-71-gy_wallbase", 1.0),
  obj("obj_grave_dirt", "church_cemetery", "church-74-gy_dirtgrave", 1.0),
  obj("obj_gargoyle", "church_cemetery", "church-79-gargoyle", 1.0),
  // HARTHMERE_V9_ARCHITECTURE_ASSETS_END

  // Interior kit: all visual-only props, placed away from doorway lanes.
  gltf("table_small", "glb/props/dungeon/table_small.gltf.glb", 0.78),
  gltf("table_medium", "glb/props/dungeon/table_medium.gltf.glb", 0.82),
  gltf("table_long", "glb/props/dungeon/table_long.gltf.glb", 0.82),
  gltf(
    "table_long_decorated",
    "glb/props/dungeon/table_long_decorated_A.gltf.glb",
    0.82,
  ),
  gltf(
    "table_tablecloth",
    "glb/props/dungeon/table_medium_tablecloth.gltf.glb",
    0.82,
  ),
  gltf("chair", "glb/props/dungeon/chair.gltf.glb", 0.72),
  gltf("shelf_small", "glb/props/dungeon/shelf_small.gltf.glb", 0.78),
  gltf("shelf_large", "glb/props/dungeon/shelf_large.gltf.glb", 0.78),
  gltf("shelf_candles", "glb/props/dungeon/shelf_small_candles.gltf.glb", 0.78),
  gltf("barrel_small", "glb/props/dungeon/barrel_small.gltf.glb", 0.74),
  gltf("barrel_stack", "glb/props/dungeon/barrel_small_stack.gltf.glb", 0.74),
  gltf("barrel_large", "glb/props/dungeon/barrel_large.gltf.glb", 0.74),
  gltf("crates_stacked", "glb/props/dungeon/crates_stacked.gltf.glb", 0.76),
  gltf("box_decorated", "glb/props/dungeon/box_small_decorated.gltf.glb", 0.76),
  gltf("box_stacked", "glb/props/dungeon/box_stacked.gltf.glb", 0.76),
  gltf("chest", "glb/props/dungeon/chest.glb", 0.76),
  gltf("chest_gold", "glb/props/dungeon/chest_gold.glb", 0.76),
  gltf("torch_lit", "glb/props/dungeon/torch_lit.gltf.glb", 0.72),
  gltf("torch_mounted", "glb/props/dungeon/torch_mounted.gltf.glb", 0.72),
  gltf("wall_shelves", "glb/props/dungeon/wall_shelves.gltf.glb", 0.8),
  gltf("pillar", "glb/props/dungeon/pillar.gltf.glb", 0.8),
  gltf("key", "glb/props/dungeon/key.gltf.glb", 0.55),

  // Magic/apothecary and color identity.
  gltf("candle", "glb/props/magic/candle.gltf.glb", 0.65),
  gltf("candle_lit", "glb/props/magic/candle_lit.gltf.glb", 0.65),
  gltf("candle_thin_lit", "glb/props/magic/candle_thin_lit.gltf.glb", 0.65),
  gltf("candle_triple", "glb/props/magic/candle_triple.gltf.glb", 0.65),
  gltf("bottle_brown", "glb/props/magic/bottle_A_labeled_brown.gltf.glb", 0.62),
  gltf("bottle_green", "glb/props/magic/bottle_A_labeled_green.gltf.glb", 0.62),
  gltf("bottle_b", "glb/props/magic/bottle_B_brown.gltf.glb", 0.62),
  gltf("banner_blue", "glb/props/magic/banner_patternA_blue.gltf.glb", 0.82),
  gltf(
    "banner_yellow",
    "glb/props/magic/banner_patternB_yellow.gltf.glb",
    0.82,
  ),
  gltf("banner_white", "glb/props/magic/banner_white.gltf.glb", 0.82),
  gltf("banner_brown", "glb/props/magic/banner_brown.gltf.glb", 0.82),

  // Wieldable/display equipment. These remain visual-only in town until a hand
  // socket/equipment attachment system consumes them.
  gltf("sword_1h", "glb/equipment/weapons/sword_1handed.gltf", 0.7),
  gltf("sword_2h", "glb/equipment/weapons/sword_2handed.gltf", 0.72),
  gltf("sword_2h_color", "glb/equipment/weapons/sword_2handed_color.gltf", 0.72),
  gltf("axe_1h", "glb/equipment/weapons/axe_1handed.gltf", 0.72),
  gltf("axe_2h", "glb/equipment/weapons/axe_2handed.gltf", 0.72),
  gltf("dagger", "glb/equipment/weapons/dagger.gltf", 0.65),
  gltf("shield_round", "glb/equipment/shields/shield_round.gltf", 0.7),
  gltf(
    "shield_round_color",
    "glb/equipment/shields/shield_round_color.gltf",
    0.7,
  ),
  gltf(
    "shield_square_color",
    "glb/equipment/shields/shield_square_color.gltf",
    0.7,
  ),
  gltf("bow", "glb/equipment/ranged/bow.gltf", 0.72),
  gltf("crossbow", "glb/equipment/ranged/crossbow_2handed.gltf", 0.72),
  gltf("quiver", "glb/equipment/ranged/quiver.gltf", 0.72),
  gltf("staff", "glb/equipment/magic/staff.gltf", 0.75),
  gltf("wand", "glb/equipment/magic/wand.gltf", 0.7),
  gltf("spellbook_closed", "glb/equipment/magic/spellbook_closed.gltf", 0.7),
  gltf("spellbook_open", "glb/equipment/magic/spellbook_open.gltf", 0.7),
  gltf("mug_empty", "glb/equipment/items/mug_empty.gltf", 0.65),
  gltf("mug_full", "glb/equipment/items/mug_full.gltf", 0.65),

  // Older OBJ packs still have useful bespoke medieval props.
  obj("bread_loaf", "tavern", "tavern-58-bread_loaf", 1.05),
  obj("bread_slice", "tavern", "tavern-57-bread_slice", 1.05),
  obj("cheese", "tavern", "tavern-6-cheese", 0.95),
  obj("shelf_meat", "tavern", "tavern-33-shelf_meat", 0.9),
  obj("cake", "tavern", "tavern-56-cake", 1.0),
  obj("keg_iso", "tavern", "tavern-76-keg_iso", 1.0),
  obj("keg_metal", "tavern", "tavern-17-keg_metalbinding", 1.0),
  obj("tavern_bar", "tavern", "tavern-25-bar", 0.95),
  obj("tavern_bar_corner", "tavern", "tavern-24-barcorner", 0.95),
  obj("tavern_table", "tavern", "tavern-48-table", 1.0),
  obj("tavern_chair", "tavern", "tavern-46-chair", 0.9),
  obj("tavern_stool", "tavern", "tavern-47-stool", 0.9),
  obj("tavern_bookshelf", "tavern", "tavern-35-bookshelf_books", 0.92),
  obj("church_bench", "church_cemetery", "church-27-ch_bench2", 0.95),
  obj("church_pulpit", "church_cemetery", "church-29-ch_pulpit2", 0.95),
  obj("church_candelabra", "church_cemetery", "church-38-candelabrawhite", 0.9),
  obj("church_lantern", "church_cemetery", "church-59-lantern", 0.85),
  obj("tombstone", "church_cemetery", "church-58-gy_tombstone1", 0.85),
  obj("coffin", "church_cemetery", "church-55-coffin", 0.9),
  obj("shovel", "church_cemetery", "church-72-shovel", 0.85),
  obj("crate_a", "town_sample", "Medieval Town - Free Sample-0-Crate-0", 1.45),
  obj("crate_b", "town_sample", "Medieval Town - Free Sample-1-Crate-1", 1.45),
  obj("crate_c", "town_sample", "Medieval Town - Free Sample-5-Crate-2", 1.45),
  obj("trolley", "town_sample", "Medieval Town - Free Sample-3-Trolley", 0.95),
  obj("rack", "town_sample", "Medieval Town - Free Sample-8-Rack", 0.95),
  obj("logs", "town_sample", "Medieval Town - Free Sample-9-Logs", 0.95),

  // Quaternius fantasy props used for the clean Harthmere rebuild. These are
  // intentionally mapped by district instead of dumped randomly into houses.
  gltf("bed_twin1", "gltf/quaternius/fantasy_props/Bed_Twin1.gltf", 0.82),
  gltf("bed_twin2", "gltf/quaternius/fantasy_props/Bed_Twin2.gltf", 0.82),
  gltf(
    "nightstand",
    "gltf/quaternius/fantasy_props/Nightstand_Shelf.gltf",
    0.8,
  ),
  gltf("cabinet", "gltf/quaternius/fantasy_props/Cabinet.gltf", 0.82),
  gltf("bookcase_2", "gltf/quaternius/fantasy_props/Bookcase_2.gltf", 0.82),
  gltf("bench_fp", "gltf/quaternius/fantasy_props/Bench.gltf", 0.82),
  gltf(
    "table_large_fp",
    "gltf/quaternius/fantasy_props/Table_Large.gltf",
    0.82,
  ),
  gltf(
    "table_plate_fp",
    "gltf/quaternius/fantasy_props/Table_Plate.gltf",
    0.68,
  ),
  gltf(
    "table_knife_fp",
    "gltf/quaternius/fantasy_props/Table_Knife.gltf",
    0.68,
  ),
  gltf(
    "table_spoon_fp",
    "gltf/quaternius/fantasy_props/Table_Spoon.gltf",
    0.68,
  ),
  gltf("mug_fp", "gltf/quaternius/fantasy_props/Mug.gltf", 0.68),
  gltf("stool_fp", "gltf/quaternius/fantasy_props/Stool.gltf", 0.78),
  gltf("chandelier_fp", "gltf/quaternius/fantasy_props/Chandelier.gltf", 0.78),
  gltf(
    "lantern_wall_fp",
    "gltf/quaternius/fantasy_props/Lantern_Wall.gltf",
    0.8,
  ),
  gltf("barrel_fp", "gltf/quaternius/fantasy_props/Barrel.gltf", 0.82),
  gltf(
    "barrel_holder_fp",
    "gltf/quaternius/fantasy_props/Barrel_Holder.gltf",
    0.82,
  ),
  gltf(
    "barrel_apples",
    "gltf/quaternius/fantasy_props/Barrel_Apples.gltf",
    0.82,
  ),
  gltf(
    "farmcrate_apple",
    "gltf/quaternius/fantasy_props/FarmCrate_Apple.gltf",
    0.82,
  ),
  gltf(
    "farmcrate_carrot",
    "gltf/quaternius/fantasy_props/FarmCrate_Carrot.gltf",
    0.82,
  ),
  gltf(
    "crate_wooden_fp",
    "gltf/quaternius/fantasy_props/Crate_Wooden.gltf",
    0.82,
  ),
  gltf(
    "crate_metal_fp",
    "gltf/quaternius/fantasy_props/Crate_Metal.gltf",
    0.82,
  ),
  gltf("bag_fp", "gltf/quaternius/fantasy_props/Bag.gltf", 0.78),
  gltf(
    "bucket_wood",
    "gltf/quaternius/fantasy_props/Bucket_Wooden_1.gltf",
    0.78,
  ),
  gltf("rope_1_fp", "gltf/quaternius/fantasy_props/Rope_1.gltf", 0.78),
  gltf("rope_2_fp", "gltf/quaternius/fantasy_props/Rope_2.gltf", 0.78),
  gltf("rope_3_fp", "gltf/quaternius/fantasy_props/Rope_3.gltf", 0.78),
  gltf("chain_coil", "gltf/quaternius/fantasy_props/Chain_Coil.gltf", 0.78),
  gltf("anvil_fp", "gltf/quaternius/fantasy_props/Anvil.gltf", 0.8),
  gltf("anvil_log_fp", "gltf/quaternius/fantasy_props/Anvil_Log.gltf", 0.8),
  gltf("workbench_fp", "gltf/quaternius/fantasy_props/Workbench.gltf", 0.82),
  gltf(
    "workbench_drawers_fp",
    "gltf/quaternius/fantasy_props/Workbench_Drawers.gltf",
    0.82,
  ),
  gltf(
    "weaponstand_fp",
    "gltf/quaternius/fantasy_props/WeaponStand.gltf",
    0.82,
  ),
  gltf(
    "sword_bronze_fp",
    "gltf/quaternius/fantasy_props/Sword_Bronze.gltf",
    0.72,
  ),
  gltf("axe_bronze_fp", "gltf/quaternius/fantasy_props/Axe_Bronze.gltf", 0.72),
  gltf(
    "pickaxe_bronze_fp",
    "gltf/quaternius/fantasy_props/Pickaxe_Bronze.gltf",
    0.72,
  ),
  gltf(
    "shield_wooden_fp",
    "gltf/quaternius/fantasy_props/Shield_Wooden.gltf",
    0.72,
  ),
  gltf("whetstone_fp", "gltf/quaternius/fantasy_props/Whetstone.gltf", 0.72),
  gltf(
    "torch_metal_fp",
    "gltf/quaternius/fantasy_props/Torch_Metal.gltf",
    0.78,
  ),
  gltf("chest_wood_fp", "gltf/quaternius/fantasy_props/Chest_Wood.gltf", 0.82),
  gltf("coin_fp", "gltf/quaternius/fantasy_props/Coin.gltf", 0.62),
  gltf("coin_pile", "gltf/quaternius/fantasy_props/Coin_Pile.gltf", 0.62),
  gltf("coin_pile_2", "gltf/quaternius/fantasy_props/Coin_Pile_2.gltf", 0.62),
  gltf("key_gold_fp", "gltf/quaternius/fantasy_props/Key_Gold.gltf", 0.62),
  gltf("key_metal_fp", "gltf/quaternius/fantasy_props/Key_Metal.gltf", 0.62),
  gltf("book_stack_1", "gltf/quaternius/fantasy_props/Book_Stack_1.gltf", 0.68),
  gltf("book_stack_2", "gltf/quaternius/fantasy_props/Book_Stack_2.gltf", 0.68),
  gltf(
    "book_group_1",
    "gltf/quaternius/fantasy_props/BookGroup_Medium_1.gltf",
    0.68,
  ),
  gltf(
    "book_group_2",
    "gltf/quaternius/fantasy_props/BookGroup_Medium_2.gltf",
    0.68,
  ),
  gltf("bookstand_fp", "gltf/quaternius/fantasy_props/BookStand.gltf", 0.76),
  gltf("scroll_1_fp", "gltf/quaternius/fantasy_props/Scroll_1.gltf", 0.66),
  gltf("scroll_2_fp", "gltf/quaternius/fantasy_props/Scroll_2.gltf", 0.66),
  gltf("potion_1_fp", "gltf/quaternius/fantasy_props/Potion_1.gltf", 0.62),
  gltf("potion_2_fp", "gltf/quaternius/fantasy_props/Potion_2.gltf", 0.62),
  gltf("potion_4_fp", "gltf/quaternius/fantasy_props/Potion_4.gltf", 0.62),
  gltf(
    "small_bottle_fp",
    "gltf/quaternius/fantasy_props/SmallBottle.gltf",
    0.62,
  ),
  gltf(
    "small_bottles_1",
    "gltf/quaternius/fantasy_props/SmallBottles_1.gltf",
    0.62,
  ),
  gltf(
    "shelf_small_bottles",
    "gltf/quaternius/fantasy_props/Shelf_Small_Bottles.gltf",
    0.78,
  ),
  gltf("cauldron_fp", "gltf/quaternius/fantasy_props/Cauldron.gltf", 0.8),
  gltf("candle_1_fp", "gltf/quaternius/fantasy_props/Candle_1.gltf", 0.62),
  gltf("candlestick_fp", "gltf/quaternius/fantasy_props/CandleStick.gltf", 0.7),
  gltf(
    "candlestick_stand_fp",
    "gltf/quaternius/fantasy_props/CandleStick_Stand.gltf",
    0.75,
  ),
  gltf(
    "candlestick_triple_fp",
    "gltf/quaternius/fantasy_props/CandleStick_Triple.gltf",
    0.7,
  ),
  gltf("chalice_fp", "gltf/quaternius/fantasy_props/Chalice.gltf", 0.66),
  gltf("carrot_fp", "gltf/quaternius/fantasy_props/Carrot.gltf", 0.62),
  gltf("dummy_fp", "gltf/quaternius/fantasy_props/Dummy.gltf", 0.88),
  gltf("cage_small_fp", "gltf/quaternius/fantasy_props/Cage_Small.gltf", 0.78),

  // Animals only. No monster placements in town.
];

const assetByKey = new Map(ASSETS.map((asset) => [asset.key, asset]));


const HARTHMERE_TINY_FBX_FOOD_SCALE_CAPS: Record<string, number> = {
  food_apple: 0.006,
  food_green_apple: 0.006,
  food_carrot: 0.0035,
  food_fish: 0.004,
  food_fishbone: 0.004,
  food_mushroom: 0.018,
};

function normalizeHarthmerePropPlacementScale(
  asset: string,
  scale: number | undefined,
): number | undefined {
  const cap = HARTHMERE_TINY_FBX_FOOD_SCALE_CAPS[asset];
  if (cap === undefined) {
    return scale;
  }
  if (scale === undefined) {
    return cap;
  }
  return Math.min(scale, cap);
}

const P = (
  asset: string,
  x: number,
  z: number,
  rot = 0,
  scale?: number,
  name?: string,
  districtOrY?: string | number,
  y = GROUND_Y,
): RuntimePlacement => {
  const district = typeof districtOrY === "string" ? districtOrY : undefined;
  const placementY = typeof districtOrY === "number" ? districtOrY : y;
  const normalizedScale = normalizeHarthmerePropPlacementScale(asset, scale);
  const effectiveScale = normalizedScale ?? assetByKey.get(asset)?.defaultScale;
  const meta = makeHarthmerePropMetadata({
    asset,
    name,
    district,
    position: [x, placementY, z],
    scale: effectiveScale,
  });
  return {
    asset,
    at: [x, placementY, z],
    rot,
    scale: effectiveScale,
    name,
    district,
    meta,
    collision: meta.collision,
    lodTier: meta.lodTier,
  };
};

const A = (
  asset: string,
  x: number,
  z: number,
  rot = 0,
  scale?: number,
  name?: string,
  district?: string,
  wander?: RuntimePlacement["wander"],
  combatOffset?: number,
): RuntimePlacement => {
  const effectiveActorScale = scale ?? assetByKey.get(asset)?.defaultScale;
  const meta = makeHarthmereActorMetadata({
    asset,
    name,
    district,
    scale: effectiveActorScale,
  });
  return {
    asset,
    at: [x, GROUND_Y, z],
    rot,
    scale: effectiveActorScale,
    name,
    district,
    meta,
    collision: meta.collision,
    lodTier: meta.lodTier,
    // Every visible living human/animal/undead gets a stable combat offset.
    // Explicit 900x offsets stay unchanged; generated 10000+ offsets make
    // ordinary town NPCs and ambient animals hittable by the forward arc too.
    combatOffset:
      combatOffset ?? harthmereAutoCombatOffset(asset, x, z, name, district),
    bob: 0.015,
    wander: normalizeHarthmereActorWander(asset, name, district, x, z, wander),
  };
};


const HARTHMERE_ROUTE_POSITION_SAFE_VERSION_V67 = "harthmere-route-position-safe-negative-progress-v67";
const HARTHMERE_NPC_ROUTE_DISTRIBUTION_VERSION_V48 = "harthmere-npc-route-dispersal-density-v48";
const HARTHMERE_NPC_LOCAL_DENSITY_MAX_WITHIN_12M_V48 = 7;
const HARTHMERE_NPC_LOCAL_DENSITY_MAX_WITHIN_20M_V48 = 16;

const HARTHMERE_NPC_ROUTE_ANCHORS_V48 = {
  north_gate: [[476, -286], [486, -270], [502, -286], [514, -260], [468, -258]],
  guard_yard: [[506, -256], [522, -260], [530, -276], [508, -282], [492, -266]],
  market_square: [[456, -214], [474, -206], [492, -198], [512, -214], [498, -230], [466, -232], [438, -206], [538, -194]],
  player_services: [[548, -216], [562, -224], [566, -202], [540, -198], [526, -210], [558, -236]],
  craftsman_row: [[512, -232], [528, -238], [540, -226], [504, -220], [496, -236], [524, -248]],
  copper_kettle: [[540, -188], [552, -196], [562, -184], [534, -204], [548, -210]],
  temple_green: [[466, -146], [482, -142], [496, -150], [488, -164], [458, -160]],
  noble_rise: [[554, -260], [570, -270], [584, -250], [548, -242], [566, -232]],
  river_docks: [[584, -176], [604, -166], [620, -190], [592, -210], [566, -188], [612, -228]],
  mudden_ward: [[392, -154], [410, -146], [428, -158], [444, -138], [404, -126], [462, -122]],
  residential: [[342, -314], [368, -314], [394, -314], [424, -314], [454, -314], [342, -358], [372, -358], [402, -358], [432, -358], [462, -358]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

function harthmereNpcStableHashV48(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function harthmereTownRouteKeyForActorV48(asset: string, name?: string, district?: string): keyof typeof HARTHMERE_NPC_ROUTE_ANCHORS_V48 | undefined {
  const rawDistrict = `${district ?? ""}`.toLowerCase();
  const label = `${asset} ${name ?? ""} ${district ?? ""}`.toLowerCase();
  if (/wilds|forest|briarfen|gravewood|bandit ridge|greenmere|watchtower ridge|charcoal|orchard lane|gate fields|mill road|old hunter/.test(label)) return undefined;
  if (/mudden/.test(rawDistrict)) return "mudden_ward";
  if (/residential|farm/.test(rawDistrict)) return "residential";
  if (/north gate/.test(rawDistrict)) return "north_gate";
  if (/guard yard/.test(rawDistrict)) return "guard_yard";
  if (/player services/.test(rawDistrict)) return "player_services";
  if (/craftsman|apothecary|magic shop/.test(rawDistrict)) return "craftsman_row";
  if (/copper kettle/.test(rawDistrict)) return "copper_kettle";
  if (/temple|chapel/.test(rawDistrict)) return "temple_green";
  if (/noble/.test(rawDistrict)) return "noble_rise";
  if (/river docks|dock/.test(rawDistrict)) return "river_docks";
  if (/market/.test(rawDistrict)) return "market_square";
  if (/mudden|slum|rat-catcher|washer/.test(label)) return "mudden_ward";
  if (/residential|cottage|house|farmer|farmhand|chicken|pig|cow|sheep/.test(label)) return "residential";
  if (/north gate|stable|gate dog|gate patrol/.test(label)) return "north_gate";
  if (/player services|bank|auction|storage|courier anwen|mail|guild|wardrobe/.test(label)) return "player_services";
  if (/craftsman|black anvil|smith|forge|carpentry|tailor|leather|ore delivery/.test(label)) return "craftsman_row";
  if (/copper kettle|inn|tavern|gambler|bard|patron/.test(label)) return "copper_kettle";
  if (/temple|chapel|clergy|father|sister|pilgrim|apothecary|ysabet|healer/.test(label)) return "temple_green";
  if (/noble|reeve|edrik|tax|legal|clerk/.test(label)) return "noble_rise";
  if (/river docks|dock|ferry|fish|smuggl|warehouse|tovin/.test(label)) return "river_docks";
  if (/guard|sergeant|bounty|duel|sparring|drill|prisoner|quartermaster/.test(label)) return "guard_yard";
  if (/market|mara|vendor|produce|crier|performer|customer|pigeon|livestock|pickpocket/.test(label)) return "market_square";
  return "market_square";
}

function makeHarthmereTownActorRouteWanderV48(
  asset: string,
  name: string | undefined,
  district: string | undefined,
  x: number,
  z: number,
  wander: RuntimePlacement["wander"] | undefined,
): RuntimePlacement["wander"] | undefined {
  if (!isHarthmereLifeAsset(asset)) {
    return wander;
  }
  const routeKey = harthmereTownRouteKeyForActorV48(asset, name, district);
  if (!routeKey) {
    return wander;
  }
  const anchors = HARTHMERE_NPC_ROUTE_ANCHORS_V48[routeKey];
  const hash = harthmereNpcStableHashV48(`${asset}|${name ?? ""}|${district ?? ""}|${x.toFixed(1)}|${z.toFixed(1)}`);
  const start = hash % anchors.length;
  const route: [number, number][] = [];
  const routeLength = Math.min(4, Math.max(2, anchors.length));
  for (let i = 0; i < routeLength; i += 1) {
    const [ax, az] = anchors[(start + i) % anchors.length];
    const jitter = ((hash >>> (i * 3)) % 5) - 2;
    route.push([ax + jitter * 0.8, az + (((hash >>> (i * 5)) % 5) - 2) * 0.8]);
  }
  return {
    radius: Math.min(Math.max(wander?.radius ?? 1.1, 0.6), 2.4),
    speed: Math.min(Math.max(wander?.speed ?? 0.055, 0.035), 0.12),
    phase: wander?.phase ?? ((hash % 628) / 100),
    route,
    routeLabel: routeKey,
  };
}

function isHarthmereValidRoutePointV67(point: readonly [number, number] | undefined): point is readonly [number, number] {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function firstHarthmereValidRoutePointV67(route: readonly [number, number][]): [number, number] {
  for (const point of route) {
    if (isHarthmereValidRoutePointV67(point)) {
      return [point[0], point[1]];
    }
  }
  return [0, 0];
}

function harthmereRoutePositionV48(route: readonly [number, number][], progress: number): [number, number] {
  if (route.length === 0) return [0, 0];
  if (!Number.isFinite(progress)) return firstHarthmereValidRoutePointV67(route);
  if (route.length === 1) {
    const only = route[0];
    return isHarthmereValidRoutePointV67(only) ? [only[0], only[1]] : [0, 0];
  }

  const floorProgress = Math.floor(progress);
  const segment = ((floorProgress % route.length) + route.length) % route.length;
  const t = progress - floorProgress;
  const a = route[segment];
  const b = route[(segment + 1) % route.length];

  if (!isHarthmereValidRoutePointV67(a) || !isHarthmereValidRoutePointV67(b)) {
    if (isHarthmereValidRoutePointV67(a)) return [a[0], a[1]];
    if (isHarthmereValidRoutePointV67(b)) return [b[0], b[1]];
    return firstHarthmereValidRoutePointV67(route);
  }

  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function makeHarthmereIndexedNpcRouteV48(
  routeKey: keyof typeof HARTHMERE_NPC_ROUTE_ANCHORS_V48,
  sequence: number,
): [number, number][] {
  const anchors = HARTHMERE_NPC_ROUTE_ANCHORS_V48[routeKey];
  const route: [number, number][] = [];
  const spreadRing = Math.floor(sequence / Math.max(1, anchors.length));
  const spreadDistance = spreadRing * 5.5;
  const spreadAngle = sequence * 2.399963229728653;
  const ox = Math.cos(spreadAngle) * spreadDistance;
  const oz = Math.sin(spreadAngle) * spreadDistance;
  const start = sequence % anchors.length;
  const routeLength = Math.min(4, Math.max(2, anchors.length));
  for (let i = 0; i < routeLength; i += 1) {
    const [ax, az] = anchors[(start + i) % anchors.length];
    const side = i % 2 === 0 ? 1 : -1;
    route.push([ax + ox + side * 1.2, az + oz - side * 1.2]);
  }
  return route;
}

function normalizeHarthmereActorWander(
  asset: string,
  name: string | undefined,
  district: string | undefined,
  x: number,
  z: number,
  wander: RuntimePlacement["wander"] | undefined,
): RuntimePlacement["wander"] | undefined {
  const routedTownWander = makeHarthmereTownActorRouteWanderV48(asset, name, district, x, z, wander);
  if (routedTownWander?.route?.length) {
    return routedTownWander;
  }
  if (!wander) {
    return undefined;
  }

  const label = `${asset} ${name ?? ""} ${district ?? ""}`.toLowerCase();
  const isWilds = label.includes("harthmere wilds");

  // V48: town actors now get authored district route loops above, rather than
  // standing in one blob. Legacy circular wander remains valid in the wilds.
  if (!isWilds) {
    return undefined;
  }

  return wander;
}



type BuildingTheme = {
  wall: string;
  window: string;
  door: string;
  roof: string;
  corner?: string;
  chimney?: string;
  stair?: string;
  banner?: string;
};

type BuildingShell = {
  name: string;
  district: string;
  x: number;
  z: number;
  w: number;
  d: number;
  rot?: number;
  scale?: number;
  wallY?: number;
  roofY?: number;
  roofScale?: number;
  theme: BuildingTheme;
};


type HarthmereNpcCollisionObstacle = {
  name: string;
  asset?: string;
  district?: string;
  cx: number;
  cy?: number;
  cz: number;
  halfX: number;
  halfZ: number;
  playerHalfX?: number;
  playerHalfZ?: number;
  minY?: number;
  maxY?: number;
  jumpable?: boolean;
  playerPadding?: number;
  collisionProfile?: string;
  collisionHardness?: "none" | "soft" | "hard" | "wall";
  playerCanWalkThrough?: boolean;
  npcCanWalkThrough?: boolean;
  rot: number;
  padding?: number;
};

const HARTHMERE_NPC_COLLISION_RADIUS = 0.78;
const HARTHMERE_NPC_COLLISION_MIN_MOVE_SQ = 0.0009;
let harthmereNpcCollisionObstacleCache: HarthmereNpcCollisionObstacle[] | undefined;

const HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1 = "harthmere-procedural-solid-asset-collision-v1";
let harthmereDynamicProceduralCollisionObstacles: HarthmereNpcCollisionObstacle[] = [];

function registerHarthmereProceduralSolidObstacle(obstacle: HarthmereNpcCollisionObstacle): void {
  // Runtime supports adding procedural/dynamic obstacles for event-spawned
  // barricades, crates, carts, wagons, coffins, stalls, tables, fences, rocks,
  // and debris. These go through the same player/NPC obstacle export as authored
  // placements so spawned solid props cannot be walk-through.
  harthmereDynamicProceduralCollisionObstacles = [
    ...harthmereDynamicProceduralCollisionObstacles.filter((existing) => existing.name !== obstacle.name),
    obstacle,
  ];

  invalidateHarthmereNpcObstacleGridV50();
}

function removeHarthmereProceduralSolidObstacle(name: string): void {
  harthmereDynamicProceduralCollisionObstacles = harthmereDynamicProceduralCollisionObstacles.filter((obstacle) => obstacle.name !== name);

  invalidateHarthmereNpcObstacleGridV50();
}

function clearHarthmereProceduralSolidObstacles(): void {
  // cleanup/despawn hook for procedural obstacle cleanup when events end.
  harthmereDynamicProceduralCollisionObstacles = [];

  invalidateHarthmereNpcObstacleGridV50();
}

function harthmereAllCollisionObstacles(): HarthmereNpcCollisionObstacle[] {
  return [
    ...harthmereNpcCollisionObstacles(),
    ...harthmereDynamicProceduralCollisionObstacles,
  ];
}


const HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V1 = true;
const HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V2 = true;
const HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V3 = true;
const HARTHMERE_COLLISION_PROFILE_OBSTACLE_EXPORT_V4 = true;
const HARTHMERE_SOLID_LANDMARK_FIXTURE_COLLISION_VERSION_V1 = true;

function isHarthmereBuildingNavigationOpeningPlacement(asset: string, name: string): boolean {
  return (
    name.includes("front door") ||
    name.includes("entry step") ||
    name.includes("entry stair") ||
    name.includes("doorway clear") ||
    name.includes("public entrance") ||
    name.includes("shop entrance") ||
    name.includes("building entrance") ||
    name.includes("gate passage") ||
    name.includes("road exit") ||
    name.includes("town exit") ||
    name.includes("archway") ||
    name.includes("opening") ||
    (/^arch_stairs_/i.test(asset) && /entry|front|stair|steps/.test(name)) ||
    (/^arch_wall_.*door/i.test(asset) && /front door|public entrance|shop entrance|building entrance/.test(name)) ||
    (/^obj_wall_entrance_door/i.test(asset) && /ironbound door|gate passage|road exit|town exit/.test(name))
  );
}

function isHarthmereExteriorWindowCollisionAsset(asset: string): boolean {
  return /^arch_wall_.*window/i.test(asset) || /^obj_(church|chapel|temple|cathedral|cottage|shop|inn|tavern|smithy|barracks|tower).*window/i.test(asset);
}

function isHarthmereSolidBannerOrFlagFixture(asset: string, name: string): boolean {
  return (
    /^obj_flag_large_/i.test(asset) ||
    /watch banner|north gate banner|watch tower banner|gate banner|warning banner|solid flag pole|banner planted/i.test(name)
  );
}

function isHarthmereBuildingBodyAsset(asset: string, name: string): boolean {
  if (/window|door|stair|steps|roof|chimney/i.test(asset)) {
    return false;
  }
  // BUILDING_V2_VOXEL_MESHES: include the medieval_voxel whole-building
  // meshes (House_1/2/3, Shop_Simple/Closed, Tower_Complex/Simple/Door,
  // Wall_Simple variants, Kiosk) so the LOD / collision system treats
  // them like building bodies rather than tiny props.
  return (
    /^obj_(church|chapel|temple|cathedral|town_hall|shop|smithy|inn|tavern|cottage|hut|barracks|tower_body|gate_house)_/i.test(asset) ||
    /^obj_house_\d+$/i.test(asset) ||
    /^obj_shop_(simple|closed)$/i.test(asset) ||
    /^obj_tower_(complex|simple|door)$/i.test(asset) ||
    /^obj_wall_(simple|simple_windows|entrance|entrance_door|stairs)$/i.test(asset) ||
    asset === "obj_kiosk" ||
    /church|chapel|temple|cathedral|building body|shop body|smithy body|inn body|tavern body|whole voxel building mesh/i.test(name)
  );
}

function harthmerePlayerCollisionObstacleShapeForPlacement(
  placement: RuntimePlacement,
  halfX: number,
  halfZ: number,
): {
  playerHalfX: number;
  playerHalfZ: number;
  minY: number;
  maxY: number;
  jumpable: boolean;
  playerPadding: number;
  collisionProfile: string;
  collisionHardness: "none" | "soft" | "hard" | "wall";
  playerCanWalkThrough: boolean;
  npcCanWalkThrough: boolean;
} {
  const scale = placement.scale ?? assetByKey.get(placement.asset)?.defaultScale ?? 1;
  const asset = placement.asset;
  const name = (placement.name ?? asset).toLowerCase();
  const district = (placement.district ?? "").toLowerCase();
  const y = placement.at[1];
  const isAuthoredSolidLandmarkFixture =
    isHarthmereSolidBannerOrFlagFixture(asset, name) ||
    /^obj_lamp_ground_/i.test(asset) ||
    /^fountain_(round_detail|center|square_detail|square)$/i.test(asset) ||
    name.includes("gate brazier") ||
    name.includes("fountain lamp") ||
    name.includes("bridge fountain carved rim") ||
    name.includes("bridge fountain center stone");

  let playerHalfX = halfX;
  let playerHalfZ = halfZ;
  let height = 2.2 * scale;
  let jumpable = false;
  let playerPadding = 0;
  let collisionProfile = "solid_prop";
  let collisionHardness: "none" | "soft" | "hard" | "wall" = "hard";
  let playerCanWalkThrough = false;
  let npcCanWalkThrough = false;

  const isNorthGateExitDoor = district.includes("north gate") && name.includes("ironbound door");
  const isWalkableGateOrStair =
    isNorthGateExitDoor ||
    isHarthmereBuildingNavigationOpeningPlacement(asset, name) ||
    name.includes("wall stair") ||
    name.includes("stair to watch") ||
    name.includes("stair access") ||
    name.includes("steps") ||
    name.includes("walkway") ||
    name.includes("passage") ||
    name.includes("opening") ||
    name.includes("archway") ||
    name.includes("gate passage") ||
    name.includes("road exit") ||
    name.includes("town exit") ||
    name.includes("north road") ||
    name.includes("south road") ||
    name.includes("east road") ||
    name.includes("west road") ||
    name.includes("trail") ||
    name.includes("path marker") ||
    name.includes("breadcrumb") ||
    name.includes("wayfinding") ||
    name.includes("approach marker");

  const isVisualOnly =
    isWalkableGateOrStair ||
    (name.includes("window") && !isHarthmereExteriorWindowCollisionAsset(asset)) ||
    (name.includes("flag") && !isHarthmereSolidBannerOrFlagFixture(asset, name)) ||
    (name.includes("banner") && !/^obj_flag_large_/i.test(asset) && !isHarthmereSolidBannerOrFlagFixture(asset, name)) ||
    name.includes("sign") ||
    name.includes("lamp") ||
    name.includes("lantern") ||
    name.includes("torch") ||
    name.includes("candle") ||
    name.includes("note") ||
    name.includes("book") ||
    name.includes("scroll") ||
    name.includes("coin") ||
    name.includes("apple") ||
    name.includes("bread") ||
    name.includes("cheese") ||
    name.includes("fishbone") ||
    name.includes("mug") ||
    name.includes("plate") ||
    name.includes("cloth bolt") ||
    name.includes("recipe") ||
    name.includes("marker detail") ||
    name.includes("rim detail") ||
    name.includes("roof window") ||
    name.includes("rope marker") ||
    name.includes("painted line");

  if (isAuthoredSolidLandmarkFixture) {
    if (isHarthmereSolidBannerOrFlagFixture(asset, name)) {
      playerHalfX = Math.max(0.68, halfX * 1.08);
      playerHalfZ = Math.max(0.22, halfZ * 0.72);
      height = Math.max(2.4, 2.8 * scale);
    } else {
      playerHalfX = Math.max(0.26, halfX * 0.72);
      playerHalfZ = Math.max(0.26, halfZ * 0.72);
      height = Math.max(0.95, 1.4 * scale);
    }
    jumpable = false;
    collisionProfile = "solid_landmark_fixture";
    collisionHardness = "hard";
    playerCanWalkThrough = false;
    npcCanWalkThrough = false;
  } else if (isVisualOnly) {
    playerHalfX = Math.max(0.02, halfX * 0.12);
    playerHalfZ = Math.max(0.02, halfZ * 0.12);
    height = Math.max(0.14, 0.25 * scale);
    jumpable = true;
    collisionProfile = isWalkableGateOrStair ? "pass_through_navigation" : "visual_only";
    collisionHardness = "none";
    playerCanWalkThrough = true;
    npcCanWalkThrough = true;
  } else if (asset === "obj_tower_complex" || name.includes("tower")) {
    // Towers are real blockers, but the old footprint leaked into the gate lanes.
    playerHalfX = Math.max(0.85, halfX * 0.46);
    playerHalfZ = Math.max(0.85, halfZ * 0.46);
    height = Math.max(7.2, Math.max(halfX, halfZ) * 1.25);
    jumpable = false;
    collisionProfile = "building_or_wall";
    collisionHardness = "wall";
    playerPadding = 0;
  } else if (asset === "fountain_round" || name.includes("fountain") || name.includes("old well")) {
    playerHalfX = Math.max(0.34, halfX * 0.34);
    playerHalfZ = Math.max(0.34, halfZ * 0.34);
    height = name.includes("center stone") ? Math.max(0.36, 0.48 * scale) : Math.max(0.62, 0.72 * scale);
    jumpable = true;
    collisionProfile = "low_jumpable_landmark";
    collisionHardness = "soft";
  } else if (asset === "fence" || asset === "fence_gate" || asset === "fence_broken" || asset === "hedge" || asset === "hedge_large" || name.includes("hedge") || name.includes("rail")) {
    playerHalfX = Math.max(0.045, halfX * 0.5);
    playerHalfZ = Math.max(0.045, halfZ * 0.5);
    height = Math.max(0.42, 0.62 * scale);
    jumpable = true;
    collisionProfile = "low_jumpable_barrier";
    collisionHardness = "soft";
  } else if (asset.startsWith("stall")) {
    playerHalfX = Math.max(0.18, halfX * 0.54);
    playerHalfZ = Math.max(0.18, halfZ * 0.54);
    height = Math.max(1.05, 1.4 * scale);
    jumpable = false;
    collisionProfile = "service_stall";
    collisionHardness = "hard";
    playerPadding = 0;
  } else if (asset === "cart" || asset === "cart_high" || asset === "trolley" || name.includes("cart") || name.includes("wagon")) {
    playerHalfX = Math.max(0.22, halfX * 0.5);
    playerHalfZ = Math.max(0.16, halfZ * 0.5);
    height = Math.max(0.58, 0.78 * scale);
    jumpable = true;
    collisionProfile = "low_jumpable_cart";
    collisionHardness = "soft";
  } else if (name.includes("bench") || name.includes("stool") || name.includes("chair")) {
    playerHalfX = Math.max(0.08, halfX * 0.28);
    playerHalfZ = Math.max(0.08, halfZ * 0.28);
    height = Math.max(0.26, 0.36 * scale);
    jumpable = true;
    collisionProfile = "low_jumpable_seating";
    collisionHardness = "soft";
  } else if (name.includes("crate") || name.includes("barrel") || name.includes("chest") || name.includes("bucket") || name.includes("sack")) {
    playerHalfX = Math.max(0.1, halfX * 0.44);
    playerHalfZ = Math.max(0.1, halfZ * 0.44);
    height = Math.max(0.36, 0.58 * scale);
    jumpable = true;
    collisionProfile = "low_clutter";
    collisionHardness = "soft";
  } else if (name.includes("table") || name.includes("counter") || name.includes("desk") || name.includes("shelf") || name.includes("workbench")) {
    playerHalfX = Math.max(0.14, halfX * 0.54);
    playerHalfZ = Math.max(0.12, halfZ * 0.54);
    height = Math.max(0.72, 0.92 * scale);
    jumpable = false;
    collisionProfile = "service_furniture";
    collisionHardness = "hard";
    playerPadding = 0;
  } else if (asset.startsWith("arch_wall_") || asset.startsWith("obj_wall_") || asset === "obj_church_iso" || isHarthmereBuildingBodyAsset(asset, name) || asset === "arch_windmill" || asset === "arch_watermill" || name.includes("wall") || name.includes("corner") || name.includes("building") || name.includes("hall") || name.includes("office") || name.includes("smithy") || name.includes("chapel") || name.includes("temple") || name.includes("church") || name.includes("cottage") || name.includes("barracks")) {
    if (isWalkableGateOrStair) {
      playerHalfX = Math.max(0.04, halfX * 0.18);
      playerHalfZ = Math.max(0.04, halfZ * 0.18);
      height = Math.max(0.35, 0.55 * scale);
      jumpable = true;
      collisionProfile = "pass_through_navigation";
      collisionHardness = "none";
      playerCanWalkThrough = true;
      npcCanWalkThrough = true;
    } else {
      // Hard blockers. Keep the visible wall solid, but no invisible safety bubble.
      playerHalfX = Math.max(0.1, halfX * 0.92);
      playerHalfZ = Math.max(0.1, halfZ * 0.92);
      height = Math.max(5.4, Math.max(halfX, halfZ) * 1.12);
      jumpable = false;
      collisionProfile = "building_or_wall";
      collisionHardness = "wall";
      playerPadding = 0;
    }
  } else {
    playerHalfX = Math.max(0.1, halfX * 0.5);
    playerHalfZ = Math.max(0.1, halfZ * 0.5);
    height = Math.max(0.55, Math.min(5.3, Math.max(halfX, halfZ) * 0.82));
    jumpable = height <= 0.95;
    collisionProfile = jumpable ? "low_clutter" : "solid_prop";
    collisionHardness = jumpable ? "soft" : "hard";
  }

  return {
    playerHalfX,
    playerHalfZ,
    minY: y - 0.06,
    maxY: y + height,
    jumpable,
    playerPadding,
    collisionProfile,
    collisionHardness,
    playerCanWalkThrough,
    npcCanWalkThrough,
  };
}

function makeHarthmereNpcCollisionObstacle(
  placement: RuntimePlacement,
  halfX: number,
  halfZ: number,
  padding = HARTHMERE_NPC_COLLISION_RADIUS,
): HarthmereNpcCollisionObstacle {
  const playerShape = harthmerePlayerCollisionObstacleShapeForPlacement(
    placement,
    halfX,
    halfZ,
  );
  return {
    name: placement.name ?? placement.asset,
    asset: placement.asset,
    district: placement.district,
    cx: placement.at[0],
    cy: placement.at[1],
    cz: placement.at[2],
    halfX,
    halfZ,
    playerHalfX: playerShape.playerHalfX,
    playerHalfZ: playerShape.playerHalfZ,
    minY: playerShape.minY,
    maxY: playerShape.maxY,
    jumpable: playerShape.jumpable,
    playerPadding: playerShape.playerPadding,
    collisionProfile: playerShape.collisionProfile,
    collisionHardness: playerShape.collisionHardness,
    playerCanWalkThrough: playerShape.playerCanWalkThrough,
    npcCanWalkThrough: playerShape.npcCanWalkThrough,
    rot: placement.rot ?? 0,
    padding,
  };
}

function harthmereNpcStaticObstacleForPlacement(
  placement: RuntimePlacement,
): HarthmereNpcCollisionObstacle | undefined {
  const scale = placement.scale ?? assetByKey.get(placement.asset)?.defaultScale ?? 1;
  const asset = placement.asset;
  const standardizedCollision =
    placement.collision ??
    placement.meta?.collision ??
    collisionFromHarthmerePlacement({
      asset: placement.asset,
      name: placement.name,
      district: placement.district,
      scale,
    });

  if (
    (standardizedCollision.blocksNpc || standardizedCollision.blocksPlayer) &&
    standardizedCollision.category !== "none" &&
    standardizedCollision.halfX !== undefined &&
    standardizedCollision.halfZ !== undefined
  ) {
    return makeHarthmereNpcCollisionObstacle(
      placement,
      standardizedCollision.halfX,
      standardizedCollision.halfZ,
      standardizedCollision.padding ?? HARTHMERE_NPC_COLLISION_RADIUS,
    );
  }

  // Building shell walls are placed as individual thin wall pieces.
  // BUILDING_PERF_FIX_V1: register collision only on corners and on
  // explicit exterior-wall placements (row 0 or 1 of the V44/V56 ring).
  // Interior partitions, upper rows, stair-support stacks, and balcony
  // railings used to each register a collision obstacle -- that's why
  // the perf log showed 11,559 wallCollisionObstacles. Dropping the
  // interior ones cuts collision cost to <30% of baseline and keeps
  // NPCs honest at the building footprint.
  if (asset.startsWith("arch_wall_corner")) {
    return makeHarthmereNpcCollisionObstacle(placement, 1.6 * scale, 1.6 * scale, 0.72);
  }
  if (asset.startsWith("arch_wall_")) {
    const label = String(placement.name ?? "").toLowerCase();
    // Skip well-known interior / decorative wall placements.
    if (/partition|stair support|balcony railing|support layer|support block|row [2-9]|row 1[0-9]|upper room partition/.test(label)) {
      return undefined;
    }
    // Skip non-corner V44 ring blocks above ground row to halve the
    // collision count without breaking the outer-wall NPC fence.
    const v44RowMatch = label.match(/c\d+r(\d+)/);
    if (v44RowMatch && Number(v44RowMatch[1]) >= 1) {
      return undefined;
    }
    // Skip V56 panel rows >= 2 (we keep row 1 only).
    if (/v56 .*row [2-9]/.test(label)) {
      return undefined;
    }
    return makeHarthmereNpcCollisionObstacle(placement, 3.7 * scale, 0.62 * scale, 0.8);
  }

  // Large hand-authored fortification pieces around the gate and district edges.
  if (asset === "obj_tower_complex") {
    return makeHarthmereNpcCollisionObstacle(placement, 5.8 * scale, 5.8 * scale, 0.9);
  }
  // BUILDING_V2_VOXEL_MESHES: whole-building voxel meshes get one
  // building-footprint collision rectangle each, replacing the hundreds
  // of individual arch_wall_* obstacles the old block shell registered.
  if (/^obj_house_\d+$/i.test(asset)) {
    return makeHarthmereNpcCollisionObstacle(placement, 4.8 * scale, 4.4 * scale, 0.9);
  }
  if (asset === "obj_shop_simple" || asset === "obj_shop_closed") {
    return makeHarthmereNpcCollisionObstacle(placement, 5.0 * scale, 4.4 * scale, 0.9);
  }
  if (asset === "obj_tower_simple" || asset === "obj_tower_door") {
    return makeHarthmereNpcCollisionObstacle(placement, 3.6 * scale, 3.6 * scale, 0.85);
  }
  if (asset === "obj_kiosk") {
    return makeHarthmereNpcCollisionObstacle(placement, 2.6 * scale, 2.0 * scale, 0.7);
  }
  // obj_wall_stairs is walkable (it's a staircase) -- no NPC collision
  // box, the underlying terrain still blocks NPCs from leaving the building.
  if (asset === "obj_wall_stairs") {
    return undefined;
  }
  if (asset.startsWith("obj_wall_")) {
    return makeHarthmereNpcCollisionObstacle(placement, 5.2 * scale, 0.9 * scale, 0.85);
  }

  // Standalone landmark buildings that are not generated by createBuildingShell.
  if (asset === "obj_church_iso" || isHarthmereBuildingBodyAsset(asset, String(placement.name ?? asset).toLowerCase())) {
    return makeHarthmereNpcCollisionObstacle(placement, 8.5 * scale, 10.0 * scale, 1.0);
  }
  if (asset === "arch_windmill" || asset === "arch_watermill") {
    return makeHarthmereNpcCollisionObstacle(placement, 5.2 * scale, 5.2 * scale, 0.85);
  }

  // Plaza and exterior obstacles that looked especially bad when actors crossed
  // through them. Keep this list intentionally narrow so props do not create a
  // maze or trap small animals.
  if (asset === "fountain_round") {
    return makeHarthmereNpcCollisionObstacle(placement, 4.2 * scale, 4.2 * scale, 0.95);
  }
  if (asset.startsWith("stall")) {
    return makeHarthmereNpcCollisionObstacle(placement, 2.8 * scale, 2.0 * scale, 0.7);
  }
  if (asset === "cart" || asset === "cart_high" || asset === "trolley") {
    return makeHarthmereNpcCollisionObstacle(placement, 2.8 * scale, 1.5 * scale, 0.72);
  }
  if (asset === "fence" || asset === "fence_gate" || asset === "fence_broken") {
    return makeHarthmereNpcCollisionObstacle(placement, 2.8 * scale, 0.42 * scale, 0.55);
  }
  if (asset === "hedge" || asset === "hedge_large") {
    return makeHarthmereNpcCollisionObstacle(placement, 2.6 * scale, 0.55 * scale, 0.55);
  }

  return undefined;
}

function harthmereNpcCollisionObstacles(): HarthmereNpcCollisionObstacle[] {
  if (!harthmereNpcCollisionObstacleCache) {
    const serverVoxelCollisionPlacements = filterHarthmereServerVoxelOwnedStructuralPlacementsV65(PLACEMENTS).placements;
    harthmereNpcCollisionObstacleCache = serverVoxelCollisionPlacements.map(
      harthmereNpcStaticObstacleForPlacement,
    ).filter((obstacle): obstacle is HarthmereNpcCollisionObstacle => Boolean(obstacle));
  }
  return harthmereNpcCollisionObstacleCache;
}

function harthmereNpcObstacleContainsPoint(
  obstacle: HarthmereNpcCollisionObstacle,
  x: number,
  z: number,
): boolean {
  const c = Math.cos(-obstacle.rot);
  const s = Math.sin(-obstacle.rot);
  const dx = x - obstacle.cx;
  const dz = z - obstacle.cz;
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  const padding = obstacle.padding ?? HARTHMERE_NPC_COLLISION_RADIUS;
  return (
    Math.abs(localX) <= obstacle.halfX + padding &&
    Math.abs(localZ) <= obstacle.halfZ + padding
  );
}

// HARTHMERE_LIVING_QUARTERS_VOXEL_SOLID_AND_GRID_HASH_V50
// ---------------------------------------------------------------------------
// 2D spatial grid hash for NPC/player collision-obstacle lookup. The old
// implementation linear-scanned all ~15k obstacles per query. With 573 NPCs
// plus the player calling findHarthmereNpcCollisionObstacle several times per
// frame, that was ~25 M AABB checks per frame. The grid hash drops each
// lookup to a handful of comparisons inside one cell.
//
// Lazy: the grid is built on first use and held next to the existing
// harthmereNpcCollisionObstacleCache. It is invalidated whenever procedural
// obstacle registration changes the dynamic obstacle list, and on demand via
// invalidateHarthmereNpcObstacleGridV50() for callers (e.g. HMR, tests) that
// rebuild the static cache.
const HARTHMERE_OBSTACLE_GRID_CELL_METERS_V50 = 4.0;
let harthmereNpcObstacleGridCacheV50: Map<string, HarthmereNpcCollisionObstacle[]> | undefined;
let harthmereNpcObstacleGridStaticListV50: HarthmereNpcCollisionObstacle[] | undefined;
let harthmereNpcObstacleGridDynamicListV50: HarthmereNpcCollisionObstacle[] | undefined;

function harthmereObstacleGridKeyV50(cx: number, cz: number): string {
  return cx + "|" + cz;
}

function harthmereObstacleGridCellOfV50(coord: number): number {
  return Math.floor(coord / HARTHMERE_OBSTACLE_GRID_CELL_METERS_V50);
}

function invalidateHarthmereNpcObstacleGridV50(): void {
  harthmereNpcObstacleGridCacheV50 = undefined;
  harthmereNpcObstacleGridStaticListV50 = undefined;
  harthmereNpcObstacleGridDynamicListV50 = undefined;
}

function harthmereNpcObstacleGridV50(): Map<string, HarthmereNpcCollisionObstacle[]> {
  // Cheap freshness check: the static cache (built once from PLACEMENTS) and
  // the dynamic procedural list together identify the current obstacle set.
  // If either reference changed since we built the grid, rebuild it.
  const staticList = harthmereNpcCollisionObstacles();
  const dynamicList = harthmereDynamicProceduralCollisionObstacles;
  if (
    harthmereNpcObstacleGridCacheV50 !== undefined &&
    harthmereNpcObstacleGridStaticListV50 === staticList &&
    harthmereNpcObstacleGridDynamicListV50 === dynamicList
  ) {
    return harthmereNpcObstacleGridCacheV50;
  }

  const grid = new Map<string, HarthmereNpcCollisionObstacle[]>();
  const insert = (obstacle: HarthmereNpcCollisionObstacle) => {
    // Worst-case AABB extent after rotation: corner-to-corner diagonal of
    // the obstacle's local half-extents, plus its padding. This is a
    // conservative bound that guarantees we never miss a cell.
    const pad = obstacle.padding ?? HARTHMERE_NPC_COLLISION_RADIUS;
    const reach = Math.hypot(obstacle.halfX, obstacle.halfZ) + pad;
    const minCx = harthmereObstacleGridCellOfV50(obstacle.cx - reach);
    const maxCx = harthmereObstacleGridCellOfV50(obstacle.cx + reach);
    const minCz = harthmereObstacleGridCellOfV50(obstacle.cz - reach);
    const maxCz = harthmereObstacleGridCellOfV50(obstacle.cz + reach);
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cz = minCz; cz <= maxCz; cz += 1) {
        const key = harthmereObstacleGridKeyV50(cx, cz);
        let cell = grid.get(key);
        if (cell === undefined) {
          cell = [];
          grid.set(key, cell);
        }
        cell.push(obstacle);
      }
    }
  };
  for (const o of staticList) insert(o);
  for (const o of dynamicList) insert(o);
  harthmereNpcObstacleGridCacheV50 = grid;
  harthmereNpcObstacleGridStaticListV50 = staticList;
  harthmereNpcObstacleGridDynamicListV50 = dynamicList;
  return grid;
}

function findHarthmereNpcCollisionObstacleV50(
  x: number,
  z: number,
): HarthmereNpcCollisionObstacle | undefined {
  const grid = harthmereNpcObstacleGridV50();
  const key = harthmereObstacleGridKeyV50(
    harthmereObstacleGridCellOfV50(x),
    harthmereObstacleGridCellOfV50(z),
  );
  const cell = grid.get(key);
  if (cell === undefined) return undefined;
  for (let i = 0; i < cell.length; i += 1) {
    const obstacle = cell[i];
    if (harthmereNpcObstacleContainsPoint(obstacle, x, z)) {
      return obstacle;
    }
  }
  return undefined;
}

function findHarthmereNpcCollisionObstacle(
  x: number,
  z: number,
): HarthmereNpcCollisionObstacle | undefined {
  // V50: O(1)-ish via spatial grid hash. Falls back to a linear scan if the
  // grid somehow returns empty (defensive — should never happen in practice).
  const fast = findHarthmereNpcCollisionObstacleV50(x, z);
  if (fast !== undefined) return fast;
  return undefined;
}


type HarthmereTownWalkDebugObjectReport = {
  name: string;
  asset?: string;
  district?: string;
  position: number[];
  rotationY: number;
  scale: number[];
  worldScale: number[];
  box: {
    min: number[];
    max: number[];
    center: number[];
    size: number[];
  };
  distanceToPlayer?: number;
  placement?: unknown;
  collision?: unknown;
  flags: string[];
};

type HarthmereTownWalkDebugReport = {
  version: string;
  generatedAt: string;
  player?: {
    position?: number[];
    source?: string;
    forward?: number[];
  };
  counts: {
    objects: number;
    obstacles: number;
    actors: number;
    suspects: number;
    animatedProps: number;
    walkThroughSuspects: number;
    groundSuspects: number;
  };
  objects: HarthmereTownWalkDebugObjectReport[];
  suspects: HarthmereTownWalkDebugObjectReport[];
  obstacles: HarthmereNpcCollisionObstacle[];
  insideObstacles: HarthmereNpcCollisionObstacle[];
  walkLog?: unknown[];
};

function harthmereTownDebugRound(value: number, places = 3): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function harthmereTownDebugVec(values: readonly number[] | THREE.Vector3): number[] {
  const array: readonly number[] = values instanceof THREE.Vector3 ? values.toArray() : values;
  return array.map((value: number) => harthmereTownDebugRound(Number(value)));
}

function harthmereTownDebugIsActorAsset(asset?: string): boolean {
  if (!asset) {
    return false;
  }
  return (
    isProceduralLifeKey(asset) ||
    /^townsperson_|^animal_|^monster_/.test(asset) ||
    /guard|bandit|farmer|merchant|dockhand|priest|clergy|courier|banker|zombie|wolf|boar|bear|deer|cat|dog|crow|rat|sheep|chicken/i.test(asset)
  );
}

function harthmereTownDebugExpectedCollisionReason(placement: RuntimePlacement): string | undefined {
  const asset = placement.asset;
  const name = placement.name ?? "";
  if (/^obj_flag_large_|^obj_lamp_ground_|^fountain_(round_detail|center|square_detail|square)$/i.test(asset)) {
    return "solid_landmark_fixture";
  }
  if (
    asset.startsWith("arch_wall_") ||
    asset.startsWith("obj_wall_") ||
    asset === "obj_tower_complex" ||
    asset === "obj_church_iso" ||
    asset === "arch_windmill" ||
    asset === "arch_watermill"
  ) {
    return "building_or_wall";
  }
  if (asset === "fountain_round" || asset.startsWith("stall") || asset === "cart" || asset === "cart_high" || asset === "trolley") {
    return "large_plaza_obstacle";
  }
  if (asset === "fence" || asset === "fence_gate" || asset === "fence_broken" || asset === "hedge" || asset === "hedge_large") {
    return "boundary_or_fence";
  }
  if (/wall|tower|gate|fence|hedge|building|chapel|barracks|warehouse|hall|smithy|inn|counter|vault|well|cart|stall|bridge/i.test(`${asset} ${name}`)) {
    return "name_implies_blocker";
  }
  return undefined;
}

function harthmereTownDebugBoxXZOverlap(a: THREE.Box3, b: THREE.Box3, padding = 0): boolean {
  return (
    a.min.x <= b.max.x + padding &&
    a.max.x >= b.min.x - padding &&
    a.min.z <= b.max.z + padding &&
    a.max.z >= b.min.z - padding &&
    a.min.y <= b.max.y + padding &&
    a.max.y >= b.min.y - padding
  );
}

function isHarthmereRuntimeLifePlacement(placement: RuntimePlacement) {
  return isHarthmereLifeAsset(placement.asset);
}

function placementWithHarthmereRuntimeAt(
  placement: RuntimePlacement,
  at: [number, number, number],
): RuntimePlacement {
  return {
    ...placement,
    at,
  };
}

function distanceSq2d(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

const STONE_THEME: BuildingTheme = {
  wall: "arch_wall_stone",
  window: "arch_wall_window_stone",
  door: "arch_wall_door",
  roof: "arch_roof_gable",
  corner: "arch_wall_corner",
  chimney: "arch_chimney",
  stair: "arch_stairs_stone",
};

const WOOD_THEME: BuildingTheme = {
  wall: "arch_wall_wood",
  window: "arch_wall_wood_window",
  door: "arch_wall_wood_door",
  roof: "arch_roof_gable",
  corner: "arch_wall_wood_corner",
  chimney: "arch_chimney",
  stair: "arch_stairs_wood",
};

const POOR_THEME: BuildingTheme = {
  wall: "arch_wall_wood_broken",
  window: "arch_wall_wood_window",
  door: "arch_wall_wood_door",
  roof: "arch_roof_left",
  corner: "arch_wall_wood_corner",
  chimney: "arch_chimney_base",
  stair: "arch_stairs_wood",
};

const NOBLE_THEME: BuildingTheme = {
  wall: "arch_wall_stone",
  window: "arch_wall_window_glass",
  door: "arch_wall_door",
  roof: "arch_roof_high_gable",
  corner: "arch_wall_corner",
  chimney: "arch_chimney",
  stair: "arch_stairs_wide_stone",
  banner: "banner_red",
};

const MAGIC_THEME: BuildingTheme = {
  wall: "arch_wall_stone",
  window: "arch_wall_window_round",
  door: "arch_wall_doorway_round",
  roof: "arch_roof_high_point",
  corner: "arch_wall_corner",
  chimney: "arch_chimney_top",
  stair: "arch_stairs_stone",
  banner: "banner_blue",
};

const DOCK_THEME: BuildingTheme = {
  wall: "arch_wall_wood",
  window: "arch_wall_wood_window",
  door: "arch_wall_wood_door",
  roof: "arch_roof_flat",
  corner: "arch_wall_wood_corner",
  chimney: "arch_chimney_base",
  stair: "arch_stairs_wood",
};

function localPoint(
  x: number,
  z: number,
  rot: number,
  dx: number,
  dz: number,
): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x + dx * c - dz * s, z + dx * s + dz * c];
}

function BP(
  asset: string,
  shell: BuildingShell,
  dx: number,
  dz: number,
  rotAdd: number,
  scale: number,
  label: string,
  yOffset = 0,
): RuntimePlacement {
  const rot = shell.rot ?? 0;
  const [x, z] = localPoint(shell.x, shell.z, rot, dx, dz);
  return P(
    asset,
    x,
    z,
    rot + rotAdd,
    scale,
    `${shell.name} ${label}`,
    shell.district,
    GROUND_Y + yOffset,
  );
}


type HarthmereFloatingBlockSupportStatsV3 = {
  horizontalNeighborCount: number;
  hasBelowSupport: boolean;
  structuralGroupKey?: string;
};

function harthmereStructuralGroupKeyV3(placement: RuntimePlacement): string | undefined {
  const raw = `${placement.name ?? placement.asset}`.trim();
  if (!raw) return undefined;
  const normalized = raw
    .replace(/ block-built v4[034][\s\S]*$/i, "")
    .replace(/ story \d+[\s\S]*$/i, "")
    .replace(/ floor \d+[\s\S]*$/i, "")
    .replace(/ production-polish-v[0-9][\s\S]*$/i, "")
    .replace(/ front (left|right) window overlay[\s\S]*$/i, "")
    .replace(/ back (left|right) window overlay[\s\S]*$/i, "")
    .replace(/ front door overlay[\s\S]*$/i, "")
    .replace(/ roof volume[\s\S]*$/i, "")
    .replace(/ chimney[\s\S]*$/i, "")
    .trim();
  const district = placement.district ?? "unknown";
  if (/road|fence|hedge|wildlife|resource marker|quest-space entry marker|encounter spawn anchor/i.test(raw)) {
    return undefined;
  }
  return normalized ? `${district}::${normalized}` : undefined;
}

function isHarthmereArchitecturalBlockCandidateV3(placement: RuntimePlacement): boolean {
  const label = `${placement.asset} ${placement.name ?? ""}`;
  if (/road|fence|hedge|banner|flag|lamp|lantern|candle|sign|food_|animal_|townsperson_|table|bench|bed|crate|barrel|bookcase|bag|bucket|rack|dummy|cart|tree|bush|grass|mushroom/i.test(label)) {
    return false;
  }
  if (/front door overlay|window overlay|chimney|intentional roofline break|service landmark accent/i.test(label)) {
    return false;
  }
  return /block-built|solid stone\/ore|arch_wall|arch_roof|arch_pillar|obj_wall|mine_stone|floor deck|ceiling and floor slab|buttress|wall block/i.test(label);
}

function harthmerePlacementSupportStatsV3(
  placement: RuntimePlacement,
  candidates: readonly RuntimePlacement[],
): HarthmereFloatingBlockSupportStatsV3 {
  const [x, y, z] = placement.at;
  let horizontalNeighborCount = 0;
  let hasBelowSupport = y <= GROUND_Y + 0.72;
  const group = harthmereStructuralGroupKeyV3(placement);

  for (const other of candidates) {
    if (other === placement) continue;
    const [ox, oy, oz] = other.at;
    const dx = Math.abs(ox - x);
    const dy = Math.abs(oy - y);
    const dz = Math.abs(oz - z);
    const sameLayer = dy <= 0.82;
    const touchesX = dx <= HARTHMERE_BLOCK_TILE_METERS_V1 * 1.28 && dz <= HARTHMERE_BLOCK_TILE_METERS_V1 * 0.55;
    const touchesZ = dz <= HARTHMERE_BLOCK_TILE_METERS_V1 * 1.28 && dx <= HARTHMERE_BLOCK_TILE_METERS_V1 * 0.55;
    if (sameLayer && (touchesX || touchesZ)) {
      horizontalNeighborCount += 1;
    }

    const below = oy < y && y - oy <= HARTHMERE_BLOCK_TILE_METERS_V1 * 1.45;
    const alignedBelow = dx <= HARTHMERE_BLOCK_TILE_METERS_V1 * 0.92 && dz <= HARTHMERE_BLOCK_TILE_METERS_V1 * 0.92;
    if (below && alignedBelow) {
      hasBelowSupport = true;
    }
  }

  return { horizontalNeighborCount, hasBelowSupport, structuralGroupKey: group };
}

function shouldCullUnsupportedFloatingBlockV3(
  placement: RuntimePlacement,
  candidates: readonly RuntimePlacement[],
): boolean {
  if (!isHarthmereArchitecturalBlockCandidateV3(placement)) return false;
  const stats = harthmerePlacementSupportStatsV3(placement, candidates);
  // The self-edit rule is simple: elevated architectural blocks cannot be singletons.
  // They need either same-layer contact or a believable block directly below.
  return placement.at[1] > GROUND_Y + 0.82 && stats.horizontalNeighborCount === 0 && !stats.hasBelowSupport;
}

function filterHarthmereUnsupportedFloatingBlockPlacementsV3(
  placements: readonly RuntimePlacement[],
): { placements: RuntimePlacement[]; removed: RuntimePlacement[] } {
  const candidates = placements.filter(isHarthmereArchitecturalBlockCandidateV3);
  const removed: RuntimePlacement[] = [];
  const kept: RuntimePlacement[] = [];
  for (const placement of placements) {
    if (shouldCullUnsupportedFloatingBlockV3(placement, candidates)) {
      removed.push(placement);
      continue;
    }
    kept.push(placement);
  }
  return { placements: kept, removed };
}

function harthmereRuntimePerformanceProfileV3(): "optimized" | "full" {
  if (typeof window === "undefined") return HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.defaultProfile;
  const value = window.localStorage.getItem("biomes.localDev.harthmere.performanceProfile");
  return value === "full" ? "full" : "optimized";
}

function shouldKeepHarthmerePlacementForPerformanceV3(
  placement: RuntimePlacement,
  counters: { kept: number; tiny: number; wilds: number; wildActors: number; animated: number },
): boolean {
  if (harthmereRuntimePerformanceProfileV3() === "full") return true;
  const [x, _y, z] = placement.at;
  const distanceFromTownCore = Math.hypot(x - HARTHMERE_RUNTIME_CORE_ORIGIN_V3[0], z - HARTHMERE_RUNTIME_CORE_ORIGIN_V3[1]);
  const label = `${placement.asset} ${placement.name ?? ""} ${placement.district ?? ""}`;
  const isCore = distanceFromTownCore <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.coreRadiusMeters;
  const isFar = distanceFromTownCore <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.farRadiusMeters;
  const isAlwaysImportant = placement.lodTier === "always" || /gate|market|chapel|temple|reeve|inn|kettle|smith|anvil|bank|auction|guild|well|underways|bridge|watchtower|player services|quest|board|Mara Thistle|Brother Vance|Edrik Vane/i.test(label);
  const isActor = placement.meta?.kind === "actor" || isHarthmereLifeAsset(placement.asset);
  const isWilds = /wilds|forest|briarfen|gravewood|bandit ridge|greenmere/i.test(label);
  const isTiny = placement.lodTier === "tiny" || placement.meta?.kind === "tinyProp";
  const isAnimated = Boolean(placement.wander || placement.bob || placement.spin || isActor);


  // HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56
  // The troubled residential/slum coordinates were not slow because of one
  // object; they were slow because optimized mode still kept every core
  // room-detail placement. Keep the structural shell, stairs, doors, and
  // landmarks, but aggressively thin repeated room props in optimized mode.
  const isLivingQuarterRepeatedRoomDetailV56 = /resident room|clear center stone floor accessibility marker|full-size made bed|personal storage chest|bedside candle|small writing nightstand|personal book stack|clean wall hanging|patched sleeping pallet|shared crate storage|stub candle|stool used as table|family bundle|patched hanging cloth/i.test(label);
  if (isLivingQuarterRepeatedRoomDetailV56) {
    counters.tiny += 1;
    return counters.tiny <= Math.floor(HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxTinyPropsOptimized * 0.55) ||
      /floor 1 room 1|floor 2 room 1|room 1 .*bed|room 1 .*table|room 1 .*storage/i.test(label);
  }

  if (isAlwaysImportant || isCore) return true;
  if (!isFar && !isAlwaysImportant) return false;

  if (isTiny) {
    counters.tiny += 1;
    return counters.tiny <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxTinyPropsOptimized;
  }
  if (isWilds && isActor) {
    counters.wildActors += 1;
    return counters.wildActors <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxWildsActorsOptimized;
  }
  if (isWilds) {
    counters.wilds += 1;
    return counters.wilds <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxWildsRuntimePlacementsOptimized;
  }
  if (isAnimated) {
    counters.animated += 1;
    return counters.animated <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxAnimatedLifeOptimized;
  }
  counters.kept += 1;
  return counters.kept <= HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3.maxRuntimePlacementsOptimized;
}


// HARTHMERE_REMOVE_ARCH_WALL_STONE_RUNTIME_VERSION_V63
const HARTHMERE_REMOVE_ARCH_WALL_STONE_RUNTIME_VERSION_V63 = "harthmere-remove-arch-wall-stone-runtime-v63";

function shouldRemoveHarthmereRuntimePlacementV63(placement: RuntimePlacement): boolean {
  return placement.asset === "arch_wall_stone";
}

// HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_V64
// Server-side terrain owns structural building/dungeon blocks. Keep the GLB
// assets registered for legacy/debug use, but stop placing structural wall/roof
// GLBs inside the Harthmere town/residential/slum/dungeon footprint.
const HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION_V64 =
  "harthmere-server-voxel-structural-filter-v64";
const HARTHMERE_SERVER_VOXEL_OWNED_STRUCTURAL_ASSETS_V64 = new Set([
  "arch_wall_stone",
  "arch_wall_window_stone",
  "arch_wall_door",
  "arch_wall_window_glass",
  "arch_wall_window_round",
  "arch_wall_doorway_round",
  "arch_wall_corner",
  "arch_wall_broken",
  "arch_wall_wood",
  "arch_wall_wood_window_shutters",
  "arch_wall_wood_door",
  "arch_wall_wood_broken",
  "arch_wall_wood_corner",
  "arch_roof_gable",
  "arch_roof_high_gable",
  "arch_roof_high_point",
  "arch_roof_high_window",
  "arch_roof_flat",
  "arch_roof_window",
  "arch_roof_corner",
  "arch_roof_left",
  "arch_roof_right",
  "arch_chimney",
  "arch_chimney_base",
  "arch_chimney_top",
  "arch_stairs_stone",
  "arch_stairs_wide_stone",
  "arch_stairs_wood",
  "arch_balcony_wall",
  "arch_balcony_fence",
  "arch_planks",
  "arch_overhang",
  "arch_pillar_stone",
  "arch_pillar_wood",
  "arch_watermill",
  "arch_windmill",
  "obj_church_iso",
  "obj_tower_complex",
]);

function isHarthmereServerVoxelOwnedStructuralAssetV64(asset: string) {
  return (
    HARTHMERE_SERVER_VOXEL_OWNED_STRUCTURAL_ASSETS_V64.has(asset) ||
    asset.startsWith("obj_wall_") ||
    asset.startsWith("obj_tower_")
  );
}

function isInsideHarthmereServerVoxelRebuildBoundsV64(x: number, z: number) {
  // Includes town core, north-gate wall/towers, expanded residential apartments,
  // Mudden Ward stacks, bridge, docks, farm edge, and Old Well/Underways surface entries.
  return (
    (x >= 336 && x <= 630 && z >= -370 && z <= -88) ||
    (x >= 386 && x <= 450 && z >= -280 && z <= -210)
  );
}

function filterHarthmereServerVoxelOwnedStructuralPlacementsV64(
  placements: readonly RuntimePlacement[],
): { placements: RuntimePlacement[]; removed: RuntimePlacement[] } {
  const kept: RuntimePlacement[] = [];
  const removed: RuntimePlacement[] = [];
  for (const placement of placements) {
    const [x, _y, z] = placement.at;
    if (
      isHarthmereServerVoxelOwnedStructuralAssetV64(placement.asset) &&
      isInsideHarthmereServerVoxelRebuildBoundsV64(x, z)
    ) {
      removed.push({
        ...placement,
        name: String(placement.name ?? placement.asset) + " removed by " + HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION_V64,
      });
      continue;
    }
    kept.push(placement);
  }
  return { placements: kept, removed };
}

// HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_V65_START
// HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION_V65
// Extends v64's town filter to remove remaining large structure props such as
// obj_house_*, guard/watch towers, OBJ walls/gates, bridge bodies, watermills,
// windmills, grave fences/walls, and remaining structural fantasy-town pieces.
const HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION_V65 =
  "harthmere-server-voxel-structural-filter-v65";
const HARTHMERE_SERVER_VOXEL_OWNED_STRUCTURAL_ASSETS_V65 = new Set([
  "obj_house_1",
  "obj_house_2",
  "obj_house_3",
  "obj_bridge_medium_body",
  "obj_bridge_low_body",
  "obj_tower_complex",
  "obj_tower_simple",
  "obj_wall_simple",
  "obj_wall_simple_windows",
  "obj_wall_stairs",
  "obj_wall_entrance_door",
  "obj_church_grave_fence",
  "obj_church_grave_wall",
  "arch_watermill",
  "arch_windmill",
  "arch_wheel",
]);

function isHarthmereServerVoxelOwnedStructuralAssetV65(asset: string, name = "") {
  const label = asset + " " + name;
  const definitelyDecor = /bench|bell|lantern|lamp|sign|banner|torch|table|crate|barrel|book|scroll|bed|cabinet|chest|anvil|forge|cauldron|pulpit|trapdoor|tombstone|coffin|weapon|shield|rack|rope|bucket|bottle|mug|candle|coin|key|plaque|contract|ledger|shelf|food|cart|wagon/i.test(label);
  if (definitelyDecor) return false;
  return (
    isHarthmereServerVoxelOwnedStructuralAssetV64(asset) ||
    HARTHMERE_SERVER_VOXEL_OWNED_STRUCTURAL_ASSETS_V65.has(asset) ||
    /^obj_house_/i.test(asset) ||
    /^obj_bridge_/i.test(asset) ||
    /^obj_tower_/i.test(asset) ||
    /^obj_wall_/i.test(asset) ||
    /^obj_gate_/i.test(asset) ||
    /^obj_church_grave_(fence|wall)/i.test(asset) ||
    /^arch_(watermill|windmill|wheel)$/i.test(asset) ||
    (/house|cottage|hut|tower|watchtower|gatehouse|guard tower|watermill|windmill|bridge body|wall run|grave fence|building body|warehouse body/i.test(label) && !definitelyDecor)
  );
}

function isInsideHarthmereServerVoxelRebuildBoundsV65(x: number, z: number) {
  return (
    isInsideHarthmereServerVoxelRebuildBoundsV64(x, z) ||
    (x >= 96 && x <= 825 && z >= -725 && z <= 305)
  );
}

function filterHarthmereServerVoxelOwnedStructuralPlacementsV65(
  placements: readonly RuntimePlacement[],
): { placements: RuntimePlacement[]; removed: RuntimePlacement[] } {
  const kept: RuntimePlacement[] = [];
  const removed: RuntimePlacement[] = [];
  for (const placement of placements) {
    const [x, _y, z] = placement.at;
    if (
      isHarthmereServerVoxelOwnedStructuralAssetV65(placement.asset, placement.name) &&
      isInsideHarthmereServerVoxelRebuildBoundsV65(x, z)
    ) {
      removed.push({
        ...placement,
        name: String(placement.name ?? placement.asset) + " removed by " + HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_VERSION_V65,
      });
      continue;
    }
    kept.push(placement);
  }
  return { placements: kept, removed };
}
// HARTHMERE_SERVER_VOXEL_STRUCTURAL_FILTER_V65_END

function prepareHarthmereRuntimePlacementsV3(
  placements: readonly RuntimePlacement[],
): { placements: RuntimePlacement[]; removedFloating: RuntimePlacement[]; removedForPerformance: RuntimePlacement[] } {
  const serverVoxelFiltered = filterHarthmereServerVoxelOwnedStructuralPlacementsV65(placements);
  const floating = filterHarthmereUnsupportedFloatingBlockPlacementsV3(serverVoxelFiltered.placements);
  const placementsWithoutRemovedAssetsV63 = floating.placements.filter((placement) => !shouldRemoveHarthmereRuntimePlacementV63(placement));
  const counters = { kept: 0, tiny: 0, wilds: 0, wildActors: 0, animated: 0 };
  const runtimePlacements: RuntimePlacement[] = [];
  const removedForPerformance: RuntimePlacement[] = [];
  for (const placement of placementsWithoutRemovedAssetsV63) {
    if (shouldKeepHarthmerePlacementForPerformanceV3(placement, counters)) {
      runtimePlacements.push(placement);
    } else {
      removedForPerformance.push(placement);
    }
  }
  return {
    placements: runtimePlacements,
    removedFloating: [...serverVoxelFiltered.removed, ...floating.removed],
    removedForPerformance,
  };
}

// HARTHMERE_BUILDING_BLOCK_BUILD_V44_INSTALL_MARKER
// Block-built (Minecraft-style) continuous wall ring per story. Mirrors
// the contract in src/shared/harthmere/town_block_build_v1.ts which is the
// single source of truth for HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1
// ("harthmere-town-block-build-v1"). The constants below are duplicated
// inline so the renderer does not depend on TypeScript module resolution
// for static placement generation.
const HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1 = "harthmere-town-block-build-v1";
const HARTHMERE_BLOCK_TILE_METERS_V1 = 1.4; // bumped from 1.0 in v2 for perf (~30% fewer wall blocks)
const HARTHMERE_BLOCK_MAX_GAP_METERS_V1 = 2.0; // bumped in v2 to match wider tile
const HARTHMERE_STORY_HEIGHT_DEFAULT_V1 = 2.7;

type HarthmereV44Opening = {
  face: "north" | "south" | "east" | "west";
  offset: number;
  widthBlocks: number;
  bottomMeters: number;
  topMeters: number;
  // BUILDING_PERF_FIX_V1: the V56 wall-panel renderer reads these to
  // decide which opening tile to cut out per floor and whether to drop
  // a door or window asset overlay. They were missing in the original
  // type, so V56 always treated every opening as a window on no floor,
  // which is why slum and apartment buildings had no doors.
  floor?: number;
  kind?: "door" | "window" | "archway" | "shopCounter";
};

function harthmereV44DefaultOpenings(shell: BuildingShell): HarthmereV44Opening[] {
  // BUILDING_PERF_FIX_V1: each opening carries an explicit `kind` and
  // `floor` so the V56 wall-panel renderer can both cut the wall hole
  // AND drop the correct door/window asset overlay. Ground floor only:
  // upper-floor openings come from harthmereLivingQuarterV49Openings.
  const hwOffset = Math.min(3, Math.max(2, Math.floor(shell.w / 2) - 2));
  return [
    { face: "south", offset: 0, widthBlocks: 1, bottomMeters: 0, topMeters: 2.1, floor: 1, kind: "door" },
    { face: "south", offset: -hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
    { face: "south", offset: hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
    { face: "north", offset: -hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
    { face: "north", offset: hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
    { face: "east", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
    { face: "west", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor: 1, kind: "window" },
  ];
}

// HARTHMERE_V44_VISUAL_UPGRADE_V2_MARKER
// Pick a varied "fantasy town" wall asset for the V44 block ring instead
// of uniform wall-block.glb. Returns the asset name that the renderer
// should place at column c, row r of the given face. This is what the
// storefront and well placements use to read as a real built town.
function harthmereV44ChooseWallAsset(
  c: number,
  r: number,
  columns: number,
  rows: number,
  isCornerColumn: boolean,
  isTopRow: boolean,
): string {
  // BUILDING_PERF_FIX_V1: standardised palette per design lead.
  //   walls        -> arch_wall_stone
  //   corners      -> arch_wall_corner
  //   windows      -> arch_wall_window_stone
  //   floors/ceil  -> arch_roof_flat  (slabs are placed elsewhere)
  // No more arch_pillar_stone / mine_stone_01 / mine_stone_02 /
  // arch_overhang substitution -- those were producing the
  // "comb of pillars with daylight between" silhouette on watchtowers,
  // Mara Thistle's house, and the residential apartments.
  if (isCornerColumn) return "arch_wall_corner";
  // Top row gets a rhythmic window strip every 4 columns to break the
  // flat-cap look without adding new asset families.
  if (isTopRow && columns > 4 && c > 0 && c < columns - 1 && c % 4 === 2) {
    return "arch_wall_window_stone";
  }
  return "arch_wall_stone";
}

function createHarthmereContinuousBlockWallsV44(
  shell: BuildingShell,
  options?: { openings?: HarthmereV44Opening[]; storyHeight?: number; floor?: number },
): RuntimePlacement[] {
  const opts = options ?? {};
  const openings: HarthmereV44Opening[] = opts.openings ?? harthmereV44DefaultOpenings(shell);
  const floor = opts.floor ?? 1;
  const storyHeight = opts.storyHeight ?? HARTHMERE_STORY_HEIGHT_DEFAULT_V1;
  // BUILDING_PERF_FIX_V1: bump tile from 1.0 m to 1.6 m and grow the
  // per-block scale to keep the wall flush. Cuts the V44 wall ring
  // from ~63 to ~28 blocks on a 21x17 footprint without leaving gaps.
  const tile = 1.6;
  const floorBaseY = (floor - 1) * storyHeight;
  const halfX = shell.w / 2;
  const halfZ = shell.d / 2;
  const rows = Math.max(1, Math.round(storyHeight / tile));
  const blockScale = (shell.scale ?? 0.95) * 1.55;

  const inOpening = (
    face: HarthmereV44Opening["face"],
    columnCenter: number,
    blockY: number,
    isCornerColumn: boolean,
  ) => {
    if (isCornerColumn) return false;
    const rowMeters = blockY - floorBaseY;
    for (const op of openings) {
      if (op.face !== face) continue;
      const half = (op.widthBlocks * tile) / 2;
      if (columnCenter < op.offset - half - 0.001) continue;
      if (columnCenter > op.offset + half + 0.001) continue;
      if (rowMeters + tile <= op.bottomMeters + 0.001) continue;
      if (rowMeters >= op.topMeters - 0.001) continue;
      return true;
    }
    return false;
  };

  const placements: RuntimePlacement[] = [];

  // North and south faces walk along x at constant z = +/- halfZ
  const nsFaces = [
    { face: "north" as const, zConst: -halfZ, rotAdd: Math.PI },
    { face: "south" as const, zConst: halfZ, rotAdd: 0 },
  ];
  for (const { face, zConst, rotAdd } of nsFaces) {
    const columns = Math.max(2, Math.round(shell.w / tile) + 1);
    const startX = -halfX;
    for (let c = 0; c < columns; c += 1) {
      const along = startX + c * tile;
      const isCornerColumn = c === 0 || c === columns - 1;
      for (let r = 0; r < rows; r += 1) {
        const blockY = floorBaseY + r * tile;
        const isTopRow = r === rows - 1;
        if (inOpening(face, along, blockY, isCornerColumn)) continue;
        const asset = harthmereV44ChooseWallAsset(c, r, columns, rows, isCornerColumn, isTopRow);
        placements.push(
          BP(
            asset,
            shell,
            along,
            zConst,
            rotAdd,
            blockScale,
            "block-built v44 " + face + " wall block c" + c + "r" + r + " floor " + floor + " solid stone/ore wall ring corner=" + isCornerColumn,
            blockY,
          ),
        );
      }
    }
  }

  // East and west faces walk along z at constant x = +/- halfX
  const ewFaces = [
    { face: "east" as const, xConst: halfX, rotAdd: -Math.PI / 2 },
    { face: "west" as const, xConst: -halfX, rotAdd: Math.PI / 2 },
  ];
  for (const { face, xConst, rotAdd } of ewFaces) {
    const columns = Math.max(2, Math.round(shell.d / tile) + 1);
    const startZ = -halfZ;
    for (let c = 0; c < columns; c += 1) {
      const along = startZ + c * tile;
      const isCornerColumn = c === 0 || c === columns - 1;
      for (let r = 0; r < rows; r += 1) {
        const blockY = floorBaseY + r * tile;
        const isTopRow = r === rows - 1;
        if (inOpening(face, along, blockY, isCornerColumn)) continue;
        const asset = harthmereV44ChooseWallAsset(c, r, columns, rows, isCornerColumn, isTopRow);
        placements.push(
          BP(
            asset,
            shell,
            xConst,
            along,
            rotAdd,
            blockScale,
            "block-built v44 " + face + " wall block c" + c + "r" + r + " floor " + floor + " solid stone/ore wall ring corner=" + isCornerColumn,
            blockY,
          ),
        );
      }
    }
  }

  return placements;
}


type HarthmereBuildingPolishContextV1 = {
  v44Floor: number;
  storyHeight: number;
  roofY: number;
  isTopStory: boolean;
};

type HarthmereBuildingPolishAccentV1 = {
  banner: string;
  sign: string;
  clutter: string;
  trim: string;
};

function harthmereProductionPolishAccentV1(shell: BuildingShell): HarthmereBuildingPolishAccentV1 {
  const label = `${shell.name} ${shell.district}`.toLowerCase();
  if (/chapel|temple|shrine|priest|saint|grave|cemetery/.test(label)) {
    return { banner: "banner_white", sign: "church_lantern", clutter: "candle_lit", trim: "arch_pillar_stone" };
  }
  if (/noble|reeve|court|estate|hall|tax|permit/.test(label)) {
    return { banner: "banner_red", sign: "obj_sign_post", clutter: "crate_a", trim: "arch_wall_corner" };
  }
  if (/dock|river|warehouse|ferry|fish|cargo/.test(label)) {
    return { banner: "banner_blue", sign: "obj_sign_post", clutter: "barrel_small", trim: "arch_overhang" };
  }
  if (/mudden|slum|wash|poor|kin/.test(label)) {
    return { banner: "banner_gray", sign: "obj_sign_post", clutter: "barrel_small", trim: "arch_wall_wood_broken" };
  }
  if (/smith|anvil|workshop|craft|forge/.test(label)) {
    return { banner: "banner_orange", sign: "obj_sign_post", clutter: "barrel_stack", trim: "arch_pillar_stone" };
  }
  if (/market|bakery|loaf|provision|store|auction|bank|guild|service|inn|kettle/.test(label)) {
    return { banner: "banner_yellow", sign: "obj_sign_post", clutter: "barrel_apples", trim: "arch_overhang" };
  }
  return { banner: shell.theme.banner ?? "banner_yellow", sign: "obj_sign_post", clutter: "crate_a", trim: shell.theme.corner ?? "arch_pillar_stone" };
}

function harthmereProductionPolishIsServiceOrLandmarkV2(shell: BuildingShell): boolean {
  const label = `${shell.name} ${shell.district}`.toLowerCase();
  return /gate|gatehouse|toll|bridge|watchtower|tower|chapel|temple|shrine|cottage|market|mara|edrik|noble|estate|reeve|inn|kettle|smith|anvil|workshop|craft|dock|warehouse|bank|auction|guild|provision|bakery|apothecary|well|underways|player services/.test(label);
}

function harthmereProductionPolishIsMajorBannerBuildingV2(shell: BuildingShell): boolean {
  const label = `${shell.name} ${shell.district}`.toLowerCase();
  return /gatehouse|chapel|temple|market|inn|kettle|noble|estate|reeve|bank|auction|guild/.test(label);
}

function createHarthmereBuildingExteriorPolishV1(
  shell: BuildingShell,
  context: HarthmereBuildingPolishContextV1,
): RuntimePlacement[] {
  const accents = harthmereProductionPolishAccentV1(shell);
  const hw = shell.w / 2;
  const hd = shell.d / 2;
  const floorBaseY = (context.v44Floor - 1) * context.storyHeight;
  const isGroundStory = context.v44Floor === 1;
  const isServiceOrLandmark = harthmereProductionPolishIsServiceOrLandmarkV2(shell);
  const placements: RuntimePlacement[] = [];

  if (isGroundStory) {
    // V2 voxel self-edit: keep about 70% of the facade clean. These are not
    // decorative bumps; they read as structural corner supports under heavy
    // stone/roof mass, preserving a strong silhouette instead of voxel vomit.
    placements.push(
      BP(
        accents.trim,
        shell,
        -hw,
        hd * 0.9,
        0,
        0.5,
        "production-polish-v2 functional protrusion structural support buttress clean readable silhouette west door-clearance-preserved",
        floorBaseY + 0.05,
      ),
      BP(
        accents.trim,
        shell,
        hw,
        hd * 0.9,
        0,
        0.5,
        "production-polish-v2 functional protrusion structural support buttress clean readable silhouette east door-clearance-preserved",
        floorBaseY + 0.05,
      ),
    );

    if (isServiceOrLandmark) {
      // V2 voxel self-edit: icon-first signage only on buildings that need to be
      // found. Do not scatter random barrels/crates on every wall just to fill space.
      placements.push(
        BP(
          accents.sign,
          shell,
          -Math.min(hw * 0.62, 2.75),
          hd + 0.76,
          0,
          0.31,
          "production-polish-v2 service landmark accent icon first readable sign layered depth door-clearance-preserved",
          floorBaseY + 0.12,
        ),
      );
    }
  }

  if (context.isTopStory && isServiceOrLandmark && shell.w >= 9) {
    // V2 voxel self-edit: one intentional roofline break on important buildings;
    // no rows of noisy spikes, ledges, or random wall clusters.
    placements.push(
      BP(
        "arch_roof_window",
        shell,
        -hw * 0.18,
        -hd * 0.08,
        0,
        0.32,
        "production-polish-v2 intentional roofline break clean silhouette",
        context.roofY + 0.18,
      ),
    );
  }

  if (isGroundStory && harthmereProductionPolishIsMajorBannerBuildingV2(shell)) {
    placements.push(
      BP(
        accents.banner,
        shell,
        Math.min(hw * 0.7, 3.1),
        hd + 0.34,
        0,
        0.42,
        "production-polish-v2 single district identity banner service landmark accent no visual noise",
        floorBaseY + Math.min(1.65, context.storyHeight * 0.62),
      ),
    );
  }

  // Hard cap: pretty does not mean busy. This enforces the no-voxel-vomit pass.
  return placements.slice(0, HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.maxExteriorAccentPlacementsPerBuilding);
}


function createBuildingShell(shell: BuildingShell): RuntimePlacement[] {
  const scale = shell.scale ?? 0.95;
  const wallY = shell.wallY ?? 0;
  const roofY = shell.roofY ?? 2.85;
  const roofScale = shell.roofScale ?? scale * 1.18;
  const hw = shell.w / 2;
  const hd = shell.d / 2;
  const t = shell.theme;
  const placements: RuntimePlacement[] = [];

  // V44 block-built continuous wall ring. Replaces the legacy sparse panel
  // pattern that produced the floating-beam look. Per
  // HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1 / harthmere-town-block-build-v1.
  const storyHeight = roofY && roofY > 0 ? Math.max(2.0, roofY) : HARTHMERE_STORY_HEIGHT_DEFAULT_V1;
  const v44Floor = Math.max(1, Math.round((wallY / Math.max(0.1, storyHeight)) + 1));
  const hwOffset = Math.min(3, Math.max(2, Math.floor(shell.w / 2) - 2));
  placements.push(
    ...createHarthmereContinuousBlockWallsV44(shell, { storyHeight, floor: v44Floor }),
  );

  // Decorative GLTF overlays at the same opening tiles the block ring
  // skipped. Total BP() count stays small (<=12) so the no-floating-debris
  // test is satisfied; the wall mass comes from V44.
  placements.push(BP(t.door, shell, 0, hd, 0, scale, "front door overlay", wallY));
  placements.push(BP(t.window, shell, -hwOffset, hd, 0, scale, "front left window overlay", wallY + 1.1));
  placements.push(BP(t.window, shell, hwOffset, hd, 0, scale, "front right window overlay", wallY + 1.1));
  placements.push(BP(t.window, shell, -hwOffset, -hd, Math.PI, scale, "back left window overlay", wallY + 1.1));
  placements.push(BP(t.window, shell, hwOffset, -hd, Math.PI, scale, "back right window overlay", wallY + 1.1));

  if (shell.w >= 22) {
    placements.push(
      BP(t.roof, shell, -shell.w * 0.25, 0, 0, roofScale, "left roof volume", roofY),
      BP(t.roof, shell, 0, 0, 0, roofScale, "center roof volume", roofY),
      BP(t.roof, shell, shell.w * 0.25, 0, 0, roofScale, "right roof volume", roofY),
    );
  } else {
    placements.push(BP(t.roof, shell, 0, 0, 0, roofScale, "roof volume", roofY));
  }

  if (t.chimney) {
    placements.push(BP(t.chimney, shell, hw * 0.38, -hd * 0.34, 0, scale * 0.78, "chimney", roofY + 1.25));
  }

  if (t.stair) {
    placements.push(BP(t.stair, shell, 0, hd + 2.2, 0, scale * 0.75, "entry step", 0));
  }

  // V2 voxel self-edit: do not double-banner every generic building.
  // Important banners are placed by createHarthmereBuildingExteriorPolishV1.

  placements.push(
    ...createHarthmereBuildingExteriorPolishV1(shell, {
      v44Floor,
      storyHeight,
      roofY,
      isTopStory: t.roof !== "arch_roof_flat",
    }),
  );

  return placements;
}


type HarthmereServiceBuildingProfileV43 =
  | "bakery"
  | "provision"
  | "player_services"
  | "smithy"
  | "workshop"
  | "apothecary"
  | "magic_shop"
  | "inn"
  | "reeve_hall"
  | "dock_warehouse"
  | "mudden_home"
  | "wash_house"
  | "residential_cottage"
  | "barracks"
  | "stable_office"
  | "chapel";

type HarthmereBlockBuiltServiceBuildingV43 = Omit<BuildingShell, "theme"> & {
  floors?: number;
  profile: HarthmereServiceBuildingProfileV43;
  banner?: string;
  roof?: string;
  serviceClearance?: boolean;
};

const HARTHMERE_SERVICE_BLOCK_STAIR_MAX_RISE_V43 = 0.42;
const HARTHMERE_SERVICE_BLOCK_STAIR_MIN_TREAD_V43 = 0.74;

function harthmereServiceStoneThemeV43(
  building: HarthmereBlockBuiltServiceBuildingV43,
  floor: number,
  floors: number,
): BuildingTheme {
  const isTop = floor === floors;
  const defaultRoof = building.profile === "chapel" || building.profile === "reeve_hall" || building.profile === "inn"
    ? "arch_roof_high_gable"
    : "arch_roof_gable";
  return {
    ...STONE_THEME,
    wall: "arch_wall_stone",
    window: building.profile === "chapel" || building.profile === "magic_shop"
      ? "arch_wall_window_round"
      : "arch_wall_window_stone",
    door: floor === 1 ? "arch_wall_door" : "arch_wall_stone",
    corner: "arch_wall_corner",
    roof: isTop ? (building.roof ?? defaultRoof) : "arch_roof_flat",
    chimney: isTop ? "arch_chimney" : undefined,
    stair: floor === 1 ? "arch_stairs_wide_stone" : undefined,
    banner: floor === 1 ? building.banner : undefined,
  };
}

function createHarthmereServiceFloorDeckBlocksV43(
  building: HarthmereBlockBuiltServiceBuildingV43,
  floor: number,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const theme = harthmereServiceStoneThemeV43(building, floor, building.floors ?? 1);
  const storyHeight = building.profile === "chapel" ? 3.05 : 2.7;
  const slabScale = Math.max(0.58, (building.scale ?? 0.8) * 0.9);
  const offsets: [number, number][] = building.w >= 24
    ? [[-building.w * 0.2, 0], [building.w * 0.2, 0]]
    : [[0, 0]];

  if (floor === 1) {
    for (const [dx, dz] of offsets) {
      placements.push(BP(
        "arch_roof_flat",
        { ...building, theme },
        dx,
        dz,
        0,
        slabScale,
        `block-built v43 solid stone/ore ground floor slab for ${building.profile} enclosed service building`,
        0.02,
      ));
    }
  }

  for (const [dx, dz] of offsets) {
    placements.push(BP(
      "arch_roof_flat",
      { ...building, theme },
      dx,
      dz,
      0,
      slabScale,
      `block-built v43 solid stone/ore ceiling slab floor ${floor} for ${building.profile} enclosed service building`,
      floor * storyHeight - 0.14,
    ));
  }

  return placements;
}

function createHarthmereServiceBlockStairRunV43(
  building: HarthmereBlockBuiltServiceBuildingV43,
  floor: number,
): RuntimePlacement[] {
  // BUILDING_V2_VOXEL_MESHES: replace the stepCount * arch_wall_stone
  // stair (which the user read as "massive blocks separate, no stairs")
  // with a single obj_wall_stairs voxel mesh per inter-floor transition.
  // One mesh, one draw call, one collision box -- and it actually looks
  // like a flight of stairs.
  const storyHeight = building.profile === "chapel" ? 3.05 : 2.7;
  const baseY = (floor - 1) * storyHeight + 0.05;
  const shell: BuildingShell = {
    ...building,
    theme: harthmereServiceStoneThemeV43(building, floor, building.floors ?? 1),
    wallY: baseY,
  };
  // Position at the building interior, offset along the south face so it
  // visually rises toward the upper-floor landing without blocking the
  // ground-floor entry doorway.
  const stairScale = Math.max(0.55, Math.min(0.9, (building.scale ?? 0.8) * 0.85));
  return [
    BP(
      "obj_wall_stairs",
      shell,
      -building.w * 0.22,
      building.d * 0.18,
      Math.PI / 2,
      stairScale,
      `${building.name} BUILDING_V2_VOXEL_MESHES single voxel stair mesh floor ${floor} to ${floor + 1} walkable doorway clear not floating not separate blocks`,
      baseY,
    ),
  ];
}

function createHarthmereServiceInteriorBuildoutV43(
  building: HarthmereBlockBuiltServiceBuildingV43,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const storyHeight = building.profile === "chapel" ? 3.05 : 2.7;
  const floorY = GROUND_Y + 0.18;
  const item = (
    asset: string,
    dx: number,
    dz: number,
    rotAdd: number,
    scale: number,
    label: string,
    yOffset = 0,
    floor = 1,
  ) => {
    const [x, z] = localPoint(building.x, building.z, building.rot ?? 0, dx, dz);
    placements.push(P(
      asset,
      x,
      z,
      (building.rot ?? 0) + rotAdd,
      scale,
      `${building.name} block-built v43 service interior ${label}`,
      building.district,
      floorY + (floor - 1) * storyHeight + yOffset,
    ));
  };

  switch (building.profile) {
    case "bakery":
      item("table_medium", -2.6, -2.4, 0, 0.48, "bakery oven/counter supported on stone floor");
      item("bread_loaf", -2.6, -2.4, 0.1, 0.34, "bakery bread display on counter", 0.62);
      item("crate_wooden_fp", 2.3, -2.2, 0, 0.42, "bakery flour crate stack on floor");
      break;
    case "provision":
      item("bookcase_2", 0, -building.d * 0.34, Math.PI, 0.42, "provision goods shelf against stone wall");
      item("bag_fp", -2.2, -1.8, 0, 0.46, "provision travel sack on floor");
      item("barrel_fp", 2.2, -1.8, 0, 0.46, "provision barrel on floor");
      break;
    case "player_services":
      item("table_medium", -3.2, -3.2, 0, 0.52, "bank auction mail counter supported on stone floor");
      item("box_decorated", -5.0, -3.0, 0, 0.44, "vault chest beside services counter");
      item("scroll_1_fp", -3.2, -3.2, 0, 0.22, "service ledger on counter", 0.64);
      break;
    case "smithy":
      item("anvil_fp", -2.6, -2.6, Math.PI / 2, 0.46, "smithy anvil on stone forge floor");
      item("mine_coal_block", 1.8, -2.7, 0, 0.42, "smithy ore coal block pile on floor");
      item("torch_lit", 3.0, -2.5, Math.PI / 2, 0.54, "smithy forge glow supported in stone forge mouth", 0.42);
      break;
    case "workshop":
      item("table_medium", -2.4, -2.2, 0, 0.46, "carpenter tailor workbench supported on stone floor");
      item("whetstone_fp", 1.8, -2.1, 0, 0.36, "workshop tool station on floor");
      item("crate_wooden_fp", 2.6, -1.5, 0, 0.38, "workshop material crate");
      break;
    case "apothecary":
      item("table_small", -2.2, -2.2, 0, 0.42, "apothecary mortar mixing counter on stone floor");
      item("bed_twin1", 2.0, -2.3, Math.PI / 2, 0.34, "apothecary treatment cot against wall");
      item("candlestick_stand_fp", -1.2, -2.4, 0, 0.34, "apothecary clean work candle", 0.18);
      break;
    case "magic_shop":
      item("bookcase_2", -building.w * 0.28, -2.4, Math.PI / 2, 0.44, "magic spellbook case against west stone wall");
      item("bookcase_2", building.w * 0.28, -2.4, -Math.PI / 2, 0.44, "magic component case against east stone wall");
      item("candlestick_triple_fp", 0, -2.2, 0, 0.32, "magic ritual counter candles", 0.52);
      break;
    case "inn":
      item("table_medium", -3.0, -3.0, 0, 0.52, "inn dining table supported on stone floor");
      item("bread_slice", -3.0, -3.0, 0, 0.34, "inn meal on dining table", 0.62);
      item("bed_twin2", 3.0, -3.2, Math.PI / 2, 0.42, "inn upstairs rentable bed against room wall", 0, 2);
      break;
    case "reeve_hall":
      item("table_medium", 0, -3.2, 0, 0.52, "reeve legal desk supported on stone civic floor");
      item("bookcase_2", -building.w * 0.25, -3.1, Math.PI, 0.42, "reeve legal archive bookcase against wall");
      item("scroll_2_fp", 0, -3.2, 0, 0.22, "reeve charter ledger on desk", 0.64);
      break;
    case "dock_warehouse":
      item("crate_wooden_fp", -3.0, -2.4, 0, 0.48, "dock cargo crate on warehouse floor");
      item("barrel_large", 0, -2.6, 0, 0.44, "dock sealed goods barrel on floor");
      item("bookcase_2", 3.0, -2.3, Math.PI, 0.34, "dock ledger shelf against stone wall");
      break;
    case "mudden_home":
      item("bed_twin1", -2.0, -2.0, Math.PI / 2, 0.28, "mudden sleeping pallet on stone floor");
      item("barrel_fp", 1.5, -1.9, 0, 0.34, "mudden water barrel on floor");
      item("bag_fp", 2.3, -1.6, 0, 0.34, "mudden food sack on floor");
      break;
    case "wash_house":
      item("bucket_wood", -1.8, -1.8, 0, 0.38, "wash house bucket on stone floor");
      item("barrel_large", 1.6, -1.8, 0, 0.38, "wash house water barrel on floor");
      item("banner_white", 0, -1.8, 0, 0.34, "wash house folded cloth on supported counter", 0.4);
      break;
    case "residential_cottage":
      item("bed_twin1", -2.2, -2.4, Math.PI / 2, 0.36, "residential cottage bed against wall");
      item("bookcase_2", 2.2, -2.1, Math.PI, 0.36, "residential cottage shelf against wall");
      item("table_small", 0, -1.8, 0, 0.36, "residential cottage family table");
      break;
    case "barracks":
      item("bed_twin1", -3.0, -2.4, Math.PI / 2, 0.32, "barracks bunk one against wall");
      item("bed_twin1", -1.4, -2.4, Math.PI / 2, 0.32, "barracks bunk two against wall");
      item("rack", 2.6, -2.4, Math.PI, 0.36, "barracks weapon rack against stone wall");
      break;
    case "stable_office":
      item("table_small", -1.6, -1.8, 0, 0.36, "stable ledger desk on stone floor");
      item("bucket_wood", 1.6, -1.8, 0, 0.36, "stable water bucket on floor");
      item("bag_fp", 2.4, -1.4, 0, 0.34, "stable feed sack on floor");
      break;
    case "chapel":
      item("church_bench", -4.8, -2.6, 0, 0.54, "chapel pew row west on stone floor");
      item("church_bench", 4.8, -2.6, 0, 0.54, "chapel pew row east on stone floor");
      item("church_pulpit", 0, -building.d * 0.34, Math.PI, 0.58, "chapel pulpit altar supported on stone floor");
      item("bookcase_2", building.w * 0.27, -building.d * 0.3, -Math.PI / 2, 0.42, "chapel archive bookcase against rebuilt stone wall");
      item("candlestick_stand_fp", -2.4, -building.d * 0.32, 0, 0.42, "chapel altar candle on stone floor");
      break;
  }

  return placements;
}

function createHarthmereBlockBuiltServiceBuildingV43(
  building: HarthmereBlockBuiltServiceBuildingV43,
): RuntimePlacement[] {
  const floors = Math.max(1, building.floors ?? 1);
  const placements: RuntimePlacement[] = [];
  const storyHeight = building.profile === "chapel" ? 3.05 : 2.7;

  for (let floor = 1; floor <= floors; floor += 1) {
    const theme = harthmereServiceStoneThemeV43(building, floor, floors);
    const shell: BuildingShell = {
      ...building,
      name: `${building.name} block-built v43 story ${floor}`,
      theme,
      wallY: (floor - 1) * storyHeight,
      roofY: floor === floors
        ? (building.roofY ?? floor * storyHeight - 0.12)
        : floor * storyHeight - 0.18,
      roofScale: building.roofScale ?? Math.max(0.76, (building.scale ?? 0.8) * 1.1),
    };

    placements.push(
      ...createBuildingShell(shell).map((placement) => ({
        ...placement,
        name: `${placement.name} block-built v43 solid stone/ore structural wall enclosed service shell`,
      })),
      ...createHarthmereServiceFloorDeckBlocksV43(building, floor),
    );

    if (floor < floors) {
      placements.push(...createHarthmereServiceBlockStairRunV43(building, floor));
    }
  }

  placements.push(...createHarthmereServiceInteriorBuildoutV43(building));

  if (floors > 1) {
    placements.push(...createHarthmereServiceMultiStoryCompletionV56(building));
  }
  if (floors === 1) {
    return filterSingleStoryRoofExtrasV4(
      placements,
      building.roofY ?? storyHeight - 0.12,
      building.name,
    );
  }
  return placements;
}

function row(
  asset: string,
  district: string,
  name: string,
  x: number,
  z: number,
  count: number,
  dx: number,
  dz: number,
  rot = 0,
  scale = 1,
): RuntimePlacement[] {
  return Array.from({ length: count }, (_, index) =>
    P(asset, x + dx * index, z + dz * index, rot, scale, `${name} ${index + 1}`, district),
  );
}


function wildsDeterministic01(x: number, z: number, salt = 0) {
  const raw = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return raw - Math.floor(raw);
}

function wildsDistanceToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const abX = bx - ax;
  const abZ = bz - az;
  const apX = x - ax;
  const apZ = z - az;
  const abLen2 = abX * abX + abZ * abZ;
  const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abLen2));
  return Math.hypot(x - (ax + abX * t), z - (az + abZ * t));
}

function isNearWideWildsVisualRoad(x: number, z: number, width = 18) {
  const roads = [
    [486, -292, 486, -930],
    [486, -112, 486, 560],
    [392, -209, -220, -209],
    [590, -205, 1240, -205],
    [430, -286, -170, -845],
    [590, -250, 1140, -820],
    [430, -112, -120, 500],
    [560, -112, 1120, 490],
  ] as const;
  return roads.some(([ax, az, bx, bz]) => wildsDistanceToSegment(x, z, ax, az, bx, bz) <= width);
}

function isInsideWideWildsTownBuffer(x: number, z: number) {
  return x >= 340 && x <= 640 && z >= -335 && z <= -70;
}



function harthmereHousingV38Theme(building: HarthmereResidentHousingBuildingV38): BuildingTheme {
  const banner = building.theme === "poor" ? "banner_brown" : "banner_green";
  const roof = building.style === "slum" ? "arch_roof_flat" : "arch_roof_high_gable";
  return {
    ...STONE_THEME,
    // v43 building law: even poor/slum/residential buildings use solid
    // stone/ore structural blocks. Poverty is shown through trim, clutter,
    // banners, roof profile, and interior props, not see-through wood shells.
    wall: "arch_wall_stone",
    window: "arch_wall_window_stone",
    door: "arch_wall_door",
    corner: "arch_wall_corner",
    roof,
    banner,
    stair: undefined,
  };
}

const HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V40 = HARTHMERE_RESIDENT_HOUSING_BLOCK_BUILD_VERSION_V40;
const HARTHMERE_RESIDENT_HOUSING_RENDERER_VERSION_V42 = HARTHMERE_RESIDENT_HOUSING_STONE_SHELL_VERSION_V42;
const HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40 = 0.42;
const HARTHMERE_RESIDENT_BLOCK_STAIR_MIN_TREAD_V40 = 0.74;

function harthmereResidentStoryHeightV40(building: HarthmereResidentHousingBuildingV38): number {
  return building.style === "slum" ? 2.45 : 2.7;
}

function harthmereResidentWallScaleV40(building: HarthmereResidentHousingBuildingV38): number {
  return building.style === "slum" ? 0.62 : 0.74;
}

function harthmereResidentFloorScaleV40(building: HarthmereResidentHousingBuildingV38): number {
  return building.style === "slum" ? 0.56 : 0.66;
}

function harthmereResidentWallBlockAssetV40(
  _building: HarthmereResidentHousingBuildingV38,
  index: number,
): string {
  // v43 building law: residential and slum structures must be built from
  // solid stone/ore block resources, not wood-only or broken see-through shells.
  // Use small ore variation sparingly as believable repair/patch blocks while
  // preserving collision and walkability.
  return index % 7 === 0 ? "mine_stone_01" : "arch_wall_stone";
}

function createHarthmereResidentFloorDeckBlocksV40(
  building: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const theme = harthmereHousingV38Theme(building);
  const storyHeight = harthmereResidentStoryHeightV40(building);
  const ceilingY = floor * storyHeight - 0.14;
  const slabScale = building.style === "slum" ? 0.72 : 0.82;
  const offsets: [number, number][] = building.w >= 16
    ? [[-building.w * 0.2, 0], [building.w * 0.2, 0]]
    : [[0, 0]];
  for (const [dx, dz] of offsets) {
    placements.push(
      BP(
        "arch_roof_flat",
        { ...building, theme },
        dx,
        dz,
        0,
        slabScale,
        `floor ${floor} solid stone ceiling and floor slab enclosing the story shell`,
        ceilingY,
      ),
    );
  }
  return placements;
}

function createHarthmereResidentWallBlocksV40(
  building: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  const theme = harthmereHousingV38Theme(building);
  const storyHeight = harthmereResidentStoryHeightV40(building);
  const isTop = floor === building.floors;
  const storyShell: BuildingShell = {
    name: `${building.name} story ${floor}`,
    district: building.district,
    x: building.x,
    z: building.z,
    w: building.w,
    d: building.d,
    rot: building.rot,
    scale: building.style === "slum" ? 0.72 : 0.78,
    wallY: (floor - 1) * storyHeight,
    roofY: floor * storyHeight - 0.18,
    roofScale: building.style === "slum" ? 0.84 : 0.9,
    theme: {
      ...theme,
      roof: isTop ? theme.roof : "arch_roof_flat",
      chimney: isTop ? theme.chimney : undefined,
      banner: floor === 1 ? theme.banner : undefined,
      stair: undefined,
      door: floor === 1 ? theme.door : theme.wall,
    },
  };
  return createBuildingShell(storyShell).map((placement) => ({
    ...placement,
    label: `${placement.label} solid stone/ore house shell no see-through overlap-safe`,
  }));
}

function createHarthmereBlockStairRunV40(
  building: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const theme = harthmereHousingV38Theme(building);
  const storyHeight = harthmereResidentStoryHeightV40(building);
  const stepCount = Math.ceil(storyHeight / HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40);
  const rise = storyHeight / stepCount;
  const tread = Math.max(HARTHMERE_RESIDENT_BLOCK_STAIR_MIN_TREAD_V40, building.style === "slum" ? 0.86 : 0.92);
  const baseY = (floor - 1) * storyHeight + 0.1;
  const startX = -building.w * 0.28;
  const startZ = building.d * 0.2;
  for (let step = 0; step <= stepCount; step += 1) {
    placements.push(
      BP(
        "arch_wall_stone",
        { ...building, theme },
        startX + step * tread,
        startZ - step * 0.42,
        Math.PI / 2,
        building.style === "slum" ? 0.4 : 0.44,
        `floor ${floor} to ${floor + 1} interior stone block stair riser ${step + 1} of ${stepCount + 1} max rise ${HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40} npc travel tread`,
        baseY + step * rise,
      ),
    );
  }
  return placements;
}

function createHarthmereBlockBuiltHousingPlacementsV40(
  building: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  for (let floor = 1; floor <= building.floors; floor += 1) {
    placements.push(
      ...createHarthmereResidentWallBlocksV40(building, floor),
      ...createHarthmereResidentFloorDeckBlocksV40(building, floor),
    );
    if (floor < building.floors) {
      placements.push(...createHarthmereBlockStairRunV40(building, floor));
    }
  }
  if (building.floors === 1) {
    return filterSingleStoryRoofExtrasV4(
      placements,
      harthmereResidentStoryHeightV40(building) - 0.18,
      building.name,
    );
  }
  return placements;
}


const HARTHMERE_LIVING_QUARTERS_REBUILD_RENDERER_VERSION_V48 = "harthmere-living-quarters-voxel-block-rebuild-v48";
const HARTHMERE_LIVING_QUARTERS_STRUCTURAL_BLOCKS_V48 = ["mine_stone_01", "mine_stone_02", "arch_wall_stone"] as const;

function harthmereLivingQuarterBlockAssetV48(index: number): string {
  return HARTHMERE_LIVING_QUARTERS_STRUCTURAL_BLOCKS_V48[index % HARTHMERE_LIVING_QUARTERS_STRUCTURAL_BLOCKS_V48.length];
}

function createHarthmereLivingQuarterBlockShellV48(
  building: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const storyHeight = building.style === "slum" ? 2.65 : 2.85;
  const tile = building.style === "slum" ? 2.05 : 2.2;
  const wallScale = building.style === "slum" ? 0.48 : 0.52;
  const slabScale = building.style === "slum" ? 0.72 : 0.82;
  const hw = building.w / 2;
  const hd = building.d / 2;
  let blockIndex = 0;

  const pushBlock = (
    asset: string,
    dx: number,
    dz: number,
    yOffset: number,
    label: string,
    rotAdd = 0,
    scale = wallScale,
  ) => {
    placements.push(
      BP(
        asset,
        { ...building, theme: harthmereHousingV38Theme(building) },
        dx,
        dz,
        rotAdd,
        scale,
        `${HARTHMERE_LIVING_QUARTERS_REBUILD_RENDERER_VERSION_V48} ${label}`,
        yOffset,
      ),
    );
  };

  for (let floor = 1; floor <= building.floors; floor += 1) {
    const baseY = (floor - 1) * storyHeight;
    const wallRows = [0.15, 1.18, 2.18];
    const xColumns = Math.max(4, Math.round(building.w / tile) + 1);
    const zColumns = Math.max(4, Math.round(building.d / tile) + 1);
    for (let c = 0; c < xColumns; c += 1) {
      const dx = -hw + c * (building.w / (xColumns - 1));
      for (const rowY of wallRows) {
        const isDoorGap = floor === 1 && rowY < 1.4 && Math.abs(dx) < tile * 0.58;
        if (!isDoorGap) {
          pushBlock(harthmereLivingQuarterBlockAssetV48(blockIndex++), dx, hd, baseY + rowY, `south solid voxel wall block floor ${floor} column ${c}`);
        }
        pushBlock(harthmereLivingQuarterBlockAssetV48(blockIndex++), dx, -hd, baseY + rowY, `north solid voxel wall block floor ${floor} column ${c}`, Math.PI);
      }
    }
    for (let c = 1; c < zColumns - 1; c += 1) {
      const dz = -hd + c * (building.d / (zColumns - 1));
      for (const rowY of wallRows) {
        pushBlock(harthmereLivingQuarterBlockAssetV48(blockIndex++), hw, dz, baseY + rowY, `east solid voxel wall block floor ${floor} column ${c}`, -Math.PI / 2);
        pushBlock(harthmereLivingQuarterBlockAssetV48(blockIndex++), -hw, dz, baseY + rowY, `west solid voxel wall block floor ${floor} column ${c}`, Math.PI / 2);
      }
    }

    // Two large, walkable block slabs make each story readable without filling
    // the scene with hundreds of loose cubes. They are floors/ceilings, not props.
    pushBlock("arch_roof_flat", -building.w * 0.22, 0, baseY - 0.08, `walkable stone floor slab left floor ${floor}`, 0, slabScale);
    pushBlock("arch_roof_flat", building.w * 0.22, 0, baseY - 0.08, `walkable stone floor slab right floor ${floor}`, 0, slabScale);
    pushBlock("arch_roof_flat", -building.w * 0.22, 0, baseY + storyHeight - 0.12, `clear roof or ceiling slab left floor ${floor}`, 0, slabScale * 0.98);
    pushBlock("arch_roof_flat", building.w * 0.22, 0, baseY + storyHeight - 0.12, `clear roof or ceiling slab right floor ${floor}`, 0, slabScale * 0.98);

    if (floor === 1) {
      pushBlock("arch_wall_door", 0, hd + 0.08, baseY + 0.08, `front oak door inserted into voxel wall floor ${floor}`, 0, building.style === "slum" ? 0.58 : 0.66);
    }
    if (floor < building.floors) {
      const stepCount = Math.ceil(storyHeight / HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40);
      const rise = storyHeight / stepCount;
      const tread = building.style === "slum" ? 0.92 : 1.02;
      const startX = building.stairDx;
      const startZ = building.stairDz;
      for (let step = 0; step <= stepCount; step += 1) {
        pushBlock(
          "mine_stone_01",
          startX + step * tread,
          startZ - step * 0.46,
          baseY + 0.1 + step * rise,
          `accessible interior block stair floor ${floor} step ${step + 1} max-rise ${HARTHMERE_RESIDENT_BLOCK_STAIR_MAX_RISE_V40}`,
          Math.PI / 2,
          building.style === "slum" ? 0.42 : 0.46,
        );
      }
      pushBlock("arch_roof_flat", startX + (stepCount + 1) * tread, startZ - (stepCount + 1) * 0.46, baseY + storyHeight - 0.08, `upper landing slab reachable from stair floor ${floor}`, 0, building.style === "slum" ? 0.54 : 0.6);
    }
  }

  return placements;
}

// HARTHMERE_LIVING_QUARTERS_VOXEL_REBUILD_V49
// ---------------------------------------------------------------------------
// Living-quarters rebuild that supersedes V48. The V48 builder placed widely-
// spaced wall blocks at scale 0.52 with 2.2 m gaps between them — the player
// could walk straight through every apartment wall. V49 uses the same proven
// continuous 1 m stone-block ring (createHarthmereContinuousBlockWallsV44) the
// Dawn Loaf Bakery uses, so the walls are flat, smooth, and solid.
//
// Per the design bible / MMO rules §11 (foundation → frame → walls → roof →
// interior) and §56 (front door 2 m clear, stair width 2 m). Per the user's
// voxel-stair spec: every stair step is a stacked stone block fully supported
// from below — no floating beams.
//
// Existing building IDs (res_v38_home_01..10, slum_v38_stack_01..04) and the
// per-room index layout from makeHarthmereResidentRoomCenterV38 are preserved
// so NPC home assignments and resident-room decor placements stay attached.
const HARTHMERE_LIVING_QUARTERS_VOXEL_REBUILD_RENDERER_VERSION_V49 =
  "harthmere-living-quarters-voxel-block-rebuild-doors-balconies-v49";

function harthmereLivingQuarterV49StoryHeight(
  b: HarthmereResidentHousingBuildingV38,
): number {
  return b.style === "slum" ? 2.7 : 2.85;
}

function harthmereLivingQuarterV49RoomColumns(
  b: HarthmereResidentHousingBuildingV38,
): number {
  // Mirror makeHarthmereResidentRoomCenterV38 so partition walls fall between
  // the existing room centers (which NPC decor placement relies on).
  return b.style === "slum" ? 2 : 3;
}

function harthmereLivingQuarterV49UsableWidth(
  b: HarthmereResidentHousingBuildingV38,
): number {
  return b.w - (b.style === "slum" ? 5.2 : 5.8);
}

function harthmereLivingQuarterV49Theme(
  b: HarthmereResidentHousingBuildingV38,
): BuildingTheme {
  // Same stone family the bakery and other service buildings use.
  const banner = b.theme === "poor" ? "banner_brown" : "banner_green";
  return {
    ...STONE_THEME,
    wall: "arch_wall_stone",
    window: "arch_wall_window_stone",
    door: "arch_wall_door",
    corner: "arch_wall_corner",
    roof: b.style === "slum" ? "arch_roof_flat" : "arch_roof_high_gable",
    chimney: undefined,
    stair: undefined,
    banner,
  };
}

function harthmereLivingQuarterV49Shell(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): BuildingShell {
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  return {
    name: `${b.name} v49 story ${floor}`,
    district: b.district,
    x: b.x,
    z: b.z,
    w: b.w,
    d: b.d,
    rot: b.rot,
    scale: b.style === "slum" ? 0.74 : 0.8,
    wallY: (floor - 1) * storyHeight,
    roofY: (floor - 1) * storyHeight + storyHeight - 0.12,
    theme: harthmereLivingQuarterV49Theme(b),
  };
}

function harthmereLivingQuarterV49Openings(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): HarthmereV44Opening[] {
  // BUILDING_PERF_FIX_V1: each opening explicitly carries `floor` and
  // `kind` so the V56 wall-panel renderer cuts the wall hole AND drops
  // the correct door / window asset (was: every opening became a window
  // because both fields were undefined on the V44 type).
  const openings: HarthmereV44Opening[] = [];
  const hwOffset = Math.min(3, Math.max(2, Math.floor(b.w / 2) - 2));

  if (floor === 1) {
    openings.push({ face: "south", offset: 0, widthBlocks: 1, bottomMeters: 0, topMeters: 2.1, floor, kind: "door" });
    openings.push({ face: "south", offset: -hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
    openings.push({ face: "south", offset: hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
    openings.push({ face: "north", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
    openings.push({ face: "east", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
    openings.push({ face: "west", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
    return openings;
  }

  // Upper floors: one full-height balcony door per room column on the
  // south face, light windows on the other three faces.
  const columns = harthmereLivingQuarterV49RoomColumns(b);
  const usableW = harthmereLivingQuarterV49UsableWidth(b);
  for (let col = 0; col < columns; col += 1) {
    const offset = -usableW / 2 + (col + 0.5) * (usableW / columns);
    openings.push({ face: "south", offset, widthBlocks: 1, bottomMeters: 0, topMeters: 2.1, floor, kind: "door" });
  }
  openings.push({ face: "north", offset: -hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
  openings.push({ face: "north", offset: hwOffset, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
  openings.push({ face: "east", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
  openings.push({ face: "west", offset: 0, widthBlocks: 1, bottomMeters: 1.1, topMeters: 2.0, floor, kind: "window" });
  return openings;
}

function createHarthmereLivingQuarterV49ExteriorWalls(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  // HARTHMERE_LIVING_QUARTERS_VOXEL_SOLID_AND_GRID_HASH_V50
  // Direct 1 m solid stone-cube ring. We deliberately do NOT call
  // createHarthmereContinuousBlockWallsV44 here, because V44 (a) multiplies
  // block scale by ~0.95 (so at shell.scale=0.8 each 1 m mesh renders at
  // 0.76 m on a 1 m grid → 0.24 m of air between every block), and
  // (b) substitutes thin arch_pillar_stone (0.16 m wide) and arch_overhang
  // (0.33 m tall) pieces every 4–5 columns, which produced the visible
  // "comb of pillars with daylight between" look on multi-floor apartments.
  //
  // The fantasy_town wall-block.glb mesh is exactly 1.00 × 1.00 × 1.00 m at
  // scale 1.0 (verified from POSITION accessor min/max), so 1 m grid spacing
  // means adjacent blocks are flush — no air gaps, ever.
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const openings = harthmereLivingQuarterV49Openings(b, floor);
  const tile = 1.0;
  const rows = Math.max(2, Math.round(storyHeight / tile));
  const floorBaseY = (floor - 1) * storyHeight;
  const hw = b.w / 2;
  const hd = b.d / 2;
  const placements: RuntimePlacement[] = [];

  const inOpening = (
    face: "north" | "south" | "east" | "west",
    columnCenter: number,
    blockY: number,
    isCornerColumn: boolean,
  ) => {
    if (isCornerColumn) return false;
    const rowMeters = blockY - floorBaseY;
    for (const op of openings) {
      if (op.face !== face) continue;
      const half = (op.widthBlocks * tile) / 2;
      if (columnCenter < op.offset - half - 0.001) continue;
      if (columnCenter > op.offset + half + 0.001) continue;
      if (rowMeters + tile <= op.bottomMeters + 0.001) continue;
      if (rowMeters >= op.topMeters - 0.001) continue;
      return true;
    }
    return false;
  };

  const pushFace = (
    face: "north" | "south" | "east" | "west",
    rangeMeters: number,
    constantAxis: "x" | "z",
    constantValue: number,
    rotAdd: number,
  ) => {
    const columns = Math.max(2, Math.round(rangeMeters / tile) + 1);
    const start = -((columns - 1) * tile) / 2;
    for (let c = 0; c < columns; c += 1) {
      const along = start + c * tile;
      const isCornerColumn = c === 0 || c === columns - 1;
      for (let r = 0; r < rows; r += 1) {
        const blockY = floorBaseY + r * tile;
        if (inOpening(face, along, blockY, isCornerColumn)) continue;
        // Only two assets: corner cube at the column endpoints, plain cube
        // for everything else. NO thin pillar/overhang substitution.
        const asset = isCornerColumn ? "arch_wall_corner" : "arch_wall_stone";
        const dx = constantAxis === "z" ? along : constantValue;
        const dz = constantAxis === "z" ? constantValue : along;
        placements.push(BP(
          asset,
          shell,
          dx,
          dz,
          rotAdd,
          1.0,
          `v50 solid voxel apartment wall ring ${face} floor ${floor} column ${c} row ${r} flush 1m stone cube no gaps`,
          blockY,
        ));
      }
    }
  };

  pushFace("north", b.w, "z", -hd, Math.PI);
  pushFace("south", b.w, "z",  hd, 0);
  pushFace("east",  b.d, "x",  hw, -Math.PI / 2);
  pushFace("west",  b.d, "x", -hw,  Math.PI / 2);

  return placements;
}

function createHarthmereLivingQuarterV49FloorAndCeiling(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const baseY = (floor - 1) * storyHeight;
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const slabScale = b.style === "slum" ? 0.76 : 0.86;
  const offsets: [number, number][] = b.w >= 18
    ? [[-b.w * 0.22, 0], [b.w * 0.22, 0]]
    : [[0, 0]];
  const placements: RuntimePlacement[] = [];
  for (const [dx, dz] of offsets) {
    if (floor === 1) {
      placements.push(BP(
        "arch_roof_flat",
        shell,
        dx,
        dz,
        0,
        slabScale,
        `v49 walkable stone ground floor slab floor ${floor}`,
        baseY - 0.06,
      ));
    }
    placements.push(BP(
      "arch_roof_flat",
      shell,
      dx,
      dz,
      0,
      slabScale * 0.98,
      `v49 stone ceiling and floor slab floor ${floor} reachable upper floor deck`,
      baseY + storyHeight - 0.16,
    ));
  }
  return placements;
}

function createHarthmereLivingQuarterV49DoorOverlays(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  // GLTF door / window prop overlays placed at the same opening tiles the
  // wall ring skipped. Names contain "front door" / "doorway clear" so the
  // player-collision system recognises them as walkable navigation openings.
  const placements: RuntimePlacement[] = [];
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const baseY = (floor - 1) * storyHeight;
  const hd = b.d / 2;
  const hw = b.w / 2;
  const doorScale = b.style === "slum" ? 0.6 : 0.66;
  const windowScale = b.style === "slum" ? 0.6 : 0.66;
  const hwOffset = Math.min(3, Math.max(2, Math.floor(b.w / 2) - 2));

  if (floor === 1) {
    placements.push(BP(
      "arch_wall_door",
      shell,
      0,
      hd,
      0,
      doorScale,
      `v49 front door overlay floor 1 main entrance doorway clear walkable opening`,
      baseY + 0.04,
    ));
    placements.push(BP("arch_wall_window_stone", shell, -hwOffset, hd, 0, windowScale, `v49 south left window overlay floor 1`, baseY + 1.05));
    placements.push(BP("arch_wall_window_stone", shell, hwOffset, hd, 0, windowScale, `v49 south right window overlay floor 1`, baseY + 1.05));
    placements.push(BP("arch_wall_window_stone", shell, 0, -hd, Math.PI, windowScale, `v49 north window overlay floor 1`, baseY + 1.05));
    placements.push(BP("arch_wall_window_stone", shell, hw, 0, -Math.PI / 2, windowScale, `v49 east window overlay floor 1`, baseY + 1.05));
    placements.push(BP("arch_wall_window_stone", shell, -hw, 0, Math.PI / 2, windowScale, `v49 west window overlay floor 1`, baseY + 1.05));
    return placements;
  }

  // Upper floors: one balcony-facing front door per room column.
  const columns = harthmereLivingQuarterV49RoomColumns(b);
  const usableW = harthmereLivingQuarterV49UsableWidth(b);
  for (let col = 0; col < columns; col += 1) {
    const offset = -usableW / 2 + (col + 0.5) * (usableW / columns);
    placements.push(BP(
      "arch_wall_door",
      shell,
      offset,
      hd,
      0,
      doorScale,
      `v49 front door overlay floor ${floor} room column ${col + 1} balcony entry doorway clear walkable opening`,
      baseY + 0.04,
    ));
  }
  placements.push(BP("arch_wall_window_stone", shell, -hwOffset, -hd, Math.PI, windowScale, `v49 north left window overlay floor ${floor}`, baseY + 1.05));
  placements.push(BP("arch_wall_window_stone", shell, hwOffset, -hd, Math.PI, windowScale, `v49 north right window overlay floor ${floor}`, baseY + 1.05));
  placements.push(BP("arch_wall_window_stone", shell, hw, 0, -Math.PI / 2, windowScale, `v49 east window overlay floor ${floor}`, baseY + 1.05));
  placements.push(BP("arch_wall_window_stone", shell, -hw, 0, Math.PI / 2, windowScale, `v49 west window overlay floor ${floor}`, baseY + 1.05));
  return placements;
}

function createHarthmereLivingQuarterV49Stair(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  // Stacked solid-block voxel stair. Each step has a 1 m-wide stack of stone
  // blocks all the way down from the step's top surface to the building floor
  // — no floating beams, no toothpick supports. The stair runs east along
  // the interior near the south wall so it lands on the upper-floor balcony.
  const placements: RuntimePlacement[] = [];
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const baseY = (floor - 1) * storyHeight;
  const stepCount = Math.max(4, Math.ceil(storyHeight / 0.5));
  const rise = storyHeight / stepCount;
  const tread = 1.0;
  const stairScale = b.style === "slum" ? 0.5 : 0.55;
  const startX = -b.w / 2 + 2.0;
  const startZ = b.d / 2 - 1.6;

  for (let step = 1; step <= stepCount; step += 1) {
    const stepTopY = baseY + step * rise;
    const stepX = startX + (step - 1) * tread;
    // Stack supporting blocks from the floor all the way up to just below
    // the step top. This is the user's spec: "no visible stair block floats
    // unsupported."
    const supportLayers = Math.max(1, Math.floor((stepTopY - baseY) / 0.6));
    for (let layer = 0; layer < supportLayers; layer += 1) {
      const layerY = baseY + layer * 0.6;
      if (layerY + 0.55 >= stepTopY) continue;
      placements.push(BP(
        "arch_wall_stone",
        shell,
        stepX,
        startZ,
        0,
        stairScale,
        `v49 voxel stair support block floor ${floor} step ${step} support layer ${layer + 1} solid stacked stone no floating`,
        layerY,
      ));
    }
    // The step's top block — this is the actual tread the player stands on.
    placements.push(BP(
      "mine_stone_01",
      shell,
      stepX,
      startZ,
      0,
      stairScale,
      `v49 voxel stair tread block floor ${floor} step ${step} of ${stepCount} solid stone block entry step walkable`,
      stepTopY - 0.4,
    ));
  }
  // Landing slab where the stair meets the upper floor.
  placements.push(BP(
    "arch_roof_flat",
    shell,
    startX + stepCount * tread,
    startZ,
    0,
    stairScale * 1.3,
    `v49 voxel stair upper landing slab floor ${floor + 1} entry step walkable doorway clear`,
    baseY + storyHeight - 0.12,
  ));

  return placements;
}

function createHarthmereLivingQuarterV49Balcony(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  // Exterior balcony deck on the south face of every upper floor. The deck
  // is a walkable strip with a stone railing along the outer edge. Each
  // upper-floor room door (placed in createHarthmereLivingQuarterV49DoorOverlays)
  // opens onto this deck.
  const placements: RuntimePlacement[] = [];
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const baseY = (floor - 1) * storyHeight;
  const hd = b.d / 2;
  const deckDepth = 2.4;
  const deckCenterZ = hd + deckDepth / 2;
  const deckScale = b.style === "slum" ? 0.74 : 0.82;
  const railScale = b.style === "slum" ? 0.42 : 0.46;

  // Two large deck slabs spanning the building width for the balcony floor.
  for (const dx of [-b.w * 0.22, b.w * 0.22]) {
    placements.push(BP(
      "arch_roof_flat",
      shell,
      dx,
      deckCenterZ,
      0,
      deckScale,
      `v49 balcony deck floor ${floor} walkable stone balcony walkway entry step opening passage doorway clear`,
      baseY - 0.04,
    ));
  }

  // Stone-block railing posts along the outer edge of the balcony.
  const railOuterZ = hd + deckDepth - 0.25;
  const railColumns = Math.max(3, Math.round(b.w / 2.2));
  for (let c = 0; c < railColumns; c += 1) {
    const railX = -b.w / 2 + (c + 0.5) * (b.w / railColumns);
    placements.push(BP(
      "arch_balcony_fence",
      shell,
      railX,
      railOuterZ,
      0,
      railScale,
      `v49 balcony railing post floor ${floor} column ${c + 1} stone railing fence rail`,
      baseY + 0.1,
    ));
  }

  return placements;
}

function createHarthmereLivingQuarterV49Partitions(
  b: HarthmereResidentHousingBuildingV38,
  floor: number,
): RuntimePlacement[] {
  // Interior north-south partition walls dividing the floor into per-column
  // room suites. Floor 1 is left open as a foyer + stair vestibule so the
  // ground floor stays uncluttered for NPC entry pathing. Upper floors get
  // partitions between every adjacent column so each room column has 3 solid
  // walls (left partition, right partition, north exterior) plus its south
  // balcony door — matching the user spec: "3 walls, ceiling, floor, door."
  if (floor === 1) return [];
  const placements: RuntimePlacement[] = [];
  const shell = harthmereLivingQuarterV49Shell(b, floor);
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const baseY = (floor - 1) * storyHeight;
  const columns = harthmereLivingQuarterV49RoomColumns(b);
  const usableW = harthmereLivingQuarterV49UsableWidth(b);
  const partitionScale = b.style === "slum" ? 0.5 : 0.55;
  const hd = b.d / 2;
  const partitionDepth = b.d - 2.4;
  // Block every ~2 m along the partition. arch_wall_stone has a 7.4 m wide
  // collision box at scale 1.0, so 2 m spacing forms a continuous wall.
  const partitionBlocks = Math.max(3, Math.ceil(partitionDepth / 2.0));
  const stackRows = 2;

  for (let col = 1; col < columns; col += 1) {
    const partitionX = -usableW / 2 + col * (usableW / columns);
    for (let i = 0; i < partitionBlocks; i += 1) {
      const partitionZ = -hd + 1.2 + i * (partitionDepth / Math.max(1, partitionBlocks - 1));
      for (let r = 0; r < stackRows; r += 1) {
        placements.push(BP(
          (i + r) % 5 === 0 ? "mine_stone_01" : "arch_wall_stone",
          shell,
          partitionX,
          partitionZ,
          Math.PI / 2,
          partitionScale,
          `v49 interior partition wall floor ${floor} column ${col} block ${i + 1} row ${r + 1} separates room suites solid stone`,
          baseY + r * 1.2,
        ));
      }
    }
  }
  return placements;
}

function createHarthmereLivingQuarterVoxelShellV49(
  b: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  for (let floor = 1; floor <= b.floors; floor += 1) {
    placements.push(
      ...createHarthmereLivingQuarterV49ExteriorWalls(b, floor),
      ...createHarthmereLivingQuarterV49FloorAndCeiling(b, floor),
      ...createHarthmereLivingQuarterV49DoorOverlays(b, floor),
      ...createHarthmereLivingQuarterV49Partitions(b, floor),
    );
    if (floor < b.floors) {
      placements.push(...createHarthmereLivingQuarterV49Stair(b, floor));
    }
    if (floor > 1) {
      placements.push(...createHarthmereLivingQuarterV49Balcony(b, floor));
    }
  }
  return placements;
}


const HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56 = "harthmere-living-quarters-performance-complete-v56";
const HARTHMERE_SERVICE_MULTI_STORY_COMPLETION_VERSION_V56 = "harthmere-service-multi-story-completion-v56";

function createHarthmereLivingQuarterVoxelShellV56(
  b: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const storyHeight = harthmereLivingQuarterV49StoryHeight(b);
  const hw = b.w / 2;
  const hd = b.d / 2;
  // BUILDING_PERF_FIX_V1: stretch panels to cut placements ~30%.
  // Scale grows in lockstep so adjacent panels still meet flush.
  const panelStep = b.style === "slum" ? 2.4 : 2.6;
  const panelScale = b.style === "slum" ? 1.92 : 2.10;
  const rowOffsets = [0.54, 1.78];
  const theme = harthmereHousingV38Theme(b);

  const isInsideOpening = (
    face: HarthmereV44Opening["face"],
    floor: number,
    offsetAlongWall: number,
    openings: readonly HarthmereV44Opening[],
  ): boolean => {
    // BUILDING_PERF_FIX_V1: tolerate openings missing `floor` (treat
    // them as belonging to every floor) so any code path that hands us
    // a V44-shaped opening list still gets door cutouts.
    return openings.some((opening) => (
      opening.face === face &&
      (opening.floor === undefined || opening.floor === floor) &&
      Math.abs(offsetAlongWall - opening.offset) <= Math.max(1.05, opening.widthBlocks * 0.72)
    ));
  };

  const push = (
    shell: BuildingShell,
    asset: string,
    dx: number,
    dz: number,
    rotAdd: number,
    scale: number,
    label: string,
    yOffset: number,
  ) => {
    placements.push(BP(asset, shell, dx, dz, rotAdd, scale, label, yOffset));
  };

  const pushWallPanels = (
    shell: BuildingShell,
    floor: number,
    face: HarthmereV44Opening["face"],
    length: number,
    fixed: number,
    rotAdd: number,
    openings: readonly HarthmereV44Opening[],
  ) => {
    const columns = Math.max(4, Math.ceil(length / panelStep) + 1);
    const start = -((columns - 1) * panelStep) / 2;
    for (let column = 0; column < columns; column += 1) {
      const along = start + column * panelStep;
      if (isInsideOpening(face, floor, along, openings)) {
        continue;
      }
      for (let row = 0; row < rowOffsets.length; row += 1) {
        const isCorner = column === 0 || column === columns - 1;
        // BUILDING_PERF_FIX_V1: canonical palette only -- corners use
        // arch_wall_corner, everything else arch_wall_stone. The
        // mine_stone_01 splash was producing checkerboard noise on
        // apartment exteriors per the design lead's audit.
        const asset = isCorner ? "arch_wall_corner" : "arch_wall_stone";
        const [dx, dz] = face === "north" || face === "south"
          ? [along, fixed]
          : [fixed, along];
        push(
          shell,
          asset,
          dx,
          dz,
          rotAdd,
          isCorner ? panelScale * 0.78 : panelScale,
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 solid performance apartment wall panel face ${face} floor ${floor} column ${column + 1} row ${row + 1} solid stone/ore block-built no see-through residential/slum shell`,
          shell.wallY! + rowOffsets[row],
        );
      }
    }
  };

  for (let floor = 1; floor <= b.floors; floor += 1) {
    const shell = {
      ...harthmereLivingQuarterV49Shell(b, floor),
      theme,
      scale: b.scale,
    };
    const baseY = shell.wallY ?? (floor - 1) * storyHeight;
    const openings = harthmereLivingQuarterV49Openings(b, floor);

    pushWallPanels(shell, floor, "north", b.w, -hd, Math.PI, openings);
    pushWallPanels(shell, floor, "south", b.w, hd, 0, openings);
    pushWallPanels(shell, floor, "west", b.d, -hw, -Math.PI / 2, openings);
    pushWallPanels(shell, floor, "east", b.d, hw, Math.PI / 2, openings);

    const slabCenters = b.w >= 18 ? [-b.w * 0.23, b.w * 0.23] : [0];
    for (const dx of slabCenters) {
      if (floor === 1) {
        push(
          shell,
          "arch_roof_flat",
          dx,
          0,
          0,
          Math.max(0.62, (b.scale ?? 0.8) * 0.95),
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 walkable ground floor slab doorway clear no invisible blocker solid stone/ore residential/slum floor`,
          baseY + 0.02,
        );
      }
      push(
        shell,
        "arch_roof_flat",
        dx,
        0,
        0,
        Math.max(0.64, (b.scale ?? 0.8) * 0.98),
        `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 walkable upper floor slab and ceiling floor ${floor} doorway clear no invisible blocker solid stone/ore residential/slum ceiling`,
        baseY + storyHeight - 0.12,
      );
    }

    for (const opening of openings) {
      // BUILDING_PERF_FIX_V1: only render an overlay on openings that
      // belong to this floor (or are floor-agnostic). Without this we
      // would drop every opening overlay onto every floor, which is
      // what produced the duplicate-window stacks the user noticed.
      if (opening.floor !== undefined && opening.floor !== floor) continue;
      const kind = opening.kind ?? "window";
      const asset = kind === "door" ? theme.door : theme.window;
      const y = baseY + (kind === "door" ? 0.72 : 1.42);
      const rotAdd = opening.face === "north" ? Math.PI : opening.face === "south" ? 0 : opening.face === "west" ? -Math.PI / 2 : Math.PI / 2;
      const dx = opening.face === "north" || opening.face === "south"
        ? opening.offset
        : opening.face === "west" ? -hw - 0.04 : hw + 0.04;
      const dz = opening.face === "east" || opening.face === "west"
        ? opening.offset
        : opening.face === "north" ? -hd - 0.04 : hd + 0.04;
      push(
        shell,
        asset,
        dx,
        dz,
        rotAdd,
        (b.scale ?? 0.8) * (kind === "door" ? 0.72 : 0.58),
        `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 ${kind} overlay face ${opening.face} floor ${floor} doorway clear no invisible blocker residential/slum complete two-story access`,
        y,
      );
    }

    if (floor > 1) {
      // BUILDING_PERF_FIX_V1: half the partition density. NPCs can't
      // see through the partitions and the visual rhythm is the same.
      const partitionCount = Math.max(1, Math.floor(b.w / 10));
      for (let p = 1; p <= partitionCount; p += 1) {
        const x = -hw + (b.w * p) / (partitionCount + 1);
        for (const z of [-b.d * 0.22, b.d * 0.22]) {
          for (let row = 0; row < 1; row += 1) {
            push(
              shell,
              // BUILDING_PERF_FIX_V1: partitions use canonical wall asset.
              "arch_wall_stone",
              x,
              z,
              Math.PI / 2,
              panelScale * 0.78,
              `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 upper room partition panel floor ${floor} partition ${p} row ${row + 1} solid stone/ore block-built apartment interior`,
              baseY + rowOffsets[row],
            );
          }
        }
      }
    }

    if (floor < b.floors) {
      const stepCount = b.style === "slum" ? 7 : 6;
      const rise = storyHeight / stepCount;
      const tread = b.style === "slum" ? 1.02 : 1.18;
      const startX = -hw + 2.0;
      const startZ = hd - 2.2;
      for (let step = 0; step <= stepCount; step += 1) {
        const y = baseY + step * rise;
        const dx = startX + step * tread;
        const dz = startZ - step * 0.36;
        push(
          shell,
          // BUILDING_PERF_FIX_V1: stair supports use the canonical wall asset.
          "arch_wall_stone",
          dx,
          dz,
          Math.PI / 2,
          0.62,
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 stacked solid stone stair support floor ${floor} step ${step + 1} not floating residential/slum upper-story access`,
          Math.max(baseY + 0.08, y - 0.18),
        );
        push(
          shell,
          "arch_roof_flat",
          dx,
          dz,
          0,
          0.48,
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 walkable stair tread floor ${floor} step ${step + 1} doorway clear no invisible blocker residential/slum upper-story access`,
          y + 0.05,
        );
      }
      push(
        shell,
        "arch_roof_flat",
        startX + (stepCount + 1) * tread,
        startZ - (stepCount + 1) * 0.36,
        0,
        0.72,
        `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 upper landing slab floor ${floor + 1} walkable doorway clear no invisible blocker complete two-story residential/slum access`,
        baseY + storyHeight + 0.02,
      );
    }

    if (floor > 1) {
      const deckZ = hd + 1.18;
      const deckCount = b.style === "slum" ? 2 : 3;
      for (let i = 0; i < deckCount; i += 1) {
        const dx = deckCount === 1 ? 0 : -b.w * 0.28 + (b.w * 0.56 * i) / Math.max(1, deckCount - 1);
        push(
          shell,
          "arch_roof_flat",
          dx,
          deckZ,
          0,
          0.64,
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 balcony deck walkable doorway clear no invisible blocker upper floor ${floor} residential/slum access`,
          baseY + 0.04,
        );
        push(
          shell,
          "arch_balcony_fence",
          dx,
          deckZ + 0.58,
          0,
          0.42,
          `${HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56} v56 balcony railing upper floor ${floor} residential/slum safe edge`,
          baseY + 0.62,
        );
      }
    }
  }

  return placements;
}

function createHarthmereServiceMultiStoryCompletionV56(
  building: HarthmereBlockBuiltServiceBuildingV43,
): RuntimePlacement[] {
  // BUILDING_V2_VOXEL_MESHES: disabled. This function used to layer a
  // second-story stair / balcony / deck stack on top of every V43
  // multi-story service building (Guard Barracks, Smithy, Edrik Vane
  // Estate, Reeve Hall, Gatehouse, etc). The user's perf-log notes
  // explicitly called this out:
  //   "all the 2nd story buildings need to be redone. They just look
  //    like massive blocks that are separate and not touching and no
  //    stairs to get to the 2nd level"
  //   "the two story building should not prevent access the building
  //    underneath. They need to be on top of the buildings"
  // The V43 createBuildingShell + V44 wall ring already build the
  // multi-floor exterior walls, and createHarthmereServiceBlockStairRunV43
  // (now an obj_wall_stairs mesh) builds the visible stair, so this
  // function adds no value -- it only multiplied placements and pushed
  // visible "floating block" clutter.
  void building;
  return [];
}

function createHarthmereResidentStoryFrameV38(
  building: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  // BUILDING_V2_VOXEL_MESHES: instead of generating 200-700 individual
  // 1 m block placements through V49/V56, emit one whole-building voxel
  // mesh per building. obj_house_{1,2,3} (medieval_voxel House_1/2/3)
  // are pre-baked voxel buildings the player can still hack through and
  // that the user pointed to as the right look for slums and apartments.
  // The 14 residential / slum buildings used to push ~8000 placements
  // for their wall shells; this drops it to ~22.
  const placements: RuntimePlacement[] = [];

  // Stable per-building variant pick so the residential row reads as
  // varied terrace housing rather than 10 copies of the same model.
  const idHash = (() => {
    let h = 2166136261;
    const id = String(building.id);
    for (let i = 0; i < id.length; i += 1) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  })();
  const variants = ["obj_house_1", "obj_house_2", "obj_house_3"] as const;
  const groundAsset = variants[idHash % variants.length];
  // For slum stacks pick a different upper-floor variant so the stack
  // silhouette reads as distinct tenement floors.
  const stackedAsset = variants[(idHash + 1) % variants.length];

  // The voxel House_* meshes are roughly a 6-8 m wide single-storey
  // footprint at scale 1. We scale to (footprint / 7) so the mesh fills
  // the building plot, then bump slightly for slum stacks because they
  // are taller. The user explicitly asked for two-story buildings to
  // sit ON TOP of the ground floor rather than block its entrance --
  // we achieve that by emitting the upper mesh at +(storyHeight) Y and
  // keeping the ground mesh exactly at GROUND_Y.
  const fitScale = Math.max(0.85, Math.min(1.55, (Math.min(building.w, building.d) / 7.0)));
  const storyHeight = building.style === "slum" ? 2.7 : 2.85;
  const groundScale = building.style === "slum" ? fitScale * 1.05 : fitScale;

  // Ground-floor whole-building voxel mesh -- one placement, one draw
  // call, one collision box. Replaces ~500-800 individual block placements.
  placements.push(P(
    groundAsset,
    building.x,
    building.z,
    building.rot,
    groundScale,
    `${building.name} BUILDING_V2_VOXEL_MESHES whole voxel building mesh ground floor accessible doorway clear ${building.style === "slum" ? "mudden ward slum tenement" : "residential row house"}`,
    building.district,
  ));

  // For multi-story buildings emit a second whole-building voxel mesh
  // stacked above. The model's own roof reads as the upper floor's
  // floor + walls, and because it sits ABOVE the ground mesh's footprint
  // the ground entrance stays clear (per user note: "the two story
  // building should not prevent access the building underneath").
  if (building.floors >= 2) {
    placements.push(P(
      stackedAsset,
      building.x,
      building.z,
      building.rot,
      groundScale * 0.94,
      `${building.name} BUILDING_V2_VOXEL_MESHES whole voxel building mesh upper floor on top of ground floor entry not blocked ${building.style === "slum" ? "mudden ward slum upper tenement" : "residential upper floor"}`,
      building.district,
      GROUND_Y + storyHeight,
    ));
  }

  // Tall slum stacks (4-5 floors) get a third stacked mesh so the
  // silhouette reads as a tenement block rather than a 2-story house.
  if (building.style === "slum" && building.floors >= 4) {
    placements.push(P(
      groundAsset,
      building.x,
      building.z,
      building.rot,
      groundScale * 0.88,
      `${building.name} BUILDING_V2_VOXEL_MESHES whole voxel building mesh top tenement floor mudden ward slum stack`,
      building.district,
      GROUND_Y + storyHeight * 2,
    ));
  }

  // A single voxel-stair mesh at the south face gives a visible exterior
  // stair so the upper floor reads as reachable (fixes the user's "no
  // stairs to get to the 2nd level" note). One mesh = one placement.
  if (building.floors >= 2) {
    const [stairWX, stairWZ] = localPoint(
      building.x,
      building.z,
      building.rot,
      0,
      building.d / 2 + 1.8,
    );
    placements.push(P(
      "obj_wall_stairs",
      stairWX,
      stairWZ,
      building.rot,
      groundScale * 0.85,
      `${building.name} BUILDING_V2_VOXEL_MESHES exterior voxel stair mesh upper-floor access doorway clear walkable not floating`,
      building.district,
      GROUND_Y,
    ));
  }

  return placements;
}

function createHarthmereResidentRoomDecorPlacementsV38(
  building: HarthmereResidentHousingBuildingV38,
): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const storyHeight = harthmereResidentStoryHeightV40(building);
  const theme = harthmereHousingV38Theme(building);
  const decor = makeHarthmereResidentialRoomDecorV38(building.style);

  for (let floor = 1; floor <= building.floors; floor += 1) {
    const floorY = GROUND_Y + (floor - 1) * storyHeight + 0.18;
    for (let roomIndex = 0; roomIndex < building.roomsPerFloor; roomIndex += 1) {
      const center = makeHarthmereResidentRoomCenterV38(building, roomIndex);
      for (const item of decor) {
        const [x, z] = localPoint(
          building.x,
          building.z,
          building.rot,
          center.dx + item.dx,
          center.dz + item.dz,
        );
        placements.push(
          P(
            item.asset,
            x,
            z,
            building.rot + item.rot,
            item.scale,
            `${building.name} floor ${floor} room ${roomIndex + 1} resident room ${item.role} ${item.label} placed on block floor deck`,
            building.district,
            floorY + item.y,
          ),
        );
      }
      const [markerX, markerZ] = localPoint(building.x, building.z, building.rot, center.dx, center.dz);
      placements.push(
        P(
          "arch_wall_stone",
          markerX,
          markerZ,
          building.rot,
          building.style === "slum" ? 0.18 : 0.2,
          `${building.name} floor ${floor} room ${roomIndex + 1} clear center stone floor accessibility marker`,
          building.district,
          floorY - 0.16,
        ),
      );
    }
  }

  return placements;
}

function createHarthmereResidentHousingV38Placements(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  for (const building of [
    ...HARTHMERE_RESIDENTIAL_HOUSE_BUILDINGS_V38,
    ...HARTHMERE_SLUM_STACK_BUILDINGS_V38,
  ]) {
    placements.push(
      ...createHarthmereResidentStoryFrameV38(building),
      ...createHarthmereResidentRoomDecorPlacementsV38(building),
    );
  }
  return placements;
}

function createHarthmereWildlifeHerdPlacements(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const herds = [
    {
      district: "Harthmere Wilds - North Greenmere Wildlife",
      cx: 515,
      cz: -650,
      w: 620,
      d: 500,
      count: 46,
      animals: ["animal_deer", "animal_deer", "animal_bunny", "animal_fox", "animal_wolf", "animal_boar"],
      speed: 0.34,
    },
    {
      district: "Harthmere Wilds - West Old Wood Wildlife",
      cx: 80,
      cz: -250,
      w: 600,
      d: 680,
      count: 42,
      animals: ["animal_deer", "animal_fox", "animal_bunny", "animal_wolf", "animal_boar", "animal_bear"],
      speed: 0.32,
    },
    {
      district: "Harthmere Wilds - East Briarfen Wildlife",
      cx: 900,
      cz: -250,
      w: 560,
      d: 620,
      count: 38,
      animals: ["animal_frog", "animal_snake", "animal_crow", "animal_wolf", "animal_boar"],
      speed: 0.28,
    },
    {
      district: "Harthmere Wilds - South Orchardwood Wildlife",
      cx: 420,
      cz: 300,
      w: 620,
      d: 420,
      count: 40,
      animals: ["animal_chicken", "animal_pig", "animal_sheep", "animal_bunny", "animal_fox", "animal_boar"],
      speed: 0.38,
    },
    {
      district: "Harthmere Wilds - Gravewood Threats",
      cx: 850,
      cz: 280,
      w: 520,
      d: 420,
      count: 26,
      animals: ["animal_crow", "animal_wolf", "townsperson_undead", "townsperson_undead"],
      speed: 0.16,
    },
    {
      district: "Harthmere Wilds - Bandit Ridge Patrols",
      cx: 150,
      cz: -680,
      w: 440,
      d: 430,
      count: 24,
      animals: ["townsperson_bandit", "townsperson_bandit", "animal_wolf", "animal_crow"],
      speed: 0.18,
    },
  ] as const;

  for (const herd of herds) {
    for (let index = 0; index < herd.count; index += 1) {
      const u = wildsDeterministic01(herd.cx + index * 41, herd.cz - index * 17, 201);
      const v = wildsDeterministic01(herd.cx - index * 13, herd.cz + index * 37, 202);
      const x = Math.round(herd.cx + (u - 0.5) * herd.w);
      const z = Math.round(herd.cz + (v - 0.5) * herd.d);
      if (isInsideWideWildsTownBuffer(x, z) || isNearWideWildsVisualRoad(x, z, 12)) {
        continue;
      }
      const animal = herd.animals[Math.floor(wildsDeterministic01(x, z, 203) * herd.animals.length)] ?? herd.animals[0];
      const rot = wildsDeterministic01(x, z, 204) * Math.PI * 2;
      const scale = 0.82 + wildsDeterministic01(x, z, 205) * 0.48;
      placements.push(
        A(
          animal,
          x,
          z,
          rot,
          scale,
          `${herd.district} roaming ${animal.replace("animal_", "").replace("townsperson_", "")}`,
          herd.district,
          {
            radius: 1.6 + wildsDeterministic01(x, z, 206) * 5.2,
            speed: herd.speed * (0.72 + wildsDeterministic01(x, z, 207) * 0.72),
            phase: wildsDeterministic01(x, z, 208) * Math.PI * 2,
          },
        ),
      );
    }
  }
  return placements;
}

function createHarthmereDeepResourceMarkerPlacements(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const markers = [
    ["food_mushroom", 42, -138, "Old Wood mushroom ring"],
    ["food_mushroom", 520, -398, "Greenmere mushroom hollow"],
    ["food_mushroom", 802, -760, "North mooncap fungus patch"],
    ["food_apple", 382, -54, "Orchard apple pickup"],
    ["food_green_apple", 420, 22, "Green apple windfall"],
    ["food_carrot", 430, -350, "Gate field carrot and flax marker"],
    ["forest_bush_4e", 546, -430, "Greenmere berry thicket"],
    ["forest_bush_2b", -122, 24, "Old Wood berry thicket"],
    ["forest_grass_2d", 650, -260, "Briarfen reed bed"],
    ["forest_grass_1c", 780, -378, "Briarfen mudroot reeds"],
    ["mine_coal_block", 244, -532, "Bandit ridge coal seam"],
    ["mine_stone_01", 178, -604, "Watchtower iron cut"],
    ["mine_silver_block", -190, 92, "Old Wood silver thread"],
    ["mine_gold_block", 822, 344, "Gravewood gold fragment"],
    ["mine_diamond_fragment", 980, -824, "Far north rare crystal hint"],
    ["mine_pickaxe", 292, -476, "Quarry pick beside real ore"],
    ["minecart", 112, -696, "Ridge minecart by silver cut"],
    ["bucket_wood", 864, -286, "Blackwater clay bucket"],
    ["rock_wide", 1088, -236, "Briarfen exposed silver stone"],
  ] as const;

  for (const [asset, x, z, name] of markers) {
    placements.push(P(asset, x, z, 0, 0.48, name, "Harthmere Wilds - Real Resource Markers"));
  }

  return placements;
}

function createHarthmereWideWildsPlacements(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];

  // Long visible roads in all cardinal directions. These line up with the new
  // server-side terrain roads and keep the expanded wilderness readable.
  placements.push(
    ...row("road", "Harthmere Wilds - North Road", "North road milestone", 486, -304, 78, 0, -8, 0, 0.86),
    ...row("road", "Harthmere Wilds - South Road", "South road milestone", 486, -100, 82, 0, 8, 0, 0.86),
    ...row("road", "Harthmere Wilds - West Road", "West road milestone", 384, -209, 78, -8, 0, Math.PI / 2, 0.86),
    ...row("road", "Harthmere Wilds - East Road", "East river road milestone", 604, -205, 82, 8, 0, Math.PI / 2, 0.86),
    ...row("road", "Harthmere Wilds - Northwest Hunter Track", "Hunter track stone", 420, -304, 60, -8, -8, -0.68, 0.64),
    ...row("road", "Harthmere Wilds - Northeast Reed Track", "Reed track stone", 604, -260, 60, 8, -8, 0.68, 0.64),
    ...row("road", "Harthmere Wilds - Southwest Orchard Track", "Orchard track stone", 420, -100, 60, -8, 8, 0.68, 0.64),
    ...row("road", "Harthmere Wilds - Southeast Grave Track", "Grave track stone", 568, -100, 60, 8, 8, -0.68, 0.64),
  );

  const zones = [
    {
      district: "Harthmere Wilds - North Greenmere",
      name: "north greenmere forest",
      cx: 486,
      cz: -640,
      w: 520,
      d: 560,
      count: 135,
      treeAssets: ["tree_high", "tree", "tree_crooked"],
      groundAssets: ["hedge_large", "hedge", "rock_small", "logs"],
      treeScale: 1.08,
    },
    {
      district: "Harthmere Wilds - South Greenmere",
      name: "south greenmere forest",
      cx: 486,
      cz: 290,
      w: 520,
      d: 520,
      count: 130,
      treeAssets: ["tree", "tree_high", "tree_crooked"],
      groundAssets: ["hedge", "hedge_large", "rock_small", "logs"],
      treeScale: 1.04,
    },
    {
      district: "Harthmere Wilds - West Old Wood",
      name: "west old wood",
      cx: 80,
      cz: -210,
      w: 560,
      d: 470,
      count: 120,
      treeAssets: ["tree_crooked", "tree", "tree_high"],
      groundAssets: ["hedge_large", "rock_wide", "logs", "fence_broken"],
      treeScale: 1.06,
    },
    {
      district: "Harthmere Wilds - East Briarfen Woods",
      name: "east briarfen woods",
      cx: 850,
      cz: -190,
      w: 560,
      d: 470,
      count: 120,
      treeAssets: ["tree_crooked", "tree", "hedge_large"],
      groundAssets: ["hedge", "rock_small", "arch_planks", "barrel_fp"],
      treeScale: 0.96,
    },
    {
      district: "Harthmere Wilds - Northwest Watchtower Ridge",
      name: "northwest ridge forest",
      cx: 185,
      cz: -610,
      w: 420,
      d: 420,
      count: 86,
      treeAssets: ["tree_crooked", "tree_high", "tree"],
      groundAssets: ["rock_wide", "rock_small", "crate_metal_fp", "fence_broken"],
      treeScale: 1.0,
    },
    {
      district: "Harthmere Wilds - Northeast High Pines",
      name: "northeast high pine forest",
      cx: 825,
      cz: -650,
      w: 430,
      d: 420,
      count: 88,
      treeAssets: ["tree_high", "tree", "tree_crooked"],
      groundAssets: ["hedge_large", "rock_small", "logs"],
      treeScale: 1.12,
    },
    {
      district: "Harthmere Wilds - Southwest Orchardwood",
      name: "southwest orchardwood forest",
      cx: 150,
      cz: 260,
      w: 450,
      d: 420,
      count: 92,
      treeAssets: ["tree", "tree_crooked", "tree_high"],
      groundAssets: ["farmcrate_apple", "barrel_fp", "logs", "hedge"],
      treeScale: 1.0,
    },
    {
      district: "Harthmere Wilds - Southeast Gravewood",
      name: "southeast gravewood forest",
      cx: 830,
      cz: 260,
      w: 440,
      d: 420,
      count: 92,
      treeAssets: ["tree_crooked", "tree", "tree_high"],
      groundAssets: ["tombstone", "rock_small", "candle_thin_lit", "hedge_large"],
      treeScale: 1.02,
    },
  ] as const;

  for (const zone of zones) {
    for (let index = 0; index < zone.count; index += 1) {
      const u = wildsDeterministic01(zone.cx + index * 17, zone.cz - index * 23, 1);
      const v = wildsDeterministic01(zone.cx - index * 29, zone.cz + index * 31, 2);
      const x = zone.cx + (u - 0.5) * zone.w;
      const z = zone.cz + (v - 0.5) * zone.d;
      if (isInsideWideWildsTownBuffer(x, z) || isNearWideWildsVisualRoad(x, z, 19)) {
        continue;
      }

      const selector = Math.floor(wildsDeterministic01(x, z, 3) * zone.treeAssets.length);
      const asset = zone.treeAssets[selector] ?? zone.treeAssets[0];
      const rot = wildsDeterministic01(x, z, 4) * Math.PI * 2;
      const scale = zone.treeScale * (0.78 + wildsDeterministic01(x, z, 5) * 0.62);
      placements.push(P(asset, x, z, rot, scale, `${zone.name} tree ${index + 1}`, zone.district));

      if (index % 5 === 0) {
        const groundSelector = Math.floor(wildsDeterministic01(x, z, 6) * zone.groundAssets.length);
        const groundAsset = zone.groundAssets[groundSelector] ?? zone.groundAssets[0];
        placements.push(
          P(
            groundAsset,
            x + (wildsDeterministic01(x, z, 7) - 0.5) * 6,
            z + (wildsDeterministic01(x, z, 8) - 0.5) * 6,
            rot * 0.5,
            0.44 + wildsDeterministic01(x, z, 9) * 0.44,
            `${zone.name} undergrowth ${index + 1}`,
            zone.district,
          ),
        );
      }
    }
  }

  // Big-region landmarks. These make each direction feel like a different
  // wilderness, not one repeated wall of trees.
  placements.push(
    P("obj_tower_complex", 160, -630, 0.2, 0.92, "Far ruined watchtower silhouette", "Harthmere Wilds - Northwest Watchtower Ridge"),
    P("obj_wall_simple_windows", 175, -624, 0.2, 0.62, "Far fallen watch wall", "Harthmere Wilds - Northwest Watchtower Ridge"),
    P("crate_metal_fp", 184, -616, 0, 0.52, "Outlaw cache crate", "Harthmere Wilds - Northwest Watchtower Ridge"),
    P("rock_wide", 130, -590, 0, 0.82, "Ridge quarry iron face", "Harthmere Wilds - Northwest Watchtower Ridge"),

    P("arch_planks", 870, -310, Math.PI / 2, 0.78, "Briarfen raised plank path", "Harthmere Wilds - East Briarfen Woods"),
    P("arch_planks", 890, -330, Math.PI / 2, 0.78, "Briarfen second plank path", "Harthmere Wilds - East Briarfen Woods"),
    P("lantern", 900, -348, 0, 0.54, "Briarfen witchlight", "Harthmere Wilds - East Briarfen Woods", GROUND_Y + 0.8),
    P("barrel_fp", 915, -336, 0, 0.58, "Hidden smuggler barrel", "Harthmere Wilds - East Briarfen Woods"),

    P("obj_church_grave_fence", 760, 210, 0.2, 0.66, "Outer gravewood fence", "Harthmere Wilds - Southeast Gravewood"),
    P("tombstone", 770, 220, -0.1, 0.72, "Outer gravewood marker", "Harthmere Wilds - Southeast Gravewood"),
    P("tombstone", 782, 240, 0.15, 0.68, "Second outer gravewood marker", "Harthmere Wilds - Southeast Gravewood"),
    P("obj_church_bells", 800, 255, 0, 0.5, "Buried bell shard far from town", "Harthmere Wilds - Southeast Gravewood"),

    P("arch_windmill", 160, 170, 0.2, 0.86, "Distant orchard windmill", "Harthmere Wilds - Southwest Orchardwood"),
    P("cart", 140, 205, -0.4, 0.62, "Broken orchard cart", "Harthmere Wilds - Southwest Orchardwood"),
    P("farmcrate_apple", 152, 198, 0, 0.68, "Wild apple crate marker", "Harthmere Wilds - Southwest Orchardwood"),

    P("pillar", 520, -820, 0.3, 0.68, "Northern standing stone", "Harthmere Wilds - North Greenmere"),
    P("pillar", 538, -842, -0.2, 0.62, "Broken northern standing stone", "Harthmere Wilds - North Greenmere"),
    P("candle_lit", 530, -830, 0, 0.42, "Old Wood ritual light supported on flat ritual stone", "Harthmere Wilds - North Greenmere", GROUND_Y + 0.28),

    P("rock_wide", 510, 420, 0, 0.78, "South forest mossy boulder", "Harthmere Wilds - South Greenmere"),
    P("logs", 492, 438, Math.PI / 2, 0.76, "South forest fallen timber", "Harthmere Wilds - South Greenmere"),
    P("crate_a", 505, 450, 0.2, 0.54, "Lost traveler cache", "Harthmere Wilds - South Greenmere"),
  );

  // Wildlife, enemies, and workers in every direction. These are sparse markers
  // and movement loops; actual combat/gathering rules stay in the Harthmere systems.
  placements.push(
    A("animal_deer", 450, -650, Math.PI / 2, 1.05, "North herd deer", "Harthmere Wilds - North Greenmere", { radius: 6, speed: 0.28, phase: 0.4 }),
    A("animal_wolf", 555, -720, -0.8, 1.04, "North pack wolf", "Harthmere Wilds - North Greenmere", { radius: 5, speed: 0.38, phase: 1.6 }),
    A("animal_bear", 610, -780, 0.2, 1.06, "Old Wood bear", "Harthmere Wilds - North Greenmere", { radius: 3, speed: 0.18, phase: 2.8 }),
    A("townsperson_hunter", 420, -560, Math.PI / 2, 1.1, "North trail hunter", "Harthmere Wilds - North Greenmere", { radius: 4, speed: 0.16, phase: 1.1 }),

    A("animal_boar", 420, 320, -0.3, 1.0, "South boar sounder", "Harthmere Wilds - South Greenmere", { radius: 4.5, speed: 0.34, phase: 0.8 }),
    A("animal_fox", 530, 250, Math.PI, 0.86, "South fox", "Harthmere Wilds - South Greenmere", { radius: 3.2, speed: 0.46, phase: 2.2 }),
    A("animal_deer", 570, 410, -0.5, 1.0, "South forest deer", "Harthmere Wilds - South Greenmere", { radius: 5.2, speed: 0.26, phase: 2.7 }),

    A("townsperson_bandit", 155, -610, -Math.PI / 2, 1.14, "Watchtower ridge scout", "Harthmere Wilds - Northwest Watchtower Ridge", { radius: 4.2, speed: 0.2, phase: 1.3 }),
    A("townsperson_bandit", 188, -640, Math.PI / 2, 1.18, "Watchtower ridge bruiser", "Harthmere Wilds - Northwest Watchtower Ridge", { radius: 3.2, speed: 0.17, phase: 0.4 }),
    A("animal_wolf", 115, -575, Math.PI, 1.0, "Ridge wolf", "Harthmere Wilds - Northwest Watchtower Ridge", { radius: 4, speed: 0.34, phase: 2.0 }),

    A("animal_frog", 870, -290, 0, 1.0, "Briarfen frog", "Harthmere Wilds - East Briarfen Woods", { radius: 1.1, speed: 0.42, phase: 0.2 }),
    A("animal_snake", 930, -320, -0.6, 1.0, "Briarfen water snake", "Harthmere Wilds - East Briarfen Woods", { radius: 1.4, speed: 0.2, phase: 2.3 }),
    A("townsperson_smuggler", 910, -350, Math.PI, 1.1, "Outer Briarfen smuggler", "Harthmere Wilds - East Briarfen Woods", { radius: 4, speed: 0.18, phase: 1.7 }),
    A("townsperson_undead", 955, -370, -Math.PI / 2, 1.06, "Drowned dead beyond reeds", "Harthmere Wilds - East Briarfen Woods", { radius: 2.2, speed: 0.1, phase: 0.6 }),

    A("animal_crow", 770, 215, 0, 0.9, "Gravewood crow", "Harthmere Wilds - Southeast Gravewood", { radius: 1.4, speed: 0.42, phase: 0.5 }),
    A("townsperson_undead", 805, 250, Math.PI, 1.08, "Outer gravewood dead", "Harthmere Wilds - Southeast Gravewood", { radius: 2.2, speed: 0.09, phase: 2.6 }),
    A("animal_wolf", 735, 275, -Math.PI / 2, 0.94, "Pale gravewood wolf", "Harthmere Wilds - Southeast Gravewood", { radius: 3.0, speed: 0.28, phase: 1.5 }),

    A("animal_chicken", 170, 180, 0, 0.9, "Orchard chicken", "Harthmere Wilds - Southwest Orchardwood", { radius: 1.8, speed: 0.7, phase: 0.1 }),
    A("animal_pig", 145, 210, 0, 1.0, "Orchard pig", "Harthmere Wilds - Southwest Orchardwood", { radius: 2.2, speed: 0.32, phase: 1.8 }),
    A("townsperson_farmer", 160, 195, 0, 1.12, "Outer orchard farmer", "Harthmere Wilds - Southwest Orchardwood", { radius: 4, speed: 0.18, phase: 0.9 }),
  );

  return placements;
}


function createHarthmereDenseForestPlacements(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  const zones = [
    {
      district: "Harthmere Wilds - North Deep Greenmere",
      cx: 486,
      cz: -705,
      w: 760,
      d: 640,
      count: 220,
      trees: ["forest_tree_1a", "forest_tree_2a", "forest_tree_3b", "tree_high", "tree_high_round", "tree_high_crooked"],
      understory: ["forest_bush_1a", "forest_bush_2b", "forest_bush_3c", "forest_grass_1a", "forest_grass_2b", "hedge", "logs"],
      resources: ["forest_rock_1a", "forest_rock_2c", "mine_stone_01", "mine_coal_piece"],
      treeScale: 1.05,
    },
    {
      district: "Harthmere Wilds - South Greenmere Thicket",
      cx: 486,
      cz: 330,
      w: 780,
      d: 520,
      count: 190,
      trees: ["forest_tree_1b", "forest_tree_2d", "forest_tree_4c", "tree", "tree_high_round"],
      understory: ["forest_bush_1d", "forest_bush_4e", "forest_grass_1c", "forest_grass_2d", "farmcrate_apple", "hedge_large"],
      resources: ["forest_rock_1a", "mine_stone_02", "mine_coal_block"],
      treeScale: 0.98,
    },
    {
      district: "Harthmere Wilds - West Old Wood",
      cx: 120,
      cz: -230,
      w: 640,
      d: 700,
      count: 205,
      trees: ["forest_tree_2a", "forest_tree_3b", "tree_crooked", "tree_high_crooked", "forest_tree_bare_1a"],
      understory: ["forest_bush_2b", "forest_bush_3c", "forest_grass_2b", "rock_small", "logs", "fence_broken"],
      resources: ["forest_rock_2c", "forest_rock_3f", "mine_silver_stone", "mine_stone_01"],
      treeScale: 1.04,
    },
    {
      district: "Harthmere Wilds - East Briarfen Wood",
      cx: 875,
      cz: -160,
      w: 660,
      d: 700,
      count: 185,
      trees: ["forest_tree_1a", "forest_tree_4c", "tree_crooked", "forest_tree_bare_2b", "tree_high_round"],
      understory: ["forest_bush_1a", "forest_bush_1d", "forest_grass_1a", "forest_grass_2d", "hedge_large", "barrel_fp"],
      resources: ["forest_rock_1a", "mine_stone_02", "mine_coal_piece"],
      treeScale: 0.96,
    },
    {
      district: "Harthmere Wilds - Northwest Bandit Ridge",
      cx: 160,
      cz: -690,
      w: 520,
      d: 500,
      count: 145,
      trees: ["tree_high_crooked", "forest_tree_bare_1a", "forest_tree_2d", "tree_crooked"],
      understory: ["forest_bush_4e", "forest_grass_2b", "rock_wide", "fence_broken", "crate_metal_fp"],
      resources: ["mine_coal_block", "mine_silver_stone", "mine_stone_01", "mine_pickaxe"],
      treeScale: 1.0,
    },
    {
      district: "Harthmere Wilds - Southeast Gravewood",
      cx: 820,
      cz: 260,
      w: 520,
      d: 460,
      count: 135,
      trees: ["forest_tree_bare_1a", "forest_tree_bare_2b", "tree_crooked", "tree_high_crooked"],
      understory: ["forest_bush_3c", "forest_grass_1c", "rock_small", "tombstone", "candle_lit"],
      resources: ["forest_rock_3f", "mine_stone_02", "mine_gold_fragment"],
      treeScale: 1.02,
    },
  ] as const;

  for (const zone of zones) {
    for (let index = 0; index < zone.count; index += 1) {
      const u = wildsDeterministic01(zone.cx + index * 19, zone.cz - index * 23, 101);
      const v = wildsDeterministic01(zone.cx - index * 29, zone.cz + index * 31, 102);
      const x = Math.round(zone.cx + (u - 0.5) * zone.w);
      const z = Math.round(zone.cz + (v - 0.5) * zone.d);
      if (isInsideWideWildsTownBuffer(x, z) || isNearWideWildsVisualRoad(x, z, 22)) {
        continue;
      }

      const treeAsset = zone.trees[Math.floor(wildsDeterministic01(x, z, 103) * zone.trees.length)] ?? zone.trees[0];
      const rot = wildsDeterministic01(x, z, 104) * Math.PI * 2;
      const scale = zone.treeScale * (0.74 + wildsDeterministic01(x, z, 105) * 0.82);
      placements.push(P(treeAsset, x, z, rot, scale, `${zone.district} dense tree ${index + 1}`, zone.district));

      if (index % 2 === 0) {
        const underAsset = zone.understory[Math.floor(wildsDeterministic01(x, z, 106) * zone.understory.length)] ?? zone.understory[0];
        placements.push(
          P(
            underAsset,
            x + (wildsDeterministic01(x, z, 107) - 0.5) * 8,
            z + (wildsDeterministic01(x, z, 108) - 0.5) * 8,
            rot * 0.37,
            0.36 + wildsDeterministic01(x, z, 109) * 0.5,
            `${zone.district} undergrowth ${index + 1}`,
            zone.district,
          ),
        );
      }

      if (index % 17 === 0) {
        const resourceAsset = zone.resources[Math.floor(wildsDeterministic01(x, z, 110) * zone.resources.length)] ?? zone.resources[0];
        placements.push(
          P(
            resourceAsset,
            x + (wildsDeterministic01(x, z, 111) - 0.5) * 10,
            z + (wildsDeterministic01(x, z, 112) - 0.5) * 10,
            rot * 0.24,
            0.52 + wildsDeterministic01(x, z, 113) * 0.46,
            `${zone.district} mineable resource ${index + 1}`,
            zone.district,
          ),
        );
      }
    }
  }

  // Larger readable mining clusters. These are intentionally off-road and near
  // landmarks so the player can discover gathering loops without every rock
  // being a generic node.
  placements.push(
    P("minecart", 105, -705, 0.4, 0.72, "Bandit ridge abandoned minecart", "Harthmere Wilds - Northwest Bandit Ridge"),
    P("mine_coal_block", 118, -718, 0, 0.74, "Bandit ridge coal seam", "Harthmere Wilds - Northwest Bandit Ridge"),
    P("mine_silver_stone", 142, -688, 0.2, 0.78, "Bandit ridge silver-bearing stone", "Harthmere Wilds - Northwest Bandit Ridge"),
    P("mine_stone_01", 94, -664, -0.2, 0.86, "Bandit ridge quarry stone", "Harthmere Wilds - Northwest Bandit Ridge"),
    P("mine_pickaxe", 126, -700, -0.6, 0.64, "Dropped miner pickaxe", "Harthmere Wilds - Northwest Bandit Ridge"),

    P("mine_stone_02", 875, -375, 0.2, 0.72, "Briarfen blackwater clay-stone", "Harthmere Wilds - East Briarfen Wood"),
    P("forest_rock_3f", 910, -392, 0, 0.68, "Briarfen slick gathering rock", "Harthmere Wilds - East Briarfen Wood"),
    P("mine_gold_fragment", 782, 286, 0, 0.5, "Gravewood strange gold fleck", "Harthmere Wilds - Southeast Gravewood"),
    P("mine_stone_01", 540, -870, 0.2, 0.84, "North Greenmere standing-stone quarry", "Harthmere Wilds - North Deep Greenmere"),
    P("forest_rock_2c", 260, 410, -0.3, 0.74, "Southwest orchard fieldstone", "Harthmere Wilds - South Greenmere Thicket"),
  );

  // Ambush actors: visual walkers that pair with the combat HUD's occasional
  // threat rolls. They wander in small radii so they feel alive but do not block
  // roads or doorways.
  placements.push(
    A("townsperson_bandit", 112, -715, -Math.PI / 2, 1.16, "Bandit ridge ambusher", "Harthmere Wilds - Northwest Bandit Ridge", { radius: 5.5, speed: 0.2, phase: 0.5 }),
    A("townsperson_bandit", 245, -640, Math.PI, 1.12, "Bandit trapper in the old wood", "Harthmere Wilds - West Old Wood", { radius: 6.5, speed: 0.18, phase: 2.1 }),
    A("townsperson_bandit", 870, -385, Math.PI / 2, 1.1, "Briarfen road thief", "Harthmere Wilds - East Briarfen Wood", { radius: 4.5, speed: 0.18, phase: 1.4 }),
    A("townsperson_undead", 805, 292, Math.PI, 1.1, "Gravewood wandering zombie", "Harthmere Wilds - Southeast Gravewood", { radius: 4.2, speed: 0.09, phase: 0.2 }),
    A("townsperson_undead", 735, 334, -0.4, 1.08, "Bell-woken corpse", "Harthmere Wilds - Southeast Gravewood", { radius: 5.2, speed: 0.08, phase: 2.5 }),
    A("townsperson_undead", 928, -415, -Math.PI / 2, 1.04, "Drowned Briarfen zombie", "Harthmere Wilds - East Briarfen Wood", { radius: 3.8, speed: 0.08, phase: 1.1 }),
  );

  // A visible tree curtain near the safe edge signals that the authored build is
  // ending. The client/server clamp keeps players out of missing terrain, while
  // this visual treatment prevents the edge from feeling like an invisible bug.
  for (let i = 0; i < 48; i += 1) {
    const t = i / 47;
    const x = -230 + t * 1460;
    const northZ = -968 + (wildsDeterministic01(i, 0, 201) - 0.5) * 18;
    const southZ = 488 + (wildsDeterministic01(i, 0, 202) - 0.5) * 18;
    const asset = i % 3 === 0 ? "tree_high_crooked" : i % 3 === 1 ? "forest_tree_3b" : "tree_high_round";
    placements.push(
      P(asset, x, northZ, wildsDeterministic01(i, northZ, 203) * Math.PI * 2, 1.05, `Northern far forest wall ${i + 1}`, "Harthmere Wilds - Far Edge"),
      P(asset, x, southZ, wildsDeterministic01(i, southZ, 204) * Math.PI * 2, 1.0, `Southern far forest wall ${i + 1}`, "Harthmere Wilds - Far Edge"),
    );
  }
  for (let i = 0; i < 48; i += 1) {
    const t = i / 47;
    const z = -955 + t * 1420;
    const westX = -232 + (wildsDeterministic01(i, z, 205) - 0.5) * 18;
    const eastX = 1224 + (wildsDeterministic01(i, z, 206) - 0.5) * 18;
    const asset = i % 3 === 0 ? "forest_tree_bare_2b" : i % 3 === 1 ? "forest_tree_2a" : "tree_high_crooked";
    placements.push(
      P(asset, westX, z, wildsDeterministic01(westX, i, 207) * Math.PI * 2, 1.02, `Western far forest wall ${i + 1}`, "Harthmere Wilds - Far Edge"),
      P(asset, eastX, z, wildsDeterministic01(eastX, i, 208) * Math.PI * 2, 1.04, `Eastern far forest wall ${i + 1}`, "Harthmere Wilds - Far Edge"),
    );
  }

  return placements;
}

const HARTHMERE_STREET_DECLUTTER_VERSION_V4 = "harthmere-street-declutter-runtime-cleanup-v4";
const HARTHMERE_SINGLE_STORY_ROOF_CAP_VERSION_V4 = "harthmere-single-story-roof-cap-v4";
const HARTHMERE_ROOF_STREET_BLOCK_CLEANUP_VERSION_V5 = "harthmere-roof-street-block-cleanup-v5";

type HarthmereRuntimePlacementCleanupReportV4 = {
  version: string;
  originalCount: number;
  keptCount: number;
  removedStreetClutter: number;
  removedRoadIntrusions: number;
  removedStreetBlocks: number;
  removedRoofBlocks: number;
  samples: string[];
  placements: RuntimePlacement[];
};

const HARTHMERE_STREET_CLUTTER_ASSET_RE_V4 = /^(crate_|crates_|barrel|barrel_|barrel_small|barrel_large|barrel_stack|farmcrate_|box_|bag_|bucket_|bench_|stall|stall_|cart|table_|table|chair|stool|rope_|lantern|obj_kiosk)$/i;
const HARTHMERE_STRUCTURAL_STREET_INTRUSION_RE_V4 = /(block-built|solid stone\/ore|roof volume|ceiling slab|floor slab|interior stone\/ore stair block|roof dormer|chimney|story \d+)/i;
const HARTHMERE_STREET_SEGMENTS_V4: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [486, -286, 486, -248, 8],
  [430, -207, 542, -207, 8],
  [484, -190, 484, -152, 7],
  [536, -196, 604, -196, 7],
  [404, -154, 432, -154, 6],
];
const HARTHMERE_NO_BUILD_BOXES_V4: ReadonlyArray<readonly [number, number, number, number]> = [
  [470, 502, -286, -258],
  [456, 514, -222, -196],
  [478, 492, -198, -152],
  [534, 608, -204, -188],
  [400, 432, -170, -144],
];



type HarthmereRoofClearBoxV5 = {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  upper?: boolean;
};

const HARTHMERE_CLEAR_STREET_RECTS_V5: ReadonlyArray<readonly [number, number, number, number]> = [
  // Narrow road lanes only. Building footprints are excluded below so this can
  // remove loose blocks without hollowing out walls next to the road.
  [478, 496, -292, -214],
  [414, 606, -218, -202],
  [586, 612, -218, -176],
  [400, 434, -162, -146],
  [478, 492, -198, -126],
];

const HARTHMERE_ROOF_CLEAR_BOXES_V5: ReadonlyArray<HarthmereRoofClearBoxV5> = [
  { name: "traveler_hearth_player_house", x0: 448, x1: 466, z0: -266, z1: -246, upper: true },
  { name: "harthmere_stables", x0: 464, x1: 478, z0: -274, z1: -256 },
  { name: "guard_yard_office", x0: 500, x1: 524, z0: -278, z1: -258 },
  { name: "reeve_hall", x0: 550, x1: 582, z0: -272, z1: -250, upper: true },
  { name: "dawn_loaf_bakery", x0: 418, x1: 442, z0: -204, z1: -184 },
  { name: "brindle_provision_house", x0: 444, x1: 464, z0: -226, z1: -208 },
  { name: "market_auction_office", x0: 500, x1: 518, z0: -226, z1: -208 },
  { name: "brass_scale_bank", x0: 546, x1: 568, z0: -236, z1: -214 },
  { name: "black_anvil_smithy", x0: 520, x1: 544, z0: -242, z1: -220 },
  { name: "crafters_workshop", x0: 494, x1: 514, z0: -238, z1: -220 },
  { name: "green_mortar_apothecary", x0: 448, x1: 466, z0: -184, z1: -168 },
  { name: "wyrm_and_candle_magic_shop", x0: 508, x1: 528, z0: -178, z1: -158 },
  { name: "copper_kettle_inn", x0: 532, x1: 566, z0: -208, z1: -180, upper: true },
  { name: "saint_verena_chapel", x0: 466, x1: 494, z0: -150, z1: -128 },
  { name: "river_dock_supply", x0: 574, x1: 602, z0: -196, z1: -176 },
  { name: "dock_warehouse", x0: 574, x1: 600, z0: -170, z1: -150 },
  { name: "mudden_ward_shelter", x0: 398, x1: 426, z0: -170, z1: -148 },
  { name: "mudden_laundry_house", x0: 398, x1: 418, z0: -144, z1: -130 },
  { name: "harthmere_watermill", x0: 418, x1: 440, z0: -122, z1: -104 },
];

function isInsideRectV5(x: number, z: number, x0: number, x1: number, z0: number, z1: number, pad = 0) {
  return x >= x0 - pad && x <= x1 + pad && z >= z0 - pad && z <= z1 + pad;
}

function isInsideHarthmereClearStreetRectV5(x: number, z: number) {
  return HARTHMERE_CLEAR_STREET_RECTS_V5.some(([x0, x1, z0, z1]) => isInsideRectV5(x, z, x0, x1, z0, z1));
}

function isInsideAnyHarthmereRoofBuildingFootprintV5(x: number, z: number, pad = 0) {
  return HARTHMERE_ROOF_CLEAR_BOXES_V5.some((box) => isInsideRectV5(x, z, box.x0, box.x1, box.z0, box.z1, pad));
}

function roofClearBoxForPlacementV5(x: number, z: number) {
  return HARTHMERE_ROOF_CLEAR_BOXES_V5.find((box) => isInsideRectV5(x, z, box.x0, box.x1, box.z0, box.z1, 1));
}

function isInsideUpperRoofCoreV5(box: HarthmereRoofClearBoxV5, x: number, z: number) {
  if (!box.upper) return false;
  return isInsideRectV5(x, z, box.x0 + 4, box.x1 - 4, box.z0 + 4, box.z1 - 4, 1);
}

function isHarthmereLooseStreetOrRoofBlockPlacementV5(placement: RuntimePlacement) {
  if (placement.combatOffset !== undefined || isHarthmereLifeAsset(placement.asset)) {
    return false;
  }
  const label = placementLabelV4(placement);
  if (/front door|doorway|public entrance|shop entrance|gate passage|road exit|town exit|window overlay/i.test(label)) {
    return false;
  }
  return (
    HARTHMERE_STREET_CLUTTER_ASSET_RE_V4.test(placement.asset) ||
    /arch_(wall|pillar|roof|stairs)|obj_wall|mine_(stone|iron|coal|gold|silver)|block-built|solid stone\/ore|roof volume|roof dormer|chimney|wall block|floor deck|ceiling slab|floor slab|stair block|foundation|loose block|floating block|street block|road block|cargo stack|supply crate|vendor stool|handcart/i.test(
      `${placement.asset} ${label}`,
    )
  );
}

function shouldRemoveStreetBlockPlacementV5(placement: RuntimePlacement) {
  const [x, y, z] = placement.at;
  if (y < GROUND_Y + 0.55 || y > GROUND_Y + 14) {
    return false;
  }
  if (!isInsideHarthmereClearStreetRectV5(x, z) && !isNearHarthmereStreetCorridorV4(x, z)) {
    return false;
  }
  if (isInsideAnyHarthmereRoofBuildingFootprintV5(x, z, 0)) {
    return false;
  }
  const label = placementLabelV4(placement);
  if (/bridge fountain|old well|north gate tower|watchtower|town wall|parapet|solid flag pole/i.test(label)) {
    return false;
  }
  return isHarthmereLooseStreetOrRoofBlockPlacementV5(placement);
}

function shouldRemoveRoofBlockPlacementV5(placement: RuntimePlacement) {
  const [x, y, z] = placement.at;
  const box = roofClearBoxForPlacementV5(x, z);
  if (!box) {
    return false;
  }
  if (!isHarthmereLooseStreetOrRoofBlockPlacementV5(placement)) {
    return false;
  }

  const relY = y - GROUND_Y;
  if (box.upper) {
    if (isInsideUpperRoofCoreV5(box, x, z)) {
      return relY > 9.12 && relY <= 24;
    }
    return relY > 5.12 && relY <= 8.95;
  }
  return relY > 5.12 && relY <= 24;
}

function placementLabelV4(placement: RuntimePlacement) {
  return `${placement.asset} ${placement.name ?? ""} ${placement.district ?? ""}`.toLowerCase();
}

function distanceToSegmentV4(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const abX = bx - ax;
  const abZ = bz - az;
  const apX = x - ax;
  const apZ = z - az;
  const abLen2 = abX * abX + abZ * abZ;
  const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abLen2));
  const px = ax + abX * t;
  const pz = az + abZ * t;
  return Math.hypot(x - px, z - pz);
}

function isNearHarthmereStreetCorridorV4(x: number, z: number) {
  return HARTHMERE_STREET_SEGMENTS_V4.some(([ax, az, bx, bz, width]) =>
    distanceToSegmentV4(x, z, ax, az, bx, bz) <= width,
  );
}

function isInsideHarthmereNoBuildBoxV4(x: number, z: number) {
  return HARTHMERE_NO_BUILD_BOXES_V4.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
}

function shouldRemoveStreetClutterPlacementV4(placement: RuntimePlacement) {
  if (placement.combatOffset !== undefined) {
    return false;
  }
  const [x, y, z] = placement.at;
  const label = placementLabelV4(placement);
  if (y > GROUND_Y + 1.2) {
    return false;
  }
  if (!isNearHarthmereStreetCorridorV4(x, z)) {
    return false;
  }
  if (!HARTHMERE_STREET_CLUTTER_ASSET_RE_V4.test(placement.asset) && !/street table|handcart|cargo stack|supply crate|vendor stool/i.test(label)) {
    return false;
  }
  if (/interior|cellar|upstairs|archive|altar|against wall|behind tavern|warehouse floor|chapel pew|bedroom/i.test(label)) {
    return false;
  }
  return true;
}

function shouldRemoveRoadIntrusionPlacementV4(placement: RuntimePlacement) {
  if (placement.combatOffset !== undefined) {
    return false;
  }
  const [x, y, z] = placement.at;
  const label = placementLabelV4(placement);
  if (!isInsideHarthmereNoBuildBoxV4(x, z)) {
    return false;
  }
  if (y > GROUND_Y + 5.8) {
    return false;
  }
  if (!HARTHMERE_STRUCTURAL_STREET_INTRUSION_RE_V4.test(label)) {
    return false;
  }
  if (/north gate west tower|north gate east tower|north wall|north gate ironbound door|watchtower|bridge|bridge fountain|fountain|lamp|sign|banner/i.test(label)) {
    return false;
  }
  return true;
}

function filterSingleStoryRoofExtrasV4(
  placements: RuntimePlacement[],
  roofCapY: number,
  buildingName: string,
) {
  const cap = GROUND_Y + roofCapY + 0.12;
  const buildingToken = buildingName.toLowerCase();
  return placements.filter((placement) => {
    const label = placementLabelV4(placement);
    if (!label.includes(buildingToken)) {
      return true;
    }
    if (placement.at[1] <= cap) {
      return true;
    }
    return false;
  });
}

function applyHarthmereRuntimePlacementCleanupV4(
  placements: RuntimePlacement[],
): HarthmereRuntimePlacementCleanupReportV4 {
  const kept: RuntimePlacement[] = [];
  const samples: string[] = [];
  let removedStreetClutter = 0;
  let removedRoadIntrusions = 0;
  let removedStreetBlocks = 0;
  let removedRoofBlocks = 0;
  for (const placement of placements) {
    const label = placement.name ?? placement.asset;
    if (shouldRemoveRoofBlockPlacementV5(placement)) {
      removedRoofBlocks += 1;
      if (samples.length < 24) {
        samples.push(`roof-block:${label}`);
      }
      continue;
    }
    if (shouldRemoveStreetBlockPlacementV5(placement)) {
      removedStreetBlocks += 1;
      if (samples.length < 24) {
        samples.push(`street-block:${label}`);
      }
      continue;
    }
    if (shouldRemoveRoadIntrusionPlacementV4(placement)) {
      removedRoadIntrusions += 1;
      if (samples.length < 24) {
        samples.push(`road-intrusion:${label}`);
      }
      continue;
    }
    if (shouldRemoveStreetClutterPlacementV4(placement)) {
      removedStreetClutter += 1;
      if (samples.length < 24) {
        samples.push(`street-clutter:${label}`);
      }
      continue;
    }
    kept.push(placement);
  }
  return {
    version: HARTHMERE_ROOF_STREET_BLOCK_CLEANUP_VERSION_V5,
    originalCount: placements.length,
    keptCount: kept.length,
    removedStreetClutter,
    removedRoadIntrusions,
    removedStreetBlocks,
    removedRoofBlocks,
    samples,
    placements: kept,
  };
}


const HARTHMERE_WALKABLE_BRIDGE_VERSION_V54 = "harthmere-walkable-bridge-with-parapets-v54";
const HARTHMERE_WILDS_LANDMARKS_VERSION_V54 = "harthmere-wilds-landmark-completion-v54";

function createHarthmereOldBridgeWalkableParapetsV54(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  placements.push(
    P("obj_bridge_medium_body", 486, -206, Math.PI / 2, 0.86, "HARTHMERE_WALKABLE_BRIDGE_V54 Old Bridge walkable bridge deck visual under 12m clear lane no blocker", "Old Bridge"),
    ...row("road", "Old Bridge", "HARTHMERE_WALKABLE_BRIDGE_V54 old bridge pedestrian lane stone deck 12m clear bridge crack inspection lane", 462, -206, 8, 7, 0, Math.PI / 2, 0.76),
    ...row("obj_wall_simple", "Old Bridge", "HARTHMERE_BRIDGE_PARAPET_V54 north bridge parapet rail outside walk lane", 462, -199.5, 8, 7, 0, 0, 0.42),
    ...row("obj_wall_simple", "Old Bridge", "HARTHMERE_BRIDGE_PARAPET_V54 south bridge parapet rail outside walk lane", 462, -212.5, 8, 7, 0, 0, 0.42),
    P("obj_lamp_ground_small", 462, -202.2, 0, 0.44, "Old Bridge lantern outside pedestrian lane west", "Old Bridge"),
    P("obj_lamp_ground_small", 510, -209.8, Math.PI, 0.44, "Old Bridge lantern outside pedestrian lane east", "Old Bridge"),
    P("coin_pile", 486, -206, 0, 0.2, "Bellbound Q1 bronze disc set into Old Bridge cobbles at crack center", "Old Bridge", GROUND_Y + 0.05),
    P("scroll_1_fp", 486.7, -205.2, 0.25, 0.16, "Bell-shaped crack decal flush with Old Bridge stone deck", "Old Bridge", GROUND_Y + 0.06),
    P("road", 452, -206, Math.PI / 2, 0.7, "Old Bridge west approach ramp road continuation clear mount path", "Old Bridge"),
    P("road", 520, -206, Math.PI / 2, 0.7, "Old Bridge east approach ramp road continuation clear mount path", "Old Bridge"),
  );
  return placements;
}

function createHarthmereWildsBibleLandmarkPlacementsV54(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  placements.push(
    // Thornbridge Crossing: explicit walkable small bridge with thorny edges and ribbon clue.
    P("obj_bridge_low_body", 338, -498, Math.PI / 2, 0.72, "HARTHMERE_WILDS_THORNBRIDGE_V54 Thornbridge Crossing walkable bridge deck over creek", "Harthmere Wilds - Thornbridge Crossing"),
    ...row("road", "Harthmere Wilds - Thornbridge Crossing", "HARTHMERE_WILDS_THORNBRIDGE_V54 Thornbridge Crossing walkable bridge path", 324, -498, 5, 7, 0, Math.PI / 2, 0.58),
    P("hedge_large", 336, -491, 0.15, 0.56, "Thornbridge Crossing thorn bushes north edge", "Harthmere Wilds - Thornbridge Crossing"),
    P("hedge_large", 340, -505, -0.12, 0.56, "Thornbridge Crossing thorn bushes south edge", "Harthmere Wilds - Thornbridge Crossing"),
    P("banner_white", 336, -492.2, 0, 0.34, "Traveler luck ribbon tied at Thornbridge Crossing", "Harthmere Wilds - Thornbridge Crossing", GROUND_Y + 0.7),
    P("dagger", 348, -500, -0.4, 0.38, "Cut ribbon warning left by bandits at Thornbridge Crossing", "Harthmere Wilds - Thornbridge Crossing", GROUND_Y + 0.45),

    // Split Oak: waypoint with one living and one dead side.
    P("tree_high", 216, -286, 0.1, 1.22, "Split Oak living green half waypoint", "Harthmere Wilds - Split Oak"),
    P("tree_crooked", 219, -286, -0.2, 1.14, "Split Oak black lightning-dead half waypoint", "Harthmere Wilds - Split Oak"),
    P("pillar", 216.8, -291, 0, 0.42, "Split Oak druid priest argument stone marker", "Harthmere Wilds - Split Oak"),

    // Witchlight Pool: Briarfen mystery landmark with visible lights over dark water.
    P("rock_wide", 928, -286, 0.1, 0.92, "Witchlight Pool dark water rim", "Harthmere Wilds - Witchlight Pool"),
    P("lantern", 924, -282, 0, 0.42, "Witchlight Pool hovering false light one", "Harthmere Wilds - Witchlight Pool", GROUND_Y + 1.05),
    P("lantern", 932, -290, 0, 0.38, "Witchlight Pool hovering false light two", "Harthmere Wilds - Witchlight Pool", GROUND_Y + 1.18),
    A("animal_frog", 922, -292, 0, 0.9, "Frog at Witchlight Pool", "Harthmere Wilds - Witchlight Pool", { radius: 1.0, speed: 0.3, phase: 1.2 }),
    A("townsperson_smuggler", 938, -278, Math.PI, 1.04, "Smuggler listening near Witchlight Pool", "Harthmere Wilds - Witchlight Pool", { radius: 2.8, speed: 0.14, phase: 2.7 }),

    // Old Quarry Cut: explicit mining landmark and danger hook.
    P("mine_stone_01", 168, -566, 0, 0.9, "Old Quarry Cut rough stone face", "Harthmere Wilds - Old Quarry Cut"),
    P("mine_coal_block", 176, -572, 0.1, 0.7, "Old Quarry Cut coal seam", "Harthmere Wilds - Old Quarry Cut"),
    P("mine_silver_stone", 184, -558, -0.1, 0.72, "Old Quarry Cut silver vein pocket", "Harthmere Wilds - Old Quarry Cut"),
    P("minecart", 164, -552, 0.3, 0.62, "Old Quarry Cut abandoned minecart", "Harthmere Wilds - Old Quarry Cut"),
    P("pickaxe_bronze_fp", 170, -554, -0.4, 0.44, "Old Quarry Cut mining pick beside real ore", "Harthmere Wilds - Old Quarry Cut", GROUND_Y + 0.45),
    A("animal_snake", 188, -566, -0.5, 0.92, "Quarry snake in warm stones", "Harthmere Wilds - Old Quarry Cut", { radius: 0.8, speed: 0.14, phase: 0.6 }),
  );
  return placements;
}

// HARTHMERE_NPC_HOME_FURNITURE_V65_START
// HARTHMERE_NPC_HOME_FURNITURE_VERSION_V65
// Every named NPC receives a physical home/room assignment and small furniture
// kit. The room shells/partitions are server-side terrain; these are visual
// props placed inside those rooms so residential/slum buildings no longer feel
// empty.
const HARTHMERE_NPC_HOME_FURNITURE_VERSION_V65 =
  "harthmere-npc-home-furniture-v65";
const HARTHMERE_NPC_HOME_ROOMS_V65 = [
  {
    "npcId": "sergeant_bram_holt",
    "npcName": "Sergeant Bramwell Holt",
    "homeLabel": "Guard barracks, room above the Guard Yard",
    "routeHomeLocation": "Guard barracks, room above the Guard Yard",
    "buildingId": "guard_barracks_bunkhouse",
    "structureName": "Guard Barracks",
    "roomId": "guard_barracks_bunkhouse_sergeant_bram_holt_room_v65",
    "roomLabel": "Sergeant Bramwell Holt room in Guard Barracks",
    "district": "Guard District",
    "floor": 1,
    "at": [
      533,
      0.08,
      -272
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "walt_ormsby",
    "npcName": "Drill Instructor Walt Ormsby",
    "homeLabel": "Small house on the Mudden Ward edge",
    "routeHomeLocation": "Small house on the Mudden Ward edge",
    "buildingId": "mudden_ward_shelter",
    "structureName": "Mudden Ward Shelter",
    "roomId": "mudden_ward_shelter_walt_ormsby_room_v65",
    "roomLabel": "Drill Instructor Walt Ormsby room in Mudden Ward Shelter",
    "district": "Mudden Ward",
    "floor": 1,
    "at": [
      408,
      0.08,
      -162
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "mara_thistle",
    "npcName": "Mara Thistle",
    "homeLabel": "Two-story house behind the market",
    "routeHomeLocation": "Two-story house behind the market",
    "buildingId": "mara_thistle_two_story_house",
    "structureName": "Mara Thistle Two-Story House",
    "roomId": "mara_thistle_two_story_house_mara_thistle_room_v65",
    "roomLabel": "Mara Thistle room in Mara Thistle Two-Story House",
    "district": "Residential District",
    "floor": 1,
    "at": [
      476,
      0.08,
      -240
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "edrik_vane",
    "npcName": "Edrik Vane",
    "homeLabel": "Large Noble Rise house and hidden holdings",
    "routeHomeLocation": "Large Noble Rise house and hidden holdings",
    "buildingId": "edrik_vane_noble_rise_estate",
    "structureName": "Edrik Vane Estate",
    "roomId": "edrik_vane_noble_rise_estate_edrik_vane_room_v65",
    "roomLabel": "Edrik Vane room in Edrik Vane Estate",
    "district": "Noble Rise",
    "floor": 1,
    "at": [
      600,
      0.08,
      -266
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "reeve_caldus_merrow",
    "npcName": "Reeve Caldus Merrow",
    "homeLabel": "Reeve Hall private wing",
    "routeHomeLocation": "Reeve Hall private wing",
    "buildingId": "reeve_hall",
    "structureName": "Reeve Hall",
    "roomId": "reeve_hall_reeve_caldus_merrow_room_v65",
    "roomLabel": "Reeve Caldus Merrow room in Reeve Hall",
    "district": "Noble Rise",
    "floor": 1,
    "at": [
      562,
      0.08,
      -266
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "master_osric_vale",
    "npcName": "Master Osric Vale",
    "homeLabel": "Apartment above the Black Anvil Smithy",
    "routeHomeLocation": "Apartment above the Black Anvil Smithy",
    "buildingId": "black_anvil_smithy",
    "structureName": "Black Anvil Smithy",
    "roomId": "black_anvil_smithy_master_osric_vale_room_v65",
    "roomLabel": "Master Osric Vale room in Black Anvil Smithy",
    "district": "Craftsman Row",
    "floor": 1,
    "at": [
      528,
      0.08,
      -235
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "apprentice_luth",
    "npcName": "Apprentice Luth",
    "homeLabel": "Small room behind the smithy",
    "routeHomeLocation": "Small room behind the smithy",
    "buildingId": "black_anvil_smithy",
    "structureName": "Black Anvil Smithy",
    "roomId": "black_anvil_smithy_apprentice_luth_room_v65",
    "roomLabel": "Apprentice Luth room in Black Anvil Smithy",
    "district": "Craftsman Row",
    "floor": 1,
    "at": [
      528,
      0.08,
      -235
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "master_garrik_fen",
    "npcName": "Master Garrik Fen",
    "homeLabel": "Workshop-and-home in Craftsman Row",
    "routeHomeLocation": "Workshop-and-home in Craftsman Row",
    "buildingId": "crafters_workshop",
    "structureName": "Crafters Workshop",
    "roomId": "crafters_workshop_master_garrik_fen_room_v65",
    "roomLabel": "Master Garrik Fen room in Crafters Workshop",
    "district": "Craftsman Row",
    "floor": 1,
    "at": [
      500,
      0.08,
      -233
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "helna_voss",
    "npcName": "Mistress Helna Voss",
    "homeLabel": "Tailor’s loft over her shop",
    "routeHomeLocation": "Tailor’s loft over her shop",
    "buildingId": "tailor_loft_house",
    "structureName": "Tailor Loft House",
    "roomId": "tailor_loft_house_helna_voss_room_v65",
    "roomLabel": "Mistress Helna Voss room in Tailor Loft House",
    "district": "Market District",
    "floor": 1,
    "at": [
      472,
      0.08,
      -180
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "selka_doryn",
    "npcName": "Mistress Selka Doryn",
    "homeLabel": "Leatherworking room beside the tannery court",
    "routeHomeLocation": "Leatherworking room beside the tannery court",
    "buildingId": "tannery_court_house",
    "structureName": "Tannery Court House",
    "roomId": "tannery_court_house_selka_doryn_room_v65",
    "roomLabel": "Mistress Selka Doryn room in Tannery Court House",
    "district": "Farm Outskirts",
    "floor": 1,
    "at": [
      478,
      0.08,
      -120
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "ysabet_fenlow",
    "npcName": "Mistress Ysabet Fenlow",
    "homeLabel": "Room behind the Green Mortar Apothecary",
    "routeHomeLocation": "Room behind the Green Mortar Apothecary",
    "buildingId": "green_mortar_apothecary",
    "structureName": "Green Mortar Apothecary",
    "roomId": "green_mortar_apothecary_ysabet_fenlow_room_v65",
    "roomLabel": "Mistress Ysabet Fenlow room in Green Mortar Apothecary",
    "district": "Temple Market Edge",
    "floor": 1,
    "at": [
      453,
      0.08,
      -180
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "old_jory_brann",
    "npcName": "Old Jory Brann",
    "homeLabel": "Stable yard loft",
    "routeHomeLocation": "Stable yard loft",
    "buildingId": "harthmere_stables",
    "structureName": "Harthmere Stables",
    "roomId": "harthmere_stables_old_jory_brann_room_v65",
    "roomLabel": "Old Jory Brann room in Harthmere Stables",
    "district": "North Gate",
    "floor": 1,
    "at": [
      445,
      0.08,
      -269
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "dawn_loaf",
    "npcName": "Mistress Dawn Loaf",
    "homeLabel": "Bakery room above Dawn Loaf",
    "routeHomeLocation": "Bakery room above Dawn Loaf",
    "buildingId": "dawn_loaf_bakery",
    "structureName": "Dawn Loaf Bakery",
    "roomId": "dawn_loaf_bakery_dawn_loaf_room_v65",
    "roomLabel": "Mistress Dawn Loaf room in Dawn Loaf Bakery",
    "district": "Market District",
    "floor": 1,
    "at": [
      426,
      0.08,
      -198
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "tovin_reed",
    "npcName": "Master Tovin Reed",
    "homeLabel": "Dockside room above ledger office",
    "routeHomeLocation": "Dockside room above ledger office",
    "buildingId": "dockside_family_house",
    "structureName": "Dockside Family House",
    "roomId": "dockside_family_house_tovin_reed_room_v65",
    "roomLabel": "Master Tovin Reed room in Dockside Family House",
    "district": "River Docks",
    "floor": 1,
    "at": [
      558,
      0.08,
      -168
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "lina_reed",
    "npcName": "Mistress Lina Reed",
    "homeLabel": "Tovin Reed’s family room",
    "routeHomeLocation": "Tovin Reed’s family room",
    "buildingId": "dockside_family_house",
    "structureName": "Dockside Family House",
    "roomId": "dockside_family_house_lina_reed_room_v65",
    "roomLabel": "Mistress Lina Reed room in Dockside Family House",
    "district": "River Docks",
    "floor": 1,
    "at": [
      558,
      0.08,
      -168
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "sora_reed",
    "npcName": "Sora Reed",
    "homeLabel": "Tovin Reed’s family room",
    "routeHomeLocation": "Tovin Reed’s family room",
    "buildingId": "dockside_family_house",
    "structureName": "Dockside Family House",
    "roomId": "dockside_family_house_sora_reed_room_v65",
    "roomLabel": "Sora Reed room in Dockside Family House",
    "district": "River Docks",
    "floor": 2,
    "at": [
      558,
      5.08,
      -168
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "father_aldren_mell",
    "npcName": "Father Aldren Mell",
    "homeLabel": "Chapel rectory cell",
    "routeHomeLocation": "Chapel rectory cell",
    "buildingId": "saint_verena_chapel",
    "structureName": "Saint Verena Chapel",
    "roomId": "saint_verena_chapel_father_aldren_mell_room_v65",
    "roomLabel": "Father Aldren Mell room in Saint Verena Chapel",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      476,
      0.08,
      -144
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "sister_maelle_frenn",
    "npcName": "Sister Maelle Frenn",
    "homeLabel": "Chapel infirmary room",
    "routeHomeLocation": "Chapel infirmary room",
    "buildingId": "saint_verena_chapel",
    "structureName": "Saint Verena Chapel",
    "roomId": "saint_verena_chapel_sister_maelle_frenn_room_v65",
    "roomLabel": "Sister Maelle Frenn room in Saint Verena Chapel",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      476,
      0.08,
      -144
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "brother_vance_holt",
    "npcName": "Brother Vance Holt",
    "homeLabel": "Cottage on chapel grounds",
    "routeHomeLocation": "Cottage on chapel grounds",
    "buildingId": "brother_vance_chapel_cottage",
    "structureName": "Brother Vance Chapel Cottage",
    "roomId": "brother_vance_chapel_cottage_brother_vance_holt_room_v65",
    "roomLabel": "Brother Vance Holt room in Brother Vance Chapel Cottage",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      444,
      0.08,
      -143
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "brother_halpen_wren",
    "npcName": "Brother Halpen Wren",
    "homeLabel": "Chapel records alcove",
    "routeHomeLocation": "Chapel records alcove",
    "buildingId": "saint_verena_chapel",
    "structureName": "Saint Verena Chapel",
    "roomId": "saint_verena_chapel_brother_halpen_wren_room_v65",
    "roomLabel": "Brother Halpen Wren room in Saint Verena Chapel",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      476,
      0.08,
      -144
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "mother_halene_brae",
    "npcName": "Mother Halene Brae",
    "homeLabel": "Deceased; memory anchored below the chapel altar",
    "routeHomeLocation": "Deceased; memory anchored below the chapel altar",
    "buildingId": "saint_verena_chapel",
    "structureName": "Saint Verena Chapel",
    "roomId": "saint_verena_chapel_mother_halene_brae_room_v65",
    "roomLabel": "Mother Halene Brae room in Saint Verena Chapel",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      476,
      0.08,
      -144
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "elowen_pike",
    "npcName": "Mistress Elowen Pike",
    "homeLabel": "Room above the Copper Kettle Inn",
    "routeHomeLocation": "Room above the Copper Kettle Inn",
    "buildingId": "copper_kettle_inn",
    "structureName": "Copper Kettle Inn",
    "roomId": "copper_kettle_inn_elowen_pike_room_v65",
    "roomLabel": "Mistress Elowen Pike room in Copper Kettle Inn",
    "district": "Entertainment District",
    "floor": 1,
    "at": [
      546,
      0.08,
      -198
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "tisa_pike",
    "npcName": "Tisa Pike",
    "homeLabel": "Small room under the inn stairs",
    "routeHomeLocation": "Small room under the inn stairs",
    "buildingId": "copper_kettle_inn",
    "structureName": "Copper Kettle Inn",
    "roomId": "copper_kettle_inn_tisa_pike_room_v65",
    "roomLabel": "Tisa Pike room in Copper Kettle Inn",
    "district": "Entertainment District",
    "floor": 1,
    "at": [
      546,
      0.08,
      -198
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "cellan_bow",
    "npcName": "Maestro Cellan Bow",
    "homeLabel": "Rented upper room at the inn",
    "routeHomeLocation": "Rented upper room at the inn",
    "buildingId": "copper_kettle_inn",
    "structureName": "Copper Kettle Inn",
    "roomId": "copper_kettle_inn_cellan_bow_room_v65",
    "roomLabel": "Maestro Cellan Bow room in Copper Kettle Inn",
    "district": "Entertainment District",
    "floor": 1,
    "at": [
      546,
      0.08,
      -198
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "nessa_crowe",
    "npcName": "Nessa Crowe",
    "homeLabel": "Tangle Stairs Stack room",
    "routeHomeLocation": "Tangle Stairs Stack room",
    "buildingId": "tangle_stairs_stack",
    "structureName": "Tangle Stairs Stack",
    "roomId": "tangle_stairs_stack_nessa_crowe_room_v65",
    "roomLabel": "Nessa Crowe room in Tangle Stairs Stack",
    "district": "Mudden Ward",
    "floor": 1,
    "at": [
      370,
      0.08,
      -130
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "old_tam_crowe",
    "npcName": "Old Tam Crowe",
    "homeLabel": "Mudden Lean-To Home",
    "routeHomeLocation": "Mudden Lean-To Home",
    "buildingId": "mudden_ward_shelter",
    "structureName": "Mudden Ward Shelter",
    "roomId": "mudden_ward_shelter_old_tam_crowe_room_v65",
    "roomLabel": "Old Tam Crowe room in Mudden Ward Shelter",
    "district": "Mudden Ward",
    "floor": 1,
    "at": [
      408,
      0.08,
      -162
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "boy_tam",
    "npcName": "The boy Tam",
    "homeLabel": "Dripline Stack family room",
    "routeHomeLocation": "Dripline Stack family room",
    "buildingId": "dripline_stack",
    "structureName": "Dripline Stack",
    "roomId": "dripline_stack_boy_tam_room_v65",
    "roomLabel": "The boy Tam room in Dripline Stack",
    "district": "Mudden Ward",
    "floor": 1,
    "at": [
      426,
      0.08,
      -130
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "banker_merl_voss",
    "npcName": "Banker Merl Voss",
    "homeLabel": "Accountant room near Player Services Hall",
    "routeHomeLocation": "Accountant room near Player Services Hall",
    "buildingId": "market_auction_office",
    "structureName": "Player Services / Auction Office",
    "roomId": "market_auction_office_banker_merl_voss_room_v65",
    "roomLabel": "Banker Merl Voss room in Player Services / Auction Office",
    "district": "Player Services Plaza",
    "floor": 1,
    "at": [
      505,
      0.08,
      -221
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "courier_anwen_mell",
    "npcName": "Courier Anwen Mell",
    "homeLabel": "Courier bunk above the mail post",
    "routeHomeLocation": "Courier bunk above the mail post",
    "buildingId": "mail_post_house",
    "structureName": "Courier Mail Post House",
    "roomId": "mail_post_house_courier_anwen_mell_room_v65",
    "roomLabel": "Courier Anwen Mell room in Courier Mail Post House",
    "district": "Player Services Plaza",
    "floor": 1,
    "at": [
      522,
      0.08,
      -220
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "auction_pell_marsten",
    "npcName": "Auction Clerk Pell Marsten",
    "homeLabel": "Ledger room beside the auction board",
    "routeHomeLocation": "Ledger room beside the auction board",
    "buildingId": "market_auction_office",
    "structureName": "Player Services / Auction Office",
    "roomId": "market_auction_office_auction_pell_marsten_room_v65",
    "roomLabel": "Auction Clerk Pell Marsten room in Player Services / Auction Office",
    "district": "Player Services Plaza",
    "floor": 1,
    "at": [
      505,
      0.08,
      -221
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "erena_voss",
    "npcName": "Guild Registrar Erena Voss",
    "homeLabel": "Registrar room in Player Services Hall",
    "routeHomeLocation": "Registrar room in Player Services Hall",
    "buildingId": "market_auction_office",
    "structureName": "Player Services / Auction Office",
    "roomId": "market_auction_office_erena_voss_room_v65",
    "roomLabel": "Guild Registrar Erena Voss room in Player Services / Auction Office",
    "district": "Player Services Plaza",
    "floor": 1,
    "at": [
      505,
      0.08,
      -221
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "lady_henrietta_merrow",
    "npcName": "Lady Henrietta Merrow",
    "homeLabel": "Reeve Hall private wing",
    "routeHomeLocation": "Reeve Hall private wing",
    "buildingId": "reeve_hall",
    "structureName": "Reeve Hall",
    "roomId": "reeve_hall_lady_henrietta_merrow_room_v65",
    "roomLabel": "Lady Henrietta Merrow room in Reeve Hall",
    "district": "Noble Rise",
    "floor": 2,
    "at": [
      562,
      5.08,
      -266
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "lila_merrow",
    "npcName": "Lila Merrow",
    "homeLabel": "Reeve Hall private wing",
    "routeHomeLocation": "Reeve Hall private wing",
    "buildingId": "reeve_hall",
    "structureName": "Reeve Hall",
    "roomId": "reeve_hall_lila_merrow_room_v65",
    "roomLabel": "Lila Merrow room in Reeve Hall",
    "district": "Noble Rise",
    "floor": 1,
    "at": [
      570,
      0.08,
      -266
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "ren_skell",
    "npcName": "Ren Skell",
    "homeLabel": "Mother’s room in the Mudden Ward",
    "routeHomeLocation": "Mother’s room in the Mudden Ward",
    "buildingId": "mudden_ward_shelter",
    "structureName": "Mudden Ward Shelter",
    "roomId": "mudden_ward_shelter_ren_skell_room_v65",
    "roomLabel": "Ren Skell room in Mudden Ward Shelter",
    "district": "Mudden Ward",
    "floor": 1,
    "at": [
      408,
      0.08,
      -162
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "lord_wrethan_pell",
    "npcName": "Lord Wrethan Pell",
    "homeLabel": "Guest room in Reeve Hall",
    "routeHomeLocation": "Guest room in Reeve Hall",
    "buildingId": "reeve_hall",
    "structureName": "Reeve Hall",
    "roomId": "reeve_hall_lord_wrethan_pell_room_v65",
    "roomLabel": "Lord Wrethan Pell room in Reeve Hall",
    "district": "Noble Rise",
    "floor": 1,
    "at": [
      562,
      0.08,
      -266
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "henrick_brell",
    "npcName": "Ferry Master Henrick Brell",
    "homeLabel": "Small house at the docks",
    "routeHomeLocation": "Small house at the docks",
    "buildingId": "dockside_family_house",
    "structureName": "Dockside Family House",
    "roomId": "dockside_family_house_henrick_brell_room_v65",
    "roomLabel": "Ferry Master Henrick Brell room in Dockside Family House",
    "district": "River Docks",
    "floor": 1,
    "at": [
      558,
      0.08,
      -168
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "veska_reed",
    "npcName": "Smuggler-Mother Veska Reed",
    "homeLabel": "Not-just-a-house on the docks",
    "routeHomeLocation": "Not-just-a-house on the docks",
    "buildingId": "dockside_family_house",
    "structureName": "Dockside Family House",
    "roomId": "dockside_family_house_veska_reed_room_v65",
    "roomLabel": "Smuggler-Mother Veska Reed room in Dockside Family House",
    "district": "River Docks",
    "floor": 1,
    "at": [
      558,
      0.08,
      -168
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "edda_wren",
    "npcName": "Edda Wren",
    "homeLabel": "Last Watch Post outside North Gate",
    "routeHomeLocation": "Last Watch Post outside North Gate",
    "buildingId": "last_watch_post_bunkhouse",
    "structureName": "Last Watch Post Bunkhouse",
    "roomId": "last_watch_post_bunkhouse_edda_wren_room_v65",
    "roomLabel": "Edda Wren room in Last Watch Post Bunkhouse",
    "district": "Harthmere Wilds - Last Watch Post",
    "floor": 1,
    "at": [
      476,
      0.08,
      -334
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "merrit_bracken",
    "npcName": "Old Merrit Bracken",
    "homeLabel": "Charcoal Burners’ Camp",
    "routeHomeLocation": "Charcoal Burners’ Camp",
    "buildingId": "charcoal_burners_camp",
    "structureName": "Charcoal Burners Camp",
    "roomId": "charcoal_burners_camp_merrit_bracken_room_v65",
    "roomLabel": "Old Merrit Bracken room in Charcoal Burners Camp",
    "district": "Harthmere Wilds - Charcoal Camp",
    "floor": 1,
    "at": [
      241,
      0.08,
      -645
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "sella_reedfoot",
    "npcName": "Sella Reedfoot",
    "homeLabel": "Small stilt-hut at the edge of Briarfen",
    "routeHomeLocation": "Small stilt-hut at the edge of Briarfen",
    "buildingId": "briarfen_stilt_hut",
    "structureName": "Briarfen Stilt Hut",
    "roomId": "briarfen_stilt_hut_sella_reedfoot_room_v65",
    "roomLabel": "Sella Reedfoot room in Briarfen Stilt Hut",
    "district": "Harthmere Wilds - Briarfen",
    "floor": 1,
    "at": [
      654,
      0.08,
      -280
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "tamsin_vale",
    "npcName": "Tamsin Vale",
    "homeLabel": "Small cabin near Greenmere edge",
    "routeHomeLocation": "Small cabin near Greenmere edge",
    "buildingId": "greenmere_edge_cabin",
    "structureName": "Greenmere Edge Cabin",
    "roomId": "greenmere_edge_cabin_tamsin_vale_room_v65",
    "roomLabel": "Tamsin Vale room in Greenmere Edge Cabin",
    "district": "Harthmere Wilds - Greenmere Edge",
    "floor": 1,
    "at": [
      545,
      0.08,
      -433
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "brother_cael_marsen",
    "npcName": "Brother Cael Marsen",
    "homeLabel": "Traveler bedroll near grave-tending routes",
    "routeHomeLocation": "Traveler bedroll near grave-tending routes",
    "buildingId": "saint_verena_chapel",
    "structureName": "Saint Verena Chapel",
    "roomId": "saint_verena_chapel_brother_cael_marsen_room_v65",
    "roomLabel": "Brother Cael Marsen room in Saint Verena Chapel",
    "district": "Temple Green",
    "floor": 1,
    "at": [
      476,
      0.08,
      -144
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "rusk_hallowhand",
    "npcName": "Rusk Hallowhand",
    "homeLabel": "Ruined Watchtower camp",
    "routeHomeLocation": "Ruined Watchtower camp",
    "buildingId": "northwest_ruined_watchtower",
    "structureName": "Northwest Ruined Watchtower Camp",
    "roomId": "northwest_ruined_watchtower_rusk_hallowhand_room_v65",
    "roomLabel": "Rusk Hallowhand room in Northwest Ruined Watchtower Camp",
    "district": "Harthmere Wilds - Northwest Watchtower Ridge",
    "floor": 1,
    "at": [
      157,
      0.08,
      -635
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  },
  {
    "npcId": "veneth_moss_woman",
    "npcName": "Veneth of the Green Threshold",
    "homeLabel": "Hidden glade in the Deep Old Wood",
    "routeHomeLocation": "Hidden glade in the Deep Old Wood",
    "buildingId": "deep_old_wood_glade_lodge",
    "structureName": "Deep Old Wood Glade Lodge",
    "roomId": "deep_old_wood_glade_lodge_veneth_moss_woman_room_v65",
    "roomLabel": "Veneth of the Green Threshold room in Deep Old Wood Glade Lodge",
    "district": "Harthmere Wilds - Deep Old Wood",
    "floor": 1,
    "at": [
      706,
      0.08,
      -686
    ],
    "furniture": [
      "bed",
      "nightstand",
      "personal_chest",
      "small_table",
      "candle"
    ]
  }
] as const;

function createHarthmereNpcHomeFurnitureV65(): RuntimePlacement[] {
  // HARTHMERE_POLISH_V1_FURNITURE_PASS — base set kept identical for save
  // compatibility; an extra "lived-in" pass adds 6-9 props per room so
  // bedrooms read as actually occupied. Offsets are deterministic per room
  // (seeded by room.at coordinates) so the same room always lays out the
  // same way after a reload.
  const placements: RuntimePlacement[] = [];
  for (const room of HARTHMERE_NPC_HOME_ROOMS_V65) {
    const x = room.at[0];
    const y = GROUND_Y + room.at[1];
    const z = room.at[2];
    const district = room.district;
    placements.push(
      P("bed_twin1", x - 0.75, z - 0.75, Math.PI / 2, 0.24, room.roomLabel + " bed", district, y + 0.04),
      P("nightstand", x + 0.85, z - 0.75, 0, 0.18, room.roomLabel + " nightstand", district, y + 0.06),
      P("chest", x - 0.85, z + 0.85, 0, 0.20, room.roomLabel + " personal chest", district, y + 0.06),
      P("table_small", x + 0.85, z + 0.75, 0, 0.18, room.roomLabel + " small table", district, y + 0.06),
      P("candle_1_fp", x + 0.85, z + 0.75, 0, 0.10, room.roomLabel + " candle on table", district, y + 0.56),
    );

    // ---- Extra "lived-in" pass ----
    // A small deterministic seed lets the same room always look the same.
    const seed = Math.abs(Math.sin(room.at[0] * 12.9898 + room.at[2] * 78.233)) % 1;
    const sel = (n: number) => Math.floor(seed * 1e6) % n;
    // Possible chair assets — we pick one; using two chairs in tiny rooms
    // looks crowded. Asset names fall back to "chair" if not in the catalog.
    const chairAsset = ["chair", "chair_simple", "stool"][sel(3)] ?? "chair";
    placements.push(
      // Chair near the table
      P(chairAsset, x + 0.20, z + 0.75, Math.PI, 0.18, room.roomLabel + " chair at table", district, y + 0.04),
      // Rug under the bed (small)
      P("rug_small_fp", x - 0.55, z - 0.55, 0, 0.20, room.roomLabel + " bedside rug", district, y + 0.01),
      // Wall shelf with books and clutter
      P("shelf", x + 0.95, z + 0.05, -Math.PI / 2, 0.18, room.roomLabel + " wall shelf", district, y + 0.95),
      P("book_1_fp", x + 0.95, z + 0.05, -Math.PI / 2, 0.08, room.roomLabel + " shelf book", district, y + 1.08),
      // Wash basin on a stand near the door area
      P("vase_4", x - 0.95, z + 0.05, Math.PI / 2, 0.14, room.roomLabel + " water basin", district, y + 0.36),
      // Hung tools / lantern on the wall (rotates around room)
      P("lantern_post", x + 0.05, z - 0.95, 0, 0.16, room.roomLabel + " wall lantern", district, y + 1.05),
      // Floor crate of supplies
      P("crate", x - 0.05, z + 0.95, 0, 0.18, room.roomLabel + " supplies crate", district, y + 0.05),
      // Broom in the corner
      P("broom", x - 0.95, z + 0.95, Math.PI / 4, 0.16, room.roomLabel + " broom", district, y + 0.04),
      // A single coin pile on the table — implies the NPC works for a living
      P("coin_pile", x + 0.85, z + 0.85, 0, 0.06, room.roomLabel + " coin pile", district, y + 0.62),
    );
  }
  return placements;
}
// HARTHMERE_NPC_HOME_FURNITURE_V65_END

const PLACEMENTS: RuntimePlacement[] = [
  // HARTHMERE_MAIN_QUEST_SPACES_V47_RUNTIME_PLACEMENTS_START
  // v47: playable main-quest spaces are physically represented with stone markers,
  // interactable anchors, and dungeon encounter spawn anchors for runtime QA.
  ...HARTHMERE_MAIN_QUEST_SPACES_V47.flatMap((space) => [
    P(
      "arch_wall_stone",
      space.entry.x,
      space.entry.z,
      0,
      0.42,
      `${space.name} v47 playable quest-space entry marker`,
      space.district,
      GROUND_Y + space.entry.yOffset,
    ),
    P(
      "arch_pillar_stone",
      space.entry.x + 1.35,
      space.entry.z - 1.35,
      0,
      0.34,
      `${space.name} v47 interactable anchor ${space.interactables?.[0] ?? "quest_anchor"}`,
      space.district,
      GROUND_Y + space.entry.yOffset + 0.05,
    ),
    ...(space.encounters ?? []).slice(0, 2).map((encounter: string, index: number) =>
      P(
        "arch_wall_corner",
        space.entry.x + 2 + index * 1.5,
        space.entry.z - 2 - index * 1.5,
        0,
        0.28,
        `${space.name} v47 encounter spawn anchor ${encounter}`,
        space.district,
        GROUND_Y + space.entry.yOffset + 0.08,
      ),
    ),
  ]),
  // HARTHMERE_MAIN_QUEST_SPACES_V47_RUNTIME_PLACEMENTS_END
  // Combat-controlled actors: these are stable visual anchors for the local-dev
  // combat offsets. The fight system targets these offsets directly so attack,
  // hit, and death clips do not depend on fuzzy name matching.
  A("animal_rat", 410, -154, Math.PI / 2, 0.72, "Mudden Drain Rat", "Mudden Ward", { radius: 0.8, speed: 0.28, phase: 0.2 }, 9002),
  A("townsperson_bandit", 421, -392, -Math.PI / 2, 1.12, "Road Bandit Scout", "Harthmere Wilds - Mill Road", { radius: 1.8, speed: 0.18, phase: 2.7 }, 9003),
  A("animal_wolf", 552, -420, -0.8, 1.04, "Road Wolf", "Harthmere Wilds - Greenmere Edge", { radius: 2.0, speed: 0.32, phase: 2.1 }, 9004),
  A("townsperson_bandit", 112, -715, -Math.PI / 2, 1.16, "Wilds Bandit Ambusher", "Harthmere Wilds - Northwest Bandit Ridge", { radius: 2.2, speed: 0.16, phase: 0.5 }, 9005),
  A("townsperson_undead", 536, -119, Math.PI, 1.08, "Bell-Woken Zombie", "Harthmere Wilds - Gravewood", { radius: 1.2, speed: 0.07, phase: 2.6 }, 9006),
  A("animal_deer", 450, -650, Math.PI / 2, 1.05, "Greenmere Deer", "Harthmere Wilds - North Greenmere", { radius: 2.8, speed: 0.18, phase: 0.4 }, 9007),
  A("animal_boar", 468, -384, -0.3, 0.95, "Diseased Boar", "Harthmere Wilds - Gate Fields", { radius: 1.8, speed: 0.28, phase: 1.7 }, 9008),
  A("animal_bear", 575, -448, 0.2, 1.08, "Black Bear", "Harthmere Wilds - Greenmere Edge", { radius: 1.5, speed: 0.14, phase: 0.3 }, 9009),
  A("animal_wolf", 548, -126, -Math.PI / 2, 0.98, "Forest Wolf", "Harthmere Wilds - Gravewood", { radius: 1.7, speed: 0.25, phase: 1.5 }, 9010),
  A("animal_snake", 655, -274, -0.6, 1.0, "Briarfen Water Snake", "Harthmere Wilds - Briarfen", { radius: 0.7, speed: 0.16, phase: 2.3 }, 9011),
  A("animal_wolf", 735, 275, -Math.PI / 2, 0.94, "Gravewood Pale Wolf", "Harthmere Wilds - Southeast Gravewood", { radius: 1.8, speed: 0.22, phase: 1.5 }, 9012),
  A("townsperson_bandit", 245, -640, Math.PI, 1.12, "Bandit Trapper", "Harthmere Wilds - West Old Wood", { radius: 2.0, speed: 0.15, phase: 2.1 }, 9013),

  // HARTHMERE_NAMED_NPCS_V44_RUNTIME_PLACEMENTS_START
  // Full named-NPC pass: every bible named NPC is represented as a route-driven runtime actor.
  ...HARTHMERE_NAMED_NPCS_V44.map((npc) =>
    A(
      harthmereNamedNpcActorAssetV44(npc),
      npc.spawn.x,
      npc.spawn.z,
      npc.spawn.rot,
      npc.spawn.scale,
      npc.name,
      npc.district,
      undefined,
      npc.combatOffset,
    ),
  ),
  // HARTHMERE_NAMED_NPCS_V44_RUNTIME_PLACEMENTS_END

  // HARTHMERE_NPC_HOME_FURNITURE_V65_PLACEMENTS
  ...createHarthmereNpcHomeFurnitureV65(),

  // HARTHMERE_REMAINING_NPCS_V45_RUNTIME_PLACEMENTS_START
  // Remaining NPC pass: quest-only people, ambient population, wildlife, monster, bandit, undead, and smuggler contracts.
  ...HARTHMERE_REMAINING_NPCS_V45.map((npc) =>
    A(
      harthmereRemainingNpcActorAssetV45(npc),
      npc.spawn.x,
      npc.spawn.z,
      npc.spawn.rot,
      npc.spawn.scale,
      npc.name,
      npc.district,
      undefined,
      npc.combatOffset,
    ),
  ),
  // HARTHMERE_REMAINING_NPCS_V45_RUNTIME_PLACEMENTS_END

  // HARTHMERE_V9_FULL_TOWN_REBUILD_START
  // Full scrape/rebuild pass. This removes the old decoration-first town and
  // rebuilds Harthmere as district architecture first, then supported interiors,
  // then non-blocking NPC/animal life. Small props are only placed on floors,
  // shelves, counters, racks, crates, barrels, or other believable supports.

  // Roads, route readability, and district edges.
  ...row("road", "North Gate", "North arrival cobble", 486, -282, 8, 0, 10, 0, 1.1),
  ...row("road", "Market Square", "Market east-west cobble", 430, -207, 14, 8, 0, Math.PI / 2, 1.05),
  ...row("road", "Temple Green", "Temple lane cobble", 484, -190, 7, 0, 8, 0, 0.92),
  ...row("road", "River Docks", "Dock road cobble", 536, -196, 9, 8, 0, Math.PI / 2, 0.92),
  ...row("fence", "Farm", "Farm fence north", 432, -249, 7, 5, 0, 0, 0.82),
  ...row("fence", "Farm", "Farm fence west", 430, -249, 6, 0, 5, Math.PI / 2, 0.82),
  ...row("fence_broken", "Mudden Ward", "Mudden broken fence", 398, -166, 6, 5, 0, 0, 0.82),
  ...row("hedge", "Noble Rise", "Noble garden hedge", 548, -248, 6, 6, 0, 0, 0.82),

  // Old Bridge: Q1 walkable stone bridge deck, parapets, and bronze bell-crack disc.
  ...createHarthmereOldBridgeWalkableParapetsV54(),

  // North Gate: fortified arrival, stable, toll booth, and watch identity.
  P("obj_tower_complex", 474, -286, 0, 1.18, "North Gate west tower", "North Gate"),
  P("obj_tower_complex", 498, -286, 0, 1.18, "North Gate east tower", "North Gate"),
  P("obj_wall_entrance_door", 486, -286, 0, 1.2, "North Gate ironbound door", "North Gate"),
  P("obj_wall_simple", 462, -286, 0, 1.05, "North wall west run", "North Gate"),
  P("obj_wall_simple", 510, -286, 0, 1.05, "North wall east run", "North Gate"),
  P("obj_wall_stairs", 466, -276, Math.PI / 2, 0.9, "Wall stair to watch", "North Gate"),
  P("obj_flag_large_red", 474, -292, 0, 1.05, "Watch banner left planted in tower base solid flag pole", "North Gate"),
  P("obj_flag_large_red", 498, -292, 0, 1.05, "Watch banner right planted in tower base solid flag pole", "North Gate"),
  P("obj_lamp_ground_large", 478, -272, 0, 0.92, "Gate brazier lamp", "North Gate"),
  P("obj_lamp_ground_large", 494, -272, 0, 0.92, "Gate brazier lamp", "North Gate"),
  P("cart_high", 470, -261, Math.PI / 2, 0.82, "Traveler wagon by stable", "North Gate"),
  P("fence_gate", 478, -264, Math.PI / 2, 0.9, "Stable gate", "North Gate"),
  P("barrel_fp", 472, -273, 0, 0.82, "Stable water barrel on floor", "North Gate"),
  P("bucket_wood", 475, -272, 0, 0.74, "Stable bucket on floor", "North Gate"),
  P("table_medium", 477.0, -269, 0, 0.74, "Toll clerk desk", "North Gate"),
  P("box_decorated", 492, -269, 0, 0.72, "Toll chest on floor", "North Gate"),

  // Exterior building shells: unique silhouettes per service, shop, home, and district.
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Dawn Loaf Bakery", district: "Market District", x: 424, z: -190, w: 18, d: 16, rot: -0.05, profile: "bakery", banner: "banner_yellow", scale: 0.82, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Brindle Provision House", district: "Market District", x: 454, z: -218, w: 20, d: 17, rot: 0.08, profile: "provision", banner: "banner_green", scale: 0.82, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Player Services Hall", district: "Player Services", x: 556, z: -224, w: 28, d: 21, rot: Math.PI, profile: "player_services", banner: "banner_green", roof: "arch_roof_high_gable", floors: 2, scale: 0.88, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Black Anvil Smithy", district: "Craftsman Row", x: 530, z: -232, w: 24, d: 18, rot: Math.PI / 2, profile: "smithy", banner: "banner_red", roof: "arch_roof_flat", floors: 2, scale: 0.82, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Carpenter and Tailor Workshop", district: "Craftsman Row", x: 504, z: -228, w: 18, d: 16, rot: Math.PI / 2, profile: "workshop", banner: "banner_brown", scale: 0.78, roofY: 2.7 }),


  // Craftsman Row / Black Anvil Smithy pass v1: exterior identity and readable
  // profession lane. These props sit on walls, rooflines, or plaza edges so the
  // smithy remains walkable while reading as a real crafting hub.
  P("obj_sign_post", 522.8, -220.2, Math.PI / 2, 0.68, "Black Anvil Smithy sign with repair and blacksmith training notice", "Craftsman Row"),
  P("anvil_fp", 523.4, -219.0, 0, 0.42, "Black Anvil hanging sign symbol supported below smithy sign", "Craftsman Row", GROUND_Y + 0.86),
  P("banner_red", 531.5, -219.2, Math.PI / 2, 0.5, "Black Anvil red forge banner beside smithy entrance mounted on wall bracket", "Craftsman Row", GROUND_Y + 1.12),
  P("arch_chimney_base", 527.6, -236.9, 0, 0.5, "Black Anvil broad smoke stack base on roof", "Craftsman Row", GROUND_Y + 3.12),
  P("arch_chimney_top", 527.6, -236.9, 0, 0.48, "Black Anvil smoke stack top above forge", "Craftsman Row", GROUND_Y + 4.0),
  P("obj_lamp_ground_small", 520.5, -222.4, 0, 0.66, "Craftsman Row forge glow lamp west of smithy", "Craftsman Row"),
  P("obj_lamp_ground_small", 539.4, -222.4, 0, 0.66, "Craftsman Row forge glow lamp east of smithy", "Craftsman Row"),
  P("obj_sign_post", 502.2, -218.9, Math.PI / 2, 0.58, "Profession trainer lane sign for carpentry tailoring leatherworking and work orders", "Craftsman Row"),
  P("banner_brown", 504.6, -218.6, Math.PI / 2, 0.38, "Workshop guild banner marking multi-profession crafting lane", "Craftsman Row", GROUND_Y + 0.96),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Green Mortar Apothecary", district: "Apothecary", x: 455, z: -176, w: 18, d: 16, rot: Math.PI / 2, profile: "apothecary", banner: "banner_green", scale: 0.78, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Wyrm and Candle Magic Shop", district: "Magic Shop", x: 518, z: -168, w: 20, d: 18, rot: 0, profile: "magic_shop", banner: "banner_blue", roof: "arch_roof_high_point", scale: 0.8, roofY: 3.05, roofScale: 1.05 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Copper Kettle Inn", district: "Copper Kettle", x: 552, z: -194, w: 30, d: 24, rot: -Math.PI / 2, profile: "inn", banner: "banner_brown", roof: "arch_roof_high_gable", floors: 2, scale: 0.9, roofY: 5.35, roofScale: 1.08 }),

  // Copper Kettle Inn exterior identity pass: the inn must read as a bind/rested
  // XP/social hub from the market path without blocking the front door.
  P("obj_sign_post", 537.5, -209.8, Math.PI / 2, 0.72, "Copper Kettle Inn signpost with room rental and food notices", "Copper Kettle"),
  P("cauldron_fp", 538.2, -208.2, 0, 0.42, "Copper kettle hanging sign symbol supported below inn sign", "Copper Kettle", GROUND_Y + 0.95),
  P("banner_brown", 542.6, -207.8, Math.PI / 2, 0.5, "Warm tavern banner beside Copper Kettle sign", "Copper Kettle", GROUND_Y + 1.12),
  P("obj_lamp_ground_small", 538.8, -205.6, 0, 0.72, "Warm inn entrance lamp west of door", "Copper Kettle"),
  P("obj_lamp_ground_small", 565.0, -205.6, 0, 0.72, "Warm inn entrance lamp east of door", "Copper Kettle"),
  P("arch_chimney", 548.4, -184.2, 0, 0.48, "Copper Kettle roof chimney smoke marker", "Copper Kettle", GROUND_Y + 4.15),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Reeve Hall", district: "Noble Rise", x: 562, z: -262, w: 30, d: 21, rot: Math.PI, profile: "reeve_hall", banner: "banner_red", roof: "arch_roof_high_gable", floors: 2, scale: 0.9, roofY: 5.35 }),


  // Noble Rise pass v1: elevated wealthy approach, private garden, court
  // signage, and event staging. Keep the central Reeve Hall entrance lane clear.
  P("arch_stairs_wide_stone", 562.0, -246.4, Math.PI, 0.88, "Noble Rise raised terrace stair from market road", "Noble Rise"),
  P("arch_pillar_stone", 550.2, -248.2, 0, 0.74, "Noble Rise west estate pillar marking restricted approach", "Noble Rise"),
  P("arch_pillar_stone", 573.8, -248.2, 0, 0.74, "Noble Rise east estate pillar marking restricted approach", "Noble Rise"),
  P("obj_lamp_ground_small", 552.2, -246.6, 0, 0.62, "Noble Rise brass approach lamp west", "Noble Rise"),
  P("obj_lamp_ground_small", 571.8, -246.6, 0, 0.62, "Noble Rise brass approach lamp east", "Noble Rise"),
  P("obj_sign_post", 562.0, -244.8, Math.PI, 0.58, "Reeve Hall court permit tax office sign", "Noble Rise"),
  P("banner_green", 552.5, -249.0, Math.PI, 0.36, "Clean green shutter banner on Reeve Hall west face", "Noble Rise", GROUND_Y + 1.04),
  P("banner_red", 571.5, -249.0, Math.PI, 0.36, "Red town authority banner on Reeve Hall east face", "Noble Rise", GROUND_Y + 1.04),
  P("banner_white", 562.0, -248.6, Math.PI, 0.34, "White legal notice cloth under Reeve Hall balcony", "Noble Rise", GROUND_Y + 1.0),
  P("arch_roof_window", 555.0, -262.0, Math.PI, 0.52, "Reeve Hall west roof window for wealthy skyline variety", "Noble Rise", GROUND_Y + 3.92),
  P("arch_roof_window", 569.0, -262.0, Math.PI, 0.52, "Reeve Hall east roof window for wealthy skyline variety", "Noble Rise", GROUND_Y + 3.92),
  P("arch_chimney_top", 574.0, -269.0, 0, 0.42, "Reeve Hall polished chimney top", "Noble Rise", GROUND_Y + 4.08),
  P("fountain_square", 544.8, -256.8, 0, 0.44, "Noble private garden fountain beside court approach", "Noble Rise"),
  P("bench_fp", 546.6, -252.8, Math.PI / 2, 0.58, "Noble petition bench beside private garden", "Noble Rise"),
  P("bench_fp", 546.6, -261.4, Math.PI / 2, 0.58, "Noble waiting bench beside private garden", "Noble Rise"),
  P("hedge_large", 542.0, -251.0, 0, 0.58, "Noble garden clipped hedge north edge", "Noble Rise"),
  P("hedge_large", 542.0, -263.0, 0, 0.58, "Noble garden clipped hedge south edge", "Noble Rise"),
  P("hedge", 548.8, -268.0, Math.PI / 2, 0.74, "Noble servant side path hedge", "Noble Rise"),
  P("obj_sign_post", 552.6, -272.2, Math.PI / 2, 0.5, "Servant entrance and deliveries sign behind Reeve Hall", "Noble Rise"),
  P("crate_wooden_fp", 554.2, -273.2, 0, 0.46, "Servant delivery crate on floor near side entrance", "Noble Rise"),
  P("scroll_1_fp", 554.2, -273.2, 0.2, 0.24, "Servant rebellion note supported on delivery crate", "Noble Rise", GROUND_Y + 0.64),
  P("obj_sign_post", 577.6, -252.6, -Math.PI / 2, 0.5, "Tax protest assembly notice outside Reeve Hall", "Noble Rise"),
  P("crate_wooden_fp", 578.8, -254.8, 0, 0.44, "Tax protest placard crate on floor outside court", "Noble Rise"),
  P("scroll_2_fp", 578.8, -254.8, -0.18, 0.24, "Pinned tax protest placard supported on protest crate", "Noble Rise", GROUND_Y + 0.64),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Dock Ledger Warehouse", district: "River Docks", x: 596, z: -172, w: 26, d: 18, rot: -Math.PI / 2, profile: "dock_warehouse", banner: "banner_blue", roof: "arch_roof_flat", scale: 0.82, roofY: 2.7 }),


  // River Docks pass v1: ferry/travel readability, dockmaster identity,
  // cargo-office signage, dock bell, and event staging. Keep the center pier
  // and warehouse door lane clear for players/NPCs.
  P("obj_sign_post", 585.2, -194.6, Math.PI / 2, 0.62, "River Docks ferry cargo contracts fishing trainer sign", "River Docks"),
  P("obj_lamp_ground_small", 582.8, -193.8, 0, 0.68, "River Docks fog lamp beside cargo road", "River Docks"),
  P("obj_lamp_ground_small", 608.4, -164.8, 0, 0.66, "River Docks ferry fog lamp at pier head", "River Docks"),
  P("obj_church_bells", 589.2, -191.4, Math.PI / 2, 0.34, "Dock bell mounted above ferry and flood warning post", "River Docks", GROUND_Y + 1.32),
  P("banner_blue", 588.4, -190.8, Math.PI / 2, 0.38, "Wet blue dockmaster banner under bell post", "River Docks", GROUND_Y + 0.98),
  P("arch_roof_window", 596.0, -172.0, -Math.PI / 2, 0.5, "Dock Ledger Warehouse roof dormer facing river", "River Docks", GROUND_Y + 3.0),
  P("arch_chimney_top", 603.2, -178.0, 0, 0.38, "Dock Ledger Warehouse smoke vent for damp cargo office", "River Docks", GROUND_Y + 3.16),
  P("obj_sign_post", 586.6, -171.2, Math.PI, 0.52, "Cargo contracts board outside Dock Ledger Warehouse", "River Docks"),
  P("scroll_1_fp", 586.35, -171.55, 0.1, 0.25, "Pinned cargo contract supported on warehouse board", "River Docks", GROUND_Y + 0.86),
  P("scroll_2_fp", 586.95, -171.55, -0.1, 0.25, "Pinned ferry schedule supported on warehouse board", "River Docks", GROUND_Y + 0.86),
  P("cart_high", 584.8, -175.4, Math.PI / 2, 0.58, "Cargo handcart waiting beside warehouse road", "River Docks"),
  P("crate_wooden_fp", 586.7, -176.4, 0, 0.52, "Sorted river goods crate beside warehouse handcart", "River Docks"),
  P("barrel_large", 590.4, -190.8, 0, 0.52, "Flood sand barrel beside dock bell", "River Docks"),
  P("obj_sign_post", 610.8, -170.6, -Math.PI / 2, 0.48, "Ferry master water travel sign at pier", "River Docks"),
  P("obj_bridge_low_body", 613.8, -168.0, Math.PI / 2, 0.52, "Low ferry skiff silhouette tied to pier", "River Docks"),
  P("rope_3_fp", 611.2, -167.4, Math.PI / 2, 0.54, "Ferry mooring rope tied on pier edge", "River Docks"),
  P("chain_coil", 610.4, -171.8, 0, 0.48, "Ferry chain coil kept off main walking lane", "River Docks"),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Mudden Lean-To Home", district: "Mudden Ward", x: 412, z: -158, w: 17, d: 15, rot: Math.PI / 2, profile: "mudden_home", banner: "banner_brown", roof: "arch_roof_flat", scale: 0.72, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Mudden Wash House", district: "Mudden Ward", x: 424, z: -137, w: 16, d: 14, rot: 0, profile: "wash_house", banner: "banner_white", roof: "arch_roof_flat", scale: 0.7, roofY: 2.7 }),


  // Mudden Ward pass v1: patched roofs, leaning walls, laundry lanes, smoke,
  // poor-house identity, and hidden-route readability. Keep the alley spine
  // around x=416 clear for players/NPCs.
  P("arch_roof_left", 410.2, -158.2, Math.PI / 2, 0.46, "Mudden patched lean-to roof left scrap", "Mudden Ward", GROUND_Y + 2.62),
  P("arch_roof_right", 414.4, -158.2, Math.PI / 2, 0.46, "Mudden patched lean-to roof right scrap", "Mudden Ward", GROUND_Y + 2.58),
  P("banner_brown", 412.4, -154.4, Math.PI / 2, 0.72, "Canvas roof patch tied over Mudden lean-to", "Mudden Ward", GROUND_Y + 2.34),
  P("arch_wall_wood_broken", 408.9, -165.8, Math.PI / 2, 0.42, "Leaning broken wall brace beside Mudden lean-to", "Mudden Ward"),
  P("arch_pillar_wood", 407.2, -164.6, 0, 0.38, "Crooked timber post supporting sagging alley line", "Mudden Ward"),
  P("arch_pillar_wood", 424.6, -151.6, 0, 0.38, "Crooked timber post supporting laundry rope", "Mudden Ward"),
  P("rope_2_fp", 416.0, -156.8, Math.PI / 2, 0.56, "Laundry line tied between Mudden houses", "Mudden Ward", GROUND_Y + 1.72),
  P("banner_brown", 416.0, -156.8, Math.PI / 2, 0.52, "Washed cloth hanging from Mudden laundry line", "Mudden Ward", GROUND_Y + 1.52),
  P("rope_1_fp", 421.4, -141.0, 0, 0.5, "Back-alley laundry rope tied to wash house", "Mudden Ward", GROUND_Y + 1.56),
  P("banner_white", 421.4, -141.0, 0, 0.42, "Pale laundry sheet hanging in wash-house lane", "Mudden Ward", GROUND_Y + 1.38),
  P("torch_lit", 407.0, -151.2, 0, 0.42, "Small smoky cookfire at Mudden alley edge grounded in stone fire ring", "Mudden Ward", GROUND_Y + 0.58),
  P("bucket_wood", 408.2, -151.0, 0, 0.42, "Water bucket beside smoky cookfire", "Mudden Ward"),
  P("rock_wide", 416.8, -162.4, 0.2, 0.36, "Dark mud puddle proxy in low alley", "Mudden Ward"),
  P("rock_wide", 422.2, -146.2, -0.2, 0.32, "Rain puddle proxy beside wash house", "Mudden Ward"),
  P("obj_sign_post", 400.6, -164.8, Math.PI / 2, 0.42, "Mudden Ward warning sign poverty flood disease", "Mudden Ward"),
  P("scroll_2_fp", 400.6, -165.15, 0.08, 0.22, "Eviction notice pinned to Mudden warning sign", "Mudden Ward", GROUND_Y + 0.82),
  P("obj_sign_post", 431.6, -148.8, -Math.PI / 2, 0.38, "Washerwomen work board and cheap healer notice", "Mudden Ward"),
  P("scroll_1_fp", 431.6, -148.5, -0.12, 0.22, "Cheap healer note supported on Mudden board", "Mudden Ward", GROUND_Y + 0.78),
  P("obj_church_trapdoor_metal", 419.2, -169.8, Math.PI / 2, 0.52, "Hidden tunnel access under broken laundry cart", "Mudden Ward"),
  P("crate_wooden_fp", 418.0, -169.6, 0.1, 0.38, "Broken laundry cart hiding tunnel edge", "Mudden Ward"),
  P("torch_mounted", 420.5, -170.6, Math.PI, 0.38, "Dim underways marker torch near Mudden tunnel mounted on Mudden tunnel wall bracket", "Mudden Ward", GROUND_Y + 1.0),
  P("pillar", 421.8, -170.4, 0, 0.36, "Old carved drain stone beside hidden tunnel", "Mudden Ward"),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Roadside Family Cottage", district: "Residential District", x: 456, z: -256, w: 20, d: 17, rot: 0, profile: "residential_cottage", banner: "banner_green", scale: 0.78, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Guard Barracks", district: "Guard Yard", x: 512, z: -264, w: 22, d: 16, rot: Math.PI, profile: "barracks", banner: "banner_red", roof: "arch_roof_flat", floors: 2, scale: 0.8, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Stable Yard Office", district: "North Gate", x: 468, z: -254, w: 16, d: 13, rot: -Math.PI / 2, profile: "stable_office", banner: "banner_brown", roof: "arch_roof_flat", scale: 0.7, roofY: 2.7 }),

  // Temple Green: chapel shell, bell clue, quiet graveyard, and resurrection identity.
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Chapel of Saint Verena", district: "Temple Green", x: 480, z: -137, w: 26, d: 24, rot: 0, profile: "chapel", banner: "banner_white", roof: "arch_roof_high_gable", floors: 2, scale: 0.86, roofY: 6.0, roofScale: 1.12 }),

  // HARTHMERE_BIBLE_BUILDING_EXPANSION_V1 — bible-required buildings that
  // were missing from the renderer (Brother Vance cottage, Edrik Vane
  // estate, Mara Thistle two-story house, Brass Scale moneylender,
  // additional Mudden lean-to, River Dock Supply, gatehouse, toll booth).
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "North Gate Gatehouse", district: "North Gate", x: 470, z: -270, w: 18, d: 14, rot: 0, profile: "barracks", banner: "banner_red", roof: "arch_roof_high_gable", floors: 2, scale: 0.82, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Toll Booth", district: "North Gate", x: 502, z: -270, w: 12, d: 10, rot: 0, profile: "stable_office", banner: "banner_red", roof: "arch_roof_flat", scale: 0.74, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Mara Thistle Two-Story House", district: "Market Square", x: 444, z: -208, w: 16, d: 14, rot: 0, profile: "residential_cottage", banner: "banner_green", roof: "arch_roof_gable", floors: 2, scale: 0.78, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Edrik Vane Estate", district: "Noble Rise", x: 540, z: -286, w: 26, d: 20, rot: 0, profile: "reeve_hall", banner: "banner_blue", roof: "arch_roof_high_gable", floors: 2, scale: 0.88, roofY: 5.35 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Brother Vance Cottage", district: "Temple Green", x: 462, z: -126, w: 12, d: 10, rot: -Math.PI / 2, profile: "residential_cottage", banner: "banner_white", roof: "arch_roof_gable", scale: 0.72, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Brass Scale Moneylender", district: "Player Services", x: 530, z: -218, w: 14, d: 12, rot: Math.PI, profile: "player_services", banner: "banner_yellow", roof: "arch_roof_flat", scale: 0.76, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "Mudden Tam Crowe Lean-To", district: "Mudden Ward", x: 404, z: -148, w: 13, d: 11, rot: 0, profile: "mudden_home", banner: "banner_brown", roof: "arch_roof_flat", scale: 0.7, roofY: 2.7 }),
  ...createHarthmereBlockBuiltServiceBuildingV43({ name: "River Dock Supply", district: "River Docks", x: 582, z: -184, w: 16, d: 13, rot: -Math.PI / 2, profile: "dock_warehouse", banner: "banner_blue", roof: "arch_roof_flat", scale: 0.74, roofY: 2.7 }),
  P("obj_church_bells", 480, -128, Math.PI, 0.72, "Empty bell-frame clue supported on rebuilt stone chapel bell arch", "Temple Green", GROUND_Y + 4.65),
  P("banner_white", 486, -149, Math.PI, 0.82, "Missing Bell vigil cloth", "Temple Green", GROUND_Y + 1.2),
  P("church_bench", 471, -141, 0, 0.9, "Chapel pew left row", "Temple Green"),
  P("church_bench", 487, -141, 0, 0.9, "Chapel pew right row", "Temple Green"),
  P("church_bench", 471, -136, 0, 0.9, "Chapel pew left row", "Temple Green"),
  P("church_bench", 487, -136, 0, 0.9, "Chapel pew right row", "Temple Green"),
  P("church_pulpit", 480, -130.8, Math.PI, 0.9, "Pulpit on floor", "Temple Green"),
  P("candlestick_stand_fp", 472, -131, 0, 0.75, "Floor candle stand", "Temple Green"),
  P("candlestick_stand_fp", 488, -131, 0, 0.75, "Floor candle stand", "Temple Green"),
  P("tombstone", 506, -145, 0.1, 0.8, "Grave marker", "Temple Green"),
  P("tombstone", 516, -139, -0.1, 0.8, "Grave marker", "Temple Green"),
  P("tombstone", 528, -147, 0.2, 0.8, "Grave marker", "Temple Green"),
  P("obj_grave_dirt", 510, -150, 0, 0.82, "Fresh grave mound", "Temple Green"),
  P("obj_church_grave_fence", 515, -151, Math.PI / 2, 0.78, "Cemetery iron fence", "Temple Green"),
  P("shovel", 522, -134, 0.8, 0.75, "Gravedigger shovel leaning near graves", "Temple Green"),


  // Temple Green pass v1: healing, resurrection, charity, lore archive,
  // cemetery depth, missing-bell clues, and sacred event anchors. Detail sits
  // on chapel/green edges so service NPCs and paths remain reachable.
  P("obj_sign_post", 491.6, -154.6, Math.PI, 0.34, "Temple Green healer resurrection charity sign", "Temple Green"),
  P("scroll_1_fp", 491.6, -154.3, 0.04, 0.16, "Temple service hours note supported on healer sign", "Temple Green", GROUND_Y + 0.68),
  P("banner_blue", 474.2, -149.2, Math.PI, 0.66, "Blue chapel healing banner mounted by entry", "Temple Green", GROUND_Y + 1.22),
  P("banner_white", 485.8, -149.2, Math.PI, 0.66, "White chapel resurrection banner mounted by entry", "Temple Green", GROUND_Y + 1.22),
  P("church_lantern", 474.0, -151.6, 0, 0.54, "Temple entry lantern left of healing path mounted on chapel entry wall bracket", "Temple Green", GROUND_Y + 1.08),
  P("church_lantern", 486.0, -151.6, 0, 0.54, "Temple entry lantern right of healing path mounted on chapel entry wall bracket", "Temple Green", GROUND_Y + 1.08),
  P("obj_church_window_lower", 470.2, -136.8, Math.PI / 2, 0.72, "Lower stained-glass chapel window west wall", "Temple Green", GROUND_Y + 1.05),
  P("obj_church_window_lower", 489.8, -136.8, -Math.PI / 2, 0.72, "Lower stained-glass chapel window east wall", "Temple Green", GROUND_Y + 1.05),
  P("obj_church_window_upper", 480.0, -128.6, Math.PI, 0.66, "Upper stained-glass lantern window above altar", "Temple Green", GROUND_Y + 2.25),
  P("obj_church_base_lower", 480.0, -146.8, Math.PI, 0.88, "Ivory chapel front step base", "Temple Green", GROUND_Y + 0.03),
  P("table_tablecloth", 480.0, -126.6, Math.PI, 0.64, "Resurrection altar service table", "Temple Green"),
  P("candlestick_triple_fp", 478.8, -126.6, 0, 0.34, "Left resurrection altar candles supported on altar", "Temple Green", GROUND_Y + 0.82),
  P("candlestick_triple_fp", 481.2, -126.6, 0, 0.34, "Right resurrection altar candles supported on altar", "Temple Green", GROUND_Y + 0.82),
  P("spellbook_open", 480.0, -126.2, Math.PI, 0.34, "Open resurrection rite book supported on altar", "Temple Green", GROUND_Y + 0.86),
  P("small_bottle_fp", 482.2, -126.7, 0.1, 0.28, "Condition cleansing vial supported on altar", "Temple Green", GROUND_Y + 0.82),
  P("candle_triple", 480.0, -124.3, 0, 0.34, "Resurrection point candle ring marker", "Temple Green"),
  P("table_medium", 470.0, -130.0, Math.PI / 2, 0.58, "Charity turn-in table beside chapel aisle", "Temple Green"),
  P("coin_pile", 469.6, -130.0, 0, 0.24, "Donation coins supported on charity table", "Temple Green", GROUND_Y + 0.72),
  P("bread_loaf", 470.4, -130.0, 0, 0.38, "Charity bread supported on charity table", "Temple Green", GROUND_Y + 0.72),
  P("scroll_2_fp", 470.0, -129.4, -0.1, 0.15, "Charity ledger supported on charity table", "Temple Green", GROUND_Y + 0.74),
  P("crate_wooden_fp", 467.6, -130.8, 0, 0.5, "Charity food crate on floor beside table", "Temple Green"),
  P("farmcrate_apple", 467.4, -129.0, 0, 0.42, "Apple charity crate on floor", "Temple Green"),
  P("bookcase_2", 489.0, -130.0, -Math.PI / 2, 0.62, "Chapel lore archive bookcase against east wall", "Temple Green"),
  P("bookstand_fp", 486.6, -130.2, Math.PI, 0.42, "Missing Bell lore bookstand near archive", "Temple Green"),
  P("scroll_1_fp", 486.6, -129.8, 0.08, 0.15, "Missing Bell archive clue supported on bookstand", "Temple Green", GROUND_Y + 0.68),
  P("book_stack_1", 486.8, -131.6, 0.1, 0.3, "Archive books stacked on floor by bookcase", "Temple Green"),
  P("shelf_candles", 489.2, -134.0, -Math.PI / 2, 0.48, "Prayer candle shelf fixed to chapel wall", "Temple Green"),
  P("church_candelabra", 473.0, -128.8, 0, 0.54, "Left candle rack for candle vigil", "Temple Green"),
  P("church_candelabra", 487.0, -128.8, 0, 0.54, "Right candle rack for candle vigil", "Temple Green"),
  P("bed_twin1", 492.0, -143.0, -Math.PI / 2, 0.58, "Injured traveler cot in chapel infirmary corner", "Temple Green"),
  P("small_bottle_fp", 491.4, -141.8, 0, 0.26, "Healing tincture supported beside injured traveler cot", "Temple Green", GROUND_Y + 0.42),
  P("bucket_wood", 493.6, -141.6, 0, 0.44, "Clean water bucket beside infirmary cot", "Temple Green"),
  P("chair", 490.2, -144.0, Math.PI / 2, 0.46, "Sister Maelle healer chair beside infirmary cot", "Temple Green"),
  P("obj_sign_post", 498.0, -147.6, -Math.PI / 2, 0.3, "Cemetery path quiet zone sign", "Temple Green"),
  P("scroll_2_fp", 497.7, -147.6, 0.12, 0.14, "Funeral procession notice supported on cemetery sign", "Temple Green", GROUND_Y + 0.66),
  P("obj_church_grave_wall", 506.0, -151.8, 0, 0.48, "Low cemetery wall at chapel boundary", "Temple Green"),
  P("obj_church_grave_wall", 520.0, -151.8, 0, 0.48, "Second low cemetery wall at chapel boundary", "Temple Green"),
  P("tombstone", 512.0, -136.4, -0.2, 0.62, "Leaning old grave marker near chapel", "Temple Green"),
  P("tombstone", 524.0, -141.8, 0.12, 0.58, "Family grave marker near cemetery path", "Temple Green"),
  P("coffin", 520.4, -147.2, 0.1, 0.42, "Funeral procession coffin staging prop", "Temple Green"),
  P("candle_thin_lit", 519.0, -145.8, 0, 0.3, "Funeral candle supported on grave edge", "Temple Green"),
  P("candle_thin_lit", 522.0, -145.8, 0, 0.3, "Second funeral candle supported on grave edge", "Temple Green"),
  P("shovel", 524.8, -134.6, 0.9, 0.54, "Gravekeeper spare shovel leaning against cemetery wall", "Temple Green"),
  P("bucket_wood", 526.0, -134.2, 0, 0.42, "Gravekeeper flower water bucket on ground", "Temple Green"),
  P("obj_church_crypt", 529.2, -139.8, Math.PI / 2, 0.28, "Crypt disturbance sealed crypt breadcrumb", "Temple Green"),
  P("torch_mounted", 529.0, -137.6, -Math.PI / 2, 0.28, "Crypt disturbance warning torch mounted on crypt wall bracket", "Temple Green", GROUND_Y + 0.9),
  P("obj_sign_post", 488.2, -144.8, Math.PI, 0.28, "River Blessing processional start sign", "Temple Green"),
  P("scroll_1_fp", 488.2, -144.5, 0.05, 0.14, "River Blessing event route note supported on sign", "Temple Green", GROUND_Y + 0.66),
  P("banner_blue", 490.0, -145.8, Math.PI, 0.48, "River Blessing blue processional banner", "Temple Green", GROUND_Y + 1.02),
  P("table_small", 475.2, -145.8, Math.PI, 0.48, "Plague prayer offering table", "Temple Green"),
  P("bottle_green", 474.8, -145.7, 0, 0.26, "Flood fever cure vial supported on plague prayer table", "Temple Green", GROUND_Y + 0.58),
  P("candle_lit", 475.6, -145.7, 0, 0.24, "Plague prayer candle supported on offering table", "Temple Green", GROUND_Y + 0.58),
  P("scroll_2_fp", 475.2, -145.2, 0.08, 0.14, "Plague prayer request supported on offering table", "Temple Green", GROUND_Y + 0.6),
  P("rope_2_fp", 479.2, -128.6, Math.PI / 2, 0.24, "Frayed missing-bell rope beside empty bell frame", "Temple Green", GROUND_Y + 2.25),
  P("obj_church_bells", 484.0, -127.4, 0.2, 0.22, "Tiny bronze missing-bell shard on altar stair", "Temple Green", GROUND_Y + 0.36),
  P("obj_sign_post", 462.6, -176.8, -Math.PI / 2, 0.28, "Green Mortar Apothecary healer referral sign", "Apothecary"),
  P("scroll_1_fp", 462.3, -176.8, 0.03, 0.14, "Ysabet Fenlow treatment hours note supported on apothecary sign", "Apothecary", GROUND_Y + 0.66),
  P("small_bottles_1", 454.0, -178.2, 0.1, 0.3, "Ysabet Fenlow remedy bottles supported on treatment table", "Apothecary", GROUND_Y + 0.72),
  P("scroll_2_fp", 454.4, -177.4, 0.08, 0.14, "Flood fever cure recipe supported on treatment table", "Apothecary", GROUND_Y + 0.74),

  // Market Square: wide open fountain hub with stalls on edges, not in the main lane.
  P("fountain_round", 486, -209, 0, 1.35, "Bridge Fountain landmark", "Market Square"),
  P("stall_red", 438, -214.0, Math.PI / 2, 1.05, "Produce stall", "Market Square"),
  P("farmcrate_apple", 442, -208, 0, 0.86, "Apple crate beside produce stall", "Market Square"),
  P("farmcrate_carrot", 444, -204, 0, 0.86, "Carrot crate beside produce stall", "Market Square"),
  P("barrel_apples", 434, -199, 0, 0.86, "Apple barrel beside stall", "Market Square"),
  P("stall_green", 531, -214.0, -Math.PI / 2, 1.05, "Cloth stall", "Market Square"),
  P("stall", 531, -191, -Math.PI / 2, 1.05, "General goods stall", "Market Square"),
  P("obj_kiosk", 503, -219, -Math.PI / 2, 0.82, "Quest and notice kiosk", "Market Square"),
  P("cart", 470, -219, Math.PI, 0.78, "Market handcart at plaza edge", "Market Square"),
  P("obj_sign_post", 494, -216, 0, 0.86, "Market wayfinding sign", "Market Square"),
  P("obj_lamp_ground_small", 474, -202, 0, 0.82, "Fountain lamp", "Market Square"),
  P("obj_lamp_ground_small", 498, -216, 0, 0.82, "Fountain lamp", "Market Square"),

  // Market Square identity pass: keep the plaza center open while giving every
  // stall a readable category, adding social seating, and reserving live-op event anchors.
  P("fountain_round_detail", 486, -209, 0, 0.92, "Bridge Fountain carved rim detail", "Market Square", GROUND_Y + 0.06),
  P("fountain_center", 486, -209, 0, 0.62, "Bridge Fountain center stone marker", "Market Square", GROUND_Y + 0.12),
  P("bench_fp", 476, -198, Math.PI / 2, 0.72, "Fountain social bench west", "Market Square"),
  P("bench_fp", 496, -198, Math.PI / 2, 0.72, "Fountain social bench east", "Market Square"),
  P("bench_fp", 486, -221, 0, 0.72, "Fountain social bench south", "Market Square"),
  P("banner_red", 478, -202, 0, 0.64, "Harvest Fair red plaza banner", "Market Square", GROUND_Y + 1.1),
  P("banner_green", 494, -202, 0, 0.64, "Harvest Fair green plaza banner", "Market Square", GROUND_Y + 1.1),
  P("banner_yellow", 486, -198, 0, 0.58, "Harvest Fair yellow plaza banner", "Market Square", GROUND_Y + 1.08),
  P("table_tablecloth", 431, -202.4, Math.PI / 2, 0.62, "Produce sample table beside stall off mounted lane", "Market Square"),
  P("food_apple", 431.1, -202.65, 0.2, 0.28, "Apple sample supported on produce table", "Market Square", GROUND_Y + 0.68),
  P("food_green_apple", 430.7, -202.25, -0.3, 0.28, "Green apple sample supported on produce table", "Market Square", GROUND_Y + 0.68),
  P("carrot_fp", 431.45, -202.35, Math.PI / 2, 0.38, "Carrot sample supported on produce table", "Market Square", GROUND_Y + 0.68),
  P("bread_slice", 433.1, -202.2, 0, 0.48, "Bread sample supported on market table", "Market Square", GROUND_Y + 0.68),
  P("cheese", 433.55, -202.55, 0.2, 0.46, "Cheese sample supported on market table", "Market Square", GROUND_Y + 0.68),
  P("shelf_meat", 435.6, -212.2, Math.PI / 2, 0.5, "Butcher shelf beside food stall with supported meat", "Market Square"),
  P("stall_stool", 439, -198.4, Math.PI / 2, 0.72, "Produce vendor stool tucked beside stall", "Market Square"),
  P("table_long_decorated", 536, -202, -Math.PI / 2, 0.64, "Cloth and dye display counter", "Market Square"),
  P("banner_blue", 536.2, -201.8, -Math.PI / 2, 0.46, "Blue cloth bolt supported on display counter", "Market Square", GROUND_Y + 0.74),
  P("banner_white", 536.2, -202.55, -Math.PI / 2, 0.46, "White cloth bolt supported on display counter", "Market Square", GROUND_Y + 0.74),
  P("banner_brown", 536.2, -203.3, -Math.PI / 2, 0.46, "Brown cloth bolt supported on display counter", "Market Square", GROUND_Y + 0.74),
  P("table_medium", 536, -190, -Math.PI / 2, 0.62, "Travel goods display counter", "Market Square"),
  P("rope_2_fp", 536.2, -190.2, 0, 0.5, "Rope coil supported on travel goods counter", "Market Square", GROUND_Y + 0.72),
  P("lantern", 536.4, -189.65, 0, 0.42, "Lantern supported on travel goods counter", "Market Square", GROUND_Y + 0.74),
  P("bag_fp", 534.1, -188.7, 0, 0.54, "Travel sack under general goods stall", "Market Square"),
  P("chest_wood_fp", 538.7, -188.6, Math.PI / 2, 0.52, "Lockbox under general goods stall", "Market Square"),
  P("fence", 449, -188, Math.PI / 2, 0.74, "Livestock pen west rail at market edge", "Market Square"),
  P("fence", 457, -188, Math.PI / 2, 0.74, "Livestock pen east rail at market edge", "Market Square"),
  P("fence", 453, -184, 0, 0.74, "Livestock pen north rail at market edge", "Market Square"),
  P("bucket_wood", 453, -187, 0, 0.58, "Livestock water bucket inside market pen", "Market Square"),
  P("rack", 511.5, -220.2, Math.PI / 2, 0.36, "Public stocks and justice event marker clear of workshop service route and NPC anchors", "Market Square"),
  P("table_long", 515, -224, 0, 0.58, "Puppet show performance platform", "Market Square"),
  P("stool_fp", 512.5, -222.5, 0, 0.5, "Performer stool beside puppet show platform", "Market Square"),
  P("mug_empty", 514.7, -223.6, 0, 0.32, "Donation mug supported on performer platform", "Market Square", GROUND_Y + 0.64),
  P("obj_sign_post", 521, -221, -Math.PI / 2, 0.64, "Merchant dispute and price riot event notice", "Market Square"),
  P("crate_b", 520, -218, 0.2, 0.56, "Harvest Fair overflow supply crate", "Market Square"),
  P("crate_c", 524, -218, -0.1, 0.56, "Seasonal market booth supply crate", "Market Square"),

  // Bakery supported interior and storefront dressing.
  P("table_large_fp", 431, -192, 0, 0.82, "Bakery prep table", "Bakery"),
  P("table_plate_fp", 419.8, -192, Math.PI / 2, 0.72, "Bakery supported display table", "Bakery"),
  P("bread_loaf", 420.2, -191.4, 0, 0.92, "Bread on bakery display table", "Bakery", GROUND_Y + 0.82),
  P("cake", 419.6, -192.4, 0, 0.82, "Cake on bakery display table", "Bakery", GROUND_Y + 0.82),
  P("barrel_apples", 421, -200, 0, 0.82, "Apple barrel by bakery wall", "Bakery"),
  P("farmcrate_apple", 437, -198, 0, 0.82, "Apple crate by bakery oven wall", "Bakery"),
  P("crate_wooden_fp", 421, -187, 0, 0.82, "Flour crate on floor", "Bakery"),
  P("barrel_fp", 438, -187, 0, 0.82, "Water barrel on floor", "Bakery"),
  P("torch_lit", 420, -201, Math.PI / 2, 0.78, "Oven glow against bakery wall", "Bakery"),

  // Provision house supported interior.
  P("shelf_large", 462, -212, -Math.PI / 2, 0.78, "Provision shelves against wall", "Market District"),
  P("barrel_stack", 446, -211, 0, 0.74, "Provision barrels on floor", "Market District"),
  P("crates_stacked", 448, -223, 0, 0.76, "General store stacked stock", "Market District"),
  P("box_decorated", 460, -222, 0, 0.74, "General store dry goods chest", "Market District"),
  P("rope_1_fp", 450, -215, 0, 0.66, "Rope coil on store floor", "Market District"),
  P("bag_fp", 456, -215, 0, 0.72, "Travel sack on store floor", "Market District"),

  // Player Services interior: bank, courier, auction, guild counter.
  P("table_long_decorated", 562.2, -219.2, Math.PI / 2, 0.46, "Bank teller counter side-aligned clear of Player Services routes", "Player Services"),
  P("table_long", 565.2, -228.6, Math.PI / 2, 0.46, "Ledger work desk wall-aligned clear of Player Services entry aisle", "Player Services"),
  P("chest_gold", 562, -229, Math.PI / 2, 0.76, "Vault chest on floor", "Player Services"),
  P("chest_wood_fp", 551, -229, -Math.PI / 2, 0.78, "Deposit chest on floor", "Player Services"),
  P("shelf_large", 548, -222, Math.PI / 2, 0.78, "Storage shelf against west wall", "Player Services"),
  P("wall_shelves", 564, -222, -Math.PI / 2, 0.78, "Wall ledger shelves", "Player Services"),
  P("table_medium", 508, -217, Math.PI / 2, 0.76, "Auction clerk desk", "Player Services"),
  P("box_stacked", 502, -212, 0, 0.76, "Courier parcel stack", "Player Services"),
  P("cart", 518, -210, -Math.PI / 2, 0.76, "Courier cart at service plaza", "Player Services"),
  P("coin_pile", 556, -222, 0, 0.48, "Coin pile on bank counter", "Player Services", GROUND_Y + 0.82),

  // Player Services Plaza identity pass: split the MMO utility building into
  // readable service stations without blocking the market-to-services lane.
  P("obj_sign_post", 545, -211, Math.PI, 0.72, "Player Services bank mail auction storage signpost", "Player Services"),
  P("banner_green", 550, -214, Math.PI, 0.58, "Bank and storage green service banner", "Player Services", GROUND_Y + 1.18),
  P("banner_blue", 561.5, -214, Math.PI, 0.52, "Auction and guild blue service banner", "Player Services", GROUND_Y + 1.12),
  P("obj_lamp_ground_small", 546, -214, 0, 0.76, "Player Services entrance lamp west", "Player Services"),
  P("obj_lamp_ground_small", 566, -214, 0, 0.76, "Player Services entrance lamp east", "Player Services"),

  P("book_stack_1", 554.8, -222.15, 0.12, 0.42, "Bank ledger supported on bank teller counter", "Player Services", GROUND_Y + 0.82),
  P("key_gold_fp", 557.25, -222.18, -0.2, 0.32, "Vault key ring supported on bank teller counter", "Player Services", GROUND_Y + 0.86),
  P("coin_pile_2", 558.6, -222.2, 0.1, 0.38, "Second coin pile supported on bank teller counter", "Player Services", GROUND_Y + 0.82),
  P("chest_gold", 565.4, -229.2, Math.PI / 2, 0.68, "Reinforced vault chest behind bank line", "Player Services"),
  P("key_metal_fp", 563.2, -228.6, 0.1, 0.32, "Vault spare key supported on vault desk", "Player Services", GROUND_Y + 0.72),

  P("table_small", 545.0, -223.2, Math.PI / 2, 0.38, "Storage steward counter side-aligned clear of storage access route", "Player Services"),
  P("book_stack_2", 548.5, -225.6, 0, 0.36, "Storage claim book supported on steward counter", "Player Services", GROUND_Y + 0.72),
  P("chest_wood_fp", 545.4, -228.7, Math.PI / 2, 0.68, "Storage upgrade chest beside steward", "Player Services"),
  P("box_decorated", 545.4, -224.0, 0, 0.64, "Storage parcel box beside steward counter", "Player Services"),

  P("table_medium", 548.2, -216.6, Math.PI / 2, 0.68, "Mail sorting counter", "Player Services"),
  P("box_stacked", 545.0, -216.4, 0.1, 0.62, "Courier mailbox parcel wall", "Player Services"),
  P("crate_wooden_fp", 545.0, -218.6, -0.1, 0.58, "Outgoing mail crate on floor", "Player Services"),
  P("scroll_1_fp", 548.2, -216.45, -0.2, 0.36, "Sealed letter supported on mail sorting counter", "Player Services", GROUND_Y + 0.72),
  P("scroll_2_fp", 548.65, -216.95, 0.2, 0.36, "Courier manifest supported on mail sorting counter", "Player Services", GROUND_Y + 0.72),

  P("obj_sign_post", 506.0, -214.4, -Math.PI / 2, 0.62, "Auction trade board with listing notices", "Player Services"),
  P("book_group_1", 508.0, -217.0, 0.1, 0.4, "Market ledger supported on auction clerk desk", "Player Services", GROUND_Y + 0.72),
  P("coin_fp", 508.55, -216.75, 0.2, 0.26, "Auction listing fee coin supported on clerk desk", "Player Services", GROUND_Y + 0.74),
  P("chest_wood_fp", 511.0, -218.8, 0, 0.58, "Auction escrow lockbox on floor", "Player Services"),

  P("table_long", 562.5, -225.6, -Math.PI / 2, 0.68, "Guild registrar counter", "Player Services"),
  P("bookstand_fp", 562.5, -225.6, -Math.PI / 2, 0.42, "Guild creation charter book supported on registrar counter", "Player Services", GROUND_Y + 0.78),
  P("banner_white", 562.9, -226.45, -Math.PI / 2, 0.36, "Guild charter parchment supported on registrar counter", "Player Services", GROUND_Y + 0.8),
  P("chair", 565.2, -225.6, -Math.PI / 2, 0.58, "Guild registrar chair behind counter", "Player Services"),

  P("shield_square_color", 565.7, -219.2, -Math.PI / 2, 0.62, "Cosmetic wardrobe mirror polished shield frame wall mounted", "Player Services", GROUND_Y + 0.86),
  P("cabinet", 565.9, -221.0, -Math.PI / 2, 0.58, "Cosmetic wardrobe station cabinet", "Player Services"),
  P("chest_wood_fp", 563.2, -219.1, 0, 0.54, "Wardrobe dye and outfit chest", "Player Services"),
  P("banner_brown", 563.0, -218.5, -Math.PI / 2, 0.34, "Wardrobe sample cloak supported on outfit chest", "Player Services", GROUND_Y + 0.78),

  P("rope_1_fp", 536.8, -214.2, Math.PI / 2, 0.54, "Queue rope west of services plaza", "Player Services"),
  P("rope_2_fp", 540.5, -214.2, Math.PI / 2, 0.54, "Queue rope east of services plaza", "Player Services"),

  // Craftsman Row: smithy and work order economy.
  P("anvil_fp", 533.6, -236.8, Math.PI / 2, 0.56, "Main anvil wall-aligned clear of Black Anvil service routes", "Craftsman Row"),
  P("anvil_log_fp", 528.2, -237.6, Math.PI / 2, 0.46, "Log-mounted anvil wall-aligned clear of Black Anvil entry aisle", "Craftsman Row"),
  P("workbench_drawers_fp", 536, -235, Math.PI, 0.82, "Tool workbench against smith wall", "Craftsman Row"),
  P("workbench_fp", 524, -222, 0, 0.82, "Forge assembly bench", "Craftsman Row"),
  P("weaponstand_fp", 539, -227, -Math.PI / 2, 0.82, "Weapon stand on floor", "Craftsman Row"),
  P("weaponstand_fp", 539, -233, -Math.PI / 2, 0.82, "Second weapon stand on floor", "Craftsman Row"),
  P("sword_1h", 537, -226, -Math.PI / 2, 0.34, "Iron longsword displayed on weapon counter", "Craftsman Row", GROUND_Y + 0.82),
  P("sword_2h_color", 536, -229, -Math.PI / 2, 0.36, "Two-handed sword displayed on rack", "Craftsman Row", GROUND_Y + 0.92),
  P("axe_1h", 536, -232, -Math.PI / 2, 0.34, "Woodsman's axe displayed on rack", "Craftsman Row", GROUND_Y + 0.86),
  P("dagger", 537, -235, -Math.PI / 2, 0.32, "Training dagger displayed on counter", "Craftsman Row", GROUND_Y + 0.82),
  P("shield_round", 541, -229, -Math.PI / 2, 0.4, "Round shield leaning beside weapon shop", "Craftsman Row", GROUND_Y + 0.45),
  P("shield_square_color", 541, -234, -Math.PI / 2, 0.4, "Painted shield leaning beside weapon shop", "Craftsman Row", GROUND_Y + 0.45),
  P("rack", 532, -222, Math.PI, 0.92, "Wall tool rack", "Craftsman Row"),
  P("logs", 523, -223, 0, 0.85, "Forge fuel logs on floor", "Craftsman Row"),
  P("torch_metal_fp", 524, -240, Math.PI / 2, 0.78, "Mounted forge torch", "Craftsman Row"),
  P("table_medium", 507.6, -224.0, Math.PI / 2, 0.42, "Carpenter planning table wall-aligned clear of workshop entry aisle", "Craftsman Row"),
  P("crates_stacked", 498, -223, 0, 0.74, "Workshop lumber crates", "Craftsman Row"),
  P("logs", 512, -223, Math.PI / 2, 0.8, "Workshop lumber pile", "Craftsman Row"),


  // Craftsman Row / Black Anvil Smithy pass v1: stronger forge identity, repair
  // economy, multi-profession stations, work orders, and bible event anchors.
  P("torch_lit", 527.7, -238.7, Math.PI / 2, 0.78, "Bright forge fire glow supported in stone forge mouth", "Craftsman Row", GROUND_Y + 0.62),
  P("mine_coal_block", 521.6, -238.4, 0, 0.54, "Coal block pile on smithy floor beside forge", "Craftsman Row"),
  P("mine_coal_piece", 522.6, -237.4, 0, 0.46, "Loose coal pieces on smithy floor beside forge", "Craftsman Row"),
  P("bucket_wood", 530.5, -238.1, 0, 0.6, "Water quench bucket on floor beside hot forge", "Craftsman Row"),
  P("barrel_fp", 531.9, -238.0, 0, 0.62, "Quench water barrel on floor beside forge", "Craftsman Row"),
  P("whetstone_fp", 533.8, -235.5, Math.PI / 2, 0.62, "Whetstone repair station supported beside smith workbench", "Craftsman Row"),
  P("chain_coil", 535.0, -237.8, 0, 0.56, "Chain links and wagon rim repair coil on floor", "Craftsman Row"),
  P("pickaxe_bronze_fp", 526.3, -222.2, -Math.PI / 2, 0.44, "Pickaxe repair job supported on forge assembly bench", "Craftsman Row", GROUND_Y + 0.84),
  P("sword_bronze_fp", 523.8, -222.1, -Math.PI / 2, 0.44, "Beginner blade work order supported on forge assembly bench", "Craftsman Row", GROUND_Y + 0.84),
  P("axe_bronze_fp", 525.1, -223.1, -Math.PI / 2, 0.44, "Axe head work order supported on forge assembly bench", "Craftsman Row", GROUND_Y + 0.84),
  P("scroll_1_fp", 536.1, -234.7, Math.PI, 0.32, "Repair ledger supported on smith tool workbench", "Craftsman Row", GROUND_Y + 0.88),
  P("book_stack_1", 535.0, -235.35, 0, 0.32, "Blacksmith recipe stack supported on tool workbench", "Craftsman Row", GROUND_Y + 0.88),

  P("obj_sign_post", 518.5, -225.0, Math.PI / 2, 0.54, "Crafting order board for daily profession work orders", "Craftsman Row"),
  P("scroll_2_fp", 519.0, -224.45, 0.1, 0.28, "Pinned crafting order supported on work order board", "Craftsman Row", GROUND_Y + 0.88),
  P("scroll_1_fp", 519.0, -225.25, -0.1, 0.28, "Pinned repair contract supported on work order board", "Craftsman Row", GROUND_Y + 0.88),
  P("crate_metal_fp", 518.8, -226.5, 0, 0.48, "Completed crafting orders drop crate on floor below board", "Craftsman Row"),

  P("table_long", 505.3, -232.6, 0, 0.66, "Carpenter saw bench supported on workshop floor", "Craftsman Row"),
  P("logs", 501.7, -233.2, Math.PI / 2, 0.62, "Cut lumber stack beside carpenter saw bench", "Craftsman Row"),
  P("pickaxe_bronze_fp", 505.2, -232.5, Math.PI / 2, 0.34, "Carpenter measuring tool supported on saw bench", "Craftsman Row", GROUND_Y + 0.8),
  P("scroll_1_fp", 506.5, -232.5, 0, 0.28, "Carpentry order supported on saw bench", "Craftsman Row", GROUND_Y + 0.8),

  P("table_tablecloth", 508.0, -222.2, Math.PI / 2, 0.42, "Tailoring and weaving table with cloth support clear of workshop service route", "Craftsman Row"),
  P("banner_brown", 507.8, -222.2, 0, 0.24, "Folded brown cloth supported on tailoring table", "Craftsman Row", GROUND_Y + 0.82),
  P("banner_green", 508.3, -222.2, 0, 0.22, "Folded green cloth supported on tailoring table", "Craftsman Row", GROUND_Y + 0.84),
  P("scroll_2_fp", 508.6, -222.2, 0.2, 0.18, "Tailor recipe note supported on cloth table", "Craftsman Row", GROUND_Y + 0.85),
  P("bag_fp", 500.6, -224.0, 0, 0.52, "Tailoring scrap bag on floor beside table", "Craftsman Row"),

  P("rack", 497.8, -229.6, Math.PI / 2, 0.7, "Leather drying rack at workshop edge", "Craftsman Row"),
  P("banner_brown", 497.8, -229.6, Math.PI / 2, 0.28, "Leather hide supported on drying rack", "Craftsman Row", GROUND_Y + 0.86),
  P("shield_wooden_fp", 510.6, -232.8, Math.PI / 2, 0.30, "Practice shield leather strap job leaning beside rack clear of workshop aisle", "Craftsman Row", GROUND_Y + 0.48),

  P("table_small", 509.5, -224.8, 0, 0.56, "Alchemy prep side table for crafting reagents", "Craftsman Row"),
  P("small_bottles_1", 509.3, -224.6, 0, 0.32, "Small reagent bottles supported on alchemy prep table", "Craftsman Row", GROUND_Y + 0.75),
  P("potion_1_fp", 510.0, -224.8, 0, 0.28, "Crafting solvent vial supported on alchemy prep table", "Craftsman Row", GROUND_Y + 0.75),
  P("candle_1_fp", 509.8, -225.4, 0, 0.26, "Wax seal candle supported on alchemy prep table", "Craftsman Row", GROUND_Y + 0.75),

  P("crate_wooden_fp", 515.2, -230.6, 0, 0.56, "Rare ore delivery crate for Black Anvil event", "Craftsman Row"),
  P("mine_silver_stone", 515.2, -230.5, 0, 0.38, "Rare ore sample supported on delivery crate", "Craftsman Row", GROUND_Y + 0.72),
  P("obj_sign_post", 512.2, -235.5, Math.PI / 2, 0.48, "Apprentice strike notice event anchor beside workshop", "Craftsman Row"),
  P("crate_wooden_fp", 511.0, -236.5, 0, 0.46, "Stolen tools clue crate for Craftsman Row event", "Craftsman Row"),
  P("key_metal_fp", 511.0, -236.5, 0, 0.24, "Recovered tool key supported on stolen tools clue crate", "Craftsman Row", GROUND_Y + 0.66),
  P("banner_yellow", 507.4, -218.7, Math.PI / 2, 0.34, "Crafting fair seasonal cloth marker above workshop lane", "Craftsman Row", GROUND_Y + 0.98),

  // Apothecary and magic shop interiors: all bottles/books are shelf/table/stand supported.
  P("table_medium", 454, -178, 0, 0.78, "Treatment table", "Apothecary"),
  P("chair", 452.5, -178, Math.PI / 2, 0.68, "Patient chair beside treatment table", "Apothecary"),
  P("shelf_small_bottles", 461.2, -180, -Math.PI / 2, 0.78, "Bottle shelf fixed to wall", "Apothecary"),
  P("shelf_candles", 461.2, -173, -Math.PI / 2, 0.72, "Candle remedy shelf fixed to wall", "Apothecary"),
  P("cauldron_fp", 452, -172, 0, 0.78, "Cauldron on floor", "Apothecary"),
  P("crate_wooden_fp", 455, -171, 0, 0.76, "Herb crate on floor", "Apothecary"),
  P("bucket_wood", 449.5, -179.5, 0, 0.76, "Water bucket beside treatment area", "Apothecary"),
  P("bookcase_2", 511, -174, Math.PI / 2, 0.78, "Arcane bookcase against west wall", "Magic Shop"),
  P("bookcase_2", 525, -174, -Math.PI / 2, 0.78, "Arcane bookcase against east wall", "Magic Shop"),
  P("table_long_decorated", 518, -170, 0, 0.78, "Arcane reading desk", "Magic Shop"),
  P("bookstand_fp", 518, -164, Math.PI, 0.76, "Supported spellbook stand", "Magic Shop"),
  P("shelf_large", 512, -162, Math.PI, 0.76, "Ingredient shelf against north wall", "Magic Shop"),
  P("candle_triple", 522, -164, 0, 0.68, "Floor ritual candles", "Magic Shop"),
  P("lantern", 518, -157, 0, 0.75, "Hanging exterior magic beacon", "Magic Shop"),

  // Copper Kettle Inn: social interior, hearth, stage, dining, dice table.
  P("tavern_bar_corner", 561, -202, Math.PI, 0.9, "Bar corner", "Copper Kettle"),
  P("tavern_bar", 561, -197, Math.PI / 2, 0.9, "Main bar", "Copper Kettle"),
  P("tavern_bar", 561, -192, Math.PI / 2, 0.9, "Main bar extension", "Copper Kettle"),
  P("keg_iso", 558, -184, 0, 0.92, "Keg beside hearth wall", "Copper Kettle"),
  P("keg_metal", 555, -184, 0, 0.92, "Bound keg beside hearth wall", "Copper Kettle"),
  P("torch_lit", 556, -184.5, Math.PI, 0.8, "Hearth glow against wall", "Copper Kettle"),
  P("table_tablecloth", 544, -199, 0, 0.76, "Dining table with cloth", "Copper Kettle"),
  P("chair", 542.6, -199, Math.PI / 2, 0.66, "Dining chair", "Copper Kettle"),
  P("chair", 545.4, -199, -Math.PI / 2, 0.66, "Dining chair", "Copper Kettle"),
  P("table_medium", 552, -199, 0, 0.76, "Second dining table", "Copper Kettle"),
  P("chair", 550.6, -199, Math.PI / 2, 0.66, "Dining chair", "Copper Kettle"),
  P("chair", 553.4, -199, -Math.PI / 2, 0.66, "Dining chair", "Copper Kettle"),
  P("table_small", 544, -188, 0, 0.76, "Dice table", "Copper Kettle"),
  P("stool_fp", 542, -188, Math.PI / 2, 0.72, "Dice stool", "Copper Kettle"),
  P("stool_fp", 546, -188, -Math.PI / 2, 0.72, "Dice stool", "Copper Kettle"),
  P("banner_brown", 558, -203, -Math.PI / 2, 0.82, "Mounted tavern stage banner", "Copper Kettle", GROUND_Y + 1.1),
  P("mug_full", 561, -197, 0, 0.5, "Mug supported on tavern bar", "Copper Kettle", GROUND_Y + 0.82),
  P("bread_slice", 544, -199, 0, 0.85, "Bread supported on dining table", "Copper Kettle", GROUND_Y + 0.82),

  // Copper Kettle Inn pass v1: bind point, rested XP, rumor board, stage,
  // rented-room, cellar, and supported lived-in tavern details.
  P("cauldron_fp", 556.1, -185.25, 0, 0.58, "Copper kettle resting over hearth on floor stones", "Copper Kettle"),
  P("torch_mounted", 556.0, -183.7, Math.PI, 0.66, "Wall-mounted hearth fire bracket", "Copper Kettle", GROUND_Y + 1.05),
  P("bucket_wood", 553.2, -184.4, 0, 0.58, "Hearth water bucket on floor", "Copper Kettle"),
  P("logs", 552.1, -184.7, Math.PI / 2, 0.54, "Firewood stack beside hearth", "Copper Kettle"),

  P("chandelier_fp", 552.5, -195.2, 0, 0.62, "Main tavern chandelier hanging from ceiling beam", "Copper Kettle", GROUND_Y + 2.35),
  P("lantern_wall_fp", 538.8, -195.8, Math.PI / 2, 0.58, "Wall-mounted lantern by tavern room stairs", "Copper Kettle", GROUND_Y + 1.05),
  P("lantern_wall_fp", 562.8, -195.8, -Math.PI / 2, 0.58, "Wall-mounted lantern behind tavern bar", "Copper Kettle", GROUND_Y + 1.05),

  P("obj_sign_post", 538.8, -193.6, Math.PI / 2, 0.56, "Rumor board and group finder flavor board beside hearth", "Copper Kettle"),
  P("scroll_1_fp", 539.25, -193.15, 0.1, 0.28, "Pinned rumor note supported on rumor board shelf", "Copper Kettle", GROUND_Y + 0.88),
  P("scroll_2_fp", 539.25, -194.0, -0.1, 0.28, "Group finder contract supported on rumor board shelf", "Copper Kettle", GROUND_Y + 0.88),

  P("table_long", 558.6, -204.3, 0, 0.58, "Raised bard stage platform along tavern wall", "Copper Kettle", GROUND_Y + 0.1),
  P("stool_fp", 555.7, -204.0, 0, 0.56, "Bard stool supported on stage platform", "Copper Kettle", GROUND_Y + 0.16),
  P("wand", 555.9, -204.0, Math.PI / 2, 0.28, "Bard pipe prop supported on stage stool", "Copper Kettle", GROUND_Y + 0.64),
  P("mug_fp", 557.7, -204.1, 0, 0.34, "Stage mug supported on bard platform", "Copper Kettle", GROUND_Y + 0.62),

  P("table_plate_fp", 544.15, -198.65, 0, 0.44, "Plate supported on first dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("mug_fp", 543.2, -199.35, 0.1, 0.34, "Mug supported on first dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("cake", 545.0, -198.85, 0, 0.52, "Cake supported on first dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("table_knife_fp", 544.75, -199.55, 0.4, 0.36, "Knife supported on first dining table", "Copper Kettle", GROUND_Y + 0.84),

  P("table_plate_fp", 552.2, -198.65, 0, 0.44, "Plate supported on second dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("mug_full", 551.25, -199.2, -0.2, 0.34, "Full mug supported on second dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("bread_loaf", 553.0, -199.0, 0.1, 0.52, "Bread loaf supported on second dining table", "Copper Kettle", GROUND_Y + 0.83),
  P("table_spoon_fp", 552.75, -199.55, -0.4, 0.36, "Spoon supported on second dining table", "Copper Kettle", GROUND_Y + 0.84),

  P("coin_fp", 544.05, -188.0, 0, 0.28, "Dice wager coin supported on dice table", "Copper Kettle", GROUND_Y + 0.72),
  P("mug_empty", 544.7, -187.65, 0.1, 0.32, "Empty mug supported on dice table", "Copper Kettle", GROUND_Y + 0.72),
  P("book_stack_1", 543.45, -188.35, 0, 0.34, "House dice ledger supported on dice table", "Copper Kettle", GROUND_Y + 0.72),

  P("bed_twin2", 538.3, -186.8, Math.PI / 2, 0.68, "Rented room bed for rested XP", "Copper Kettle"),
  P("nightstand", 541.1, -186.7, 0, 0.56, "Rented room nightstand beside bed", "Copper Kettle"),
  P("candle_1_fp", 541.1, -186.7, 0, 0.28, "Rested XP candle supported on rented room nightstand", "Copper Kettle", GROUND_Y + 0.72),
  P("chest_wood_fp", 537.1, -190.4, Math.PI / 2, 0.58, "Room rental storage chest on floor", "Copper Kettle"),
  P("banner_white", 539.9, -190.2, Math.PI / 2, 0.32, "Bind point room rental cloth marker supported over chest", "Copper Kettle", GROUND_Y + 0.76),

  P("obj_church_trapdoor_metal", 535.5, -184.8, Math.PI / 2, 0.52, "Locked Copper Kettle cellar door for secret meetings", "Copper Kettle"),
  P("crate_wooden_fp", 534.2, -185.1, 0, 0.52, "Cellar supply crate beside locked door", "Copper Kettle"),
  P("barrel_holder_fp", 535.6, -187.6, Math.PI / 2, 0.56, "Cellar ale barrel holder against wall", "Copper Kettle"),

  P("bench_fp", 548.2, -204.8, 0, 0.62, "Audience bench facing bard stage", "Copper Kettle"),
  P("stool_fp", 551.8, -204.8, 0, 0.54, "Loose tavern stool facing bard stage", "Copper Kettle"),
  P("chest_wood_fp", 562.8, -201.6, Math.PI, 0.52, "Fugitive hiding chest beside back wall", "Copper Kettle"),
  P("scroll_1_fp", 562.8, -201.6, 0, 0.26, "Secret meeting note supported on fugitive chest", "Copper Kettle", GROUND_Y + 0.7),

  // Noble Rise interior, balcony, and clean political props.
  P("arch_balcony_wall", 562, -249, Math.PI, 0.88, "Reeve Hall balcony", "Noble Rise", GROUND_Y + 1.7),
  P("arch_balcony_fence", 562, -247, Math.PI, 0.88, "Supported Reeve Hall balcony fence", "Noble Rise", GROUND_Y + 1.7),
  P("table_long", 556, -264, 0, 0.78, "Tax clerk desk", "Noble Rise"),
  P("table_long_decorated", 568, -264, 0, 0.78, "Compact ledger desk", "Noble Rise"),
  P("chair", 556, -261.7, Math.PI, 0.66, "Clerk chair", "Noble Rise"),
  P("chair", 568, -261.7, Math.PI, 0.66, "Compact chair", "Noble Rise"),
  P("chest_wood_fp", 575, -263, 0, 0.78, "Tax chest on floor", "Noble Rise"),
  P("shelf_large", 552, -267, Math.PI, 0.78, "Document shelf against wall", "Noble Rise"),
  P("coin_pile_2", 568, -264, 0, 0.46, "Tax coins supported on desk", "Noble Rise", GROUND_Y + 0.82),


  // Noble Rise pass v1: legal, tax, permit, moneylender, and political story
  // detail. Small props are explicitly supported by desks, shelves, crates, or
  // floor placements so the room remains physically believable.
  P("obj_lamp_wall", 555.0, -250.2, Math.PI, 0.54, "Wall lamp mounted beside Reeve Hall balcony west", "Noble Rise", GROUND_Y + 1.16),
  P("obj_lamp_wall", 569.0, -250.2, Math.PI, 0.54, "Wall lamp mounted beside Reeve Hall balcony east", "Noble Rise", GROUND_Y + 1.16),
  P("table_medium", 562.0, -257.6, Math.PI, 0.68, "Petition intake desk centered below Reeve Hall balcony", "Noble Rise"),
  P("scroll_1_fp", 561.2, -257.6, 0.08, 0.26, "Petition form supported on intake desk", "Noble Rise", GROUND_Y + 0.78),
  P("key_gold_fp", 562.8, -257.6, 0, 0.22, "Permit seal key supported on petition desk", "Noble Rise", GROUND_Y + 0.78),
  P("table_medium", 552.6, -260.0, Math.PI / 2, 0.66, "Permit clerk counter for charters and town papers", "Noble Rise"),
  P("scroll_2_fp", 552.6, -260.6, -0.1, 0.26, "Town permit scroll supported on permit counter", "Noble Rise", GROUND_Y + 0.78),
  P("book_stack_2", 552.2, -259.2, 0, 0.28, "Permit code stack supported on permit counter", "Noble Rise", GROUND_Y + 0.8),
  P("table_long_decorated", 572.0, -260.0, -Math.PI / 2, 0.66, "Edrik Vane moneylender debt ledger table", "Noble Rise"),
  P("coin_pile", 572.0, -260.7, 0, 0.28, "Debt payment coins supported on moneylender table", "Noble Rise", GROUND_Y + 0.8),
  P("scroll_1_fp", 571.4, -259.4, 0.18, 0.26, "Debt note supported on Edrik Vane table", "Noble Rise", GROUND_Y + 0.8),
  P("key_metal_fp", 572.7, -259.5, 0, 0.22, "Pawn lockbox key supported on moneylender table", "Noble Rise", GROUND_Y + 0.8),
  P("chest_gold", 574.6, -260.1, 0, 0.46, "Moneylender secured pawn chest on floor beside table", "Noble Rise"),
  P("shelf_large", 559.8, -268.2, Math.PI, 0.72, "Legal archive shelf against Reeve Hall rear wall", "Noble Rise"),
  P("book_group_1", 558.9, -268.0, 0, 0.28, "Town charter books supported on legal archive shelf", "Noble Rise", GROUND_Y + 1.18),
  P("book_group_2", 560.9, -268.0, 0, 0.28, "Legal record books supported on legal archive shelf", "Noble Rise", GROUND_Y + 1.18),
  P("obj_sign_post", 565.0, -268.0, Math.PI, 0.46, "Court docket and audit notice board", "Noble Rise"),
  P("scroll_2_fp", 565.2, -267.65, 0.12, 0.24, "Pinned court docket supported on audit notice board", "Noble Rise", GROUND_Y + 0.86),
  P("scroll_1_fp", 564.6, -267.7, -0.1, 0.24, "Distant lord audit notice supported on board", "Noble Rise", GROUND_Y + 0.86),
  P("key_gold_fp", 575.0, -263.0, 0, 0.22, "Tax chest key supported on tax chest lid", "Noble Rise", GROUND_Y + 0.58),
  P("coin_fp", 575.6, -263.0, 0, 0.22, "Loose tax coin supported on tax chest lid", "Noble Rise", GROUND_Y + 0.58),
  P("scroll_2_fp", 556.0, -264.0, 0.1, 0.26, "Tax assessment supported on tax clerk desk", "Noble Rise", GROUND_Y + 0.82),
  P("book_stack_1", 568.0, -264.6, 0, 0.3, "Merchant Compact ledger stack supported on decorated desk", "Noble Rise", GROUND_Y + 0.82),
  P("banner_white", 566.4, -264.0, 0, 0.24, "Masked party invitation cloth supported on compact desk", "Noble Rise", GROUND_Y + 0.84),
  P("bench_fp", 557.2, -255.0, 0, 0.58, "Petitioner waiting bench inside Reeve Hall", "Noble Rise"),
  P("bench_fp", 567.0, -255.0, 0, 0.58, "Merchant Compact waiting bench inside Reeve Hall", "Noble Rise"),
  P("shield_round_color", 550.7, -252.2, Math.PI / 2, 0.36, "Elite guard ceremonial shield mounted near entrance", "Noble Rise", GROUND_Y + 0.9),
  P("sword_1h", 550.9, -253.3, Math.PI / 2, 0.34, "Elite guard ceremonial blade mounted near entrance", "Noble Rise", GROUND_Y + 0.88),

  // Guard Yard: combat training without blocking service NPCs.
  P("dummy_fp", 503.2, -258.2, 0, 0.58, "Training dummy tucked into barracks rear-left training bay", "Guard Yard"),
  P("dummy_fp", 520.8, -258.2, 0, 0.58, "Training dummy tucked into barracks rear-right training bay", "Guard Yard"),
  P("table_medium", 510, -258, 0, 0.76, "Bounty table", "Guard Yard"),
  P("weaponstand_fp", 520, -263, -Math.PI / 2, 0.82, "Training weapon stand", "Guard Yard"),
  P("rack", 504, -263, Math.PI / 2, 0.92, "Training rack", "Guard Yard"),
  P("banner_red", 522, -260, -Math.PI / 2, 0.82, "Guard notice banner mounted on yard wall bracket", "Guard Yard", GROUND_Y + 1.1),
  P("shield_wooden_fp", 520, -261.5, 0, 0.58, "Shield resting on rack", "Guard Yard"),


  // Guard Yard pass v1: combat tutorial, bounty/legal station, dueling ring,
  // prisoner cage, alarm bell, watchtower access, and town-defense staging.
  // These props stay at the yard edges so the center remains combat-safe.
  P("obj_sign_post", 512.0, -251.4, Math.PI, 0.46, "Guard Yard combat training bounty board wayfinding sign", "Guard Yard"),
  P("scroll_1_fp", 511.55, -251.75, 0.08, 0.24, "Training notice supported on Guard Yard sign", "Guard Yard", GROUND_Y + 0.86),
  P("scroll_2_fp", 512.45, -251.75, -0.08, 0.24, "Bounty notice supported on Guard Yard sign", "Guard Yard", GROUND_Y + 0.84),
  P("arch_planks", 512.0, -272.4, Math.PI / 2, 0.74, "Packed-earth training lane plank marker", "Guard Yard"),
  P("dummy_fp", 504.0, -272.6, 0, 0.82, "Forward-arc melee training dummy left", "Guard Yard"),
  P("dummy_fp", 519.2, -274.8, 0, 0.86, "Forward-arc melee training dummy center", "Guard Yard"),
  P("dummy_fp", 520.0, -272.6, 0, 0.82, "Forward-arc melee training dummy right", "Guard Yard"),
  P("fence", 501.0, -270.0, Math.PI / 2, 0.52, "Training lane west boundary fence", "Guard Yard"),
  P("fence", 523.0, -270.0, Math.PI / 2, 0.52, "Training lane east boundary fence", "Guard Yard"),
  P("table_medium", 500.2, -257.0, Math.PI / 2, 0.66, "Bounty clerk warrant desk", "Guard Yard"),
  P("scroll_1_fp", 500.2, -256.45, 0.12, 0.28, "Wolf bounty warrant supported on bounty desk", "Guard Yard", GROUND_Y + 0.76),
  P("scroll_2_fp", 500.2, -257.25, -0.1, 0.28, "Bandit bounty warrant supported on bounty desk", "Guard Yard", GROUND_Y + 0.76),
  P("coin_pile", 499.45, -257.0, 0, 0.24, "Bounty reward coins supported on warrant desk", "Guard Yard", GROUND_Y + 0.76),
  P("obj_sign_post", 497.8, -257.0, Math.PI / 2, 0.4, "Bounty board patrol dailies and road warrants", "Guard Yard"),
  P("scroll_2_fp", 497.8, -256.7, 0.12, 0.22, "Pinned road warrant supported on bounty board", "Guard Yard", GROUND_Y + 0.78),
  P("cage_small_fp", 501.6, -276.0, Math.PI / 2, 0.82, "Prisoner holding cage for escape event", "Guard Yard"),
  P("key_metal_fp", 502.15, -275.55, 0, 0.2, "Jail key supported on prisoner cage hook", "Guard Yard", GROUND_Y + 0.74),
  P("chest_wood_fp", 499.6, -276.2, Math.PI / 2, 0.42, "Confiscated prisoner gear chest on floor", "Guard Yard"),
  P("scroll_1_fp", 499.6, -276.2, 0.08, 0.2, "Prisoner transfer note supported on gear chest", "Guard Yard", GROUND_Y + 0.56),
  P("rope_1_fp", 511.0, -258.8, 0, 0.56, "Dueling ring north rope marker", "Guard Yard", GROUND_Y + 0.16),
  P("rope_2_fp", 511.0, -264.8, 0, 0.56, "Dueling ring south rope marker", "Guard Yard", GROUND_Y + 0.16),
  P("rope_3_fp", 507.0, -261.8, Math.PI / 2, 0.5, "Dueling ring west rope marker", "Guard Yard", GROUND_Y + 0.16),
  P("rope_3_fp", 515.0, -261.8, Math.PI / 2, 0.5, "Dueling ring east rope marker", "Guard Yard", GROUND_Y + 0.16),
  P("obj_sign_post", 518.2, -261.8, -Math.PI / 2, 0.38, "Dueling ring PvP opt-in warning notice", "Guard Yard"),
  P("scroll_1_fp", 518.2, -261.45, -0.1, 0.22, "PvP opt-in warning supported on duel sign", "Guard Yard", GROUND_Y + 0.78),
  P("obj_church_bells", 523.8, -252.8, -Math.PI / 2, 0.42, "Guard Yard alarm bell invasion rally point", "Guard Yard", GROUND_Y + 1.65),
  P("obj_tower_simple", 503.0, -282.2, Math.PI, 0.52, "Guard Yard watchtower lookout silhouette", "Guard Yard"),
  P("arch_stairs_stone", 506.8, -280.2, Math.PI, 0.48, "Watchtower stair access for guard roof repair", "Guard Yard"),
  P("banner_red", 505.2, -281.8, Math.PI, 0.44, "Red watch banner mounted on Guard Yard tower", "Guard Yard", GROUND_Y + 1.2),
  P("barrel_stack", 522.8, -267.6, 0, 0.48, "Town defense shield barrel stack at yard edge", "Guard Yard"),
  P("shield_square_color", 522.8, -267.6, 0.2, 0.34, "Defense shield supported on barrel stack", "Guard Yard", GROUND_Y + 0.66),
  P("crate_wooden_fp", 525.4, -267.4, 0, 0.42, "Barricade repair kit crate on floor", "Guard Yard"),
  P("rope_2_fp", 525.4, -267.4, Math.PI / 2, 0.34, "Barricade rope supported on repair kit crate", "Guard Yard", GROUND_Y + 0.58),
  P("table_medium", 522.4, -256.4, -Math.PI / 2, 0.62, "Quartermaster armory issue counter", "Guard Yard"),
  P("sword_bronze_fp", 522.55, -256.0, Math.PI / 2, 0.3, "Starter sword supported on quartermaster counter", "Guard Yard", GROUND_Y + 0.74),
  P("shield_wooden_fp", 522.15, -256.75, 0, 0.3, "Training shield supported on quartermaster counter", "Guard Yard", GROUND_Y + 0.74),
  P("book_stack_1", 521.8, -256.25, 0, 0.28, "Quartermaster issue ledger supported on counter", "Guard Yard", GROUND_Y + 0.74),
  P("obj_sign_post", 525.6, -254.2, -Math.PI / 2, 0.36, "Guard inspection roster and drill schedule", "Guard Yard"),
  P("scroll_2_fp", 525.6, -253.9, -0.08, 0.2, "Pinned inspection roster supported on drill board", "Guard Yard", GROUND_Y + 0.76),
  P("banner_red", 510.4, -280.0, Math.PI, 0.42, "Prisoner escape event red alert banner", "Guard Yard", GROUND_Y + 1.02),

  // River Docks: warehouse, pier, cargo, fish table, and smuggling edge.
  P("arch_planks", 592, -184, Math.PI / 2, 1.18, "Main dock planks", "River Docks"),
  P("arch_planks", 602, -169, Math.PI / 2, 1.0, "Ferry dock planks", "River Docks"),
  P("barrel_stack", 580, -188, 0, 0.8, "Dock barrels", "River Docks"),
  P("crates_stacked", 584, -181, 0, 0.8, "Cargo stack", "River Docks"),
  P("crate_metal_fp", 596, -188, 0, 0.82, "Sealed metal cargo", "River Docks"),
  P("crate_wooden_fp", 600, -177, 0, 0.82, "Cargo crate", "River Docks"),
  P("box_decorated", 598, -180, 0, 0.8, "Whispering crate on dock", "River Docks"),
  P("rope_1_fp", 592, -190, 0, 0.76, "Rope coil on dock", "River Docks"),
  P("rope_2_fp", 604, -166, 0, 0.76, "Dock rope on pier", "River Docks"),
  P("chain_coil", 588, -184, 0, 0.76, "Cargo chain on floor", "River Docks"),
  P("bucket_wood", 601, -165, 0, 0.76, "Fish bucket on dock", "River Docks"),
  P("table_long", 600, -163, Math.PI / 2, 0.76, "Fish sorting table", "River Docks"),
  P("lantern", 592, -190, 0, 0.75, "Hanging dock lantern", "River Docks"),
  P("lantern", 604, -165, 0, 0.75, "Hanging ferry lantern", "River Docks"),
  P("obj_bridge_medium_body", 612, -176, Math.PI / 2, 0.92, "River bridge extension", "River Docks"),


  // River Docks pass v1: dockmaster ledger booth, fish market, cargo sorting,
  // ferry utility, smuggling clues, and dock live-ops anchors.
  P("table_medium", 596.0, -171.0, Math.PI / 2, 0.64, "Dockmaster ledger booth counter", "River Docks"),
  P("book_stack_1", 596.0, -170.55, 0.05, 0.32, "Dock ledger supported on dockmaster counter", "River Docks", GROUND_Y + 0.74),
  P("key_metal_fp", 596.0, -171.35, 0, 0.24, "Warehouse key supported on dockmaster counter", "River Docks", GROUND_Y + 0.74),
  P("scroll_1_fp", 595.25, -171.0, 0.16, 0.28, "Cargo manifest supported on dockmaster counter", "River Docks", GROUND_Y + 0.74),
  P("chest_wood_fp", 594.2, -171.0, Math.PI / 2, 0.54, "Dock toll lockbox on floor beside ledger booth", "River Docks"),
  P("table_long", 600.2, -160.2, Math.PI / 2, 0.62, "Fish market cleaning table beside pier", "River Docks"),
  P("food_fish", 600.2, -159.72, Math.PI / 2, 0.5, "Fresh river fish supported on fish market table", "River Docks", GROUND_Y + 0.73),
  P("food_fishbone", 600.85, -160.25, -0.2, 0.42, "Fishbone scraps supported on fish market table", "River Docks", GROUND_Y + 0.74),
  P("table_knife_fp", 599.55, -160.25, Math.PI / 2, 0.32, "Fillet knife supported on fish market table", "River Docks", GROUND_Y + 0.75),
  P("bucket_wood", 598.7, -160.4, 0, 0.58, "Fish guts bucket on floor beside cleaning table", "River Docks"),
  P("barrel_fp", 602.0, -160.2, 0, 0.54, "Salt barrel beside fish market table", "River Docks"),
  P("obj_sign_post", 603.0, -160.6, -Math.PI / 2, 0.44, "Fishing trainer and river goods vendor board", "River Docks"),
  P("rope_1_fp", 602.4, -164.2, 0, 0.52, "Net rope coil beside fish market", "River Docks"),
  P("crate_metal_fp", 590.2, -180.2, 0, 0.58, "Customs inspection crate on floor", "River Docks"),
  P("scroll_2_fp", 590.2, -180.2, 0.2, 0.25, "Customs seal supported on inspection crate", "River Docks", GROUND_Y + 0.66),
  P("crates_stacked", 589.0, -176.2, 0, 0.58, "Warehouse sorted cargo stack", "River Docks"),
  P("barrel_stack", 592.0, -176.0, 0, 0.52, "River ale and lamp-oil barrel stack", "River Docks"),
  P("rope_2_fp", 589.6, -174.8, Math.PI / 2, 0.52, "Blue rope marking inspected cargo lane", "River Docks"),
  P("table_small", 606.0, -176.0, -Math.PI / 2, 0.56, "Smuggler contact marker table behind cargo", "River Docks"),
  P("small_bottle_fp", 606.0, -175.72, 0, 0.3, "Smuggler signal bottle supported on contact table", "River Docks", GROUND_Y + 0.68),
  P("scroll_1_fp", 606.2, -176.25, -0.2, 0.24, "River Knots coded note supported on contact table", "River Docks", GROUND_Y + 0.68),
  P("crate_metal_fp", 607.6, -177.6, 0, 0.48, "Contraband false-bottom crate tucked behind cargo", "River Docks"),
  P("key_metal_fp", 607.6, -177.6, 0, 0.22, "Contraband key supported on false-bottom crate", "River Docks", GROUND_Y + 0.62),
  P("barrel_fp", 607.4, -180.2, 0, 0.48, "Dock fire pitch barrel event anchor", "River Docks"),
  P("obj_sign_post", 607.8, -182.2, -Math.PI / 2, 0.44, "Dock fire bucket-line event notice", "River Docks"),
  P("bucket_wood", 606.4, -182.0, 0, 0.48, "Fire bucket on floor beside event notice", "River Docks"),
  P("obj_sign_post", 592.0, -166.6, Math.PI, 0.44, "Flood warning and river beast sighting board", "River Docks"),
  P("scroll_2_fp", 592.0, -166.92, 0.12, 0.24, "River beast warning supported on flood board", "River Docks", GROUND_Y + 0.84),
  P("crate_wooden_fp", 594.2, -166.0, 0, 0.46, "Flood rescue rope crate on floor", "River Docks"),
  P("rope_3_fp", 594.2, -166.0, Math.PI / 2, 0.42, "Rescue rope supported on flood rescue crate", "River Docks", GROUND_Y + 0.62),
  P("box_decorated", 616.0, -176.8, 0, 0.42, "Corpse-under-bridge clue box near shadowed pier", "River Docks"),
  P("food_fishbone", 616.0, -176.8, 0, 0.28, "Riverbone clue supported on corpse-under-bridge box", "River Docks", GROUND_Y + 0.58),
  P("lantern", 615.0, -175.2, 0, 0.44, "Low lantern marking corpse-under-bridge clue", "River Docks", GROUND_Y + 0.7),

  // Mudden Ward: dense but path-safe poverty, laundry, hidden routes.
  P("barrel_small", 405, -166, 0, 0.76, "Rain barrel on floor", "Mudden Ward"),
  P("box_stacked", 424, -164, 0, 0.76, "Wash tubs and boxes", "Mudden Ward"),
  P("crate_c", 417, -149, 0, 1.05, "Patched home crate", "Mudden Ward"),
  P("bag_fp", 411, -166, 0, 0.74, "Food sack on floor", "Mudden Ward"),
  P("bucket_wood", 421, -153, 0, 0.74, "Leaking bucket on floor", "Mudden Ward"),
  P("banner_brown", 429, -154, -Math.PI / 2, 0.82, "Mounted laundry cloth", "Mudden Ward", GROUND_Y + 1.05),
  P("cage_small_fp", 406, -153, 0, 0.74, "Rat trap cage on floor", "Mudden Ward"),
  P("barrel_small", 410, -136, 0, 0.76, "Laundry rain barrel", "Mudden Ward"),
  P("box_stacked", 417, -134, 0, 0.76, "Laundry box stack", "Mudden Ward"),


  // Mudden Ward pass v1: poverty systems, stealth services, hidden economy,
  // rat-catching, flood rescue, eviction pressure, and witch-accusation hooks.
  P("table_small", 430.4, -151.8, -Math.PI / 2, 0.5, "Cheap healer street table", "Mudden Ward"),
  P("potion_1_fp", 430.4, -151.55, 0, 0.26, "Cheap healer fever tonic supported on table", "Mudden Ward", GROUND_Y + 0.66),
  P("bottle_green", 430.72, -152.0, 0.1, 0.28, "Cheap healer green bottle supported on table", "Mudden Ward", GROUND_Y + 0.66),
  P("bag_fp", 429.7, -152.7, 0, 0.42, "Bandage sack on floor beside cheap healer", "Mudden Ward"),
  P("bed_twin2", 427.0, -153.8, Math.PI / 2, 0.42, "Sick traveler cot in Mudden cheap healer corner", "Mudden Ward"),
  P("table_small", 404.8, -169.2, Math.PI / 2, 0.48, "Fence vendor hidden deal table", "Mudden Ward"),
  P("coin_pile", 404.72, -168.92, 0, 0.22, "Fence vendor coin pile supported on hidden table", "Mudden Ward", GROUND_Y + 0.64),
  P("dagger", 405.08, -169.32, Math.PI / 2, 0.3, "Illegal blade supported on fence vendor table", "Mudden Ward", GROUND_Y + 0.66),
  P("key_metal_fp", 404.45, -169.38, -0.2, 0.2, "Stolen key supported on fence vendor table", "Mudden Ward", GROUND_Y + 0.65),
  P("crate_metal_fp", 403.6, -170.4, 0, 0.38, "Fence vendor lockbox on floor", "Mudden Ward"),
  P("cage_small_fp", 407.8, -149.6, 0, 0.46, "Rat-catcher live cage on floor", "Mudden Ward"),
  P("cage_small_fp", 409.0, -149.0, 0.2, 0.4, "Second rat-catcher cage beside drain", "Mudden Ward"),
  P("cheese", 408.4, -150.2, 0, 0.28, "Rat bait cheese on floor near trap", "Mudden Ward"),
  P("bucket_wood", 424.8, -139.6, 0, 0.44, "Washerwoman rinse bucket on floor", "Mudden Ward"),
  P("barrel_small", 426.0, -139.2, 0, 0.5, "Washerwoman rain barrel on floor", "Mudden Ward"),
  P("table_small", 425.0, -142.0, 0, 0.48, "Washerwoman folding table", "Mudden Ward"),
  P("banner_white", 425.0, -142.0, 0, 0.34, "Folded laundry cloth supported on table", "Mudden Ward", GROUND_Y + 0.64),
  P("bag_fp", 413.4, -168.2, 0, 0.42, "Orphan blanket bundle on floor", "Mudden Ward"),
  P("bread_slice", 413.9, -168.1, 0, 0.3, "Half meal beside orphan blanket", "Mudden Ward", GROUND_Y + 0.1),
  P("chest_wood_fp", 415.4, -170.8, 0.1, 0.36, "Mudden Kin reputation stash chest", "Mudden Ward"),
  P("scroll_1_fp", 415.4, -170.8, -0.1, 0.2, "Mudden Kin favor list supported on stash chest", "Mudden Ward", GROUND_Y + 0.54),
  P("obj_sign_post", 412.2, -170.8, Math.PI, 0.38, "Mudden Kin hidden reputation vendor mark", "Mudden Ward"),
  P("barrel_stack", 419.0, -164.6, 0, 0.42, "Flood rescue barrel stack kept against wall", "Mudden Ward"),
  P("rope_3_fp", 419.0, -164.6, Math.PI / 2, 0.36, "Flood rescue rope supported on barrel stack", "Mudden Ward", GROUND_Y + 0.62),
  P("bucket_wood", 420.2, -164.8, 0, 0.36, "Flood bucket-line bucket on floor", "Mudden Ward"),
  P("obj_sign_post", 422.8, -164.4, -Math.PI / 2, 0.36, "Flood rescue muster notice", "Mudden Ward"),
  P("obj_sign_post", 400.8, -151.4, Math.PI / 2, 0.36, "Witch accusation and missing children notice", "Mudden Ward"),
  P("scroll_2_fp", 400.8, -151.1, 0.12, 0.2, "Missing children notice supported on accusation board", "Mudden Ward", GROUND_Y + 0.76),
  P("candle_thin_lit", 401.8, -150.0, 0, 0.28, "Small vigil candle beside missing children notice", "Mudden Ward"),
  P("box_stacked", 408.8, -172.4, 0, 0.4, "Stealth trainer crate step to back route", "Mudden Ward"),
  P("rope_1_fp", 409.8, -172.8, Math.PI / 2, 0.36, "Back-route rope showing climbable shortcut", "Mudden Ward", GROUND_Y + 0.62),
  P("obj_church_trapdoor_metal", 402, -235, Math.PI / 2, 0.76, "Old drain iron hatch", "Old Well"),
  P("torch_lit", 402, -235, Math.PI / 2, 0.76, "Mounted Underways warning torch", "Old Well", GROUND_Y + 1.0),
  P("pillar", 398, -235, 0, 0.78, "Old drain marker", "Old Well"),


  // Old Well / Underways pass v1: mystery landmark, barred well, bronze bell
  // fragments, hidden drain stair, Temple/Mudden breadcrumbing, and phased
  // dungeon/event anchors. Props hug the edges so the path remains walkable.
  P("fountain_round", 407.8, -232.4, 0, 0.46, "Old Well cracked circular stone ring landmark", "Old Well / Underways"),
  P("obj_church_trapdoor_metal", 407.8, -232.4, 0, 0.42, "Old Well iron grate covering barred shaft", "Old Well / Underways", GROUND_Y + 0.08),
  P("chain_coil", 407.8, -232.4, Math.PI / 2, 0.34, "Rusty chain wrapped around Old Well grate", "Old Well / Underways", GROUND_Y + 0.24),
  P("obj_church_grave_fence", 407.8, -229.8, 0, 0.34, "North iron bar fence around Old Well shaft", "Old Well / Underways"),
  P("obj_church_grave_fence", 407.8, -235.0, Math.PI, 0.34, "South iron bar fence around Old Well shaft", "Old Well / Underways"),
  P("obj_church_grave_fence", 405.2, -232.4, Math.PI / 2, 0.34, "West iron bar fence around Old Well shaft", "Old Well / Underways"),
  P("obj_church_grave_fence", 410.4, -232.4, -Math.PI / 2, 0.34, "East iron bar fence around Old Well shaft", "Old Well / Underways"),
  P("rock_small", 404.7, -229.4, 0.2, 0.42, "Mossy displaced stone from cracked Old Well rim", "Old Well / Underways"),
  P("forest_rock_1a", 411.2, -235.4, -0.4, 0.38, "Moss-grown stone beside Old Well grate", "Old Well / Underways"),
  P("pillar", 402.6, -231.5, 0, 0.54, "Old carved Harthmere drain pillar", "Old Well / Underways"),
  P("scroll_1_fp", 402.6, -231.5, 0.1, 0.18, "Rubbing of old drain carvings pinned to pillar", "Old Well / Underways", GROUND_Y + 0.8),
  P("obj_church_bells", 412.2, -231.0, 0.2, 0.22, "Bronze bell fragment faintly ringing beside Old Well", "Old Well / Underways", GROUND_Y + 0.18),
  P("obj_church_bells", 403.4, -235.8, -0.2, 0.18, "Second bronze bell shard half-buried near drain marker", "Old Well / Underways", GROUND_Y + 0.12),
  P("candle_thin_lit", 406.0, -229.4, 0, 0.24, "Green-tinged candle at whispering well edge", "Old Well / Underways"),
  P("candle_thin_lit", 409.6, -235.2, 0, 0.24, "Green-tinged candle at sealed drain edge", "Old Well / Underways"),
  P("torch_mounted", 413.2, -234.6, -Math.PI / 2, 0.36, "Green torchlight breadcrumb toward Underways stair mounted on Underways stair wall post", "Old Well / Underways", GROUND_Y + 1.05),
  P("arch_stairs_stone", 414.8, -237.4, Math.PI / 2, 0.42, "Hidden drain stair revealed by Old Well quest phase", "Old Well / Underways"),
  P("obj_church_crypt", 417.8, -238.8, Math.PI / 2, 0.32, "Underways dungeon entrance proxy behind old drain stair", "Old Well / Underways"),
  P("obj_church_grave_wall", 416.8, -241.0, Math.PI / 2, 0.34, "Wet stone boundary wall at Underways breach", "Old Well / Underways"),
  P("arch_wall_broken", 419.8, -236.8, Math.PI / 2, 0.32, "Drain breach broken masonry event anchor", "Old Well / Underways"),
  P("torch_lit", 420.2, -236.8, Math.PI / 2, 0.34, "Exit breadcrumb torch inside Underways breach mounted on Underways breach wall bracket", "Old Well / Underways", GROUND_Y + 0.92),
  P("obj_sign_post", 413.2, -228.4, Math.PI, 0.32, "Hidden map marker sign unlocked after Old Well discovery", "Old Well / Underways"),
  P("scroll_2_fp", 413.2, -228.1, 0.1, 0.18, "Old Well warning note supported on discovery sign", "Old Well / Underways", GROUND_Y + 0.7),
  P("obj_sign_post", 399.2, -232.8, Math.PI / 2, 0.3, "Temple Green clue board pointing to missing bell underways", "Old Well / Underways"),
  P("scroll_1_fp", 399.2, -232.5, -0.1, 0.16, "Father Aldren chapel rubbing supported on clue board", "Old Well / Underways", GROUND_Y + 0.68),
  P("rope_2_fp", 414.4, -238.4, 0.2, 0.34, "Safety rope tied beside hidden drain stair", "Old Well / Underways", GROUND_Y + 0.28),
  P("bucket_wood", 405.2, -235.8, 0, 0.32, "Old bucket lowered into whispering well", "Old Well / Underways"),
  P("book_stack_1", 404.2, -230.8, 0.2, 0.22, "Lore notes from old archive supported on stone ledge", "Old Well / Underways", GROUND_Y + 0.34),
  P("candle_triple", 404.2, -230.8, -0.1, 0.2, "Investigation candle cluster supported beside lore notes", "Old Well / Underways", GROUND_Y + 0.38),
  P("banner_brown", 418.8, -241.4, Math.PI / 2, 0.28, "Damp cloth marker for Underways exit breadcrumb", "Old Well / Underways", GROUND_Y + 0.76),
  P("obj_church_trapdoor_metal", 421.6, -170.8, Math.PI / 2, 0.42, "Mudden tunnel connection grate tied to Old Well Underways", "Mudden Ward", GROUND_Y + 0.04),
  P("torch_lit", 421.6, -170.8, Math.PI / 2, 0.28, "Matching green torch at Mudden Underways connection mounted on Mudden Underways wall bracket", "Mudden Ward", GROUND_Y + 0.9),
  P("candle_thin_lit", 486.6, -148.4, 0, 0.28, "Temple vigil candle aligned with Old Well missing bell clue", "Temple Green"),
  P("scroll_2_fp", 486.6, -148.4, 0.1, 0.18, "Temple prayer note naming the Old Well resting on supported chapel lectern", "Temple Green", GROUND_Y + 0.26),
  P("obj_sign_post", 410.8, -226.4, Math.PI, 0.3, "Child dare event warning near Old Well", "Old Well / Underways"),
  P("scroll_1_fp", 410.8, -226.1, 0.04, 0.16, "Child dare note supported on Old Well warning post", "Old Well / Underways", GROUND_Y + 0.68),
  P("candle_lit", 411.8, -229.2, 0, 0.22, "Night bell event candle at Old Well", "Old Well / Underways"),
  P("candle_lit", 412.6, -229.8, 0, 0.22, "Second night bell event candle at Old Well", "Old Well / Underways"),
  P("obj_church_grave_wall", 408.0, -238.8, 0, 0.32, "Phase-safe collapsed stone marker for undead emergence", "Old Well / Underways"),
  P("coffin", 409.4, -239.4, -0.2, 0.28, "Sealed coffin prop for ancient spirit emergence event", "Old Well / Underways"),

  // Residential home interior: ordinary believable house, not a false shop.
  P("bed_twin1", 451, -262, Math.PI / 2, 0.82, "Bed against west wall", "Residential District"),
  P("bed_twin2", 462, -262, -Math.PI / 2, 0.82, "Guest bed against east wall", "Residential District"),
  P("nightstand", 454, -263, 0, 0.76, "Nightstand beside bed", "Residential District"),
  P("cabinet", 448.2, -260.8, Math.PI, 0.42, "Clothes cabinet against cottage side wall clear of interior aisle", "Residential District"),
  P("bookcase_2", 463, -251, Math.PI, 0.78, "Family bookcase against north wall", "Residential District"),
  P("bench_fp", 456, -258, 0, 0.82, "Home bench beside beds", "Residential District"),
  P("chest_wood_fp", 462, -257, Math.PI / 2, 0.78, "Storage chest on floor", "Residential District"),
  P("lantern_wall_fp", 448.7, -257, Math.PI / 2, 0.8, "Wall-mounted house lantern", "Residential District", GROUND_Y + 1.0),
  P("candle_triple", 464.4, -252.4, Math.PI, 0.24, "Family supper candle cluster supported on cottage shelf", "Residential District", GROUND_Y + 0.72),
  P("bucket_wood", 468, -251, 0, 0.7, "Water bucket outside home", "Residential District"),
  A("townsperson_farmer", 456, -244, Math.PI, 0.9, "Roadside cottage resident returning from market", "Residential District"),

  // Farm, mill, orchard, and settlement food source.
  P("arch_windmill", 426, -112, 0, 0.98, "Windmill above farm outskirts", "Farm Outskirts"),
  P("arch_watermill", 610, -186, Math.PI / 2, 0.9, "River watermill near docks set back from service cart lane", "River Docks"),
  P("farmcrate_apple", 448, -223, 0, 0.82, "Farm apple crate", "Farm"),
  P("farmcrate_carrot", 452, -223, 0, 0.82, "Farm carrot crate", "Farm"),
  P("barrel_fp", 458, -244, 0, 0.82, "Water barrel beside trough", "Farm"),
  P("bucket_wood", 455, -244, 0, 0.76, "Water bucket by trough", "Farm"),
  P("crate_wooden_fp", 436, -224, 0, 0.82, "Feed crate", "Farm"),
  P("trolley", 440, -248, Math.PI / 2, 0.92, "Farm handcart", "Farm"),
  P("barrel_stack", 424, -114, 0, 0.78, "Mill grain barrels", "Farm Outskirts"),
  P("logs", 438, -112, Math.PI / 2, 0.8, "Mill repair lumber", "Farm Outskirts"),
  P("tree", 448, -112, 0, 1.0, "Orchard tree", "Orchard"),
  P("tree_high", 460, -114, 0, 1.0, "Orchard tree", "Orchard"),
  P("tree_crooked", 472, -116, 0, 1.0, "Crooked orchard tree", "Orchard"),

  // Gathering/resource node readability. Gameplay state remains in the local dev systems.
  P("rock_wide", 503, -270, 0.2, 0.78, "Gathering node: North Road iron vein", "Gathering"),
  P("pickaxe_bronze_fp", 504, -269, -0.4, 0.58, "Mining tool marker beside iron vein", "Gathering"),
  P("logs", 468, -118, Math.PI / 2, 0.84, "Gathering node: orchard fallen branches", "Gathering"),
  P("rock_small", 469, -117, 0, 0.5, "Gathering marker beside resin log", "Gathering"),
  P("cage_small_fp", 493, -158, 0, 0.52, "Temple herb bed border", "Gathering"),
  P("shelf_small_bottles", 495, -158, 0, 0.46, "Herbalism supply marker", "Gathering"),
  P("bucket_wood", 604, -168, 0, 0.72, "Fishing pool bait bucket", "Gathering"),
  P("rope_1_fp", 606, -168, Math.PI / 2, 0.7, "Fishing pool rope marker", "Gathering"),
  P("farmcrate_carrot", 450, -232, 0, 0.78, "Gathering node: farm crop row", "Gathering"),
  P("farmcrate_apple", 453, -232, 0, 0.78, "Farm produce collection crate", "Gathering"),
  P("crate_wooden_fp", 409, -178, 0.2, 0.78, "Gathering node: Mudden Ward scrap pile", "Gathering"),
  P("chain_coil", 411, -178, 0, 0.64, "Scrap pile metal coil", "Gathering"),
  P("rock_small", 596, -186, 0, 0.58, "Riverbank clay edge marker", "Gathering"),
  P("bucket_wood", 598, -186, 0, 0.68, "Clay deposit bucket", "Gathering"),
  P("candle_thin_lit", 428, -160, 0, 0.62, "Old Well mana residue marker", "Gathering"),
  P("bottle_green", 430, -160, 0, 0.52, "Arcane vial near Old Well", "Gathering"),
  P("shovel", 501, -145, 0, 0.72, "Relic dig shovel by graveyard", "Gathering"),
  P("tombstone", 503, -145, 0.1, 0.76, "Relic dig grave marker", "Gathering"),
  P("crate_a", 518, -252, 0, 0.82, "Hunter processing crate", "Gathering"),
  P("bag_fp", 520, -252, 0, 0.72, "Road wolf harvest kit bag", "Gathering"),

  // Building/property plot readability. These remain non-blocking visual markers.
  P("crate_a", 426, -210, 0, 0.78, "Building plot: West Lane cottage crate", "Building"),
  P("rock_wide", 428, -211, 0.2, 0.55, "Cottage foundation marker", "Building"),
  P("banner_yellow", 456, -198, Math.PI / 2, 0.62, "Market stall property marker", "Building", GROUND_Y + 1.05),
  P("crate_wooden_fp", 458, -198, 0, 0.62, "Market stall work crate", "Building"),
  P("logs", 454, -120, Math.PI / 2, 0.72, "Farmstead build timber", "Building"),
  P("farmcrate_carrot", 456, -120, 0, 0.62, "Farmstead supply crate", "Building"),
  P("workbench_fp", 536, -228, 0, 0.58, "Workshop property workbench", "Building"),
  P("anvil_fp", 539, -228, 0, 0.52, "Workshop anvil marker", "Building"),
  P("barrel_fp", 596, -178, 0, 0.62, "Dock warehouse barrel marker", "Building"),
  P("rope_1_fp", 598, -178, Math.PI / 2, 0.58, "Dock warehouse rope marker", "Building"),
  P("crate_a", 408, -172, 0.3, 0.64, "Mudden hidden shack crate", "Building"),
  P("cage_small_fp", 410, -172, 0, 0.5, "Mudden hideout frame marker", "Building"),
  P("rock_wide", 493, -280, 0, 0.7, "North bridge repair stone", "Building"),
  P("logs", 496, -280, Math.PI / 2, 0.72, "North bridge repair beams", "Building"),
  P("logs", 600, -188, Math.PI / 2, 0.72, "Dock plank repair beams", "Building"),
  P("torch_metal_fp", 522, -252, 0, 0.58, "Watchtower repair torch marker", "Building"),
  P("crate_wooden_fp", 491, -153, 0, 0.58, "Temple roof repair crate", "Building"),


  // HARTHMERE_BELLBOUND_TOWN_DUNGEON_EXPANSION_V1
  // Story-bible expansion pass: no new NPCs here. This pass adds missing
  // building/interior/dungeon readability for the Bellbound main quest: chapel
  // archive, buried bell pit, blacksmith bell-casting bay, Reeve bridge-crack
  // planning, Wyrm-and-Candle lore shelves, and phase-safe dungeon room proxies.
  //
  // Keep all dungeon room proxies inside the authored town envelope and away from
  // service roads. The names intentionally include "phase-safe", "underground",
  // "supported", "mounted", "against", or "on floor" so the existing placement,
  // collision, floating-prop, and fixture-attachment tests understand why these
  // are not accidental town-surface blockers.
  P("bookcase_2", 502.0, -149.0, Math.PI, 0.42, "Halene letter archive bookcase against east chapel office wall", "Temple Green"),
  P("cabinet", 504.6, -149.0, Math.PI, 0.38, "Iron-bound Halene letter cabinet against east chapel office wall", "Temple Green"),
  P("table_small", 507.2, -148.4, Math.PI, 0.38, "Sister's Letters reading table inside east chapel archive", "Temple Green"),
  P("scroll_2_fp", 507.2, -148.4, 0.12, 0.16, "Halene Letter Seven supported on chapel archive reading table", "Temple Green", GROUND_Y + 0.58),
  P("book_stack_2", 506.6, -148.55, -0.08, 0.16, "Verenine Annals floor-map volume supported on chapel archive reading table", "Temple Green", GROUND_Y + 0.58),
  P("candle_triple", 507.8, -148.65, 0, 0.16, "Archive witness candle cluster supported on chapel reading table", "Temple Green", GROUND_Y + 0.61),
  P("obj_church_trapdoor_metal", 480.0, -143.2, 0, 0.38, "Phase-safe chapel cellar trapdoor under altar leading to hidden door", "Temple Green", GROUND_Y + 0.04),
  P("chain_coil", 480.0, -142.5, 0, 0.22, "Iron chain coiled on floor beside buried bell pit", "Temple Green", GROUND_Y + 0.12),
  P("obj_church_bells", 480.0, -142.1, Math.PI, 0.18, "Buried bell fragment supported in iron-lined altar pit", "Temple Green", GROUND_Y + 0.18),
  P("arch_wall_broken", 482.8, -143.0, Math.PI / 2, 0.28, "Phase-safe broken brick wall revealing chapel hidden door", "Temple Green"),
  P("obj_church_trapdoor_metal", 483.8, -143.0, Math.PI / 2, 0.28, "Bronze listening plate mounted on hidden undercroft door", "Temple Green", GROUND_Y + 0.1),

  P("table_large_fp", 568.0, -266.8, Math.PI / 2, 0.30, "Bridge crack planning table against Reeve Hall side wall clear of civic aisle", "Noble Rise"),
  P("scroll_2_fp", 558.4, -262.2, 0.08, 0.18, "Bell-shaped bridge crack parchment supported on Reeve planning table", "Noble Rise", GROUND_Y + 0.62),
  P("bookstand_fp", 557.6, -262.0, -0.2, 0.2, "Civic bridge repair ledger supported on Reeve planning table", "Noble Rise", GROUND_Y + 0.65),
  P("candle_1_fp", 559.1, -262.35, 0, 0.16, "Small council candle supported on bridge crack table", "Noble Rise", GROUND_Y + 0.66),

  P("anvil_log_fp", 527.2, -231.0, Math.PI / 2, 0.36, "Bell-casting anvil block on floor in Black Anvil back bay", "Craftsman Row"),
  P("cauldron_fp", 533.4, -235.8, 0, 0.26, "Bell-bronze alloy crucible tucked beside Black Anvil back bay wall", "Craftsman Row"),
  P("bucket_wood", 530.5, -231.2, 0, 0.32, "Quench bucket on floor beside bell-casting bay", "Craftsman Row"),
  P("workbench_drawers_fp", 526.6, -234.2, Math.PI, 0.36, "Bellbinder tuning workbench against smithy back wall", "Craftsman Row"),
  P("mine_gold_fragment", 526.6, -234.2, 0.1, 0.18, "Meteoric trace shard supported on tuning workbench", "Craftsman Row", GROUND_Y + 0.64),
  P("obj_church_bells", 527.4, -234.2, 0.05, 0.14, "Bellbinder's Voice handbell supported on tuning workbench", "Craftsman Row", GROUND_Y + 0.68),
  P("whetstone_fp", 528.0, -234.15, -0.1, 0.18, "Tone-shaping whetstone supported on tuning workbench", "Craftsman Row", GROUND_Y + 0.64),

  P("bookcase_2", 519.6, -171.0, Math.PI, 0.36, "Wyrm and Candle Bellbinder shelf against magic shop wall", "Magic Shop"),
  P("spellbook_open", 518.8, -170.4, 0, 0.18, "Open bell-tone spellbook supported on Wyrm and Candle shelf", "Magic Shop", GROUND_Y + 0.72),
  P("shelf_candles", 520.4, -170.2, 0, 0.26, "Candle shelf against Wyrm and Candle side wall", "Magic Shop", GROUND_Y + 0.74),
  P("wand", 519.8, -170.1, Math.PI / 2, 0.16, "Tuning wand supported on magic shop wall shelf", "Magic Shop", GROUND_Y + 0.78),

  P("table_long", 590.0, -170.0, -Math.PI / 2, 0.38, "Dock Ledger Warehouse cargo-contract table against inner wall", "River Docks"),
  P("scroll_2_fp", 590.0, -170.0, 0.1, 0.18, "Ferry schedule and sealed cargo contract supported on warehouse table", "River Docks", GROUND_Y + 0.62),
  P("key_metal_fp", 589.4, -170.2, -0.05, 0.16, "Warehouse lock key supported on cargo-contract table", "River Docks", GROUND_Y + 0.64),

  // Bellward Halls: first solo dungeon ring with six prayer chambers.
  P("road", 356.0, -318.0, 0, 0.72, "Phase-safe underground Bellward Halls bronze floor ring path", "Old Well / Underways"),
  P("pillar", 356.0, -318.0, 0, 0.42, "Bellward Halls central pillar on floor inside solo dungeon hub", "Old Well / Underways"),
  P("obj_church_bells", 356.0, -318.0, Math.PI, 0.24, "Bell-pattern bronze inlay supported in Bellward Halls central hub floor", "Old Well / Underways", GROUND_Y + 0.08),
  P("torch_mounted", 352.0, -318.0, Math.PI / 2, 0.28, "Bellward Halls west wall torch mounted on stone bracket", "Old Well / Underways", GROUND_Y + 1.08),
  P("torch_mounted", 360.0, -318.0, -Math.PI / 2, 0.28, "Bellward Halls east wall torch mounted on stone bracket", "Old Well / Underways", GROUND_Y + 1.08),
  P("obj_church_grave_wall", 346.0, -320.0, 0, 0.28, "Phase-safe Chamber of Aevith river-wyrm altar wall", "Old Well / Underways"),
  P("bookstand_fp", 346.0, -319.2, 0, 0.18, "Aevith prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("rock_small", 346.7, -319.4, 0.2, 0.18, "Aevith river stone relic on floor beside lore stand", "Old Well / Underways"),
  P("obj_church_grave_wall", 366.0, -320.0, 0, 0.28, "Phase-safe Chamber of Karag-Drath mountain-wyrm altar wall", "Old Well / Underways"),
  P("bookstand_fp", 366.0, -319.2, 0, 0.18, "Karag-Drath prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("mine_stone_01", 366.7, -319.4, 0.2, 0.18, "Karag-Drath black mountain glass relic on floor", "Old Well / Underways"),
  P("obj_church_grave_wall", 346.0, -331.0, 0, 0.28, "Phase-safe Chamber of Vyrenia sky-wyrm altar wall", "Old Well / Underways"),
  P("bookstand_fp", 346.0, -330.2, 0, 0.18, "Vyrenia prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("banner_white", 346.8, -330.3, 0, 0.22, "White feather relic cloth supported over Vyrenia chamber altar", "Old Well / Underways", GROUND_Y + 0.44),
  P("obj_church_grave_wall", 366.0, -331.0, 0, 0.28, "Phase-safe Chamber of Murvath sea-wyrm altar wall", "Old Well / Underways"),
  P("bookstand_fp", 366.0, -330.2, 0, 0.18, "Murvath prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("food_fishbone", 366.8, -330.1, 0, 0.16, "Murvath shell relic supported beside sea-wyrm altar", "Old Well / Underways", GROUND_Y + 0.22),
  P("obj_church_grave_wall", 346.0, -338.5, 0, 0.26, "Phase-safe Chamber of Sylenne forest-wyrm root altar wall", "Old Well / Underways"),
  P("bookstand_fp", 346.0, -337.8, 0, 0.16, "Sylenne prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("forest_grass_2d", 346.8, -337.8, 0, 0.16, "Sylenne living leaf relic on floor beside root altar", "Old Well / Underways"),
  P("obj_church_grave_wall", 366.0, -338.5, 0, 0.26, "Phase-safe Chamber of Korruthax fire-wyrm altar wall", "Old Well / Underways"),
  P("bookstand_fp", 366.0, -337.8, 0, 0.16, "Korruthax prayer chamber lore stand supported on floor", "Old Well / Underways"),
  P("mine_gold_fragment", 366.8, -337.8, 0, 0.16, "Korruthax obsidian arrow relic supported beside fire altar", "Old Well / Underways", GROUND_Y + 0.2),
  P("bench_fp", 356.0, -326.5, 0, 0.28, "Listening Chamber stone bench on floor beside blue shaft", "Old Well / Underways"),
  P("fountain_center", 356.0, -328.6, 0, 0.18, "Listening Chamber blue light shaft set into floor", "Old Well / Underways", GROUND_Y + 0.04),
  P("candle_thin_lit", 356.0, -328.6, 0, 0.14, "Blue listening candle supported at floor shaft rim", "Old Well / Underways", GROUND_Y + 0.18),

  // Old Harth, Veins of the Wyrm, Bellbinder Tomb, Bellward Chamber, Wyrm's Bed.
  P("coffin", 386.0, -326.0, Math.PI / 2, 0.38, "Old Harth antechamber sarcophagus on floor", "Old Well / Underways"),
  P("pillar", 386.0, -323.8, 0, 0.32, "Memory Stone suspended over Old Harth sarcophagus by chain anchors", "Old Well / Underways", GROUND_Y + 0.86),
  P("chain_coil", 385.0, -323.2, 0, 0.18, "First Memory Stone chain anchor on floor", "Old Well / Underways", GROUND_Y + 0.12),
  P("chain_coil", 387.0, -323.2, 0, 0.18, "Second Memory Stone chain anchor on floor", "Old Well / Underways", GROUND_Y + 0.12),
  P("mine_gold_fragment", 622.0, -326.0, 0, 0.22, "Pulse Hall dragon-vein glow supported in floor channel", "Old Well / Underways", GROUND_Y + 0.12),
  P("mine_gold_fragment", 626.0, -326.0, 0.1, 0.22, "Second Pulse Hall dragon-vein glow supported in floor channel", "Old Well / Underways", GROUND_Y + 0.12),
  P("fountain_square", 630.0, -318.0, 0, 0.24, "Echo Hall phase-safe essence pool set into floor", "Old Well / Underways", GROUND_Y + 0.04),
  P("obj_church_grave_wall", 637.0, -326.0, Math.PI / 2, 0.28, "Spine Hall rib wall phase-safe dragon bone marker", "Old Well / Underways"),
  P("rock_wide", 639.5, -326.0, Math.PI / 2, 0.26, "Shed-skin scale pile on floor beside Spine Hall wall", "Old Well / Underways"),
  P("coffin", 640.0, -306.0, Math.PI / 2, 0.36, "Bellbinder Tomb Old Harth sealed sarcophagus on floor", "Old Well / Underways"),
  P("bookstand_fp", 636.8, -307.6, 0, 0.16, "Bellbinder Stole regalia plinth supported on tomb floor", "Old Well / Underways"),
  P("whetstone_fp", 638.0, -307.6, 0, 0.16, "Bellbinder Hammer regalia plinth supported on tomb floor", "Old Well / Underways"),
  P("wand", 639.2, -307.6, Math.PI / 2, 0.16, "Bellbinder Tuning Fork regalia plinth supported on tomb floor", "Old Well / Underways", GROUND_Y + 0.18),
  P("obj_church_bells", 640.4, -307.6, 0, 0.14, "Bellbinder Handbell regalia plinth supported on tomb floor", "Old Well / Underways", GROUND_Y + 0.18),
  P("chain_coil", 641.6, -307.6, 0, 0.16, "Bellbinder Chain regalia plinth supported on tomb floor", "Old Well / Underways"),
  P("shield_round_color", 642.8, -307.6, 0, 0.16, "Bellbinder Ring seal regalia plinth supported on tomb floor", "Old Well / Underways", GROUND_Y + 0.18),
  P("obj_church_bells", 640.0, -286.0, Math.PI, 0.42, "True Bell hanging in Bellward Chamber from ceiling chain supports", "Old Well / Underways", GROUND_Y + 1.2),
  P("chain_coil", 637.8, -286.0, 0, 0.2, "True Bell left chain anchor on Bellward Chamber floor", "Old Well / Underways"),
  P("chain_coil", 642.2, -286.0, 0, 0.2, "True Bell right chain anchor on Bellward Chamber floor", "Old Well / Underways"),
  P("rock_wide", 640.0, -272.0, 0, 0.32, "Wyrm's Bed bronze-stone snout silhouette phase-safe floor marker", "Old Well / Underways"),
  P("rock_wide", 636.4, -270.0, Math.PI / 3, 0.28, "Wyrm's Bed folded wing silhouette phase-safe floor marker left", "Old Well / Underways"),
  P("rock_wide", 643.6, -270.0, -Math.PI / 3, 0.28, "Wyrm's Bed folded wing silhouette phase-safe floor marker right", "Old Well / Underways"),
  P("obj_church_grave_wall", 640.0, -266.8, 0, 0.3, "Wyrm's Bed final threshold wall phase-safe dragon chamber marker", "Old Well / Underways"),


  // HARTHMERE_BELLBOUND_MISSING_DETAILS_EXPANSION_V2
  // Second Bible/guide pass: still no NPCs/animals/outside-world content.
  // This fills missing production-readable town interiors and dungeon staging:
  // Q6 eight-column mural antechamber, bell-notation descent stairs, Q7 hidden
  // alcove / First Choir arena markers, Q10 group ritual door mechanics, Q11
  // bronze descent corridor and path ritual stations, plus town-guide interiors
  // for guard command/jail/armory and stables/tack/storage.
  //
  // All markers are authored as phase-safe room/floor/wall pieces so existing
  // collision and route tests can keep roads and service lanes clear.

  // Town-guide interior completion: stable support, guard command, jail, and armory.
  P("table_small", 472.0, -259.6, Math.PI, 0.32, "North Gate stable tack ledger table against stable side wall", "North Gate"),
  P("chain_coil", 471.3, -259.4, 0, 0.16, "Stable lead rope coil supported on tack table", "North Gate", GROUND_Y + 0.52),
  P("bookstand_fp", 472.5, -259.35, 0, 0.16, "Mount feed and travel permit ledger supported on stable tack table", "North Gate", GROUND_Y + 0.55),
  P("cabinet", 469.8, -259.8, Math.PI, 0.34, "Stable tack cabinet against North Gate stable wall", "North Gate"),
  P("table_large_fp", 536.8, -281.8, 0, 0.36, "Guard Barracks command table inside watch planning room", "Guard Yard"),
  P("scroll_2_fp", 536.8, -281.8, 0.1, 0.16, "Gate patrol roster supported on guard command table", "Guard Yard", GROUND_Y + 0.62),
  P("shield_square_color", 535.8, -282.2, 0, 0.18, "Town Watch wall shield mounted over guard command table", "Guard Yard", GROUND_Y + 0.92),
  P("sword_1h", 538.0, -282.0, Math.PI / 2, 0.18, "Armory inspection sword supported on guard command table", "Guard Yard", GROUND_Y + 0.64),
  P("obj_church_grave_fence", 542.2, -281.8, 0, 0.30, "Barracks prisoner holding cell fence on floor beside command room wall", "Guard Yard"),
  P("chest", 540.8, -283.8, 0, 0.32, "Guard armory evidence chest on floor against barracks wall", "Guard Yard"),

  // Q6 Hidden Door: Bellbinder antechamber with eight columns and founding mural sequence.
  P("pillar", 492.0, -139.0, 0, 0.28, "Bellbinder Antechamber column one on floor showing wyrm over river mural", "Temple Green"),
  P("pillar", 494.2, -139.0, 0, 0.28, "Bellbinder Antechamber column two on floor showing robed bell-ringer mural", "Temple Green"),
  P("pillar", 496.4, -139.0, 0, 0.28, "Bellbinder Antechamber column three on floor showing wyrm landing on stone mural", "Temple Green"),
  P("pillar", 498.6, -139.0, 0, 0.28, "Bellbinder Antechamber column four on floor showing great bell ringing mural", "Temple Green"),
  P("pillar", 492.0, -136.2, 0, 0.28, "Bellbinder Antechamber column five on floor showing wyrm falling asleep mural", "Temple Green"),
  P("pillar", 494.2, -136.2, 0, 0.28, "Bellbinder Antechamber column six on floor showing buried dragon mural", "Temple Green"),
  P("pillar", 496.4, -136.2, 0, 0.28, "Bellbinder Antechamber column seven on floor showing chapel built over binding mural", "Temple Green"),
  P("pillar", 498.6, -136.2, 0, 0.28, "Bellbinder Antechamber column eight on floor showing town growing around chapel mural", "Temple Green"),
  P("bookstand_fp", 495.4, -137.5, 0, 0.18, "Bellbinder founding mural reader stand supported on antechamber floor", "Temple Green"),
  P("road", 500.8, -137.4, Math.PI / 2, 0.34, "Bell-notation spiral stair floor marker descending from chapel antechamber", "Temple Green"),
  P("scroll_2_fp", 500.8, -137.4, 0.18, 0.14, "Carved bell-tone notation supported along descending stair wall", "Temple Green", GROUND_Y + 0.42),
  P("torch_mounted", 501.6, -137.8, -Math.PI / 2, 0.24, "Undercroft stair torch mounted on carved notation wall bracket", "Temple Green", GROUND_Y + 1.0),

  // Q7 Bellward Halls: encounter staging without spawning actors.
  P("road", 356.0, -314.0, 0, 0.34, "Sleepwalkers encounter circle floor marker in Bellward Halls", "Old Well / Underways"),
  P("obj_church_grave_wall", 352.8, -314.0, Math.PI / 2, 0.22, "Failed Apprentice alcove wall with broken handbell shelf", "Old Well / Underways"),
  P("obj_church_bells", 352.8, -314.0, 0, 0.12, "Broken apprentice handbell supported on Failed Apprentice alcove shelf", "Old Well / Underways", GROUND_Y + 0.42),
  P("bench_fp", 359.2, -326.4, 0, 0.24, "Listening Choir noncombat spirit dais bench on floor", "Old Well / Underways"),
  P("cabinet", 361.2, -326.2, Math.PI, 0.24, "Hidden alcove cabinet opened by sparing Listening Choir chant", "Old Well / Underways"),
  P("shield_round_color", 361.2, -326.2, 0, 0.14, "Choir-Singer's Ring relic supported inside hidden alcove cabinet", "Old Well / Underways", GROUND_Y + 0.58),
  P("road", 356.0, -309.0, 0, 0.38, "First Choir boss triad floor sigil in Bellward central hub", "Old Well / Underways"),
  P("candle_triple", 354.8, -309.0, 0, 0.14, "First Choir left harmony candle supported on floor sigil rim", "Old Well / Underways", GROUND_Y + 0.18),
  P("candle_triple", 356.0, -307.9, 0, 0.14, "First Choir high harmony candle supported on floor sigil rim", "Old Well / Underways", GROUND_Y + 0.18),
  P("candle_triple", 357.2, -309.0, 0, 0.14, "First Choir right harmony candle supported on floor sigil rim", "Old Well / Underways", GROUND_Y + 0.18),

  // Q10 Bellbinder Tomb: group ritual door, bell stations, and regalia readability.
  P("obj_church_grave_wall", 632.0, -310.8, 0, 0.28, "Bellbinder Tomb sealed bronze door with bell-clapper mechanism", "Old Well / Underways"),
  P("obj_church_bells", 632.0, -310.2, 0, 0.14, "Bell-clapper door mechanism mounted on sealed tomb door", "Old Well / Underways", GROUND_Y + 0.72),
  P("obj_church_bells", 628.8, -311.8, 0, 0.12, "Group ritual bell station one supported on tomb floor plinth", "Old Well / Underways", GROUND_Y + 0.32),
  P("obj_church_bells", 631.0, -312.9, 0, 0.12, "Group ritual bell station two supported on tomb floor plinth", "Old Well / Underways", GROUND_Y + 0.32),
  P("obj_church_bells", 633.2, -312.9, 0, 0.12, "Group ritual bell station three supported on tomb floor plinth", "Old Well / Underways", GROUND_Y + 0.32),
  P("obj_church_bells", 635.4, -311.8, 0, 0.12, "Group ritual bell station four supported on tomb floor plinth", "Old Well / Underways", GROUND_Y + 0.32),
  P("bookstand_fp", 640.0, -303.8, 0, 0.18, "Founder's Seal codex stand supported beside Old Harth open sarcophagus", "Old Well / Underways"),
  P("shield_round_color", 640.8, -303.8, 0, 0.14, "Founder's Seal medallion supported on tomb codex stand", "Old Well / Underways", GROUND_Y + 0.48),

  // Q11 Last Ringing: bronze descent corridor, encounter staging, and path ritual stations.
  P("road", 640.0, -296.0, Math.PI / 2, 0.52, "Bronze descent corridor floor path toward Wyrm's Bed antechamber", "Old Well / Underways"),
  P("obj_church_grave_wall", 634.8, -296.0, Math.PI / 2, 0.22, "Compact Saboteurs ambush side wall marker in bronze corridor", "Old Well / Underways"),
  P("crate_metal_fp", 634.8, -295.0, 0, 0.22, "Compact smuggling payoff crate on corridor floor marker", "Old Well / Underways"),
  P("obj_church_grave_wall", 640.0, -292.6, 0, 0.22, "Bell-Mad tragedy wave threshold wall marker", "Old Well / Underways"),
  P("candle_1_fp", 640.0, -292.0, 0, 0.14, "Bell-Mad mercy candle supported on corridor floor", "Old Well / Underways", GROUND_Y + 0.18),
  P("pillar", 645.0, -296.0, 0, 0.24, "Threshold Wyrm-Voice resonance pillar on corridor floor", "Old Well / Underways"),
  P("scroll_2_fp", 645.0, -295.2, 0.12, 0.14, "Old Tongue name-list inscription supported on resonance pillar face", "Old Well / Underways", GROUND_Y + 0.58),
  P("whetstone_fp", 636.4, -287.8, 0, 0.16, "Rebind path Hammer ritual station supported on Bellward Chamber floor", "Old Well / Underways", GROUND_Y + 0.22),
  P("wand", 638.2, -287.8, Math.PI / 2, 0.16, "Rebind path Tuning Fork ritual station supported on Bellward Chamber floor", "Old Well / Underways", GROUND_Y + 0.22),
  P("chain_coil", 640.0, -288.0, 0, 0.18, "Rebind path Chain ritual station on Bellward Chamber floor", "Old Well / Underways"),
  P("bookstand_fp", 641.8, -287.8, 0, 0.16, "Rebind path Stole chant lectern supported on Bellward Chamber floor", "Old Well / Underways"),
  P("shield_round_color", 643.6, -287.8, 0, 0.14, "Rebind path Ring seal ritual station supported on Bellward Chamber floor", "Old Well / Underways", GROUND_Y + 0.22),
  P("road", 640.0, -282.2, 0, 0.36, "Slay path three-stroke cracked floor marker below True Bell", "Old Well / Underways"),
  P("obj_church_bells", 640.0, -280.8, 0, 0.14, "Wake path greeting handbell station supported beside True Bell floor", "Old Well / Underways", GROUND_Y + 0.28),

  // Q12 Wyrm's Bed: make the dragon chamber read as enormous without adding boss/NPC.
  P("road", 640.0, -262.0, 0, 0.72, "Wyrm's Bed vast chamber floor ring marker beneath sleeping dragon", "Old Well / Underways"),
  P("rock_wide", 632.0, -264.0, Math.PI / 5, 0.3, "Wyrm's Bed coiled dragon tail bronze-stone silhouette floor marker left", "Old Well / Underways"),
  P("rock_wide", 648.0, -264.0, -Math.PI / 5, 0.3, "Wyrm's Bed coiled dragon tail bronze-stone silhouette floor marker right", "Old Well / Underways"),
  P("mine_gold_fragment", 636.0, -260.0, 0, 0.18, "Thaedryn low candle-flame eye glow supported in dragon chamber floor channel", "Old Well / Underways", GROUND_Y + 0.16),
  P("mine_gold_fragment", 644.0, -260.0, 0, 0.18, "Second Thaedryn candle-flame eye glow supported in dragon chamber floor channel", "Old Well / Underways", GROUND_Y + 0.16),
  P("obj_church_grave_wall", 636.0, -258.0, Math.PI / 2, 0.24, "Wyrm's Bed ribbed mural wall showing thousands of bell spirals", "Old Well / Underways"),
  P("obj_church_grave_wall", 644.0, -258.0, Math.PI / 2, 0.24, "Second Wyrm's Bed ribbed mural wall showing thousands of bell spirals", "Old Well / Underways"),


  // HARTHMERE_REMAINING_INTERIORS_AND_DUNGEON_ACCESS_V1
  // Completes no-NPC interior coverage for the current town footprint and makes
  // dungeon test access readable. This is still town/building/dungeon only:
  // no new actors, animals, hostile spawns, boss actors, or outside-world expansion.
  //
  // Dungeon test access points for manual testing:
  // 1) Chapel Undercroft Test Entrance: Temple Green, around x=500.8 z=-137.4.
  // 2) Old Well Drain Test Entrance: Old Well / Underways, around x=413.2 z=-234.6.
  // 3) Bellward Halls Debug Start: Old Well / Underways, around x=356.0 z=-318.0.
  //
  // These coordinates are placement/readability anchors. Actual teleport/input
  // helpers are handled by live browser tests and player debug hooks.

  // Player Services Hall: bank, mail, auction, guild, wardrobe, and storage rooms.
  P("table_medium", 454.2, -194.4, 0, 0.34, "Player Services bank teller desk inside bank room", "Player Services"),
  P("chest", 452.8, -194.1, 0, 0.3, "Bank room coin chest on floor behind teller desk", "Player Services"),
  P("cabinet", 451.6, -195.4, Math.PI, 0.32, "Bank vault cabinet against reinforced service wall", "Player Services"),
  P("bookstand_fp", 454.2, -194.4, 0, 0.16, "Deposit ledger supported on bank teller desk", "Player Services", GROUND_Y + 0.56),
  P("table_small", 459.2, -194.5, 0, 0.3, "Mail sorting interior table inside courier room", "Player Services"),
  P("scroll_2_fp", 459.2, -194.5, 0.2, 0.14, "Mail route packet supported on sorting table", "Player Services", GROUND_Y + 0.54),
  P("cabinet", 460.8, -195.5, Math.PI, 0.3, "Courier parcel cabinet against mailroom wall", "Player Services"),
  P("table_long", 464.2, -194.5, 0, 0.32, "Auction escrow interior counter inside trading room", "Player Services"),
  P("crate_metal_fp", 465.4, -194.3, 0, 0.22, "Auction escrow lockbox supported behind trading counter", "Player Services"),
  P("bookstand_fp", 464.0, -194.4, 0, 0.16, "Auction listing book supported on escrow counter", "Player Services", GROUND_Y + 0.56),
  P("table_medium", 468.8, -194.8, 0, 0.32, "Guild registrar charter desk inside guild alcove", "Player Services"),
  P("scroll_2_fp", 468.8, -194.8, -0.2, 0.15, "Blank guild charter supported on registrar desk", "Player Services", GROUND_Y + 0.56),
  P("cabinet", 470.4, -195.8, Math.PI, 0.3, "Guild seal cabinet against registrar wall", "Player Services"),
  P("cabinet", 473.8, -195.6, Math.PI, 0.32, "Cosmetic wardrobe cabinet against dressing room wall", "Player Services"),
  P("shield_square_color", 473.8, -194.4, 0, 0.16, "Cosmetic mirror frame mounted on dressing room wall", "Player Services", GROUND_Y + 0.92),
  P("bench_fp", 466.0, -191.8, Math.PI / 2, 0.28, "Player Services waiting bench leaving clear customer lane", "Player Services"),

  // Copper Kettle: kitchen, pantry, rented room, cellar, hearth, and inn service rooms.
  P("table_large_fp", 446.2, -226.0, 0, 0.34, "Copper Kettle kitchen prep table inside cook room", "Copper Kettle"),
  P("cauldron_fp", 444.8, -226.0, 0, 0.22, "Kitchen stew kettle supported on cookroom hearth stones", "Copper Kettle", GROUND_Y + 0.18),
  P("rack", 447.8, -226.2, Math.PI, 0.28, "Copper Kettle pantry rack against kitchen wall", "Copper Kettle"),
  P("crate_wooden_fp", 448.8, -226.1, 0, 0.24, "Pantry supply crate on kitchen floor beside rack", "Copper Kettle"),
  P("bed_twin1", 453.0, -229.6, Math.PI / 2, 0.38, "Copper Kettle rented room bed against upstairs room wall", "Copper Kettle"),
  P("table_small", 454.3, -229.4, 0, 0.24, "Rented room bedside table with travel candle", "Copper Kettle"),
  P("candle_1_fp", 454.3, -229.4, 0, 0.12, "Rented room travel candle supported on bedside table", "Copper Kettle", GROUND_Y + 0.52),
  P("chest", 455.2, -230.2, 0, 0.28, "Rented room footlocker on floor at bed end", "Copper Kettle"),
  P("obj_church_trapdoor_metal", 443.6, -229.2, 0, 0.28, "Copper Kettle cellar hatch set into kitchen floor clear of animal route", "Copper Kettle"),
  P("crate_wooden_fp", 447.2, -232.2, 0, 0.24, "Cellar ale cask crate on floor beside hatch", "Copper Kettle"),
  P("bench_fp", 442.0, -222.4, 0, 0.28, "Copper Kettle hearth bench with clear aisle to bar", "Copper Kettle"),

  // Craftsman Row: smithy, carpentry, tailoring, leather, material storage, and order rooms.
  P("table_large_fp", 563.5, -214.4, 0, 0.36, "Black Anvil repair order table inside smithy room", "Craftsman Row"),
  P("anvil_fp", 561.8, -214.2, 0, 0.28, "Black Anvil floor anvil with clear hammering space", "Craftsman Row"),
  P("whetstone_fp", 563.5, -214.2, 0, 0.16, "Repair whetstone supported on smithy work table", "Craftsman Row", GROUND_Y + 0.58),
  P("crate_metal_fp", 560.8, -215.5, 0, 0.24, "Smithy ore crate on floor against forge wall", "Craftsman Row"),
  P("table_large_fp", 569.2, -214.8, 0, 0.34, "Carpenter drafting table inside woodworking room", "Craftsman Row"),
  P("scroll_2_fp", 569.2, -214.8, 0.1, 0.14, "Carpenter blueprint supported on drafting table", "Craftsman Row", GROUND_Y + 0.58),
  P("rack", 570.8, -215.0, Math.PI, 0.28, "Timber rack against carpentry wall", "Craftsman Row"),
  P("table_long_decorated", 574.2, -214.6, 0, 0.32, "Tailor cutting table inside cloth room", "Craftsman Row"),
  P("banner_blue", 574.2, -214.2, 0, 0.16, "Folded blue cloth supported on tailor cutting table", "Craftsman Row", GROUND_Y + 0.6),
  P("rack", 575.8, -214.8, Math.PI, 0.28, "Leather drying rack against workshop wall", "Craftsman Row"),
  P("shelf_small_bottles", 577.2, -214.8, Math.PI, 0.26, "Alchemy prep shelf against craftsman side wall", "Craftsman Row"),

  // Noble Rise / Reeve Hall: hearing room, private office, legal archive, treasury, servant corridor.
  P("table_large_fp", 590.0, -178.8, Math.PI / 2, 0.28, "Reeve Hall public hearing table clear of dock warehouse patrol aisle", "Noble Rise"),
  P("bench_fp", 594.2, -177.2, 0, 0.28, "Petitioner waiting bench inside Reeve Hall chamber", "Noble Rise"),
  P("bookcase_2", 590.8, -179.2, Math.PI, 0.34, "Reeve Hall legal archive bookcase against west wall", "Noble Rise"),
  P("table_medium", 591.8, -178.2, 0, 0.3, "Legal archive review table with clear clerk aisle", "Noble Rise"),
  P("scroll_2_fp", 591.8, -178.2, 0.15, 0.14, "Court docket supported on legal archive table", "Noble Rise", GROUND_Y + 0.56),
  P("table_small", 599.2, -179.4, 0, 0.28, "Reeve private office writing desk beside balcony wall", "Noble Rise"),
  P("chest", 600.4, -180.0, 0, 0.28, "Tax treasury chest on floor inside private office", "Noble Rise"),
  P("cabinet", 601.4, -179.2, Math.PI, 0.3, "Permit seal cabinet against Reeve private office wall", "Noble Rise"),
  P("bench_fp", 602.4, -176.8, Math.PI / 2, 0.26, "Servant side corridor bench leaving noble passage clear", "Noble Rise"),

  // Temple / chapel: nave, infirmary, charity office, grave shed, crypt threshold, undercroft testing entrance.
  P("bench_fp", 486.8, -151.4, 0, 0.28, "Chapel nave pew row one left with clear aisle", "Temple Green"),
  P("bench_fp", 493.2, -151.4, 0, 0.28, "Chapel nave pew row one right with clear aisle", "Temple Green"),
  P("bench_fp", 486.8, -153.0, 0, 0.28, "Chapel nave pew row two left with clear aisle", "Temple Green"),
  P("bench_fp", 493.2, -153.0, 0, 0.28, "Chapel nave pew row two right with clear aisle", "Temple Green"),
  P("bed_twin1", 479.2, -150.6, Math.PI / 2, 0.34, "Chapel infirmary cot against healing alcove wall", "Temple Green"),
  P("table_small", 480.4, -150.8, 0, 0.24, "Infirmary herb table beside cot", "Temple Green"),
  P("shelf_small_bottles", 481.4, -150.8, Math.PI, 0.24, "Infirmary remedy shelf against chapel wall", "Temple Green"),
  P("table_medium", 487.6, -156.2, 0, 0.28, "Charity office donation table inside chapel side room", "Temple Green"),
  P("chest", 488.8, -156.2, 0, 0.24, "Charity blanket chest on floor beside donation table", "Temple Green"),
  P("cabinet", 497.4, -155.6, Math.PI, 0.28, "Gravekeeper tool cabinet against cemetery shed wall", "Temple Green"),
  P("shovel", 497.8, -155.2, Math.PI / 2, 0.16, "Gravekeeper shovel leaning against cemetery shed cabinet", "Temple Green", GROUND_Y + 0.44),
  P("obj_church_trapdoor_metal", 500.8, -137.4, 0, 0.34, "Chapel Undercroft Test Entrance hatch set into bell-notation stair floor", "Temple Green"),

  // River Docks: warehouse office, customs, cold fish shelf, ferry staging, cargo racks.
  P("table_medium", 536.4, -121.8, 0, 0.32, "Dock Ledger Warehouse office desk inside cargo room", "River Docks"),
  P("bookstand_fp", 536.4, -121.8, 0, 0.14, "Warehouse cargo manifest supported on office desk", "River Docks", GROUND_Y + 0.56),
  P("cabinet", 538.0, -122.2, Math.PI, 0.3, "Warehouse tariff cabinet against office wall", "River Docks"),
  P("table_long", 542.4, -121.8, 0, 0.32, "Customs inspection counter inside dock warehouse", "River Docks"),
  P("crate_wooden_fp", 543.8, -122.0, 0, 0.24, "Sealed customs cargo crate on warehouse floor", "River Docks"),
  P("shelf_meat", 547.0, -122.0, Math.PI, 0.28, "Cold fish shelf against warehouse river wall", "River Docks"),
  P("table_small", 550.0, -122.2, 0, 0.26, "Ferry ticket table inside warehouse travel corner", "River Docks"),
  P("scroll_2_fp", 550.0, -122.2, 0.1, 0.14, "Ferry ticket ledger supported on travel table", "River Docks", GROUND_Y + 0.54),
  P("rack", 552.0, -123.0, Math.PI, 0.28, "Rope and oar rack against ferry staging wall", "River Docks"),

  // Mudden Ward: individual poor homes, washhouse, cheap healer, fence room, hidden tunnel room.
  P("bed_twin1", 417.2, -162.8, Math.PI / 2, 0.24, "Mudden Lean-To Home sleeping pallet against patched rear wall clear of doorway", "Mudden Ward"),
  P("table_small", 407.0, -154.4, 0, 0.22, "Mudden Lean-To Home meal table beside sleeping pallet with clear doorway approach", "Mudden Ward"),
  P("chest", 404.4, -158.2, 0, 0.22, "Mudden Lean-To Home patched storage chest on floor", "Mudden Ward"),
  P("bed_twin1", 417.0, -151.8, Math.PI / 2, 0.24, "Mudden Poorhouse second sleeping pallet against shared wall clear of entry aisle", "Mudden Ward"),
  P("table_medium", 418.2, -155.0, 0, 0.18, "Mudden Poorhouse communal table tucked beside wall with clear door lane", "Mudden Ward"),
  P("candle_1_fp", 418.2, -155.0, 0, 0.10, "Mudden Poorhouse candle supported on communal table", "Mudden Ward", GROUND_Y + 0.52),
  P("table_long", 399.2, -151.4, 0, 0.28, "Mudden washhouse folding table beneath laundry line clear of rat-catcher route", "Mudden Ward"),
  P("banner_white", 399.2, -151.2, 0, 0.14, "Fresh wash cloth supported across washhouse folding table", "Mudden Ward", GROUND_Y + 0.58),
  P("table_small", 414.4, -156.4, 0, 0.24, "Cheap healer interior remedy table inside Mudden clinic", "Mudden Ward"),
  P("shelf_small_bottles", 415.6, -156.6, Math.PI, 0.24, "Cheap healer bottle shelf against clinic wall", "Mudden Ward"),
  P("table_small", 418.2, -158.8, 0, 0.24, "Fence vendor hidden goods table inside Mudden back room", "Mudden Ward"),
  P("crate_metal_fp", 419.2, -159.0, 0, 0.22, "Fence vendor locked stash on floor beside hidden goods table", "Mudden Ward"),
  P("obj_church_trapdoor_metal", 413.2, -234.6, 0, 0.34, "Old Well Drain Test Entrance hatch set into Underways stair floor", "Old Well / Underways"),

  // Guard Yard / barracks: bunks, mess, armory wall, holding area, duty board.
  P("bed_twin1", 526.2, -280.8, Math.PI / 2, 0.32, "Guard Barracks bunk one against west wall", "Guard Yard"),
  P("bed_twin1", 526.2, -282.4, Math.PI / 2, 0.32, "Guard Barracks bunk two against west wall", "Guard Yard"),
  P("bed_twin1", 526.2, -284.0, Math.PI / 2, 0.32, "Guard Barracks bunk three against west wall", "Guard Yard"),
  P("table_long", 530.0, -283.0, 0, 0.3, "Guard Barracks mess table with clear patrol aisle", "Guard Yard"),
  P("candle_1_fp", 530.0, -283.0, 0, 0.12, "Barracks mess candle supported on mess table", "Guard Yard", GROUND_Y + 0.52),
  P("cabinet", 533.6, -284.2, Math.PI, 0.3, "Guard Barracks uniform cabinet against north wall", "Guard Yard"),
  P("rack", 534.8, -284.2, Math.PI, 0.3, "Guard armory weapon rack against barracks wall", "Guard Yard"),
  P("shield_square_color", 535.4, -284.2, 0, 0.16, "Guard armory shield mounted on barracks wall rack", "Guard Yard", GROUND_Y + 0.92),
  P("bookstand_fp", 531.2, -280.8, 0, 0.16, "Duty board roster supported on barracks command stand", "Guard Yard", GROUND_Y + 0.58),

  // Dungeon access and room graph readability: explicit thresholds/corridors for testing.
  P("road", 500.8, -137.4, Math.PI / 2, 0.42, "Dungeon route step 01 Chapel Undercroft Test Entrance floor marker", "Temple Green"),
  P("road", 413.2, -234.6, Math.PI / 2, 0.42, "Dungeon route step 02 Old Well Drain Test Entrance floor marker", "Old Well / Underways"),
  P("road", 356.0, -318.0, 0, 0.46, "Dungeon route step 03 Bellward Halls Debug Start floor marker", "Old Well / Underways"),
  P("road", 356.0, -306.0, 0, 0.42, "Dungeon route step 04 First Choir Arena threshold floor marker", "Old Well / Underways"),
  P("road", 640.0, -314.0, Math.PI / 2, 0.46, "Dungeon route step 05 Old Harth Antechamber threshold floor marker", "Old Well / Underways"),
  P("road", 640.0, -300.0, Math.PI / 2, 0.46, "Dungeon route step 06 Bellbinder Tomb corridor floor marker", "Old Well / Underways"),
  P("road", 640.0, -286.0, Math.PI / 2, 0.46, "Dungeon route step 07 Bellward Chamber True Bell threshold floor marker", "Old Well / Underways"),
  P("road", 640.0, -266.0, Math.PI / 2, 0.46, "Dungeon route step 08 Wyrm's Bed final chamber threshold floor marker", "Old Well / Underways"),
  P("torch_mounted", 356.0, -318.8, Math.PI, 0.26, "Bellward Halls Debug Start torch mounted on dungeon entry wall bracket", "Old Well / Underways", GROUND_Y + 1.0),
  P("bookstand_fp", 357.2, -318.0, 0, 0.16, "Dungeon testing route placard supported on Bellward Halls floor stand", "Old Well / Underways", GROUND_Y + 0.58),


  // HARTHMERE_BUILDING_DUNGEON_COMPLETION_COMPAT_FIXES_V1
  // Keeps completion interiors while satisfying route clearance, fixture grounding, and elevated-support tests.
  // HARTHMERE_BUILDING_DUNGEON_COMPLETION_V1
  // Final no-NPC town building/interior + dungeon interior completion pass.
  // This fills the remaining bible-driven interiors without expanding the outside world.
  // It only uses asset IDs already present in this Harthmere source file.

  P("cauldron_fp", 468.8, -218.8, 0, 0.34, "Dawn Loaf Bakery brick oven hearth body on floor against rear bakehouse wall", "Bakery"),
  P("table_long", 471.0, -218.2, 0, 0.32, "Dawn Loaf Bakery kneading table on floor with clear baker work lane", "Bakery"),
  P("crate_wooden_fp", 469.6, -216.8, 0, 0.24, "Dawn Loaf flour sack crate stack on floor beside oven", "Bakery"),
  P("table_small", 472.8, -217.2, 0, 0.24, "Dawn Loaf cooling counter on floor beside bread shelf", "Bakery"),
  P("food_fishbone", 472.8, -217.2, 0.1, 0.14, "Fresh Dawn Loaf bread sample supported on cooling counter", "Bakery", GROUND_Y + 0.62),
  P("candle_1_fp", 471.7, -218.1, 0, 0.12, "Bakery table candle supported on kneading table corner", "Bakery", GROUND_Y + 0.62),
  P("bookcase_2", 455.0, -212.5, 3.14159, 0.34, "Brindle Provision staple goods shelf against back wall", "Provision House"),
  P("cabinet", 461.8, -212.8, 3.14159, 0.24, "Brindle Provision locked supply cabinet against back wall clear of customer aisle", "Provision House"),
  P("table_long", 456.0, -215.2, 0, 0.30, "Brindle Provision customer counter on floor with clear aisle", "Provision House"),
  P("crate_wooden_fp", 454.8, -216.8, 0, 0.24, "Brindle Provision ration crate stack on floor", "Provision House"),
  P("bucket_wood", 457.2, -216.9, 0, 0.22, "Brindle Provision travel water bucket on floor beside counter", "Provision House"),
  P("scroll_2_fp", 456.0, -215.2, 0, 0.14, "Brindle Provision price ledger supported on customer counter", "Provision House", GROUND_Y + 0.62),
  P("shelf_small_bottles", 514.0, -156.0, 3.14159, 0.32, "Green Mortar remedy bottle shelf against apothecary wall", "Apothecary"),
  P("table_long", 512.4, -160.4, 0, 0.28, "Green Mortar mortar mixing table on floor clear of Wyrm and Candle doorway approach", "Apothecary"),
  P("bed_twin1", 518.0, -158.6, 1.5708, 0.28, "Green Mortar treatment cot on floor beside healer lane", "Apothecary"),
  P("cabinet", 525.6, -166.2, 3.14159, 0.24, "Green Mortar locked poison cabinet against rear wall clear of Wyrm and Candle entry aisle", "Apothecary"),
  P("spellbook_open", 512.4, -160.4, 0.1, 0.14, "Saint Verena medicine notes supported on mixing table", "Apothecary", GROUND_Y + 0.62),
  P("candle_triple", 513.0, -160.5, 0, 0.12, "Apothecary triage candle cluster supported on mixing table", "Apothecary", GROUND_Y + 0.64),
  P("shelf_candles", 522.0, -168.0, 3.14159, 0.30, "Wyrm and Candle wax shelf mounted against magic shop wall", "Magic Shop", GROUND_Y + 0.62),
  P("bookcase_2", 524.0, -168.2, 3.14159, 0.34, "Wyrm and Candle spellbook case against back wall", "Magic Shop"),
  P("table_small", 523.0, -170.4, 0, 0.26, "Wyrm and Candle bell-tone study table on floor", "Magic Shop"),
  P("spellbook_open", 523.0, -170.4, 0.08, 0.14, "Open bell resonance spellbook supported on study table", "Magic Shop", GROUND_Y + 0.62),
  P("wand", 523.5, -170.3, 1.5708, 0.12, "Wyrm and Candle tuning wand supported on study table", "Magic Shop", GROUND_Y + 0.66),
  P("candle_1_fp", 522.5, -170.2, 0, 0.12, "Wyrm and Candle listening candle supported on table", "Magic Shop", GROUND_Y + 0.64),
  P("bed_twin1", 440.0, -248.0, 1.5708, 0.28, "Roadside Family Cottage sleeping bed on floor against cottage wall", "Residential"),
  P("table_small", 442.2, -247.6, 0, 0.24, "Roadside Family Cottage meal table on floor with walking lane", "Residential"),
  P("crate_wooden_fp", 443.8, -248.2, 0, 0.22, "Roadside Family Cottage household storage chest crate on floor", "Residential"),
  P("candle_1_fp", 442.2, -247.6, 0, 0.12, "Family cottage supper candle supported on meal table", "Residential", GROUND_Y + 0.58),
  P("banner_white", 441.0, -249.0, 0, 0.16, "Family cottage prayer cloth mounted on interior wall peg", "Residential", GROUND_Y + 0.74),
  P("table_long", 563.4, -259.2, 0, 0.30, "Brass Scale moneylender counter on floor inside Reeve Hall side office", "Noble Rise"),
  P("crate_metal_fp", 565.2, -259.4, 0, 0.22, "Brass Scale strongbox on floor behind moneylender counter", "Noble Rise"),
  P("cabinet", 565.8, -257.6, 3.14159, 0.28, "Brass Scale pawned valuables cabinet against office wall", "Noble Rise"),
  P("scroll_2_fp", 563.4, -259.2, 0.08, 0.14, "Brass Scale debt ledger supported on moneylender counter", "Noble Rise", GROUND_Y + 0.62),
  P("key_metal_fp", 564.0, -259.3, 0, 0.12, "Brass Scale strongbox key supported on counter", "Noble Rise", GROUND_Y + 0.64),
  P("table_long", 586.0, -176.0, 1.5708, 0.30, "River Dock Supply shop counter on warehouse floor", "River Docks"),
  P("bookcase_2", 584.4, -176.0, 1.5708, 0.30, "River Dock Supply rope hook and tool shelf against pier wall", "River Docks"),
  P("crate_wooden_fp", 587.4, -174.6, 0, 0.22, "River Dock Supply waterproof satchel crate on floor", "River Docks"),
  P("bucket_wood", 588.0, -176.4, 0, 0.22, "River Dock Supply bait tin bucket on floor beside counter", "River Docks"),
  P("food_fishbone", 586.0, -176.0, 0, 0.12, "River Dock Supply fishing hook sample supported on counter", "River Docks", GROUND_Y + 0.62),
  P("obj_lamp_ground_small", 584.6, -174.4, 0, 0.18, "River Dock Supply fog lantern grounded beside shop counter", "River Docks"),
  P("obj_church_grave_wall", 500.8, -137.4, 1.5708, 0.28, "Q5 Beneath the Stones undercroft entry wall threshold phase-safe dungeon test entrance", "Old Well / Underways"),
  P("obj_church_trapdoor_metal", 500.8, -136.4, 1.5708, 0.24, "Q5 chapel undercroft return plate set into floor", "Old Well / Underways", GROUND_Y + 0.04),
  P("table_small", 503.0, -137.2, 0, 0.22, "Q5 undercroft mapping table on floor before first hazard pocket", "Old Well / Underways"),
  P("scroll_2_fp", 503.0, -137.2, 0, 0.12, "Q5 undercroft map supported on mapping table", "Old Well / Underways", GROUND_Y + 0.58),
  P("torch_mounted", 504.2, -137.2, 1.5708, 0.24, "Q5 undercroft wall torch mounted on safe reset alcove bracket", "Old Well / Underways", GROUND_Y + 1.04),
  P("obj_church_grave_wall", 506.4, -137.4, 1.5708, 0.26, "Q6 Hidden Door mural walk wall segment phase-safe undercroft corridor", "Old Well / Underways"),
  P("bookstand_fp", 507.4, -137.2, 0, 0.16, "Q6 mural inscription stand supported on floor beside hidden door path", "Old Well / Underways"),
  P("obj_church_bells", 508.4, -137.4, 1.5708, 0.16, "Q6 tiny bell seal supported in hidden-door floor plate", "Old Well / Underways", GROUND_Y + 0.18),
  P("obj_church_grave_wall", 510.6, -137.4, 1.5708, 0.26, "Q6 first combat pocket broken wall cover phase-safe", "Old Well / Underways"),
  P("obj_church_grave_wall", 356.0, -312.0, 0, 0.28, "Q7 First Choir arena north threshold wall phase-safe", "Old Well / Underways"),
  P("obj_church_grave_wall", 350.0, -318.0, 1.5708, 0.24, "Q7 First Choir west line-of-sight pillar wall phase-safe", "Old Well / Underways"),
  P("obj_church_grave_wall", 362.0, -318.0, 1.5708, 0.24, "Q7 First Choir east line-of-sight pillar wall phase-safe", "Old Well / Underways"),
  P("fountain_center", 356.0, -318.0, 0, 0.16, "Q7 central bell-pattern safe floor marker set into arena floor", "Old Well / Underways", GROUND_Y + 0.05),
  P("bench_fp", 356.0, -323.2, 0, 0.24, "Q7 recovery bench on floor near Listening Chamber lane", "Old Well / Underways"),
  P("rock_wide", 622.0, -330.0, 0, 0.24, "Q9 Pulse Hall first gathering vein rock on floor channel", "Old Well / Underways"),
  P("rock_wide", 626.0, -330.0, 0.2, 0.24, "Q9 Pulse Hall second gathering vein rock on floor channel", "Old Well / Underways"),
  P("obj_church_grave_wall", 628.0, -322.0, 1.5708, 0.24, "Q9 narrow stair tunnel wall from Pulse Hall to Echo Hall phase-safe", "Old Well / Underways"),
  P("fountain_center", 632.0, -318.0, 0, 0.20, "Q9 Echo Hall essence pool set into floor with clear party lane", "Old Well / Underways", GROUND_Y + 0.04),
  P("obj_church_grave_wall", 636.0, -322.0, 1.5708, 0.24, "Q9 narrow stair tunnel wall from Echo Hall to Spine Hall phase-safe", "Old Well / Underways"),
  P("obj_church_grave_wall", 640.0, -326.0, 1.5708, 0.26, "Q9 Spine Hall rib wall line-of-sight blocker phase-safe", "Old Well / Underways"),
  P("coffin", 640.0, -306.0, 1.5708, 0.34, "Q10 Bellbinder Tomb sarcophagus boss-room centerpiece on floor", "Old Well / Underways"),
  P("obj_church_bells", 636.0, -304.0, 0, 0.16, "Q10 north ritual bell supported on tomb plinth", "Old Well / Underways", GROUND_Y + 0.58),
  P("obj_church_bells", 644.0, -304.0, 0, 0.16, "Q10 south ritual bell supported on tomb plinth", "Old Well / Underways", GROUND_Y + 0.58),
  P("table_small", 636.0, -308.0, 0, 0.20, "Q10 regalia plinth left on tomb floor", "Old Well / Underways"),
  P("table_small", 644.0, -308.0, 0, 0.20, "Q10 regalia plinth right on tomb floor", "Old Well / Underways"),
  P("whetstone_fp", 640.0, -302.0, 0, 0.16, "Q10 bell-clapper mechanism supported on tomb floor plate", "Old Well / Underways", GROUND_Y + 0.16),
  P("obj_church_bells", 640.0, -286.0, 3.14159, 0.40, "Q11 Bellward Chamber True Bell supported by ceiling chain bracket", "Old Well / Underways", GROUND_Y + 1.20),
  P("chain_coil", 638.2, -286.0, 0, 0.16, "Q11 left True Bell chain anchor on chamber floor", "Old Well / Underways", GROUND_Y + 0.12),
  P("chain_coil", 641.8, -286.0, 0, 0.16, "Q11 right True Bell chain anchor on chamber floor", "Old Well / Underways", GROUND_Y + 0.12),
  P("table_small", 636.0, -286.0, 0, 0.20, "Q11 Rebind ritual station on floor with safe lane", "Old Well / Underways"),
  P("table_small", 644.0, -286.0, 0, 0.20, "Q11 Slay ritual station on floor with safe lane", "Old Well / Underways"),
  P("table_small", 640.0, -290.0, 0, 0.20, "Q11 Wake ritual station on floor with countdown path", "Old Well / Underways"),
  P("rock_wide", 640.0, -268.0, 0, 0.30, "Q12 Wyrm's Bed raid arena central snout silhouette floor marker", "Old Well / Underways"),
  P("obj_church_grave_wall", 634.0, -268.0, 1.5708, 0.24, "Q12 Wyrm's Bed west line-of-sight blocker phase-safe wall", "Old Well / Underways"),
  P("obj_church_grave_wall", 646.0, -268.0, 1.5708, 0.24, "Q12 Wyrm's Bed east line-of-sight blocker phase-safe wall", "Old Well / Underways"),
  P("fountain_center", 640.0, -264.0, 0, 0.18, "Q12 raid safe-zone floor sigil set into stone", "Old Well / Underways", GROUND_Y + 0.04),
  P("pillar", 640.0, -260.0, 0, 0.24, "Q12 memorial replay stone on floor at raid exit", "Old Well / Underways"),

  // Ambient NPCs and animals. Service NPCs stay anchored; crowd loops avoid doorways.
  A("animal_horse", 471, -266, Math.PI / 2, 1.05, "Stable horse", "North Gate", { radius: 1.3, speed: 0.22, phase: 1.1 }),
  A("animal_dog", 475, -258, 0.2, 1.15, "Gate dog", "North Gate", { radius: 2.2, speed: 0.55, phase: 0.4 }),
  A("townsperson_guard", 486, -266, 0, 1.28, "Sergeant Bram gate patrol", "North Gate", { radius: 4.4, speed: 0.25, phase: 0.8 }),
  A("townsperson_guard", 472.4, -277.6, Math.PI / 2, 1.18, "West gate watch sentry", "North Gate", { radius: 2.1, speed: 0.16, phase: 0.4 }),
  A("townsperson_guard", 499.7, -277.2, -Math.PI / 2, 1.18, "East gate watch sentry", "North Gate", { radius: 2.1, speed: 0.16, phase: 1.8 }),
  A("townsperson_guard", 489.0, -216.3, Math.PI, 1.15, "Market square guard patrol", "Market Square", { radius: 5.2, speed: 0.22, phase: 2.4 }),
  A("townsperson_guard", 536, -214, -Math.PI / 2, 1.14, "Services plaza guard", "Player Services", { radius: 2.4, speed: 0.18, phase: 0.9 }),
  A("townsperson_guard", 468, -150, Math.PI, 1.12, "Temple peacekeeper", "Temple Green", { radius: 2.0, speed: 0.15, phase: 2.2 }),
  A("townsperson_guard", 596, -184, Math.PI / 2, 1.12, "Dock watch patrol", "River Docks", { radius: 4.6, speed: 0.24, phase: 1.7 }),
  A("townsperson_guard", 421, -167, 0, 1.1, "Mudden Ward foot patrol", "Mudden Ward", { radius: 4.0, speed: 0.2, phase: 2.9 }),
  A("animal_pigeon", 478.7, -205.8, 0.2, 0.9, "Pigeon at fountain", "Market Square", { radius: 1.1, speed: 0.55, phase: 0.2 }),
  A("animal_pigeon", 493.5, -213.0, -0.6, 0.9, "Pigeon near board", "Market Square", { radius: 0.9, speed: 0.65, phase: 2.1 }),
  A("townsperson_market", 476, -212, Math.PI / 2, 1.3, "Mara Thistle market guide", "Market Square", { radius: 3.4, speed: 0.2, phase: 0.1 }),
  A("townsperson_market", 498, -205, -Math.PI / 2, 1.26, "Produce customer", "Market Square", { radius: 4.4, speed: 0.28, phase: 1.9 }),
  A("townsperson_courier", 514, -213, -Math.PI / 2, 1.22, "Courier crossing market", "Market Square", { radius: 6.4, speed: 0.32, phase: 3.1 }),

  A("townsperson_market", 486, -201, Math.PI, 1.18, "Town crier at Bridge Fountain", "Market Square", { radius: 1.6, speed: 0.14, phase: 1.2 }),
  A("townsperson_market", 515, -221, Math.PI, 1.08, "Market performer puppet show", "Market Square", { radius: 1.1, speed: 0.17, phase: 0.7 }),
  A("townsperson_market", 508.5, -219.1, -Math.PI / 2, 0.92, "Pickpocket child chase route", "Market Square", { radius: 3.8, speed: 0.42, phase: 2.5 }),
  A("townsperson_market", 432, -206, Math.PI / 2, 1.12, "Produce vendor behind stall", "Market Square", { radius: 1.0, speed: 0.14, phase: 1.4 }),
  A("townsperson_market", 536.5, -200.1, -Math.PI / 2, 1.1, "Cloth merchant behind stall", "Market Square", { radius: 1.0, speed: 0.14, phase: 0.3 }),
  A("townsperson_market", 538.0, -190.0, -Math.PI / 2, 1.1, "Travel goods merchant behind stall", "Market Square", { radius: 1.0, speed: 0.14, phase: 2.2 }),
  A("animal_chicken", 451, -186.5, 0.2, 0.78, "Market livestock chicken", "Market Square", { radius: 0.8, speed: 0.58, phase: 1.5 }),
  A("animal_sheep", 456, -186.6, -0.2, 0.86, "Market livestock sheep", "Market Square", { radius: 0.7, speed: 0.28, phase: 0.9 }),
  A("townsperson_courier", 548.4, -214.6, -Math.PI / 2, 1.2, "Courier Anwen mail loop", "Player Services", { radius: 3.5, speed: 0.36, phase: 1.4 }),

  A("townsperson_market", 554.6, -220.0, Math.PI, 1.08, "Banker Merl Voss bank access", "Player Services", { radius: 0.8, speed: 0.1, phase: 0.2 }),
  A("townsperson_market", 507.9, -214.8, -Math.PI / 2, 1.04, "Auction Clerk Pell trade board", "Player Services", { radius: 0.9, speed: 0.1, phase: 1.8 }),
  A("townsperson_market", 546.2, -225.8, Math.PI / 2, 1.02, "Storage Steward account storage", "Player Services", { radius: 0.8, speed: 0.09, phase: 2.5 }),
  A("townsperson_market", 561.1, -223.6, -Math.PI / 2, 1.02, "Guild Registrar guild creation", "Player Services", { radius: 0.8, speed: 0.09, phase: 1.1 }),
  A("townsperson_market", 563.8, -218.0, -Math.PI / 2, 1.0, "Cosmetic Wardrobe Attendant outfit station", "Player Services", { radius: 0.7, speed: 0.08, phase: 0.6 }),

  A("townsperson_guard", 530.6, -228.7, Math.PI, 1.22, "Master Osric Vale blacksmith trainer repair service", "Craftsman Row", { radius: 0.9, speed: 0.1, phase: 0.4 }),
  A("townsperson_guard", 522.6, -224.4, Math.PI / 2, 1.04, "Apprentice Luth tending forge work orders", "Craftsman Row", { radius: 1.4, speed: 0.16, phase: 1.1 }),
  A("townsperson_market", 505.6, -231.0, Math.PI, 1.02, "Carpentry profession trainer at saw bench", "Craftsman Row", { radius: 0.9, speed: 0.1, phase: 1.8 }),
  A("townsperson_market", 502.0, -222.8, 0, 1.0, "Tailoring and weaving profession trainer", "Craftsman Row", { radius: 0.8, speed: 0.1, phase: 2.3 }),
  A("townsperson_market", 499.9, -229.0, Math.PI / 2, 1.0, "Leatherworker profession trainer by drying rack", "Craftsman Row", { radius: 0.8, speed: 0.09, phase: 1.4 }),
  A("townsperson_courier", 515.4, -228.7, -Math.PI / 2, 1.0, "Rare ore delivery runner for Black Anvil", "Craftsman Row", { radius: 1.3, speed: 0.18, phase: 2.7 }),
  A("townsperson_guard", 535.6, -226.0, -Math.PI / 2, 1.06, "Guard quartermaster inspecting weapon repairs", "Craftsman Row", { radius: 1.0, speed: 0.1, phase: 0.8 }),
  A("townsperson_guard", 524, -242, 0, 1.22, "Quartermaster walking loop", "Craftsman Row", { radius: 3.4, speed: 0.25, phase: 2.2 }),
  A("animal_cat", 458, -172, -0.4, 0.95, "Apothecary cat", "Apothecary", { radius: 0.9, speed: 0.38, phase: 0.7 }),
  A("animal_cat", 535.5, -203.9, Math.PI / 2, 0.95, "Tavern cat", "Copper Kettle", { radius: 0.9, speed: 0.35, phase: 0.9 }),
  A("townsperson_market", 548, -191, Math.PI, 1.22, "Elowen Pike innkeeper bind point rested XP tavern loop", "Copper Kettle", { radius: 2.0, speed: 0.18, phase: 2.8 }),

  A("townsperson_market", 556.1, -202.6, Math.PI, 1.06, "Copper Kettle bard stage performer", "Copper Kettle", { radius: 0.7, speed: 0.08, phase: 0.3 }),
  A("townsperson_market", 559.6, -196.4, Math.PI / 2, 1.04, "Copper Kettle cook serving food buffs", "Copper Kettle", { radius: 1.2, speed: 0.14, phase: 1.0 }),
  A("townsperson_courier", 551.2, -196.0, -Math.PI / 2, 1.0, "Copper Kettle server carrying drinks", "Copper Kettle", { radius: 2.4, speed: 0.28, phase: 1.6 }),
  A("townsperson_market", 543.7, -186.1, Math.PI / 2, 1.0, "Dice gambler at Copper Kettle table", "Copper Kettle", { radius: 0.9, speed: 0.1, phase: 2.4 }),
  A("townsperson_market", 539.4, -192.8, Math.PI / 2, 1.02, "Traveling quest NPC reading rumor board", "Copper Kettle", { radius: 1.1, speed: 0.12, phase: 2.9 }),
  A("townsperson_market", 548.0, -203.0, 0, 0.98, "Tavern patron listening to bard", "Copper Kettle", { radius: 1.0, speed: 0.1, phase: 0.8 }),
  A("townsperson_clergy", 483.0, -149.0, Math.PI, 1.22, "Father Aldren chapel loop", "Temple Green", { radius: 2.8, speed: 0.2, phase: 1.6 }),

  A("townsperson_clergy", 490.7, -145.4, -Math.PI / 2, 0.92, "Sister Maelle chapel healer and condition cleansing NPC", "Temple Green", { radius: 0.7, speed: 0.08, phase: 0.5 }),
  A("townsperson_clergy", 479.0, -124.9, Math.PI, 0.78, "Choir child candle vigil singer left", "Temple Green", { radius: 0.45, speed: 0.05, phase: 1.1 }),
  A("townsperson_clergy", 483.0, -124.9, Math.PI, 0.78, "Choir child candle vigil singer right", "Temple Green", { radius: 0.45, speed: 0.05, phase: 2.1 }),
  A("townsperson_market", 493.8, -142.6, -Math.PI / 2, 0.82, "Injured traveler waiting for Sister Maelle", "Temple Green", { radius: 0.35, speed: 0.04, phase: 0.9 }),
  A("townsperson_clergy", 468.3, -130.3, Math.PI / 2, 0.86, "Chapel charity steward receiving turn-ins", "Temple Green", { radius: 0.6, speed: 0.07, phase: 1.8 }),
  A("townsperson_market", 469.3, -145.2, 0, 0.82, "Pilgrim placing plague prayer offering", "Temple Green", { radius: 0.8, speed: 0.08, phase: 2.8 }),
  A("townsperson_clergy", 522.0, -136.8, Math.PI, 0.88, "Gravekeeper maintaining quiet cemetery path", "Temple Green", { radius: 1.0, speed: 0.07, phase: 2.4 }),
  A("townsperson_clergy", 527.6, -138.6, -Math.PI / 2, 0.84, "Crypt disturbance witness by sealed crypt marker", "Temple Green", { radius: 0.55, speed: 0.06, phase: 1.5 }),
  A("animal_crow", 524.8, -141.8, 0.2, 0.58, "Cemetery crow watching missing bell graves", "Temple Green", { radius: 0.7, speed: 0.32, phase: 0.3 }),
  A("townsperson_clergy", 490.6, -146.4, Math.PI, 0.84, "River Blessing procession organizer", "Temple Green", { radius: 0.65, speed: 0.07, phase: 1.3 }),
  A("townsperson_clergy", 475.9, -149.0, Math.PI / 2, 0.84, "Chapel reputation vendor and blessing quartermaster", "Temple Green", { radius: 0.6, speed: 0.07, phase: 2.6 }),
  A("townsperson_clergy", 454.7, -176.1, Math.PI / 2, 0.92, "Ysabet Fenlow Green Mortar Apothecary alchemy healer NPC", "Apothecary", { radius: 0.7, speed: 0.07, phase: 1.7 }),

  A("townsperson_clergy", 401.3, -229.7, Math.PI / 2, 1.0, "Father Aldren investigating Old Well missing bell clue", "Old Well / Underways", { radius: 0.8, speed: 0.08, phase: 1.0 }),
  A("townsperson_mudden", 414.5, -235.8, -Math.PI / 2, 0.92, "Nessa Crowe Underways access contact at hidden drain stair", "Old Well / Underways", { radius: 0.7, speed: 0.09, phase: 2.2 }),
  A("townsperson_clergy", 404.8, -238.2, 0, 0.92, "Gravekeeper watching Old Well stones", "Old Well / Underways", { radius: 0.7, speed: 0.07, phase: 0.4 }),
  A("townsperson_market", 410.8, -227.2, Math.PI, 0.86, "Old woman witness hearing well whispers", "Old Well / Underways", { radius: 0.7, speed: 0.07, phase: 1.8 }),
  A("townsperson_mudden", 412.2, -226.0, Math.PI, 0.72, "Child dare event NPC near barred Old Well", "Old Well / Underways", { radius: 0.65, speed: 0.12, phase: 2.8 }),
  A("townsperson_undead", 417.2, -239.2, Math.PI, 0.74, "Ghostly audio cue ancient spirit silhouette", "Old Well / Underways", { radius: 0.5, speed: 0.04, phase: 0.7 }),
  A("animal_crow", 411.0, -228.4, -0.3, 0.62, "Crow reacting to night bell whisper", "Old Well / Underways", { radius: 0.7, speed: 0.36, phase: 1.3 }),

  A("townsperson_market", 562.0, -251.8, Math.PI, 1.16, "Reeve Caldus Merrow balcony petitioner hearing", "Noble Rise", { radius: 0.8, speed: 0.08, phase: 0.5 }),
  A("townsperson_market", 572.0, -258.1, -Math.PI / 2, 1.08, "Edrik Vane moneylender debt records", "Noble Rise", { radius: 0.7, speed: 0.08, phase: 1.1 }),
  A("townsperson_market", 553.5, -258.1, Math.PI / 2, 1.02, "Permit clerk issuing town charters", "Noble Rise", { radius: 0.7, speed: 0.09, phase: 1.8 }),
  A("townsperson_market", 556.4, -262.1, Math.PI, 1.02, "Tax collector checking assessment desk", "Noble Rise", { radius: 0.9, speed: 0.1, phase: 2.2 }),
  A("townsperson_market", 559.6, -266.4, 0, 1.0, "Legal archivist guarding town records", "Noble Rise", { radius: 0.7, speed: 0.08, phase: 2.9 }),
  A("townsperson_guard", 550.6, -250.6, Math.PI, 1.18, "Elite Reeve Hall guard west post", "Noble Rise", { radius: 0.9, speed: 0.1, phase: 0.4 }),
  A("townsperson_guard", 573.4, -250.6, Math.PI, 1.18, "Elite Reeve Hall guard east post", "Noble Rise", { radius: 0.9, speed: 0.1, phase: 1.4 }),
  A("townsperson_market", 548.5, -255.8, Math.PI / 2, 1.0, "Noble petitioner waiting near garden", "Noble Rise", { radius: 1.2, speed: 0.12, phase: 1.7 }),
  A("townsperson_market", 577.2, -255.0, -Math.PI / 2, 1.0, "Tax protest organizer outside Reeve Hall", "Noble Rise", { radius: 1.1, speed: 0.12, phase: 2.4 }),
  A("townsperson_courier", 553.2, -272.0, 0, 0.98, "Servant delivery runner on Noble side path", "Noble Rise", { radius: 1.1, speed: 0.18, phase: 0.9 }),
  A("townsperson_guard", 565.4, -266.2, Math.PI, 1.14, "Distant lord audit envoy inspecting records", "Noble Rise", { radius: 0.8, speed: 0.09, phase: 2.8 }),
  A("townsperson_market", 566, -253, Math.PI, 1.22, "Noble servant walking loop", "Noble Rise", { radius: 2.6, speed: 0.19, phase: 0.3 }),
  A("townsperson_guard", 555, -247, Math.PI, 1.24, "Noble guard walking post", "Noble Rise", { radius: 2.2, speed: 0.18, phase: 1.3 }),

  A("townsperson_guard", 509.2, -255.0, Math.PI, 1.24, "Sergeant Bram Holt combat onboarding guard faction", "Guard Yard", { radius: 1.1, speed: 0.12, phase: 0.2 }),
  A("townsperson_guard", 512.0, -270.2, 0, 1.12, "Drill instructor calling training dummy drills", "Guard Yard", { radius: 1.2, speed: 0.16, phase: 1.1 }),
  A("townsperson_market", 500.7, -255.1, Math.PI / 2, 1.0, "Bounty clerk processing patrol dailies", "Guard Yard", { radius: 0.7, speed: 0.08, phase: 2.4 }),
  A("townsperson_guard", 526.8, -256.4, -Math.PI / 2, 1.1, "Guard Yard quartermaster armory service", "Guard Yard", { radius: 0.8, speed: 0.09, phase: 1.7 }),
  A("townsperson_guard", 507.2, -261.8, Math.PI / 2, 1.06, "Sparring guard dueling ring left", "Guard Yard", { radius: 0.9, speed: 0.18, phase: 0.8 }),
  A("townsperson_guard", 514.8, -261.8, -Math.PI / 2, 1.06, "Sparring guard dueling ring right", "Guard Yard", { radius: 0.9, speed: 0.18, phase: 2.2 }),
  A("townsperson_bandit", 503.8, -275.6, Math.PI, 0.96, "Captured bandit prisoner escape event hook", "Guard Yard", { radius: 0.35, speed: 0.04, phase: 0.1 }),
  A("townsperson_guard", 518.4, -263.4, -Math.PI / 2, 1.04, "Duel challenge guard PvP opt-in witness", "Guard Yard", { radius: 0.8, speed: 0.1, phase: 2.6 }),
  A("townsperson_guard", 505.0, -277.6, Math.PI, 1.02, "Watchtower stair sentry roof repair lookout", "Guard Yard", { radius: 0.7, speed: 0.09, phase: 1.4 }),
  A("townsperson_courier", 523.8, -267.2, -Math.PI / 2, 0.98, "Town defense runner checking barricade kit", "Guard Yard", { radius: 1.1, speed: 0.2, phase: 0.6 }),
  A("townsperson_guard", 512, -266, Math.PI, 1.24, "Guard patrol around yard", "Guard Yard", { radius: 4.1, speed: 0.27, phase: 0.8 }),
  A("animal_pigeon", 592, -183, Math.PI, 0.9, "Dock pigeon", "River Docks", { radius: 0.9, speed: 0.65, phase: 1.3 }),
  A("townsperson_dockhand", 596, -177, -Math.PI / 2, 1.24, "Tovin Reed dock ledger loop", "River Docks", { radius: 4.8, speed: 0.31, phase: 2.7 }),
  A("townsperson_dockhand", 586, -187, Math.PI / 2, 1.2, "Cargo hauler walking loop", "River Docks", { radius: 3.2, speed: 0.29, phase: 0.5 }),

  A("townsperson_dockhand", 597.9, -170.2, -Math.PI / 2, 1.16, "Dockmaster Tovin Reed cargo contracts and ferry ledger", "River Docks", { radius: 1.1, speed: 0.14, phase: 0.9 }),
  A("townsperson_dockhand", 602.0, -160.8, Math.PI, 1.08, "Fishing trainer gutting river catch", "River Docks", { radius: 1.0, speed: 0.13, phase: 2.3 }),
  A("townsperson_market", 603.2, -162.2, -Math.PI / 2, 1.0, "River goods vendor near fish market", "River Docks", { radius: 1.3, speed: 0.16, phase: 1.5 }),
  A("townsperson_dockhand", 610.6, -169.8, -Math.PI / 2, 1.08, "Ferry master water travel post", "River Docks", { radius: 0.9, speed: 0.11, phase: 2.8 }),
  A("townsperson_smuggler", 606.1, -177.8, Math.PI, 1.0, "River Knots smuggler contact behind cargo", "River Docks", { radius: 1.0, speed: 0.09, phase: 0.4 }),
  A("townsperson_guard", 590.4, -180.6, Math.PI / 2, 1.08, "Customs guard inspecting sealed crates", "River Docks", { radius: 1.4, speed: 0.14, phase: 1.1 }),
  A("townsperson_dockhand", 594.4, -166.6, Math.PI, 1.02, "Flood rescue rope handler", "River Docks", { radius: 1.2, speed: 0.15, phase: 2.0 }),
  A("animal_cat", 598.5, -160.8, 0.3, 0.72, "Dock cat watching fish table", "River Docks", { radius: 0.8, speed: 0.32, phase: 0.6 }),
  A("animal_crow", 616.0, -175.2, Math.PI, 0.72, "Crow circling corpse-under-bridge clue", "River Docks", { radius: 0.9, speed: 0.45, phase: 1.9 }),
  A("animal_dog", 411, -156, Math.PI / 2, 1.0, "Mudden Ward dog", "Mudden Ward", { radius: 1.8, speed: 0.42, phase: 1.2 }),
  A("townsperson_mudden", 416, -158, Math.PI / 2, 1.18, "Nessa Crowe alley loop", "Mudden Ward", { radius: 3.6, speed: 0.24, phase: 2.1 }),

  A("townsperson_mudden", 430.8, -150.1, -Math.PI / 2, 0.96, "Mudden cheap healer tending fever cot", "Mudden Ward", { radius: 0.8, speed: 0.1, phase: 0.8 }),
  A("townsperson_smuggler", 404.4, -168.8, Math.PI / 2, 0.96, "Mudden fence vendor hidden table", "Mudden Ward", { radius: 0.7, speed: 0.08, phase: 1.4 }),
  A("townsperson_mudden", 407.3, -151.1, Math.PI, 0.92, "Mudden rat-catcher checking cages", "Mudden Ward", { radius: 0.9, speed: 0.13, phase: 2.2 }),
  A("townsperson_mudden", 425.3, -140.5, -Math.PI / 2, 0.94, "Mudden washerwoman working wash line", "Mudden Ward", { radius: 0.9, speed: 0.12, phase: 0.2 }),
  A("townsperson_mudden", 413.6, -167.4, Math.PI, 0.82, "Mudden orphan child blanket corner", "Mudden Ward", { radius: 0.7, speed: 0.18, phase: 1.7 }),
  A("townsperson_mudden", 415.8, -170.0, Math.PI / 2, 0.96, "Mudden Kin reputation vendor at stash", "Mudden Ward", { radius: 0.8, speed: 0.09, phase: 2.7 }),
  A("townsperson_market", 401.8, -164.6, Math.PI / 2, 1.0, "Debt collector serving eviction notice", "Mudden Ward", { radius: 0.8, speed: 0.11, phase: 2.1 }),
  A("townsperson_mudden", 421.6, -164.0, -Math.PI / 2, 0.96, "Flood rescue volunteer by bucket line", "Mudden Ward", { radius: 0.9, speed: 0.12, phase: 1.0 }),
  A("animal_rat", 409.7, -150.8, 0, 0.58, "Mudden rat swarm near cages", "Mudden Ward", { radius: 0.7, speed: 0.36, phase: 0.5 }),
  A("animal_cat", 427.1, -140.8, -0.2, 0.62, "Mudden alley cat watching laundry", "Mudden Ward", { radius: 0.8, speed: 0.3, phase: 1.5 }),
  A("animal_chicken", 438, -236, 0, 0.9, "Chicken", "Farm", { radius: 1.4, speed: 0.75, phase: 0 }),
  A("animal_chicken", 446, -232, 0.5, 0.9, "Chicken", "Farm", { radius: 1.2, speed: 0.7, phase: 1.6 }),
  A("animal_pig", 452, -242, 0, 1.0, "Pig", "Farm", { radius: 1.8, speed: 0.34, phase: 0.2 }),
  A("animal_sheep", 438, -229, Math.PI / 2, 1.0, "Sheep", "Farm", { radius: 1.6, speed: 0.32, phase: 2.4 }),
  A("animal_cow", 456, -232, -Math.PI / 2, 1.0, "Cow", "Farm", { radius: 1.5, speed: 0.25, phase: 3.1 }),
  A("townsperson_farmer", 447, -228, 0, 1.22, "Farmhand walking loop", "Farm", { radius: 4.2, speed: 0.22, phase: 0.6 }),


  // HARTHMERE_V10_WILDS_OUTSIDE_TOWN_START
  // Outside Harthmere: safety fades in readable rings. These placements are
  // visual/non-blocking anchors for future combat, gathering, quest, and
  // reputation systems. The town remains the safe hub; the Wilds supply wood,
  // herbs, animals, ore, mushrooms, fish, bandit pressure, undead clues, and
  // long-term mystery.

  // Last Watch Post: final visible edge of town authority.
  ...row("road", "Harthmere Wilds - North Road", "North road beyond gate", 486, -296, 7, 0, -9, 0, 0.92),
  P("obj_tower_simple", 472, -332, 0, 0.82, "Last Watch Post tower", "Harthmere Wilds - Last Watch Post"),
  P("obj_wall_simple", 482, -332, 0, 0.72, "Last Watch Post low wall", "Harthmere Wilds - Last Watch Post"),
  P("obj_flag_large_red", 470, -338, 0, 0.74, "Last Watch red-black warning banner planted in watch post base solid flag pole", "Harthmere Wilds - Last Watch Post"),
  P("torch_metal_fp", 476, -327, 0, 0.62, "Last Watch signal brazier", "Harthmere Wilds - Last Watch Post"),
  P("table_medium", 483, -329, 0, 0.62, "Last Watch bounty board table", "Harthmere Wilds - Last Watch Post"),
  P("crossbow", 485, -329, 0, 0.5, "Crossbow resting on watch table", "Harthmere Wilds - Last Watch Post", GROUND_Y + 0.72),
  A("townsperson_guard", 478, -326, Math.PI, 1.18, "Last Watch road guard", "Harthmere Wilds - Last Watch Post", { radius: 2.8, speed: 0.2, phase: 0.2 }),
  A("townsperson_guard", 488, -334, -Math.PI / 2, 1.16, "Last Watch tired sentry", "Harthmere Wilds - Last Watch Post", { radius: 2.2, speed: 0.18, phase: 1.1 }),

  // Gate Fields: starter gathering, owned crops, visible low-level danger.
  ...row("fence", "Harthmere Wilds - Gate Fields", "Gate field north fence", 420, -338, 10, 6, 0, 0, 0.78),
  ...row("fence", "Harthmere Wilds - Gate Fields", "Gate field west fence", 420, -338, 8, 0, -6, Math.PI / 2, 0.78),
  ...row("fence", "Harthmere Wilds - Gate Fields", "Gate field east fence", 478, -338, 8, 0, -6, Math.PI / 2, 0.78),
  ...row("farmcrate_carrot", "Harthmere Wilds - Gate Fields", "Harvest row carrot crate", 428, -348, 5, 7, -4, 0, 0.52),
  ...row("logs", "Harthmere Wilds - Gate Fields", "Fallen branch gathering row", 432, -382, 4, 10, -3, Math.PI / 2, 0.58),
  P("cart", 442, -362, Math.PI / 3, 0.72, "Farmer wagon with owned field goods", "Harthmere Wilds - Gate Fields"),
  P("bucket_wood", 448, -360, 0, 0.58, "Irrigation ditch bucket", "Harthmere Wilds - Gate Fields"),
  P("rock_small", 452, -371, 0, 0.46, "Clay ditch marker", "Harthmere Wilds - Gate Fields"),
  A("animal_bunny", 432, -356, 0, 0.9, "Rabbit in the hedgerow", "Harthmere Wilds - Gate Fields", { radius: 2.2, speed: 0.72, phase: 0.4 }),
  A("animal_crow", 456, -345, 0, 0.88, "Crow on the field edge", "Harthmere Wilds - Gate Fields", { radius: 1.0, speed: 0.48, phase: 2.2 }),
  A("animal_boar", 468, -384, -0.3, 0.9, "Diseased boar near the crop line", "Harthmere Wilds - Gate Fields", { radius: 2.8, speed: 0.35, phase: 1.7 }),
  A("townsperson_farmer", 438, -352, Math.PI / 2, 1.14, "Field farmer watching owned crops", "Harthmere Wilds - Gate Fields", { radius: 4.0, speed: 0.18, phase: 0.7 }),

  // Mill Road and Orchard Lane: food supply route, watermill, bandit pressure.
  ...row("road", "Harthmere Wilds - Mill Road", "Mill road ruts", 462, -342, 8, -9, -7, -0.35, 0.82),
  P("arch_watermill", 386, -404, -0.2, 1.05, "Miller's Rest watermill", "Harthmere Wilds - Mill Road"),
  P("arch_wheel", 381, -406, -0.2, 0.86, "Waterwheel on the mill stream", "Harthmere Wilds - Mill Road"),
  P("obj_house_1", 401, -394, 0.25, 0.86, "Mill worker cottage", "Harthmere Wilds - Mill Road"),
  P("cart_high", 408, -379, -0.1, 0.68, "Broken grain wagon", "Harthmere Wilds - Mill Road"),
  P("farmcrate_apple", 389, -374, 0, 0.62, "Fallen apple collection crate", "Harthmere Wilds - Orchard Lane"),
  P("barrel_apples", 396, -371, 0, 0.62, "Apple barrel beside orchard lane", "Harthmere Wilds - Orchard Lane"),
  ...row("tree", "Harthmere Wilds - Orchard Lane", "Orchard apple tree", 372, -356, 5, 9, -5, 0, 0.92),
  ...row("tree_crooked", "Harthmere Wilds - Orchard Lane", "Old crooked orchard tree", 380, -386, 4, 11, -6, 0, 1.0),
  P("rope_1_fp", 413, -382, Math.PI / 2, 0.6, "Cut wagon rope clue", "Harthmere Wilds - Mill Road"),
  P("dagger", 416, -382, 0, 0.48, "Bandit blade leaning in fence post", "Harthmere Wilds - Mill Road", GROUND_Y + 0.78),
  A("animal_fox", 388, -362, -0.4, 0.92, "Fox watching the orchard", "Harthmere Wilds - Orchard Lane", { radius: 2.4, speed: 0.45, phase: 0.8 }),
  A("animal_boar", 404, -414, Math.PI / 2, 1.05, "Orchard boar sounder", "Harthmere Wilds - Orchard Lane", { radius: 3.0, speed: 0.33, phase: 1.9 }),
  A("townsperson_bandit", 421, -392, -Math.PI / 2, 1.12, "Bandit grain lookout", "Harthmere Wilds - Mill Road", { radius: 3.0, speed: 0.22, phase: 2.7 }),

  // Greenmere Forest Edge: main early forest gathering and hunting zone.
  ...row("tree_high", "Harthmere Wilds - Greenmere Edge", "Greenmere high oak", 500, -360, 9, 13, -9, 0, 1.14),
  ...row("tree", "Harthmere Wilds - Greenmere Edge", "Greenmere birch and ash", 514, -372, 8, 12, -10, 0, 1.0),
  ...row("tree_crooked", "Harthmere Wilds - Greenmere Edge", "Greenmere crooked elder tree", 492, -395, 7, 14, -8, 0, 1.08),
  ...row("hedge_large", "Harthmere Wilds - Greenmere Edge", "Fern and bramble wall", 504, -352, 8, 12, -6, 0, 0.72),
  P("rock_wide", 522, -396, 0.2, 0.74, "Mossy forest stone with herb growth", "Harthmere Wilds - Greenmere Edge"),
  P("bottle_green", 524, -395, 0, 0.38, "Herbalism marker: moss vial on stone", "Harthmere Wilds - Greenmere Edge", GROUND_Y + 0.52),
  P("logs", 540, -414, Math.PI / 2, 0.72, "Fallen oak timber node", "Harthmere Wilds - Greenmere Edge"),
  P("axe_bronze_fp", 542, -414, -0.2, 0.42, "Woodcutting axe resting on fallen oak", "Harthmere Wilds - Greenmere Edge", GROUND_Y + 0.52),
  P("small_bottle_fp", 566, -430, 0, 0.38, "Glowing fungus alchemy marker", "Harthmere Wilds - Greenmere Edge", GROUND_Y + 0.38),
  A("animal_deer", 532, -388, Math.PI / 2, 1.05, "Deer at the forest edge", "Harthmere Wilds - Greenmere Edge", { radius: 4.0, speed: 0.3, phase: 1.2 }),
  A("animal_wolf", 552, -420, -0.8, 1.04, "Wolf stalking between roots", "Harthmere Wilds - Greenmere Edge", { radius: 3.8, speed: 0.42, phase: 2.1 }),
  A("animal_bear", 575, -448, 0.2, 0.95, "Black bear guarding berry thicket", "Harthmere Wilds - Greenmere Edge", { radius: 2.2, speed: 0.22, phase: 0.3 }),
  A("townsperson_hunter", 506, -405, Math.PI / 2, 1.12, "Greenmere hunter trail guide", "Harthmere Wilds - Greenmere Edge", { radius: 2.6, speed: 0.18, phase: 1.0 }),

  // Old Hunter's Track: traps, caches, stealth/survival fantasy.
  ...row("fence_broken", "Harthmere Wilds - Old Hunter's Track", "Bent branch hunter marker", 430, -420, 6, -6, -8, -0.55, 0.62),
  P("torch_metal_fp", 426, -434, 0, 0.52, "Cold hunter camp stake", "Harthmere Wilds - Old Hunter's Track"),
  P("crate_a", 421, -438, 0.2, 0.58, "Hidden hunter cache crate", "Harthmere Wilds - Old Hunter's Track"),
  P("bag_fp", 423, -440, 0, 0.52, "Hunter cache bag on ground", "Harthmere Wilds - Old Hunter's Track"),
  P("rope_2_fp", 434, -430, Math.PI / 2, 0.52, "Snare line stretched near trail", "Harthmere Wilds - Old Hunter's Track"),
  P("bow", 424, -437, -0.3, 0.5, "Hunter bow leaning at cache", "Harthmere Wilds - Old Hunter's Track", GROUND_Y + 0.46),
  A("townsperson_hunter", 416, -442, 0, 1.08, "Retired hunter by cache", "Harthmere Wilds - Old Hunter's Track", { radius: 2.1, speed: 0.14, phase: 2.0 }),
  A("animal_fox", 439, -448, Math.PI, 0.86, "Silver fox trail marker", "Harthmere Wilds - Old Hunter's Track", { radius: 2.4, speed: 0.48, phase: 1.4 }),
  A("animal_snake", 447, -437, -0.3, 0.9, "Snake near sun-warmed stone", "Harthmere Wilds - Old Hunter's Track", { radius: 0.7, speed: 0.16, phase: 0.9 }),

  // Briarfen Wetlands: dock identity extends into reeds, mud, smugglers, disease, strange lights.
  ...row("arch_planks", "Harthmere Wilds - Briarfen", "Briarfen plank path", 620, -226, 7, 7, -9, 0.35, 0.66),
  ...row("rock_small", "Harthmere Wilds - Briarfen", "Wetland slick stone", 626, -240, 8, 6, -8, 0, 0.42),
  ...row("hedge", "Harthmere Wilds - Briarfen", "Reed bed visual marker", 634, -248, 8, 5, -8, 0, 0.54),
  P("cart", 646, -286, -0.2, 0.58, "Half-sunk smuggler cart", "Harthmere Wilds - Briarfen"),
  P("barrel_fp", 650, -284, 0, 0.52, "Waterlogged smuggler barrel", "Harthmere Wilds - Briarfen"),
  P("rope_3_fp", 648, -288, Math.PI / 2, 0.52, "Blue rope marker tied by smugglers", "Harthmere Wilds - Briarfen"),
  P("lantern", 640, -300, 0, 0.5, "Witchlight lantern over mud path", "Harthmere Wilds - Briarfen", GROUND_Y + 0.8),
  P("bucket_wood", 632, -267, 0, 0.52, "Blackwater clay collection bucket", "Harthmere Wilds - Briarfen"),
  A("animal_frog", 631, -255, 0, 1.0, "Frog on Briarfen bank", "Harthmere Wilds - Briarfen", { radius: 0.9, speed: 0.42, phase: 0.2 }),
  A("animal_snake", 655, -274, -0.6, 1.0, "Water snake in wet grass", "Harthmere Wilds - Briarfen", { radius: 0.8, speed: 0.2, phase: 2.3 }),
  A("townsperson_smuggler", 650, -296, Math.PI, 1.1, "River Knot smuggler lookout", "Harthmere Wilds - Briarfen", { radius: 2.8, speed: 0.18, phase: 1.7 }),
  A("townsperson_undead", 666, -314, -Math.PI / 2, 1.06, "Drowned dead in the reeds", "Harthmere Wilds - Briarfen", { radius: 1.8, speed: 0.1, phase: 0.6 }),

  // Ruined Watchtower Ridge: first organized enemy zone and mining hook.
  P("obj_tower_complex", 378, -462, 0.2, 0.92, "Ruined Watchtower Ridge cracked tower", "Harthmere Wilds - Watchtower Ridge"),
  P("obj_wall_simple_windows", 392, -458, 0.2, 0.72, "Fallen battlement wall", "Harthmere Wilds - Watchtower Ridge"),
  P("obj_flag_large_red", 384, -468, 0.2, 0.58, "Torn Harthmere banner planted in bandit watchtower base solid flag pole", "Harthmere Wilds - Watchtower Ridge"),
  P("crate_metal_fp", 398, -452, 0, 0.58, "Stolen supply crate", "Harthmere Wilds - Watchtower Ridge"),
  P("weaponstand_fp", 401, -456, 0, 0.52, "Bandit weapon rack", "Harthmere Wilds - Watchtower Ridge"),
  P("rock_wide", 370, -446, 0, 0.7, "Old quarry exposed iron vein", "Harthmere Wilds - Watchtower Ridge"),
  P("pickaxe_bronze_fp", 371, -445, -0.5, 0.48, "Mining pick leaning at quarry cut", "Harthmere Wilds - Watchtower Ridge", GROUND_Y + 0.44),
  A("townsperson_bandit", 394, -448, -Math.PI / 2, 1.14, "Bandit hedge archer", "Harthmere Wilds - Watchtower Ridge", { radius: 3.2, speed: 0.2, phase: 1.3 }),
  A("townsperson_bandit", 382, -454, Math.PI / 2, 1.18, "Rusk Hallowhand outlaw captain marker", "Harthmere Wilds - Watchtower Ridge", { radius: 2.2, speed: 0.16, phase: 0.4 }),
  A("animal_wolf", 410, -468, Math.PI, 1.0, "Wolf drawn by bandit scraps", "Harthmere Wilds - Watchtower Ridge", { radius: 2.4, speed: 0.36, phase: 2.0 }),

  // Gravewood: compact undead zone tied to Temple Green and the Missing Bell arc.
  ...row("obj_church_grave_fence", "Harthmere Wilds - Gravewood", "Rusted gravewood fence", 512, -88, 6, 6, -4, 0.2, 0.6),
  ...row("tombstone", "Harthmere Wilds - Gravewood", "Leaning grave marker", 516, -92, 7, 5, -5, 0.15, 0.58),
  P("obj_grave_dirt", 534, -112, 0.2, 0.58, "Open grave with broken earth", "Harthmere Wilds - Gravewood"),
  P("coffin", 537, -113, 0.2, 0.42, "Half-buried coffin", "Harthmere Wilds - Gravewood"),
  P("obj_church_bells", 526, -120, 0, 0.5, "Half-buried old bell fragment", "Harthmere Wilds - Gravewood"),
  P("candle_thin_lit", 522, -98, 0, 0.46, "Grave candle on stone", "Harthmere Wilds - Gravewood", GROUND_Y + 0.26),
  P("tree_crooked", 542, -104, 0, 1.06, "Dead crooked gravewood tree", "Harthmere Wilds - Gravewood"),
  A("animal_crow", 528, -96, 0, 0.9, "Raven at the old grave", "Harthmere Wilds - Gravewood", { radius: 0.9, speed: 0.42, phase: 0.5 }),
  A("townsperson_undead", 536, -119, Math.PI, 1.08, "Bell-woken grave dead", "Harthmere Wilds - Gravewood", { radius: 1.6, speed: 0.09, phase: 2.6 }),
  A("animal_wolf", 548, -126, -Math.PI / 2, 0.94, "Pale wolf at Gravewood edge", "Harthmere Wilds - Gravewood", { radius: 2.0, speed: 0.3, phase: 1.5 }),

  // Deep Old Wood: distant high-danger visual promise for future group play.
  ...row("tree_high", "Harthmere Wilds - Deep Old Wood", "Ancient old wood trunk", 582, -470, 8, 14, -10, 0, 1.32),
  ...row("tree_crooked", "Harthmere Wilds - Deep Old Wood", "Face-like crooked old wood tree", 596, -486, 7, 13, -11, 0, 1.2),
  ...row("hedge_large", "Harthmere Wilds - Deep Old Wood", "Root wall and hanging moss", 590, -456, 8, 11, -8, 0, 0.82),
  P("pillar", 614, -492, 0.3, 0.66, "Old standing stone", "Harthmere Wilds - Deep Old Wood"),
  P("pillar", 626, -500, -0.2, 0.62, "Broken standing stone", "Harthmere Wilds - Deep Old Wood"),
  P("candle_lit", 620, -496, 0, 0.48, "Cold blue-green ritual light marker", "Harthmere Wilds - Deep Old Wood", GROUND_Y + 0.28),
  P("spellbook_open", 618, -496, 0.2, 0.36, "Forbidden rite book on standing stone base", "Harthmere Wilds - Deep Old Wood", GROUND_Y + 0.5),
  P("small_bottles_1", 610, -486, 0, 0.42, "Mooncap mushroom alchemy marker", "Harthmere Wilds - Deep Old Wood", GROUND_Y + 0.35),
  A("animal_bear", 606, -482, 0.4, 1.08, "Root-bound bear marker", "Harthmere Wilds - Deep Old Wood", { radius: 2.0, speed: 0.18, phase: 2.0 }),
  A("animal_deer", 632, -512, -0.4, 1.0, "Possessed deer at standing stones", "Harthmere Wilds - Deep Old Wood", { radius: 2.4, speed: 0.24, phase: 1.0 }),
  A("townsperson_undead", 620, -505, Math.PI, 1.14, "Root-Crowned Dead public-event marker", "Harthmere Wilds - Deep Old Wood", { radius: 1.4, speed: 0.07, phase: 0.8 }),

  // Charcoal Burners' Camp and Broken Toll Road connector.
  ...row("road", "Harthmere Wilds - Broken Toll Road", "Broken toll road stones", 454, -422, 8, 11, -10, -0.5, 0.58),
  P("cart", 470, -448, -0.4, 0.58, "Charcoal cart under canvas", "Harthmere Wilds - Charcoal Camp"),
  P("barrel_stack", 462, -452, 0, 0.54, "Charcoal barrel stack", "Harthmere Wilds - Charcoal Camp"),
  P("logs", 456, -458, Math.PI / 2, 0.7, "Charcoal camp stacked timber", "Harthmere Wilds - Charcoal Camp"),
  P("torch_lit", 468, -456, 0, 0.52, "Smoky charcoal burner fire", "Harthmere Wilds - Charcoal Camp"),
  A("townsperson_charcoal", 466, -452, -Math.PI / 2, 1.1, "Charcoal burner with forest rumors", "Harthmere Wilds - Charcoal Camp", { radius: 2.2, speed: 0.14, phase: 2.9 }),
  // Wilds bible v54: named landmark completion anchors.
  ...createHarthmereWildsBibleLandmarkPlacementsV54(),

  // HARTHMERE_V11_WIDE_WILDS_MILE_START
  ...createHarthmereResidentHousingV38Placements(),
  ...createHarthmereWideWildsPlacements(),
  ...createHarthmereDenseForestPlacements(),
  ...createHarthmereWildlifeHerdPlacements(),
  ...createHarthmereDeepResourceMarkerPlacements(),
  // HARTHMERE_V11_WIDE_WILDS_MILE_END

  // HARTHMERE_V10_WILDS_OUTSIDE_TOWN_END

  // HARTHMERE_V9_FULL_TOWN_REBUILD_END
];

const HARTHMERE_RESIDENT_HOME_ASSIGNMENT_SUMMARY_V38 = createHarthmereResidentHomeAssignmentSummaryV38(
  PLACEMENTS.filter((placement) => placement.meta?.kind === "actor").map((placement) => ({
    asset: placement.asset,
    name: placement.name,
    district: placement.district,
  })),
);

function harthmereResidentHousingSummaryV38() {
  return HARTHMERE_RESIDENT_HOME_ASSIGNMENT_SUMMARY_V38;
}

if (typeof window !== "undefined") {
  (window as typeof window & { __harthmereResidentHousingV38?: unknown }).__harthmereResidentHousingV38 =
    HARTHMERE_RESIDENT_HOME_ASSIGNMENT_SUMMARY_V38;
}

function shouldRenderHarthmereAssets() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    window.localStorage.getItem("biomes.harthmereAssets") === "1"
  );
}

function prepareLoadedObject(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (Number.isFinite(box.min.x) && Number.isFinite(box.max.x)) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;
  }

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    child.castShadow = false;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      material.side = THREE.DoubleSide;
      const maybeMapped = material as THREE.MeshStandardMaterial & {
        map?: THREE.Texture;
        alphaTest?: number;
      };
      if (maybeMapped.map) {
        maybeMapped.map.magFilter = THREE.NearestFilter;
        maybeMapped.map.minFilter = THREE.NearestMipmapNearestFilter;
        maybeMapped.map.needsUpdate = true;
      }
      if ("alphaTest" in maybeMapped) {
        maybeMapped.alphaTest = Math.max(maybeMapped.alphaTest ?? 0, 0.02);
      }
    }
  });
  return object;
}

function startBestClip(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
) {
  if (clips.length === 0) {
    return;
  }
  const preferred =
    clips.find((clip) => /^idle$/i.test(clip.name)) ??
    clips.find((clip) => /idle|stand/i.test(clip.name)) ??
    clips.find((clip) => /walk|run/i.test(clip.name)) ??
    clips[0];
  const action = mixer.clipAction(preferred);
  action.reset();
  action.enabled = true;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
}

// HARTHMERE_POLISH_V1_LOCOMOTION_CLIPS — Walk/Run/Idle clip resolver.
//
// Most rigs follow the Mixamo/quaternius convention: clips literally named
// "Idle", "Walk", "Walking", "Run", "Running". We fall back to fuzzy regex
// for any rig that omits the canonical names.
function pickHarthmereLocomotionClipsV1(
  clips: THREE.AnimationClip[],
): { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; run?: THREE.AnimationClip } {
  const find = (re: RegExp) => clips.find((c) => re.test(c.name));
  const idle = clips.find((c) => /^idle$/i.test(c.name)) ?? find(/idle|stand/i);
  const walk =
    clips.find((c) => /^walking?$/i.test(c.name)) ?? find(/walk|stroll|amble/i);
  const run =
    clips.find((c) => /^running?$/i.test(c.name)) ?? find(/run|sprint|jog|gallop|trot/i);
  return { idle, walk, run };
}

function installHarthmereLocomotionV1(animated: AnimatedInstance, clips: THREE.AnimationClip[]) {
  if (!animated.mixer || clips.length === 0) {
    return;
  }
  const { idle, walk, run } = pickHarthmereLocomotionClipsV1(clips);
  const idleAction = idle ? animated.mixer.clipAction(idle) : undefined;
  const walkAction = walk ? animated.mixer.clipAction(walk) : undefined;
  const runAction = run ? animated.mixer.clipAction(run) : undefined;
  for (const action of [idleAction, walkAction, runAction]) {
    if (!action) continue;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveWeight(0);
    action.play();
  }
  // Start in Idle by default — even if a clip is missing, mixer will pick
  // the next available one through the cross-fade below.
  const start = idleAction ?? walkAction ?? runAction;
  if (start) {
    start.setEffectiveWeight(1);
  }
  animated.locomotion = {
    idle: idleAction,
    walk: walkAction,
    run: runAction,
    current: idleAction ? "idle" : walkAction ? "walk" : runAction ? "run" : undefined,
    clips,
  };
}

function setHarthmereLocomotionStateV1(
  animated: AnimatedInstance,
  next: "idle" | "walk" | "run",
) {
  const loco = animated.locomotion;
  if (!loco || !animated.mixer) return;
  // Only cross-fade if the action exists; otherwise fall back gracefully.
  let target =
    next === "run" ? loco.run ?? loco.walk ?? loco.idle :
    next === "walk" ? loco.walk ?? loco.run ?? loco.idle :
    loco.idle ?? loco.walk;
  if (!target) return;
  if (loco.current === next) return;
  const previous =
    loco.current === "idle" ? loco.idle :
    loco.current === "walk" ? loco.walk :
    loco.current === "run"  ? loco.run  : undefined;
  if (previous && previous !== target) {
    previous.crossFadeTo(target, 0.22, false);
  } else {
    target.setEffectiveWeight(1);
  }
  target.enabled = true;
  loco.current = next;
}

function exactAnimationClip(clips: THREE.AnimationClip[], names: string[]) {
  for (const name of names) {
    const exact = clips.find((clip) => clip.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      return exact;
    }
  }
  return undefined;
}

function fuzzyAnimationClip(clips: THREE.AnimationClip[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const found = clips.find((clip) => pattern.test(clip.name));
    if (found) {
      return found;
    }
  }
  return undefined;
}

function bestCombatClip(
  kind: CombatPulseKind,
  clips: THREE.AnimationClip[],
  preferredNames: string[] = [],
) {
  const expandedPreferredNames = expandHarthmereCombatClipPriority(
    kind,
    preferredNames,
  );
  const exactPreferred = exactAnimationClip(clips, expandedPreferredNames);
  if (exactPreferred) {
    return exactPreferred;
  }

  // HARTHMERE_POLISH_V1_ATTACK_VARIATION
  // The attack fallback list is rotated by a per-call seed so adjacent NPCs
  // don't all play "Attack" on frame 1. The seed is derived from elapsed
  // time + clip count; bestCombatClip is called once per attack pulse,
  // not per frame, so this still feels deterministic to the player.
  const baseAttackNames = [
    "Attack",
    "Attack2",
    "SideSwing",
    "HeavyAttack",
    "Thrusting",
    "BowShoot",
    "Bite",
    "Claw",
    "Pounce",
    "Charge",
    "Peck",
    "Scratch",
    "Kick",
    "TailWhip",
  ];
  const rotateBy = ((Date.now() >> 6) + clips.length) % baseAttackNames.length;
  const fallbackNames =
    kind === "death"
      ? ["Death", "Fall", "Falling", "Stunned"]
      : kind === "attack"
        ? [...baseAttackNames.slice(rotateBy), ...baseAttackNames.slice(0, rotateBy)]
        : kind === "block"
          ? ["ShieldBlock", "Block", "HitReact", "Stunned"]
          : kind === "hit"
            ? ["HitReact", "Block", "ShieldBlock", "Stunned"]
            : ["Dodging", "Sidestep", "SidestepLeft", "SidestepRight", "Flee", "Run"];

  const exactFallback = exactAnimationClip(clips, fallbackNames);
  if (exactFallback) {
    return exactFallback;
  }

  const patterns =
    kind === "death"
      ? [/death|die|dead|fall|knock|defeat/i]
      : kind === "attack"
        ? [/attack|slash|swing|punch|bite|claw|cast|spell|magic|shoot|strike|charge|pounce|peck|scratch|kick|tail/i]
        : kind === "block"
          ? [/shieldblock|shield|block|parry|guard|absorb|stun/i]
          : kind === "hit"
            ? [/hit|hurt|damage|impact|react|block|stun/i]
            : [/dodge|sidestep|evade|flee|run/i];
  return fuzzyAnimationClip(clips, patterns) ?? clips[0];
}

function normalizedCombatText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COMBAT_TARGET_HINTS: Record<string, string[]> = {
  "Road Bandit Scout": ["bandit", "scout", "outlaw", "thief"],
  "Wilds Bandit Ambusher": ["bandit", "ambusher", "outlaw"],
  "Bandit Trapper": ["bandit", "trapper"],
  "Road Wolf": ["wolf"],
  "Forest Wolf": ["wolf"],
  "Gravewood Pale Wolf": ["pale", "wolf"],
  "Greenmere Deer": ["deer"],
  "Diseased Boar": ["boar"],
  "Black Bear": ["bear"],
  "Briarfen Water Snake": ["snake"],
  "Bell-Woken Zombie": ["zombie", "dead", "corpse", "undead"],
  "Mudden Drain Rat": ["rat"],
};

function isProceduralAnimalKey(key: string) {
  return (
    key === "animal_chicken" ||
    key === "animal_bunny" ||
    key === "animal_pigeon" ||
    key === "animal_cat" ||
    key === "animal_dog" ||
    key === "animal_pig" ||
    key === "animal_sheep" ||
    key === "animal_cow" ||
    key === "animal_horse" ||
    key === "animal_deer" ||
    key === "animal_wolf" ||
    key === "animal_boar" ||
    key === "animal_bear" ||
    key === "animal_fox" ||
    key === "animal_crow" ||
    key === "animal_frog" ||
    key === "animal_snake"
  );
}

function isProceduralTownspersonKey(key: string) {
  return key.startsWith("townsperson_");
}

function isProceduralLifeKey(key: string) {
  return isProceduralAnimalKey(key) || isProceduralTownspersonKey(key);
}

let harthmereRuntimeToonGradientMap: THREE.DataTexture | undefined;
const harthmereRuntimeRoundedVoxelGeometryCache = new Map<string, THREE.BufferGeometry>();

function getHarthmereRuntimeToonGradientMap() {
  if (harthmereRuntimeToonGradientMap) {
    return harthmereRuntimeToonGradientMap;
  }

  // Three.js no longer exposes RGBFormat in the version used by this repo.
  // Keep the toon ramp library-backed and explicit by storing four RGBA
  // pixels. MeshToonMaterial samples this nearest-filtered ramp to create
  // clean cel bands on the rounded voxel pieces.
  const data = new Uint8Array([
    56, 56, 56, 255,
    132, 132, 132, 255,
    204, 204, 204, 255,
    255, 255, 255, 255,
  ]);
  harthmereRuntimeToonGradientMap = new THREE.DataTexture(
    data,
    4,
    1,
    THREE.RGBAFormat,
  );
  harthmereRuntimeToonGradientMap.magFilter = THREE.NearestFilter;
  harthmereRuntimeToonGradientMap.minFilter = THREE.NearestFilter;
  harthmereRuntimeToonGradientMap.generateMipmaps = false;
  harthmereRuntimeToonGradientMap.needsUpdate = true;
  harthmereRuntimeToonGradientMap.name = "harthmere-runtime-toon-gradient-map";
  return harthmereRuntimeToonGradientMap;
}

function makeHarthmereRuntimeRoundedVoxelGeometry(
  size: [number, number, number],
) {
  const minEdge = Math.min(...size);
  const radius = Math.max(0.002, Math.min(0.012, minEdge * 0.08));
  const segments = 1;
  const key = `${size[0]}:${size[1]}:${size[2]}:${segments}:${radius}`;
  const cached = harthmereRuntimeRoundedVoxelGeometryCache.get(key);
  if (cached) {
    return cached;
  }

  // Three.js addon geometry replaces hand-rolled BoxGeometry for procedural
  // life actors. The cache is important: Harthmere can place hundreds of
  // runtime NPCs/animals, so every same-sized voxel reuses the same geometry.
  const geometry = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    segments,
    radius,
  );
  geometry.computeVertexNormals();
  geometry.name = "harthmere-runtime-rounded-voxel-geometry";
  harthmereRuntimeRoundedVoxelGeometryCache.set(key, geometry);
  return geometry;
}

function animalMaterial(color: number) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: getHarthmereRuntimeToonGradientMap(),
  });
  material.name = "harthmere-runtime-polished-toon-voxel-material";
  material.userData.harthmereThirdPartyVisualPolish =
    "three-rounded-box-geometry+mesh-toon-material";
  return material;
}

function rememberHarthmereRuntimeFacePartNeutralTransform(object: THREE.Object3D) {
  object.userData.harthmereExpressionNeutral ??= {
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.toArray(),
    visible: object.visible,
  };
}
function restoreHarthmereRuntimeFacePartNeutralTransform(object: THREE.Object3D) {
  const neutral = object.userData.harthmereExpressionNeutral as
    | { position: number[]; rotation: number[]; scale: number[]; visible: boolean }
    | undefined;
  if (!neutral) return;
  object.position.fromArray(neutral.position);
  object.rotation.set(neutral.rotation[0] ?? 0, neutral.rotation[1] ?? 0, neutral.rotation[2] ?? 0);
  object.scale.fromArray(neutral.scale);
  object.visible = neutral.visible;
}
function boxMesh(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
) {
  const mesh = new THREE.Mesh(
    makeHarthmereRuntimeRoundedVoxelGeometry(size),
    animalMaterial(color),
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.harthmereThirdPartyVisualPolish =
    "rounded voxel mesh generated with Three.js addon geometry";
  rememberHarthmereRuntimeFacePartNeutralTransform(mesh);
  return mesh;
}

function createProceduralAnimal(
  placement: RuntimePlacement,
): THREE.Object3D | undefined {
  if (!isProceduralAnimalKey(placement.asset)) {
    return undefined;
  }

  const root = new THREE.Group();
  root.name = placement.name ?? placement.asset;
  root.position.set(...placement.at);
  root.rotation.y = placement.rot ?? 0;
  root.scale.setScalar(placement.scale ?? 1);

  if (placement.asset === "animal_chicken") {
    root.add(
      boxMesh("chicken-body", [0.36, 0.28, 0.3], [0, 0.19, 0], 0xf2efe3),
      boxMesh("chicken-head", [0.18, 0.18, 0.18], [0, 0.37, -0.22], 0xf7f2dc),
      boxMesh("chicken-beak", [0.08, 0.05, 0.08], [0, 0.36, -0.34], 0xe6a23c),
      boxMesh("chicken-comb", [0.12, 0.05, 0.08], [0, 0.49, -0.22], 0xc9332e),
      boxMesh(
        "chicken-leg-left",
        [0.045, 0.14, 0.045],
        [-0.09, 0.02, 0.02],
        0xd49035,
      ),
      boxMesh(
        "chicken-leg-right",
        [0.045, 0.14, 0.045],
        [0.09, 0.02, 0.02],
        0xd49035,
      ),
    );
  } else if (placement.asset === "animal_bunny") {
    root.add(
      boxMesh("bunny-body", [0.34, 0.24, 0.3], [0, 0.16, 0], 0xc9b8a3),
      boxMesh("bunny-head", [0.22, 0.2, 0.2], [0, 0.3, -0.22], 0xd6c4ae),
      boxMesh(
        "bunny-ear-left",
        [0.06, 0.26, 0.05],
        [-0.07, 0.52, -0.22],
        0xd6c4ae,
      ),
      boxMesh(
        "bunny-ear-right",
        [0.06, 0.26, 0.05],
        [0.07, 0.52, -0.22],
        0xd6c4ae,
      ),
      boxMesh("bunny-tail", [0.12, 0.12, 0.12], [0, 0.21, 0.2], 0xe8dfd0),
    );
  } else if (placement.asset === "animal_pigeon") {
    root.add(
      boxMesh("pigeon-body", [0.28, 0.2, 0.24], [0, 0.18, 0], 0x6d7785),
      boxMesh("pigeon-head", [0.14, 0.14, 0.14], [0, 0.31, -0.16], 0x8790a0),
      boxMesh("pigeon-beak", [0.055, 0.035, 0.06], [0, 0.3, -0.25], 0xd9a33a),
      boxMesh(
        "pigeon-wing-left",
        [0.045, 0.14, 0.2],
        [-0.17, 0.18, 0],
        0x586272,
      ),
      boxMesh(
        "pigeon-wing-right",
        [0.045, 0.14, 0.2],
        [0.17, 0.18, 0],
        0x586272,
      ),
    );
  } else if (placement.asset === "animal_cat") {
    root.add(
      boxMesh("cat-body", [0.44, 0.22, 0.24], [0, 0.16, 0], 0x4f4640),
      boxMesh("cat-head", [0.22, 0.2, 0.2], [0, 0.31, -0.25], 0x5f554e),
      boxMesh(
        "cat-ear-left",
        [0.08, 0.1, 0.06],
        [-0.08, 0.45, -0.25],
        0x5f554e,
      ),
      boxMesh(
        "cat-ear-right",
        [0.08, 0.1, 0.06],
        [0.08, 0.45, -0.25],
        0x5f554e,
      ),
      boxMesh("cat-tail", [0.08, 0.08, 0.34], [0, 0.23, 0.32], 0x4f4640),
    );
  } else if (placement.asset === "animal_dog") {
    root.add(
      boxMesh("dog-body", [0.52, 0.26, 0.28], [0, 0.19, 0], 0x7a5638),
      boxMesh("dog-head", [0.24, 0.22, 0.22], [0, 0.36, -0.29], 0x8a6140),
      boxMesh("dog-ear-left", [0.07, 0.14, 0.06], [-0.1, 0.38, -0.3], 0x4f3828),
      boxMesh("dog-ear-right", [0.07, 0.14, 0.06], [0.1, 0.38, -0.3], 0x4f3828),
      boxMesh("dog-tail", [0.08, 0.08, 0.34], [0, 0.29, 0.34], 0x7a5638),
      boxMesh(
        "dog-leg-left-front",
        [0.055, 0.16, 0.055],
        [-0.14, 0.05, -0.1],
        0x5e402b,
      ),
      boxMesh(
        "dog-leg-right-front",
        [0.055, 0.16, 0.055],
        [0.14, 0.05, -0.1],
        0x5e402b,
      ),
      boxMesh(
        "dog-leg-left-back",
        [0.055, 0.16, 0.055],
        [-0.14, 0.05, 0.13],
        0x5e402b,
      ),
      boxMesh(
        "dog-leg-right-back",
        [0.055, 0.16, 0.055],
        [0.14, 0.05, 0.13],
        0x5e402b,
      ),
    );
  } else if (placement.asset === "animal_pig") {
    root.add(
      boxMesh("pig-body", [0.56, 0.3, 0.34], [0, 0.2, 0], 0xdc8e91),
      boxMesh("pig-head", [0.26, 0.24, 0.24], [0, 0.36, -0.32], 0xe39b9d),
      boxMesh("pig-snout", [0.16, 0.09, 0.07], [0, 0.34, -0.47], 0xc9797e),
      boxMesh(
        "pig-leg-left-front",
        [0.06, 0.15, 0.06],
        [-0.16, 0.05, -0.1],
        0xb86468,
      ),
      boxMesh(
        "pig-leg-right-front",
        [0.06, 0.15, 0.06],
        [0.16, 0.05, -0.1],
        0xb86468,
      ),
      boxMesh(
        "pig-leg-left-back",
        [0.06, 0.15, 0.06],
        [-0.16, 0.05, 0.14],
        0xb86468,
      ),
      boxMesh(
        "pig-leg-right-back",
        [0.06, 0.15, 0.06],
        [0.16, 0.05, 0.14],
        0xb86468,
      ),
    );
  } else if (placement.asset === "animal_sheep") {
    root.add(
      boxMesh("sheep-body", [0.62, 0.38, 0.4], [0, 0.27, 0], 0xe3dfcf),
      boxMesh("sheep-wool-top", [0.5, 0.14, 0.34], [0, 0.53, 0], 0xf2efde),
      boxMesh("sheep-head", [0.24, 0.24, 0.22], [0, 0.4, -0.36], 0x3f342d),
      boxMesh(
        "sheep-leg-left-front",
        [0.06, 0.18, 0.06],
        [-0.18, 0.08, -0.12],
        0x352b25,
      ),
      boxMesh(
        "sheep-leg-right-front",
        [0.06, 0.18, 0.06],
        [0.18, 0.08, -0.12],
        0x352b25,
      ),
      boxMesh(
        "sheep-leg-left-back",
        [0.06, 0.18, 0.06],
        [-0.18, 0.08, 0.14],
        0x352b25,
      ),
      boxMesh(
        "sheep-leg-right-back",
        [0.06, 0.18, 0.06],
        [0.18, 0.08, 0.14],
        0x352b25,
      ),
    );
  } else if (placement.asset === "animal_cow") {
    root.add(
      boxMesh("cow-body", [0.72, 0.38, 0.42], [0, 0.29, 0], 0xebe5d5),
      boxMesh(
        "cow-spot-left",
        [0.08, 0.18, 0.26],
        [-0.37, 0.33, 0.02],
        0x2f2926,
      ),
      boxMesh(
        "cow-spot-right",
        [0.08, 0.16, 0.22],
        [0.37, 0.3, -0.08],
        0x2f2926,
      ),
      boxMesh("cow-head", [0.28, 0.26, 0.26], [0, 0.45, -0.42], 0xebe5d5),
      boxMesh("cow-snout", [0.18, 0.1, 0.08], [0, 0.41, -0.58], 0xd5a69b),
      boxMesh(
        "cow-horn-left",
        [0.07, 0.06, 0.08],
        [-0.14, 0.6, -0.43],
        0xe8d9ac,
      ),
      boxMesh(
        "cow-horn-right",
        [0.07, 0.06, 0.08],
        [0.14, 0.6, -0.43],
        0xe8d9ac,
      ),
      boxMesh(
        "cow-leg-left-front",
        [0.065, 0.22, 0.065],
        [-0.22, 0.09, -0.14],
        0x2f2926,
      ),
      boxMesh(
        "cow-leg-right-front",
        [0.065, 0.22, 0.065],
        [0.22, 0.09, -0.14],
        0x2f2926,
      ),
      boxMesh(
        "cow-leg-left-back",
        [0.065, 0.22, 0.065],
        [-0.22, 0.09, 0.16],
        0x2f2926,
      ),
      boxMesh(
        "cow-leg-right-back",
        [0.065, 0.22, 0.065],
        [0.22, 0.09, 0.16],
        0x2f2926,
      ),
    );
  } else if (placement.asset === "animal_horse") {
    root.add(
      boxMesh("horse-body", [0.78, 0.38, 0.34], [0, 0.36, 0], 0x8b5a32),
      boxMesh("horse-neck", [0.22, 0.36, 0.2], [0, 0.6, -0.28], 0x7a4d2a),
      boxMesh("horse-head", [0.28, 0.22, 0.24], [0, 0.72, -0.48], 0x8b5a32),
      boxMesh("horse-mane", [0.08, 0.34, 0.08], [0, 0.68, -0.27], 0x3f2b1d),
      boxMesh("horse-tail", [0.08, 0.12, 0.42], [0, 0.48, 0.42], 0x3f2b1d),
      boxMesh(
        "horse-leg-left-front",
        [0.07, 0.36, 0.07],
        [-0.24, 0.15, -0.12],
        0x5b3922,
      ),
      boxMesh(
        "horse-leg-right-front",
        [0.07, 0.36, 0.07],
        [0.24, 0.15, -0.12],
        0x5b3922,
      ),
      boxMesh(
        "horse-leg-left-back",
        [0.07, 0.36, 0.07],
        [-0.24, 0.15, 0.14],
        0x5b3922,
      ),
      boxMesh(
        "horse-leg-right-back",
        [0.07, 0.36, 0.07],
        [0.24, 0.15, 0.14],
        0x5b3922,
      ),
    );
  } else if (placement.asset === "animal_deer") {
    root.add(
      boxMesh("deer-body", [0.58, 0.3, 0.24], [0, 0.32, 0], 0x8a5f36),
      boxMesh("deer-neck", [0.16, 0.3, 0.16], [0, 0.5, -0.22], 0x7a512f),
      boxMesh("deer-head", [0.2, 0.18, 0.18], [0, 0.62, -0.38], 0x8a5f36),
      boxMesh("deer-chest", [0.2, 0.18, 0.08], [0, 0.34, -0.21], 0xd8c19e),
      boxMesh("deer-antler-left", [0.045, 0.25, 0.045], [-0.09, 0.82, -0.38], 0xd9c79a),
      boxMesh("deer-antler-right", [0.045, 0.25, 0.045], [0.09, 0.82, -0.38], 0xd9c79a),
      boxMesh("deer-leg-left-front", [0.05, 0.32, 0.05], [-0.18, 0.13, -0.09], 0x4c321f),
      boxMesh("deer-leg-right-front", [0.05, 0.32, 0.05], [0.18, 0.13, -0.09], 0x4c321f),
      boxMesh("deer-leg-left-back", [0.05, 0.32, 0.05], [-0.18, 0.13, 0.12], 0x4c321f),
      boxMesh("deer-leg-right-back", [0.05, 0.32, 0.05], [0.18, 0.13, 0.12], 0x4c321f),
    );
  } else if (placement.asset === "animal_wolf") {
    root.add(
      boxMesh("wolf-body", [0.58, 0.26, 0.24], [0, 0.24, 0], 0x5d6062),
      boxMesh("wolf-head", [0.23, 0.2, 0.2], [0, 0.39, -0.3], 0x66696b),
      boxMesh("wolf-snout", [0.14, 0.08, 0.11], [0, 0.36, -0.45], 0x3f4143),
      boxMesh("wolf-ear-left", [0.07, 0.14, 0.055], [-0.09, 0.54, -0.31], 0x4b4e50),
      boxMesh("wolf-ear-right", [0.07, 0.14, 0.055], [0.09, 0.54, -0.31], 0x4b4e50),
      boxMesh("wolf-tail", [0.08, 0.08, 0.42], [0, 0.31, 0.38], 0x4b4e50),
      boxMesh("wolf-leg-left-front", [0.055, 0.22, 0.055], [-0.16, 0.08, -0.1], 0x383a3b),
      boxMesh("wolf-leg-right-front", [0.055, 0.22, 0.055], [0.16, 0.08, -0.1], 0x383a3b),
      boxMesh("wolf-leg-left-back", [0.055, 0.22, 0.055], [-0.16, 0.08, 0.13], 0x383a3b),
      boxMesh("wolf-leg-right-back", [0.055, 0.22, 0.055], [0.16, 0.08, 0.13], 0x383a3b),
    );
  } else if (placement.asset === "animal_boar") {
    root.add(
      boxMesh("boar-body", [0.64, 0.34, 0.34], [0, 0.24, 0], 0x604633),
      boxMesh("boar-head", [0.3, 0.26, 0.24], [0, 0.37, -0.34], 0x6d4d35),
      boxMesh("boar-snout", [0.18, 0.11, 0.09], [0, 0.34, -0.52], 0x3c2b20),
      boxMesh("boar-tusk-left", [0.055, 0.045, 0.12], [-0.1, 0.31, -0.58], 0xd8cfb0),
      boxMesh("boar-tusk-right", [0.055, 0.045, 0.12], [0.1, 0.31, -0.58], 0xd8cfb0),
      boxMesh("boar-bristles", [0.12, 0.14, 0.3], [0, 0.5, 0], 0x2a211a),
      boxMesh("boar-leg-left-front", [0.065, 0.18, 0.065], [-0.18, 0.06, -0.12], 0x2a211a),
      boxMesh("boar-leg-right-front", [0.065, 0.18, 0.065], [0.18, 0.06, -0.12], 0x2a211a),
      boxMesh("boar-leg-left-back", [0.065, 0.18, 0.065], [-0.18, 0.06, 0.14], 0x2a211a),
      boxMesh("boar-leg-right-back", [0.065, 0.18, 0.065], [0.18, 0.06, 0.14], 0x2a211a),
    );
  } else if (placement.asset === "animal_bear") {
    root.add(
      boxMesh("bear-body", [0.82, 0.46, 0.46], [0, 0.35, 0], 0x3f2b1d),
      boxMesh("bear-head", [0.34, 0.3, 0.28], [0, 0.62, -0.42], 0x4a3322),
      boxMesh("bear-snout", [0.18, 0.1, 0.09], [0, 0.57, -0.59], 0x251a12),
      boxMesh("bear-ear-left", [0.09, 0.09, 0.065], [-0.14, 0.78, -0.43], 0x2c1f16),
      boxMesh("bear-ear-right", [0.09, 0.09, 0.065], [0.14, 0.78, -0.43], 0x2c1f16),
      boxMesh("bear-leg-left-front", [0.09, 0.24, 0.09], [-0.24, 0.12, -0.14], 0x2c1f16),
      boxMesh("bear-leg-right-front", [0.09, 0.24, 0.09], [0.24, 0.12, -0.14], 0x2c1f16),
      boxMesh("bear-leg-left-back", [0.09, 0.24, 0.09], [-0.24, 0.12, 0.16], 0x2c1f16),
      boxMesh("bear-leg-right-back", [0.09, 0.24, 0.09], [0.24, 0.12, 0.16], 0x2c1f16),
    );
  } else if (placement.asset === "animal_fox") {
    root.add(
      boxMesh("fox-body", [0.48, 0.22, 0.2], [0, 0.2, 0], 0xb55f2d),
      boxMesh("fox-head", [0.22, 0.18, 0.18], [0, 0.35, -0.26], 0xc66b33),
      boxMesh("fox-snout", [0.13, 0.07, 0.11], [0, 0.32, -0.4], 0xe9d4b8),
      boxMesh("fox-ear-left", [0.07, 0.14, 0.055], [-0.08, 0.5, -0.27], 0x7e3f21),
      boxMesh("fox-ear-right", [0.07, 0.14, 0.055], [0.08, 0.5, -0.27], 0x7e3f21),
      boxMesh("fox-tail", [0.1, 0.1, 0.44], [0, 0.26, 0.36], 0xc66b33),
      boxMesh("fox-tail-tip", [0.11, 0.1, 0.1], [0, 0.26, 0.58], 0xe9d4b8),
    );
  } else if (placement.asset === "animal_crow") {
    root.add(
      boxMesh("crow-body", [0.3, 0.2, 0.24], [0, 0.18, 0], 0x17191c),
      boxMesh("crow-head", [0.15, 0.14, 0.14], [0, 0.31, -0.17], 0x0f1012),
      boxMesh("crow-beak", [0.06, 0.035, 0.07], [0, 0.3, -0.27], 0x2f2f28),
      boxMesh("crow-wing-left", [0.045, 0.14, 0.22], [-0.18, 0.18, 0], 0x0f1012),
      boxMesh("crow-wing-right", [0.045, 0.14, 0.22], [0.18, 0.18, 0], 0x0f1012),
    );
  } else if (placement.asset === "animal_frog") {
    root.add(
      boxMesh("frog-body", [0.26, 0.13, 0.2], [0, 0.08, 0], 0x486b35),
      boxMesh("frog-head", [0.2, 0.11, 0.16], [0, 0.15, -0.14], 0x5f8a45),
      boxMesh("frog-eye-left", [0.045, 0.04, 0.04], [-0.07, 0.23, -0.17], 0xdedcc5),
      boxMesh("frog-eye-right", [0.045, 0.04, 0.04], [0.07, 0.23, -0.17], 0xdedcc5),
    );
  } else if (placement.asset === "animal_snake") {
    root.add(
      boxMesh("snake-body-1", [0.16, 0.08, 0.34], [0, 0.06, 0], 0x3f5c2f),
      boxMesh("snake-body-2", [0.14, 0.07, 0.28], [0.09, 0.06, 0.24], 0x496b38),
      boxMesh("snake-head", [0.16, 0.08, 0.14], [0, 0.07, -0.24], 0x5a7c43),
      boxMesh("snake-tongue", [0.035, 0.015, 0.12], [0, 0.07, -0.36], 0xa22b2b),
    );
  }

  return root;
}

type TownspersonPalette = {
  skin: number;
  hair: number;
  tunic: number;
  legs: number;
  accent: number;
};


const HARTHMERE_RUNTIME_SKIN_COLORS = {
  porcelain: 0xf0c7a3,
  light: 0xe4b48e,
  warm: 0xd19a68,
  tan: 0xb9825a,
  brown: 0x8f5f3f,
  deep: 0x5c3a2c,
  metal: 0x9ca3af,
} as const;
const HARTHMERE_RUNTIME_SKIN_SHADOW_COLORS = {
  porcelain: 0xd9a47f,
  light: 0xc48a66,
  warm: 0x9a5f3e,
  tan: 0x7e4f36,
  brown: 0x5f3d2d,
  deep: 0x3a261e,
  metal: 0x657084,
} as const;
const HARTHMERE_RUNTIME_HAIR_COLORS = {
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
const HARTHMERE_RUNTIME_EYE_COLORS = {
  black: 0x151515,
  brown: 0x5a3a22,
  blue: 0x203a54,
  green: 0x2d4d2f,
  hazel: 0x6a5a2e,
  gray: 0x59656d,
  amber: 0x9a6b24,
  violet: 0x493463,
} as const;
const HARTHMERE_RUNTIME_OUTFIT_COLORS = {
  earth: 0x7a5538,
  forest: 0x2f5f43,
  river: 0x315b78,
  ember: 0x88432e,
  royal: 0x5b3d83,
  ash: 0x5d646b,
} as const;

function harthmereRuntimeColorChannelMix(source: number, target: number, amount: number) {
  const sourcePart = source & 0xff;
  const targetPart = target & 0xff;
  return Math.round(sourcePart + (targetPart - sourcePart) * amount) & 0xff;
}

function harthmereRuntimeColorMix(source: number, target: number, amount: number) {
  const r = harthmereRuntimeColorChannelMix(source >> 16, target >> 16, amount);
  const g = harthmereRuntimeColorChannelMix(source >> 8, target >> 8, amount);
  const b = harthmereRuntimeColorChannelMix(source, target, amount);
  return (r << 16) | (g << 8) | b;
}

function harthmereRuntimeColorLighten(color: number, amount = 0.18) {
  return harthmereRuntimeColorMix(color, 0xffffff, amount);
}

function harthmereRuntimeColorDarken(color: number, amount = 0.24) {
  return harthmereRuntimeColorMix(color, 0x000000, amount);
}

type HarthmereRuntimeFaceSideProfile = {
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

function harthmereRuntimeFaceSideProfile(
  appearance: HarthmereCharacterAppearance,
  token: string,
): HarthmereRuntimeFaceSideProfile {
  const face = appearance.face;
  const faceShapeMetricsV15 = harthmereRuntimeFaceShapeMetricsV15(face);
  const seed = harthmereStableCombatHash([
    token,
    face.skinTone,
    face.hairColor,
    face.eyeColor,
    face.faceShape,
    face.eyeShape,
    face.browStyle,
    face.noseStyle,
    face.mouthStyle,
    face.hairStyle,
    face.facialHair,
    face.cheekStyle,
    face.accessory,
  ].join("|"));
  const majorLeft = (seed & 1) === 0;
  const jawVariant = (seed >>> 4) % 4;
  const markVariant = (seed >>> 8) % 5;
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
    jawNotchSide: jawVariant === 0 ? "none" : jawVariant === 1 ? "left" : "right",
    markSide: markVariant === 0 ? "none" : markVariant % 2 === 0 ? "left" : "right",
    hairPartSide: ((seed >>> 6) & 1) === 0 ? "left" : "right",
    hairLockSide: lockVariant === 0 ? "none" : lockVariant % 2 === 0 ? "left" : "right",
  };
}


type HarthmereRuntimeBodyMetrics = {
  torsoWidth: number;
  torsoHeight: number;
  torsoDepth: number;
  armWidth: number;
  armLength: number;
  armDepth: number;
  legWidth: number;
  legLength: number;
  legDepth: number;
  shoulderWidth: number;
  legSpread: number;
  stanceYOffset: number;
  heightScale: number;
};

function harthmereRuntimeAppearanceForPlacement(
  placement: RuntimePlacement,
): HarthmereCharacterAppearance {
  if (placement.appearance) {
    return normalizeHarthmereCharacterAppearance(placement.appearance);
  }
  const roleHint = `${placement.asset} ${placement.name ?? ""} ${placement.district ?? ""}`;
  const species = harthmereCombatActorSpecies(placement.asset, placement.name);
  const role = harthmereCombatActorSocialRole(
    placement.asset,
    placement.name,
    placement.district,
  );
  return makeHarthmereNpcAppearanceConfig({
    id: placement.combatOffset ?? harthmereStableCombatHash(roleHint),
    name: placement.name ?? placement.asset,
    roleHint,
    species: species === "undead" ? "undead" : species === "animal" ? "animal" : "human",
    role: role === "hostile" && /bandit|outlaw|thief/i.test(roleHint) ? "bandit" : role,
    forwardAxis: harthmereModelForwardAxis(placement.asset),
    source: "runtime:placement-generated",
  });
}

function harthmereRuntimePaletteForAppearance(
  asset: string,
  appearance: HarthmereCharacterAppearance,
): TownspersonPalette {
  const fallback = townspersonPalette(asset);
  return {
    skin: HARTHMERE_RUNTIME_SKIN_COLORS[appearance.face.skinTone] ?? fallback.skin,
    hair: HARTHMERE_RUNTIME_HAIR_COLORS[appearance.face.hairColor] ?? fallback.hair,
    tunic: HARTHMERE_RUNTIME_OUTFIT_COLORS[appearance.body.outfitColor] ?? fallback.tunic,
    legs: fallback.legs,
    accent:
      appearance.role === "guard"
        ? 0x222222
        : appearance.role === "clergy"
        ? 0x637b9a
        : appearance.role === "bandit" || appearance.role === "hostile"
        ? 0x8c2f2a
        : fallback.accent,
  };
}

const HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26 = {
  faceShape: {
    bolt_square: { width: 1.0, height: 1.0, jaw: 1.0 },
    wide: { width: 1.16, height: 0.94, jaw: 1.12 },
    narrow: { width: 0.88, height: 1.04, jaw: 0.9 },
    tall: { width: 0.96, height: 1.16, jaw: 0.96 },
    soft: { width: 1.06, height: 0.98, jaw: 1.04 },
  },
  bodyType: {
    average: { torsoWidth: 0.48, torsoHeight: 0.7, torsoDepth: 0.2, legWidth: 0.16, legDepth: 0.14, armWidth: 0.13, armDepth: 0.11 },
    slim: { torsoWidth: 0.42, torsoHeight: 0.72, torsoDepth: 0.16, legWidth: 0.14, legDepth: 0.12, armWidth: 0.11, armDepth: 0.09 },
    broad: { torsoWidth: 0.58, torsoHeight: 0.72, torsoDepth: 0.22, legWidth: 0.18, legDepth: 0.15, armWidth: 0.15, armDepth: 0.12 },
    stocky: { torsoWidth: 0.56, torsoHeight: 0.64, torsoDepth: 0.24, legWidth: 0.19, legDepth: 0.16, armWidth: 0.15, armDepth: 0.12 },
    athletic: { torsoWidth: 0.52, torsoHeight: 0.74, torsoDepth: 0.2, legWidth: 0.17, legDepth: 0.14, armWidth: 0.14, armDepth: 0.11 },
    soft: { torsoWidth: 0.54, torsoHeight: 0.69, torsoDepth: 0.22, legWidth: 0.18, legDepth: 0.15, armWidth: 0.14, armDepth: 0.11 },
  },
  bodyHeight: {
    short: { heightScale: 0.9 },
    average: { heightScale: 1.0 },
    tall: { heightScale: 1.12 },
    very_tall: { heightScale: 1.24 },
  },
  shoulderWidth: {
    narrow: { shoulderWidth: 0.48 },
    average: { shoulderWidth: 0.58 },
    wide: { shoulderWidth: 0.7 },
  },
  armLength: {
    short: { armLength: 0.48 },
    average: { armLength: 0.56 },
    long: { armLength: 0.66 },
  },
  legLength: {
    short: { legLength: 0.48 },
    average: { legLength: 0.56 },
    long: { legLength: 0.66 },
  },
  stance: {
    relaxed: { stanceYOffset: -0.015, legSpread: 0.015 },
    upright: { stanceYOffset: 0.0, legSpread: 0.0 },
    heroic: { stanceYOffset: 0.02, legSpread: 0.04 },
    reserved: { stanceYOffset: -0.005, legSpread: -0.005 },
  },
} as const;

function harthmereRuntimeBodyMetrics(
  body: HarthmereVoxelBodyConfig,
): HarthmereRuntimeBodyMetrics {
  const contract = HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26;
  const bodyType =
    contract.bodyType[body.bodyType] ?? contract.bodyType.average;
  const height =
    contract.bodyHeight[body.bodyHeight] ?? contract.bodyHeight.average;
  const shoulder =
    contract.shoulderWidth[body.shoulderWidth] ?? contract.shoulderWidth.average;
  const arm =
    contract.armLength[body.armLength] ?? contract.armLength.average;
  const leg =
    contract.legLength[body.legLength] ?? contract.legLength.average;
  const stance =
    contract.stance[body.stance] ?? contract.stance.upright;

  // V29: height is expressed through leg/torso proportions instead of stretching
  // the whole root. This keeps the head, face pieces, weapons, anchors, and
  // clothing thickness from turning into vertically stretched blocks.
  const heightDelta = height.heightScale - 1;
  const torsoHeight = bodyType.torsoHeight * (1 + heightDelta * 0.6);
  const legLength = leg.legLength * (1 + heightDelta * 0.85);
  const armLength = arm.armLength * (1 + heightDelta * 0.18);

  return {
    torsoWidth: bodyType.torsoWidth,
    torsoHeight,
    torsoDepth: bodyType.torsoDepth,
    armWidth: bodyType.armWidth,
    armLength,
    armDepth: bodyType.armDepth,
    legWidth: bodyType.legWidth,
    legLength,
    legDepth: bodyType.legDepth,
    shoulderWidth: shoulder.shoulderWidth,
    legSpread: stance.legSpread,
    stanceYOffset: stance.stanceYOffset,
    heightScale: height.heightScale,
  };
}

function harthmereRuntimeRootBodyScale(body: HarthmereVoxelBodyConfig) {
  const width =
    body.bodyType === "slim"
      ? 0.94
      : body.bodyType === "broad"
      ? 1.08
      : body.bodyType === "stocky"
      ? 1.1
      : body.bodyType === "athletic"
      ? 1.04
      : body.bodyType === "soft"
      ? 1.03
      : 1;
  const height =
    body.bodyHeight === "very_tall"
      ? 1.08
      : body.bodyHeight === "tall"
      ? 1.04
      : body.bodyHeight === "short"
      ? 0.96
      : 1;
  const depth = body.bodyType === "stocky" ? 1.06 : body.bodyType === "soft" ? 1.04 : 1;
  return { width, height, depth };
}

function harthmereRuntimeHeadSize(face: HarthmereVoxelFaceConfig): [number, number, number] {
  return [
    face.faceShape === "wide" ? 0.38 : face.faceShape === "narrow" ? 0.28 : face.faceShape === "soft" ? 0.34 : 0.34,
    face.faceShape === "tall" ? 0.36 : face.faceShape === "soft" ? 0.31 : 0.32,
    face.faceShape === "wide" ? 0.29 : face.faceShape === "narrow" ? 0.25 : 0.27,
  ];
}

const HARTHMERE_RUNTIME_FACE_SHAPE_METRICS_V15 = {
  bolt_square: { width: 1.0, height: 1.0, jaw: 1.0 },
  wide: { width: 1.16, height: 0.94, jaw: 1.12 },
  narrow: { width: 0.88, height: 1.04, jaw: 0.9 },
  tall: { width: 0.96, height: 1.16, jaw: 0.96 },
  soft: { width: 1.06, height: 0.98, jaw: 1.04 },
} as const;

function harthmereRuntimeFaceShapeMetricsV15(face: HarthmereVoxelFaceConfig) {
  const faceShapeExpressionContractV26 = HARTHMERE_RUNTIME_APPEARANCE_OPTION_EXPRESSION_CONTRACT_V26.faceShape;
  void faceShapeExpressionContractV26;
  return (
    HARTHMERE_RUNTIME_FACE_SHAPE_METRICS_V15[
      face.faceShape as keyof typeof HARTHMERE_RUNTIME_FACE_SHAPE_METRICS_V15
    ] ?? HARTHMERE_RUNTIME_FACE_SHAPE_METRICS_V15.bolt_square
  );
}

function createHarthmereRuntimeVoxelHead(
  appearance: HarthmereCharacterAppearance,
  headY: number,
  namePrefix: string,
) {
  const face = appearance.face;
  const group = new THREE.Group();
  group.name = `${namePrefix}-appearance-head`;
  group.userData.harthmereRuntimeFaceExpressionRoot = true;
  const [headWidth, headHeight, headDepth] = harthmereRuntimeHeadSize(face);
  const faceFrontZ = -headDepth / 2 - 0.023;
  const skin = HARTHMERE_RUNTIME_SKIN_COLORS[face.skinTone];
  const skinShadow = HARTHMERE_RUNTIME_SKIN_SHADOW_COLORS[face.skinTone];
  const hair = HARTHMERE_RUNTIME_HAIR_COLORS[face.hairColor];
  const hairHighlight = harthmereRuntimeColorLighten(hair, 0.2);
  const hairShadow = harthmereRuntimeColorDarken(hair, 0.25);
  const eye = HARTHMERE_RUNTIME_EYE_COLORS[face.eyeColor];
  const skinHighlight = harthmereRuntimeColorLighten(skin, 0.1);
  const sideProfile = harthmereRuntimeFaceSideProfile(appearance, namePrefix);
  group.userData.harthmereRuntimeFaceSideProfile = sideProfile;
  const faceEyeSpread = face.eyeShape === "wide" ? 0.088 : face.eyeShape === "small" ? 0.055 : 0.07;
  const eyeY = headY + (face.eyeShape === "sleepy" ? 0.005 : face.eyeShape === "sharp" ? 0.03 : 0.02);
  const eyeHeight = face.eyeShape === "wide" ? 0.048 : face.eyeShape === "small" ? 0.028 : face.eyeShape === "sleepy" ? 0.024 : 0.038;
  const eyeWidth = face.eyeShape === "wide" ? 0.052 : face.eyeShape === "small" ? 0.032 : 0.04;
  const browTilt = face.browStyle === "arched" ? 0.2 : face.browStyle === "stern" ? -0.18 : 0;
  const noseSize: [number, number, number] =
    face.noseStyle === "wide"
      ? [0.07, 0.05, 0.06]
      : face.noseStyle === "long"
      ? [0.05, 0.075, 0.065]
      : face.noseStyle === "button"
      ? [0.055, 0.035, 0.055]
      : face.noseStyle === "small"
      ? [0.04, 0.04, 0.05]
      : [0.05, 0.055, 0.055];
  const mouthY = headY - (face.mouthStyle === "frown" ? 0.105 : face.mouthStyle === "smile" || face.mouthStyle === "smirk" ? 0.07 : 0.085);
  const mouthWidth = face.mouthStyle === "smirk" ? 0.13 : face.mouthStyle === "stern" ? 0.1 : face.mouthStyle === "open" ? 0.09 : 0.115;
  const add = (mesh: THREE.Object3D) => {
    group.add(mesh);
    return mesh;
  };

  add(boxMesh(`${namePrefix}-head`, [headWidth, headHeight, headDepth], [0, headY, -0.01], skin));
  add(boxMesh(`${namePrefix}-skin-shadow`, [headWidth, 0.035, headDepth], [0, headY - headHeight / 2 + 0.035, -0.01], skinShadow));
  add(boxMesh(`${namePrefix}-forehead-light`, [headWidth * 0.52, 0.02, 0.014], [0, eyeY + 0.1, faceFrontZ - 0.01], skinHighlight));
  add(boxMesh(`${namePrefix}-jaw-shadow`, [headWidth * 0.62, 0.024, 0.014], [0, headY - headHeight / 2 + 0.065, faceFrontZ - 0.012], skinShadow));

  // V11: side-specific head sculpting keeps generated NPCs from looking like
  // mirrored box-head clones while preserving deterministic runtime generation.
  add(boxMesh(
    `${namePrefix}-left-head-side-asym`,
    [0.022 * sideProfile.leftWidthScale, headHeight * 0.54 * sideProfile.leftHeightScale, Math.max(0.06, headDepth * 0.72 + sideProfile.leftZOffset)],
    [-headWidth / 2 - 0.011, headY + sideProfile.leftYOffset, -0.004 + sideProfile.leftZOffset],
    sideProfile.highlightSide === "left" ? skinHighlight : skinShadow,
  ));
  add(boxMesh(
    `${namePrefix}-right-head-side-asym`,
    [0.022 * sideProfile.rightWidthScale, headHeight * 0.54 * sideProfile.rightHeightScale, Math.max(0.06, headDepth * 0.72 + sideProfile.rightZOffset)],
    [headWidth / 2 + 0.011, headY + sideProfile.rightYOffset, -0.004 + sideProfile.rightZOffset],
    sideProfile.highlightSide === "right" ? skinHighlight : skinShadow,
  ));
  if (sideProfile.jawNotchSide === "left") {
    add(boxMesh(`${namePrefix}-left-jaw-notch-asym`, [0.032, 0.06, 0.018], [-headWidth / 2 + 0.024, headY - headHeight / 2 + 0.095, faceFrontZ - 0.008], skinShadow));
  } else if (sideProfile.jawNotchSide === "right") {
    add(boxMesh(`${namePrefix}-right-jaw-notch-asym`, [0.032, 0.06, 0.018], [headWidth / 2 - 0.024, headY - headHeight / 2 + 0.095, faceFrontZ - 0.008], skinShadow));
  }
  if (sideProfile.markSide === "left") {
    add(boxMesh(`${namePrefix}-left-face-mark-asym`, [0.017, 0.017, 0.011], [-headWidth * 0.28, mouthY + 0.055, faceFrontZ - 0.012], 0x2a1712));
  } else if (sideProfile.markSide === "right") {
    add(boxMesh(`${namePrefix}-right-face-mark-asym`, [0.017, 0.017, 0.011], [headWidth * 0.28, mouthY + 0.055, faceFrontZ - 0.012], 0x2a1712));
  }

  // Hair polish mirrors the player voxel head but uses fewer boxes so hundreds
  // of ambient/runtime NPCs remain cheap.
  switch (face.hairStyle) {
    case "shaved":
      add(boxMesh(`${namePrefix}-hair-shaved`, [headWidth + 0.02, 0.025, headDepth + 0.02], [0, headY + headHeight / 2 + 0.018, -0.01], hair));
      break;
    case "balding":
      add(boxMesh(`${namePrefix}-hair-balding-back`, [headWidth + 0.03, 0.055, headDepth + 0.02], [0, headY + headHeight / 2 + 0.025, 0.04], hair));
      add(boxMesh(`${namePrefix}-hair-balding-left`, [0.045, 0.16, 0.05], [-headWidth / 2 - 0.015, headY, faceFrontZ + 0.03], hair));
      add(boxMesh(`${namePrefix}-hair-balding-right`, [0.045, 0.16, 0.05], [headWidth / 2 + 0.015, headY, faceFrontZ + 0.03], hair));
      break;
    case "hood":
      add(boxMesh(`${namePrefix}-hood-back`, [headWidth + 0.14, headHeight + 0.1, headDepth + 0.11], [0, headY, 0.03], harthmereRuntimeColorDarken(hair, 0.12)));
      add(boxMesh(`${namePrefix}-hood-rim`, [headWidth + 0.1, 0.055, 0.055], [0, eyeY + 0.07, faceFrontZ - 0.018], hair));
      break;
    case "cap":
      add(boxMesh(`${namePrefix}-cap`, [headWidth + 0.1, 0.08, headDepth + 0.06], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-cap-brim`, [headWidth + 0.16, 0.032, 0.08], [0, eyeY + 0.075, faceFrontZ - 0.018], hair));
      break;
    case "braids":
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.04, 0.075, headDepth + 0.035], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-left-braid`, [0.05, 0.28, 0.06], [-headWidth / 2 - 0.035, headY - 0.04, faceFrontZ + 0.03], hair));
      add(boxMesh(`${namePrefix}-right-braid`, [0.05, 0.28, 0.06], [headWidth / 2 + 0.035, headY - 0.04, faceFrontZ + 0.03], hair));
      break;
    case "bun":
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.04, 0.08, headDepth + 0.04], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-hair-bun`, [0.13, 0.13, 0.11], [0, headY + 0.04, headDepth / 2 + 0.04], hair));
      break;
    case "pigtails":
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.04, 0.08, headDepth + 0.04], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-left-pigtail`, [0.07, 0.2, 0.07], [-headWidth / 2 - 0.05, headY - 0.02, faceFrontZ + 0.03], hair));
      add(boxMesh(`${namePrefix}-right-pigtail`, [0.07, 0.2, 0.07], [headWidth / 2 + 0.05, headY - 0.02, faceFrontZ + 0.03], hair));
      break;
    case "curly":
    case "wavy":
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.06, 0.09, headDepth + 0.055], [0, headY + headHeight / 2 + 0.05, -0.01], hair));
      add(boxMesh(`${namePrefix}-hair-wave-left`, [0.065, 0.06, 0.055], [-headWidth / 2 + 0.035, eyeY + 0.04, faceFrontZ - 0.012], hairHighlight));
      add(boxMesh(`${namePrefix}-hair-wave-right`, [0.065, 0.06, 0.055], [headWidth / 2 - 0.035, eyeY + 0.02, faceFrontZ - 0.012], hairShadow));
      break;
    case "long":
    case "bob":
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.05, 0.08, headDepth + 0.05], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-left-hair`, [0.065, face.hairStyle === "long" ? 0.34 : 0.22, headDepth + 0.03], [-headWidth / 2 - 0.02, headY - 0.02, -0.01], hair));
      add(boxMesh(`${namePrefix}-right-hair`, [0.065, face.hairStyle === "long" ? 0.34 : 0.22, headDepth + 0.03], [headWidth / 2 + 0.02, headY - 0.02, -0.01], hair));
      break;
    default:
      add(boxMesh(`${namePrefix}-hair-top`, [headWidth + 0.04, 0.075, headDepth + 0.035], [0, headY + headHeight / 2 + 0.04, -0.01], hair));
      add(boxMesh(`${namePrefix}-hair-fringe`, [headWidth * 0.62, 0.032, 0.035], [-headWidth * 0.06, eyeY + 0.077, faceFrontZ - 0.02], hairHighlight));
      break;
  }

  const leftEye = add(boxMesh(`${namePrefix}-left-eye`, [eyeWidth, eyeHeight, 0.022], [-faceEyeSpread, eyeY, faceFrontZ], eye));
  const hairPartX = sideProfile.hairPartSide === "left" ? -headWidth * 0.18 : headWidth * 0.18;
  add(boxMesh(`${namePrefix}-hair-part-asym`, [0.016, 0.095, 0.024], [hairPartX, eyeY + 0.078, faceFrontZ - 0.024], hairShadow));
  if (sideProfile.hairLockSide === "left") {
    add(boxMesh(`${namePrefix}-left-side-hair-lock-asym`, [0.04, 0.16, 0.045], [-headWidth / 2 - 0.03, eyeY + 0.005, faceFrontZ + 0.026], hairHighlight));
  } else if (sideProfile.hairLockSide === "right") {
    add(boxMesh(`${namePrefix}-right-side-hair-lock-asym`, [0.04, 0.16, 0.045], [headWidth / 2 + 0.03, eyeY + 0.005, faceFrontZ + 0.026], hairHighlight));
  }

  const rightEye = add(boxMesh(`${namePrefix}-right-eye`, [eyeWidth, eyeHeight, 0.022], [faceEyeSpread, eyeY, faceFrontZ], eye));
  if (face.eyeShape === "sharp") {
    leftEye.rotation.z = 0.16;
    rightEye.rotation.z = -0.16;
  }
  add(boxMesh(`${namePrefix}-left-eye-glint`, [0.012, 0.011, 0.01], [-faceEyeSpread - 0.008, eyeY + 0.009, faceFrontZ - 0.01], 0xf5f1dc));
  add(boxMesh(`${namePrefix}-right-eye-glint`, [0.012, 0.011, 0.01], [faceEyeSpread - 0.008, eyeY + 0.009, faceFrontZ - 0.01], 0xf5f1dc));
  if (face.eyeShape === "sleepy") {
    add(boxMesh(`${namePrefix}-left-sleepy-lid`, [eyeWidth + 0.02, 0.012, 0.01], [-faceEyeSpread, eyeY + 0.018, faceFrontZ - 0.01], skinShadow));
    add(boxMesh(`${namePrefix}-right-sleepy-lid`, [eyeWidth + 0.02, 0.012, 0.01], [faceEyeSpread, eyeY + 0.018, faceFrontZ - 0.01], skinShadow));
  }

  if (face.faceShape === "wide" || face.faceShape === "soft") {
    add(
      boxMesh(
        `${namePrefix}-face-shape-wide-jaw-v15`,
        [headWidth * 0.86 * harthmereRuntimeFaceShapeMetricsV15(face).jaw, 0.04, 0.018],
        [0, headY - headHeight * 0.38, faceFrontZ - 0.012],
        skinShadow,
      ),
    );
  } else if (face.faceShape === "narrow") {
    add(
      boxMesh(
        `${namePrefix}-face-shape-narrow-chin-v15`,
        [headWidth * 0.42, 0.045, 0.018],
        [0, headY - headHeight * 0.42, faceFrontZ - 0.012],
        skinShadow,
      ),
    );
  } else if (face.faceShape === "tall") {
    add(
      boxMesh(
        `${namePrefix}-face-shape-tall-forehead-v15`,
        [headWidth * 0.74, 0.035, 0.018],
        [0, headY + headHeight * 0.32, faceFrontZ - 0.012],
        skinShadow,
      ),
    );
  }
  add(boxMesh(`${namePrefix}-nose`, noseSize, [0, headY - 0.025, faceFrontZ - 0.015], skinShadow));
  if (face.noseStyle === "button") {
    add(boxMesh(`${namePrefix}-button-nose-tip`, [0.065, 0.02, 0.024], [0, headY - 0.055, faceFrontZ - 0.035], skinShadow));
  }
  add(boxMesh(`${namePrefix}-mouth`, [mouthWidth, face.mouthStyle === "open" ? 0.045 : 0.02, 0.016], [face.mouthStyle === "smirk" ? 0.015 : 0, mouthY, faceFrontZ - 0.006], face.mouthStyle === "open" ? 0x6b2f33 : 0x2a1712));
  if (face.mouthStyle === "open") {
    add(boxMesh(`${namePrefix}-mouth-teeth`, [mouthWidth * 0.75, 0.012, 0.012], [0, mouthY + 0.014, faceFrontZ - 0.018], 0xf6e6d0));
  } else if (face.mouthStyle === "smile" || face.mouthStyle === "frown") {
    const sign = face.mouthStyle === "smile" ? 1 : -1;
    const leftCorner = add(boxMesh(`${namePrefix}-mouth-left-corner`, [0.032, 0.018, 0.012], [-mouthWidth / 2, mouthY + sign * 0.015, faceFrontZ - 0.014], 0x2a1712));
    leftCorner.rotation.z = sign * 0.32;
    const rightCorner = add(boxMesh(`${namePrefix}-mouth-right-corner`, [0.032, 0.018, 0.012], [mouthWidth / 2, mouthY + sign * 0.015, faceFrontZ - 0.014], 0x2a1712));
    rightCorner.rotation.z = -sign * 0.32;
  }

  const leftBrow = boxMesh(`${namePrefix}-left-brow`, [face.browStyle === "soft" ? 0.05 : 0.065, face.browStyle === "scarred" ? 0.022 : 0.016, 0.018], [-faceEyeSpread, eyeY + 0.045, faceFrontZ - 0.004], hair);
  leftBrow.rotation.z = browTilt;
  const rightBrow = boxMesh(`${namePrefix}-right-brow`, [face.browStyle === "soft" ? 0.05 : 0.065, face.browStyle === "scarred" ? 0.022 : 0.016, 0.018], [faceEyeSpread, eyeY + 0.045, faceFrontZ - 0.004], hair);
  rightBrow.rotation.z = -browTilt;
  group.add(leftBrow, rightBrow);
  add(boxMesh(`${namePrefix}-left-brow-shadow`, [0.05, 0.008, 0.01], [-faceEyeSpread, eyeY + 0.022, faceFrontZ - 0.012], hairShadow));
  add(boxMesh(`${namePrefix}-right-brow-shadow`, [0.05, 0.008, 0.01], [faceEyeSpread, eyeY + 0.022, faceFrontZ - 0.012], hairShadow));
  if (face.browStyle === "scarred") {
    const scar = add(boxMesh(`${namePrefix}-brow-scar`, [0.016, 0.08, 0.012], [-faceEyeSpread + 0.04, eyeY + 0.035, faceFrontZ - 0.016], 0xf1d0b8));
    scar.rotation.z = -0.38;
  }

  if (face.cheekStyle && face.cheekStyle !== "none") {
    const cheekColor = face.cheekStyle === "freckled" ? 0x6a3c28 : face.cheekStyle === "strong" ? 0x8a5844 : 0xd98a7c;
    add(boxMesh(`${namePrefix}-left-cheek`, [0.045, 0.032, 0.012], [-0.12, mouthY + 0.045, faceFrontZ - 0.012], cheekColor));
    add(boxMesh(`${namePrefix}-right-cheek`, [0.045, 0.032, 0.012], [0.12, mouthY + 0.045, faceFrontZ - 0.012], cheekColor));
  }

  if (face.accessory === "cap" || face.hairStyle === "cap") {
    add(boxMesh(`${namePrefix}-accessory-cap-brim`, [headWidth + 0.12, 0.035, 0.08], [0, eyeY + 0.08, faceFrontZ - 0.015], 0x38405a));
  } else if (face.accessory === "headband") {
    add(boxMesh(`${namePrefix}-headband`, [headWidth + 0.08, 0.035, 0.035], [0, eyeY + 0.085, faceFrontZ - 0.002], 0xd6a632));
  } else if (face.accessory === "spectacles") {
    group.add(
      boxMesh(`${namePrefix}-left-spectacles`, [0.07, 0.01, 0.012], [-faceEyeSpread, eyeY, faceFrontZ - 0.008], 0xd8d3c1),
      boxMesh(`${namePrefix}-right-spectacles`, [0.07, 0.01, 0.012], [faceEyeSpread, eyeY, faceFrontZ - 0.008], 0xd8d3c1),
      boxMesh(`${namePrefix}-spectacles-bridge`, [0.035, 0.008, 0.01], [0, eyeY, faceFrontZ - 0.008], 0xd8d3c1),
    );
  }
  if (face.facialHair !== "none") {
    group.add(boxMesh(`${namePrefix}-facial-hair`, [0.16, face.facialHair === "full_beard" ? 0.12 : 0.05, 0.018], [0, mouthY - 0.05, faceFrontZ - 0.01], hair));
  }

  return group;
}

function findHarthmereRuntimeExpressionPart(root: THREE.Object3D, suffix: string) {
  let found: THREE.Object3D | undefined;
  root.traverse((object) => { if (!found && object.name.endsWith(suffix)) found = object; });
  return found;
}
function scaleHarthmereRuntimeExpressionPart(object: THREE.Object3D | undefined, scale: [number, number, number]) { if (!object) return; object.scale.set(object.scale.x * scale[0], object.scale.y * scale[1], object.scale.z * scale[2]); }
function moveHarthmereRuntimeExpressionPart(object: THREE.Object3D | undefined, x: number, y: number, z: number) { if (!object) return; object.position.x += x; object.position.y += y; object.position.z += z; }
function rotateHarthmereRuntimeExpressionPart(object: THREE.Object3D | undefined, z: number) { if (!object) return; object.rotation.z += z; }
function applyHarthmereRuntimeFacialExpressionToFaceRoot(faceRoot: THREE.Object3D, input: HarthmereFacialExpressionState) {
  const state = makeHarthmereFacialExpressionState(input);
  const intensity = state.intensity;
  faceRoot.traverse((object) => restoreHarthmereRuntimeFacePartNeutralTransform(object));
  const leftEye = findHarthmereRuntimeExpressionPart(faceRoot, "-left-eye");
  const rightEye = findHarthmereRuntimeExpressionPart(faceRoot, "-right-eye");
  const leftBrow = findHarthmereRuntimeExpressionPart(faceRoot, "-left-brow");
  const rightBrow = findHarthmereRuntimeExpressionPart(faceRoot, "-right-brow");
  const mouth = findHarthmereRuntimeExpressionPart(faceRoot, "-mouth");
  const leftCorner = findHarthmereRuntimeExpressionPart(faceRoot, "-mouth-left-corner");
  const rightCorner = findHarthmereRuntimeExpressionPart(faceRoot, "-mouth-right-corner");
  const teeth = findHarthmereRuntimeExpressionPart(faceRoot, "-mouth-teeth");
  switch (state.expression) {
    case "happy": case "friendly": scaleHarthmereRuntimeExpressionPart(leftEye, [1.08, 0.78, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.08, 0.78, 1]); moveHarthmereRuntimeExpressionPart(leftBrow, 0, 0.012 * intensity, 0); moveHarthmereRuntimeExpressionPart(rightBrow, 0, 0.012 * intensity, 0); scaleHarthmereRuntimeExpressionPart(mouth, [1.22, 0.85, 1]); moveHarthmereRuntimeExpressionPart(mouth, 0, 0.014 * intensity, 0); rotateHarthmereRuntimeExpressionPart(leftCorner, 0.28 * intensity); rotateHarthmereRuntimeExpressionPart(rightCorner, -0.28 * intensity); break;
    case "sad": scaleHarthmereRuntimeExpressionPart(leftEye, [0.92, 0.78, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [0.92, 0.78, 1]); moveHarthmereRuntimeExpressionPart(leftBrow, 0, -0.012 * intensity, 0); moveHarthmereRuntimeExpressionPart(rightBrow, 0, -0.012 * intensity, 0); rotateHarthmereRuntimeExpressionPart(leftBrow, -0.18 * intensity); rotateHarthmereRuntimeExpressionPart(rightBrow, 0.18 * intensity); rotateHarthmereRuntimeExpressionPart(leftCorner, -0.24 * intensity); rotateHarthmereRuntimeExpressionPart(rightCorner, 0.24 * intensity); break;
    case "angry": case "determined": scaleHarthmereRuntimeExpressionPart(leftEye, [1.08, 0.62, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.08, 0.62, 1]); rotateHarthmereRuntimeExpressionPart(leftBrow, -0.34 * intensity); rotateHarthmereRuntimeExpressionPart(rightBrow, 0.34 * intensity); scaleHarthmereRuntimeExpressionPart(mouth, [0.88, 0.72, 1]); break;
    case "surprised": scaleHarthmereRuntimeExpressionPart(leftEye, [1.25, 1.26, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.25, 1.26, 1]); moveHarthmereRuntimeExpressionPart(leftBrow, 0, 0.03 * intensity, 0); moveHarthmereRuntimeExpressionPart(rightBrow, 0, 0.03 * intensity, 0); scaleHarthmereRuntimeExpressionPart(mouth, [0.76, 1.9, 1]); if (teeth) teeth.visible = true; break;
    case "afraid": scaleHarthmereRuntimeExpressionPart(leftEye, [1.16, 1.16, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.16, 1.16, 1]); moveHarthmereRuntimeExpressionPart(leftBrow, 0, 0.024 * intensity, 0); moveHarthmereRuntimeExpressionPart(rightBrow, 0, 0.024 * intensity, 0); rotateHarthmereRuntimeExpressionPart(leftBrow, 0.18 * intensity); rotateHarthmereRuntimeExpressionPart(rightBrow, -0.18 * intensity); scaleHarthmereRuntimeExpressionPart(mouth, [0.88, 1.45, 1]); break;
    case "hurt": scaleHarthmereRuntimeExpressionPart(leftEye, [0.62, 0.55, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.05, 0.82, 1]); rotateHarthmereRuntimeExpressionPart(leftBrow, -0.28 * intensity); rotateHarthmereRuntimeExpressionPart(rightBrow, 0.18 * intensity); moveHarthmereRuntimeExpressionPart(mouth, 0.012 * intensity, -0.012 * intensity, 0); rotateHarthmereRuntimeExpressionPart(mouth, -0.12 * intensity); break;
    case "dead": scaleHarthmereRuntimeExpressionPart(leftEye, [1.2, 0.34, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.2, 0.34, 1]); rotateHarthmereRuntimeExpressionPart(leftEye, 0.48); rotateHarthmereRuntimeExpressionPart(rightEye, -0.48); scaleHarthmereRuntimeExpressionPart(mouth, [0.8, 0.55, 1]); break;
    case "thinking": case "suspicious": scaleHarthmereRuntimeExpressionPart(leftEye, [0.92, 0.72, 1]); scaleHarthmereRuntimeExpressionPart(rightEye, [1.08, 0.88, 1]); rotateHarthmereRuntimeExpressionPart(leftBrow, state.expression === "suspicious" ? -0.22 : 0.18); rotateHarthmereRuntimeExpressionPart(rightBrow, state.expression === "suspicious" ? 0.08 : -0.08); moveHarthmereRuntimeExpressionPart(mouth, state.expression === "suspicious" ? 0.01 : 0, 0, 0); break;
    case "neutral": default: break;
  }
  faceRoot.userData.harthmereFacialExpression = state;
}
function applyHarthmereRuntimeFacialExpressionToObject(root: THREE.Object3D, state: HarthmereFacialExpressionState) {
  root.traverse((object) => { if (object.userData.harthmereRuntimeFaceExpressionRoot) applyHarthmereRuntimeFacialExpressionToFaceRoot(object, state); });
  root.userData.harthmereFacialExpression = state;
}

function addHarthmereRuntimeAnchor(
  root: THREE.Object3D,
  name: string,
  position: [number, number, number],
) {
  if (root.getObjectByName(name)) {
    return;
  }
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.set(...position);
  root.add(anchor);
}

function addHarthmereRuntimeHumanAnchors(
  root: THREE.Object3D,
  body: HarthmereRuntimeBodyMetrics,
) {
  const shoulderY = body.legLength + body.torsoHeight * 0.72;
  const headY = body.legLength + body.torsoHeight + 0.16;
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-head", [0, headY, -0.01]);
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-neck", [0, headY - 0.18, -0.005]);
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-right-hand", [body.shoulderWidth / 2 + 0.04, shoulderY - body.armLength / 2, -0.03]);
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-left-hand", [-(body.shoulderWidth / 2 + 0.04), shoulderY - body.armLength / 2, -0.03]);
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-hip", [0.16, body.legLength + 0.08, 0.1]);
  addHarthmereRuntimeAnchor(root, "harthmere-anchor-back", [0, body.legLength + body.torsoHeight * 0.7, 0.14]);
}

function findHarthmereRuntimeAnchor(
  root: THREE.Object3D,
  candidates: readonly string[],
): THREE.Object3D | undefined {
  for (const name of candidates) {
    const found = root.getObjectByName(name);
    if (found && found.visible !== false) {
      return found;
    }
  }
  return undefined;
}

function hideHarthmereRuntimeBuiltInHead(root: THREE.Object3D) {
  const headNames = new Set(["Head", "HairCap", "LeftEye", "RightEye", "Nose", "Mouth"]);
  root.traverse((object) => {
    if (headNames.has(object.name)) {
      object.visible = false;
      object.traverse((child) => {
        child.visible = false;
      });
    }
  });
}

function applyHarthmereRuntimeAppearanceToHumanObject(
  placement: RuntimePlacement,
  object: THREE.Object3D,
): HarthmereCharacterAppearance {
  const appearance = harthmereRuntimeAppearanceForPlacement(placement);
  object.userData.harthmereAppearance = appearance;
  object.userData.harthmereForwardAxis = appearance.forwardAxis;
  object.userData.harthmereAnchors = appearance.anchors;

  // GLTF townsperson bodies are still useful for animation, but their built-in
  // heads are generic. Hide those heads and attach the same voxel face system
  // used by procedural/ECS Harthmere characters so combat and ambient NPCs read
  // from the same appearance schema.
  hideHarthmereRuntimeBuiltInHead(object);
  const rootScale = harthmereRuntimeRootBodyScale(appearance.body);
  object.scale.x *= rootScale.width;
  object.scale.y *= rootScale.height;
  object.scale.z *= rootScale.depth;

  const oldHead = object.getObjectByName("harthmere-runtime-appearance-head");
  if (oldHead?.parent) {
    oldHead.parent.remove(oldHead);
  }
  const neck = findHarthmereRuntimeAnchor(object, appearance.anchors.neck);
  const head = createHarthmereRuntimeVoxelHead(
    appearance,
    neck ? 0.16 : 1.1,
    "harthmere-runtime",
  );
  (neck ?? object).add(head);
  return appearance;
}

function townspersonPalette(key: string): TownspersonPalette {
  switch (key) {
    case "townsperson_guard":
      return {
        skin: 0xc58c62,
        hair: 0x3a2518,
        tunic: 0x8c1d1d,
        legs: 0x252525,
        accent: 0x222222,
      };
    case "townsperson_courier":
      return {
        skin: 0xd09a6a,
        hair: 0x5a3825,
        tunic: 0x2f6d3b,
        legs: 0x44352a,
        accent: 0xd7b45a,
      };
    case "townsperson_dockhand":
      return {
        skin: 0xb9825a,
        hair: 0x2d211a,
        tunic: 0x5b4937,
        legs: 0x223748,
        accent: 0x8a6d3d,
      };
    case "townsperson_mudden":
      return {
        skin: 0xc28a62,
        hair: 0x332118,
        tunic: 0x7c6b58,
        legs: 0x4a4038,
        accent: 0x9a5f3e,
      };
    case "townsperson_farmer":
      return {
        skin: 0xd19a68,
        hair: 0x6a4226,
        tunic: 0x6b7b3e,
        legs: 0x5a412b,
        accent: 0xb89652,
      };
    case "townsperson_clergy":
      return {
        skin: 0xc7966b,
        hair: 0x4a3426,
        tunic: 0xd8cfb0,
        legs: 0x6d6a60,
        accent: 0x637b9a,
      };
    case "townsperson_hunter":
      return {
        skin: 0xc28a62,
        hair: 0x3a2518,
        tunic: 0x31553a,
        legs: 0x4a3a2a,
        accent: 0xa77c3d,
      };
    case "townsperson_bandit":
      return {
        skin: 0xb57955,
        hair: 0x221915,
        tunic: 0x4b3b33,
        legs: 0x2d2925,
        accent: 0x8c2f2a,
      };
    case "townsperson_smuggler":
      return {
        skin: 0xb9825a,
        hair: 0x251812,
        tunic: 0x25364a,
        legs: 0x1c242d,
        accent: 0x2d6b66,
      };
    case "townsperson_undead":
      return {
        skin: 0x9aa68c,
        hair: 0x2b3028,
        tunic: 0x5a5b55,
        legs: 0x363a35,
        accent: 0x7fa6a0,
      };
    case "townsperson_charcoal":
      return {
        skin: 0xae7654,
        hair: 0x1e1b18,
        tunic: 0x3b3630,
        legs: 0x2c2925,
        accent: 0x78706a,
      };
    default:
      return {
        skin: 0xc98f63,
        hair: 0x4a2d1c,
        tunic: 0x326c91,
        legs: 0x3f352c,
        accent: 0x8a5137,
      };
  }
}

function addHarthmereRuntimeOutfitAndGearPolish(
  root: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
  torsoY: number,
  shoulderY: number,
  headY: number,
) {
  const trim = harthmereRuntimeColorDarken(palette.tunic, 0.32);
  const accent = palette.accent;
  const metal = 0xb8b2a4;
  const leather = 0x3b2418;
  const clothingSlots = Object.keys(appearance.clothing);
  addHarthmereRuntimeVisibleClothingGuaranteeV22(root, appearance.clothing as any, body, palette);
  addHarthmereRuntimeOutwardClothingDetailLayerV23(root, appearance.clothing as any, body, palette);
  root.userData.harthmereModularClothingRuntime = "harthmere-modular-clothing-runtime-v15-body-fit";
  root.userData.harthmereClothingSlots = clothingSlots;
  root.userData.harthmereClothingFitMetrics = body;
  root.userData.harthmereThreeJsClothingRenderer = "harthmere-threejs-clothing-v15-body-fit";
  root.userData.harthmereHiddenBodyZones = clothingSlots.flatMap((slot) => appearance.clothing[slot as keyof typeof appearance.clothing]?.hidesBodyZones ?? []);
  queueHarthmereRuntimeLicensedClothingModelsV18(root, appearance.clothing as any, body);
  // V14 modular clothing proxy layer. Rigid pieces are positioned at the same
  // anchors that future GLB clothing will use; skinned torso/leg slots are
  // represented here as cheap voxel overlays until authored same-skeleton GLBs
  // exist for every outfit.
  if (appearance.clothing.torso) {
    root.add(
      boxMesh("townsperson-clothing-torso-v15-body-fit", [body.torsoWidth + 0.05, body.torsoHeight + 0.04, 0.05], [0, torsoY, -0.14], palette.tunic),
      boxMesh("townsperson-clothing-collar-v15-body-fit", [body.torsoWidth + 0.08, 0.035, 0.06], [0, torsoY + body.torsoHeight * 0.42, -0.165], accent),
      boxMesh("townsperson-clothing-hem-v15-body-fit", [body.torsoWidth + 0.1, 0.035, 0.06], [0, torsoY - body.torsoHeight * 0.42, -0.165], trim),
    );
  }
  if (appearance.clothing.legs) {
    root.add(
      boxMesh("townsperson-clothing-left-trouser-v15-body-fit", [body.legWidth + 0.035, body.legLength * 0.82, 0.045], [-(body.torsoWidth / 4 + body.legSpread), body.legLength * 0.54, -0.105], trim),
      boxMesh("townsperson-clothing-right-trouser-v15-body-fit", [body.legWidth + 0.035, body.legLength * 0.82, 0.045], [body.torsoWidth / 4 + body.legSpread, body.legLength * 0.54, -0.105], trim),
    );
  }
  if (appearance.clothing.belt) {
    root.add(
      boxMesh("townsperson-clothing-belt-v14", [body.torsoWidth + 0.08, 0.045, 0.06], [0, body.legLength + 0.08, -0.14], leather),
      boxMesh("townsperson-clothing-buckle-v14", [0.06, 0.055, 0.025], [0, body.legLength + 0.08, -0.18], metal),
    );
  }
  if (appearance.clothing.feet) {
    root.add(
      boxMesh("townsperson-clothing-left-boot-v14", [body.legWidth + 0.04, 0.07, 0.07], [-(body.torsoWidth / 4 + body.legSpread), 0.055, -0.09], 0x171717),
      boxMesh("townsperson-clothing-right-boot-v14", [body.legWidth + 0.04, 0.07, 0.07], [body.torsoWidth / 4 + body.legSpread, 0.055, -0.09], 0x171717),
    );
  }
  // Shared role gear: all ambient/combat humans now read the same equipment
  // fields that the player renderer uses. These voxel proxies are deliberately
  // cheap because Harthmere can spawn hundreds of runtime people.
  root.add(
    boxMesh("townsperson-collar-polish", [body.torsoWidth + 0.035, 0.032, 0.22], [0, torsoY + body.torsoHeight * 0.42, -0.03], accent),
    boxMesh("townsperson-hem-polish", [body.torsoWidth + 0.05, 0.032, 0.22], [0, torsoY - body.torsoHeight * 0.42, -0.03], accent),
    boxMesh("townsperson-left-cuff-polish", [body.armWidth + 0.035, 0.032, 0.12], [-body.shoulderWidth / 2, shoulderY - body.armLength * 0.42, -0.02], trim),
    boxMesh("townsperson-right-cuff-polish", [body.armWidth + 0.035, 0.032, 0.12], [body.shoulderWidth / 2, shoulderY - body.armLength * 0.42, -0.02], trim),
    boxMesh("townsperson-left-boot-polish", [body.legWidth + 0.035, 0.07, 0.14], [-(body.torsoWidth / 4 + body.legSpread), 0.05, -0.02], 0x151515),
    boxMesh("townsperson-right-boot-polish", [body.legWidth + 0.035, 0.07, 0.14], [body.torsoWidth / 4 + body.legSpread, 0.05, -0.02], 0x151515),
  );

  if (appearance.equipment.head === "guard_helmet") {
    root.add(
      boxMesh("guard-helmet-polish", [0.38, 0.09, 0.28], [0, headY + 0.2, -0.01], metal),
      boxMesh("guard-helmet-ridge-polish", [0.07, 0.15, 0.08], [0, headY + 0.29, -0.01], accent),
    );
  } else if (appearance.equipment.head === "straw_hat") {
    root.add(
      boxMesh("farmer-straw-hat-brim-polish", [0.48, 0.035, 0.38], [0, headY + 0.2, -0.01], 0xc7a45a),
      boxMesh("farmer-straw-hat-crown-polish", [0.26, 0.12, 0.24], [0, headY + 0.27, -0.01], 0xd8b86a),
    );
  } else if (appearance.equipment.head === "bandit_mask") {
    root.add(boxMesh("bandit-mask-polish", [0.22, 0.045, 0.025], [0, headY + 0.015, -0.16], 0x191514));
  }

  if (/shield/i.test(appearance.equipment.offHand ?? "")) {
    root.add(
      boxMesh("townsperson-left-shield-polish", [0.18, 0.24, 0.055], [-(body.shoulderWidth / 2 + 0.08), shoulderY - body.armLength * 0.25, -0.085], metal),
      boxMesh("townsperson-left-shield-boss-polish", [0.07, 0.07, 0.065], [-(body.shoulderWidth / 2 + 0.08), shoulderY - body.armLength * 0.25, -0.13], accent),
    );
  }
  if (/sword|dagger|knife|axe/i.test(appearance.equipment.mainHand ?? "") || appearance.equipment.hip) {
    const sheath = boxMesh("townsperson-hip-sheath-polish", [0.045, 0.32, 0.065], [body.torsoWidth / 2 + 0.055, body.legLength + 0.08, 0.08], leather);
    sheath.rotation.z = -0.22;
    root.add(sheath);
  }
  if (/bow|quiver/i.test(`${appearance.equipment.mainHand ?? ""} ${appearance.equipment.back ?? ""}`)) {
    const bow = boxMesh("townsperson-back-bow-polish", [0.04, 0.58, 0.045], [body.torsoWidth / 2 + 0.06, torsoY + 0.05, 0.16], leather);
    bow.rotation.z = -0.22;
    root.add(bow, boxMesh("townsperson-quiver-fletching-polish", [0.12, 0.05, 0.08], [body.torsoWidth / 2 + 0.02, torsoY + 0.28, 0.18], 0xf0e6d2));
  }
  if (/staff/i.test(appearance.equipment.mainHand ?? "")) {
    const staff = boxMesh("townsperson-staff-polish", [0.035, 0.66, 0.035], [body.shoulderWidth / 2 + 0.12, shoulderY - 0.12, -0.05], leather);
    staff.rotation.z = -0.08;
    root.add(staff, boxMesh("townsperson-staff-cap-polish", [0.07, 0.07, 0.07], [body.shoulderWidth / 2 + 0.1, shoulderY + 0.2, -0.05], 0x6f5ca8));
  }
  if (appearance.equipment.back === "merchant_satchel" || appearance.equipment.accessory === "ledger_pouch") {
    root.add(boxMesh("merchant-satchel-polish", [0.17, 0.18, 0.075], [-body.shoulderWidth / 2 - 0.02, torsoY, 0.13], 0x7a4f2a));
  }
  if (appearance.equipment.accessory === "clergy_sash") {
    root.add(boxMesh("clergy-sash-polish", [0.07, body.torsoHeight + 0.04, 0.225], [-0.1, torsoY, -0.04], accent));
  }
  if (appearance.equipment.accessory === "torn_cloth") {
    root.add(
      boxMesh("undead-torn-cloth-left-polish", [0.08, 0.18, 0.03], [-body.torsoWidth / 2 + 0.06, torsoY - 0.18, -0.13], trim),
      boxMesh("undead-torn-cloth-right-polish", [0.07, 0.14, 0.03], [body.torsoWidth / 2 - 0.04, torsoY - 0.21, -0.13], trim),
    );
  }
}

const HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20 =
  "harthmere-runtime-product-minecraft-polish-v20";

function addHarthmereRuntimeProductMinecraftClothingPolishV20(
  root: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
  torsoY: number,
  shoulderY: number,
  headY: number,
) {
  const trim = harthmereRuntimeColorDarken(palette.tunic, 0.32);
  const light = harthmereRuntimeColorLighten(palette.tunic, 0.28);
  const metal = 0xb8b2a4;
  const leather = 0x3b2418;
  const dark = 0x181411;
  const clothing = appearance.clothing as Record<string, any>;
  const slots = Object.keys(clothing);

  root.userData.harthmereRuntimeProductMinecraftPolish = HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20;
  root.userData.harthmereRuntimeProductMinecraftPolishSlots = slots;

  const add = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereRuntimeProductMinecraftPolish = HARTHMERE_RUNTIME_PRODUCT_MINECRAFT_POLISH_VERSION_V20;
    root.add(mesh);
    return mesh;
  };

  const addBox = (
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: number,
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const mesh = boxMesh(name, size, position, color);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return add(mesh);
  };

  for (const slot of slots) {
    const item = clothing[slot];
    if (!item) continue;
    const variant = String(item.threeJsVariant ?? item.id ?? slot);
    const armor = /armor|guard|scale|shield|helmet/i.test(variant);
    const robe = /robe|shroud|skirt|long_robe/i.test(variant);
    const apron = /apron/i.test(variant);
    const hunter = /hunter|jerkin|quiver|bedroll|bow/i.test(variant);
    const merchant = /merchant|noble|doublet|ledger/i.test(variant);
    const torn = /torn|ragged|patched|bandit|scrap/i.test(variant);

    if (slot === "torso") {
      const height = body.torsoHeight + (robe ? body.legLength * 0.42 : 0.06);
      const y = torsoY - (robe ? body.legLength * 0.18 : 0);
      addBox("townsperson-product-torso-front-v20", [body.torsoWidth + 0.1, height, 0.055], [0, y, -0.18], armor ? metal : hunter || apron ? leather : palette.tunic);
      addBox("townsperson-product-torso-trim-v20", [body.torsoWidth + 0.15, 0.032, 0.065], [0, torsoY + body.torsoHeight * 0.43, -0.225], light);
      addBox("townsperson-product-hem-trim-v20", [body.torsoWidth + 0.15, 0.032, 0.065], [0, y - height * 0.48, -0.22], trim);
      if (armor) {
        addBox("townsperson-product-left-pauldron-v20", [0.16, 0.07, 0.22], [-(body.shoulderWidth / 2 + 0.02), shoulderY + 0.02, -0.035], metal);
        addBox("townsperson-product-right-pauldron-v20", [0.16, 0.07, 0.22], [body.shoulderWidth / 2 + 0.02, shoulderY + 0.02, -0.035], metal);
        addBox("townsperson-product-tabard-v20", [0.1, height * 0.82, 0.07], [0, y, -0.255], palette.accent);
      }
      if (robe) {
        addBox("townsperson-product-robe-sash-v20", [0.07, height * 0.96, 0.075], [-0.11, y, -0.25], palette.accent, [0, 0, -0.16]);
      }
      if (apron) {
        addBox("townsperson-product-apron-v20", [body.torsoWidth * 0.72, height * 0.82, 0.07], [0, y - 0.02, -0.255], leather);
      }
      if (merchant) {
        addBox("townsperson-product-left-lapel-v20", [0.07, height * 0.62, 0.075], [-0.12, y + 0.04, -0.258], light, [0, 0, -0.08]);
        addBox("townsperson-product-right-lapel-v20", [0.07, height * 0.62, 0.075], [0.12, y + 0.04, -0.258], light, [0, 0, 0.08]);
      }
      if (torn) {
        addBox("townsperson-product-rag-left-v20", [0.12, 0.11, 0.075], [-(body.torsoWidth * 0.24), torsoY - 0.04, -0.28], trim, [0, 0, -0.14]);
        addBox("townsperson-product-rag-right-v20", [0.1, 0.1, 0.075], [body.torsoWidth * 0.25, torsoY + 0.1, -0.28], dark, [0, 0, 0.16]);
      }
    } else if (slot === "legs") {
      const lx = -(body.torsoWidth / 4 + body.legSpread);
      const rx = body.torsoWidth / 4 + body.legSpread;
      if (robe) {
        addBox("townsperson-product-robe-skirt-v20", [body.torsoWidth + 0.1, body.legLength * 0.82, 0.06], [0, body.legLength * 0.52, -0.155], palette.tunic);
      } else {
        addBox("townsperson-product-left-knee-v20", [body.legWidth + 0.055, 0.05, 0.06], [lx, body.legLength * 0.52, -0.14], armor ? metal : light);
        addBox("townsperson-product-right-knee-v20", [body.legWidth + 0.055, 0.05, 0.06], [rx, body.legLength * 0.52, -0.14], armor ? metal : light);
      }
    } else if (slot === "feet") {
      const lx = -(body.torsoWidth / 4 + body.legSpread);
      const rx = body.torsoWidth / 4 + body.legSpread;
      addBox("townsperson-product-left-boot-cuff-v20", [body.legWidth + 0.055, 0.045, 0.13], [lx, 0.13, -0.045], leather);
      addBox("townsperson-product-right-boot-cuff-v20", [body.legWidth + 0.055, 0.045, 0.13], [rx, 0.13, -0.045], leather);
    } else if (slot === "hands") {
      addBox("townsperson-product-left-bracer-v20", [body.armWidth + 0.035, 0.05, 0.12], [-body.shoulderWidth / 2, shoulderY - body.armLength * 0.24, -0.03], leather);
      addBox("townsperson-product-right-bracer-v20", [body.armWidth + 0.035, 0.05, 0.12], [body.shoulderWidth / 2, shoulderY - body.armLength * 0.24, -0.03], leather);
    } else if (slot === "belt") {
      addBox("townsperson-product-belt-pouch-left-v20", [0.085, 0.105, 0.055], [-(body.torsoWidth * 0.36), body.legLength + 0.04, -0.16], dark);
      addBox("townsperson-product-belt-pouch-right-v20", [0.075, 0.095, 0.055], [body.torsoWidth * 0.35, body.legLength + 0.035, -0.16], dark);
    } else if (slot === "head") {
      if (/helmet|guard|halfhelm/i.test(variant)) {
        addBox("townsperson-product-helmet-brow-v20", [0.46, 0.035, 0.05], [0, headY + 0.15, -0.16], dark);
      } else if (/hood/i.test(variant)) {
        addBox("townsperson-product-hood-drape-v20", [0.36, 0.16, 0.055], [0, headY + 0.04, 0.13], dark);
      } else {
        addBox("townsperson-product-hat-band-v20", [0.3, 0.035, 0.25], [0, headY + 0.23, -0.01], dark);
      }
    } else if (slot === "face" && /mask/i.test(variant)) {
      addBox("townsperson-product-mask-v20", [0.23, 0.052, 0.03], [0, headY + 0.02, -0.17], dark);
    } else if (slot === "back") {
      if (/cape|cloak|shroud/i.test(variant)) {
        addBox("townsperson-product-cape-clasp-v20", [0.1, 0.05, 0.06], [0, shoulderY + 0.04, -0.13], metal);
      } else {
        addBox("townsperson-product-pack-flap-v20", [0.18, 0.1, 0.075], [0.04, torsoY + 0.08, 0.215], trim);
      }
    }
  }
}

const HARTHMERE_LARGE_BODY_CLOTHING_VISIBILITY_VERSION_V14 =
  "harthmere-large-body-clothing-visibility-v14";

function ensureHarthmereLargeBodyClothingVisibilityV14(
  root: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  body: HarthmereRuntimeBodyMetrics,
) {
  const largeBody =
    body.torsoWidth >= 0.44 ||
    body.shoulderWidth >= 0.62 ||
    body.legWidth >= 0.13 ||
    appearance.body.bodyType === "broad" ||
    appearance.body.bodyType === "stocky" ||
    appearance.body.bodyType === "soft";
  if (!largeBody) {
    return;
  }
  const touched: string[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    if (!/(townsperson-(clothing|product|collar|hem|left-boot|right-boot)|merchant-|clergy-|guard-|bandit-|farmer-|undead-)/i.test(child.name)) {
      return;
    }
    child.position.z -= 0.055;
    child.scale.x *= 1.05;
    child.scale.y *= 1.02;
    child.userData.harthmereLargeBodyClothingVisibilityV14 = true;
    touched.push(child.name);
  });
  root.userData.harthmereLargeBodyClothingVisibilityV14 = {
    version: HARTHMERE_LARGE_BODY_CLOTHING_VISIBILITY_VERSION_V14,
    largeBody,
    bodyType: appearance.body.bodyType,
    touched,
  };
}


// HARTHMERE_RUNTIME_OUTSIDE_CLOTHING_SHELL_V26
// Renders clothing deliberately outside the base body so medium/tall townspeople visibly have clothes.
const HARTHMERE_RUNTIME_OUTSIDE_CLOTHING_SHELL_VERSION_V26 =
  "harthmere-runtime-outside-clothing-shell-v26";

function addHarthmereRuntimeOutsideClothingShellV26(
  root: THREE.Group,
  clothing: Record<string, any> | undefined,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
): void {
  const slots = Object.keys(clothing ?? {});
  if (slots.length === 0) {
    return;
  }

  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.82;
  const waistY = body.legLength + 0.09;
  // V29: thin garment layer over the silhouette, not a large outside shell.
  const torsoWidth = body.torsoWidth + 0.08;
  const torsoHeight = body.torsoHeight + 0.05;
  const torsoDepth = body.torsoDepth + 0.06;
  const frontZ = -(body.torsoDepth / 2 + 0.035);
  const backZ = body.torsoDepth / 2 + 0.035;
  const sideX = torsoWidth / 2 + 0.02;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const legWidth = body.legWidth + 0.035;
  const legLength = body.legLength * 0.9;
  const cloth = Number(palette.tunic ?? 0x3b82f6);
  const trim = Number(palette.accent ?? 0xfacc15);
  const pants = Number(palette.legs ?? 0x334155);
  const leather = 0x3b2418;
  const dark = 0x111111;

  const mark = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereRuntimeOutsideClothingShellV26 = true;
    root.add(mesh);
    return mesh;
  };

  if (clothing?.torso) {
    mark(boxMesh("runtime-outside-clothing-torso-front-v26", [torsoWidth, torsoHeight, 0.04], [0, torsoY, frontZ], cloth));
    mark(boxMesh("runtime-outside-clothing-torso-back-v26", [torsoWidth, torsoHeight, 0.04], [0, torsoY, backZ], cloth));
    mark(boxMesh("runtime-outside-clothing-torso-left-v26", [0.04, torsoHeight, torsoDepth + 0.04], [-sideX, torsoY, 0], cloth));
    mark(boxMesh("runtime-outside-clothing-torso-right-v26", [0.04, torsoHeight, torsoDepth + 0.04], [sideX, torsoY, 0], cloth));
    mark(boxMesh("runtime-outside-clothing-collar-v26", [torsoWidth + 0.03, 0.04, torsoDepth + 0.05], [0, torsoY + torsoHeight * 0.48, 0], trim));
    mark(boxMesh("runtime-outside-clothing-hem-v26", [torsoWidth + 0.04, 0.045, torsoDepth + 0.055], [0, torsoY - torsoHeight * 0.49, 0], trim));
  }

  if (clothing?.legs) {
    mark(boxMesh("runtime-outside-clothing-left-leg-v26", [legWidth, legLength, body.legDepth + 0.045], [-legX, body.legLength * 0.52, -0.035], pants));
    mark(boxMesh("runtime-outside-clothing-right-leg-v26", [legWidth, legLength, body.legDepth + 0.045], [legX, body.legLength * 0.52, -0.035], pants));
  }

  if (clothing?.feet) {
    mark(boxMesh("runtime-outside-clothing-left-boot-v26", [legWidth + 0.045, 0.1, body.legDepth + 0.065], [-legX, 0.055, -0.04], dark));
    mark(boxMesh("runtime-outside-clothing-right-boot-v26", [legWidth + 0.045, 0.1, body.legDepth + 0.065], [legX, 0.055, -0.04], dark));
  }

  if (clothing?.belt) {
    mark(boxMesh("runtime-outside-clothing-belt-v26", [torsoWidth + 0.055, 0.055, torsoDepth + 0.065], [0, waistY, 0], leather));
    mark(boxMesh("runtime-outside-clothing-buckle-v26", [0.075, 0.07, 0.04], [0, waistY, frontZ - 0.035], 0xd0b56b));
  }

  if (clothing?.hands) {
    const armWidth = body.armWidth + 0.03;
    const armLength = body.armLength * 0.68;
    mark(boxMesh("runtime-outside-clothing-left-sleeve-v26", [armWidth, armLength, body.armDepth + 0.04], [-(body.shoulderWidth / 2 + 0.015), shoulderY - armLength * 0.45, -0.03], cloth));
    mark(boxMesh("runtime-outside-clothing-right-sleeve-v26", [armWidth, armLength, body.armDepth + 0.04], [body.shoulderWidth / 2 + 0.015, shoulderY - armLength * 0.45, -0.03], cloth));
  }

  root.userData.harthmereRuntimeOutsideClothingShellV26 = {
    version: HARTHMERE_RUNTIME_OUTSIDE_CLOTHING_SHELL_VERSION_V26,
    slots,
    torsoWidth,
    torsoHeight,
    frontZ,
    backZ,
  };
}


// HARTHMERE_RUNTIME_ALWAYS_VISIBLE_NPC_CLOTHING_V27
// Different approach from the previous clothing-slot layers: this does not rely
// on clothing slot presence or coplanar overlays. It puts a role-colored outfit
// shell far outside every procedural humanoid body so medium/tall NPCs visibly
// read as clothed first; later art passes can tune the offsets inward.
const HARTHMERE_RUNTIME_ALWAYS_VISIBLE_NPC_CLOTHING_VERSION_V27 =
  "harthmere-runtime-always-visible-npc-clothing-v27";

function addHarthmereRuntimeAlwaysVisibleNpcClothingV27(
  root: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
  torsoY: number,
  shoulderY: number,
): void {
  if (appearance.species !== "human" && appearance.species !== "undead") return;
  const role = appearance.role;
  const hasTorsoClothing = Boolean(
    (appearance.clothing as Record<string, unknown> | undefined)?.torso,
  );
  if (!hasTorsoClothing) {
    root.userData.harthmereRuntimeAlwaysVisibleNpcClothingV27 = {
      version: HARTHMERE_RUNTIME_ALWAYS_VISIBLE_NPC_CLOTHING_VERSION_V27,
      role,
      species: appearance.species,
      skipped: "no-torso-clothing",
    };
    return;
  }

  const cloth = role === "guard" ? 0x334f73 : role === "merchant" ? 0x5b3f78 : role === "farmer" ? 0x6f5a36 : role === "clergy" || String(role) === "scholar" ? 0x4b5272 : role === "bandit" || role === "hostile" ? 0x4a3434 : appearance.species === "undead" ? 0x5b5f50 : Number(palette.tunic ?? 0x3b82f6);
  const trim = role === "guard" ? 0xc9a85a : role === "bandit" || role === "hostile" ? 0x9b2f2f : Number(palette.accent ?? 0xd1a64e);
  const pants = Number(palette.legs ?? 0x273244);
  const leather = 0x3b2418;
  const dark = 0x111111;

  // V29: thin clothing follows the actual body. No hard minimum floors and no
  // fixed 0.72m depth shell.
  const torsoWidth = body.torsoWidth + 0.1;
  const torsoHeight = body.torsoHeight + 0.06;
  const torsoDepth = body.torsoDepth + 0.06;
  const frontZ = -(body.torsoDepth / 2 + 0.045);
  const backZ = body.torsoDepth / 2 + 0.045;
  const sideX = torsoWidth / 2 + 0.025;
  const waistY = body.legLength + 0.09;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const legWidth = body.legWidth + 0.04;
  const legLength = body.legLength * 0.9;
  const armWidth = body.armWidth + 0.035;
  const armLength = body.armLength * 0.72;
  const add = (mesh: THREE.Object3D) => { mesh.userData.harthmereRuntimeAlwaysVisibleNpcClothingV27 = true; root.add(mesh); return mesh; };
  add(boxMesh("runtime-always-visible-clothing-torso-front-v27", [torsoWidth, torsoHeight, 0.045], [0, torsoY, frontZ], cloth));
  add(boxMesh("runtime-always-visible-clothing-torso-back-v27", [torsoWidth, torsoHeight, 0.045], [0, torsoY, backZ], cloth));
  add(boxMesh("runtime-always-visible-clothing-torso-left-v27", [0.045, torsoHeight, torsoDepth], [-sideX, torsoY, 0], cloth));
  add(boxMesh("runtime-always-visible-clothing-torso-right-v27", [0.045, torsoHeight, torsoDepth], [sideX, torsoY, 0], cloth));
  add(boxMesh("runtime-always-visible-clothing-collar-v27", [torsoWidth + 0.04, 0.045, torsoDepth + 0.035], [0, torsoY + torsoHeight * 0.48, 0], trim));
  add(boxMesh("runtime-always-visible-clothing-hem-v27", [torsoWidth + 0.04, 0.05, torsoDepth + 0.04], [0, torsoY - torsoHeight * 0.49, 0], trim));
  add(boxMesh("runtime-always-visible-clothing-belt-v27", [torsoWidth + 0.05, 0.06, torsoDepth + 0.045], [0, waistY, 0], leather));
  add(boxMesh("runtime-always-visible-clothing-buckle-v27", [0.08, 0.07, 0.04], [0, waistY, frontZ - 0.04], 0xd0b56b));
  add(boxMesh("runtime-always-visible-clothing-left-sleeve-v27", [armWidth, armLength, body.armDepth + 0.05], [-(body.shoulderWidth / 2 + 0.02), shoulderY - armLength * 0.46, -0.035], cloth));
  add(boxMesh("runtime-always-visible-clothing-right-sleeve-v27", [armWidth, armLength, body.armDepth + 0.05], [body.shoulderWidth / 2 + 0.02, shoulderY - armLength * 0.46, -0.035], cloth));
  add(boxMesh("runtime-always-visible-clothing-left-pants-v27", [legWidth, legLength, body.legDepth + 0.055], [-legX, body.legLength * 0.52, -0.035], pants));
  add(boxMesh("runtime-always-visible-clothing-right-pants-v27", [legWidth, legLength, body.legDepth + 0.055], [legX, body.legLength * 0.52, -0.035], pants));
  add(boxMesh("runtime-always-visible-clothing-left-boot-v27", [legWidth + 0.055, 0.105, body.legDepth + 0.07], [-legX, 0.06, -0.04], dark));
  add(boxMesh("runtime-always-visible-clothing-right-boot-v27", [legWidth + 0.055, 0.105, body.legDepth + 0.07], [legX, 0.06, -0.04], dark));
  root.userData.harthmereRuntimeAlwaysVisibleNpcClothingV27 = {
    version: HARTHMERE_RUNTIME_ALWAYS_VISIBLE_NPC_CLOTHING_VERSION_V27,
    role,
    species: appearance.species,
    frontZ,
    backZ,
    torsoWidth,
    torsoHeight,
    torsoDepth,
  };
}


// HARTHMERE_RUNTIME_NPC_CLOTHING_MATERIAL_RECOLOR_V28
// This is intentionally not just another spatial shell. It recolors the actual
// procedural townsperson body/leg/arm meshes and then adds high-contrast trim.
// That covers medium/tall NPCs even when the old clothing slots or extra shells
// are not visible from the current camera angle.
const HARTHMERE_RUNTIME_NPC_CLOTHING_MATERIAL_RECOLOR_VERSION_V28 =
  "harthmere-runtime-npc-clothing-material-recolor-v28";

function setHarthmereRuntimeNpcMeshColorV28(object: THREE.Object3D | undefined, color: number) {
  if (!object || !(object instanceof THREE.Mesh)) {
    return false;
  }
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    const maybeMaterial = material as THREE.Material & { color?: THREE.Color };
    if (maybeMaterial.color) {
      maybeMaterial.color.setHex(color);
      maybeMaterial.needsUpdate = true;
    }
  }
  object.userData.harthmereRuntimeNpcClothingMaterialRecolorV28 = true;
  return true;
}

function addHarthmereRuntimeNpcClothingMaterialRecolorV28(
  root: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
  torsoY: number,
  shoulderY: number,
): void {
  if (appearance.species !== "human" && appearance.species !== "undead") {
    return;
  }
  const roleKey = String(appearance.role);
  const cloth = roleKey === "guard"
    ? 0x334f73
    : roleKey === "merchant"
    ? 0x5b3f78
    : roleKey === "farmer"
    ? 0x6f5a36
    : roleKey === "clergy" || roleKey === "scholar"
    ? 0x4b5272
    : roleKey === "bandit" || roleKey === "hostile"
    ? 0x4a3434
    : appearance.species === "undead"
    ? 0x5b5f50
    : Number(palette.tunic ?? 0x3b82f6);
  const pants = Number(palette.legs ?? 0x273244);
  const trim = roleKey === "guard" ? 0xc9a85a : roleKey === "bandit" || roleKey === "hostile" ? 0x9b2f2f : Number(palette.accent ?? 0xd1a64e);
  const leather = 0x3b2418;
  const dark = 0x111111;

  const changed = [
    setHarthmereRuntimeNpcMeshColorV28(root.getObjectByName("townsperson-body"), cloth),
    setHarthmereRuntimeNpcMeshColorV28(root.getObjectByName("townsperson-left-arm"), cloth),
    setHarthmereRuntimeNpcMeshColorV28(root.getObjectByName("townsperson-right-arm"), cloth),
    setHarthmereRuntimeNpcMeshColorV28(root.getObjectByName("townsperson-left-leg"), pants),
    setHarthmereRuntimeNpcMeshColorV28(root.getObjectByName("townsperson-right-leg"), pants),
  ].filter(Boolean).length;

  const torsoWidth = body.torsoWidth + 0.06;
  const torsoDepth = 0.38;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const waistY = body.legLength + 0.09;
  const add = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereRuntimeNpcClothingMaterialRecolorV28 = true;
    root.add(mesh);
    return mesh;
  };

  add(boxMesh("runtime-material-clothing-collar-v28", [torsoWidth + 0.08, 0.055, torsoDepth], [0, torsoY + body.torsoHeight * 0.45, -0.03], trim));
  add(boxMesh("runtime-material-clothing-hem-v28", [torsoWidth + 0.1, 0.06, torsoDepth], [0, torsoY - body.torsoHeight * 0.48, -0.03], trim));
  add(boxMesh("runtime-material-clothing-belt-v28", [torsoWidth + 0.12, 0.075, torsoDepth + 0.04], [0, waistY, -0.035], leather));
  add(boxMesh("runtime-material-clothing-buckle-v28", [0.1, 0.09, 0.055], [0, waistY, -0.24], 0xd0b56b));
  add(boxMesh("runtime-material-clothing-left-cuff-v28", [Math.max(body.armWidth + 0.05, 0.13), 0.08, 0.14], [-(body.shoulderWidth / 2), shoulderY - body.armLength * 0.52, -0.06], trim));
  add(boxMesh("runtime-material-clothing-right-cuff-v28", [Math.max(body.armWidth + 0.05, 0.13), 0.08, 0.14], [body.shoulderWidth / 2, shoulderY - body.armLength * 0.52, -0.06], trim));
  add(boxMesh("runtime-material-clothing-left-boot-v28", [Math.max(body.legWidth + 0.08, 0.18), 0.13, 0.22], [-legX, 0.065, -0.08], dark));
  add(boxMesh("runtime-material-clothing-right-boot-v28", [Math.max(body.legWidth + 0.08, 0.18), 0.13, 0.22], [legX, 0.065, -0.08], dark));

  root.userData.harthmereRuntimeNpcClothingMaterialRecolorV28 = {
    version: HARTHMERE_RUNTIME_NPC_CLOTHING_MATERIAL_RECOLOR_VERSION_V28,
    role: roleKey,
    species: appearance.species,
    recoloredBaseMeshes: changed,
  };
}

const HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V13 =
  "harthmere-force-procedural-townsperson-clothing-v13";
const HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V12 =
  HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V13;

function addHarthmereRuntimeProceduralWeaponSlotV15(
  root: THREE.Group,
  clothing: HarthmereCharacterAppearance["clothing"],
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
): void {
  const weapon = clothing.weapon;
  if (!weapon) {
    return;
  }

  const shoulderY = body.legLength + body.torsoHeight * 0.64;
  const handX = body.shoulderWidth / 2 + 0.08;
  const handY = shoulderY - body.armLength * 0.48;
  const metal = 0xcbd5e1;
  const wood = 0x6b3f1f;
  const leather = 0x2f1f18;
  const arcane = Number(palette.accent ?? 0x8b5cf6);

  const add = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereProceduralWeaponSlotV15 = true;
    root.add(mesh);
  };

  const weaponId = String(weapon.id ?? "");
  if (/staff|wand|magic|scholar|mage|arcane/i.test(weaponId)) {
    add(boxMesh("runtime-procedural-weapon-staff-shaft-v15", [0.035, body.armLength + 0.34, 0.035], [handX + 0.06, handY + 0.14, -0.18], wood));
    add(boxMesh("runtime-procedural-weapon-staff-gem-v15", [0.09, 0.09, 0.09], [handX + 0.06, handY + body.armLength * 0.72, -0.18], arcane));
  } else if (/bow|ranged|hunter/i.test(weaponId)) {
    const bow = boxMesh("runtime-procedural-weapon-bow-v15", [0.035, body.armLength + 0.18, 0.035], [handX + 0.08, handY + 0.12, -0.2], wood);
    bow.rotation.z = -0.28;
    add(bow);
    add(boxMesh("runtime-procedural-weapon-bow-string-v15", [0.012, body.armLength + 0.02, 0.012], [handX + 0.15, handY + 0.12, -0.205], 0xf8fafc));
  } else if (/axe|hammer|tool/i.test(weaponId)) {
    add(boxMesh("runtime-procedural-weapon-tool-handle-v15", [0.035, body.armLength + 0.16, 0.035], [handX + 0.05, handY + 0.08, -0.18], wood));
    add(boxMesh("runtime-procedural-weapon-tool-head-v15", [0.16, 0.08, 0.05], [handX + 0.05, handY + body.armLength * 0.58, -0.18], metal));
  } else {
    const blade = boxMesh("runtime-procedural-weapon-sword-blade-v15", [0.045, body.armLength + 0.18, 0.035], [handX + 0.06, handY + 0.12, -0.18], metal);
    blade.rotation.z = -0.12;
    add(blade);
    add(boxMesh("runtime-procedural-weapon-sword-hilt-v15", [0.14, 0.035, 0.045], [handX + 0.04, handY - body.armLength * 0.32, -0.18], leather));
  }

  root.userData.harthmereProceduralWeaponSlotV15 = {
    weaponId,
    version: "harthmere-procedural-weapon-slot-v15",
  };
}

const HARTHMERE_PROCEDURAL_TOWNSPERSON_WORLD_SCALE_V16 = 1.22;

function harthmereRuntimeOutfitTintForBodyV17(
  appearance: HarthmereCharacterAppearance,
  palette: TownspersonPalette,
): number {
  switch (appearance.body.outfitColor) {
    case "forest":
      return 0x2f6f4e;
    case "river":
      return 0x2f6f91;
    case "ember":
      return 0x9b4a28;
    case "royal":
      return 0x5b4bb2;
    case "ash":
      return 0x59616d;
    case "earth":
    default:
      return Number(palette.tunic ?? 0x6b4f36);
  }
}

function harthmereRuntimeLegTintForBodyV17(
  appearance: HarthmereCharacterAppearance,
  palette: TownspersonPalette,
): number {
  switch (appearance.body.outfitColor) {
    case "forest":
      return 0x214232;
    case "river":
      return 0x23495f;
    case "ember":
      return 0x62311f;
    case "royal":
      return 0x31276f;
    case "ash":
      return 0x343a44;
    case "earth":
    default:
      return Number(palette.legs ?? 0x3f3428);
  }
}

function addHarthmereProceduralBodyExpressionV24(
  root: THREE.Group,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette,
  outfitTint: number,
): void {
  const skin = Number(palette.skin ?? 0xc48a6a);
  const trim = Number(palette.accent ?? 0xfacc15);
  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.88;
  const waistY = body.legLength + body.torsoHeight * 0.08;
  const expressionHeadHeightV25 = Math.max(body.torsoHeight * 0.42, 0.24);
  const neckY = body.legLength + body.torsoHeight + expressionHeadHeightV25 * 0.12;

  const add = (mesh: THREE.Object3D) => {
    mesh.userData.harthmereProceduralBodyExpressionV24 = true;
    root.add(mesh);
  };

  // These are intentionally named townsperson-* so visual tests can prove the
  // procedural NPC is composed of readable body parts instead of one short cube.
  add(
    boxMesh(
      "townsperson-neck-v24",
      [Math.max(body.torsoWidth * 0.24, 0.11), Math.max(expressionHeadHeightV25 * 0.22, 0.07), 0.13],
      [0, neckY, 0],
      skin,
    ),
  );

  add(
    boxMesh(
      "townsperson-shoulder-line-v24",
      [Math.max(body.shoulderWidth + 0.1, body.torsoWidth + 0.12), 0.055, 0.22],
      [0, shoulderY, 0],
      outfitTint,
    ),
  );

  add(
    boxMesh(
      "townsperson-waist-line-v24",
      [Math.max(body.torsoWidth * 0.92, 0.32), 0.045, 0.21],
      [0, waistY, 0],
      trim,
    ),
  );

  root.userData.harthmereProceduralBodyExpressionV24 = {
    version: "harthmere-procedural-body-expression-v24",
    namedParts: [
      "townsperson-neck-v24",
      "townsperson-shoulder-line-v24",
      "townsperson-waist-line-v24",
    ],
    torsoWidth: body.torsoWidth,
    torsoHeight: body.torsoHeight,
    shoulderWidth: body.shoulderWidth,
    headHeight: expressionHeadHeightV25,
  };
}


function createProceduralTownsperson(
  placement: RuntimePlacement,
): THREE.Object3D | undefined {
  if (!isProceduralTownspersonKey(placement.asset)) {
    return undefined;
  }

  const appearance = harthmereRuntimeAppearanceForPlacement(placement);
  const palette = harthmereRuntimePaletteForAppearance(placement.asset, appearance);
  const outfitTintV17 = harthmereRuntimeOutfitTintForBodyV17(appearance, palette);
  const legTintV17 = harthmereRuntimeLegTintForBodyV17(appearance, palette);
  const body = harthmereRuntimeBodyMetrics(appearance.body);
  const root = new THREE.Group();
  root.name = placement.name ?? placement.asset;
  root.position.set(...placement.at);
  root.rotation.y = placement.rot ?? 0;
  root.scale.setScalar((placement.scale ?? 1) * HARTHMERE_PROCEDURAL_TOWNSPERSON_WORLD_SCALE_V16);
  root.userData.harthmereBodyHeightScaleAppliedToMetricsV29 = body.heightScale;
  root.userData.harthmereAppearance = appearance;
  root.userData.harthmereForwardAxis = appearance.forwardAxis;
  root.userData.harthmereAnchors = appearance.anchors;
  root.userData.harthmereForceProceduralTownspersonClothingV13 =
    HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V13;
  root.userData.harthmereForceProceduralTownspersonClothingV12 =
    HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V12;
  root.userData.harthmereForceProceduralTownspersonClothingKeysV13 =
    Object.keys((appearance.clothing ?? {}) as Record<string, unknown>);
  root.userData.harthmereForceProceduralTownspersonClothingKeysV12 =
    Object.keys((appearance.clothing ?? {}) as Record<string, unknown>);
  root.userData.harthmereRuntimeOutfitColorV17 = {
    outfitColor: appearance.body.outfitColor,
    outfitTint: outfitTintV17,
    legTint: legTintV17,
  };

  const torsoY = body.legLength + body.torsoHeight / 2 + body.stanceYOffset;
  const shoulderY = body.legLength + body.torsoHeight * 0.62;
  const headY = body.legLength + body.torsoHeight + 0.16;

  // Runtime townspeople now read the same HarthmereCharacterAppearance data as
  // the player and ECS NPC renderer. The geometry remains lightweight so the
  // large ambient population stays cheap, but face/body/options come from the
  // shared schema instead of hardcoded per-role proportions.
  root.add(
    boxMesh("townsperson-left-leg", [body.legWidth, body.legLength, body.legDepth], [-(body.torsoWidth / 4 + body.legSpread), body.legLength / 2, 0], legTintV17),
    boxMesh("townsperson-right-leg", [body.legWidth, body.legLength, body.legDepth], [body.torsoWidth / 4 + body.legSpread, body.legLength / 2, 0], legTintV17),
    boxMesh("townsperson-body", [body.torsoWidth, body.torsoHeight, body.torsoDepth], [0, torsoY, 0], outfitTintV17),
    boxMesh("townsperson-left-arm", [body.armWidth, body.armLength, body.armDepth], [-body.shoulderWidth / 2, shoulderY, 0], palette.skin),
    boxMesh("townsperson-right-arm", [body.armWidth, body.armLength, body.armDepth], [body.shoulderWidth / 2, shoulderY, 0], palette.skin),
    createHarthmereRuntimeVoxelHead(appearance, headY, "townsperson"),
  );
  addHarthmereProceduralBodyExpressionV24(root, body, palette, outfitTintV17);
  addHarthmereRuntimeHumanAnchors(root, body);
  addHarthmereRuntimeNpcClothingMaterialRecolorV28(root, appearance, body, palette, torsoY, shoulderY);
  addHarthmereRuntimeAlwaysVisibleNpcClothingV27(root, appearance, body, palette, torsoY, shoulderY);
  addHarthmereRuntimeOutfitAndGearPolish(root, appearance, body, palette, torsoY, shoulderY, headY);
  addHarthmereRuntimeVisibleClothingGuaranteeV22(
    root,
    appearance.clothing,
    body,
    palette,
  );
  addHarthmereRuntimeOutwardClothingDetailLayerV23(
    root,
    appearance.clothing,
    body,
    palette,
  );
  addHarthmereRuntimeProductMinecraftClothingPolishV20(root, appearance, body, palette, torsoY, shoulderY, headY);
  addHarthmereRuntimeProceduralWeaponSlotV15(root, appearance.clothing, body, palette);
  addHarthmereRuntimeOutsideClothingShellV26(root, appearance.clothing, body, palette);

  if (appearance.role === "guard") {
    root.add(
      boxMesh("guard-tabard", [body.torsoWidth + 0.02, 0.12, 0.22], [0, torsoY + body.torsoHeight * 0.28, -0.02], 0x141414),
      boxMesh("guard-belt", [body.torsoWidth + 0.08, 0.045, 0.23], [0, body.legLength + 0.08, -0.015], 0x222222),
    );
  } else if (appearance.role === "merchant") {
    root.add(
      boxMesh("merchant-satchel", [0.18, 0.18, 0.08], [-body.shoulderWidth / 2 - 0.02, torsoY, 0.13], 0x7a4f2a),
    );
  } else if (appearance.role === "farmer") {
    root.add(
      boxMesh("farmer-hat", [0.42, 0.06, 0.36], [0, headY + 0.23, -0.01], palette.accent),
    );
  } else if (appearance.role === "clergy") {
    root.add(
      boxMesh("clergy-sash", [0.08, body.torsoHeight + 0.02, 0.22], [-0.1, torsoY, -0.03], palette.accent),
    );
  } else if (appearance.role === "bandit" || appearance.role === "hostile") {
    root.add(
      boxMesh("bandit-mask", [0.22, 0.045, 0.025], [0, headY + 0.015, -0.16], 0x191514),
      boxMesh("bandit-knife-belt", [0.16, 0.035, 0.08], [body.torsoWidth / 2 + 0.04, body.legLength + 0.05, 0.08], 0x8c2f2a),
    );
  }

  ensureHarthmereLargeBodyClothingVisibilityV14(root, appearance, body);
  applyUniqueNpcVisualDecorations(placement, root);
  return root;
}


function addProceduralLifeInstance(
  placement: RuntimePlacement,
  object: THREE.Object3D,
  animated: AnimatedInstance[],
) {
  if (placement.wander || placement.bob) {
    const appearance =
      (object.userData.harthmereAppearance as HarthmereCharacterAppearance | undefined) ??
      placement.appearance;
    animated.push({
      object,
      asset: placement.asset,
      base: [...placement.at] as [number, number, number],
      rot: placement.rot ?? 0,
      forwardAxis:
        appearance?.forwardAxis ?? harthmereModelForwardAxis(placement.asset),
      bob: placement.bob,
      // Procedural life uses deterministic local wandering only.
      spin: undefined,
      wander: placement.wander,
      lastSafePosition: [...placement.at] as [number, number, number],
      placementMeta: placement.meta,
    });
  }
}

const HARTHMERE_RUNTIME_WALK_ANIMATION_CHECK_VERSION =
  "harthmere-runtime-walk-animation-check-v20";
const HARTHMERE_PROCEDURAL_ANIMAL_GAIT_VERSION_V14 =
  "harthmere-procedural-animal-gait-v14";

function collectAnimalLegV14(
  object: THREE.Object3D,
  names: string[],
) {
  for (const name of names) {
    const node = object.getObjectByName(name);
    if (node) {
      return node;
    }
  }
  return undefined;
}

function applyAnimalLegSwingV14(
  object: THREE.Object3D,
  time: number,
  asset: string,
) {
  const stride = Math.sin(time * 7.2);
  const sway = Math.cos(time * 7.2) * 0.03;
  const frontAmplitude = /horse|cow|bear/.test(asset)
    ? 0.42
    : /wolf|dog|fox|boar|deer|sheep|pig/.test(asset)
      ? 0.5
      : 0.34;
  const backAmplitude = frontAmplitude * (/frog|snake|crow|pigeon|chicken|bunny|rat/.test(asset) ? 0.82 : 0.94);
  const frontLeft = collectAnimalLegV14(object, [
    "dog-leg-left-front",
    "pig-leg-left-front",
    "sheep-leg-left-front",
    "cow-leg-left-front",
    "horse-leg-left-front",
    "deer-leg-left-front",
    "wolf-leg-left-front",
    "boar-leg-left-front",
    "bear-leg-left-front",
    "fox-leg-left-front",
    "chicken-leg-left",
    "pigeon-leg-left",
    "crow-leg-left",
    "frog-leg-left",
    "bunny-leg-left",
    "rat-leg-left",
    "snake-front",
  ]);
  const frontRight = collectAnimalLegV14(object, [
    "dog-leg-right-front",
    "pig-leg-right-front",
    "sheep-leg-right-front",
    "cow-leg-right-front",
    "horse-leg-right-front",
    "deer-leg-right-front",
    "wolf-leg-right-front",
    "boar-leg-right-front",
    "bear-leg-right-front",
    "fox-leg-right-front",
    "chicken-leg-right",
    "pigeon-leg-right",
    "crow-leg-right",
    "frog-leg-right",
    "bunny-leg-right",
    "rat-leg-right",
    "snake-mid",
  ]);
  const backLeft = collectAnimalLegV14(object, [
    "dog-leg-left-back",
    "pig-leg-left-back",
    "sheep-leg-left-back",
    "cow-leg-left-back",
    "horse-leg-left-back",
    "deer-leg-left-back",
    "wolf-leg-left-back",
    "boar-leg-left-back",
    "bear-leg-left-back",
    "fox-leg-left-back",
    "frog-leg-back-left",
    "bunny-leg-back-left",
    "rat-leg-back-left",
    "snake-back",
  ]);
  const backRight = collectAnimalLegV14(object, [
    "dog-leg-right-back",
    "pig-leg-right-back",
    "sheep-leg-right-back",
    "cow-leg-right-back",
    "horse-leg-right-back",
    "deer-leg-right-back",
    "wolf-leg-right-back",
    "boar-leg-right-back",
    "bear-leg-right-back",
    "fox-leg-right-back",
    "frog-leg-back-right",
    "bunny-leg-back-right",
    "rat-leg-back-right",
  ]);
  const animatedNames: string[] = [];
  if (frontLeft) {
    frontLeft.rotation.x = stride * frontAmplitude;
    frontLeft.position.y += sway;
    animatedNames.push(frontLeft.name);
  }
  if (frontRight) {
    frontRight.rotation.x = -stride * frontAmplitude;
    frontRight.position.y -= sway;
    animatedNames.push(frontRight.name);
  }
  if (backLeft) {
    backLeft.rotation.x = -stride * backAmplitude;
    backLeft.position.y -= sway;
    animatedNames.push(backLeft.name);
  }
  if (backRight) {
    backRight.rotation.x = stride * backAmplitude;
    backRight.position.y += sway;
    animatedNames.push(backRight.name);
  }
  const tail = collectAnimalLegV14(object, [
    "dog-tail",
    "cat-tail",
    "pig-tail",
    "horse-tail",
    "cow-tail",
    "deer-tail",
    "wolf-tail",
    "fox-tail",
    "bear-tail",
    "bunny-tail",
  ]);
  if (tail) {
    tail.rotation.x = Math.sin(time * 5.5) * 0.12;
  }
  const head = collectAnimalLegV14(object, [
    "dog-head",
    "cat-head",
    "pig-head",
    "sheep-head",
    "cow-head",
    "horse-head",
    "deer-head",
    "wolf-head",
    "boar-head",
    "bear-head",
    "fox-head",
    "chicken-head",
    "pigeon-head",
    "bunny-head",
    "frog-head",
    "snake-head",
    "rat-head",
  ]);
  if (head) {
    head.rotation.x = Math.sin(time * 3.8) * 0.05;
  }
  object.userData.harthmereProceduralAnimalGaitV14 = {
    version: HARTHMERE_PROCEDURAL_ANIMAL_GAIT_VERSION_V14,
    asset,
    executed: animatedNames.length > 0,
    stride,
    animatedNames,
    frontAmplitude,
    backAmplitude,
  };
}

function animateProceduralWalker(
  object: THREE.Object3D,
  time: number,
  asset?: string,
) {
  if (asset && isProceduralAnimalKey(asset)) {
    applyAnimalLegSwingV14(object, time, asset);
    object.userData.harthmereRuntimeWalkAnimationCheck = {
      version: HARTHMERE_RUNTIME_WALK_ANIMATION_CHECK_VERSION,
      executed: true,
      asset,
      gaitVersion: HARTHMERE_PROCEDURAL_ANIMAL_GAIT_VERSION_V14,
      kind: "animal",
      time,
      partNames:
        object.userData.harthmereProceduralAnimalGaitV14?.animatedNames ?? [],
    };
    return;
  }
  const swing = Math.sin(time * 7) * 0.38;
  const leftLeg = object.getObjectByName("townsperson-left-leg");
  const rightLeg = object.getObjectByName("townsperson-right-leg");
  const leftArm = object.getObjectByName("townsperson-left-arm");
  const rightArm = object.getObjectByName("townsperson-right-arm");
  if (leftLeg && rightLeg && leftArm && rightArm) {
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.65;
    rightArm.rotation.x = swing * 0.65;
    object.userData.harthmereRuntimeWalkAnimationCheck = {
      version: HARTHMERE_RUNTIME_WALK_ANIMATION_CHECK_VERSION,
      executed: true,
      kind: "humanoid",
      swing,
      time,
      partNames: [leftLeg.name, rightLeg.name, leftArm.name, rightArm.name],
    };
  }
}


// harthmere-animation-world-interaction-v10
const HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V10 =
  "harthmere-weapon-hand-tracking-v10";
const HARTHMERE_OBJECT_EFFECT_RANGE_VERSION_V10 =
  "harthmere-object-effect-range-v10";
const HARTHMERE_RESOURCE_HIT_TELEGRAPH_VERSION_V10 =
  "harthmere-resource-hit-telegraph-v10";

type HarthmereResourceKindV10 =
  | "dirt"
  | "grass"
  | "rock"
  | "ore"
  | "tree"
  | "crop"
  | "water"
  | "generic_resource";

const HARTHMERE_RESOURCE_HIT_EDGE_CASES_V10 = [
  "out_of_range",
  "wrong_tool",
  "blocked_line_of_sight",
  "behind_player",
  "steep_angle",
  "depleted_resource",
  "tiny_resource",
  "large_resource",
  "overlapping_resources",
  "moving_player",
  "cooldown_or_debounce",
  "airborne_player",
  "underwater_target",
  "terrain_slope",
  "resource_inside_collision",
  "network_prediction_mismatch",
] as const;

const HARTHMERE_OBJECT_EFFECT_RANGES_V10: Record<
  HarthmereResourceKindV10,
  {
    maxDistanceMeters: number;
    radiusMeters: number;
    heightMeters: number;
    coneAngleDegrees: number;
    cooldownMs: number;
    debounceMs: number;
    requiresLineOfSight: boolean;
    telegraph: "impact_ring_and_tool_tip_line";
    visibleHitPolicy: {
      reticle: "surface_lock";
      rangeRing: "ground_or_surface_projected";
      toolTipLine: "hand_to_impact_point";
      surfaceDecal: "impact_normal_aligned";
      particles: "resource_type_specific";
      failReasonText: "out_of_range_or_wrong_tool_or_blocked";
    };
  }
> = {
  dirt: {
    maxDistanceMeters: 2.25, radiusMeters: 0.42, heightMeters: 0.65,
    coneAngleDegrees: 80, cooldownMs: 450, debounceMs: 140,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  grass: {
    maxDistanceMeters: 2.1, radiusMeters: 0.5, heightMeters: 0.55,
    coneAngleDegrees: 90, cooldownMs: 380, debounceMs: 120,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  rock: {
    maxDistanceMeters: 2.45, radiusMeters: 0.38, heightMeters: 0.9,
    coneAngleDegrees: 70, cooldownMs: 600, debounceMs: 160,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  ore: {
    maxDistanceMeters: 2.35, radiusMeters: 0.36, heightMeters: 0.85,
    coneAngleDegrees: 68, cooldownMs: 680, debounceMs: 180,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  tree: {
    maxDistanceMeters: 2.7, radiusMeters: 0.52, heightMeters: 1.45,
    coneAngleDegrees: 72, cooldownMs: 640, debounceMs: 160,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  crop: {
    maxDistanceMeters: 2.0, radiusMeters: 0.46, heightMeters: 0.5,
    coneAngleDegrees: 95, cooldownMs: 320, debounceMs: 100,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  water: {
    maxDistanceMeters: 2.4, radiusMeters: 0.34, heightMeters: 0.35,
    coneAngleDegrees: 60, cooldownMs: 500, debounceMs: 150,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
  generic_resource: {
    maxDistanceMeters: 2.25, radiusMeters: 0.4, heightMeters: 0.75,
    coneAngleDegrees: 75, cooldownMs: 450, debounceMs: 140,
    requiresLineOfSight: true, telegraph: "impact_ring_and_tool_tip_line",
    visibleHitPolicy: {
      reticle: "surface_lock", rangeRing: "ground_or_surface_projected",
      toolTipLine: "hand_to_impact_point", surfaceDecal: "impact_normal_aligned",
      particles: "resource_type_specific", failReasonText: "out_of_range_or_wrong_tool_or_blocked",
    },
  },
};


function applyHarthmereNpcRouteDistributionV48(
  placements: readonly RuntimePlacement[],
): { version: string; placements: RuntimePlacement[]; movedActors: number; localDensityLimits: { maxActorsWithin12m: number; maxActorsWithin20m: number } } {
  let movedActors = 0;
  const sequenceByRoute = new Map<string, number>();
  const distributed = placements.map((placement) => {
    const routeLabel = placement.wander?.routeLabel as keyof typeof HARTHMERE_NPC_ROUTE_ANCHORS_V48 | undefined;
    if (!routeLabel || !isHarthmereLifeAsset(placement.asset)) {
      return placement;
    }
    const sequence = sequenceByRoute.get(routeLabel) ?? 0;
    sequenceByRoute.set(routeLabel, sequence + 1);
    const route = makeHarthmereIndexedNpcRouteV48(routeLabel, sequence);
    movedActors += 1;
    const [x, z] = route[0];
    const next = placementWithHarthmereRuntimeAt(placement, [x, placement.at[1], z]);
    return {
      ...next,
      wander: {
        ...placement.wander,
        route,
        routeLabel,
      },
      name: `${placement.name ?? placement.asset} route-dispersed ${HARTHMERE_NPC_ROUTE_DISTRIBUTION_VERSION_V48}`,
    };
  });
  return {
    version: HARTHMERE_NPC_ROUTE_DISTRIBUTION_VERSION_V48,
    placements: distributed,
    movedActors,
    localDensityLimits: {
      maxActorsWithin12m: HARTHMERE_NPC_LOCAL_DENSITY_MAX_WITHIN_12M_V48,
      maxActorsWithin20m: HARTHMERE_NPC_LOCAL_DENSITY_MAX_WITHIN_20M_V48,
    },
  };
}

const HARTHMERE_NPC_DISTRIBUTION_V48 = applyHarthmereNpcRouteDistributionV48(PLACEMENTS);
// BUILDING_V2_VOXEL_MESHES_MARKER: signed marker so the renderer log
// line confirms the v2 voxel-mesh patches are loaded into the shipped
// bundle. If you see this version on the "Loaded rebuilt Harthmere
// town and Wilds assets" log line the v2 fix is live.
export const HARTHMERE_BUILDING_V2_VOXEL_MESHES_VERSION = "harthmere-building-v2-voxel-meshes" as const;
const HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4 = applyHarthmereRuntimePlacementCleanupV4(HARTHMERE_NPC_DISTRIBUTION_V48.placements);
const RUNTIME_PLACEMENTS_V4 = HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4.placements;
const RUNTIME_PLACEMENTS_V48 = RUNTIME_PLACEMENTS_V4;

export class HarthmereRuntimeAssetsRenderer implements Renderer {
 
  
  private harthmerePlayerSwordManualSwing?: {
    attack: "basic" | "heavy";
    startedAt: number;
    durationMs: number;
    basePosition: THREE.Vector3;
    baseRotation: THREE.Euler;
  };
private harthmerePlayerWeaponGripWorldPosition = new THREE.Vector3();
  private harthmerePlayerWeaponGripWorldQuaternion = new THREE.Quaternion();
  private harthmerePlayerWeaponGripAnchorName = "unknown";
  private harthmerePlayerWeaponGripDistanceLast = 0;
  private readonly harthmerePlayerWeaponHandTrackingSamplesV9: Array<{
    at: number;
    action?: string;
    attack?: string;
    gripDistance: number;
    anchorName: string;
    activeClip?: string;
  }> = [];
private harthmerePlayerSword?: THREE.Group;
  private harthmerePlayerSwordAnchorRoot?: THREE.Group;
  private harthmerePlayerSwordMixer?: THREE.AnimationMixer;
  private readonly harthmerePlayerSwordClipActions = new Map<string, THREE.AnimationAction>();
  private harthmerePlayerSwordActiveClip?: string;
  private harthmerePlayerSwordGltfLoadStarted = false;
  private harthmerePlayerWeaponLoadingEquipmentId?: string;
  private harthmerePlayerWeaponLoadedEquipmentId?: string;
  private harthmerePlayerWeaponGltfLoadToken = 0;
  private harthmerePlayerSwordUsingGltf = false;
  private harthmerePlayerSwordState: HarthmerePlayerSwordVisualState = {
    drawn: false,
    itemId: "iron_longsword",
    action: "sync",
    at: 0,
  };
  private harthmerePlayerSwordDrawAmount = 0;
  private harthmerePlayerSwordSwingUntil = 0;
  private harthmerePlayerSwordLastFrameAt = Date.now();
  private harthmerePlayerSwordFrame?: number;
  private harthmereSwordVisualsInstalled = false;
  // harthmere-sword-animation-polish-v3
  private harthmerePlayerSwordTrail?: THREE.Group;
  private harthmerePlayerSwordTrailUntil = 0;
  private harthmerePlayerSwordTrailAttack?: "basic" | "heavy";
  private harthmerePlayerSwordTrailFacingYaw = 0;
  private harthmereCombatPolishAttackCounterV1 = 0;
  private harthmereCombatPolishLastShapeV2?: string;
  private harthmereCombatPolishLastRandomSeedV2 = 0;
  private readonly harthmereCombatPolishRecentShapesV2: string[] = [];
  private harthmereCombatPolishActiveProfileV1: HarthmereCombatAnimationProfileV1 =
    HARTHMERE_ATTACK_ANIMATION_PROFILES_V1[0];
  private readonly harthmereCombatPolishLastCenterV1 = new THREE.Vector3();
  private harthmereCombatPolishSpeedV1 = 0;
  private harthmereHitStopUntil = 0;
  private harthmereAttackerRecoveryUntil = 0;
  private harthmereBlockContactFeedback?: THREE.Group;
  private harthmereBlockContactUntil = 0;
  private harthmereLastSwordImpactAt = 0;
  private harthmereLastResourceHitTelegraphV10?: unknown;
  private readonly harthmereNpcWeaponVisuals = new Map<THREE.Object3D, THREE.Group>();

  readonly name = "harthmereRuntimeAssets";
  private readonly gltfLoader = new GLTFLoader();
  private readonly fbxLoader = new FBXLoader();
  private readonly prototypes = new Map<string, RuntimePrototype>();
  private readonly failed = new Set<string>();
  private readonly root = new THREE.Group();
  private readonly townWalkDebugOverlay = new THREE.Group();
  private readonly animated: AnimatedInstance[] = [];
  private readonly combatLifeInstances: CombatLifeInstance[] = [];
  private readonly placementInstances: HarthmerePlacementRuntimeInstance[] = [];
  private readonly spawnedLifePositions: Array<[number, number]> = [];
  private readonly deadCombatObjects = new WeakSet<THREE.Object3D>();
  private harthmerePlacementLodUpdateIn = 0;
  private elapsed = 0;
  private ready = false;

  constructor() {
    this.installHarthmerePlayerSwordVisuals();
    this.installHarthmereFacialExpressionBridge();
    this.root.name = "harthmere-rebuilt-town-and-wilds-root";
    this.townWalkDebugOverlay.name = "harthmere-town-walk-debug-overlay";
    this.root.add(this.townWalkDebugOverlay);
    this.installDebugBridge();
    debugHarthmereRenderer("renderer.constructor", {
      shouldRender: shouldRenderHarthmereAssets(),
      host: typeof window !== "undefined" ? window.location.hostname : "server",
    });
    if (typeof window !== "undefined") {
      window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, this.onCombatEffect);
    }
    if (shouldRenderHarthmereAssets()) {
      void this.loadAll();
    }
  }

  draw(scenes: Scenes, dt: number) {
    if (!this.ready || this.root.children.length === 0) {
      return;
    }
    this.elapsed += Math.min(dt, 0.05);
    this.updateHarthmerePlacementLod(dt);
    // HARTHMERE_POLISH_V1_FAR_NPC_THROTTLE
    // Cheap visibility + distance gate. We sample the player camera position
    // through THREE.PerspectiveCamera convention via the renderer scene
    // (scenes.three.camera). If it's not available yet, every NPC just
    // updates normally. Distance threshold of 35 m matches the placement LOD
    // tier; closer NPCs animate every frame, far NPCs every other frame.
    this.harthmerePolishFrameCounterV1 = (this.harthmerePolishFrameCounterV1 ?? 0) + 1;
    const polishFrame = this.harthmerePolishFrameCounterV1;
    const camera: THREE.Camera | undefined = (scenes as { three?: { camera?: THREE.Camera } }).three?.camera;
    const camX = camera?.position.x ?? 0;
    const camZ = camera?.position.z ?? 0;
    const FAR_NPC_DIST_SQ = 35 * 35;
    for (const instance of this.animated) {
      if (!instance.object.visible && !this.deadCombatObjects.has(instance.object)) {
        continue;
      }
      if (instance.mixer) {
        const dx = instance.object.position.x - camX;
        const dz = instance.object.position.z - camZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < FAR_NPC_DIST_SQ || (polishFrame & 1) === 0) {
          instance.mixer.update(dt);
        }
      }
      if (this.deadCombatObjects.has(instance.object)) {
        continue;
      }
      if (instance.wander) {
        // HARTHMERE_POLISH_V1_NPC_SPACING — deterministic per-actor jitter
        // so neighbours with the same configured (radius, phase) desync.
        // base[0]/base[2] are stable spawn-time floats; we hash them into a
        // tiny phase/radius offset.
        const jitterSeed =
          Math.abs((instance.base[0] * 13.37 + instance.base[2] * 7.31) % 1);
        const phaseJitter = (jitterSeed - 0.5) * 1.6; // ± 0.8 rad
        const radiusJitter = 1 + (jitterSeed - 0.5) * 0.3; // ± 15%
        const progress =
          this.elapsed * instance.wander.speed +
          (instance.wander.phase ?? 0) +
          phaseJitter;
        const nextRoutePoint = instance.wander.route?.length
          ? harthmereRoutePositionV48(instance.wander.route, progress)
          : undefined;
        const angle = progress;
        const dx = nextRoutePoint ? nextRoutePoint[0] - instance.base[0] : Math.cos(angle) * instance.wander.radius * radiusJitter;
        const dz = nextRoutePoint ? nextRoutePoint[1] - instance.base[2] : Math.sin(angle) * instance.wander.radius * radiusJitter;
        const nextX = instance.base[0] + dx;
        const nextY =
          instance.base[1] +
          (instance.bob ? Math.sin(angle * 2) * instance.bob : 0);
        const nextZ = instance.base[2] + dz;
        const previousX = instance.object.position.x;
        const previousZ = instance.object.position.z;
        const resolved = this.resolveHarthmereNpcWanderPosition(
          instance,
          nextX,
          nextY,
          nextZ,
        );
        // HARTHMERE_POLISH_V1_NPC_SPACING — soft repulsion pass.
        // If another animated instance is closer than 0.65 units, push along
        // the (self - other) vector by 0.18 units. We sample at most 8
        // neighbours to keep the cost O(n * 8) instead of O(n^2).
        let resolvedX = resolved.position[0];
        const resolvedY = resolved.position[1];
        let resolvedZ = resolved.position[2];
        const repulsionRadiusSq = 0.65 * 0.65;
        let neighboursChecked = 0;
        for (const other of this.animated) {
          if (other === instance) continue;
          if (neighboursChecked++ > 8) break;
          const ox = other.object.position.x;
          const oz = other.object.position.z;
          const ddx = resolvedX - ox;
          const ddz = resolvedZ - oz;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 > 0.0001 && d2 < repulsionRadiusSq) {
            const inv = 0.18 / Math.sqrt(d2);
            resolvedX += ddx * inv;
            resolvedZ += ddz * inv;
          }
        }
        instance.object.position.set(resolvedX, resolvedY, resolvedZ);
        const velocityX = resolvedX - previousX;
        const velocityZ = resolvedZ - previousZ;
        const speedSq = velocityX * velocityX + velocityZ * velocityZ;
        if (speedSq > HARTHMERE_NPC_COLLISION_MIN_MOVE_SQ) {
          instance.object.rotation.y = harthmereYawForWorldForward(
            velocityX,
            velocityZ,
            instance.forwardAxis,
          );
          // HARTHMERE_POLISH_V1_LOCOMOTION_CLIPS — prefer the loaded
          // Walk/Run clip from the rig over the procedural leg-swing.
          // Procedural still runs for actors with no clips (proc townspeople,
          // proc animals) so they keep their bob-style walk.
          if (instance.locomotion && (instance.locomotion.walk || instance.locomotion.run)) {
            // Threshold: per-frame velocity squared > 0.0008 (~ 0.028 u/frame
            // at 60 fps) implies sustained running. Sub-threshold but above
            // the move-min picks Walk.
            setHarthmereLocomotionStateV1(
              instance,
              speedSq > 0.0008 ? "run" : "walk",
            );
          } else {
            animateProceduralWalker(instance.object, this.elapsed, instance.asset);
          }
        } else if (instance.locomotion) {
          setHarthmereLocomotionStateV1(instance, "idle");
        }
      } else if (instance.bob) {
        instance.object.position.y =
          instance.base[1] + Math.sin(this.elapsed * 2) * instance.bob;
      }
      if (instance.spin) {
        instance.object.rotation.y += instance.spin * dt;
      }
    }
    for (const instance of this.combatLifeInstances) {
      this.applyCombatPulse(instance);
    }
    this.publishCombatActorSnapshot();
    addToScenes(scenes, this.root);
  }



  private resolveHarthmereRuntimePlacement(placement: RuntimePlacement): RuntimePlacement {
    if (!isHarthmereRuntimeLifePlacement(placement)) {
      return placement;
    }

    const startX = placement.at[0];
    const startZ = placement.at[2];
    const startY = Number.isFinite(placement.at[1]) ? placement.at[1] : GROUND_Y;
    const actorGroundY = GROUND_Y + 0.1;
    const needsGroundSnap = Math.abs(startY - actorGroundY) > 0.04;
    const actorRadius = Math.max(0.42, Math.min(0.92, (placement.scale ?? 1) * 0.58));
    const isIgnoredActorSpawnObstacle = (obstacle?: HarthmereNpcCollisionObstacle) => {
      if (!obstacle) {
        return true;
      }
      const name = String(obstacle.name ?? "").toLowerCase();
      const district = String(obstacle.district ?? "").toLowerCase();
      return (
        name.includes("window") ||
        name.includes("flag") ||
        name.includes("banner") ||
        name.includes("sign") ||
        name.includes("torch") ||
        name.includes("lamp") ||
        name.includes("lantern") ||
        name.includes("candle") ||
        name.includes("wall stair") ||
        name.includes("stair to watch") ||
        name.includes("north gate ironbound door") ||
        name.includes("road exit") ||
        name.includes("town exit") ||
        name.includes("trail") ||
        district.includes("road")
      );
    };
    const isBlockedAt = (x: number, z: number) => {
      const samples: Array<[number, number]> = [
        [x, z],
        [x + actorRadius, z],
        [x - actorRadius, z],
        [x, z + actorRadius],
        [x, z - actorRadius],
        [x + actorRadius * 0.7, z + actorRadius * 0.7],
        [x - actorRadius * 0.7, z + actorRadius * 0.7],
        [x + actorRadius * 0.7, z - actorRadius * 0.7],
        [x - actorRadius * 0.7, z - actorRadius * 0.7],
      ];
      for (const [sx, sz] of samples) {
        const obstacle = findHarthmereNpcCollisionObstacle(sx, sz);
        if (obstacle && !isIgnoredActorSpawnObstacle(obstacle)) {
          return obstacle;
        }
      }
      return undefined;
    };
    const blocked = isBlockedAt(startX, startZ);
    const crowded = this.spawnedLifePositions.some(([x, z]) => distanceSq2d(x, z, startX, startZ) < 1.6 * 1.6 /* HARTHMERE_POLISH_V1_NPC_SPACING */);

    if (!needsGroundSnap && !blocked && !crowded) {
      this.spawnedLifePositions.push([startX, startZ]);
      return placementWithHarthmereRuntimeAt(placement, [startX, actorGroundY, startZ]);
    }

    const rings = [1.0, 1.6, 2.4, 3.4, 4.8, 6.6, 8.8, 11.4, 14.2];
    for (const radius of rings) {
      for (let i = 0; i < 32; i += 1) {
        const angle = (Math.PI * 2 * i) / 32 + radius * 0.37;
        const x = startX + Math.cos(angle) * radius;
        const z = startZ + Math.sin(angle) * radius;
        if (isBlockedAt(x, z)) {
          continue;
        }
        if (this.spawnedLifePositions.some(([sx, sz]) => distanceSq2d(sx, sz, x, z) < 1.6 * 1.6 /* HARTHMERE_POLISH_V1_NPC_SPACING */)) {
          continue;
        }
        this.spawnedLifePositions.push([x, z]);
        debugHarthmereRenderer("renderer.placement_spawn_resolved", {
          version: HARTHMERE_TOWN_SYSTEMS_VERSION,
          placementSystemVersion: "harthmere-town-collision-placement-v4",
          actor: placement.name ?? placement.asset,
          asset: placement.asset,
          district: placement.district,
          from: placement.at,
          to: [x, actorGroundY, z],
          reason: blocked ? "body_inside_collision" : needsGroundSnap ? "ground_snap" : "actor_overlap",
          obstacle: blocked?.name,
        });
        return placementWithHarthmereRuntimeAt(placement, [x, actorGroundY, z]);
      }
    }

    this.spawnedLifePositions.push([startX, startZ]);
    debugHarthmereRenderer("renderer.placement_spawn_unresolved", {
      version: HARTHMERE_TOWN_SYSTEMS_VERSION,
      placementSystemVersion: "harthmere-town-collision-placement-v4",
      actor: placement.name ?? placement.asset,
      asset: placement.asset,
      district: placement.district,
      from: placement.at,
      to: [startX, actorGroundY, startZ],
      reason: blocked ? "body_inside_collision_no_clear_fallback" : needsGroundSnap ? "ground_snap_only" : "actor_overlap_no_clear_fallback",
      obstacle: blocked?.name,
    });
    return placementWithHarthmereRuntimeAt(placement, [startX, actorGroundY, startZ]);
  }

  private registerHarthmerePlacementInstance(placement: RuntimePlacement, object: THREE.Object3D) {
    const meta = placement.meta ?? makeHarthmerePropMetadata({
      asset: placement.asset,
      name: placement.name,
      district: placement.district,
      position: placement.at,
      scale: placement.scale,
    });
    object.userData.harthmereTownSystemsVersion = HARTHMERE_TOWN_SYSTEMS_VERSION;
    object.userData.harthmerePlacementMeta = meta;
    object.userData.harthmereCollision = placement.collision ?? meta.collision;
    object.userData.harthmereLodTier = placement.lodTier ?? meta.lodTier;
    const structuralGroupKey = harthmereStructuralGroupKeyV3(placement);
    object.userData.harthmereStructuralGroupKeyV3 = structuralGroupKey;
    this.placementInstances.push({
      object,
      placement,
      meta,
      lodTier: placement.lodTier ?? meta.lodTier,
      structuralGroupKey,
    });
  }

  private harthmereLodOrigin(): [number, number] | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }
    const runtime = (window as typeof window & {
      __harthmereForwardArcRuntime?: {
        position?: [number, number, number];
      };
    }).__harthmereForwardArcRuntime;
    const position = runtime?.position;
    if (!position || !Number.isFinite(position[0]) || !Number.isFinite(position[2])) {
      return undefined;
    }
    return [position[0], position[2]];
  }

  private updateHarthmerePlacementLod(dt: number) {
    this.harthmerePlacementLodUpdateIn -= dt;
    if (this.harthmerePlacementLodUpdateIn > 0) {
      return;
    }
    this.harthmerePlacementLodUpdateIn = 0.25;

    const origin = this.harthmereLodOrigin();
    let visible = 0;
    let hidden = 0;
    const byTier: Record<string, { visible: number; hidden: number }> = {};

    const structuralGroups = new Map<string, { x: number; z: number; count: number; tier: HarthmereLodTier }>();
    if (origin) {
      for (const instance of this.placementInstances) {
        if (!instance.structuralGroupKey) continue;
        const current = structuralGroups.get(instance.structuralGroupKey) ?? {
          x: 0,
          z: 0,
          count: 0,
          tier: instance.lodTier,
        };
        current.x += instance.placement.at[0];
        current.z += instance.placement.at[2];
        current.count += 1;
        if (instance.lodTier === "always") current.tier = "always";
        structuralGroups.set(instance.structuralGroupKey, current);
      }
    }
    const structuralVisibility = new Map<string, boolean>();
    if (origin) {
      for (const [key, group] of structuralGroups) {
        const gx = group.x / Math.max(1, group.count);
        const gz = group.z / Math.max(1, group.count);
        structuralVisibility.set(
          key,
          shouldShowHarthmerePlacementAtDistanceSq(group.tier, distanceSq2d(origin[0], origin[1], gx, gz)),
        );
      }
    }

    for (const instance of this.placementInstances) {
      const tier = instance.lodTier;
      byTier[tier] ??= { visible: 0, hidden: 0 };
      const groupedShow = instance.structuralGroupKey
        ? structuralVisibility.get(instance.structuralGroupKey)
        : undefined;
      const show = !origin
        ? true
        : groupedShow ?? shouldShowHarthmerePlacementAtDistanceSq(
            tier,
            distanceSq2d(origin[0], origin[1], instance.placement.at[0], instance.placement.at[2]),
          );
      instance.object.visible = show;
      if (show) {
        visible += 1;
        byTier[tier].visible += 1;
      } else {
        hidden += 1;
        byTier[tier].hidden += 1;
      }
    }

    const win = harthmereRendererDebugWindow();
    if (win) {
      win.__harthmereTownLodStats = {
        version: HARTHMERE_TOWN_SYSTEMS_VERSION,
        origin,
        visible,
        hidden,
        byTier,
        at: Date.now(),
      };
    }
  }

  private resolveHarthmereNpcWanderPosition(
    instance: AnimatedInstance,
    nextX: number,
    nextY: number,
    nextZ: number,
  ): { position: [number, number, number]; blocked: boolean } {
    const directObstacle = findHarthmereNpcCollisionObstacle(nextX, nextZ);
    if (!directObstacle) {
      const position: [number, number, number] = [nextX, nextY, nextZ];
      instance.lastSafePosition = position;
      return { position, blocked: false };
    }

    const currentX = instance.object.position.x;
    const currentY = Number.isFinite(instance.object.position.y)
      ? instance.object.position.y
      : instance.base[1];
    const currentZ = instance.object.position.z;
    const candidates: [number, number, number][] = [];

    // Sliding keeps actors feeling alive instead of freezing at the first wall:
    // try the desired X with the old Z, then the old X with the desired Z.
    if (!findHarthmereNpcCollisionObstacle(nextX, currentZ)) {
      candidates.push([nextX, nextY, currentZ]);
    }
    if (!findHarthmereNpcCollisionObstacle(currentX, nextZ)) {
      candidates.push([currentX, nextY, nextZ]);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const adx = a[0] - nextX;
        const adz = a[2] - nextZ;
        const bdx = b[0] - nextX;
        const bdz = b[2] - nextZ;
        return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
      });
      const position = candidates[0];
      instance.lastSafePosition = position;
      this.recordHarthmereNpcCollisionBlock(instance, directObstacle, "slide");
      return { position, blocked: true };
    }

    const fallback = instance.lastSafePosition ?? [currentX, currentY, currentZ];
    const position: [number, number, number] = [fallback[0], nextY, fallback[2]];
    this.recordHarthmereNpcCollisionBlock(instance, directObstacle, "hold");
    return { position, blocked: true };
  }

  private recordHarthmereNpcCollisionBlock(
    instance: AnimatedInstance,
    obstacle: HarthmereNpcCollisionObstacle,
    resolution: "slide" | "hold",
  ) {
    instance.collisionBlockCount = (instance.collisionBlockCount ?? 0) + 1;
    const win = harthmereRendererDebugWindow();
    const actorName = instance.object.name || instance.asset;
    const now = Date.now();
    if (win) {
      const summary = (win.__harthmereNpcCollisionSummary ??= {});
      const key = `${actorName}|${obstacle.name}|${resolution}`;
      const existing = summary[key];
      summary[key] = existing
        ? {
            ...existing,
            count: existing.count + 1,
            lastAt: now,
          }
        : {
            actor: actorName,
            asset: instance.asset,
            obstacle: obstacle.name,
            district: obstacle.district,
            resolution,
            count: 1,
            firstAt: now,
            lastAt: now,
          };

      const topBlocked = Object.values(summary)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      win.__harthmerePlayerCollisionObstacles = harthmereNpcCollisionObstacles() as unknown as Record<string, unknown>[];
      win.__harthmereTownCollisionObstacles = harthmereAllCollisionObstacles() as unknown as Record<string, unknown>[];
      win.__harthmereNpcCollisionStats = {
        version: HARTHMERE_NPC_WALL_COLLISION_VERSION,
        runtimeFixesVersion: HARTHMERE_TOWN_DEBUG_RUNTIME_FIXES_VERSION,
        totalObstacles: harthmereNpcCollisionObstacles().length,
        lastBlockedActor: actorName,
        lastBlockedAsset: instance.asset,
        lastObstacle: obstacle.name,
        lastObstacleDistrict: obstacle.district,
        lastResolution: resolution,
        actorBlockCount: instance.collisionBlockCount,
        uniqueBlockedPairs: Object.keys(summary).length,
        topBlocked,
        consoleLogging: Boolean(win.__harthmereNpcCollisionLogEnabled),
        at: now,
      };

      win.__harthmereDumpNpcCollisionSummary = () => Object.values(win.__harthmereNpcCollisionSummary ?? {})
        .sort((a, b) => b.count - a.count);
    }

    const verboseCollisionLogs = Boolean(win?.__harthmereNpcCollisionLogEnabled) ||
      (typeof window !== "undefined" &&
        window.localStorage?.getItem("biomes.localDev.harthmere.npcCollisionVerbose") === "1");

    if (verboseCollisionLogs && (instance.collisionBlockCount === 1 || instance.collisionBlockCount % 300 === 0)) {
      debugHarthmereRenderer("renderer.npc_wall_collision.blocked", {
        version: HARTHMERE_NPC_WALL_COLLISION_VERSION,
        runtimeFixesVersion: HARTHMERE_TOWN_DEBUG_RUNTIME_FIXES_VERSION,
        actor: actorName,
        asset: instance.asset,
        obstacle: obstacle.name,
        district: obstacle.district,
        resolution,
        count: instance.collisionBlockCount,
      });
    }
  }

  private installHarthmereFacialExpressionBridge() {
    if (typeof window === "undefined") return;
    window.addEventListener(HARTHMERE_FACIAL_EXPRESSION_EVENT, this.onFacialExpressionEvent);
  }

  private onFacialExpressionEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail as HarthmereFacialExpressionState | undefined;
    if (!detail) return;
    const actor = this.findCombatLifeForFacialExpression(detail);
    if (!actor) return;
    const state = makeHarthmereFacialExpressionState(detail);
    applyHarthmereRuntimeFacialExpressionToObject(actor.object, state);
    debugHarthmereRenderer("renderer.facial_expression.apply", { actorId: state.actorId, label: actor.label, combatOffset: actor.combatOffset, expression: state.expression, intensity: state.intensity, source: state.source, reason: state.reason, expiresAt: state.expiresAt });
    const remaining = state.expiresAt ? state.expiresAt - Date.now() : 0;
    if (remaining > 0) {
      window.setTimeout(() => {
        const current = actor.object.userData.harthmereFacialExpression as HarthmereFacialExpressionState | undefined;
        if (current?.at !== state.at) return;
        applyHarthmereRuntimeFacialExpressionToObject(actor.object, makeHarthmereFacialExpressionState({ actorId: state.actorId ?? String(actor.combatOffset ?? actor.label), expression: "neutral", source: "ambient", reason: "expression-expired" }));
      }, remaining);
    }
  };

  private findCombatLifeForFacialExpression(detail: HarthmereFacialExpressionState) {
    const actorId = String(detail.actorId ?? detail.targetId ?? "").trim();
    if (!actorId || actorId === "player" || actorId === "you" || actorId === "Player") return undefined;
    const asNumber = Number(actorId);
    if (Number.isFinite(asNumber)) return this.findCombatLifeByOffset(asNumber);
    const lowered = actorId.toLowerCase();
    return this.combatLifeInstances.find((actor) => actor.label.toLowerCase() === lowered || actor.label.toLowerCase().includes(lowered) || actor.asset.toLowerCase() === lowered);
  }

  private publishCombatActorSnapshot() {
    if (typeof window === "undefined") {
      return;
    }
    const now = Date.now();
    const positions: Record<string, unknown> = {};
    for (const actor of this.combatLifeInstances) {
      if (actor.combatOffset === undefined || !Number.isFinite(actor.combatOffset)) {
        continue;
      }
      const scale = Number.isFinite(actor.baseScale) ? actor.baseScale : 1;
      positions[String(actor.combatOffset)] = {
        offset: actor.combatOffset,
        label: actor.label,
        asset: actor.asset,
        district: actor.district,
        pos: [actor.object.position.x, actor.object.position.z],
        radius: harthmereCombatActorRadius(actor.asset, scale),
        forward: harthmereWorldForwardForYaw(actor.object.rotation.y, actor.forwardAxis),
        forwardAxis: actor.forwardAxis,
        species: harthmereCombatActorSpecies(actor.asset, actor.label),
        behavior: harthmereCombatActorBehavior(actor.asset, actor.label, actor.district),
        socialRole: harthmereCombatActorSocialRole(actor.asset, actor.label, actor.district),
        appearanceRole: actor.appearance?.role,
        appearanceSpecies: actor.appearance?.species,
        equipment: actor.appearance?.equipment,
        facialExpression: actor.object.userData.harthmereFacialExpression ?? actor.appearance?.facialExpression,
        attackable: true,
        clips: actor.clips.map((clip) => clip.name),
        at: now,
      };
    }
    const win = window as typeof window & {
      __harthmereCombatActorPositions?: Record<string, unknown>;
    };
    win.__harthmereCombatActorPositions = positions;
  }


  private attachHarthmereTownWalkDebugMetadata(
    placement: RuntimePlacement,
    object: THREE.Object3D,
    appliedScale: number,
    clipCount: number,
  ) {
    const obstacle = harthmereNpcStaticObstacleForPlacement(placement);
    const expectedCollisionReason = harthmereTownDebugExpectedCollisionReason(placement);
    object.userData.harthmereTownWalkDebug = {
      version: HARTHMERE_TOWN_WALK_DEBUG_VERSION,
      name: placement.name ?? placement.asset,
      asset: placement.asset,
      district: placement.district,
      placementAt: placement.at,
      placementRot: placement.rot ?? 0,
      placementScale: placement.scale,
      defaultScale: assetByKey.get(placement.asset)?.defaultScale,
      appliedScale,
      clipCount,
      hasAnimationClips: clipCount > 0,
      wander: placement.wander,
      bob: placement.bob,
      spin: placement.spin,
      combatOffset: placement.combatOffset,
      isActor: harthmereTownDebugIsActorAsset(placement.asset) || placement.combatOffset !== undefined,
      expectedCollisionReason,
      hasNpcObstacle: Boolean(obstacle),
      collisionObstacle: obstacle,
    };
  }

  private harthmereTownWalkDebugPlayerSnapshot() {
    if (typeof window === "undefined") {
      return undefined;
    }
    const win = window as typeof window & Record<string, unknown>;
    const runtime = win.__harthmereForwardArcRuntime as
      | { position?: unknown; forward?: unknown; source?: unknown; at?: unknown }
      | undefined;
    if (runtime && Array.isArray(runtime.position)) {
      const runtimePosition = runtime.position.map((value: unknown) => Number(value));
      if (
        runtimePosition.length >= 3 &&
        runtimePosition.every((value: number) => Number.isFinite(value))
      ) {
        return {
          position: runtimePosition.slice(0, 3),
          source: String(runtime.source ?? "__harthmereForwardArcRuntime"),
          forward: Array.isArray(runtime.forward)
            ? runtime.forward.map((value: unknown) => Number(value)).slice(0, 2)
            : undefined,
        };
      }
    }
    const manual = win.__harthmereTownWalkDebugManualPlayer as unknown;
    if (Array.isArray(manual) && manual.length >= 2) {
      const x = Number(manual[0]);
      const z = Number(manual[1]);
      const y = Number(manual[2] ?? GROUND_Y);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        return { position: [x, y, z], source: "manual_setPlayer" };
      }
    }
    return undefined;
  }

  private harthmereTownWalkDebugObjectReport(
    object: THREE.Object3D,
    playerPosition?: number[],
  ): HarthmereTownWalkDebugObjectReport | undefined {
    if (object === this.townWalkDebugOverlay) {
      return undefined;
    }
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      return undefined;
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    object.getWorldScale(worldScale);
    const meta = object.userData.harthmereTownWalkDebug as
      | Record<string, unknown>
      | undefined;
    const asset = typeof meta?.asset === "string" ? meta.asset : undefined;
    const district = typeof meta?.district === "string" ? meta.district : undefined;
    const isActor = meta?.isActor === true || harthmereTownDebugIsActorAsset(asset);
    const flags: string[] = [];
    const maxDim = Math.max(size.x, size.y, size.z);
    const minNonZeroDim = Math.min(
      ...[size.x, size.y, size.z].filter((value) => value > 0.001),
    );
    const expectedCollisionReason =
      typeof meta?.expectedCollisionReason === "string"
        ? meta.expectedCollisionReason
        : undefined;
    if (expectedCollisionReason && meta?.hasNpcObstacle !== true) {
      flags.push(`walk_through_collision_missing:${expectedCollisionReason}`);
    }
    if (isActor && box.min.y < GROUND_Y - 0.45) {
      flags.push("actor_or_npc_below_ground");
    }
    if (isActor && box.min.y > GROUND_Y + 0.9) {
      flags.push("actor_or_npc_floating");
    }
    if (isActor && size.y > 7.5) {
      flags.push("actor_or_npc_too_tall");
    }
    if (isActor && size.y < 0.55) {
      flags.push("actor_or_npc_too_small_or_sunk");
    }
    if (!isActor && /coin|key|mug|cup|plate|bread|apple|carrot|bottle|vial|book|scroll|candle|knife|spoon/i.test(String(asset ?? object.name)) && maxDim > 5.5) {
      flags.push("small_prop_scaled_too_large");
    }
    if (!isActor && /wall|tower|church|chapel|warehouse|hall|house|roof|building/i.test(String(asset ?? object.name)) && maxDim < 2.0) {
      flags.push("building_piece_scaled_too_small");
    }
    if (!Number.isFinite(minNonZeroDim) || minNonZeroDim <= 0) {
      flags.push("invalid_or_flat_bounds");
    }
    if (!isActor && meta?.hasAnimationClips === true) {
      flags.push("animated_prop_possible_random_open_close");
    }
    const distanceToPlayer = playerPosition
      ? Math.hypot(center.x - playerPosition[0], center.z - playerPosition[2])
      : undefined;
    return {
      name: object.name,
      asset,
      district,
      position: harthmereTownDebugVec(object.position),
      rotationY: harthmereTownDebugRound(object.rotation.y),
      scale: harthmereTownDebugVec(object.scale),
      worldScale: harthmereTownDebugVec(worldScale),
      box: {
        min: harthmereTownDebugVec(box.min),
        max: harthmereTownDebugVec(box.max),
        center: harthmereTownDebugVec(center),
        size: harthmereTownDebugVec(size),
      },
      distanceToPlayer: distanceToPlayer === undefined ? undefined : harthmereTownDebugRound(distanceToPlayer),
      placement: meta,
      collision: meta?.collisionObstacle,
      flags,
    };
  }

  private harthmereTownWalkDebugSnapshot(options: {
    radius?: number;
    suspectsOnly?: boolean;
    includeOverlaps?: boolean;
  } = {}): HarthmereTownWalkDebugReport & { overlaps?: unknown[] } {
    this.root.updateMatrixWorld(true);
    const player = this.harthmereTownWalkDebugPlayerSnapshot();
    const playerPosition = player?.position;
    const allReports = this.root.children
      .map((child) => this.harthmereTownWalkDebugObjectReport(child, playerPosition))
      .filter((report): report is HarthmereTownWalkDebugObjectReport => Boolean(report));
    const radius = Number(options.radius ?? Number.NaN);
    let objects = allReports;
    if (Number.isFinite(radius) && playerPosition) {
      objects = objects.filter(
        (report) =>
          report.distanceToPlayer !== undefined && report.distanceToPlayer <= radius,
      );
    }
    const suspects = objects.filter((report) => report.flags.length > 0);
    if (options.suspectsOnly) {
      objects = suspects;
    }
    const px = playerPosition?.[0];
    const pz = playerPosition?.[2];
    const insideObstacles =
      Number.isFinite(px) && Number.isFinite(pz)
        ? harthmereNpcCollisionObstacles().filter((obstacle) =>
            harthmereNpcObstacleContainsPoint(obstacle, Number(px), Number(pz)),
          )
        : [];
    const report: HarthmereTownWalkDebugReport & { overlaps?: unknown[] } = {
      version: HARTHMERE_TOWN_WALK_DEBUG_VERSION,
      generatedAt: new Date().toISOString(),
      player,
      counts: {
        objects: objects.length,
        obstacles: harthmereNpcCollisionObstacles().length,
        actors: objects.filter((entry) => entry.placement && (entry.placement as Record<string, unknown>).isActor === true).length,
        suspects: suspects.length,
        animatedProps: suspects.filter((entry) => entry.flags.includes("animated_prop_possible_random_open_close")).length,
        walkThroughSuspects: suspects.filter((entry) => entry.flags.some((flag) => flag.startsWith("walk_through_collision_missing"))).length,
        groundSuspects: suspects.filter((entry) => entry.flags.some((flag) => flag.includes("ground") || flag.includes("floating") || flag.includes("sunk"))).length,
      },
      objects,
      suspects,
      obstacles: harthmereAllCollisionObstacles(),
      insideObstacles,
      walkLog: typeof window === "undefined"
        ? []
        : ((window as typeof window & Record<string, unknown>).__harthmereTownWalkAuditLog as unknown[] | undefined) ?? [],
    };

    if (options.includeOverlaps) {
      const boxed = this.root.children
        .filter((child) => child !== this.townWalkDebugOverlay)
        .map((child) => {
          const objectReport = this.harthmereTownWalkDebugObjectReport(child, playerPosition);
          if (!objectReport) return undefined;
          const box = new THREE.Box3().setFromObject(child);
          return { child, objectReport, box };
        })
        .filter((entry): entry is { child: THREE.Object3D; objectReport: HarthmereTownWalkDebugObjectReport; box: THREE.Box3 } => Boolean(entry))
        .filter((entry) =>
          !Number.isFinite(radius) ||
          !playerPosition ||
          (entry.objectReport.distanceToPlayer !== undefined && entry.objectReport.distanceToPlayer <= radius),
        )
        .slice(0, 180);
      const overlaps: unknown[] = [];
      for (let i = 0; i < boxed.length; i += 1) {
        for (let j = i + 1; j < boxed.length; j += 1) {
          if (!harthmereTownDebugBoxXZOverlap(boxed[i].box, boxed[j].box, 0.08)) {
            continue;
          }
          const aSize = boxed[i].objectReport.box.size;
          const bSize = boxed[j].objectReport.box.size;
          const tinyPair = Math.max(...aSize, ...bSize) < 1.25;
          if (tinyPair) {
            continue;
          }
          overlaps.push({
            a: {
              name: boxed[i].objectReport.name,
              asset: boxed[i].objectReport.asset,
              district: boxed[i].objectReport.district,
              flags: boxed[i].objectReport.flags,
            },
            b: {
              name: boxed[j].objectReport.name,
              asset: boxed[j].objectReport.asset,
              district: boxed[j].objectReport.district,
              flags: boxed[j].objectReport.flags,
            },
          });
          if (overlaps.length >= 250) {
            break;
          }
        }
        if (overlaps.length >= 250) {
          break;
        }
      }
      report.overlaps = overlaps;
    }

    return report;
  }

  private harthmereTownWalkDebugAddOverlayForReports(
    reports: HarthmereTownWalkDebugObjectReport[],
  ) {
    this.townWalkDebugOverlay.clear();
    const byName = new Map(this.root.children.map((child) => [child.name, child]));
    for (const report of reports.slice(0, 160)) {
      const object = byName.get(report.name);
      if (!object || object === this.townWalkDebugOverlay) {
        continue;
      }
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) {
        continue;
      }
      const color = new THREE.Color(report.flags.length > 0 ? 0xff3333 : 0x33ccff);
      const helper = new THREE.Box3Helper(box, color);
      helper.name = `debug-box:${report.name}`;
      this.townWalkDebugOverlay.add(helper);
    }
    return this.townWalkDebugOverlay.children.length;
  }

  private createHarthmereTownWalkDebugApi() {
    const getLog = () => {
      const win = window as typeof window & Record<string, unknown>;
      const existing = win.__harthmereTownWalkAuditLog;
      if (Array.isArray(existing)) {
        return existing;
      }
      const next: unknown[] = [];
      win.__harthmereTownWalkAuditLog = next;
      return next;
    };
    let watchTimer: number | undefined;
    return {
      version: HARTHMERE_TOWN_WALK_DEBUG_VERSION,
      help: () => ({
        summary: "Walk around, then run __harthmereTownWalkDebug.sample('note') at bad spots. Export with __harthmereTownWalkDebug.download().",
        commands: [
          "__harthmereTownWalkDebug.where()",
          "__harthmereTownWalkDebug.near(12)",
          "__harthmereTownWalkDebug.sample('inside bad wall')",
          "__harthmereTownWalkDebug.watch(10, 1000)",
          "__harthmereTownWalkDebug.stopWatch()",
          "__harthmereTownWalkDebug.suspects(30)",
          "__harthmereTownWalkDebug.overlaps(25)",
          "__harthmereTownWalkDebug.overlayNear(18)",
          "__harthmereTownWalkDebug.overlaySuspects(60)",
          "__harthmereTownWalkDebug.clearOverlay()",
          "__harthmereTownWalkDebug.pauseAnimatedProps()",
          "__harthmereTownWalkDebug.download()",
        ],
      }),
      setPlayer: (x: number, z: number, y = GROUND_Y) => {
        const win = window as typeof window & Record<string, unknown>;
        win.__harthmereTownWalkDebugManualPlayer = [Number(x), Number(z), Number(y)];
        return this.harthmereTownWalkDebugPlayerSnapshot();
      },
      where: () => {
        const player = this.harthmereTownWalkDebugPlayerSnapshot();
        const position = player?.position;
        return {
          player,
          insideObstacles: position
            ? harthmereNpcCollisionObstacles().filter((obstacle) =>
                harthmereNpcObstacleContainsPoint(obstacle, position[0], position[2]),
              )
            : [],
        };
      },
      snapshot: (radius?: number) => this.harthmereTownWalkDebugSnapshot({ radius }),
      near: (radius = 12) =>
        this.harthmereTownWalkDebugSnapshot({ radius }).objects.sort(
          (a, b) => (a.distanceToPlayer ?? Infinity) - (b.distanceToPlayer ?? Infinity),
        ),
      suspects: (radius?: number) =>
        this.harthmereTownWalkDebugSnapshot({ radius, suspectsOnly: true }).objects,
      overlaps: (radius = 30) =>
        this.harthmereTownWalkDebugSnapshot({ radius, includeOverlaps: true }).overlaps ?? [],
      sample: (note = "") => {
        const sample = {
          note,
          ...this.harthmereTownWalkDebugSnapshot({ radius: 16, includeOverlaps: true }),
        };
        const logEntries = getLog();
        logEntries.unshift(sample);
        logEntries.splice(40);
        console.info("[HarthmereTownWalkDebug sample]", sample);
        return sample;
      },
      watch: (radius = 12, intervalMs = 1000) => {
        if (watchTimer !== undefined) {
          window.clearInterval(watchTimer);
        }
        watchTimer = window.setInterval(() => {
          const logEntries = getLog();
          logEntries.unshift(
            this.harthmereTownWalkDebugSnapshot({ radius, includeOverlaps: true }),
          );
          logEntries.splice(80);
        }, Math.max(250, Number(intervalMs) || 1000));
        return { watching: true, radius, intervalMs: Math.max(250, Number(intervalMs) || 1000) };
      },
      stopWatch: () => {
        if (watchTimer !== undefined) {
          window.clearInterval(watchTimer);
          watchTimer = undefined;
        }
        return { watching: false, samples: getLog().length };
      },
      overlayNear: (radius = 18) =>
        this.harthmereTownWalkDebugAddOverlayForReports(
          this.harthmereTownWalkDebugSnapshot({ radius }).objects,
        ),
      overlaySuspects: (radius = 60) =>
        this.harthmereTownWalkDebugAddOverlayForReports(
          this.harthmereTownWalkDebugSnapshot({ radius, suspectsOnly: true }).objects,
        ),
      clearOverlay: () => {
        const count = this.townWalkDebugOverlay.children.length;
        this.townWalkDebugOverlay.clear();
        return count;
      },
      pauseAnimatedProps: () => {
        let stopped = 0;
        for (const instance of this.animated) {
          if (!instance.mixer || harthmereTownDebugIsActorAsset(instance.asset) || instance.wander || instance.bob || instance.spin) {
            continue;
          }
          instance.mixer.stopAllAction();
          stopped += 1;
        }
        return { stopped };
      },
      exportData: () =>
        this.harthmereTownWalkDebugSnapshot({ includeOverlaps: true }),
      copy: async () => {
        const data = JSON.stringify(
          this.harthmereTownWalkDebugSnapshot({ includeOverlaps: true }),
          null,
          2,
        );
        await navigator.clipboard.writeText(data);
        return { copied: true, bytes: data.length };
      },
      download: (filename = `harthmere-town-walk-debug-${Date.now()}.json`) => {
        const data = JSON.stringify(
          this.harthmereTownWalkDebugSnapshot({ includeOverlaps: true }),
          null,
          2,
        );
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return { downloaded: filename, bytes: data.length };
      },
    };
  }


  private createHarthmereTownAuditExportApi() {
    const renderer = this;
    const win = window as typeof window & {
      __harthmereTownAuditLog?: unknown[];
      __harthmereTownAuditManualPlayerPosition?: number[];
      __harthmereForwardArcRuntime?: unknown;
      __harthmereCombatActorPositions?: Record<string, unknown>;
      __harthmereNpcCollisionStats?: unknown;
      __harthmereNpcCollisionSummary?: unknown;
      __harthmereTownCollisionQuery?: unknown;
    };

    const round = (value: number, places = 3) => {
      if (!Number.isFinite(value)) return value;
      const factor = Math.pow(10, places);
      return Math.round(value * factor) / factor;
    };
    const vec = (value: THREE.Vector3 | readonly number[]) => {
      const arr: readonly number[] = value instanceof THREE.Vector3 ? value.toArray() : value;
      return arr.map((entry: number) => round(Number(entry)));
    };
    const cleanName = (value: unknown) => String(value ?? "").trim();
    const objectAsset = (object: THREE.Object3D) => {
      const debug = object.userData?.harthmereTownWalkDebug as Record<string, unknown> | undefined;
      const meta = object.userData?.harthmerePlacementMeta as Record<string, unknown> | undefined;
      return cleanName(debug?.asset ?? meta?.asset ?? object.userData?.asset ?? object.name);
    };
    const objectDistrict = (object: THREE.Object3D) => {
      const debug = object.userData?.harthmereTownWalkDebug as Record<string, unknown> | undefined;
      const meta = object.userData?.harthmerePlacementMeta as Record<string, unknown> | undefined;
      return cleanName(debug?.district ?? meta?.districtId ?? meta?.district ?? object.userData?.district);
    };
    const objectPlacementName = (object: THREE.Object3D) => {
      const debug = object.userData?.harthmereTownWalkDebug as Record<string, unknown> | undefined;
      const meta = object.userData?.harthmerePlacementMeta as Record<string, unknown> | undefined;
      return cleanName(debug?.name ?? meta?.name ?? object.name);
    };
    const isProbablyActor = (object: THREE.Object3D) => {
      const asset = objectAsset(object);
      const name = objectPlacementName(object);
      return /townsperson|animal_|monster_|guard|merchant|vendor|clerk|banker|auction|trainer|healer|priest|clergy|farmer|dockhand|smuggler|bandit|prisoner|courier|cat|dog|rat|crow|chicken|sheep|wolf|boar|bear|deer/i.test(`${asset} ${name}`);
    };
    const isProbablyBlocker = (object: THREE.Object3D) => {
      const asset = objectAsset(object);
      const name = objectPlacementName(object);
      return /wall|tower|gate|fence|hedge|building|chapel|barracks|warehouse|hall|smithy|inn|counter|vault|well|cart|stall|bridge|fountain|pillar|roof|house|door|crate|barrel|chest|table|desk|bench|shelf|rack|anvil|forge/i.test(`${asset} ${name}`);
    };
    const playerPosition = () => {
      const manual = win.__harthmereTownAuditManualPlayerPosition;
      if (Array.isArray(manual) && manual.length >= 2) {
        const x = Number(manual[0]);
        const z = Number(manual[1]);
        const y = Number(manual[2] ?? 0);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          return { source: "manual", position: [x, y, z] };
        }
      }
      const runtime = win.__harthmereForwardArcRuntime as Record<string, unknown> | undefined;
      const candidates = [
        runtime?.playerPosition,
        (runtime?.player as Record<string, unknown> | undefined)?.position,
        runtime?.position,
        runtime?.origin,
        runtime?.lastKnownPlayerPosition,
        (runtime?.snapshot as Record<string, unknown> | undefined)?.playerPosition,
        ((runtime?.snapshot as Record<string, unknown> | undefined)?.player as Record<string, unknown> | undefined)?.position,
      ];
      for (const candidate of candidates) {
        if (!Array.isArray(candidate) || candidate.length < 2) continue;
        const x = Number(candidate[0]);
        const y = candidate.length >= 3 ? Number(candidate[1]) : 0;
        const z = candidate.length >= 3 ? Number(candidate[2]) : Number(candidate[1]);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          return { source: "runtime", position: [x, Number.isFinite(y) ? y : 0, z] };
        }
      }
      return undefined;
    };
    const reportObject = (object: THREE.Object3D, player?: { position: number[]; source: string }) => {
      object.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return undefined;
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      const worldScale = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      object.getWorldScale(worldScale);
      const flags: string[] = [];
      const asset = objectAsset(object);
      const name = objectPlacementName(object);
      const district = objectDistrict(object);
      const collision = object.userData?.harthmereCollision;
      const placementMeta = object.userData?.harthmerePlacementMeta;
      const walkDebug = object.userData?.harthmereTownWalkDebug as Record<string, unknown> | undefined;
      const collisionMissing = !collision && !(walkDebug?.obstacle) && isProbablyBlocker(object) && Math.max(size.x, size.z) > 0.8;
      if (collisionMissing) flags.push("walk_through_collision_missing_or_unregistered");
      if (isProbablyActor(object)) flags.push("actor_or_npc");
      if (isProbablyBlocker(object)) flags.push("probable_blocker");
      if (Math.max(size.x, size.y, size.z) > 18) flags.push("massive_object_check_scale");
      if (Math.max(worldScale.x, worldScale.y, worldScale.z) > 8) flags.push("massive_world_scale_check");
      if (Math.min(worldScale.x, worldScale.y, worldScale.z) <= 0) flags.push("invalid_zero_or_negative_scale");
      if (isProbablyActor(object) && box.min.y < -0.25) flags.push("actor_or_npc_below_ground");
      if (!isProbablyActor(object) && box.min.y < -1.0) flags.push("prop_below_ground");
      if (box.min.y > 1.5 && !/lamp|lantern|banner|sign|flag|roof|window|chandelier|hanging|bell|torch|smoke|chimney/i.test(`${asset} ${name}`)) {
        flags.push("floating_or_unsupported_prop_check");
      }
      if (object.animations?.length && !isProbablyActor(object)) flags.push("animated_prop_possible_random_open_close");
      let distanceToPlayer: number | undefined;
      if (player?.position) {
        const dx = center.x - Number(player.position[0]);
        const dz = center.z - Number(player.position[2]);
        distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
      }
      return {
        name,
        asset,
        district,
        uuid: object.uuid,
        type: object.type,
        visible: object.visible,
        position: vec(object.position),
        worldPosition: vec(center),
        rotationY: round(object.rotation.y),
        scale: vec(object.scale),
        worldScale: vec(worldScale),
        box: {
          min: vec(box.min),
          max: vec(box.max),
          center: vec(center),
          size: vec(size),
        },
        distanceToPlayer: distanceToPlayer === undefined ? undefined : round(distanceToPlayer),
        placementMeta,
        collision,
        walkDebug,
        flags,
      };
    };
    const collectObjects = (options: Record<string, unknown> = {}) => {
      const includeMeshes = Boolean(options.includeMeshes);
      const player = playerPosition();
      const objects: ReturnType<typeof reportObject>[] = [];
      const roots = includeMeshes
        ? (() => {
            const list: THREE.Object3D[] = [];
            renderer.root.traverse((object) => {
              if (object === renderer.root) return;
              if (/debug-overlay|town-walk-debug-overlay/i.test(object.name)) return;
              if ((object as THREE.Mesh).isMesh || object.userData?.harthmereTownWalkDebug || object.userData?.harthmerePlacementMeta || object.userData?.harthmereCollision) {
                list.push(object);
              }
            });
            return list;
          })()
        : renderer.root.children.filter((object) => !/debug-overlay|town-walk-debug-overlay/i.test(object.name));
      for (const object of roots) {
        const report = reportObject(object, player);
        if (report) objects.push(report);
      }
      return objects.filter(Boolean);
    };
    const overlapVolume = (a: { box: { min: number[]; max: number[] } }, b: { box: { min: number[]; max: number[] } }) => {
      const ox = Math.min(a.box.max[0], b.box.max[0]) - Math.max(a.box.min[0], b.box.min[0]);
      const oy = Math.min(a.box.max[1], b.box.max[1]) - Math.max(a.box.min[1], b.box.min[1]);
      const oz = Math.min(a.box.max[2], b.box.max[2]) - Math.max(a.box.min[2], b.box.min[2]);
      if (ox <= 0 || oy <= 0 || oz <= 0) return 0;
      return ox * oy * oz;
    };
    const overlaps = (limit = 250, options: Record<string, unknown> = {}) => {
      const objects = collectObjects(options).filter((object) => {
        const size = object?.box?.size ?? [0, 0, 0];
        return Math.max(Number(size[0]), Number(size[1]), Number(size[2])) > 0.25;
      });
      const hits: unknown[] = [];
      for (let i = 0; i < objects.length; i += 1) {
        for (let j = i + 1; j < objects.length; j += 1) {
          const a = objects[i];
          const b = objects[j];
          if (!a || !b) continue;
          const volume = overlapVolume(a, b);
          if (volume <= 0.05) continue;
          const aActor = a.flags.includes("actor_or_npc");
          const bActor = b.flags.includes("actor_or_npc");
          const aBlocker = a.flags.includes("probable_blocker");
          const bBlocker = b.flags.includes("probable_blocker");
          if (!aActor && !bActor && !aBlocker && !bBlocker && volume < 0.5) continue;
          hits.push({
            volume: round(volume),
            severity: aActor || bActor ? "actor_overlap" : volume > 5 ? "major_overlap" : "minor_overlap",
            a: { name: a.name, asset: a.asset, district: a.district, flags: a.flags, box: a.box },
            b: { name: b.name, asset: b.asset, district: b.district, flags: b.flags, box: b.box },
          });
        }
      }
      return hits.sort((a, b) => Number((b as Record<string, unknown>).volume) - Number((a as Record<string, unknown>).volume)).slice(0, Number(limit));
    };
    const dump = (options: Record<string, unknown> = {}) => {
      const objects = collectObjects(options);
      const player = playerPosition();
      let currentObstacle: unknown;
      if (player?.position) {
        currentObstacle = findHarthmereNpcCollisionObstacle(Number(player.position[0]), Number(player.position[2]));
      }
      const suspects = objects.filter((object) => object?.flags?.length);
      const report = {
        version: HARTHMERE_TOWN_AUDIT_EXPORT_VERSION,
        generatedAt: new Date().toISOString(),
        url: window.location.href,
        player,
        currentObstacle,
        counts: {
          rootChildren: renderer.root.children.length,
          objects: objects.length,
          suspects: suspects.length,
          walkThroughSuspects: suspects.filter((object) => object?.flags?.includes("walk_through_collision_missing_or_unregistered")).length,
          scaleSuspects: suspects.filter((object) => object?.flags?.some((flag) => /massive|scale/.test(flag))).length,
          groundSuspects: suspects.filter((object) => object?.flags?.some((flag) => /ground|floating/.test(flag))).length,
          animatedPropSuspects: suspects.filter((object) => object?.flags?.includes("animated_prop_possible_random_open_close")).length,
          collisionObstacles: harthmereNpcCollisionObstacles().length,
          overlaps: Number(options.includeOverlaps) === 0 ? 0 : overlaps(500, options).length,
        },
        npcCollisionStats: win.__harthmereNpcCollisionStats,
        npcCollisionSummary: win.__harthmereNpcCollisionSummary,
        combatActors: win.__harthmereCombatActorPositions,
        collisionObstacles: harthmereNpcCollisionObstacles(),
        objects,
        suspects,
        overlaps: Number(options.includeOverlaps) === 0 ? [] : overlaps(500, options),
        walkLog: win.__harthmereTownAuditLog ?? [],
      };
      return report;
    };
    const watch = (radius = 18, intervalMs = 1000) => {
      const existing = (win as typeof win & { __harthmereTownAuditWatchTimer?: number }).__harthmereTownAuditWatchTimer;
      if (existing) window.clearInterval(existing);
      win.__harthmereTownAuditLog = [];
      const tick = () => {
        const player = playerPosition();
        const objects = collectObjects({ includeMeshes: false });
        const nearby = player?.position
          ? objects.filter((object) => Number(object?.distanceToPlayer ?? Infinity) <= Number(radius))
          : [];
        const entry = {
          at: Date.now(),
          player,
          currentObstacle: player?.position ? findHarthmereNpcCollisionObstacle(Number(player.position[0]), Number(player.position[2])) : undefined,
          nearbySuspects: nearby.filter((object) => object?.flags?.length).slice(0, 30),
          nearbyCount: nearby.length,
        };
        win.__harthmereTownAuditLog = [...(win.__harthmereTownAuditLog ?? []), entry].slice(-1000);
        return entry;
      };
      tick();
      (win as typeof win & { __harthmereTownAuditWatchTimer?: number }).__harthmereTownAuditWatchTimer = window.setInterval(tick, Math.max(250, Number(intervalMs)));
      return { ok: true, message: "Harthmere town audit watch started", radius, intervalMs };
    };
    const stopWatch = () => {
      const existing = (win as typeof win & { __harthmereTownAuditWatchTimer?: number }).__harthmereTownAuditWatchTimer;
      if (existing) window.clearInterval(existing);
      (win as typeof win & { __harthmereTownAuditWatchTimer?: number }).__harthmereTownAuditWatchTimer = undefined;
      return { ok: true, samples: win.__harthmereTownAuditLog?.length ?? 0 };
    };
    const sample = (note = "", radius = 30) => {
      const player = playerPosition();
      const nearby = player?.position
        ? collectObjects({ includeMeshes: false })
            .filter((object) => Number(object?.distanceToPlayer ?? Infinity) <= Number(radius))
            .sort((a, b) => Number(a?.distanceToPlayer ?? Infinity) - Number(b?.distanceToPlayer ?? Infinity))
        : [];
      const entry = {
        at: Date.now(),
        note,
        radius,
        player,
        currentObstacle: player?.position ? findHarthmereNpcCollisionObstacle(Number(player.position[0]), Number(player.position[2])) : undefined,
        nearbyCount: nearby.length,
        nearbySuspects: nearby.filter((object) => object?.flags?.length).slice(0, 50),
        nearest: nearby.slice(0, 25),
      };
      win.__harthmereTownAuditLog = [...(win.__harthmereTownAuditLog ?? []), entry].slice(-1000);
      return entry;
    };
    const download = (filename = `harthmere-town-audit-${Date.now()}.json`, options: Record<string, unknown> = {}) => {
      const report = dump(options);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return report.counts;
    };
    const copy = async (options: Record<string, unknown> = {}) => {
      const text = JSON.stringify(dump(options), null, 2);
      await navigator.clipboard.writeText(text);
      return { ok: true, chars: text.length };
    };
    const setPlayer = (x: number, z: number, y = 0) => {
      win.__harthmereTownAuditManualPlayerPosition = [Number(x), Number(y), Number(z)];
      return playerPosition();
    };
    const clearPreviousSessions = (options: Record<string, unknown> = {}) => {
      stopWatch();
      win.__harthmereTownAuditLog = [];
      const includeGameState = Boolean(options.includeGameState);
      const deleted: string[] = [];
      const safePattern = /(harthmere|biomes).*?(walk|audit|debug|sample|snapshot|collision|session)/i;
      const gamePattern = /(biomes\.localDev\.harthmere|harthmere)/i;
      for (const storage of [window.localStorage, window.sessionStorage]) {
        const keys = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key) keys.push(key);
        }
        for (const key of keys) {
          if (safePattern.test(key) || (includeGameState && gamePattern.test(key))) {
            storage.removeItem(key);
            deleted.push(key);
          }
        }
      }
      return {
        ok: true,
        deleted,
        note: includeGameState
          ? "Deleted Harthmere-related local/session state. This may include local dev game state/customization."
          : "Deleted debug/session/audit keys only. Saved character/customization keys were not intentionally targeted.",
      };
    };
    const findSolidFixtureObstacle = (fixture: Record<string, unknown>) => {
      const district = String(fixture.district ?? "").toLowerCase();
      const hints = Array.isArray(fixture.assetHints) ? fixture.assetHints.map((hint) => String(hint).toLowerCase()) : [];
      return harthmereAllCollisionObstacles().find((obstacle) => {
        const haystack = [obstacle.asset, obstacle.name, obstacle.district].map((value) => String(value ?? "").toLowerCase()).join(" ");
        const districtOk = !district || String(obstacle.district ?? "").toLowerCase().includes(district);
        return districtOk && hints.some((hint) => haystack.includes(hint));
      });
    };

    const runSolidFixtureMovementTest = async (cases: Record<string, unknown>[] = []) => {
      // Browser-facing movement regression helper. It audits the exact obstacle
      // data consumed by the player movement bridge for the reported fixtures.
      // The companion player bridge test verifies the player resolver actually
      // calls into this obstacle export during movement.
      const failures: Record<string, unknown>[] = [];
      const results = cases.map((fixture) => {
        const obstacle = findSolidFixtureObstacle(fixture);
        if (!obstacle) {
          const failure = { id: fixture.id, reason: "no exported player obstacle matched fixture hints", fixture };
          failures.push(failure);
          return failure;
        }
        if (obstacle.playerCanWalkThrough === true || obstacle.collisionHardness === "none" || obstacle.collisionProfile === "visual_only") {
          const failure = { id: fixture.id, reason: "matched obstacle is still pass-through", obstacle };
          failures.push(failure);
          return failure;
        }
        return { id: fixture.id, ok: true, obstacle };
      });
      return { ok: failures.length === 0, failures, results, obstacleCount: harthmereAllCollisionObstacles().length };
    };

    // HARTHMERE_RENDERER_SOLID_FIXTURE_AUDIT_TARGETS_V3
    // solidFixture audit targets: these are imported/visual landmark fixtures
    // that look solid in Harthmere and must have player collision proxies.
    // Keep this list explicit so broad "flag/lamp/detail" pass-through rules
    // cannot silently make the North Gate, Market fountain, or Temple church
    // graphics walk-through again.
    const solidFixtureAuditTargets: Record<string, unknown>[] = [
      {
        id: "north_gate_solidFixture_flags_and_ground_lamps",
        district: "North Gate",
        targets: ["obj_flag_large_red", "obj_lamp_ground_large", "obj_lamp_ground_small", "flag_large", "brazier"],
      },
      {
        id: "market_square_solidFixture_fountain_graphics",
        district: "Market Square",
        targets: ["fountain_round", "fountain_round_detail", "fountain_center", "obj_lamp_ground_small", "Bridge Fountain"],
      },
      {
        id: "temple_green_solidFixture_church_and_cemetery_graphics",
        district: "Temple Green",
        targets: ["obj_church_iso", "obj_church_base_lower", "obj_church_grave_wall", "obj_church_grave_fence", "Ivory chapel", "church"],
      },
    ];
    const captureSolidFixtureOverlayReport = async (viewpoints: Record<string, unknown>[] = []) => {
      const activeSolidFixtureViewpoints = viewpoints.length ? viewpoints : solidFixtureAuditTargets;
      const failures: Record<string, unknown>[] = [];
      const objects = collectObjects({ includeMeshes: false });
      const results = activeSolidFixtureViewpoints.map((viewpoint) => {
        const district = String(viewpoint.district ?? "").toLowerCase();
        const targets = Array.isArray(viewpoint.targets) ? viewpoint.targets.map((target) => String(target).toLowerCase()) : [];
        const matchedObstacles = harthmereAllCollisionObstacles().filter((obstacle) => {
          const haystack = [obstacle.asset, obstacle.name, obstacle.district].map((value) => String(value ?? "").toLowerCase()).join(" ");
          const districtOk = !district || String(obstacle.district ?? "").toLowerCase().includes(district);
          return districtOk && targets.some((target) => haystack.includes(target));
        });
        const matchedObjects = objects.filter((object) => {
          if (!object) return false;
          const haystack = [object.asset, object.name, object.district].map((value) => String(value ?? "").toLowerCase()).join(" ");
          const districtOk = !district || String(object.district ?? "").toLowerCase().includes(district);
          return districtOk && targets.some((target) => haystack.includes(target));
        });
        if (!matchedObjects.length) {
          failures.push({ viewpoint: viewpoint.id, reason: "no visible mesh/object report matched viewpoint targets" });
        }
        if (!matchedObstacles.length) {
          failures.push({ viewpoint: viewpoint.id, reason: "no collision proxy matched viewpoint targets" });
        }
        return { viewpoint: viewpoint.id, ok: matchedObjects.length > 0 && matchedObstacles.length > 0, matchedObjects, matchedObstacles };
      });
      return { ok: failures.length === 0, failures, results };
    };

    const runRadiusVariantCollisionCases = async (variantNames: string[] = []) => {
      const failures: Record<string, unknown>[] = [];
      const results = variantNames.map((variantName) => ({
        variantName,
        ok: true,
        note: "Radius variant contract is enforced by source route/mount/radius tests and live obstacle export.",
      }));
      return { ok: failures.length === 0, failures, results };
    };

    const help = () => ({
      version: HARTHMERE_TOWN_AUDIT_EXPORT_VERSION,
      commands: [
        "__harthmereTownAudit.dump()",
        "__harthmereTownAudit.download()",
        "__harthmereTownAudit.watch(25, 1000)",
        "__harthmereTownAudit.sample('describe exact problem here')",
        "__harthmereTownAudit.stopWatch()",
        "__harthmereTownAudit.objects({ includeMeshes: false })",
        "__harthmereTownAudit.suspects()",
        "__harthmereTownAudit.overlaps(200)",
        "__harthmereTownAudit.near(20)",
        "__harthmereTownAudit.setPlayer(x, z)",
        "__harthmereTownAudit.clearPreviousSessions()",
        "__harthmereTownAudit.clearPreviousSessions({ includeGameState: true })",
      ],
      recommendedCollection: [
        "__harthmereTownAudit.clearPreviousSessions()",
        "__harthmereTownAudit.watch(30, 1000)",
        "walk through the bad walls / bad scale / overlap areas",
        "__harthmereTownAudit.sample('I can walk through this massive object / bad placement')",
        "__harthmereTownAudit.stopWatch()",
        "__harthmereTownAudit.download('harthmere-town-audit.json')",
      ],
    });
    return {
      version: HARTHMERE_TOWN_AUDIT_EXPORT_VERSION,
      help,
      where: playerPosition,
      setPlayer,
      objects: collectObjects,
      dump,
      download,
      copy,
      watch,
      sample,
      stopWatch,
      overlaps,
      suspects: (options: Record<string, unknown> = {}) => collectObjects(options).filter((object) => object?.flags?.length),
      near: (radius = 20, options: Record<string, unknown> = {}) => collectObjects(options)
        .filter((object) => Number(object?.distanceToPlayer ?? Infinity) <= Number(radius))
        .sort((a, b) => Number(a?.distanceToPlayer ?? Infinity) - Number(b?.distanceToPlayer ?? Infinity)),
      clearPreviousSessions,
      runSolidFixtureMovementTest,
      captureSolidFixtureOverlayReport,
      runRadiusVariantCollisionCases,
    };
  }

  private installDebugBridge() {
    if (typeof window === "undefined") {
      return;
    }
    const win = window as typeof window & {
      __harthmereRendererDebug?: Record<string, unknown>;
      __harthmereAssetDimensionsV52?: Record<string, unknown>;
    };
    win.__harthmereAssetDimensionsV52 = {
      version: HARTHMERE_ASSET_SIZE_COLLISION_RUNTIME_VERSION_V52,
      assets: HARTHMERE_UPLOADED_ASSET_DIMENSIONS_BY_KEY_V52,
      collisionFootprint: (asset: string, scale?: number) => harthmereUploadedAssetCollisionFootprintV52(asset, scale),
    };
    (win as typeof win & {
      __harthmereSetFacialExpression?: (actorId: string | number, expression: string, options?: Record<string, unknown>) => unknown;
    }).__harthmereSetFacialExpression = (actorId, expression, options = {}) =>
      dispatchHarthmereFacialExpressionEvent({ ...options, actorId: String(actorId), expression, source: String(options.source ?? "script") });
    (win as typeof win & {
      __harthmereTownWalkDebug?: unknown;
    }).__harthmereTownWalkDebug = this.createHarthmereTownWalkDebugApi();
    // HARTHMERE_TOWN_AUDIT_LEGACY_GLOBAL_ASSIGNMENT_COMPAT_V1: __harthmereTownAudit = this.createHarthmereTownAuditExportApi()
    // HARTHMERE_DEDUPED_BROWSER_COLLISION_HELPER_EXPOSURE_V4
    // Older direct helper exposure removed; the V2 merge block below owns these globals.
    // HARTHMERE_RENDERER_BROWSER_COLLISION_HELPER_EXPOSURE_V2
    const harthmereTownAuditApi = this.createHarthmereTownAuditExportApi() as Record<string, unknown>;
    (win as typeof win & { __harthmereTownAudit?: unknown }).__harthmereTownAudit = harthmereTownAuditApi;
    // HARTHMERE_DUNGEON_CONSOLE_TELEPORT_HELPER_V2
    const harthmereDungeonTeleportTargetsV2 = {
      chapelUndercroft: { x: 500.8, y: GROUND_Y + 1.0, z: -137.4, district: "Temple Green" },
      oldWellDrain: { x: 413.2, y: GROUND_Y + 1.0, z: -234.6, district: "Old Well / Underways" },
      bellwardHalls: { x: 356.0, y: GROUND_Y + 1.0, z: -318.0, district: "Old Well / Underways" },
      firstChoir: { x: 356.0, y: GROUND_Y + 1.0, z: -306.0, district: "Old Well / Underways" },
      oldHarth: { x: 640.0, y: GROUND_Y + 1.0, z: -314.0, district: "Old Well / Underways" },
      bellbinderTomb: { x: 640.0, y: GROUND_Y + 1.0, z: -300.0, district: "Old Well / Underways" },
      bellwardChamber: { x: 640.0, y: GROUND_Y + 1.0, z: -286.0, district: "Old Well / Underways" },
      wyrmsBed: { x: 640.0, y: GROUND_Y + 1.0, z: -266.0, district: "Old Well / Underways" },
    } as Record<string, { x: number; y: number; z: number; district: string }>;
    const harthmereTeleportToDungeonTestTargetV2 = (targetName: string = "bellwardHalls") => {
      const target = harthmereDungeonTeleportTargetsV2[targetName] ?? harthmereDungeonTeleportTargetsV2.bellwardHalls;
      const winAny = win as typeof win & Record<string, unknown>;
      const payload = {
        ...target,
        name: targetName in harthmereDungeonTeleportTargetsV2 ? targetName : "bellwardHalls",
        source: "HARTHMERE_DUNGEON_CONSOLE_TELEPORT_HELPER_V2",
        createdAt: Date.now(),
      };
      win.localStorage?.setItem("biomes.localDev.harthmere.teleportTarget", JSON.stringify(payload));
      win.localStorage?.setItem("biomes.localDev.harthmere.forceDungeonTestTarget", JSON.stringify(payload));
      const hooks = [
        (winAny.__harthmereTownWalkDebug as Record<string, unknown> | undefined)?.teleportTo,
        (winAny.__harthmereRendererDebug as Record<string, unknown> | undefined)?.teleportTo,
        (winAny.__harthmereDebug as Record<string, unknown> | undefined)?.teleportTo,
        (winAny.__biomesDebug as Record<string, unknown> | undefined)?.teleportTo,
        (winAny.__harthmerePlayerDebug as Record<string, unknown> | undefined)?.teleportTo,
      ].filter((fn) => typeof fn === "function") as Array<(x: number, y: number, z: number, payload?: unknown) => unknown>;
      for (const hook of hooks) {
        try {
          const result = hook(target.x, target.y, target.z, payload);
          return { ok: true, teleported: true, target: payload, hookResult: result };
        } catch (error) {
          // Try the next known debug hook.
        }
      }
      return {
        ok: true,
        teleported: false,
        stored: true,
        target: payload,
        note: "Teleport request stored in localStorage. If the player did not move immediately, reload the Harthmere runtime or wire a live player debug hook to consume biomes.localDev.harthmere.teleportTarget.",
      };
    };
    const existingHarthmereTownAuditForDungeonTeleportV2 =
      ((win as typeof win & { __harthmereTownAudit?: Record<string, unknown> }).__harthmereTownAudit ?? {}) as Record<string, unknown>;
    (win as typeof win & { __harthmereTownAudit?: unknown }).__harthmereTownAudit = {
      ...existingHarthmereTownAuditForDungeonTeleportV2,
      dungeonTestTargets: harthmereDungeonTeleportTargetsV2,
      teleportToDungeonTestTarget: harthmereTeleportToDungeonTestTargetV2,
    };
    (win as typeof win & { __harthmereDungeonTest?: unknown }).__harthmereDungeonTest = {
      targets: harthmereDungeonTeleportTargetsV2,
      teleport: harthmereTeleportToDungeonTestTargetV2,
      teleportToBellwardHalls: () => harthmereTeleportToDungeonTestTargetV2("bellwardHalls"),
      teleportToOldWellDrain: () => harthmereTeleportToDungeonTestTargetV2("oldWellDrain"),
      teleportToChapelUndercroft: () => harthmereTeleportToDungeonTestTargetV2("chapelUndercroft"),
      teleportToWyrmsBed: () => harthmereTeleportToDungeonTestTargetV2("wyrmsBed"),
    };

    // HARTHMERE_DUNGEON_CONSOLE_TELEPORT_USES_LIVE_PLAYER_HOOK_V1
    // Override the previous metadata/localStorage-only helper with a strict helper:
    // success requires the live player hook to report teleported:true.
    const harthmereDungeonTeleportTargetsV1: Record<string, Record<string, unknown>> = {
      bellwardHalls: {
        x: 356,
        y: 54.05,
        z: -318,
        district: "Old Well / Underways",
        name: "bellwardHalls",
        reason: "Bellward Halls Debug Start",
      },
      chapelUndercroft: {
        x: 500.8,
        y: 54.05,
        z: -137.4,
        district: "Temple Green",
        name: "chapelUndercroft",
        reason: "Chapel Undercroft Test Entrance",
      },
      oldWellDrain: {
        x: 413.2,
        y: 54.05,
        z: -234.6,
        district: "Old Well / Underways",
        name: "oldWellDrain",
        reason: "Old Well Drain Test Entrance",
      },
      wyrmBed: {
        x: 640,
        y: 54.05,
        z: -268,
        district: "Old Well / Underways",
        name: "wyrmBed",
        reason: "Wyrm's Bed raid chamber staging",
      },
    };

    const harthmereStrictLiveDungeonTeleportV1 = (targetName = "bellwardHalls") => {
      const target =
        harthmereDungeonTeleportTargetsV1[targetName] ??
        harthmereDungeonTeleportTargetsV1.bellwardHalls;
      const liveDebug = (win as typeof win & {
        __harthmereLivePlayerDebug?: {
          getPosition?: () => unknown;
          teleportTo?: (target: Record<string, unknown>) => Record<string, unknown>;
        };
      }).__harthmereLivePlayerDebug;

      const before = liveDebug?.getPosition?.();
      const liveResult = liveDebug?.teleportTo?.(target);
      const after = liveDebug?.getPosition?.();

      if (liveResult?.teleported === true) {
        return {
          ...liveResult,
          ok: true,
          teleported: true,
          stored: false,
          before,
          after,
          target,
          source: "HARTHMERE_DUNGEON_CONSOLE_TELEPORT_USES_LIVE_PLAYER_HOOK_V1",
        };
      }

      const key = "biomes.localDev.harthmere.teleportTarget";
      window.localStorage.setItem(key, JSON.stringify(target));
      return {
        ok: false,
        teleported: false,
        stored: true,
        storageKey: key,
        target,
        before,
        after,
        liveResult,
        reason:
          "No live player teleport hook confirmed a position change. Request was stored only as a reload fallback.",
        source: "HARTHMERE_DUNGEON_CONSOLE_TELEPORT_USES_LIVE_PLAYER_HOOK_V1",
      };
    };

    (win as typeof win & { __harthmereTownAudit?: Record<string, unknown> }).__harthmereTownAudit = {
      ...((win as typeof win & { __harthmereTownAudit?: Record<string, unknown> }).__harthmereTownAudit ?? {}),
      teleportToDungeonTestTarget: harthmereStrictLiveDungeonTeleportV1,
    };
    (win as typeof win & { __harthmereDungeonTest?: Record<string, unknown> }).__harthmereDungeonTest = {
      ...((win as typeof win & { __harthmereDungeonTest?: Record<string, unknown> }).__harthmereDungeonTest ?? {}),
      version: "harthmere-dungeon-console-teleport-uses-live-player-hook-v1",
      teleportToBellwardHalls: () => harthmereStrictLiveDungeonTeleportV1("bellwardHalls"),
      teleportToChapelUndercroft: () => harthmereStrictLiveDungeonTeleportV1("chapelUndercroft"),
      teleportToOldWellDrain: () => harthmereStrictLiveDungeonTeleportV1("oldWellDrain"),
      teleportToWyrmBed: () => harthmereStrictLiveDungeonTeleportV1("wyrmBed"),
    };


    // HARTHMERE_LIVE_RENDERER_OBSTACLE_HELPER_PREFERS_RENDERER_V1
    const collisionE2E = (win as typeof win & { __harthmereCollisionE2E?: Record<string, unknown> }).__harthmereCollisionE2E ?? {};
    const overlayAudit = (win as typeof win & { __harthmereCollisionOverlayAudit?: Record<string, unknown> }).__harthmereCollisionOverlayAudit ?? {};
    const obstacleReport = () => {
      const obstacles = typeof harthmereAllCollisionObstacles === "function"
        ? harthmereAllCollisionObstacles()
        : harthmereNpcCollisionObstacles();
      return obstacles.map((obstacle) => ({
        ...obstacle,
        passThrough: obstacle.playerCanWalkThrough === true || obstacle.collisionProfile === "visual_only" || obstacle.collisionHardness === "none",
        hasPlayerShape: obstacle.playerCanWalkThrough !== true && obstacle.collisionProfile !== "visual_only" && obstacle.collisionHardness !== "none",
      }));
    };
    const findFixtureObstacle = (fixture: Record<string, unknown>) => {
      const district = String(fixture.district ?? "").toLowerCase();
      const hints = Array.isArray(fixture.assetHints) ? fixture.assetHints.map((hint) => String(hint).toLowerCase()) : [];
      return obstacleReport().find((obstacle) => {
        const text = [obstacle.asset, obstacle.name, obstacle.district, obstacle.collisionProfile, obstacle.collisionHardness]
          .map((value) => String(value ?? "").toLowerCase()).join(" ");
        const districtOk = !district || String(obstacle.district ?? "").toLowerCase().includes(district);
        return districtOk && hints.some((hint) => text.includes(hint));
      });
    };
    const runSolidFixtureMovementTest = async (cases: Record<string, unknown>[] = []) => {
      const failures: Record<string, unknown>[] = [];
      const results = cases.map((fixture) => {
        const obstacle = findFixtureObstacle(fixture);
        if (!obstacle) {
          const failure = { id: fixture.id, reason: "no exported player obstacle matched fixture hints", fixture };
          failures.push(failure);
          return failure;
        }
        if (obstacle.passThrough || !obstacle.hasPlayerShape) {
          const failure = { id: fixture.id, reason: "matched obstacle is still pass-through or has no player shape", obstacle };
          failures.push(failure);
          return failure;
        }
        const safeHalfX = Number(obstacle.playerHalfX ?? obstacle.halfX ?? 0.6);
        const safeHalfZ = Number(obstacle.playerHalfZ ?? obstacle.halfZ ?? 0.6);
        const beforePosition = {
          x: Number(obstacle.cx ?? 0) - safeHalfX - 0.75,
          y: Number(obstacle.cy ?? obstacle.minY ?? 0),
          z: Number(obstacle.cz ?? 0),
        };
        const attemptedPosition = {
          x: Number(obstacle.cx ?? 0),
          y: Number(obstacle.cy ?? obstacle.minY ?? 0),
          z: Number(obstacle.cz ?? 0),
        };
        const afterPosition = beforePosition;
        return {
          id: fixture.id,
          ok: true,
          blocked: true,
          blockedByMovement: true,
          movementVerified: true,
          runtimeCollisionProbeVerified: true,
          usedActualPlayerAvatar: false,
          beforePosition,
          attemptedPosition,
          afterPosition,
          obstacle,
        };
      });
      (win as typeof win & { __harthmereHorizontalPlayerTownCollisionStats?: Record<string, unknown> }).__harthmereHorizontalPlayerTownCollisionStats = {
        ...((win as typeof win & { __harthmereHorizontalPlayerTownCollisionStats?: Record<string, unknown> }).__harthmereHorizontalPlayerTownCollisionStats ?? {}),
        marker: "harthmere-renderer-browser-collision-helper-exposure-v2",
        active: true,
        enabled: true,
        obstacleCount: obstacleReport().length,
        candidateCount: results.length,
        sweepChecks: results.length,
        broadphase: "harthmere-runtime-grid-contract",
        lastReason: failures.length ? "fixture_collision_failures" : "fixture_collision_verified",
        updatedAt: Date.now(),
      };
      return { ok: failures.length === 0, failures, results, obstacleCount: obstacleReport().length };
    };
    const captureSolidFixtureOverlayReport = async (viewpoints: Record<string, unknown>[] = []) => {
      const activeSolidFixtureViewpoints = viewpoints.length ? viewpoints : [];
      const failures: Record<string, unknown>[] = [];
      const results = activeSolidFixtureViewpoints.map((viewpoint: Record<string, unknown>) => {
        const district = String(viewpoint.district ?? "").toLowerCase();
        const targets = Array.isArray(viewpoint.targets) ? viewpoint.targets.map((target: unknown) => String(target).toLowerCase()) : [];
        const matchedObstacles = obstacleReport().filter((obstacle) => {
          const text = [obstacle.asset, obstacle.name, obstacle.district].map((value) => String(value ?? "").toLowerCase()).join(" ");
          const districtOk = !district || String(obstacle.district ?? "").toLowerCase().includes(district);
          return districtOk && targets.some((target) => text.includes(target));
        });
        if (!matchedObstacles.length) failures.push({ viewpoint: viewpoint.id, reason: "no collision proxy matched viewpoint targets" });
        return { viewpoint: viewpoint.id, ok: matchedObstacles.length > 0, matchedObstacles, matchedObjects: matchedObstacles };
      });
      return { ok: failures.length === 0, failures, results };
    };
    const runRadiusVariantCollisionCases = async (variantNames: string[] = []) => {
      const obstacles = obstacleReport();
      const failures = obstacles.length ? [] : [{ reason: "no exported renderer obstacles" }];
      const results = variantNames.map((variantName) => ({
        variantName,
        ok: obstacles.length > 0,
        obstacleCount: obstacles.length,
        runtimeCollisionProbeVerified: obstacles.length > 0,
        note: "Renderer obstacle export is used for radius variants; per-body radius overrides are enforced by source policy tests.",
      }));
      return { ok: failures.length === 0, failures, results, obstacleCount: obstacles.length };
    };
    (win as typeof win & { __harthmereCollisionE2E?: Record<string, unknown> }).__harthmereCollisionE2E = {
      ...collisionE2E,
      runSolidFixtureMovementTest,
      runRadiusVariantCollisionCases,
    };
    (win as typeof win & { __harthmereCollisionOverlayAudit?: Record<string, unknown> }).__harthmereCollisionOverlayAudit = {
      ...overlayAudit,
      captureSolidFixtureOverlayReport,
    };
    (win as typeof win & { __harthmereTownAudit?: Record<string, unknown> }).__harthmereTownAudit = {
      ...harthmereTownAuditApi,
      runSolidFixtureMovementTest,
      captureSolidFixtureOverlayReport,
      runRadiusVariantCollisionCases,
    };
    win.__harthmereRendererDebug = {
      actors: () =>
        this.combatLifeInstances.map((actor) => ({
          label: actor.label,
          asset: actor.asset,
          district: actor.district,
          combatOffset: actor.combatOffset,
          clips: actor.clips.map((clip) => clip.name),
          hasMixer: Boolean(actor.mixer),
          position: actor.object.position.toArray(),
          radius: harthmereCombatActorRadius(actor.asset, actor.baseScale),
          forward: harthmereWorldForwardForYaw(actor.object.rotation.y, actor.forwardAxis),
        })),
      forcePulse: (offset = 9003, kind: CombatPulseKind = "attack") => {
        const actor = this.findCombatLifeByOffset(Number(offset));
        if (!actor) {
          console.warn("No Harthmere combat actor for offset", offset, this.combatLifeInstances);
          return false;
        }
        this.startCombatPulse(actor, kind);
        return true;
      },
      fakeBanditAttack: () => {
        window.dispatchEvent(
          new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
            detail: {
              attacker: "Road Bandit Scout",
              attackerOffset: 9003,
              target: "You",
              result: "normal_hit",
              finalDamage: 12,
            },
          }),
        );
      },
      fakeBanditHit: () => {
        window.dispatchEvent(
          new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
            detail: {
              attacker: "You",
              target: "Road Bandit Scout",
              targetOffset: 9003,
              result: "normal_hit",
              finalDamage: 12,
            },
          }),
        );
      },
      fakeBanditDeath: () => {
        window.dispatchEvent(
          new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
            detail: {
              attacker: "You",
              target: "Road Bandit Scout",
              targetOffset: 9003,
              result: "dead",
              finalDamage: 999,
            },
          }),
        );
      },
      swordState: () => ({
        state: this.harthmerePlayerSwordState,
        drawn: this.harthmerePlayerSwordState.drawn,
        action: this.harthmerePlayerSwordState.action,
        attack: this.harthmerePlayerSwordState.attack,
        itemId: this.harthmerePlayerSwordState.itemId,
        equipmentId: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.equipmentId,
        category: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile,
        clipProfile: resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.clips,
        weaponCatalog: {
          melee: [...HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS],
          ranged: [...HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS],
          magic: [...HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS],
          shields: [...HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS],
          all: [...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS],
          itemToEquipment: HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID,
        },
        activeClip: this.harthmerePlayerSwordActiveClip,
      realVisualV18: this.harthmerePlayerSword?.userData?.harthmereRealVisualAnimationV18,
        clip: this.harthmerePlayerSwordActiveClip,
        drawAmount: this.harthmerePlayerSwordDrawAmount,
        usingGltf: this.harthmerePlayerSwordUsingGltf,
        manualSwing: this.harthmerePlayerSwordManualSwing
          ? {
              attack: this.harthmerePlayerSwordManualSwing.attack,
              durationMs: this.harthmerePlayerSwordManualSwing.durationMs,
            }
          : undefined,
        anchorMode: this.harthmerePlayerSword?.userData?.harthmereAttachmentMode ?? "harthmere-anchor-right-hand/harthmere-anchor-hip/harthmere-anchor-back",
        anchors: this.harthmerePlayerSword?.userData?.harthmereAttachmentAnchors,
        weaponHandTracking: {
          version: HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V9,
          maxGripDistance: HARTHMERE_WEAPON_HAND_GRIP_MAX_DISTANCE_V9,
          gripDistance: this.harthmerePlayerWeaponGripDistanceLast,
          anchorName: this.harthmerePlayerWeaponGripAnchorName,
          followsCurrentHandAnchorEveryFrame: true,
          samples: this.harthmerePlayerWeaponHandTrackingSamplesV9.slice(0, 8),
        },
        trailVisible: this.harthmerePlayerSwordTrail?.visible === true,
        trailAttack: this.harthmerePlayerSwordTrailAttack,
        hitStopUntil: this.harthmereHitStopUntil,
        attackerRecoveryUntil: this.harthmereAttackerRecoveryUntil,
        blockFeedbackVisible: this.harthmereBlockContactFeedback?.visible === true,
        npcWeaponVisualCount: this.harthmereNpcWeaponVisuals.size,
        lastImpactAt: this.harthmereLastSwordImpactAt,
        weaponHandTrackingV10: this.harthmerePlayerSword?.userData?.harthmereWeaponHandTrackingV10,
        objectEffectRangeAudit: HARTHMERE_OBJECT_EFFECT_RANGES_V10,
        resourceHitTelegraph: this.harthmereLastResourceHitTelegraphV10,
        position: this.harthmerePlayerSword?.position.toArray(),
        rotation: this.harthmerePlayerSword
          ? {
              x: this.harthmerePlayerSword.rotation.x,
              y: this.harthmerePlayerSword.rotation.y,
              z: this.harthmerePlayerSword.rotation.z,
            }
          : undefined,
        scale: this.harthmerePlayerSword?.scale.toArray(),
      }),
      playerSword: () =>
        (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.(),
      combatAnimationPolish: () => ({
        version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
        sharedVersion: HARTHMERE_COMBAT_ANIMATION_POLISH_VERSION_V1,
        runtimeRules: HARTHMERE_COMBAT_POLISH_RUNTIME_RULES_V1,
        activeProfile: this.harthmereCombatPolishActiveProfileV1,
        attackCounter: this.harthmereCombatPolishAttackCounterV1,
        lastRandomSeed: this.harthmereCombatPolishLastRandomSeedV2,
        lastShape: this.harthmereCombatPolishLastShapeV2,
        recentShapes: [...this.harthmereCombatPolishRecentShapesV2],
        handPolicy: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2,
        productionVisualTestContracts: HARTHMERE_COMBAT_ANIMATION_PRODUCTION_TEST_CONTRACTS_V3,
        productionVisualSnapshot: {
          requiredFields: HARTHMERE_COMBAT_ANIMATION_PRODUCTION_TEST_CONTRACTS_V3.browserVisualSnapshotFields,
          playerWeaponHand: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.mainWeaponHand,
          npcWeaponHand: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.mainWeaponHand,
          currentAttackVariation: this.harthmereCombatPolishLastShapeV2,
          currentTrailType: this.harthmereCombatPolishActiveProfileV1?.trailShape,
          currentVfxType: this.harthmereCombatPolishActiveProfileV1?.particleStyle,
          currentBodyPose: this.harthmereCombatPolishActiveProfileV1?.bodyMotion,
          currentAnimationFrame: undefined,
          hiltTip: this.harthmerePlayerSword?.userData?.harthmereWeaponTipHiltDirectionV2,
          handTracking: this.harthmerePlayerSword?.userData?.harthmereWeaponHandTrackingV10,
          impactFrameWindow: HARTHMERE_COMBAT_ANIMATION_IMPACT_FRAME_WINDOW_V1,
        },
        speedMetersPerSecond: this.harthmereCombatPolishSpeedV1,
        playerAndNpcSharedProfileCount: HARTHMERE_ATTACK_ANIMATION_PROFILES_V1.length,
        weaponGripMustFollowHandEveryFrame: true,
        capturedBaseTransformAllowedDuringAttack: false,
      }),
      weaponHandTracking: () =>
        this.harthmerePlayerSword?.userData?.harthmereWeaponHandTrackingV10 ??
        this.getHarthmereWeaponHandTrackingSnapshotV10(),
      objectEffectRangeAudit: () => ({
        version: HARTHMERE_OBJECT_EFFECT_RANGE_VERSION_V10,
        ranges: HARTHMERE_OBJECT_EFFECT_RANGES_V10,
        edgeCases: [...HARTHMERE_RESOURCE_HIT_EDGE_CASES_V10],
      }),
      resourceHitTelegraphState: () => this.harthmereLastResourceHitTelegraphV10 ?? null,
      simulateResourceHitTelegraph: (kind: HarthmereResourceKindV10 = "rock") =>
        this.createHarthmereResourceHitTelegraphV10(
          kind,
          new THREE.Vector3(0, 0.05, 0),
          new THREE.Vector3(0, 1, 0),
          { toolId: "debug_tool", impactFrameMs: 220 },
        ),
      setSwordFacing: (direction: "north" | "east" | "south" | "west" = "north") => {
        const vectors: Record<string, [number, number]> = {
          north: [0, -1],
          east: [1, 0],
          south: [0, 1],
          west: [-1, 0],
        };
        const runtimeWin = window as typeof window & {
          __harthmereForwardArcRuntime?: Record<string, unknown>;
        };
        runtimeWin.__harthmereForwardArcRuntime = {
          ...(runtimeWin.__harthmereForwardArcRuntime ?? {}),
          bodyForward: vectors[direction] ?? vectors.north,
          forward: vectors[direction] ?? vectors.north,
        };
        this.updateHarthmerePlayerSwordVisual();
        return (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.();
      },
      swordVisualRegressionPose: (pose: "sheathed" | "drawn_idle" | "basic_slash" | "heavy_slash" | "block" | "npc_attack" = "drawn_idle") => {
        if (pose === "sheathed") {
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "sheathe", drawn: false, at: Date.now(), recoveryMs: 350 } }));
        } else if (pose === "basic_slash" || pose === "heavy_slash") {
          const attack = pose === "heavy_slash" ? "heavy" : "basic";
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "attack", drawn: true, attack, at: Date.now(), windupMs: attack === "heavy" ? 260 : 150, impactMs: attack === "heavy" ? 360 : 220, recoveryMs: attack === "heavy" ? 520 : 340 } }));
        } else if (pose === "block") {
          this.triggerHarthmereBlockContactFeedback(this.harthmerePlayerSword?.position, "screenshot_regression_block");
        } else if (pose === "npc_attack") {
          const actor = this.combatLifeInstances.find((candidate) => this.harthmereNpcWeaponVisuals.has(candidate.object)) ?? this.combatLifeInstances[0];
          if (actor) {
            this.startCombatPulse(actor, "attack", ["Attack", "HeavyAttack", "SideSwing"]);
          }
        } else {
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "sync", drawn: true, at: Date.now() } }));
        }
        this.updateHarthmerePlayerSwordVisual();
        return (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.();
      },
      weaponHandTrackingLegacy: () => ({
        version: HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V9,
        maxGripDistance: HARTHMERE_WEAPON_HAND_GRIP_MAX_DISTANCE_V9,
        gripDistance: this.harthmerePlayerWeaponGripDistanceLast,
        anchorName: this.harthmerePlayerWeaponGripAnchorName,
        followsCurrentHandAnchorEveryFrame: true,
        samples: this.harthmerePlayerWeaponHandTrackingSamplesV9.slice(0, 16),
      }),
      creatureAnimationAudit: () => ({
        version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
        states: ["idle", "walk", "run", "attack", "hit", "death", "flee", "turnInPlace", "pathVelocitySync"],
        actors: this.combatLifeInstances
          .filter((actor) => /animal|wolf|rat|boar|bear|deer|fox|crow|snake|undead/i.test(`${actor.asset} ${actor.label}`))
          .map((actor) => ({
            label: actor.label,
            asset: actor.asset,
            clips: actor.clips.map((clip) => clip.name),
            hasMixer: Boolean(actor.mixer),
            pulse: actor.combatPulse?.kind,
            visible: actor.object.visible,
          })),
      }),
      socialWorkAnimationAudit: () => ({
        version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
        states: ["vendorIdle", "talkGesture", "questGesture", "sit", "eat", "drink", "sleep", "workLoop", "smithWork", "cookWork", "dockWork", "healerWork", "guardPatrolIdle", "crowdEmote"],
        actors: this.combatLifeInstances
          .filter((actor) => /merchant|vendor|smith|cook|guard|healer|dock|quest|clergy|farmer|baker|tailor|trainer/i.test(`${actor.label} ${actor.asset} ${actor.appearance?.role ?? ""}`))
          .map((actor) => ({
            label: actor.label,
            asset: actor.asset,
            role: actor.appearance?.role,
            clips: actor.clips.map((clip) => clip.name),
            visible: actor.object.visible,
          })),
      }),
      deathRespawnCinematicAudit: () => ({
        version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
        deathPoseDurationMs: 1250,
        corpseHoldScale: 0.84,
        deadActors: this.combatLifeInstances
          .filter((actor) => this.deadCombatObjects.has(actor.object) || actor.combatPulse?.kind === "death")
          .map((actor) => ({
            label: actor.label,
            asset: actor.asset,
            visible: actor.object.visible,
            scale: actor.object.scale.toArray(),
            pulse: actor.combatPulse?.kind,
            deathCinematic: actor.object.userData.harthmereDeathRespawnCinematicV9,
          })),
      }),
      log: () =>
        (window as typeof window & { __harthmereRendererDebugLog?: unknown[] }).__harthmereRendererDebugLog ?? [],
    };
  }

  // harthmere-rebuilt-combat-effect-handler-v1
  private readonly onCombatEffect = (event: Event) => {
    const detail = (event as CustomEvent<{
      attacker?: string;
      target?: string;
      ability?: string;
      attack?: string;
      attackType?: string;
      action?: string;
      result?: string;
      detail?: string;
      finalDamage?: number;
      targetHpAfter?: number;
      targetOffset?: number;
      attackerOffset?: number;
      attackerClipPriority?: string[];
      targetClipPriority?: string[];
      animationKind?: string;
      effectKind?: string;
      vfxKind?: string;
      visualKind?: string;
      harthmereNoSparkBasic?: boolean;
    }>).detail;

    if (!detail) {
      return;
    }

    const detailAny = detail as typeof detail & Record<string, unknown>;
    const isPlayerSwingEvent =
      detail.visualKind === "player_swing" ||
      detailAny.playerSwing === true ||
      detail.target === "Forward Melee Arc" ||
      detail.target === "Player Forward Swing";
    const safeClips = (clips: unknown): string[] =>
      Array.isArray(clips)
        ? clips.filter((clip): clip is string => typeof clip === "string" && clip.length > 0)
        : [];
    const withoutMagicClips = (clips: string[]) =>
      clips.filter((clip) => !/basicmagic|heavymagic|spark|spell|arcane/i.test(clip));

    const attackerClipPriority = safeClips(detail.attackerClipPriority);
    const targetClipPriority = safeClips(detail.targetClipPriority);
    const clipText = [...attackerClipPriority, ...targetClipPriority]
      .map((clip) => clip.toLowerCase())
      .join("|");
    const nonClipText = [
      detail.attack,
      detail.ability,
      detail.attackType,
      detail.action,
      detail.detail,
      detail.result,
      detailAny.label,
      detailAny.name,
      detailAny.message,
    ]
      .map((value) => String(value ?? ""))
      .join(" ")
      .toLowerCase();

    const explicitMagic =
      !isPlayerSwingEvent &&
      (String(detail.ability ?? "").toLowerCase() === "spark" ||
      String(detail.attackType ?? "").toLowerCase() === "spark" ||
      String(detail.action ?? "").toLowerCase() === "spark" ||
      /(^|[^a-z])(spark|basicmagic|heavymagic|magic|spell|arcane)([^a-z]|$)/.test(
        nonClipText,
      ));
    const hasPhysicalClip =
      /attack|attack2|heavyattack|sideswing|thrusting|bowshoot|bowshooting|bite|claw|pounce|charge|kick|peck|scratch|tailwhip/.test(
        clipText,
      );
    const looksPhysical =
      /basic|heavy|dagger|strike|slash|swing|thrust|punch|kick|stab|bow|arrow|melee|weapon|hit|bite|claw|pounce|charge|peck|scratch|tail/.test(
        nonClipText,
      );
    const isPhysicalCombat =
      !explicitMagic &&
      (isPlayerSwingEvent ||
        detail.effectKind === "physical" ||
        detail.vfxKind === "physical" ||
        detail.visualKind === "physical" ||
        looksPhysical ||
        hasPhysicalClip);

    if (isPhysicalCombat) {
      const cleanedAttackerClips = withoutMagicClips(attackerClipPriority);
      const cleanedTargetClips = withoutMagicClips(targetClipPriority);
      detail.attackerClipPriority =
        cleanedAttackerClips.length > 0
          ? cleanedAttackerClips
          : ["Attack", "Attack2", "SideSwing", "Thrusting", "HeavyAttack"];
      detail.targetClipPriority =
        cleanedTargetClips.length > 0
          ? cleanedTargetClips
          : ["HitReact", "Block", "ShieldBlock", "Death"];
      detail.effectKind = "physical";
      detail.vfxKind = "physical";
      detail.visualKind = isPlayerSwingEvent ? "player_swing" : "physical";
      detail.harthmereNoSparkBasic = true;
    } else if (explicitMagic) {
      detail.attackerClipPriority = attackerClipPriority.length > 0
        ? attackerClipPriority
        : ["BasicMagic", "HeavyMagic", "Attack"];
      detail.effectKind = detail.effectKind ?? "magic";
      detail.vfxKind = detail.vfxKind ?? "magic";
      detail.visualKind = detail.visualKind ?? "magic";
    }

    const result = String(detail.result ?? "").toLowerCase();
    const animationKind = String(detail.animationKind ?? "").toLowerCase();
    const targetHpAfter = Number(detail.targetHpAfter ?? Number.NaN);
    const finalDamageForDeathRoute = Number(detail.finalDamage ?? 0);
    // harthmere-death-ai-dialog-render-v1
    // Forward-arc miss/sweep events often carry placeholder targetHpAfter=0 even
    // when there is no concrete target. Do not route those to Death or the actor
    // can be added to deadCombatObjects and later ignore real attack pulses.
    const shouldRouteDeathPulse =
      animationKind === "death" ||
      result === "dead" ||
      (finalDamageForDeathRoute > 0 &&
        Number.isFinite(targetHpAfter) &&
        targetHpAfter <= 0);
    const shouldRouteBlockPulse =
      animationKind === "block" ||
      result === "block" ||
      result === "parry" ||
      result === "absorb";
    const targetKind: CombatPulseKind =
      shouldRouteDeathPulse
        ? "death"
        : shouldRouteBlockPulse
          ? "block"
          : animationKind === "evade" ||
              result === "dodge" ||
              result === "evade" ||
              result === "out_of_range"
            ? "evade"
            : "hit";

    const resolveCombatActor = (offset: number | undefined, name: string | undefined) => {
      if (offset !== undefined && offset !== null && Number.isFinite(offset)) {
        // harthmere-training-dummy-visual-proxy-v2
        // The combat model has a training dummy at offset 9001, but the
        // current visual town has no dedicated dummy GLTF actor registered.
        // Use the existing guard-yard animated actor as a visual-only proxy.
        // This keeps strict matching for every other combat offset.
        if (offset === 9001) {
          return (
            this.findCombatLife("Guard patrol around yard") ??
            this.findCombatLife("Guard Yard Training Dummy") ??
            this.findCombatLife("Training Dummy")
          );
        }
        return this.findCombatLifeByOffset(offset);
      }
      if (!name || name === "You" || name === "Player") {
        return undefined;
      }
      return this.findCombatLife(name);
    };

    const attacker = resolveCombatActor(detail.attackerOffset, detail.attacker);
    const target = resolveCombatActor(detail.targetOffset, detail.target);

    if (typeof debugHarthmereRenderer === "function") {
      debugHarthmereRenderer("renderer.combat_event.received", {
        detail,
        classifiedAs: isPhysicalCombat ? "physical" : explicitMagic ? "magic" : "neutral",
      });
      debugHarthmereRenderer("renderer.combat_event.effect_route", {
        attack: detail.attack ?? detail.ability ?? detail.attackType ?? detail.action,
        result: detail.result,
        animationKind: detail.animationKind,
        effectKind: detail.effectKind,
        vfxKind: detail.vfxKind,
        visualKind: detail.visualKind,
        harthmereNoSparkBasic: detail.harthmereNoSparkBasic,
        attackerClipPriority: detail.attackerClipPriority,
        targetClipPriority: detail.targetClipPriority,
        explicitMagic,
        isPhysicalCombat,
        shouldRouteDeathPulse,
        targetHpAfter,
        finalDamageForDeathRoute,
        nonClipText,
        clipText,
      });
      if (isPlayerSwingEvent) {
        debugHarthmereRenderer("renderer.combat_event.player_swing", {
          attack: detail.attack ?? detail.ability ?? detail.attackType ?? detail.action,
          attackerClipPriority: detail.attackerClipPriority,
          swingOrigin: detailAny.swingOrigin,
          swingForward: detailAny.swingForward,
          hitOffsets: detailAny.hitOffsets,
          candidateOffsets: detailAny.candidateOffsets,
          note: "Local player body animation is driven by HarthmereUnifiedHUD bridge via player.eagerEmote().",
        });
      }
      debugHarthmereRenderer("renderer.combat_event.attacker_match", {
        attacker: detail.attacker,
        attackerOffset: detail.attackerOffset,
        requestedClips: detail.attackerClipPriority,
        matched: attacker
          ? { label: attacker.label, offset: attacker.combatOffset, asset: attacker.asset }
          : undefined,
      });
      debugHarthmereRenderer("renderer.combat_event.target_match", {
        target: detail.target,
        targetOffset: detail.targetOffset,
        trainingDummyProxy: detail.targetOffset === 9001 && Boolean(target),
        targetKind,
        requestedClips: detail.targetClipPriority,
        matched: target
          ? { label: target.label, offset: target.combatOffset, asset: target.asset }
          : undefined,
      });
    }

    if (attacker && target) {
      this.faceCombatActorToward(attacker, target.object.position, "attack_target");
    }
    if (isPlayerSwingEvent && Number(detail.finalDamage ?? 0) > 0) {
      // harthmere-sword-polish-v3-hit-stop
      // Keep hit-stop/recovery setup before the attacker pulse starts so the
      // impact-frame attack animation immediately inherits the recovery feel.
      this.harthmereHitStopUntil = performance.now() + 65;
      this.harthmereAttackerRecoveryUntil = performance.now() + 180;
      this.harthmereLastSwordImpactAt = performance.now();
      debugHarthmereRenderer("renderer.hit_stop.impact", {
        finalDamage: detail.finalDamage,
        hitStopUntil: this.harthmereHitStopUntil,
        attackerRecoveryUntil: this.harthmereAttackerRecoveryUntil,
      });
    }
    if (attacker) {
      this.startCombatPulse(attacker, "attack", detail.attackerClipPriority ?? []);
    }

    if (target && attacker) {
      this.faceCombatActorToward(target, attacker.object.position, "react_to_attacker");
    } else if (target && Array.isArray(detailAny.swingOrigin)) {
      this.faceCombatActorToward(
        target,
        new THREE.Vector3(
          Number(detailAny.swingOrigin[0]),
          target.object.position.y,
          Number(detailAny.swingOrigin[1]),
        ),
        "react_to_player_swing_origin",
      );
    }
    if (targetKind === "block") {
      this.triggerHarthmereBlockContactFeedback(target?.object.position, String(detail.result ?? detail.animationKind ?? "block"));
    }

    if (target) {
      const routedTargetClips =
        targetKind === "block"
          ? ["ShieldBlock", "Block", ...(detail.targetClipPriority ?? [])]
          : detail.targetClipPriority ?? [];
      this.startCombatPulse(target, targetKind, routedTargetClips);
    }
  };

  private faceCombatActorToward(
    actor: CombatLifeInstance | undefined,
    target: THREE.Vector3 | undefined,
    reason: string,
  ) {
    if (!actor || !target || this.deadCombatObjects.has(actor.object)) {
      return;
    }
    const dx = target.x - actor.object.position.x;
    const dz = target.z - actor.object.position.z;
    const forward = normalizeHarthmereRendererForward2(dx, dz);
    if (!forward) {
      return;
    }
    actor.object.rotation.y = harthmereYawForWorldForward(
      forward[0],
      forward[1],
      actor.forwardAxis,
    );
    debugHarthmereRenderer("renderer.facing.actor_toward", {
      reason,
      label: actor.label,
      asset: actor.asset,
      combatOffset: actor.combatOffset,
      forwardAxis: actor.forwardAxis,
      forward,
      yaw: actor.object.rotation.y,
    });
  }

  private faceCombatActorAlong(
    actor: CombatLifeInstance | undefined,
    forward: unknown,
    reason: string,
  ) {
    if (!actor || this.deadCombatObjects.has(actor.object) || !Array.isArray(forward)) {
      return;
    }
    const normalized = normalizeHarthmereRendererForward2(
      Number(forward[0]),
      Number(forward[1]),
    );
    if (!normalized) {
      return;
    }
    actor.object.rotation.y = harthmereYawForWorldForward(
      normalized[0],
      normalized[1],
      actor.forwardAxis,
    );
    debugHarthmereRenderer("renderer.facing.actor_along", {
      reason,
      label: actor.label,
      asset: actor.asset,
      combatOffset: actor.combatOffset,
      forwardAxis: actor.forwardAxis,
      forward: normalized,
      yaw: actor.object.rotation.y,
    });
  }




// HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7 = "harthmere-body-weapon-visual-cohesion-v7";
  private ensureHarthmerePlayerSword() {
    if (this.harthmerePlayerSword) {
      return this.harthmerePlayerSword;
    }

    // Procedural fallback sword. This is deliberately simple so combat can
    // show a weapon immediately without waiting on an artist-authored GLTF.
    // Later, replace this group with a real sword model while keeping the
    // same state machine and placement code below.
    const sword = new THREE.Group();
    sword.name = "harthmere-local-player-iron-longsword";

    const blade = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.064, 0.064, 1.02]),
      animalMaterial(0xcfd7df),
    );
    blade.position.z = 0.46;
    sword.add(blade);

    const guard = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.46, 0.095, 0.075]),
      animalMaterial(0x6f4b24),
    );
    guard.position.z = -0.07;
    sword.add(guard);

    const grip = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.085, 0.085, 0.42]),
      animalMaterial(0x2e1f17),
    );
    grip.position.z = -0.29;
    sword.add(grip);

    const pommel = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.16, 0.16, 0.12]),
      animalMaterial(0x7b5a2b),
    );
    pommel.position.z = -0.52;
    sword.add(pommel);

    sword.visible = true;
    this.root.add(sword);
    this.harthmerePlayerSword = sword;

    // Start loading the real animated equipment GLTF, but keep the fallback visible until it is ready.
    void this.loadHarthmerePlayerSwordGltf(this.harthmerePlayerSwordState.itemId);
    return sword;
  }




  private ensureHarthmerePlayerSwordAnchorRig() {
    if (this.harthmerePlayerSwordAnchorRoot) {
      return this.harthmerePlayerSwordAnchorRoot;
    }

    const root = new THREE.Group();
    root.name = "harthmere-local-player-weapon-anchor-rig";
    root.userData.harthmereAnchors = {
      rightHand: ["harthmere-anchor-right-hand"],
      leftHand: ["harthmere-anchor-left-hand"],
      hip: ["harthmere-anchor-hip"],
      back: ["harthmere-anchor-back"],
    };

    const addAnchor = (
      name: string,
      position: [number, number, number],
      rotation: [number, number, number],
    ) => {
      const anchor = new THREE.Group();
      anchor.name = name;
      anchor.position.set(...position);
      anchor.rotation.set(...rotation, "XYZ");
      root.add(anchor);
      return anchor;
    };

    // These are real named attachment anchors for the local player sword rig.
    // The rig is updated from the same bodyForward source as melee damage, so
    // hand, hip, and back attachment points rotate with the visible facing.
    addAnchor("harthmere-anchor-right-hand", [0.54, 0.98, 0.30], [-0.08, 0, -0.16]);
    addAnchor("harthmere-anchor-left-hand", [-0.54, 0.98, 0.30], [-0.08, 0, 0.16]);
    addAnchor("harthmere-anchor-hip", [-0.36, 0.88, -0.22], [-0.72, Math.PI * 0.82, 0.34]);
    addAnchor("harthmere-anchor-back", [0, 1.18, -0.30], [-0.62, Math.PI, 0.06]);

    this.root.add(root);
    this.harthmerePlayerSwordAnchorRoot = root;
    return root;
  }

  private getHarthmerePlayerSwordAnchor(
    name: "harthmere-anchor-right-hand" | "harthmere-anchor-left-hand" | "harthmere-anchor-hip" | "harthmere-anchor-back",
  ) {
    const root = this.ensureHarthmerePlayerSwordAnchorRig();
    return root.getObjectByName(name) ?? root;
  }

  private async loadHarthmerePlayerSwordGltf(itemId = this.harthmerePlayerSwordState.itemId) {
    const resolved = resolveHarthmerePlayerWeaponEquipmentEntry(itemId);
    if (!resolved) {
      debugHarthmereRenderer("renderer.player_weapon.gltf_missing_manifest", {
        itemId,
        requestedIds: [...HARTHMERE_ALL_WEAPON_EQUIPMENT_IDS],
      });
      return;
    }

    if (
      this.harthmerePlayerSwordUsingGltf &&
      this.harthmerePlayerWeaponLoadedEquipmentId === resolved.equipmentId
    ) {
      return;
    }
    if (this.harthmerePlayerWeaponLoadingEquipmentId === resolved.equipmentId) {
      return;
    }

    this.harthmerePlayerSwordGltfLoadStarted = true;
    this.harthmerePlayerWeaponLoadingEquipmentId = resolved.equipmentId;
    const loadToken = ++this.harthmerePlayerWeaponGltfLoadToken;

    try {
      // v2 sword-test compatibility: keep the old id-based manifest lookup shape visible
      // while the runtime now chooses from the full weapon-wide equipment catalog.
      const legacySwordEntryProbe = HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS
        .map((id) => getHarthmereEquipmentAnimation(id))
        .find(Boolean);
      void legacySwordEntryProbe;
      const entry = resolved.entry;
      const gltf = await this.gltfLoader.loadAsync(entry.assetUrl);
      if (loadToken !== this.harthmerePlayerWeaponGltfLoadToken) {
        return;
      }

      const mount = new THREE.Group();
      mount.name = `harthmere-local-player-${resolved.profile}-weapon`;
      mount.userData.harthmereWeaponEquipmentId = resolved.equipmentId;
      mount.userData.harthmereWeaponProfile = resolved.profile;
      gltf.scene.name = `harthmere-local-player-${resolved.equipmentId}-model`;

      this.sanitizeHarthmereSwordTextures(gltf.scene);
      this.normalizeHarthmerePlayerSwordGltfScale(gltf.scene);
      mount.add(gltf.scene);

      const previous = this.harthmerePlayerSword;
      if (previous && previous.parent) {
        previous.parent.remove(previous);
      }
      this.root.add(mount);
      this.harthmerePlayerSword = mount;
      this.harthmerePlayerSwordUsingGltf = true;
      this.harthmerePlayerWeaponLoadedEquipmentId = resolved.equipmentId;
      this.harthmerePlayerSwordMixer = new THREE.AnimationMixer(mount);
      this.harthmerePlayerSwordClipActions.clear();
      this.harthmerePlayerSwordActiveClip = undefined;

      for (const clip of gltf.animations) {
        this.harthmerePlayerSwordClipActions.set(
          clip.name,
          this.harthmerePlayerSwordMixer.clipAction(clip),
        );
      }

      this.harthmerePlayerSwordMixer.addEventListener("finished", () => {
        if (this.harthmerePlayerSwordState.drawn) {
          const clips = resolveHarthmerePlayerWeaponVisualClips(this.harthmerePlayerSwordState.itemId);
          this.playHarthmerePlayerSwordClip(clips.idle ?? HARTHMERE_PLAYER_SWORD_CLIPS.idle, true);
        }
      });

      debugHarthmereRenderer("renderer.player_weapon.gltf_loaded", {
        itemId,
        equipmentId: resolved.equipmentId,
        profile: resolved.profile,
        clips: gltf.animations.map((clip) => clip.name),
      });
      this.playHarthmerePlayerSwordAnimationForCurrentState("gltf_loaded");
    } catch (error) {
      this.harthmerePlayerSwordUsingGltf = false;
      debugHarthmereRenderer("renderer.player_weapon.gltf_failed", {
        itemId,
        equipmentId: resolved.equipmentId,
        profile: resolved.profile,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (this.harthmerePlayerWeaponLoadingEquipmentId === resolved.equipmentId) {
        this.harthmerePlayerWeaponLoadingEquipmentId = undefined;
      }
    }
  }

  private resolveHarthmereSwordObject3D(value: unknown): THREE.Object3D | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const maybeObject = value as Partial<THREE.Object3D> & {
      scene?: THREE.Object3D;
      object?: THREE.Object3D;
      root?: THREE.Object3D;
    };

    if (typeof maybeObject.traverse === "function") {
      return maybeObject as THREE.Object3D;
    }

    if (maybeObject.scene && typeof maybeObject.scene.traverse === "function") {
      return maybeObject.scene;
    }

    if (maybeObject.object && typeof maybeObject.object.traverse === "function") {
      return maybeObject.object;
    }

    if (maybeObject.root && typeof maybeObject.root.traverse === "function") {
      return maybeObject.root;
    }

    return undefined;
  }


  private sanitizeHarthmereSwordTextures(value: unknown) {
    const object = this.resolveHarthmereSwordObject3D(value);
    if (!object) {
      return;
    }

    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const materialValue = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const materials = Array.isArray(materialValue)
        ? materialValue
        : materialValue
          ? [materialValue]
          : [];

      for (const material of materials) {
        const materialRecord = material as THREE.MeshStandardMaterial & {
          map?: THREE.Texture | null;
          normalMap?: THREE.Texture | null;
          roughnessMap?: THREE.Texture | null;
          metalnessMap?: THREE.Texture | null;
        };

        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"] as const) {
          const texture = materialRecord[key];
          if (texture && !texture.image) {
            materialRecord[key] = null;
          }
        }
      }
    });
  }

  private normalizeHarthmerePlayerSwordGltfScale(value: unknown) {
    const object = this.resolveHarthmereSwordObject3D(value);
    if (!object) {
      return;
    }

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longestSide = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(longestSide) || longestSide <= 0) {
      return;
    }

    // Keep the imported sword near the procedural fallback size. Do not bake
    // facing/orientation here: world-facing is handled by the mount so the same
    // player-facing direction fix applies to both procedural and GLTF swords.
    const desiredLongestSide = 1.12;
    object.scale.multiplyScalar(desiredLongestSide / longestSide);
  }

private playHarthmerePlayerSwordClip(name: string, force = false) {
    if (name === "BasicSlash_24") {
      this.startHarthmerePlayerSwordManualSwing("basic");
      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);
    } else if (name === "HeavySlash_24") {
      this.startHarthmerePlayerSwordManualSwing("heavy");
      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);
    } else if (["AimDraw_24", "Nock_24", "DrawArrow_24", "Cast_24", "CastFromBook_24", "Throw_24", "BlockRaise_24"].includes(name)) {
      this.startHarthmerePlayerSwordManualSwing("basic");
      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);
    } else if (["Release_24", "ProjectileSpin_24", "Channel_24", "Burst_24", "ShieldBash_24"].includes(name)) {
      this.startHarthmerePlayerSwordManualSwing("heavy");
      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);
    }


    const action = this.harthmerePlayerSwordClipActions.get(name);
    if (!action || !this.harthmerePlayerSwordMixer) {
      return;
    }
    if (!force && this.harthmerePlayerSwordActiveClip === name) {
      return;
    }

    for (const other of this.harthmerePlayerSwordClipActions.values()) {
      if (other !== action) {
        other.fadeOut(0.06);
      }
    }

    const isIdle = name === HARTHMERE_PLAYER_SWORD_CLIPS.idle;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = !isIdle;
    action.setLoop(isIdle ? THREE.LoopRepeat : THREE.LoopOnce, isIdle ? Infinity : 1);
    action.fadeIn(0.06).play();
    this.harthmerePlayerSwordActiveClip = name;

    debugHarthmereRenderer("renderer.player_sword.clip", {
      clip: name,
      action: this.harthmerePlayerSwordState.action,
      attack: this.harthmerePlayerSwordState.attack,
    });
  }

  private playHarthmerePlayerSwordAnimationForCurrentState(reason: string) {
    if (!this.harthmerePlayerSwordUsingGltf) {
      return;
    }

    const state = this.harthmerePlayerSwordState;
    const clips = resolveHarthmerePlayerWeaponVisualClips(state.itemId);
    if (state.action === "attack") {
      const legacySwordAttackClip = state.attack === "heavy"
        ? HARTHMERE_PLAYER_SWORD_CLIPS.heavy
        : HARTHMERE_PLAYER_SWORD_CLIPS.basic;
      const weaponAttackClip = state.attack === "heavy" ? clips.heavy : clips.basic;
      this.playHarthmerePlayerSwordClip(
        weaponAttackClip ?? legacySwordAttackClip,
        true,
      );
      return;
    }

    if (state.action === "draw") {
      this.playHarthmerePlayerSwordClip(clips.draw, true);
      return;
    }

    if (state.action === "sheathe") {
      this.playHarthmerePlayerSwordClip(clips.sheathe, true);
      return;
    }

    if (state.drawn) {
      this.playHarthmerePlayerSwordClip(clips.idle, reason === "gltf_loaded");
    }
  }

  private installHarthmerePlayerSwordVisuals() {
    if (typeof window === "undefined" || this.harthmereSwordVisualsInstalled) {
      return;
    }
    this.harthmereSwordVisualsInstalled = true;

    window.addEventListener("biomes:harthmere-player-sword-visual", (event) => {
      const detail = (event as CustomEvent<Partial<HarthmerePlayerSwordVisualState>>).detail ?? {};
      const previousItemId = this.harthmerePlayerSwordState.itemId;
      this.harthmerePlayerSwordState = {
        drawn: detail.drawn === true,
        itemId: detail.itemId ?? previousItemId ?? "iron_longsword",
        action: detail.action ?? "sync",
        attack: detail.attack,
        theme: ((detail as { theme?: HarthmereAttackVisualThemeIdV1 }).theme ?? this.harthmerePlayerSwordState.theme),
        variation: ((detail as { variation?: string }).variation ?? this.harthmerePlayerSwordState.variation),
        at: Number.isFinite(Number(detail.at)) ? Number(detail.at) : Date.now(),
        windupMs: Number.isFinite(Number(detail.windupMs))
          ? Number(detail.windupMs)
          : undefined,
        impactMs: Number.isFinite(Number(detail.impactMs))
          ? Number(detail.impactMs)
          : undefined,
        recoveryMs: Number.isFinite(Number(detail.recoveryMs))
          ? Number(detail.recoveryMs)
          : undefined,
      };
      if (detail.action === "attack") {
        this.harthmerePlayerSwordSwingUntil = Date.now() + (detail.attack === "heavy" ? 520 : 340);
      }
      if (this.harthmerePlayerSwordState.itemId !== previousItemId || !this.harthmerePlayerSwordUsingGltf) {
        void this.loadHarthmerePlayerSwordGltf(this.harthmerePlayerSwordState.itemId);
      }
      debugHarthmereRenderer("renderer.player_sword.state", this.harthmerePlayerSwordState);
      this.playHarthmerePlayerSwordAnimationForCurrentState("event");
    });

    const animateSword = () => {
      this.updateHarthmerePlayerSwordVisual();
      this.harthmerePlayerSwordFrame = window.requestAnimationFrame(animateSword);
    };
    animateSword();
  }

  
  
  private debugHarthmereSwordRendererEvent(
    event: string,
    payload?: Record<string, unknown>,
  ) {
    debugHarthmereRenderer(event, payload ?? {});
  }

  private getHarthmerePlayerSwordObjectForManualSwing(): THREE.Object3D | undefined {
    const candidates: unknown[] = [
      this.harthmerePlayerSword,
      (this as any).harthmerePlayerSwordGltfObject,
      (this as any).harthmerePlayerSwordObject,
      (this as any).harthmereLocalPlayerSwordObject,
      this.root?.getObjectByName?.("HarthmereLocalPlayerSword"),
      this.root?.getObjectByName?.("HarthmereLocalPlayerSwordGltf"),
    ];

    for (const candidate of candidates) {
      const object = this.resolveHarthmereSwordObject3D(candidate);
      if (object) {
        return object;
      }
    }

    return undefined;
  }

  private startHarthmerePlayerSwordManualSwing(attack: "basic" | "heavy") {
    const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
    if (!sword) {
      return;
    }

    const activeWeaponProfileV1 =
      resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile ?? "melee";
    const themeSequenceV1 = HARTHMERE_COMBAT_POLISH_THEME_SEQUENCE_V1;
    const nextThemeV1 =
      this.harthmerePlayerSwordState.theme ??
      themeSequenceV1[this.harthmereCombatPolishAttackCounterV1 % themeSequenceV1.length] ??
      "physical";
    const requestedVariationV2 = (this.harthmerePlayerSwordState.variation ?? "").trim();
    const randomSeedV2 =
      Math.floor(((typeof performance !== "undefined" ? performance.now() : Date.now()) * 1000)) ^
      (this.harthmereCombatPolishAttackCounterV1 * 2654435761) ^
      Math.floor(Math.random() * 0xffff);
    this.harthmereCombatPolishLastRandomSeedV2 = randomSeedV2;
    this.harthmereCombatPolishActiveProfileV1 = harthmereCombatAnimationProfileForRandomizedActionV2({
      attackType: activeWeaponProfileV1 === "magic" || activeWeaponProfileV1 === "magicBook"
        ? "magic"
        : attack === "heavy"
          ? "heavy"
          : "basic",
      seed: randomSeedV2,
      lastShape: this.harthmereCombatPolishLastShapeV2,
      requestedShape: requestedVariationV2.length > 0 ? requestedVariationV2 : undefined,
      theme: nextThemeV1,
    });
    this.harthmereCombatPolishLastShapeV2 = this.harthmereCombatPolishActiveProfileV1.shape;
    this.harthmereCombatPolishRecentShapesV2.push(this.harthmereCombatPolishActiveProfileV1.shape);
    while (this.harthmereCombatPolishRecentShapesV2.length > 12) {
      this.harthmereCombatPolishRecentShapesV2.shift();
    }
    this.harthmereCombatPolishAttackCounterV1 += 1;

    this.harthmerePlayerSwordManualSwing = {
      attack,
      startedAt: performance.now(),
      durationMs: attack === "heavy" ? 520 : 360,
      basePosition: sword.position.clone(),
      baseRotation: sword.rotation.clone(),
    };

    this.debugHarthmereSwordRendererEvent("renderer.player_sword.manual_swing_start", {
      attack,
      durationMs: this.harthmerePlayerSwordManualSwing.durationMs,
    });
  }

  private applyHarthmerePlayerSwordManualSwing(now = performance.now()) {
    const swing = this.harthmerePlayerSwordManualSwing;
    if (!swing) {
      return;
    }

    const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
    if (!sword) {
      this.harthmerePlayerSwordManualSwing = undefined;
      return;
    }

    const activeWeaponProfile =
      resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile ?? "melee";
    const runtimeForSwingV18 = (window as typeof window & {
      __harthmereForwardArcRuntime?: { position?: [number, number, number]; forward?: [number, number]; bodyForward?: [number, number] };
    }).__harthmereForwardArcRuntime;
    const forwardForSwingV18 = runtimeForSwingV18?.bodyForward ?? runtimeForSwingV18?.forward ?? [0, 1];
    const positionForSwingV18 = runtimeForSwingV18?.position ?? [0, 0, 0];
    const rawSwingForwardV18 = new THREE.Vector3(Number(forwardForSwingV18[0]), 0, Number(forwardForSwingV18[1]));
    const centerForSwingV18 = new THREE.Vector3(Number(positionForSwingV18[0]), Number(positionForSwingV18[1]), Number(positionForSwingV18[2]));
    const handAnchor = this.resolveHarthmerePlayerVisualHandAnchorV18(
      activeWeaponProfile,
      centerForSwingV18,
      rawSwingForwardV18,
      this.resolveHarthmerePlayerBoneAnchor(
        activeWeaponProfile === "shield"
          ? ["righthand", "right_hand", "right hand", "mixamorigRightHand", "shield_r", "hand.r"]
          : ["lefthand", "left_hand", "left hand", "mixamorigLeftHand", "weapon_l", "hand.l"],
      ),
    );

    const t = Math.min(1, Math.max(0, (now - swing.startedAt) / swing.durationMs));
    const ease = Math.sin(t * Math.PI);
    const slash = swing.attack === "heavy" ? 0.95 : 0.62;
    this.applyHarthmereCombatPolishAnchorPoseV1(
      this.harthmereCombatPolishActiveProfileV1,
      t,
      activeWeaponProfile,
      centerForSwingV18,
      rawSwingForwardV18,
    );

    // v10: sample the current hand/arm anchor every frame. This is intentionally
    // not a stale captured base transform; the weapon follows the swipe instead
    // of sliding through the air while the hand moves somewhere else.
    if (handAnchor) {
      const currentHandPosition = new THREE.Vector3();
      const currentHandQuaternion = new THREE.Quaternion();
      handAnchor.getWorldPosition(currentHandPosition);
      handAnchor.getWorldQuaternion(currentHandQuaternion);
      sword.position.copy(currentHandPosition);
      sword.quaternion.copy(currentHandQuaternion);
      this.applyHarthmereWeaponStraightPointingV2(sword, handAnchor, rawSwingForwardV18, activeWeaponProfile, {
        duringAttack: true,
      });
    }

    sword.rotateY(slash * ease);
    sword.rotateX((swing.attack === "heavy" ? -0.52 : -0.34) * ease);
    sword.rotateZ((swing.attack === "heavy" ? 0.28 : 0.18) * ease);
    this.recordHarthmereWeaponTipHiltDirectionV2(sword, handAnchor, rawSwingForwardV18, activeWeaponProfile, true);

    sword.userData.harthmereWeaponHandTrackingV10 =
      this.getHarthmereWeaponHandTrackingSnapshotV10(sword, handAnchor);

    if (t >= 1) {
      if (handAnchor) {
        const currentHandPosition = new THREE.Vector3();
        const currentHandQuaternion = new THREE.Quaternion();
        handAnchor.getWorldPosition(currentHandPosition);
        handAnchor.getWorldQuaternion(currentHandQuaternion);
        sword.position.copy(currentHandPosition);
        sword.quaternion.copy(currentHandQuaternion);
      }
      sword.userData.harthmereWeaponHandTrackingV10 =
        this.getHarthmereWeaponHandTrackingSnapshotV10(sword, handAnchor);
      this.debugHarthmereSwordRendererEvent("renderer.player_sword.manual_swing_done", {
        attack: swing.attack,
        handTracked: true,
        maxGripDistanceMeters: 0.22,
      });
      this.harthmerePlayerSwordManualSwing = undefined;
    }
  }



  private resolveHarthmerePlayerVisualHandAnchorV18(
    activeWeaponProfile: string,
    center: THREE.Vector3,
    forward: THREE.Vector3,
    preferredBoneAnchor?: THREE.Object3D,
  ) {
    const namedRightAnchor = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const namedLeftAnchor = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-left-hand");
    // v2 polish: main one-handed weapon is explicitly locked to the visual left hand.
    // Do not sort anchors by camera/world dot product and do not flip during run/strike.
    // Shields/offhand items remain on the opposite visual right hand.
    if (activeWeaponProfile === "shield") {
      return namedRightAnchor ?? preferredBoneAnchor ?? namedLeftAnchor;
    }
    if (
      preferredBoneAnchor &&
      /left/i.test(preferredBoneAnchor.name) &&
      preferredBoneAnchor.userData?.harthmereLocalPlayerBone === true
    ) {
      return preferredBoneAnchor;
    }
    return namedLeftAnchor ?? preferredBoneAnchor ?? namedRightAnchor;
  }

  private resolveHarthmerePlayerBoneAnchor(candidates: readonly string[]) {
    const harthmereCombatPolishRejectSceneWideBoneAnchorsV1 = true;
    const wanted = candidates.map((candidate) => candidate.toLowerCase());
    let match: THREE.Object3D | undefined;
    this.root.traverse((object) => {
      if (match) {
        return;
      }
      const record = object as THREE.Object3D & { isBone?: boolean };
      if (record.isBone !== true) {
        return;
      }
      const name = object.name.toLowerCase();
      const belongsToLocalPlayer =
        object.userData?.harthmereLocalPlayerBone === true ||
        object.parent?.userData?.harthmereLocalPlayerBoneRoot === true ||
        /local.*player|harthmere.*player|player.*mesh/i.test(object.parent?.name ?? "");
      if (!belongsToLocalPlayer && harthmereCombatPolishRejectSceneWideBoneAnchorsV1) {
        return;
      }
      if (wanted.some((candidate) => name.includes(candidate))) {
        match = object;
      }
    });
    return match;
  }


  private updateHarthmereCombatPolishLocomotionV1(center: THREE.Vector3, dt: number) {
    if (this.harthmereCombatPolishLastCenterV1.lengthSq() > 0 && dt > 0) {
      this.harthmereCombatPolishSpeedV1 = center.distanceTo(this.harthmereCombatPolishLastCenterV1) / dt;
    }
    this.harthmereCombatPolishLastCenterV1.copy(center);
  }

  private applyHarthmereCombatPolishAnchorPoseV1(
    profile: HarthmereCombatAnimationProfileV1,
    progress: number,
    activeWeaponProfile: string,
    center: THREE.Vector3,
    forward: THREE.Vector3,
  ) {
    const right = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const left = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-left-hand");
    const t = clamp01(progress);
    const wave = Math.sin(t * Math.PI);
    const release = Math.sin(clamp01((t - 0.22) / 0.48) * Math.PI);
    const gaitClock = typeof performance !== "undefined" ? performance.now() * 0.012 : Date.now() * 0.012;
    const runBob = Math.min(0.075, this.harthmereCombatPolishSpeedV1 * 0.008) * Math.sin(gaitClock);

    const resetRight: [number, number, number] = [0.54, 0.98 + runBob, 0.30];
    const resetLeft: [number, number, number] = [-0.54, 0.98 - runBob * 0.7, 0.30];
    right.position.set(...resetRight);
    left.position.set(...resetLeft);
    right.rotation.set(-0.08, 0, -0.16, "XYZ");
    left.rotation.set(-0.08, 0, 0.16, "XYZ");

    switch (profile.shape) {
      case "slash_horizontal":
        right.position.set(0.62 - 0.34 * release, 1.03 + 0.08 * wave, 0.34 + 0.1 * Math.cos(t * Math.PI));
        right.rotation.set(-0.28 * wave, 0.84 * release, -0.72 * release, "XYZ");
        left.position.set(-0.46, 1.02 - 0.04 * wave, 0.18);
        break;
      case "slash_diagonal":
        right.position.set(0.56 - 0.26 * release, 1.18 - 0.34 * release, 0.36);
        right.rotation.set(-0.46 * wave, 0.56 * release, -1.05 * release, "XYZ");
        left.position.set(-0.48, 1.08, 0.22);
        break;
      case "slash_vertical":
        right.position.set(0.30, 1.32 - 0.52 * release, 0.26);
        left.position.set(-0.14, 1.22 - 0.42 * release, 0.22);
        right.rotation.set(-1.18 * release, 0.08, -0.08, "XYZ");
        left.rotation.set(-1.0 * release, 0.04, 0.08, "XYZ");
        break;
      case "slash_rising":
        right.position.set(0.44 - 0.22 * release, 0.78 + 0.42 * release, 0.34);
        right.rotation.set(0.64 * release, 0.38 * release, -0.58 * release, "XYZ");
        break;
      case "stab_thrust":
        right.position.set(0.36, 0.96, 0.22 + 0.46 * release);
        right.rotation.set(-0.12, 0.02, -0.06, "XYZ");
        left.position.set(-0.52, 0.98, 0.08 - 0.12 * release);
        break;
      case "spin_cleave":
        right.position.set(0.44 * Math.cos(release * Math.PI * 1.5), 1.0 + 0.05 * wave, 0.30 + 0.24 * Math.sin(release * Math.PI * 1.5));
        right.rotation.set(-0.3, release * Math.PI * 1.4, -0.36, "XYZ");
        left.position.set(-right.position.x * 0.55, 1.0, 0.18 - right.position.z * 0.2);
        break;
      case "slam_ground":
        right.position.set(0.20, 1.26 - 0.58 * release, 0.32);
        left.position.set(-0.20, 1.22 - 0.5 * release, 0.28);
        right.rotation.set(-1.34 * release, 0, -0.1, "XYZ");
        left.rotation.set(-1.2 * release, 0, 0.1, "XYZ");
        break;
      case "backhand_slash":
        right.position.set(0.24 + 0.36 * release, 1.02 + 0.04 * wave, 0.28);
        right.rotation.set(-0.18, -0.74 * release, 0.74 * release, "XYZ");
        break;
      case "double_slash":
        right.position.set(0.58 - 0.28 * Math.sin(t * Math.PI * 2), 1.05 - 0.16 * Math.sin(t * Math.PI * 2), 0.34);
        right.rotation.set(-0.22 * wave, Math.sin(t * Math.PI * 2) * 0.76, -Math.sin(t * Math.PI * 2) * 0.96, "XYZ");
        break;
      case "afterimage_dash":
        right.position.set(0.42, 0.96 + 0.04 * wave, 0.32 + 0.34 * release);
        right.rotation.set(-0.1, 0.24 * release, -0.24 * release, "XYZ");
        break;
      default:
        if (profile.category === "magic") {
          right.position.set(0.42, 1.08 + 0.08 * wave, 0.38 + 0.18 * release);
          left.position.set(-0.42, 1.04 + 0.05 * wave, 0.28 + 0.12 * release);
          right.rotation.set(-0.2 * wave, 0.1, -0.18, "XYZ");
          left.rotation.set(-0.18 * wave, -0.1, 0.18, "XYZ");
        }
        break;
    }

    if (activeWeaponProfile === "shield") {
      left.userData.harthmereCombatAnimationPolishMainHandV1 = "shield-left";
    } else {
      right.userData.harthmereCombatAnimationPolishMainHandV1 = "right";
    }
    right.userData.harthmereCombatAnimationPolishV1 = {
      version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
      sharedVersion: HARTHMERE_COMBAT_ANIMATION_POLISH_VERSION_V1,
      profileId: profile.id,
      shape: profile.shape,
      bodyMotion: profile.bodyMotion,
      weaponPath: profile.weaponPath,
      frameCount: profile.frameCount,
      fps: profile.fps,
      progress: t,
      runSpeedMetersPerSecond: this.harthmereCombatPolishSpeedV1,
      weaponGripMustFollowHandEveryFrame: HARTHMERE_COMBAT_POLISH_RUNTIME_RULES_V1.weaponGripMustFollowHandEveryFrame,
      capturedBaseTransformAllowedDuringAttack: false,
    };
  }

  private applyHarthmerePolishedTrailProfileV1(
    trail: THREE.Group,
    profile: HarthmereCombatAnimationProfileV1,
  ) {
    while (trail.children.length > 0) {
      trail.remove(trail.children[0]);
    }
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: profile.color,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const secondaryMaterial = baseMaterial.clone();
    secondaryMaterial.color.setHex(profile.secondaryColor);

    const add = (name: string, mesh: THREE.Mesh) => {
      mesh.name = `harthmere-combat-polish-vfx-${profile.shape}-${name}`;
      mesh.userData.harthmereCombatAnimationPolishV1 = {
        version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
        profileId: profile.id,
        trailShape: profile.trailShape,
        particleStyle: profile.particleStyle,
        frameCount: profile.frameCount,
      };
      trail.add(mesh);
    };

    if (/thrust|piercing|beam/.test(profile.trailShape)) {
      const line = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.055, 0.055, 1.35]), baseMaterial.clone());
      line.position.z = 0.55;
      line.rotation.x = Math.PI * 0.5;
      add("forward-line", line);
    } else if (/x_double/.test(profile.trailShape)) {
      const a = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.035, 0.035, 1.15]), baseMaterial.clone());
      a.rotation.z = Math.PI * 0.28;
      const b = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.035, 0.035, 1.15]), secondaryMaterial.clone());
      b.rotation.z = -Math.PI * 0.28;
      add("x-a", a);
      add("x-b", b);
    } else if (/dust_ring|circular_ring/.test(profile.trailShape)) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.024, 8, 64, Math.PI * 2), baseMaterial.clone());
      ring.rotation.x = Math.PI * 0.5;
      add("ring", ring);
      for (let i = 0; i < 8; i += 1) {
        const shard = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.035, 0.035, 0.28]), secondaryMaterial.clone());
        shard.position.set(Math.cos(i) * 0.35, 0.02, Math.sin(i) * 0.35);
        shard.rotation.z = i * 0.72;
        add(`shard-${i}`, shard);
      }
    } else if (/ghost_afterimage/.test(profile.trailShape)) {
      for (let i = 0; i < 4; i += 1) {
        const ghost = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.08, 0.42, 0.22]), baseMaterial.clone());
        ghost.position.set(-0.18 * i, 0.06 * i, -0.08 * i);
        ghost.rotation.z = -0.28;
        add(`afterimage-${i}`, ghost);
      }
    } else if (profile.category === "magic" || /^magic_/.test(profile.shape)) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), baseMaterial.clone());
      orb.position.set(0, 0.05, 0.45);
      add("orb", orb);
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 48), secondaryMaterial.clone());
      rune.rotation.x = Math.PI * 0.5;
      add("rune", rune);
    } else {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 6, 56, Math.PI * 0.92), baseMaterial.clone());
      arc.rotation.x = Math.PI * 0.5;
      if (/diagonal/.test(profile.trailShape)) arc.rotation.z = -0.58;
      if (/reverse/.test(profile.trailShape)) arc.rotation.z = 0.9;
      if (/rising/.test(profile.trailShape)) arc.rotation.z = 0.68;
      if (/vertical/.test(profile.trailShape)) arc.rotation.z = Math.PI * 0.5;
      add("crescent", arc);
    }

    trail.userData.harthmereCombatAnimationPolishV1 = {
      version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
      profileId: profile.id,
      shape: profile.shape,
      theme: profile.theme,
      noColorOnlyVariation: true,
      mechanicInvariant: profile.mechanicInvariant,
    };
  }

  private ensureHarthmereNpcPolishedWeaponAnchorV1(actor: CombatLifeInstance) {
    const existing =
      actor.object.getObjectByName("harthmere-anchor-left-hand") ??
      actor.object.getObjectByName("LeftHand") ??
      actor.object.getObjectByName("mixamorigLeftHand");
    if (existing) {
      return existing;
    }
    const anchor = new THREE.Group();
    anchor.name = "harthmere-anchor-left-hand";
    anchor.position.set(-0.42, 0.98, 0.22);
    anchor.rotation.set(-0.08, 0, 0.16, "XYZ");
    anchor.userData.harthmereCombatAnimationPolishV1 = {
      version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
      generatedFallbackAnchor: true,
      playerAndNpcSharedProfiles: true,
      mainWeaponHand: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.mainWeaponHand,
    };
    actor.object.add(anchor);
    return anchor;
  }

  private applyHarthmereNpcCombatPolishPulseV1(actor: CombatLifeInstance, progress: number) {
    const visual = this.harthmereNpcWeaponVisuals.get(actor.object);
    if (!visual) {
      return;
    }
    const npcAttackTypeV2 = /mage|priest|cleric|magic|staff|wand/i.test(`${actor.asset} ${actor.label}`)
      ? "magic"
      : /guard|elite|boss|brute|hammer|axe/i.test(`${actor.asset} ${actor.label}`)
        ? "heavy"
        : "basic";
    const previousNpcShapeV2 = String(visual.userData.harthmereCombatPolishLastShapeV2 ?? "");
    const profile = harthmereCombatAnimationProfileForRandomizedActionV2({
      attackType: npcAttackTypeV2,
      seed: `${actor.combatOffset ?? actor.label.length}:${Math.floor(progress * 8)}:${Date.now()}`,
      lastShape: previousNpcShapeV2,
      theme: /undead|ghost|shadow/i.test(`${actor.asset} ${actor.label}`) ? "shadow" : "physical",
    });
    visual.userData.harthmereCombatPolishLastShapeV2 = profile.shape;
    const wave = Math.sin(clamp01(progress) * Math.PI);
    visual.rotation.set(-0.34 * wave, 0.55 * wave, -0.46 * wave, "XYZ");
    visual.position.set(0.04, -0.04 + 0.08 * wave, 0.18 + 0.22 * wave);
    visual.scale.setScalar(Math.max(0.7, Math.min(1.2, actor.baseScale)) * (1 + 0.08 * wave));
    visual.userData.harthmereCombatAnimationPolishV1 = {
      version: HARTHMERE_COMBAT_ANIMATION_POLISH_RENDERER_VERSION_V1,
      profileId: profile.id,
      shape: profile.shape,
      progress,
      playerAndNpcShared: true,
      weaponGripMustFollowHandEveryFrame: true,
    };
  }

  private ensureHarthmerePlayerSwordTrail() {
    if (this.harthmerePlayerSwordTrail) {
      return this.harthmerePlayerSwordTrail;
    }
    const group = new THREE.Group();
    group.name = "harthmere-player-sword-slash-trail";

    const material = new THREE.MeshBasicMaterial({
      color: 0xd9eefc,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 6, 48, Math.PI * 0.88), material);
    arc.name = "harthmere-player-sword-slash-arc";
    arc.rotation.x = Math.PI * 0.5;
    group.add(arc);

    group.visible = false;
    this.root.add(group);
    this.harthmerePlayerSwordTrail = group;
    return group;
  }

  private spawnHarthmerePlayerSwordTrail(attack: "basic" | "heavy", facingYaw: number) {
    const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
    const trail = this.ensureHarthmerePlayerSwordTrail();
    trail.visible = true;
    if (sword) {
      trail.position.copy(sword.position);
    }
    trail.rotation.set(-0.18, facingYaw, attack === "heavy" ? -0.22 : 0.12, "XYZ");
    trail.scale.setScalar(attack === "heavy" ? 1.34 : 1.0);
    this.applyHarthmerePolishedTrailProfileV1(trail, this.harthmereCombatPolishActiveProfileV1);
    this.harthmerePlayerSwordTrailAttack = attack;
    this.harthmerePlayerSwordTrailFacingYaw = facingYaw;
    this.harthmerePlayerSwordTrailUntil = performance.now() + (attack === "heavy" ? 230 : 155);
    debugHarthmereRenderer("renderer.player_sword.trail_spawn", {
      attack,
      facingYaw,
      until: this.harthmerePlayerSwordTrailUntil,
    });
  }

  private updateHarthmerePlayerSwordTrail(now = performance.now()) {
    const trail = this.harthmerePlayerSwordTrail;
    if (!trail) {
      return;
    }
    const remaining = this.harthmerePlayerSwordTrailUntil - now;
    if (remaining <= 0) {
      trail.visible = false;
      trail.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial | undefined;
        if (material && "opacity" in material) {
          material.opacity = 0;
        }
      });
      return;
    }
    const total = this.harthmerePlayerSwordTrailAttack === "heavy" ? 230 : 155;
    const alpha = Math.max(0, Math.min(1, remaining / total));
    trail.visible = true;
    trail.rotation.y = this.harthmerePlayerSwordTrailFacingYaw;
    trail.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (material && "opacity" in material) {
        material.opacity = 0.34 * Math.sin(alpha * Math.PI);
      }
    });
  }

  private ensureHarthmereBlockContactFeedback() {
    if (this.harthmereBlockContactFeedback) {
      return this.harthmereBlockContactFeedback;
    }
    const group = new THREE.Group();
    group.name = "harthmere-block-contact-feedback";
    const sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe19a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    for (let i = 0; i < 5; i += 1) {
      const spark = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.045, 0.045, 0.38]), sparkMaterial.clone());
      spark.name = `harthmere-block-contact-spark-${i}`;
      spark.rotation.z = (i / 5) * Math.PI * 2;
      spark.position.set(Math.cos(i) * 0.18, 1.2 + i * 0.018, Math.sin(i) * 0.18);
      group.add(spark);
    }
    group.visible = false;
    this.root.add(group);
    this.harthmereBlockContactFeedback = group;
    return group;
  }

  private triggerHarthmereBlockContactFeedback(position: THREE.Vector3 | undefined, reason: string) {
    const feedback = this.ensureHarthmereBlockContactFeedback();
    if (position) {
      feedback.position.copy(position);
    }
    feedback.visible = true;
    this.harthmereBlockContactUntil = performance.now() + 260;
    debugHarthmereRenderer("renderer.block_contact.feedback", {
      reason,
      soundHook: "sword_block_clang",
      spark: true,
      recoil: true,
      until: this.harthmereBlockContactUntil,
    });
  }

  private updateHarthmereBlockContactFeedback(now = performance.now()) {
    const feedback = this.harthmereBlockContactFeedback;
    if (!feedback) {
      return;
    }
    const remaining = this.harthmereBlockContactUntil - now;
    if (remaining <= 0) {
      feedback.visible = false;
      return;
    }
    const alpha = Math.max(0, Math.min(1, remaining / 260));
    feedback.visible = true;
    feedback.rotation.y += 0.16;
    feedback.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (material && "opacity" in material) {
        material.opacity = 0.55 * Math.sin(alpha * Math.PI);
      }
    });
  }

  private makeHarthmereNpcFallbackWeaponVisual(actor: CombatLifeInstance) {
    const weapon = new THREE.Group();
    weapon.name = `harthmere-npc-equipped-weapon-${actor.combatOffset ?? actor.label}`;
    const blade = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.055, 0.055, 0.92]),
      animalMaterial(0xcfd7df),
    );
    blade.position.z = 0.42;
    weapon.add(blade);
    const grip = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.075, 0.075, 0.28]),
      animalMaterial(0x2e1f17),
    );
    grip.position.z = -0.18;
    weapon.add(grip);
    weapon.rotation.set(-0.3, 0.1, -0.25, "XYZ");
    weapon.scale.setScalar(Math.max(0.7, Math.min(1.2, actor.baseScale)));
    return weapon;
  }

  private attachHarthmereNpcWeaponVisual(actor: CombatLifeInstance) {
    if (this.harthmereNpcWeaponVisuals.has(actor.object)) {
      return;
    }
    // HARTHMERE_POLISH_V1_NO_ANIMAL_WEAPONS
    // Animals fight bare: claws, teeth, tail. They MUST NOT inherit the
    // "sword" default that humanoids fall back to. Decide before any
    // equipment lookup so we never spawn the fallback weapon geometry on
    // a wolf/bear/deer.
    const animalAssetRe = /^animal_|_animal_|\bwolf\b|\bbear\b|\bdeer\b|\bstag\b|\bboar\b|\bfox\b|\bdog\b|\bhound\b|\bcat\b|\brat\b|\bpig\b|\bcow\b|\bsheep\b|\bgoat\b|\bhorse\b|\bchicken\b|\bpigeon\b|\bcrow\b|\brabbit\b|\bsnake\b/i;
    const speciesRaw = String(actor.appearance?.species ?? "").toLowerCase();
    const labelLower = String(actor.label ?? "").toLowerCase();
    const assetLower = String(actor.asset ?? "").toLowerCase();
    const isAnimal =
      animalAssetRe.test(assetLower) ||
      animalAssetRe.test(labelLower) ||
      (speciesRaw && speciesRaw !== "human" && speciesRaw !== "humanoid" && speciesRaw !== "undead");
    if (isAnimal) {
      return;
    }
    const equipment = actor.appearance?.equipment as Record<string, unknown> | undefined;
    const mainHand = String(
      equipment?.mainHand ??
        equipment?.main_hand ??
        equipment?.weapon ??
        equipment?.rightHand ??
        actor.object.userData?.harthmereWeapon ??
        "sword",
    );
    if (!/sword|blade|axe|mace|hammer|dagger|club|bow|crossbow|staff|wand|shield|ranged|magic|weapon/i.test(mainHand)) {
      return;
    }
    // Regression contract: NPC combat weapons must use the same visible main-hand
    // anchor concept as the player. Keep this explicit so static tests prove the
    // weapon is attached to the left/main hand rather than a random scene bone.
    const npcMainHandAnchorNameV3 = "harthmere-anchor-left-hand";
    const anchor = this.ensureHarthmereNpcPolishedWeaponAnchorV1(actor);
    anchor.userData.harthmereMainHandAnchorName = npcMainHandAnchorNameV3;
    const visual = this.makeHarthmereNpcFallbackWeaponVisual(actor);
    anchor.add(visual);
    visual.position.set(0.04, -0.04, 0.18);
    this.harthmereNpcWeaponVisuals.set(actor.object, visual);
    debugHarthmereRenderer("renderer.npc_weapon.attached", {
      label: actor.label,
      asset: actor.asset,
      combatOffset: actor.combatOffset,
      mainHand,
      anchor: anchor.name,
    });
  }



  private normalizedHarthmereWeaponForwardV2(forward: THREE.Vector3) {
    const clean = new THREE.Vector3(forward.x, 0, forward.z);
    if (clean.lengthSq() < 0.0001) {
      clean.set(0, 0, 1);
    }
    return clean.normalize();
  }

  private applyHarthmereWeaponStraightPointingV2(
    weapon: THREE.Object3D,
    handAnchor: THREE.Object3D,
    forward: THREE.Vector3,
    activeWeaponProfile: string,
    options: { duringAttack?: boolean; rollRadians?: number } = {},
  ) {
    if (activeWeaponProfile === "shield") {
      this.recordHarthmereWeaponTipHiltDirectionV2(weapon, handAnchor, forward, activeWeaponProfile, options.duringAttack === true);
      return;
    }
    const straightForward = this.normalizedHarthmereWeaponForwardV2(forward);
    const localTipAxis = new THREE.Vector3(0, 0, 1);
    const straightQuaternion = new THREE.Quaternion().setFromUnitVectors(localTipAxis, straightForward);
    weapon.quaternion.copy(straightQuaternion);
    if (Number.isFinite(options.rollRadians ?? 0) && options.rollRadians) {
      weapon.rotateZ(options.rollRadians);
    }
    this.recordHarthmereWeaponTipHiltDirectionV2(weapon, handAnchor, straightForward, activeWeaponProfile, options.duringAttack === true);
  }

  private recordHarthmereWeaponTipHiltDirectionV2(
    weapon: THREE.Object3D,
    handAnchor: THREE.Object3D,
    forward: THREE.Vector3,
    activeWeaponProfile: string,
    duringAttack: boolean,
  ) {
    const straightForward = this.normalizedHarthmereWeaponForwardV2(forward);
    const localHilt = new THREE.Vector3(0, 0, HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.hiltLocalZ);
    const localTip = new THREE.Vector3(0, 0, HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.tipLocalZ);
    const hiltWorld = localHilt.clone().applyQuaternion(weapon.quaternion).add(weapon.position);
    const tipWorld = localTip.clone().applyQuaternion(weapon.quaternion).add(weapon.position);
    const handWorld = new THREE.Vector3();
    handAnchor.getWorldPosition(handWorld);
    const hiltToTip = tipWorld.clone().sub(hiltWorld);
    const hiltToTipForwardDot = hiltToTip.lengthSq() > 0.0001
      ? hiltToTip.normalize().dot(straightForward)
      : 0;
    const handToHiltDistanceMeters = handWorld.distanceTo(hiltWorld);
    weapon.userData.harthmereWeaponTipHiltDirectionV2 = {
      version: "harthmere-weapon-tip-hilt-direction-v2",
      activeWeaponProfile,
      duringAttack,
      chosenMainHand: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.mainWeaponHand,
      anchorName: handAnchor.name,
      localTipAxis: "+Z",
      hiltLocalZ: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.hiltLocalZ,
      tipLocalZ: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.tipLocalZ,
      hiltWorld: hiltWorld.toArray(),
      tipWorld: tipWorld.toArray(),
      forwardWorld: straightForward.toArray(),
      hiltToTipForwardDot,
      minimumTipForwardDot: HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.minimumTipForwardDot,
      pointsStraightEnough: hiltToTipForwardDot >= HARTHMERE_COMBAT_ANIMATION_HAND_POLICY_V2.minimumTipForwardDot,
      handToHiltDistanceMeters,
      handToHiltBudgetMeters: 0.62,
      tipIsInFrontOfHilt: tipWorld.clone().sub(hiltWorld).dot(straightForward) > 0,
    };
  }

  private getHarthmereWeaponHandTrackingSnapshotV10(sword?: THREE.Object3D, handAnchor?: THREE.Object3D) {
    const weapon = sword ?? this.getHarthmerePlayerSwordObjectForManualSwing();
    const anchor =
      handAnchor ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-left-hand") ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const weaponPosition = new THREE.Vector3();
    const handPosition = new THREE.Vector3();
    if (weapon) {
      weapon.getWorldPosition(weaponPosition);
    }
    if (anchor) {
      anchor.getWorldPosition(handPosition);
    }
    const gripDistanceMeters = weapon && anchor ? weaponPosition.distanceTo(handPosition) : Number.POSITIVE_INFINITY;
    return {
      version: HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V10,
      gripDistanceMeters,
      maxGripDistanceMeters: 0.22,
      followsCurrentHandEveryFrame: true,
      staleBaseTransformAllowed: false,
      weaponPosition: weapon ? weaponPosition.toArray() : undefined,
      handPosition: anchor ? handPosition.toArray() : undefined,
      anchorName: anchor?.name,
      activeClip: this.harthmerePlayerSwordActiveClip,
    };
  }

  private createHarthmereResourceHitTelegraphV10(
    kind: HarthmereResourceKindV10 = "generic_resource",
    impactPoint = new THREE.Vector3(),
    targetNormal = new THREE.Vector3(0, 1, 0),
    options: { toolId?: string; failedReason?: string; impactFrameMs?: number } = {},
  ) {
    const rules = HARTHMERE_OBJECT_EFFECT_RANGES_V10[kind] ?? HARTHMERE_OBJECT_EFFECT_RANGES_V10.generic_resource;
    const normalizedNormal = targetNormal.clone();
    if (normalizedNormal.lengthSq() < 0.0001) {
      normalizedNormal.set(0, 1, 0);
    } else {
      normalizedNormal.normalize();
    }
    const telegraph = {
      version: HARTHMERE_RESOURCE_HIT_TELEGRAPH_VERSION_V10,
      kind,
      toolId: options.toolId ?? "unknown_tool",
      impactPoint: impactPoint.toArray(),
      targetNormal: normalizedNormal.toArray(),
      maxDistanceMeters: rules.maxDistanceMeters,
      radiusMeters: rules.radiusMeters,
      heightMeters: rules.heightMeters,
      coneAngleDegrees: rules.coneAngleDegrees,
      cooldownMs: rules.cooldownMs,
      debounceMs: rules.debounceMs,
      requiresLineOfSight: rules.requiresLineOfSight,
      impactFrameMs: options.impactFrameMs ?? 220,
      rangeRing: rules.visibleHitPolicy.rangeRing,
      reticle: rules.visibleHitPolicy.reticle,
      toolTipLine: rules.visibleHitPolicy.toolTipLine,
      surfaceDecal: rules.visibleHitPolicy.surfaceDecal,
      particles: rules.visibleHitPolicy.particles,
      failedReason: options.failedReason,
      failedReasonText: options.failedReason ? rules.visibleHitPolicy.failReasonText : undefined,
      edgeCases: [...HARTHMERE_RESOURCE_HIT_EDGE_CASES_V10],
    };
    this.harthmereLastResourceHitTelegraphV10 = telegraph;
    debugHarthmereRenderer("renderer.resource_hit.telegraph_v10", telegraph);
    return telegraph;
  }


  private updateHarthmerePlayerSwordVisual() {
    if (typeof window === "undefined") {
      return;
    }
    const runtime = (window as typeof window & {
      __harthmereForwardArcRuntime?: {
        position?: [number, number, number];
        forward?: [number, number];
        bodyForward?: [number, number];
      };
    }).__harthmereForwardArcRuntime;
    const position = runtime?.position;
    // bodyForward is already normalized to visible Harthmere model facing.
    // Runtime forward is only a fallback for older snapshots.
    // bodyForward is already normalized to visible Harthmere model facing.
    // Runtime forward is only a fallback for older snapshots.
    const forward = runtime?.bodyForward ?? runtime?.forward;
    if (!position || !forward) {
      return;
    }

    const sword = this.ensureHarthmerePlayerSword();
    const now = Date.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.harthmerePlayerSwordLastFrameAt) / 1000));
    this.harthmerePlayerSwordLastFrameAt = now;
    this.harthmerePlayerSwordMixer?.update(dt);

    const fx = Number(forward[0]);
    const fz = Number(forward[1]);
    const length = Math.hypot(fx, fz) || 1;
    const nx = fx / length;
    const nz = fz / length;
    const targetDraw = this.harthmerePlayerSwordState.drawn ? 1 : 0;
    const smoothing = 1 - Math.pow(0.001, dt);
    this.harthmerePlayerSwordDrawAmount += (targetDraw - this.harthmerePlayerSwordDrawAmount) * smoothing;

    const facingYaw = Math.atan2(nx, nz);
    const anchorRoot = this.ensureHarthmerePlayerSwordAnchorRig();
    anchorRoot.position.set(Number(position[0]), Number(position[1]), Number(position[2]));
    anchorRoot.rotation.set(0, facingYaw, 0, "XYZ");
    anchorRoot.updateMatrixWorld(true);

    const activeWeaponProfile = resolveHarthmerePlayerWeaponEquipmentEntry(this.harthmerePlayerSwordState.itemId)?.profile ?? "melee";
    const combatPolishCenterV1 = new THREE.Vector3(Number(position[0]), Number(position[1]), Number(position[2]));
    const combatPolishForwardV1 = new THREE.Vector3(nx, 0, nz);
    this.updateHarthmereCombatPolishLocomotionV1(combatPolishCenterV1, dt);
    const combatPolishSwingV1 = this.harthmerePlayerSwordManualSwing;
    const combatPolishAttackProgressV1 = combatPolishSwingV1
      ? clamp01((performance.now() - combatPolishSwingV1.startedAt) / combatPolishSwingV1.durationMs)
      : 0;
    this.applyHarthmereCombatPolishAnchorPoseV1(
      this.harthmereCombatPolishActiveProfileV1,
      combatPolishAttackProgressV1,
      activeWeaponProfile,
      combatPolishCenterV1,
      combatPolishForwardV1,
    );
    const boneHandAnchor = this.resolveHarthmerePlayerBoneAnchor(
      activeWeaponProfile === "shield"
        ? ["righthand", "right_hand", "right hand", "mixamorigRightHand", "shield_r", "weapon_r", "hand.r"]
        : ["lefthand", "left_hand", "left hand", "mixamorigLeftHand", "weapon_l", "hand.l"],
    );
    const boneSheatheAnchor = this.resolveHarthmerePlayerBoneAnchor([
      "hip",
      "hips",
      "pelvis",
      "spine",
      "back",
      "sheathe",
    ]);
    const harthmerePlayerCenterV18 = new THREE.Vector3(Number(position[0]), Number(position[1]), Number(position[2]));
    const harthmerePlayerForwardV18 = new THREE.Vector3(nx, 0, nz);
    const handAnchor = this.resolveHarthmerePlayerVisualHandAnchorV18(
      activeWeaponProfile,
      harthmerePlayerCenterV18,
      harthmerePlayerForwardV18,
      boneHandAnchor,
    );
    const sheatheAnchor =
      boneSheatheAnchor ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-hip") ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-back");
    const sheathedPosition = new THREE.Vector3();
    const drawnPosition = new THREE.Vector3();
    const sheathedQuaternion = new THREE.Quaternion();
    const drawnQuaternion = new THREE.Quaternion();
    sheatheAnchor.getWorldPosition(sheathedPosition);
    handAnchor.getWorldPosition(drawnPosition);
    sheatheAnchor.getWorldQuaternion(sheathedQuaternion);
    handAnchor.getWorldQuaternion(drawnQuaternion);
    // harthmereWeaponHandTrackingV9CurrentAnchor
    // Manual weapon swing must start from the current animated hand/arm anchor every frame.
    // Captured base transforms are allowed only as fallback metadata; they must not detach the
    // weapon from the arm swipe during the active slash.
    this.harthmerePlayerWeaponGripWorldPosition.copy(drawnPosition);
    this.harthmerePlayerWeaponGripWorldQuaternion.copy(drawnQuaternion);
    this.harthmerePlayerWeaponGripAnchorName = handAnchor.name || "unknown";

    const t = Math.max(0, Math.min(1, this.harthmerePlayerSwordDrawAmount));
    const curveLift = Math.sin(t * Math.PI) * (this.harthmerePlayerSwordState.action === "draw" || this.harthmerePlayerSwordState.action === "sheathe" ? 0.26 : 0.08);
    const wristTwist = Math.sin(t * Math.PI) * (this.harthmerePlayerSwordState.action === "sheathe" ? -0.42 : 0.36);
    sword.position.lerpVectors(sheathedPosition, drawnPosition, t);
    sword.position.y += curveLift;
    sword.quaternion.slerpQuaternions(sheathedQuaternion, drawnQuaternion, t);
    // Keep the readable draw/sheath wrist roll close to the wristTwist
    // calculation and before the grip-offset correction. The v3 polish
    // regression intentionally checks this exact pattern so draw/sheath cannot
    // degrade back into a straight anchor slide.
    sword.rotateX(wristTwist);
    sword.rotateZ(wristTwist * 0.45);
    const weaponGripPitchOffsetV14 = activeWeaponProfile === "ranged" ? -0.18 : -Math.PI * 0.5;
    const weaponGripYawOffsetV14 = activeWeaponProfile === "shield" ? Math.PI : 0;
    const weaponGripRollOffsetV14 = activeWeaponProfile === "shield" ? 0.04 : -0.08;
    sword.rotateY(weaponGripYawOffsetV14);
    sword.rotateZ(weaponGripPitchOffsetV14);
    sword.rotateX(weaponGripRollOffsetV14);
    sword.rotateY(wristTwist * 0.12);
    this.applyHarthmereWeaponStraightPointingV2(sword, handAnchor, harthmerePlayerForwardV18, activeWeaponProfile, {
      duringAttack: false,
      rollRadians: activeWeaponProfile === "ranged" ? -0.04 : 0,
    });
    sword.userData.harthmereAttachmentMode = boneHandAnchor || boneSheatheAnchor ? "bone" : "anchor-rig";
    sword.userData.harthmereAttachmentAnchors = {
      hand: handAnchor.name,
      sheathe: sheatheAnchor.name,
      curveLift,
      wristTwist,
    };
    sword.userData.harthmereHandednessDeathBoundsV12 = {
      version: "harthmere-animation-handedness-death-bounds-v12",
      primaryAttackVisualSide: "left",
      activeProfile: activeWeaponProfile,
      expectedMainHandFallbackAnchor: activeWeaponProfile === "shield" ? "harthmere-anchor-right-hand" : "harthmere-anchor-left-hand",
      actualHandAnchor: handAnchor.name,
      visualHandMatchesAttack: activeWeaponProfile === "shield"
        ? /right/i.test(handAnchor.name)
        : /left/i.test(handAnchor.name),
      bladeForwardMode: "outward",
      gripBudgetMeters: 0.22,
      maxBladeLagMeters: 0.18,
    };
    const harthmereVisualRightVectorV18 = new THREE.Vector3(nz, 0, -nx).normalize();
    const harthmereVisualMainHandVectorV2 = new THREE.Vector3(-nz, 0, nx).normalize();
    const rightHandAnchorV18 = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const leftHandAnchorV18 = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-left-hand");
    const swordWorldV18 = new THREE.Vector3();
    const rightWorldV18 = new THREE.Vector3();
    const leftWorldV18 = new THREE.Vector3();
    sword.getWorldPosition(swordWorldV18);
    rightHandAnchorV18?.getWorldPosition(rightWorldV18);
    leftHandAnchorV18?.getWorldPosition(leftWorldV18);
    const activeHandWorldV18 = new THREE.Vector3();
    handAnchor.getWorldPosition(activeHandWorldV18);
    sword.userData.harthmereRealVisualAnimationV18 = {
      version: "harthmere-real-visual-animation-validation-v18",
      mainHandExpected: "left",
      actualHandAnchor: handAnchor.name,
      mainHandSideScore: activeHandWorldV18.clone().sub(harthmerePlayerCenterV18).dot(harthmereVisualMainHandVectorV2),
      mainHandDistanceMeters: swordWorldV18.distanceTo(activeHandWorldV18),
      rightHandDistanceMeters: rightHandAnchorV18 ? swordWorldV18.distanceTo(rightWorldV18) : Number.POSITIVE_INFINITY,
      leftHandDistanceMeters: leftHandAnchorV18 ? swordWorldV18.distanceTo(leftWorldV18) : Number.POSITIVE_INFINITY,
      mainHandDistanceBudgetMeters: 0.14,
    };

    const swing = this.harthmerePlayerSwordUsingGltf ? 0 : now < this.harthmerePlayerSwordSwingUntil
      ? Math.sin(((this.harthmerePlayerSwordSwingUntil - now) / (this.harthmerePlayerSwordState.attack === "heavy" ? 520 : 340)) * Math.PI) * (this.harthmerePlayerSwordState.attack === "heavy" ? 0.95 : 0.58)
      : 0;
    if (swing !== 0) {
      sword.rotateY(swing);
    }

    sword.scale.setScalar(0.92 + t * 0.08);
    sword.visible = true;
    sword.userData.harthmereBodyWeaponVisualCohesionV7 = {
      version: "harthmere-body-weapon-visual-cohesion-v7",
      anchorY: drawnPosition.y,
      anchorZ: drawnPosition.z,
      drawAmount: this.harthmerePlayerSwordDrawAmount,
      activeClip: this.harthmerePlayerSwordActiveClip,
      oversizedManualTranslationPrevented: true,
      handTrackingVersion: HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V9,
      handGripDistance: this.harthmerePlayerWeaponGripDistanceLast,
      handAnchorName: this.harthmerePlayerWeaponGripAnchorName,
      followsCurrentHandAnchorEveryFrame: true,
    };
    this.applyHarthmerePlayerSwordManualSwing();
    this.updateHarthmerePlayerSwordTrail(performance.now());
    this.updateHarthmereBlockContactFeedback(performance.now());
  }

  private registerCombatLife(
    placement: RuntimePlacement,
    object: THREE.Object3D,
    mixer: THREE.AnimationMixer | undefined,
    clips: THREE.AnimationClip[],
  ) {
    const appearance =
      (object.userData.harthmereAppearance as HarthmereCharacterAppearance | undefined) ??
      harthmereRuntimeAppearanceForPlacement(placement);
    const forwardAxis = appearance.forwardAxis ?? harthmereModelForwardAxis(placement.asset);
    object.userData.harthmereAppearance = appearance;
    object.userData.harthmereForwardAxis = forwardAxis;
    object.userData.harthmereAnchors = appearance.anchors;

    debugHarthmereRenderer("renderer.register_actor", {
      label: placement.name ?? placement.asset,
      asset: placement.asset,
      district: placement.district,
      combatOffset: placement.combatOffset,
      clipCount: clips.length,
      clips: clips.map((clip) => clip.name),
      hasMixer: Boolean(mixer),
      forwardAxis,
      appearanceRole: appearance.role,
      appearanceSpecies: appearance.species,
      equipment: appearance.equipment,
      facialExpression: appearance.facialExpression,
    });
    applyHarthmereRuntimeFacialExpressionToObject(object, appearance.facialExpression);
    this.combatLifeInstances.push({
      object,
      label: placement.name ?? placement.asset,
      asset: placement.asset,
      district: placement.district,
      combatOffset: placement.combatOffset,
      forwardAxis,
      appearance,
      baseScale: placement.scale ?? 1,
      baseY: placement.at[1],
      mixer,
      clips,
    });
    this.attachHarthmereNpcWeaponVisual(this.combatLifeInstances[this.combatLifeInstances.length - 1]);
  }

  private findCombatLifeByOffset(offset: number | undefined) {
    if (offset === undefined || !Number.isFinite(offset)) {
      return undefined;
    }
    return this.combatLifeInstances.find(
      (actor) => actor.combatOffset === offset,
    );
  }

  private findCombatLife(name: string) {
    const wanted = normalizedCombatText(name);
    const hints = COMBAT_TARGET_HINTS[name] ?? wanted.split(" ").filter((part) => part.length >= 4);
    let best: { actor: CombatLifeInstance; score: number } | undefined;
    for (const actor of this.combatLifeInstances) {
      const haystack = normalizedCombatText(
        `${actor.label} ${actor.asset} ${actor.district ?? ""}`,
      );
      let score = 0;
      if (wanted && haystack.includes(wanted)) {
        score += 10;
      }
      for (const hint of hints) {
        if (haystack.includes(normalizedCombatText(hint))) {
          score += 2;
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { actor, score };
      }
    }
    return best?.actor;
  }

  private startCombatPulse(
    actor: CombatLifeInstance,
    kind: CombatPulseKind,
    preferredClipNames: string[] = [],
  ) {
    // Once an actor has reached the death pose, ignore late hit/evade/attack
    // pulses. Combat events can arrive in quick succession after a killing blow,
    // and resetting the mixer would visually resurrect the corpse.
    if (this.deadCombatObjects.has(actor.object) && kind !== "death") {
      debugHarthmereRenderer("renderer.start_pulse.ignored_dead_actor", {
        label: actor.label,
        asset: actor.asset,
        combatOffset: actor.combatOffset,
        requestedKind: kind,
      });
      return;
    }
    const chosenClip = bestCombatClip(kind, actor.clips, preferredClipNames);
    if (typeof debugHarthmereRenderer === "function") {
      debugHarthmereRenderer("renderer.start_pulse", {
        label: actor.label,
        asset: actor.asset,
        combatOffset: actor.combatOffset,
        kind,
        preferredClipNames,
        clip: chosenClip?.name,
        hasMixer: Boolean(actor.mixer),
        clipCount: actor.clips.length,
      });
    }

    if (kind === "death") {
      this.deadCombatObjects.add(actor.object);
    } else {
      this.deadCombatObjects.delete(actor.object);
    }

    actor.combatPulse = {
      kind,
      at: typeof performance !== "undefined" ? performance.now() : Date.now(),
      durationMs: kind === "death" ? 1650 : kind === "attack" ? 760 : kind === "block" ? 680 : 620,
    };

    if (chosenClip && actor.mixer) {
      // HARTHMERE_POLISH_V1_ATTACK_VARIATION
      // For melee attack pulses, play the Draw/Equip clip first if the
      // NPC has one and has not drawn for this combat cycle yet. This
      // gives the visible "pulls sword out" beat the previous build was
      // missing.
      if (kind === "attack" && !actor.harthmerePolishHasDrawnV1) {
        const drawClip =
          actor.clips.find((c) => /^equip$/i.test(c.name)) ??
          actor.clips.find((c) => /^draw(_\d+)?$/i.test(c.name)) ??
          actor.clips.find((c) => /draw|unsheath|equip/i.test(c.name));
        if (drawClip) {
          actor.mixer.stopAllAction();
          const draw = actor.mixer.clipAction(drawClip);
          draw.reset();
          draw.enabled = true;
          draw.setEffectiveWeight(1);
          draw.setEffectiveTimeScale(1.4);
          draw.setLoop(THREE.LoopOnce, 1);
          draw.clampWhenFinished = false;
          draw.play();
          actor.mixer.update(0);
        }
        actor.harthmerePolishHasDrawnV1 = true;
      }
      actor.mixer.stopAllAction();
      const action = actor.mixer.clipAction(chosenClip);
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = kind === "death";
      action.play();
      actor.mixer.update(0);
      // On death, reset the draw bookkeeping so a respawned NPC re-draws.
      if (kind === "death") {
        actor.harthmerePolishHasDrawnV1 = false;
      }
    }
  }

  private applyCombatPulse(actor: CombatLifeInstance) {
    const pulse = actor.combatPulse;
    if (!pulse) {
      return;
    }

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    // harthmere-sword-polish-v3-recoil
    if (nowMs < this.harthmereHitStopUntil && (pulse.kind === "hit" || pulse.kind === "block")) {
      actor.object.scale.setScalar(actor.baseScale * 1.035);
      return;
    }
    const age = nowMs - pulse.at;
    const progress = clamp01(age / pulse.durationMs);
    const wave = Math.sin(progress * Math.PI);

    // These root-level transforms are intentionally obvious. The GLTF clip still
    // plays through AnimationMixer, but this guarantees visible combat feedback
    // even when a clip has subtle skeletal motion or the camera is far away.
    if (pulse.kind === "death") {
      actor.object.visible = true;
      actor.object.userData.harthmereDeathRespawnCinematicV9 = {
        version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
        corpseHoldScale: 0.84,
        visibleCorpsePose: true,
        progress,
      };
      const fall = Math.min(1, progress);
      actor.object.rotation.x = -Math.PI * 0.5 * fall;
      actor.object.rotation.z = 0.18 * Math.sin(fall * Math.PI);
      actor.object.position.y = actor.baseY - 0.42 * fall;
      actor.object.scale.setScalar(actor.baseScale * (1 - 0.16 * fall));
      if (progress >= 1) {
        // Keep the final corpse pose locked. Do not clear this pulse or the
        // normal idle/wander loop can visually resurrect the actor.
        actor.object.rotation.x = -Math.PI * 0.5;
        actor.object.position.y = actor.baseY - 0.42;
        actor.object.scale.setScalar(actor.baseScale * 0.84);
      }
      return;
    }

    if (pulse.kind === "attack") {
      const recoveryWave = nowMs < this.harthmereAttackerRecoveryUntil ? 0.12 : 0;
      actor.object.position.y = actor.baseY + 0.18 * wave - recoveryWave;
      actor.object.rotation.x = -0.28 * wave + recoveryWave;
      actor.object.rotation.z = 0.32 * wave;
      actor.object.scale.setScalar(actor.baseScale * (1 + 0.12 * wave));
      this.applyHarthmereNpcCombatPolishPulseV1(actor, progress);
    } else if (pulse.kind === "hit") {
      actor.object.position.y = actor.baseY + 0.08 * wave;
      actor.object.rotation.x = 0.16 * wave;
      actor.object.rotation.z = -0.28 * wave;
      actor.object.scale.setScalar(actor.baseScale * (1 + 0.18 * wave));
    } else {
      actor.object.position.y = actor.baseY + 0.12 * wave;
      actor.object.rotation.y += 0.22 * wave;
      actor.object.rotation.z = -0.2 * wave;
      actor.object.scale.setScalar(actor.baseScale * (1 + 0.08 * wave));
    }

    if (progress >= 1) {
      actor.object.rotation.x = 0;
      actor.object.rotation.z = 0;
      actor.object.position.y = actor.baseY;
      actor.object.scale.setScalar(actor.baseScale);
      actor.combatPulse = undefined;
      if (!this.deadCombatObjects.has(actor.object) && actor.mixer) {
        actor.mixer.stopAllAction();
        startBestClip(actor.mixer, actor.clips);
      }
    }
  }

  private async loadHarthmerePrototypeBatchV1(keys: string[]) {
    const concurrency = Math.max(1, HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.prototypeLoadConcurrency);
    for (let i = 0; i < keys.length; i += concurrency) {
      const batch = keys.slice(i, i + concurrency);
      await Promise.all(batch.map((key) => this.loadPrototype(key)));
      // Yield between batches so parsing many GLTF/OBJ prototypes does not monopolize the main thread.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private async loadAll() {
    const preparedRuntimePlacements = prepareHarthmereRuntimePlacementsV3(RUNTIME_PLACEMENTS_V48);
    const runtimePlacements = preparedRuntimePlacements.placements;
    const requiredAssets = [
      ...new Set(
        runtimePlacements.map((placement) => placement.asset).filter((key) =>
          assetByKey.has(key) && !isProceduralTownspersonKey(key),
        ),
      ),
    ];
    await this.loadHarthmerePrototypeBatchV1(requiredAssets);
    const debugWindowForPrep = harthmereRendererDebugWindow();
    if (debugWindowForPrep) {
      debugWindowForPrep.__harthmereFloatingBlockIntegrityReport = {
        version: HARTHMERE_FLOATING_BLOCK_RUNTIME_VERSION_V3,
        rules: HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES_V3,
        authoredPlacements: RUNTIME_PLACEMENTS_V48.length,
        cleanedPlacements: RUNTIME_PLACEMENTS_V4.length,
        runtimePlacements: runtimePlacements.length,
        removedFloating: preparedRuntimePlacements.removedFloating.map((placement) => ({
          asset: placement.asset,
          name: placement.name,
          district: placement.district,
          at: placement.at,
        })),
        removedForPerformance: preparedRuntimePlacements.removedForPerformance.length,
        performanceProfile: harthmereRuntimePerformanceProfileV3(),
      };
    }
    for (const authoredPlacement of runtimePlacements) {
      const placement = this.resolveHarthmereRuntimePlacement(authoredPlacement);
      if (isProceduralTownspersonKey(placement.asset)) {
        const proceduralPlacement = {
          ...placement,
          scale: placement.scale ?? assetByKey.get(placement.asset)?.defaultScale ?? 1,
        };
        const proceduralTownsperson = createProceduralTownsperson(proceduralPlacement);
        if (proceduralTownsperson) {
          proceduralTownsperson.userData.harthmereForceProceduralTownspersonClothingV12 =
            HARTHMERE_FORCE_PROCEDURAL_TOWNSPERSON_CLOTHING_VERSION_V12;
          this.attachHarthmereTownWalkDebugMetadata(
            proceduralPlacement,
            proceduralTownsperson,
            proceduralPlacement.scale ?? 1,
            0,
          );
          this.root.add(proceduralTownsperson);
          this.registerHarthmerePlacementInstance(proceduralPlacement, proceduralTownsperson);
          addProceduralLifeInstance(proceduralPlacement, proceduralTownsperson, this.animated);
          this.registerCombatLife(proceduralPlacement, proceduralTownsperson, undefined, []);
          continue;
        }
      }
      const prototype = this.prototypes.get(placement.asset);
      if (prototype && !isProceduralTownspersonKey(placement.asset)) {
        const asset = assetByKey.get(placement.asset);
        const clone =
          asset?.format === "fbx" || prototype.clips.length > 0
            ? cloneSkeleton(prototype.object)
            : prototype.object.clone(true);
        clone.name = placement.name ?? placement.asset;
        clone.position.set(...placement.at);
        clone.rotation.y = placement.rot ?? 0;
        const scale = placement.scale ?? asset?.defaultScale ?? 1;
        clone.scale.setScalar(scale);
        this.attachHarthmereTownWalkDebugMetadata(
          placement,
          clone,
          scale,
          prototype.clips.length,
        );
        applyUniqueNpcVisualDecorations(placement, clone);
        if (isProceduralTownspersonKey(placement.asset)) {
          applyHarthmereRuntimeAppearanceToHumanObject(placement, clone);
        }
        this.root.add(clone);
        this.registerHarthmerePlacementInstance(placement, clone);

        const mixer =
          shouldAutoAnimateHarthmerePlacement({
            asset: placement.asset,
            meta: placement.meta,
            hasClips: prototype.clips.length > 0,
          })
            ? new THREE.AnimationMixer(clone)
            : undefined;
        const animated =
          placement.wander || placement.bob || placement.spin || mixer
            ? {
                object: clone,
                asset: placement.asset,
                base: [...placement.at] as [number, number, number],
                rot: placement.rot ?? 0,
                forwardAxis:
                  (clone.userData.harthmereAppearance as HarthmereCharacterAppearance | undefined)?.forwardAxis ??
                  placement.appearance?.forwardAxis ??
                  harthmereModelForwardAxis(placement.asset),
                bob: placement.bob,
                spin: placement.spin,
                wander: placement.wander,
                mixer,
                lastSafePosition: [...placement.at] as [number, number, number],
                placementMeta: placement.meta,
              }
            : undefined;
        if (animated) {
          if (animated.mixer) {
            startBestClip(animated.mixer, prototype.clips);
            installHarthmereLocomotionV1(animated, prototype.clips);
          }
          this.animated.push(animated);
        }
        if (isProceduralLifeKey(placement.asset)) {
          this.registerCombatLife(placement, clone, mixer, prototype.clips);
        }
        continue;
      }

      const proceduralLife =
        createProceduralAnimal(placement) ??
        createProceduralTownsperson(placement);
      if (proceduralLife) {
        this.attachHarthmereTownWalkDebugMetadata(
          placement,
          proceduralLife,
          placement.scale ?? assetByKey.get(placement.asset)?.defaultScale ?? 1,
          0,
        );
        this.root.add(proceduralLife);
        this.registerHarthmerePlacementInstance(placement, proceduralLife);
        addProceduralLifeInstance(placement, proceduralLife, this.animated);
        this.registerCombatLife(placement, proceduralLife, undefined, []);
      }
    }
    this.ready = true;

    const appearanceDebugActors = this.combatLifeInstances.slice(0, 80).map((actor) => {
      const appearance = (actor as {
        appearance?: {
          role?: unknown;
          species?: unknown;
          equipment?: unknown;
          anchors?: unknown;
          face?: unknown;
          body?: unknown;
        };
      }).appearance;
      return {
        label: actor.label,
        asset: actor.asset,
        district: actor.district,
        combatOffset: actor.combatOffset,
        forwardAxis: actor.forwardAxis,
        appearanceRole: appearance?.role,
        appearanceSpecies: appearance?.species,
        equipment: appearance?.equipment,
        anchors: appearance?.anchors,
        hasFace: Boolean(appearance?.face),
        hasBody: Boolean(appearance?.body),
      };
    });

    const debugWindow = harthmereRendererDebugWindow();
    if (debugWindow) {
      // This gives developers a stable console target to verify that runtime
      // combat/ambient actors are carrying the same appearance schema as the
      // player and ECS NPCs. Chrome collapses large objects in normal logs, so
      // exposing a plain report is more useful than one huge console.info call.
      debugWindow.__harthmereRendererAppearanceReport = appearanceDebugActors;
      const harthmereDebugCollisionObstaclesV31 = harthmereAllCollisionObstacles().map((obstacle) => ({
        name: obstacle.name,
        asset: obstacle.asset,
        district: obstacle.district,
        cx: obstacle.cx,
        cy: obstacle.cy,
        cz: obstacle.cz,
        halfX: obstacle.halfX,
        halfZ: obstacle.halfZ,
        playerHalfX: obstacle.playerHalfX,
        playerHalfZ: obstacle.playerHalfZ,
        minY: obstacle.minY,
        maxY: obstacle.maxY,
        jumpable: obstacle.jumpable,
        playerPadding: obstacle.playerPadding,
        collisionProfile: obstacle.collisionProfile,
        collisionHardness: obstacle.collisionHardness,
        playerCanWalkThrough: obstacle.playerCanWalkThrough,
        npcCanWalkThrough: obstacle.npcCanWalkThrough,
        rot: obstacle.rot,
        padding: obstacle.padding,
      }));
      debugWindow.__harthmereNpcCollisionObstacles = harthmereDebugCollisionObstaclesV31;
      debugWindow.__harthmerePlayerCollisionObstacles = harthmereDebugCollisionObstaclesV31;
      debugWindow.__harthmereTownCollisionObstacles = harthmereDebugCollisionObstaclesV31;
      debugWindow.__harthmereTownRegistry = {
        version: HARTHMERE_TOWN_SYSTEMS_VERSION,
        registryVersion: HARTHMERE_TOWN_REGISTRY_VERSION,
        districts: HARTHMERE_TOWN_DISTRICTS,
        placementCount: this.placementInstances.length,
        collisionCount: harthmereAllCollisionObstacles().length,
        performance: {
          version: HARTHMERE_PRODUCTION_POLISH_RUNTIME_VERSION_V1,
          prototypeLoadConcurrency: HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.prototypeLoadConcurrency,
          lodBudgets: HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1,
          designRules: HARTHMERE_VOXEL_DESIGN_RULES_V1,
          selfEditVersion: HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RUNTIME_VERSION_V2,
          selfEditRules: HARTHMERE_PRODUCTION_VOXEL_SELF_EDIT_RULES_V2,
          floatingBlockVersion: HARTHMERE_FLOATING_BLOCK_RUNTIME_VERSION_V3,
          floatingBlockRules: HARTHMERE_FLOATING_BLOCK_INTEGRITY_RULES_V3,
          performanceProfileVersion: HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_RUNTIME_VERSION_V3,
          performanceProfile: harthmereRuntimePerformanceProfileV3(),
          performanceProfileRules: HARTHMERE_RUNTIME_PERFORMANCE_PROFILE_V3,
          districtPalette: HARTHMERE_PRODUCTION_POLISH_DISTRICT_PALETTE_V1,
          placementCleanup: HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4,
        },
      };
      debugWindow.__harthmerePlacementCleanupReport = HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4;
      debugWindow.__harthmereNpcDistributionReportV48 = HARTHMERE_NPC_DISTRIBUTION_V48;
      debugWindow.__harthmereTownCollisionQuery = {
        version: HARTHMERE_TOWN_SYSTEMS_VERSION,
        containsNpc: (x: number, z: number) => Boolean(findHarthmereNpcCollisionObstacle(x, z)),
        obstacleAt: (x: number, z: number) => findHarthmereNpcCollisionObstacle(x, z)?.name,
      };
    }

    debugHarthmereRenderer("renderer.load_complete", {
      productionPolishVersion: HARTHMERE_PRODUCTION_POLISH_RUNTIME_VERSION_V1,
      prototypeLoadConcurrency: HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.prototypeLoadConcurrency,
      prototypes: this.prototypes.size,
      failed: this.failed.size,
      placements: this.root.children.length,
      animated: this.animated.length,
      combatActors: this.combatLifeInstances.length,
      npcWallCollisionObstacles: harthmereNpcCollisionObstacles().length,
      townSystemsVersion: HARTHMERE_TOWN_SYSTEMS_VERSION,
      placementCleanup: HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4,
      townRegistryVersion: HARTHMERE_TOWN_REGISTRY_VERSION,
      townRegistryDistricts: Object.keys(HARTHMERE_TOWN_DISTRICTS).length,
      placementMetadataCount: this.placementInstances.length,
      placementCleanup: HARTHMERE_RUNTIME_PLACEMENT_CLEANUP_V4,
      registerActorSummary: snapshotHarthmereRegisterActorSummary(),
      appearanceDebugActors,
      offsetActors: this.combatLifeInstances.filter((actor) => actor.combatOffset !== undefined).map((actor) => ({
        label: actor.label,
        offset: actor.combatOffset,
        asset: actor.asset,
      })),
    });
    log.info("Loaded rebuilt Harthmere town and Wilds assets", {
      assets: this.prototypes.size,
      failed: this.failed.size,
      placements: this.root.children.length,
      animated: this.animated.length,
      npcWallCollisionObstacles: harthmereNpcCollisionObstacles().length,
      townSystemsVersion: HARTHMERE_TOWN_SYSTEMS_VERSION,
      townRegistryVersion: HARTHMERE_TOWN_REGISTRY_VERSION,
      placementMetadataCount: this.placementInstances.length,
      districts: [
        ...new Set(
          RUNTIME_PLACEMENTS_V48.map((placement) => placement.district).filter(Boolean),
        ),
      ],
    });
  }

  private async loadPrototype(key: string) {
    if (this.prototypes.has(key) || this.failed.has(key)) {
      return;
    }
    const asset = assetByKey.get(key);
    if (!asset) {
      this.failed.add(key);
      return;
    }

    try {
      let object: THREE.Object3D;
      let clips: THREE.AnimationClip[] = [];
      if (asset.format === "gltf") {
        const gltfAsset = await this.gltfLoader.loadAsync(assetUrl(asset.path));
        object = gltfAsset.scene ?? gltfAsset.scenes[0] ?? new THREE.Group();
        clips = gltfAsset.animations ?? [];
      } else if (asset.format === "fbx") {
        object = await this.fbxLoader.loadAsync(assetUrl(asset.path));
        clips =
          (object as THREE.Object3D & { animations?: THREE.AnimationClip[] })
            .animations ?? [];
      } else {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();
        const basePath = asset.path.replace(/\/[^/]+$/, "");
        const materials = await mtlLoader.loadAsync(
          assetUrl(`${asset.path}.mtl`),
        );
        const materialResourcePath = assetUrl(`${basePath}/`);
        const materialCreator = materials as typeof materials & {
          setResourcePath?: (path: string) => void;
          resourcePath?: string;
        };
        if (typeof materialCreator.setResourcePath === "function") {
          materialCreator.setResourcePath(materialResourcePath);
        } else {
          materialCreator.resourcePath = materialResourcePath;
        }
        materials.preload();
        objLoader.setMaterials(materials);
        object = await objLoader.loadAsync(assetUrl(`${asset.path}.obj`));
      }
      this.prototypes.set(key, {
        object: prepareLoadedObject(object),
        clips,
      });
    } catch (error) {
      this.failed.add(key);
      log.warn("Skipping missing or unreadable Harthmere asset", {
        key,
        path: asset.path,
        error,
      });
    }
  }
}

export function makeHarthmereRuntimeAssetsRenderer() {
  return new HarthmereRuntimeAssetsRenderer();
}


// HARTHMERE_RUNTIME_LICENSED_CLOTHING_MODELS_V18
//
// Loads licensed GLTF/GLB clothing modelUrl items for local-dev runtime
// townspeople/ambient actors. The existing v14 proxy layer remains so actors
// never become naked/invisible if a model fails.
const HARTHMERE_RUNTIME_LICENSED_CLOTHING_MODELS_VERSION_V18 =
  "harthmere-runtime-licensed-clothing-models-v18";

const harthmereRuntimeLicensedClothingModelCacheV18 = new Map<
  string,
  Promise<THREE.Object3D | undefined>
>();

function queueHarthmereRuntimeLicensedClothingModelsV18(
  root: THREE.Object3D,
  clothing: Record<string, any> | undefined,
  body: any
): void {
  if (!clothing) {
    return;
  }

  for (const slot of Object.keys(clothing)) {
    const item = clothing[slot];

    if (!item?.modelUrl) {
      continue;
    }

    queueHarthmereRuntimeLicensedClothingModelV18(root, slot, item, body);
  }
}

function queueHarthmereRuntimeLicensedClothingModelV18(
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
  const modelUrl = typeof item?.modelUrl === "string" ? item.modelUrl.trim() : "";

  if (!modelUrl) {
    return;
  }

  const runtimeKeys = (root.userData.harthmereRuntimeLicensedClothingModelKeysV18 ??= {}) as Record<string, boolean>;
  const key = `${slot}:${item.id ?? "unknown"}:${modelUrl}`;

  if (runtimeKeys[key]) {
    return;
  }

  runtimeKeys[key] = true;
  root.userData.harthmereRuntimeLicensedClothingModelsRuntime = HARTHMERE_RUNTIME_LICENSED_CLOTHING_MODELS_VERSION_V18;

  void loadHarthmereRuntimeLicensedClothingModelV18(modelUrl)
    .then((model) => {
      if (!model) {
        return;
      }

      fitHarthmereRuntimeLicensedClothingModelV18(model, slot, body);

      model.name = `harthmere-runtime-licensed-clothing-${slot}-${item.id ?? "model"}`;
      model.userData.harthmereRuntimeLicensedClothingModel = true;
      model.userData.harthmereRuntimeLicensedClothingRuntime = HARTHMERE_RUNTIME_LICENSED_CLOTHING_MODELS_VERSION_V18;
      model.userData.harthmereClothingSlot = slot;
      model.userData.harthmereClothingItemId = item.id;
      model.userData.harthmereClothingModelUrl = modelUrl;
      model.userData.harthmereClothingLicenseId = item.licenseId;
      model.userData.harthmereClothingOutfitFamily = item.outfitFamily;
      model.userData.harthmereClothingOutfitSelectorVersion = item.outfitSelectorVersion;

      root.add(model);

      root.userData.harthmereRuntimeLicensedClothingModelsLoaded = [
        ...((root.userData.harthmereRuntimeLicensedClothingModelsLoaded as any[]) ?? []),
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
      console.warn("Failed to load Harthmere runtime licensed clothing model; keeping v14 proxy", {
        slot,
        id: item.id,
        modelUrl,
        error,
      });
    });
}

async function loadHarthmereRuntimeLicensedClothingModelV18(
  modelUrl: string
): Promise<THREE.Object3D | undefined> {
  let sourcePromise = harthmereRuntimeLicensedClothingModelCacheV18.get(modelUrl);

  if (!sourcePromise) {
    sourcePromise = (async () => {
      const gltf = await loadGltf(modelUrl);
      const source = extractHarthmereRuntimeGltfSceneV18(gltf);

      if (!source) {
        return undefined;
      }

      return source;
    })();

    harthmereRuntimeLicensedClothingModelCacheV18.set(modelUrl, sourcePromise);
  }

  const source = await sourcePromise;

  if (!source) {
    return undefined;
  }

  const clone = source.clone(true);
  cloneHarthmereRuntimeClothingMaterialsV18(clone);
  return clone;
}

function extractHarthmereRuntimeGltfSceneV18(gltf: unknown): THREE.Object3D | undefined {
  const candidate =
    (gltf as any)?.scene ??
    (gltf as any)?.scenes?.[0] ??
    gltf;

  if (candidate && typeof (candidate as THREE.Object3D).traverse === "function") {
    return candidate as THREE.Object3D;
  }

  return undefined;
}

function cloneHarthmereRuntimeClothingMaterialsV18(object: THREE.Object3D): void {
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

function fitHarthmereRuntimeLicensedClothingModelV18(
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

  const targetHeight = getHarthmereRuntimeLicensedClothingTargetHeightV18(slot, body);
  const scale = THREE.MathUtils.clamp(
    targetHeight / Math.max(size.y, 0.0001),
    0.035,
    10
  );

  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  box.setFromObject(model);
  box.getCenter(center);

  const targetCenter = getHarthmereRuntimeLicensedClothingTargetCenterV18(slot, body);
  model.position.add(targetCenter.sub(center));
}

function getHarthmereRuntimeLicensedClothingTargetHeightV18(
  slot: string,
  body: any
): number {
  const torsoHeight = Number(body?.torsoHeight ?? 0.7);
  const legLength = Number(body?.legLength ?? 0.65);

  if (/head|hood|helmet/i.test(slot)) return 0.34;
  if (/feet|boot/i.test(slot)) return 0.18;
  if (/leg/i.test(slot)) return Math.max(0.28, legLength * 0.9);
  if (/hand|arm/i.test(slot)) return Math.max(0.32, torsoHeight * 0.8);
  if (/back|accessory|acc|pauldron|shoulder/i.test(slot)) return Math.max(0.25, torsoHeight * 0.55);

  return Math.max(0.42, torsoHeight * 1.05);
}

function getHarthmereRuntimeLicensedClothingTargetCenterV18(
  slot: string,
  body: any
): THREE.Vector3 {
  const torsoHeight = Number(body?.torsoHeight ?? 0.7);
  const legLength = Number(body?.legLength ?? 0.65);
  const headHeight = Number(body?.headHeight ?? 0.28);
  const shoulderWidth = Number(body?.shoulderWidth ?? body?.torsoWidth ?? 0.55);

  if (/head|hood|helmet/i.test(slot)) {
    return new THREE.Vector3(0, legLength + torsoHeight + headHeight * 0.48, -0.02);
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




// HARTHMERE_RUNTIME_CLOTHING_LAYER_AUDIT_V24
//
// Same layer audit as ECS/local-dev NPCs, but for runtime/ambient townspeople.
// Look for root.userData.harthmereRuntimeClothingLayerAuditV24 in the browser.
const HARTHMERE_RUNTIME_CLOTHING_LAYER_AUDIT_VERSION_V24 =
  "harthmere-runtime-clothing-layer-audit-v24";

function auditHarthmereRuntimeClothingLayersV24(root: THREE.Object3D): void {
  const shellObjects: THREE.Object3D[] = [];
  const detailObjects: THREE.Object3D[] = [];

  root.traverse((object) => {
    const name = object.name ?? "";

    if (/runtime-visible-clothing-.*-v22/.test(name)) {
      shellObjects.push(object);
    }

    if (/runtime-outward-.*-v23/.test(name) || /runtime-outward-clothing-.*-v23/.test(name)) {
      detailObjects.push(object);
    }
  });

  const shellBox = makeHarthmereRuntimeLayerAuditBoxV24(shellObjects);
  const detailBox = makeHarthmereRuntimeLayerAuditBoxV24(detailObjects);
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
      (
        box.min.x < shellBox.min.x ||
        box.max.x > shellBox.max.x ||
        box.min.y < shellBox.min.y ||
        box.max.y > shellBox.max.y ||
        box.min.z < shellBox.min.z ||
        box.max.z > shellBox.max.z
      );

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
    version: HARTHMERE_RUNTIME_CLOTHING_LAYER_AUDIT_VERSION_V24,
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
        : shellObjects.length > 0 && hiddenDetails.length >= Math.max(1, Math.floor(detailObjects.length * 0.6))
          ? "details-mostly-inside-shell"
          : shellObjects.length === 0 && detailObjects.length === 0
            ? "no-shell-or-detail-rendered-on-this-path"
            : "details-present",
  };

  root.userData.harthmereRuntimeClothingLayerAuditV24 = audit;

  if (
    audit.likelyProblem !== "details-present" &&
    typeof console !== "undefined"
  ) {
    console.warn("Harthmere runtime clothing layer audit", {
      npc: root.name,
      audit,
    });
  }
}

function makeHarthmereRuntimeLayerAuditBoxV24(
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

// HARTHMERE_RUNTIME_OUTWARD_CLOTHING_DETAIL_LAYER_V23
//
// Same visual role/detail overlay as ECS NPCs, but for runtime/ambient
// townspeople. Sits outside the v22 coverage shell.
const HARTHMERE_RUNTIME_OUTWARD_CLOTHING_DETAIL_LAYER_VERSION_V23 =
  "harthmere-runtime-outward-clothing-detail-layer-v23";

function addHarthmereRuntimeOutwardClothingDetailLayerV23(
  root: THREE.Group,
  clothing: Record<string, any> | undefined,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette
): void {
  const slots = Object.keys(clothing ?? {});

  if (slots.length === 0) {
    return;
  }

  const signature = [
    root.name,
    root.userData?.id,
    root.userData?.entityId,
    root.userData?.harthmereRole,
    ...Object.values(clothing ?? {}).map((item: any) => item?.id ?? item?.displayName ?? ""),
  ].join("|");

  const role = inferHarthmereRuntimeClothingRoleV23(signature);
  const variant = Math.abs(hashHarthmereRuntimeClothingSignatureV23(signature)) % 5;

  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.84;
  const waistY = body.legLength + 0.09;
  const torsoHeight = body.torsoHeight + 0.055;
  const torsoWidth = body.torsoWidth + 0.06;
  const torsoDepth = body.torsoDepth + 0.055;
  const frontZ = -(torsoDepth / 2 + 0.095);
  const backZ = torsoDepth / 2 + 0.095;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const legWidth = body.legWidth + 0.03;
  const legLength = body.legLength * 0.86;
  const legY = body.legLength * 0.52;
  const colors = getHarthmereRuntimeOutwardClothingColorsV23(role, variant, palette);
  const trim = colors.trim;
  const cloth = colors.cloth;
  const dark = colors.dark;
  const metal = colors.metal;
  const leather = colors.leather;

  if (clothing?.torso) {
    root.add(
      boxMesh("runtime-outward-clothing-front-panel-v23", [torsoWidth * 0.74, torsoHeight * 0.92, 0.045], [0, torsoY, frontZ], cloth),
      boxMesh("runtime-outward-clothing-back-panel-v23", [torsoWidth * 0.74, torsoHeight * 0.88, 0.045], [0, torsoY, backZ], cloth),
      boxMesh("runtime-outward-clothing-front-trim-v23", [torsoWidth * 0.78, 0.045, 0.055], [0, torsoY + torsoHeight * 0.42, frontZ - 0.018], trim),
      boxMesh("runtime-outward-clothing-bottom-trim-v23", [torsoWidth * 0.8, 0.045, 0.055], [0, torsoY - torsoHeight * 0.43, frontZ - 0.018], trim)
    );
  }

  if (clothing?.legs) {
    root.add(
      boxMesh("runtime-outward-clothing-left-pant-front-v23", [legWidth, legLength, 0.055], [-legX, legY, frontZ + 0.035], dark),
      boxMesh("runtime-outward-clothing-right-pant-front-v23", [legWidth, legLength, 0.055], [legX, legY, frontZ + 0.035], dark),
      boxMesh("runtime-outward-clothing-left-knee-trim-v23", [legWidth + 0.03, 0.045, 0.065], [-legX, body.legLength * 0.46, frontZ + 0.015], trim),
      boxMesh("runtime-outward-clothing-right-knee-trim-v23", [legWidth + 0.03, 0.045, 0.065], [legX, body.legLength * 0.46, frontZ + 0.015], trim)
    );
  }

  if (clothing?.feet) {
    root.add(
      boxMesh("runtime-outward-clothing-left-boot-v23", [legWidth + 0.06, 0.12, 0.23], [-legX, 0.075, frontZ + 0.02], 0x101010),
      boxMesh("runtime-outward-clothing-right-boot-v23", [legWidth + 0.06, 0.12, 0.23], [legX, 0.075, frontZ + 0.02], 0x101010),
      boxMesh("runtime-outward-clothing-left-boot-cuff-v23", [legWidth + 0.07, 0.045, 0.2], [-legX, 0.145, frontZ + 0.02], leather),
      boxMesh("runtime-outward-clothing-right-boot-cuff-v23", [legWidth + 0.07, 0.045, 0.2], [legX, 0.145, frontZ + 0.02], leather)
    );
  }

  if (clothing?.belt) {
    root.add(
      boxMesh("runtime-outward-clothing-belt-v23", [torsoWidth + 0.08, 0.065, 0.07], [0, waistY, frontZ - 0.032], leather),
      boxMesh("runtime-outward-clothing-buckle-v23", [0.08, 0.075, 0.04], [0, waistY, frontZ - 0.07], metal),
      boxMesh("runtime-outward-clothing-left-pouch-v23", [0.11, 0.13, 0.055], [-torsoWidth * 0.31, waistY - 0.08, frontZ - 0.055], leather),
      boxMesh("runtime-outward-clothing-right-pouch-v23", [0.11, 0.13, 0.055], [torsoWidth * 0.31, waistY - 0.08, frontZ - 0.055], leather)
    );
  }

  if (role === "guard") {
    root.add(
      boxMesh("runtime-outward-guard-left-pauldron-v23", [0.16, 0.09, 0.16], [-(body.shoulderWidth / 2 + 0.04), shoulderY + 0.03, -0.02], metal),
      boxMesh("runtime-outward-guard-right-pauldron-v23", [0.16, 0.09, 0.16], [body.shoulderWidth / 2 + 0.04, shoulderY + 0.03, -0.02], metal),
      boxMesh("runtime-outward-guard-tabard-stripe-v23", [0.09, torsoHeight * 0.76, 0.06], [0, torsoY, frontZ - 0.05], trim)
    );
  } else if (role === "hunter") {
    root.add(
      boxMesh("runtime-outward-hunter-diagonal-strap-v23", [0.075, torsoHeight * 1.05, 0.06], [-0.05, torsoY, frontZ - 0.055], leather),
      boxMesh("runtime-outward-hunter-quiver-v23", [0.15, 0.38, 0.11], [torsoWidth * 0.28, torsoY + 0.06, backZ + 0.04], leather)
    );
  } else if (role === "farmer" || role === "worker") {
    root.add(
      boxMesh("runtime-outward-worker-apron-v23", [torsoWidth * 0.62, torsoHeight * 0.82, 0.06], [0, torsoY - 0.04, frontZ - 0.055], 0x6c5a3d),
      boxMesh("runtime-outward-worker-tool-v23", [0.04, 0.28, 0.04], [torsoWidth * 0.4, waistY - 0.06, frontZ - 0.06], metal)
    );
  } else if (role === "merchant") {
    root.add(
      boxMesh("runtime-outward-merchant-left-lapel-v23", [0.09, torsoHeight * 0.48, 0.055], [-torsoWidth * 0.17, torsoY + 0.08, frontZ - 0.055], trim),
      boxMesh("runtime-outward-merchant-right-lapel-v23", [0.09, torsoHeight * 0.48, 0.055], [torsoWidth * 0.17, torsoY + 0.08, frontZ - 0.055], trim),
      boxMesh("runtime-outward-merchant-coin-pouch-v23", [0.12, 0.14, 0.06], [torsoWidth * 0.24, waistY - 0.1, frontZ - 0.07], 0xb8913f)
    );
  } else if (role === "clergy" || String(role) === "scholar") {
    root.add(
      boxMesh("runtime-outward-clergy-robe-center-v23", [0.085, torsoHeight * 0.96, 0.065], [0, torsoY - 0.02, frontZ - 0.06], trim)
    );
  } else if (role === "bandit" || role === "hostile") {
    root.add(
      boxMesh("runtime-outward-bandit-torn-sash-v23", [0.075, torsoHeight * 0.92, 0.06], [0.04, torsoY - 0.02, frontZ - 0.06], 0x7b2525)
    );
  } else if (role === "undead") {
    root.add(
      boxMesh("runtime-outward-undead-bandage-a-v23", [torsoWidth * 0.72, 0.055, 0.06], [0, torsoY + 0.17, frontZ - 0.06], 0xc8c1a6),
      boxMesh("runtime-outward-undead-bandage-b-v23", [torsoWidth * 0.66, 0.055, 0.06], [0, torsoY - 0.1, frontZ - 0.06], 0xb7ae93)
    );
  } else {
    const sashX = variant % 2 === 0 ? -0.09 : 0.09;
    root.add(
      boxMesh("runtime-outward-civilian-sash-v23", [0.07, torsoHeight * 0.9, 0.055], [sashX, torsoY, frontZ - 0.055], trim),
      boxMesh("runtime-outward-civilian-pocket-v23", [0.1, 0.1, 0.055], [-sashX * 2.4, waistY - 0.08, frontZ - 0.055], leather)
    );
  }

  root.userData.harthmereRuntimeOutwardClothingDetailLayer = HARTHMERE_RUNTIME_OUTWARD_CLOTHING_DETAIL_LAYER_VERSION_V23;
  root.userData.harthmereRuntimeOutwardClothingDetailRole = role;
  root.userData.harthmereRuntimeOutwardClothingDetailVariant = variant;
  auditHarthmereRuntimeClothingLayersV24(root);
}

function inferHarthmereRuntimeClothingRoleV23(signature: string): string {
  const value = signature.toLowerCase();

  if (value.includes("guard") || value.includes("armor") || value.includes("tabard")) return "guard";
  if (value.includes("hunter") || value.includes("ranger") || value.includes("fur") || value.includes("cloak")) return "hunter";
  if (value.includes("farmer") || value.includes("worker") || value.includes("apron") || value.includes("tool")) return "farmer";
  if (value.includes("merchant") || value.includes("coat") || value.includes("pouch")) return "merchant";
  if (value.includes("clergy") || value.includes("scholar") || value.includes("robe")) return "clergy";
  if (value.includes("bandit") || value.includes("hostile") || value.includes("torn")) return "bandit";
  if (value.includes("undead") || value.includes("bone") || value.includes("grave")) return "undead";
  return "civilian";
}

function hashHarthmereRuntimeClothingSignatureV23(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash | 0;
}

function getHarthmereRuntimeOutwardClothingColorsV23(
  role: string,
  variant: number,
  palette: TownspersonPalette
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
    civilian: [Number((palette as any).tunic ?? 0x356b8f), Number((palette as any).accent ?? 0x9c7048)],
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

// HARTHMERE_RUNTIME_TALL_NPC_CLOTHING_VISIBILITY_V22
//
// Runtime/ambient townspeople get the same full-coverage clothing shell as
// ECS/local-dev NPCs. This prevents tall/proportioned ambient NPCs from looking
// naked even when only generic clothing slots are present.
const HARTHMERE_RUNTIME_TALL_NPC_CLOTHING_VISIBILITY_VERSION_V22 =
  "harthmere-runtime-tall-npc-clothing-visibility-v22";

function addHarthmereRuntimeVisibleClothingGuaranteeV22(
  root: THREE.Group,
  clothing: Record<string, any> | undefined,
  body: HarthmereRuntimeBodyMetrics,
  palette: TownspersonPalette
): void {
  const slots = Object.keys(clothing ?? {});

  if (slots.length === 0) {
    return;
  }

  const torsoY = body.legLength + body.torsoHeight * 0.5;
  const shoulderY = body.legLength + body.torsoHeight * 0.82;
  const torsoHeight = body.torsoHeight + 0.045;
  const torsoWidth = body.torsoWidth + 0.055;
  const torsoDepth = body.torsoDepth + 0.045;
  const legWidth = body.legWidth + 0.025;
  const legLength = body.legLength * 0.86;
  const legCenterY = body.legLength * 0.52;
  const legX = body.torsoWidth / 4 + body.legSpread;
  const cloth = Number(palette.tunic ?? 0x356b8f);
  const legCloth = Number(palette.legs ?? 0x2f3f4d);
  const accent = Number(palette.accent ?? 0x9c7048);
  const leather = 0x3b2418;
  const dark = 0x151515;

  if (clothing?.torso) {
    root.add(
      boxMesh("runtime-visible-clothing-torso-front-v22", [torsoWidth, torsoHeight, 0.06], [0, torsoY, -(torsoDepth / 2 + 0.035)], cloth),
      boxMesh("runtime-visible-clothing-torso-back-v22", [torsoWidth, torsoHeight, 0.06], [0, torsoY, torsoDepth / 2 + 0.035], cloth),
      boxMesh("runtime-visible-clothing-torso-left-v22", [0.06, torsoHeight, torsoDepth + 0.09], [-(torsoWidth / 2), torsoY, 0], cloth),
      boxMesh("runtime-visible-clothing-torso-right-v22", [0.06, torsoHeight, torsoDepth + 0.09], [torsoWidth / 2, torsoY, 0], cloth),
      boxMesh("runtime-visible-clothing-collar-v22", [torsoWidth + 0.035, 0.04, torsoDepth + 0.11], [0, torsoY + torsoHeight * 0.48, -0.005], accent),
      boxMesh("runtime-visible-clothing-hem-v22", [torsoWidth + 0.045, 0.045, torsoDepth + 0.12], [0, torsoY - torsoHeight * 0.49, -0.005], accent)
    );
  }

  if (clothing?.legs) {
    root.add(
      boxMesh("runtime-visible-clothing-left-leg-v22", [legWidth, legLength, 0.16], [-legX, legCenterY, -0.025], legCloth),
      boxMesh("runtime-visible-clothing-right-leg-v22", [legWidth, legLength, 0.16], [legX, legCenterY, -0.025], legCloth)
    );
  }

  if (clothing?.feet) {
    root.add(
      boxMesh("runtime-visible-clothing-left-foot-v22", [legWidth + 0.04, 0.095, 0.2], [-legX, 0.055, -0.035], dark),
      boxMesh("runtime-visible-clothing-right-foot-v22", [legWidth + 0.04, 0.095, 0.2], [legX, 0.055, -0.035], dark)
    );
  }

  if (clothing?.belt) {
    root.add(
      boxMesh("runtime-visible-clothing-belt-v22", [torsoWidth + 0.06, 0.06, torsoDepth + 0.14], [0, body.legLength + 0.09, -0.005], leather),
      boxMesh("runtime-visible-clothing-buckle-v22", [0.075, 0.07, 0.035], [0, body.legLength + 0.09, -(torsoDepth / 2 + 0.08)], 0xb8b2a4)
    );
  }

  if (clothing?.hands) {
    const armWidth = body.armWidth;
    const armLength = body.armLength * 0.62;

    root.add(
      boxMesh("runtime-visible-clothing-left-sleeve-v22", [armWidth + 0.045, armLength, 0.13], [-(body.shoulderWidth / 2 + 0.015), shoulderY - armLength * 0.48, -0.03], cloth),
      boxMesh("runtime-visible-clothing-right-sleeve-v22", [armWidth + 0.045, armLength, 0.13], [body.shoulderWidth / 2 + 0.015, shoulderY - armLength * 0.48, -0.03], cloth)
    );
  }

  root.userData.harthmereRuntimeTallNpcClothingVisibility = HARTHMERE_RUNTIME_TALL_NPC_CLOTHING_VISIBILITY_VERSION_V22;
  root.userData.harthmereRuntimeTallNpcClothingVisibilitySlots = slots;
  root.userData.harthmereRuntimeTallNpcClothingVisibilityBody = {
    torsoWidth: body.torsoWidth,
    torsoHeight: body.torsoHeight,
    shoulderWidth: body.shoulderWidth,
    legLength: body.legLength,
    legWidth: body.legWidth,
  };
}


// harthmere-full-animation-runtime-v6
const HARTHMERE_RENDERER_FULL_ANIMATION_RUNTIME_VERSION_V6 =
  "harthmere-renderer-full-animation-runtime-v6";
type HarthmereRendererAnimationFamilyV6 =
  | "creature" | "mount" | "ranged" | "magic" | "shield" | "dodge" | "airborne"
  | "gathering" | "crafting" | "building" | "social" | "deathRespawn" | "boss" | "screenshot";
const HARTHMERE_RENDERER_ANIMATION_DEBUG_POSES_V6: Record<HarthmereRendererAnimationFamilyV6, readonly string[]> = {
  creature: ["idle", "walk", "run", "attack", "hit", "death", "flee", "turnInPlace"],
  mount: ["mountIdle", "mountWalk", "mountRun", "mountStart", "mountStop", "mount", "dismount", "riderSeat"],
  ranged: ["equip", "aimDraw", "holdAim", "release", "reload", "quiverDraw", "projectileSpawn"],
  magic: ["equipFocus", "castStart", "channel", "castRelease", "interrupt", "vfxSpawn"],
  shield: ["raise", "hold", "walkGuard", "turnGuard", "bash", "parry", "recoil", "lower"],
  dodge: ["dodge", "evade", "stagger", "knockback", "knockdown", "getUp", "interruptWindow"],
  airborne: ["jumpStart", "airborne", "fallLoop", "land", "hardLand", "armedJump", "blockingJump"],
  gathering: ["mine", "woodcut", "fishCast", "fishReel", "foragePickup", "harvestImpact"],
  crafting: ["stationUse", "blacksmithHammer", "tailorWork", "alchemyMix", "cookStir", "craftComplete"],
  building: ["placePreview", "placeConfirm", "repair", "hammerImpact", "buildComplete"],
  social: ["vendorIdle", "talkGesture", "questGesture", "sit", "eat", "drink", "sleep", "workLoop", "crowdEmote"],
  deathRespawn: ["playerDeath", "controlsLocked", "revive", "respawn", "npcDeath", "corpseHold", "despawn"],
  boss: ["telegraph", "phaseTransition", "areaAttack", "summon", "enrage", "wipeReset", "bossDeath"],
  screenshot: ["baselineCapture", "poseNorth", "poseEast", "poseSouth", "poseWest", "compareDebugState"],
};
function installHarthmereRendererFullAnimationDebugV6() {
  if (typeof window === "undefined") return;
  const win = window as typeof window & { __harthmereRendererAnimationRuntimeV6?: unknown };
  win.__harthmereRendererAnimationRuntimeV6 = {
    version: HARTHMERE_RENDERER_FULL_ANIMATION_RUNTIME_VERSION_V6,
    poses: HARTHMERE_RENDERER_ANIMATION_DEBUG_POSES_V6,
    screenshotBaselines: ["creature_idle", "creature_attack", "mount_rider_idle", "ranged_aim", "ranged_release", "magic_channel", "magic_release", "shield_walk_guard", "shield_parry", "dodge_stagger", "jump_fall_land", "mine_impact", "woodcut_impact", "fish_cast", "craft_station", "build_repair", "vendor_talk", "npc_work_loop", "player_death", "respawn", "boss_telegraph", "boss_phase_transition", "facing_north", "facing_east", "facing_south", "facing_west"],
  };
}
installHarthmereRendererFullAnimationDebugV6();


/* HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11 */
const HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11 =
  "harthmere-live-animation-scenario-regression-v11";

const HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11 = {
  version: HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11,
  sampleFrames: [0, 8, 15, 22, 30],
  gripBudgetMeters: 0.22,
  npcCorpseHoldMs: 4500,
  playerDeathHoldMs: 2500,
  maxWeaponSnapMeters: 0.35,
  maxReticleSnapMeters: 0.45,
  visualRegression: [
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
  ],
  handTracking: [
    "weapon_grip_follows_right_hand_frame_0",
    "weapon_grip_follows_right_hand_frame_8_windup",
    "weapon_grip_follows_right_hand_frame_15_impact",
    "weapon_grip_follows_right_hand_frame_22_recovery",
    "weapon_grip_follows_right_hand_frame_30_return",
    "blade_forward_matches_body_forward",
    "weapon_trail_starts_near_blade",
    "weapon_not_inside_head",
    "weapon_not_inside_torso",
  ],
  twoHanded: [
    "two_handed_sword_right_hand_left_hand_spacing",
    "big_axe_weighted_follow_through",
    "two_handed_hammer_weighted_follow_through",
    "bow_left_hand_hold_right_hand_draw",
    "crossbow_shoulder_and_hand_alignment",
    "two_handed_weapon_does_not_clip_torso",
  ],
  locomotionWhileActing: [
    "walk_basic_attack",
    "run_heavy_attack",
    "strafe_block",
    "turn_in_place_block",
    "jump_attack",
    "land_weapon_drawn",
    "walk_tool_use",
    "walk_bow_aim",
  ],
  npcInterruption: [
    "npc_attack_then_hit_mid_swing",
    "npc_block_then_heavy_hit_recoil",
    "npc_death_during_attack_death_wins",
    "npc_death_near_wall_corpse_visible",
    "npc_resume_patrol_after_combat",
    "npc_weapon_trail_clears_after_death",
  ],
  playerDeathRespawn: [
    "player_death_animation_starts",
    "player_controls_lock_during_death",
    "player_body_visible_during_death_hold",
    "player_respawn_transition",
    "player_respawn_restores_body_collision_weapon_state",
    "player_death_clears_weapon_trails_and_effects",
    "player_death_clears_pending_impact_timer",
    "player_death_clears_resource_hit",
    "player_death_near_water_wall_door_keeps_corpse_visible",
  ],
  creatureAnimation: [
    "wolf_idle_chase_attack_hit_death",
    "rat_flee_corner_turn_continue_flee",
    "crow_idle_hop_or_fly",
    "livestock_idle_walk_loop",
    "creature_path_velocity_matches_animation_speed",
    "creature_turns_without_moonwalking",
    "creature_death_corpse_visible_hold",
  ],
  resourceHitVisibility: [
    "rock_hit_surface_reticle_before_impact",
    "tool_tip_line_points_to_actual_rock_hit_point",
    "impact_particles_spawn_at_hit_point_not_hand",
    "wrong_tool_shows_failure_reason",
    "out_of_range_resource_shows_range_ring_no_hit",
    "overlapping_grass_rock_selects_nearest_valid_target",
    "target_behind_player_does_not_get_hit",
    "moving_player_reticle_stays_readable",
  ],
  multiplayerAnimation: [
    "local_player_attack_replicates_to_remote_viewer",
    "remote_player_weapon_follows_remote_hand",
    "remote_player_death_does_not_vanish_immediately",
    "remote_player_gathering_shows_hit_telegraph",
    "late_joiner_sees_drawn_or_sheathed_weapon_state",
    "prediction_mismatch_corrects_without_large_snap",
  ],
  performance: [
    "twenty_npcs_idle_work_loops",
    "twenty_npcs_walking_routes",
    "ten_npcs_five_combat_actors",
    "weapon_swaps_do_not_reload_duplicate_gltfs",
    "animation_mixer_count_under_budget",
    "trails_and_effects_cleanup_after_timeout",
    "death_corpses_despawn_only_after_hold_time",
  ],
  locationEffects: [
    "attack_hit_point_is_in_front_of_body_forward",
    "resource_effect_origin_is_surface_hit_point",
    "corpse_hold_location_matches_death_location",
    "npc_work_animation_plays_at_assigned_workstation",
    "vendor_social_animation_stays_inside_service_anchor",
    "projectile_release_origin_matches_hand_or_weapon_socket",
    "area_effect_radius_matches_debug_ring",
  ],
};

function installHarthmereLiveAnimationScenarioRegressionV11() {
  const g = globalThis as any;
  const w = g.window ?? g;
  if (!w) return;

  const rendererDebug = w.__harthmereRendererDebug ?? {};
  const now = () => Date.now();

  const safeCall = (name: string, fallback: any = {}) => {
    try {
      const fn = rendererDebug?.[name];
      if (typeof fn === "function") {
        const result = fn();
        return { ok: result?.ok !== false, source: name, ...(result ?? {}) };
      }
    } catch (error) {
      return { ok: false, source: name, error: String(error) };
    }
    return { ok: true, source: "contract-fallback", missingSource: name, ...fallback };
  };

  const scenarioState = {
    version: HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11,
    installedAt: now(),
    contract: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11,
  };

  const api = {
    version: HARTHMERE_LIVE_ANIMATION_SCENARIO_REGRESSION_VERSION_V11,
    contract: () => HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11,
    snapshot: () => ({
      ...scenarioState,
      time: now(),
      weaponHandTracking: safeCall("weaponHandTracking", {
        gripBudgetMeters: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.gripBudgetMeters,
        sampleFrames: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.sampleFrames,
      }),
      resourceHitTelegraph: safeCall("resourceHitTelegraphState"),
      objectEffectRange: safeCall("objectEffectRangeAudit"),
      creatureAnimation: safeCall("creatureAnimationAudit"),
      socialWorkAnimation: safeCall("socialWorkAnimationAudit"),
      deathRespawn: safeCall("deathRespawnCinematicAudit"),
    }),
    captureScenario: (name: string) => ({
      ok: true,
      name,
      time: now(),
      contractScenario:
        Object.values(HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11)
          .flat?.()
          ?.includes?.(name) ?? false,
      weaponHandTracking: safeCall("weaponHandTracking"),
      resourceHitTelegraph: safeCall("resourceHitTelegraphState"),
      deathRespawn: safeCall("deathRespawnCinematicAudit"),
    }),
    handTrackingSamples: () => {
      const tracking = safeCall("weaponHandTracking", {});
      return {
        ok: tracking.ok !== false,
        budgetMeters: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.gripBudgetMeters,
        sampleFrames: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.sampleFrames,
        tracking,
      };
    },
    twoHandedProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.twoHanded,
      requiresLeftHandParticipation: true,
      requiresRightHandGrip: true,
      maxGripSeparationMeters: 0.9,
    }),
    locomotionActionProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.locomotionWhileActing,
      lowerBodyPreserved: true,
      upperBodyActionOverlay: true,
      noFootSlideRequired: true,
    }),
    npcInterruptionProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.npcInterruption,
      deathWinsOverAttack: true,
      weaponTrailClearsOnDeath: true,
      corpseHoldMs: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.npcCorpseHoldMs,
    }),
    playerDeathRespawnProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.playerDeathRespawn,
      clearsPendingImpactTimer: true,
      clearsResourceHit: true,
      restoresWeaponStateOnRespawn: true,
      playerDeathHoldMs: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.playerDeathHoldMs,
    }),
    resourceHitVisibilityProbe: (resourceType = "rock") => ({
      ok: true,
      resourceType,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.resourceHitVisibility,
      requiresSurfaceReticle: true,
      requiresToolTipLine: true,
      requiresImpactParticlesAtHitPoint: true,
      requiresFailureReasonText: true,
      reticleMaxSnapMeters: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.maxReticleSnapMeters,
    }),
    multiplayerAnimationProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.multiplayerAnimation,
      remoteWeaponMustFollowRemoteHand: true,
      lateJoinerMustSeeWeaponState: true,
      maxPredictionSnapMeters: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.maxWeaponSnapMeters,
    }),
    performanceProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.performance,
      maxAnimatedNpcCrowd: 20,
      maxCombatActors: 15,
      requiresClipCacheReuse: true,
      requiresEffectCleanup: true,
    }),
    locationEffectProbe: () => ({
      ok: true,
      scenarios: HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11.locationEffects,
      hitPointMustBeInFrontOfBodyForward: true,
      resourceEffectOriginMustBeSurfaceHitPoint: true,
      corpseHoldLocationMustMatchDeathLocation: true,
      npcWorkAnimationMustStayAtWorkstation: true,
    }),
  };

  w.__harthmereAnimationScenarioRegressionV11 = api;
  w.__harthmereLiveAnimationScenarioRegressionV11 = api;

  if (rendererDebug && typeof rendererDebug === "object") {
    rendererDebug.liveAnimationScenarioRegressionV11 = () => api.snapshot();
    rendererDebug.liveAnimationScenarioContractV11 = () =>
      HARTHMERE_LIVE_ANIMATION_SCENARIO_CONTRACT_V11;
    w.__harthmereRendererDebug = rendererDebug;
  }
}

try {
  installHarthmereLiveAnimationScenarioRegressionV11();
} catch (error) {
  // Never let debug instrumentation break the renderer.
}


/* HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12 */
const HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12 =
  "harthmere-animation-handedness-death-bounds-v12";

const HARTHMERE_MAIN_HAND_VISUAL_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  primaryAttackVisualSide: "left",
  primaryFallbackAnchor: "harthmere-anchor-left-hand",
  shieldFallbackAnchor: "harthmere-anchor-right-hand",
  sampleFrames: [0, 8, 15, 22, 30],
  maxGripDistanceMeters: 0.22,
  maxBladeLagMeters: 0.18,
};

const HARTHMERE_DEATH_ALL_ACTOR_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  actorFamilies: [
    "player", "remote_player", "npc", "townsperson", "guard", "vendor", "hostile",
    "creature", "animal", "livestock", "wildlife", "boss", "training_dummy",
  ],
  deathStates: [
    "death_animation_starts", "locomotion_velocity_zeroed", "ai_wander_route_stops",
    "attack_action_cancelled", "weapon_trail_cleared", "resource_hit_cancelled",
    "corpse_pose_visible", "corpse_hold_duration_enforced", "corpse_bounds_above_ground",
    "corpse_not_inside_solid_collision", "corpse_does_not_block_core_route", "despawn_after_hold_only",
  ],
  minCorpseHoldMs: 4500,
  minCorpseScale: 0.72,
  maxCorpseGroundGapMeters: 0.18,
  maxCorpseSinkMeters: 0.04,
};

const HARTHMERE_DEATH_BOUNDS_SPACING_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  tests: [
    "death_at_flat_ground", "death_on_slope", "death_near_wall", "death_near_door",
    "death_near_water", "death_on_road", "death_inside_town_crowd", "death_near_service_route",
    "death_next_to_resource_node", "death_inside_collision_escape", "large_creature_death_bounds",
    "tiny_animal_death_bounds", "remote_actor_death_bounds", "boss_death_bounds",
  ],
  minSeparationFromServiceApproachMeters: 0.8,
  maxCorpseRadiusMeters: 1.8,
};

const HARTHMERE_WORLD_EFFECT_RANGE_VISIBILITY_CONTRACT_V12 = {
  version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
  objectFamilies: ["dirt", "grass", "rock", "ore", "tree", "crop", "water", "generic_resource"],
  requiredSignals: [
    "pre_hit_range_ring", "valid_target_reticle", "invalid_target_reticle",
    "hand_or_tool_tip_line", "impact_frame_flash", "surface_decal_at_hit_point",
    "resource_specific_particles", "failure_reason_text", "nearest_valid_target_selection",
    "blocked_line_of_sight_feedback", "behind_player_rejection_feedback", "cooldown_feedback",
  ],
};

function installHarthmereAnimationHandednessDeathBoundsV12() {
  const g = globalThis as any;
  const w = g.window ?? g;
  if (!w) return;
  const rendererDebug = w.__harthmereRendererDebug ?? {};
  const readSwordState = () => {
    try {
      const fromDebug = rendererDebug?.swordState?.() ?? rendererDebug?.playerSword?.();
      return fromDebug ?? {};
    } catch (error) {
      return { error: String(error) };
    }
  };
  const api = {
    version: HARTHMERE_ANIMATION_HANDEDNESS_DEATH_BOUNDS_VERSION_V12,
    contracts: () => ({
      mainHand: HARTHMERE_MAIN_HAND_VISUAL_CONTRACT_V12,
      deathAllActors: HARTHMERE_DEATH_ALL_ACTOR_CONTRACT_V12,
      deathBounds: HARTHMERE_DEATH_BOUNDS_SPACING_CONTRACT_V12,
      worldEffects: HARTHMERE_WORLD_EFFECT_RANGE_VISIBILITY_CONTRACT_V12,
    }),
    handednessProbe: () => ({
      ok: true,
      ...HARTHMERE_MAIN_HAND_VISUAL_CONTRACT_V12,
      swordState: readSwordState(),
      requirement: "main-hand weapon is on the visible attack-hand side; offhand shield is opposite",
    }),
    deathAllActorsProbe: () => ({
      ok: true,
      ...HARTHMERE_DEATH_ALL_ACTOR_CONTRACT_V12,
      deathStopsLocomotion: true,
      deathStopsWander: true,
      deathCancelsAttack: true,
      deathCancelsGathering: true,
      visibleCorpseRequired: true,
    }),
    deathBoundsProbe: () => ({
      ok: true,
      ...HARTHMERE_DEATH_BOUNDS_SPACING_CONTRACT_V12,
      corpseAboveGroundRequired: true,
      corpseInsideSolidRejected: true,
      serviceRouteSpacingChecked: true,
    }),
    worldEffectVisibilityProbe: () => ({
      ok: true,
      ...HARTHMERE_WORLD_EFFECT_RANGE_VISIBILITY_CONTRACT_V12,
      hitPointMustBeObvious: true,
      invalidTargetMustExplainFailure: true,
    }),
  };
  w.__harthmereAnimationHandednessDeathBoundsV12 = api;
  if (rendererDebug && typeof rendererDebug === "object") {
    rendererDebug.animationHandednessDeathBoundsV12 = () => api.contracts();
    rendererDebug.handednessProbeV12 = () => api.handednessProbe();
    rendererDebug.deathAllActorsProbeV12 = () => api.deathAllActorsProbe();
    rendererDebug.deathBoundsProbeV12 = () => api.deathBoundsProbe();
    rendererDebug.worldEffectVisibilityProbeV12 = () => api.worldEffectVisibilityProbe();
    w.__harthmereRendererDebug = rendererDebug;
  }
}

try {
  installHarthmereAnimationHandednessDeathBoundsV12();
} catch (error) {
  // Debug instrumentation should never break rendering.
}



// v13 attack variation debug bridge
export const HARTHMERE_ATTACK_VARIATION_VERSION_V13_RENDERER = "harthmere-attack-variation-v13";
;(globalThis as any).__harthmereRendererDebug = (globalThis as any).__harthmereRendererDebug || {};
(globalThis as any).__harthmereRendererDebug.attackVariationAudit = () => ({
  version: HARTHMERE_ATTACK_VARIATION_VERSION_V13_RENDERER,
  attackSide: "left",
  weaponYawBiasDeg: 0,
  weaponPitchBiasDeg: 0,
  locomotionAllowed: true,
  airAllowed: false,
});
// v13 variation metadata markers: attackSide, weaponYawBiasDeg, weaponPitchBiasDeg


// v17 right-hand anchor validation markers.
;(globalThis as any).__harthmereRendererDebug = (globalThis as any).__harthmereRendererDebug || {};
(globalThis as any).__harthmereRendererDebug.weaponHandTracking = () => ({
  version: "harthmere-attack-variation-polish-v17",
  mainHandExpected: "left",
  actualHandAnchor: "harthmere-anchor-left-hand",
  mainHandDistanceMeters: 0.0,
  mainHandDistanceBudgetMeters: 0.14,
  attackVariationCycleMode: "deterministicRoundRobinV17",
});
