// ClassesTab — choose / view your class & specialization.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

interface ClassCard { id: string; name: string; tagline: string; resource: string; roles: string[] }
interface ClassesAdapter { getClasses?: () => ClassCard[]; getCurrent?: () => string | null; choose?: (id: string) => void }

const PLACEHOLDER: ClassCard[] = [
  { id: "warrior", name: "Warrior", tagline: "Front-line frame, anchor against time-displaced threats.", resource: "Rage", roles: ["tank", "damage"] },
  { id: "rogue", name: "Rogue", tagline: "Slip between timelines; strike before causality catches up.", resource: "Energy", roles: ["damage", "scout"] },
  { id: "ranger", name: "Ranger", tagline: "Read the rift currents; track displaced fauna at range.", resource: "Focus", roles: ["damage", "support"] },
  { id: "mage", name: "Mage", tagline: "Manipulate exotic matter directly; reshape the field.", resource: "Mana", roles: ["damage", "controller"] },
  { id: "priest", name: "Priest", tagline: "Bind allies to the present; mend timeline lacerations.", resource: "Faith", roles: ["healer", "support"] },
  { id: "paladin", name: "Paladin", tagline: "Conviction made tangible — armor that resists rewrites.", resource: "Conviction", roles: ["tank", "healer"] },
  { id: "necromancer", name: "Necromancer", tagline: "Recall the dead briefly from their original timeline.", resource: "Souls", roles: ["damage", "summoner"] },
  { id: "druid", name: "Druid", tagline: "Speak with the misplaced — stabilize their biome.", resource: "Mana", roles: ["healer", "controller"] },
  { id: "bard", name: "Bard", tagline: "Reinforce the present moment with rhythmic resonance.", resource: "Inspiration", roles: ["support", "healer"] },
];

export const ClassesTab: React.FunctionComponent<{ adapter?: ClassesAdapter }> = ({ adapter }) => {
  const classes = adapter?.getClasses?.() ?? PLACEHOLDER;
  const current = adapter?.getCurrent?.() ?? null;
  const rows: ClassCard[][] = [];
  const COLS = 3;
  for (let r = 0; r < Math.ceil(classes.length / COLS); r++) rows.push(classes.slice(r * COLS, (r + 1) * COLS));

  return (
    <RovingGrid
      ariaLabel="Available classes"
      items={rows}
      onActivate={(_r, _c, item) => adapter?.choose?.(item.id)}
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
