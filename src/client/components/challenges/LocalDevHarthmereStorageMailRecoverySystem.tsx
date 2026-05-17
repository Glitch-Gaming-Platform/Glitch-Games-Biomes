import React, { useEffect, useMemo, useState } from "react";
import type { HarthmereTradeableItem } from "@/client/components/challenges/LocalDevHarthmereTradeAuctionSystem";

export const HARTHMERE_STORAGE_MAIL_RECOVERY_VERSION = 1;
export const HARTHMERE_STORAGE_MAIL_RECOVERY_STATE_KEY =
  "biomes.localDev.harthmere.storageMailRecoveryState.v1";
export const HARTHMERE_STORAGE_MAIL_RECOVERY_CHANGED_EVENT =
  "biomes:harthmere-storage-mail-recovery-changed";
export const HARTHMERE_HIGH_VALUE_STORAGE_LOG_THRESHOLD = 500;

export type HarthmereStoragePlayerInventory = {
  playerId: string;
  accountId: string;
  backpack: HarthmereTradeableItem[];
  wallet: Record<string, number>;
  materialStorage: Record<string, number>;
  maxBackpackSlots: number;
};

export type HarthmereBankVault = {
  ownerId: string;
  maxSlots: number;
  items: HarthmereTradeableItem[];
};

export type HarthmereSharedAccountVault = {
  accountId: string;
  maxSlots: number;
  items: HarthmereTradeableItem[];
};

export type HarthmereMailMessage = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  subject: string;
  body: string;
  createdAt: number;
  attachments: HarthmereTradeableItem[];
  currency: Record<string, number>;
  codGold?: number;
  immutableCodGold?: number;
  claimedAt?: number;
  source:
    | "player_mail"
    | "auction_delivery"
    | "auction_return"
    | "overflow_reward"
    | "recovery";
};

export type HarthmereOverflowRecord = {
  id: string;
  ownerId: string;
  createdAt: number;
  reason: "backpack_full" | "quest_reward" | "vendor_purchase" | "mail_claim";
  items: HarthmereTradeableItem[];
  currency: Record<string, number>;
  claimedAt?: number;
};

export type HarthmereRecoveryRecord = {
  id: string;
  ownerId: string;
  createdAt: number;
  transactionId: string;
  reason:
    | "server_crash"
    | "failed_trade"
    | "failed_auction"
    | "failed_mail"
    | "failed_bank"
    | "manual_recovery";
  item: HarthmereTradeableItem;
  checksum: string;
  restoredAt?: number;
};

export type HarthmereStorageLogEntry = {
  id: string;
  at: number;
  system: "storage_mail_recovery";
  action: string;
  actorId?: string;
  itemId?: string;
  amountGold?: number;
  highValue: boolean;
  reason: string;
  success: boolean;
};

export type HarthmereStorageMailRecoveryState = {
  version: 1;
  bankVaults: Record<string, HarthmereBankVault>;
  sharedAccountVaults: Record<string, HarthmereSharedAccountVault>;
  mailboxes: Record<string, HarthmereMailMessage[]>;
  overflow: Record<string, HarthmereOverflowRecord[]>;
  recovery: Record<string, HarthmereRecoveryRecord[]>;
  transactionIds: Record<string, number>;
  logs: HarthmereStorageLogEntry[];
};

export type HarthmereStorageResult<T> =
  | { ok: true; state: HarthmereStorageMailRecoveryState; value: T }
  | { ok: false; state: HarthmereStorageMailRecoveryState; error: string };

export const HARTHMERE_STORAGE_SERVICE_NPCS = [
  {
    id: "banker_merl_voss",
    name: "Banker Merl Voss",
    offset: 29,
    service: "bank",
    district: "Player Services",
  },
  {
    id: "storage_steward",
    name: "Storage Steward",
    offset: 31,
    service: "storage",
    district: "Player Services",
  },
  {
    id: "courier_anwen",
    name: "Courier Anwen",
    offset: 30,
    service: "mail",
    district: "Player Services",
  },
  {
    id: "auction_clerk_pell",
    name: "Auction Clerk Pell",
    offset: 34,
    service: "auction_mail_escrow",
    district: "Player Services",
  },
] as const;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function now() {
  return Date.now();
}

