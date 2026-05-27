// BankingTab — exotic-matter vault. Deposit / withdraw + currency overview.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

interface VaultItem { id: string; name: string; icon: string; quantity: number }
interface Currency { id: string; name: string; amount: number; icon: string }
interface BankingAdapter {
  getVault?: () => { items: Array<VaultItem | null>; maxSlots: number };
  getCurrencies?: () => Currency[];
  deposit?: (instanceId: string) => void;
  withdraw?: (instanceId: string) => void;
}

const PLACEHOLDER_VAULT = { maxSlots: 24, items: [] as Array<VaultItem | null> };
const PLACEHOLDER_CURR: Currency[] = [
  { id: "gold", name: "Gold", amount: 1240, icon: "◉" },
  { id: "exotic", name: "Exotic Matter Shards", amount: 18, icon: "✦" },
  { id: "singularity", name: "Singularity Credits", amount: 4, icon: "◌" },
];

export const BankingTab: React.FunctionComponent<{ adapter?: BankingAdapter }> = ({ adapter }) => {
  const vault = adapter?.getVault?.() ?? PLACEHOLDER_VAULT;
  const currencies = adapter?.getCurrencies?.() ?? PLACEHOLDER_CURR;
  const filled: Array<VaultItem | null> = Array.from({ length: vault.maxSlots }, (_, i) => vault.items[i] ?? null);
  const COLS = 8;
  const rows: Array<Array<VaultItem | null>> = [];
  for (let r = 0; r < Math.ceil(filled.length / COLS); r++) rows.push(filled.slice(r * COLS, (r + 1) * COLS));

  return (
    <div>
      <section aria-label="Currency balances" style={{ marginBottom: 14 }}>
        <h3 style={titleStyle}>Balances</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {currencies.map((c) => (
            <div key={c.id} style={{ padding: "8px 14px", background: "var(--biomes-bg-glass)",
              border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 }}>
              <span style={{ fontSize: 16, marginRight: 6 }}>{c.icon}</span>
              <strong>{c.amount.toLocaleString()}</strong>
              <span style={{ marginLeft: 6, color: "var(--biomes-fg-muted)" }}>{c.name}</span>
            </div>
          ))}
        </div>
      </section>
      <section aria-label="Vault actions" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Highlightable uniqueId={UI_IDS.BANKING_DEPOSIT} showCaption>
          <button type="button" className="biomes-ui-tab" aria-label="Deposit selected item">Deposit</button>
        </Highlightable>
        <Highlightable uniqueId={UI_IDS.BANKING_WITHDRAW} showCaption>
          <button type="button" className="biomes-ui-tab" aria-label="Withdraw selected item">Withdraw</button>
        </Highlightable>
      </section>
      <section aria-label="Vault slots">
        <h3 style={titleStyle}>Vault — {filled.filter(Boolean).length} / {vault.maxSlots}</h3>
        <RovingGrid
          ariaLabel="Vault slots"
          items={rows}
          renderCell={(item, { row, col, focused }, cell) => {
            const slotNumber = row * COLS + col + 1;
            return React.createElement(Highlightable as any, { uniqueId: UI_IDS.BANKING_VAULT_SLOT(slotNumber) },
              React.createElement("div", {
                ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: cell.onClick, onKeyDown: cell.onKeyDown,
                className: "biomes-ui-slot", "data-focused": focused ? "true" : undefined,
                "aria-label": item ? `${item.name} x${item.quantity}` : `Empty vault slot ${slotNumber}`,
                style: { width: 48, height: 48 },
              },
                item ? React.createElement("span", { style: { fontSize: 20 } }, item.icon) : null
              )
            );
          }}
        />
      </section>
    </div>
  );
};
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
