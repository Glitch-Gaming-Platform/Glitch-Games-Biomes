import { useEffect, useRef, useSyncExternalStore } from "react";

export const WORLD_INTERACTION_PRIORITY = {
  // An active Chapter 1 story prompt represents the exact server-validated
  // objective at the player's current position. It must outrank tools and
  // incidental overlapping players/NPCs; otherwise F can open an unrelated
  // modal while the authored quest action remains stuck.
  chapter1Story: 30_000,
  // Gates are Chapter 1 world interactions, but an active conversation staged
  // at the same aperture (Halden/Jackie/Rook beats) must own F first. When no
  // story candidate is registered, the gate still outranks tools and every
  // ordinary world object.
  chapter1Gate: 29_000,
  // A deliberately active tool mode (camera/fishing/wand) owns its controls
  // before any object behind the reticle. The player selected that mode and
  // its HUD is the visible contract for F.
  activeTool: 20_000,
  // A physical jobs board is an explicit station interaction and must outrank
  // an NPC standing beside or behind it. Otherwise the native cursor shortcut
  // steals F and the board can never be opened or used in crowded settlements.
  jobsBoard: 15_000,
  nativeEcs: 10_000,
  authoredStation: 6_000,
  authoredLoot: 5_000,
  authoredGathering: 4_000,
  ambientQuickAction: 1_000,
} as const;

export interface WorldInteractionCandidate {
  /** Stable diagnostic name. Registrations still receive a unique token. */
  id: string;
  /** Larger values win. Add a small distance adjustment when appropriate. */
  priority: number;
  keyCodes?: readonly string[];
  disabled?: boolean;
  canHandle?: () => boolean;
  onInteract: (event: KeyboardEvent) => unknown;
}

interface RegisteredWorldInteractionCandidate
  extends WorldInteractionCandidate {
  token: symbol;
  order: number;
}

const candidates = new Map<symbol, RegisteredWorldInteractionCandidate>();
const subscribers = new Set<() => void>();
const DEFAULT_KEY_CODES = ["KeyF"] as const;
let nextOrder = 1;
let removeKeyboardListener: (() => void) | undefined;
let nextSubscriberNotificationId = 1;
let pendingSubscriberNotificationId: number | undefined;

function eventStartedInEditable(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable)
  );
}

function candidateAcceptsKey(
  candidate: RegisteredWorldInteractionCandidate,
  keyCode: string
) {
  return (candidate.keyCodes ?? DEFAULT_KEY_CODES).includes(keyCode);
}

function selectedCandidate(keyCode: string) {
  let selected: RegisteredWorldInteractionCandidate | undefined;
  for (const candidate of candidates.values()) {
    if (!candidateAcceptsKey(candidate, keyCode)) continue;
    if (candidate.canHandle && !candidate.canHandle()) continue;
    if (
      !selected ||
      candidate.priority > selected.priority ||
      (candidate.priority === selected.priority &&
        candidate.order > selected.order)
    ) {
      selected = candidate;
    }
  }
  return selected;
}

function interactionKeys(
  ...candidateValues: Array<WorldInteractionCandidate | undefined>
) {
  const keys = new Set<string>();
  for (const candidate of candidateValues) {
    for (const keyCode of candidate?.keyCodes ?? DEFAULT_KEY_CODES) {
      keys.add(keyCode);
    }
  }
  return keys;
}

function selectedTokenSnapshot(keyCodes: Iterable<string>) {
  const snapshot = new Map<string, symbol | undefined>();
  for (const keyCode of keyCodes) {
    snapshot.set(keyCode, selectedCandidate(keyCode)?.token);
  }
  return snapshot;
}

function selectionChanged(snapshot: Map<string, symbol | undefined>) {
  for (const [keyCode, selectedToken] of snapshot) {
    if (selectedCandidate(keyCode)?.token !== selectedToken) {
      return true;
    }
  }
  return false;
}

function notifySubscribers() {
  if (pendingSubscriberNotificationId !== undefined) return;
  const notificationId = nextSubscriberNotificationId++;
  pendingSubscriberNotificationId = notificationId;
  queueMicrotask(() => {
    if (pendingSubscriberNotificationId !== notificationId) return;
    pendingSubscriberNotificationId = undefined;
    for (const subscriber of [...subscribers]) subscriber();
  });
}

function installKeyboardListener() {
  if (removeKeyboardListener || typeof window === "undefined") return;
  const handler = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      eventStartedInEditable(event)
    ) {
      return;
    }
    const selected = selectedCandidate(event.code);
    if (!selected) return;

    // A disabled top-priority action still owns the target. Consume the key so
    // a lower-priority prompt behind a locked crate/NPC cannot fire instead.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!selected.disabled) {
      selected.onInteract(event);
    }
  };
  window.addEventListener("keydown", handler, true);
  removeKeyboardListener = () => {
    window.removeEventListener("keydown", handler, true);
    removeKeyboardListener = undefined;
  };
}

