// GuildsTab — production Guild System UI wired to the live-mode guild backend.
// It surfaces guild creation, finder/applications/invites, roster/ranks,
// guild bank/treasury/tax, guild hall linking, and guild chat.

import {
  BUILDING_SYSTEM_BLUEPRINTS,
  BUILDING_SYSTEM_PLOTS,
} from "../../../../shared/harthmere/building_system";
import {
  HARTHMERE_GUILD_CREATION_FEE_GOLD,
  HARTHMERE_GUILD_CREATION_MIN_LEVEL,
  HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH,
  HARTHMERE_GUILD_MAX_NAME_LENGTH,
  HARTHMERE_GUILD_MAX_TAG_LENGTH,
  HARTHMERE_GUILD_MAX_TAX_RATE,
  type HarthmereGuildChatMessage,
  type HarthmereGuildPermissionMap,
  type HarthmereGuildPermission,
} from "../../../../shared/harthmere/mmo_guild_authority";
import type {
  BiomesUIGuildDepositCandidate,
  BiomesUIGuildHallCandidate,
  BiomesUIGuildsAdapter,
} from "../adapters/guildsLiveAdapter";
import { biomesInventoryItemIcon } from "../adapters/inventoryItemPresentation";
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

interface LegacyGuildMember {
  id: string;
  name: string;
  class: string;
  rank: string;
  online: boolean;
  lastSeen: string;
  contributionXp: number;
}
interface LegacyRank {
  id: string;
  name: string;
  canInvite: boolean;
  canKick: boolean;
  canEditBank: boolean;
}
interface GuildsAdapter extends Partial<BiomesUIGuildsAdapter> {
  getGuildName?: () => string;
  getRoster?: () => LegacyGuildMember[];
  getRanks?: () => LegacyRank[];
  getBulletin?: () => string;
}

type GuildPanel = "overview" | "finder" | "bank" | "ranks" | "chat" | "hall" | "logs";

const EMPTY_GUILD: { roster: LegacyGuildMember[]; ranks: LegacyRank[]; bulletin: string; name: string } = {
  name: "No Guild Joined",
  bulletin: "Create or join a guild to unlock shared storage, ranks, treasury, tax, guild halls, and chat.",
  roster: [],
  ranks: [
    { id: "leader", name: "Leader", canInvite: true, canKick: true, canEditBank: true },
    { id: "officer", name: "Officer", canInvite: true, canKick: true, canEditBank: true },
    { id: "member", name: "Member", canInvite: false, canKick: false, canEditBank: false },
    { id: "recruit", name: "Recruit", canInvite: false, canKick: false, canEditBank: false },
  ],
};

const guildBlueprint = BUILDING_SYSTEM_BLUEPRINTS.find(
  (blueprint: any) => blueprint?.buildingUse === "guild" || blueprint?.use === "guild" || /guild/i.test(String(blueprint?.displayName ?? blueprint?.blueprintId ?? "")),
);
const guildPlot = BUILDING_SYSTEM_PLOTS.find(
  (plot: any) => Array.isArray(plot?.allowedBlueprintIds) && guildBlueprint?.blueprintId && plot.allowedBlueprintIds.includes(guildBlueprint.blueprintId),
);

const GUILD_PANELS: Array<{ key: GuildPanel; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "finder", label: "Finder" },
  { key: "bank", label: "Bank" },
  { key: "ranks", label: "Ranks" },
  { key: "chat", label: "Chat" },
  { key: "hall", label: "Hall" },
  { key: "logs", label: "Logs" },
];

const PERMISSION_OPTIONS: Array<{ key: HarthmereGuildPermission; label: string }> = [
  { key: "invite_members", label: "Invite" },
  { key: "manage_applications", label: "Applications" },
  { key: "manage_members", label: "Members" },
  { key: "manage_ranks", label: "Ranks" },
  { key: "deposit_bank", label: "Deposit" },
  { key: "withdraw_bank", label: "Withdraw" },
  { key: "manage_treasury", label: "Treasury" },
  { key: "set_tax", label: "Tax" },
  { key: "manage_guild_hall", label: "Hall" },
  { key: "send_chat", label: "Chat" },
  { key: "moderate_chat", label: "Moderate" },
  { key: "disband_guild", label: "Disband" },
];

function gold(value: number | undefined): string {
  return `${Math.max(0, Number(value ?? 0)).toLocaleString()}g`;
}

