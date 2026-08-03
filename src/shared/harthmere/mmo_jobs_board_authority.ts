/*
 * mmo_jobs_board_authority.ts
 *
 * Server-authoritative universal jobs board for Harthmere.
 * There are two physical notice boards: one in the Grove and one in Harthmere's
 * market district. Posting, accepting, cancelling, and turning in jobs require
 * the actor to be at the target board; accepted jobs become quest-board todos /
 * map-marker records for seekers. Runtime state starts empty: the board registry
 * is static world configuration, not dummy job data.
 */

import type {
  HarthmereEconomyBusinessRecord,
  HarthmereEconomyBusinessTypeId,
  HarthmereProductionEconomyState,
} from "./mmo_economy_authority";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
  harthmereJobsBoardBusinessTemplateById,
  isKnownHarthmereJobsBoardExecutableItemId,
} from "./jobs_board_business_templates";
import { HARTHMERE_COLLECTIBLE_DEFINITIONS } from "./mmo_class_ability_collectibles";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessScaledJobPay,
  harthmereBusinessOutpostJobsBoardPosition,
  harthmereBusinessOutpostMapMarkerId,
  type HarthmereBusinessOutpost,
} from "./business_customer_simulator";
import { HARTHMERE_EXOTIC_MATTER_COMPONENTS } from "./exotic_matter_caves";
import {
  HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
  HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID,
  randomHarthmereJobsBoardMuckBountyTarget,
} from "./jobs_board_muck_bounty_targets";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "./jobs_board_quest_marker_positions";
import {
  harthmereJobsBoardFieldTargets,
  harthmereOutpostWorkStationAction,
  harthmereOutpostWorkStationForOutpost,
  isHarthmereJobsBoardFieldTargetId,
} from "./jobs_board_field_targets";
import type { BiomesId } from "@/shared/ids";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";
import { harthmereRequestBoardJobsBoardLocations } from "@/shared/harthmere/native_request_board_locations";

export const HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION =
  "harthmere-jobs-board-authority" as const;
export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID =
  "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL =
  "public/assets/harthmere/vox/props/itch_voxel_asset_pack/Blacksmith Sign.vox" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID =
  "harthmere_market_posting_board" as const;
// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
// Second physical board located in Harthmere's market district. Lives near
// the Harthmere Market Office landmark and uses the same voxel kiosk asset
// as the Grove board. Jobs posted at this board are scoped to the Harthmere
// town/region so towns/guilds/NPCs based in Harthmere have a board to use.
export const HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID =
  "harthmere_town_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID =
  "harthmere_town_market_posting_board" as const;
export const HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME =
  "Harthmere Town Jobs Board" as const;
export const HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION =
  shiftHarthmereAuthoredPositionToWorld([
    534,
    HARTHMERE_EXTENSION_FEET_Y,
    -202,
  ]);
export const HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS = 3.25;
export const HARTHMERE_JOBS_BOARD_FIELD_COMPLETION_RADIUS = 8;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER = 12;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER = 6;
export const HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD = 5;
export const HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD = 5000;
export const HARTHMERE_JOBS_BOARD_MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const HARTHMERE_JOBS_BOARD_POST_COOLDOWN_MS = 10 * 1000;
export const HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS = 3 * 1000;
export const HARTHMERE_JOBS_BOARD_MAX_LOGS = 300;
export const HARTHMERE_JOBS_BOARD_BUSINESS_AUTO_SEED_MAX_PER_TICK = 4;

export type HarthmereJobsBoardIssuerKind =
  | "player"
  | "business"
  | "guild"
  | "town"
  | "npc";
export type HarthmereJobsBoardJobKind =
  | "gather"
  | "delivery"
  | "repair"
  | "cleanup"
  | "hunt"
  | "escort"
  | "craft"
  | "medical"
  | "exploration"
  | "construction"
  | "security"
  | "service";
export type HarthmereJobsBoardPostingStatus =
  | "open"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type HarthmereEscortCompanionStatus =
  | "following"
  | "arrived"
  | "completed"
  | "failed";

export interface HarthmereEscortCompanion {
  companionId: string;
  entityId: BiomesId;
  jobId: string;
  actorId: string;
  /** Numeric native ECS entity for the durable save actor in `actorId`. */
  actorEntityId?: BiomesId;
  displayName: string;
  status: HarthmereEscortCompanionStatus;
  position: { x: number; y: number; z: number };
  destination: { x: number; y: number; z: number };
  destinationTargetId?: string;
  destinationMarkerId?: string;
  createdAtMs: number;
  updatedAtMs: number;
  arrivedAtMs?: number;
  failedAtMs?: number;
}

export interface HarthmereJobsBoardLocation {
  x: number;
  y: number;
  z: number;
  radius: number;
  district: string;
  landmarkId: string;
  voxelAssetHint?: string;
}

export interface HarthmereJobsBoardRecord {
  boardId: string;
  displayName: string;
  townId: string;
  regionId: string;
  markerId: string;
  location: HarthmereJobsBoardLocation;
  acceptedKinds: HarthmereJobsBoardJobKind[];
  requiresPhysicalInteraction: true;
  createdAtMs: number;
  /**
   * HARTHMERE_REQUEST_BOARDS: this board carries authored townsfolk requests
   * rather than a player posting queue.
   *
   * The four original-snapshot boards (Fishing, Farming, Industrial,
   * Collective Research) are physical boards with the same interaction, marker
   * and panel as the jobs boards, but their listings come from the native ECS
   * quest system. Players read and fill them; they do not post to them, and
   * nothing escrows. `native_request_boards.ts` owns the catalogue.
   */
  readOnlyRequestBoard?: true;
}

export interface HarthmereJobsBoardRequirement {
  itemId?: string;
  count?: number;
  serviceKind?: string;
  serviceUnits?: number;
  targetId?: string;
  targetName?: string;
  mapMarkerId?: string;
  // HARTHMERE_REPAIR_TOOL_REQUIREMENT: a tool ACTION (e.g. "repair") that
  // must be satisfied by an EQUIPPED tool to do the work. When the player lacks
  // it, the quest layer surfaces a "go get the tool" sub-objective instead of
  // letting the job complete. `requiredToolId` pins a specific tool item.
  requiredToolAction?: string;
  requiredToolId?: string;
  // HARTHMERE_DELIVERY: delivery semantics. `recipientNpcId` makes the
  // recipient a PERSON (a business owner) the player hands the parcel to by
  // talking to them; otherwise the recipient is the PLACE at `mapMarkerId`.
  // `pickupMarkerId`, when set, means the parcel must be COLLECTED there first
  // (so it is NOT auto-granted on accept); otherwise the parcel (`itemId`) is
  // placed in the player's inventory on accept.
  recipientNpcId?: string;
  pickupMarkerId?: string;
}

// HARTHMERE_JOB_TOOL_SUBOBJECTIVE: when a job requirement needs a tool the
// player has not equipped, this turns it into a directive the quest layer shows
// as a "get the tool first" sub-objective (with its own marker), instead of
// letting the job silently complete without the tool ever being used.
export interface HarthmereJobToolSubObjective {
  needsTool: true;
  requiredToolAction: string;
  requiredToolId?: string;
  message: string;
}

export function harthmereJobRequirementToolSubObjective(input: {
  requirements?: HarthmereJobsBoardRequirement[];
  hasEquippedToolForAction: (action: string) => boolean;
  hasEquippedToolId?: (itemId: string) => boolean;
}): HarthmereJobToolSubObjective | undefined {
  for (const req of input.requirements ?? []) {
    if (
      req.requiredToolId &&
      input.hasEquippedToolId &&
      !input.hasEquippedToolId(req.requiredToolId)
    ) {
      return {
        needsTool: true,
        requiredToolAction: req.requiredToolAction ?? "repair",
        requiredToolId: req.requiredToolId,
        message:
          "Equip the required tool to complete this job. Acquire it from a vendor or craft it, then return to the marked spot.",
      };
    }
    const action = req.requiredToolAction;
    if (action && !input.hasEquippedToolForAction(action)) {
      return {
        needsTool: true,
        requiredToolAction: action,
        message: `Equip a ${action} tool to complete this job. Acquire one from a vendor or craft it, then return to the marked spot.`,
      };
    }
  }
  return undefined;
}

// HARTHMERE_DELIVERY: marker-id prefix for a business-owner recipient. Kept
// in sync with harthmereBusinessOwnerMarkerId (inlined here to avoid pulling
// the heavy business-owner/outpost module graph into the authority reducer).
export const HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX = "harthmere_owner:";

export type HarthmereDeliveryRecipient =
  | { kind: "person"; ownerNpcId: string; markerId: string }
  | { kind: "place"; markerId?: string };

export interface HarthmereDeliveryPlan {
  // The parcel carried/handed off (a requirement itemId), if any.
  parcelItemId?: string;
  parcelCount: number;
  // Grant the parcel to the player on accept (true), or require collecting it at
  // a pickup location first (false).
  grantOnAccept: boolean;
  pickupMarkerId?: string;
  recipient: HarthmereDeliveryRecipient;
}

export function harthmereDeliveryRequirement(
  job:
    | { kind?: string; requirements?: HarthmereJobsBoardRequirement[] }
    | undefined
): HarthmereJobsBoardRequirement | undefined {
  if (!job || job.kind !== "delivery") {
    return undefined;
  }
  return (job.requirements ?? []).find(
    (req) => req.recipientNpcId || req.itemId
  );
}

// Pure delivery plan: where the parcel comes from (granted on accept vs picked
// up), and who/where it goes to (a person owner vs a place). Returns undefined
// for non-delivery jobs or deliveries with neither a parcel nor a recipient.
export function harthmereDeliveryPlan(
  job:
    | { kind?: string; requirements?: HarthmereJobsBoardRequirement[] }
    | undefined
): HarthmereDeliveryPlan | undefined {
  const req = harthmereDeliveryRequirement(job);
  if (!req) {
    return undefined;
  }
  const recipient: HarthmereDeliveryRecipient = req.recipientNpcId
    ? {
        kind: "person",
        ownerNpcId: req.recipientNpcId,
        markerId: `${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}${req.recipientNpcId}`,
      }
    : { kind: "place", markerId: req.mapMarkerId ?? req.targetId };
  const hasPickup = Boolean(req.pickupMarkerId);
  return {
    parcelItemId: req.itemId,
    parcelCount: Math.max(1, req.count ?? 1),
    grantOnAccept: Boolean(req.itemId) && !hasPickup,
    pickupMarkerId: req.pickupMarkerId,
    recipient,
  };
}

export interface HarthmereJobsBoardRewardItem {
  itemId: string;
  count: number;
}

export interface HarthmereJobsBoardPosting {
  jobId: string;
  boardId: string;
  issuerKind: HarthmereJobsBoardIssuerKind;
  issuerId: string;
  issuerBusinessType?: HarthmereEconomyBusinessTypeId;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKind;
  requirements: HarthmereJobsBoardRequirement[];
  templateId?: string;
  rewardGold: number;
  escrowGold: number;
  rewardItems?: HarthmereJobsBoardRewardItem[];
  escrowItems?: Record<string, number>;
  rewardCollectibleIds?: string[];
  reputationDelta: number;
  status: HarthmereJobsBoardPostingStatus;
  townId: string;
  regionId: string;
  createdAtMs: number;
  deadlineAtMs: number;
  acceptedAtMs?: number;
  acceptedByActorId?: string;
  completedAtMs?: number;
  cancelledAtMs?: number;
  failurePenaltyGold: number;
  requiresFieldWork: boolean;
  mapMarkerId?: string;
  targetId?: string;
  abuseFlags: string[];
  logs: string[];
  // HARTHMERE_JOBS_BOARD_AUTO_POSTING:
  // Optional metadata attached by the economy auto-seeder. These never affect
  // existing player-posted jobs and stay undefined for them. Monster-hunt
  // postings always set these so clients can flag party-required combat
  // jobs in the UI.
  autoPosted?: boolean;
  source?: "economy_auto_seed";
  partyRecommended?: boolean;
  partyMinSize?: number;
  monsterId?: "mucker" | "hex" | string;
  monsterTier?: "normal" | "strong" | "elite" | "boss";
  monsterPowerLevel?: number;
  lootHint?: string[];
  escortCompanion?: HarthmereEscortCompanion;
}

export interface HarthmereJobsBoardTodo {
  todoId: string;
  jobId: string;
  actorId: string;
  boardId: string;
  title: string;
  todoText: string;
  status: "active" | "completed" | "failed" | "cancelled" | "expired";
  kind: HarthmereJobsBoardJobKind;
  mapMarkerId?: string;
  targetId?: string;
  townId: string;
  regionId: string;
  createdAtMs: number;
  dueAtMs: number;
  questBoardTodo: true;
  /**
   * HARTHMERE_SERVICE_UNIT_BASELINE (2026-07-29): repeated-work objectives
   * ("clear five muckwad clumps") are proven by the server's world-interaction
   * receipt counter, which is lifetime. This snapshots the counter at accept
   * time so only work done AFTER accepting counts toward serviceUnits.
   */
  serviceProgressBaseline?: Record<string, number>;
}

export interface HarthmereJobsBoardAuditEntry {
  id: string;
  atMs: number;
  actorId: string;
  kind: string;
  jobId?: string;
  boardId?: string;
  issuerKind?: HarthmereJobsBoardIssuerKind;
  issuerId?: string;
  amountGold?: number;
  reason?: string;
}

export interface HarthmereJobsBoardState {
  version: typeof HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION;
  boards: Record<string, HarthmereJobsBoardRecord>;
  postings: Record<string, HarthmereJobsBoardPosting>;
  todos: Record<string, HarthmereJobsBoardTodo>;
  actorAcceptedJobIds: Record<string, string[]>;
  issuerOpenJobIds: Record<string, string[]>;
  actorCooldowns: Record<
    string,
    { lastPostAtMs?: number; lastAcceptAtMs?: number; abuseScore: number }
  >;
  audit: HarthmereJobsBoardAuditEntry[];
  nextJobNumber: number;
  nextTodoNumber: number;
}

export interface HarthmereJobsBoardMutationRequest {
  requestId: string;
  actorId: string;
  nowMs: number;
  operation: string;
  boardId?: string;
  jobId?: string;
  issuerKind?: HarthmereJobsBoardIssuerKind;
  issuerId?: string;
  businessId?: string;
  title?: string;
  description?: string;
  kind?: HarthmereJobsBoardJobKind;
  requirements?: HarthmereJobsBoardRequirement[];
  templateId?: string;
  rewardGold?: number;
  rewardItems?: HarthmereJobsBoardRewardItem[];
  rewardCollectibleIds?: string[];
  deadlineAtMs?: number;
  townId?: string;
  regionId?: string;
  mapMarkerId?: string;
  targetId?: string;
  requiresFieldWork?: boolean;
  completionItemDeltas?: Record<string, number>;
  completionNote?: string;
  questTodoId?: string;
  completedTargetId?: string;
  // HARTHMERE_REPAIR_TOOL_COMPLETION: tool action actually used to do the
  // work (e.g. "repair"), set by the client only when the player performed the
  // task with the EQUIPPED tool. The server gates completion of any requirement
  // that declares `requiredToolAction` on this matching — so a repair job cannot
  // be turned in without the repair tool ever being used.
  usedToolAction?: string;
}

