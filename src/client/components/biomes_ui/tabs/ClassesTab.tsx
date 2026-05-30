// ClassesTab — choose / view your class & specialization.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

interface ClassCard { id: string; name: string; tagline: string; resource: string; roles: string[]; specializations?: string[] }
interface ClassesAdapter {
  isHydrated?: () => boolean;
  getClasses?: () => ClassCard[];
  getCurrent?: () => string | null;
  getSpecialization?: () => string | null;
  hasClassChoice?: () => boolean;
  classChoiceLocked?: () => boolean;
  choose?: (id: string) => void;
  chooseSpecialization?: (id: string) => void;
}

export function activateBiomesClassCardForTest(adapter: ClassesAdapter | undefined, id: string): string | null {
  if (adapter?.classChoiceLocked?.() && adapter.getCurrent?.() !== id) {
    return null;
  }
  adapter?.choose?.(id);
  return id;
}

export function activateBiomesSpecializationForTest(adapter: ClassesAdapter | undefined, id: string): string {
  adapter?.chooseSpecialization?.(id);
  return id;
}

export const ClassesTab: React.FunctionComponent<{ adapter?: ClassesAdapter }> = ({ adapter }) => {
  const classes = adapter?.getClasses?.() ?? [];
  const current = adapter?.getCurrent?.() ?? null;
  const currentClass = classes.find((entry) => entry.id === current);
  const currentSpecialization = adapter?.getSpecialization?.() ?? null;
  const classChoiceMade = adapter?.hasClassChoice?.() ?? Boolean(current);
  const classChoiceLocked = adapter?.classChoiceLocked?.() ?? false;
  const [pendingChoice, setPendingChoice] = React.useState<string | null>(null);
  React.useEffect(() => {
    setPendingChoice(null);
  }, [current]);
  const rows: ClassCard[][] = [];
  const COLS = 3;
  for (let r = 0; r < Math.ceil(classes.length / COLS); r++) rows.push(classes.slice(r * COLS, (r + 1) * COLS));

  if (classes.length === 0) {
    return <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>{adapter?.isHydrated?.() ? "No classes are available yet." : "Finding your classes..."}</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 20rem)", gap: 16, alignItems: "start" }}>
      <RovingGrid
        ariaLabel="Available classes"
        items={rows}
        onActivate={(_r, _c, item) => {
          setPendingChoice(activateBiomesClassCardForTest(adapter, item.id));
        }}
        renderCell={(c, { focused }, cell) => {
          const lockedClassChange = classChoiceLocked && current !== c.id;
          return (
          React.createElement(Highlightable as any, { uniqueId: UI_IDS.CLASS_CARD(c.id), showCaption: true },
            React.createElement("div", {
              ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
              role: "button",
              "aria-label": `${c.name} class — ${c.tagline}${current === c.id ? " (current)" : lockedClassChange ? " (requires respec)" : ""}`,
              "data-selected": current === c.id ? "true" : undefined,
              "data-focused": focused ? "true" : undefined,
              "aria-disabled": lockedClassChange ? "true" : undefined,
              style: { width: 240, minHeight: 116, padding: 12, margin: 4, cursor: lockedClassChange ? "not-allowed" : "pointer",
                background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)",
                borderRadius: 4, outline: "none",
                opacity: lockedClassChange ? 0.58 : 1,
                ...(current === c.id ? { borderColor: "var(--biomes-edge-magenta)", boxShadow: "0 0 14px rgba(255,84,196,0.2)" } : {}),
                ...(focused ? { boxShadow: "0 0 12px rgba(74,222,255,0.35)" } : {}) }
            },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } },
                React.createElement("strong", { style: { fontSize: 14 } }, c.name),
                current === c.id
                  ? React.createElement("span", { style: statusPillStyle }, "Selected")
                  : lockedClassChange
                  ? React.createElement("span", { style: statusPillStyle }, "Respec")
                  : pendingChoice === c.id
                  ? React.createElement("span", { style: statusPillStyle }, "Saving")
                  : null
              ),
              React.createElement("p", { style: { margin: "6px 0 0", fontSize: 11, color: "var(--biomes-fg-muted)", lineHeight: 1.4 } }, c.tagline),
              React.createElement("div", { style: { marginTop: 8, fontSize: 10, letterSpacing: "0.1em", color: "var(--biomes-fg-dim)" } },
                `Resource: ${biomesPlayerTitle(c.resource)} · ${c.roles.map((role) => biomesPlayerTitle(role)).join(" / ")}`)
            )
          )
          );
        }}
      />
      <aside style={detailsStyle} aria-live="polite">
        <h3 style={titleStyle}>Current Class</h3>
        <strong>{currentClass?.name ?? "None selected"}</strong>
        <p style={mutedStyle}>
          {pendingChoice && pendingChoice !== current
            ? `${classes.find((entry) => entry.id === pendingChoice)?.name ?? "Class"} is being saved.`
            : current && classChoiceMade
            ? "Your selected class controls starting abilities, resource type, and skill unlocks."
            : current
            ? "This is your starter preview. Choose a class card to save your path."
            : "Choose a class card to save it."}
        </p>
        {currentClass?.specializations?.length ? (
          <div style={{ marginTop: 14 }}>
            <h3 style={titleStyle}>Specialization</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {currentClass.specializations.map((spec) => {
                const selected = currentSpecialization === spec;
                return (
                  <button
                    key={spec}
                    type="button"
                    disabled={!classChoiceMade}
                    onClick={() => activateBiomesSpecializationForTest(adapter, spec)}
                    style={{
                      ...specializationButtonStyle,
                      ...(selected ? selectedSpecializationStyle : {}),
                      opacity: classChoiceMade ? 1 : 0.5,
                      cursor: classChoiceMade ? "pointer" : "not-allowed",
                    }}
                  >
                    {biomesPlayerTitle(spec)}
                  </button>
                );
              })}
            </div>
            <p style={mutedStyle}>
              {currentSpecialization
                ? `${biomesPlayerTitle(currentSpecialization)} is active.`
                : classChoiceMade
                ? "Choose a specialization for this class."
                : "Save a class before choosing a specialization."}
            </p>
          </div>
        ) : null}
        {classChoiceLocked ? (
          <p style={mutedStyle}>Changing class after selection requires a respec service.</p>
        ) : null}
      </aside>
    </div>
  );
};

const titleStyle: React.CSSProperties = { margin: "0 0 10px", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: 12, lineHeight: 1.4, color: "var(--biomes-fg-muted)" };
const statusPillStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-magenta)",
  borderRadius: 4,
  padding: "2px 5px",
  fontSize: 9,
  color: "var(--biomes-fg)",
};
const specializationButtonStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  padding: "5px 7px",
  fontSize: 11,
  color: "var(--biomes-fg)",
  background: "rgba(255, 255, 255, 0.08)",
};
const selectedSpecializationStyle: React.CSSProperties = {
  borderColor: "var(--biomes-edge-magenta)",
  background: "rgba(255, 84, 196, 0.18)",
};
const detailsStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 6,
  padding: 12,
  background: "rgba(4, 10, 24, 0.42)",
};
