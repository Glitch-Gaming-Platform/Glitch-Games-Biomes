import { shortcutsHUDHandlesKeyForModeForTest } from "@/client/components/shortcutsHudKeyOwnership";
import { biomesUITabForKeyboardCodeForTest } from "@/client/components/biomes_ui/shortcuts/BiomesUIKeyRouting";
import { shouldFocusAndLockForGameplayMovementKey } from "@/client/components/shortcutsHudMovementFocus";
import assert from "assert";

describe("ShortcutsHUD gameplay movement focus recovery", () => {
  it("keeps native Recipes and movement focus recovery active behind replacement BiomesUI", () => {
    assert.equal(
      biomesUITabForKeyboardCodeForTest("KeyR"),
      undefined,
      "the replacement rail must not capture R before native Recipes"
    );
    assert.equal(biomesUITabForKeyboardCodeForTest("KeyJ"), "quests");
    assert.equal(biomesUITabForKeyboardCodeForTest("KeyG"), "guilds");
    assert.equal(
      biomesUITabForKeyboardCodeForTest("KeyG", true),
      undefined,
      "a visible robot Settings prompt must own G before the Guilds tab"
    );
    assert.equal(shortcutsHUDHandlesKeyForModeForTest("KeyR", true), true);
    for (const code of [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "ShiftLeft",
      "ShiftRight",
    ]) {
      assert.equal(
        shortcutsHUDHandlesKeyForModeForTest(code, true),
        true,
        `${code} must still reach the pointer-lock recovery path`
      );
    }
    for (const code of ["KeyE", "KeyI", "KeyM", "KeyC", "KeyV", "KeyO"]) {
      assert.equal(shortcutsHUDHandlesKeyForModeForTest(code, true), false);
    }
    assert.equal(shortcutsHUDHandlesKeyForModeForTest("KeyE", false), true);
  });

  it("relocks gameplay when movement starts from an unfocused empty game view", () => {
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        code: "KeyW",
        modalKind: "empty",
        inInputElement: false,
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        pointerLocked: false,
      }),
      true
    );
  });

  it("keeps the existing tabbed pause recovery path for movement keys", () => {
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        code: "KeyA",
        modalKind: "tabbed_pause",
        inInputElement: false,
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        pointerLocked: false,
      }),
      true
    );
  });

  it("does not steal focus from dialogue, other modals, inputs, modifiers, or repeats", () => {
    const base = {
      code: "KeyW",
      modalKind: "talk_to_npc",
      inInputElement: false,
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      pointerLocked: false,
    };

    assert.equal(shouldFocusAndLockForGameplayMovementKey(base), false);
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        ...base,
        modalKind: "empty",
        inInputElement: true,
      }),
      false
    );
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        ...base,
        modalKind: "empty",
        repeat: true,
      }),
      false
    );
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        ...base,
        modalKind: "empty",
        altKey: true,
      }),
      false
    );
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        ...base,
        modalKind: "empty",
        pointerLocked: true,
      }),
      false
    );
  });

  it("ignores non-movement HUD keys", () => {
    assert.equal(
      shouldFocusAndLockForGameplayMovementKey({
        code: "KeyI",
        modalKind: "empty",
        inInputElement: false,
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        pointerLocked: false,
      }),
      false
    );
  });
});
