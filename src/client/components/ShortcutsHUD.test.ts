import { shouldFocusAndLockForGameplayMovementKey } from "@/client/components/shortcutsHudMovementFocus";
import assert from "assert";

describe("ShortcutsHUD gameplay movement focus recovery", () => {
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