function removeKeyboardListenerWhenIdle() {
  if (candidates.size === 0) removeKeyboardListener?.();
}

export function registerWorldInteractionCandidate(
  candidate: WorldInteractionCandidate
) {
  const token = Symbol(candidate.id);
  const registrationKeys = interactionKeys(candidate);
  const previousSelection = selectedTokenSnapshot(registrationKeys);
  candidates.set(token, { ...candidate, token, order: nextOrder++ });
  installKeyboardListener();
  if (selectionChanged(previousSelection)) {
    notifySubscribers();
  }
  return {
    token,
    update: (nextCandidate: WorldInteractionCandidate) => {
      const currentCandidate = candidates.get(token);
      if (!currentCandidate) return;
      const affectedKeys = interactionKeys(currentCandidate, nextCandidate);
      const previousSelection = selectedTokenSnapshot(affectedKeys);
      candidates.set(token, {
        ...nextCandidate,
        token,
        order: currentCandidate.order,
      });
      if (selectionChanged(previousSelection)) {
        notifySubscribers();
      }
    },
    unregister: () => {
      const currentCandidate = candidates.get(token);
      if (!currentCandidate) return;
      const affectedKeys = interactionKeys(currentCandidate);
      const previousSelection = selectedTokenSnapshot(affectedKeys);
      candidates.delete(token);
      if (selectionChanged(previousSelection)) {
        notifySubscribers();
      }
      removeKeyboardListenerWhenIdle();
    },
  };
}

export function selectedWorldInteractionIdForKey(keyCode = "KeyF") {
  return selectedCandidate(keyCode)?.id;
}

export function hasSelectedWorldInteractionCandidate(keyCode = "KeyF") {
  return selectedCandidate(keyCode) !== undefined;
}

export function useHasSelectedWorldInteractionCandidate(keyCode = "KeyF") {
  return (
    useSyncExternalStore(
      subscribe,
      () => selectedTokenForKey(keyCode),
      () => undefined
    ) !== undefined
  );
}

/**
 * Invoke the same winner the keyboard dispatcher would choose. Hotbar tool
 * buttons and accessibility controls use this instead of calling individual
 * gathering/station implementations, preserving the single global priority
 * order (including native ECS containers and jobs boards).
 */
export function invokeSelectedWorldInteractionForKey(keyCode = "KeyF") {
  const selected = selectedCandidate(keyCode);
  if (!selected || selected.disabled) {
    return false;
  }
  const event =
    typeof KeyboardEvent !== "undefined"
      ? new KeyboardEvent("keydown", { code: keyCode })
      : ({ code: keyCode } as KeyboardEvent);
  selected.onInteract(event);
  return true;
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function selectedTokenForKey(keyCode: string) {
  return selectedCandidate(keyCode)?.token;
}

/**
 * Registers one world action with the process-wide keyboard dispatcher and
 * reports whether this exact registration currently owns its primary key.
 * Components use the result to render only the prompt that will receive F.
 */
export function useWorldInteractionCandidate(
  candidate: WorldInteractionCandidate | undefined,
  primaryKeyCode = "KeyF"
) {
  const registrationToken = useRef<symbol>(undefined);
  const registration =
    useRef<ReturnType<typeof registerWorldInteractionCandidate>>(undefined);
  const selectedToken = useSyncExternalStore(
    subscribe,
    () => selectedTokenForKey(primaryKeyCode),
    () => undefined
  );

  useEffect(() => {
    if (!candidate) {
      const currentRegistration = registration.current;
      registration.current = undefined;
      registrationToken.current = undefined;
      currentRegistration?.unregister();
      return;
    }

    if (registration.current) {
      registration.current.update(candidate);
      return;
    }

    const nextRegistration = registerWorldInteractionCandidate(candidate);
    registration.current = nextRegistration;
    registrationToken.current = nextRegistration.token;
  });

  useEffect(() => {
    return () => {
      const currentRegistration = registration.current;
      registration.current = undefined;
      registrationToken.current = undefined;
      currentRegistration?.unregister();
    };
  }, []);

  return Boolean(
    candidate &&
      registrationToken.current &&
      registrationToken.current === selectedToken
  );
}

export function resetWorldInteractionDispatcherForTest() {
  const hadCandidates = candidates.size > 0;
  candidates.clear();
  nextOrder = 1;
  pendingSubscriberNotificationId = undefined;
  if (hadCandidates) {
    notifySubscribers();
  }
  removeKeyboardListener?.();
}
