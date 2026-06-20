import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenManager,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";

export type HarthmereJobsBoardPointerLockLike =
  PointerLockUnlockWhileOpenManager;

export type HarthmereJobsBoardPointerLockReturnRef =
  PointerLockUnlockWhileOpenReturnRef;

export function openHarthmereJobsBoardPointerLock(
  pointerLockManager: HarthmereJobsBoardPointerLockLike,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRef,
) {
  openPointerLockUnlockWhileOpen(
    pointerLockManager,
    shouldReturnPointerLockRef
  );
}

export function closeHarthmereJobsBoardPointerLock(
  pointerLockManager: HarthmereJobsBoardPointerLockLike,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRef,
) {
  closePointerLockUnlockWhileOpen(
    pointerLockManager,
    shouldReturnPointerLockRef
  );
}
