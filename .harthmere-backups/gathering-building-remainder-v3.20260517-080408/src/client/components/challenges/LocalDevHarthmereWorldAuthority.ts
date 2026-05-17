// Harthmere mock-authoritative world layer.
// This is intentionally pure and client-callable for local-dev tests, but it models
// the same validation boundary a real server/API must own in production.

export const HARTHMERE_AUTHORITY_MODE = "mock_server" as const;
export const HARTHMERE_AUTHORITY_VERSION = 1 as const;

export type HarthmereAuthorityMode = typeof HARTHMERE_AUTHORITY_MODE | "live_server";
export type HarthmereAuthorityFailureCode =
  | "unknown_target"
  | "duplicate_transaction"
  | "too_far"
  | "blocked_line_of_sight"
  | "invalid_player_state"
  | "missing_tool"
  | "tool_broken"
  | "skill_too_low"
  | "wrong_quest_phase"
  | "restricted_area"
  | "node_depleted"
  | "node_reserved"
  | "wrong_environment"
  | "inventory_full"
  | "anti_bot_review"
  | "not_enough_gold"
  | "missing_materials"
  | "missing_permission"
  | "invalid_placement"
  | "door_locked"
  | "upkeep_blocked"
  | "repair_blocked";

export type HarthmereAuthorityResult<T = Record<string, never>> =
  | ({ ok: true; mode: HarthmereAuthorityMode; message: string } & T)
  | {
      ok: false;
      mode: HarthmereAuthorityMode;
      code: HarthmereAuthorityFailureCode;
      message: string;
      evidence: string[];
    };

export interface HarthmereAuthorityTransport {
  mode: HarthmereAuthorityMode;
  validate<TRequest, TResponse>(route: string, request: TRequest): Promise<TResponse>;
}

export function createHarthmereMockServerTransport(): HarthmereAuthorityTransport {
  return {
    mode: HARTHMERE_AUTHORITY_MODE,
    async validate(_route, request) {
      return request as never;
    },
  };
}

export function createHarthmereLiveServerTransport(baseUrl: string): HarthmereAuthorityTransport {
  return {
    mode: "live_server",
    async validate(route, request) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(`Harthmere authority request failed: ${response.status}`);
      }
      return (await response.json()) as never;
    },
  };
}

export interface HarthmerePlayerActionState {
  playerId: string;
  position?: [number, number, number];
  lineOfSightClear?: boolean;
  isDead?: boolean;
  isDowned?: boolean;
  isStunned?: boolean;
  inCombat?: boolean;
  mounted?: boolean;
  mountedGatheringAllowed?: boolean;
  swimming?: boolean;
  aquaticGatheringAllowed?: boolean;
  flying?: boolean;
  aerialGatheringAllowed?: boolean;
  trading?: boolean;
  teleporting?: boolean;
  loading?: boolean;
  inCutscene?: boolean;
  inRestrictedArea?: boolean;
  questPhase?: string;
  stealth?: boolean;
  tookDamageAt?: number;
}

export interface HarthmereGatheringActionOptions {
  transactionId?: string;
  idempotencyKey?: string;
  playerState?: Partial<HarthmerePlayerActionState>;
  inventoryCapacity?: HarthmereGatheringInventoryCapacity;
  reservation?: HarthmereResourceReservation;
  environment?: HarthmereWorldConditionState;
  antiBot?: HarthmereAntiBotSnapshot;
  toolDurability?: HarthmereToolDurabilitySnapshot;
}

export interface HarthmereResourceReservation {
  nodeId: string;
  reservedBy: string;
  reservedUntil: number;
  released?: boolean;
  releaseReason?: "cancel" | "moved" | "combat" | "death" | "timeout";
}

export interface HarthmereWorldConditionState {
  biome?: string;
  weather?: "clear" | "rain" | "storm" | "snow" | "fog" | "ash";
  timeOfDay?: "dawn" | "day" | "dusk" | "night";
  season?: "spring" | "summer" | "autumn" | "winter" | "festival";
  eventFlags?: string[];
}

export interface HarthmereAntiBotSnapshot {
  routeHash?: string;
  repeatedNodeCount?: number;
  recentAttemptsInMinute?: number;
  suspiciousRouteScore?: number;
  lastTransactionIds?: string[];
}

