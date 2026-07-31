import {
  DEFAULT_TAB_SHORTCUTS,
  installTabShortcuts,
  isReservedGameplayShortcutKey,
} from "@/client/components/biomes_ui/shortcuts/BiomesShortcuts";
import assert from "assert";

class FakeDocument {
  private listener?: (event: KeyboardEvent) => void;

  addEventListener(name: string, listener: (event: KeyboardEvent) => void) {
    if (name === "keydown") this.listener = listener;
  }

  removeEventListener(name: string, listener: (event: KeyboardEvent) => void) {
    if (name === "keydown" && this.listener === listener) {
      this.listener = undefined;
    }
  }

  keydown(key: string) {
    this.listener?.({
      key,
      code: `Key${key.toUpperCase()}`,
      defaultPrevented: false,
      repeat: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault() {},
    } as KeyboardEvent);
  }
}

describe("Biomes UI shortcut contract", () => {
  it("reserves Z, X, and C for crouch, dodge, and evade at runtime", () => {
    assert.equal(isReservedGameplayShortcutKey("z"), true);
    assert.equal(isReservedGameplayShortcutKey("X"), true);
    assert.equal(isReservedGameplayShortcutKey(" c "), true);
    assert.equal(isReservedGameplayShortcutKey("v"), false);

    const previousDocument = globalThis.document;
    const fakeDocument = new FakeDocument();
    (globalThis as { document: Document }).document =
      fakeDocument as unknown as Document;
    try {
      const seen: string[] = [];
      const cleanup = installTabShortcuts(
        [
          { key: "z", label: "Z", tab: "guilds" },
          { key: "x", label: "X", tab: "collections" },
          { key: "c", label: "C", tab: "recovered" },
        ],
        (tab) => seen.push(tab),
        () => false
      );
      fakeDocument.keydown("z");
      fakeDocument.keydown("x");
      fakeDocument.keydown("c");
      cleanup();
      assert.deepEqual(seen, []);
    } finally {
      (globalThis as { document: Document | undefined }).document =
        previousDocument;
    }
  });

  it("moves recovered and collections to bracket keys", () => {
    assert.deepEqual(
      DEFAULT_TAB_SHORTCUTS.filter(
        ({ tab }) => tab === "recovered" || tab === "collections"
      ).map(({ key, tab }) => [key, tab]),
      [
        ["[", "recovered"],
        ["]", "collections"],
      ]
    );
  });
});
