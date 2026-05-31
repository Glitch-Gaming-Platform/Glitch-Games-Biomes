export const POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR_V1 =
  '[data-pointer-lock-policy="unlock-while-open"]';

let pointerLockUnlockWhileOpenDepthV1 = 0;

export interface PointerLockUnlockWhileOpenManagerV1 {
  isLocked(): boolean;
  unlock(): void;
  focusAndLock(): void;
}

export interface PointerLockUnlockWhileOpenReturnRefV1 {
  current: boolean;
  policyActive?: boolean;
}

// HARTHMERE_UI_V147: a subscriber set so React surfaces (the EscGameMenu)
// can hide themselves while an "unlock-while-open" panel is active. Without
// this, opening the Jobs Board / Home / Business / Crafting panel would
// surface the "Return to Game" overlay on top of the panel because the
// pointer is intentionally unlocked.
const pointerLockUnlockWhileOpenSubscribersV1 = new Set<() => void>();

function notifyPointerLockUnlockWhileOpenSubscribersV1() {
  // Iterate over a snapshot to avoid mutation-during-iteration if a subscriber
  // unsubscribes itself in response to the notification.
  for (const subscriber of Array.from(
    pointerLockUnlockWhileOpenSubscribersV1
  )) {
    try {
      subscriber();
    } catch {}
  }
}

export function subscribePointerLockUnlockWhileOpenV1(
  subscriber: () => void
) {
  pointerLockUnlockWhileOpenSubscribersV1.add(subscriber);
  return () => {
    pointerLockUnlockWhileOpenSubscribersV1.delete(subscriber);
  };
}

export function beginPointerLockUnlockWhileOpenV1() {
  pointerLockUnlockWhileOpenDepthV1 += 1;
  notifyPointerLockUnlockWhileOpenSubscribersV1();
}

export function endPointerLockUnlockWhileOpenV1() {
  const next = Math.max(0, pointerLockUnlockWhileOpenDepthV1 - 1);
  if (next === pointerLockUnlockWhileOpenDepthV1) return;
  pointerLockUnlockWhileOpenDepthV1 = next;
  notifyPointerLockUnlockWhileOpenSubscribersV1();
}

export function isPointerLockUnlockWhileOpenActiveV1() {
  return pointerLockUnlockWhileOpenDepthV1 > 0;
}

export function openPointerLockUnlockWhileOpenV1(
  pointerLockManager: PointerLockUnlockWhileOpenManagerV1,
  shouldReturnPointerLockRef: PointerLockUnlockWhileOpenReturnRefV1
) {
  if (!shouldReturnPointerLockRef.policyActive) {
    beginPointerLockUnlockWhileOpenV1();
    shouldReturnPointerLockRef.policyActive = true;
    shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
  } else {
    shouldReturnPointerLockRef.current =
      shouldReturnPointerLockRef.current || pointerLockManager.isLocked();
  }
  pointerLockManager.unlock();
}

export function closePointerLockUnlockWhileOpenV1(
  pointerLockManager: PointerLockUnlockWhileOpenManagerV1,
  shouldReturnPointerLockRef: PointerLockUnlockWhileOpenReturnRefV1
) {
  if (shouldReturnPointerLockRef.policyActive) {
    endPointerLockUnlockWhileOpenV1();
    shouldReturnPointerLockRef.policyActive = false;
  }
  if (!shouldReturnPointerLockRef.current) return;
  shouldReturnPointerLockRef.current = false;
  pointerLockManager.focusAndLock();
}

export function hasPointerLockUnlockWhileOpenSurfaceV1(
  root: Pick<ParentNode, "querySelector"> | undefined =
    typeof document === "undefined" ? undefined : document
) {
  return Boolean(
    root?.querySelector(POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR_V1)
  );
}