function id(prefix: string) {
  return `${prefix}_${now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clampCurrency(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.floor(n));
}

function checksumItem(item: HarthmereTradeableItem) {
  return `${item.instanceId}:${item.itemId}:${item.ownerId}:${item.quantity}:${item.category ?? ""}`;
}

function appendStorageLog(
  state: HarthmereStorageMailRecoveryState,
  entry: Omit<HarthmereStorageLogEntry, "id" | "at" | "system" | "highValue"> & {
    valueGold?: number;
  },
) {
  const valueGold = Number(entry.valueGold ?? entry.amountGold ?? 0);
  state.logs = [
    {
      id: id("slog"),
      at: now(),
      system: "storage_mail_recovery" as const,
      highValue: Number.isFinite(valueGold) && valueGold >= HARTHMERE_HIGH_VALUE_STORAGE_LOG_THRESHOLD,
      ...entry,
    },
    ...state.logs,
  ].slice(0, 250);
}

export function createHarthmereStorageMailRecoveryState(): HarthmereStorageMailRecoveryState {
  return {
    version: 1,
    bankVaults: {},
    sharedAccountVaults: {},
    mailboxes: {},
    overflow: {},
    recovery: {},
    transactionIds: {},
    logs: [],
  };
}

export function readHarthmereStorageMailRecoveryState(): HarthmereStorageMailRecoveryState {
  if (!isBrowser()) {
    return createHarthmereStorageMailRecoveryState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_STORAGE_MAIL_RECOVERY_STATE_KEY);
    if (!raw) {
      return createHarthmereStorageMailRecoveryState();
    }
    const parsed = JSON.parse(raw) as Partial<HarthmereStorageMailRecoveryState>;
    return {
      version: 1,
      bankVaults: parsed.bankVaults ?? {},
      sharedAccountVaults: parsed.sharedAccountVaults ?? {},
      mailboxes: parsed.mailboxes ?? {},
      overflow: parsed.overflow ?? {},
      recovery: parsed.recovery ?? {},
      transactionIds: parsed.transactionIds ?? {},
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return createHarthmereStorageMailRecoveryState();
  }
}

export function writeHarthmereStorageMailRecoveryState(state: HarthmereStorageMailRecoveryState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_STORAGE_MAIL_RECOVERY_STATE_KEY,
    JSON.stringify(state),
  );
  window.dispatchEvent(new CustomEvent(HARTHMERE_STORAGE_MAIL_RECOVERY_CHANGED_EVENT));
}

function getBankVault(state: HarthmereStorageMailRecoveryState, ownerId: string) {
  state.bankVaults[ownerId] = state.bankVaults[ownerId] ?? {
    ownerId,
    maxSlots: 48,
    items: [],
  };
  return state.bankVaults[ownerId];
}

function getSharedVault(state: HarthmereStorageMailRecoveryState, accountId: string) {
  state.sharedAccountVaults[accountId] = state.sharedAccountVaults[accountId] ?? {
    accountId,
    maxSlots: 32,
    items: [],
  };
  return state.sharedAccountVaults[accountId];
}

function removeBackpackItem(player: HarthmereStoragePlayerInventory, instanceId: string) {
  const idx = player.backpack.findIndex(
    (item) => item.instanceId === instanceId && item.ownerId === player.playerId,
  );
  if (idx < 0) {
    return undefined;
  }
  const [item] = player.backpack.splice(idx, 1);
  return item;
}

function isProtectedForExternalMove(item: HarthmereTradeableItem | undefined) {
  if (!item) {
    return "Item not found.";
  }
  if (item.locked || item.lockedInTrade || item.escrowId) {
    return "Locked, trade-locked, or escrowed items cannot be moved.";
  }
  if (item.questItem || item.category === "quest_item") {
    return "Quest items cannot be mailed, traded, or shared.";
  }
  return undefined;
}

export function depositHarthmereBankItem(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
  itemInstanceId: string,
): HarthmereStorageResult<{ player: HarthmereStoragePlayerInventory; vault: HarthmereBankVault }> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const item = nextPlayer.backpack.find((candidate) => candidate.instanceId === itemInstanceId);
  const protectedReason = isProtectedForExternalMove(item);
  if (protectedReason) {
    appendStorageLog(next, {
      action: "bank_deposit",
      actorId: player.playerId,
      itemId: item?.itemId,
      reason: protectedReason,
      success: false,
    });
    return { ok: false, state: next, error: protectedReason };
  }
  if (item!.ownerId !== player.playerId) {
    return { ok: false, state: next, error: "Bank deposit validates item ownership." };
  }
  const vault = getBankVault(next, player.playerId);
  if (vault.items.length >= vault.maxSlots) {
    return { ok: false, state: next, error: "Bank vault is full." };
  }
  const moved = removeBackpackItem(nextPlayer, itemInstanceId)!;
  vault.items.push({ ...moved, ownerId: player.playerId });
  appendStorageLog(next, {
    action: "bank_deposit",
    actorId: player.playerId,
    itemId: moved.itemId,
    valueGold: moved.baseValue,
    reason: "ownership_validated_and_item_moved_to_bank",
    success: true,
  });
  return { ok: true, state: next, value: { player: nextPlayer, vault } };
}

export function withdrawHarthmereBankItem(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
  itemInstanceId: string,
): HarthmereStorageResult<{ player: HarthmereStoragePlayerInventory; vault: HarthmereBankVault }> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const vault = getBankVault(next, player.playerId);
  const idx = vault.items.findIndex(
    (item) => item.instanceId === itemInstanceId && item.ownerId === player.playerId,
  );
  if (idx < 0) {
    return { ok: false, state: next, error: "Bank withdraw validates ownership." };
  }
  if (nextPlayer.backpack.length >= nextPlayer.maxBackpackSlots) {
    return { ok: false, state: next, error: "Backpack is full; withdraw blocked." };
  }
  const [item] = vault.items.splice(idx, 1);
  nextPlayer.backpack.push(item);
  appendStorageLog(next, {
    action: "bank_withdraw",
    actorId: player.playerId,
    itemId: item.itemId,
    valueGold: item.baseValue,
    reason: "ownership_validated_and_item_withdrawn",
    success: true,
  });
  return { ok: true, state: next, value: { player: nextPlayer, vault } };
}

export function depositHarthmereSharedAccountItem(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
  itemInstanceId: string,
): HarthmereStorageResult<{ player: HarthmereStoragePlayerInventory; vault: HarthmereSharedAccountVault }> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const item = nextPlayer.backpack.find((candidate) => candidate.instanceId === itemInstanceId);
  const protectedReason = isProtectedForExternalMove(item);
  if (protectedReason) {
    return { ok: false, state: next, error: protectedReason };
  }
  if (!item!.accountBound) {
    return { ok: false, state: next, error: "Shared account storage only accepts account-bound allowed items." };
  }
  const vault = getSharedVault(next, player.accountId);
  if (vault.items.length >= vault.maxSlots) {
    return { ok: false, state: next, error: "Shared account vault is full." };
  }
  const moved = removeBackpackItem(nextPlayer, itemInstanceId)!;
  vault.items.push({ ...moved, ownerId: player.playerId, accountBound: true });
  appendStorageLog(next, {
    action: "shared_storage_deposit",
    actorId: player.playerId,
    itemId: moved.itemId,
    valueGold: moved.baseValue,
    reason: "account_bound_item_deposited_to_shared_vault",
    success: true,
  });
  return { ok: true, state: next, value: { player: nextPlayer, vault } };
}

export function depositAllHarthmereMaterials(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
): HarthmereStorageResult<HarthmereStoragePlayerInventory> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const kept: HarthmereTradeableItem[] = [];
  let movedCount = 0;
  for (const item of nextPlayer.backpack) {
    if (item.category === "crafting_material" && !item.locked && !item.escrowId) {
      nextPlayer.materialStorage[item.itemId] =
        (nextPlayer.materialStorage[item.itemId] ?? 0) + Math.max(1, item.quantity);
      movedCount += Math.max(1, item.quantity);
    } else {
      kept.push(item);
    }
  }
  nextPlayer.backpack = kept;
  appendStorageLog(next, {
    action: "material_deposit_all",
    actorId: player.playerId,
    reason: `deposited_${movedCount}_materials_to_material_storage`,
    success: true,
  });
  return { ok: true, state: next, value: nextPlayer };
}

function claimTransaction(
  state: HarthmereStorageMailRecoveryState,
  transactionId: string,
) {
  if (state.transactionIds[transactionId]) {
    return "Duplicate storage/mail transaction rejected.";
  }
  state.transactionIds[transactionId] = now();
  return undefined;
}

export function sendHarthmereMailWithAttachments(
  state: HarthmereStorageMailRecoveryState,
  sender: HarthmereStoragePlayerInventory,
  input: {
    transactionId: string;
    toPlayerId: string;
    subject: string;
    body: string;
    itemInstanceIds: string[];
    currency?: Record<string, number>;
    codGold?: number;
  },
): HarthmereStorageResult<{ sender: HarthmereStoragePlayerInventory; mail: HarthmereMailMessage }> {
  const next = clone(state);
  const nextSender = clone(sender);
  const duplicate = claimTransaction(next, input.transactionId);
  if (duplicate) {
    return { ok: false, state: next, error: duplicate };
  }
  const attachments: HarthmereTradeableItem[] = [];
  for (const instanceId of input.itemInstanceIds) {
    const item = nextSender.backpack.find((candidate) => candidate.instanceId === instanceId);
    const protectedReason = isProtectedForExternalMove(item);
    if (protectedReason) {
      return { ok: false, state: next, error: protectedReason };
    }
  }
  const currency = Object.fromEntries(
    Object.entries(input.currency ?? {}).map(([key, value]) => [key, clampCurrency(value)]),
  );
  for (const [currencyName, amount] of Object.entries(currency)) {
    if (clampCurrency(nextSender.wallet[currencyName]) < amount) {
      return { ok: false, state: next, error: "Sender lacks attached currency." };
    }
  }
  for (const instanceId of input.itemInstanceIds) {
    attachments.push(removeBackpackItem(nextSender, instanceId)!);
  }
  for (const [currencyName, amount] of Object.entries(currency)) {
    nextSender.wallet[currencyName] = clampCurrency(nextSender.wallet[currencyName]) - amount;
  }
  const mail: HarthmereMailMessage = {
    id: id("mail"),
    fromPlayerId: sender.playerId,
    toPlayerId: input.toPlayerId,
    subject: input.subject,
    body: input.body,
    createdAt: now(),
    attachments,
    currency,
    codGold: clampCurrency(input.codGold),
    immutableCodGold: clampCurrency(input.codGold),
    source: "player_mail",
  };
  next.mailboxes[input.toPlayerId] = [...(next.mailboxes[input.toPlayerId] ?? []), mail];
  appendStorageLog(next, {
    action: "mail_send",
    actorId: sender.playerId,
    amountGold: currency.gold,
    reason: "attachments_removed_atomically_and_mail_created",
    success: true,
  });
  return { ok: true, state: next, value: { sender: nextSender, mail } };
}

export function claimHarthmereMail(
  state: HarthmereStorageMailRecoveryState,
  recipient: HarthmereStoragePlayerInventory,
  sender: HarthmereStoragePlayerInventory | undefined,
  mailId: string,
  clientClaimedCodGold?: number,
): HarthmereStorageResult<{
  recipient: HarthmereStoragePlayerInventory;
  sender?: HarthmereStoragePlayerInventory;
  mail: HarthmereMailMessage;
}> {
  const next = clone(state);
  const nextRecipient = clone(recipient);
  const nextSender = sender ? clone(sender) : undefined;
  const mailbox = next.mailboxes[recipient.playerId] ?? [];
  const mail = mailbox.find((candidate) => candidate.id === mailId);
  if (!mail || mail.claimedAt) {
    return { ok: false, state: next, error: "Mail not found or already claimed." };
  }
  const codGold = clampCurrency(mail.immutableCodGold ?? mail.codGold);
  if (clientClaimedCodGold !== undefined && clientClaimedCodGold !== codGold) {
    return { ok: false, state: next, error: "Mail COD cannot be spoofed by the client." };
  }
  if (codGold > 0 && clampCurrency(nextRecipient.wallet.gold) < codGold) {
    return { ok: false, state: next, error: "Recipient lacks COD gold." };
  }
  if (nextRecipient.backpack.length + mail.attachments.length > nextRecipient.maxBackpackSlots) {
    return { ok: false, state: next, error: "Backpack is full; claim mail through overflow/recovery." };
  }
  if (codGold > 0) {
    nextRecipient.wallet.gold = clampCurrency(nextRecipient.wallet.gold) - codGold;
    if (nextSender) {
      nextSender.wallet.gold = clampCurrency(nextSender.wallet.gold) + codGold;
    }
  }
  nextRecipient.backpack.push(
    ...mail.attachments.map((item) => ({ ...item, ownerId: recipient.playerId })),
  );
  for (const [currencyName, amount] of Object.entries(mail.currency)) {
    nextRecipient.wallet[currencyName] = clampCurrency(nextRecipient.wallet[currencyName]) + clampCurrency(amount);
  }
  mail.claimedAt = now();
  appendStorageLog(next, {
    action: "mail_claim",
    actorId: recipient.playerId,
    amountGold: codGold,
    reason: "mail_claimed_atomically_with_immutable_cod",
    success: true,
  });
  return { ok: true, state: next, value: { recipient: nextRecipient, sender: nextSender, mail } };
}

export function grantHarthmereRewardWithOverflow(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
  reward: { items: HarthmereTradeableItem[]; currency?: Record<string, number>; reason: HarthmereOverflowRecord["reason"] },
): HarthmereStorageResult<HarthmereStoragePlayerInventory> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const availableSlots = Math.max(0, nextPlayer.maxBackpackSlots - nextPlayer.backpack.length);
  const directItems = reward.items.slice(0, availableSlots).map((item) => ({ ...item, ownerId: player.playerId }));
  const overflowItems = reward.items.slice(availableSlots).map((item) => ({ ...item, ownerId: player.playerId }));
  nextPlayer.backpack.push(...directItems);
  for (const [currencyName, amount] of Object.entries(reward.currency ?? {})) {
    nextPlayer.wallet[currencyName] = clampCurrency(nextPlayer.wallet[currencyName]) + clampCurrency(amount);
  }
  if (overflowItems.length > 0) {
    next.overflow[player.playerId] = [
      ...(next.overflow[player.playerId] ?? []),
      {
        id: id("overflow"),
        ownerId: player.playerId,
        createdAt: now(),
        reason: reward.reason,
        items: overflowItems,
        currency: {},
      },
    ];
    appendStorageLog(next, {
      action: "overflow_store",
      actorId: player.playerId,
      reason: "backpack_full_reward_items_stored_in_overflow",
      success: true,
    });
  }
  return { ok: true, state: next, value: nextPlayer };
}

export function recordHarthmereFailedTransactionRecovery(
  state: HarthmereStorageMailRecoveryState,
  ownerId: string,
  transactionId: string,
  item: HarthmereTradeableItem,
  reason: HarthmereRecoveryRecord["reason"],
): HarthmereStorageMailRecoveryState {
  const next = clone(state);
  next.recovery[ownerId] = [
    ...(next.recovery[ownerId] ?? []),
    {
      id: id("recovery"),
      ownerId,
      createdAt: now(),
      transactionId,
      reason,
      item: { ...item, ownerId },
      checksum: checksumItem({ ...item, ownerId }),
    },
  ];
  appendStorageLog(next, {
    action: "recovery_record",
    actorId: ownerId,
    itemId: item.itemId,
    valueGold: item.baseValue,
    reason: "failed_transaction_recorded_for_item_recovery",
    success: true,
  });
  return next;
}

export function restoreHarthmereRecoveryItem(
  state: HarthmereStorageMailRecoveryState,
  player: HarthmereStoragePlayerInventory,
  recoveryId: string,
): HarthmereStorageResult<HarthmereStoragePlayerInventory> {
  const next = clone(state);
  const nextPlayer = clone(player);
  const record = (next.recovery[player.playerId] ?? []).find((entry) => entry.id === recoveryId);
  if (!record || record.restoredAt) {
    return { ok: false, state: next, error: "Recovery item missing or already restored." };
  }
  if (checksumItem(record.item) !== record.checksum) {
    return { ok: false, state: next, error: "Recovery checksum mismatch." };
  }
  if (nextPlayer.backpack.length >= nextPlayer.maxBackpackSlots) {
    return { ok: false, state: next, error: "Backpack full; recovery remains available." };
  }
  nextPlayer.backpack.push({ ...record.item, ownerId: player.playerId });
  record.restoredAt = now();
  appendStorageLog(next, {
    action: "recovery_restore",
    actorId: player.playerId,
    itemId: record.item.itemId,
    valueGold: record.item.baseValue,
    reason: "recovery_restored_after_failed_transaction_or_crash",
    success: true,
  });
  return { ok: true, state: next, value: nextPlayer };
}

export function installHarthmereStorageMailRecoveryDebugBridge() {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereStorageMailRecovery?: unknown;
  };
  win.__harthmereStorageMailRecovery = {
    version: HARTHMERE_STORAGE_MAIL_RECOVERY_VERSION,
    serviceNpcs: HARTHMERE_STORAGE_SERVICE_NPCS,
    readState: readHarthmereStorageMailRecoveryState,
    writeState: writeHarthmereStorageMailRecoveryState,
    reset: () => writeHarthmereStorageMailRecoveryState(createHarthmereStorageMailRecoveryState()),
    depositBankItem: depositHarthmereBankItem,
    withdrawBankItem: withdrawHarthmereBankItem,
    depositSharedAccountItem: depositHarthmereSharedAccountItem,
    depositAllMaterials: depositAllHarthmereMaterials,
    sendMailWithAttachments: sendHarthmereMailWithAttachments,
    claimMail: claimHarthmereMail,
    grantRewardWithOverflow: grantHarthmereRewardWithOverflow,
    recordRecovery: recordHarthmereFailedTransactionRecovery,
    restoreRecoveryItem: restoreHarthmereRecoveryItem,
  };
}

export const HarthmereStorageMailRecoveryMenuPanel: React.FunctionComponent<{}> = () => {
  const [state, setState] = useState<HarthmereStorageMailRecoveryState>(() =>
    readHarthmereStorageMailRecoveryState(),
  );
  useEffect(() => {
    installHarthmereStorageMailRecoveryDebugBridge();
    const onChange = () => setState(readHarthmereStorageMailRecoveryState());
    window.addEventListener(HARTHMERE_STORAGE_MAIL_RECOVERY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(HARTHMERE_STORAGE_MAIL_RECOVERY_CHANGED_EVENT, onChange);
  }, []);
  const summary = useMemo(() => {
    const banked = Object.values(state.bankVaults).reduce((sum, vault) => sum + vault.items.length, 0);
    const mail = Object.values(state.mailboxes).reduce((sum, messages) => sum + messages.length, 0);
    const recovery = Object.values(state.recovery).reduce((sum, records) => sum + records.filter((r) => !r.restoredAt).length, 0);
    return { banked, mail, recovery };
  }, [state]);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
      <div className="mb-2 text-sm font-bold text-white">Bank, Mail & Recovery</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-black/30 p-2">Banked: {summary.banked}</div>
        <div className="rounded-lg bg-black/30 p-2">Mail: {summary.mail}</div>
        <div className="rounded-lg bg-black/30 p-2">Recovery: {summary.recovery}</div>
      </div>
      <div className="mt-2 text-[11px] text-white/60">
        Service NPCs cover banking, storage, mail, auction escrow, overflow rewards, and failed-transaction recovery.
      </div>
    </div>
  );
};

installHarthmereStorageMailRecoveryDebugBridge();
