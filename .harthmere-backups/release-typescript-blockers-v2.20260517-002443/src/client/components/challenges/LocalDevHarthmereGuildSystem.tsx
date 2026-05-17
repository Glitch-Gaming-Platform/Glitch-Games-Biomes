import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  readHarthmereInventoryState,
  writeHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  readHarthmereEconomyState,
  recordHarthmereEconomicEvent,
  writeHarthmereEconomyState,
} from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import {
  awardHarthmereXp,
  getHarthmereLevelSummary,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_GUILD_STATE_KEY = "biomes.localDev.harthmere.guildState.v1";
const HARTHMERE_GUILD_EVENT = "biomes:harthmere-guild-changed";

type GuildType =
  | "casual"
  | "pve"
  | "raid"
  | "pvp"
  | "crafting"
  | "trading"
  | "gathering"
  | "building"
  | "mercenary"
  | "outlaw";

type GuildRankName =
  | "Guild Leader"
  | "Co-Leader"
  | "Officer"
  | "Raid Leader"
  | "Veteran"
  | "Member"
  | "Recruit"
  | "Trial Member";

type GuildProjectStatus = "available" | "in_progress" | "completed";
type GuildEventType =
  | "raid"
  | "dungeon"
  | "pvp"
  | "gathering"
  | "crafting"
  | "town_project"
  | "meeting";
type GuildDiplomacyState =
  | "neutral"
  | "friendly"
  | "allied"
  | "rival"
  | "at_war"
  | "truce"
  | "trade_partner";

type GuildLogKind =
  | "creation"
  | "roster"
  | "bank"
  | "treasury"
  | "project"
  | "event"
  | "rank"
  | "war"
  | "hall"
  | "recruitment"
  | "warning";

interface GuildPermissions {
  inviteMembers: boolean;
  kickMembers: boolean;
  promoteMembers: boolean;
  editMessage: boolean;
  createEvents: boolean;
  withdrawBankItemsPerDay: number;
  withdrawGoldPerDay: number;
  spendTreasury: boolean;
  startProjects: boolean;
  manageGuildHall: boolean;
  declareWar: boolean;
  manageAlliances: boolean;
  disbandGuild: boolean;
}

interface GuildRankDefinition {
  name: GuildRankName;
  order: number;
  permissions: GuildPermissions;
}

interface GuildMemberRecord {
  playerId: string;
  name: string;
  rank: GuildRankName;
  level: number;
  role: string;
  professions: string[];
  joinedAt: number;
  lastOnline: number;
  contributionLifetime: number;
  contributionWeekly: number;
  note?: string;
}

interface GuildBankTab {
  id: string;
  name: string;
  description: string;
  materials: Record<string, number>;
  items: Record<string, number>;
  gold: number;
  lockedToRankOrder: number;
}

interface GuildProjectDefinition {
  id: string;
  name: string;
  type: "hall" | "crafting" | "raid" | "pvp" | "town" | "economy";
  description: string;
  requiredGold: number;
  requiredMaterials: Record<string, number>;
  rewards: string[];
  guildXp: number;
  townEffect?: Partial<{
    wealth: number;
    security: number;
    foodSupply: number;
    oreSupply: number;
    medicineSupply: number;
    crimeRate: number;
  }>;
}

interface GuildProjectState {
  id: string;
  status: GuildProjectStatus;
  contributedGold: number;
  contributedMaterials: Record<string, number>;
  startedAt?: number;
  completedAt?: number;
}

interface GuildCalendarEvent {
  id: string;
  title: string;
  type: GuildEventType;
  startAt: number;
  location: string;
  requiredRoles: Record<string, number>;
  notes: string;
  signups: Array<{
    playerName: string;
    role: string;
    status: "accepted" | "tentative" | "declined";
  }>;
}

interface GuildHallState {
  owned: boolean;
  tier: number;
  condition: number;
  services: string[];
  permissions: "members" | "friends" | "public" | "officers";
  workers: string[];
}

interface GuildLogEntry {
  id: string;
  at: number;
  kind: GuildLogKind;
  label: string;
  detail: string;
  goldDelta?: number;
}

interface GuildRecord {
  id: string;
  name: string;
  tag: string;
  type: GuildType;
  faction: string;
  leaderId: string;
  level: number;
  xp: number;
  description: string;
  messageOfTheDay: string;
  recruitmentOpen: boolean;
  maxMembers: number;
  createdAt: number;
  treasuryGold: number;
  taxRate: number;
  reputation: Record<string, number>;
  members: GuildMemberRecord[];
  ranks: GuildRankDefinition[];
  bankTabs: GuildBankTab[];
  projects: Record<string, GuildProjectState>;
  events: GuildCalendarEvent[];
  achievements: string[];
  hall: GuildHallState;
  diplomacy: Record<string, GuildDiplomacyState>;
  recent: GuildLogEntry[];
}

interface GuildApplication {
  id: string;
  playerName: string;
  role: string;
  message: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
}

interface HarthmereGuildState {
  version: 1;
  currentGuildId?: string;
  guilds: Record<string, GuildRecord>;
  applications: GuildApplication[];
  recent: GuildLogEntry[];
}

const MATERIAL_LABELS: Record<string, string> = {
  softwood_log: "Softwood Log",
  rough_stone: "Rough Stone",
  iron_ore: "Iron Ore",
  river_clay: "River Clay",
  scrap_metal: "Scrap Metal",
  cloth_scrap: "Cloth Scrap",
  peacebloom: "Peacebloom",
  mana_essence: "Mana Essence",
  rough_garnet: "Rough Garnet",
  river_trout: "River Trout",
  clean_water: "Clean Water",
  oak_branch: "Oak Branch",
  tree_resin: "Tree Resin",
};

const GUILD_PROJECT_DEFINITIONS: GuildProjectDefinition[] = [
  {
    id: "guild_hall_charter_room",
    name: "Found the Guild Hall Charter Room",
    type: "hall",
    description:
      "Establishes a Harthmere guild room with a notice board, ledger desk, basic guild bank access, and a safe meeting table.",
    requiredGold: 80,
    requiredMaterials: {
      softwood_log: 30,
      rough_stone: 20,
      iron_ore: 12,
      river_clay: 10,
      cloth_scrap: 8,
    },
    rewards: [
      "Guild Hall Tier 1",
      "Guild Bank Tab: Projects",
      "Guild Meeting Service",
    ],
    guildXp: 450,
    townEffect: { wealth: 2, security: 1 },
  },
  {
    id: "guild_forge_cooperative",
    name: "Build the Cooperative Guild Forge",
    type: "crafting",
    description:
      "Adds a shared forge station for guild repair work, crafting orders, and town construction contracts.",
    requiredGold: 110,
    requiredMaterials: {
      rough_stone: 28,
      iron_ore: 24,
      scrap_metal: 18,
      softwood_log: 12,
      tree_resin: 6,
    },
    rewards: [
      "Guild Forge Service",
      "Repair Fund Access",
      "Crafting Contract Board",
    ],
    guildXp: 600,
    townEffect: { wealth: 2, oreSupply: 2 },
  },
  {
    id: "guild_supply_drive",
    name: "Stock a Guild Supply Drive",
    type: "town",
    description:
      "Creates a pooled supply drive for Harthmere medicine, food, and bridge repairs. This is a safe way for gatherers to help the guild matter.",
    requiredGold: 40,
    requiredMaterials: {
      peacebloom: 20,
      river_trout: 12,
      clean_water: 12,
      softwood_log: 12,
      rough_stone: 10,
    },
    rewards: [
      "Town Project Contribution",
      "Guild Favor in Harthmere",
      "Member Contribution Credit",
    ],
    guildXp: 350,
    townEffect: { wealth: 1, foodSupply: 3, medicineSupply: 3, crimeRate: -1 },
  },
  {
    id: "guild_watch_pact",
    name: "Sign the Watch Patrol Pact",
    type: "pvp",
    description:
      "Registers the guild as a lawful patrol group for caravan defense, bounty work, and future guild war systems.",
    requiredGold: 75,
    requiredMaterials: {
      iron_ore: 16,
      cloth_scrap: 10,
      rough_stone: 8,
    },
    rewards: [
      "Guild Contract: Caravan Defense",
      "PvP War Tools Placeholder",
      "Watch Reputation",
    ],
    guildXp: 400,
    townEffect: { security: 4, crimeRate: -2 },
  },
];

const RECRUIT_POOL: Array<
  Pick<GuildMemberRecord, "name" | "role" | "professions" | "level" | "note">
> = [
  {
    name: "Renn Ashwick",
    role: "Healer",
    professions: ["Herbalism", "Alchemy"],
    level: 3,
    note: "Keeps salves stocked before patrols.",
  },
  {
    name: "Mira Coalhand",
    role: "Crafter",
    professions: ["Mining", "Blacksmithing"],
    level: 4,
    note: "Wants access to a shared forge.",
  },
  {
    name: "Tovin's Cousin Pell",
    role: "Scout",
    professions: ["Fishing", "Scavenging"],
    level: 2,
    note: "Knows the dock routes and market gossip.",
  },
  {
    name: "Brother Caldus",
    role: "Support",
    professions: ["Medicine", "Cooking"],
    level: 3,
    note: "Prefers public repair projects over raids.",
  },
];

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function guildEvent() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(HARTHMERE_GUILD_EVENT));
}