export interface HarthmereJobsBoardMutationContext {
  actorGold: number;
  actorInventoryItems: Record<string, number>;
  /** Authenticated native ECS entity corresponding to the durable actor id. */
  actorEntityId?: BiomesId;
  // Completion items can live outside the backpack when the live server routes
  // bulky building/material rewards into material storage. The jobs reducer
  // still validates item turn-ins here, so it needs both sources.
  actorMaterialStorageItems?:
    | Record<string, number>
    | { items?: Record<string, number> };
  actorCollectibles?: Record<string, number>;
  actorGuildId?: string;
  actorTownIds?: string[];
  nearbyBoardId?: string;
  actorPosition?: { x: number; y: number; z: number };
  /** Tool actions proven by server-owned equipped inventory state. */
  authoritativeEquippedToolActions?: string[];
  /** Target ids proven by server position against authored ECS/world markers. */
  authoritativeCompletedTargetIds?: string[];
  /**
   * Lifetime server-owned counters of repeatable field work per target id
   * (world-object interaction receipts). Used with the todo's accept-time
   * baseline to enforce multi-unit service objectives.
   */
  authoritativeServiceProgressCounts?: Record<string, number>;
  economy?: HarthmereProductionEconomyState;
  allowNpcJobPosting?: boolean;
  canManageGuildJobs?: (guildId: string) => boolean;
  canManageTownJobs?: (townId: string) => boolean;
  canManageBusinessJobs?: (business: HarthmereEconomyBusinessRecord) => boolean;
}

export interface HarthmereJobsBoardMutationResult {
  jobsBoard: HarthmereJobsBoardState;
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
  collectibleRewardIds: string[];
  economy?: HarthmereProductionEconomyState;
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
}

type MutableJobsResult = {
  next: HarthmereJobsBoardState;
  economy?: HarthmereProductionEconomyState;
  goldDelta: number;
  itemDeltas: Record<string, number>;
  collectibleRewardIds: string[];
  warnings: string[];
  touched: Set<string>;
  shared: Set<string>;
};

const HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE: Record<
  HarthmereEconomyBusinessTypeId,
  HarthmereJobsBoardJobKind
> = {
  exotic_matter_refinery: "craft",
  biome_maintenance_repair: "repair",
  biome_design_studio: "service",
  security_defense_contractor: "security",
  portal_transit_company: "delivery",
  biome_farming_rare_foods: "gather",
  weapons_tools: "craft",
  magic_goods: "craft",
  exploration_guide: "exploration",
  custom_home_property_development: "construction",
  general_trader: "delivery",
  hunter_wild_meat: "hunt",
  medical_doctor: "medical",
  teleport_owner: "delivery",
  waste_sanitation_cleanup: "cleanup",
  repair_maintenance_person: "repair",
  food_service_restaurant: "service",
  courier: "delivery",
  hospitality_inn_hotel_shelter: "service",
};

function harthmereBusinessOutpostJobsBoardId(
  outpost: HarthmereBusinessOutpost
) {
  return `${outpost.outpostId}_jobs_board`;
}

function harthmereBusinessOutpostJobMarkerId(
  outpost: HarthmereBusinessOutpost
) {
  return `${outpost.outpostId}_job_board`;
}

const HARTHMERE_BUSINESS_OUTPOST_JOB_BOARD_LOCATIONS: Record<
  string,
  HarthmereJobsBoardRecord
> = Object.fromEntries(
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => {
    const boardId = harthmereBusinessOutpostJobsBoardId(outpost);
    const markerId = harthmereBusinessOutpostJobMarkerId(outpost);
    const kind =
      HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE[outpost.businessType];
    const position = harthmereBusinessOutpostJobsBoardPosition(outpost);
    return [
      boardId,
      {
        boardId,
        displayName: `${outpost.displayName} Jobs Board`,
        townId: outpost.townId,
        regionId: outpost.regionId,
        markerId,
        location: {
          x: position.x,
          y: position.y,
          z: position.z,
          radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
          district: outpost.district,
          landmarkId: markerId,
          voxelAssetHint: "procedural_business_outpost_jobs_board",
        },
        acceptedKinds: [kind],
        requiresPhysicalInteraction: true,
        createdAtMs: 0,
      } satisfies HarthmereJobsBoardRecord,
    ];
  })
);

function businessOutpostForJobsBoardId(boardId: string) {
  return HARTHMERE_BUSINESS_OUTPOSTS.find(
    (outpost) => harthmereBusinessOutpostJobsBoardId(outpost) === boardId
  );
}

export const HARTHMERE_JOBS_BOARD_LOCATIONS: Record<
  string,
  HarthmereJobsBoardRecord
> = {
  [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]: {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    displayName: "Jobs Board",
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    markerId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID,
    location: {
      // HARTHMERE_JOBS_BOARD_GROVE_RELOCATION: snapped to the player's
      // reported feet position so the kiosk renders exactly where the pin says.
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
      district: "The Grove",
      landmarkId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID,
      voxelAssetHint: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL,
    },
    acceptedKinds: [
      "gather",
      "delivery",
      "repair",
      "cleanup",
      "hunt",
      "escort",
      "craft",
      "medical",
      "exploration",
      "construction",
      "security",
      "service",
    ],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
  },
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
  // Harthmere town market district board. Its authored market position is
  // shifted by the shared additive transform so map, voxel, and authority
  // coordinates cannot drift independently.
  // is townId-scoped to `harthmere_town` so its postings stay distinct from
  // the Grove board in the live snapshot.
  [HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID]: {
    boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
    displayName: HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME,
    townId: "harthmere_town",
    regionId: "harthmere_town_region",
    markerId: HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID,
    location: {
      x: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[0],
      y: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[1],
      z: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[2],
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
      district: "Harthmere Market District",
      landmarkId: HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID,
      voxelAssetHint: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL,
    },
    acceptedKinds: [
      "gather",
      "delivery",
      "repair",
      "cleanup",
      "hunt",
      "escort",
      "craft",
      "medical",
      "exploration",
      "construction",
      "security",
      "service",
    ],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
  },
  ...HARTHMERE_BUSINESS_OUTPOST_JOB_BOARD_LOCATIONS,
  // HARTHMERE_REQUEST_BOARDS: the four snapshot request boards plus the
  // Harthmere quay Fishing Board. Registered here so they get exactly the same
  // physical interaction, map marker and BiomesUI panel as every other board —
  // and with `acceptedKinds` narrowed to their own single kind, so a Farming
  // board can never show industrial work.
  ...harthmereRequestBoardJobsBoardLocations(),
};

export function defaultHarthmereJobsBoardState(
  nowMs = 0
): HarthmereJobsBoardState {
  const boards = JSON.parse(
    JSON.stringify(HARTHMERE_JOBS_BOARD_LOCATIONS)
  ) as Record<string, HarthmereJobsBoardRecord>;
  for (const board of Object.values(boards)) board.createdAtMs = nowMs;
  return {
    version: HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION,
    boards,
    postings: {},
    todos: {},
    actorAcceptedJobIds: {},
    issuerOpenJobIds: {},
    actorCooldowns: {},
    audit: [],
    nextJobNumber: 1,
    nextTodoNumber: 1,
  };
}

export function normalizeHarthmereJobsBoardState(
  raw: unknown,
  nowMs = 0
): HarthmereJobsBoardState {
  const defaults = defaultHarthmereJobsBoardState(nowMs);
  const value =
    raw && typeof raw === "object"
      ? (raw as Partial<HarthmereJobsBoardState>)
      : {};
  return {
    ...defaults,
    ...value,
    version: HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION,
    boards: { ...defaults.boards, ...(value.boards ?? {}) },
    postings: { ...(value.postings ?? {}) },
    todos: { ...(value.todos ?? {}) },
    actorAcceptedJobIds: { ...(value.actorAcceptedJobIds ?? {}) },
    issuerOpenJobIds: { ...(value.issuerOpenJobIds ?? {}) },
    actorCooldowns: { ...(value.actorCooldowns ?? {}) },
    audit: Array.isArray(value.audit)
      ? value.audit.slice(-HARTHMERE_JOBS_BOARD_MAX_LOGS)
      : [],
    nextJobNumber: Math.max(1, Math.trunc(Number(value.nextJobNumber) || 1)),
    nextTodoNumber: Math.max(1, Math.trunc(Number(value.nextTodoNumber) || 1)),
  };
}

function cloneJobsState(state: HarthmereJobsBoardState) {
  return normalizeHarthmereJobsBoardState(JSON.parse(JSON.stringify(state)));
}

// HARTHMERE_JOBS_ECONOMY_COPY_ON_WRITE (2026-07-29):
// `makeResult` used to deep-clone the WHOLE production economy with a JSON
// round-trip on every single jobs-board mutation. In production that object is
// ~15 MB — almost all of it `businessSystems`, which this reducer never reads
// or writes — so post/accept/complete each burned ~200 ms of pure serialization
// before doing any work. The reducer only mutates `businesses[*].balanceGold`
// and `businesses[*].inventory`, so clone exactly that and share the rest.
function cloneEconomyForJobsReducer(
  economy: HarthmereProductionEconomyState
): HarthmereProductionEconomyState {
  const businesses: Record<string, HarthmereEconomyBusinessRecord> = {};
  for (const [businessId, business] of Object.entries(
    economy.businesses ?? {}
  )) {
    const inventory: Record<string, { itemId: string; count: number }> = {};
    for (const [itemId, stack] of Object.entries(business.inventory ?? {})) {
      inventory[itemId] = { ...(stack as { itemId: string; count: number }) };
    }
    businesses[businessId] = {
      ...business,
      inventory,
    } as HarthmereEconomyBusinessRecord;
  }
  return { ...economy, businesses };
}

function makeResult(
  state: HarthmereJobsBoardState,
  context: HarthmereJobsBoardMutationContext
): MutableJobsResult {
  return {
    next: cloneJobsState(state),
    economy: context.economy
      ? cloneEconomyForJobsReducer(context.economy)
      : undefined,
    goldDelta: 0,
    itemDeltas: {},
    collectibleRewardIds: [],
    warnings: [],
    touched: new Set(),
    shared: new Set(),
  };
}

function reject(result: MutableJobsResult, warning: string) {
  result.warnings.push(warning);
  result.touched.add("jobs_board_rejection");
}

function pushAudit(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  entry: Omit<HarthmereJobsBoardAuditEntry, "atMs" | "actorId">
) {
  result.next.audit.push({
    atMs: request.nowMs,
    actorId: request.actorId,
    ...entry,
  });
  result.next.audit = result.next.audit.slice(-HARTHMERE_JOBS_BOARD_MAX_LOGS);
}

function issuerKey(kind: HarthmereJobsBoardIssuerKind, id: string) {
  return `${kind}:${id}`;
}

function sharedBoardKey(boardId: string) {
  return `harthmere:jobs_board:${boardId}`;
}
function sharedJobKey(jobId: string) {
  return `harthmere:jobs_board:job:${jobId}`;
}
function sharedTodoKey(todoId: string) {
  return `harthmere:jobs_board:todo:${todoId}`;
}

function positiveInt(value: unknown, fallback = 0) {
  return Math.max(0, Math.trunc(Number(value) || fallback));
}

function recordItemDelta(
  target: Record<string, number>,
  itemId: string,
  delta: number
) {
  const next = (target[itemId] ?? 0) + Math.trunc(delta);
  if (next === 0) delete target[itemId];
  else target[itemId] = next;
}

function distance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function horizontalDistance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function isActorAtHarthmereJobsBoard(
  state: HarthmereJobsBoardState,
  context: Pick<
    HarthmereJobsBoardMutationContext,
    "nearbyBoardId" | "actorPosition"
  >,
  boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
) {
  const board = state.boards[boardId];
  if (!board) return false;
  if (context.nearbyBoardId === boardId) return true;
  if (!context.actorPosition) return false;
  return (
    distance(context.actorPosition, board.location) <= board.location.radius
  );
}

function requireBoard(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const boardId = request.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
  const board = result.next.boards[boardId];
  if (!board) {
    reject(result, "jobs_board_rejected:board_not_found");
    return undefined;
  }
  if (!isActorAtHarthmereJobsBoard(result.next, context, boardId)) {
    reject(result, "jobs_board_rejected:must_be_at_jobs_board");
    return undefined;
  }
  return board;
}

function sanitizeText(value: unknown, fallback: string, max: number) {
  const text =
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function hasSuspiciousText(text: string) {
  const lowered = text.toLowerCase();
  return /https?:\/\/|discord\.gg|free\s+gold|dupe|exploit|admin\s+password/.test(
    lowered
  );
}

function normalizeRequirements(
  requirements: HarthmereJobsBoardRequirement[] | undefined
) {
  const out: HarthmereJobsBoardRequirement[] = [];
  for (const req of requirements ?? []) {
    const itemId =
      typeof req.itemId === "string" && req.itemId.trim()
        ? req.itemId.trim().slice(0, 80)
        : undefined;
    const serviceKind =
      typeof req.serviceKind === "string" && req.serviceKind.trim()
        ? req.serviceKind.trim().slice(0, 80)
        : undefined;
    const targetId =
      typeof req.targetId === "string" && req.targetId.trim()
        ? req.targetId.trim().slice(0, 120)
        : undefined;
    const targetName =
      typeof req.targetName === "string" && req.targetName.trim()
        ? req.targetName.trim().slice(0, 120)
        : undefined;
    const mapMarkerId =
      typeof req.mapMarkerId === "string" && req.mapMarkerId.trim()
        ? req.mapMarkerId.trim().slice(0, 120)
        : undefined;
    const count =
      req.count === undefined ? undefined : positiveInt(req.count, 1);
    const serviceUnits =
      req.serviceUnits === undefined
        ? undefined
        : positiveInt(req.serviceUnits, 1);
    const requiredToolAction =
      typeof req.requiredToolAction === "string" &&
      req.requiredToolAction.trim()
        ? req.requiredToolAction.trim().slice(0, 40)
        : undefined;
    const requiredToolId =
      typeof req.requiredToolId === "string" && req.requiredToolId.trim()
        ? req.requiredToolId.trim().slice(0, 80)
        : undefined;
    const recipientNpcId =
      typeof req.recipientNpcId === "string" && req.recipientNpcId.trim()
        ? req.recipientNpcId.trim().slice(0, 80)
        : undefined;
    const pickupMarkerId =
      typeof req.pickupMarkerId === "string" && req.pickupMarkerId.trim()
        ? req.pickupMarkerId.trim().slice(0, 120)
        : undefined;
    if (!itemId && !serviceKind && !targetId && !recipientNpcId) continue;
    out.push({
      itemId,
      count,
      serviceKind,
      serviceUnits,
      targetId,
      targetName,
      mapMarkerId,
      requiredToolAction,
      requiredToolId,
      recipientNpcId,
      pickupMarkerId,
    });
  }
  return out.slice(0, 8);
}

function normalizeRewardItems(
  rewardItems: HarthmereJobsBoardRewardItem[] | undefined
) {
  const out: Record<string, number> = {};
  for (const reward of rewardItems ?? []) {
    const itemId =
      typeof reward.itemId === "string"
        ? reward.itemId.trim().slice(0, 80)
        : "";
    if (!itemId || !isKnownHarthmereJobsBoardExecutableItemId(itemId)) continue;
    const count = positiveInt(reward.count, 1);
    if (count <= 0) continue;
    out[itemId] = (out[itemId] ?? 0) + count;
  }
  return Object.entries(out)
    .slice(0, 5)
    .map(([itemId, count]) => ({ itemId, count }));
}

function normalizeRewardCollectibleIds(
  rewardCollectibleIds: string[] | undefined
) {
  return Array.from(
    new Set(
      (rewardCollectibleIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim().slice(0, 120) : ""))
        .filter((id) => id && HARTHMERE_COLLECTIBLE_DEFINITIONS[id])
    )
  ).slice(0, 3);
}

function itemRewardsToRecord(
  rewardItems: HarthmereJobsBoardRewardItem[] | undefined
) {
  const record: Record<string, number> = {};
  for (const reward of rewardItems ?? []) {
    if (reward.count > 0)
      record[reward.itemId] = (record[reward.itemId] ?? 0) + reward.count;
  }
  return record;
}

