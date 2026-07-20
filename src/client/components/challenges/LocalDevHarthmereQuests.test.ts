/// <reference types="mocha" />

import assert from "assert";

const memoryStore = new Map<string, string>();
const dispatchedEvents: any[] = [];
const localStorageShim = {
  getItem: (key: string) =>
    memoryStore.has(key) ? memoryStore.get(key)! : null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  clear: () => memoryStore.clear(),
};

(globalThis as any).window = {
  localStorage: localStorageShim,
  dispatchEvent: (event: any) => {
    dispatchedEvents.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).localStorage = localStorageShim;
if (typeof (globalThis as any).Event === "undefined") {
  (globalThis as any).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

import {
  readHarthmereQuestState,
  writeHarthmereQuestState,
  type HarthmereQuestState,
} from "@/client/components/challenges/LocalDevHarthmereQuests";

describe("Harthmere quest Biomes ECS projection", () => {
  beforeEach(() => {
    memoryStore.clear();
    dispatchedEvents.length = 0;
    (globalThis as any).window = {
      localStorage: localStorageShim,
      dispatchEvent: (event: any) => {
        dispatchedEvents.push(event);
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).localStorage = localStorageShim;
  });

  it("keeps string-keyed local quests out of native Challenges ECS", () => {
    const state: HarthmereQuestState = {
      active: { "welcome-to-harthmere": 0 },
      completed: ["read-the-jobs-board"],
    };

    writeHarthmereQuestState(state);

    assert.deepEqual(readHarthmereQuestState(), state);
    assert.equal(
      dispatchedEvents.some((entry) =>
        String(entry.type).includes("harthmere-biomes-ecs-challenges")
      ),
      false
    );
  });
});
