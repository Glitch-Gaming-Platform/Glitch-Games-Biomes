// AbilitiesTab — active ability loadout (8 slots) and an ability library.
// Wires through `adapter`:
//   - getEquipped(): Array<Ability | null>
//   - getLibrary(): Ability[]
//   - assign(slot, abilityId)
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

interface Ability {
  id: string;
  name: string;
  icon: string;
  cooldown: number;
  cost: number;
  resource: string;
  description: string;
}
interface AbilitiesAdapter {
  getEquipped?: () => Array<Ability | null>;
  getLibrary?: () => Ability[];
  assign?: (slot: number, abilityId: string) => void;
}

const PLACEHOLDER_LIBRARY: Ability[] = [
  { id: "rift_step", name: "Rift Step", icon: "⇶", cooldown: 12, cost: 25, resource: "Exotic Charge", description: "Phase 6m through space — bypasses solid biome walls briefly." },
  { id: "echo_strike", name: "Echo Strike", icon: "⚡", cooldown: 4, cost: 15, resource: "Stamina", description: "A second hit echoes from 0.4s in your past — combos with melee." },
  { id: "stasis_field", name: "Stasis Field", icon: "❄", cooldown: 30, cost: 40, resource: "Mana", description: "Slows time in a 4m radius for 6s — enemies move at 30% speed." },
  { id: "anchor", name: "Anchor", icon: "⚓", cooldown: 60, cost: 50, resource: "Conviction", description: "Set a temporal anchor — die within 30s to revert to this point." },
];

export const AbilitiesTab: React.FunctionComponent<{ adapter?: AbilitiesAdapter }> = ({ adapter }) => {
  const equipped = adapter?.getEquipped?.() ?? Array(8).fill(null);
  const library = adapter?.getLibrary?.() ?? PLACEHOLDER_LIBRARY;

  return (
    <div>
      <section aria-label="Equipped abilities">
        <h3 style={titleStyle}>Loadout — Active Slots</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {equipped.map((ab, i) => (
            <Highlightable key={i} uniqueId={UI_IDS.ABILITY_SLOT(i + 1)} showCaption>
              <button type="button" className="biomes-ui-slot" aria-label={ab ? `Ability ${i + 1}: ${ab.name}` : `Ability slot ${i + 1}: empty`}>
                {ab ? <span aria-hidden style={{ fontSize: 22 }}>{ab.icon}</span> : <span style={{ opacity: 0.4, fontSize: 10 }}>{i + 1}</span>}
              </button>
            </Highlightable>
          ))}
        </div>
      </section>
      <section aria-label="Ability library" style={{ marginTop: 18 }}>
        <h3 style={titleStyle}>Library</h3>
        <RovingGrid
          ariaLabel="Ability library"
          items={[library]}
          renderCell={(ab, { focused }, cell) =>
            React.createElement("div", {
              ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
              role: "button", "data-focused": focused ? "true" : undefined,
              "aria-label": `${ab.name} — ${ab.description}`,
              style: { width: 220, padding: 10, marginBottom: 6,
                border: focused ? "1px solid var(--biomes-edge-cyan)" : "1px solid var(--biomes-edge-cyan-soft)",
                background: "var(--biomes-bg-glass)", borderRadius: 4, cursor: "pointer", outline: "none" }
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement("span", { style: { fontSize: 22 } }, ab.icon),
                React.createElement("strong", { style: { fontSize: 13 } }, ab.name),
              ),
              React.createElement("div", { style: { marginTop: 4, fontSize: 11, color: "var(--biomes-fg-muted)" } },
                `CD ${ab.cooldown}s · Cost ${ab.cost} ${ab.resource}`),
              React.createElement("p", { style: { margin: "4px 0 0", fontSize: 11, lineHeight: 1.35 } }, ab.description),
            )
          }
        />
      </section>
    </div>
  );
};

const titleStyle: React.CSSProperties = { margin: "0 0 10px", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
