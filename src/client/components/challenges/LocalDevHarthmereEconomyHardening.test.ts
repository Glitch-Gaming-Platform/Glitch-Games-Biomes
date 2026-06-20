import assert from "assert";
import {
  applyHarthmereLocalDevTownEconomyImpact,
  HARTHMERE_LOCAL_DEV_STATE_KEYS,
} from "@/client/components/challenges/LocalDevHarthmereEconomyHardening";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

describe("Harthmere local-dev economy hardening", () => {
  let localStorage: MemoryStorage;
  let dispatched: string[];

  beforeEach(() => {
    localStorage = new MemoryStorage();
    dispatched = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        localStorage,
        dispatchEvent: (event: Event) => {
          dispatched.push(event.type);
          return true;
        },
      },
    });
    if (typeof globalThis.CustomEvent === "undefined") {
      Object.defineProperty(globalThis, "CustomEvent", {
        configurable: true,
        value: class TestCustomEvent<T = unknown> extends Event {
          readonly detail: T | undefined;

          constructor(type: string, init?: CustomEventInit<T>) {
            super(type);
            this.detail = init?.detail;
          }
        },
      });
    }
  });

  it("centralizes quest town-economy impact writes through one economy key", () => {
    localStorage.setItem(
      HARTHMERE_LOCAL_DEV_STATE_KEYS.economy,
      JSON.stringify({
        town: { wealth: 4, security: 2, crimeRate: 1 },
        recent: [],
      })
    );

    applyHarthmereLocalDevTownEconomyImpact({
      sourceId: "welcome-to-harthmere",
      deltas: { wealth: 2, security: 1, crimeRate: -3 },
      label: "Quest Economy Impact",
      detail: "quest updated town economy",
      reason: "quest_completion",
    });

    const next = JSON.parse(
      localStorage.getItem(HARTHMERE_LOCAL_DEV_STATE_KEYS.economy) ?? "{}"
    );
    assert.deepEqual(next.town, { wealth: 6, security: 3, crimeRate: 0 });
    assert.equal(next.recent[0].sourceId, "welcome-to-harthmere");
    assert.deepEqual(dispatched, ["biomes:harthmere-economy-changed"]);
  });
});