function pct(value: number | undefined): string {
  return `${((Number(value ?? 0) || 0) * 100).toFixed(1)}%`;
}

function positiveWholeNumber(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const integer = Math.trunc(parsed);
  return integer > 0 ? integer : undefined;
}

function nonNegativeWholeNumber(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const integer = Math.trunc(parsed);
  return integer >= 0 ? integer : undefined;
}

function shortDate(ms: number | undefined): string {
  if (!Number.isFinite(Number(ms))) return "—";
  try {
    return new Date(Number(ms)).toLocaleDateString();
  } catch {
    return "—";
  }
}

function hasPermission(adapter: GuildsAdapter | undefined, permission: HarthmereGuildPermission): boolean {
  return adapter?.getSnapshot?.()?.permissions?.[permission] === true;
}

function permissionSummary(permissions: Partial<HarthmereGuildPermissionMap> | undefined): string {
  if (!permissions) return "No permissions";
  const labels = PERMISSION_OPTIONS.filter((entry) => permissions[entry.key]).map((entry) => entry.label);
  return labels.length ? labels.join(" · ") : "No permissions";
}

function bankItems(guild: any): Array<[string, number]> {
  return Object.entries(guild?.bank?.items ?? {})
    .map(([itemId, count]) => [itemId, Number(count)] as [string, number])
    .filter(([, count]) => Number.isFinite(count) && count > 0);
}

function recentChat(messages: HarthmereGuildChatMessage[] | undefined) {
  return [...(messages ?? [])]
    .filter((message) => !message.deletedAtMs)
    .slice(-20)
    .reverse();
}