function applyBusinessTemplateDefaults(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  issuerBusinessType: HarthmereEconomyBusinessTypeId | undefined
) {
  const template = harthmereJobsBoardBusinessTemplateById(request.templateId);
  if (!request.templateId) return undefined;
  if (!template) {
    reject(result, "jobs_board_rejected:unknown_business_job_template");
    return undefined;
  }
  if (issuerBusinessType && template.businessType !== issuerBusinessType) {
    reject(result, "jobs_board_rejected:template_business_type_mismatch");
    return undefined;
  }
  return template;
}

function validateIssuer(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const issuerKind =
    request.issuerKind ?? (request.businessId ? "business" : "player");
  let issuerId = request.issuerId ?? request.actorId;
  let issuerBusinessType: HarthmereEconomyBusinessTypeId | undefined;
  if (issuerKind === "player") {
    if (issuerId !== request.actorId) {
      reject(result, "jobs_board_rejected:player_issuer_mismatch");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "business") {
    issuerId = request.businessId ?? issuerId;
    const business = context.economy?.businesses?.[issuerId];
    if (!business) {
      reject(result, "jobs_board_rejected:business_not_found");
      return undefined;
    }
    const canManage =
      (business.ownerKind === "player" &&
        business.ownerId === request.actorId) ||
      context.canManageBusinessJobs?.(business) === true;
    if (!canManage) {
      reject(result, "jobs_board_rejected:business_job_permission_required");
      return undefined;
    }
    issuerBusinessType = business.typeId;
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "guild") {
    if (!issuerId || context.canManageGuildJobs?.(issuerId) !== true) {
      reject(result, "jobs_board_rejected:guild_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "town") {
    if (!issuerId || context.canManageTownJobs?.(issuerId) !== true) {
      reject(result, "jobs_board_rejected:town_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "npc") {
    if (context.allowNpcJobPosting !== true) {
      reject(result, "jobs_board_rejected:npc_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  reject(result, "jobs_board_rejected:invalid_issuer");
  return undefined;
}

function chargeEscrow(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext,
  issuerKind: HarthmereJobsBoardIssuerKind,
  issuerId: string,
  rewardGold: number,
  rewardItems: HarthmereJobsBoardRewardItem[],
  rewardCollectibleIds: string[]
) {
  if (issuerKind === "player") {
    if (context.actorGold + result.goldDelta < rewardGold)
      return reject(result, "jobs_board_rejected:escrow_gold_required");
    for (const reward of rewardItems) {
      if (
        (context.actorInventoryItems[reward.itemId] ?? 0) +
          (result.itemDeltas[reward.itemId] ?? 0) <
        reward.count
      ) {
        return reject(
          result,
          `jobs_board_rejected:escrow_item_required:${reward.itemId}`
        );
      }
    }
    for (const collectibleId of rewardCollectibleIds) {
      if (!context.actorCollectibles?.[collectibleId]) {
        return reject(
          result,
          `jobs_board_rejected:escrow_collectible_required:${collectibleId}`
        );
      }
    }
    result.goldDelta -= rewardGold;
    for (const reward of rewardItems)
      recordItemDelta(result.itemDeltas, reward.itemId, -reward.count);
    return;
  }
  if (issuerKind === "business") {
    const business = result.economy?.businesses?.[issuerId];
    if (!business || business.balanceGold < rewardGold)
      return reject(
        result,
        "jobs_board_rejected:business_escrow_gold_required"
      );
    for (const reward of rewardItems) {
      const stack = business.inventory[reward.itemId];
      if (!stack || stack.count < reward.count) {
        return reject(
          result,
          `jobs_board_rejected:business_escrow_item_required:${reward.itemId}`
        );
      }
    }
    business.balanceGold -= rewardGold;
    for (const reward of rewardItems) {
      const stack = business.inventory[reward.itemId];
      if (!stack) continue;
      stack.count -= reward.count;
      if (stack.count <= 0) delete business.inventory[reward.itemId];
    }
    result.touched.add("economy_business_bank");
    if (rewardItems.length > 0)
      result.touched.add("economy_business_inventory");
    result.shared.add(`harthmere:economy:business:${business.businessId}`);
    return;
  }
  // Guild/town/NPC postings can be backed by their own treasury systems later. For now
  // they are only allowed through explicit permission callbacks and are audit logged.
}

function refundEscrow(
  result: MutableJobsResult,
  job: HarthmereJobsBoardPosting,
  request: HarthmereJobsBoardMutationRequest
) {
  const escrowItems = job.escrowItems ?? itemRewardsToRecord(job.rewardItems);
  if (job.issuerKind === "player" && job.issuerId === request.actorId) {
    if (job.escrowGold > 0) result.goldDelta += job.escrowGold;
    for (const [itemId, count] of Object.entries(escrowItems))
      recordItemDelta(result.itemDeltas, itemId, count);
  }
  if (job.issuerKind === "business") {
    const business = result.economy?.businesses?.[job.issuerId];
    if (business) {
      if (job.escrowGold > 0) business.balanceGold += job.escrowGold;
      for (const [itemId, count] of Object.entries(escrowItems)) {
        business.inventory[itemId] = {
          itemId,
          count: (business.inventory[itemId]?.count ?? 0) + count,
        };
      }
    }
    result.touched.add("economy_business_bank");
    if (Object.keys(escrowItems).length > 0)
      result.touched.add("economy_business_inventory");
  }
  job.escrowGold = 0;
  job.escrowItems = {};
}

function openJobIdsForIssuer(
  state: HarthmereJobsBoardState,
  kind: HarthmereJobsBoardIssuerKind,
  id: string
) {
  return Object.values(state.postings)
    .filter(
      (job) =>
        job.issuerKind === kind &&
        job.issuerId === id &&
        (job.status === "open" || job.status === "active")
    )
    .map((job) => job.jobId);
}

function activeJobIdsForActor(state: HarthmereJobsBoardState, actorId: string) {
  return Object.values(state.postings)
    .filter(
      (job) => job.acceptedByActorId === actorId && job.status === "active"
    )
    .map((job) => job.jobId);
}

function createJobPosting(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const issuer = validateIssuer(result, request, context);
  if (!issuer) return;
  const cooldown = result.next.actorCooldowns[request.actorId] ?? {
    abuseScore: 0,
  };
  if (
    (cooldown.lastPostAtMs ?? 0) + HARTHMERE_JOBS_BOARD_POST_COOLDOWN_MS >
    request.nowMs
  ) {
    cooldown.abuseScore += 1;
    result.next.actorCooldowns[request.actorId] = cooldown;
    return reject(result, "jobs_board_rejected:post_cooldown");
  }
  const template = applyBusinessTemplateDefaults(
    result,
    request,
    issuer.issuerBusinessType
  );
  if (result.warnings.length) return;
  const rewardGold = positiveInt(
    request.rewardGold,
    template?.defaultRewardGold ?? 0
  );
  if (rewardGold < HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD)
    return reject(result, "jobs_board_rejected:reward_too_low");
  if (rewardGold > HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD)
    return reject(result, "jobs_board_rejected:reward_too_high");
  const deadlineAtMs =
    request.deadlineAtMs ??
    request.nowMs + (template?.defaultDeadlineDays ?? 7) * 24 * 60 * 60 * 1000;
  if (
    deadlineAtMs <= request.nowMs ||
    deadlineAtMs - request.nowMs > HARTHMERE_JOBS_BOARD_MAX_DURATION_MS
  )
    return reject(result, "jobs_board_rejected:invalid_deadline");
  const kind = request.kind ?? template?.kind ?? "service";
  if (!board.acceptedKinds.includes(kind))
    return reject(result, "jobs_board_rejected:unsupported_job_kind");
  const title = sanitizeText(
    request.title,
    template?.title ?? "Work Needed",
    100
  );
  const description = sanitizeText(
    request.description,
    template?.description ?? "See the board notice for details.",
    360
  );
  const requirements = normalizeRequirements(
    request.requirements ?? template?.requirements
  );
  if (!requirements.length)
    return reject(result, "jobs_board_rejected:requirements_required");
  for (const req of requirements) {
    if (req.itemId && !isKnownHarthmereJobsBoardExecutableItemId(req.itemId)) {
      return reject(
        result,
        `jobs_board_rejected:unknown_requirement_item:${req.itemId}`
      );
    }
  }
  const rewardItems = normalizeRewardItems(request.rewardItems);
  const rewardCollectibleIds = normalizeRewardCollectibleIds(
    request.rewardCollectibleIds
  );
  if ((request.rewardItems ?? []).length !== rewardItems.length)
    return reject(result, "jobs_board_rejected:invalid_reward_item");
  if (
    (request.rewardCollectibleIds ?? []).length !== rewardCollectibleIds.length
  )
    return reject(result, "jobs_board_rejected:invalid_reward_collectible");
  const requiresFieldWork =
    request.requiresFieldWork === true ||
    [
      "delivery",
      "repair",
      "cleanup",
      "hunt",
      "escort",
      "medical",
      "exploration",
      "construction",
      "security",
    ].includes(kind);
  const firstMarker =
    request.mapMarkerId ??
    template?.mapMarkerId ??
    requirements.find((req) => req.mapMarkerId)?.mapMarkerId ??
    requirements.find((req) => req.targetId)?.targetId;
  const targetId =
    request.targetId ??
    template?.targetId ??
    requirements.find((req) => req.targetId)?.targetId;
  if (
    requiresFieldWork &&
    !harthmereJobsBoardQuestMarkerRuntimePositionForId(firstMarker ?? targetId)
  ) {
    return reject(result, "jobs_board_rejected:field_marker_unresolvable");
  }
  const flags: string[] = [];
  if (hasSuspiciousText(`${title} ${description}`))
    flags.push("suspicious_text");
  const activeIssuerJobs = openJobIdsForIssuer(
    result.next,
    issuer.issuerKind,
    issuer.issuerId
  );
  if (
    activeIssuerJobs.length >=
    HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER
  )
    return reject(result, "jobs_board_rejected:issuer_posting_limit");
  chargeEscrow(
    result,
    request,
    context,
    issuer.issuerKind,
    issuer.issuerId,
    rewardGold,
    rewardItems,
    rewardCollectibleIds
  );
  if (result.warnings.length) return;
  const jobId = `harthmere_job_${result.next.nextJobNumber++}`;
  result.next.postings[jobId] = {
    jobId,
    boardId: board.boardId,
    issuerKind: issuer.issuerKind,
    issuerId: issuer.issuerId,
    issuerBusinessType: issuer.issuerBusinessType,
    title,
    description,
    kind,
    requirements,
    templateId: request.templateId,
    rewardGold,
    escrowGold: rewardGold,
    rewardItems,
    escrowItems: itemRewardsToRecord(rewardItems),
    rewardCollectibleIds,
    reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
    status: "open",
    townId: request.townId ?? board.townId,
    regionId: request.regionId ?? board.regionId,
    createdAtMs: request.nowMs,
    deadlineAtMs,
    failurePenaltyGold: Math.round(rewardGold * 0.1),
    requiresFieldWork,
    mapMarkerId: firstMarker,
    targetId,
    abuseFlags: flags,
    logs: [`created:${request.actorId}:${request.nowMs}`],
  };
  result.next.issuerOpenJobIds[issuerKey(issuer.issuerKind, issuer.issuerId)] =
    openJobIdsForIssuer(result.next, issuer.issuerKind, issuer.issuerId);
  result.next.actorCooldowns[request.actorId] = {
    ...cooldown,
    lastPostAtMs: request.nowMs,
  };
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_posted",
    jobId,
    boardId: board.boardId,
    issuerKind: issuer.issuerKind,
    issuerId: issuer.issuerId,
    amountGold: -rewardGold,
    reason: flags.join(",") || undefined,
  });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedBoardKey(board.boardId));
  result.shared.add(sharedJobKey(jobId));
}

// HARTHMERE_SERVICE_UNIT_BASELINE: snapshot the lifetime world-interaction
// counters for every repeated-work target this job names, so progress made
// before accepting can never satisfy the objective.
function serviceProgressBaselineForJob(
  job: HarthmereJobsBoardPosting,
  context: HarthmereJobsBoardMutationContext
): Record<string, number> | undefined {
  const counters = context.authoritativeServiceProgressCounts;
  if (!counters) return undefined;
  const baseline: Record<string, number> = {};
  for (const req of job.requirements) {
    const targetId = repeatedServiceTargetId(req);
    if (!targetId) continue;
    baseline[targetId] = Math.max(0, Math.floor(counters[targetId] ?? 0));
  }
  return Object.keys(baseline).length ? baseline : undefined;
}

/** The target id of a requirement that demands N repeated field actions. */
function repeatedServiceTargetId(
  req: HarthmereJobsBoardRequirement
): string | undefined {
  if (req.itemId) return undefined;
  if (!req.targetId) return undefined;
  const units = Math.max(1, Math.floor(Number(req.serviceUnits ?? 1)));
  if (units <= 1) return undefined;
  if (!String(req.serviceKind ?? "").startsWith("cleanup")) return undefined;
  return req.targetId;
}

function createTodoForJob(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  job: HarthmereJobsBoardPosting,
  context?: HarthmereJobsBoardMutationContext
) {
  const serviceProgressBaseline = context
    ? serviceProgressBaselineForJob(job, context)
    : undefined;
  const existing = Object.values(result.next.todos).find(
    (todo) => todo.jobId === job.jobId && todo.actorId === request.actorId
  );
  if (existing) {
    if (existing.status !== "active") {
      existing.status = "active";
      existing.boardId = job.boardId;
      existing.title = job.title;
      existing.todoText = job.requiresFieldWork
        ? `Go to the marked location and complete: ${job.title}`
        : `Complete board job: ${job.title}`;
      existing.kind = job.kind;
      existing.mapMarkerId = job.mapMarkerId ?? job.targetId;
      existing.targetId = job.targetId;
      existing.townId = job.townId;
      existing.regionId = job.regionId;
      existing.createdAtMs = request.nowMs;
      existing.dueAtMs = job.deadlineAtMs;
      existing.questBoardTodo = true;
      existing.serviceProgressBaseline = serviceProgressBaseline;
      result.touched.add("jobs_board_quest_todo");
      result.shared.add(sharedTodoKey(existing.todoId));
    }
    return;
  }
  const todoId = `harthmere_job_todo_${result.next.nextTodoNumber++}`;
  result.next.todos[todoId] = {
    todoId,
    jobId: job.jobId,
    actorId: request.actorId,
    boardId: job.boardId,
    title: job.title,
    todoText: job.requiresFieldWork
      ? `Go to the marked location and complete: ${job.title}`
      : `Complete board job: ${job.title}`,
    status: "active",
    kind: job.kind,
    mapMarkerId: job.mapMarkerId ?? job.targetId,
    targetId: job.targetId,
    townId: job.townId,
    regionId: job.regionId,
    createdAtMs: request.nowMs,
    dueAtMs: job.deadlineAtMs,
    questBoardTodo: true,
    serviceProgressBaseline,
  };
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedTodoKey(todoId));
}

function acceptJobPosting(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.boardId !== board.boardId)
    return reject(result, "jobs_board_rejected:wrong_board");
  if (job.status !== "open")
    return reject(result, "jobs_board_rejected:job_not_open");
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    job.logs.push(`expired_on_accept:${request.nowMs}`);
    result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
      openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
    result.shared.add(sharedJobKey(job.jobId));
    result.shared.add(sharedBoardKey(board.boardId));
    return reject(result, "jobs_board_rejected:job_expired");
  }
  if (job.issuerKind === "player" && job.issuerId === request.actorId)
    return reject(result, "jobs_board_rejected:cannot_accept_own_job");
  const cooldown = result.next.actorCooldowns[request.actorId] ?? {
    abuseScore: 0,
  };
  if (
    (cooldown.lastAcceptAtMs ?? 0) + HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS >
    request.nowMs
  ) {
    cooldown.abuseScore += 1;
    result.next.actorCooldowns[request.actorId] = cooldown;
    return reject(result, "jobs_board_rejected:accept_cooldown");
  }
  if (
    activeJobIdsForActor(result.next, request.actorId).length >=
    HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER
  )
    return reject(result, "jobs_board_rejected:seeker_active_job_limit");
  job.status = "active";
  job.acceptedAtMs = request.nowMs;
  job.acceptedByActorId = request.actorId;
  // HARTHMERE_JOB_ACCEPT_TIMER: the completion clock starts NOW (on accept).
  // Escort jobs get a strict 2-5 hour companion window; other timed job kinds
  // keep the existing few-hours-to-day window. Set before createTodoForJob so
  // the todo's dueAtMs inherits this accept-window deadline.
  job.deadlineAtMs =
    request.nowMs +
    harthmereAcceptedJobWindowMs(job, request.actorId, request.nowMs);
  job.escortCompanion = createEscortCompanionForAcceptedJob(
    result.next,
    job,
    request,
    context
  );
  job.logs.push(`accepted:${request.actorId}:${request.nowMs}`);
  result.next.actorAcceptedJobIds[request.actorId] = activeJobIdsForActor(
    result.next,
    request.actorId
  );
  result.next.actorCooldowns[request.actorId] = {
    ...cooldown,
    lastAcceptAtMs: request.nowMs,
  };
  createTodoForJob(result, request, job, context);
  const deliveryPlan = harthmereDeliveryPlan(job);
  if (
    deliveryPlan?.grantOnAccept &&
    deliveryPlan.parcelItemId &&
    deliveryPlan.parcelCount > 0
  ) {
    recordItemDelta(
      result.itemDeltas,
      deliveryPlan.parcelItemId,
      deliveryPlan.parcelCount
    );
    job.logs.push(
      `delivery_parcel_granted:${deliveryPlan.parcelItemId}:${deliveryPlan.parcelCount}:${request.nowMs}`
    );
    result.touched.add("jobs_board_delivery_parcel");
  }
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_accepted",
    jobId: job.jobId,
    boardId: board.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
  });
  result.touched.add("jobs_board_posting");
  if (job.escortCompanion) {
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
  result.shared.add(sharedJobKey(job.jobId));
  result.shared.add(sharedBoardKey(board.boardId));
}

function actorHasCompletionRequirements(
  job: HarthmereJobsBoardPosting,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext,
  result: MutableJobsResult
) {
  const rawMaterialStorage = context.actorMaterialStorageItems ?? {};
  const materialStorageItems =
    "items" in rawMaterialStorage &&
    rawMaterialStorage.items &&
    typeof rawMaterialStorage.items === "object"
      ? rawMaterialStorage.items
      : (rawMaterialStorage as Record<string, number>);
  for (const req of job.requirements) {
    if (!req.itemId) continue;
    const needed = positiveInt(req.count, 1);
    const providedDelta = request.completionItemDeltas?.[req.itemId];
    if (typeof providedDelta === "number") {
      if (providedDelta !== -needed)
        return reject(
          result,
          `jobs_board_rejected:invalid_completion_delta:${req.itemId}`
        );
    }
    if (
      (context.actorInventoryItems[req.itemId] ?? 0) +
        (materialStorageItems[req.itemId] ?? 0) +
        (result.itemDeltas[req.itemId] ?? 0) <
      needed
    ) {
      return reject(
        result,
        `jobs_board_rejected:missing_completion_item:${req.itemId}`
      );
    }
  }
}

function todoForJobAndActor(
  state: HarthmereJobsBoardState,
  jobId: string,
  actorId: string,
  questTodoId?: string
) {
  if (questTodoId) {
    const todo = state.todos[questTodoId];
    return todo?.jobId === jobId && todo.actorId === actorId ? todo : undefined;
  }
  return Object.values(state.todos).find(
    (todo) => todo.jobId === jobId && todo.actorId === actorId
  );
}

function pickupDeliveryParcel(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.kind !== "delivery") {
    return reject(result, "jobs_board_rejected:not_delivery_job");
  }
  if (job.status !== "active") {
    return reject(result, "jobs_board_rejected:job_not_active");
  }
  if (job.acceptedByActorId !== request.actorId) {
    return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  }
  const todo = todoForJobAndActor(
    result.next,
    job.jobId,
    request.actorId,
    request.questTodoId
  );
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status !== "active") {
    return reject(
      result,
      `jobs_board_rejected:quest_not_active:${todo.status}`
    );
  }
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    todo.status = "expired";
    return reject(result, "jobs_board_rejected:job_expired");
  }
  const plan = harthmereDeliveryPlan(job);
  if (!plan?.pickupMarkerId || !plan.parcelItemId) {
    return reject(result, "jobs_board_rejected:delivery_pickup_not_required");
  }
  if (
    request.completedTargetId !== plan.pickupMarkerId &&
    request.completedTargetId !== undefined
  ) {
    return reject(
      result,
      `jobs_board_rejected:wrong_delivery_pickup:${plan.pickupMarkerId}`
    );
  }
  const currentCount = Math.max(
    0,
    Math.floor(Number(context.actorInventoryItems[plan.parcelItemId] ?? 0))
  );
  const grantCount = Math.max(0, plan.parcelCount - currentCount);
  if (grantCount > 0) {
    recordItemDelta(result.itemDeltas, plan.parcelItemId, grantCount);
  }
  job.logs.push(
    `delivery_parcel_picked_up:${plan.parcelItemId}:${grantCount}:${plan.pickupMarkerId}:${request.nowMs}`
  );
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_delivery_parcel_picked_up",
    jobId: job.jobId,
    boardId: job.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
    reason: plan.pickupMarkerId,
  });
  result.touched.add("jobs_board_delivery_parcel");
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedTodoKey(todo.todoId));
  result.shared.add(sharedJobKey(job.jobId));
}

