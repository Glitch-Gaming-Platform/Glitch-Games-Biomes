import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

interface VaultItem { id: string; name: string; icon: string; quantity: number }
interface Currency { id: string; name: string; amount: number; icon: string }
interface LoanSummary {
  loanId: string;
  principalOriginal: number;
  principalRemaining: number;
  dailyInterestRate: number;
  openedAtMs: number;
  dueAtMs: number;
  status: "active" | "paid" | "defaulted";
  balance?: { interestRemaining: number; totalRemaining: number; overdue: boolean; lateDays?: number; defaultPenaltyRemaining?: number; creditHold?: boolean };
}
interface BankLogEntry {
  id: string;
  kind: string;
  vault: string;
  itemId?: string;
  count?: number;
  goldDelta?: number;
  atMs: number;
}
interface DepositCandidate { id: string; name: string; icon: string; quantity: number; category?: string }
interface BankingAdapter {
  isHydrated?: () => boolean;
  getVault?: (kind?: "personal" | "account" | "materials") => { items: Array<VaultItem | null>; maxSlots: number; usedSlots?: number };
  getCurrencies?: () => Currency[];
  getDepositCandidates?: () => DepositCandidate[];
  getLoans?: () => LoanSummary[];
  getLogs?: () => BankLogEntry[];
  getNextUpgradeCost?: (kind: "personal" | "account" | "materials") => number | undefined;
  deposit?: (itemId: string, count: number) => Promise<void> | void;
  withdraw?: (itemId: string, count: number) => Promise<void> | void;
  depositAccount?: (itemId: string, count: number) => Promise<void> | void;
  withdrawAccount?: (itemId: string, count: number) => Promise<void> | void;
  depositMaterial?: (itemId: string, count: number) => Promise<void> | void;
  withdrawMaterial?: (itemId: string, count: number) => Promise<void> | void;
  upgradeSlots?: (kind: "personal" | "account" | "materials") => Promise<void> | void;
  takeLoan?: (amount: number, days: number) => Promise<void> | void;
  repayLoan?: (loanId: string | undefined, amount: number) => Promise<void> | void;
}

type VaultKind = "personal" | "account" | "materials";
type Selection =
  | { source: "inventory"; item: DepositCandidate }
  | { source: VaultKind; item: VaultItem };

function isBankingImageIcon(icon: string | undefined) {
  if (!icon) return false;
  return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(icon);
}

function renderBankingIcon(icon: string | undefined, size = 20) {
  if (isBankingImageIcon(icon)) {
    const src = icon?.startsWith("buckets/") || icon?.startsWith("assets/")
      ? `/${icon}`
      : icon;
    return React.createElement("img", {
      src,
      alt: "",
      "aria-hidden": true,
      "data-banking-icon-kind": "image",
      style: { width: size, height: size, objectFit: "contain", display: "inline-block" },
    });
  }
  return React.createElement("span", {
    "aria-hidden": true,
    "data-banking-icon-kind": "glyph",
    style: { fontSize: size },
  }, icon || "◼");
}

