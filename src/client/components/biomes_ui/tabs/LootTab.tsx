// LootTab — recent loot rolls and claimable world drops from backend authority.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface LootEntry { id: string; itemName: string; quantity: number; source: string; quality: string; at: string }
interface LootAdapter { getRecent?: () => LootEntry[]; isHydrated?: () => boolean; refresh?: () => void }

const QC: Record<string, string> = {
  common: "#b4c8dc", uncommon: "#78e68c", rare: "#5fa5ff", epic: "#c864ff", legendary: "#ffb844", quest: "#ff54c4",
};

export const LootTab: React.FunctionComponent<{ adapter?: LootAdapter }> = ({ adapter }) => {
  const recent = adapter?.getRecent?.() ?? [];
  const hydrated = adapter?.isHydrated?.() ?? false;
  React.useEffect(() => {
    adapter?.refresh?.();
  }, [adapter]);

  if (!recent.length) {
    return (
      <div
        role="status"
        aria-label="No recent loot"
        style={{
          padding: "18px",
          border: "1px solid var(--biomes-edge-cyan-soft)",
          background: "var(--biomes-bg-glass)",
          color: "var(--biomes-fg-muted)",
        }}
      >
        {hydrated
          ? "No backend loot events or claimable drops yet. Defeat enemies, finish jobs, or claim real world drops to populate this list."
          : "Loading backend loot ledger..."}
      </div>
    );
  }

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
