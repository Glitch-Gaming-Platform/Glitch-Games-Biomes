/*
 * mmo_guild_authority.ts
 *
 * Server-authoritative Guild System model and reducer for Harthmere live mode.
 * This module intentionally contains no React/localStorage assumptions. Guilds
 * are persisted as backend state and mirrored through shared guild state keys.
 */

export const HARTHMERE_GUILD_AUTHORITY_VERSION = "harthmere-guild-authority";

export const HARTHMERE_GUILD_CREATION_FEE_GOLD = 250;
export const HARTHMERE_GUILD_CREATION_MIN_LEVEL = 10;
export const HARTHMERE_GUILD_BASE_BANK_SLOTS = 48;
export const HARTHMERE_GUILD_BANK_MAX_SLOTS = 240;
export const HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE = 12;
export const HARTHMERE_GUILD_MAX_TAX_RATE = 0.1;
export const HARTHMERE_GUILD_XP_PER_LEVEL = 500;
export const HARTHMERE_GUILD_MAX_NAME_LENGTH = 32;
export const HARTHMERE_GUILD_MAX_TAG_LENGTH = 6;
export const HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH = 500;
export const HARTHMERE_GUILD_MAX_CHAT_MESSAGE_LENGTH = 500;
export const HARTHMERE_GUILD_MAX_AUDIT_LOGS = 200;
export const HARTHMERE_GUILD_MAX_CHAT_MESSAGES = 100;
export const HARTHMERE_GUILD_MAX_BANK_LOGS = 200;
export const HARTHMERE_GUILD_MAX_MUTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const HARTHMERE_GUILD_MAX_MEMBERS = 100;

export type HarthmereGuildType =
  | "adventuring"
  | "crafting"
  | "trade"
  | "social"
  | "pvp"
  | "civic";

export type HarthmereGuildRecruitmentStatus = "open" | "application" | "invite_only" | "closed";
export type HarthmereGuildApplicationStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type HarthmereGuildInviteStatus = "pending" | "accepted" | "expired" | "revoked" | "declined";
export type HarthmereGuildMemberStatus = "active" | "inactive" | "banned";

export type HarthmereGuildPermission =
  | "invite_members"
  | "manage_applications"
  | "manage_members"
  | "manage_ranks"
  | "deposit_bank"
  | "withdraw_bank"
  | "manage_treasury"
  | "set_tax"
  | "manage_guild_hall"
  | "send_chat"
  | "moderate_chat"
  | "disband_guild";

export type HarthmereGuildPermissionMap = Record<HarthmereGuildPermission, boolean>;

export interface HarthmereGuildRank {
  rankId: string;
  name: string;
  order: number;
  permissions: HarthmereGuildPermissionMap;
  dailyBankWithdrawLimitGoldValue: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface HarthmereGuildMember {
  actorId: string;
  displayName?: string;
  rankId: string;
  joinedAtMs: number;
  lastSeenAtMs: number;
  status: HarthmereGuildMemberStatus;
  contributionXp: number;
  mutedUntilMs?: number;
}

export interface HarthmereGuildApplication {
  applicationId: string;
  guildId: string;
  applicantActorId: string;
  applicantDisplayName?: string;
  message?: string;
  status: HarthmereGuildApplicationStatus;
  createdAtMs: number;
  decidedAtMs?: number;
  decidedByActorId?: string;
}

export interface HarthmereGuildInvite {
  inviteId: string;
  guildId: string;
  targetActorId: string;
  invitedByActorId: string;
  targetDisplayName?: string;
  status: HarthmereGuildInviteStatus;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs?: number;
}

export interface HarthmereGuildBankLog {
  id: string;
  guildId: string;
  actorId: string;
  kind: "deposit" | "withdraw" | "slot_upgrade";
  itemId?: string;
  count?: number;
  goldValue?: number;
  atMs: number;
}

export interface HarthmereGuildBank {
  items: Record<string, number>;
  maxSlots: number;
  logs: HarthmereGuildBankLog[];
  dailyWithdrawals: Record<string, { dayKey: string; goldValue: number }>;
}

export interface HarthmereGuildTreasuryLog {
  id: string;
  guildId: string;
  actorId: string;
  kind: "deposit" | "withdraw" | "tax" | "guild_creation_fee" | "guild_hall_cost" | "bank_slot_upgrade";
  amountGold: number;
  reason?: string;
  atMs: number;
}

export interface HarthmereGuildChatMessage {
  messageId: string;
  guildId: string;
  actorId: string;
  displayName?: string;
  channel: "guild" | "officer";
  body: string;
  createdAtMs: number;
  deletedAtMs?: number;
  deletedByActorId?: string;
}

export interface HarthmereGuildHallState {
  propertyId?: string;
  plotId?: string;
  blueprintId?: string;
  status: "none" | "planned" | "under_construction" | "completed";
  servicesUnlocked: string[];
  linkedAtMs?: number;
}

export interface HarthmereGuildAuditLog {
  id: string;
  guildId: string;
  actorId: string;
  kind: string;
  detail?: string;
  atMs: number;
}

export interface HarthmereGuildRecord {
  guildId: string;
  name: string;
  tag: string;
  description: string;
  type: HarthmereGuildType;
  recruitment: HarthmereGuildRecruitmentStatus;
  leaderActorId: string;
  createdAtMs: number;
  updatedAtMs: number;
  level: number;
  xp: number;
  treasuryGold: number;
  taxRate: number;
  ranks: Record<string, HarthmereGuildRank>;
  members: Record<string, HarthmereGuildMember>;
  applications: Record<string, HarthmereGuildApplication>;
  invites: Record<string, HarthmereGuildInvite>;
  bank: HarthmereGuildBank;
  treasuryLogs: HarthmereGuildTreasuryLog[];
  chatMessages: HarthmereGuildChatMessage[];
  auditLogs: HarthmereGuildAuditLog[];
  guildHall: HarthmereGuildHallState;
  disbandedAtMs?: number;
}

export interface HarthmereLiveModeGuildState {
  /** Legacy single-guild summary fields kept for older callers. */
  guildId?: string;
  role?: string;
  treasury: number;
  bank: Record<string, number>;
  projectContributions: Record<string, number>;

