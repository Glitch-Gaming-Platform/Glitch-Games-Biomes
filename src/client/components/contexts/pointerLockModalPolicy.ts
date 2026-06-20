export const POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR =
  '[data-pointer-lock-policy="unlock-while-open"]';

let pointerLockUnlockWhileOpenDepth = 0;

export interface PointerLockUnlockWhileOpenManager {
  isLocked(): boolean;
  unlock(): void;
  focusAndLock(): void;
}

export interface PointerLockUnlockWhileOpenReturnRef {
  current: boolean;
  policyActive?: boolean;
}

// HARTHMERE_UI: a subscriber set so React surfaces (the EscGameMenu)
// can hide themselves while an "unlock-while-open" panel is active. Without
// this, opening the Jobs Board / Home / Business / Crafting panel would
// surface the "Return to Game" overlay on top of the panel because the
// pointer is intentionally unlocked.
const pointerLockUnlockWhileOpenSubscribers = new Set<() => void>();

function notifyPointerLockUnlockWhileOpenSubscribers() {
  // Iterate over a snapshot to avoid mutation-during-iteration if a subscriber
  // unsubscribes itself in response to the notification.
  for (const subscriber of Array.from(
    pointerLockUnlockWhileOpenSubscribers
  )) {
    try {
      subscriber();
    } catch {}
  }
}

export function subscribePointerLockUnlockWhileOpen(
  subscriber: () => void
) {
  pointerLockUnlockWhileOpenSubscribers.add(subscriber);
  return () => {
    pointerLockUnlockWhileOpenSubscribers.delete(subscriber);
  };
}

export function beginPointerLockUnlockWhileOpen() {
  pointerLockUnlockWhileOpenDepth += 1;
  notifyPointerLockUnlockWhileOpenSubscribers();
}

export function endPointerLockUnlockWhileOpen() {
  const next = Math.max(0, pointerLockUnlockWhileOpenDepth - 1);
  if (next === pointerLockUnlockWhileOpenDepth) return;
  pointerLockUnlockWhileOpenDepth = next;
  notifyPointerLockUnlockWhileOpenSubscribers();
}

export function isPointerLockUnlockWhileOpenActive() {
  return pointerLockUnlockWhileOpenDepth > 0;
}

export function openPointerLockUnlockWhileOpen(
  pointerLockManager: PointerLockUnlockWhileOpenManager,
  shouldReturnPointerLockRef: PointerLockUnlockWhileOpenReturnRef
) {
  if (!shouldReturnPointerLockRef.policyActive) {
    beginPointerLockUnlockWhileOpen();
    shouldReturnPointerLockRef.policyActive = true;
    shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
  } else {
    shouldReturnPointerLockRef.current =
      shouldReturnPointerLockRef.current || pointerLockManager.isLocked();
  }
  pointerLockManager.unlock();
}

export function closePointerLockUnlockWhileOpen(
  pointerLockManager: PointerLockUnlockWhileOpenManager,
  shouldReturnPointerLockRef: PointerLockUnlockWhileOpenReturnRef
) {
  if (shouldReturnPointerLockRef.policyActive) {
    endPointerLockUnlockWhileOpen();
    shouldReturnPointerLockRef.policyActive = false;
  }
  if (!shouldReturnPointerLockRef.current) return;
  shouldReturnPointerLockRef.current = false;
  pointerLockManager.focusAndLock();
}

export function hasPointerLockUnlockWhileOpenSurface(
  root: Pick<ParentNode, "querySelector"> | undefined =
    typeof document === "undefined" ? undefined : document
) {
  return Boolean(
    root?.querySelector(POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR)
  );
}