export const BankingTab: React.FunctionComponent<{ adapter?: BankingAdapter }> = ({ adapter }) => {
  const hydrated = adapter?.isHydrated?.() ?? false;
  const [vaultKind, setVaultKind] = React.useState<VaultKind>("personal");
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [loanAmount, setLoanAmount] = React.useState("50");
  const [loanDays, setLoanDays] = React.useState("7");
  const [repayAmount, setRepayAmount] = React.useState("25");

  const vault = adapter?.getVault?.(vaultKind) ?? { maxSlots: 0, items: [] };
  const currencies = adapter?.getCurrencies?.() ?? [];
  const depositCandidates = adapter?.getDepositCandidates?.() ?? [];
  const loans = adapter?.getLoans?.() ?? [];
  const logs = adapter?.getLogs?.() ?? [];
  const filled: Array<VaultItem | null> = Array.from({ length: vault.maxSlots }, (_, i) => vault.items[i] ?? null);
  const COLS = 8;
  const rows: Array<Array<VaultItem | null>> = [];
  for (let r = 0; r < Math.ceil(filled.length / COLS); r++) rows.push(filled.slice(r * COLS, (r + 1) * COLS));
  const selectedVaultItem = selection?.source === vaultKind ? selection.item : null;
  const selectedInventoryItem = selection?.source === "inventory" ? selection.item : null;
  const activeLoan = loans.find((loan) => loan.status === "active");
  const upgradeCost = adapter?.getNextUpgradeCost?.(vaultKind);

  const runDeposit = () => {
    if (!selectedInventoryItem) return;
    if (vaultKind === "account") void adapter?.depositAccount?.(selectedInventoryItem.id, 1);
    else if (vaultKind === "materials") void adapter?.depositMaterial?.(selectedInventoryItem.id, 1);
    else void adapter?.deposit?.(selectedInventoryItem.id, 1);
  };
  const runWithdraw = () => {
    if (!selectedVaultItem) return;
    if (vaultKind === "account") void adapter?.withdrawAccount?.(selectedVaultItem.id, 1);
    else if (vaultKind === "materials") void adapter?.withdrawMaterial?.(selectedVaultItem.id, 1);
    else void adapter?.withdraw?.(selectedVaultItem.id, 1);
  };

  if (!hydrated) {
    return (
      <div>
        <h3 style={titleStyle}>Bank Unavailable</h3>
        <p style={mutedTextStyle}>Checking your vault. Your balances will appear here when the bank is ready.</p>
      </div>
    );
  }

  return (
    <div data-production-banking="true">
      <section aria-label="Currency balances" style={{ marginBottom: 14 }}>
        <h3 style={titleStyle}>Balances</h3>
        {currencies.length === 0 ? (
          <p style={mutedTextStyle}>No real currency balances are currently available.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {currencies.map((c) => (
              <div key={c.id} style={pillStyle}>
                <span style={{ marginRight: 6 }}>{renderBankingIcon(c.icon, 16)}</span>
                <strong>{c.amount.toLocaleString()}</strong>
                <span style={{ marginLeft: 6, color: "var(--biomes-fg-muted)" }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Vault selector" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(["personal", "account", "materials"] as const).map((kind) => (
          <button key={kind} type="button" className="biomes-ui-tab" aria-selected={vaultKind === kind} onClick={() => { setVaultKind(kind); setSelection(null); }}>
            {kind === "personal" ? "Personal Vault" : kind === "account" ? "Account Vault" : "Materials"}
          </button>
        ))}
      </section>

      <section aria-label="Vault actions" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Highlightable uniqueId={UI_IDS.BANKING_DEPOSIT} showCaption>
          <button type="button" className="biomes-ui-tab" aria-label="Deposit selected item" onClick={runDeposit} disabled={!selectedInventoryItem}>Deposit 1</button>
        </Highlightable>
        <Highlightable uniqueId={UI_IDS.BANKING_WITHDRAW} showCaption>
          <button type="button" className="biomes-ui-tab" aria-label="Withdraw selected item" onClick={runWithdraw} disabled={!selectedVaultItem}>Withdraw 1</button>
        </Highlightable>
        <button type="button" className="biomes-ui-tab" onClick={() => void adapter?.upgradeSlots?.(vaultKind)}>
          Upgrade Slots{upgradeCost !== undefined ? ` (${upgradeCost} gold)` : ""}
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(320px, 1fr) 260px", gap: 16, alignItems: "start" }}>
        <section aria-label="Backpack deposit candidates">
          <h3 style={titleStyle}>Backpack</h3>
          {depositCandidates.length === 0 ? (
            <p style={mutedTextStyle}>No depositable inventory items found.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {depositCandidates.slice(0, 12).map((item) => (
                <button key={item.id} type="button" className="biomes-ui-tab" style={rowButtonStyle} aria-pressed={selection?.source === "inventory" && selection.item.id === item.id} onClick={() => setSelection({ source: "inventory", item })}>
                  <span>{renderBankingIcon(item.icon, 18)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <strong>{item.quantity}</strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Vault slots">
          <h3 style={titleStyle}>Vault — {vault.usedSlots ?? filled.filter(Boolean).length} / {vault.maxSlots}</h3>
          {vault.maxSlots <= 0 ? (
            <p style={mutedTextStyle}>This vault has no open storage slots yet.</p>
          ) : (
            <RovingGrid
              ariaLabel="Vault slots"
              items={rows}
              renderCell={(item, { row, col, focused }, cell) => {
                const slotNumber = row * COLS + col + 1;
                return React.createElement(Highlightable as any, { uniqueId: UI_IDS.BANKING_VAULT_SLOT(slotNumber) },
                  React.createElement("button", {
                    ref: cell.ref, tabIndex: cell.tabIndex, onFocus: cell.onFocus, onClick: (event: React.MouseEvent) => { cell.onClick?.(); if (item) setSelection({ source: vaultKind, item }); }, onKeyDown: cell.onKeyDown,
                    className: "biomes-ui-slot", "data-focused": focused ? "true" : undefined,
                    "data-selected": item && selection?.source === vaultKind && selection.item.id === item.id ? "true" : undefined,
                    "aria-label": item ? `${item.name} x${item.quantity}` : `Empty vault slot ${slotNumber}`,
                    style: { width: 48, height: 48 },
                  },
                    item ? React.createElement(React.Fragment, null,
                      renderBankingIcon(item.icon, 24),
                      React.createElement("span", { style: visuallyHiddenStyle }, item.name),
                      item.quantity > 1 ? React.createElement("span", { className: "biomes-ui-inventory__count" }, item.quantity) : null,
                    ) : null
                  )
                );
              }}
            />
          )}
        </section>

        <section aria-label="Bank loans and logs">
          <h3 style={titleStyle}>Loans</h3>
          {activeLoan ? (
            <div style={cardStyle}>
              <strong>{activeLoan.loanId}</strong>
              <p style={mutedTextStyle}>Due {new Date(activeLoan.dueAtMs).toLocaleDateString()} · {(activeLoan.dailyInterestRate * 100).toFixed(1)}% / day</p>
              {activeLoan.status === "defaulted" || activeLoan.balance?.overdue ? (
                <p style={{ ...mutedTextStyle, color: "#fbbf24" }}>
                  Consequence active: credit hold, reputation penalty, late interest, and a default fee until the debt is paid.
                </p>
              ) : null}
              <p style={mutedTextStyle}>Balance: {(activeLoan.balance?.totalRemaining ?? activeLoan.principalRemaining).toLocaleString()} gold</p>
              {activeLoan.balance?.defaultPenaltyRemaining ? (
                <p style={mutedTextStyle}>Default fee remaining: {activeLoan.balance.defaultPenaltyRemaining.toLocaleString()} gold</p>
              ) : null}
              <label style={labelStyle}>Repay gold<input value={repayAmount} onChange={(event) => setRepayAmount(event.currentTarget.value)} style={inputStyle} /></label>
              <button type="button" className="biomes-ui-tab" onClick={() => void adapter?.repayLoan?.(activeLoan.loanId, Math.max(1, Number(repayAmount) || 1))}>Repay</button>
            </div>
          ) : (
            <div style={cardStyle}>
              <label style={labelStyle}>Amount<input value={loanAmount} onChange={(event) => setLoanAmount(event.currentTarget.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Days<input value={loanDays} onChange={(event) => setLoanDays(event.currentTarget.value)} style={inputStyle} /></label>
              <button type="button" className="biomes-ui-tab" onClick={() => void adapter?.takeLoan?.(Math.max(1, Number(loanAmount) || 1), Math.max(1, Number(loanDays) || 1))}>Take Loan</button>
            </div>
          )}

          <h3 style={{ ...titleStyle, marginTop: 14 }}>Recent Logs</h3>
          {logs.length === 0 ? (
            <p style={mutedTextStyle}>No banking transactions recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {logs.slice(-5).reverse().map((log) => (
                <div key={log.id} style={cardStyle}>
                  <strong>{biomesPlayerTitle(log.kind)}</strong>
                  <p style={mutedTextStyle}>{log.itemId ? `${biomesPlayerTitle(log.itemId)} x${log.count ?? 1}` : log.goldDelta ? `${log.goldDelta} gold` : biomesPlayerTitle(log.vault)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)", lineHeight: 1.45 };
const pillStyle: React.CSSProperties = { padding: "8px 14px", background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, fontSize: 12 };
const rowButtonStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "20px 1fr auto", alignItems: "center", gap: 6, width: "100%", textAlign: "left" };
const cardStyle: React.CSSProperties = { padding: 10, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, marginBottom: 8, fontSize: 11, color: "var(--biomes-fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em" };
const inputStyle: React.CSSProperties = { minWidth: 0, padding: "6px 8px", color: "var(--biomes-fg)", background: "var(--biomes-bg-deep)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const visuallyHiddenStyle: React.CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
