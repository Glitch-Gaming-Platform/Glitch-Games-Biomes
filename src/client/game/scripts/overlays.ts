import type { MailMan } from "@/client/game/chat/mailman";
import type { ClientConfig } from "@/client/game/client_config";
import type { AuthManager } from "@/client/game/context_managers/auth_manager";
import type { MapManager } from "@/client/game/context_managers/map_manager";
import type { ClientTable } from "@/client/game/game";
import { plantExperimentalAt } from "@/client/game/helpers/farming";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID,
  readActiveBiomesUIMapPin,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  accurateNavigationAidPosition,
  navigationAidShowsPrecisionOverlay,
  PRECISE_NAVIGATION_AID_NDC_BOX,
  QUEST_PRECISE_MIN_RENDER_DISTANCE,
} from "@/client/game/helpers/navigation_aids";
import { groupOccupancyAt } from "@/client/game/helpers/occupancy";
import { changeRadius } from "@/client/game/interact/helpers";
import type { Camera } from "@/client/game/resources/camera";
import type {
  InspectableOverlay,
  Overlay,
  OverlayMap,
  ProjectionMap,
} from "@/client/game/resources/overlays";
import type { ClientResources } from "@/client/game/resources/types";
import { harthmereGroundedFeetYWithMemory } from "@/client/game/util/harthmere_entity_grounding";
import type { Script } from "@/client/game/scripts/script_controller";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  DropSelector,
  MinigameElementsSelector,
  NamedQuestGiverSelector,
  NpcMetadataSelector,
  PlaceableSelector,
  PlayerSelector,
  RestoredPlaceableSelector,
} from "@/shared/ecs/gen/selectors";
import { getAabbForEntity, getSizeForEntity } from "@/shared/game/entity_sizes";
import {
  canInventoryAcceptBag,
  isInventoryFull,
} from "@/shared/game/inventory";
import { anItem } from "@/shared/game/item";
import type { RequiredItem } from "@/shared/game/spatial";
import { hitExistingTerrain } from "@/shared/game/spatial";
import { getTerrainIdAndIsomorphismAtPosition } from "@/shared/game/terrain_helper";
import { terrainMarch } from "@/shared/game/terrain_march";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import { log } from "@/shared/logging";
import {
  add,
  centerAABB,
  dist,
  dist2,
  dot,
  length,
  scale,
  sub,
  viewDir,
  xzProject,
} from "@/shared/math/linear";
import { clamp } from "@/shared/math/math";
import type { AABB, ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { isHarthmereCombatCreatureNpcType } from "@/client/components/challenges/dialogueObjectSemantics";
import { getNpcBehavior, idToNpcType, isNpcTypeId } from "@/shared/npc/bikkie";
import { displayUsername } from "@/shared/util/helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import {
  SNAPSHOT_LIVE_NPC_GROUNDING_VERSION,
  snapshotGroundLiveNpcPosition,
} from "@/shared/harthmere/snapshot_live_debug";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import { GROVE_ECONOMY_STARTER_LANDMARKS } from "@/shared/harthmere/grove_economy_starter";
import { readSnapshotGroveQuestState } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  activeHarthmereQuestMarkerId,
  activeHarthmereQuestMarkerIds,
  isVisibleHarthmereWorldObjectMarker,
} from "@/client/game/renderers/local_dev/harthmere_quest_object_markers";
import { harthmereJobsBoardFieldTargets } from "@/shared/harthmere/jobs_board_field_targets";
import {
  HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS,
  harthmereWorldObjectCandidateIsVisibleForInteraction,
  isHarthmereInspectableWorldObject,
  selectNearestHarthmereWorldObjectInspectable,
  type HarthmereWorldObjectCandidate,
} from "@/shared/harthmere/harthmere_world_object_inspectable";
import {
  isNativeRoadAheadQuestObjectLabel,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_IDS,
  NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS,
  nativeRoadAheadEcsAuthorityEnabled,
  shouldBypassGenericPlaceableOverlayForNativeQuestContainer,
} from "@/shared/harthmere/native_road_ahead_contract";
import {
  HARTHMERE_CRAFTING_TABLE_PROMPT_RADIUS,
  selectNearestHarthmereCraftingTable,
  type HarthmereCraftingTableCandidate,
} from "@/shared/harthmere/harthmere_crafting_table_proximity";
import { isHarthmerePlacedCookStationItem } from "@/client/components/overlays/inspected/placeables/craftingStationCookRouting";
import { ok } from "assert";
import { isEqual } from "lodash";
import { Vector3 } from "three";

const PLAYER_PROJECTION_OFFSET: Vec3 = [0, 0.35, 0];

// SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION
// Legacy snapshot quest-giver / NPC-like entities can have a position and label
// but no size component that the newer Glitch overlay code can resolve. The
// name overlay should never crash the render loop. Use a conservative human
// overlay height and log once so the bad entity can still be audited later.
const SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION =
  "snapshot-overlay-entity-size-compat";
const snapshotOverlayMissingSizeLogged = new Set<BiomesId>();

// Exact snapshot reward-dialogue props that must remain discoverable even when
// their rendered voxel art belongs to a larger group. A terrain ray inside the
// sunken ship resolves the ship group before generic proximity candidates, so
// without this narrow exception the real Muck Buster Crate is synchronized and
// in range but its F prompt can never win. Spare Robot Parts is included from
// the same immutable contract so both reward crates keep identical routing if
// its authored grouping changes in a later snapshot.
const NATIVE_PRIORITY_QUEST_PROP_ENTITY_IDS = new Set<BiomesId>([
  ...Object.values(NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS).map(
    (spec) => spec.sourceEntityId
  ),
  // Remaining original-snapshot quest props whose model is embedded in a
  // parent group. Spatial selectors can omit these children even though the
  // synchronized ClientTable contains them, so exact lookup is required for a
  // stable F prompt. Road Ahead's already-green props are intentionally absent.
  ...NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_IDS,
  2172725824368913 as BiomesId, // Billy's Tools
]);
const NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_ID_SET = new Set<BiomesId>(
  NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_IDS
);

function getOverlayEntitySizeCompat(entity: ReadonlyEntity): ReadonlyVec3 {
  const resolved = getSizeForEntity(entity);
  if (resolved) {
    return resolved;
  }
  const directSize = entity.size?.v;
  if (directSize) {
    return directSize;
  }
  if (!snapshotOverlayMissingSizeLogged.has(entity.id)) {
    snapshotOverlayMissingSizeLogged.add(entity.id);
    log.warn(
      "SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT missing entity size; using human overlay fallback",
      {
        entityId: entity.id,
        label: entity.label?.text,
        hasNpcMetadata: Boolean(entity.npc_metadata),
        hasQuestGiver: Boolean(entity.quest_giver),
        version: SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION,
      }
    );
  }
  return [1, 2, 1];
}

function nameOverlayPosFromPlayer(
  resources: ClientResources,
  id: BiomesId
): Vec3 {
  const scenePlayer = resources.get("/scene/player", id);
  const aabb = scenePlayer.aabb();
  const ret = centerAABB(aabb);
  ret[1] = aabb[1][1];
  return ret;
}

function behindCamera(position: ReadonlyVec3, camera: Camera) {
  return dot(sub(position, camera.pos()), camera.view()) < 0;
}

function screenCoordinateProjection(
  position: ReadonlyVec3,
  camera: Camera,
  ndcClipBox: AABB = [
    [-1, -1, -1],
    [1, 1, Infinity],
  ]
) {
  if (behindCamera(position, camera)) {
    return null;
  }

  const threeProjection = new Vector3(...position);
  threeProjection.project(camera.three);
  if (
    threeProjection.x < ndcClipBox[0][0] ||
    threeProjection.x > ndcClipBox[1][0] ||
    threeProjection.y < ndcClipBox[0][1] ||
    threeProjection.y > ndcClipBox[1][1] ||
    threeProjection.z < ndcClipBox[0][2] ||
    threeProjection.z > ndcClipBox[1][2]
  ) {
    return null;
  }

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const screenX = ((threeProjection.x + 1) / 2) * screenWidth;
  const screenY = ((1 - threeProjection.y) / 2) * screenHeight;
  const projection = [screenX, screenY, threeProjection.z] as Vec3;
  return projection;
}

const OVERLAY_TEXT_TIME_MS = 5300; // Add 300 miliseconds for fade out (beginHide)

const MAX_PLAYER_OVERLAY_DIST = 20;
const MAX_NPC_OVERLAY_DIST = 15;
// HARTHMERE_NPC_TALK_RADIUS_TIGHTEN:
// The 8.5m talk radius let players talk to NPCs who were clearly not next to
// them (and, combined with the full-hemisphere fallback, made the talk prompt
// pop for distant townsfolk). Tighten to a near-conversational range so the
// "Talk" prompt only shows for an NPC the player is actually standing by.
export const HARTHMERE_NPC_TALK_INSPECT_RADIUS = 4.5;
export const HARTHMERE_NPC_TALK_FALLBACK_RADIUS = 4.5;
export const HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS = 2.75;
export const HARTHMERE_NPC_TALK_FALLBACK_MIN_VIEW_DOT = 0;

export function harthmereNpcTalkCandidateScoreForTest(input: {
  playerPosition: ReadonlyVec3;
  facingView: ReadonlyVec3;
  npcPosition: ReadonlyVec3;
  radius?: number;
  closeRadius?: number;
  minViewDot?: number;
}): number | undefined {
  const radius = input.radius ?? HARTHMERE_NPC_TALK_FALLBACK_RADIUS;
  const closeRadius =
    input.closeRadius ?? HARTHMERE_NPC_TALK_FALLBACK_CLOSE_RADIUS;
  const minViewDot =
    input.minViewDot ?? HARTHMERE_NPC_TALK_FALLBACK_MIN_VIEW_DOT;
  const toNpcX = input.npcPosition[0] - input.playerPosition[0];
  const toNpcZ = input.npcPosition[2] - input.playerPosition[2];
  const horizontalDistance = Math.hypot(toNpcX, toNpcZ);
  if (!Number.isFinite(horizontalDistance) || horizontalDistance > radius) {
    return undefined;
  }
  const viewX = input.facingView[0];
  const viewZ = input.facingView[2];
  const viewLength = Math.hypot(viewX, viewZ);
  if (!Number.isFinite(viewLength) || viewLength <= 1e-5) {
    return undefined;
  }
  const toNpcLength = Math.max(horizontalDistance, 1e-5);
  const viewDot =
    (viewX * toNpcX + viewZ * toNpcZ) / (viewLength * toNpcLength);
  // The close-radius allowance keeps side-by-side conversations usable, but
  // it should never select an NPC behind the player's facing direction.
  const requiredViewDot =
    horizontalDistance <= closeRadius ? 0 : Math.max(0, minViewDot);
  if (viewDot < requiredViewDot) {
    return undefined;
  }
  // Prefer closer NPCs, but keep a gentle bias toward what the player is
  // already looking at so crowded Grove conversations don't jump around.
  return horizontalDistance - viewDot * 0.9;
}