function completeJobQuest(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status !== "active")
    return reject(result, "jobs_board_rejected:job_not_active");
  if (job.acceptedByActorId !== request.actorId)
    return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  const todo = todoForJobAndActor(
    result.next,
    job.jobId,
    request.actorId,
    request.questTodoId
  );
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status === "completed")
    return reject(result, "jobs_board_rejected:quest_already_completed");
  if (todo.status !== "active")
    return reject(
      result,
      `jobs_board_rejected:quest_not_active:${todo.status}`
    );
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    todo.status = "expired";
    return reject(result, "jobs_board_rejected:job_expired");
  }
  if (job.requiresFieldWork) {
    const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      todo.mapMarkerId ?? job.mapMarkerId ?? todo.targetId ?? job.targetId
    );
    if (!context.actorPosition || !marker) {
      return reject(result, "jobs_board_rejected:field_position_unverified");
    }
    const markerPosition = {
      x: marker.position[0],
      y: marker.position[1],
      z: marker.position[2],
    };
    // Field markers come from terrain scans whose recommended feet Y can
    // differ from the live player controller's grounded Y (for example, a
    // forge marker can be 11m above its actual walkable floor). The objective
    // target/evidence gates still identify the exact interaction; proximity is
    // therefore intentionally horizontal so a stale terrain height cannot make
    // an otherwise reachable job impossible to turn in.
    if (
      horizontalDistance(context.actorPosition, markerPosition) >
      HARTHMERE_JOBS_BOARD_FIELD_COMPLETION_RADIUS
    ) {
      return reject(result, "jobs_board_rejected:field_target_out_of_range");
    }
  }
  const serviceRequirements = job.requirements.filter(
    (req) => !req.itemId && (req.targetId || req.serviceKind)
  );
  for (const req of serviceRequirements) {
    if (
      req.targetId &&
      !context.authoritativeCompletedTargetIds?.includes(req.targetId)
    ) {
      return reject(
        result,
        `jobs_board_rejected:wrong_quest_target:${req.targetId}`
      );
    }
    // HARTHMERE_SERVICE_UNITS_ENFORCED (2026-07-29): "clear five muckwad
    // clumps" used to complete on the FIRST cleanup because nothing counted
    // the repeats. Count the server's own world-interaction receipts for the
    // target since this todo was accepted.
    const repeatedTargetId = repeatedServiceTargetId(req);
    if (repeatedTargetId && context.authoritativeServiceProgressCounts) {
      const required = Math.max(1, Math.floor(Number(req.serviceUnits ?? 1)));
      const current = Math.max(
        0,
        Math.floor(
          Number(
            context.authoritativeServiceProgressCounts[repeatedTargetId] ?? 0
          )
        )
      );
      const baseline = Math.max(
        0,
        Math.floor(Number(todo.serviceProgressBaseline?.[repeatedTargetId] ?? 0))
      );
      if (current - baseline < required) {
        return reject(
          result,
          `jobs_board_rejected:service_units_incomplete:${repeatedTargetId}:${Math.max(
            0,
            current - baseline
          )}/${required}`
        );
      }
    }
  }
  // HARTHMERE_ITEM_REQUIREMENT_FIELD_TARGET (2026-07-29):
  // An item requirement that names a registered physical field target (the
  // refinery intake, the clinic supply shelf, the inn linen shelf, ...) must
  // ALSO be handed in AT that object. Previously only requirements without an
  // itemId were target-verified, so a delivery could be turned in from anywhere
  // inside the marker's 8m field radius without touching the drop-off.
  for (const req of job.requirements) {
    if (!req.itemId || !req.targetId) continue;
    if (!isHarthmereJobsBoardFieldTargetId(req.targetId)) continue;
    if (!context.authoritativeCompletedTargetIds?.includes(req.targetId)) {
      return reject(
        result,
        `jobs_board_rejected:wrong_quest_target:${req.targetId}`
      );
    }
  }
  if (job.kind === "escort" && job.escortCompanion?.status !== "arrived") {
    return reject(result, "jobs_board_rejected:escort_companion_not_arrived");
  }
  // Tool-gated work is proven only from the server-read selected/worn native
  // inventory. The client no longer supplies a `usedToolAction` claim.
  for (const req of job.requirements) {
    if (
      req.requiredToolAction &&
      !context.authoritativeEquippedToolActions?.includes(
        req.requiredToolAction
      )
    ) {
      return reject(
        result,
        `jobs_board_rejected:missing_required_tool:${req.requiredToolAction}`
      );
    }
  }
  // HARTHMERE_DELIVERY: a person-recipient delivery is only complete when it
  // was handed off to that recipient. The client reports the recipient via
  // completedTargetId (the owner marker id or the raw ownerNpcId) when the player
  // delivers by talking to the owner.
  for (const req of job.requirements) {
    if (!req.recipientNpcId) continue;
    const ownerMarkerId = `${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}${req.recipientNpcId}`;
    if (
      !context.authoritativeCompletedTargetIds?.includes(ownerMarkerId) &&
      !context.authoritativeCompletedTargetIds?.includes(req.recipientNpcId)
    ) {
      return reject(
        result,
        `jobs_board_rejected:not_delivered_to_recipient:${req.recipientNpcId}`
      );
    }
  }
  actorHasCompletionRequirements(job, request, context, result);
  if (result.warnings.length) return;
  for (const req of job.requirements) {
    if (req.itemId)
      recordItemDelta(
        result.itemDeltas,
        req.itemId,
        -positiveInt(req.count, 1)
      );
  }
  todo.status = "completed";
  job.logs.push(`quest_completed:${request.actorId}:${request.nowMs}`);
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_quest_completed",
    jobId: job.jobId,
    boardId: job.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
    reason: sanitizeText(request.completionNote, "quest completed", 120),
  });
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedTodoKey(todo.todoId));
  result.shared.add(sharedJobKey(job.jobId));
}

function completeJobPosting(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status !== "active")
    return reject(result, "jobs_board_rejected:job_not_active");
  if (job.acceptedByActorId !== request.actorId)
    return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    return reject(result, "jobs_board_rejected:job_expired");
  }
  const todo = todoForJobAndActor(
    result.next,
    job.jobId,
    request.actorId,
    request.questTodoId
  );
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status !== "completed")
    return reject(result, "jobs_board_rejected:quest_not_completed");
  result.goldDelta += job.escrowGold;
  for (const reward of job.rewardItems ?? [])
    recordItemDelta(result.itemDeltas, reward.itemId, reward.count);
  result.collectibleRewardIds.push(...(job.rewardCollectibleIds ?? []));
  job.escrowGold = 0;
  job.escrowItems = {};
  job.status = "completed";
  job.completedAtMs = request.nowMs;
  if (job.escortCompanion) {
    job.escortCompanion.status = "completed";
    job.escortCompanion.updatedAtMs = request.nowMs;
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
  job.logs.push(`completed:${request.actorId}:${request.nowMs}`);
  for (const todo of Object.values(result.next.todos)) {
    if (todo.jobId === job.jobId && todo.actorId === request.actorId)
      todo.status = "completed";
  }
  result.next.actorAcceptedJobIds[request.actorId] = activeJobIdsForActor(
    result.next,
    request.actorId
  );
  result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
    openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_completed",
    jobId: job.jobId,
    boardId: board.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
    amountGold: job.rewardGold,
    reason: sanitizeText(request.completionNote, "completed", 120),
  });
  result.touched.add("jobs_board_posting");
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedJobKey(job.jobId));
  result.shared.add(sharedBoardKey(board.boardId));
}

function cancelJobPosting(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status === "completed")
    return reject(result, "jobs_board_rejected:cannot_cancel_completed_job");
  const issuerIsActor =
    job.issuerKind === "player" && job.issuerId === request.actorId;
  const business =
    job.issuerKind === "business"
      ? context.economy?.businesses?.[job.issuerId]
      : undefined;
  const canCancel =
    issuerIsActor ||
    (business && context.canManageBusinessJobs?.(business) === true) ||
    (job.issuerKind === "guild" &&
      context.canManageGuildJobs?.(job.issuerId) === true) ||
    (job.issuerKind === "town" &&
      context.canManageTownJobs?.(job.issuerId) === true) ||
    (job.issuerKind === "npc" && context.allowNpcJobPosting === true);
  if (!canCancel)
    return reject(result, "jobs_board_rejected:cancel_permission_required");
  if (job.status === "active") {
    // Prevent bait-and-switch abuse: active jobs cannot be silently cancelled by issuer without failing.
    job.status = "failed";
    job.logs.push(`failed_by_cancel:${request.actorId}:${request.nowMs}`);
    // The seeker did not complete the job, so the escrowed reward must still return to the
    // issuer — previously it was silently destroyed on an active-job cancel.
    refundEscrow(result, job, request);
  } else {
    job.status = "cancelled";
    job.cancelledAtMs = request.nowMs;
    refundEscrow(result, job, request);
  }
  if (job.escortCompanion) {
    job.escortCompanion.status =
      job.status === "cancelled" ? "completed" : "failed";
    job.escortCompanion.updatedAtMs = request.nowMs;
    if (job.escortCompanion.status === "failed") {
      job.escortCompanion.failedAtMs = request.nowMs;
    }
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
  for (const todo of Object.values(result.next.todos)) {
    if (todo.jobId === job.jobId)
      todo.status = job.status === "cancelled" ? "cancelled" : "failed";
  }
  result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
    openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
  if (job.acceptedByActorId)
    result.next.actorAcceptedJobIds[job.acceptedByActorId] =
      activeJobIdsForActor(result.next, job.acceptedByActorId);
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_cancelled",
    jobId: job.jobId,
    boardId: board.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
  });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedJobKey(job.jobId));
}