export interface HarthmereToolDurabilitySnapshot {
  itemId: string;
  durability: number;
  durabilityMax: number;
  lossPerGather?: number;
}

export interface HarthmereGatheringInventoryCapacity {
  backpackFreeSlots?: number;
  materialStorageFree?: number;
  questPouchFreeSlots?: number;
  walletAcceptsCurrencies?: boolean;
  overflowEnabled?: boolean;
}

export interface HarthmereGatheringValidationInput {
  nodeDefinition?: {
    id: string;
    name: string;
    position?: [number, number, number];
    requiredTool?: string;
    requiredSkill?: number;
    profession?: string;
    shareMode?: string;
    category?: string;
    biome?: string;
    ownership?: string;
    requiredQuestPhase?: string;
    requiredWeather?: string[];
    requiredTimeOfDay?: string[];
    requiredSeason?: string[];
    allowCombatGathering?: boolean;
    allowMountedGathering?: boolean;
    allowSwimmingGathering?: boolean;
    requiresLineOfSight?: boolean;
  };
  playerState?: Partial<HarthmerePlayerActionState>;
  hasRequiredTool: boolean;
  professionLevel: number;
  cooldownReady: boolean;
  reservation?: HarthmereResourceReservation;
  environment?: HarthmereWorldConditionState;
  antiBot?: HarthmereAntiBotSnapshot;
  toolDurability?: HarthmereToolDurabilitySnapshot;
}

const DEFAULT_PLAYER: HarthmerePlayerActionState = {
  playerId: "local-player",
  position: undefined,
  lineOfSightClear: true,
  isDead: false,
  isDowned: false,
  isStunned: false,
  inCombat: false,
  mounted: false,
  mountedGatheringAllowed: false,
  swimming: false,
  aquaticGatheringAllowed: false,
  flying: false,
  aerialGatheringAllowed: false,
  trading: false,
  teleporting: false,
  loading: false,
  inCutscene: false,
  inRestrictedArea: false,
  questPhase: undefined,
  stealth: false,
};

function fail(code: HarthmereAuthorityFailureCode, message: string, evidence: string[] = []): HarthmereAuthorityResult {
  return { ok: false, mode: HARTHMERE_AUTHORITY_MODE, code, message, evidence };
}

function pass<T extends Record<string, unknown>>(message: string, extra: T): HarthmereAuthorityResult<T> {
  return { ok: true, mode: HARTHMERE_AUTHORITY_MODE, message, ...extra };
}

