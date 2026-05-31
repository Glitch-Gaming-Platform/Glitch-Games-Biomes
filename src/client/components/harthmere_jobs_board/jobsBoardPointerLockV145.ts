import {
  closePointerLockUnlockWhileOpenV1,
  openPointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenManagerV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "@/client/components/contexts/pointerLockModalPolicy";

export type HarthmereJobsBoardPointerLockLikeV145 =
  PointerLockUnlockWhileOpenManagerV1;

export type HarthmereJobsBoardPointerLockReturnRefV145 =
  PointerLockUnlockWhileOpenReturnRefV1;

export function openHarthmereJobsBoardPointerLockV145(
  pointerLockManager: HarthmereJobsBoardPointerLockLikeV145,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRefV145,
) {
  openPointerLockUnlockWhileOpenV1(
    pointerLockManager,
    shouldReturnPointerLockRef
  );
}

export function closeHarthmereJobsBoardPointerLockV145(
  pointerLockManager: HarthmereJobsBoardPointerLockLikeV145,
  shouldReturnPointerLockRef: HarthmereJobsBoardPointerLockReturnRefV145,
) {
  closePointerLockUnlockWhileOpenV1(
    pointerLockManager,
    shouldReturnPointerLockRef
  );
}
