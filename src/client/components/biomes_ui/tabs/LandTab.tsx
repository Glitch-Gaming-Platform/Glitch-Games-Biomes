// LandTab — Biome (pocket-dimension) ownership.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface Plot { id: string; name: string; biomeType: string; size: string; status: "owned" | "leased" | "available"; instability: number }
interface LandAdapter { getPlots?: () => Plot[] }

const PLACEHOLDER: Plot[] = [
  { id: "plot_grove_alpha", name: "Grove Alpha — Home", biomeType: "Temperate Grove", size: "32×32", status: "owned", instability: 0.04 },
  { id: "plot_grove_beta", name: "Grove Beta — Workshop", biomeType: "Temperate Grove", size: "16×16", status: "owned", instability: 0.02 },
  { id: "plot_dune", name: "Dune Outpost", biomeType: "Desert", size: "24×24", status: "leased", instability: 0.18 },
  { id: "plot_glacier", name: "Glacier Vault", biomeType: "Winterland", size: "48×48", status: "available", instability: 0.31 },
];

export const LandTab: React.FunctionComponent<{ adapter?: LandAdapter }> = ({ adapter }) => {
  const plots = adapter?.getPlots?.() ?? PLACEHOLDER;
  return (
    <div role="list" aria-label="Biome plots">
      {plots.map((p) => (
        <Highlightable key={p.id} uniqueId={UI_IDS.LAND_PLOT(p.id)} showCaption>
          <div role="listitem" tabIndex={0} aria-label={`${p.name} — ${p.biomeType}, ${p.size}, status ${p.status}, ${(p.instability*100).toFixed(0)}% instability`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", marginBottom: 6,
              background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 }}>
            <div>
              <strong style={{ fontSize: 13 }}>{p.name}</strong>
              <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{p.biomeType} · {p.size}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: p.status === "owned" ? "#9ce8ff" : p.status === "leased" ? "#ffb844" : "#a0b8c8" }}>
                {p.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: p.instability > 0.25 ? "var(--biomes-warn-amber)" : "var(--biomes-fg-dim)" }}>
                Instability {(p.instability * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </Highlightable>
      ))}
    </div>
  );
};