// HARTHMERE_WORLD_OBJECT_INSPECT_CANDIDATES
// The interactable Grove props (crates, boards, posts, doors, ...) render as
// procedural beacons rather than ECS entities, so the cursor raycast never
// produces an inspectable overlay for them. We resolve them by proximity from
// the same static landmark tables the renderer draws, filtered to the labels
// the object-interaction semantics recognize as non-living props.
let harthmereWorldObjectCandidateCache:
  | HarthmereWorldObjectCandidate[]
  | undefined;

// Radius used to gather live ECS world-object candidates from the spatial table.
// Slightly larger than the selector's own accept radius (6.5m) so the faced-cone
// scoring in selectNearestHarthmereWorldObjectInspectable still does the final
// gating; we just want every nearby labeled object in the candidate set.
const HARTHMERE_WORLD_OBJECT_INSPECT_TABLE_SCAN_RADIUS = 8;

function harthmereWorldObjectInspectCandidates(): HarthmereWorldObjectCandidate[] {
  if (harthmereWorldObjectCandidateCache) {
    return harthmereWorldObjectCandidateCache;
  }
  const seen = new Set<string>();
  const candidates: HarthmereWorldObjectCandidate[] = [];
  const landmarks: SnapshotGroveLandmark[] = [
    ...SNAPSHOT_GROVE_LANDMARKS,
    ...GROVE_ECONOMY_STARTER_LANDMARKS,
  ];
  for (const landmark of landmarks) {
    if (landmark.kind === "npc" || seen.has(landmark.id)) {
      continue;
    }
    if (!isHarthmereInspectableWorldObject({ label: landmark.label })) {
      continue;
    }
    seen.add(landmark.id);
    // RESOLVED, not raw — see grove_waypoints.ts. An in-world overlay anchored
    // at the retired Y=54 sits under the courtyard floor.
    const world = groveLandmarkWorldPosition(landmark);
    candidates.push({
      id: landmark.id,
      label: landmark.label,
      position: [world[0], world[1], world[2]],
    });
  }
  harthmereWorldObjectCandidateCache = candidates;
  return candidates;
}

// HARTHMERE_JOBS_BOARD_FIELD_TARGET_CANDIDATES
// The 19 business job-template targets (refinery intake, farm supply crate,
// clinic supply shelf, inn linen shelf, ...) and the 19 outpost starter work
// stations are permanent shop fixtures, not quest-gated props: they must offer
// their "F" prompt whenever the player is standing at them, exactly like the
// jobs board itself. Without this the player could walk to the marker and find
// nothing to interact with, which made every business job uncompletable.
let harthmereFieldTargetCandidateCache:
  | HarthmereWorldObjectCandidate[]
  | undefined;
const harthmereFieldTargetGroundedFeetYByColumn = new Map<string, number>();

function harthmereJobsBoardFieldTargetInspectCandidates(
  resources: ClientResources
): HarthmereWorldObjectCandidate[] {
  if (!harthmereFieldTargetCandidateCache) {
    harthmereFieldTargetCandidateCache = harthmereJobsBoardFieldTargets().map(
      (target) => ({
        id: target.targetId,
        label: target.label,
        position: [
          target.position[0],
          target.position[1],
          target.position[2],
        ] as [number, number, number],
      })
    );
  }
  return harthmereFieldTargetCandidateCache.flatMap((candidate) => {
    // The procedural renderer grounds these same permanent props against live
    // terrain. Resolve the overlay candidate through the same shared grounder;
    // otherwise a built apron or platform can put the visible prop several
    // metres above its authored hint and the proximity selector rejects a
    // player who is standing directly beside it.
    const feetY = harthmereGroundedFeetYWithMemory(
      resources,
      harthmereFieldTargetGroundedFeetYByColumn,
      candidate.position[0],
      candidate.position[2],
      candidate.position[1],
      true
    );
    return feetY === undefined
      ? []
      : [
          {
            ...candidate,
            position: [
              candidate.position[0],
              feetY,
              candidate.position[2],
            ] as [number, number, number],
          },
        ];
  });
}

function harthmereVisibleStaticWorldObjectInspectCandidates(
  resources: ClientResources
): HarthmereWorldObjectCandidate[] {
  const questState = readSnapshotGroveQuestState();
  const activeMarkerId = activeHarthmereQuestMarkerId(questState);
  const activeMarkerIds = activeHarthmereQuestMarkerIds(questState);
  const activePin = readActiveBiomesUIMapPin();
  return [
    ...harthmereWorldObjectInspectCandidates().filter((candidate) =>
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate,
        activeMarkerId,
        activePinMarkerId: activePin?.markerId,
        activePinPosition: activePin?.worldPosition,
        alwaysVisible:
          activeMarkerIds.has(candidate.id) ||
          isVisibleHarthmereWorldObjectMarker(candidate.id),
      })
    ),
    ...harthmereJobsBoardFieldTargetInspectCandidates(resources),
  ];
}

const HARTHMERE_ECS_NPC_COMBAT_REGISTRY = "harthmere-ecs-npc-combat-registry";
const HARTHMERE_ECS_NPC_COMBAT_REGISTRY_SCAN_RADIUS = Math.max(
  64,
  MAX_NPC_OVERLAY_DIST * 4
);

type HarthmereEcsNpcCombatRegistryBehavior =
  | "hostile"
  | "defensive"
  | "guard"
  | "merchant"
  | "passive"
  | "training_dummy"
  | "quest_anchor";

type HarthmereEcsNpcCombatRegistrySpecies =
  | "human"
  | "animal"
  | "undead"
  | "construct";

type HarthmereEcsNpcCombatRegistrySocialRole =
  | "hostile"
  | "wildlife"
  | "guard"
  | "merchant"
  | "civilian"
  | "training";

type HarthmereEcsNpcCombatActorRegistryEntry = {
  offset: number;
  entityId: number;
  npcTypeId: number;
  label: string;
  asset: string;
  district?: string;
  pos: [number, number];
  world: Vec3;
  radius: number;
  species: HarthmereEcsNpcCombatRegistrySpecies;
  behavior: HarthmereEcsNpcCombatRegistryBehavior;
  socialRole: HarthmereEcsNpcCombatRegistrySocialRole;
  attackable: boolean;
  health?: { hp: number; maxHp: number };
  at: number;
  source: "ecs_npc_combat_registry";
};

type HarthmereEcsNpcCombatRegistryAudit = {
  version: typeof HARTHMERE_ECS_NPC_COMBAT_REGISTRY;
  scanRadius: number;
  expectedNpcCount: number;
  registeredNpcCount: number;
  missingNpcEntityIds: number[];
  invalidNpcTypeEntityIds: number[];
  deadNpcEntityIds: number[];
  actorOffsets: number[];
  labels: Array<{
    offset: number;
    label: string;
    behavior: HarthmereEcsNpcCombatRegistryBehavior;
    species: HarthmereEcsNpcCombatRegistrySpecies;
    socialRole: HarthmereEcsNpcCombatRegistrySocialRole;
    attackable: boolean;
    hp?: number;
    maxHp?: number;
  }>;
  at: number;
};

// Seedy Muckling / Seedling Mucker / Muckernot / Hexer must classify as hostile.
function harthmereEcsNpcCombatRegistryText(
  label: string | undefined,
  displayName: string | undefined,
  typeId: unknown
) {
  return `${label ?? ""} ${displayName ?? ""} ${String(
    typeId ?? ""
  )}`.toLowerCase();
}

function harthmereEcsNpcCombatRegistrySpeciesFromText(
  text: string
): HarthmereEcsNpcCombatRegistrySpecies {
  if (/undead|zombie|corpse|gravewood|drowned|dead/.test(text)) {
    return "undead";
  }
  if (
    /seedy|seedling|muck|muckling|mucker|muckernot|animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|pigeon|chicken|bunny|rabbit|pig|monster|creature|wyrm/.test(
      text
    )
  ) {
    return "animal";
  }
  return "human";
}