function makeLog(
  kind: GuildLogKind,
  label: string,
  detail: string,
  goldDelta?: number
): GuildLogEntry {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    at: Date.now(),
    kind,
    label,
    detail,
    goldDelta,
  };
}

function defaultRanks(): GuildRankDefinition[] {
  return [
    {
      name: "Guild Leader",
      order: 0,
      permissions: {
        inviteMembers: true,
        kickMembers: true,
        promoteMembers: true,
        editMessage: true,
        createEvents: true,
        withdrawBankItemsPerDay: 999,
        withdrawGoldPerDay: 9999,
        spendTreasury: true,
        startProjects: true,
        manageGuildHall: true,
        declareWar: true,
        manageAlliances: true,
        disbandGuild: true,
      },
    },
    {
      name: "Co-Leader",
      order: 1,
      permissions: {
        inviteMembers: true,
        kickMembers: true,
        promoteMembers: true,
        editMessage: true,
        createEvents: true,
        withdrawBankItemsPerDay: 40,
        withdrawGoldPerDay: 300,
        spendTreasury: true,
        startProjects: true,
        manageGuildHall: true,
        declareWar: true,
        manageAlliances: true,
        disbandGuild: false,
      },
    },
    {
      name: "Officer",
      order: 2,
      permissions: {
        inviteMembers: true,
        kickMembers: true,
        promoteMembers: true,
        editMessage: true,
        createEvents: true,
        withdrawBankItemsPerDay: 20,
        withdrawGoldPerDay: 120,
        spendTreasury: false,
        startProjects: true,
        manageGuildHall: true,
        declareWar: false,
        manageAlliances: true,
        disbandGuild: false,
      },
    },
    {
      name: "Raid Leader",
      order: 3,
      permissions: {
        inviteMembers: true,
        kickMembers: false,
        promoteMembers: false,
        editMessage: false,
        createEvents: true,
        withdrawBankItemsPerDay: 10,
        withdrawGoldPerDay: 75,
        spendTreasury: false,
        startProjects: false,
        manageGuildHall: false,
        declareWar: false,
        manageAlliances: false,
        disbandGuild: false,
      },
    },
    {
      name: "Veteran",
      order: 4,
      permissions: {
        inviteMembers: true,
        kickMembers: false,
        promoteMembers: false,
        editMessage: false,
        createEvents: true,
        withdrawBankItemsPerDay: 8,
        withdrawGoldPerDay: 35,
        spendTreasury: false,
        startProjects: false,
        manageGuildHall: false,
        declareWar: false,
        manageAlliances: false,
        disbandGuild: false,
      },
    },
    {
      name: "Member",
      order: 5,
      permissions: {
        inviteMembers: false,
        kickMembers: false,
        promoteMembers: false,
        editMessage: false,
        createEvents: false,
        withdrawBankItemsPerDay: 3,
        withdrawGoldPerDay: 10,
        spendTreasury: false,
        startProjects: false,
        manageGuildHall: false,
        declareWar: false,
        manageAlliances: false,
        disbandGuild: false,
      },
    },
    {
      name: "Recruit",
      order: 6,
      permissions: {
        inviteMembers: false,
        kickMembers: false,
        promoteMembers: false,
        editMessage: false,
        createEvents: false,
        withdrawBankItemsPerDay: 0,
        withdrawGoldPerDay: 0,
        spendTreasury: false,
        startProjects: false,
        manageGuildHall: false,
        declareWar: false,
        manageAlliances: false,
        disbandGuild: false,
      },
    },
    {
      name: "Trial Member",
      order: 7,
      permissions: {
        inviteMembers: false,
        kickMembers: false,
        promoteMembers: false,
        editMessage: false,
        createEvents: false,
        withdrawBankItemsPerDay: 0,
        withdrawGoldPerDay: 0,
        spendTreasury: false,
        startProjects: false,
        manageGuildHall: false,
        declareWar: false,
        manageAlliances: false,
        disbandGuild: false,
      },
    },
  ];
}

function defaultState(): HarthmereGuildState {
  return {
    version: 1,
    guilds: {},
    applications: [],
    recent: [],
  };
}

function normalizeGuild(guild: Partial<GuildRecord>): GuildRecord {
  const ranks = guild.ranks?.length ? guild.ranks : defaultRanks();
  return {
    id: guild.id ?? "guild_iron_lanterns",
    name: guild.name ?? "Iron Lanterns",
    tag: guild.tag ?? "IRON",
    type: guild.type ?? "casual",
    faction: guild.faction ?? "Harthmere Alliance",
    leaderId: guild.leaderId ?? "local_player",
    level: Math.max(1, guild.level ?? 1),
    xp: Math.max(0, guild.xp ?? 0),
    description:
      guild.description ??
      "A local-dev guild for testing cooperation, crafting, town projects, raids, and guild property.",
    messageOfTheDay:
      guild.messageOfTheDay ??
      "Help stock the guild hall project. Bring ore, stone, food, and medicine to the Market Board.",
    recruitmentOpen: guild.recruitmentOpen ?? true,
    maxMembers: guild.maxMembers ?? 250,
    createdAt: guild.createdAt ?? Date.now(),
    treasuryGold: Math.max(0, guild.treasuryGold ?? 0),
    taxRate: Math.max(0, Math.min(10, guild.taxRate ?? 0)),
    reputation: {
      harthmere: guild.reputation?.harthmere ?? 0,
      merchant_guild: guild.reputation?.merchant_guild ?? 0,
      thieves_guild: guild.reputation?.thieves_guild ?? -50,
    },
    members: (guild.members ?? []).slice(0, guild.maxMembers ?? 250),
    ranks,
    bankTabs: guild.bankTabs?.length
      ? guild.bankTabs
      : [
          {
            id: "general_supplies",
            name: "General Supplies",
            description:
              "Food, salves, basic materials, and safe member deposits.",
            materials: {},
            items: {},
            gold: 0,
            lockedToRankOrder: 5,
          },
          {
            id: "guild_projects",
            name: "Guild Projects",
            description:
              "Materials reserved for guild hall, town repairs, and contracts.",
            materials: {},
            items: {},
            gold: 0,
            lockedToRankOrder: 2,
          },
          {
            id: "officer_vault",
            name: "Officer Vault",
            description:
              "High-value materials that require officer trust in a production guild.",
            materials: {},
            items: {},
            gold: 0,
            lockedToRankOrder: 2,
          },
        ],
    projects: Object.fromEntries(
      GUILD_PROJECT_DEFINITIONS.map((project) => [
        project.id,
        guild.projects?.[project.id] ?? {
          id: project.id,
          status: "available" as GuildProjectStatus,
          contributedGold: 0,
          contributedMaterials: {},
        },
      ])
    ),
    events: (guild.events ?? []).slice(0, 8),
    achievements: guild.achievements ?? [],
    hall: {
      owned: guild.hall?.owned ?? false,
      tier: Math.max(0, guild.hall?.tier ?? 0),
      condition: Math.max(0, Math.min(100, guild.hall?.condition ?? 100)),
      services: guild.hall?.services ?? [],
      permissions: guild.hall?.permissions ?? "members",
      workers: guild.hall?.workers ?? [],
    },
    diplomacy: guild.diplomacy ?? {
      "River Knots": "neutral",
      "Merchant Guild": "friendly",
      "Harthmere Watch": "friendly",
    },
    recent: (guild.recent ?? []).slice(0, 20),
  };
}

