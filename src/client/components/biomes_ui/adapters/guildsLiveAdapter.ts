import type {
  HarthmereGuildApplicationV1,
  HarthmereGuildChatMessageV1,
  HarthmereGuildInviteV1,
  HarthmereGuildPermissionMapV1,
  HarthmereGuildPermissionV1,
  HarthmereGuildRecordV1,
  HarthmereGuildRecruitmentStatusV1,
  HarthmereGuildTypeV1,
} from "../../../../shared/harthmere/mmo_guild_authority_v1";

export interface BiomesUIGuildDirectoryEntryV1 {
  guildId: string;
  name: string;
  tag: string;
  description: string;
  type: HarthmereGuildTypeV1 | string;
  recruitment: HarthmereGuildRecruitmentStatusV1 | string;
  level: number;
  xp: number;
  memberCount: number;
  taxRate: number;
  hasGuildHall: boolean;
}

export interface BiomesUIGuildClientSnapshotV1 {
  actorId?: string;
  memberGuildId?: string;
  role?: string;
  permissions: Partial<HarthmereGuildPermissionMapV1>;
  guild?: HarthmereGuildRecordV1;
  finder: BiomesUIGuildDirectoryEntryV1[];
  pendingApplications: HarthmereGuildApplicationV1[];
  pendingInvites: HarthmereGuildInviteV1[];
}

export interface BiomesUIGuildDepositCandidateV1 {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  category?: string;
  estimatedGoldValue?: number;
}

export interface BiomesUIGuildHallCandidateV1 {
  propertyId: string;
  plotId?: string;
  blueprintId?: string;
  label: string;
  status?: string;
}

export type BiomesUIGuildMutationOperationV1 =
  | "find_guilds"
  | "create_guild"
  | "update_profile"
  | "apply_to_guild"
  | "cancel_application"
  | "accept_application"
  | "reject_application"
  | "invite_member"
  | "accept_invite"
  | "decline_invite"
  | "leave_guild"
  | "kick_member"
  | "transfer_leader"
  | "create_rank"
  | "update_rank"
  | "delete_rank"
  | "assign_rank"
  | "treasury_deposit"
  | "treasury_withdraw"
  | "set_tax"
  | "guild_bank_deposit"
  | "guild_bank_withdraw"
  | "upgrade_guild_bank_slots"
  | "link_guild_hall"
  | "send_chat"
  | "delete_chat_message"
  | "mute_member"
  | "disband_guild";

export interface BiomesUIGuildMutationPayloadV1 {
  guildId?: string;
  name?: string;
  tag?: string;
  description?: string;
  guildType?: HarthmereGuildTypeV1 | string;
  recruitment?: HarthmereGuildRecruitmentStatusV1 | string;
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
  amountGold?: number;
  taxRate?: number;
  message?: string;
  channel?: "guild" | "officer";
  propertyId?: string;
  plotId?: string;
  blueprintId?: string;
  reason?: string;
}

export interface BiomesUIGuildSubmitOptionsV1 {
  fetchImpl?: typeof fetch;
  requestId?: string;
  actorEntityVersion?: number;
  zoneId?: string;
  nowMs?: number;
  randomSuffix?: string;
}

export interface BiomesUIGuildLiveModeResponseV1 {
  ok?: boolean;
  guildState?: BiomesUIGuildClientSnapshotV1;
  backendMutation?: {
    warnings?: string[];
    touchedModels?: string[];
    sharedStateKeys?: string[];
  };
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  warnings?: string[];
  errors?: string[];
}

export function normalizeBiomesUIGuildSnapshotV1(input: unknown): BiomesUIGuildClientSnapshotV1 {
  const raw = typeof input === "object" && input !== null ? (input as any) : {};
  return {
    actorId: typeof raw.actorId === "string" ? raw.actorId : undefined,
    memberGuildId: typeof raw.memberGuildId === "string" ? raw.memberGuildId : undefined,
    role: typeof raw.role === "string" ? raw.role : undefined,
    permissions:
      typeof raw.permissions === "object" && raw.permissions !== null
        ? raw.permissions
        : {},
    guild:
      typeof raw.guild === "object" && raw.guild !== null
        ? raw.guild
        : undefined,
    finder: Array.isArray(raw.finder) ? raw.finder : [],
    pendingApplications: Array.isArray(raw.pendingApplications)
      ? raw.pendingApplications
      : [],
    pendingInvites: Array.isArray(raw.pendingInvites) ? raw.pendingInvites : [],
  };
}

