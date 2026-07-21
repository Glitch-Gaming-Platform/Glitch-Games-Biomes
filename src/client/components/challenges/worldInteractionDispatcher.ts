import { useEffect, useRef, useSyncExternalStore } from "react";

export const WORLD_INTERACTION_PRIORITY = {
  // A deliberately active tool mode (camera/fishing/wand) owns its controls
  // before any object behind the reticle. The player selected that mode and
  // its HUD is the visible contract for F.
  activeTool: 20_000,
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
let nextOrder = 1;
let removeKeyboardListener: (() => void) | undefined;

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
  return (candidate.keyCodes ?? ["KeyF"]).includes(keyCode);
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

function notifySubscribers() {
  for (const subscriber of subscribers) subscriber();
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
  candidates.set(token, { ...candidate, token, order: nextOrder++ });
  installKeyboardListener();
  notifySubscribers();
  return {
    token,
    unregister: () => {
      if (!candidates.delete(token)) return;
      notifySubscribers();
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
  const registrationToken = useRef<symbol>();
  const selectedToken = useSyncExternalStore(
    subscribe,
    () => selectedTokenForKey(primaryKeyCode),
    () => undefined
  );

  useEffect(() => {
    if (!candidate) {
      registrationToken.current = undefined;
      return;
    }
    const registration = registerWorldInteractionCandidate(candidate);
    registrationToken.current = registration.token;
    return () => {
      registration.unregister();
      if (registrationToken.current === registration.token) {
        registrationToken.current = undefined;
      }
    };
  }, [candidate]);

  return Boolean(
    candidate &&
      registrationToken.current &&
      registrationToken.current === selectedToken
  );
}

export function resetWorldInteractionDispatcherForTest() {
  candidates.clear();
  nextOrder = 1;
  notifySubscribers();
  removeKeyboardListener?.();
}
