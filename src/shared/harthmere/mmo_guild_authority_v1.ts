/*
 * mmo_guild_authority_v1.ts
 *
 * Server-authoritative Guild System model and reducer for Harthmere live mode.
 * This module intentionally contains no React/localStorage assumptions. Guilds
 * are persisted as backend state and mirrored through shared guild state keys.
 */

export const HARTHMERE_GUILD_AUTHORITY_VERSION_V1 = "harthmere-guild-authority-v1";

export const HARTHMERE_GUILD_CREATION_FEE_GOLD_V1 = 250;
export const HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1 = 10;
export const HARTHMERE_GUILD_BASE_BANK_SLOTS_V1 = 48;
export const HARTHMERE_GUILD_BANK_MAX_SLOTS_V1 = 240;
export const HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE_V1 = 12;
export const HARTHMERE_GUILD_MAX_TAX_RATE_V1 = 0.1;
export const HARTHMERE_GUILD_XP_PER_LEVEL_V1 = 500;
export const HARTHMERE_GUILD_MAX_NAME_LENGTH_V1 = 32;
export const HARTHMERE_GUILD_MAX_TAG_LENGTH_V1 = 6;
export const HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH_V1 = 500;
export const HARTHMERE_GUILD_MAX_CHAT_MESSAGE_LENGTH_V1 = 500;
export const HARTHMERE_GUILD_MAX_AUDIT_LOGS_V1 = 200;
export const HARTHMERE_GUILD_MAX_CHAT_MESSAGES_V1 = 100;
export const HARTHMERE_GUILD_MAX_BANK_LOGS_V1 = 200;
export const HARTHMERE_GUILD_MAX_MUTE_DURATION_MS_V1 = 7 * 24 * 60 * 60 * 1000;
export const HARTHMERE_GUILD_MAX_MEMBERS_V1 = 100;

export type HarthmereGuildTypeV1 =
  | "adventuring"
  | "crafting"
  | "trade"
  | "social"
  | "pvp"
  | "civic";

export type HarthmereGuildRecruitmentStatusV1 = "open" | "application" | "invite_only" | "closed";
export type HarthmereGuildApplicationStatusV1 = "pending" | "accepted" | "rejected" | "cancelled";
export type HarthmereGuildInviteStatusV1 = "pending" | "accepted" | "expired" | "revoked" | "declined";
export type HarthmereGuildMemberStatusV1 = "active" | "inactive" | "banned";

export type HarthmereGuildPermissionV1 =
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

export type HarthmereGuildPermissionMapV1 = Record<HarthmereGuildPermissionV1, boolean>;

export interface HarthmereGuildRankV1 {
  rankId: string;
  name: string;
  order: number;
  permissions: HarthmereGuildPermissionMapV1;
  dailyBankWithdrawLimitGoldValue: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface HarthmereGuildMemberV1 {
  actorId: string;
  displayName?: string;
  rankId: string;
  joinedAtMs: number;
  lastSeenAtMs: number;
  status: HarthmereGuildMemberStatusV1;
  contributionXp: number;
  mutedUntilMs?: number;
}

export interface HarthmereGuildApplicationV1 {
  applicationId: string;
  guildId: string;
  applicantActorId: string;
  applicantDisplayName?: string;
  message?: string;
  status: HarthmereGuildApplicationStatusV1;
  createdAtMs: number;
  decidedAtMs?: number;
  decidedByActorId?: string;
}

export interface HarthmereGuildInviteV1 {
  inviteId: string;
  guildId: string;
  targetActorId: string;
  invitedByActorId: string;
  targetDisplayName?: string;
  status: HarthmereGuildInviteStatusV1;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs?: number;
}

export interface HarthmereGuildBankLogV1 {
  id: string;
  guildId: string;
  actorId: string;
  kind: "deposit" | "withdraw" | "slot_upgrade";
  itemId?: string;
  count?: number;
  goldValue?: number;
  atMs: number;
}

export interface HarthmereGuildBankV1 {
  items: Record<string, number>;
  maxSlots: number;
  logs: HarthmereGuildBankLogV1[];
  dailyWithdrawals: Record<string, { dayKey: string; goldValue: number }>;
}

export interface HarthmereGuildTreasuryLogV1 {
  id: string;
  guildId: string;
  actorId: string;
  kind: "deposit" | "withdraw" | "tax" | "guild_creation_fee" | "guild_hall_cost" | "bank_slot_upgrade";
  amountGold: number;
  reason?: string;
  atMs: number;
}

export interface HarthmereGuildChatMessageV1 {
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

export interface HarthmereGuildHallStateV1 {
  propertyId?: string;
  plotId?: string;
  blueprintId?: string;
  status: "none" | "planned" | "under_construction" | "completed";
  servicesUnlocked: string[];
  linkedAtMs?: number;
}

export interface HarthmereGuildAuditLogV1 {
  id: string;
  guildId: string;
  actorId: string;
  kind: string;
  detail?: string;
  atMs: number;
}

export interface HarthmereGuildRecordV1 {
  guildId: string;
  name: string;
  tag: string;
  description: string;
  type: HarthmereGuildTypeV1;
  recruitment: HarthmereGuildRecruitmentStatusV1;
  leaderActorId: string;
  createdAtMs: number;
  updatedAtMs: number;
  level: number;
  xp: number;
  treasuryGold: number;
  taxRate: number;
  ranks: Record<string, HarthmereGuildRankV1>;
  members: Record<string, HarthmereGuildMemberV1>;
  applications: Record<string, HarthmereGuildApplicationV1>;
  invites: Record<string, HarthmereGuildInviteV1>;
  bank: HarthmereGuildBankV1;
  treasuryLogs: HarthmereGuildTreasuryLogV1[];
  chatMessages: HarthmereGuildChatMessageV1[];
  auditLogs: HarthmereGuildAuditLogV1[];
  guildHall: HarthmereGuildHallStateV1;
  disbandedAtMs?: number;
}

export interface HarthmereLiveModeGuildStateV1 {
  /** Legacy single-guild summary fields kept for older callers. */
  guildId?: string;
  role?: string;
  treasury: number;
  bank: Record<string, number>;
  projectContributions: Record<string, number>;