function normalizeState(
  raw: Partial<HarthmereGuildState>
): HarthmereGuildState {
  const guilds = Object.fromEntries(
    Object.entries(raw.guilds ?? {}).map(([id, guild]) => [
      id,
      normalizeGuild(guild),
    ])
  );
  return {
    version: 1,
    currentGuildId: raw.currentGuildId,
    guilds,
    applications: (raw.applications ?? []).slice(0, 20),
    recent: (raw.recent ?? []).slice(0, 20),
  };
}

export function readHarthmereGuildState(): HarthmereGuildState {
  if (!isBrowser()) {
    return defaultState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_GUILD_STATE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw) as Partial<HarthmereGuildState>);
  } catch {
    return defaultState();
  }
}

export function writeHarthmereGuildState(state: HarthmereGuildState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    HARTHMERE_GUILD_STATE_KEY,
    JSON.stringify(normalizeState(state))
  );
  guildEvent();
}

function activeGuild(state = readHarthmereGuildState()) {
  return state.currentGuildId ? state.guilds[state.currentGuildId] : undefined;
}

function withGuildLog(
  state: HarthmereGuildState,
  guild: GuildRecord | undefined,
  kind: GuildLogKind,
  label: string,
  detail: string,
  goldDelta?: number
): HarthmereGuildState {
  const entry = makeLog(kind, label, detail, goldDelta);
  if (!guild) {
    return { ...state, recent: [entry, ...state.recent].slice(0, 20) };
  }
  return {
    ...state,
    guilds: {
      ...state.guilds,
      [guild.id]: {
        ...guild,
        recent: [entry, ...guild.recent].slice(0, 20),
      },
    },
    recent: [entry, ...state.recent].slice(0, 20),
  };
}

function materialLabel(itemId: string) {
  return MATERIAL_LABELS[itemId] ?? itemId.replace(/_/g, " ");
}

function formatMaterials(materials: Record<string, number>) {
  const entries = Object.entries(materials).filter(
    ([, quantity]) => quantity > 0
  );
  if (!entries.length) return "no materials";
  return entries
    .map(([itemId, quantity]) => `${materialLabel(itemId)} x${quantity}`)
    .join(", ");
}

function requiredRemaining(
  def: GuildProjectDefinition,
  project: GuildProjectState
) {
  const materials: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(def.requiredMaterials)) {
    const remaining = Math.max(
      0,
      quantity - (project.contributedMaterials[itemId] ?? 0)
    );
    if (remaining > 0) materials[itemId] = remaining;
  }
  return {
    gold: Math.max(0, def.requiredGold - project.contributedGold),
    materials,
  };
}

function projectById(projectId: string) {
  return GUILD_PROJECT_DEFINITIONS.find((project) => project.id === projectId);
}

function addGuildXp(guild: GuildRecord, amount: number) {
  let xp = guild.xp + amount;
  let level = guild.level;
  const achievements = [...guild.achievements];
  while (xp >= level * 750 && level < 25) {
    xp -= level * 750;
    level += 1;
    const achievement = `Guild Level ${level}`;
    if (!achievements.includes(achievement)) achievements.push(achievement);
  }
  return { ...guild, xp, level, achievements };
}

function adjustPlayerGold(amount: number, label: string) {
  const inventory = readHarthmereInventoryState();
  const current = inventory.wallet.gold ?? 0;
  if (amount < 0 && current < Math.abs(amount)) {
    writeHarthmereInventoryState({
      ...inventory,
      recent: [
        {
          id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
          at: Date.now(),
          action: "Not Enough Gold",
          detail: `${label} needs ${Math.abs(amount)} gold. You have ${current}.`,
        },
        ...inventory.recent,
      ].slice(0, 18),
    });
    return false;
  }
  writeHarthmereInventoryState({
    ...inventory,
    wallet: { ...inventory.wallet, gold: Math.max(0, current + amount) },
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        action: amount < 0 ? "Guild Gold Spent" : "Guild Gold Received",
        detail: `${label}: ${amount > 0 ? "+" : ""}${amount} gold.`,
      },
      ...inventory.recent,
    ].slice(0, 18),
  });
  return true;
}

function consumePlayerMaterials(
  materials: Record<string, number>,
  label: string
) {
  const inventory = readHarthmereInventoryState();
  const missing = Object.entries(materials).filter(
    ([itemId, quantity]) => (inventory.materialStorage[itemId] ?? 0) < quantity
  );
  if (missing.length) {
    writeHarthmereInventoryState({
      ...inventory,
      recent: [
        {
          id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
          at: Date.now(),
          action: "Missing Guild Materials",
          detail: `${label} needs ${missing
            .map(
              ([itemId, quantity]) =>
                `${materialLabel(itemId)} ${inventory.materialStorage[itemId] ?? 0}/${quantity}`
            )
            .join(", ")}.`,
        },
        ...inventory.recent,
      ].slice(0, 18),
    });
    return false;
  }
  const nextStorage = { ...inventory.materialStorage };
  for (const [itemId, quantity] of Object.entries(materials)) {
    nextStorage[itemId] = Math.max(0, (nextStorage[itemId] ?? 0) - quantity);
  }
  writeHarthmereInventoryState({
    ...inventory,
    materialStorage: nextStorage,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        action: "Guild Materials Used",
        detail: `${label}: ${formatMaterials(materials)} moved into guild records atomically.`,
      },
      ...inventory.recent,
    ].slice(0, 18),
  });
  return true;
}

function mutateTownForGuild(
  effect: GuildProjectDefinition["townEffect"],
  label: string
) {
  if (!effect) return;
  const economy = readHarthmereEconomyState() as any;
  writeHarthmereEconomyState({
    ...economy,
    town: {
      ...economy.town,
      wealth: Math.max(
        0,
        Math.min(100, economy.town.wealth + (effect.wealth ?? 0))
      ),
      security: Math.max(
        0,
        Math.min(100, economy.town.security + (effect.security ?? 0))
      ),
      foodSupply: Math.max(
        0,
        Math.min(100, economy.town.foodSupply + (effect.foodSupply ?? 0))
      ),
      oreSupply: Math.max(
        0,
        Math.min(100, economy.town.oreSupply + (effect.oreSupply ?? 0))
      ),
      medicineSupply: Math.max(
        0,
        Math.min(
          100,
          economy.town.medicineSupply + (effect.medicineSupply ?? 0)
        )
      ),
      crimeRate: Math.max(
        0,
        Math.min(100, economy.town.crimeRate + (effect.crimeRate ?? 0))
      ),
    },
  } as any);
  recordHarthmereEconomicEvent(
    "project",
    "Guild Town Effect",
    `${label} changed Harthmere's economy through a guild project.`
  );
}