function harthmereEcsNpcCombatRegistryBehaviorFromText(
  text: string,
  attackable: boolean
): HarthmereEcsNpcCombatRegistryBehavior {
  if (!attackable) {
    return "passive";
  }
  if (/dummy|training/.test(text)) {
    return "training_dummy";
  }
  if (
    /guard|watch|sentry|patrol|peacekeeper|sergeant|quartermaster/.test(text)
  ) {
    return "guard";
  }
  if (
    /seedy|seedling|muck|muckling|mucker|muckernot|hex|hexer|bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|gravewood|wolf|bear|boar|snake|rat|enemy|monster|creature|wyrm/.test(
      text
    )
  ) {
    return "hostile";
  }
  if (/merchant|vendor|banker|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  return "defensive";
}

function harthmereEcsNpcCombatRegistrySocialRoleFromBehavior(
  behavior: HarthmereEcsNpcCombatRegistryBehavior,
  species: HarthmereEcsNpcCombatRegistrySpecies
): HarthmereEcsNpcCombatRegistrySocialRole {
  if (behavior === "training_dummy") {
    return "training";
  }
  if (behavior === "guard") {
    return "guard";
  }
  if (behavior === "merchant") {
    return "merchant";
  }
  if (behavior === "hostile") {
    return "hostile";
  }
  if (species === "animal") {
    return "wildlife";
  }
  return "civilian";
}

function publishHarthmereEcsNpcCombatRegistry(
  actors: Record<string, HarthmereEcsNpcCombatActorRegistryEntry>,
  audit: HarthmereEcsNpcCombatRegistryAudit
) {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as typeof window & {
    __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
    __harthmereEcsNpcCombatActorBridgeAudit?: Record<string, unknown>;
    __harthmereEcsNpcCombatRegistrationAudit?: Record<string, unknown>;
  };
  win.__harthmereEcsNpcCombatActorPositions = actors;
  win.__harthmereEcsNpcCombatActorBridgeAudit = audit;
  win.__harthmereEcsNpcCombatRegistrationAudit = audit;
}

export const MAX_MINIGAME_OVERLAY_DIST = 50;

const HARTHMERE_ECS_NPC_RETALIATION_BRIDGE =
  "harthmere-ecs-npc-retaliation-bridge";

type HarthmereEcsNpcCombatBridgeBehavior =
  | "hostile"
  | "defensive"
  | "guard"
  | "merchant"
  | "passive"
  | "training_dummy"
  | "quest_anchor";

type HarthmereEcsNpcCombatBridgeSpecies =
  | "human"
  | "animal"
  | "undead"
  | "construct";

type HarthmereEcsNpcCombatBridgeSocialRole =
  | "hostile"
  | "wildlife"
  | "guard"
  | "merchant"
  | "civilian"
  | "training";

type HarthmereEcsNpcCombatActorBridgeEntry = {
  offset: number;
  entityId: number;
  npcTypeId: number;
  label: string;
  asset: string;
  district?: string;
  pos: [number, number];
  world: Vec3;
  radius: number;
  species: HarthmereEcsNpcCombatBridgeSpecies;
  behavior: HarthmereEcsNpcCombatBridgeBehavior;
  socialRole: HarthmereEcsNpcCombatBridgeSocialRole;
  attackable: boolean;
  health?: { hp: number; maxHp?: number };
  at: number;
  source: "ecs_npc_overlay_bridge";
};

function harthmereEcsNpcCombatBridgeText(
  label: string | undefined,
  displayName: string | undefined,
  typeId: unknown
) {
  return `${label ?? ""} ${displayName ?? ""} ${String(
    typeId ?? ""
  )}`.toLowerCase();
}

function harthmereEcsNpcCombatSpeciesFromText(
  text: string
): HarthmereEcsNpcCombatBridgeSpecies {
  if (/undead|zombie|corpse|gravewood|drowned|dead/.test(text)) {
    return "undead";
  }
  if (
    /muck|muckling|mucker|animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|pigeon|chicken|bunny|rabbit|pig|monster|creature|wyrm/.test(
      text
    )
  ) {
    return "animal";
  }
  return "human";
}

function harthmereEcsNpcCombatBehaviorFromText(
  text: string,
  attackable: boolean
): HarthmereEcsNpcCombatBridgeBehavior {
  if (!attackable) {
    return "passive";
  }
  if (/dummy|training/.test(text)) {
    return "training_dummy";
  }
  if (
    /guard|watch|sentry|patrol|peacekeeper|sergeant|quartermaster/.test(text)
  ) {
    return "guard";
  }
  if (
    /muck|muckling|mucker|seed|seedy|hex|hexer|bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|gravewood|wolf|bear|boar|snake|rat|enemy|monster|creature|wyrm/.test(
      text
    )
  ) {
    return "hostile";
  }
  if (/merchant|vendor|banker|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  return "defensive";
}

function harthmereEcsNpcCombatSocialRoleFromBehavior(
  behavior: HarthmereEcsNpcCombatBridgeBehavior,
  species: HarthmereEcsNpcCombatBridgeSpecies
): HarthmereEcsNpcCombatBridgeSocialRole {
  if (behavior === "training_dummy") {
    return "training";
  }
  if (behavior === "guard") {
    return "guard";
  }
  if (behavior === "merchant") {
    return "merchant";
  }
  if (behavior === "hostile") {
    return "hostile";
  }
  if (species === "animal") {
    return "wildlife";
  }
  return "civilian";
}

function publishHarthmereEcsNpcCombatActorSnapshot(
  actors: Record<string, HarthmereEcsNpcCombatActorBridgeEntry>
) {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as typeof window & {
    __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
    __harthmereEcsNpcCombatActorBridgeAudit?: Record<string, unknown>;
  };
  win.__harthmereEcsNpcCombatActorPositions = actors;
  win.__harthmereEcsNpcCombatActorBridgeAudit = {
    version: HARTHMERE_ECS_NPC_RETALIATION_BRIDGE,
    count: Object.keys(actors).length,
    labels: Object.values(actors)
      .slice(0, 24)
      .map((actor) => ({
        offset: actor.offset,
        label: actor.label,
        distanceSource: "npc overlay scan",
        behavior: actor.behavior,
        species: actor.species,
        attackable: actor.attackable,
      })),
    at: Date.now(),
  };
}

export class OverlayScript implements Script {
  readonly name = "overlay";

  lastLocalInventoryVersion: number = 0;
  inventoryFull: boolean = false;
  lastLandId: BiomesId | undefined = undefined;
  lastLandIdChanged: number = 0;
  lastPosition: Vec3 | undefined = undefined;

  constructor(
    private readonly userId: BiomesId,
    private readonly resources: ClientResources,
    private readonly table: ClientTable,
    private readonly mailMan: MailMan,
    private readonly clientConfig: ClientConfig,
    private readonly authManager: AuthManager,
    private readonly mapManager: MapManager,
    private readonly voxeloo: VoxelooModule
  ) {}

  applyNavigationAidOverlays(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap,
    onlyAidId?: number
  ) {
    if (
      this.resources
        .get("/ruleset/current")
        .disabledHuds?.includes("challenges")
    ) {
      return;
    }
    const camera = this.resources.get("/scene/camera");
    const localPlayer = this.resources.get("/scene/local_player");
    for (const e of this.mapManager.localNavigationAids.values()) {
      // When restricted to a single aid (e.g. the user's active map pin shown
      // on-screen even while the big-nav-aids tweak is off), skip the rest.
      if (onlyAidId !== undefined && e.id !== onlyAidId) {
        continue;
      }
      const overlayPosition = accurateNavigationAidPosition(
        this.userId,
        this.resources,
        e
      );
      if (!overlayPosition) {
        continue;
      }

      const playerDist = dist(e.pos, localPlayer.player.position);

      const distance2d = dist2(
        xzProject(overlayPosition),
        xzProject(localPlayer.player.position)
      );
      if (
        !navigationAidShowsPrecisionOverlay(
          e,
          this.mapManager.isTrackingQuest(e.challengeId ?? INVALID_BIOMES_ID),
          distance2d
        )
      ) {
        continue;
      }
      const offsetPosition = add(overlayPosition, [0, 0.65, 0]);
      const nameProjection = screenCoordinateProjection(
        offsetPosition,
        camera,
        PRECISE_NAVIGATION_AID_NDC_BOX
      );
      if (!nameProjection) {
        continue;
      }

      const key = `navigationAid:${e.id}`;
      projectionMap.set(key, {
        loc: nameProjection,
        proximity: clamp(
          1 - playerDist / QUEST_PRECISE_MIN_RENDER_DISTANCE,
          0,
          1
        ),
      });
      overlayMap.set(key, {
        kind: "navigation_aid",
        key,
        aid: e,
        isOccluded: this.isOccluded(offsetPosition, camera),
      });
    }
  }

  isOccluded(
    pos: ReadonlyVec3,
    camera: Camera,
    options: {
      assumeOccludedForDistance?: number;
    } = {
      assumeOccludedForDistance: 50,
    }
  ) {
    const tweaks = this.resources.get("/tweaks");
    if (!tweaks.performOverlayOcclusion) {
      return false;
    }

    const camPos = camera.three.position.toArray();
    let rayDir = sub(pos, camPos);
    const dist = length(rayDir);

    if (
      options.assumeOccludedForDistance !== undefined &&
      dist > options.assumeOccludedForDistance
    ) {
      return true;
    }

    const rayDist = length(rayDir);
    rayDir = scale(1 / Math.max(1e-5, rayDist), rayDir);

    let didHit = false;
    terrainMarch(this.voxeloo, this.resources, camPos, rayDir, rayDist, () => {
      didHit = true;
      return false;
    });
    return didHit;
  }

  applyPlayerNameOverlays(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap,
    showGremlins: boolean
  ) {
    const camera = this.resources.get("/scene/camera");
    const localPlayer = this.resources.get("/scene/local_player");

    for (const entity of this.table.scan(
      PlayerSelector.query.spatial.inSphere(
        {
          center: localPlayer.player.position,
          radius: MAX_PLAYER_OVERLAY_DIST,
        },
        {
          approx: true,
        }
      )
    )) {
      if ((entity.gremlin && !showGremlins) || !entity.player_status?.init) {
        continue; // don't allow inspecting invisible gremlins
      }
      const playerDist = dist(entity.position.v, localPlayer.player.position);

      if (playerDist > MAX_PLAYER_OVERLAY_DIST) {
        continue;
      }

      const namePos = add(
        nameOverlayPosFromPlayer(this.resources, entity.id),
        PLAYER_PROJECTION_OFFSET
      );
      const nameProjection = screenCoordinateProjection(namePos, camera);
      if (!nameProjection) {
        continue;
      }

      if (this.isOccluded(namePos, camera)) {
        continue;
      }

      const recentText = this.mailMan.recentTexts.get(entity.id);

      const key = `playerName:${entity.id}`;
      projectionMap.set(key, {
        loc: nameProjection,
        proximity: clamp(1 - playerDist / MAX_PLAYER_OVERLAY_DIST, 0, 1),
      });

      overlayMap.set(key, {
        kind: "name",
        key,
        entity,
        name: displayUsername(entity.label.text),
        typing: this.mailMan.isCurrentlyTyping(entity.id),
        beginHide:
          recentText &&
          recentText.createdAt + OVERLAY_TEXT_TIME_MS - 300 > Date.now()
            ? false
            : true,
        recentText:
          recentText && recentText.createdAt + OVERLAY_TEXT_TIME_MS > Date.now()
            ? recentText
            : undefined,
        health: undefined,
        entityId: entity.id,
      });
    }
  }

  private publishHarthmereEcsNpcCombatRegistry() {
    const localPlayer = this.resources.get("/scene/local_player");
    const actors: Record<string, HarthmereEcsNpcCombatActorRegistryEntry> = {};
    const seenNpcEntityIds: number[] = [];
    const missingNpcEntityIds: number[] = [];
    const invalidNpcTypeEntityIds: number[] = [];
    const deadNpcEntityIds: number[] = [];
    const now = Date.now();

    for (const entity of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: HARTHMERE_ECS_NPC_COMBAT_REGISTRY_SCAN_RADIUS,
      })
    )) {
      seenNpcEntityIds.push(Number(entity.id));

      if (!isNpcTypeId(entity.npc_metadata.type_id)) {
        invalidNpcTypeEntityIds.push(Number(entity.id));
        continue;
      }

      const npcType = idToNpcType(entity.npc_metadata.type_id);
      const becomeTheNPC = this.resources.get("/scene/npc/become_npc");
      const motionOverrides =
        becomeTheNPC.kind === "active" && becomeTheNPC.entityId === entity.id
          ? becomeTheNPC
          : undefined;
      const npc = this.resources.cached("/scene/npc/render_state", entity.id);
      const rawNpcPos =
        motionOverrides?.position ??
        npc?.smoothedPosition() ??
        entity.position?.v;
      const npcPos = rawNpcPos
        ? snapshotGroundLiveNpcPosition(rawNpcPos, entity.label?.text)
        : undefined;
      void SNAPSHOT_LIVE_NPC_GROUNDING_VERSION;
      if (!npcPos) {
        missingNpcEntityIds.push(Number(entity.id));
        continue;
      }

      const npcSize = entity.size?.v ?? getOverlayEntitySizeCompat(entity);
      const npcName = entity.label?.text ?? npcType.displayName;
      const hp = Number(entity.health?.hp);
      const maxHp = Number(entity.health?.maxHp);
      const alive = !Number.isFinite(hp) || hp > 0;
      if (!alive) {
        deadNpcEntityIds.push(Number(entity.id));
      }
      const attackable = alive;
      const bridgeText = harthmereEcsNpcCombatRegistryText(
        npcName,
        npcType.displayName,
        entity.npc_metadata.type_id
      );
      const species = harthmereEcsNpcCombatRegistrySpeciesFromText(bridgeText);
      const behavior = harthmereEcsNpcCombatRegistryBehaviorFromText(
        bridgeText,
        attackable
      );
      const socialRole = harthmereEcsNpcCombatRegistrySocialRoleFromBehavior(
        behavior,
        species
      );

      actors[String(entity.id)] = {
        offset: Number(entity.id),
        entityId: Number(entity.id),
        npcTypeId: Number(entity.npc_metadata.type_id),
        label: npcName,
        asset: npcType.displayName,
        pos: [npcPos[0], npcPos[2]],
        world: [...npcPos] as Vec3,
        radius: Math.max(
          0.65,
          Math.min(3.75, Math.max(npcSize[0], npcSize[2], 0.85) * 0.7)
        ),
        species,
        behavior,
        socialRole,
        attackable,
        health: Number.isFinite(hp)
          ? { hp, maxHp: Number.isFinite(maxHp) ? maxHp : hp }
          : undefined,
        at: now,
        source: "ecs_npc_combat_registry",
      };
    }

    const actorOffsets = Object.keys(actors).map(Number);
    publishHarthmereEcsNpcCombatRegistry(actors, {
      version: HARTHMERE_ECS_NPC_COMBAT_REGISTRY,
      scanRadius: HARTHMERE_ECS_NPC_COMBAT_REGISTRY_SCAN_RADIUS,
      expectedNpcCount: seenNpcEntityIds.length,
      registeredNpcCount: actorOffsets.length,
      missingNpcEntityIds,
      invalidNpcTypeEntityIds,
      deadNpcEntityIds,
      actorOffsets,
      labels: Object.values(actors)
        .slice(0, 48)
        .map((actor) => ({
          offset: actor.offset,
          label: actor.label,
          behavior: actor.behavior,
          species: actor.species,
          socialRole: actor.socialRole,
          attackable: actor.attackable,
          hp: actor.health?.hp,
          maxHp: actor.health?.maxHp,
        })),
      at: now,
    });
  }

  applyNpcNameOverlays(overlayMap: OverlayMap, projectionMap: ProjectionMap) {
    const camera = this.resources.get("/scene/camera");
    const localPlayer = this.resources.get("/scene/local_player");
    const ecsNpcCombatActorBridge: Record<
      string,
      HarthmereEcsNpcCombatActorBridgeEntry
    > = {};

    for (const entity of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: MAX_NPC_OVERLAY_DIST,
      })
    )) {
      if (!isNpcTypeId(entity.npc_metadata.type_id)) {
        log.throttledError(
          10_000,
          `Entity ${entity.id} has npc_metadata but invalid type_id (${entity.npc_metadata.type_id})`
        );
        continue;
      }

      const npcType = idToNpcType(entity.npc_metadata.type_id);

      const shouldHideNameOverlay =
        getNpcBehavior(npcType).hideNameOverlay?.hideNameOverlay;

      if (
        shouldHideNameOverlay ||
        !entity.health?.hp ||
        entity.health.hp <= 0
      ) {
        continue;
      }

      const npc = this.resources.cached("/scene/npc/render_state", entity.id);
      if (!npc) {
        continue;
      }

      const becomeTheNPC = this.resources.get("/scene/npc/become_npc");
      const motionOverrides =
        becomeTheNPC.kind === "active" && becomeTheNPC.entityId === entity.id
          ? becomeTheNPC
          : undefined;
      const npcPos = motionOverrides?.position ?? npc.smoothedPosition();
      const npcSize = entity.size?.v ?? getOverlayEntitySizeCompat(entity);
      const npcName = entity.label?.text ?? npcType.displayName;
      const attackable = Boolean(
        getNpcBehavior(npcType).damageable?.attackable &&
          entity.health?.hp !== undefined &&
          entity.health.hp > 0
      );
      const bridgeText = harthmereEcsNpcCombatBridgeText(
        npcName,
        npcType.displayName,
        entity.npc_metadata.type_id
      );
      const species = harthmereEcsNpcCombatSpeciesFromText(bridgeText);
      const behavior = harthmereEcsNpcCombatBehaviorFromText(
        bridgeText,
        attackable
      );
      ecsNpcCombatActorBridge[String(entity.id)] = {
        offset: Number(entity.id),
        entityId: Number(entity.id),
        npcTypeId: Number(entity.npc_metadata.type_id),
        label: npcName,
        asset: npcType.displayName,
        pos: [npcPos[0], npcPos[2]],
        world: [...npcPos] as Vec3,
        radius: Math.max(
          0.65,
          Math.min(3.75, Math.max(npcSize[0], npcSize[2], 0.85) * 0.7)
        ),
        species,
        behavior,
        socialRole: harthmereEcsNpcCombatSocialRoleFromBehavior(
          behavior,
          species
        ),
        attackable,
        health: entity.health
          ? { hp: entity.health.hp, maxHp: entity.health.maxHp }
          : undefined,
        at: Date.now(),
        source: "ecs_npc_overlay_bridge",
      };

      const namePos: Vec3 = add(
        [npcPos[0], npcPos[1] + npcSize[1], npcPos[2]],
        PLAYER_PROJECTION_OFFSET
      );
      const nameProjection = screenCoordinateProjection(namePos, camera);
      if (!nameProjection) {
        continue;
      }

      const npcDist = dist(npcPos, localPlayer.player.position);
      if (this.isOccluded(namePos, camera)) {
        continue;
      }

      const key = `npc:${entity.id}`;

      projectionMap.set(key, {
        loc: nameProjection,
        proximity: clamp(1 - npcDist / MAX_NPC_OVERLAY_DIST, 0, 1),
      });

      overlayMap.set(key, {
        kind: "name",
        key,
        entity,
        name: entity.label?.text ?? npcType.displayName,
        typing: false,
        beginHide: true,
        health: getNpcBehavior(npcType).damageable?.attackable
          ? entity.health
          : undefined,
        entityId: entity.id,
        npcType,
      });
    }
    publishHarthmereEcsNpcCombatActorSnapshot(ecsNpcCombatActorBridge);
  }

  applyMinigameElementOverlays(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap
  ) {
    const camera = this.resources.get("/scene/camera");
    const localPlayer = this.resources.get("/scene/local_player");

    for (const entity of this.table.scan(
      MinigameElementsSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: MAX_MINIGAME_OVERLAY_DIST,
      })
    )) {
      const aabb = getAabbForEntity(entity);
      if (!aabb) {
        continue;
      }

      const namePos = centerAABB(aabb);
      namePos[1] = aabb[1][1];

      const nameProjection = screenCoordinateProjection(namePos, camera);
      if (!nameProjection) {
        continue;
      }

      const npcDist = dist(namePos, localPlayer.player.position);

      const key = `minigameElement:${entity.id}`;
      projectionMap.set(key, {
        loc: nameProjection,
        proximity: clamp(1 - npcDist / MAX_NPC_OVERLAY_DIST, 0, 1),
      });

      overlayMap.set(key, {
        kind: "minigame_element",
        key,
        minigameId: entity.minigame_element.minigame_id,
        elementId: entity.id,
        isOccluded: this.isOccluded(namePos, camera),
        pos: namePos,
      });
    }
  }

  applyQuestGiverNameOverlays(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap
  ) {
    const localPlayer = this.resources.get("/scene/local_player");

    for (const entity of this.table.scan(
      NamedQuestGiverSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: MAX_NPC_OVERLAY_DIST,
      })
    )) {
      // Containers/boards bridged through quest_giver are non-living props.
      // Their object overlay owns the label and uses the real placeable bounds;
      // sending them through NPC-name sizing produced human fallback warnings
      // for Billy's Toolbag and the Clothing Crate.
      if (this.isHarthmereWorldObjectEntity(entity)) {
        continue;
      }
      const npcKey = `npc:${entity.id}`;
      if (overlayMap.has(npcKey)) {
        continue; // Already handled in NPC selector above
      }

      this.basicEntityPosition(overlayMap, projectionMap, entity, npcKey, {
        kind: "name",
        key: npcKey,
        entity,
        name: entity.label?.text,
        typing: false,
        beginHide: true,
        entityId: entity.id,
      });
    }
  }

  applyRestoredPlaceableOverlay(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap
  ) {
    const localPlayer = this.resources.get("/scene/local_player");

    for (const entity of this.table.scan(
      RestoredPlaceableSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: MAX_NPC_OVERLAY_DIST,
      })
    )) {
      if (
        entity.restores_to?.restore_to_state !== "deleted" ||
        !isFinite(entity.restores_to.trigger_at)
      ) {
        continue;
      }
      const key = `restoredPlaceable:${entity.id}`;
      this.basicEntityPosition(overlayMap, projectionMap, entity, key, {
        kind: "restored_placeable",
        key,
        entity,
      });
    }
  }

  private basicEntityPosition(
    overlayMap: OverlayMap,
    projectionMap: ProjectionMap,
    entity: ReadonlyEntity,
    key: string,
    overlay: Overlay
  ) {
    const localPlayer = this.resources.get("/scene/local_player");
    const camera = this.resources.get("/scene/camera");

    const rawNpcPos = entity.position?.v;
    const npcPos = rawNpcPos
      ? snapshotGroundLiveNpcPosition(rawNpcPos, entity.label?.text)
      : undefined;
    void SNAPSHOT_LIVE_NPC_GROUNDING_VERSION;
    if (!npcPos) {
      log.warn(
        "SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT missing entity position; skipping overlay",
        {
          entityId: entity.id,
          label: entity.label?.text,
          version: SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION,
        }
      );
      return;
    }
    const npcSize = getOverlayEntitySizeCompat(entity);

    const namePos: Vec3 = add(
      [npcPos[0], npcPos[1] + npcSize[1], npcPos[2]],
      PLAYER_PROJECTION_OFFSET
    );
    const nameProjection = screenCoordinateProjection(namePos, camera);
    if (!nameProjection) {
      return;
    }
    const npcDist = dist(npcPos, localPlayer.player.position);
    if (this.isOccluded(namePos, camera)) {
      return;
    }

    projectionMap.set(key, {
      loc: nameProjection,
      proximity: clamp(1 - npcDist / MAX_NPC_OVERLAY_DIST, 0, 1),
    });

    overlayMap.set(key, overlay);
  }

  getTweakedInspectableOverlay(): InspectableOverlay | undefined {
    const overlay = this.getInspectableOverlay();
    if (!overlay) {
      return undefined;
    }
    const tweaks = this.resources.get(
      "/ecs/c/inspection_tweaks",
      overlay.entityId
    );
    if (tweaks?.hidden) {
      return {
        kind: "hidden",
        entityId: overlay.entityId,
        overlay: overlay,
      };
    }
    return overlay;
  }

  getInspectableOverlay(): InspectableOverlay | undefined {
    const { hit } = this.resources.get("/scene/cursor");

    if (hit?.kind === "entity") {
      const entity = hit.entity;
      const maxInspectDistance = entity.npc_metadata
        ? Math.max(
            changeRadius(this.resources),
            HARTHMERE_NPC_TALK_INSPECT_RADIUS
          )
        : changeRadius(this.resources);
      if (hit.distance > maxInspectDistance) {
        return (
          this.getNearbyGrabBagInspectableOverlay() ??
          this.getNearbyHarthmereObjectInspectableOverlay() ??
          this.getNearbyHarthmerePlaceableCraftingStationOverlay() ??
          this.getNearbyNpcTalkInspectableOverlay()
        );
      }
      ok(entity.position);
      if (entity.player_behavior) {
        // A player standing on a repair post, terminal, crate, or other
        // authored world object must not make that object unusable. Keep the
        // same tight range/facing/occlusion gates as every other nearby-object
        // fallback, but let the object win when the reticle-facing evidence
        // says the user is genuinely trying to interact with it.
        const nearbyHarthmereObjectOverlay =
          this.getNearbyHarthmereObjectInspectableOverlay();
        if (nearbyHarthmereObjectOverlay) {
          return nearbyHarthmereObjectOverlay;
        }
        return {
          kind: "player",
          key: `inspect:player:${entity.id}`,
          entityId: entity.id,
        };
      } else if (entity.grab_bag) {
        return {
          kind: "grab_bag",
          key: `inspect:grab_bag:${entity.id}`,
          entityId: entity.id,
        };
      } else if (entity.robot_component) {
        return {
          kind: "robot",
          key: `inspect:robot:${entity.id}`,
          entityId: entity.id,
        };
      } else if (
        entity.npc_metadata &&
        !this.isHarthmereWorldObjectEntity(entity)
      ) {
        // Real, living NPC. Objects that happen to be bridged as `npc_metadata`
        // voxel props (their label names a crate/chest/board/...) are excluded
        // here so they fall through to the world-object prompt below instead of
        // offering a (non-functional) Talk prompt.
        const npcType = idToNpcType(entity.npc_metadata.type_id);
        return {
          kind: "npc",
          key: `inspect:npc:${entity.id}`,
          npcType: npcType,
          entity,
          entityId: entity.id,
        };
      } else if (
        entity.placeable_component &&
        entity.placed_by &&
        !this.isAuthoredHarthmereWorldObjectPlaceable(entity) &&
        // NATIVE_QUEST_CONTAINER_DIRECT_HIT_EXEMPTION (2026-07-26):
        // Busted's sunken chest is a real snapshot container placeable, but
        // its reward inventory is private and materialized only after the
        // Harthmere object interaction runs. Returning the generic placeable
        // overlay here lets a direct cursor hit preempt that interaction and
        // produces no usable F shortcut. The proximity fallback worked only
        // when the ray hit the surrounding hull, which made the old browser
        // test pass while a player looking straight at the chest remained
        // blocked. Native quest containers must fall through to the authored
        // object overlay for both direct hits and nearby discovery.
        !shouldBypassGenericPlaceableOverlayForNativeQuestContainer({
          label: entity.label?.text,
          placedBy: entity.placed_by,
        })
      ) {
        // Player-placed placeable: keep the rich, item-type-specific overlay
        // (container / door / sign / crafting station / ...). Authored Harthmere
        // world props (a frame/plain placeable whose label names a crate/chest/
        // ... and that carries a quest_giver) are intentionally excluded here so
        // they fall through to the world-object prompt below — their placeable
        // item (a picture frame) otherwise routes to a frame overlay with no
        // usable engagement. See isAuthoredHarthmereWorldObjectPlaceable.
        return {
          kind: "placeable",
          key: `inspect:placeable:${entity.id}`,
          entityId: entity.id,
          itemId: entity.placeable_component.item_id,
          placerId: entity.placed_by.id,
        };
      }
      // HARTHMERE_WORLD_OBJECT_DIRECT_HIT_PROMPT:
      // The cursor ray is directly on an entity we already hold in hand. If its
      // label/description marks it a non-living world object (a seeded chest /
      // crate / bin / board / ... that has a `label` but no `placed_by`, so the
      // rich placeable branch above never fires), surface the world-object
      // toaster straight from this entity. This is what makes "look at the
      // chest -> Open Container" work without the object having to be listed in
      // any static landmark table.
      if (/\binscriptions?\b/i.test(entity.label?.text ?? "")) {
        // Old snapshots contain readable duplicate plates beside the four
        // quest-authored children. A direct ray on a duplicate must still
        // resolve the nearby canonical source id, otherwise the dialogue looks
        // correct but server validation cannot advance the exact quest leaf.
        const canonicalInscription =
          this.getNearbyPriorityHarthmereObjectInspectableOverlay(
            NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_ID_SET
          );
        if (canonicalInscription) {
          return canonicalInscription;
        }
      }
      const directObjectOverlay =
        this.harthmereWorldObjectOverlayForEntity(entity);
      if (directObjectOverlay) {
        return directObjectOverlay;
      }
      // HARTHMERE_WORLD_OBJECT_PROMPT_PRIORITY:
      // Prefer the world-object (crate/chest/bag) prompt over the NPC-talk
      // fallback. The NPC fallback is greedy (8.5m, full forward hemisphere, no
      // facing gate), so any townsfolk standing near a prop would otherwise
      // shadow the "Open Container" prompt and players could never interact with
      // world objects. The object selector enforces a tight facing cone
      // (minViewDot 0.15, 6.5m), so it only wins when the player is genuinely
      // looking at the prop; otherwise the NPC-talk prompt still shows.
      return (
        this.getNearbyGrabBagInspectableOverlay() ??
        this.getNearbyHarthmereObjectInspectableOverlay() ??
        this.getNearbyHarthmerePlaceableCraftingStationOverlay() ??
        this.getNearbyNpcTalkInspectableOverlay()
      );
    }

    // A terrain ray hit is more specific than any proximity fallback. Resolve
    // native groups/plants before nearby bags, authored props, stations, or
    // NPCs; otherwise a person or crate several metres away can steal the
    // inspection overlay from the fully-grown crop under the reticle and the
    // HarvestPlantEvent is never emitted.
    if (hitExistingTerrain(hit)) {
      const groupId = groupOccupancyAt(this.resources, hit.pos);
      if (groupId) {
        // GROUPED_REWARD_PROP_BEATS_PARENT_GROUP (2026-07-26): the Muck Buster
        // Crate is a child of the sunken-ship group. The reticle therefore hits
        // ship terrain and resolves a hidden `group` overlay before the nearby
        // object selector can expose the crate. Let only the exact immutable
        // reward/quest props listed above override their parent group; all
        // ordinary groups, crops, and terrain retain their existing priority.
        const nearbyPriorityQuestProp =
          this.getNearbyPriorityHarthmereObjectInspectableOverlay();
        if (nearbyPriorityQuestProp) {
          return nearbyPriorityQuestProp;
        }
        const label = this.resources.get("/ecs/c/label", groupId);
        if (label) {
          return {
            kind: "group",
            key: `inspect:group:${groupId}`,
            entityId: groupId,
            label: label.text,
          };
        }
      }
      const plantId = plantExperimentalAt(this.resources, hit.pos);
      if (plantId) {
        const camera = this.resources.get("/scene/camera");
        const projection = screenCoordinateProjection(
          add(hit.pos, [0.5, 1.0, 0.5]),
          camera
        );
        if (projection) {
          return {
            kind: "plant",
            key: `inspect:plant:${plantId}`,
            pos: hit.pos,
            entityId: plantId,
            projection,
          };
        }
      }
      // A direct terrain hit terminates generic proximity fallbacks. Only an
      // authored procedural object at roughly the same depth may still win;
      // crates, NPCs, bags, and stations behind the aimed voxel cannot leak an
      // unrelated F prompt through the reticle.
      const localPlayer = this.resources.get("/scene/local_player");
      return this.getNearbyHarthmereObjectInspectableOverlay(
        dist(hit.pos, localPlayer.player.position) + 1.25
      );
    }

    // HARTHMERE_WORLD_OBJECT_PROMPT_PRIORITY: object before NPC fallback
    // (see rationale above), but only after a direct terrain target.
    const nearbyGrabBagOverlay = this.getNearbyGrabBagInspectableOverlay();
    if (nearbyGrabBagOverlay) {
      return nearbyGrabBagOverlay;
    }

    const nearbyHarthmereObjectOverlay =
      this.getNearbyHarthmereObjectInspectableOverlay();
    if (nearbyHarthmereObjectOverlay) {
      return nearbyHarthmereObjectOverlay;
    }

    const nearbyHarthmereCraftingStationOverlay =
      this.getNearbyHarthmerePlaceableCraftingStationOverlay();
    if (nearbyHarthmereCraftingStationOverlay) {
      return nearbyHarthmereCraftingStationOverlay;
    }

    const nearbyNpcTalkOverlay = this.getNearbyNpcTalkInspectableOverlay();
    if (nearbyNpcTalkOverlay) {
      return nearbyNpcTalkOverlay;
    }
  }

  private getNearbyGrabBagInspectableOverlay(): InspectableOverlay | undefined {
    const localPlayer = this.resources.get("/scene/local_player");
    let best:
      | {
          entityId: BiomesId;
          distance: number;
        }
      | undefined;
    for (const entity of this.table.scan(
      DropSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: this.clientConfig.gameDropPickupDistance + 1,
      })
    )) {
      const position = entity.position?.v;
      if (!position || !entity.grab_bag) continue;
      const distance = dist(position, localPlayer.player.position);
      if (!best || distance < best.distance) {
        best = { entityId: entity.id, distance };
      }
    }
    return best
      ? {
          kind: "grab_bag",
          key: `inspect:grab_bag:nearby:${best.entityId}`,
          entityId: best.entityId,
        }
      : undefined;
  }

  // HARTHMERE_WORLD_OBJECT_INSPECT_OVERLAY
  // Returns true when an ECS entity's label/description marks it a non-living,
  // interactable world prop (crate / chest / board / cookpot / door / ...). This
  // is the same gate the object-interaction semantics use, so the prompt only
  // appears for objects the resolver knows how to act on.
  private isHarthmereWorldObjectEntity(entity: ReadonlyEntity): boolean {
    return isHarthmereInspectableWorldObject({
      label: entity.label?.text,
      entityDescription: entity.entity_description?.text,
    });
  }

  // True when a placeable item already renders its own item-type-specific
  // inspection overlay (container / door / sign / shop / crafting / outfit /
  // mailbox / media player). Those must keep their native overlay. Frames and
  // flagless placeables return false — they have no useful engagement of their
  // own, so an authored world-object label is allowed to drive the prompt.
  private placeableItemHasOwnInteractiveOverlay(itemId: BiomesId): boolean {
    const item = anItem(itemId);
    return Boolean(
      item.isContainer ||
        item.isDoor ||
        item.isShopContainer ||
        item.isCraftingStation ||
        item.isOutfitStand ||
        item.readable ||
        item.isCustomizableTextSign ||
        item.isMailbox ||
        item.isMediaPlayer
    );
  }

  // HARTHMERE_AUTHORED_PLACEABLE_WORLD_OBJECT:
  // The crates/chests/etc. players actually run into are NOT label-only seeded
  // entities — they are *placed placeables* (placeable_component + placed_by)
  // authored as picture frames that carry a quest_giver and a world-object
  // `label` (confirmed against prod redis: "Clothing Crate",
  // "Chest The Grove Underwater Main", ...). Because they have placed_by, the
  // rich placeable branch claims them and routes their frame item to a frame
  // overlay with no usable engagement, and the proximity scan skipped them.
  // This identifies that authored class so both paths route them to the
  // world-object ("F") prompt instead. Guards keep player builds untouched:
  //  - must carry a quest_giver (authored-content marker; player storage chests
  //    and decor do not), and
  //  - the placeable item must have no interactive overlay of its own (so real
  //    player-placed containers/doors/signs keep their native overlay).
  private isAuthoredHarthmereWorldObjectPlaceable(
    entity: ReadonlyEntity
  ): boolean {
    if (!entity.placeable_component || !entity.quest_giver) {
      return false;
    }
    if (!this.isHarthmereWorldObjectEntity(entity)) {
      return false;
    }
    return !this.placeableItemHasOwnInteractiveOverlay(
      entity.placeable_component.item_id
    );
  }

  // Builds the world-object ("F") overlay directly from a live ECS entity, used
  // when the cursor ray lands on a labeled world object that the rich placeable
  // branch did not handle (e.g. a seeded container with no `placed_by`). Carries
  // the real entityId so the interaction handlers can de-dupe per instance.
  private harthmereWorldObjectOverlayForEntity(
    entity: ReadonlyEntity
  ): InspectableOverlay | undefined {
    if (!this.isHarthmereWorldObjectEntity(entity)) {
      return undefined;
    }
    const label = entity.label?.text ?? "";
    const pos = entity.position?.v;
    const candidate: HarthmereWorldObjectCandidate = {
      id: `ecs:${entity.id}`,
      label,
      position: pos ? [pos[0], pos[1], pos[2]] : [0, 0, 0],
      entityDescription: entity.entity_description?.text,
    };
    return {
      kind: "harthmere_object",
      key: `inspect:harthmere_object:entity:${entity.id}`,
      entityId: entity.id,
      objectId: candidate.id,
      label,
      entityDescription: candidate.entityDescription,
      pos: candidate.position,
    };
  }

  /**
   * Select only immutable snapshot quest props that are allowed to beat their
   * parent group terrain. Filtering before scoring prevents a nearby duplicate
   * inscription or unrelated live object from winning merely because its
   * legacy anchor is a little closer than the canonical quest child.
   */
  private getNearbyPriorityHarthmereObjectInspectableOverlay(
    entityIds: ReadonlySet<BiomesId> = NATIVE_PRIORITY_QUEST_PROP_ENTITY_IDS
  ): InspectableOverlay | undefined {
    const localPlayer = this.resources.get("/scene/local_player");
    const candidates: HarthmereWorldObjectCandidate[] = [];
    const entityIdByCandidateId = new Map<string, BiomesId>();
    for (const entityId of entityIds) {
      const entity = this.table.get(entityId);
      const position = entity?.position?.v;
      if (!entity || !position || !this.isHarthmereWorldObjectEntity(entity)) {
        continue;
      }
      const id = `ecs:${entityId}`;
      entityIdByCandidateId.set(id, entityId);
      candidates.push({
        id,
        label: entity.label?.text ?? "",
        position: [position[0], position[1], position[2]],
        entityDescription: entity.entity_description?.text,
      });
    }
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [...localPlayer.player.position] as [
        number,
        number,
        number
      ],
      facingView: viewDir([0, localPlayer.player.orientation[1]]) as [
        number,
        number,
        number
      ],
      candidates,
      radius: HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS,
    });
    if (!selected) {
      return undefined;
    }
    const entityId =
      entityIdByCandidateId.get(selected.id) ?? INVALID_BIOMES_ID;
    return {
      kind: "harthmere_object",
      key: `inspect:harthmere_object:entity:${entityId}`,
      entityId,
      objectId: selected.id,
      label: selected.label,
      entityDescription: selected.entityDescription,
      pos: [selected.position[0], selected.position[1], selected.position[2]],
    };
  }

  // Scans the live ECS table near the player for labeled world objects (seeded
  // chests/crates/boards/...) and returns them as inspect candidates. These are
  // the objects that exist in the running world but are NOT enumerated in any
  // static landmark table, which is why they previously never showed a prompt.
  // Player-placed placeables (`placed_by`) are intentionally skipped so their
  // richer aimed overlay still wins. `entityIdByCandidateId` lets the caller map
  // the selected candidate back to its real entityId.
  private harthmereLiveWorldObjectInspectCandidates(
    playerPosition: ReadonlyVec3,
    entityIdByCandidateId: Map<string, BiomesId>
  ): HarthmereWorldObjectCandidate[] {
    const candidates: HarthmereWorldObjectCandidate[] = [];
    const seen = new Set<BiomesId>();
    const radius = HARTHMERE_WORLD_OBJECT_INSPECT_TABLE_SCAN_RADIUS;
    const center = playerPosition;
    const consider = (entity: ReadonlyEntity) => {
      if (seen.has(entity.id)) {
        return;
      }
      // Never offer the world-object prompt for the local player, real NPCs,
      // robots, or player-placed placeables that have their own overlay. Authored
      // Harthmere world props (frame/plain placeables with a quest_giver +
      // world-object label) are NOT skipped — they are exactly the seeded
      // crates/chests that need the prompt (see
      // isAuthoredHarthmereWorldObjectPlaceable).
      if (
        entity.player_behavior ||
        entity.robot_component ||
        (entity.placeable_component &&
          entity.placed_by &&
          !this.isAuthoredHarthmereWorldObjectPlaceable(entity) &&
          // NATIVE_QUEST_CONTAINER_PROXIMITY_EXEMPTION (2026-07-25):
          // Busted's sunken chest is an original-snapshot container with
          // `placed_by` set, so it was skipped here in favour of the aimed
          // overlay — which never fires underwater because the cursor ray
          // hits the hull/water first. Known native-quest containers must
          // stay proximity-discoverable; the server still owns range and
          // step validation on open.
          !shouldBypassGenericPlaceableOverlayForNativeQuestContainer({
            label: entity.label?.text,
            placedBy: entity.placed_by,
          }))
      ) {
        return;
      }
      if (!this.isHarthmereWorldObjectEntity(entity)) {
        return;
      }
      const pos = entity.position?.v;
      if (!pos) {
        return;
      }
      seen.add(entity.id);
      const id = `ecs:${entity.id}`;
      const candidate: HarthmereWorldObjectCandidate = {
        id,
        label: entity.label?.text ?? "",
        position: [pos[0], pos[1], pos[2]],
        entityDescription: entity.entity_description?.text,
      };
      // Static, renderer-authored quest/source markers are still filtered by
      // harthmereVisibleStaticWorldObjectInspectCandidates above. A live ECS
      // crate/chest that is already rendered in the world is visible gameplay
      // state, so it must keep its prompt regardless of quest pin state.
      entityIdByCandidateId.set(id, entity.id);
      candidates.push(candidate);
    };
    // GROUPED_QUEST_PROP_DIRECT_LOOKUP (2026-07-26): the authored Busted
    // `Muck Buster Crate` is a child of the sunken-ship group. Group children
    // are synchronized into the client table but are not guaranteed to appear
    // in the spatial PlaceableSelector index, so the surrounding ship wins the
    // cursor hit and the crate receives no F prompt. These two immutable
    // snapshot reward props already have exact source ids in the shared quest
    // contract. Feed their synchronized entities through the same candidate
    // validator before the spatial scans; this is not a synthetic marker and
    // cannot surface unless the real source entity is present in client ECS.
    for (const spec of Object.values(NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS)) {
      const entity = this.table.get(spec.sourceEntityId);
      if (entity) {
        consider(entity);
      }
    }
    for (const entityId of NATIVE_PRIORITY_QUEST_PROP_ENTITY_IDS) {
      const entity = this.table.get(entityId);
      if (entity) {
        consider(entity);
      }
    }
    for (const entity of this.table.scan(
      PlaceableSelector.query.spatial.inSphere({ center, radius })
    )) {
      consider(entity);
    }
    for (const entity of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere({ center, radius })
    )) {
      consider(entity);
    }
    for (const entity of this.table.scan(
      NamedQuestGiverSelector.query.spatial.inSphere({ center, radius })
    )) {
      consider(entity);
    }
    return candidates;
  }

  // HARTHMERE_PLACEABLE_CRAFTING_STATION_FALLBACK:
  // Crafting stations (including campfires / ovens / pots) already have the
  // correct native placeable overlay when the cursor ray hits them. In Harthmere's
  // third-person camera, though, standing at the station often does not mean the
  // cursor ray selects it, so the player sees no F prompt. This proximity fallback
  // resolves nearby real placeable crafting stations and returns the same
  // `placeable` inspect overlay the raycast path would have produced, preserving
  // the existing crafting/cooking routing without changing signs, NPCs, boards, or
  // ordinary props.
  private getNearbyHarthmerePlaceableCraftingStationOverlay():
    | InspectableOverlay
    | undefined {
    const localPlayer = this.resources.get("/scene/local_player");
    const playerPosition: ReadonlyVec3 = [
      localPlayer.player.position[0],
      localPlayer.player.position[1],
      localPlayer.player.position[2],
    ];
    const entityByCandidateId = new Map<string, ReadonlyEntity>();
    const candidates: HarthmereCraftingTableCandidate[] = [];

    for (const entity of this.table.scan(
      PlaceableSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: HARTHMERE_CRAFTING_TABLE_PROMPT_RADIUS + 0.5,
      })
    )) {
      const placeable = entity.placeable_component;
      const pos = entity.position?.v;
      if (!placeable || !pos) {
        continue;
      }
      const item = anItem(placeable.item_id);
      // Crafting stations (workbench/anvil/...) AND placed cooking stations
      // (campfire / oven / cookpot / fire pit) both get the proximity "F" prompt
      // here. Cooking stations are not flagged isCraftingStation, so without the
      // cook predicate the player standing over a campfire would see no prompt.
      const isCookStation = isHarthmerePlacedCookStationItem(item);
      if (!item.isCraftingStation && !isCookStation) {
        continue;
      }
      const id = String(entity.id);
      entityByCandidateId.set(id, entity);
      candidates.push({
        entityId: id,
        position: [pos[0], pos[1], pos[2]],
        isCraftingStation: true,
        stationName: item.displayName,
      });
    }

    const selected = selectNearestHarthmereCraftingTable({
      playerPosition,
      facingView: viewDir([0, localPlayer.player.orientation[1]]) as [
        number,
        number,
        number
      ],
      candidates,
    });
    if (!selected) {
      return undefined;
    }
    const entity = entityByCandidateId.get(selected.entityId);
    if (!entity?.placeable_component) {
      return undefined;
    }
    return {
      kind: "placeable",
      key: `inspect:placeable:crafting_station_fallback:${entity.id}`,
      entityId: entity.id,
      itemId: entity.placeable_component.item_id,
      placerId: entity.placed_by?.id ?? INVALID_BIOMES_ID,
      label: selected.stationName,
    };
  }

  // Produces the "F" inspect/interact prompt for nearby world objects. Candidates
  // come from BOTH the static landmark tables (procedural Grove props) AND the
  // live ECS table (seeded chests/crates/boards/... that exist in the running
  // world but aren't enumerated in source). CursorInspectionComponent then
  // resolves the authored interaction (open container, read, craft, repair, ...)
  // it already uses for placeables and NPCs.
  private getNearbyHarthmereObjectInspectableOverlay(
    maxDistance?: number
  ): InspectableOverlay | undefined {
    const localPlayer = this.resources.get("/scene/local_player");
    const playerPosition: ReadonlyVec3 = [
      localPlayer.player.position[0],
      localPlayer.player.position[1],
      localPlayer.player.position[2],
    ];
    const entityIdByCandidateId = new Map<string, BiomesId>();
    const bustedChestCandidateId = `ecs:${NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId}`;
    entityIdByCandidateId.set(
      bustedChestCandidateId,
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId
    );
    const liveCandidates = this.harthmereLiveWorldObjectInspectCandidates(
      localPlayer.player.position,
      entityIdByCandidateId
    );
    const priorityCandidateIds = new Set(
      [...NATIVE_PRIORITY_QUEST_PROP_ENTITY_IDS].map(
        (entityId) => `ecs:${entityId}`
      )
    );
    const activeQuestMarkerIds = activeHarthmereQuestMarkerIds(
      readSnapshotGroveQuestState()
    );
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition,
      facingView: viewDir([0, localPlayer.player.orientation[1]]) as [
        number,
        number,
        number
      ],
      candidates: [
        ...harthmereVisibleStaticWorldObjectInspectCandidates(
          this.resources
        ).filter(
          (candidate) =>
            !nativeRoadAheadEcsAuthorityEnabled() ||
            !isNativeRoadAheadQuestObjectLabel(candidate.label)
        ),
        // Canonical snapshot fallback. The real source entity is still fetched
        // and validated by the server, but the prompt no longer depends on the
        // client spatial table having synchronized this old placed frame.
        {
          id: bustedChestCandidateId,
          label: "Chest The Grove Underwater Main",
          position: NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.position,
        },
        ...liveCandidates,
      ],
      radius:
        maxDistance === undefined
          ? undefined
          : Math.min(HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS, maxDistance),
      // A reticle hit on the ship hull or the chest's voxel art must not shrink
      // the container prompt to the terrain-hit depth.
      containerRadius: HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS,
      // Grouped quest plates/crates use immutable source ids. Their own parent
      // terrain may be the shallow cursor hit, so keep the normal 6.5m facing
      // gate for those exact candidates instead of clipping them to the hit.
      priorityCandidateIds,
      priorityRadius: HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS,
      preferredCandidateIds: activeQuestMarkerIds,
    });
    if (!selected) {
      return undefined;
    }
    const camera = this.resources.get("/scene/camera");
    const targetPosition: Vec3 = [
      selected.position[0],
      selected.position[1] + 1,
      selected.position[2],
    ];
    // Third-person cameras commonly sit outside an underwater ship or ruin
    // while the player and chest are together inside it. Nearby containers are
    // already constrained by the live spatial scan and the server's 3-D range
    // check, so hull/camera occlusion must not suppress their universal F
    // prompt. Other object types keep the stricter visible-target behavior.
    if (
      !selected.isContainer &&
      !selected.isPriority &&
      (!screenCoordinateProjection(targetPosition, camera) ||
        this.isOccluded(targetPosition, camera))
    ) {
      return undefined;
    }
    const realEntityId =
      entityIdByCandidateId.get(selected.id) ?? INVALID_BIOMES_ID;
    return {
      kind: "harthmere_object",
      key:
        realEntityId !== INVALID_BIOMES_ID
          ? `inspect:harthmere_object:entity:${realEntityId}`
          : `inspect:harthmere_object:${selected.id}`,
      entityId: realEntityId,
      objectId: selected.id,
      label: selected.label,
      entityDescription: selected.entityDescription,
      pos: [selected.position[0], selected.position[1], selected.position[2]],
    };
  }

  private getNearbyNpcTalkInspectableOverlay(): InspectableOverlay | undefined {
    const localPlayer = this.resources.get("/scene/local_player");
    const becomeTheNPC = this.resources.get("/scene/npc/become_npc");
    let best:
      | {
          score: number;
          entity: ReadonlyEntity;
          npcType: ReturnType<typeof idToNpcType>;
        }
      | undefined;

    for (const entity of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere({
        center: localPlayer.player.position,
        radius: HARTHMERE_NPC_TALK_FALLBACK_RADIUS,
      })
    )) {
      if (!isNpcTypeId(entity.npc_metadata.type_id)) {
        continue;
      }
      // Muckers / hexers / huntable wildlife are combat creatures, not
      // conversational NPCs — never let them win the nearby-talk fallback (which
      // would otherwise shadow a real NPC standing next to them).
      if (isHarthmereCombatCreatureNpcType(entity.npc_metadata.type_id)) {
        continue;
      }
      if (entity.health?.hp !== undefined && entity.health.hp <= 0) {
        continue;
      }
      const npcType = idToNpcType(entity.npc_metadata.type_id);
      const motionOverrides =
        becomeTheNPC.kind === "active" && becomeTheNPC.entityId === entity.id
          ? becomeTheNPC
          : undefined;
      const npc = this.resources.cached("/scene/npc/render_state", entity.id);
      const npcPosition =
        motionOverrides?.position ??
        npc?.smoothedPosition() ??
        entity.position?.v;
      if (!npcPosition) {
        continue;
      }
      const score = harthmereNpcTalkCandidateScoreForTest({
        playerPosition: localPlayer.player.position,
        facingView: viewDir([0, localPlayer.player.orientation[1]]),
        npcPosition,
      });
      if (score === undefined) {
        continue;
      }
      if (!best || score < best.score) {
        best = { score, entity, npcType };
      }
    }

    if (!best) {
      return undefined;
    }
    return {
      kind: "npc",
      key: `inspect:npc:${best.entity.id}`,
      npcType: best.npcType,
      entity: best.entity,
      entityId: best.entity.id,
    };
  }

  applyLootOverlay(overlayMap: OverlayMap) {
    const localPlayer = this.resources.get("/scene/local_player");

    // If we have a full inventory, check if we have any nearby grab bags that we can't pick up
    const localInventoryVersion = this.resources.version(
      "/ecs/c/inventory",
      localPlayer.player.id
    );
    if (localInventoryVersion > this.lastLocalInventoryVersion) {
      this.lastLocalInventoryVersion = localInventoryVersion;
      const localInventory = this.resources.get(
        "/ecs/c/inventory",
        localPlayer.player.id
      );
      this.inventoryFull = isInventoryFull(localInventory);
    }

    let displayFullMessage = false;
    if (this.inventoryFull) {
      const localInventory = this.resources.get(
        "/ecs/c/inventory",
        localPlayer.player.id
      );

      for (const entity of this.table.scan(
        DropSelector.query.spatial.inSphere({
          center: localPlayer.player.position,
          radius: this.clientConfig.gameDropDistance,
        })
      )) {
        const drop = this.resources.cached("/scene/drops", entity.id);

        if (!localInventory || !entity.grab_bag?.slots) {
          continue;
        }
        const hasInventorySpace = canInventoryAcceptBag({
          inventory: localInventory,
          itemBag: entity.grab_bag?.slots,
        });
        const isDropPickupable = drop && drop.visible && drop.itemMesh;
        if (isDropPickupable && !hasInventorySpace) {
          displayFullMessage = true;
        }
      }
    }

    const lootEvents = this.resources.get("/overlays/loot");
    if (lootEvents.events.length === 0 && !displayFullMessage) {
      // don't do any of this when there isnt loot to display
      return;
    }
    const camera = this.resources.get("/scene/camera");

    // try to make a more stable left vector.
    // create an in-world vector facing screen left, with the width
    // of the bounding box, and transform that point back into
    // screen space. using AABB directly will bounce the pos back
    // and forth when we rotate
    const bounding = localPlayer.player.aabb();
    const boundingWidth = (bounding[1][0] - bounding[0][0]) / 2;
    const playerPos = new Vector3(...localPlayer.player.position);
    playerPos.add(new Vector3(0, 0.7, 0));
    const cameraFacing = new Vector3(0, 0, 0);
    cameraFacing.copy(camera.three.position);
    cameraFacing.sub(playerPos);
    cameraFacing.normalize();
    const leftVec = new Vector3(0, -1, 0);
    leftVec.cross(cameraFacing);
    leftVec.multiplyScalar(boundingWidth * 1.5);
    const leftBoundary = new Vector3(0, 0, 0);
    leftBoundary.copy(playerPos);
    leftBoundary.add(leftVec);
    leftBoundary.project(camera.three);

    const screenPos = ((1 + leftBoundary.x) / 2) * window.innerWidth;

    // Send the overlay the left-most side of the AABB so they can try avoid
    // overlapping the character
    overlayMap.set("loot", {
      kind: "loot",
      key: "loot",
      displayFullMessage: displayFullMessage,
      posX: screenPos,
    });
  }

  applyBlueprintOverlay(overlayMap: OverlayMap) {
    const { hit } = this.resources.get("/scene/cursor");
    if (hit?.kind !== "blueprint") {
      return;
    }
    let cursorItem: RequiredItem | undefined;

    const [terrainId, isomorphism] = getTerrainIdAndIsomorphismAtPosition(
      this.resources,
      hit.pos
    );
    if (terrainId && hit.requiredItem.kind === "terrain") {
      cursorItem = {
        kind: "terrain",
        blueprintId: hit.requiredItem.blueprintId,
        position: hit.pos,
        terrainId,
        isomorphism,
      };
    }

    const blueprint = this.resources.get(
      "/groups/blueprint/state",
      hit.blueprintEntityId
    );
    overlayMap.set("blueprint", {
      kind: "blueprint",
      key: `blueprint:${hit.blueprintEntityId}`,
      entityId: hit.blueprintEntityId,
      voxelPos: hit.pos,
      cursorItem,
      requiredItem: hit.requiredItem,
      completed: blueprint.completed,
    });
  }

  applyFishMeterOverlay(overlayMap: OverlayMap) {
    const selection = this.resources.get("/hotbar/selection");
    if (selection.kind === "hotbar" && selection.item?.action === "fishMeter") {
      overlayMap.set("fish_meter", {
        kind: "fish_meter",
      });
    }
  }

  applyBlueprintPlacementOverlay(overlayMap: OverlayMap) {
    const selection = this.resources.get("/hotbar/selection");
    if (selection.kind === "hotbar" && selection.item?.isBlueprint) {
      const playerHasRequiredItems = this.resources.get(
        "/groups/blueprint/has_required_items",
        selection.item.id
      );
      if (!playerHasRequiredItems) {
        const key = "blueprint_placement";
        overlayMap.set(key, {
          kind: "blueprint_placement",
          key,
        });
      }
    }
  }

  applyAllOverlays(overlayMap: OverlayMap, projectionMap: ProjectionMap) {
    const tweaks = this.resources.get("/tweaks");
    const showGremlins =
      this.authManager.currentUser.hasSpecialRole("seeGremlins") &&
      tweaks.showGremlins;
    const showNpcs = this.resources.get("/tweaks").showNpcs;
    this.applyPlayerNameOverlays(overlayMap, projectionMap, showGremlins);
    if (showNpcs) {
      this.applyNpcNameOverlays(overlayMap, projectionMap);
    } else {
      publishHarthmereEcsNpcCombatActorSnapshot({});
    }
    this.applyQuestGiverNameOverlays(overlayMap, projectionMap);
    this.applyMinigameElementOverlays(overlayMap, projectionMap);
    this.applyRestoredPlaceableOverlay(overlayMap, projectionMap);
    this.publishHarthmereEcsNpcCombatRegistry();
    const selection = this.resources.get("/hotbar/selection");
    if (selection?.kind !== "camera") {
      if (tweaks.bigNavigationAids) {
        this.applyNavigationAidOverlays(overlayMap, projectionMap);
      } else {
        // Even with big navigation aids off, always show the on-screen
        // directional indicator for the destination the user explicitly pinned,
        // so "set marker active -> see the way there" works on-screen.
        this.applyNavigationAidOverlays(
          overlayMap,
          projectionMap,
          BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID
        );
      }
      // Show tutorial overlay over inspectable overlays
      this.applyBlueprintOverlay(overlayMap);
      this.applyBlueprintPlacementOverlay(overlayMap);
      const inspectable = this.getTweakedInspectableOverlay();
      if (inspectable) {
        overlayMap.set("inspectable", inspectable);
      }
      this.applyLootOverlay(overlayMap);
      this.applyFishMeterOverlay(overlayMap);
    }
  }

  tick(_dt: number) {
    const curTime = Date.now();
    const lootTimeout = 5 * 1000;
    const lootEvents = this.resources.get("/overlays/loot");
    // Check only the oldest event if we need to update
    if (
      lootEvents &&
      lootEvents.events.length !== 0 &&
      (!lootEvents.events[0] ||
        curTime - lootEvents.events[0].time > lootTimeout)
    ) {
      this.resources.update("/overlays/loot", (lootEvents) => {
        let toRemove = 0;
        for (let idx = 0; idx < lootEvents.events.length; idx++) {
          const evt = lootEvents.events[idx];
          if (!evt || curTime - evt.time > lootTimeout) {
            toRemove += 1;
          } else {
            break;
          }
        }
        lootEvents.events.splice(0, toRemove);
        lootEvents.version += 1;
      });
    }

    const newOverlays: OverlayMap = new Map();
    const newProjection: ProjectionMap = new Map();
    this.applyAllOverlays(newOverlays, newProjection);

    const oldOverlays = this.resources.get("/overlays");
    if (!isEqual(newOverlays, oldOverlays)) {
      this.resources.update("/overlays", (overlayMap) => {
        const oldCopy = new Map(oldOverlays);
        overlayMap.clear();

        // This makes it so we re-use the same object if it hasn't changed, which plays nicely with React.memo out of the box
        newOverlays.forEach((val, key) => {
          const oldVal = oldCopy.get(key);
          if (oldVal && isEqual(oldVal, val)) {
            overlayMap.set(key, oldVal);
          } else {
            overlayMap.set(key, val);
          }
        });
      });
    }

    this.resources.update("/overlays/projection", (projMap) => {
      projMap.clear();
      for (const [k, v] of newProjection) {
        projMap.set(k, v);
      }
    });
  }
}
