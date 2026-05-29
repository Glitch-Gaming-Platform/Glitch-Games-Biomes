export interface HarthmereJobsBoardPointerLockLikeV145 {
  isLocked(): boolean;
  unlock(): void;
  focusAndLock(): void;
}

export interface HarthmereJobsBoardPointerLockReturnRefV145 {
  current: boolean;
}

export function openHarthmereJobsBoardPointerLockV145(
  pointerLockManager: HarthmereJobsBoardPointerLockLikeV145,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRefV145,
) {
  shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
  pointerLockManager.unlock();
}

export function closeHarthmereJobsBoardPointerLockV145(
  pointerLockManager: HarthmereJobsBoardPointerLockLikeV145,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRefV145,
) {
  if (!shouldReturnPointerLockRef.current) return;
  shouldReturnPointerLockRef.current = false;
  pointerLockManager.focusAndLock();
}