function createStarterGuild() {
  let state = readHarthmereGuildState();
  if (activeGuild(state)) {
    writeHarthmereGuildState(
      withGuildLog(
        state,
        activeGuild(state),
        "warning",
        "Already in Guild",
        "You already have an active local-dev guild ledger."
      )
    );
    return;
  }
  const level = getHarthmereLevelSummary().state.level;
  if (level < 1) {
    writeHarthmereGuildState(
      withGuildLog(
        state,
        undefined,
        "warning",
        "Guild Blocked",
        "Guild creation requires an active local-dev character."
      )
    );
    return;
  }
  const creationFee = 25;
  if (!adjustPlayerGold(-creationFee, "Guild registration")) {
    writeHarthmereGuildState(
      withGuildLog(
        state,
        undefined,
        "warning",
        "Guild Fee Missing",
        `Creating a guild costs ${creationFee} gold in this local-dev pass.`
      )
    );
    return;
  }
  const guild = normalizeGuild({
    id: "guild_iron_lanterns",
    name: "Iron Lanterns",
    tag: "IRON",
    type: "casual",
    leaderId: "local_player",
    treasuryGold: 10,
    members: [
      {
        playerId: "local_player",
        name: "You",
        rank: "Guild Leader",
        level,
        role: "Founder",
        professions: ["Adventuring", "Building", "Gathering"],
        joinedAt: Date.now(),
        lastOnline: Date.now(),
        contributionLifetime: 0,
        contributionWeekly: 0,
        note: "Local-dev guild founder.",
      },
    ],
  });
  const created = withGuildLog(
    {
      ...state,
      currentGuildId: guild.id,
      guilds: { ...state.guilds, [guild.id]: guild },
    },
    guild,
    "creation",
    "Guild Created",
    "Iron Lanterns registered with Harthmere. Production guild creation would validate name, tag, signatures, cooldowns, legal status, and server-side gold atomically.",
    -creationFee
  );
  writeHarthmereGuildState(created);
  recordHarthmereEconomicEvent(
    "sink",
    "Guild Registration",
    `Guild registration removed ${creationFee} gold through official fees.`,
    -creationFee
  );
}

function resetHarthmereGuildState() {
  writeHarthmereGuildState(defaultState());
  recordHarthmereEconomicEvent(
    "warning",
    "Guild State Reset",
    "Local-dev guild state was reset for a clean pass."
  );
}

function updateGuild(
  mutator: (
    state: HarthmereGuildState,
    guild: GuildRecord
  ) => HarthmereGuildState
) {
  const state = readHarthmereGuildState();
  const guild = activeGuild(state);
  if (!guild) {
    writeHarthmereGuildState(
      withGuildLog(
        state,
        undefined,
        "warning",
        "No Guild",
        "Create a guild at the Market Board or Guild Registrar first."
      )
    );
    return false;
  }
  writeHarthmereGuildState(mutator(state, guild));
  return true;
}

function donateGoldToGuild(amount = 25) {
  if (!adjustPlayerGold(-amount, "Guild treasury donation")) return;
  updateGuild((state, guild) => {
    const nextGuild = addGuildXp(
      {
        ...guild,
        treasuryGold: guild.treasuryGold + amount,
        members: guild.members.map((member) =>
          member.playerId === "local_player"
            ? {
                ...member,
                contributionLifetime: member.contributionLifetime + amount,
                contributionWeekly: member.contributionWeekly + amount,
              }
            : member
        ),
      },
      Math.max(10, Math.round(amount * 2))
    );
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "treasury",
      "Treasury Donation",
      `You donated ${amount} gold. Guild treasury spending is logged and should be server-authoritative in production.`,
      amount
    );
  });
}

function depositUsefulMaterialsToGuild() {
  const inventory = readHarthmereInventoryState();
  const wanted = [
    "softwood_log",
    "rough_stone",
    "iron_ore",
    "river_clay",
    "scrap_metal",
    "cloth_scrap",
    "peacebloom",
    "river_trout",
    "clean_water",
    "mana_essence",
  ];
  const deposit: Record<string, number> = {};
  for (const itemId of wanted) {
    const have = inventory.materialStorage[itemId] ?? 0;
    if (have > 0) deposit[itemId] = Math.min(have, 10);
  }
  if (!Object.keys(deposit).length) {
    updateGuild((state, guild) =>
      withGuildLog(
        state,
        guild,
        "bank",
        "No Materials Deposited",
        "You do not have guild-useful materials in material storage yet. Gather ore, stone, wood, herbs, fish, water, clay, or scrap first."
      )
    );
    return;
  }
  if (!consumePlayerMaterials(deposit, "Guild bank deposit")) return;
  updateGuild((state, guild) => {
    const tabs = guild.bankTabs.map((tab) =>
      tab.id === "guild_projects"
        ? {
            ...tab,
            materials: Object.fromEntries(
              Array.from(
                new Set([
                  ...Object.keys(tab.materials),
                  ...Object.keys(deposit),
                ])
              ).map((itemId) => [
                itemId,
                (tab.materials[itemId] ?? 0) + (deposit[itemId] ?? 0),
              ])
            ),
          }
        : tab
    );
    const total = Object.values(deposit).reduce(
      (sum, quantity) => sum + quantity,
      0
    );
    const nextGuild = addGuildXp(
      {
        ...guild,
        bankTabs: tabs,
        members: guild.members.map((member) =>
          member.playerId === "local_player"
            ? {
                ...member,
                contributionLifetime: member.contributionLifetime + total,
                contributionWeekly: member.contributionWeekly + total,
              }
            : member
        ),
      },
      Math.max(12, total * 3)
    );
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "bank",
      "Guild Bank Deposit",
      `${formatMaterials(deposit)} deposited into the Guild Projects tab. Production guild banks need rank permissions, limits, and logs like this.`
    );
  });
}

function withdrawBasicGuildSupplies() {
  updateGuild((state, guild) => {
    const projectTab = guild.bankTabs.find(
      (tab) => tab.id === "guild_projects"
    );
    if (!projectTab) return state;
    const materialsToReturn: Record<string, number> = {};
    for (const [itemId, quantity] of Object.entries(projectTab.materials)) {
      if (quantity > 0 && Object.keys(materialsToReturn).length < 3) {
        materialsToReturn[itemId] = Math.min(2, quantity);
      }
    }
    if (!Object.keys(materialsToReturn).length) {
      return withGuildLog(
        state,
        guild,
        "bank",
        "Withdrawal Blocked",
        "The Guild Projects tab has no basic materials to withdraw. Recruits have no withdrawal rights by default; this local-dev action simulates a leader withdrawal."
      );
    }
    const inventory = readHarthmereInventoryState();
    writeHarthmereInventoryState({
      ...inventory,
      materialStorage: Object.fromEntries(
        Array.from(
          new Set([
            ...Object.keys(inventory.materialStorage),
            ...Object.keys(materialsToReturn),
          ])
        ).map((itemId) => [
          itemId,
          (inventory.materialStorage[itemId] ?? 0) +
            (materialsToReturn[itemId] ?? 0),
        ])
      ),
      recent: [
        {
          id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
          at: Date.now(),
          action: "Guild Bank Withdrawal",
          detail: `${formatMaterials(materialsToReturn)} withdrawn by guild leader permission.`,
        },
        ...inventory.recent,
      ].slice(0, 18),
    });
    const tabs = guild.bankTabs.map((tab) =>
      tab.id === "guild_projects"
        ? {
            ...tab,
            materials: Object.fromEntries(
              Object.entries(tab.materials).map(([itemId, quantity]) => [
                itemId,
                Math.max(0, quantity - (materialsToReturn[itemId] ?? 0)),
              ])
            ),
          }
        : tab
    );
    const nextGuild = { ...guild, bankTabs: tabs };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "bank",
      "Guild Bank Withdrawal",
      `${formatMaterials(materialsToReturn)} withdrawn. Withdrawal limits and high-value locks are modeled by rank permissions in the guild ledger.`
    );
  });
}