function abandonJobPosting(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status !== "active")
    return reject(result, "jobs_board_rejected:job_not_active");
  if (job.acceptedByActorId !== request.actorId)
    return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  const seekerId = request.actorId;
  // The seeker releases the job back to the open pool: the issuer's escrow stays put (the
  // job remains posted and re-acceptable by anyone), the seeker's active slot frees up, and
  // the seeker pays the anti-grief failure penalty for not finishing what they accepted.
  const penalty = Math.max(0, Math.trunc(job.failurePenaltyGold ?? 0));
  job.status = "open";
  job.acceptedByActorId = undefined;
  job.acceptedAtMs = undefined;
  if (job.escortCompanion) {
    job.escortCompanion.status = "failed";
    job.escortCompanion.updatedAtMs = request.nowMs;
    job.escortCompanion.failedAtMs = request.nowMs;
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
  job.logs.push(`abandoned:${seekerId}:${request.nowMs}`);
  for (const todo of Object.values(result.next.todos)) {
    if (todo.jobId === job.jobId && todo.actorId === seekerId)
      todo.status = "cancelled";
  }
  result.next.actorAcceptedJobIds[seekerId] = activeJobIdsForActor(
    result.next,
    seekerId
  );
  result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
    openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
  if (penalty > 0) result.goldDelta -= penalty;
  pushAudit(result, request, {
    id: request.requestId,
    kind: "job_abandoned",
    jobId: job.jobId,
    boardId: board.boardId,
    issuerKind: job.issuerKind,
    issuerId: job.issuerId,
    amountGold: penalty > 0 ? -penalty : undefined,
  });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedJobKey(job.jobId));
  result.shared.add(sharedBoardKey(board.boardId));
}

// HARTHMERE_JOB_ACCEPT_TIMER: when an accepted job's accept-window deadline
// lapses, mark the player's quest todo FAILED (so the UI shows it failed and its
// map markers drop — failed todos are no longer "active"), free the seeker slot,
// and release the posting back to "open" so others can take it. NO escrow
// movement: the reward stays held for whoever completes it, so this is safe to
// run on every mutation regardless of who is acting.
function sweepLapsedAcceptedJobs(result: MutableJobsResult, nowMs: number) {
  let touched = false;
  for (const job of Object.values(result.next.postings)) {
    if (job.status !== "active" || job.deadlineAtMs > nowMs) {
      continue;
    }
    job.status = "open";
    job.acceptedByActorId = undefined;
    job.acceptedAtMs = undefined;
    if (job.escortCompanion) {
      job.escortCompanion.status = "failed";
      job.escortCompanion.updatedAtMs = nowMs;
      job.escortCompanion.failedAtMs = nowMs;
    }
    // Reset the (now-passed) accept-window deadline to a fresh open lifetime so
    // the released job is immediately acceptable again; the next accept resets it
    // to that taker's accept window.
    job.deadlineAtMs = nowMs + HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS;
    job.logs.push(`accept_window_lapsed:${nowMs}`);
    for (const todo of Object.values(result.next.todos)) {
      if (todo.jobId === job.jobId && todo.status === "active") {
        todo.status = "failed";
        result.shared.add(sharedTodoKey(todo.todoId));
      }
    }
    result.shared.add(sharedJobKey(job.jobId));
    touched = true;
  }
  if (touched) {
    result.touched.add("jobs_board_posting");
    result.touched.add("jobs_board_quest_todo");
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
}

// Explicitly FAIL the actor's active quest for a job — used when the objective is
// failed mid-run (e.g. an escorted NPC is killed). Marks the todo failed (markers
// drop), frees the seeker slot, and releases the posting back to "open". No
// escrow movement.
function failJobQuest(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest
) {
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  const todo = todoForJobAndActor(
    result.next,
    job.jobId,
    request.actorId,
    request.questTodoId
  );
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status !== "active") {
    return reject(
      result,
      `jobs_board_rejected:quest_not_active:${todo.status}`
    );
  }
  todo.status = "failed";
  if (job.status === "active" && job.acceptedByActorId === request.actorId) {
    job.status = "open";
    job.acceptedByActorId = undefined;
    job.acceptedAtMs = undefined;
  }
  if (job.escortCompanion) {
    job.escortCompanion.status = "failed";
    job.escortCompanion.updatedAtMs = request.nowMs;
    job.escortCompanion.failedAtMs = request.nowMs;
    result.touched.add("escort_companion");
    result.touched.add("live_entity_combat");
  }
  job.logs.push(
    `quest_failed:${request.actorId}:${request.nowMs}:${sanitizeText(
      request.completionNote,
      "failed",
      60
    )}`
  );
  result.touched.add("jobs_board_quest_todo");
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedTodoKey(todo.todoId));
  result.shared.add(sharedJobKey(job.jobId));
}

function expireJobs(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  for (const job of Object.values(result.next.postings)) {
    if (
      (job.status === "open" || job.status === "active") &&
      job.deadlineAtMs <= request.nowMs
    ) {
      job.status = "expired";
      job.logs.push(`expired:${request.nowMs}`);
      if (job.escortCompanion) {
        job.escortCompanion.status = "failed";
        job.escortCompanion.updatedAtMs = request.nowMs;
        job.escortCompanion.failedAtMs = request.nowMs;
        result.touched.add("escort_companion");
        result.touched.add("live_entity_combat");
      }
      // Refund the escrow whether the job was still open or active-but-unfinished — an
      // active job that lapses at its deadline must not destroy the issuer's escrowed gold.
      refundEscrow(result, job, request);
      for (const todo of Object.values(result.next.todos)) {
        if (todo.jobId === job.jobId) todo.status = "expired";
      }
      result.shared.add(sharedJobKey(job.jobId));
    }
  }
  result.touched.add("jobs_board_expiration");
  result.shared.add(sharedBoardKey(board.boardId));
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING:
// Tuning knobs for the economy-driven auto-seeder. Keep these named so tests
// can assert on them and ops can tune them without changing the seeder body.
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN = 8;
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK = 4;
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS = 24 * 60 * 60 * 1000;

// HARTHMERE_JOB_ACCEPT_TIMER: a job's completion timer starts when it is
// ACCEPTED (not when posted) — the player then has a few hours to a day to finish
// it, which keeps people coming back daily. If the window lapses, the accepted
// job is RELEASED back to "open" (claim lost, seeker slot freed, marker cleared);
// the escrowed reward stays held for whoever completes it (no escrow movement).
export const HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MIN_MS = 4 * 60 * 60 * 1000;
export const HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MAX_MS = 24 * 60 * 60 * 1000;
export const HARTHMERE_ESCORT_ACCEPT_WINDOW_MIN_MS = 2 * 60 * 60 * 1000;
export const HARTHMERE_ESCORT_ACCEPT_WINDOW_MAX_MS = 5 * 60 * 60 * 1000;
export const HARTHMERE_ESCORT_COMPANION_ENTITY_ID_BASE =
  8_810_000_000_030_000 as BiomesId;
export const HARTHMERE_ESCORT_COMPANION_ENTITY_ID_SPAN = 500_000;

// Deterministic per-acceptance window in [min, max] (reducers must be pure — no
// Math.random), seeded from a stable key so the same acceptance always resolves
// the same deadline.
export function harthmereJobAcceptWindowMs(seedKey: string): number {
  return harthmereDeterministicWindowMs(
    seedKey,
    HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MIN_MS,
    HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MAX_MS
  );
}

export function harthmereEscortAcceptWindowMs(seedKey: string): number {
  return harthmereDeterministicWindowMs(
    seedKey,
    HARTHMERE_ESCORT_ACCEPT_WINDOW_MIN_MS,
    HARTHMERE_ESCORT_ACCEPT_WINDOW_MAX_MS
  );
}

function harthmereDeterministicHash(seedKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i += 1) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function harthmereDeterministicWindowMs(
  seedKey: string,
  minMs: number,
  maxMs: number
): number {
  const t = (harthmereDeterministicHash(seedKey) % 100000) / 100000;
  const span = maxMs - minMs;
  return minMs + Math.round(t * span);
}

export function harthmereAcceptedJobWindowMs(
  job: Pick<HarthmereJobsBoardPosting, "jobId" | "kind">,
  actorId: string,
  nowMs: number
): number {
  const seedKey = `${job.jobId}:${actorId}:${nowMs}`;
  return job.kind === "escort"
    ? harthmereEscortAcceptWindowMs(seedKey)
    : harthmereJobAcceptWindowMs(seedKey);
}

export function harthmereEscortCompanionEntityId(
  jobId: string,
  actorId: string
): BiomesId {
  const offset =
    harthmereDeterministicHash(`escort-companion:${jobId}:${actorId}`) %
    HARTHMERE_ESCORT_COMPANION_ENTITY_ID_SPAN;
  return (Number(HARTHMERE_ESCORT_COMPANION_ENTITY_ID_BASE) +
    offset) as BiomesId;
}

function pointObject(value: { x: number; y: number; z: number }) {
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
  };
}

function createEscortCompanionForAcceptedJob(
  state: HarthmereJobsBoardState,
  job: HarthmereJobsBoardPosting,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
): HarthmereEscortCompanion | undefined {
  if (job.kind !== "escort") return undefined;
  const boardRecord =
    state.boards[job.boardId] ??
    (request.boardId ? state.boards[request.boardId] : undefined);
  const anchor =
    context.actorPosition ??
    (boardRecord
      ? {
          x: boardRecord.location.x,
          y: boardRecord.location.y + 1,
          z: boardRecord.location.z,
        }
      : { x: 501.99486179104775, y: 70, z: -132.00350672753194 });
  const destinationMarker =
    harthmereJobsBoardQuestMarkerRuntimePositionForId(job.mapMarkerId) ??
    harthmereJobsBoardQuestMarkerRuntimePositionForId(job.targetId);
  const destination = destinationMarker
    ? {
        x: destinationMarker.position[0],
        y: destinationMarker.position[1],
        z: destinationMarker.position[2],
      }
    : pointObject(anchor);
  const position = {
    x: anchor.x + 1.35,
    y: anchor.y,
    z: anchor.z + 1.1,
  };
  const entityId = harthmereEscortCompanionEntityId(job.jobId, request.actorId);
  return {
    companionId: `escort_companion:${job.jobId}:${request.actorId}`,
    entityId,
    jobId: job.jobId,
    actorId: request.actorId,
    actorEntityId: context.actorEntityId,
    displayName: "Newcomer",
    status: "following",
    position,
    destination,
    destinationTargetId: job.targetId,
    destinationMarkerId: destinationMarker?.markerId ?? job.mapMarkerId,
    createdAtMs: request.nowMs,
    updatedAtMs: request.nowMs,
  };
}

export function harthmereJobTimeRemainingMs(
  deadlineAtMs: number | undefined,
  nowMs: number
): number {
  if (deadlineAtMs === undefined || !Number.isFinite(deadlineAtMs)) return 0;
  return Math.max(0, deadlineAtMs - nowMs);
}

// Player-facing countdown label shown on the job AND its quest entry.
export function formatHarthmereJobTimeRemaining(
  deadlineAtMs: number | undefined,
  nowMs: number
): string {
  const ms = harthmereJobTimeRemainingMs(deadlineAtMs, nowMs);
  if (deadlineAtMs === undefined) return "";
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return "under 1m left";
}
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX = "harthmere_auto_";
export const HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR = 1200;
export const HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_CEILING = 4500;
export const HARTHMERE_EXOTIC_MATTER_MINING_TEMPLATE_ID_PREFIXES = [
  "exotic_matter_mine_",
  "deep_exotic_matter_mine_",
] as const;

export function isHarthmereExoticMatterMiningTemplateId(
  templateId: string | undefined | null
) {
  return Boolean(
    templateId &&
      HARTHMERE_EXOTIC_MATTER_MINING_TEMPLATE_ID_PREFIXES.some((prefix) =>
        templateId.startsWith(prefix)
      )
  );
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING:
// Templates for procedurally generated NPC/town/business jobs. Each template
// is a plain data record so it's trivial to test, extend, and tune. Reward
// ranges intentionally overlap with player-posted job ranges (5–5000 gold)
// and respect HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD.
//
// Monster-hunt templates are flagged `partyRecommended: true` with elevated
// `monsterPowerLevel` (player-character-level units). The intent: solo
// players can technically engage but the encounter is balanced for 3–4 and
// rewards reflect that, with named drop hints (e.g. Hex Sigil, Muckheart).
// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
// Templates can be scoped to a specific board id (grove vs harthmere) so the
// auto-seeder doesn't post Grove jobs on the Harthmere board (and vice
// versa). `boardScope: "any"` posts on either board.
type AutoSeedBoardScope = "grove" | "harthmere" | "any";
interface AutoSeedTemplate {
  templateId: string;
  issuerKind: HarthmereJobsBoardIssuerKind;
  issuerId: string;
  kind: HarthmereJobsBoardJobKind;
  title: string;
  description: string;
  requirements: HarthmereJobsBoardRequirement[];
  rewardGold: { min: number; max: number };
  requiresFieldWork: boolean;
  mapMarkerId?: string;
  targetId?: string;
  monsterId?: "mucker" | "hex";
  monsterTier?: "normal" | "strong" | "elite" | "boss";
  monsterPowerLevel?: number;
  partyRecommended?: boolean;
  partyMinSize?: number;
  lootHint?: string[];
  boardScope?: AutoSeedBoardScope;
}

function templateBoardScopeMatches(
  template: AutoSeedTemplate,
  boardId: string
): boolean {
  const scope = template.boardScope ?? "any";
  if (scope === "any") return true;
  if (scope === "grove" && boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID)
    return true;
  if (
    scope === "harthmere" &&
    boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
  )
    return true;
  return false;
}

// HARTHMERE_JOBS_BOARD_AUTO_SEED_OBTAINABLE_REQUIREMENTS
// An auto-seeded job must only require items a player can actually obtain. A
// template whose requirement references an item outside the known executable
// set (e.g. a placeholder id like `apple_basket`/`courier_pouch` that exists
// nowhere as loot/vendor/craft output) would produce a posting that can NEVER
// satisfy `actorHasCompletionRequirements`, so we exclude it from auto-seeding.
// Target-only requirements (no itemId) are always allowed.
export function harthmereAutoSeedTemplateRequirementsObtainable(
  requirements: ReadonlyArray<{ itemId?: string }> | undefined
): boolean {
  // HARTHMERE_OBTAINABLE_REQUIREMENTS_ROBUSTNESS (2026-07-29): this used to
  // call `.every` unconditionally. A template with no requirements array made
  // it throw `requirements.every is not a function`, which is what crashed the
  // all-jobs browser E2E *after* all 20 job scenarios had already passed and
  // turned a green run into a red report. A requirement-free template is
  // trivially obtainable.
  if (!Array.isArray(requirements)) {
    return true;
  }
  return requirements.every(
    (req) =>
      !req?.itemId || isKnownHarthmereJobsBoardExecutableItemId(req.itemId)
  );
}

function hasOpenExoticMatterMiningJob(
  state: HarthmereJobsBoardState,
  boardId: string
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      job.status === "open" &&
      isHarthmereExoticMatterMiningTemplateId(job.templateId)
  );
}

