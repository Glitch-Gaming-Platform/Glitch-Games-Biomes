// CollectionsTab — anomaly catalog (Snapped, Blocks, Fish, Food & Drink, Farming, Games, ...).
import * as React from "react";
import { RovingGrid } from "../nav/RovingGrid";

interface Entry { id: string; name: string; icon: string; discovered: boolean }
interface Category { id: string; name: string; entries: Entry[] }
interface CollectionsAdapter { isHydrated?: () => boolean; getCategories?: () => Category[]; discover?: (id: string) => void }

export function activateBiomesCollectionEntryForTest(adapter: CollectionsAdapter | undefined, id: string) {
  adapter?.discover?.(id);
}

export const CollectionsTab: React.FunctionComponent<{ adapter?: CollectionsAdapter }> = ({ adapter }) => {
  const cats = adapter?.getCategories?.() ?? [];
  const [activeCat, setActiveCat] = React.useState(cats[0]?.id);
  React.useEffect(() => {
    if (!activeCat && cats[0]?.id) setActiveCat(cats[0].id);
  }, [activeCat, cats]);
  const cat = cats.find((c) => c.id === activeCat);
  const COLS = 8;
  const rows: Entry[][] = [];
  if (cat) for (let r = 0; r < Math.ceil(cat.entries.length / COLS); r++) rows.push(cat.entries.slice(r * COLS, (r + 1) * COLS));

  if (cats.length === 0) {
    return <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>{adapter?.isHydrated?.() ? "No collection records available." : "Loading collection records..."}</p>;
  }

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
          onActivate={(_r, _c, item) => activateBiomesCollectionEntryForTest(adapter, item.id)}
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
