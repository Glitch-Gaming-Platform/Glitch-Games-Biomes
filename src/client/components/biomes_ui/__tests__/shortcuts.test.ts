// Tests for the global tab shortcut installer.

import assert from "assert";
import {
  DEFAULT_TAB_SHORTCUTS,
  installTabShortcuts,
} from "../shortcuts/BiomesShortcuts";
import {
  registerWorldInteractionCandidate,
  resetWorldInteractionDispatcherForTest,
} from "@/client/components/challenges/worldInteractionDispatcher";

function dispatchKey(key: string, opts: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : undefined,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(e);
  return e;
}

describe("BiomesUI tab shortcuts", () => {
  // The mocha+jsdom setup is shared across tests in src/. If jsdom isn't
  // present at runtime, skip cleanly so this file doesn't crash the suite.
  before(function () {
    if (typeof document === "undefined") {
      // eslint-disable-next-line no-invalid-this
      this.skip();
    }
  });

  afterEach(() => resetWorldInteractionDispatcherForTest());

  it("toggles the matched tab when its key is pressed", () => {
    const seen: string[] = [];
    const cleanup = installTabShortcuts(
      DEFAULT_TAB_SHORTCUTS,
      (t) => {
        seen.push(t);
      },
      () => false
    );
    dispatchKey("i");
    dispatchKey("p");
    dispatchKey("m");
    dispatchKey(",");
    cleanup();
    assert.deepEqual(seen, ["inventory", "farming", "map", "options"]);
  });

  it("ignores keys when isTypingInInput is true (chat protection)", () => {
    const seen: string[] = [];
    const cleanup = installTabShortcuts(
      DEFAULT_TAB_SHORTCUTS,
      (t) => {
        seen.push(t);
      },
      () => true
    );
    dispatchKey("i");
    cleanup();
    assert.deepEqual(seen, []);
  });

  it("ignores Cmd/Ctrl/Alt-modified keys (preserves browser shortcuts)", () => {
    const seen: string[] = [];
    const cleanup = installTabShortcuts(
      DEFAULT_TAB_SHORTCUTS,
      (t) => {
        seen.push(t);
      },
      () => false
    );
    dispatchKey("i", { ctrlKey: true });
    dispatchKey("m", { metaKey: true });
    dispatchKey("o", { altKey: true });
    cleanup();
    assert.deepEqual(seen, []);
  });

  it("cleanup removes the listener", () => {
    const seen: string[] = [];
    const cleanup = installTabShortcuts(
      DEFAULT_TAB_SHORTCUTS,
      (t) => {
        seen.push(t);
      },
      () => false
    );
    cleanup();
    dispatchKey("i");
    assert.deepEqual(seen, []);
  });

  it("lets a visible world Settings action own G before the Guilds tab", () => {
    const seen: string[] = [];
    registerWorldInteractionCandidate({
      id: "robot-settings",
      priority: 100,
      keyCodes: ["KeyG"],
      onInteract: () => undefined,
    });
    const cleanup = installTabShortcuts(
      DEFAULT_TAB_SHORTCUTS,
      (tab) => seen.push(tab),
      () => false
    );

    dispatchKey("g");
    cleanup();
    assert.deepEqual(seen, []);
  });
});