export const GuildsTab: React.FunctionComponent<{ adapter?: GuildsAdapter }> = ({ adapter }) => {
  const snapshot = adapter?.getSnapshot?.();
  const guild = snapshot?.guild;
  const name = adapter?.getGuildName?.() ?? EMPTY_GUILD.name;
  const roster = adapter?.getRoster?.() ?? EMPTY_GUILD.roster;
  const ranks = adapter?.getRanks?.() ?? EMPTY_GUILD.ranks;
  const bulletin = adapter?.getBulletin?.() ?? EMPTY_GUILD.bulletin;
  const finder = adapter?.getFinder?.() ?? [];
  const pendingApplications = adapter?.getPendingApplications?.() ?? [];
  const pendingInvites = adapter?.getPendingInvites?.() ?? [];
  const depositCandidates = adapter?.getDepositCandidates?.() ?? [];
  const hallCandidates = adapter?.getGuildHallCandidates?.() ?? [];
  const hydrated = adapter?.isHydrated?.() ?? !!snapshot;

  const [panel, setPanel] = React.useState<GuildPanel>(guild ? "overview" : "finder");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [createName, setCreateName] = React.useState("Iron Lanterns");
  const [createTag, setCreateTag] = React.useState("IRON");
  const [createDescription, setCreateDescription] = React.useState("Cooperative Grove builders, crafters, and defenders.");
  const [createType, setCreateType] = React.useState("adventuring");
  const [createRecruitment, setCreateRecruitment] = React.useState("application");
  const [finderMessage, setFinderMessage] = React.useState("I want to help with guild projects and Grove defense.");
  const [inviteActorId, setInviteActorId] = React.useState("");
  const [inviteDisplayName, setInviteDisplayName] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState("");
  const [selectedRank, setSelectedRank] = React.useState("member");
  const [newRankName, setNewRankName] = React.useState("Quartermaster");
  const [newRankLimit, setNewRankLimit] = React.useState("250");
  const [newRankPermissions, setNewRankPermissions] = React.useState<Partial<HarthmereGuildPermissionMap>>({
    invite_members: true,
    deposit_bank: true,
    withdraw_bank: true,
    send_chat: true,
  });
  const [bankItemId, setBankItemId] = React.useState("");
  const [bankCount, setBankCount] = React.useState("1");
  const [treasuryAmount, setTreasuryAmount] = React.useState("50");
  const [treasuryReason, setTreasuryReason] = React.useState("Guild operations");
  const [taxPercent, setTaxPercent] = React.useState(String(Math.round((guild?.taxRate ?? 0) * 1000) / 10));
  const [chatMessage, setChatMessage] = React.useState("");
  const [chatChannel, setChatChannel] = React.useState<"guild" | "officer">("guild");
  const [hallPropertyId, setHallPropertyId] = React.useState("");

  React.useEffect(() => {
    if (guild) setTaxPercent(String(Math.round((guild.taxRate ?? 0) * 1000) / 10));
  }, [guild?.guildId, guild?.taxRate]);

  React.useEffect(() => {
    if (!bankItemId && depositCandidates[0]?.id) {
      setBankItemId(depositCandidates[0].id);
    }
  }, [bankItemId, depositCandidates]);

  React.useEffect(() => {
    if (!selectedMember && roster[0]?.id) setSelectedMember(roster[0].id);
  }, [roster, selectedMember]);

  const runAction = React.useCallback(
    async (label: string, action: (() => Promise<void> | void | undefined) | undefined) => {
      if (!action) {
        setError("Guild services are not ready yet.");
        return;
      }
      setBusy(label);
      setNotice(null);
      setError(null);
      try {
        await action();
        setNotice(label);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const normalizedCreateName = createName.trim().replace(/\s+/g, " ");
  const normalizedCreateTag = createTag.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
  const canCreateGuild =
    !guild &&
    normalizedCreateName.length >= 3 &&
    normalizedCreateName.length <= HARTHMERE_GUILD_MAX_NAME_LENGTH &&
    normalizedCreateTag.length >= 2 &&
    normalizedCreateTag.length <= HARTHMERE_GUILD_MAX_TAG_LENGTH &&
    createDescription.length <= HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH;
  const bankCountValue = positiveWholeNumber(bankCount);
  const treasuryAmountValue = positiveWholeNumber(treasuryAmount);
  const newRankLimitValue = nonNegativeWholeNumber(newRankLimit);
  const taxRateValue = Number(taxPercent);
  const selectedIsSelf = !!snapshot?.actorId && selectedMember === snapshot.actorId;
  const bankRows = bankItems(guild);
  const rankRecords = (Object.values(guild?.ranks ?? {}) as any[]).sort((a, b) => a.order - b.order);
  const applicationRows = (Object.values(guild?.applications ?? {}) as any[]).filter((app) => app.status === "pending");
  const inviteRows = (Object.values(guild?.invites ?? {}) as any[]).filter((invite) => invite.status === "pending");

  return (
    <div style={{ display: "grid", gap: 14 }} data-biomes-ui-guilds="production">
      {!hydrated ? (
        <div style={warningStyle}>Checking your guild hall…</div>
      ) : null}
      {error ? <div role="alert" style={errorStyle}>{error}</div> : null}
      {notice ? <div role="status" style={successStyle}>Done: {notice}</div> : null}
      {busy ? <div role="status" style={warningStyle}>Working: {busy}…</div> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {GUILD_PANELS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="biomes-ui-tab"
            aria-pressed={panel === entry.key}
            onClick={() => setPanel(entry.key)}
          >
            {entry.label}
          </button>
        ))}
        <button type="button" className="biomes-ui-tab" onClick={() => void runAction("Refreshed guild state", () => adapter?.refresh?.())}>
          Refresh
        </button>
      </div>

      {panel === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>{name} — Bulletin</h3>
            <p style={bulletinStyle}>{bulletin}</p>
            <div style={statsGridStyle}>
              <Stat label="Level" value={String(guild?.level ?? 0)} />
              <Stat label="XP" value={(guild?.xp ?? 0).toLocaleString()} />
              <Stat label="Treasury" value={gold(guild?.treasuryGold)} />
              <Stat label="Tax" value={pct(guild?.taxRate)} />
              <Stat label="Bank Slots" value={`${bankRows.length}/${guild?.bank?.maxSlots ?? 0}`} />
              <Stat label="Guild Hall" value={biomesPlayerTitle(guild?.guildHall?.status ?? "none")} />
            </div>

            <Highlightable uniqueId={UI_IDS.GUILD_ROSTER} showCaption>
              <div role="table" aria-label="Guild roster" style={{ marginTop: 14 }}>
                <h3 style={titleStyle}>Roster</h3>
                {roster.length === 0 ? (
                  <div role="row" tabIndex={0} style={emptyRowStyle}>No guild members yet. Create a guild, accept an invite, or apply through the finder.</div>
                ) : roster.map((member) => (
                  <div key={member.id} role="row" tabIndex={0} style={rosterRowStyle}>
                    <span><strong>{member.name}</strong><br /><small style={mutedInlineStyle}>{member.id}</small></span>
                    <span style={mutedInlineStyle}>{member.class}</span>
                    <span style={mutedInlineStyle}>{member.rank}</span>
                    <span style={mutedInlineStyle}>{Math.max(0, Number(member.contributionXp ?? 0)).toLocaleString()}</span>
                    <span style={{ color: member.online ? "#78e68c" : "var(--biomes-fg-dim)" }}>{member.online ? "online" : member.lastSeen}</span>
                  </div>
                ))}
              </div>
            </Highlightable>
          </section>

          <section>
            <h3 style={titleStyle}>Member Management</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Target Member
                <select value={selectedMember} onChange={(event) => setSelectedMember(event.currentTarget.value)} style={inputStyle}>
                  {roster.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Rank
                <select value={selectedRank} onChange={(event) => setSelectedRank(event.currentTarget.value)} style={inputStyle}>
                  {rankRecords.map((rank) => <option key={rank.rankId} value={rank.rankId}>{rank.name}</option>)}
                </select>
              </label>
              <div style={buttonGridStyle}>
                <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_members") || !selectedMember || selectedIsSelf || selectedRank === "leader"} onClick={() => void runAction("Assigned rank", () => adapter?.assignRank?.(selectedMember, selectedRank))}>Assign Rank</button>
                <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_members") || !selectedMember || selectedIsSelf} onClick={() => void runAction("Kicked member", () => adapter?.kickMember?.(selectedMember))}>Kick</button>
                <button type="button" className="biomes-ui-tab" disabled={snapshot?.role !== "leader" || !selectedMember || selectedIsSelf} onClick={() => void runAction("Transferred leadership", () => adapter?.transferLeadership?.(selectedMember))}>Transfer Lead</button>
                <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "moderate_chat") || !selectedMember} onClick={() => void runAction("Muted member", () => adapter?.muteMember?.(selectedMember, 300_000))}>Mute 5m</button>
              </div>
            </div>

            <h3 style={{ ...titleStyle, marginTop: 14 }}>Invite</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Actor ID<input value={inviteActorId} onChange={(event) => setInviteActorId(event.currentTarget.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Display Name<input value={inviteDisplayName} onChange={(event) => setInviteDisplayName(event.currentTarget.value)} style={inputStyle} /></label>
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "invite_members") || !inviteActorId.trim()} onClick={() => void runAction("Invited member", () => adapter?.inviteMember?.(inviteActorId.trim(), inviteDisplayName.trim() || undefined))}>Send Invite</button>
            </div>

            <button type="button" className="biomes-ui-tab" style={{ marginTop: 12 }} disabled={!guild} onClick={() => void runAction("Left guild", () => adapter?.leaveGuild?.())}>Leave Guild</button>
          </section>
        </div>
      )}

      {panel === "finder" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>Create Guild</h3>
            <div style={cardStyle}>
              <p style={mutedTextStyle}>Level {HARTHMERE_GUILD_CREATION_MIN_LEVEL} · Charter {gold(HARTHMERE_GUILD_CREATION_FEE_GOLD)} · Name 3-{HARTHMERE_GUILD_MAX_NAME_LENGTH} · Tag 2-{HARTHMERE_GUILD_MAX_TAG_LENGTH}</p>
              <label style={labelStyle}>Name<input value={createName} maxLength={HARTHMERE_GUILD_MAX_NAME_LENGTH} onChange={(event) => setCreateName(event.currentTarget.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Tag<input value={createTag} maxLength={HARTHMERE_GUILD_MAX_TAG_LENGTH} onChange={(event) => setCreateTag(event.currentTarget.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} style={inputStyle} /></label>
              <label style={labelStyle}>Type
                <select value={createType} onChange={(event) => setCreateType(event.currentTarget.value)} style={inputStyle}>
                  <option value="adventuring">Adventuring</option>
                  <option value="crafting">Crafting</option>
                  <option value="trade">Trade</option>
                  <option value="social">Social</option>
                  <option value="pvp">PvP</option>
                  <option value="civic">Civic</option>
                </select>
              </label>
              <label style={labelStyle}>Recruitment
                <select value={createRecruitment} onChange={(event) => setCreateRecruitment(event.currentTarget.value)} style={inputStyle}>
                  <option value="open">Open</option>
                  <option value="application">Application</option>
                  <option value="invite_only">Invite Only</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label style={labelStyle}>Description<textarea value={createDescription} maxLength={HARTHMERE_GUILD_MAX_DESCRIPTION_LENGTH} onChange={(event) => setCreateDescription(event.currentTarget.value)} style={textAreaStyle} /></label>
              <button type="button" className="biomes-ui-tab" disabled={!canCreateGuild} onClick={() => void runAction("Created guild", () => adapter?.createGuild?.({ name: normalizedCreateName, tag: normalizedCreateTag, description: createDescription, guildType: createType, recruitment: createRecruitment }))}>Create Guild</button>
            </div>

            <h3 style={{ ...titleStyle, marginTop: 14 }}>Your Invites</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {pendingInvites.length === 0 ? <p style={mutedTextStyle}>No pending invites.</p> : pendingInvites.map((invite) => (
                <div key={invite.inviteId} style={cardStyle}>
                  <strong>{invite.guildId}</strong>
                  <p style={mutedTextStyle}>Expires {shortDate(invite.expiresAtMs)}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="biomes-ui-tab" onClick={() => void runAction("Accepted invite", () => adapter?.acceptInvite?.(invite.guildId, invite.inviteId))}>Accept Invite</button>
                    <button type="button" className="biomes-ui-tab" onClick={() => void runAction("Declined invite", () => adapter?.declineInvite?.(invite.guildId, invite.inviteId))}>Decline Invite</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 style={titleStyle}>Guild Finder</h3>
            <label style={labelStyle}>Application Message<textarea value={finderMessage} onChange={(event) => setFinderMessage(event.currentTarget.value)} style={textAreaStyle} /></label>
            <div style={{ display: "grid", gap: 8 }}>
              {finder.length === 0 ? <p style={mutedTextStyle}>No recruitable guilds found yet.</p> : finder.map((entry) => (
                <div key={entry.guildId} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{entry.name} [{entry.tag}]</strong>
                    <span style={mutedInlineStyle}>Lv {entry.level} · {entry.memberCount} members</span>
                  </div>
                  <p style={mutedTextStyle}>{entry.description || "No description."}</p>
                  <p style={mutedTextStyle}>{entry.type} · {entry.recruitment} · tax {pct(entry.taxRate)} · hall {entry.hasGuildHall ? "yes" : "no"}</p>
                  <button type="button" className="biomes-ui-tab" disabled={!!guild || entry.recruitment === "invite_only"} onClick={() => void runAction("Applied to guild", () => adapter?.applyToGuild?.(entry.guildId, finderMessage))}>
                    {entry.recruitment === "open" ? "Join" : "Apply"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {panel === "bank" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>Guild Bank</h3>
            <div style={statsGridStyle}>
              <Stat label="Slots" value={`${bankRows.length}/${guild?.bank?.maxSlots ?? 0}`} />
              <Stat label="Treasury" value={gold(guild?.treasuryGold)} />
              <Stat label="Tax" value={pct(guild?.taxRate)} />
              <Stat label="Withdraw Permission" value={hasPermission(adapter, "withdraw_bank") ? "yes" : "no"} />
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {bankRows.length === 0 ? <p style={mutedTextStyle}>The guild bank is empty.</p> : bankRows.map(([itemId, count]) => (
                <div key={itemId} style={bankRowStyle}>
                  <span>{biomesInventoryItemIcon(itemId)}</span>
                  <span><strong>{itemId}</strong></span>
                  <span>x{count}</span>
                  <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "withdraw_bank") || !bankCountValue} onClick={() => void runAction("Withdrew guild bank item", () => adapter?.withdrawGuildBank?.(itemId, bankCountValue ?? 1))}>Withdraw</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 style={titleStyle}>Deposit / Withdraw</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Inventory Item
                <select value={bankItemId} onChange={(event) => setBankItemId(event.currentTarget.value)} style={inputStyle}>
                  <option value="">Select item…</option>
                  {depositCandidates.map((item) => <option key={item.id} value={item.id}>{item.name} x{item.quantity}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Count<input value={bankCount} inputMode="numeric" onChange={(event) => setBankCount(event.currentTarget.value)} style={inputStyle} /></label>
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "deposit_bank") || !bankItemId || !bankCountValue} onClick={() => void runAction("Deposited guild bank item", () => adapter?.depositGuildBank?.(bankItemId, bankCountValue ?? 1))}>Deposit</button>
            </div>

            <h3 style={{ ...titleStyle, marginTop: 14 }}>Treasury</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Gold<input value={treasuryAmount} inputMode="numeric" onChange={(event) => setTreasuryAmount(event.currentTarget.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Reason<input value={treasuryReason} onChange={(event) => setTreasuryReason(event.currentTarget.value)} style={inputStyle} /></label>
              <div style={buttonGridStyle}>
                <button type="button" className="biomes-ui-tab" disabled={!treasuryAmountValue} onClick={() => void runAction("Deposited treasury gold", () => adapter?.depositTreasury?.(treasuryAmountValue ?? 1, treasuryReason))}>Deposit</button>
                <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_treasury") || !treasuryAmountValue} onClick={() => void runAction("Withdrew treasury gold", () => adapter?.withdrawTreasury?.(treasuryAmountValue ?? 1, treasuryReason))}>Withdraw</button>
                <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_treasury")} onClick={() => void runAction("Upgraded guild bank slots", () => adapter?.upgradeGuildBankSlots?.())}>Upgrade Slots</button>
              </div>
            </div>

            <h3 style={{ ...titleStyle, marginTop: 14 }}>Tax</h3>
            <div style={cardStyle}>
              <p style={mutedTextStyle}>Max tax: {pct(HARTHMERE_GUILD_MAX_TAX_RATE)}</p>
              <label style={labelStyle}>Tax %<input value={taxPercent} inputMode="decimal" onChange={(event) => setTaxPercent(event.currentTarget.value)} style={inputStyle} /></label>
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "set_tax") || !Number.isFinite(taxRateValue) || taxRateValue < 0 || taxRateValue / 100 > HARTHMERE_GUILD_MAX_TAX_RATE} onClick={() => void runAction("Updated guild tax", () => adapter?.setTaxRate?.(taxRateValue / 100))}>Set Tax</button>
            </div>
          </section>
        </div>
      )}

      {panel === "ranks" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>Ranks & Permissions</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {rankRecords.length === 0 ? ranks.map((rank) => (
                <RankCard key={rank.id} id={rank.id} name={rank.name} summary={`${rank.canInvite ? "invite" : "—"} · ${rank.canKick ? "kick" : "—"} · ${rank.canEditBank ? "bank" : "—"}`} />
              )) : rankRecords.map((rank) => (
                <Highlightable key={rank.rankId} uniqueId={UI_IDS.GUILD_RANK(rank.rankId)} showCaption>
                  <div style={cardStyle}>
                    <strong>{rank.name}</strong>
                    <p style={mutedTextStyle}>Order {rank.order} · Daily withdraw limit: {rank.dailyBankWithdrawLimitGoldValue === Number.MAX_SAFE_INTEGER ? "unlimited" : gold(rank.dailyBankWithdrawLimitGoldValue)}</p>
                    <p style={mutedTextStyle}>{permissionSummary(rank.permissions)}</p>
                    <div style={buttonGridStyle}>
                      <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_ranks") || ["leader", "officer", "member", "recruit"].includes(rank.rankId)} onClick={() => void runAction("Deleted rank", () => adapter?.deleteRank?.(rank.rankId))}>Delete</button>
                    </div>
                  </div>
                </Highlightable>
              ))}
            </div>
          </section>

          <section>
            <h3 style={titleStyle}>Create Rank</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Name<input value={newRankName} onChange={(event) => setNewRankName(event.currentTarget.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Daily Withdraw Limit<input value={newRankLimit} inputMode="numeric" onChange={(event) => setNewRankLimit(event.currentTarget.value)} style={inputStyle} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 10 }}>
                {PERMISSION_OPTIONS.map((entry) => (
                  <label key={entry.key} style={checkboxStyle}>
                    <input type="checkbox" checked={newRankPermissions[entry.key] === true} onChange={(event) => setNewRankPermissions((prev) => ({ ...prev, [entry.key]: event.currentTarget.checked }))} />
                    {entry.label}
                  </label>
                ))}
              </div>
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_ranks") || newRankName.trim().length < 2 || newRankLimitValue === undefined} onClick={() => void runAction("Created rank", () => adapter?.createRank?.(newRankName, newRankPermissions, newRankLimitValue ?? 0))}>Create Rank</button>
            </div>

            <h3 style={{ ...titleStyle, marginTop: 14 }}>Applications</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {applicationRows.length === 0 ? <p style={mutedTextStyle}>No pending applications.</p> : applicationRows.map((app) => (
                <div key={app.applicationId} style={cardStyle}>
                  <strong>{app.applicantDisplayName ?? app.applicantActorId}</strong>
                  <p style={mutedTextStyle}>{app.message || "No message."}</p>
                  <div style={buttonGridStyle}>
                    <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_applications")} onClick={() => void runAction("Accepted application", () => adapter?.acceptApplication?.(app.guildId, app.applicationId))}>Accept</button>
                    <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_applications")} onClick={() => void runAction("Rejected application", () => adapter?.rejectApplication?.(app.guildId, app.applicationId))}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {panel === "chat" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>Guild Chat</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {recentChat(guild?.chatMessages).length === 0 ? <p style={mutedTextStyle}>No guild chat messages yet.</p> : recentChat(guild?.chatMessages).map((message) => (
                <div key={message.messageId} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{message.displayName ?? message.actorId}</strong>
                    <span style={mutedInlineStyle}>{message.channel} · {shortDate(message.createdAtMs)}</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>{message.body}</p>
                  <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "moderate_chat")} onClick={() => void runAction("Deleted chat message", () => adapter?.deleteChatMessage?.(message.messageId))}>Delete</button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 style={titleStyle}>Send Message</h3>
            <div style={cardStyle}>
              <label style={labelStyle}>Channel
                <select value={chatChannel} onChange={(event) => setChatChannel(event.currentTarget.value as "guild" | "officer")} style={inputStyle}>
                  <option value="guild">Guild</option>
                  <option value="officer">Officer</option>
                </select>
              </label>
              <label style={labelStyle}>Message<textarea value={chatMessage} onChange={(event) => setChatMessage(event.currentTarget.value)} style={textAreaStyle} /></label>
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "send_chat") || chatMessage.trim().length < 1} onClick={() => void runAction("Sent guild chat", async () => { await adapter?.sendChat?.(chatMessage, chatChannel); setChatMessage(""); })}>Send</button>
            </div>
          </section>
        </div>
      )}

      {panel === "hall" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
          <section>
            <Highlightable uniqueId={UI_IDS.GUILD_BUILDING_GUIDE} showCaption>
              <div className="biomes-ui-guild-building-guide" data-guild-building-guide="true" style={cardStyle}>
                <h3 style={titleStyle}>Guild Hall Building Guide</h3>
                <strong>{guildBlueprint?.displayName ?? "Guild Hall"}</strong>
                <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  <li>Open the Building System tab with <kbd>L</kbd>.</li>
                  <li>Claim the {guildPlot?.displayName ?? "Grove guild plot"} and make the muck land safe.</li>
                  <li>Select the guild blueprint and complete every construction stage.</li>
                  <li>Set access mode to guild, then link the completed property here.</li>
                </ol>
              </div>
            </Highlightable>
            <div style={{ ...cardStyle, marginTop: 10 }}>
              <h3 style={titleStyle}>Linked Hall</h3>
              <p style={mutedTextStyle}>Status: {biomesPlayerTitle(guild?.guildHall?.status ?? "none")}</p>
              <p style={mutedTextStyle}>Property: {guild?.guildHall?.propertyId ?? "—"}</p>
              <p style={mutedTextStyle}>Services: {(guild?.guildHall?.servicesUnlocked ?? []).join(" · ") || "none"}</p>
            </div>
          </section>
          <section>
            <h3 style={titleStyle}>Link Completed Guild Hall</h3>
            <div style={cardStyle}>
              {hallCandidates.length > 0 ? (
                <label style={labelStyle}>Completed Properties
                  <select value={hallPropertyId} onChange={(event) => setHallPropertyId(event.currentTarget.value)} style={inputStyle}>
                    <option value="">Select property…</option>
                    {hallCandidates.map((candidate) => <option key={candidate.propertyId} value={candidate.propertyId}>{candidate.label}</option>)}
                  </select>
                </label>
              ) : (
                <label style={labelStyle}>Property ID<input value={hallPropertyId} onChange={(event) => setHallPropertyId(event.currentTarget.value)} placeholder="property_grove_guild_plot" style={inputStyle} /></label>
              )}
              <button type="button" className="biomes-ui-tab" disabled={!hasPermission(adapter, "manage_guild_hall") || !hallPropertyId.trim()} onClick={() => {
                const candidate = hallCandidates.find((entry) => entry.propertyId === hallPropertyId) ?? { propertyId: hallPropertyId.trim(), plotId: guildPlot?.plotId, blueprintId: guildBlueprint?.blueprintId, label: hallPropertyId.trim() } as BiomesUIGuildHallCandidate;
                void runAction("Linked guild hall", () => adapter?.linkGuildHall?.(candidate));
              }}>Link Hall</button>
            </div>
          </section>
        </div>
      )}

      {panel === "logs" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <section>
            <h3 style={titleStyle}>Treasury Logs</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {(guild?.treasuryLogs ?? []).slice(-20).reverse().map((log) => (
                <div key={log.id} style={cardStyle}><strong>{log.kind}</strong><p style={mutedTextStyle}>{gold(log.amountGold)} · {log.reason ?? "—"} · {shortDate(log.atMs)}</p></div>
              ))}
              {(guild?.treasuryLogs ?? []).length === 0 ? <p style={mutedTextStyle}>No treasury logs.</p> : null}
            </div>
          </section>
          <section>
            <h3 style={titleStyle}>Audit / Bank Logs</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {(guild?.auditLogs ?? []).slice(-12).reverse().map((log) => (
                <div key={log.id} style={cardStyle}><strong>{log.kind}</strong><p style={mutedTextStyle}>{log.detail ?? "—"} · {shortDate(log.atMs)}</p></div>
              ))}
              {(guild?.bank?.logs ?? []).slice(-8).reverse().map((log) => (
                <div key={log.id} style={cardStyle}><strong>bank {log.kind}</strong><p style={mutedTextStyle}>{log.itemId ? `${log.itemId} x${log.count ?? 1}` : gold(log.goldValue)} · {shortDate(log.atMs)}</p></div>
              ))}
              {inviteRows.length > 0 ? <p style={mutedTextStyle}>Pending sent invites: {inviteRows.length}</p> : null}
              {(guild?.auditLogs ?? []).length === 0 && (guild?.bank?.logs ?? []).length === 0 ? <p style={mutedTextStyle}>No audit or bank logs.</p> : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const Stat: React.FunctionComponent<{ label: string; value: string }> = ({ label, value }) => (
  <div style={statStyle}>
    <span style={mutedInlineStyle}>{label}</span>
    <strong>{value}</strong>
  </div>
);

const RankCard: React.FunctionComponent<{ id: string; name: string; summary: string }> = ({ id, name, summary }) => (
  <Highlightable uniqueId={UI_IDS.GUILD_RANK(id)} showCaption>
    <div role="group" tabIndex={0} aria-label={`Rank ${name}`} style={cardStyle}>
      <strong>{name}</strong>
      <div style={mutedTextStyle}>{summary}</div>
    </div>
  </Highlightable>
);

const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)", lineHeight: 1.45 };
const mutedInlineStyle: React.CSSProperties = { color: "var(--biomes-fg-muted)", fontSize: 11 };
const bulletinStyle: React.CSSProperties = { margin: "0 0 14px", padding: 10, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 };
const cardStyle: React.CSSProperties = { padding: 10, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 };
const emptyRowStyle: React.CSSProperties = { padding: "8px 10px", background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", fontSize: 12 };
const rosterRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 82px 82px 80px 70px", gap: 8, padding: "6px 10px", background: "var(--biomes-bg-glass)", borderBottom: "1px solid var(--biomes-edge-cyan-soft)", fontSize: 12 };
const statsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 };
const statStyle: React.CSSProperties = { display: "grid", gap: 2, padding: 8, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, marginBottom: 8, fontSize: 11, color: "var(--biomes-fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em" };
const inputStyle: React.CSSProperties = { minWidth: 0, padding: "6px 8px", color: "var(--biomes-fg)", background: "var(--biomes-bg-deep)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const textAreaStyle: React.CSSProperties = { ...inputStyle, minHeight: 72, resize: "vertical" };
const checkboxStyle: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--biomes-fg-muted)" };
const buttonGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 };
const bankRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "20px 1fr auto auto", gap: 8, alignItems: "center", padding: 8, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 };
const errorStyle: React.CSSProperties = { padding: 10, color: "#fecaca", background: "rgba(127,29,29,0.35)", border: "1px solid rgba(252,165,165,0.45)", borderRadius: 4, fontSize: 12 };
const successStyle: React.CSSProperties = { padding: 10, color: "#bbf7d0", background: "rgba(20,83,45,0.35)", border: "1px solid rgba(134,239,172,0.45)", borderRadius: 4, fontSize: 12 };
const warningStyle: React.CSSProperties = { padding: 10, color: "#fde68a", background: "rgba(113,63,18,0.35)", border: "1px solid rgba(253,230,138,0.45)", borderRadius: 4, fontSize: 12 };