export async function fetchBiomesUIGuildStateV1(fetchImpl: typeof fetch = fetch): Promise<BiomesUIGuildClientSnapshotV1 | undefined> {
  const response = await fetchImpl("/api/harthmere/live_mode_guild_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return normalizeBiomesUIGuildSnapshotV1(body?.guildState);
}

function buildGuildRequestIdV1(operation: string, options: BiomesUIGuildSubmitOptionsV1): string {
  if (options.requestId) return options.requestId;
  const now = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  const suffix = options.randomSuffix ?? Math.random().toString(36).slice(2);
  return `biomes_ui_guild_${operation}_${now}_${suffix}`;
}

function responseErrorMessageV1(operation: string, body: BiomesUIGuildLiveModeResponseV1 | undefined): string {
  const validation = body?.validation?.errors;
  if (Array.isArray(validation) && validation.length > 0) return validation.join(",");
  const errors = body?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(",");
  const warnings = body?.backendMutation?.warnings ?? body?.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) return warnings.join(",");
  return `guild_request_failed:${operation}`;
}

const SERVER_ONLY_GUILD_OPERATIONS_V1 = new Set<string>(["collect_tax", "add_xp"]);

export async function submitBiomesUIGuildMutationV1(
  operation: BiomesUIGuildMutationOperationV1,
  payload: BiomesUIGuildMutationPayloadV1 = {},
  options: BiomesUIGuildSubmitOptionsV1 = {},
): Promise<BiomesUIGuildLiveModeResponseV1> {
  if (SERVER_ONLY_GUILD_OPERATIONS_V1.has(String(operation))) {
    throw new Error(`guild_request_rejected:server_only_operation:${operation}`);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = buildGuildRequestIdV1(operation, options);
  const response = await fetchImpl("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_guild_mutation",
      subsystem: "guild",
      actorEntityVersion: options.actorEntityVersion ?? 1,
      zoneId: options.zoneId ?? "the_grove",
      payload: {
        operation,
        ...payload,
      },
      clientClaims: {},
    }),
  });
  const body = (await response.json()) as BiomesUIGuildLiveModeResponseV1;
  if (!response.ok || body?.ok === false) {
    throw new Error(responseErrorMessageV1(operation, body));
  }
  const reducerWarnings = body?.backendMutation?.warnings ?? [];
  const rejection = reducerWarnings.find((warning) => String(warning).startsWith("guild_rejected:"));
  if (rejection) throw new Error(rejection);
  return body;
}

export function hasBiomesUIGuildPermissionV1(
  snapshot: BiomesUIGuildClientSnapshotV1 | undefined,
  permission: HarthmereGuildPermissionV1,
): boolean {
  return snapshot?.permissions?.[permission] === true;
}

export function formatBiomesUIGuildDateV1(ms: number | undefined): string {
  if (!Number.isFinite(Number(ms))) return "—";
  try {
    return new Date(Number(ms)).toLocaleDateString();
  } catch {
    return "—";
  }
}