export const HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES: AutoSeedTemplate[] = [
  // Grove-scoped town/NPC/guild work — these reference Grove landmarks.
  {
    templateId: "town_gather_road_rations",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "gather",
    title: "Stock the Road Rations Crate",
    description:
      "Grove travellers leave hungry. Gather 6 wild berries for the road rations crate at the fountain.",
    requirements: [
      {
        itemId: "wild_berries",
        count: 6,
        mapMarkerId: "grove_garden_edge_berries",
      },
    ],
    rewardGold: { min: 35, max: 75 },
    requiresFieldWork: true,
    mapMarkerId: "grove_garden_edge_berries",
    boardScope: "grove",
  },
  {
    templateId: "town_repair_fence",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "repair",
    title: "Patch the Safe-Zone Fence",
    description:
      "The eastern fence post split again. Bring 3 softwood logs and a repair tool before the next muck flush.",
    requirements: [
      {
        itemId: "softwood_log",
        count: 3,
        mapMarkerId: "grove_repair_fence",
        // Needs a repair tool EQUIPPED to restore the fence blocks. Without one,
        // the quest layer routes the player to acquire/equip a repair tool first.
        requiredToolAction: "repair",
      },
    ],
    rewardGold: { min: 60, max: 110 },
    requiresFieldWork: true,
    mapMarkerId: "grove_repair_fence",
    boardScope: "grove",
  },
  {
    templateId: "town_cleanup_muck_patch",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "cleanup",
    title: "Clear the Muckwad Patch",
    description:
      "Five muckwad clumps near the road need clearing before they spread to the practice fields.",
    requirements: [
      {
        serviceKind: "cleanup_muck",
        serviceUnits: 5,
        count: 5,
        targetId: "muckwad_patch",
        targetName: "Muckwad Patch",
        mapMarkerId: "muckwad_patch",
        requiredToolAction: "cleanup",
      },
    ],
    rewardGold: { min: 90, max: 160 },
    requiresFieldWork: true,
    mapMarkerId: "muckwad_patch",
    boardScope: "grove",
  },
  {
    templateId: "npc_delivery_apples",
    issuerKind: "npc",
    issuerId: "old_coop",
    kind: "delivery",
    title: "Run the Coop Food Parcel",
    description:
      "Collect Old Coop's sealed food parcel from the hen-yard crate, then carry it to the marked bakery satchel by the fountain.",
    requirements: [
      {
        itemId: "sealed_package",
        count: 1,
        mapMarkerId: "grove_mail_bank_satchel",
      },
    ],
    rewardGold: { min: 45, max: 90 },
    requiresFieldWork: true,
    mapMarkerId: "grove_mail_bank_satchel",
    boardScope: "grove",
  },
  {
    templateId: "business_craft_torch",
    issuerKind: "npc",
    issuerId: "grove_kettle_inn",
    kind: "craft",
    title: "Plane Bench Planks for the Inn",
    description:
      "The inn needs sturdy bench planks before dusk. Craft or buy 3 wood planks and turn them in at the board.",
    requirements: [{ itemId: "wood_plank", count: 3 }],
    rewardGold: { min: 70, max: 120 },
    requiresFieldWork: false,
    boardScope: "grove",
  },
  {
    templateId: "guild_escort_road_post",
    issuerKind: "guild",
    issuerId: "grove_wayfinder_guild",
    kind: "escort",
    title: "Escort a Newcomer to the Road Post",
    description:
      "A new arrival needs a steady walk to the Old Grove Road Post. Stay close until they reach it.",
    requirements: [
      {
        targetId: "old_grove_road_post",
        targetName: "Old Grove Road Post",
        mapMarkerId: "old_grove_road_post",
      },
    ],
    rewardGold: { min: 50, max: 100 },
    requiresFieldWork: true,
    mapMarkerId: "old_grove_road_post",
    boardScope: "grove",
  },
  // HARTHMERE_JOBS_BOARD_MONSTER_HUNT:
  // Two high-reward party-required hunts. The Mucker variant is a tougher
  // version of the Mucked Robot the player meets in the muck edges; the Hex
  // variant is a corrupted boss that drops a sigil and an arcane shard. The
  // Grove board carries the Mucker hunt (closer to the Grove muck edge); the
  // Harthmere board carries the Hex wraith hunt (out in Mosslawn closer to
  // Harthmere's far districts), and there is a third "any" boss for both.
  {
    templateId: "hunt_mucker_elite",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "hunt",
    title: "Bounty: Elite Mucker at the Muck Edge",
    description:
      "An elite Mucker has dug in past the safe-zone boundary. Strong, slow, hits like a piledriver — bring a party. Reward only paid on confirmed kill.",
    requirements: [
      {
        targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
        targetName: "Elite Mucker",
        mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
      },
    ],
    rewardGold: {
      min: HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR,
      max: 2400,
    },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
    targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
    monsterId: "mucker",
    monsterTier: "elite",
    monsterPowerLevel: 18,
    partyRecommended: true,
    partyMinSize: 3,
    lootHint: ["Muckheart", "Mucked Plate Fragment", "Elite Reward Chest"],
    boardScope: "grove",
  },
  {
    templateId: "hunt_hex_boss",
    issuerKind: "guild",
    issuerId: "harthmere_warden_guild",
    kind: "hunt",
    title: "Bounty: Hex Wraith Sighting in Mosslawn",
    description:
      "A Hex wraith has surfaced under the Mosslawn songline near Harthmere's borderlands. Heavily resists single attackers and drops a Hex Sigil. Take a party of four.",
    requirements: [
      {
        targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID,
        targetName: "Hex Wraith",
        mapMarkerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
      },
    ],
    rewardGold: {
      min: 2600,
      max: HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_CEILING,
    },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
    targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID,
    monsterId: "hex",
    monsterTier: "boss",
    monsterPowerLevel: 24,
    partyRecommended: true,
    partyMinSize: 4,
    lootHint: ["Hex Sigil", "Arcane Shard", "Boss Loot Cache"],
    boardScope: "harthmere",
  },
  // HARTHMERE_EXOTIC_MATTER_CAVE_JOBS:
  // High-value Harthmere board contracts that send miners into confirmed
  // underground cave rooms for the three antimatter blocks needed to craft Raw
  // Exotic Matter. These use shared cave deposit markers so the board, map,
  // renderer, and live backend agree on exact [x, y, z] targets.
  {
    templateId: "exotic_matter_mine_antihydrogen",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antihydrogen for Exotic Matter",
    description:
      "The refiners need sealed Antihydrogen from the Mossglass survey cave before the next Biome stabilizer run. Mine the marked seam and bring the blocks back intact.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihydrogen.itemId,
        count: 3,
        targetId: "harthmere_antihydrogen_deposit",
        targetName:
          HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihydrogen.jobTargetName,
        mapMarkerId: "exotic_antihydrogen_mossglass_survey_02",
      },
    ],
    rewardGold: { min: 3200, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihydrogen_mossglass_survey_02",
    targetId: "harthmere_antihydrogen_deposit",
    lootHint: [
      "Refinery priority pay",
      "Biome stabilizer supply",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  {
    templateId: "exotic_matter_mine_antihelium",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antihelium for Exotic Matter",
    description:
      "A clean-power order is waiting on Antihelium. Follow the marked cave pocket, mine the contained blocks, and keep the shipment sealed.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.itemId,
        count: 2,
        targetId: "harthmere_antihelium_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.jobTargetName,
        mapMarkerId: "exotic_antihelium_mossglass_survey_05",
      },
    ],
    rewardGold: { min: 3400, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihelium_mossglass_survey_05",
    targetId: "harthmere_antihelium_deposit",
    lootHint: [
      "Refinery priority pay",
      "Teleport fuel supply",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  {
    templateId: "exotic_matter_mine_antiboron",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antiboron for Exotic Matter",
    description:
      "Antiboron is scarce and the refinery is paying accordingly. Mine the marked blackglass vein in the Mossglass survey cave and return with sealed blocks.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId,
        count: 1,
        targetId: "harthmere_antiboron_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.jobTargetName,
        mapMarkerId: "exotic_antiboron_mossglass_survey_03",
      },
    ],
    rewardGold: { min: 3800, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antiboron_mossglass_survey_03",
    targetId: "harthmere_antiboron_deposit",
    lootHint: [
      "Refinery priority pay",
      "Alcubierre supply chain",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antihydrogen",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antihydrogen for Exotic Matter",
    description:
      "A major refinery order needs Antihydrogen from the Deep Spindle massive cave. Mine the marked blue seam and return with sealed blocks.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihydrogen.itemId,
        count: 5,
        targetId: "harthmere_deep_antihydrogen_deposit",
        targetName:
          HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihydrogen.jobTargetName,
        mapMarkerId: "exotic_antihydrogen_deep_spindle_14",
      },
    ],
    rewardGold: { min: 4600, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihydrogen_deep_spindle_14",
    targetId: "harthmere_deep_antihydrogen_deposit",
    lootHint: [
      "Deep-cave hazard pay",
      "Biome stabilizer supply",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antihelium",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antihelium for Exotic Matter",
    description:
      "The clean-power line is short on Antihelium. Push into the Deep Spindle massive cave and mine the marked pocket.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.itemId,
        count: 4,
        targetId: "harthmere_deep_antihelium_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.jobTargetName,
        mapMarkerId: "exotic_antihelium_deep_spindle_15",
      },
    ],
    rewardGold: { min: 4700, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihelium_deep_spindle_15",
    targetId: "harthmere_deep_antihelium_deposit",
    lootHint: [
      "Deep-cave hazard pay",
      "Teleport fuel supply",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antiboron",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antiboron for Exotic Matter",
    description:
      "Antiboron from the Deep Spindle massive cave is scarce and dangerous to extract. Mine the marked blackglass vein for premium pay.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId,
        count: 3,
        targetId: "harthmere_deep_antiboron_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.jobTargetName,
        mapMarkerId: "exotic_antiboron_deep_spindle_16",
      },
    ],
    rewardGold: { min: 4800, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antiboron_deep_spindle_16",
    targetId: "harthmere_deep_antiboron_deposit",
    lootHint: [
      "Deep-cave hazard pay",
      "Alcubierre supply chain",
      "Rare mining bonus",
    ],
    boardScope: "harthmere",
  },
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
  // Harthmere-scoped town/NPC/business work tied to Harthmere landmarks
  // (market office, chapel stone, bridge center, Mosslawn). These keep the
  // Harthmere board populated with town-flavored jobs.
  {
    templateId: "harthmere_town_market_delivery",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "delivery",
    title: "Deliver Sealed Package to Trader Odette Bright",
    description:
      "Collect the sealed market package at the marked pickup, then carry it to the marked trader at Brightcart Exchange.",
    // Person recipient: repeatable auto-seeding supplies a pickup marker and
    // routes the drop-off to the live business owner.
    requirements: [
      {
        itemId: "sealed_package",
        count: 1,
        mapMarkerId: "harthmere_owner:npc_outpost_brightcart_trader",
        recipientNpcId: "npc_outpost_brightcart_trader",
      },
    ],
    rewardGold: { min: 60, max: 120 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_owner:npc_outpost_brightcart_trader",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_town_repair_chapel",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "repair",
    title: "Restore the Chapel Stone Engravings",
    description:
      "Wind and muck have dulled the chapel stone. Bring 4 chisel-grade stones and an equipped repair tool to restore the etchings.",
    requirements: [
      {
        itemId: "rough_stone",
        count: 4,
        mapMarkerId: "harthmere_chapel_stone",
        // The copy has always promised a mallet; the server now enforces it,
        // and the tool-source guidance routes an unarmed player to Hingehall.
        requiredToolAction: "repair",
      },
    ],
    rewardGold: { min: 80, max: 150 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_chapel_stone",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_npc_courier_bridge",
    issuerKind: "npc",
    issuerId: "sergeant_bram_holt",
    kind: "delivery",
    title: "Bram's Bridge Report Delivery",
    description:
      "Collect Bram's sealed bridge report at the marked pickup, then carry it to the marked dispatcher at Stampspur Station before dusk.",
    requirements: [
      {
        itemId: "sealed_package",
        count: 1,
        mapMarkerId: "harthmere_owner:npc_outpost_stampspur_dispatcher",
        recipientNpcId: "npc_outpost_stampspur_dispatcher",
      },
    ],
    rewardGold: { min: 70, max: 140 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_owner:npc_outpost_stampspur_dispatcher",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_business_craft_lantern",
    issuerKind: "business",
    issuerId: "harthmere_marketcraft_co",
    kind: "craft",
    title: "Forge Market Iron Fittings",
    description:
      "The market lamps need replacement brackets. Smelt or buy 3 iron ingots and turn them in at the Harthmere jobs board.",
    requirements: [{ itemId: "iron_ingot", count: 3 }],
    rewardGold: { min: 90, max: 180 },
    requiresFieldWork: false,
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_guild_security_patrol",
    issuerKind: "guild",
    issuerId: "harthmere_warden_guild",
    kind: "security",
    title: "Night Patrol the Market District",
    description:
      "A night patrol pass between bridge and market office. Report anything that doesn't belong.",
    requirements: [
      {
        targetId: "harthmere_market_office",
        targetName: "Harthmere Market Office",
        mapMarkerId: "harthmere_market_office",
      },
    ],
    rewardGold: { min: 100, max: 200 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_market_office",
    boardScope: "harthmere",
  },
  // HARTHMERE_JOBS_BOARD_MONSTER_HUNT (Harthmere-side):
  // Tougher Mucker variant operating along the Harthmere borderlands. Same
  // pattern as the Grove Elite Mucker but rewards scale higher because the
  // monster is later-game power level and the travel distance is bigger.
  {
    templateId: "hunt_mucker_alpha",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "hunt",
    title: "Bounty: Alpha Mucker Past the Bridge",
    description:
      "An alpha Mucker is digging up the road past the bridge. Even a small party will struggle — bring four and stay clear of its slam radius.",
    requirements: [
      {
        targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID,
        targetName: "Alpha Mucker",
        mapMarkerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
      },
    ],
    rewardGold: { min: 1800, max: 3600 },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
    targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID,
    monsterId: "mucker",
    monsterTier: "boss",
    monsterPowerLevel: 22,
    partyRecommended: true,
    partyMinSize: 4,
    lootHint: ["Alpha Muckheart", "Slag Plate", "Boss Loot Cache"],
    boardScope: "harthmere",
  },
];

// Small deterministic PRNG used by the seeder so tests can run with a fixed
// "now" timestamp and assert exact outputs. Mulberry32 is plenty for picking
// templates and rolling reward amounts.
function autoSeedRng(seed: number) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `autoSeedRotationBucket(nowMs)` was removed with
// HARTHMERE_JOBS_BOARD_SEED_DETERMINISM. It bucketed the wall clock to rotate
// auto-seed draws, which is precisely the input that made an unpersisted read
// projection disagree with the durable write for the same job id. Rotation is
// now driven by the durable `nextJobNumber`. Do not reintroduce a clock-derived
// bucket into any auto-seed selection path.

function autoSeedStringSeed(value: string) {
  let seed = 0;
  for (let i = 0; i < value.length; i += 1) {
    seed = (seed * 31 + value.charCodeAt(i)) | 0;
  }
  return seed >>> 0;
}

/**
 * Rotate a template pool so the same entry is not always drawn first.
 *
 * TAKES A DURABLE `rotation`, NOT `nowMs`. This used to bucket the wall clock
 * per second, which made the rotation — and therefore the job drawn into a given
 * slot — differ between an unpersisted read projection and the write that later
 * persists it. See HARTHMERE_JOBS_BOARD_SEED_DETERMINISM in `economyAutoSeedJobs`.
 * The caller passes the same durable slot basis it uses for the slot RNG.
 */
function rotateAutoSeedEntries<T>(
  entries: readonly T[],
  input: {
    boardId: string;
    rotation: number;
    salt: string;
  }
) {
  if (entries.length <= 1) return [...entries];
  const rotation = Math.max(0, Math.trunc(Number(input.rotation) || 0));
  const offset =
    (rotation + autoSeedStringSeed(`${input.boardId}:${input.salt}`)) %
    entries.length;
  return entries
    .map((entry, index) => ({
      entry,
      order: (index - offset + entries.length) % entries.length,
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ entry }) => entry);
}

function isRepeatablePlacementAutoSeedTemplate(template: AutoSeedTemplate) {
  return template.kind === "delivery" || Boolean(template.monsterId);
}

const HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS: readonly string[] = [
  "old_grove_road_post",
  "coop_supply_box",
  "grove_tool_crate",
  "grove_resource_basket",
  "econ_kit_mailbag",
  "econ_grove_supply_chest",
  "harthmere_orchard_softwood",
  "doc_field_table",
] as const;

const HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS: readonly string[] = [
  "grove_mail_bank_satchel",
  "old_grove_road_post",
  "econ_grove_supply_chest",
  "doc_field_table",
] as const;

const HARTHMERE_TOWN_DELIVERY_DROPOFF_MARKERS: readonly string[] = [
  "harthmere_bridge_center",
  "harthmere_market_office",
  "harthmere_chapel_stone",
  "harthmere_connector",
] as const;

interface RepeatableDeliveryDropoffCandidate {
  markerId: string;
  targetId?: string;
  targetName?: string;
  recipientNpcId?: string;
}

function repeatableDeliveryPickupMarkersForBoard(boardId: string) {
  const outpostMarkers = HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) =>
    harthmereBusinessOutpostMapMarkerId(outpost.outpostId)
  );
  if (boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID) {
    return [...HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS, ...outpostMarkers];
  }
  return [
    "harthmere_bridge_center",
    "harthmere_market_office",
    "harthmere_chapel_stone",
    "harthmere_connector",
    ...outpostMarkers,
    ...HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS,
  ];
}

function repeatableDeliveryDropoffCandidatesForBoard(input: {
  boardId: string;
  personOnly?: boolean;
}): RepeatableDeliveryDropoffCandidate[] {
  const ownerDrops = HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => ({
    markerId: `${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}${outpost.ownerNpcId}`,
    recipientNpcId: outpost.ownerNpcId,
    targetName: outpost.displayName,
  }));
  if (input.personOnly) {
    return ownerDrops;
  }

  // HARTHMERE_BUSINESS_INTAKE_DROPOFFS (2026-07-29): the business intakes
  // (refinery intake terminal, forge material bin, trader ration crate, ...)
  // are now real, always-interactable props on each outpost apron, so a town
  // delivery can legitimately terminate at the business that ordered it rather
  // than always being rerouted to a Grove satchel.
  const businessIntakeDrops = harthmereJobsBoardFieldTargets()
    .filter((target) => target.source === "business_template_target")
    .map((target) => ({
      markerId: target.mapMarkerId,
      targetId: target.targetId,
      targetName: target.label,
    }));
  const placeMarkers =
    input.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
      ? HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS
      : [
          ...HARTHMERE_TOWN_DELIVERY_DROPOFF_MARKERS,
          ...HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS,
        ];
  return [
    ...placeMarkers.map((markerId) => ({
      markerId,
      targetId: markerId,
    })),
    ...(input.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
      ? []
      : businessIntakeDrops),
  ];
}

function randomRepeatableDeliveryPickupMarker(input: {
  boardId: string;
  rng: () => number;
  avoidMarkerIds?: readonly (string | undefined)[];
}) {
  const avoid = new Set(
    (input.avoidMarkerIds ?? []).filter((id): id is string => Boolean(id))
  );
  const candidates = repeatableDeliveryPickupMarkersForBoard(
    input.boardId
  ).filter((markerId) => !avoid.has(markerId));
  if (!candidates.length) {
    return undefined;
  }
  return candidates[
    Math.min(candidates.length - 1, Math.floor(input.rng() * candidates.length))
  ];
}

function randomRepeatableDeliveryDropoff(input: {
  boardId: string;
  rng: () => number;
  personOnly?: boolean;
  avoidMarkerIds?: readonly (string | undefined)[];
}) {
  const avoid = new Set(
    (input.avoidMarkerIds ?? []).filter((id): id is string => Boolean(id))
  );
  const candidates = repeatableDeliveryDropoffCandidatesForBoard({
    boardId: input.boardId,
    personOnly: input.personOnly,
  }).filter((candidate) => !avoid.has(candidate.markerId));
  if (!candidates.length) {
    return undefined;
  }
  return candidates[
    Math.min(candidates.length - 1, Math.floor(input.rng() * candidates.length))
  ];
}

function randomizedAutoSeedRequirements(input: {
  template: Pick<
    AutoSeedTemplate,
    | "kind"
    | "requirements"
    | "monsterId"
    | "monsterTier"
    | "mapMarkerId"
    | "targetId"
  >;
  boardId: string;
  rng: () => number;
}) {
  const requirements = input.template.requirements.map((req) => ({ ...req }));
  let mapMarkerId = input.template.mapMarkerId;
  let targetId = input.template.targetId;
  const logs: string[] = [];

  if (input.template.monsterId) {
    const target = randomHarthmereJobsBoardMuckBountyTarget({
      monsterId: input.template.monsterId,
      monsterTier: input.template.monsterTier,
      rng: input.rng,
    });
    if (target) {
      mapMarkerId = target.markerId;
      targetId = target.targetId;
      for (const req of requirements) {
        if (req.targetId || req.mapMarkerId) {
          req.targetId = target.targetId;
          req.targetName = target.targetName;
          req.mapMarkerId = target.markerId;
        }
      }
      logs.push(`muck_bounty_target:${target.seedId}:${target.areaId}`);
    }
  }

  if (input.template.kind === "delivery") {
    const firstDeliveryReq = requirements.find((req) => req.itemId);
    if (firstDeliveryReq) {
      const dropoff = randomRepeatableDeliveryDropoff({
        boardId: input.boardId,
        rng: input.rng,
        personOnly: Boolean(firstDeliveryReq.recipientNpcId),
      });
      if (dropoff) {
        firstDeliveryReq.mapMarkerId = dropoff.markerId;
        firstDeliveryReq.targetId = dropoff.targetId;
        firstDeliveryReq.targetName = dropoff.targetName;
        firstDeliveryReq.recipientNpcId = dropoff.recipientNpcId;
        mapMarkerId = dropoff.markerId;
        targetId = dropoff.targetId;
        logs.push(`delivery_dropoff:${dropoff.markerId}`);
      }
      const pickupMarkerId = randomRepeatableDeliveryPickupMarker({
        boardId: input.boardId,
        rng: input.rng,
        avoidMarkerIds: [
          firstDeliveryReq.mapMarkerId,
          firstDeliveryReq.targetId,
          firstDeliveryReq.recipientNpcId
            ? `${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}${firstDeliveryReq.recipientNpcId}`
            : undefined,
          mapMarkerId,
          targetId,
        ],
      });
      if (pickupMarkerId) {
        firstDeliveryReq.pickupMarkerId = pickupMarkerId;
        logs.push(`delivery_pickup:${pickupMarkerId}`);
      }
    }
  }

  return { requirements, mapMarkerId, targetId, logs };
}

function randomizedBusinessTemplateRequirements(input: {
  template: (typeof HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES)[number];
  boardId: string;
  rng: () => number;
}) {
  return randomizedAutoSeedRequirements({
    template: {
      kind: input.template.kind,
      requirements: input.template.requirements,
      mapMarkerId: input.template.mapMarkerId,
      targetId: input.template.targetId,
    },
    boardId: input.boardId,
    rng: input.rng,
  });
}

function countOpenAutoPostings(
  state: HarthmereJobsBoardState,
  boardId: string
): number {
  let count = 0;
  for (const job of Object.values(state.postings)) {
    if (job.boardId !== boardId) continue;
    if (job.status !== "open") continue;
    if (!job.autoPosted) continue;
    count += 1;
  }
  return count;
}

function expireStaleAutoPostingsForBoard(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  boardId: string
) {
  let expired = 0;
  for (const job of Object.values(result.next.postings)) {
    if (job.boardId !== boardId) continue;
    if (!job.autoPosted) continue;
    if (job.status !== "open" && job.status !== "active") continue;
    if (job.deadlineAtMs > request.nowMs) continue;
    const wasOpen = job.status === "open";
    job.status = "expired";
    job.logs.push(`expired_auto_read:${request.nowMs}`);
    if (wasOpen) {
      refundEscrow(result, job, request);
    }
    for (const todo of Object.values(result.next.todos)) {
      if (todo.jobId === job.jobId) todo.status = "expired";
    }
    result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
      openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
    if (job.acceptedByActorId) {
      result.next.actorAcceptedJobIds[job.acceptedByActorId] =
        activeJobIdsForActor(result.next, job.acceptedByActorId);
    }
    result.shared.add(sharedJobKey(job.jobId));
    expired += 1;
  }
  if (expired > 0) {
    result.touched.add("jobs_board_auto_expired");
    result.shared.add(sharedBoardKey(boardId));
  }
}

function hasOpenBusinessTemplateJob(
  state: HarthmereJobsBoardState,
  boardId: string,
  businessId: string
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      job.issuerKind === "business" &&
      job.issuerId === businessId &&
      (job.status === "open" || job.status === "active") &&
      Boolean(job.templateId)
  );
}

function hasOpenOutpostStarterJob(
  state: HarthmereJobsBoardState,
  boardId: string,
  outpostId: string
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      // Dedupe on the template id only: the starter job's targetId now points
      // at the outpost work station, not at the outpost itself.
      job.templateId === `business_outpost_starter:${outpostId}` &&
      (job.status === "open" || job.status === "active")
  );
}

