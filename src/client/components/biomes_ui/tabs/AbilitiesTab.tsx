// AbilitiesTab — active ability loadout (8 slots) and an ability library.
// Wires through `adapter`:
//   - getEquipped(): Array<Ability | null>
//   - getLibrary(): Ability[]
//   - assign(slot, abilityId)
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { biomesPlayerSentence, biomesPlayerTitle } from "../playerFacingText";
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

function playerFacingAbilityStatus(ability: Ability) {
  return ability.known
    ? "Learned"
    : ability.unlocked
    ? "Ready to learn"
    : "Locked";
}

function playerFacingAbilityWait(cooldown: number) {
  const seconds = Math.max(0, Math.round(cooldown));
  if (seconds === 0) return "No wait time";
  if (seconds < 60) {
    return `Ready again in ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `Ready again in ${minutes} ${
    minutes === 1 ? "minute" : "minutes"
  }${
    remainingSeconds > 0
      ? ` ${remainingSeconds} ${
          remainingSeconds === 1 ? "second" : "seconds"
        }`
      : ""
  }`;
}

function playerFacingAbilityDetails(ability: Ability) {
  const wait = playerFacingAbilityWait(ability.cooldown);
  const cost =
    ability.cost > 0
      ? `Uses ${ability.cost} ${biomesPlayerTitle(ability.resource)}`
      : "No resource cost";
  return `${playerFacingAbilityStatus(ability)} · ${wait} · ${cost}`;
}

export function chunkBiomesAbilityRowsForTest<T>(items: T[], columns = 3): T[][] {
  const safeColumns = Math.max(1, Math.floor(columns));
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += safeColumns) {
    rows.push(items.slice(index, index + safeColumns));
  }
  return rows;
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
  const libraryRows = React.useMemo(
    () => chunkBiomesAbilityRowsForTest(library, 3),
    [library]
  );
  const assignOrLearn = React.useCallback((ability: Ability) => {
    activateBiomesAbilityForTest({ ability, equipped, adapter });
  }, [adapter, equipped]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section aria-label="Equipped abilities" style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={titleStyle}>Equipped Abilities</h3>
          <span style={metaStyle}>8 ability spaces</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 56px)", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {equipped.map((ab, i) => (
            <Highlightable key={i} uniqueId={UI_IDS.ABILITY_SLOT(i + 1)} showCaption>
              <button type="button" className="biomes-ui-slot" aria-label={ab ? `Equipped ability ${i + 1}: ${ab.name}` : `Ability space ${i + 1}: empty`}>
                {ab ? (
                  <span aria-hidden style={{ fontSize: 22, fontWeight: 800 }}>{ab.icon}</span>
                ) : (
                  <span style={{ opacity: 0.45, fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
                )}
              </button>
            </Highlightable>
          ))}
        </div>
      </section>
      <section aria-label="Available abilities" style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={titleStyle}>Available Abilities</h3>
          <span style={metaStyle}>{library.length} available</span>
        </div>
        {library.length === 0 && (
          <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>
            {adapter?.isHydrated?.() ? "No abilities are available for this character yet." : "Finding your abilities..."}
          </p>
        )}
        <RovingGrid
          ariaLabel="Available abilities"
          items={libraryRows}
          onActivate={(_r, _c, item) => assignOrLearn(item)}
          style={{ display: "grid", gap: 8 }}
          renderCell={(ab, { focused }, cell) =>
            React.createElement("div", {
              ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
              role: "button", "data-focused": focused ? "true" : undefined,
              "aria-label": `${ab.name} — ${playerFacingAbilityStatus(ab)} — ${biomesPlayerSentence(ab.description)}`,
              style: {
                width: "clamp(218px, 28vw, 320px)",
                minHeight: 148,
                padding: 12,
                marginBottom: 6,
                border: focused ? "1px solid var(--biomes-edge-cyan)" : "1px solid var(--biomes-edge-cyan-soft)",
                background: ab.known
                  ? "linear-gradient(180deg, rgba(16, 31, 57, 0.92), rgba(9, 17, 37, 0.92))"
                  : "var(--biomes-bg-glass)",
                borderRadius: 4,
                cursor: ab.unlocked || ab.known ? "pointer" : "not-allowed",
                outline: "none",
                opacity: ab.unlocked || ab.known ? 1 : 0.58,
                boxShadow: focused ? "0 0 18px rgba(74, 222, 255, 0.22)" : "inset 0 0 18px rgba(74, 222, 255, 0.04)",
                overflow: "hidden",
              }
            },
              React.createElement("div", { style: { display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", alignItems: "start", gap: 9 } },
                React.createElement("span", { style: abilityIconStyle }, ab.icon),
                React.createElement("strong", { style: { fontSize: 13, lineHeight: 1.16, overflowWrap: "anywhere" } }, ab.name),
              ),
              React.createElement("div", { style: { marginTop: 9, fontSize: 11, color: "var(--biomes-fg-muted)", lineHeight: 1.25 } },
                playerFacingAbilityDetails(ab)),
              React.createElement("p", { style: { margin: "7px 0 0", fontSize: 11, lineHeight: 1.35, color: "rgba(232, 244, 255, 0.84)" } }, biomesPlayerSentence(ab.description)),
            )
          }
        />
      </section>
    </div>
  );
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(74, 222, 255, 0.18)",
  background: "rgba(4, 10, 24, 0.36)",
  borderRadius: 6,
  padding: 12,
};
const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const metaStyle: React.CSSProperties = { fontSize: 11, color: "var(--biomes-fg-dim)", whiteSpace: "nowrap" };
const abilityIconStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(74, 222, 255, 0.28)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.72)",
  color: "var(--biomes-fg)",
  fontSize: 18,
  fontWeight: 900,
};
