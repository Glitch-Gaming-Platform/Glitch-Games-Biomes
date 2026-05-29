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
  known?: boolean;
  unlocked?: boolean;
  businessTypeId?: string;
  cooldown: number;
  cost: number;
  resource: string;
  description: string;
}
interface AbilitiesAdapter {
  isHydrated?: () => boolean;
  getEquipped?: () => Array<Ability | null>;
  getLibrary?: () => Ability[];
  learn?: (abilityId: string) => void;
  assign?: (slot: number, abilityId: string) => void;
}

export function activateBiomesAbilityForTest(input: {
  ability: Ability;
  equipped: Array<Ability | null>;
  adapter?: AbilitiesAdapter;
}) {
  if (!input.ability.known && !input.ability.unlocked) return;
  if (!input.ability.known) {
    input.adapter?.learn?.(input.ability.id);
    return;
  }
  const firstOpenSlot = input.equipped.findIndex((ability) => !ability);
  input.adapter?.assign?.(firstOpenSlot < 0 ? 0 : firstOpenSlot, input.ability.id);
}

export const AbilitiesTab: React.FunctionComponent<{ adapter?: AbilitiesAdapter }> = ({ adapter }) => {
  const equipped = adapter?.getEquipped?.() ?? Array(8).fill(null);
  const library = adapter?.getLibrary?.() ?? [];
  const assignOrLearn = React.useCallback((ability: Ability) => {
    activateBiomesAbilityForTest({ ability, equipped, adapter });
  }, [adapter, equipped]);

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
        {library.length === 0 && (
          <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>
            {adapter?.isHydrated?.() ? "No abilities available for this character yet." : "Loading ability records..."}
          </p>
        )}
        <RovingGrid
          ariaLabel="Ability library"
          items={[library]}
          onActivate={(_r, _c, item) => assignOrLearn(item)}
          renderCell={(ab, { focused }, cell) =>
            React.createElement("div", {
              ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
              role: "button", "data-focused": focused ? "true" : undefined,
              "aria-label": `${ab.name} — ${ab.known ? "known" : ab.unlocked ? "learnable" : "locked"} — ${ab.description}`,
              style: { width: 220, padding: 10, marginBottom: 6,
                border: focused ? "1px solid var(--biomes-edge-cyan)" : "1px solid var(--biomes-edge-cyan-soft)",
                background: "var(--biomes-bg-glass)", borderRadius: 4, cursor: ab.unlocked || ab.known ? "pointer" : "not-allowed", outline: "none",
                opacity: ab.unlocked || ab.known ? 1 : 0.48 }
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement("span", { style: { fontSize: 22 } }, ab.icon),
                React.createElement("strong", { style: { fontSize: 13 } }, ab.name),
              ),
              React.createElement("div", { style: { marginTop: 4, fontSize: 11, color: "var(--biomes-fg-muted)" } },
                `${ab.known ? "Known" : ab.unlocked ? "Learnable" : "Locked"} · CD ${ab.cooldown}s · Cost ${ab.cost} ${ab.resource}`),
              React.createElement("p", { style: { margin: "4px 0 0", fontSize: 11, lineHeight: 1.35 } }, ab.description),
            )
          }
        />
      </section>
    </div>
  );
};

const titleStyle: React.CSSProperties = { margin: "0 0 10px", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