function economyAutoSeedBusinessOutpostStarterJob(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  board: HarthmereJobsBoardRecord,
  outpost: HarthmereBusinessOutpost
) {
  if (hasOpenOutpostStarterJob(result.next, board.boardId, outpost.outpostId)) {
    result.touched.add("jobs_board_outpost_starter_noop");
    return;
  }
  const kind =
    HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE[outpost.businessType];
  const rewardGold = Math.max(
    HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD,
    Math.min(
      HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD,
      harthmereBusinessScaledJobPay(outpost.job.rewardGold)
    )
  );
  let jobId = `harthmere_outpost_starter_${result.next.nextJobNumber++}`;
  while (result.next.postings[jobId]) {
    jobId = `harthmere_outpost_starter_${result.next.nextJobNumber++}`;
  }
  // HARTHMERE_OUTPOST_STARTER_WORK_STATION (2026-07-29):
  // The starter requirement used to point at the outpost's OWN jobs board
  // marker, so "sort refinery stock" / "prepare bandages" / "wrap meat" were
  // satisfied by re-opening the board that issued the job. It now points at the
  // physical work station on the shop apron, and the server's observed-target
  // gate requires a real world-object receipt for that station.
  const workStation = harthmereOutpostWorkStationForOutpost(outpost.outpostId);
  const workAction = harthmereOutpostWorkStationAction(outpost.businessType);
  const posting: HarthmereJobsBoardPosting = {
    jobId,
    boardId: board.boardId,
    issuerKind: "npc",
    issuerId: outpost.ownerNpcId,
    issuerBusinessType: outpost.businessType,
    title: `${outpost.job.title} at ${outpost.displayName}`,
    description: workStation
      ? `${outpost.job.starterTask} ${
          workAction ?? "Do the work"
        } at the ${workStation.label}, then return to the board. Teaches: ${
          outpost.job.teaches
        }`
      : `${outpost.job.starterTask} Teaches: ${outpost.job.teaches}`,
    kind,
    requirements: [
      {
        serviceKind: outpost.businessType,
        serviceUnits: 1,
        targetId: workStation?.targetId ?? outpost.outpostId,
        targetName: workStation?.label ?? outpost.displayName,
        mapMarkerId:
          workStation?.mapMarkerId ??
          harthmereBusinessOutpostJobMarkerId(outpost),
      },
    ],
    templateId: `business_outpost_starter:${outpost.outpostId}`,
    rewardGold,
    escrowGold: rewardGold,
    reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
    status: "open",
    townId: outpost.townId,
    regionId: outpost.regionId,
    createdAtMs: request.nowMs,
    deadlineAtMs: request.nowMs + 7 * 24 * 60 * 60 * 1000,
    failurePenaltyGold: Math.round(rewardGold * 0.1),
    requiresFieldWork: true,
    mapMarkerId:
      workStation?.mapMarkerId ?? harthmereBusinessOutpostJobMarkerId(outpost),
    targetId: workStation?.targetId ?? outpost.outpostId,
    abuseFlags: [],
    logs: [
      `auto_seeded_business_outpost_starter:${outpost.outpostId}:${request.nowMs}`,
    ],
    autoPosted: true,
    source: "economy_auto_seed",
  };
  result.next.postings[jobId] = posting;
  const issuerKey = `npc:${outpost.ownerNpcId}`;
  result.next.issuerOpenJobIds[issuerKey] = [
    ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
    jobId,
  ];
  result.next.audit.push({
    id: `${request.requestId}:${jobId}`,
    atMs: request.nowMs,
    actorId: request.actorId,
    kind: "job_auto_seeded",
    jobId,
    boardId: board.boardId,
    issuerKind: "npc",
    issuerId: outpost.ownerNpcId,
    amountGold: -rewardGold,
    reason: `business_outpost_starter:${outpost.businessType}`,
  });
  result.touched.add("jobs_board_posting");
  result.touched.add("jobs_board_outpost_starter_seeded");
  result.shared.add(sharedBoardKey(board.boardId));
  result.shared.add(sharedJobKey(jobId));
}

