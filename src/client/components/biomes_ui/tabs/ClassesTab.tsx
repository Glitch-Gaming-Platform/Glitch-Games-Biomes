// ClassesTab — choose / view your class & specialization.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

interface ClassCard { id: string; name: string; tagline: string; resource: string; roles: string[] }
interface ClassesAdapter { isHydrated?: () => boolean; getClasses?: () => ClassCard[]; getCurrent?: () => string | null; choose?: (id: string) => void }

export function activateBiomesClassCardForTest(adapter: ClassesAdapter | undefined, id: string) {
  adapter?.choose?.(id);
}

export const ClassesTab: React.FunctionComponent<{ adapter?: ClassesAdapter }> = ({ adapter }) => {
  const classes = adapter?.getClasses?.() ?? [];
  const current = adapter?.getCurrent?.() ?? null;
  const rows: ClassCard[][] = [];
  const COLS = 3;
  for (let r = 0; r < Math.ceil(classes.length / COLS); r++) rows.push(classes.slice(r * COLS, (r + 1) * COLS));

  if (classes.length === 0) {
    return <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>{adapter?.isHydrated?.() ? "No classes available." : "Loading class records..."}</p>;
  }

  return (
    <RovingGrid
      ariaLabel="Available classes"
      items={rows}
      onActivate={(_r, _c, item) => activateBiomesClassCardForTest(adapter, item.id)}
      renderCell={(c, { focused }, cell) =>
        React.createElement(Highlightable as any, { uniqueId: UI_IDS.CLASS_CARD(c.id), showCaption: true },
          React.createElement("div", {
            ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
            role: "button",
            "aria-label": `${c.name} class — ${c.tagline}${current === c.id ? " (current)" : ""}`,
            "data-selected": current === c.id ? "true" : undefined,
            "data-focused": focused ? "true" : undefined,
            style: { width: 240, padding: 12, margin: 4, cursor: "pointer",
              background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)",
              borderRadius: 4, outline: "none",
              ...(current === c.id ? { borderColor: "var(--biomes-edge-magenta)" } : {}),
              ...(focused ? { boxShadow: "0 0 12px rgba(74,222,255,0.35)" } : {}) }
          },
            React.createElement("strong", { style: { fontSize: 14 } }, c.name),
            React.createElement("p", { style: { margin: "6px 0 0", fontSize: 11, color: "var(--biomes-fg-muted)", lineHeight: 1.4 } }, c.tagline),
            React.createElement("div", { style: { marginTop: 8, fontSize: 10, letterSpacing: "0.1em", color: "var(--biomes-fg-dim)" } },
              `Resource: ${c.resource} · ${c.roles.join(" / ")}`)
          )
        )
      }
    />
  );
};
