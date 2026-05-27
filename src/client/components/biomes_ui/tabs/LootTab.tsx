// LootTab — recent loot rolls + active loot tables you can preview.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface LootEntry { id: string; itemName: string; quantity: number; source: string; quality: string; at: string }
interface LootAdapter { getRecent?: () => LootEntry[] }

const PLACEHOLDER: LootEntry[] = [
  { id: "l_001", itemName: "Razorslash Moldy Ancient Gloves", quantity: 1, source: "Anomaly · Iron Reliquary", quality: "rare", at: "00:14 ago" },
  { id: "l_002", itemName: "Spoon", quantity: 1, source: "Old Grove Road Post", quality: "common", at: "00:16 ago" },
  { id: "l_003", itemName: "Muckwad Sludge", quantity: 3, source: "Muckwad Patch", quality: "common", at: "00:25 ago" },
  { id: "l_004", itemName: "Exotic Matter Splinter", quantity: 1, source: "Rift Echo · Viking Skirmisher", quality: "epic", at: "01:02 ago" },
];

const QC: Record<string, string> = {
  common: "#b4c8dc", uncommon: "#78e68c", rare: "#5fa5ff", epic: "#c864ff", legendary: "#ffb844", quest: "#ff54c4",
};

export const LootTab: React.FunctionComponent<{ adapter?: LootAdapter }> = ({ adapter }) => {
  const recent = adapter?.getRecent?.() ?? PLACEHOLDER;
  return (
    <div role="list" aria-label="Recent loot">
      {recent.map((l) => (
        <Highlightable key={l.id} uniqueId={UI_IDS.LOOT_ENTRY(l.id)} showCaption>
          <div role="listitem" tabIndex={0} aria-label={`${l.itemName} x${l.quantity} from ${l.source}, ${l.quality}, ${l.at}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", marginBottom: 4,
              background: "var(--biomes-bg-glass)",
              borderLeft: `3px solid ${QC[l.quality] ?? QC.common}`,
              border: "1px solid var(--biomes-edge-cyan-soft)" }}>
            <div>
              <strong style={{ fontSize: 13, color: QC[l.quality] ?? "#e8f4ff" }}>{l.itemName}</strong>
              {l.quantity > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--biomes-fg-muted)" }}>×{l.quantity}</span>}
              <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{l.source}</div>
            </div>
            <div style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>{l.at}</div>
          </div>
        </Highlightable>
      ))}
    </div>
  );
};