function economyAutoSeedProductionBusinessJobs(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  board: HarthmereJobsBoardRecord
) {
  let produced = 0;
  const businessCandidates = Object.values(result.economy?.businesses ?? {})
    .filter(
      (business) =>
        business.status === "open" &&
        (business.townId === board.townId ||
          business.regionId === board.regionId)
    )
    .sort((a, b) => a.businessId.localeCompare(b.businessId));
  let businessOrderSeed = 0;
  const businessOrderSeedKey = `${board.boardId}:business-rotation`;
  for (let i = 0; i < businessOrderSeedKey.length; i += 1) {
    businessOrderSeed =
      (businessOrderSeed * 31 + businessOrderSeedKey.charCodeAt(i)) | 0;
  }
  // HARTHMERE_JOBS_BOARD_SEED_DETERMINISM applies here too. This path allocates
  // ids from the same durable `nextJobNumber` counter and also runs on the
  // unpersisted GET projection, so a clock-derived rotation reissues an id with a
  // different business's job across a bucket boundary. The rotation basis is the
  // job number about to be issued; `businessCandidates` is already sorted by
  // `businessId`, so the whole ordering is now a function of durable state.
  const businessOrderRng = autoSeedRng(
    autoSeedStringSeed(
      `${businessOrderSeed}:${result.next.nextJobNumber}`
    )
  );
  const businessRotationIndex = businessCandidates.length
    ? (result.next.nextJobNumber + (businessOrderSeed >>> 0)) %
      businessCandidates.length
    : 0;
  const businesses = businessCandidates
    .map((business, index) => ({
      business,
      order:
        ((index - businessRotationIndex + businessCandidates.length) %
          businessCandidates.length) +
        businessOrderRng() * 0.001,
    }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.business);

  for (const business of businesses) {
    if (produced >= HARTHMERE_JOBS_BOARD_BUSINESS_AUTO_SEED_MAX_PER_TICK) break;
    if (
      hasOpenBusinessTemplateJob(
        result.next,
        board.boardId,
        business.businessId
      )
    )
      continue;
    const template = HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.find(
      (entry) =>
        entry.businessType === business.typeId &&
        board.acceptedKinds.includes(entry.kind)
    );
    if (!template) continue;
    const issuerKey = `business:${business.businessId}`;
    const issuerOpen = result.next.issuerOpenJobIds[issuerKey]?.length ?? 0;
    if (issuerOpen >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER)
      continue;
    const desiredRewardGold = Math.max(
      HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD,
      Math.min(HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD, template.defaultRewardGold)
    );
    const affordableGold = Math.max(0, Math.trunc(business.balanceGold ?? 0));
    const rewardGold = Math.min(desiredRewardGold, affordableGold);
    if (business.balanceGold < rewardGold) continue;
    if (rewardGold < HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD) continue;
    business.balanceGold -= rewardGold;
    let businessSeed = 0;
    const businessSeedKey = `${board.boardId}:${business.businessId}:${template.templateId}`;
    for (let i = 0; i < businessSeedKey.length; i += 1) {
      businessSeed = (businessSeed * 31 + businessSeedKey.charCodeAt(i)) | 0;
    }
    const businessRng = autoSeedRng((request.nowMs ^ businessSeed) >>> 0);
    const randomized = randomizedBusinessTemplateRequirements({
      template,
      boardId: board.boardId,
      rng: businessRng,
    });
    let jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next
      .nextJobNumber++}`;
    while (result.next.postings[jobId]) {
      jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next
        .nextJobNumber++}`;
    }
    const posting: HarthmereJobsBoardPosting = {
      jobId,
      boardId: board.boardId,
      issuerKind: "business",
      issuerId: business.businessId,
      issuerBusinessType: business.typeId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements: randomized.requirements,
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: business.townId ?? board.townId,
      regionId: business.regionId ?? board.regionId,
      createdAtMs: request.nowMs,
      deadlineAtMs:
        request.nowMs + template.defaultDeadlineDays * 24 * 60 * 60 * 1000,
      failurePenaltyGold: Math.round(rewardGold * 0.1),
      requiresFieldWork: true,
      mapMarkerId: randomized.mapMarkerId,
      targetId: randomized.targetId,
      abuseFlags: [],
      logs: [
        `auto_seeded_business:${template.templateId}:${request.nowMs}`,
        ...randomized.logs,
      ],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    result.next.postings[jobId] = posting;
    result.next.issuerOpenJobIds[issuerKey] = [
      ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
      jobId,
    ];
    result.next.audit.push({
      id: `${request.requestId}:${jobId}`,
      atMs: request.nowMs,
      actorId: request.actorId,
      kind: "job_auto_seeded",
      jobId,
      boardId: board.boardId,
      issuerKind: "business",
      issuerId: business.businessId,
      amountGold: -rewardGold,
      reason: template.templateId,
    });
    result.touched.add("jobs_board_posting");
    result.touched.add("jobs_board_business_auto_seeded");
    result.touched.add("economy_business_bank");
    result.shared.add(sharedBoardKey(board.boardId));
    result.shared.add(sharedJobKey(jobId));
    result.shared.add(`harthmere:economy:business:${business.businessId}`);
    produced += 1;
  }
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING:
// Generate up to `HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK` new auto
// postings on the target board so the board stays around
// `HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN` open auto jobs. Picks
// templates deterministically from `request.nowMs` so the same tick on the
// same board produces the same output (testable). Skips boards that don't
// accept the template's kind. Escrow comes from the issuing town/guild —
// auto-posted town/business/guild jobs pre-commit the reward gold via the
// new posting's `escrowGold` field; the existing complete/cancel flow then
// pays it out or refunds it.
function economyAutoSeedJobs(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
) {
  const boardId = request.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
  const board = result.next.boards[boardId];
  if (!board) {
    reject(result, "jobs_board_rejected:unknown_board");
    return;
  }
  expireStaleAutoPostingsForBoard(result, request, boardId);
  const outpost = businessOutpostForJobsBoardId(boardId);
  if (outpost) {
    economyAutoSeedBusinessOutpostStarterJob(result, request, board, outpost);
    return;
  }
  economyAutoSeedProductionBusinessJobs(result, request, board);
  const openAuto = countOpenAutoPostings(result.next, boardId);
  const slotsToFill = Math.max(
    0,
    Math.min(
      HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK,
      HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN - openAuto
    )
  );
  if (slotsToFill === 0) {
    result.touched.add("jobs_board_auto_seed_noop");
    return;
  }
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
  // Mix the board id into the seed so the same tick on different boards still
  // produces different template draws — otherwise both boards would surface the
  // same Mucker hunt slot when ticked together.
  //
  // HARTHMERE_JOBS_BOARD_SEED_DETERMINISM — DO NOT PUT THE CLOCK BACK IN HERE.
  //
  // This used to be `autoSeedRng((request.nowMs ^ boardSeed) >>> 0)`, and that
  // one `nowMs` was a critical correctness bug rather than a cosmetic one.
  //
  // `live_mode_jobs_board_state.ts` runs this reducer on every GET and returns
  // the result WITHOUT persisting it — correct, because the ECS source-of-truth
  // rule forbids a GET from writing. But job ids come from the durable
  // `nextJobNumber` counter while the template draw came from the wall clock,
  // so two reads a poll apart reissued the SAME ids with DIFFERENT jobs:
  //
  //   read at T      harthmere_auto_1 = Bounty: Elite Mucker, 1959g
  //   read at T+3.5s harthmere_auto_1 = Run the Coop Food Parcel, 51g
  //
  // `acceptJobPosting` binds by job id alone, and the accept-time repair in
  // `live_mode_backend.ts` re-seeds the board with the WRITER's clock when the
  // requested id is not durable yet. So the player clicked one job and was
  // reliably bound to a different one — a disappointment in one direction and a
  // gold exploit in the other.
  //
  // The seed is therefore derived only from durable state: the board id and the
  // job number about to be issued. Any number of unpersisted reads now agree
  // with each other and with the write that finally persists them. Variety is
  // unaffected: the counter advances as jobs are actually created, so the next
  // seeding round draws differently.
  const boardSeed = autoSeedStringSeed(boardId);
  const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
    (tpl) =>
      board.acceptedKinds.includes(tpl.kind) &&
      templateBoardScopeMatches(tpl, boardId) &&
      harthmereAutoSeedTemplateRequirementsObtainable(tpl.requirements)
  );
  if (templates.length === 0) {
    result.touched.add("jobs_board_auto_seed_no_templates");
    return;
  }
  const openAutoPostings = Object.values(result.next.postings).filter(
    (job) =>
      job.boardId === boardId &&
      job.status === "open" &&
      job.autoPosted === true
  );
  const openTemplateIds = new Set(
    openAutoPostings
      .map((job) => job.templateId)
      .filter((templateId): templateId is string => Boolean(templateId))
  );
  const openKinds = new Set(openAutoPostings.map((job) => job.kind));
  const exoticMatterTemplates =
    boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
      ? templates.filter((template) =>
          isHarthmereExoticMatterMiningTemplateId(template.templateId)
        )
      : [];
  const shouldPrimeExoticMatterMining =
    exoticMatterTemplates.length > 0 &&
    !hasOpenExoticMatterMiningJob(result.next, boardId);
  const repeatablePlacementTemplates = templates.filter(
    isRepeatablePlacementAutoSeedTemplate
  );
  const repeatablePlacementLimit = Math.min(
    Math.max(0, slotsToFill - (shouldPrimeExoticMatterMining ? 1 : 0)),
    repeatablePlacementTemplates.length
  );

  // Pick distinct template ids per tick when possible so the board feels
  // varied. Prefer kinds/templates missing from the board before repeating, so
  // one narrow RNG streak cannot leave players seeing only repairs and hunts.
  // When the target slot count exceeds the template count, repeats are allowed
  // (still bounded by per-issuer cap below).
  const usedTemplateIds = new Set<string>();
  const usedKinds = new Set<string>();
  let produced = 0;
  let attempts = 0;
  while (produced < slotsToFill && attempts < slotsToFill * 6) {
    attempts += 1;
    // One RNG stream per SLOT, keyed by the job number this iteration would
    // issue. `nextJobNumber` only advances when a posting is actually created,
    // so an unpersisted read and the later durable write derive the same stream
    // for the same job id. `attempts` is mixed in so a rejected draw (issuer cap,
    // duplicate template) tries something different instead of spinning on the
    // same choice — it is itself a deterministic function of the same state, so
    // reproducibility is preserved.
    const slotRng = autoSeedRng(
      autoSeedStringSeed(
        `${boardSeed}:${result.next.nextJobNumber}:${attempts}`
      )
    );
    const missingRepeatablePlacementPool = repeatablePlacementTemplates.filter(
      (template) =>
        !usedTemplateIds.has(template.templateId) &&
        (!openTemplateIds.has(template.templateId) ||
          openTemplateIds.size >= templates.length)
    );
    const shouldPrimeExotic = shouldPrimeExoticMatterMining && produced === 0;
    const shouldPrimeRepeatablePlacement =
      !shouldPrimeExotic &&
      produced < repeatablePlacementLimit &&
      missingRepeatablePlacementPool.length > 0;
    const baseTemplatePool = shouldPrimeExotic
      ? exoticMatterTemplates
      : shouldPrimeRepeatablePlacement
      ? rotateAutoSeedEntries(missingRepeatablePlacementPool, {
          boardId,
          rotation: result.next.nextJobNumber,
          salt: "repeatable-placement",
        })
      : templates;
    const distinctTemplatePool = baseTemplatePool.filter(
      (template) =>
        !usedTemplateIds.has(template.templateId) &&
        (!openTemplateIds.has(template.templateId) ||
          openTemplateIds.size >= templates.length)
    );
    const diverseKindPool = distinctTemplatePool.filter(
      (template) =>
        !openKinds.has(template.kind) && !usedKinds.has(template.kind)
    );
    const templatePool = shouldPrimeRepeatablePlacement
      ? distinctTemplatePool.length > 0
        ? distinctTemplatePool
        : baseTemplatePool
      : diverseKindPool.length > 0
      ? diverseKindPool
      : distinctTemplatePool.length > 0
      ? distinctTemplatePool
      : baseTemplatePool;
    const template = shouldPrimeRepeatablePlacement
      ? templatePool[0]
      : templatePool[Math.floor(slotRng() * templatePool.length)];
    if (!template) break;
    if (
      usedTemplateIds.has(template.templateId) &&
      usedTemplateIds.size < templates.length
    ) {
      continue;
    }
    const issuerKey = `${template.issuerKind}:${template.issuerId}`;
    const issuerOpen = result.next.issuerOpenJobIds[issuerKey]?.length ?? 0;
    if (issuerOpen >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER) {
      continue;
    }

    const rewardSpan = template.rewardGold.max - template.rewardGold.min;
    const rewardGold = Math.max(
      HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD,
      Math.min(
        HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD,
        Math.round(
          template.rewardGold.min + slotRng() * Math.max(0, rewardSpan)
        )
      )
    );
    // HARTHMERE_JOBS_BOARD_AUTO_POSTING:
    // For business-issued auto jobs, we must actually debit the business's
    // treasury or skip the template. Town/guild/NPC issuers have no real
    // treasury yet (matches existing complete-job behaviour for those
    // issuer kinds), so we accept the pre-committed escrow as a sanctioned
    // faucet for current. When town/guild treasuries land, this branch is the
    // single place to wire them up.
    if (template.issuerKind === "business") {
      const business = result.economy?.businesses?.[template.issuerId];
      if (!business || business.balanceGold < rewardGold) {
        continue;
      }
      business.balanceGold -= rewardGold;
      result.touched.add("economy_business_bank");
      result.shared.add(`harthmere:economy:business:${business.businessId}`);
    }
    let jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next
      .nextJobNumber++}`;
    while (result.next.postings[jobId]) {
      jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next
        .nextJobNumber++}`;
    }
    const randomized = randomizedAutoSeedRequirements({
      template,
      boardId,
      rng: slotRng,
    });
    const flags: string[] = [];
    if (hasSuspiciousText(`${template.title} ${template.description}`)) {
      flags.push("suspicious_text");
    }
    const posting: HarthmereJobsBoardPosting = {
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements: randomized.requirements,
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: board.townId,
      regionId: board.regionId,
      createdAtMs: request.nowMs,
      deadlineAtMs: request.nowMs + HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS,
      failurePenaltyGold: Math.round(rewardGold * 0.1),
      requiresFieldWork: template.requiresFieldWork,
      mapMarkerId: randomized.mapMarkerId,
      targetId: randomized.targetId,
      abuseFlags: flags,
      logs: [
        `auto_seeded:${template.templateId}:${request.nowMs}`,
        ...randomized.logs,
      ],
      autoPosted: true,
      source: "economy_auto_seed",
      partyRecommended: template.partyRecommended,
      partyMinSize: template.partyMinSize,
      monsterId: template.monsterId,
      monsterTier: template.monsterTier,
      monsterPowerLevel: template.monsterPowerLevel,
      lootHint: template.lootHint ? [...template.lootHint] : undefined,
    };
    result.next.postings[jobId] = posting;
    result.next.issuerOpenJobIds[issuerKey] = [
      ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
      jobId,
    ];
    usedTemplateIds.add(template.templateId);
    usedKinds.add(template.kind);
    openTemplateIds.add(template.templateId);
    openKinds.add(template.kind);
    produced += 1;

    // Audit and shared-state markers — same shape as player-posted jobs so
    // downstream consumers (UI live snapshot, audit log readers) work
    // identically for auto-posted jobs.
    result.next.audit.push({
      id: `${request.requestId}:${jobId}`,
      atMs: request.nowMs,
      actorId: request.actorId,
      kind: "job_auto_seeded",
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      amountGold: -rewardGold,
      reason: template.monsterId
        ? `monster_hunt:${template.monsterId}`
        : template.templateId,
    });
    result.touched.add("jobs_board_posting");
    result.shared.add(sharedBoardKey(boardId));
    result.shared.add(sharedJobKey(jobId));
  }
  if (produced > 0) {
    result.touched.add("jobs_board_auto_seeded");
  }
  void context;
}

export function reduceHarthmereJobsBoardMutation(
  state: HarthmereJobsBoardState,
  request: HarthmereJobsBoardMutationRequest,
  context: HarthmereJobsBoardMutationContext
): HarthmereJobsBoardMutationResult {
  const result = makeResult(state, context);
  // HARTHMERE_JOB_ACCEPT_TIMER: lazily expire lapsed accepted jobs on EVERY
  // interaction so stale claims (player took a job, ran out of time) are released
  // and marked failed without needing a separate scheduled tick.
  sweepLapsedAcceptedJobs(result, request.nowMs);
  switch (request.operation) {
    case "create_job_posting":
      createJobPosting(result, request, context);
      break;
    case "fail_job_quest":
      failJobQuest(result, request);
      break;
    case "accept_job":
      acceptJobPosting(result, request, context);
      break;
    case "complete_job":
      completeJobPosting(result, request, context);
      break;
    case "complete_job_quest":
      completeJobQuest(result, request, context);
      break;
    case "pickup_delivery_parcel":
      pickupDeliveryParcel(result, request, context);
      break;
    case "cancel_job":
      cancelJobPosting(result, request, context);
      break;
    case "abandon_job":
      abandonJobPosting(result, request, context);
      break;
    case "expire_jobs":
      expireJobs(result, request, context);
      break;
    case "economy_auto_seed_jobs":
      economyAutoSeedJobs(result, request, context);
      break;
    default:
      reject(
        result,
        `jobs_board_rejected:unsupported_operation:${request.operation}`
      );
  }
  return {
    jobsBoard: result.next,
    inventoryGoldDelta: result.goldDelta,
    inventoryItemDeltas: result.itemDeltas,
    collectibleRewardIds: result.collectibleRewardIds,
    economy: result.economy,
    warnings: result.warnings,
    touchedModels: Array.from(result.touched),
    sharedStateKeys: Array.from(result.shared),
  };
}

export function createHarthmereJobsBoardClientSnapshot(
  state: HarthmereJobsBoardState,
  actorId: string
) {
  return createHarthmereJobsBoardClientSnapshotAtTime(
    state,
    actorId,
    Date.now()
  );
}

export function createHarthmereJobsBoardClientSnapshotAtTime(
  state: HarthmereJobsBoardState,
  actorId: string,
  nowMs: number
) {
  const postings = Object.values(state.postings);
  const myPostedJobs = postings.filter(
    (job) => job.issuerKind === "player" && job.issuerId === actorId
  );
  const myAcceptedJobs = postings.filter(
    (job) => job.acceptedByActorId === actorId && job.status === "active"
  );
  const myTodos = Object.values(state.todos).filter(
    (todo) => todo.actorId === actorId
  );
  return {
    version: state.version,
    actorId,
    boards: state.boards,
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    openJobs: postings.filter(
      (job) => job.status === "open" && job.deadlineAtMs > nowMs
    ),
    activeJobs: postings.filter((job) => job.status === "active"),
    myPostedJobs,
    myAcceptedJobs,
    myTodos,
    audit: state.audit.slice(-100),
    cooldown: state.actorCooldowns[actorId] ?? { abuseScore: 0 },
    safety: {
      minRewardGold: HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD,
      maxRewardGold: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD,
      maxActivePostingsPerIssuer:
        HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER,
      maxActiveAcceptedPerSeeker:
        HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER,
      requiresPhysicalBoardInteraction: true,
    },
  };
}