function startGuildProject(projectId: string) {
  const definition = projectById(projectId);
  if (!definition) return;
  updateGuild((state, guild) => {
    const project = guild.projects[projectId];
    if (!project || project.status !== "available") {
      return withGuildLog(
        state,
        guild,
        "project",
        "Project Already Started",
        `${definition.name} is not currently available to start.`
      );
    }
    const nextGuild = {
      ...guild,
      projects: {
        ...guild.projects,
        [projectId]: {
          ...project,
          status: "in_progress" as GuildProjectStatus,
          startedAt: Date.now(),
        },
      },
    };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "project",
      "Guild Project Started",
      `${definition.name} started. Needed: ${definition.requiredGold} gold and ${formatMaterials(definition.requiredMaterials)}.`
    );
  });
}

function completeGuildProjectIfReady(guild: GuildRecord, projectId: string) {
  const definition = projectById(projectId);
  const project = guild.projects[projectId];
  if (!definition || !project || project.status !== "in_progress") return guild;
  const remaining = requiredRemaining(definition, project);
  if (remaining.gold > 0 || Object.keys(remaining.materials).length > 0)
    return guild;
  let nextGuild = addGuildXp(
    {
      ...guild,
      projects: {
        ...guild.projects,
        [projectId]: {
          ...project,
          status: "completed",
          completedAt: Date.now(),
        },
      },
      achievements: Array.from(
        new Set([...guild.achievements, definition.name])
      ),
      reputation: {
        ...guild.reputation,
        harthmere: (guild.reputation.harthmere ?? 0) + 120,
      },
    },
    definition.guildXp
  );
  if (definition.id === "guild_hall_charter_room") {
    nextGuild = {
      ...nextGuild,
      hall: {
        ...nextGuild.hall,
        owned: true,
        tier: Math.max(1, nextGuild.hall.tier),
        services: Array.from(
          new Set([
            ...nextGuild.hall.services,
            "Guild Bank",
            "Meeting Room",
            "Notice Board",
          ])
        ),
        workers: Array.from(
          new Set([...nextGuild.hall.workers, "Guild Clerk"])
        ),
      },
    };
  }
  if (definition.id === "guild_forge_cooperative") {
    nextGuild = {
      ...nextGuild,
      hall: {
        ...nextGuild.hall,
        tier: Math.max(2, nextGuild.hall.tier),
        services: Array.from(
          new Set([
            ...nextGuild.hall.services,
            "Guild Forge",
            "Repair Fund",
            "Crafting Orders",
          ])
        ),
        workers: Array.from(
          new Set([...nextGuild.hall.workers, "Forge Steward"])
        ),
      },
    };
  }
  if (definition.id === "guild_watch_pact") {
    nextGuild = {
      ...nextGuild,
      diplomacy: { ...nextGuild.diplomacy, "Harthmere Watch": "allied" },
    };
  }
  mutateTownForGuild(definition.townEffect, definition.name);
  applyHarthmereReputationChange({
    label: "Guild Project Completed",
    detail: `${definition.name} improved your guild's public standing in Harthmere.`,
    harthmere: {
      likeability: 45,
      legal: definition.type === "pvp" ? 35 : 15,
      notoriety: 20,
    },
  });
  return nextGuild;
}

function contributeToGuildProject(projectId: string) {
  const definition = projectById(projectId);
  if (!definition) return;
  updateGuild((state, guild) => {
    const project = guild.projects[projectId];
    if (!project || project.status === "completed") {
      return withGuildLog(
        state,
        guild,
        "project",
        "Project Complete",
        `${definition.name} is already complete or unavailable.`
      );
    }
    const activeProject =
      project.status === "available"
        ? {
            ...project,
            status: "in_progress" as GuildProjectStatus,
            startedAt: Date.now(),
          }
        : project;
    const remaining = requiredRemaining(definition, activeProject);
    const goldMove = Math.min(25, remaining.gold);
    if (
      goldMove > 0 &&
      !adjustPlayerGold(-goldMove, `${definition.name} guild project`)
    ) {
      return withGuildLog(
        state,
        guild,
        "project",
        "Project Needs Gold",
        `${definition.name} needs ${remaining.gold} more guild gold. Donate gold or earn more first.`
      );
    }
    const materialMove: Record<string, number> = {};
    for (const [itemId, quantity] of Object.entries(remaining.materials)) {
      materialMove[itemId] = Math.min(quantity, 8);
    }
    if (
      Object.keys(materialMove).length > 0 &&
      !consumePlayerMaterials(materialMove, `${definition.name} guild project`)
    ) {
      if (goldMove > 0)
        adjustPlayerGold(goldMove, `Refund ${definition.name} guild project`);
      return withGuildLog(
        state,
        guild,
        "project",
        "Project Needs Materials",
        `${definition.name} still needs ${formatMaterials(remaining.materials)}.`
      );
    }
    const updatedProject: GuildProjectState = {
      ...activeProject,
      contributedGold: activeProject.contributedGold + goldMove,
      contributedMaterials: Object.fromEntries(
        Array.from(
          new Set([
            ...Object.keys(activeProject.contributedMaterials),
            ...Object.keys(materialMove),
          ])
        ).map((itemId) => [
          itemId,
          (activeProject.contributedMaterials[itemId] ?? 0) +
            (materialMove[itemId] ?? 0),
        ])
      ),
    };
    let nextGuild = {
      ...guild,
      treasuryGold: guild.treasuryGold + goldMove,
      projects: { ...guild.projects, [projectId]: updatedProject },
      members: guild.members.map((member) =>
        member.playerId === "local_player"
          ? {
              ...member,
              contributionLifetime:
                member.contributionLifetime +
                goldMove +
                Object.values(materialMove).reduce((a, b) => a + b, 0),
              contributionWeekly:
                member.contributionWeekly +
                goldMove +
                Object.values(materialMove).reduce((a, b) => a + b, 0),
            }
          : member
      ),
    };
    nextGuild = completeGuildProjectIfReady(nextGuild, projectId);
    awardHarthmereXp({
      source: "exploration",
      label: `${definition.name} guild contribution`,
      baseXp: 30,
      detail:
        "Guild cooperation gives local-dev XP and guild contribution credit.",
    });
    const completed = nextGuild.projects[projectId]?.status === "completed";
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "project",
      completed ? "Guild Project Completed" : "Guild Project Contribution",
      completed
        ? `${definition.name} completed. Rewards: ${definition.rewards.join(", ")}.`
        : `${definition.name}: contributed ${goldMove} gold and ${formatMaterials(materialMove)}.`,
      -goldMove
    );
  });
}

