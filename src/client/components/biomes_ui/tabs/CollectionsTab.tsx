// CollectionsTab — anomaly catalog (Snapped, Blocks, Fish, Food & Drink, Farming, Games, ...).
import * as React from "react";
import { RovingGrid } from "../nav/RovingGrid";

interface Entry { id: string; name: string; icon: string; discovered: boolean }
interface Category { id: string; name: string; entries: Entry[] }
interface CollectionsAdapter { getCategories?: () => Category[] }

const PLACEHOLDER: Category[] = [
  { id: "snapped", name: "Snapped", entries: Array.from({ length: 16 }, (_, i) => ({ id: `s_${i}`, name: `Snapped ${i + 1}`, icon: "◫", discovered: i < 4 })) },
  { id: "blocks", name: "Blocks", entries: Array.from({ length: 12 }, (_, i) => ({ id: `b_${i}`, name: `Block ${i + 1}`, icon: "■", discovered: i < 7 })) },
  { id: "rift_echoes", name: "Rift Echoes", entries: Array.from({ length: 8 }, (_, i) => ({ id: `r_${i}`, name: `Echo ${i + 1}`, icon: "✦", discovered: i < 2 })) },
];

export const CollectionsTab: React.FunctionComponent<{ adapter?: CollectionsAdapter }> = ({ adapter }) => {
  const cats = adapter?.getCategories?.() ?? PLACEHOLDER;
  const [activeCat, setActiveCat] = React.useState(cats[0]?.id);
  const cat = cats.find((c) => c.id === activeCat);
  const COLS = 8;
  const rows: Entry[][] = [];
  if (cat) for (let r = 0; r < Math.ceil(cat.entries.length / COLS); r++) rows.push(cat.entries.slice(r * COLS, (r + 1) * COLS));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 18 }}>
      <nav aria-label="Collection categories">
        {cats.map((c) => (
          <button key={c.id} type="button" className="biomes-ui-tab"
            aria-selected={c.id === activeCat}
            onClick={() => setActiveCat(c.id)}
            style={{ display: "block", width: "100%", textAlign: "left", paddingLeft: 8 }}>
            {c.name}
            <span style={{ float: "right", color: "var(--biomes-fg-dim)", fontSize: 10 }}>
              {c.entries.filter((e) => e.discovered).length}/{c.entries.length}
            </span>
          </button>
        ))}
      </nav>
      <section>
        {cat && <RovingGrid
          ariaLabel={`${cat.name} entries`}
          items={rows}
          renderCell={(e, { focused }, cell) =>
            React.createElement("div", {
              ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
              className: "biomes-ui-slot",
              "aria-label": e.discovered ? e.name : "Undiscovered entry",
              "data-focused": focused ? "true" : undefined,
              style: { width: 56, height: 56, opacity: e.discovered ? 1 : 0.32 },
            },
              React.createElement("span", { style: { fontSize: 22 } }, e.discovered ? e.icon : "?")
            )
          } />}
      </section>
    </div>
  );
};
