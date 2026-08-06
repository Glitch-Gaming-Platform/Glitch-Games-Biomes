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
  it("reserves Z, E, and Q for crouch, dodge, and evade at runtime", () => {
    assert.equal(isReservedGameplayShortcutKey("z"), true);
    assert.equal(isReservedGameplayShortcutKey("E"), true);
    assert.equal(isReservedGameplayShortcutKey(" q "), true);
    assert.equal(isReservedGameplayShortcutKey("x"), false);
    assert.equal(isReservedGameplayShortcutKey("c"), false);
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
          { key: "e", label: "E", tab: "collections" },
          { key: "q", label: "Q", tab: "recovered" },
        ],
        (tab) => seen.push(tab),
        () => false
      );
      fakeDocument.keydown("z");
      fakeDocument.keydown("e");
      fakeDocument.keydown("q");
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
