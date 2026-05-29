import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

interface LootEntry {
  id: string;
  itemName: string;
  quantity: number;
  source: string;
  quality: string;
  at: string;
  status?: "available" | "claimed" | "wallet" | "material_storage" | "overflow" | "guild_vault";
  route?: string;
  dropId?: string;
  expiresAt?: string;
}
interface LootAdapter {
  getRecent?: () => LootEntry[];
  getAvailable?: () => LootEntry[];
  isHydrated?: () => boolean;
  refresh?: () => void;
  claim?: (dropId: string) => void;
}

const QC: Record<string, string> = {
  common: "#b4c8dc", uncommon: "#78e68c", rare: "#5fa5ff", epic: "#c864ff", legendary: "#ffb844", quest: "#ff54c4",
};

export const LootTab: React.FunctionComponent<{ adapter?: LootAdapter }> = ({ adapter }) => {
  const recent = adapter?.getRecent?.() ?? [];
  const available = adapter?.getAvailable?.() ?? [];
  const hydrated = adapter?.isHydrated?.() ?? false;
  React.useEffect(() => {
    adapter?.refresh?.();
  }, [adapter]);

  if (!recent.length && !available.length) {
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
          ? "No new loot yet. Defeat enemies, finish jobs, or pick up rewards to fill this list."
          : "Checking for your latest rewards..."}
      </div>
    );
  }

  return (
    <div>
      {available.length > 0 ? (
        <section aria-label="Available loot" style={{ marginBottom: 14 }}>
          <h3 style={sectionTitleStyle}>Available Loot</h3>
          <div role="list" aria-label="Available loot drops">
            {available.map((l) => renderLootEntry(l, adapter, true))}
          </div>
        </section>
      ) : null}
      {recent.length > 0 ? (
        <section aria-label="Recent loot">
          <h3 style={sectionTitleStyle}>Recent Loot</h3>
          <div role="list" aria-label="Recent loot">
            {recent.map((l) => renderLootEntry(l, adapter, false))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

function renderLootEntry(l: LootEntry, adapter: LootAdapter | undefined, available: boolean) {
  const route = l.route ?? routeLabelForLootEntry(l);
  return (
    <Highlightable key={l.id} uniqueId={UI_IDS.LOOT_ENTRY(lootEntryDomId(l.id, available))} showCaption>
      <div
        role="listitem"
        tabIndex={0}
        aria-label={`${l.itemName} x${l.quantity} from ${biomesPlayerTitle(l.source)}, ${biomesPlayerTitle(l.quality)}, ${route}, ${l.at}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          marginBottom: 4,
          background: "var(--biomes-bg-glass)",
          borderLeft: `3px solid ${QC[l.quality] ?? QC.common}`,
          border: "1px solid var(--biomes-edge-cyan-soft)",
        }}
      >
        <div>
          <strong style={{ fontSize: 13, color: QC[l.quality] ?? "#e8f4ff" }}>{l.itemName}</strong>
          {l.quantity > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--biomes-fg-muted)" }}>×{l.quantity}</span>}
          <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{biomesPlayerTitle(l.source)}</div>
          <div style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>
            {route}
            {l.expiresAt ? ` · ${l.expiresAt}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={routePillStyle}>{route}</span>
          {available && l.dropId ? (
            <button
              type="button"
              className="biomes-ui-action-button"
              data-loot-action="claim"
              disabled={!adapter?.claim}
              onClick={() => adapter?.claim?.(l.dropId!)}
            >
              Claim
            </button>
          ) : (
            <div style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>{l.at}</div>
          )}
        </div>
      </div>
    </Highlightable>
  );
}

function routeLabelForLootEntry(l: LootEntry): string {
  if (l.status === "wallet") return "Wallet";
  if (l.status === "material_storage") return "Material Storage";
  if (l.status === "overflow") return "Overflow";
  if (l.status === "guild_vault") return "Guild Vault";
  if (l.status === "available") return "Unclaimed";
  return "Backpack";
}

function lootEntryDomId(id: string, available: boolean): string {
  let hash = 0;
  for (const char of String(id)) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return `${available ? "available" : "recent"}_${Math.abs(hash)}`;
}

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};

const routePillStyle: React.CSSProperties = {
  display: "inline-flex",
  minWidth: 74,
  justifyContent: "center",
  padding: "3px 6px",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  color: "var(--biomes-fg-muted)",
  fontSize: 10,
  textTransform: "uppercase",
};
