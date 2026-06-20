/// <reference types="mocha" />

import assert from "assert";
import {
  readBiomesUIReplaceLegacyFlag,
  setBiomesUIReplaceLegacyFlag,
} from "../BiomesUIFlags";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

describe("BiomesUI replacement source of truth", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalEvent = Object.getOwnPropertyDescriptor(globalThis, "Event");

  beforeEach(() => {
    const localStorage = new MemoryStorage();
    if (typeof (globalThis as any).Event === "undefined") {
      Object.defineProperty(globalThis, "Event", {
        configurable: true,
        value: class {
          constructor(public type: string) {}
        },
      });
    }
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        dispatchEvent: () => true,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (originalEvent) {
      Object.defineProperty(globalThis, "Event", originalEvent);
    } else {
      delete (globalThis as { Event?: unknown }).Event;
    }
  });

  it("ignores stale false flags so legacy UI cannot become a second authority", () => {
    window.localStorage.setItem("biomes_ui_replace_legacy", "0");
    assert.equal(readBiomesUIReplaceLegacyFlag(), true);

    setBiomesUIReplaceLegacyFlag(false);
    assert.equal(window.localStorage.getItem("biomes_ui_replace_legacy"), "1");
    assert.equal(readBiomesUIReplaceLegacyFlag(), true);
  });
});
