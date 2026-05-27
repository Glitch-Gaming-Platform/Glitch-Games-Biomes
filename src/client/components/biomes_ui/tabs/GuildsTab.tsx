// GuildsTab — guild roster + ranks + bulletin.
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

const PLACEHOLDER: { roster: GuildMember[]; ranks: Rank[]; bulletin: string; name: string } = {
  name: "The Stabilizers",
  bulletin: "Weekly anomaly sweep — Friday 8pm. Bring spare exotic charge.",
  roster: [
    { id: "m1", name: "Jackie", class: "Ranger", rank: "leader", online: true, lastSeen: "now" },
    { id: "m2", name: "Glitchinstall25fe66b", class: "Mage", rank: "officer", online: true, lastSeen: "now" },
    { id: "m3", name: "Squiddy", class: "Warrior", rank: "member", online: false, lastSeen: "3h ago" },
    { id: "m4", name: "blackmage", class: "Necromancer", rank: "member", online: true, lastSeen: "now" },
  ],
  ranks: [
    { id: "leader", name: "Leader", canInvite: true, canKick: true, canEditBank: true },
    { id: "officer", name: "Officer", canInvite: true, canKick: true, canEditBank: true },
    { id: "member", name: "Member", canInvite: false, canKick: false, canEditBank: false },
    { id: "recruit", name: "Recruit", canInvite: false, canKick: false, canEditBank: false },
  ],
};

export const GuildsTab: React.FunctionComponent<{ adapter?: GuildsAdapter }> = ({ adapter }) => {
  const name = adapter?.getGuildName?.() ?? PLACEHOLDER.name;
  const roster = adapter?.getRoster?.() ?? PLACEHOLDER.roster;
  const ranks = adapter?.getRanks?.() ?? PLACEHOLDER.ranks;
  const bulletin = adapter?.getBulletin?.() ?? PLACEHOLDER.bulletin;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
      <section>
        <h3 style={titleStyle}>{name} — Bulletin</h3>
        <p style={{ margin: "0 0 14px", padding: 10, background: "var(--biomes-bg-glass)",
            border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 }}>{bulletin}</p>
        <Highlightable uniqueId={UI_IDS.GUILD_ROSTER} showCaption>
          <div role="table" aria-label="Guild roster">
            <h3 style={titleStyle}>Roster</h3>
            {roster.map((m) => (
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