  /** Production persisted guild directory and actor membership. */
  memberGuildId?: string;
  guilds: Record<string, HarthmereGuildRecordV1>;
  nextGuildNumber: number;
  nextApplicationNumber: number;
  nextInviteNumber: number;
  nextChatNumber: number;
  nextLogNumber: number;
}

export interface HarthmereGuildMutationRequestV1 {
  requestId: string;
  actorId: string;
  nowMs: number;
  operation: string;
  guildId?: string;
  name?: string;
  tag?: string;
  description?: string;
  guildType?: HarthmereGuildTypeV1;
  recruitment?: HarthmereGuildRecruitmentStatusV1;
  targetActorId?: string;
  displayName?: string;
  applicationId?: string;
  inviteId?: string;
  rankId?: string;
  rankName?: string;
  permissions?: Partial<HarthmereGuildPermissionMapV1>;
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

export interface HarthmereGuildMutationContextV1 {
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

export interface HarthmereGuildMutationResultV1 {
  guild: HarthmereLiveModeGuildStateV1;
  warnings: string[];
  touchedModels: string[];
  sharedGuildIds: string[];
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
}

const ALL_GUILD_PERMISSIONS_V1: HarthmereGuildPermissionV1[] = [
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

function permissionMapV1(enabled: Partial<HarthmereGuildPermissionMapV1> = {}): HarthmereGuildPermissionMapV1 {
  return Object.fromEntries(
    ALL_GUILD_PERMISSIONS_V1.map((permission) => [permission, enabled[permission] === true])
  ) as HarthmereGuildPermissionMapV1;
}

export function leaderGuildPermissionsV1(): HarthmereGuildPermissionMapV1 {
  return permissionMapV1(Object.fromEntries(ALL_GUILD_PERMISSIONS_V1.map((p) => [p, true])) as Partial<HarthmereGuildPermissionMapV1>);
}

export function officerGuildPermissionsV1(): HarthmereGuildPermissionMapV1 {
  return permissionMapV1({
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

export function memberGuildPermissionsV1(): HarthmereGuildPermissionMapV1 {
  return permissionMapV1({ deposit_bank: true, send_chat: true });
}

export function recruitGuildPermissionsV1(): HarthmereGuildPermissionMapV1 {
  return permissionMapV1({ send_chat: true });
}

function defaultRanksV1(nowMs: number): Record<string, HarthmereGuildRankV1> {
  return {
    leader: {
      rankId: "leader",
      name: "Guild Leader",
      order: 100,
      permissions: leaderGuildPermissionsV1(),
      dailyBankWithdrawLimitGoldValue: Number.MAX_SAFE_INTEGER,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    officer: {
      rankId: "officer",
      name: "Officer",
      order: 70,
      permissions: officerGuildPermissionsV1(),
      dailyBankWithdrawLimitGoldValue: 500,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    member: {
      rankId: "member",
      name: "Member",
      order: 30,
      permissions: memberGuildPermissionsV1(),
      dailyBankWithdrawLimitGoldValue: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    recruit: {
      rankId: "recruit",
      name: "Recruit",
      order: 10,
      permissions: recruitGuildPermissionsV1(),
      dailyBankWithdrawLimitGoldValue: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    },
  };
}

export function defaultHarthmereLiveModeGuildStateV1(): HarthmereLiveModeGuildStateV1 {
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

function normalizeNumberV1(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveIntegerV1(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const integer = Math.trunc(numeric);
  return integer > 0 ? integer : undefined;
}

function nonNegativeIntegerV1(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const integer = Math.trunc(numeric);
  return integer >= 0 ? integer : undefined;
}

function normalizePermissionMapV1(raw: unknown, fallback: HarthmereGuildPermissionMapV1): HarthmereGuildPermissionMapV1 {
  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  return Object.fromEntries(
    ALL_GUILD_PERMISSIONS_V1.map((permission) => [permission, typeof record[permission] === "boolean" ? record[permission] === true : fallback[permission]])
  ) as HarthmereGuildPermissionMapV1;
}

function normalizeRankV1(raw: any, rankId: string, nowMs: number): HarthmereGuildRankV1 {
  const defaults = defaultRanksV1(nowMs)[rankId] ?? {
    rankId,
    name: rankId.replace(/[_-]+/g, " "),
    order: 20,
    permissions: memberGuildPermissionsV1(),
    dailyBankWithdrawLimitGoldValue: 0,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  return {
    ...defaults,
    ...(raw ?? {}),
    rankId,
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : defaults.name,
    order: Math.trunc(normalizeNumberV1(raw?.order, defaults.order)),
    permissions: normalizePermissionMapV1(raw?.permissions, defaults.permissions),
    dailyBankWithdrawLimitGoldValue: nonNegativeIntegerV1(raw?.dailyBankWithdrawLimitGoldValue) ?? defaults.dailyBankWithdrawLimitGoldValue,
    createdAtMs: Math.trunc(normalizeNumberV1(raw?.createdAtMs, defaults.createdAtMs)),
    updatedAtMs: Math.trunc(normalizeNumberV1(raw?.updatedAtMs, defaults.updatedAtMs)),
  };
}

function normalizeRecordNumbersV1(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const numeric = Math.trunc(Number(value));
    if (Number.isFinite(numeric) && numeric > 0) out[key] = numeric;
  }
  return out;
}

export function normalizeHarthmereLiveModeGuildStateV1(raw: unknown, nowMs: number): HarthmereLiveModeGuildStateV1 {
  const defaults = defaultHarthmereLiveModeGuildStateV1();
  if (typeof raw !== "object" || raw === null) return defaults;
  const input = raw as any;
  const guilds: Record<string, HarthmereGuildRecordV1> = {};
  for (const [guildId, gRaw] of Object.entries((input.guilds ?? {}) as Record<string, any>)) {
    const ranksRaw = typeof gRaw?.ranks === "object" && gRaw.ranks !== null ? gRaw.ranks : {};
    const rankDefaults = defaultRanksV1(nowMs);
    const ranks: Record<string, HarthmereGuildRankV1> = {};
    for (const rankId of new Set([...Object.keys(rankDefaults), ...Object.keys(ranksRaw)])) {
      ranks[rankId] = normalizeRankV1(ranksRaw[rankId], rankId, nowMs);
    }
    const members: Record<string, HarthmereGuildMemberV1> = {};
    if (typeof gRaw?.members === "object" && gRaw.members !== null) {
      for (const [actorId, memberRaw] of Object.entries(gRaw.members as Record<string, any>)) {
        const rankId = typeof memberRaw?.rankId === "string" && ranks[memberRaw.rankId] ? memberRaw.rankId : (actorId === gRaw?.leaderActorId ? "leader" : "member");
        members[actorId] = {
          actorId,
          displayName: typeof memberRaw?.displayName === "string" ? memberRaw.displayName.slice(0, 80) : undefined,
          rankId,
          joinedAtMs: Math.trunc(normalizeNumberV1(memberRaw?.joinedAtMs, nowMs)),
          lastSeenAtMs: Math.trunc(normalizeNumberV1(memberRaw?.lastSeenAtMs, nowMs)),
          status: memberRaw?.status === "inactive" || memberRaw?.status === "banned" ? memberRaw.status : "active",
          contributionXp: Math.max(0, Math.trunc(normalizeNumberV1(memberRaw?.contributionXp, 0))),
          mutedUntilMs: typeof memberRaw?.mutedUntilMs === "number" ? memberRaw.mutedUntilMs : undefined,
        };
      }
    }
    const bankRaw = typeof gRaw?.bank === "object" && gRaw.bank !== null ? gRaw.bank : {};
    const guild: HarthmereGuildRecordV1 = {
      guildId,
      name: typeof gRaw?.name === "string" ? gRaw.name.slice(0, HARTHMERE_GUILD_MAX_NAME_LENGTH_V1) : guildId,
      tag: typeof gRaw?.tag === "string" ? gRaw.tag.slice(0, HARTHMERE_GUILD_MAX_TAG_LENGTH_V1).toUpperCase() : "GLD",
      description: typeof gRaw?.description === "string" ? gRaw.description.slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH_V1) : "",
      type: isGuildTypeV1(gRaw?.type) ? gRaw.type : "adventuring",
      recruitment: isRecruitmentStatusV1(gRaw?.recruitment) ? gRaw.recruitment : "application",
      leaderActorId: typeof gRaw?.leaderActorId === "string" ? gRaw.leaderActorId : Object.keys(members)[0] ?? "unknown",
      createdAtMs: Math.trunc(normalizeNumberV1(gRaw?.createdAtMs, nowMs)),
      updatedAtMs: Math.trunc(normalizeNumberV1(gRaw?.updatedAtMs, nowMs)),
      level: Math.max(1, Math.trunc(normalizeNumberV1(gRaw?.level, 1))),
      xp: Math.max(0, Math.trunc(normalizeNumberV1(gRaw?.xp, 0))),
      treasuryGold: Math.max(0, Math.trunc(normalizeNumberV1(gRaw?.treasuryGold, 0))),
      taxRate: Math.max(0, Math.min(HARTHMERE_GUILD_MAX_TAX_RATE_V1, Number(gRaw?.taxRate ?? 0))),
      ranks,
      members,
      applications: typeof gRaw?.applications === "object" && gRaw.applications !== null ? gRaw.applications as Record<string, HarthmereGuildApplicationV1> : {},
      invites: typeof gRaw?.invites === "object" && gRaw.invites !== null ? gRaw.invites as Record<string, HarthmereGuildInviteV1> : {},
      bank: {
        items: normalizeRecordNumbersV1(bankRaw.items),
        maxSlots: Math.max(HARTHMERE_GUILD_BASE_BANK_SLOTS_V1, Math.min(HARTHMERE_GUILD_BANK_MAX_SLOTS_V1, Math.trunc(normalizeNumberV1(bankRaw.maxSlots, HARTHMERE_GUILD_BASE_BANK_SLOTS_V1)))),
        logs: Array.isArray(bankRaw.logs) ? bankRaw.logs.slice(-HARTHMERE_GUILD_MAX_BANK_LOGS_V1) as HarthmereGuildBankLogV1[] : [],
        dailyWithdrawals: typeof bankRaw.dailyWithdrawals === "object" && bankRaw.dailyWithdrawals !== null ? bankRaw.dailyWithdrawals as Record<string, { dayKey: string; goldValue: number }> : {},
      },
      treasuryLogs: Array.isArray(gRaw?.treasuryLogs) ? gRaw.treasuryLogs.slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS_V1) as HarthmereGuildTreasuryLogV1[] : [],
      chatMessages: Array.isArray(gRaw?.chatMessages) ? gRaw.chatMessages.slice(-HARTHMERE_GUILD_MAX_CHAT_MESSAGES_V1) as HarthmereGuildChatMessageV1[] : [],
      auditLogs: Array.isArray(gRaw?.auditLogs) ? gRaw.auditLogs.slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS_V1) as HarthmereGuildAuditLogV1[] : [],
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
    treasury: Math.max(0, Math.trunc(normalizeNumberV1(input.treasury, 0))),
    bank: normalizeRecordNumbersV1(input.bank),
    projectContributions: normalizeRecordNumbersV1(input.projectContributions),
    memberGuildId: memberGuildId && guilds[memberGuildId] ? memberGuildId : undefined,
    guildId: memberGuildId && guilds[memberGuildId] ? memberGuildId : (typeof input.guildId === "string" ? input.guildId : undefined),
    role: typeof input.role === "string" ? input.role : undefined,
    guilds,
    nextGuildNumber: Math.max(1, Math.trunc(normalizeNumberV1(input.nextGuildNumber, 1))),
    nextApplicationNumber: Math.max(1, Math.trunc(normalizeNumberV1(input.nextApplicationNumber, 1))),
    nextInviteNumber: Math.max(1, Math.trunc(normalizeNumberV1(input.nextInviteNumber, 1))),
    nextChatNumber: Math.max(1, Math.trunc(normalizeNumberV1(input.nextChatNumber, 1))),
    nextLogNumber: Math.max(1, Math.trunc(normalizeNumberV1(input.nextLogNumber, 1))),
  };
}

function isGuildTypeV1(value: unknown): value is HarthmereGuildTypeV1 {
  return value === "adventuring" || value === "crafting" || value === "trade" || value === "social" || value === "pvp" || value === "civic";
}

function isRecruitmentStatusV1(value: unknown): value is HarthmereGuildRecruitmentStatusV1 {
  return value === "open" || value === "application" || value === "invite_only" || value === "closed";
}

function normalizeGuildNameV1(name: string | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ").slice(0, HARTHMERE_GUILD_MAX_NAME_LENGTH_V1);
}

function normalizeGuildTagV1(tag: string | undefined) {
  return (tag ?? "").trim().replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, HARTHMERE_GUILD_MAX_TAG_LENGTH_V1);
}

const BANNED_GUILD_TERMS_V1 = /\b(admin|moderator|developer|biomes|harthmere\s*watch|gm|staff)\b/i;

export function validateHarthmereGuildIdentityV1(input: { name?: string; tag?: string }) {
  const name = normalizeGuildNameV1(input.name);
  const tag = normalizeGuildTagV1(input.tag);
  const errors: string[] = [];
  if (name.length < 3 || name.length > HARTHMERE_GUILD_MAX_NAME_LENGTH_V1) errors.push("invalid_name_length");
  if (!/^[a-z0-9][a-z0-9 '\-]{1,30}[a-z0-9]$/i.test(name)) errors.push("invalid_name_characters");
  if (tag.length < 2 || tag.length > HARTHMERE_GUILD_MAX_TAG_LENGTH_V1) errors.push("invalid_tag_length");
  if (!/^[A-Z0-9]{2,6}$/.test(tag)) errors.push("invalid_tag_characters");
  if (BANNED_GUILD_TERMS_V1.test(name) || BANNED_GUILD_TERMS_V1.test(tag)) errors.push("reserved_or_impersonating_name");
  return { ok: errors.length === 0, errors, name, tag };
}

function makeGuildIdV1(state: HarthmereLiveModeGuildStateV1, tag: string) {
  const suffix = state.nextGuildNumber;
  return `guild_${tag.toLowerCase()}_${suffix}`;
}

export function findActorGuildIdV1(state: HarthmereLiveModeGuildStateV1, actorId: string) {
  for (const guild of Object.values(state.guilds)) {
    const member = guild.members[actorId];
    if (member && member.status !== "banned" && !guild.disbandedAtMs) {
      return guild.guildId;
    }
  }
  return undefined;
}

function currentActorGuildV1(state: HarthmereLiveModeGuildStateV1, actorId: string, explicitGuildId?: string) {
  const guildId = explicitGuildId ?? findActorGuildIdV1(state, actorId) ?? state.memberGuildId;
  return guildId ? state.guilds[guildId] : undefined;
}

export function hasHarthmereGuildPermissionV1(guild: HarthmereGuildRecordV1 | undefined, actorId: string, permission: HarthmereGuildPermissionV1, nowMs = 0) {
  if (!guild || guild.disbandedAtMs) return false;
  const member = guild.members[actorId];
  if (!member || member.status !== "active") return false;
  if (permission === "send_chat" && member.mutedUntilMs && member.mutedUntilMs > nowMs) return false;
  if (guild.leaderActorId === actorId) return true;
  const rank = guild.ranks[member.rankId];
  return rank?.permissions[permission] === true;
}

function resolvedGuildPermissionsForActorV1(guild: HarthmereGuildRecordV1 | undefined, actorId: string, nowMs: number) {
  if (!guild || guild.disbandedAtMs || !activeGuildMemberV1(guild, actorId)) return recruitGuildPermissionsV1();
  const member = guild.members[actorId];
  if (!member) return recruitGuildPermissionsV1();
  const raw = guild.leaderActorId === actorId
    ? leaderGuildPermissionsV1()
    : guild.ranks[member.rankId]?.permissions ?? recruitGuildPermissionsV1();
  const permissions = { ...raw };
  if (member.mutedUntilMs && member.mutedUntilMs > nowMs) {
    permissions.send_chat = false;
  }
  return permissions;
}

function syncLegacyGuildSummaryV1(state: HarthmereLiveModeGuildStateV1, actorId: string) {
  const guildId = findActorGuildIdV1(state, actorId);
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

function auditV1(state: HarthmereLiveModeGuildStateV1, guild: HarthmereGuildRecordV1, actorId: string, kind: string, detail?: string, nowMs = Date.now()) {
  const id = `guild_log_${guild.guildId}_${state.nextLogNumber++}`;
  guild.auditLogs = [
    ...guild.auditLogs,
    { id, guildId: guild.guildId, actorId, kind, detail, atMs: nowMs },
  ].slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS_V1);
  guild.updatedAtMs = nowMs;
}

function treasuryLogV1(state: HarthmereLiveModeGuildStateV1, guild: HarthmereGuildRecordV1, actorId: string, kind: HarthmereGuildTreasuryLogV1["kind"], amountGold: number, reason: string | undefined, nowMs: number) {
  const id = `guild_treasury_${guild.guildId}_${state.nextLogNumber++}`;
  guild.treasuryLogs = [
    ...guild.treasuryLogs,
    { id, guildId: guild.guildId, actorId, kind, amountGold, reason, atMs: nowMs },
  ].slice(-HARTHMERE_GUILD_MAX_AUDIT_LOGS_V1);
}

function guildBankLogV1(state: HarthmereLiveModeGuildStateV1, guild: HarthmereGuildRecordV1, actorId: string, kind: HarthmereGuildBankLogV1["kind"], nowMs: number, extras: Partial<HarthmereGuildBankLogV1>) {
  const id = `guild_bank_${guild.guildId}_${state.nextLogNumber++}`;
  guild.bank.logs = [
    ...guild.bank.logs,
    { id, guildId: guild.guildId, actorId, kind, atMs: nowMs, ...extras },
  ].slice(-HARTHMERE_GUILD_MAX_BANK_LOGS_V1);
}

function applyRecordDeltaV1(target: Record<string, number>, key: string, delta: number) {
  const next = Math.max(0, (target[key] ?? 0) + Math.trunc(delta));
  if (next <= 0) delete target[key];
  else target[key] = next;
}

function usedSlotsV1(items: Record<string, number>) {
  return Object.values(items).filter((count) => count > 0).length;
}

function defaultGuildBankCapacityV1(items: Record<string, number>, itemId: string, maxSlots: number) {
  return (items[itemId] ?? 0) > 0 || usedSlotsV1(items) < maxSlots;
}

function todayKeyV1(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function addGuildXpV1(guild: HarthmereGuildRecordV1, xpDelta: number) {
  const xp = Math.max(0, Math.trunc(xpDelta));
  if (xp <= 0) return;
  guild.xp += xp;
  guild.level = Math.max(1, 1 + Math.floor(guild.xp / HARTHMERE_GUILD_XP_PER_LEVEL_V1));
}

function activeGuildMemberV1(guild: HarthmereGuildRecordV1, actorId: string) {
  const member = guild.members[actorId];
  return member?.status === "active" ? member : undefined;
}

function activeGuildMemberCountV1(guild: HarthmereGuildRecordV1): number {
  return Object.values(guild.members).filter((member) => member.status === "active").length;
}

function guildAtMemberCapV1(guild: HarthmereGuildRecordV1): boolean {
  return activeGuildMemberCountV1(guild) >= HARTHMERE_GUILD_MAX_MEMBERS_V1;
}

function guildRankOrderV1(guild: HarthmereGuildRecordV1, rankId: string | undefined) {
  return rankId ? guild.ranks[rankId]?.order ?? 0 : 0;
}

function canManageGuildMemberV1(guild: HarthmereGuildRecordV1, actorId: string, targetActorId: string) {
  if (actorId === targetActorId) return false;
  const actorMember = activeGuildMemberV1(guild, actorId);
  const targetMember = activeGuildMemberV1(guild, targetActorId);
  if (!actorMember || !targetMember) return false;
  if (guild.leaderActorId === actorId) return targetActorId !== guild.leaderActorId;
  if (targetActorId === guild.leaderActorId) return false;
  return guildRankOrderV1(guild, actorMember.rankId) > guildRankOrderV1(guild, targetMember.rankId);
}

function canAssignGuildRankV1(guild: HarthmereGuildRecordV1, actorId: string, targetActorId: string, rankId: string) {
  if (rankId === "leader") return false;
  if (actorId === targetActorId) return false;
  const actorMember = activeGuildMemberV1(guild, actorId);
  const targetMember = activeGuildMemberV1(guild, targetActorId);
  const assignedRank = guild.ranks[rankId];
  if (!actorMember || !targetMember || !assignedRank) return false;
  if (targetActorId === guild.leaderActorId) return false;
  if (guild.leaderActorId === actorId) return true;
  const actorOrder = guildRankOrderV1(guild, actorMember.rankId);
  return actorOrder > guildRankOrderV1(guild, targetMember.rankId) && actorOrder > assignedRank.order;
}

function creditGuildContributionV1(guild: HarthmereGuildRecordV1, actorId: string, xpDelta: number, nowMs: number) {
  const xp = Math.max(0, Math.trunc(xpDelta));
  const member = activeGuildMemberV1(guild, actorId);
  if (!member || xp <= 0) return;
  member.contributionXp += xp;
  member.lastSeenAtMs = Math.max(member.lastSeenAtMs, nowMs);
}

function closePendingGuildJoinRequestsForActorV1(
  state: HarthmereLiveModeGuildStateV1,
  actorId: string,
  joinedGuildId: string,
  nowMs: number,
) {
  const changedGuilds: HarthmereGuildRecordV1[] = [];
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

function guildDirectoryEntryV1(guild: HarthmereGuildRecordV1) {
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

export function createHarthmereLiveModeGuildClientSnapshotV1(state: HarthmereLiveModeGuildStateV1, actorId: string) {
  const nowMs = Date.now();
  const memberGuildId = findActorGuildIdV1(state, actorId) ?? state.memberGuildId;
  const myGuild = memberGuildId ? state.guilds[memberGuildId] : undefined;
  const member = myGuild?.members[actorId];
  return {
    actorId,
    memberGuildId,
    role: member?.rankId,
    permissions: resolvedGuildPermissionsForActorV1(myGuild, actorId, nowMs),
    guild: myGuild,
    finder: Object.values(state.guilds)
      .filter((guild) => !guild.disbandedAtMs && guild.recruitment !== "closed")
      .map(guildDirectoryEntryV1)
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
    pendingApplications: Object.values(state.guilds).flatMap((guild) =>
      Object.values(guild.applications).filter((app) => app.applicantActorId === actorId && app.status === "pending")
    ),
    pendingInvites: Object.values(state.guilds).flatMap((guild) =>
      Object.values(guild.invites).filter((invite) => invite.targetActorId === actorId && invite.status === "pending" && invite.expiresAtMs > Date.now())
    ),
  };
}

function reject(result: HarthmereGuildMutationResultV1, code: string, touched = "guild_rejection") {
  result.warnings.push(`guild_rejected:${code}`);
  result.touchedModels.push(touched);
}

export function reduceHarthmereGuildMutationV1(
  state: HarthmereLiveModeGuildStateV1,
  request: HarthmereGuildMutationRequestV1,
  context: HarthmereGuildMutationContextV1,
): HarthmereGuildMutationResultV1 {
  const next = normalizeHarthmereLiveModeGuildStateV1(JSON.parse(JSON.stringify(state ?? defaultHarthmereLiveModeGuildStateV1())), request.nowMs);
  const result: HarthmereGuildMutationResultV1 = {
    guild: next,
    warnings: [],
    touchedModels: [],
    sharedGuildIds: [],
    inventoryGoldDelta: 0,
    inventoryItemDeltas: {},
  };
  const op = request.operation || "noop";
  const currentGuild = currentActorGuildV1(next, request.actorId, request.guildId);

  const markGuild = (guild: HarthmereGuildRecordV1, model = "guild_state") => {
    guild.updatedAtMs = request.nowMs;
    next.guilds[guild.guildId] = guild;
    if (!result.sharedGuildIds.includes(guild.guildId)) result.sharedGuildIds.push(guild.guildId);
    if (!result.touchedModels.includes(model)) result.touchedModels.push(model);
  };

  if (op === "noop" || op === "find_guilds") {
    result.touchedModels.push("guild_finder");
    syncLegacyGuildSummaryV1(next, request.actorId);
    return result;
  }

  if (op === "create_guild") {
    const identity = validateHarthmereGuildIdentityV1({ name: request.name, tag: request.tag });
    if (!identity.ok) {
      for (const error of identity.errors) reject(result, error);
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    if (findActorGuildIdV1(next, request.actorId)) {
      reject(result, "already_in_guild");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    const actorLevel = Math.trunc(normalizeNumberV1(context.actorLevel, 0));
    if (actorLevel < HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1) {
      reject(result, "below_minimum_level");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    if ((context.actorGuildRestrictedUntilMs ?? 0) > request.nowMs) {
      reject(result, "actor_guild_restricted");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    if ((context.actorGuildCreationCooldownUntilMs ?? 0) > request.nowMs) {
      reject(result, "guild_creation_cooldown_active");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    const duplicate = Object.values(next.guilds).find((guild) =>
      !guild.disbandedAtMs && (guild.name.toLowerCase() === identity.name.toLowerCase() || guild.tag === identity.tag)
    );
    if (duplicate) {
      reject(result, duplicate.tag === identity.tag ? "tag_already_taken" : "name_already_taken");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    if (context.actorGold < HARTHMERE_GUILD_CREATION_FEE_GOLD_V1) {
      reject(result, "not_enough_gold_for_charter");
      syncLegacyGuildSummaryV1(next, request.actorId);
      return result;
    }
    const guildId = makeGuildIdV1(next, identity.tag);
    next.nextGuildNumber += 1;
    const ranks = defaultRanksV1(request.nowMs);
    const guild: HarthmereGuildRecordV1 = {
      guildId,
      name: identity.name,
      tag: identity.tag,
      description: (request.description ?? "").trim().slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH_V1),
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
        maxSlots: HARTHMERE_GUILD_BASE_BANK_SLOTS_V1,
        logs: [],
        dailyWithdrawals: {},
      },
      treasuryLogs: [],
      chatMessages: [],
      auditLogs: [],
      guildHall: { status: "none", servicesUnlocked: [] },
    };
    treasuryLogV1(next, guild, request.actorId, "guild_creation_fee", -HARTHMERE_GUILD_CREATION_FEE_GOLD_V1, "Guild charter filing fee", request.nowMs);
    auditV1(next, guild, request.actorId, "guild_created", `${identity.name} [${identity.tag}]`, request.nowMs);
    next.guilds[guildId] = guild;
    next.memberGuildId = guildId;
    result.inventoryGoldDelta -= HARTHMERE_GUILD_CREATION_FEE_GOLD_V1;
    markGuild(guild, "guild_created");
    result.touchedModels.push("wallet", "guild_directory", "guild_member");
    syncLegacyGuildSummaryV1(next, request.actorId);
    return result;
  }

  const guild = currentGuild ?? (request.guildId ? next.guilds[request.guildId] : undefined);
  if (!guild || guild.disbandedAtMs) {
    reject(result, "guild_not_found");
    syncLegacyGuildSummaryV1(next, request.actorId);
    return result;
  }

  if (op === "update_profile") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_guild_hall", request.nowMs)) {
      reject(result, "missing_permission:manage_guild_hall");
    } else {
      if (typeof request.description === "string") guild.description = request.description.trim().slice(0, HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH_V1);
      if (request.recruitment && isRecruitmentStatusV1(request.recruitment)) guild.recruitment = request.recruitment;
      if (request.guildType && isGuildTypeV1(request.guildType)) guild.type = request.guildType;
      auditV1(next, guild, request.actorId, "guild_profile_updated", undefined, request.nowMs);
      markGuild(guild, "guild_profile");
    }
  } else if (op === "apply_to_guild") {
    if (findActorGuildIdV1(next, request.actorId)) {
      reject(result, "already_in_guild");
    } else if (guild.recruitment !== "open" && guild.recruitment !== "application") {
      reject(result, "applications_closed");
    } else if (Object.values(guild.applications).some((app) => app.applicantActorId === request.actorId && app.status === "pending")) {
      reject(result, "application_already_pending");
    } else if (guild.recruitment === "open" && guildAtMemberCapV1(guild)) {
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
      auditV1(next, guild, request.actorId, "member_joined_open_recruitment", undefined, request.nowMs);
      markGuild(guild, "guild_member");
      for (const changedGuild of closePendingGuildJoinRequestsForActorV1(next, request.actorId, guild.guildId, request.nowMs)) {
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
      auditV1(next, guild, request.actorId, "application_submitted", applicationId, request.nowMs);
      markGuild(guild, "guild_application");
    }
  } else if (op === "cancel_application") {
    const application = request.applicationId ? guild.applications[request.applicationId] : Object.values(guild.applications).find((app) => app.applicantActorId === request.actorId && app.status === "pending");
    if (!application || application.applicantActorId !== request.actorId || application.status !== "pending") reject(result, "application_not_found");
    else {
      application.status = "cancelled";
      application.decidedAtMs = request.nowMs;
      auditV1(next, guild, request.actorId, "application_cancelled", application.applicationId, request.nowMs);
      markGuild(guild, "guild_application");
    }
  } else if (op === "accept_application" || op === "reject_application") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_applications", request.nowMs)) reject(result, "missing_permission:manage_applications");
    else {
      const application = request.applicationId ? guild.applications[request.applicationId] : undefined;
      if (!application || application.status !== "pending") reject(result, "application_not_found");
      else if (op === "accept_application" && findActorGuildIdV1(next, application.applicantActorId)) reject(result, "applicant_already_in_guild");
      else if (op === "accept_application" && guildAtMemberCapV1(guild)) reject(result, "guild_member_cap_reached");
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
          for (const changedGuild of closePendingGuildJoinRequestsForActorV1(next, application.applicantActorId, guild.guildId, request.nowMs)) {
            markGuild(changedGuild, "guild_recruitment_state");
          }
        }
        auditV1(next, guild, request.actorId, op, application.applicationId, request.nowMs);
        markGuild(guild, "guild_application");
        if (op === "accept_application") result.touchedModels.push("guild_member");
      }
    }
  } else if (op === "invite_member") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "invite_members", request.nowMs)) reject(result, "missing_permission:invite_members");
    else if (!request.targetActorId) reject(result, "missing_target_actor_id");
    else if (findActorGuildIdV1(next, request.targetActorId)) reject(result, "target_already_in_guild");
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
      auditV1(next, guild, request.actorId, "invite_created", `${inviteId}:${request.targetActorId}`, request.nowMs);
      markGuild(guild, "guild_invite");
    }
  } else if (op === "accept_invite" || op === "decline_invite") {
    const invite = request.inviteId ? guild.invites[request.inviteId] : Object.values(guild.invites).find((i) => i.targetActorId === request.actorId && i.status === "pending");
    if (!invite || invite.targetActorId !== request.actorId || invite.status !== "pending") reject(result, "invite_not_found");
    else if (invite.expiresAtMs <= request.nowMs) {
      invite.status = "expired";
      reject(result, "invite_expired");
      markGuild(guild, "guild_invite");
    } else if (op === "accept_invite" && findActorGuildIdV1(next, request.actorId)) reject(result, "already_in_guild");
    else if (op === "accept_invite" && guildAtMemberCapV1(guild)) reject(result, "guild_member_cap_reached");
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
        for (const changedGuild of closePendingGuildJoinRequestsForActorV1(next, request.actorId, guild.guildId, request.nowMs)) {
          markGuild(changedGuild, "guild_recruitment_state");
        }
      }
      auditV1(next, guild, request.actorId, op, invite.inviteId, request.nowMs);
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
      auditV1(next, guild, request.actorId, "member_left", undefined, request.nowMs);
      if (guild.leaderActorId === request.actorId) guild.disbandedAtMs = request.nowMs;
      markGuild(guild, "guild_member");
    }
  } else if (op === "kick_member") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_members", request.nowMs)) reject(result, "missing_permission:manage_members");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    else if (request.targetActorId === guild.leaderActorId) reject(result, "cannot_kick_leader");
    else if (!canManageGuildMemberV1(guild, request.actorId, request.targetActorId)) reject(result, "cannot_manage_equal_or_higher_rank");
    else {
      delete guild.members[request.targetActorId];
      auditV1(next, guild, request.actorId, "member_kicked", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "transfer_leader") {
    if (guild.leaderActorId !== request.actorId) reject(result, "only_leader_can_transfer");
    else if (!request.targetActorId || !activeGuildMemberV1(guild, request.targetActorId)) reject(result, "member_not_found");
    else if (request.targetActorId === request.actorId) reject(result, "cannot_transfer_to_self");
    else {
      guild.members[request.actorId].rankId = "officer";
      guild.members[request.targetActorId].rankId = "leader";
      guild.leaderActorId = request.targetActorId;
      auditV1(next, guild, request.actorId, "leader_transferred", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "create_rank" || op === "update_rank") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_ranks", request.nowMs)) reject(result, "missing_permission:manage_ranks");
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
          permissions: normalizePermissionMapV1(request.permissions, existing?.permissions ?? memberGuildPermissionsV1()),
          dailyBankWithdrawLimitGoldValue: nonNegativeIntegerV1(request.dailyBankWithdrawLimitGoldValue) ?? existing?.dailyBankWithdrawLimitGoldValue ?? 0,
          createdAtMs: existing?.createdAtMs ?? request.nowMs,
          updatedAtMs: request.nowMs,
        };
        auditV1(next, guild, request.actorId, op, rankId, request.nowMs);
        markGuild(guild, "guild_rank");
      }
    }
  } else if (op === "delete_rank") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_ranks", request.nowMs)) reject(result, "missing_permission:manage_ranks");
    else if (!request.rankId || !guild.ranks[request.rankId]) reject(result, "rank_not_found");
    else if (["leader", "officer", "member", "recruit"].includes(request.rankId)) reject(result, "cannot_delete_system_rank");
    else if (Object.values(guild.members).some((member) => member.rankId === request.rankId)) reject(result, "rank_in_use");
    else {
      delete guild.ranks[request.rankId];
      auditV1(next, guild, request.actorId, "rank_deleted", request.rankId, request.nowMs);
      markGuild(guild, "guild_rank");
    }
  } else if (op === "assign_rank") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_members", request.nowMs)) reject(result, "missing_permission:manage_members");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    else if (!request.rankId || !guild.ranks[request.rankId]) reject(result, "rank_not_found");
    else if (request.rankId === "leader") reject(result, "use_transfer_leader_for_leader_rank");
    else if (request.targetActorId === guild.leaderActorId && request.rankId !== "leader") reject(result, "cannot_demote_leader_without_transfer");
    else if (!canAssignGuildRankV1(guild, request.actorId, request.targetActorId, request.rankId)) reject(result, "cannot_assign_equal_or_higher_rank");
    else {
      guild.members[request.targetActorId].rankId = request.rankId;
      guild.members[request.targetActorId].lastSeenAtMs = request.nowMs;
      auditV1(next, guild, request.actorId, "rank_assigned", `${request.targetActorId}:${request.rankId}`, request.nowMs);
      markGuild(guild, "guild_member");
    }
  } else if (op === "treasury_deposit") {
    const amount = positiveIntegerV1(request.amountGold);
    if (!activeGuildMemberV1(guild, request.actorId)) reject(result, "not_a_member");
    else if (amount === undefined) reject(result, "invalid_gold_amount");
    else if (context.actorGold < amount) reject(result, "not_enough_gold");
    else {
      guild.treasuryGold += amount;
      result.inventoryGoldDelta -= amount;
      treasuryLogV1(next, guild, request.actorId, "deposit", amount, request.reason, request.nowMs);
      const contributionXp = Math.max(1, Math.floor(amount / 10));
      addGuildXpV1(guild, contributionXp);
      creditGuildContributionV1(guild, request.actorId, contributionXp, request.nowMs);
      auditV1(next, guild, request.actorId, "treasury_deposit", String(amount), request.nowMs);
      markGuild(guild, "guild_treasury");
      result.touchedModels.push("wallet", "guild_level");
    }
  } else if (op === "treasury_withdraw") {
    const amount = positiveIntegerV1(request.amountGold);
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_treasury", request.nowMs)) reject(result, "missing_permission:manage_treasury");
    else if (amount === undefined) reject(result, "invalid_gold_amount");
    else if (guild.treasuryGold < amount) reject(result, "guild_treasury_insufficient");
    else {
      guild.treasuryGold -= amount;
      result.inventoryGoldDelta += amount;
      treasuryLogV1(next, guild, request.actorId, "withdraw", -amount, request.reason, request.nowMs);
      auditV1(next, guild, request.actorId, "treasury_withdraw", String(amount), request.nowMs);
      markGuild(guild, "guild_treasury");
      result.touchedModels.push("wallet");
    }
  } else if (op === "set_tax") {
    const taxRate = Number(request.taxRate ?? NaN);
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "set_tax", request.nowMs)) reject(result, "missing_permission:set_tax");
    else if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > HARTHMERE_GUILD_MAX_TAX_RATE_V1) reject(result, "invalid_tax_rate");
    else {
      guild.taxRate = Math.round(taxRate * 10000) / 10000;
      auditV1(next, guild, request.actorId, "tax_rate_set", String(guild.taxRate), request.nowMs);
      markGuild(guild, "guild_tax");
    }
  } else if (op === "collect_tax") {
    const taxable = positiveIntegerV1(request.amountGold);
    if (!context.trustedTaxCollection) reject(result, "tax_collection_not_server_authorized");
    else if (taxable === undefined) reject(result, "invalid_taxable_gold_amount");
    // Bind tax collection to the actor's own guild. The target guild is otherwise
    // attacker-controllable via request.guildId, letting a trusted tax call credit an
    // arbitrary guild the actor doesn't belong to.
    else if (!activeGuildMemberV1(guild, request.actorId)) reject(result, "tax_collector_not_a_member");
    else {
      const tax = Math.floor(taxable * guild.taxRate);
      if (tax <= 0) reject(result, "no_tax_due");
      else {
        guild.treasuryGold += tax;
        treasuryLogV1(next, guild, request.actorId, "tax", tax, request.reason, request.nowMs);
        creditGuildContributionV1(guild, request.actorId, tax, request.nowMs);
        auditV1(next, guild, request.actorId, "tax_collected", String(tax), request.nowMs);
        markGuild(guild, "guild_tax");
      }
    }
  } else if (op === "guild_bank_deposit" || op === "guild_bank_withdraw") {
    const itemId = request.itemId;
    const count = positiveIntegerV1(request.count);
    const itemUnitGoldValue = positiveIntegerV1(request.itemGoldValue);
    const itemGoldValue = count !== undefined ? (itemUnitGoldValue ?? 1) * count : undefined;
    if (!itemId) reject(result, "missing_item_id");
    else if (count === undefined) reject(result, "invalid_item_count");
    else if (itemGoldValue === undefined) reject(result, "invalid_item_gold_value");
    else if (op === "guild_bank_deposit") {
      if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "deposit_bank", request.nowMs)) reject(result, "missing_permission:deposit_bank");
      else if ((context.actorInventoryItems[itemId] ?? 0) < count) reject(result, "insufficient_item_count");
      else if (context.canDepositItem && !context.canDepositItem(itemId)) reject(result, "item_not_depositable");
      else if (!(context.guildBankHasCapacity ?? defaultGuildBankCapacityV1)(guild.bank.items, itemId, guild.bank.maxSlots)) reject(result, "guild_bank_full");
      else {
        applyRecordDeltaV1(guild.bank.items, itemId, count);
        result.inventoryItemDeltas[itemId] = (result.inventoryItemDeltas[itemId] ?? 0) - count;
        guildBankLogV1(next, guild, request.actorId, "deposit", request.nowMs, { itemId, count, goldValue: itemGoldValue });
        const contributionXp = Math.max(1, Math.floor(itemGoldValue / 10));
        addGuildXpV1(guild, contributionXp);
        creditGuildContributionV1(guild, request.actorId, contributionXp, request.nowMs);
        auditV1(next, guild, request.actorId, "guild_bank_deposit", `${itemId}:${count}`, request.nowMs);
        markGuild(guild, "guild_bank");
        result.touchedModels.push("inventory_items", "guild_level");
      }
    } else {
      if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "withdraw_bank", request.nowMs)) reject(result, "missing_permission:withdraw_bank");
      else if ((guild.bank.items[itemId] ?? 0) < count) reject(result, "guild_bank_insufficient_item_count");
      else if (context.canWithdrawToInventory && !context.canWithdrawToInventory(itemId, count)) reject(result, "carry_weight_limit_exceeded");
      else {
        const member = guild.members[request.actorId];
        const rank = member ? guild.ranks[member.rankId] : undefined;
        const dayKey = todayKeyV1(request.nowMs);
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
          applyRecordDeltaV1(guild.bank.items, itemId, -count);
          result.inventoryItemDeltas[itemId] = (result.inventoryItemDeltas[itemId] ?? 0) + count;
          guildBankLogV1(next, guild, request.actorId, "withdraw", request.nowMs, { itemId, count, goldValue: itemGoldValue });
          auditV1(next, guild, request.actorId, "guild_bank_withdraw", `${itemId}:${count}`, request.nowMs);
          markGuild(guild, "guild_bank");
          result.touchedModels.push("inventory_items");
        }
      }
    }
  } else if (op === "upgrade_guild_bank_slots") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_treasury", request.nowMs)) reject(result, "missing_permission:manage_treasury");
    else if (guild.bank.maxSlots >= HARTHMERE_GUILD_BANK_MAX_SLOTS_V1) reject(result, "guild_bank_max_slots_reached");
    else {
      const upgradeNumber = Math.floor((guild.bank.maxSlots - HARTHMERE_GUILD_BASE_BANK_SLOTS_V1) / HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE_V1);
      const cost = 200 + upgradeNumber * 150;
      if (guild.treasuryGold < cost) reject(result, "guild_treasury_insufficient");
      else {
        guild.treasuryGold -= cost;
        guild.bank.maxSlots = Math.min(HARTHMERE_GUILD_BANK_MAX_SLOTS_V1, guild.bank.maxSlots + HARTHMERE_GUILD_BANK_SLOT_UPGRADE_SIZE_V1);
        treasuryLogV1(next, guild, request.actorId, "bank_slot_upgrade", -cost, "Guild bank slot upgrade", request.nowMs);
        guildBankLogV1(next, guild, request.actorId, "slot_upgrade", request.nowMs, { goldValue: cost });
        auditV1(next, guild, request.actorId, "guild_bank_upgraded", String(guild.bank.maxSlots), request.nowMs);
        markGuild(guild, "guild_bank_slots");
      }
    }
  } else if (op === "add_xp") {
    const xpDelta = positiveIntegerV1(request.xpDelta);
    if (!context.trustedGuildXpGrant) reject(result, "xp_grant_not_server_authorized");
    else if (xpDelta === undefined) reject(result, "invalid_xp_delta");
    else {
      const boundedXpDelta = Math.min(5000, xpDelta);
      addGuildXpV1(guild, boundedXpDelta);
      creditGuildContributionV1(guild, request.actorId, boundedXpDelta, request.nowMs);
      auditV1(next, guild, request.actorId, "guild_xp_added", String(boundedXpDelta), request.nowMs);
      markGuild(guild, "guild_level");
    }
  } else if (op === "link_guild_hall") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "manage_guild_hall", request.nowMs)) reject(result, "missing_permission:manage_guild_hall");
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
      auditV1(next, guild, request.actorId, "guild_hall_linked", request.propertyId, request.nowMs);
      markGuild(guild, "guild_hall");
    }
  } else if (op === "send_chat") {
    const body = (request.message ?? "").trim();
    const channel = request.channel ?? "guild";
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "send_chat", request.nowMs)) reject(result, "missing_permission:send_chat_or_muted");
    else if (channel === "officer" && !hasHarthmereGuildPermissionV1(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:officer_chat");
    else if (body.length < 1) reject(result, "empty_chat_message");
    else if (body.length > HARTHMERE_GUILD_MAX_CHAT_MESSAGE_LENGTH_V1) reject(result, "chat_message_too_long");
    else {
      const member = guild.members[request.actorId];
      const messageId = `guild_chat_${next.nextChatNumber++}`;
      guild.chatMessages = [
        ...guild.chatMessages,
        { messageId, guildId: guild.guildId, actorId: request.actorId, displayName: member?.displayName, channel, body, createdAtMs: request.nowMs },
      ].slice(-HARTHMERE_GUILD_MAX_CHAT_MESSAGES_V1);
      markGuild(guild, "guild_chat");
    }
  } else if (op === "delete_chat_message") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:moderate_chat");
    else {
      const message = guild.chatMessages.find((m) => m.messageId === request.message);
      if (!message || message.deletedAtMs) reject(result, "chat_message_not_found");
      else {
        message.deletedAtMs = request.nowMs;
        message.deletedByActorId = request.actorId;
        auditV1(next, guild, request.actorId, "chat_message_deleted", message.messageId, request.nowMs);
        markGuild(guild, "guild_chat");
      }
    }
  } else if (op === "mute_member") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "moderate_chat", request.nowMs)) reject(result, "missing_permission:moderate_chat");
    else if (!request.targetActorId || !guild.members[request.targetActorId]) reject(result, "member_not_found");
    // A moderator may not mute the leader or an equal/higher rank — otherwise an officer
    // can silence the guild leader.
    else if (!canManageGuildMemberV1(guild, request.actorId, request.targetActorId)) reject(result, "cannot_manage_equal_or_higher_rank");
    else {
      const durationMs = Math.min(
        HARTHMERE_GUILD_MAX_MUTE_DURATION_MS_V1,
        Math.max(60_000, positiveIntegerV1(request.amountGold) ?? 300_000),
      );
      guild.members[request.targetActorId].mutedUntilMs = request.nowMs + durationMs;
      auditV1(next, guild, request.actorId, "member_muted", request.targetActorId, request.nowMs);
      markGuild(guild, "guild_chat_moderation");
    }
  } else if (op === "disband_guild") {
    if (!hasHarthmereGuildPermissionV1(guild, request.actorId, "disband_guild", request.nowMs) || guild.leaderActorId !== request.actorId) reject(result, "only_leader_can_disband");
    else if (Object.values(guild.bank.items).some((count) => count > 0)) reject(result, "guild_bank_not_empty");
    else if (guild.treasuryGold > 0) reject(result, "guild_treasury_not_empty");
    else {
      guild.disbandedAtMs = request.nowMs;
      auditV1(next, guild, request.actorId, "guild_disbanded", undefined, request.nowMs);
      markGuild(guild, "guild_disbanded");
      result.touchedModels.push("guild_directory");
    }
  } else {
    reject(result, `unsupported_operation:${op}`);
  }

  syncLegacyGuildSummaryV1(next, request.actorId);
  return result;
}

export function linkHarthmereGuildHallPropertyV1(input: {
  state: HarthmereLiveModeGuildStateV1;
  guildId: string | undefined;
  actorId: string;
  propertyId: string;
  plotId?: string;
  blueprintId?: string;
  nowMs: number;
}): { state: HarthmereLiveModeGuildStateV1; changed: boolean } {
  const state = normalizeHarthmereLiveModeGuildStateV1(input.state, input.nowMs);
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
  auditV1(state, guild, input.actorId, "guild_hall_linked_from_building_system", input.propertyId, input.nowMs);
  state.guilds[guild.guildId] = guild;
  syncLegacyGuildSummaryV1(state, input.actorId);
  return { state, changed: true };
}
