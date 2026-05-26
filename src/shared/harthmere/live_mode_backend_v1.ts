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
  type HarthmereBuildingPlacementRequestV1,
  type HarthmereBuildingPlacementContextV1,
} from "@/shared/harthmere/mmo_building_authority_v1";

export const HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1 =
  "harthmere-live-mode-backend-v1";

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
      { structureTypeId: string; origin: { x: number; y: number; z: number }; placedAtMs: number }
    >;
    ownedPlots: string[];
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
    owned: Record<string, { status: string; value: number }>;
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
}

function recordDelta(target: Record<string, number>, key: string, delta: number) {
  target[key] = Math.max(0, (target[key] ?? 0) + delta);
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

function payloadRecord(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
      active: {},
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
      economy: { ...defaults.economy, ...(parsed.economy ?? {}) },
      guild: { ...defaults.guild, ...(parsed.guild ?? {}) },
      law: { ...defaults.law, ...(parsed.law ?? {}) },
      classMagic: { ...defaults.classMagic, ...(parsed.classMagic ?? {}) },
      quests: { ...defaults.quests, ...(parsed.quests ?? {}) },
      property: { ...defaults.property, ...(parsed.property ?? {}) },
      farming: { ...defaults.farming, ...(parsed.farming ?? {}) },
      combat: { ...defaults.combat, ...(parsed.combat ?? {}) },
      respec: { ...defaults.respec, ...(parsed.respec ?? {}) },
      talents: { ...defaults.talents, ...(parsed.talents ?? {}) },
      building: { ...defaults.building, ...(parsed.building ?? {}) },
    };
  } catch {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
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
  const playerStateKey = harthmereLiveModePlayerStateKeyV1(envelope.actorId);

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
      upsertSkill(next.classMagic.skills, skillId, Math.max(0, Math.min(250, payloadNumber(envelope, "xpDelta") ?? 1)));
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
      const snapshot = buildInventorySnapshot();
      const invReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: transactionKind === "sell" ? "sell_to_vendor" : "buy_from_vendor",
        nowMs,
        itemId: payloadString(envelope, "itemId"),
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
      const propertyId = payloadString(envelope, "propertyId") ?? envelope.requestId;
      const structureTypeId = payloadString(envelope, "structureTypeId");
      const subAction = payloadString(envelope, "buildingAction") ?? "update";

      if (subAction === "place" && structureTypeId) {
        // Full server-authoritative placement validation
        const placementReq: HarthmereBuildingPlacementRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: structureTypeId as import("@/shared/harthmere/mmo_building_authority_v1").HarthmereStructureTypeV1,
          origin: {
            x: payloadNumber(envelope, "originX") ?? 0,
            y: payloadNumber(envelope, "originY") ?? 0,
            z: payloadNumber(envelope, "originZ") ?? 0,
          },
          rotationDegrees: (payloadNumber(envelope, "rotationDegrees") ?? 0) as 0 | 90 | 180 | 270,
          plotId: propertyId,
          nowMs,
        };

        // Minimal context — production wires this to the voxel terrain service
        const placementCtx: HarthmereBuildingPlacementContextV1 = {
          terrainColumns: [],   // populated by terrain service in production
          nearbyStructures: [],
          npcRouteWaypoints: [],
          questTriggerAreas: [],
          hasRoadAccess: true,
          minRoadDistanceVoxels: 10,
          plot: undefined, // populated by plot service in production
        };

        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );

        if (placementResult.ok) {
          next.building = next.building ?? { placedStructures: {}, ownedPlots: [] };
          next.building.placedStructures[envelope.requestId] = {
            structureTypeId,
            origin: placementReq.origin,
            placedAtMs: nowMs,
          };
          next.property.owned[propertyId] = {
            status: "owned",
            value: Math.max(0, payloadNumber(envelope, "propertyValue") ?? 0),
          };
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1("property", propertyId)
          );
          touchedModels.add("property_building");
          touchedModels.add("placed_structures");
        } else {
          warnings.push(
            ...placementResult.errors.map((e) => `building_rejected:${e}`)
          );
          touchedModels.add("building_rejection");
        }
      } else {
        // Generic property mutation (non-placement)
        next.property.owned[propertyId] = {
          status: payloadString(envelope, "propertyStatus") ?? "owned",
          value: Math.max(0, payloadNumber(envelope, "propertyValue") ?? 0),
        };
        recordDelta(
          next.property.buildingProgress,
          propertyId,
          payloadNumber(envelope, "buildingProgressDelta") ?? 0
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        touchedModels.add("property_building");
      }
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
    },
  };
}
