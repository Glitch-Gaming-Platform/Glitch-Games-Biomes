const GAMEPLAY_MOVEMENT_FOCUS_KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyZ",
  "KeyX",
  "KeyC",
]);

/**
 * Replacement BiomesUI owns its tab shortcuts at capture phase, but the
 * original Recipes/handcraft modal still owns R. ShortcutsHUD must also keep
 * observing gameplay movement keys so an unlocked or unfocused game can
 * reacquire pointer lock after a rejoin. Keep this rule data-only so the fast
 * test suite can verify it without importing HUD image assets.
 */
export function shortcutsHUDHandlesKeyForModeForTest(
  code: string,
  recipesOnly: boolean
) {
  return (
    !recipesOnly ||
    code === "KeyR" ||
    GAMEPLAY_MOVEMENT_FOCUS_KEY_CODES.has(code)
  );
}