function inviteNpcRecruit() {
  updateGuild((state, guild) => {
    if (guild.members.length >= guild.maxMembers) {
      return withGuildLog(
        state,
        guild,
        "roster",
        "Roster Full",
        "The guild roster is full."
      );
    }
    const recruit = RECRUIT_POOL.find(
      (candidate) =>
        !guild.members.some((member) => member.name === candidate.name)
    );
    if (!recruit) {
      return withGuildLog(
        state,
        guild,
        "recruitment",
        "No Recruits Waiting",
        "All local-dev recruit examples have already joined the guild."
      );
    }
    const member: GuildMemberRecord = {
      playerId: `npc_${recruit.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: recruit.name,
      rank: "Recruit",
      level: recruit.level,
      role: recruit.role,
      professions: recruit.professions,
      joinedAt: Date.now(),
      lastOnline: Date.now(),
      contributionLifetime: 0,
      contributionWeekly: 0,
      note: recruit.note,
    };
    const nextGuild = addGuildXp(
      { ...guild, members: [...guild.members, member] },
      50
    );
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "roster",
      "Recruit Joined",
      `${member.name} joined as ${member.rank}. Recruits cannot withdraw from the guild bank by default.`
    );
  });
}

function promoteFirstRecruit() {
  updateGuild((state, guild) => {
    const recruit = guild.members.find((member) => member.rank === "Recruit");
    if (!recruit) {
      return withGuildLog(
        state,
        guild,
        "rank",
        "Promotion Blocked",
        "No recruit is currently waiting for promotion."
      );
    }
    const nextGuild = {
      ...guild,
      members: guild.members.map((member) =>
        member.playerId === recruit.playerId
          ? { ...member, rank: "Member" as GuildRankName }
          : member
      ),
    };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "rank",
      "Member Promoted",
      `${recruit.name} promoted from Recruit to Member. Rank changes are high-trust actions and must be logged.`
    );
  });
}

function cycleGuildTax() {
  updateGuild((state, guild) => {
    const nextRate = guild.taxRate >= 10 ? 0 : guild.taxRate + 2;
    const nextGuild = { ...guild, taxRate: nextRate };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "treasury",
      "Guild Tax Changed",
      `Guild tax is now ${nextRate}%. Tax settings are visible and logged so they cannot be changed secretly.`
    );
  });
}

function scheduleGuildEvent(type: GuildEventType = "gathering") {
  updateGuild((state, guild) => {
    const event: GuildCalendarEvent = {
      id: `guild_event_${Date.now()}`,
      title:
        type === "raid"
          ? "Old Well Raid Planning"
          : type === "pvp"
            ? "Caravan Defense Patrol"
            : type === "crafting"
              ? "Guild Crafting Night"
              : "Harthmere Gathering Run",
      type,
      startAt: Date.now() + 24 * 60 * 60 * 1000,
      location:
        type === "raid"
          ? "Old Well / Underways Staging"
          : type === "pvp"
            ? "North Gate"
            : type === "crafting"
              ? "Black Anvil / Guild Forge"
              : "Market Board",
      requiredRoles:
        type === "raid"
          ? { tank: 1, healer: 1, damage: 3 }
          : type === "pvp"
            ? { scout: 1, guard: 2, healer: 1 }
            : { gatherer: 3, crafter: 1 },
      notes:
        type === "raid"
          ? "Bring salves, repair vouchers, and a clear objective plan."
          : "This local-dev event tests guild calendar, RSVP, and contribution logs.",
      signups: [{ playerName: "You", role: "Any", status: "accepted" }],
    };
    const nextGuild = addGuildXp(
      { ...guild, events: [event, ...guild.events].slice(0, 8) },
      25
    );
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "event",
      "Guild Event Scheduled",
      `${event.title} added to the guild calendar for ${new Date(event.startAt).toLocaleString()}.`
    );
  });
}

function completeGuildContract(kind: "caravan" | "crafting" | "town") {
  const reward = kind === "caravan" ? 35 : kind === "crafting" ? 25 : 20;
  updateGuild((state, guild) => {
    const nextGuild = addGuildXp(
      {
        ...guild,
        treasuryGold: guild.treasuryGold + reward,
        reputation: {
          ...guild.reputation,
          harthmere:
            (guild.reputation.harthmere ?? 0) + (kind === "caravan" ? 80 : 50),
          merchant_guild:
            (guild.reputation.merchant_guild ?? 0) +
            (kind === "caravan" ? 60 : 25),
        },
      },
      kind === "caravan" ? 160 : 110
    );
    if (kind === "caravan") {
      const economy = readHarthmereEconomyState() as any;
      writeHarthmereEconomyState({
        ...economy,
        town: {
          ...economy.town,
          security: Math.min(100, economy.town.security + 2),
          wealth: Math.min(100, economy.town.wealth + 1),
          crimeRate: Math.max(0, economy.town.crimeRate - 1),
        },
      } as any);
    }
    applyHarthmereReputationChange({
      label: "Guild Contract Completed",
      detail:
        kind === "caravan"
          ? "The guild protected trade and earned lawful public trust."
          : "The guild contributed useful labor instead of acting like a chat room.",
      harthmere: {
        likeability: 25,
        legal: kind === "caravan" ? 20 : 5,
        notoriety: 10,
      },
    });
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "project",
      "Guild Contract Completed",
      `${kind === "caravan" ? "Caravan defense" : kind === "crafting" ? "Crafting order" : "Town support"} completed. Treasury +${reward} gold and guild reputation improved.`,
      reward
    );
  });
}

function declarePracticeRivalry() {
  updateGuild((state, guild) => {
    const current = guild.diplomacy["River Knots"] ?? "neutral";
    const nextState: GuildDiplomacyState =
      current === "rival" ? "truce" : "rival";
    const nextGuild = {
      ...guild,
      diplomacy: { ...guild.diplomacy, "River Knots": nextState },
    };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "war",
      nextState === "rival" ? "Rivalry Declared" : "Truce Offered",
      nextState === "rival"
        ? "A practice rivalry was declared with the River Knots. Production guild wars need confirmation, cooldowns, safe-zone protection, and member notification."
        : "The rivalry was cooled into a truce. Diplomacy changes are logged."
    );
  });
}

function cycleGuildHallPermission() {
  updateGuild((state, guild) => {
    const order: GuildHallState["permissions"][] = [
      "members",
      "friends",
      "public",
      "officers",
    ];
    const next =
      order[(order.indexOf(guild.hall.permissions) + 1) % order.length];
    const nextGuild = { ...guild, hall: { ...guild.hall, permissions: next } };
    return withGuildLog(
      { ...state, guilds: { ...state.guilds, [guild.id]: nextGuild } },
      nextGuild,
      "hall",
      "Guild Hall Permissions",
      `Guild hall access changed to ${next}. Guild hall access should always be permission-based and logged.`
    );
  });
}

export function useHarthmereGuildState() {
  const [state, setState] = useState<HarthmereGuildState>(() =>
    readHarthmereGuildState()
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereGuildState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_GUILD_EVENT, refresh);
    window.addEventListener("biomes:harthmere-inventory-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_GUILD_EVENT, refresh);
      window.removeEventListener("biomes:harthmere-inventory-changed", refresh);
    };
  }, []);

  return state;
}

function guildSummary(guild?: GuildRecord) {
  if (!guild) return "No guild yet";
  return `${guild.name} <${guild.tag}> · Lv ${guild.level} · ${guild.members.length}/${guild.maxMembers} members · ${guild.treasuryGold}g treasury`;
}

function projectSummary(guild?: GuildRecord) {
  if (!guild) return "Create a guild first.";
  const active = Object.values(guild.projects).find(
    (project) => project.status === "in_progress"
  );
  if (!active) return "No active guild project.";
  const def = projectById(active.id);
  if (!def) return "Unknown project.";
  const remaining = requiredRemaining(def, active);
  return `${def.name}: needs ${remaining.gold}g and ${formatMaterials(remaining.materials)}.`;
}

export function guildActionsForHarthmereNpc(
  offset: number
): TalkDialogStepAction[] {
  const actions: TalkDialogStepAction[] = [];
  const guildNpcOffsets = new Set([41, 6, 10, 11, 27, 29, 30, 33, 34, 44]);
  if (!guildNpcOffsets.has(offset)) return actions;

  const state = readHarthmereGuildState();
  const guild = activeGuild(state);

  if (!guild) {
    actions.push({
      name: "Create guild: Iron Lanterns",
      tooltip:
        "Registers a local-dev guild with leader rank, ranks, permissions, bank tabs, treasury, projects, roster, and logs.",
      followUpText:
        "A guild is not just a chat room. The registrar checks fee, level, name/tag, and creates a logged guild ledger.",
      onPerformed: () => createStarterGuild(),
    });
    return actions;
  }

  if ([41, 6, 10, 30].includes(offset)) {
    actions.push({
      name: "Invite a guild recruit",
      tooltip:
        "Adds a local-dev NPC member as Recruit. Recruits cannot withdraw from guild bank by default.",
      followUpText:
        "The recruiter notes role, profession, rank, and contribution history in the roster.",
      onPerformed: () => inviteNpcRecruit(),
    });
    actions.push({
      name: "Promote first recruit to Member",
      tooltip: "Tests rank progression and logs a trust-sensitive promotion.",
      followUpText: "Promotion changes permissions, so the action is logged.",
      onPerformed: () => promoteFirstRecruit(),
    });
  }

  if ([41, 6, 29, 34].includes(offset)) {
    actions.push({
      name: "Deposit useful materials to guild bank",
      tooltip:
        "Moves up to 10 each of useful materials from material storage into the Guild Projects tab.",
      followUpText:
        "Materials are no longer loose personal supplies; they become logged guild project resources.",
      onPerformed: () => depositUsefulMaterialsToGuild(),
    });
    actions.push({
      name: "Withdraw basic guild supplies",
      tooltip:
        "Tests a leader-level withdrawal from the guild project tab. Production would enforce daily rank limits.",
      followUpText:
        "Withdrawal is logged so bank theft and disputes can be audited.",
      onPerformed: () => withdrawBasicGuildSupplies(),
    });
    actions.push({
      name: "Donate 25 gold to guild treasury",
      tooltip:
        "Moves player gold into guild treasury and records contribution credit.",
      followUpText:
        "The treasury receives the donation. In production, all treasury movement must be server-authoritative and logged.",
      onPerformed: () => donateGoldToGuild(25),
    });
  }

  if ([41, 6].includes(offset)) {
    actions.push({
      name: "Cycle guild tax rate",
      tooltip:
        "Cycles local-dev tax 0% -> 2% -> ... -> 10% -> 0%. Tax changes are announced and logged.",
      followUpText:
        "Guild tax cannot be secret. Members should always see current tax settings.",
      onPerformed: () => cycleGuildTax(),
    });
  }

  const projectOffsets: Record<number, string[]> = {
    41: GUILD_PROJECT_DEFINITIONS.map((project) => project.id),
    6: ["guild_hall_charter_room"],
    29: ["guild_forge_cooperative"],
    27: ["guild_watch_pact"],
    44: ["guild_watch_pact"],
    31: ["guild_supply_drive"],
    8: ["guild_supply_drive"],
    34: ["guild_supply_drive", "guild_watch_pact"],
  };
  for (const projectId of projectOffsets[offset] ?? []) {
    const def = projectById(projectId);
    const project = guild.projects[projectId];
    if (!def || !project || project.status === "completed") continue;
    actions.push({
      name:
        project.status === "available"
          ? `Start guild project: ${def.name}`
          : `Contribute to guild project: ${def.name}`,
      tooltip:
        project.status === "available"
          ? `${def.description} Needs ${def.requiredGold}g and ${formatMaterials(def.requiredMaterials)}.`
          : projectSummary(guild),
      followUpText:
        project.status === "available"
          ? "The guild project is now active and visible in the guild panel."
          : "The guild ledger records the contribution and checks for completion.",
      onPerformed: () =>
        project.status === "available"
          ? startGuildProject(projectId)
          : contributeToGuildProject(projectId),
    });
  }

  if ([41, 11, 30].includes(offset)) {
    actions.push({
      name: "Schedule guild gathering run",
      tooltip:
        "Adds a local-dev guild calendar event with role needs, location, and notes.",
      followUpText: "The event is added to the guild calendar with your RSVP.",
      onPerformed: () => scheduleGuildEvent("gathering"),
    });
    actions.push({
      name: "Schedule guild raid planning",
      tooltip:
        "Adds a raid-style event for future Underways/world-boss content.",
      followUpText:
        "The raid planning event is scheduled. It does not grant raid loot by itself.",
      onPerformed: () => scheduleGuildEvent("raid"),
    });
  }

  if ([27, 34, 44].includes(offset)) {
    actions.push({
      name: "Complete guild caravan defense contract",
      tooltip:
        "Simulates a lawful guild contract: treasury, guild XP, town security, and reputation improve.",
      followUpText:
        "The Watch notes the contract. Participants would get personal credit only if they contributed.",
      onPerformed: () => completeGuildContract("caravan"),
    });
    actions.push({
      name: "Declare practice rivalry with River Knots",
      tooltip:
        "Tests diplomacy/war logging. Real guild wars need confirmation, cooldowns, objectives, and safe-zone rules.",
      followUpText:
        "The rivalry/truce state changes in the guild diplomacy ledger. This does not bypass PvP consent rules.",
      onPerformed: () => declarePracticeRivalry(),
    });
  }

  if ([6, 41].includes(offset)) {
    actions.push({
      name: "Cycle guild hall access permissions",
      tooltip:
        "Cycles members/friends/public/officers access on the guild hall ledger.",
      followUpText: "Guild hall permissions changed and were logged.",
      onPerformed: () => cycleGuildHallPermission(),
    });
  }

  if (offset === 41) {
    actions.push({
      name: "Reset local-dev guild system",
      tooltip:
        "Clears guild roster, bank, treasury, projects, hall, events, diplomacy, and logs.",
      followUpText: "The guild system was reset for a clean guild test pass.",
      onPerformed: () => resetHarthmereGuildState(),
    });
  }

  return actions;
}

export const HarthmereGuildHUD: React.FunctionComponent<{}> = () => {
  const state = useHarthmereGuildState();
  const guild = activeGuild(state);
  const latest = guild?.recent[0] ?? state.recent[0];
  const activeProject = guild
    ? Object.values(guild.projects).find(
        (project) => project.status === "in_progress"
      )
    : undefined;
  const projectDef = activeProject ? projectById(activeProject.id) : undefined;
  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="text-sm font-semibold uppercase tracking-wide text-yellow-200">
        Harthmere Guild
      </div>
      <div className="mt-1 text-xs text-white/90">{guildSummary(guild)}</div>
      {guild && (
        <div className="mt-1 grid grid-cols-3 gap-1 text-[0.68rem] text-white/75">
          <div>{guild.treasuryGold}g treasury</div>
          <div>{guild.taxRate}% tax</div>
          <div>{guild.hall.owned ? `Hall T${guild.hall.tier}` : "No hall"}</div>
        </div>
      )}
      {projectDef && activeProject && (
        <div className="mt-1 rounded bg-white/10 px-1.5 py-1 text-[0.68rem] text-white/80">
          Project: {projectDef.name} ·{" "}
          {requiredRemaining(projectDef, activeProject).gold}g left
        </div>
      )}
      {latest && (
        <div className="mt-1 text-[0.68rem] text-yellow-100">
          {latest.label}: {latest.detail}
        </div>
      )}
    </div>
  );
};

const PanelButton: React.FunctionComponent<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}> = ({ children, onClick, disabled }) => (
  <button
    className={`rounded px-2 py-1 text-left text-xs font-semibold ${
      disabled
        ? "bg-white/10 text-white/35"
        : "bg-yellow-300/20 text-yellow-100 hover:bg-yellow-300/30"
    }`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

export const HarthmereGuildMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereGuildState();
  const guild = activeGuild(state);
  const [tab, setTab] = useState<
    "overview" | "roster" | "bank" | "projects" | "events" | "guide"
  >("overview");
  const projectRows = guild
    ? GUILD_PROJECT_DEFINITIONS.map((def) => ({
        def,
        state: guild.projects[def.id],
      }))
    : [];
  const latest = guild?.recent[0] ?? state.recent[0];

  return (
    <div className="mb-2 max-h-[36rem] w-[28rem] overflow-y-auto rounded-lg border border-white/15 bg-slate-950/95 p-3 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold text-yellow-200">
            Harthmere Guild System
          </div>
          <div className="text-xs text-white/65">
            Roster, ranks, bank, treasury, projects, hall, events, diplomacy,
            and logs.
          </div>
        </div>
        <div className="rounded bg-white/10 px-2 py-1 text-xs text-white/80">
          {guild ? `Lv ${guild.level}` : "No guild"}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(
          ["overview", "roster", "bank", "projects", "events", "guide"] as const
        ).map((nextTab) => (
          <button
            key={nextTab}
            className={`rounded px-2 py-1 text-xs ${tab === nextTab ? "bg-yellow-300/25 text-yellow-100" : "bg-white/10 text-white/70"}`}
            onClick={() => setTab(nextTab)}
          >
            {nextTab[0].toUpperCase() + nextTab.slice(1)}
          </button>
        ))}
      </div>

      {!guild && (
        <div className="mt-3 rounded border border-yellow-300/30 bg-yellow-300/10 p-2 text-xs text-yellow-50">
          Create a guild from the Market Board or here. This costs 25 gold in
          local-dev and creates ranks, permissions, bank tabs, treasury,
          projects, events, hall state, diplomacy, and logs.
          <div className="mt-2">
            <PanelButton onClick={createStarterGuild}>
              Create Iron Lanterns Guild
            </PanelButton>
          </div>
        </div>
      )}

      {guild && tab === "overview" && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="rounded bg-white/10 p-2">
            <div className="font-semibold text-yellow-100">
              {guild.name} &lt;{guild.tag}&gt;
            </div>
            <div className="text-white/75">{guild.description}</div>
            <div className="mt-1 text-white/70">
              MOTD: {guild.messageOfTheDay}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-white/10 p-2">
              Members: {guild.members.length}/{guild.maxMembers}
            </div>
            <div className="rounded bg-white/10 p-2">
              Treasury: {guild.treasuryGold} gold
            </div>
            <div className="rounded bg-white/10 p-2">
              Guild XP: {guild.xp} / {guild.level * 750}
            </div>
            <div className="rounded bg-white/10 p-2">Tax: {guild.taxRate}%</div>
            <div className="rounded bg-white/10 p-2">
              Hall: {guild.hall.owned ? `Tier ${guild.hall.tier}` : "not built"}
            </div>
            <div className="rounded bg-white/10 p-2">
              Harthmere Rep: {guild.reputation.harthmere ?? 0}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <PanelButton onClick={() => donateGoldToGuild(25)}>
              Donate 25g
            </PanelButton>
            <PanelButton onClick={depositUsefulMaterialsToGuild}>
              Deposit materials
            </PanelButton>
            <PanelButton onClick={inviteNpcRecruit}>Invite recruit</PanelButton>
            <PanelButton onClick={cycleGuildTax}>Cycle tax rate</PanelButton>
            <PanelButton onClick={() => scheduleGuildEvent("gathering")}>
              Schedule gathering run
            </PanelButton>
            <PanelButton onClick={() => completeGuildContract("caravan")}>
              Complete caravan contract
            </PanelButton>
          </div>
          {latest && (
            <div className="rounded bg-yellow-300/10 p-2 text-yellow-50">
              Latest: {latest.label} — {latest.detail}
            </div>
          )}
        </div>
      )}

      {guild && tab === "roster" && (
        <div className="mt-3 space-y-2 text-xs">
          {guild.members.map((member) => (
            <div key={member.playerId} className="rounded bg-white/10 p-2">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-yellow-100">
                  {member.name}
                </span>
                <span className="text-white/60">{member.rank}</span>
              </div>
              <div className="text-white/75">
                Lv {member.level} · {member.role} ·{" "}
                {member.professions.join(", ")}
              </div>
              <div className="text-white/55">
                Contribution: {member.contributionLifetime} lifetime /{" "}
                {member.contributionWeekly} weekly
              </div>
              {member.note && (
                <div className="text-white/50">{member.note}</div>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1">
            <PanelButton onClick={inviteNpcRecruit}>Invite recruit</PanelButton>
            <PanelButton onClick={promoteFirstRecruit}>
              Promote first recruit
            </PanelButton>
          </div>
        </div>
      )}

      {guild && tab === "bank" && (
        <div className="mt-3 space-y-2 text-xs">
          {guild.bankTabs.map((tabRow) => (
            <div key={tabRow.id} className="rounded bg-white/10 p-2">
              <div className="font-semibold text-yellow-100">{tabRow.name}</div>
              <div className="text-white/60">{tabRow.description}</div>
              <div className="mt-1 text-white/75">
                Gold: {tabRow.gold} · Locked to rank order{" "}
                {tabRow.lockedToRankOrder} or better
              </div>
              <div className="mt-1 text-white/70">
                Materials: {formatMaterials(tabRow.materials)}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1">
            <PanelButton onClick={depositUsefulMaterialsToGuild}>
              Deposit useful materials
            </PanelButton>
            <PanelButton onClick={withdrawBasicGuildSupplies}>
              Withdraw basic supplies
            </PanelButton>
          </div>
        </div>
      )}

      {guild && tab === "projects" && (
        <div className="mt-3 space-y-2 text-xs">
          {projectRows.map(({ def, state: projectState }) => {
            const remaining = projectState
              ? requiredRemaining(def, projectState)
              : undefined;
            return (
              <div key={def.id} className="rounded bg-white/10 p-2">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-yellow-100">
                    {def.name}
                  </span>
                  <span className="text-white/60">
                    {projectState?.status ?? "available"}
                  </span>
                </div>
                <div className="text-white/70">{def.description}</div>
                <div className="mt-1 text-white/60">
                  Rewards: {def.rewards.join(", ")}
                </div>
                {remaining && projectState?.status !== "completed" && (
                  <div className="mt-1 text-white/80">
                    Needs: {remaining.gold}g and{" "}
                    {formatMaterials(remaining.materials)}
                  </div>
                )}
                {projectState?.status !== "completed" && (
                  <div className="mt-2">
                    <PanelButton
                      onClick={() =>
                        projectState?.status === "available"
                          ? startGuildProject(def.id)
                          : contributeToGuildProject(def.id)
                      }
                    >
                      {projectState?.status === "available"
                        ? "Start project"
                        : "Contribute"}
                    </PanelButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {guild && tab === "events" && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-1">
            <PanelButton onClick={() => scheduleGuildEvent("gathering")}>
              Gathering
            </PanelButton>
            <PanelButton onClick={() => scheduleGuildEvent("raid")}>
              Raid
            </PanelButton>
            <PanelButton onClick={() => scheduleGuildEvent("pvp")}>
              PvP
            </PanelButton>
          </div>
          {guild.events.length === 0 && (
            <div className="rounded bg-white/10 p-2 text-white/60">
              No events yet.
            </div>
          )}
          {guild.events.map((event) => (
            <div key={event.id} className="rounded bg-white/10 p-2">
              <div className="font-semibold text-yellow-100">{event.title}</div>
              <div className="text-white/70">
                {event.type} · {event.location} ·{" "}
                {new Date(event.startAt).toLocaleString()}
              </div>
              <div className="text-white/60">
                Needs:{" "}
                {Object.entries(event.requiredRoles)
                  .map(([role, count]) => `${role} ${count}`)
                  .join(", ")}
              </div>
              <div className="text-white/55">{event.notes}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "guide" && (
        <div className="mt-3 space-y-2 text-xs text-white/75">
          <p>
            <b className="text-yellow-100">
              Guilds are organizations, not chat rooms.
            </b>{" "}
            They have ranks, permissions, bank tabs, treasury, tax, projects,
            halls, events, diplomacy, and logs.
          </p>
          <p>
            High-risk actions such as withdrawals, treasury spending,
            promotions, war declarations, leadership transfer, property sale,
            and disbanding must be server-authoritative and logged.
          </p>
          <p>
            Recruits have no bank withdrawal rights by default. Officers can
            organize, but only leaders should disband or transfer ownership.
          </p>
          <p>
            Guild systems connect to economy, gathering, building, raids, PvP,
            town reputation, and long-term player cooperation.
          </p>
          {guild && (
            <PanelButton onClick={resetHarthmereGuildState}>
              Reset local-dev guild system
            </PanelButton>
          )}
        </div>
      )}
    </div>
  );
};
