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

export function harthmereBusinessCustomerEffectivePhase({
  currentTicket,
  nativePhase,
  sessionSpatialPhase,
}: {
  currentTicket: boolean;
  nativePhase?: string;
  sessionSpatialPhase?: string;
}) {
  if (
    currentTicket &&
    (nativePhase === "serving" || sessionSpatialPhase === "serving")
  ) {
    return "serving";
  }
  return nativePhase ?? sessionSpatialPhase;
}

export function canDirectlyTalkToHarthmereBusinessCustomer({
  currentTicket,
  entityPresent,
  nativePhase,
  sessionSpatialPhase,
  visible,
}: {
  currentTicket: boolean;
  entityPresent: boolean;
  nativePhase?: string;
  sessionSpatialPhase?: string;
  visible: boolean;
}) {
  const effectivePhase = harthmereBusinessCustomerEffectivePhase({
    currentTicket,
    nativePhase,
    sessionSpatialPhase,
  });
  return (
    currentTicket && entityPresent && visible && effectivePhase === "serving"
  );
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
// More than one business surface can be mounted by the production HUD. Keep
// registrations scoped to the component that published them so an inactive or
// closing surface cannot clear the active shift's customer dialogue.
const targetsByOwner = new Map<
  string,
  Map<BiomesId, HarthmereBusinessCustomerTalkTarget>
>();
let revision = 0;
const listeners = new Set<() => void>();

function notify() {
  revision += 1;
  for (const listener of [...listeners]) listener();
}

export function publishHarthmereBusinessCustomerTalkTarget(
  ownerId: string,
  target: HarthmereBusinessCustomerTalkTarget
) {
  const ownedTargets = targetsByOwner.get(ownerId) ?? new Map();
  ownedTargets.set(target.entityId, target);
  targetsByOwner.set(ownerId, ownedTargets);
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
  ownerId: string,
  nextTargets: readonly HarthmereBusinessCustomerTalkTarget[]
) {
  const previousTargets = targetsByOwner.get(ownerId);
  const ownedTargets = new Map<BiomesId, HarthmereBusinessCustomerTalkTarget>();
  for (const target of nextTargets) {
    const previous = previousTargets?.get(target.entityId);
    const preserveNativeServingState =
      previous?.sessionId === target.sessionId &&
      previous.ticketId === target.ticketId &&
      previous.ready &&
      previous.phase === "serving";
    ownedTargets.set(
      target.entityId,
      preserveNativeServingState
        ? { ...target, phase: previous.phase, ready: true }
        : target
    );
  }
  if (ownedTargets.size > 0) {
    targetsByOwner.set(ownerId, ownedTargets);
  } else {
    targetsByOwner.delete(ownerId);
  }
  notify();
}

export function clearHarthmereBusinessCustomerTalkTarget(
  ownerId: string,
  entityId?: BiomesId
) {
  const ownedTargets = targetsByOwner.get(ownerId);
  if (!ownedTargets) return;
  if (entityId === undefined) {
    targetsByOwner.delete(ownerId);
    notify();
    return;
  }
  if (!ownedTargets.delete(entityId)) return;
  if (ownedTargets.size === 0) targetsByOwner.delete(ownerId);
  notify();
}

export function harthmereBusinessCustomerTalkTargetForEntity(
  entityId: BiomesId
) {
  const owners = [...targetsByOwner.values()];
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const target = owners[index].get(entityId);
    if (target) return target;
  }
  return undefined;
}

/** Diagnostics for the live-browser runner; never used for authority. */
export function harthmereBusinessCustomerTalkTargetCount() {
  return new Set(
    [...targetsByOwner.values()].flatMap((ownedTargets) => [
      ...ownedTargets.keys(),
    ])
  ).size;
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
  targetsByOwner.clear();
  revision = 0;
  listeners.clear();
}