  /** Production persisted guild directory and actor membership. */
  memberGuildId?: string;
  guilds: Record<string, HarthmereGuildRecord>;
  nextGuildNumber: number;
  nextApplicationNumber: number;
  nextInviteNumber: number;
  nextChatNumber: number;
  nextLogNumber: number;
}

export interface HarthmereGuildMutationRequest {
  requestId: string;
  actorId: string;
  nowMs: number;
  operation: string;
  guildId?: string;
  name?: string;
  tag?: string;
  description?: string;
  guildType?: HarthmereGuildType;
  recruitment?: HarthmereGuildRecruitmentStatus;
  targetActorId?: string;
  displayName?: string;
  applicationId?: string;
  inviteId?: string;
  rankId?: string;
  rankName?: string;
  permissions?: Partial<HarthmereGuildPermissionMap>;
  dailyBankWithdrawLimitGoldValue?: number;
  itemId?: string;
  count?: number;
  itemGoldValue?: number;
  amountGold?: number;
  taxRate?: number;
  xpDelta?: number;
  message?: string;
  channel?: "guild" | "officer";
  propertyId?: string;
  plotId?: string;
  blueprintId?: string;
  reason?: string;
}

export interface HarthmereGuildMutationContext {
  actorGold: number;
  actorInventoryItems: Record<string, number>;
  actorLevel: number;
  actorGuildCreationCooldownUntilMs?: number;
  actorGuildRestrictedUntilMs?: number;
  trustedTaxCollection?: boolean;
  trustedGuildXpGrant?: boolean;
  canDepositItem?: (itemId: string) => boolean;
  canWithdrawToInventory?: (itemId: string, count: number) => boolean;
  guildBankHasCapacity?: (items: Record<string, number>, itemId: string, maxSlots: number) => boolean;
  canLinkGuildHallProperty?: (input: {
    guildId: string;
    actorId: string;
    propertyId: string;
    plotId?: string;
    blueprintId?: string;
  }) => boolean;
}

export interface HarthmereGuildMutationResult {
  guild: HarthmereLiveModeGuildState;
  warnings: string[];
  touchedModels: string[];
  sharedGuildIds: string[];
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
}

const ALL_GUILD_PERMISSIONS: HarthmereGuildPermission[] = [
  "invite_members",
  "manage_applications",
  "manage_members",
  "manage_ranks",
  "deposit_bank",
  "withdraw_bank",
  "manage_treasury",
  "set_tax",
  "manage_guild_hall",
  "send_chat",
  "moderate_chat",
  "disband_guild",
];

function permissionMap(enabled: Partial<HarthmereGuildPermissionMap> = {}): HarthmereGuildPermissionMap {
  return Object.fromEntries(
    ALL_GUILD_PERMISSIONS.map((permission) => [permission, enabled[permission] === true])
  ) as HarthmereGuildPermissionMap;
}

export function leaderGuildPermissions(): HarthmereGuildPermissionMap {
  return permissionMap(Object.fromEntries(ALL_GUILD_PERMISSIONS.map((p) => [p, true])) as Partial<HarthmereGuildPermissionMap>);
}

export function officerGuildPermissions(): HarthmereGuildPermissionMap {
  return permissionMap({
    invite_members: true,
    manage_applications: true,
    manage_members: true,
    deposit_bank: true,
    withdraw_bank: true,
    manage_treasury: true,
    set_tax: true,
    manage_guild_hall: true,
    send_chat: true,
    moderate_chat: true,
  });
}

export function memberGuildPermissions(): HarthmereGuildPermissionMap {
  return permissionMap({ deposit_bank: true, send_chat: true });
}

export function recruitGuildPermissions(): HarthmereGuildPermissionMap {
  return permissionMap({ send_chat: true });
}

function defaultRanks(nowMs: number): Record<string, HarthmereGuildRank> {
  return {
    leader: {
      rankId: "leader",
      name: "Guild Leader",
      order: 100,
      permissions: leaderGuildPermissions(),
      dailyBankWithdrawLimitGoldValue: Number.MAX_SAFE_INTEGER,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    officer: {
      rankId: "officer",
      name: "Officer",
      order: 70,
      permissions: officerGuildPermissions(),
      dailyBankWithdrawLimitGoldValue: 500,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    member: {
      rankId: "member",
      name: "Member",
      order: 30,
      permissions: memberGuildPermissions(),
      dailyBankWithdrawLimitGoldValue: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    recruit: {
      rankId: "recruit",
      name: "Recruit",
      order: 10,
      permissions: recruitGuildPermissions(),
      dailyBankWithdrawLimitGoldValue: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
  };
}

export function defaultHarthmereLiveModeGuildState(): HarthmereLiveModeGuildState {
  return {
    treasury: 0,
    bank: {},
    projectContributions: {},
    guilds: {},
    nextGuildNumber: 1,
    nextApplicationNumber: 1,
    nextInviteNumber: 1,
    nextChatNumber: 1,
    nextLogNumber: 1,
  };
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveInteger(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const integer = Math.trunc(numeric);
  return integer > 0 ? integer : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const integer = Math.trunc(numeric);
  return integer >= 0 ? integer : undefined;
}

function normalizePermissionMap(raw: unknown, fallback: HarthmereGuildPermissionMap): HarthmereGuildPermissionMap {
  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  return Object.fromEntries(
    ALL_GUILD_PERMISSIONS.map((permission) => [permission, typeof record[permission] === "boolean" ? record[permission] === true : fallback[permission]])
  ) as HarthmereGuildPermissionMap;
}

function normalizeRank(raw: any, rankId: string, nowMs: number): HarthmereGuildRank {
  const defaults = defaultRanks(nowMs)[rankId] ?? {
    rankId,
    name: rankId.replace(/[_-]+/g, " "),
    order: 20,
    permissions: memberGuildPermissions(),
    dailyBankWithdrawLimitGoldValue: 0,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  return {
    ...defaults,
    ...(raw ?? {}),
    rankId,
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : defaults.name,
    order: Math.trunc(normalizeNumber(raw?.order, defaults.order)),
    permissions: normalizePermissionMap(raw?.permissions, defaults.permissions),
    dailyBankWithdrawLimitGoldValue: nonNegativeInteger(raw?.dailyBankWithdrawLimitGoldValue) ?? defaults.dailyBankWithdrawLimitGoldValue,
    createdAtMs: Math.trunc(normalizeNumber(raw?.createdAtMs, defaults.createdAtMs)),
    updatedAtMs: Math.trunc(normalizeNumber(raw?.updatedAtMs, defaults.updatedAtMs)),
  };
}

function normalizeRecordNumbers(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const numeric = Math.trunc(Number(value));
    if (Number.isFinite(numeric) && numeric > 0) out[key] = numeric;
  }
  return out;
}

export function normalizeHarthmereLiveModeGuildState(raw: unknown, nowMs: number): HarthmereLiveModeGuildState {
  const defaults = defaultHarthmereLiveModeGuildState();
  if (typeof raw !== "object" || raw === null) return defaults;
  const input = raw as any;
  const guilds: Record<string, HarthmereGuildRecord> = {};
  for (const [guildId, gRaw] of Object.entries((input.guilds ?? {}) as Record<string, any>)) {
    const ranksRaw = typeof gRaw?.ranks === "object" && gRaw.ranks !== null ? gRaw.ranks : {};
    const rankDefaults = defaultRanks(nowMs);
    const ranks: Record<string, HarthmereGuildRank> = {};
    for (const rankId of new Set([...Object.keys(rankDefaults), ...Object.keys(ranksRaw)])) {
      ranks[rankId] = normalizeRank(ranksRaw[rankId], rankId, nowMs);
    }
    const members: Record<string, HarthmereGuildMember> = {};
    if (typeof gRaw?.members === "object" && gRaw.members !== null) {
      for (const [actorId, memberRaw] of Object.entries(gRaw.members as Record<string, any>)) {
        const rankId = typeof memberRaw?.rankId === "string" && ranks[memberRaw.rankId] ? memberRaw.rankId : (actorId === gRaw?.leaderActorId ? "leader" : "member");
        members[actorId] = {
          actorId,
          displayName: typeof memberRaw?.displayName === "string" ? memberRaw.displayName.slice(0, 80) : undefined,
          rankId,
          joinedAtMs: Math.trunc(normalizeNumber(memberRaw?.joinedAtMs, nowMs)),
          lastSeenAtMs: Math.trunc(normalizeNumber(memberRaw?.lastSeenAtMs, nowMs)),
          status: memberRaw?.status === "inactive" || memberRaw?.status === "banned" ? memberRaw.status : "active",
          contributionXp: Math.max(0, Math.trunc(normalizeNumber(memberRaw?.contributionXp, 0))),
          mutedUntilMs: typeof memberRaw?.mutedUntilMs === "number" ? memberRaw.mutedUntilMs : undefined,
        };
      }
    }
    const bankRaw = typeof gRaw?.bank === "object" && gRaw.bank !== null ? gRaw.bank : {};
    const guild: HarthmereGuildRecord = {
      guildId,
      name: typeof gRaw?.name === "string" ? gRaw.name.slice(0, HARTHMERE_GUILD_MAX_NAME_LENGTH) : guildId,
      tag: typeof gRaw?.tag === "string" ? gRaw.tag.slice(0, HARTHMERE_GUILD_MAX_TAG_LENGTH).toUpperCase() : "GLD",
      description: typeof gRaw?.description === "string" ? gRaw.description.slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH) : "",
      type: isGuildType(gRaw?.type) ? gRaw.type : "adventuring",
      recruitment: isRecruitmentStatus(gRaw?.recruitment) ? gRaw.recruitment : "application",
      leaderActorId: typeof gRaw?.leaderActorId === "string" ? gRaw.leaderActorId : Object.keys(members)[0] ?? "unknown",
      createdAtMs: Math.trunc(normalizeNumber(gRaw?.createdAtMs, nowMs)),
      updatedAtMs: Math.trunc(normalizeNumber(gRaw?.updatedAtMs, nowMs)),
      level: Math.max(1, Math.trunc(normalizeNumber(gRaw?.level, 1))),
      xp: Math.max(0, Math.trunc(normalizeNumber(gRaw?.xp, 0))),
      treasuryGold: Math.max(0, Math.trunc(normalizeNumber(gRaw?.treasuryGold, 0))),
      taxRate: Math.max(0, Math.min(HARTHMERE_GUILD_MAX_TAX_RATE, Number(gRaw?.taxRate ?? 0))),
      ranks,
      members,
      applications: typeof gRaw?.applications === "object" && gRaw.applications !== null ? gRaw.applications as Record<string, HarthmereGuildApplication> : {},
      invites: typeof gRaw?.invites === "object" && gRaw.invites !== null ? gRaw.invites as Record<string, HarthmereGuildInvite> : {},
      bank: {
        items: normalizeRecordNumbers(bankRaw.items),
        maxSlots: Math.max(HARTHMERE_GUILD_BASE_BANK_SLOTS, Math.min(HARTHMERE_GUILD_BANK_MAX_SLOTS, Math.trunc(normalizeNumber(bankRaw.maxSlots, HARTHMERE_GUILD_BASE_BANK_SLOTS)))),
        logs: Array.isArray(bankRaw.logs) ? bankRaw.logs.slice(-HARTHMERE_GUILD_MAX_BANK_LOGS) as HarthmereGuildBankLog[] : [],
        dailyWithdrawals: typeof bankRaw.dailyWithdrawals === "object" && bankRaw.dailyWithdrawals !== null ? bankRaw.dailyWithdrawals as Record<string, { dayKey: string; goldValue: number }> : {},
      },
      treasuryLogs: Array.isArray(gRaw?.treasuryLogs) ? gRaw.treasuryLogs.slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS) as HarthmereGuildTreasuryLog[] : [],
      chatMessages: Array.isArray(gRaw?.chatMessages) ? gRaw.chatMessages.slice(-HARTHMERE_GUILD_MAX_CHAT_MESSAGES) as HarthmereGuildChatMessage[] : [],
      auditLogs: Array.isArray(gRaw?.auditLogs) ? gRaw.auditLogs.slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS) as HarthmereGuildAuditLog[] : [],
      guildHall: {
        status: gRaw?.guildHall?.status === "planned" || gRaw?.guildHall?.status === "under_construction" || gRaw?.guildHall?.status === "completed" ? gRaw.guildHall.status : "none",
        propertyId: typeof gRaw?.guildHall?.propertyId === "string" ? gRaw.guildHall.propertyId : undefined,
        plotId: typeof gRaw?.guildHall?.plotId === "string" ? gRaw.guildHall.plotId : undefined,
        blueprintId: typeof gRaw?.guildHall?.blueprintId === "string" ? gRaw.guildHall.blueprintId : undefined,
        servicesUnlocked: Array.isArray(gRaw?.guildHall?.servicesUnlocked) ? gRaw.guildHall.servicesUnlocked.filter((x: unknown): x is string => typeof x === "string") : [],
        linkedAtMs: typeof gRaw?.guildHall?.linkedAtMs === "number" ? gRaw.guildHall.linkedAtMs : undefined,
      },
      disbandedAtMs: typeof gRaw?.disbandedAtMs === "number" ? gRaw.disbandedAtMs : undefined,
    };
    if (!guild.members[guild.leaderActorId]) {
      guild.members[guild.leaderActorId] = {
        actorId: guild.leaderActorId,
        rankId: "leader",
        joinedAtMs: guild.createdAtMs,
        lastSeenAtMs: guild.updatedAtMs,
        status: "active",
        contributionXp: 0,
      };
    }
    guilds[guildId] = guild;
  }
  const memberGuildId = typeof input.memberGuildId === "string" ? input.memberGuildId : input.guildId;
  return {
    ...defaults,
    ...input,
    treasury: Math.max(0, Math.trunc(normalizeNumber(input.treasury, 0))),
    bank: normalizeRecordNumbers(input.bank),
    projectContributions: normalizeRecordNumbers(input.projectContributions),
    memberGuildId: memberGuildId && guilds[memberGuildId] ? memberGuildId : undefined,
    guildId: memberGuildId && guilds[memberGuildId] ? memberGuildId : (typeof input.guildId === "string" ? input.guildId : undefined),
    role: typeof input.role === "string" ? input.role : undefined,
    guilds,
    nextGuildNumber: Math.max(1, Math.trunc(normalizeNumber(input.nextGuildNumber, 1))),
    nextApplicationNumber: Math.max(1, Math.trunc(normalizeNumber(input.nextApplicationNumber, 1))),
    nextInviteNumber: Math.max(1, Math.trunc(normalizeNumber(input.nextInviteNumber, 1))),
    nextChatNumber: Math.max(1, Math.trunc(normalizeNumber(input.nextChatNumber, 1))),
    nextLogNumber: Math.max(1, Math.trunc(normalizeNumber(input.nextLogNumber, 1))),
  };
}

function isGuildType(value: unknown): value is HarthmereGuildType {
  return value === "adventuring" || value === "crafting" || value === "trade" || value === "social" || value === "pvp" || value === "civic";
}

function isRecruitmentStatus(value: unknown): value is HarthmereGuildRecruitmentStatus {
  return value === "open" || value === "application" || value === "invite_only" || value === "closed";
}

function normalizeGuildName(name: string | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ").slice(0, HARTHMERE_GUILD_MAX_NAME_LENGTH);
}

function normalizeGuildTag(tag: string | undefined) {
  return (tag ?? "").trim().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, HARTHMERE_GUILD_MAX_TAG_LENGTH);
}

const BANNED_GUILD_TERMS = /\b(admin|moderator|developer|biomes|harthmere\s*watch|gm|staff)\b/i;

export function validateHarthmereGuildIdentity(input: { name?: string; tag?: string }) {
  const name = normalizeGuildName(input.name);
  const tag = normalizeGuildTag(input.tag);
  const errors: string[] = [];
  if (name.length < 3 || name.length > HARTHMERE_GUILD_MAX_NAME_LENGTH) errors.push("invalid_name_length");
  if (!/^[a-z0-9][a-z0-9 '\-]{1,30}[a-z0-9]$/i.test(name)) errors.push("invalid_name_characters");
  if (tag.length < 2 || tag.length > HARTHMERE_GUILD_MAX_TAG_LENGTH) errors.push("invalid_tag_length");
  if (!/^[A-Z0-9]{2,6}$/.test(tag)) errors.push("invalid_tag_characters");
  if (BANNED_GUILD_TERMS.test(name) || BANNED_GUILD_TERMS.test(tag)) errors.push("reserved_or_impersonating_name");
  return { ok: errors.length === 0, errors, name, tag };
}

function makeGuildId(state: HarthmereLiveModeGuildState, tag: string) {
  const suffix = state.nextGuildNumber;
  return `guild_${tag.toLowerCase()}_${suffix}`;
}

export function findActorGuildId(state: HarthmereLiveModeGuildState, actorId: string) {
  for (const guild of Object.values(state.guilds)) {
    const member = guild.members[actorId];
    if (member && member.status !== "banned" && !guild.disbandedAtMs) {
      return guild.guildId;
    }
  }
  return undefined;
}

function currentActorGuild(state: HarthmereLiveModeGuildState, actorId: string, explicitGuildId?: string) {
  const guildId = explicitGuildId ?? findActorGuildId(state, actorId) ?? state.memberGuildId;
  return guildId ? state.guilds[guildId] : undefined;
}

export function hasHarthmereGuildPermission(guild: HarthmereGuildRecord | undefined, actorId: string, permission: HarthmereGuildPermission, nowMs = 0) {
  if (!guild || guild.disbandedAtMs) return false;
  const member = guild.members[actorId];
  if (!member || member.status !== "active") return false;
  if (permission === "send_chat" && member.mutedUntilMs && member.mutedUntilMs > nowMs) return false;
  if (guild.leaderActorId === actorId) return true;
  const rank = guild.ranks[member.rankId];
  return rank?.permissions[permission] === true;
}

function resolvedGuildPermissionsForActor(guild: HarthmereGuildRecord | undefined, actorId: string, nowMs: number) {
  if (!guild || guild.disbandedAtMs || !activeGuildMember(guild, actorId)) return recruitGuildPermissions();
  const member = guild.members[actorId];
  if (!member) return recruitGuildPermissions();
  const raw = guild.leaderActorId === actorId
    ? leaderGuildPermissions()
    : guild.ranks[member.rankId]?.permissions ?? recruitGuildPermissions();
  const permissions = { ...raw };
  if (member.mutedUntilMs && member.mutedUntilMs > nowMs) {
    permissions.send_chat = false;
  }
  return permissions;
}

function syncLegacyGuildSummary(state: HarthmereLiveModeGuildState, actorId: string) {
  const guildId = findActorGuildId(state, actorId);
  state.memberGuildId = guildId;
  state.guildId = guildId;
  if (!guildId) {
    state.role = undefined;
    state.treasury = 0;
    state.bank = {};
    return;
  }
  const guild = state.guilds[guildId];
  const member = guild.members[actorId];
  state.role = member?.rankId;
  state.treasury = guild.treasuryGold;
  state.bank = guild.bank.items;
}

function audit(state: HarthmereLiveModeGuildState, guild: HarthmereGuildRecord, actorId: string, kind: string, detail?: string, nowMs = Date.now()) {
  const id = `guild_log_${guild.guildId}_${state.nextLogNumber++}`;
  guild.auditLogs = [
    ...guild.auditLogs,
    { id, guildId: guild.guildId, actorId, kind, detail, atMs: nowMs },
  ].slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS);
  guild.updatedAtMs = nowMs;
}

function treasuryLog(state: HarthmereLiveModeGuildState, guild: HarthmereGuildRecord, actorId: string, kind: HarthmereGuildTreasuryLog["kind"], amountGold: number, reason: string | undefined, nowMs: number) {
  const id = `guild_treasury_${guild.guildId}_${state.nextLogNumber++}`;
  guild.treasuryLogs = [
    ...guild.treasuryLogs,
    { id, guildId: guild.guildId, actorId, kind, amountGold, reason, atMs: nowMs },
  ].slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS);
}

function guildBankLog(state: HarthmereLiveModeGuildState, guild: HarthmereGuildRecord, actorId: string, kind: HarthmereGuildBankLog["kind"], nowMs: number, extras: Partial<HarthmereGuildBankLog>) {
  const id = `guild_bank_${guild.guildId}_${state.nextLogNumber++}`;
  guild.bank.logs = [
    ...guild.bank.logs,
    { id, guildId: guild.guildId, actorId, kind, atMs: nowMs, ...extras },
  ].slice(-HARTHMERE_GUILD_MAX_BANK_LOGS);
}

function applyRecordDelta(target: Record<string, number>, key: string, delta: number) {
  const next = Math.max(0, (target[key] ?? 0) + Math.trunc(delta));
  if (next <= 0) delete target[key];
  else target[key] = next;
}

function usedSlots(items: Record<string, number>) {
  return Object.values(items).filter((count) => count > 0).length;
}

function defaultGuildBankCapacity(items: Record<string, number>, itemId: string, maxSlots: number) {
  return (items[itemId] ?? 0) > 0 || usedSlots(items) < maxSlots;
}

function todayKey(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function addGuildXp(guild: HarthmereGuildRecord, xpDelta: number) {
  const xp = Math.max(0, Math.trunc(xpDelta));
  if (xp <= 0) return;
  guild.xp += xp;
  guild.level = Math.max(1, 1 + Math.floor(guild.xp / HARTHMERE_GUILD_XP_PER_LEVEL));
}

function activeGuildMember(guild: HarthmereGuildRecord, actorId: string) {
  const member = guild.members[actorId];
  return member?.status === "active" ? member : undefined;
}

function activeGuildMemberCount(guild: HarthmereGuildRecord): number {
  return Object.values(guild.members).filter((member) => member.status === "active").length;
}

function guildAtMemberCap(guild: HarthmereGuildRecord): boolean {
  return activeGuildMemberCount(guild) >= HARTHMERE_GUILD_MAX_MEMBERS;
}

function guildRankOrder(guild: HarthmereGuildRecord, rankId: string | undefined) {
  return rankId ? guild.ranks[rankId]?.order ?? 0 : 0;
}

function canManageGuildMember(guild: HarthmereGuildRecord, actorId: string, targetActorId: string) {
  if (actorId === targetActorId) return false;
  const actorMember = activeGuildMember(guild, actorId);
  const targetMember = activeGuildMember(guild, targetActorId);
  if (!actorMember || !targetMember) return false;
  if (guild.leaderActorId === actorId) return targetActorId !== guild.leaderActorId;
  if (targetActorId === guild.leaderActorId) return false;
  return guildRankOrder(guild, actorMember.rankId) > guildRankOrder(guild, targetMember.rankId);
}

function canAssignGuildRank(guild: HarthmereGuildRecord, actorId: string, targetActorId: string, rankId: string) {
  if (rankId === "leader") return false;
  if (actorId === targetActorId) return false;
  const actorMember = activeGuildMember(guild, actorId);
  const targetMember = activeGuildMember(guild, targetActorId);
  const assignedRank = guild.ranks[rankId];
  if (!actorMember || !targetMember || !assignedRank) return false;
  if (targetActorId === guild.leaderActorId) return false;
  if (guild.leaderActorId === actorId) return true;
  const actorOrder = guildRankOrder(guild, actorMember.rankId);
  return actorOrder > guildRankOrder(guild, targetMember.rankId) && actorOrder > assignedRank.order;
}

function creditGuildContribution(guild: HarthmereGuildRecord, actorId: string, xpDelta: number, nowMs: number) {
  const xp = Math.max(0, Math.trunc(xpDelta));
  const member = activeGuildMember(guild, actorId);
  if (!member || xp <= 0) return;
  member.contributionXp += xp;
  member.lastSeenAtMs = Math.max(member.lastSeenAtMs, nowMs);
}

function closePendingGuildJoinRequestsForActor(
  state: HarthmereLiveModeGuildState,
  actorId: string,
  joinedGuildId: string,
  nowMs: number,
) {
  const changedGuilds: HarthmereGuildRecord[] = [];
  for (const guild of Object.values(state.guilds)) {
    let changed = false;
    for (const application of Object.values(guild.applications)) {
      if (application.applicantActorId === actorId && application.status === "pending") {
        application.status = "cancelled";
        application.decidedAtMs = nowMs;
        changed = true;
      }
    }
    for (const invite of Object.values(guild.invites)) {
      if (invite.targetActorId === actorId && invite.status === "pending" && guild.guildId !== joinedGuildId) {
        invite.status = "declined";
        invite.resolvedAtMs = nowMs;
        changed = true;
      }
    }
    if (changed) changedGuilds.push(guild);
  }
  return changedGuilds;
}

function guildDirectoryEntry(guild: HarthmereGuildRecord) {
  return {
    guildId: guild.guildId,
    name: guild.name,
    tag: guild.tag,
    description: guild.description,
    type: guild.type,
    recruitment: guild.recruitment,
    level: guild.level,
    xp: guild.xp,
    memberCount: Object.values(guild.members).filter((m) => m.status === "active").length,
    taxRate: guild.taxRate,
    hasGuildHall: guild.guildHall.status === "completed",
  };
}

export function createHarthmereLiveModeGuildClientSnapshot(state: HarthmereLiveModeGuildState, actorId: string) {
  const nowMs = Date.now();
  const memberGuildId = findActorGuildId(state, actorId) ?? state.memberGuildId;
  const myGuild = memberGuildId ? state.guilds[memberGuildId] : undefined;
  const member = myGuild?.members[actorId];
  return {
    actorId,
    memberGuildId,
    role: member?.rankId,
    permissions: resolvedGuildPermissionsForActor(myGuild, actorId, nowMs),
    guild: myGuild,
    finder: Object.values(state.guilds)
      .filter((guild) => !guild.disbandedAtMs && guild.recruitment !== "closed")
      .map(guildDirectoryEntry)
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
    pendingApplications: Object.values(state.guilds).flatMap((guild) =>
      Object.values(guild.applications).filter((app) => app.applicantActorId === actorId && app.status === "pending")
    ),
    pendingInvites: Object.values(state.guilds).flatMap((guild) =>
      Object.values(guild.invites).filter((invite) => invite.targetActorId === actorId && invite.status === "pending" && invite.expiresAtMs > Date.now())
    ),
  };
}

function reject(result: HarthmereGuildMutationResult, code: string, touched = "guild_rejection") {
  result.warnings.push(`guild_rejected:${code}`);
  result.touchedModels.push(touched);
}

export function reduceHarthmereGuildMutation(
  state: HarthmereLiveModeGuildState,
  request: HarthmereGuildMutationRequest,
  context: HarthmereGuildMutationContext,
): HarthmereGuildMutationResult {
  const next = normalizeHarthmereLiveModeGuildState(JSON.parse(JSON.stringify(state ?? defaultHarthmereLiveModeGuildState())), request.nowMs);
  const result: HarthmereGuildMutationResult = {
    guild: next,
    warnings: [],
    touchedModels: [],
    sharedGuildIds: [],
    inventoryGoldDelta: 0,
    inventoryItemDeltas: {},
  };
  const op = request.operation || "noop";
  const currentGuild = currentActorGuild(next, request.actorId, request.guildId);

  const markGuild = (guild: HarthmereGuildRecord, model = "guild_state") => {
    guild.updatedAtMs = request.nowMs;
    next.guilds[guild.guildId] = guild;
    if (!result.sharedGuildIds.includes(guild.guildId)) result.sharedGuildIds.push(guild.guildId);
    if (!result.touchedModels.includes(model)) result.touchedModels.push(model);
  };

  if (op === "noop" || op === "find_guilds") {
    result.touchedModels.push("guild_finder");
    syncLegacyGuildSummary(next, request.actorId);
    return result;
  }

  if (op === "create_guild") {
    const identity = validateHarthmereGuildIdentity({ name: request.name, tag: request.tag });
    if (!identity.ok) {
      for (const error of identity.errors) reject(result, error);
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    if (findActorGuildId(next, request.actorId)) {
      reject(result, "already_in_guild");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    const actorLevel = Math.trunc(normalizeNumber(context.actorLevel, 0));
    if (actorLevel < HARTHMERE_GUILD_CREATION_MIN_LEVEL) {
      reject(result, "below_minimum_level");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    if ((context.actorGuildRestrictedUntilMs ?? 0) > request.nowMs) {
      reject(result, "actor_guild_restricted");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    if ((context.actorGuildCreationCooldownUntilMs ?? 0) > request.nowMs) {
      reject(result, "guild_creation_cooldown_active");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    const duplicate = Object.values(next.guilds).find((guild) =>
      !guild.disbandedAtMs && (guild.name.toLowerCase() === identity.name.toLowerCase() || guild.tag === identity.tag)
    );
    if (duplicate) {
      reject(result, duplicate.tag === identity.tag ? "tag_already_taken" : "name_already_taken");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    if (context.actorGold < HARTHMERE_GUILD_CREATION_FEE_GOLD) {
      reject(result, "not_enough_gold_for_charter");
      syncLegacyGuildSummary(next, request.actorId);
      return result;
    }
    const guildId = makeGuildId(next, identity.tag);
    next.nextGuildNumber += 1;
    const ranks = defaultRanks(request.nowMs);
    const guild: HarthmereGuildRecord = {
      guildId,
      name: identity.name,
      tag: identity.tag,
      description: (request.description ?? "").trim().slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH),
      type: request.guildType ?? "adventuring",
      recruitment: request.recruitment ?? "application",
      leaderActorId: request.actorId,
      createdAtMs: request.nowMs,
      updatedAtMs: request.nowMs,
      level: 1,
      xp: 0,
      treasuryGold: 0,
      taxRate: 0,
      ranks,
      members: {
        [request.actorId]: {
          actorId: request.actorId,
          displayName: request.displayName,
          rankId: "leader",
          joinedAtMs: request.nowMs,
          lastSeenAtMs: request.nowMs,
          status: "active",
          contributionXp: 0,
        },
      },
      applications: {},
      invites: {},
      bank: {
        items: {},
        maxSlots: HARTHMERE_GUILD_BASE_BANK_SLOTS,
        logs: [],
        dailyWithdrawals: {},
      },
      treasuryLogs: [],
      chatMessages: [],
      auditLogs: [],
      guildHall: { status: "none", servicesUnlocked: [] },
    };
    treasuryLog(next, guild, request.actorId, "guild_creation_fee", -HARTHMERE_GUILD_CREATION_FEE_GOLD, "Guild charter filing fee", request.nowMs);
    audit(next, guild, request.actorId, "guild_created", `${identity.name} [${identity.tag}]`, request.nowMs);
    next.guilds[guildId] = guild;
    next.memberGuildId = guildId;
    result.inventoryGoldDelta -= HARTHMERE_GUILD_CREATION_FEE_GOLD;
    markGuild(guild, "guild_created");
    result.touchedModels.push("wallet", "guild_directory", "guild_member");
    syncLegacyGuildSummary(next, request.actorId);
    return result;
  }

  const guild = currentGuild ?? (request.guildId ? next.guilds[request.guildId] : undefined);
  if (!guild || guild.disbandedAtMs) {
    reject(result, "guild_not_found");
    syncLegacyGuildSummary(next, request.actorId);
    return result;
  }

  if (op === "update_profile") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_guild_hall", request.nowMs)) {
      reject(result, "missing_permission:manage_guild_hall");
    } else {
      if (typeof request.description === "string") guild.description = request.description.trim().slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH);
      if (request.recruitment && isRecruitmentStatus(request.recruitment)) guild.recruitment = request.recruitment;
      if (request.guildType && isGuildType(request.guildType)) guild.type = request.guildType;
      audit(next, guild, request.actorId, "guild_profile_updated", undefined, request.nowMs);
      markGuild(guild, "guild_profile");
    }
  } else if (op === "apply_to_guild") {
    if (findActorGuildId(next, request.actorId)) {
      reject(result, "already_in_guild");
    } else if (guild.recruitment !== "open" && guild.recruitment !== "application") {
      reject(result, "applications_closed");
    } else if (Object.values(guild.applications).some((app) => app.applicantActorId === request.actorId && app.status === "pending")) {
      reject(result, "application_already_pending");
    } else if (guild.recruitment === "open" && guildAtMemberCap(guild)) {
      reject(result, "guild_member_cap_reached");
    } else if (guild.recruitment === "open") {
      guild.members[request.actorId] = {
        actorId: request.actorId,
        displayName: request.displayName,
        rankId: "member",
        joinedAtMs: request.nowMs,
        lastSeenAtMs: request.nowMs,
        status: "active",
        contributionXp: 0,
      };
      audit(next, guild, request.actorId, "member_joined_open_recruitment", undefined, request.nowMs);
      markGuild(guild, "guild_member");
      for (const changedGuild of closePendingGuildJoinRequestsForActor(next, request.actorId, guild.guildId, request.nowMs)) {
        markGuild(changedGuild, "guild_recruitment_state");
      }
    } else {
      const applicationId = `guild_app_${next.nextApplicationNumber++}`;
      guild.applications[applicationId] = {
        applicationId,
        guildId: guild.guildId,
        applicantActorId: request.actorId,
        applicantDisplayName: request.displayName,
        message: request.message?.trim().slice(0, 500),
        status: "pending",
        createdAtMs: request.nowMs,
      };
      audit(next, guild, request.actorId, "application_submitted", applicationId, request.nowMs);
      markGuild(guild, "guild_application");
    }
  } else if (op === "cancel_application") {
    const application = request.applicationId ? guild.applications[request.applicationId] : Object.values(guild.applications).find((app) => app.applicantActorId === request.actorId && app.status === "pending");
    if (!application || application.applicantActorId !== request.actorId || application.status !== "pending") reject(result, "application_not_found");
    else {
      application.status = "cancelled";
      application.decidedAtMs = request.nowMs;
      audit(next, guild, request.actorId, "application_cancelled", application.applicationId, request.nowMs);
      markGuild(guild, "guild_application");
    }
  } else if (op === "accept_application" || op === "reject_application") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_applications", request.nowMs)) reject(result, "missing_permission:manage_applications");
    else {
      const application = request.applicationId ? guild.applications[request.applicationId] : undefined;
      if (!application || application.status !== "pending") reject(result, "application_not_found");
      else if (op === "accept_application" && findActorGuildId(next, application.applicantActorId)) reject(result, "applicant_already_in_guild");
      else if (op === "accept_application" && guildAtMemberCap(guild)) reject(result, "guild_member_cap_reached");
      else {
        application.status = op === "accept_application" ? "accepted" : "rejected";
        application.decidedAtMs = request.nowMs;
        application.decidedByActorId = request.actorId;
        if (op === "accept_application") {
          guild.members[application.applicantActorId] = {
            actorId: application.applicantActorId,
            displayName: application.applicantDisplayName,
            rankId: "member",
            joinedAtMs: request.nowMs,
            lastSeenAtMs: request.nowMs,
            status: "active",
            contributionXp: 0,
          };
          for (const changedGuild of closePendingGuildJoinRequestsForActor(next, application.applicantActorId, guild.guildId, request.nowMs)) {
            markGuild(changedGuild, "guild_recruitment_state");
          }
        }
        audit(next, guild, request.actorId, op, application.applicationId, request.nowMs);
        markGuild(guild, "guild_application");
        if (op === "accept_application") result.touchedModels.push("guild_member");
      }
    }
  } else if (op === "invite_member") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "invite_members", request.nowMs)) reject(result, "missing_permission:invite_members");
    else if (!request.targetActorId) reject(result, "missing_target_actor_id");
    else if (findActorGuildId(next, request.targetActorId)) reject(result, "target_already_in_guild");
    else if (Object.values(guild.invites).some((invite) => invite.targetActorId === request.targetActorId && invite.status === "pending" && invite.expiresAtMs > request.nowMs)) reject(result, "invite_already_pending");
    else {
      const inviteId = `guild_invite_${next.nextInviteNumber++}`;
      guild.invites[inviteId] = {
        inviteId,
        guildId: guild.guildId,
        targetActorId: request.targetActorId,
        targetDisplayName: request.displayName,
        invitedByActorId: request.actorId,
        status: "pending",
        createdAtMs: request.nowMs,
        expiresAtMs: request.nowMs + 7 * 24 * 60 * 60 * 1000,
      };
      audit(next, guild, request.actorId, "invite_created", `${inviteId}:${request.targetActorId}`, request.nowMs);
      markGuild(guild, "guild_invite");
    }
  } else if (op === "accept_invite" || op === "decline_invite") {
    const invite = request.inviteId ? guild.invites[request.inviteId] : Object.values(guild.invites).find((i) => i.targetActorId === request.actorId && i.status === "pending");
    if (!invite || invite.targetActorId !== request.actorId || invite.status !== "pending") reject(result, "invite_not_found");
    else if (invite.expiresAtMs <= request.nowMs) {
      invite.status = "expired";
      reject(result, "invite_expired");
      markGuild(guild, "guild_invite");
    } else if (op === "accept_invite" && findActorGuildId(next, request.actorId)) reject(result, "already_in_guild");
    else if (op === "accept_invite" && guildAtMemberCap(guild)) reject(result, "guild_member_cap_reached");
    else {
      invite.status = op === "accept_invite" ? "accepted" : "declined";
      invite.resolvedAtMs = request.nowMs;
      if (op === "accept_invite") {
        guild.members[request.actorId] = {
          actorId: request.actorId,
          displayName: invite.targetDisplayName,
          rankId: "member",
          joinedAtMs: request.nowMs,
          lastSeenAtMs: request.nowMs,
          status: "active",
          contributionXp: 0,
        };
        for (const changedGuild of closePendingGuildJoinRequestsForActor(next, request.actorId, guild.guildId, request.nowMs)) {
          markGuild(changedGuild, "guild_recruitment_state");
        }
      }
      audit(next, guild, request.actorId, op, invite.inviteId, request.nowMs);
      markGuild(guild, "guild_invite");
      if (op === "accept_invite") result.touchedModels.push("guild_member");
    }
  } else if (op === "leave_guild") {
    const member = guild.members[request.actorId];
    if (!member) reject(result, "not_a_member");
    else if (guild.leaderActorId === request.actorId && Object.keys(guild.members).filter((id) => guild.members[id].status === "active").length > 1) reject(result, "leader_must_transfer_or_disband_first");
    // A solo leader leaving disbands the guild — but must first empty the treasury/bank,
    // exactly like disband_guild. Otherwise the deposited gold/items are orphaned in a
    // disbanded guild record no one can ever recover (a player loss-of-funds bug).
    else if (guild.leaderActorId === request.actorId && (guild.treasuryGold > 0 || Object.values(guild.bank.items).some((count) => count > 0))) reject(result, "leader_must_empty_before_leaving");
    else {
      delete guild.members[request.actorId];
      audit(next, guild, request.actorId, "member_left", undefined, request.nowMs);
      if (guild.leaderActorId === request.actorId) guild.disbandedAtMs = request.nowMs;
      markGuild(guild, "guild_member");
    }
  } else if (op === "kick_member") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_members", request.nowMs)) reject(result, "missing_permission:manage_members");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    else if (request.targetActorId === guild.leaderActorId) reject(result, "cannot_kick_leader");
    else if (!canManageGuildMember(guild, request.actorId, request.targetActorId)) reject(result, "cannot_manage_equal_or_higher_rank");
    else {
      delete guild.members[request.targetActorId];
      audit(next, guild, request.actorId, "member_kicked", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "transfer_leader") {
    if (guild.leaderActorId !== request.actorId) reject(result, "only_leader_can_transfer");
    else if (!request.targetActorId || !activeGuildMember(guild, request.targetActorId)) reject(result, "member_not_found");
    else if (request.targetActorId === request.actorId) reject(result, "cannot_transfer_to_self");
    else {
      guild.members[request.actorId].rankId = "officer";
      guild.members[request.targetActorId].rankId = "leader";
      guild.leaderActorId = request.targetActorId;
      audit(next, guild, request.actorId, "leader_transferred", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "create_rank" || op === "update_rank") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_ranks", request.nowMs)) reject(result, "missing_permission:manage_ranks");
    else {
      const rankSlug = (request.rankName ?? "custom").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "custom";
      let rankId = op === "create_rank" ? `rank_${rankSlug}_${Object.keys(guild.ranks).length + 1}` : request.rankId;
      let rankSuffix = Object.keys(guild.ranks).length + 2;
      while (op === "create_rank" && rankId && guild.ranks[rankId]) {
        rankId = `rank_${rankSlug}_${rankSuffix++}`;
      }
      const rankName = (request.rankName ?? guild.ranks[rankId ?? ""]?.name ?? "Custom Rank").trim().slice(0, 40);
      if (!rankId) reject(result, "missing_rank_id");
      else if ((rankId === "leader" || rankId === "officer" || rankId === "member" || rankId === "recruit") && op === "create_rank") reject(result, "reserved_rank_id");
      else if (op === "update_rank" && !guild.ranks[rankId]) reject(result, "rank_not_found");
      else if (rankName.length < 2) reject(result, "invalid_rank_name");
      else {
        const existing = guild.ranks[rankId];
        guild.ranks[rankId] = {
          rankId,
          name: rankName,
          order: existing?.order ?? 25,
          permissions: normalizePermissionMap(request.permissions, existing?.permissions ?? memberGuildPermissions()),
          dailyBankWithdrawLimitGoldValue: nonNegativeInteger(request.dailyBankWithdrawLimitGoldValue) ?? existing?.dailyBankWithdrawLimitGoldValue ?? 0,
          createdAtMs: existing?.createdAtMs ?? request.nowMs,
          updatedAtMs: request.nowMs,
        };
        audit(next, guild, request.actorId, op, rankId, request.nowMs);
        markGuild(guild, "guild_rank");
      }
    }
  } else if (op === "delete_rank") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_ranks", request.nowMs)) reject(result, "missing_permission:manage_ranks");
    else if (!request.rankId || !guild.ranks[request.rankId]) reject(result, "rank_not_found");
    else if (["leader", "officer", "member", "recruit"].includes(request.rankId)) reject(result, "cannot_delete_system_rank");
    else if (Object.values(guild.members).some((member) => member.rankId === request.rankId)) reject(result, "rank_in_use");
    else {
      delete guild.ranks[request.rankId];
      audit(next, guild, request.actorId, "rank_deleted", request.rankId, request.nowMs);
      markGuild(guild, "guild_rank");
    }
  } else if (op === "assign_rank") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_members", request.nowMs)) reject(result, "missing_permission:manage_members");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    else if (!request.rankId || !guild.ranks[request.rankId]) reject(result, "rank_not_found");
    else if (request.rankId === "leader") reject(result, "use_transfer_leader_for_leader_rank");
    else if (request.targetActorId === guild.leaderActorId && request.rankId !== "leader") reject(result, "cannot_demote_leader_without_transfer");
    else if (!canAssignGuildRank(guild, request.actorId, request.targetActorId, request.rankId)) reject(result, "cannot_assign_equal_or_higher_rank");
    else {
      guild.members[request.targetActorId].rankId = request.rankId;
      guild.members[request.targetActorId].lastSeenAtMs = request.nowMs;
      audit(next, guild, request.actorId, "rank_assigned", `${request.targetActorId}:${request.rankId}`, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "treasury_deposit") {
    const amount = positiveInteger(request.amountGold);
    if (!activeGuildMember(guild, request.actorId)) reject(result, "not_a_member");
    else if (amount === undefined) reject(result, "invalid_gold_amount");
    else if (context.actorGold < amount) reject(result, "not_enough_gold");
    else {
      guild.treasuryGold += amount;
      result.inventoryGoldDelta -= amount;
      treasuryLog(next, guild, request.actorId, "deposit", amount, request.reason, request.nowMs);
      const contributionXp = Math.max(1, Math.floor(amount / 10));
      addGuildXp(guild, contributionXp);
      creditGuildContribution(guild, request.actorId, contributionXp, request.nowMs);
      audit(next, guild, request.actorId, "treasury_deposit", String(amount), request.nowMs);
      markGuild(guild, "guild_treasury");
      result.touchedModels.push("wallet", "guild_level");
    }
  } else if (op === "treasury_withdraw") {
    const amount = positiveInteger(request.amountGold);
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_treasury", request.nowMs)) reject(result, "missing_permission:manage_treasury");
    else if (amount === undefined) reject(result, "invalid_gold_amount");
    else if (guild.treasuryGold < amount) reject(result, "guild_treasury_insufficient");
    else {
      guild.treasuryGold -= amount;
      result.inventoryGoldDelta += amount;
      treasuryLog(next, guild, request.actorId, "withdraw", -amount, request.reason, request.nowMs);
      audit(next, guild, request.actorId, "treasury_withdraw", String(amount), request.nowMs);
      markGuild(guild, "guild_treasury");
      result.touchedModels.push("wallet");
    }
  } else if (op === "set_tax") {
    const taxRate = Number(request.taxRate ?? NaN);
    if (!hasHarthmereGuildPermission(guild, request.actorId, "set_tax", request.nowMs)) reject(result, "missing_permission:set_tax");
    else if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > HARTHMERE_GUILD_MAX_TAX_RATE) reject(result, "invalid_tax_rate");
    else {
      guild.taxRate = Math.round(taxRate * 10000) / 10000;
      audit(next, guild, request.actorId, "tax_rate_set", String(guild.taxRate), request.nowMs);
      markGuild(guild, "guild_tax");
    }
  } else if (op === "collect_tax") {
    const taxable = positiveInteger(request.amountGold);
    if (!context.trustedTaxCollection) reject(result, "tax_collection_not_server_authorized");
    else if (taxable === undefined) reject(result, "invalid_taxable_gold_amount");
    // Bind tax collection to the actor's own guild. The target guild is otherwise
    // attacker-controllable via request.guildId, letting a trusted tax call credit an
    // arbitrary guild the actor doesn't belong to.
    else if (!activeGuildMember(guild, request.actorId)) reject(result, "tax_collector_not_a_member");
    else {
      const tax = Math.floor(taxable * guild.taxRate);
      if (tax <= 0) reject(result, "no_tax_due");
      else {
        guild.treasuryGold += tax;
        treasuryLog(next, guild, request.actorId, "tax", tax, request.reason, request.nowMs);
        creditGuildContribution(guild, request.actorId, tax, request.nowMs);
        audit(next, guild, request.actorId, "tax_collected", String(tax), request.nowMs);
        markGuild(guild, "guild_tax");
      }
    }
  } else if (op === "guild_bank_deposit" || op === "guild_bank_withdraw") {
    const itemId = request.itemId;
    const count = positiveInteger(request.count);
    const itemUnitGoldValue = positiveInteger(request.itemGoldValue);
    const itemGoldValue = count !== undefined ? (itemUnitGoldValue ?? 1) * count : undefined;
    if (!itemId) reject(result, "missing_item_id");
    else if (count === undefined) reject(result, "invalid_item_count");
    else if (itemGoldValue === undefined) reject(result, "invalid_item_gold_value");
    else if (op === "guild_bank_deposit") {
      if (!hasHarthmereGuildPermission(guild, request.actorId, "deposit_bank", request.nowMs)) reject(result, "missing_permission:deposit_bank");
      else if ((context.actorInventoryItems[itemId] ?? 0) < count) reject(result, "insufficient_item_count");
      else if (context.canDepositItem && !context.canDepositItem(itemId)) reject(result, "item_not_depositable");
      else if (!(context.guildBankHasCapacity ?? defaultGuildBankCapacity)(guild.bank.items, itemId, guild.bank.maxSlots)) reject(result, "guild_bank_full");
      else {
        applyRecordDelta(guild.bank.items, itemId, count);
        result.inventoryItemDeltas[itemId] = (result.inventoryItemDeltas[itemId] ?? 0) - count;
        guildBankLog(next, guild, request.actorId, "deposit", request.nowMs, { itemId, count, goldValue: itemGoldValue });
        const contributionXp = Math.max(1, Math.floor(itemGoldValue / 10));
        addGuildXp(guild, contributionXp);
        creditGuildContribution(guild, request.actorId, contributionXp, request.nowMs);
        audit(next, guild, request.actorId, "guild_bank_deposit", `${itemId}:${count}`, request.nowMs);
        markGuild(guild, "guild_bank");
        result.touchedModels.push("inventory_items", "guild_level");
      }
    } else {
      if (!hasHarthmereGuildPermission(guild, request.actorId, "withdraw_bank", request.nowMs)) reject(result, "missing_permission:withdraw_bank");
      else if ((guild.bank.items[itemId] ?? 0) < count) reject(result, "guild_bank_insufficient_item_count");
      else if (context.canWithdrawToInventory && !context.canWithdrawToInventory(itemId, count)) reject(result, "carry_weight_limit_exceeded");
      else {
        const member = guild.members[request.actorId];
        const rank = member ? guild.ranks[member.rankId] : undefined;
        const dayKey = todayKey(request.nowMs);
        const ledger = guild.bank.dailyWithdrawals[request.actorId] ?? { dayKey, goldValue: 0 };
        if (ledger.dayKey !== dayKey) {
          ledger.dayKey = dayKey;
          ledger.goldValue = 0;
        }
        const limit = rank?.dailyBankWithdrawLimitGoldValue ?? 0;
        if (limit !== Number.MAX_SAFE_INTEGER && ledger.goldValue + itemGoldValue > limit) reject(result, "daily_withdraw_limit_exceeded");
        else {
          ledger.goldValue += itemGoldValue;
          guild.bank.dailyWithdrawals[request.actorId] = ledger;
          applyRecordDelta(guild.bank.items, itemId, -count);
          result.inventoryItemDeltas[itemId] = (result.inventoryItemDeltas[itemId] ?? 0) + count;
          guildBankLog(next, guild, request.actorId, "withdraw", request.nowMs, { itemId, count, goldValue: itemGoldValue });
          audit(next, guild, request.actorId, "guild_bank_withdraw", `${itemId}:${count}`, request.nowMs);
          markGuild(guild, "guild_bank");
          result.touchedModels.push("inventory_items");
        }
      }
    }
  } else if (op === "upgrade_guild_bank_slots") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_treasury", request.nowMs)) reject(result, "missing_permission:manage_treasury");
    else if (guild.bank.maxSlots >= HARTHMERE_GUILD_BANK_MAX_SLOTS) reject(result, "guild_bank_max_slots_reached");
    else {
      const upgradeNumber = Math.floor((guild.bank.maxSlots - HARTHMERE_GUILD_BASE_BANK_SLOTS) / HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE);
      const cost = 200 + upgradeNumber * 150;
      if (guild.treasuryGold < cost) reject(result, "guild_treasury_insufficient");
      else {
        guild.treasuryGold -= cost;
        guild.bank.maxSlots = Math.min(HARTHMERE_GUILD_BANK_MAX_SLOTS, guild.bank.maxSlots + HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE);
        treasuryLog(next, guild, request.actorId, "bank_slot_upgrade", -cost, "Guild bank slot upgrade", request.nowMs);
        guildBankLog(next, guild, request.actorId, "slot_upgrade", request.nowMs, { goldValue: cost });
        audit(next, guild, request.actorId, "guild_bank_upgraded", String(guild.bank.maxSlots), request.nowMs);
        markGuild(guild, "guild_bank_slots");
      }
    }
  } else if (op === "add_xp") {
    const xpDelta = positiveInteger(request.xpDelta);
    if (!context.trustedGuildXpGrant) reject(result, "xp_grant_not_server_authorized");
    else if (xpDelta === undefined) reject(result, "invalid_xp_delta");
    else {
      const boundedXpDelta = Math.min(5000, xpDelta);
      addGuildXp(guild, boundedXpDelta);
      creditGuildContribution(guild, request.actorId, boundedXpDelta, request.nowMs);
      audit(next, guild, request.actorId, "guild_xp_added", String(boundedXpDelta), request.nowMs);
      markGuild(guild, "guild_level");
    }
  } else if (op === "link_guild_hall") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "manage_guild_hall", request.nowMs)) reject(result, "missing_permission:manage_guild_hall");
    else if (!request.propertyId) reject(result, "missing_property_id");
    else if (context.canLinkGuildHallProperty && !context.canLinkGuildHallProperty({
      guildId: guild.guildId,
      actorId: request.actorId,
      propertyId: request.propertyId,
      plotId: request.plotId,
      blueprintId: request.blueprintId,
    })) reject(result, "guild_hall_property_not_owned_or_invalid");
    else {
      guild.guildHall = {
        propertyId: request.propertyId,
        plotId: request.plotId,
        blueprintId: request.blueprintId,
        status: "completed",
        servicesUnlocked: ["guild_bank", "charter_board", "project_board", "member_storage", "guild_chat_anchor"],
        linkedAtMs: request.nowMs,
      };
      audit(next, guild, request.actorId, "guild_hall_linked", request.propertyId, request.nowMs);
      markGuild(guild, "guild_hall");
    }
  } else if (op === "send_chat") {
    const body = (request.message ?? "").trim();
    const channel = request.channel ?? "guild";
    if (!hasHarthmereGuildPermission(guild, request.actorId, "send_chat", request.nowMs)) reject(result, "missing_permission:send_chat_or_muted");
    else if (channel === "officer" && !hasHarthmereGuildPermission(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:officer_chat");
    else if (body.length < 1) reject(result, "empty_chat_message");
    else if (body.length > HARTHMERE_GUILD_MAX_CHAT_MESSAGE_LENGTH) reject(result, "chat_message_too_long");
    else {
      const member = guild.members[request.actorId];
      const messageId = `guild_chat_${next.nextChatNumber++}`;
      guild.chatMessages = [
        ...guild.chatMessages,
        { messageId, guildId: guild.guildId, actorId: request.actorId, displayName: member?.displayName, channel, body, createdAtMs: request.nowMs },
      ].slice(-HARTHMERE_GUILD_MAX_CHAT_MESSAGES);
      markGuild(guild, "guild_chat");
    }
  } else if (op === "delete_chat_message") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:moderate_chat");
    else {
      const message = guild.chatMessages.find((m) => m.messageId === request.message);
      if (!message || message.deletedAtMs) reject(result, "chat_message_not_found");
      else {
        message.deletedAtMs = request.nowMs;
        message.deletedByActorId = request.actorId;
        audit(next, guild, request.actorId, "chat_message_deleted", message.messageId, request.nowMs);
        markGuild(guild, "guild_chat");
      }
    }
  } else if (op === "mute_member") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:moderate_chat");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    // A moderator may not mute the leader or an equal/higher rank — otherwise an officer
    // can silence the guild leader.
    else if (!canManageGuildMember(guild, request.actorId, request.targetActorId)) reject(result, "cannot_manage_equal_or_higher_rank");
    else {
      const durationMs = Math.min(
        HARTHMERE_GUILD_MAX_MUTE_DURATION_MS,
        Math.max(60_000, positiveInteger(request.amountGold) ?? 300_000),
      );
      guild.members[request.targetActorId].mutedUntilMs = request.nowMs + durationMs;
      audit(next, guild, request.actorId, "member_muted", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_chat_moderation");
    }
  } else if (op === "disband_guild") {
    if (!hasHarthmereGuildPermission(guild, request.actorId, "disband_guild", request.nowMs) || guild.leaderActorId !== request.actorId) reject(result, "only_leader_can_disband");
    else if (Object.values(guild.bank.items).some((count) => count > 0)) reject(result, "guild_bank_not_empty");
    else if (guild.treasuryGold > 0) reject(result, "guild_treasury_not_empty");
    else {
      guild.disbandedAtMs = request.nowMs;
      audit(next, guild, request.actorId, "guild_disbanded", undefined, request.nowMs);
      markGuild(guild, "guild_disbanded");
      result.touchedModels.push("guild_directory");
    }
  } else {
    reject(result, `unsupported_operation:${op}`);
  }

  syncLegacyGuildSummary(next, request.actorId);
  return result;
}

export function linkHarthmereGuildHallProperty(input: {
  state: HarthmereLiveModeGuildState;
  guildId: string | undefined;
  actorId: string;
  propertyId: string;
  plotId?: string;
  blueprintId?: string;
  nowMs: number;
}): { state: HarthmereLiveModeGuildState; changed: boolean } {
  const state = normalizeHarthmereLiveModeGuildState(input.state, input.nowMs);
  if (!input.guildId || !state.guilds[input.guildId]) return { state, changed: false };
  const guild = state.guilds[input.guildId];
  guild.guildHall = {
    propertyId: input.propertyId,
    plotId: input.plotId,
    blueprintId: input.blueprintId,
    status: "completed",
    servicesUnlocked: ["guild_bank", "charter_board", "project_board", "member_storage", "guild_chat_anchor"],
    linkedAtMs: input.nowMs,
  };
  audit(state, guild, input.actorId, "guild_hall_linked_from_building_system", input.propertyId, input.nowMs);
  state.guilds[guild.guildId] = guild;
  syncLegacyGuildSummary(state, input.actorId);
  return { state, changed: true };
}
