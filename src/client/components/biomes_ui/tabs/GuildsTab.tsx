// GuildsTab — guild roster + ranks + guild hall onboarding.
import {
  BUILDING_SYSTEM_BLUEPRINTS_V1,
  BUILDING_SYSTEM_PLOTS_V1,
} from "@/shared/harthmere/building_system_v1";
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface GuildMember { id: string; name: string; class: string; rank: string; online: boolean; lastSeen: string }
interface Rank { id: string; name: string; canInvite: boolean; canKick: boolean; canEditBank: boolean }
interface GuildsAdapter {
  getGuildName?: () => string;
  getRoster?: () => GuildMember[];
  getRanks?: () => Rank[];
  getBulletin?: () => string;
}

const EMPTY_GUILD: { roster: GuildMember[]; ranks: Rank[]; bulletin: string; name: string } = {
  name: "No Guild Joined",
  bulletin: "Build or join a guild hall to unlock shared storage, permissions, and guild contracts.",
  roster: [],
  ranks: [
    { id: "leader", name: "Leader", canInvite: true, canKick: true, canEditBank: true },
    { id: "officer", name: "Officer", canInvite: true, canKick: true, canEditBank: true },
    { id: "member", name: "Member", canInvite: false, canKick: false, canEditBank: false },
    { id: "recruit", name: "Recruit", canInvite: false, canKick: false, canEditBank: false },
  ],
};

const guildBlueprint = BUILDING_SYSTEM_BLUEPRINTS_V1.find(
  (blueprint: any) => blueprint?.buildingUse === "guild" || blueprint?.use === "guild" || /guild/i.test(String(blueprint?.displayName ?? blueprint?.blueprintId ?? "")),
);
const guildPlot = BUILDING_SYSTEM_PLOTS_V1.find(
  (plot: any) => Array.isArray(plot?.allowedBlueprintIds) && guildBlueprint?.blueprintId && plot.allowedBlueprintIds.includes(guildBlueprint.blueprintId),
);

export const GuildsTab: React.FunctionComponent<{ adapter?: GuildsAdapter }> = ({ adapter }) => {
  const name = adapter?.getGuildName?.() ?? EMPTY_GUILD.name;
  const roster = adapter?.getRoster?.() ?? EMPTY_GUILD.roster;
  const ranks = adapter?.getRanks?.() ?? EMPTY_GUILD.ranks;
  const bulletin = adapter?.getBulletin?.() ?? EMPTY_GUILD.bulletin;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
      <section>
        <h3 style={titleStyle}>{name} — Bulletin</h3>
        <p style={{ margin: "0 0 14px", padding: 10, background: "var(--biomes-bg-glass)",
            border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 }}>{bulletin}</p>
        <Highlightable uniqueId={UI_IDS.GUILD_ROSTER} showCaption>
          <div role="table" aria-label="Guild roster">
            <h3 style={titleStyle}>Roster</h3>
            {roster.length === 0 ? (
              <div role="row" tabIndex={0}
                style={{ padding: "8px 10px", background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", fontSize: 12 }}>
                No guild members yet. Build a guild hall or accept an invite to start a roster.
              </div>
            ) : roster.map((m) => (
              <div key={m.id} role="row" tabIndex={0}
                style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 70px", padding: "6px 10px",
                  background: "var(--biomes-bg-glass)", borderBottom: "1px solid var(--biomes-edge-cyan-soft)", fontSize: 12 }}>
                <span><strong>{m.name}</strong></span>
                <span style={{ color: "var(--biomes-fg-muted)" }}>{m.class}</span>
                <span style={{ color: "var(--biomes-fg-muted)" }}>{m.rank}</span>
                <span style={{ color: m.online ? "#78e68c" : "var(--biomes-fg-dim)" }}>{m.online ? "online" : m.lastSeen}</span>
              </div>
            ))}
          </div>
        </Highlightable>

        <Highlightable uniqueId={UI_IDS.GUILD_BUILDING_GUIDE} showCaption>
          <div className="biomes-ui-guild-building-guide" data-guild-building-guide="true">
            <h3 style={titleStyle}>Guild Hall Building Guide</h3>
            <strong>{guildBlueprint?.displayName ?? "Guild Hall"}</strong>
            <ol>
              <li>Open the Building System tab with <kbd>L</kbd>.</li>
              <li>Claim the {guildPlot?.displayName ?? "Grove guild plot"} and make the muck land safe.</li>
              <li>Select the guild blueprint and complete every construction stage.</li>
              <li>Set access mode to guild, then use guild permissions for doors and shared storage.</li>
            </ol>
          </div>
        </Highlightable>
      </section>
      <section>
        <h3 style={titleStyle}>Ranks</h3>
        {ranks.map((r) => (
          <Highlightable key={r.id} uniqueId={UI_IDS.GUILD_RANK(r.id)} showCaption>
            <div role="group" tabIndex={0} aria-label={`Rank ${r.name}`}
              style={{ padding: 8, marginBottom: 4, background: "var(--biomes-bg-glass)",
                border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 }}>
              <strong>{r.name}</strong>
              <div style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>
                {r.canInvite ? "invite" : "—"} · {r.canKick ? "kick" : "—"} · {r.canEditBank ? "bank" : "—"}
              </div>
            </div>
          </Highlightable>
        ))}
      </section>
    </div>
  );
};
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