function distance3(a?: [number, number, number], b?: [number, number, number]) {
  if (!a || !b) return 0;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function materialRouteFor(itemId: string, nodeCategory?: string) {
  if (itemId.includes("coin") || itemId.includes("token")) return "wallet" as const;
  if (itemId.startsWith("quest_") || itemId.includes("moonflower_quest")) return "quest_pouch" as const;
  if (
    nodeCategory === "ore" ||
    nodeCategory === "wood" ||
    nodeCategory === "herb" ||
    nodeCategory === "fish" ||
    nodeCategory === "farm" ||
    nodeCategory === "scrap" ||
    nodeCategory === "clay" ||
    nodeCategory === "magic" ||
    nodeCategory === "corpse" ||
    nodeCategory === "water" ||
    nodeCategory === "relic"
  ) {
    return "material_storage" as const;
  }
  return "backpack" as const;
}

export function validateHarthmereGatherAttempt(input: HarthmereGatheringValidationInput): HarthmereAuthorityResult<{
  transactionId: string;
  reservationExpiresAt: number;
  breaksStealth: boolean;
}> {
  const node = input.nodeDefinition;
  if (!node) return fail("unknown_target", "Unknown resource node.", ["nodeDefinition missing"]);
  const player = { ...DEFAULT_PLAYER, ...(input.playerState ?? {}) };
  const transactionId = input.antiBot?.lastTransactionIds?.[0] ?? `gather_${node.id}_${Date.now()}`;

  if (input.antiBot?.lastTransactionIds?.includes(transactionId)) {
    return fail("duplicate_transaction", "Duplicate gather request ignored.", [transactionId]);
  }
  const distance = distance3(player.position, node.position);
  if (distance > 6) {
    return fail("too_far", `${node.name} is too far away to gather.`, [`distance=${distance.toFixed(2)}`]);
  }
  if (node.requiresLineOfSight !== false && player.lineOfSightClear === false) {
    return fail("blocked_line_of_sight", `${node.name} is blocked from view.`, ["lineOfSightClear=false"]);
  }
  const invalidState = [
    [player.isDead, "dead"],
    [player.isDowned, "downed"],
    [player.isStunned, "stunned"],
    [player.trading, "trading"],
    [player.teleporting, "teleporting"],
    [player.loading, "loading"],
    [player.inCutscene, "cutscene"],
    [player.inRestrictedArea, "restricted_area"],
  ].filter(([active]) => Boolean(active));
  if (invalidState.length) {
    return fail("invalid_player_state", `Cannot gather while ${invalidState.map(([, label]) => label).join(", ")}.`, invalidState.map(([, label]) => String(label)));
  }
  if (player.inCombat && !node.allowCombatGathering) {
    return fail("invalid_player_state", "Cannot gather this resource during combat.", ["inCombat=true"]);
  }
  if (player.mounted && !(player.mountedGatheringAllowed || node.allowMountedGathering)) {
    return fail("invalid_player_state", "Dismount before gathering this resource.", ["mounted=true"]);
  }
  if (player.swimming && !(player.aquaticGatheringAllowed || node.allowSwimmingGathering || node.category === "fish" || node.category === "water")) {
    return fail("invalid_player_state", "This resource cannot be gathered while swimming.", ["swimming=true"]);
  }
  if (player.flying && !player.aerialGatheringAllowed) {
    return fail("invalid_player_state", "Land before gathering this resource.", ["flying=true"]);
  }
  if (node.requiredQuestPhase && player.questPhase !== node.requiredQuestPhase) {
    return fail("wrong_quest_phase", `${node.name} is not available in the current quest phase.`, [`required=${node.requiredQuestPhase}`, `actual=${player.questPhase ?? "none"}`]);
  }
  if (!input.hasRequiredTool) {
    return fail("missing_tool", `${node.name} requires the correct gathering tool.`, [node.requiredTool ?? "tool_required"]);
  }
  if (input.toolDurability && input.toolDurability.durability <= 0) {
    return fail("tool_broken", `${input.toolDurability.itemId} is broken and must be repaired.`, [`durability=${input.toolDurability.durability}`]);
  }
  if (input.professionLevel < (node.requiredSkill ?? 1)) {
    return fail("skill_too_low", `${node.name} requires ${node.profession ?? "gathering"} ${(node.requiredSkill ?? 1)}.`, [`level=${input.professionLevel}`]);
  }
  if (!input.cooldownReady) {
    return fail("node_depleted", `${node.name} is depleted and waiting to respawn.`, ["cooldownReady=false"]);
  }
  if (input.reservation && input.reservation.nodeId === node.id && input.reservation.reservedBy !== player.playerId && input.reservation.reservedUntil > Date.now() && !input.reservation.released) {
    return fail("node_reserved", `${node.name} is temporarily reserved by another gatherer.`, [`reservedBy=${input.reservation.reservedBy}`]);
  }
  const environment = input.environment;
  if (environment) {
    if (node.requiredWeather?.length && environment.weather && !node.requiredWeather.includes(environment.weather)) {
      return fail("wrong_environment", `${node.name} is not active in this weather.`, [`weather=${environment.weather}`]);
    }
    if (node.requiredTimeOfDay?.length && environment.timeOfDay && !node.requiredTimeOfDay.includes(environment.timeOfDay)) {
      return fail("wrong_environment", `${node.name} is not active at this time of day.`, [`timeOfDay=${environment.timeOfDay}`]);
    }
    if (node.requiredSeason?.length && environment.season && !node.requiredSeason.includes(environment.season)) {
      return fail("wrong_environment", `${node.name} is not active this season.`, [`season=${environment.season}`]);
    }
  }
  const antiBot = input.antiBot;
  if ((antiBot?.recentAttemptsInMinute ?? 0) > 45 || (antiBot?.suspiciousRouteScore ?? 0) > 25) {
    return fail("anti_bot_review", "Gathering is temporarily rate-limited for route review.", [
      `recentAttemptsInMinute=${antiBot?.recentAttemptsInMinute ?? 0}`,
      `suspiciousRouteScore=${antiBot?.suspiciousRouteScore ?? 0}`,
    ]);
  }

  return pass(`Server-authoritative gather validation passed for ${node.name}.`, {
    transactionId,
    reservationExpiresAt: Date.now() + 10_000,
    breaksStealth: Boolean(player.stealth),
  });
}

export function reserveHarthmereResourceNode(input: {
  nodeId: string;
  playerId: string;
  now?: number;
  ttlMs?: number;
  previous?: HarthmereResourceReservation;
}): HarthmereResourceReservation {
  const now = input.now ?? Date.now();
  if (input.previous && input.previous.nodeId === input.nodeId && input.previous.reservedUntil > now && !input.previous.released) {
    return input.previous;
  }
  return {
    nodeId: input.nodeId,
    reservedBy: input.playerId,
    reservedUntil: now + (input.ttlMs ?? 10_000),
  };
}

export function releaseHarthmereResourceReservation(
  reservation: HarthmereResourceReservation,
  releaseReason: NonNullable<HarthmereResourceReservation["releaseReason"]>,
): HarthmereResourceReservation {
  return { ...reservation, released: true, releaseReason, reservedUntil: Date.now() };
}

export function applyHarthmereGatheringToolDurability(tool: HarthmereToolDurabilitySnapshot): HarthmereToolDurabilitySnapshot {
  const loss = Math.max(1, tool.lossPerGather ?? 1);
  return { ...tool, durability: Math.max(0, tool.durability - loss) };
}

export function routeHarthmereGatheredMaterials(input: {
  materials: Record<string, number>;
  nodeDefinition?: { category?: string };
  inventoryCapacity?: HarthmereGatheringInventoryCapacity;
}): HarthmereAuthorityResult<{
  routes: Record<string, "material_storage" | "quest_pouch" | "wallet" | "backpack" | "overflow_recovery">;
}> {
  const routes: Record<string, "material_storage" | "quest_pouch" | "wallet" | "backpack" | "overflow_recovery"> = {};
  const capacity = {
    backpackFreeSlots: 1_000,
    materialStorageFree: 1_000_000,
    questPouchFreeSlots: 1_000,
    walletAcceptsCurrencies: true,
    overflowEnabled: false,
    ...(input.inventoryCapacity ?? {}),
  };
  let materialUnits = 0;
  let questStacks = 0;
  let backpackStacks = 0;
  for (const [itemId, quantity] of Object.entries(input.materials)) {
    const route = materialRouteFor(itemId, input.nodeDefinition?.category);
    if (route === "material_storage") materialUnits += quantity;
    if (route === "quest_pouch") questStacks += 1;
    if (route === "backpack") backpackStacks += 1;
    if (route === "wallet" && !capacity.walletAcceptsCurrencies) {
      if (capacity.overflowEnabled) routes[itemId] = "overflow_recovery";
      else return fail("inventory_full", `${itemId} could not be routed to wallet.`, ["walletAcceptsCurrencies=false"]);
    } else {
      routes[itemId] = route;
    }
  }
  if (materialUnits > capacity.materialStorageFree) {
    if (capacity.overflowEnabled) {
      for (const itemId of Object.keys(input.materials)) if (routes[itemId] === "material_storage") routes[itemId] = "overflow_recovery";
    } else {
      return fail("inventory_full", "Material storage is full. Gathering is blocked before materials are lost.", [`need=${materialUnits}`, `free=${capacity.materialStorageFree}`]);
    }
  }
  if (questStacks > capacity.questPouchFreeSlots) {
    if (capacity.overflowEnabled) {
      for (const itemId of Object.keys(input.materials)) if (routes[itemId] === "quest_pouch") routes[itemId] = "overflow_recovery";
    } else {
      return fail("inventory_full", "Quest pouch is full. Quest gathering is blocked before materials are lost.", [`need=${questStacks}`, `free=${capacity.questPouchFreeSlots}`]);
    }
  }
  if (backpackStacks > capacity.backpackFreeSlots) {
    if (capacity.overflowEnabled) {
      for (const itemId of Object.keys(input.materials)) if (routes[itemId] === "backpack") routes[itemId] = "overflow_recovery";
    } else {
      return fail("inventory_full", "Backpack is full. Gathering is blocked before materials are lost.", [`need=${backpackStacks}`, `free=${capacity.backpackFreeSlots}`]);
    }
  }
  return pass("Gathered materials routed without deletion.", { routes });
}

export function calculateHarthmereResourceTrackingUnlocks(input: {
  profession: string;
  level: number;
  perception?: number;
}) {
  const radius = 12 + Math.floor((input.perception ?? 0) / 2) + Math.floor(input.level / 5);
  const tiers = input.level >= 75 ? [1, 2, 3, 4] : input.level >= 50 ? [1, 2, 3] : input.level >= 25 ? [1, 2] : [1];
  return {
    profession: input.profession,
    minimapRadius: radius,
    showCompassHint: input.level >= 10,
    showWorldShimmer: input.level >= 20,
    showRareOnlyAfterDiscovery: true,
    tiers,
  };
}

export function planHarthmereGatheringContractProgress(input: {
  contractId: string;
  requiredMaterials: Record<string, number>;
  deliveredMaterials: Record<string, number>;
  gatheredMaterials: Record<string, number>;
}) {
  const nextDelivered = { ...input.deliveredMaterials };
  for (const [itemId, quantity] of Object.entries(input.gatheredMaterials)) {
    if (input.requiredMaterials[itemId] !== undefined) {
      nextDelivered[itemId] = Math.min(input.requiredMaterials[itemId], (nextDelivered[itemId] ?? 0) + quantity);
    }
  }
  const complete = Object.entries(input.requiredMaterials).every(([itemId, need]) => (nextDelivered[itemId] ?? 0) >= need);
  return { contractId: input.contractId, deliveredMaterials: nextDelivered, complete };
}

export function planHarthmereRefinement(input: {
  recipeId: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  available: Record<string, number>;
  stationAvailable: boolean;
  fuelAvailable?: boolean;
}) {
  const missing = Object.entries(input.inputs)
    .map(([itemId, need]) => ({ itemId, need, have: input.available[itemId] ?? 0 }))
    .filter((row) => row.have < row.need);
  return {
    ok: missing.length === 0 && input.stationAvailable && input.fuelAvailable !== false,
    recipeId: input.recipeId,
    missing,
    outputs: input.outputs,
    requiresStation: !input.stationAvailable,
    requiresFuel: input.fuelAvailable === false,
  };
}

export function rollHarthmereMaterialQuality(input: {
  skill: number;
  requiredSkill: number;
  toolBonus?: number;
  regionBonus?: number;
}) {
  const score = input.skill - input.requiredSkill + (input.toolBonus ?? 0) + (input.regionBonus ?? 0);
  if (score >= 80) return "mythic" as const;
  if (score >= 55) return "pristine" as const;
  if (score >= 35) return "rare" as const;
  if (score >= 15) return "fine" as const;
  if (score >= -10) return "common" as const;
  return "poor" as const;
}

export interface HarthmereBuildingPlacementProposal {
  position: [number, number, number];
  size: [number, number, number];
  slopeDegrees: number;
  foundationSupport:
    | "ground"
    | "pillars"
    | "platform"
    | "stilts"
    | "dock_supports"
    | "tree_supports"
    | "magical_supports";
  floating?: boolean;
  sinking?: boolean;
  clipsStructure?: boolean;
  entranceAccessible?: boolean;
  pathToEntrance?: boolean;
  overlapsRoad?: boolean;
  overlapsBridge?: boolean;
  overlapsQuestArea?: boolean;
  overlapsNpcRoute?: boolean;
  overlapsResourceNode?: boolean;
  overlapsSpawn?: boolean;
  insideNoBuildZone?: boolean;
  heightLimit?: number;
  headroomClear?: boolean;
  interiorExitClear?: boolean;
  leavesMountCartClearance?: boolean;
}

export interface HarthmereBuildingTransactionInput {
  transactionId: string;
  idempotencyKey: string;
  actorId: string;
  action: string;
  goldRequired?: number;
  goldAvailable?: number;
  materialRequirements?: Record<string, number>;
  materialAvailable?: Record<string, number>;
  hasPermission?: boolean;
}

export function validateHarthmereBuildingPlacement(input: {
  plot?: { id: string; bounds?: { xMin: number; xMax: number; zMin: number; zMax: number }; allowedBlueprints?: string[] };
  blueprint?: { id: string; name?: string; type?: string };
  proposal: HarthmereBuildingPlacementProposal;
}): HarthmereAuthorityResult<{ placementStamp: string }> {
  const { plot, blueprint, proposal } = input;
  if (!plot || !blueprint) return fail("unknown_target", "Unknown plot or blueprint.", ["plot/blueprint missing"]);
  const blockers: string[] = [];
  if (plot.allowedBlueprints && !plot.allowedBlueprints.includes(blueprint.id)) blockers.push("zoning_mismatch");
  if (proposal.slopeDegrees > 12) blockers.push("slope_too_steep");
  if (proposal.floating) blockers.push("building_floating");
  if (proposal.sinking) blockers.push("building_sinking");
  if (proposal.clipsStructure) blockers.push("clips_structure");
  if (proposal.entranceAccessible === false) blockers.push("entrance_blocked");
  if (proposal.pathToEntrance === false) blockers.push("no_path_to_entrance");
  if (proposal.overlapsRoad) blockers.push("overlaps_road");
  if (proposal.overlapsBridge) blockers.push("overlaps_bridge");
  if (proposal.overlapsQuestArea) blockers.push("overlaps_quest_area");
  if (proposal.overlapsNpcRoute) blockers.push("overlaps_npc_route");
  if (proposal.overlapsResourceNode) blockers.push("overlaps_resource_node");
  if (proposal.overlapsSpawn) blockers.push("overlaps_spawn");
  if (proposal.insideNoBuildZone) blockers.push("inside_no_build_zone");
  if (proposal.headroomClear === false) blockers.push("bad_headroom");
  if (proposal.interiorExitClear === false) blockers.push("bad_exit");
  if (proposal.leavesMountCartClearance === false) blockers.push("mount_cart_clearance_blocked");
  if (proposal.heightLimit !== undefined && proposal.size[1] > proposal.heightLimit) blockers.push("height_limit");
  if (plot.bounds) {
    const [x, , z] = proposal.position;
    if (x < plot.bounds.xMin || x > plot.bounds.xMax || z < plot.bounds.zMin || z > plot.bounds.zMax) blockers.push("outside_plot_bounds");
  }
  if (blockers.length) return fail("invalid_placement", "Building placement failed server-side safety validation.", blockers);
  return pass("Building placement is safe, supported, accessible, and within zoning.", { placementStamp: `placement_${plot.id}_${blueprint.id}` });
}

export function validateHarthmereBuildingTransaction(input: HarthmereBuildingTransactionInput): HarthmereAuthorityResult<{
  lockedGold: number;
  lockedMaterials: Record<string, number>;
}> {
  if (!input.hasPermission) return fail("missing_permission", "You do not have permission for this property action.", [input.action]);
  if ((input.goldAvailable ?? 0) < (input.goldRequired ?? 0)) {
    return fail("not_enough_gold", `${input.action} needs ${input.goldRequired ?? 0} gold.`, [`available=${input.goldAvailable ?? 0}`]);
  }
  const missing = Object.entries(input.materialRequirements ?? {})
    .map(([itemId, need]) => ({ itemId, need, have: input.materialAvailable?.[itemId] ?? 0 }))
    .filter((row) => row.have < row.need);
  if (missing.length) {
    return fail("missing_materials", `${input.action} is missing required materials.`, missing.map((row) => `${row.itemId}:${row.have}/${row.need}`));
  }
  return pass("Atomic building transaction preflight passed; gold/materials can be locked together.", {
    lockedGold: input.goldRequired ?? 0,
    lockedMaterials: { ...(input.materialRequirements ?? {}) },
  });
}

export function createHarthmerePropertyDeed(input: {
  propertyId: string;
  plotId: string;
  ownerId: string;
  ownerType?: "player" | "account" | "guild" | "town" | "faction";
  purchasePrice: number;
  taxRate: number;
  permissions?: Record<string, string[]>;
}) {
  return {
    deedId: `deed_${input.propertyId}`,
    propertyId: input.propertyId,
    plotId: input.plotId,
    ownerId: input.ownerId,
    ownerType: input.ownerType ?? "player",
    purchasePrice: input.purchasePrice,
    taxRate: input.taxRate,
    condition: 100,
    upgradeLevel: 1,
    saleStatus: "not_for_sale" as const,
    legalRestrictions: [] as string[],
    permissions: input.permissions ?? {
      owner: ["all"],
      friend: ["enter", "use_crafting", "deposit_storage"],
      guild: ["enter", "use_crafting"],
      public: [],
      blocked: [],
    },
    createdAt: Date.now(),
  };
}

export function createHarthmereLease(input: {
  propertyId: string;
  tenantId: string;
  rentGold: number;
  startsAt?: number;
  durationDays: number;
}) {
  const startsAt = input.startsAt ?? Date.now();
  return {
    leaseId: `lease_${input.propertyId}_${input.tenantId}`,
    propertyId: input.propertyId,
    tenantId: input.tenantId,
    rentGold: input.rentGold,
    startsAt,
    expiresAt: startsAt + input.durationDays * 24 * 60 * 60 * 1000,
    accessPaused: false,
    warningsSent: [] as string[],
    storedItemsRecoveryRequired: false,
  };
}

export function createHarthmerePropertySaleListing(input: {
  propertyId: string;
  sellerId: string;
  askingGold: number;
  taxRate: number;
}) {
  return {
    listingId: `property_sale_${input.propertyId}`,
    propertyId: input.propertyId,
    sellerId: input.sellerId,
    askingGold: input.askingGold,
    taxGold: Math.max(1, Math.round(input.askingGold * input.taxRate)),
    escrowed: true,
    status: "listed" as const,
  };
}

export function validateHarthmerePropertyPermission(input: {
  role: string;
  action: string;
  permissions: Record<string, string[]>;
}) {
  const allowed = input.permissions[input.role] ?? [];
  return allowed.includes("all") || allowed.includes(input.action);
}

export function resolveHarthmereDoorLock(input: {
  doorState:
    | "unlocked"
    | "locked"
    | "owner_only"
    | "guild_only"
    | "friend_only"
    | "public_shop_hours"
    | "closed_after_hours"
    | "broken"
    | "barred"
    | "magically_sealed";
  role: string;
  hasKey?: boolean;
  shopOpen?: boolean;
  legalWarrant?: boolean;
  lockpickingAllowed?: boolean;
}) {
  if (input.doorState === "unlocked" || input.doorState === "broken") return { ok: true, reason: "open" };
  if (input.legalWarrant || input.hasKey) return { ok: true, reason: "authorized_override" };
  if (input.doorState === "owner_only" && input.role === "owner") return { ok: true, reason: "owner" };
  if (input.doorState === "guild_only" && ["owner", "guild_officer", "guild"].includes(input.role)) return { ok: true, reason: "guild" };
  if (input.doorState === "friend_only" && ["owner", "friend"].includes(input.role)) return { ok: true, reason: "friend" };
  if (input.doorState === "public_shop_hours" && input.shopOpen) return { ok: true, reason: "public_shop_hours" };
  if (input.lockpickingAllowed && ["locked", "closed_after_hours"].includes(input.doorState)) return { ok: true, reason: "lockpicking_risk" };
  return { ok: false, reason: "door_locked" as const };
}

export function applyHarthmereBuildingDamage(input: {
  hp: number;
  maxHp: number;
  condition: number;
  armor?: number;
  damage: number;
  damageType: "fire" | "siege" | "explosion" | "earthquake" | "decay" | "monster" | "player" | "weather" | "flood" | "corruption" | "magic" | "war_event";
  safeZone?: boolean;
  siegeAllowed?: boolean;
}) {
  if (input.safeZone && input.damageType === "player" && !input.siegeAllowed) {
    return { hp: input.hp, condition: input.condition, destroyed: false, ignored: true, reason: "safe_zone" };
  }
  const mitigated = Math.max(0, input.damage - (input.armor ?? 0));
  const hp = Math.max(0, input.hp - mitigated);
  const condition = Math.max(0, Math.round((hp / Math.max(1, input.maxHp)) * 100));
  return { hp, condition, destroyed: hp <= 0, ignored: false, reason: input.damageType };
}

export function planHarthmereRepairContribution(input: {
  condition: number;
  targetCondition?: number;
  materialsRequired: Record<string, number>;
  materialsAvailable: Record<string, number>;
  laborRequired: number;
  laborAvailable: number;
  underAttack?: boolean;
  combatRepairAllowed?: boolean;
  recentSiegeHitAt?: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  if (input.underAttack && !input.combatRepairAllowed) {
    return { ok: false, reason: "repair_blocked_under_attack" as const, consume: {}, laborUsed: 0, nextCondition: input.condition };
  }
  if (input.recentSiegeHitAt && now - input.recentSiegeHitAt < 5_000) {
    return { ok: false, reason: "siege_repair_lockout" as const, consume: {}, laborUsed: 0, nextCondition: input.condition };
  }
  const target = input.targetCondition ?? 100;
  const missing = Object.entries(input.materialsRequired)
    .map(([itemId, need]) => ({ itemId, need, have: input.materialsAvailable[itemId] ?? 0 }))
    .filter((row) => row.have < row.need);
  if (missing.length || input.laborAvailable < input.laborRequired) {
    return { ok: false, reason: "missing_materials_or_labor" as const, missing, consume: {}, laborUsed: 0, nextCondition: input.condition };
  }
  const repairDelta = Math.max(1, target - input.condition);
  return {
    ok: true,
    reason: "partial_or_full_repair" as const,
    consume: { ...input.materialsRequired },
    laborUsed: input.laborRequired,
    nextCondition: Math.min(target, input.condition + repairDelta),
  };
}

export function advanceHarthmereUpkeepLifecycle(input: {
  propertyId: string;
  taxesDueAt: number;
  now?: number;
  warningGraceDays?: number;
}) {
  const now = input.now ?? Date.now();
  const grace = (input.warningGraceDays ?? 7) * 24 * 60 * 60 * 1000;
  if (now <= input.taxesDueAt) return { propertyId: input.propertyId, stage: "paid" as const, servicesEnabled: true, reclaimable: false };
  if (now <= input.taxesDueAt + grace) return { propertyId: input.propertyId, stage: "warning" as const, servicesEnabled: true, reclaimable: false };
  if (now <= input.taxesDueAt + grace * 2) return { propertyId: input.propertyId, stage: "services_disabled" as const, servicesEnabled: false, reclaimable: false };
  if (now <= input.taxesDueAt + grace * 4) return { propertyId: input.propertyId, stage: "abandoned" as const, servicesEnabled: false, reclaimable: false };
  return { propertyId: input.propertyId, stage: "reclaimable_with_storage_recovery" as const, servicesEnabled: false, reclaimable: true };
}

export function createHarthmereStorageRecovery(input: {
  propertyId: string;
  ownerId: string;
  itemIds: string[];
  reason: "demolition" | "lease_expired" | "upkeep_reclaimed" | "sale_transfer";
}) {
  return {
    recoveryId: `recovery_${input.propertyId}_${Date.now()}`,
    propertyId: input.propertyId,
    ownerId: input.ownerId,
    itemIds: [...input.itemIds],
    reason: input.reason,
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    deletedItems: [] as string[],
  };
}

export function createHarthmereShopListing(input: {
  propertyId: string;
  sellerId: string;
  itemId: string;
  quantity: number;
  priceGold: number;
  taxRate: number;
}) {
  return {
    listingId: `shop_${input.propertyId}_${input.itemId}_${Date.now()}`,
    propertyId: input.propertyId,
    sellerId: input.sellerId,
    itemId: input.itemId,
    quantity: input.quantity,
    priceGold: input.priceGold,
    taxGold: Math.max(1, Math.round(input.priceGold * input.taxRate)),
    escrowedInShopStorage: true,
    status: "active" as const,
  };
}

export function createHarthmereGuildTownProject(input: {
  projectId: string;
  ownerType: "guild" | "town";
  requiredMaterials: Record<string, number>;
  contributedMaterials: Record<string, number>;
  requiredLabor: number;
  contributedLabor: number;
}) {
  const materialsComplete = Object.entries(input.requiredMaterials).every(([itemId, need]) => (input.contributedMaterials[itemId] ?? 0) >= need);
  const laborComplete = input.contributedLabor >= input.requiredLabor;
  return {
    ...input,
    contributionBased: true,
    materialsComplete,
    laborComplete,
    complete: materialsComplete && laborComplete,
  };
}