export interface BiomesUIGuildsAdapterV1 {
  isHydrated: () => boolean;
  getSnapshot: () => BiomesUIGuildClientSnapshotV1 | undefined;
  refresh: () => Promise<void>;
  getGuildName: () => string;
  getRoster: () => Array<{ id: string; name: string; class: string; rank: string; online: boolean; lastSeen: string; contributionXp: number }>;
  getRanks: () => Array<{ id: string; name: string; canInvite: boolean; canKick: boolean; canEditBank: boolean }>;
  getBulletin: () => string;
  getFinder: () => BiomesUIGuildDirectoryEntryV1[];
  getPendingApplications: () => HarthmereGuildApplicationV1[];
  getPendingInvites: () => HarthmereGuildInviteV1[];
  getDepositCandidates: () => BiomesUIGuildDepositCandidateV1[];
  getGuildHallCandidates: () => BiomesUIGuildHallCandidateV1[];
  createGuild: (input: { name: string; tag: string; description?: string; guildType?: string; recruitment?: string; displayName?: string }) => Promise<void>;
  updateProfile: (input: { description?: string; recruitment?: string; guildType?: string }) => Promise<void>;
  applyToGuild: (guildId: string, message?: string) => Promise<void>;
  cancelApplication: (guildId: string, applicationId: string) => Promise<void>;
  acceptApplication: (guildId: string, applicationId: string) => Promise<void>;
  rejectApplication: (guildId: string, applicationId: string) => Promise<void>;
  inviteMember: (targetActorId: string, displayName?: string) => Promise<void>;
  acceptInvite: (guildId: string, inviteId: string) => Promise<void>;
  declineInvite: (guildId: string, inviteId: string) => Promise<void>;
  kickMember: (targetActorId: string) => Promise<void>;
  leaveGuild: () => Promise<void>;
  transferLeadership: (targetActorId: string) => Promise<void>;
  createRank: (rankName: string, permissions: Partial<HarthmereGuildPermissionMapV1>, dailyBankWithdrawLimitGoldValue?: number) => Promise<void>;
  updateRank: (rankId: string, input: { rankName?: string; permissions?: Partial<HarthmereGuildPermissionMapV1>; dailyBankWithdrawLimitGoldValue?: number }) => Promise<void>;
  deleteRank: (rankId: string) => Promise<void>;
  assignRank: (targetActorId: string, rankId: string) => Promise<void>;
  depositGuildBank: (itemId: string, count: number) => Promise<void>;
  withdrawGuildBank: (itemId: string, count: number) => Promise<void>;
  depositTreasury: (amountGold: number, reason?: string) => Promise<void>;
  withdrawTreasury: (amountGold: number, reason?: string) => Promise<void>;
  setTaxRate: (taxRate: number) => Promise<void>;
  upgradeGuildBankSlots: () => Promise<void>;
  linkGuildHall: (candidate: BiomesUIGuildHallCandidateV1) => Promise<void>;
  sendChat: (message: string, channel?: "guild" | "officer") => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  muteMember: (targetActorId: string, durationMs?: number) => Promise<void>;
  disbandGuild: () => Promise<void>;
}

export interface CreateBiomesUIGuildsAdapterOptionsV1 {
  state: BiomesUIGuildClientSnapshotV1 | undefined;
  hydrated: boolean;
  setState: (state: BiomesUIGuildClientSnapshotV1 | undefined) => void;
  refresh: () => Promise<void>;
  submit?: typeof submitBiomesUIGuildMutationV1;
  inventoryDepositCandidates?: BiomesUIGuildDepositCandidateV1[];
  guildHallCandidates?: BiomesUIGuildHallCandidateV1[];
}

function memberRankNameV1(guild: HarthmereGuildRecordV1 | undefined, rankId: string | undefined): string {
  if (!guild || !rankId) return rankId ?? "—";
  return guild.ranks?.[rankId]?.name ?? rankId;
}

