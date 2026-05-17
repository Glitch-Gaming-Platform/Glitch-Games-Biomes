
import React from "react";

export const HARTHMERE_SERVER_AUTHORITY_CONTRACT_VERSION = "harthmere-server-authoritative-production-contracts-v1";

export type HarthmereAuthoritativeMutation = "inventory" | "wallet" | "trade" | "auction" | "bank" | "mail" | "quest" | "dialogue" | "reputation" | "legal" | "world";
export type HarthmereTransactionStatus = "pending" | "committed" | "rolled_back" | "rejected";

export type HarthmereServerTransaction = {
  transactionId: string;
  idempotencyKey: string;
  actorId: string;
  mutation: HarthmereAuthoritativeMutation;
  status: HarthmereTransactionStatus;
  beforeHash: string;
  afterHash?: string;
  auditLog: string[];
  clientSuppliedFieldsRejected: string[];
};

export const HARTHMERE_SERVER_AUTHORITY_MODELS = {
  itemOwnership: ["item_instance_id", "owner_player_id", "account_id", "location", "bound_state", "escrow_state", "version"],
  wallet: ["player_id", "currency", "amount", "version", "server_delta_only"],
  tradeSession: ["session_id", "participants", "locked_offers", "confirmed_by", "expires_at", "server_state_version"],
  auctionEscrow: ["listing_id", "seller_id", "item_instance_id", "escrow_location", "fee_paid", "sale_tax", "expires_at"],
  bankMailStorage: ["owner_id", "container_id", "item_instance_ids", "cod_terms", "checksum"],
  questProgress: ["player_id", "quest_id", "objective_state", "reward_claim_transaction_id"],
  dialogueChoice: ["request_id", "choice_id", "server_revalidated_requirements", "idempotency_key"],
  reputationLegal: ["player_id", "scope", "score_delta", "reason", "witnesses", "evidence_id"],
};

export function createHarthmereServerTransaction(input: { actorId: string; mutation: HarthmereAuthoritativeMutation; idempotencyKey: string; beforeHash: string }): HarthmereServerTransaction {
  return { transactionId: `srvtx-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`, idempotencyKey: input.idempotencyKey, actorId: input.actorId, mutation: input.mutation, status: "pending", beforeHash: input.beforeHash, auditLog: [`created:${input.mutation}`], clientSuppliedFieldsRejected: [] };
}

export function rejectHarthmereClientSpoof(tx: HarthmereServerTransaction, fields: string[]) {
  return { ...tx, status: "rejected" as const, clientSuppliedFieldsRejected: Array.from(new Set([...tx.clientSuppliedFieldsRejected, ...fields])), auditLog: [...tx.auditLog, `client_spoof_rejected:${fields.join(",")}`] };
}

export function commitHarthmereServerTransaction(tx: HarthmereServerTransaction, afterHash: string, knownIdempotencyKeys: Set<string>) {
  if (knownIdempotencyKeys.has(tx.idempotencyKey)) {
    return { ...tx, status: "rejected" as const, auditLog: [...tx.auditLog, "duplicate_idempotency_key_rejected"] };
  }
  knownIdempotencyKeys.add(tx.idempotencyKey);
  return { ...tx, status: "committed" as const, afterHash, auditLog: [...tx.auditLog, "atomic_commit"] };
}

export function rollbackHarthmereServerTransaction(tx: HarthmereServerTransaction, reason: string) {
  return { ...tx, status: "rolled_back" as const, auditLog: [...tx.auditLog, `rollback:${reason}`] };
}

export function validateHarthmereServerInventoryAuthority(payload: Record<string, unknown>) {
  const rejected = ["wallet", "gold", "ownerId", "bound", "escrowState", "questRewardClaimed"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected };
}

export function validateHarthmereServerWalletAuthority(payload: Record<string, unknown>) {
  const rejected = ["amount", "currency", "balance", "delta"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected, serverDeltaRequired: true };
}

export function validateHarthmereServerTradeAuthority(payload: Record<string, unknown>) {
  const rejected = ["confirmedByOtherPlayer", "lockedOffer", "otherPlayerItems"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected, requiresServerSession: true };
}

export function validateHarthmereServerAuctionAuthority(payload: Record<string, unknown>) {
  const rejected = ["escrowLocation", "sellerPayout", "taxPaid", "buyerReceivedItem"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected, requiresEscrowTransaction: true };
}

export function validateHarthmereServerMailBankAuthority(payload: Record<string, unknown>) {
  const rejected = ["attachmentDelivered", "codPaid", "bankOwner", "sharedAccountOverride"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected, requiresChecksum: true };
}

export function validateHarthmereServerQuestDialogueAuthority(payload: Record<string, unknown>) {
  const rejected = ["questComplete", "rewardClaimed", "choiceRequirementsMet", "reputationDelta"].filter((key) => key in payload);
  return { ok: rejected.length === 0, rejected, serverRevalidationRequired: true };
}

export const HARTHMERE_SERVER_AUDIT_LOG_FIELDS = ["transactionId", "idempotencyKey", "actorId", "mutation", "beforeHash", "afterHash", "status", "auditLog", "clientSuppliedFieldsRejected"];
export const HARTHMERE_SERVER_ATOMICITY_RULES = ["single database transaction", "row/version lock", "idempotency key", "rollback on partial failure", "append-only audit log", "client spoof rejection", "server recomputes price/reward/standing"];

export const HarthmereServerAuthorityPanel: React.FunctionComponent<{}> = () => <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-server-authority="v1"><div className="text-sm font-bold text-cyan-100">Server Authority Contracts</div><div>Models: {Object.keys(HARTHMERE_SERVER_AUTHORITY_MODELS).join(", ")}</div><div>Rules: {HARTHMERE_SERVER_ATOMICITY_RULES.join(" · ")}</div></div>;
