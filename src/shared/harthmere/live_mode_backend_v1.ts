import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAnySubsystemV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import {
  reduceHarthmereInventoryMutationV1,
  applyHarthmereInventoryMutationResultV1,
  type HarthmereInventorySnapshotV1,
  type HarthmereInventoryMutationRequestV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";
import {
  reduceHarthmereCombatActionV1,
  computeHarthmereXpRewardV1,
  isHarthmerePvPLegalV1,
  type HarthmereCombatActorSnapshotV1,
  type HarthmereCombatTargetSnapshotV1,
  type HarthmereZoneSnapshotV1,
  type HarthmereCombatActionRequestV1,
} from "@/shared/harthmere/mmo_combat_authority_v1";
import {
  reduceHarthmereAuctionMutationV1,
  type HarthmereAuctionListingV1,
  type HarthmereAuctionMutationRequestV1,
} from "@/shared/harthmere/mmo_auction_authority_v1";
import {
  validateHarthmereBuildingPlacementV1,
  validateHarthmerePlotClaimV1,
  type HarthmereBuildingPlacementRequestV1,
} from "@/shared/harthmere/mmo_building_authority_v1";
import {
  buildingSystemBlueprintByIdV1,
  buildingSystemBlueprintByStructureTypeV1,
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1,
  buildingSystemCanActorAccessPropertyV1,
  buildingSystemDefaultOriginV1,
  buildingSystemDemolitionRefundGoldV1,
  buildingSystemPlotByIdV1,
  buildingSystemRemainingMaterialItemDeltasV1,
  buildingSystemRepairCostGoldV1,
  buildingSystemUpgradeCostGoldV1,
  createBuildingSystemDefaultPermissionsV1,
  createBuildingSystemDemolitionMaterializationPlanV1,
  createBuildingSystemDoorLockV1,
  createBuildingSystemMiraMapMarkerV1,
  createBuildingSystemPlacementPreviewV1,
  createBuildingSystemRepairDamageMaterializationPlanV1,
  createBuildingSystemRepairRestoreMaterializationPlanV1,
  createBuildingSystemStorageContainerV1,
  createBuildingSystemUpgradeMaterializationPlanV1,
  createBuildingSystemBusinessRecordV1,
  runBuildingSystemBusinessRevenueCycleV1,
  buildingSystemBusinessTypeByIdV1,
  createBuildingSystemMaterializationPlanV1,
  createBuildingSystemPlacementContextV1,
  createBuildingSystemPropertyRecordV1,
  createBuildingSystemSafeGroundMaterializationPlanV1,
  createBuildingSystemStageMaterializationPlanV1,
  ensureBuildingSystemStructureDefinitionsV1,
  normalizeBuildingSystemPropertyRecordV1,
  applyBuildingSystemPropertyLifecycleV1,
  toHarthmerePlotDefinitionV1,
  type BuildingSystemAccessModeV1,
  type BuildingSystemAnyMaterializationPlanV1,
  type BuildingSystemBusinessRecordV1,
  type BuildingSystemBusinessTypeV1,
  type BuildingSystemDoorLockRecordV1,
  type BuildingSystemInWorldMarkerV1,
  type BuildingSystemStorageContainerRecordV1,
  type BuildingSystemPermissionKeyV1,
  type BuildingSystemPermissionSubjectV1,
  type BuildingSystemProjectRecordV1,
  type BuildingSystemPropertyRecordV1,
  type BuildingSystemStageV1,
} from "@/shared/harthmere/building_system_v1";

export const HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1 =
  "harthmere-live-mode-backend-v1";

export const HARTHMERE_LIVE_MODE_BACKEND_SAFETY_CAP_V195 = 250;

export interface HarthmereLiveModeBackendStateV1 {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1;
  actorId: string;
  updatedAtMs: number;
  inventory: {
    items: Record<string, number>;
    bank: Record<string, number>;
    equipment: Record<string, string>;
    overflow: Array<{ itemId: string; count: number; reason: string }>;
    gold: number;
    /** Items held in auction escrow — cannot be traded, equipped, or double-listed */
    escrow: Record<string, number>;
    /** Consumable shared-cooldown categories → expires-at ms (server clock) */
    consumableCooldowns: Record<string, number>;
  };
  economy: {
    ledger: Array<{ id: string; kind: string; amount: number; atMs: number }>;
    vendorTransactions: Record<string, number>;
    /** listingId → full AH listing record (server-owned, not client summary) */
    auctionListings: Record<string, HarthmereAuctionListingV1>;
    /** Tax collected this session for the economy sink */
    houseTaxAccumulated: number;
    /** Property-hosted businesses that earn recurring revenue from town needs. */
    businesses: Record<string, BuildingSystemBusinessRecordV1>;
    businessRevenueAccumulated: number;
  };
  /** Respec metadata for cooldown/cost enforcement */
  respec: {
    count: number;
    lastRespecAtMs?: number;
  };
  /** Per-talent-tree purchased node ids */
  talents: {
    nodes: string[];
    pointsSpent: number;
  };
  /** Building placement audit records */
  building: {
    placedStructures: Record<
      string,
      {
        structureTypeId: string;
        origin: { x: number; y: number; z: number };
        placedAtMs: number;
        plotId?: string;
        blueprintId?: string;
        use?: string;
        voxelEditCount?: number;
        materializedInEcs?: boolean;
      }
    >;
    ownedPlots: string[];
    safeZones: Record<string, { safeFromMuck: boolean; activatedAtMs: number; area: string }>;
    /** Authoritative active/finished construction projects; local UI state is not truth. */
    activeProjects: Record<string, BuildingSystemProjectRecordV1>;
    /** In-world plot/deed/map/NPC marker records created by server-approved building actions. */
    inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
    materializationPlans: Record<string, BuildingSystemAnyMaterializationPlanV1>;
    storageContainers: Record<string, BuildingSystemStorageContainerRecordV1>;
    doorLocks: Record<string, BuildingSystemDoorLockRecordV1>;
  };
  guild: {
    guildId?: string;
    role?: string;
    treasury: number;
    bank: Record<string, number>;
    projectContributions: Record<string, number>;
  };
  law: {
    reputation: Record<string, number>;
    fines: Record<string, number>;
    flags: Record<string, boolean>;
    crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
  };
  classMagic: {
    classId?: string;
    specializationId?: string;
    knownAbilities: string[];
    knownRecipes: string[];
    skills: Record<string, { xp: number; level: number }>;
    magicSchools: Record<string, { xp: number; level: number; illegal: boolean }>;
    loadout: Record<string, string>;
    faith: Record<string, number>;
    /** @deprecated use top-level `respec.count` — kept for backward compat */
    respecCount: number;
  };
  quests: {
    active: Record<string, { stepId?: string; progress: number }>;
    completed: Record<string, number>;
  };
  property: {
    owned: Record<string, BuildingSystemPropertyRecordV1>;
    buildingProgress: Record<string, number>;
  };
  farming: {
    plots: Record<string, { cropId: string; plantedAtMs: number; state: string }>;
    harvests: Record<string, number>;
  };
  combat: {
    hp: number;
    maxHp: number;
    cooldowns: Record<string, number>;
    deathState?: "alive" | "downed" | "dead";
    threat: Record<string, number>;
    lootClaims: Record<string, number>;
  };
}

export interface HarthmereLiveModeBackendMutationSummaryV1 {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1;
  applied: boolean;
  actionKind: HarthmereLiveModeActionKindV1;
  subsystem: HarthmereLiveModeAnySubsystemV1;
  actorId: string;
  targetId?: string;
  playerStateKey: string;
  sharedStateKeys: string[];
  warnings: string[];
  touchedModels: string[];
  buildingMaterializationPlans?: BuildingSystemAnyMaterializationPlanV1[];
}

function recordDelta(target: Record<string, number>, key: string, delta: number) {
  const safeDelta = clampLiveModeMutationDeltaV195(delta);
  target[key] = Math.max(0, (target[key] ?? 0) + safeDelta);
  if (target[key] === 0) {
    delete target[key];
  }
}

function payloadString(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadNumber(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampLiveModeMutationDeltaV195(delta: number) {
  if (!Number.isFinite(delta)) {
    return 0;
  }
  const wholeDelta = Math.trunc(delta);
  return Math.max(-250, Math.min(250, wholeDelta));
}

function payloadRecord(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function payloadBoolean(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function buildingProjectIdForPlotV1(plotId: string) {
  return `project_${plotId}`;
}

function buildingPropertyIdForPlotV1(plotId: string) {
  return `property_${plotId}`;
}

function isBuildingSystemStageV1(stage: string | undefined): stage is BuildingSystemStageV1 {
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.includes(stage as any);
}

function nextBuildingSystemStageV1(stage: BuildingSystemStageV1): BuildingSystemStageV1 {
  const index = BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.indexOf(stage as any);
  if (index < 0) {
    return "completed";
  }
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1[index + 1] ?? "completed";
}

function normalizeMaterialContributionPayloadV1(
  record: Record<string, unknown> | undefined
): Record<string, number> | undefined {
  if (!record) {
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      out[key] = Math.trunc(numeric);
    }
  }
  return out;
}

function allBuildingMaterialsCompleteV1(
  required: Record<string, number> | undefined,
  contributed: Record<string, number>
) {
  return Object.entries(required ?? {}).every(
    ([material, count]) => (contributed[material] ?? 0) >= count
  );
}

function normalizePermissionSubjectV1(
  subject: string | undefined
): BuildingSystemPermissionSubjectV1 | undefined {
  if (subject === "owner" || subject === "friends_guests" || subject === "guild_members" || subject === "public") {
    return subject;
  }
  return undefined;
}

function normalizePermissionKeyV1(
  permission: string | undefined
): BuildingSystemPermissionKeyV1 | undefined {
  if (permission === "storage_access" || permission === "build_edit" || permission === "demolition" || permission === "transfer_sale") {
    return permission;
  }
  return undefined;
}

function normalizeAccessModeV1(mode: string | undefined): BuildingSystemAccessModeV1 | undefined {
  if (mode === "private" || mode === "friends" || mode === "guild" || mode === "public") {
    return mode;
  }
  return undefined;
}

function getOwnedPropertyForMutationV1(input: {
  properties: Record<string, BuildingSystemPropertyRecordV1>;
  propertyId: string;
  actorId: string;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  const raw = input.properties[input.propertyId];
  if (!raw) {
    input.warnings.push("property_rejected:not_found");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  const lifecycle = applyBuildingSystemPropertyLifecycleV1({ property: raw, nowMs: input.nowMs });
  input.properties[input.propertyId] = lifecycle.property;
  for (const warning of lifecycle.warnings) {
    input.warnings.push(warning);
  }
  if (lifecycle.taxDeltaGold > 0) {
    input.touchedModels.add("property_tax");
  }
  if (lifecycle.repairDecayDelta > 0) {
    input.touchedModels.add("property_repair_decay");
  }
  if (lifecycle.property.ownerId !== input.actorId) {
    input.warnings.push("property_rejected:not_owner");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  if (lifecycle.property.abandoned) {
    input.warnings.push("property_rejected:abandoned");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  return lifecycle.property;
}

function computePropertyTierValueV1(property: BuildingSystemPropertyRecordV1) {
  return Math.max(property.value + 25, Math.floor(property.value * 1.5));
}



function syncBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
  plotId?: string;
  nowMs: number;
}) {
  const plot = buildingSystemPlotByIdV1(input.property.plotId ?? input.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(input.property.blueprintId);
  if (!plot || !blueprint) return;
  const storage = createBuildingSystemStorageContainerV1({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  const door = createBuildingSystemDoorLockV1({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  input.state.building.storageContainers[storage.containerId] = storage;
  input.state.building.doorLocks[door.lockId] = door;
  input.state.building.inWorldMarkers[storage.containerId] = {
    markerId: storage.containerId,
    plotId: plot.plotId,
    kind: "storage_container",
    position: storage.position,
    label: `${input.property.propertyId} storage`,
    createdAtMs: input.nowMs,
  };
  input.state.building.inWorldMarkers[door.lockId] = {
    markerId: door.lockId,
    plotId: plot.plotId,
    kind: "door_lock",
    position: door.position,
    label: `${input.property.propertyId} door lock`,
    createdAtMs: input.nowMs,
  };
}

function removeBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
}) {
  if (input.property.storageContainerId) {
    delete input.state.building.storageContainers[input.property.storageContainerId];
    delete input.state.building.inWorldMarkers[input.property.storageContainerId];
  }
  if (input.property.doorLockId) {
    delete input.state.building.doorLocks[input.property.doorLockId];
    delete input.state.building.inWorldMarkers[input.property.doorLockId];
  }
}

function applyItemDeltas(
  target: Record<string, number>,
  deltas: Record<string, unknown> | undefined
) {
  if (!deltas) {
    return;
  }
  for (const [itemId, rawDelta] of Object.entries(deltas)) {
    if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
      recordDelta(target, itemId, rawDelta);
    }
  }
}

function applyDirectInventoryItemPayloadV148(
  target: Record<string, number>,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  options: { includePrimaryItem: boolean }
) {
  let applied = false;

  if (options.includePrimaryItem) {
    const itemId = payloadString(envelope, "itemId");
    if (itemId) {
      recordDelta(
        target,
        itemId,
        Math.max(1, payloadNumber(envelope, "count") ?? 1)
      );
      applied = true;
    }
  }

  const itemDeltas = payloadRecord(envelope, "itemDeltas");
  if (itemDeltas) {
    for (const rawDelta of Object.values(itemDeltas)) {
      if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
        applied = true;
        break;
      }
    }
    applyItemDeltas(target, itemDeltas);
  }

  return applied;
}

function upsertSkill(
  target: Record<string, { xp: number; level: number }>,
  skillId: string,
  xpDelta: number
) {
  const current = target[skillId] ?? { xp: 0, level: 1 };
  const xp = Math.max(0, current.xp + xpDelta);
  target[skillId] = {
    xp,
    level: Math.max(current.level, 1 + Math.floor(xp / 1000)),
  };
}

export function harthmereLiveModePlayerStateKeyV1(actorId: string) {
  return `harthmere:live_mode:v1:player_state:${actorId}`;
}

export function harthmereLiveModeLedgerStreamKeyV1(actorId: string) {
  return `harthmere:live_mode:v1:ledger:${actorId}`;
}

export function harthmereLiveModeSharedStateKeyV1(
  kind: string,
  id: string
) {
  return `harthmere:live_mode:v1:${kind}:${id}`;
}

export function defaultHarthmereLiveModeBackendStateV1(
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendStateV1 {
  return {
    version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
    actorId,
    updatedAtMs: nowMs,
    inventory: {
      items: {},
      bank: {},
      equipment: {},
      overflow: [],
      gold: 0,
      escrow: {},
      consumableCooldowns: {},
    },
    economy: {
      ledger: [],
      vendorTransactions: {},
      auctionListings: {},
      houseTaxAccumulated: 0,
      businesses: {},
      businessRevenueAccumulated: 0,
    },
    respec: {
      count: 0,
    },
    talents: {
      nodes: [],
      pointsSpent: 0,
    },
    building: {
      placedStructures: {},
      ownedPlots: [],
      safeZones: {},
      activeProjects: {},
      inWorldMarkers: {},
      materializationPlans: {},
      storageContainers: {},
      doorLocks: {},
    },
    guild: {
      treasury: 0,
      bank: {},
      projectContributions: {},
    },
    law: {
      reputation: {},
      fines: {},
      flags: {},
      crimeLog: [],
    },
    classMagic: {
      knownAbilities: [],
      knownRecipes: [],
      skills: {},
      magicSchools: {},
      loadout: {},
      faith: {},
      respecCount: 0,
    },
    quests: {
      active: {
        [BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId]: {
          stepId: BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.stepId,
          progress: 0,
        },
      },
      completed: {},
    },
    property: {
      owned: {},
      buildingProgress: {},
    },
    farming: {
      plots: {},
      harvests: {},
    },
    combat: {
      hp: 100,
      maxHp: 100,
      cooldowns: {},
      deathState: "alive",
      threat: {},
      lootClaims: {},
    },
  };
}

export function parseHarthmereLiveModeBackendStateV1(
  raw: string | null | undefined,
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendStateV1 {
  if (!raw) {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
  try {
    const parsed = JSON.parse(raw) as HarthmereLiveModeBackendStateV1;
    const defaults = defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
    return {
      ...defaults,
      ...parsed,
      actorId,
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      inventory: { ...defaults.inventory, ...(parsed.inventory ?? {}) },
      economy: {
        ...defaults.economy,
        ...(parsed.economy ?? {}),
        businesses: {
          ...defaults.economy.businesses,
          ...((parsed.economy as any)?.businesses ?? {}),
        },
      },
      guild: { ...defaults.guild, ...(parsed.guild ?? {}) },
      law: { ...defaults.law, ...(parsed.law ?? {}) },
      classMagic: { ...defaults.classMagic, ...(parsed.classMagic ?? {}) },
      quests: { ...defaults.quests, ...(parsed.quests ?? {}) },
      property: {
        ...defaults.property,
        ...(parsed.property ?? {}),
        owned: Object.fromEntries(
          Object.entries({
            ...defaults.property.owned,
            ...(((parsed.property as any)?.owned ?? {}) as Record<string, unknown>),
          }).map(([propertyId, raw]) => [
            propertyId,
            normalizeBuildingSystemPropertyRecordV1({
              propertyId,
              raw,
              ownerId: actorId,
              nowMs,
            }),
          ])
        ),
        buildingProgress: {
          ...defaults.property.buildingProgress,
          ...((parsed.property as any)?.buildingProgress ?? {}),
        },
      },
      farming: { ...defaults.farming, ...(parsed.farming ?? {}) },
      combat: { ...defaults.combat, ...(parsed.combat ?? {}) },
      respec: { ...defaults.respec, ...(parsed.respec ?? {}) },
      talents: { ...defaults.talents, ...(parsed.talents ?? {}) },
      building: {
        ...defaults.building,
        ...(parsed.building ?? {}),
        placedStructures: {
          ...defaults.building.placedStructures,
          ...((parsed.building as any)?.placedStructures ?? {}),
        },
        ownedPlots: [
          ...new Set([
            ...defaults.building.ownedPlots,
            ...(((parsed.building as any)?.ownedPlots ?? []) as string[]),
          ]),
        ],
        safeZones: {
          ...defaults.building.safeZones,
          ...((parsed.building as any)?.safeZones ?? {}),
        },
        activeProjects: {
          ...defaults.building.activeProjects,
          ...((parsed.building as any)?.activeProjects ?? {}),
        },
        inWorldMarkers: {
          ...defaults.building.inWorldMarkers,
          ...((parsed.building as any)?.inWorldMarkers ?? {}),
        },
        materializationPlans: {
          ...defaults.building.materializationPlans,
          ...((parsed.building as any)?.materializationPlans ?? {}),
        },
        storageContainers: {
          ...defaults.building.storageContainers,
          ...((parsed.building as any)?.storageContainers ?? {}),
        },
        doorLocks: {
          ...defaults.building.doorLocks,
          ...((parsed.building as any)?.doorLocks ?? {}),
        },
      },
    };
  } catch {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
}

export function createHarthmereLiveModeBuildingClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return {
    actorId: state.actorId,
    gold: state.inventory.gold,
    inventoryItems: state.inventory.items,
    ownedPlotIds: state.building.ownedPlots,
    safeZones: state.building.safeZones,
    activeProjects: state.building.activeProjects,
    placedStructureIds: Object.values(state.building.placedStructures)
      .map((entry) => entry.plotId)
      .filter((plotId): plotId is string => typeof plotId === "string"),
    placedStructures: state.building.placedStructures,
    completedProperties: state.property.owned,
    buildingProgress: state.property.buildingProgress,
    inWorldMarkers: state.building.inWorldMarkers,
    storageContainers: state.building.storageContainers,
    doorLocks: state.building.doorLocks,
    businesses: state.economy.businesses,
  };
}

export function reduceHarthmereLiveModeBackendStateV1(
  state: HarthmereLiveModeBackendStateV1,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  nowMs: number
): {
  state: HarthmereLiveModeBackendStateV1;
  summary: HarthmereLiveModeBackendMutationSummaryV1;
} {
  const next: HarthmereLiveModeBackendStateV1 = JSON.parse(
    JSON.stringify(state)
  );
  next.updatedAtMs = nowMs;
  const touchedModels = new Set<string>();
  const sharedStateKeys = new Set<string>();
  const warnings: string[] = [];
  const buildingMaterializationPlans: BuildingSystemAnyMaterializationPlanV1[] = [];
  const playerStateKey = harthmereLiveModePlayerStateKeyV1(envelope.actorId);

  ensureBuildingSystemStructureDefinitionsV1();

  // ---------------------------------------------------------------------------
  // Inventory snapshot helper — project current state into the authority type
  // ---------------------------------------------------------------------------
  function buildInventorySnapshot(): HarthmereInventorySnapshotV1 {
    return {
      actorId: next.actorId,
      gold: next.inventory.gold,
      equipment: { ...next.inventory.equipment },
      items: { ...next.inventory.items },
      bank: { ...next.inventory.bank },
      escrow: { ...(next.inventory.escrow ?? {}) },
      consumableCooldowns: { ...(next.inventory.consumableCooldowns ?? {}) },
      knownAbilities: [...next.classMagic.knownAbilities],
      knownRecipes: [...next.classMagic.knownRecipes],
    };
  }

  // ---------------------------------------------------------------------------
  // Combat actor snapshot helper
  // ---------------------------------------------------------------------------
  function buildActorSnapshot(): HarthmereCombatActorSnapshotV1 {
    return {
      actorId: next.actorId,
      classId: next.classMagic.classId ?? "warrior",
      specializationId: next.classMagic.specializationId ?? "none",
      level: next.classMagic.skills["character_level"]?.level ?? 1,
      hp: next.combat.hp,
      maxHp: next.combat.maxHp,
      resource: next.combat.hp, // fallback until resource pool is separate
      maxResource: next.combat.maxHp,
      resourceKind: "mana",
      cooldowns: { ...next.combat.cooldowns },
      sharedCooldowns: {},
      knownAbilities: [...next.classMagic.knownAbilities],
      equippedAbilities: Object.values(next.classMagic.loadout).filter(Boolean) as string[],
      activeTalentNodes: [...(next.talents?.nodes ?? [])],
      mainHandWeaponType: "sword",
      offHandWeaponType: "none",
      deathState: next.combat.deathState ?? "alive",
      position: { x: 0, y: 0, z: 0 },
      pvpFlagged: next.law.flags["pvp_flagged"] ?? false,
      legalFlags: { ...next.law.flags },
    };
  }

  // ---------------------------------------------------------------------------
  // Zone snapshot helper — resolves from envelope.zoneId
  // ---------------------------------------------------------------------------
  function buildZoneSnapshot(): HarthmereZoneSnapshotV1 {
    const safeZones = ["harthmere_town_square", "harthmere_temple", "harthmere_market"];
    const isSafe = safeZones.some((z) => envelope.zoneId.includes(z));
    return {
      zoneId: envelope.zoneId,
      pvpRule: isSafe ? "safe_zone" : "contested",
      isSafeZone: isSafe,
      allowPvP: !isSafe,
      activeLegalSystem: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Legacy goldDelta — kept for non-authority mutations only
  // (authority mutations compute their own gold deltas via the authority modules)
  // ---------------------------------------------------------------------------
  const AUTHORITY_ACTION_KINDS = new Set<string>([
    "request_attack",
    "request_ability_cast",
    "request_vendor_transaction",
    "request_auction_post",
    "request_auction_settle",
    "request_bank_transaction",
    "request_crafting",
    "request_inventory_mutation",
    "request_respec",
    "request_loadout_change",
    "request_property_building_mutation",
  ]);

  if (!AUTHORITY_ACTION_KINDS.has(envelope.actionKind)) {
    const goldDelta =
      payloadNumber(envelope, "goldDelta") ??
      payloadNumber(envelope, "currencyDelta") ??
      0;
    if (goldDelta !== 0) {
      next.inventory.gold = Math.max(0, next.inventory.gold + goldDelta);
      next.economy.ledger.push({
        id: envelope.requestId,
        kind: envelope.actionKind,
        amount: goldDelta,
        atMs: nowMs,
      });
      touchedModels.add("wallet");
      touchedModels.add("economy_ledger");
    }
  }

  switch (envelope.actionKind) {
    // -----------------------------------------------------------------------
    // COMBAT — fully server-authoritative via mmo_combat_authority_v1
    // -----------------------------------------------------------------------
    case "request_attack":
    case "request_ability_cast": {
      const abilityId =
        payloadString(envelope, "abilityId") ?? "basic_attack";
      const actor = buildActorSnapshot();
      const zone = buildZoneSnapshot();

      // Build a minimal target snapshot from envelope metadata
      const target: HarthmereCombatTargetSnapshotV1 | undefined =
        envelope.targetId
          ? {
              targetId: envelope.targetId,
              isHostile: true,
              isAlive: true,
              isAttackable: true,
              hp: payloadNumber(envelope, "targetHp") ?? 100,
              maxHp: payloadNumber(envelope, "targetMaxHp") ?? 100,
              position: {
                x: payloadNumber(envelope, "targetX") ?? 0,
                y: payloadNumber(envelope, "targetY") ?? 0,
                z: payloadNumber(envelope, "targetZ") ?? 0,
              },
              pvpFlagged: (envelope.payload.targetPvpFlagged as boolean) ?? false,
              isPlayer: (envelope.payload.targetIsPlayer as boolean) ?? false,
              zonePvPRule: zone.pvpRule,
            }
          : undefined;

      const combatReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "ability_cast",
        actorId: envelope.actorId,
        targetId: envelope.targetId,
        abilityId,
        nowMs,
      };

      const combatResult = reduceHarthmereCombatActionV1(combatReq, {
        actor,
        target,
        zone,
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: Math.max(
          0,
          (next.classMagic.skills["character_level"]?.level ?? 1) -
            1 -
            (next.talents?.pointsSpent ?? 0)
        ),
      });

      if (!combatResult.ok) {
        warnings.push(...combatResult.errors.map((e) => `combat_rejected:${e}`));
        touchedModels.add("combat_rejection");
        break;
      }

      // Apply server-computed cooldowns
      for (const [key, expiresAt] of Object.entries(combatResult.newCooldowns)) {
        next.combat.cooldowns[key] = expiresAt;
      }
      for (const [key, expiresAt] of Object.entries(combatResult.newSharedCooldowns)) {
        next.combat.cooldowns[`shared:${key}`] = expiresAt;
      }

      // Resource cost
      next.combat.hp = Math.max(0, combatResult.actorResourceAfter);

      // Threat
      if (envelope.targetId && combatResult.damage > 0) {
        next.combat.threat[envelope.targetId] =
          (next.combat.threat[envelope.targetId] ?? 0) + combatResult.damage;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("entity_combat", envelope.targetId)
        );
      }

      // XP
      if (combatResult.xpDelta > 0) {
        upsertSkill(next.classMagic.skills, "combat", combatResult.skillXpDelta);
      }

      if (combatResult.killsTarget && envelope.targetId) {
        const xp = computeHarthmereXpRewardV1({
          actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          targetLevel: payloadNumber(envelope, "targetLevel") ?? 1,
          baseXp: combatResult.xpDelta,
          contributionScore: 1,
          antiFarmMultiplier: 1,
          restedXpPool: 0,
        });
        upsertSkill(
          next.classMagic.skills,
          "character_level",
          xp.xpReward
        );
      }

      touchedModels.add("combat_state");
      touchedModels.add("threat");
      touchedModels.add("cooldown");
      break;
    }

    // -----------------------------------------------------------------------
    // MAGIC progress (separate from ability cast — for spell school leveling)
    // -----------------------------------------------------------------------
    case "request_magic_progress": {
      const abilityId = payloadString(envelope, "abilityId") ?? "unknown_ability";
      const schoolId = payloadString(envelope, "magicSchoolId") ?? "general_magic";
      // Validate ability is known before crediting school XP
      if (!next.classMagic.knownAbilities.includes(abilityId)) {
        warnings.push("magic_progress_rejected:ability_not_known");
        touchedModels.add("magic_rejection");
        break;
      }
      const xpDelta = Math.max(0, Math.min(1000, payloadNumber(envelope, "skillXpDelta") ?? 1));
      const school = next.classMagic.magicSchools[schoolId] ?? {
        xp: 0,
        level: 1,
        illegal: false,
      };
      school.xp += xpDelta;
      school.level = Math.max(school.level, 1 + Math.floor(school.xp / 1000));
      school.illegal =
        school.illegal || payloadString(envelope, "legalStatus") === "illegal";
      next.classMagic.magicSchools[schoolId] = school;
      next.combat.cooldowns[abilityId] = nowMs + Math.max(250, payloadNumber(envelope, "cooldownMs") ?? 1000);
      touchedModels.add("magic_progression");
      touchedModels.add("cooldown");
      break;
    }

    // -----------------------------------------------------------------------
    // EQUIPMENT change — authority-validated
    // -----------------------------------------------------------------------
    case "request_equipment_change": {
      const slot = payloadString(envelope, "slot") ?? "main_hand";
      const itemId = payloadString(envelope, "itemId");
      if (itemId) {
        // Ownership check: item must be in inventory (server verifies)
        if (next.inventory.items[itemId] === undefined) {
          warnings.push("equipment_rejected:item_not_in_inventory");
          touchedModels.add("equipment_rejection");
        } else {
          next.inventory.equipment[slot] = itemId;
          next.classMagic.loadout[slot] = itemId;
          touchedModels.add("equipment_slots");
          touchedModels.add("loadout");
        }
      } else {
        warnings.push("equipment_request_missing_item_id");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // LOADOUT change — authority-validated via combat module
    // -----------------------------------------------------------------------
    case "request_loadout_change": {
      const newLoadout = envelope.payload.newLoadout as string[] | undefined;
      if (!Array.isArray(newLoadout)) {
        warnings.push("loadout_rejected:missing_new_loadout_array");
        touchedModels.add("loadout_rejection");
        break;
      }
      const actor = buildActorSnapshot();
      const loadoutReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "loadout_change",
        actorId: envelope.actorId,
        nowMs,
        newLoadout,
      };
      const loadoutResult = reduceHarthmereCombatActionV1(loadoutReq, {
        actor,
        zone: buildZoneSnapshot(),
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: 0,
      });
      if (!loadoutResult.ok) {
        warnings.push(...loadoutResult.errors.map((e) => `loadout_rejected:${e}`));
        touchedModels.add("loadout_rejection");
        break;
      }
      for (const abilityId of loadoutResult.newEquippedAbilities) {
        next.classMagic.loadout[abilityId] = abilityId;
      }
      touchedModels.add("loadout");
      break;
    }

    // -----------------------------------------------------------------------
    // XP / skill progress
    // -----------------------------------------------------------------------
    case "request_xp_reward":
    case "request_skill_progress": {
      const skillId = payloadString(envelope, "skillId") ?? "general";
      upsertSkill(
        next.classMagic.skills,
        skillId,
        Math.max(0, Math.min(1000, payloadNumber(envelope, "xpDelta") ?? 1)),
      );
      touchedModels.add("skill_xp");
      break;
    }

    // -----------------------------------------------------------------------
    // LOOT — server grants items (contribution validated by loot pipeline)
    // -----------------------------------------------------------------------
    case "request_loot_claim":
    case "request_loot_roll":
    case "request_inventory_mutation": {
      const invReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind:
          envelope.actionKind === "request_inventory_mutation"
            ? "admin_grant"
            : "pickup_item",
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: Math.max(1, payloadNumber(envelope, "count") ?? 1),
      };
      const snapshot = buildInventorySnapshot();
      const invResult = reduceHarthmereInventoryMutationV1(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, invResult);
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.inventory.escrow = updated.escrow;
        next.inventory.consumableCooldowns = updated.consumableCooldowns;
        if (
          envelope.actionKind === "request_inventory_mutation" &&
          applyDirectInventoryItemPayloadV148(next.inventory.items, envelope, {
            includePrimaryItem: false,
          })
        ) {
          touchedModels.add("inventory_items");
        }
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("inventory_items");
        touchedModels.add("loot_claims");
      } else if (
        envelope.actionKind === "request_inventory_mutation" &&
        applyDirectInventoryItemPayloadV148(next.inventory.items, envelope, {
          includePrimaryItem: true,
        })
      ) {
        warnings.push(...invResult.errors.map((e) => `inventory_authority_warning:${e}`));
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("inventory_items");
        touchedModels.add("loot_claims");
      } else {
        warnings.push(...invResult.errors.map((e) => `loot_rejected:${e}`));
        touchedModels.add("loot_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // VENDOR — fully authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_vendor_transaction": {
      const vendorId = payloadString(envelope, "vendorId") ?? "unknown_vendor";
      const transactionKind = payloadString(envelope, "transactionKind") ?? "buy";
      const vendorItemId = payloadString(envelope, "itemId");

      if (!vendorItemId) {
        const vendorGoldDelta =
          payloadNumber(envelope, "goldDelta") ??
          payloadNumber(envelope, "currencyDelta") ??
          0;
        if (vendorGoldDelta < 0) {
          next.inventory.gold = Math.max(0, next.inventory.gold + vendorGoldDelta);
          next.economy.ledger.push({
            id: envelope.requestId,
            kind: `vendor_${transactionKind}`,
            amount: vendorGoldDelta,
            atMs: nowMs,
          });
          touchedModels.add("wallet");
          touchedModels.add("economy_ledger");
        }
        next.economy.vendorTransactions[vendorId] =
          (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("vendor", vendorId));
        touchedModels.add("vendor_stock");
        warnings.push("vendor_transaction_recorded_without_item_id");
        break;
      }

      const snapshot = buildInventorySnapshot();
      const invReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: transactionKind === "sell" ? "sell_to_vendor" : "buy_from_vendor",
        nowMs,
        itemId: vendorItemId,
        count: Math.max(1, payloadNumber(envelope, "count") ?? 1),
        vendorId,
      };
      const invResult = reduceHarthmereInventoryMutationV1(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, invResult);
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `vendor_${transactionKind}`,
          amount: invResult.goldDelta,
          atMs: nowMs,
        });
        next.economy.vendorTransactions[vendorId] =
          (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("vendor", vendorId));
        touchedModels.add("vendor_stock");
        touchedModels.add("wallet");
        touchedModels.add("inventory_items");
      } else {
        warnings.push(...invResult.errors.map((e) => `vendor_rejected:${e}`));
        touchedModels.add("vendor_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION POST — fully authority-validated with escrow
    // -----------------------------------------------------------------------
    case "request_auction_post": {
      const snapshot = buildInventorySnapshot();
      const auctionReq: HarthmereAuctionMutationRequestV1 = {
        requestId: envelope.requestId,
        kind: "post_listing",
        actorId: envelope.actorId,
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: Math.max(1, payloadNumber(envelope, "count") ?? 1),
        suggestedUnitPrice: payloadNumber(envelope, "unitPrice") ?? undefined,
      };
      const auctionResult = reduceHarthmereAuctionMutationV1(auctionReq, {
        actorSnapshot: snapshot,
      });
      if (auctionResult.ok && auctionResult.listing) {
        // Apply escrow and fee
        const listingId = auctionResult.listing.listingId;
        next.economy.auctionListings[listingId] = auctionResult.listing;
        next.inventory.escrow = { ...next.inventory.escrow };
        const itemId = auctionResult.listing.itemId;
        next.inventory.escrow[itemId] =
          (next.inventory.escrow[itemId] ?? 0) + auctionResult.sellerEscrowDelta;
        if (next.inventory.escrow[itemId] <= 0) {
          delete next.inventory.escrow[itemId];
        }
        next.inventory.gold = Math.max(0, next.inventory.gold + auctionResult.sellerGoldDelta);
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "auction_listing_fee",
          amount: auctionResult.sellerGoldDelta,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("auction_listing", listingId)
        );
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_escrow");
        touchedModels.add("wallet");
      } else {
        warnings.push(...auctionResult.errors.map((e) => `auction_post_rejected:${e}`));
        touchedModels.add("auction_post_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION SETTLE (buy) — fully authority-validated, atomic transfer
    // -----------------------------------------------------------------------
    case "request_auction_settle": {
      const listingId = payloadString(envelope, "listingId") ?? envelope.requestId;
      const currentListing = next.economy.auctionListings[listingId] as HarthmereAuctionListingV1 | undefined;
      const buyerSnapshot = buildInventorySnapshot();
      const auctionReq: HarthmereAuctionMutationRequestV1 = {
        requestId: envelope.requestId,
        kind: "buy_listing",
        actorId: envelope.actorId,
        nowMs,
        listingId,
      };
      const auctionResult = reduceHarthmereAuctionMutationV1(auctionReq, {
        actorSnapshot: buyerSnapshot,
        buyerSnapshot,
        currentListing,
        buyerInventorySlots: Object.keys(buyerSnapshot.items).length,
      });
      if (auctionResult.ok && auctionResult.listing) {
        next.economy.auctionListings[listingId] = auctionResult.listing;
        // Buyer receives item
        const itemId = auctionResult.listing.itemId;
        const itemCount = auctionResult.listing.count;
        recordDelta(next.inventory.items, itemId, auctionResult.buyerItemDelta);
        next.inventory.gold = Math.max(0, next.inventory.gold + auctionResult.buyerGoldDelta);
        // House tax accumulates
        next.economy.houseTaxAccumulated =
          (next.economy.houseTaxAccumulated ?? 0) + auctionResult.houseTaxGoldDelta;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "auction_sale",
          amount: auctionResult.buyerGoldDelta,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("auction_listing", listingId)
        );
        // Seller's escrow release is a shared-state write (handled via event)
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("seller_account", auctionResult.listing.sellerId)
        );
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_items");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        touchedModels.add("house_tax");
        void itemCount; // referenced for completeness
      } else {
        warnings.push(...auctionResult.errors.map((e) => `auction_settle_rejected:${e}`));
        touchedModels.add("auction_settle_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // BANK — authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_bank_transaction": {
      const snapshot = buildInventorySnapshot();
      const isDeposit = payloadString(envelope, "direction") !== "withdraw";
      const bankReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: isDeposit ? "transfer_to_bank" : "withdraw_from_bank",
        nowMs,
        bankItemId: payloadString(envelope, "itemId"),
        bankCount: Math.max(1, payloadNumber(envelope, "count") ?? 1),
      };
      const bankResult = reduceHarthmereInventoryMutationV1(bankReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (bankResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, bankResult);
        next.inventory.items = updated.items;
        next.inventory.bank = updated.bank;
        touchedModels.add("bank_storage");
        touchedModels.add("inventory_items");
      } else {
        warnings.push(...bankResult.errors.map((e) => `bank_rejected:${e}`));
        touchedModels.add("bank_rejection");
      }
      break;
    }
    case "request_mail_transaction": {
      const mailId = payloadString(envelope, "mailId") ?? envelope.requestId;
      sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
      touchedModels.add("mail");
      break;
    }
    case "request_guild_mutation": {
      const guildId = payloadString(envelope, "guildId") ?? next.guild.guildId;
      if (guildId) {
        next.guild.guildId = guildId;
        next.guild.role = payloadString(envelope, "role") ?? next.guild.role;
        next.guild.treasury = Math.max(
          0,
          next.guild.treasury + (payloadNumber(envelope, "treasuryDelta") ?? 0)
        );
        const projectId = payloadString(envelope, "projectId");
        if (projectId) {
          recordDelta(
            next.guild.projectContributions,
            projectId,
            payloadNumber(envelope, "projectContribution") ?? 1
          );
        }
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("guild", guildId));
        touchedModels.add("guild_state");
      }
      break;
    }
    case "request_law_reputation_mutation":
    case "request_pvp_flag_change":
    case "request_pvp_reward": {
      const factionId = payloadString(envelope, "factionId") ?? envelope.zoneId;
      next.law.reputation[factionId] =
        (next.law.reputation[factionId] ?? 0) +
        (payloadNumber(envelope, "reputationDelta") ?? 0);
      const fineDelta = payloadNumber(envelope, "fineDelta") ?? 0;
      if (fineDelta !== 0) {
        recordDelta(next.law.fines, factionId, fineDelta);
      }
      const crimeKind = payloadString(envelope, "crimeKind");
      if (crimeKind) {
        next.law.flags[crimeKind] = true;
        next.law.crimeLog.push({
          id: envelope.requestId,
          kind: crimeKind,
          atMs: nowMs,
          zoneId: envelope.zoneId,
        });
      }
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("zone_law", envelope.zoneId)
      );
      touchedModels.add("law_reputation");
      break;
    }
    case "request_trainer_unlock":
    case "request_skill_book_use": {
      // Trainer unlock / skill book: server validates access before granting
      const abilityId = payloadString(envelope, "abilityId");
      const recipeId = payloadString(envelope, "recipeId");
      if (abilityId && !next.classMagic.knownAbilities.includes(abilityId)) {
        next.classMagic.knownAbilities.push(abilityId);
        touchedModels.add("known_abilities");
      }
      if (recipeId && !next.classMagic.knownRecipes.includes(recipeId)) {
        next.classMagic.knownRecipes.push(recipeId);
        touchedModels.add("known_recipes");
      }
      touchedModels.add("class_magic_progression");
      break;
    }
    case "request_respec": {
      const actor = buildActorSnapshot();
      const respecReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "respec",
        actorId: envelope.actorId,
        nowMs,
        respecType: (payloadString(envelope, "respecType") as "full" | "partial" | undefined) ?? "full",
      };
      const respecResult = reduceHarthmereCombatActionV1(respecReq, {
        actor,
        zone: buildZoneSnapshot(),
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: 0,
      });
      if (respecResult.ok) {
        next.inventory.gold = Math.max(0, next.inventory.gold - respecResult.goldCost);
        next.respec = {
          count: (next.respec?.count ?? 0) + 1,
          lastRespecAtMs: nowMs,
        };
        // Clear all talent nodes on full respec
        if ((payloadString(envelope, "respecType") ?? "full") === "full") {
          next.talents = { nodes: [], pointsSpent: 0 };
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "respec_fee",
          amount: -respecResult.goldCost,
          atMs: nowMs,
        });
        touchedModels.add("class_magic_progression");
        touchedModels.add("talents");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
      } else {
        warnings.push(...respecResult.errors.map((e) => `respec_rejected:${e}`));
        touchedModels.add("respec_rejection");
      }
      break;
    }
    case "request_quest_state_update": {
      const questId = payloadString(envelope, "questId");
      if (questId) {
        const completed = envelope.payload.completed === true;
        if (completed) {
          next.quests.completed[questId] = nowMs;
          delete next.quests.active[questId];
        } else {
          next.quests.active[questId] = {
            stepId: payloadString(envelope, "stepId"),
            progress: Math.max(0, payloadNumber(envelope, "progress") ?? 1),
          };
        }
        touchedModels.add("quest_state");
      }
      break;
    }
    case "request_property_building_mutation": {
      const subAction = payloadString(envelope, "buildingAction") ?? "read_state";
      const requestedPlotId =
        payloadString(envelope, "plotId") ?? payloadString(envelope, "propertyId");
      const plot = buildingSystemPlotByIdV1(requestedPlotId);

      if (subAction === "read_state") {
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("building_state", envelope.actorId));
        touchedModels.add("building_state");
        break;
      }

      if (subAction === "talk_to_steward" || subAction === "complete_mira_intro") {
        next.quests.completed[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId] = nowMs;
        delete next.quests.active[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId];
        next.building.inWorldMarkers["mira_grove_land_steward_board_marker"] = {
          markerId: "mira_grove_land_steward_board_marker",
          plotId: "the_grove",
          kind: "npc_board",
          position: [501, 53, -132],
          label: "Mira Thatch · Building System",
          createdAtMs: nowMs,
        };
        const miraMapMarker = createBuildingSystemMiraMapMarkerV1(nowMs);
        next.building.inWorldMarkers[miraMapMarker.markerId] = miraMapMarker;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("quest", BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId));
        touchedModels.add("quest_state");
        touchedModels.add("building_steward_intro");
        break;
      }

      if (subAction === "claim_plot") {
        if (!plot) {
          warnings.push("plot_claim_rejected:plot_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        if (next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("plot_claim_rejected:plot_already_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        const claimPlot = toHarthmerePlotDefinitionV1(
          plot,
          "",
          true
        );
        const claim = validateHarthmerePlotClaimV1(
          {
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            plotId: plot.plotId,
            nowMs,
          },
          {
            plot: claimPlot,
            claimPriceGold: plot.claimPriceGold,
            actorGold: next.inventory.gold,
            actorOwnedPlotCount: next.building.ownedPlots.length,
            maxPlotsPerActor: 5,
          }
        );
        if (!claim.ok) {
          warnings.push(...claim.errors.map((e) => `plot_claim_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - claim.goldCost);
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          next.building.ownedPlots.push(plot.plotId);
        }
        const claimMiraMapMarker = createBuildingSystemMiraMapMarkerV1(nowMs);
        next.building.inWorldMarkers[claimMiraMapMarker.markerId] = claimMiraMapMarker;
        touchedModels.add("mira_map_marker");
        if (plot.safeAfterPurchase) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: nowMs,
            area: plot.area,
          };
          const safePlan = createBuildingSystemSafeGroundMaterializationPlanV1({
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            plot,
            activatedAtMs: nowMs,
          });
          for (const marker of safePlan.inWorldMarkers ?? []) {
            next.building.inWorldMarkers[marker.markerId] = marker;
          }
          next.building.materializationPlans[`${envelope.requestId}:safe_ground`] = safePlan;
          buildingMaterializationPlans.push(safePlan);
          touchedModels.add("muck_safe_zone");
          touchedModels.add("plot_boundary_markers");
          touchedModels.add("deed_marker");
          touchedModels.add("map_marker");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "plot_claim",
          amount: -claim.goldCost,
          atMs: nowMs,
        });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("owned_plots");
        touchedModels.add("economy_ledger");
        break;
      }

      const blueprintId = payloadString(envelope, "blueprintId");
      const structureTypeId = payloadString(envelope, "structureTypeId");
      const blueprint =
        buildingSystemBlueprintByIdV1(blueprintId) ??
        buildingSystemBlueprintByStructureTypeV1(structureTypeId, plot?.plotType);
      const propertyId =
        payloadString(envelope, "propertyId") ??
        (plot ? buildingPropertyIdForPlotV1(plot.plotId) : envelope.requestId);

      if (subAction === "start_construction") {
        if (!plot || !blueprint) {
          warnings.push("building_project_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("building_project_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.allowedBlueprintIds.includes(blueprint.blueprintId)) {
          warnings.push("building_project_rejected:blueprint_not_allowed_on_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const projectId = payloadString(envelope, "projectId") ?? buildingProjectIdForPlotV1(plot.plotId);
        const existingProject = next.building.activeProjects[projectId];
        if (existingProject && existingProject.status !== "cancelled") {
          warnings.push("building_project_rejected:project_already_exists_for_plot");
          touchedModels.add("building_rejection");
          break;
        }
        if (next.property.owned[propertyId]) {
          warnings.push("building_project_rejected:property_already_completed_for_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const origin = {
          x: payloadNumber(envelope, "originX") ?? buildingSystemDefaultOriginV1(plot, blueprint).x,
          y: payloadNumber(envelope, "originY") ?? buildingSystemDefaultOriginV1(plot, blueprint).y,
          z: payloadNumber(envelope, "originZ") ?? buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as 0 | 90 | 180 | 270;
        const placementReq: HarthmereBuildingPlacementRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContextV1({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          currentCoveredAreaVoxels: Object.values(next.building.placedStructures)
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(...placementResult.errors.map((e) => `building_project_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push("building_project_rejected:insufficient_gold_for_blueprint");
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - blueprint.goldCost);
        next.building.activeProjects[projectId] = {
          projectId,
          actorId: envelope.actorId,
          plotId: plot.plotId,
          blueprintId: blueprint.blueprintId,
          origin,
          rotationDegrees: rotation,
          currentStage: "site_preparation",
          completedStages: [],
          stageProgress: {},
          startedAtMs: nowMs,
          updatedAtMs: nowMs,
          status: "active",
          materializedStageRequestIds: [],
          storageUnlocked: false,
        };
        next.property.buildingProgress[propertyId] = 0;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `building_project_started_${blueprint.use}`,
          amount: -blueprint.goldCost,
          atMs: nowMs,
        });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("building_project");
        touchedModels.add("construction_stage_state");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "contribute_stage") {
        if (!plot) {
          warnings.push("building_stage_rejected:plot_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const projectId = payloadString(envelope, "projectId") ?? buildingProjectIdForPlotV1(plot.plotId);
        const project = next.building.activeProjects[projectId];
        if (!project || project.status !== "active") {
          warnings.push("building_stage_rejected:active_project_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const projectBlueprint = buildingSystemBlueprintByIdV1(project.blueprintId);
        if (!projectBlueprint) {
          warnings.push("building_stage_rejected:blueprint_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const requestedStage = payloadString(envelope, "stage") ?? project.currentStage;
        if (!isBuildingSystemStageV1(requestedStage)) {
          warnings.push("building_stage_rejected:invalid_stage");
          touchedModels.add("building_rejection");
          break;
        }
        if (project.completedStages.includes(requestedStage)) {
          warnings.push("building_stage_rejected:duplicate_stage_contribution");
          touchedModels.add("building_rejection");
          break;
        }
        if (requestedStage !== project.currentStage) {
          warnings.push("building_stage_rejected:stage_out_of_order");
          touchedModels.add("building_rejection");
          break;
        }

        const currentProgress = project.stageProgress[requestedStage] ?? {
          materials: {},
          labor: 0,
        };
        const requestedMaterials = normalizeMaterialContributionPayloadV1(
          payloadRecord(envelope, "materials")
        );
        const materialRequest = buildingSystemRemainingMaterialItemDeltasV1({
          blueprint: projectBlueprint,
          stage: requestedStage,
          contributed: currentProgress.materials,
          requestedMaterials,
          contributeAll: payloadBoolean(envelope, "contributeAll") === true || !requestedMaterials,
        });
        const missingSubmittedMaterials = materialRequest.lines.some((line) => line.remaining > 0) &&
          Object.keys(materialRequest.symbolicContributions).length === 0;
        if (missingSubmittedMaterials) {
          warnings.push("building_stage_rejected:missing_material_submission");
          touchedModels.add("building_rejection");
          break;
        }
        for (const [itemId, delta] of Object.entries(materialRequest.itemDeltas)) {
          const needed = Math.abs(delta);
          if ((next.inventory.items[itemId] ?? 0) < needed) {
            warnings.push(`building_stage_rejected:insufficient_material:${itemId}`);
            touchedModels.add("building_rejection");
            break;
          }
        }
        if (touchedModels.has("building_rejection")) {
          break;
        }

        for (const [itemId, delta] of Object.entries(materialRequest.itemDeltas)) {
          recordDelta(next.inventory.items, itemId, delta);
        }
        const nextMaterials = { ...currentProgress.materials };
        for (const [material, count] of Object.entries(materialRequest.symbolicContributions)) {
          nextMaterials[material] = (nextMaterials[material] ?? 0) + count;
        }
        const laborRequired = projectBlueprint.laborStages[requestedStage] ?? 0;
        const laborRemaining = Math.max(0, laborRequired - (currentProgress.labor ?? 0));
        const requestedLabor = Math.max(
          0,
          Math.trunc(payloadNumber(envelope, "laborDelta") ?? laborRemaining)
        );
        const nextLabor = Math.min(laborRequired, (currentProgress.labor ?? 0) + requestedLabor);
        const updatedProgress = {
          materials: nextMaterials,
          labor: nextLabor,
        };
        project.stageProgress[requestedStage] = updatedProgress;
        project.updatedAtMs = nowMs;

        const materialsComplete = allBuildingMaterialsCompleteV1(
          projectBlueprint.materialStages[requestedStage],
          nextMaterials
        );
        const laborComplete = nextLabor >= laborRequired;
        const stageComplete = materialsComplete && laborComplete;
        if (stageComplete) {
          project.stageProgress[requestedStage] = {
            ...updatedProgress,
            completedAtMs: nowMs,
          };
          project.completedStages.push(requestedStage);
          project.currentStage = nextBuildingSystemStageV1(requestedStage);
          const stagePlan = createBuildingSystemStageMaterializationPlanV1({
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            projectId: project.projectId,
            plot,
            blueprint: projectBlueprint,
            stage: requestedStage,
            origin: project.origin,
            rotationDegrees: project.rotationDegrees,
            activatedAtMs: nowMs,
          });
          project.materializedStageRequestIds.push(envelope.requestId);
          next.building.materializationPlans[`${envelope.requestId}:${requestedStage}`] = stagePlan;
          buildingMaterializationPlans.push(stagePlan);
          touchedModels.add("terrain_materialization");

          if (project.currentStage === "completed") {
            project.status = "completed";
            project.storageUnlocked = true;
            const completedProperty = createBuildingSystemPropertyRecordV1({
              propertyId,
              ownerId: envelope.actorId,
              plot,
              blueprint: projectBlueprint,
              nowMs,
              guildId: next.guild.guildId,
              value: Math.max(projectBlueprint.goldCost, payloadNumber(envelope, "propertyValue") ?? projectBlueprint.goldCost),
            });
            next.property.owned[propertyId] = completedProperty;
            syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property: completedProperty, plotId: plot.plotId, nowMs });
            next.property.buildingProgress[propertyId] = 100;
            next.building.placedStructures[project.projectId] = {
              structureTypeId: projectBlueprint.structureTypeId,
              origin: project.origin,
              placedAtMs: nowMs,
              plotId: plot.plotId,
              blueprintId: projectBlueprint.blueprintId,
              use: projectBlueprint.use,
              voxelEditCount: project.completedStages.length,
              materializedInEcs: true,
            };
            touchedModels.add("property_building");
            touchedModels.add("placed_structures");
            touchedModels.add("storage_unlocked");
          } else {
            next.property.buildingProgress[propertyId] = Math.floor(
              (project.completedStages.length / BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.length) * 100
            );
          }
        }

        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("inventory_items");
        touchedModels.add("building_project");
        touchedModels.add("construction_stage_state");
        break;
      }

      if (subAction === "place") {
        if (!plot || !blueprint) {
          warnings.push("building_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("building_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.allowedBlueprintIds.includes(blueprint.blueprintId)) {
          warnings.push("building_rejected:blueprint_not_allowed_on_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const origin = {
          x: payloadNumber(envelope, "originX") ?? buildingSystemDefaultOriginV1(plot, blueprint).x,
          y: payloadNumber(envelope, "originY") ?? buildingSystemDefaultOriginV1(plot, blueprint).y,
          z: payloadNumber(envelope, "originZ") ?? buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as 0 | 90 | 180 | 270;
        const placementReq: HarthmereBuildingPlacementRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContextV1({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          currentCoveredAreaVoxels: Object.values(next.building.placedStructures)
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(...placementResult.errors.map((e) => `building_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push("building_rejected:insufficient_gold_for_blueprint");
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - blueprint.goldCost);
        const plan = createBuildingSystemMaterializationPlanV1({
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          rotationDegrees: rotation,
          includeSafeGround: plot.safeAfterPurchase && !next.building.safeZones[plot.plotId]?.safeFromMuck,
          activatedAtMs: nowMs,
        });
        next.building.placedStructures[envelope.requestId] = {
          structureTypeId: blueprint.structureTypeId,
          origin,
          placedAtMs: nowMs,
          plotId: plot.plotId,
          blueprintId: blueprint.blueprintId,
          use: blueprint.use,
          voxelEditCount: plan.edits.length,
          materializedInEcs: true,
        };
        next.building.materializationPlans[envelope.requestId] = plan;
        if (plan.safeZone) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: plan.safeZone.activatedAtMs,
            area: plan.safeZone.area,
          };
        }
        const placedProperty = createBuildingSystemPropertyRecordV1({
          propertyId,
          ownerId: envelope.actorId,
          plot,
          blueprint,
          nowMs,
          guildId: next.guild.guildId,
          value: Math.max(blueprint.goldCost, payloadNumber(envelope, "propertyValue") ?? blueprint.goldCost),
        });
        next.property.owned[propertyId] = placedProperty;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property: placedProperty, plotId: plot.plotId, nowMs });
        next.property.buildingProgress[propertyId] = 100;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `building_${blueprint.use}`,
          amount: -blueprint.goldCost,
          atMs: nowMs,
        });
        buildingMaterializationPlans.push(plan);
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("property_building");
        touchedModels.add("placed_structures");
        touchedModels.add("terrain_materialization");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "manage_property" || subAction === "assess_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (property) {
          const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
          const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
          if (propertyPlot && propertyBlueprint && property.condition <= 80 && !property.visualDamageApplied) {
            const damagePlan = createBuildingSystemRepairDamageMaterializationPlanV1({
              requestId: `${envelope.requestId}:visible_damage`,
              actorId: envelope.actorId,
              property,
              plot: propertyPlot,
              blueprint: propertyBlueprint,
              activatedAtMs: nowMs,
            });
            property.visualDamageApplied = true;
            next.property.owned[propertyId] = property;
            next.building.materializationPlans[damagePlan.requestId] = damagePlan;
            buildingMaterializationPlans.push(damagePlan);
            touchedModels.add("property_visible_decay");
            touchedModels.add("terrain_materialization");
          }
          syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
          sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
          touchedModels.add("property_building");
          touchedModels.add("property_lifecycle");
        }
        break;
      }

      if (subAction === "set_access_mode") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const accessMode = normalizeAccessModeV1(payloadString(envelope, "accessMode"));
        if (!property) break;
        if (!accessMode) {
          warnings.push("property_access_rejected:invalid_access_mode");
          touchedModels.add("property_rejection");
          break;
        }
        property.accessMode = accessMode;
        property.permissions = createBuildingSystemDefaultPermissionsV1(accessMode);
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "set_permission") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const subject = normalizePermissionSubjectV1(payloadString(envelope, "subject"));
        const permission = normalizePermissionKeyV1(payloadString(envelope, "permission"));
        if (!property) break;
        if (!subject || !permission || subject === "owner") {
          warnings.push("property_permission_rejected:invalid_subject_or_permission");
          touchedModels.add("property_rejection");
          break;
        }
        property.permissions[subject][permission] = payloadBoolean(envelope, "enabled") === true;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "add_guest" || subAction === "remove_guest") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const guestActorId = payloadString(envelope, "guestActorId");
        if (!property) break;
        if (!guestActorId) {
          warnings.push("property_guest_rejected:missing_guest_actor_id");
          touchedModels.add("property_rejection");
          break;
        }
        if (subAction === "add_guest" && !property.guestActorIds.includes(guestActorId)) {
          property.guestActorIds.push(guestActorId);
        }
        if (subAction === "remove_guest") {
          property.guestActorIds = property.guestActorIds.filter((id) => id !== guestActorId);
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "pay_property_tax") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const payment = Math.min(property.taxBalanceGold, Math.max(0, Math.trunc(payloadNumber(envelope, "gold") ?? property.taxBalanceGold)));
        if (payment <= 0) {
          warnings.push("property_tax_rejected:no_tax_due");
          touchedModels.add("property_rejection");
          break;
        }
        if (next.inventory.gold < payment) {
          warnings.push("property_tax_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= payment;
        property.taxBalanceGold = Math.max(0, property.taxBalanceGold - payment);
        if (property.taxBalanceGold === 0) {
          property.unpaidTaxSinceMs = undefined;
        }
        property.updatedAtMs = nowMs;
        next.economy.houseTaxAccumulated += payment;
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_tax_paid", amount: -payment, atMs: nowMs });
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_tax");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "repair_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const cost = buildingSystemRepairCostGoldV1(property);
        if (cost <= 0) {
          warnings.push("property_repair_rejected:no_damage");
          touchedModels.add("property_rejection");
          break;
        }
        if (next.inventory.gold < cost) {
          warnings.push("property_repair_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= cost;
        property.condition = 100;
        property.repairDebtGold = 0;
        property.lastRepairDecayAtMs = nowMs;
        property.visualDamageApplied = false;
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const repairPlan = createBuildingSystemRepairRestoreMaterializationPlanV1({
            requestId: `${envelope.requestId}:repair_restore`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[repairPlan.requestId] = repairPlan;
          buildingMaterializationPlans.push(repairPlan);
          touchedModels.add("property_visible_repair");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_repaired", amount: -cost, atMs: nowMs });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_repair");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "upgrade_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "build_edit", guildId: next.guild.guildId })) {
          warnings.push("property_upgrade_rejected:missing_build_edit_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (property.tier >= 2) {
          warnings.push("property_upgrade_rejected:max_tier_reached");
          touchedModels.add("property_rejection");
          break;
        }
        const cost = buildingSystemUpgradeCostGoldV1(property);
        if (next.inventory.gold < cost) {
          warnings.push("property_upgrade_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= cost;
        property.tier += 1;
        property.upgradedVoxelTier = Math.max(property.upgradedVoxelTier, property.tier);
        property.value = computePropertyTierValueV1(property);
        property.storageSlots += Math.max(4, Math.floor(property.storageSlots * 0.5));
        property.condition = Math.min(100, property.condition + 10);
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const upgradePlan = createBuildingSystemUpgradeMaterializationPlanV1({
            requestId: `${envelope.requestId}:upgrade_tier_${property.tier}`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[upgradePlan.requestId] = upgradePlan;
          buildingMaterializationPlans.push(upgradePlan);
          touchedModels.add("property_visible_upgrade");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_upgraded_tier_2", amount: -cost, atMs: nowMs });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_upgrade");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "set_storage_item_count") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        property.storageItemCount = Math.max(0, Math.trunc(payloadNumber(envelope, "storageItemCount") ?? property.storageItemCount));
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_storage_container");
        touchedModels.add("property_storage");
        break;
      }

      if (subAction === "demolish_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "demolition", guildId: next.guild.guildId })) {
          warnings.push("property_demolition_rejected:missing_demolition_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (property.storageItemCount > 0) {
          warnings.push("property_demolition_rejected:storage_not_empty");
          touchedModels.add("property_rejection");
          break;
        }
        const refund = payloadBoolean(envelope, "refund") === false ? 0 : buildingSystemDemolitionRefundGoldV1(property);
        next.inventory.gold += refund;
        property.status = "demolished";
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const demolitionPlan = createBuildingSystemDemolitionMaterializationPlanV1({
            requestId: `${envelope.requestId}:demolition_cleanup`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[demolitionPlan.requestId] = demolitionPlan;
          buildingMaterializationPlans.push(demolitionPlan);
          for (const markerId of Object.keys(next.building.inWorldMarkers)) {
            const marker = next.building.inWorldMarkers[markerId];
            if (marker.plotId === property.plotId && (marker.kind === "deed_sign" || marker.kind === "map_marker" || marker.kind === "storage_container" || marker.kind === "door_lock" || marker.kind === "business_marker")) {
              delete next.building.inWorldMarkers[markerId];
            }
          }
          touchedModels.add("demolition_voxel_cleanup");
          touchedModels.add("terrain_materialization");
        }
        removeBuildingSystemPhysicalAccessRecordsV1({ state: next, property });
        if (property.businessId) {
          delete next.economy.businesses[property.businessId];
        }
        delete next.property.owned[propertyId];
        if (plot) {
          next.building.ownedPlots = next.building.ownedPlots.filter((id) => id !== plot.plotId);
          delete next.building.placedStructures[buildingProjectIdForPlotV1(plot.plotId)];
          delete next.building.activeProjects[buildingProjectIdForPlotV1(plot.plotId)];
        }
        next.property.buildingProgress[propertyId] = 0;
        next.economy.ledger.push({ id: envelope.requestId, kind: refund > 0 ? "property_demolished_refund" : "property_demolished_no_refund", amount: refund, atMs: nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_demolition");
        touchedModels.add("owned_plots");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "abandon_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        property.status = "abandoned";
        property.abandoned = true;
        property.abandonedAtMs = nowMs;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_abandonment");
        break;
      }

      if (subAction === "list_property_for_sale" || subAction === "transfer_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "transfer_sale", guildId: next.guild.guildId })) {
          warnings.push("property_transfer_rejected:missing_transfer_sale_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (subAction === "list_property_for_sale") {
          property.listedForSale = true;
          property.salePriceGold = Math.max(1, Math.trunc(payloadNumber(envelope, "salePriceGold") ?? property.value));
          property.status = "for_sale";
        } else {
          const newOwnerId = payloadString(envelope, "newOwnerId");
          if (!newOwnerId) {
            warnings.push("property_transfer_rejected:missing_new_owner");
            touchedModels.add("property_rejection");
            break;
          }
          property.ownerId = newOwnerId;
          property.listedForSale = false;
          property.salePriceGold = undefined;
          if (property.businessId && next.economy.businesses[property.businessId]) {
            next.economy.businesses[property.businessId].ownerId = newOwnerId;
            next.economy.businesses[property.businessId].updatedAtMs = nowMs;
          }
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_transfer_sale");
        break;
      }


      if (subAction === "preview_blueprint") {
        if (!plot || !blueprint) {
          warnings.push("building_preview_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        const preview = createBuildingSystemPlacementPreviewV1({
          plot,
          blueprint,
          owned: next.building.ownedPlots.includes(plot.plotId),
        });
        next.building.inWorldMarkers[`${plot.plotId}:preview`] = {
          markerId: `${plot.plotId}:preview`,
          plotId: plot.plotId,
          kind: "map_marker",
          position: [preview.origin.x, preview.origin.y, preview.origin.z],
          label: preview.valid ? `${blueprint.displayName} ghost preview valid` : `${blueprint.displayName} ghost preview blocked`,
          createdAtMs: nowMs,
        };
        touchedModels.add("blueprint_ghost_preview");
        touchedModels.add(preview.valid ? "blueprint_preview_valid" : "blueprint_preview_blocked");
        break;
      }

      if (subAction === "open_door" || subAction === "use_storage") {
        const property = next.property.owned[propertyId];
        if (!property) {
          warnings.push("property_access_rejected:not_found");
          touchedModels.add("property_rejection");
          break;
        }
        const actorId = payloadString(envelope, "actorId") ?? envelope.actorId;
        const allowed = subAction === "use_storage"
          ? buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "storage_access", guildId: next.guild.guildId })
          : (property.accessMode === "public" || buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "storage_access", guildId: next.guild.guildId }) || buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "build_edit", guildId: next.guild.guildId }));
        if (!allowed) {
          warnings.push(`${subAction}_rejected:physical_lock_denied`);
          touchedModels.add("physical_access_rejection");
          break;
        }
        touchedModels.add(subAction === "use_storage" ? "physical_storage_access" : "physical_door_access");
        break;
      }

      if (subAction === "start_business") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (property.use !== "business") {
          warnings.push("business_rejected:property_not_business_use");
          touchedModels.add("business_rejection");
          break;
        }
        const businessType = payloadString(envelope, "businessType") as BuildingSystemBusinessTypeV1 | undefined;
        const businessDefinition = buildingSystemBusinessTypeByIdV1(businessType);
        if (!businessDefinition || !businessType) {
          warnings.push("business_rejected:unknown_business_type");
          touchedModels.add("business_rejection");
          break;
        }
        if (next.inventory.gold < businessDefinition.startingCostGold) {
          warnings.push("business_rejected:insufficient_startup_gold");
          touchedModels.add("business_rejection");
          break;
        }
        const businessId = property.businessId ?? `business_${property.propertyId}`;
        if (next.economy.businesses[businessId]) {
          warnings.push("business_rejected:already_started");
          touchedModels.add("business_rejection");
          break;
        }
        next.inventory.gold -= businessDefinition.startingCostGold;
        const business = createBuildingSystemBusinessRecordV1({
          businessId,
          ownerId: envelope.actorId,
          propertyId,
          businessType,
          nowMs,
        });
        next.economy.businesses[businessId] = business;
        property.businessId = businessId;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        next.building.inWorldMarkers[`${businessId}:marker`] = {
          markerId: `${businessId}:marker`,
          plotId: property.plotId,
          kind: "business_marker",
          position: [buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).x, buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).y + 2, buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).z],
          label: businessDefinition.displayName,
          createdAtMs: nowMs,
        };
        next.economy.ledger.push({ id: envelope.requestId, kind: `business_started_${businessType}`, amount: -businessDefinition.startingCostGold, atMs: nowMs });
        touchedModels.add("business_started");
        touchedModels.add("business_marker");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "run_business_cycle" || subAction === "collect_business_revenue") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const businessId = payloadString(envelope, "businessId") ?? property.businessId;
        const business = businessId ? next.economy.businesses[businessId] : undefined;
        if (!business) {
          warnings.push("business_rejected:not_found");
          touchedModels.add("business_rejection");
          break;
        }
        if (subAction === "run_business_cycle") {
          const result = runBuildingSystemBusinessRevenueCycleV1({
            business,
            nowMs,
            cycles: Math.max(1, Math.trunc(payloadNumber(envelope, "cycles") ?? 1)),
          });
          next.economy.businesses[business.businessId] = result.business;
          next.economy.businessRevenueAccumulated += result.net;
          next.economy.ledger.push({ id: envelope.requestId, kind: `business_revenue_${business.type}`, amount: result.net, atMs: nowMs });
          touchedModels.add("business_revenue_cycle");
          touchedModels.add("economy_ledger");
        } else {
          const collection = Math.max(0, Math.trunc(business.revenueBalanceGold));
          if (collection <= 0) {
            warnings.push("business_collect_rejected:no_revenue");
            touchedModels.add("business_rejection");
            break;
          }
          business.revenueBalanceGold = 0;
          business.updatedAtMs = nowMs;
          next.economy.businesses[business.businessId] = business;
          next.inventory.gold += collection;
          next.economy.ledger.push({ id: envelope.requestId, kind: `business_revenue_collected_${business.type}`, amount: collection, atMs: nowMs });
          touchedModels.add("business_revenue_collected");
          touchedModels.add("wallet");
          touchedModels.add("economy_ledger");
        }
        break;
      }

      // Generic property mutation (non-placement), retained for older callers but now normalized.
      const fallbackPlot = plot ?? buildingSystemPlotByIdV1(requestedPlotId);
      const fallbackBlueprint = blueprint ?? buildingSystemBlueprintByIdV1(blueprintId);
      if (fallbackPlot && fallbackBlueprint) {
        next.property.owned[propertyId] = createBuildingSystemPropertyRecordV1({
          propertyId,
          ownerId: envelope.actorId,
          plot: fallbackPlot,
          blueprint: fallbackBlueprint,
          nowMs,
          guildId: next.guild.guildId,
          value: Math.max(0, payloadNumber(envelope, "propertyValue") ?? fallbackBlueprint.goldCost),
        });
      } else {
        warnings.push("property_rejected:missing_real_plot_or_blueprint");
        touchedModels.add("property_rejection");
        break;
      }
      recordDelta(
        next.property.buildingProgress,
        propertyId,
        payloadNumber(envelope, "buildingProgressDelta") ?? 0
      );
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("property", propertyId)
      );
      touchedModels.add("property_building");
      break;
    }
    case "request_crafting": {
      const recipeId = payloadString(envelope, "recipeId");
      if (!recipeId) {
        warnings.push("crafting_rejected:missing_recipe_id");
        touchedModels.add("crafting_rejection");
        break;
      }
      const snapshot = buildInventorySnapshot();
      const craftReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: "craft_item",
        nowMs,
        recipeId,
      };
      const craftResult = reduceHarthmereInventoryMutationV1(craftReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (craftResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, craftResult);
        next.inventory.items = updated.items;
        if (craftResult.xpDelta > 0) {
          upsertSkill(next.classMagic.skills, "crafting", craftResult.xpDelta);
        }
        touchedModels.add("crafting");
        touchedModels.add("inventory_items");
      } else {
        warnings.push(...craftResult.errors.map((e) => `crafting_rejected:${e}`));
        touchedModels.add("crafting_rejection");
      }
      break;
    }
    case "request_farming_action": {
      const plotId = payloadString(envelope, "plotId") ?? envelope.requestId;
      const cropId = payloadString(envelope, "cropId") ?? "unknown_crop";
      next.farming.plots[plotId] = {
        cropId,
        plantedAtMs: nowMs,
        state: payloadString(envelope, "farmingState") ?? "planted",
      };
      touchedModels.add("farming");
      break;
    }
    case "request_death_transition":
      next.combat.deathState = "dead";
      next.combat.hp = 0;
      touchedModels.add("death_record");
      break;
    case "request_revive":
      next.combat.deathState = "alive";
      next.combat.hp = Math.max(1, Math.floor(next.combat.maxHp * 0.25));
      touchedModels.add("revive_state");
      break;
    case "request_respawn":
      next.combat.deathState = "alive";
      next.combat.hp = next.combat.maxHp;
      touchedModels.add("respawn_state");
      break;
    case "request_npc_ai_tick":
    case "request_boss_tick":
    case "request_party_raid_credit":
      touchedModels.add(envelope.subsystem);
      break;
  }

  return {
    state: next,
    summary: {
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      applied: true,
      actionKind: envelope.actionKind,
      subsystem: envelope.subsystem,
      actorId: envelope.actorId,
      targetId: envelope.targetId,
      playerStateKey,
      sharedStateKeys: [...sharedStateKeys],
      warnings,
      touchedModels: [...touchedModels],
      buildingMaterializationPlans: buildingMaterializationPlans.length
        ? buildingMaterializationPlans
        : undefined,
    },
  };
}
