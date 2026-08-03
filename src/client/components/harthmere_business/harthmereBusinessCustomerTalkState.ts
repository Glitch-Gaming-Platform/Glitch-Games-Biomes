import type {
  HarthmereBusinessInterfaceAdapter,
  HarthmereBusinessServiceOffer,
  HarthmereBusinessTypeId,
} from "./businessInterfaceLiveAdapter";
import type { BiomesId } from "@/shared/ids";
import { useSyncExternalStore } from "react";

export const HARTHMERE_BUSINESS_CUSTOMER_TALK_VERSION =
  "harthmere-business-customer-talk-v1" as const;

export interface HarthmereBusinessCustomerTalkTarget {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
  businessType: HarthmereBusinessTypeId;
  sessionId: string;
  ticketId: string;
  entityId: BiomesId;
  customerName: string;
  askLine: string;
  patienceRemaining: number;
  requestedOfferId?: string;
  phase?: string;
  ready: boolean;
  offers: readonly HarthmereBusinessServiceOffer[];
}

/**
 * HARTHMERE_BUSINESS_TALK_TARGET_REGISTRY
 *
 * Every customer in the active shift is registered, not just the one being
 * served.
 *
 * This started as a single `activeTarget`, which meant only the front customer
 * had business content attached. Talking to anyone else in the queue fell
 * through to the ordinary NPC dialogue branch and the player got "Chit Chat" /
 * "Ask about this place" from someone who is standing in a shop queue holding a
 * service request. That is the defect the production HAR shows: the shift
 * starts cleanly, but the conversation is the wrong conversation.
 *
 * A queued customer has no offers to choose yet — that is correct and the
 * dialog says so — but it must still be *their* dialogue, driven by their ask
 * line and queue position. So the registry holds one entry per live ticket and
 * the dialog decides what to show based on the customer's own phase.
 */
const targets = new Map<BiomesId, HarthmereBusinessCustomerTalkTarget>();
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  revision += 1;
  for (const listener of [...listeners]) listener();
}

export function publishHarthmereBusinessCustomerTalkTarget(
  target: HarthmereBusinessCustomerTalkTarget
) {
  targets.set(target.entityId, target);
  notify();
}

/**
 * Replace the whole registry for one shift in a single pass.
 *
 * Publishing per-customer effects would leave stale entries behind whenever a
 * ticket is served or cancelled between renders, and a stale entry is worse
 * than none: the player would get offers for a customer who has already walked
 * out. Setting the full queue at once makes removal automatic.
 */
export function publishHarthmereBusinessCustomerTalkTargets(
  nextTargets: readonly HarthmereBusinessCustomerTalkTarget[]
) {
  targets.clear();
  for (const target of nextTargets) targets.set(target.entityId, target);
  notify();
}

export function clearHarthmereBusinessCustomerTalkTarget(entityId?: BiomesId) {
  if (entityId === undefined) {
    if (targets.size === 0) return;
    targets.clear();
    notify();
    return;
  }
  if (!targets.delete(entityId)) return;
  notify();
}

export function harthmereBusinessCustomerTalkTargetForEntity(
  entityId: BiomesId
) {
  return targets.get(entityId);
}

/** Diagnostics for the live-browser runner; never used for authority. */
export function harthmereBusinessCustomerTalkTargetCount() {
  return targets.size;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHarthmereBusinessCustomerTalkTarget(entityId: BiomesId) {
  useSyncExternalStore(
    subscribe,
    () => revision,
    () => 0
  );
  return harthmereBusinessCustomerTalkTargetForEntity(entityId);
}

export function resetHarthmereBusinessCustomerTalkStateForTest() {
  targets.clear();
  revision = 0;
  listeners.clear();
}
