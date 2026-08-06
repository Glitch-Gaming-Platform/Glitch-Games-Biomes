const GAMEPLAY_MOVEMENT_FOCUS_KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyZ",
  "KeyE",
  "KeyQ",
]);

export function shouldFocusAndLockForGameplayMovementKey(input: {
  code: string;
  modalKind: string;
  inInputElement: boolean;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  pointerLocked: boolean;
}) {
  if (
    input.repeat ||
    input.inInputElement ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey ||
    input.pointerLocked
  ) {
    return false;
  }
  if (!GAMEPLAY_MOVEMENT_FOCUS_KEY_CODES.has(input.code)) {
    return false;
  }
  return input.modalKind === "empty" || input.modalKind === "tabbed_pause";
}