export function createBiomesUIGuildsAdapterV1({
  state,
  hydrated,
  setState,
  refresh,
  submit = submitBiomesUIGuildMutationV1,
  inventoryDepositCandidates = [],
  guildHallCandidates = [],
}: CreateBiomesUIGuildsAdapterOptionsV1): BiomesUIGuildsAdapterV1 {
  const snapshot = state ? normalizeBiomesUIGuildSnapshotV1(state) : undefined;
  const guild = snapshot?.guild;
  const activeGuildId = snapshot?.memberGuildId ?? guild?.guildId;

  const mutate = async (operation: BiomesUIGuildMutationOperationV1, payload: BiomesUIGuildMutationPayloadV1 = {}) => {
    const body = await submit(operation, payload);
    if (body.guildState) setState(normalizeBiomesUIGuildSnapshotV1(body.guildState));
    else await refresh();
  };

  return {
    isHydrated: () => hydrated,
    getSnapshot: () => snapshot,
    refresh,
    getGuildName: () => guild?.name ?? "No Guild Joined",
    getRoster: () =>
      (Object.values(guild?.members ?? {}) as any[])
        .filter((member) => member.status === "active")
        .sort((a, b) => (guild?.ranks?.[a.rankId]?.order ?? 999) - (guild?.ranks?.[b.rankId]?.order ?? 999) || String(a.displayName ?? a.actorId).localeCompare(String(b.displayName ?? b.actorId)))
        .map((member) => ({
          id: member.actorId,
          name: member.displayName ?? member.actorId,
          class: member.actorId === guild?.leaderActorId ? "Leader" : "Member",
          rank: memberRankNameV1(guild, member.rankId),
          online: Date.now() - Number(member.lastSeenAtMs ?? 0) < 10 * 60 * 1000,
          lastSeen: formatBiomesUIGuildDateV1(member.lastSeenAtMs),
          contributionXp: Math.max(0, Math.trunc(Number(member.contributionXp ?? 0))),
        })),
    getRanks: () =>
      (Object.values(guild?.ranks ?? {}) as any[])
        .sort((a, b) => a.order - b.order)
        .map((rank) => ({
          id: rank.rankId,
          name: rank.name,
          canInvite: rank.permissions.invite_members === true,
          canKick: rank.permissions.manage_members === true,
          canEditBank: rank.permissions.withdraw_bank === true || rank.permissions.manage_treasury === true,
        })),
    getBulletin: () =>
      guild
        ? `${guild.description || "No bulletin set."} · Level ${guild.level} · ${Object.keys(guild.members).length} members · ${(guild.taxRate * 100).toFixed(1)}% tax`
        : "Create a guild, apply to one, or accept an invite to unlock shared storage, ranks, treasury, tax, guild halls, and chat.",
    getFinder: () => snapshot?.finder ?? [],
    getPendingApplications: () => snapshot?.pendingApplications ?? [],
    getPendingInvites: () => snapshot?.pendingInvites ?? [],
    getDepositCandidates: () => inventoryDepositCandidates,
    getGuildHallCandidates: () => guildHallCandidates,
    createGuild: (input) => mutate("create_guild", input as BiomesUIGuildMutationPayloadV1),
    updateProfile: (input) => mutate("update_profile", { guildId: activeGuildId, ...input } as BiomesUIGuildMutationPayloadV1),
    applyToGuild: (guildId, message) => mutate("apply_to_guild", { guildId, message }),
    cancelApplication: (guildId, applicationId) => mutate("cancel_application", { guildId, applicationId }),
    acceptApplication: (guildId, applicationId) => mutate("accept_application", { guildId, applicationId }),
    rejectApplication: (guildId, applicationId) => mutate("reject_application", { guildId, applicationId }),
    inviteMember: (targetActorId, displayName) => mutate("invite_member", { guildId: activeGuildId, targetActorId, displayName }),
    acceptInvite: (guildId, inviteId) => mutate("accept_invite", { guildId, inviteId }),
    declineInvite: (guildId, inviteId) => mutate("decline_invite", { guildId, inviteId }),
    kickMember: (targetActorId) => mutate("kick_member", { guildId: activeGuildId, targetActorId }),
    leaveGuild: () => mutate("leave_guild", { guildId: activeGuildId }),
    transferLeadership: (targetActorId) => mutate("transfer_leader", { guildId: activeGuildId, targetActorId }),
    createRank: (rankName, permissions, dailyBankWithdrawLimitGoldValue) => mutate("create_rank", { guildId: activeGuildId, rankName, permissions, dailyBankWithdrawLimitGoldValue }),
    updateRank: (rankId, input) => mutate("update_rank", { guildId: activeGuildId, rankId, ...input }),
    deleteRank: (rankId) => mutate("delete_rank", { guildId: activeGuildId, rankId }),
    assignRank: (targetActorId, rankId) => mutate("assign_rank", { guildId: activeGuildId, targetActorId, rankId }),
    depositGuildBank: (itemId, count) => mutate("guild_bank_deposit", { guildId: activeGuildId, itemId, count }),
    withdrawGuildBank: (itemId, count) => mutate("guild_bank_withdraw", { guildId: activeGuildId, itemId, count }),
    depositTreasury: (amountGold, reason) => mutate("treasury_deposit", { guildId: activeGuildId, amountGold, reason }),
    withdrawTreasury: (amountGold, reason) => mutate("treasury_withdraw", { guildId: activeGuildId, amountGold, reason }),
    setTaxRate: (taxRate) => mutate("set_tax", { guildId: activeGuildId, taxRate }),
    upgradeGuildBankSlots: () => mutate("upgrade_guild_bank_slots", { guildId: activeGuildId }),
    linkGuildHall: (candidate) => mutate("link_guild_hall", { guildId: activeGuildId, propertyId: candidate.propertyId, plotId: candidate.plotId, blueprintId: candidate.blueprintId }),
    sendChat: (message, channel = "guild") => mutate("send_chat", { guildId: activeGuildId, message, channel }),
    deleteChatMessage: (messageId) => mutate("delete_chat_message", { guildId: activeGuildId, message: messageId }),
    muteMember: (targetActorId, durationMs = 300_000) => mutate("mute_member", { guildId: activeGuildId, targetActorId, amountGold: durationMs }),
    disbandGuild: () => mutate("disband_guild", { guildId: activeGuildId }),
  };
}
