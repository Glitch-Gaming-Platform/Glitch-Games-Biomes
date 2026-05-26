import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAnySubsystemV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";

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
  };
  economy: {
    ledger: Array<{ id: string; kind: string; amount: number; atMs: number }>;
    vendorTransactions: Record<string, number>;
    auctionListings: Record<string, string>;
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
    },
    economy: {
      ledger: [],
      vendorTransactions: {},
      auctionListings: {},
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

  applyItemDeltas(next.inventory.items, payloadRecord(envelope, "itemDeltas"));
  if (payloadRecord(envelope, "itemDeltas")) {
    touchedModels.add("inventory_items");
  }

  switch (envelope.actionKind) {
    case "request_attack": {
      const abilityId = payloadString(envelope, "abilityId") ?? "basic_attack";
      const damage = Math.max(1, Math.min(250, payloadNumber(envelope, "baseDamage") ?? 10));
      next.combat.cooldowns[abilityId] = nowMs + 750;
      if (envelope.targetId) {
        next.combat.threat[envelope.targetId] =
          (next.combat.threat[envelope.targetId] ?? 0) + damage;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("entity_combat", envelope.targetId)
        );
      }
      touchedModels.add("combat_state");
      touchedModels.add("threat");
      break;
    }
    case "request_ability_cast":
    case "request_magic_progress": {
      const abilityId = payloadString(envelope, "abilityId") ?? "unknown_ability";
      const schoolId = payloadString(envelope, "magicSchoolId") ?? "general_magic";
      const xpDelta = Math.max(0, Math.min(1000, payloadNumber(envelope, "skillXpDelta") ?? 1));
      if (!next.classMagic.knownAbilities.includes(abilityId)) {
        next.classMagic.knownAbilities.push(abilityId);
      }
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
      touchedModels.add("known_abilities");
      touchedModels.add("magic_progression");
      touchedModels.add("cooldown");
      break;
    }
    case "request_equipment_change":
    case "request_loadout_change": {
      const slot = payloadString(envelope, "slot") ?? "main_hand";
      const itemId = payloadString(envelope, "itemId");
      if (itemId) {
        next.inventory.equipment[slot] = itemId;
        next.classMagic.loadout[slot] = itemId;
        touchedModels.add("equipment_slots");
        touchedModels.add("loadout");
      } else {
        warnings.push("equipment_request_missing_item_id");
      }
      break;
    }
    case "request_xp_reward":
    case "request_skill_progress": {
      const skillId = payloadString(envelope, "skillId") ?? "general";
      upsertSkill(next.classMagic.skills, skillId, Math.max(0, payloadNumber(envelope, "xpDelta") ?? 1));
      touchedModels.add("skill_xp");
      break;
    }
    case "request_loot_claim":
    case "request_loot_roll":
    case "request_inventory_mutation": {
      const itemId = payloadString(envelope, "itemId");
      const count = Math.max(1, payloadNumber(envelope, "count") ?? 1);
      if (itemId) {
        recordDelta(next.inventory.items, itemId, count);
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("inventory_items");
        touchedModels.add("loot_claims");
      }
      break;
    }
    case "request_vendor_transaction": {
      const vendorId = payloadString(envelope, "vendorId") ?? "unknown_vendor";
      next.economy.vendorTransactions[vendorId] =
        (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
      sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("vendor", vendorId));
      touchedModels.add("vendor_stock");
      touchedModels.add("wallet");
      break;
    }
    case "request_auction_post":
    case "request_auction_settle": {
      const listingId = payloadString(envelope, "listingId") ?? envelope.requestId;
      next.economy.auctionListings[listingId] = envelope.actionKind;
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("auction_listing", listingId)
      );
      touchedModels.add("auction_listing");
      break;
    }
    case "request_bank_transaction": {
      applyItemDeltas(next.inventory.bank, payloadRecord(envelope, "bankItemDeltas"));
      touchedModels.add("bank_storage");
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
    case "request_skill_book_use":
    case "request_respec": {
      const abilityId = payloadString(envelope, "abilityId");
      const recipeId = payloadString(envelope, "recipeId");
      if (abilityId && !next.classMagic.knownAbilities.includes(abilityId)) {
        next.classMagic.knownAbilities.push(abilityId);
      }
      if (recipeId && !next.classMagic.knownRecipes.includes(recipeId)) {
        next.classMagic.knownRecipes.push(recipeId);
      }
      if (envelope.actionKind === "request_respec") {
        next.classMagic.respecCount += 1;
      }
      touchedModels.add("class_magic_progression");
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
      break;
    }
    case "request_crafting": {
      const recipeId = payloadString(envelope, "recipeId") ?? "unknown_recipe";
      if (!next.classMagic.knownRecipes.includes(recipeId)) {
        next.classMagic.knownRecipes.push(recipeId);
      }
      touchedModels.add("crafting");
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
