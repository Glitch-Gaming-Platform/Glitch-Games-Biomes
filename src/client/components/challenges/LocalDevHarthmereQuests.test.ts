/// <reference types="mocha" />

import assert from "assert";
import { HARTHMERE_BIOMES_ECS_CHALLENGES_UPDATED_EVENT } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";

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

  it("publishes quest writes through the shared Challenges projection", () => {
    const state: HarthmereQuestState = {
      active: { "welcome-to-harthmere": 0 },
      completed: ["read-the-jobs-board"],
    };

    writeHarthmereQuestState(state);

    assert.deepEqual(readHarthmereQuestState(), state);
    const event = dispatchedEvents.find(
      (entry) => entry.type === HARTHMERE_BIOMES_ECS_CHALLENGES_UPDATED_EVENT
    );
    assert.ok(event);
    assert.ok(event.detail.component.in_progress instanceof Set);
    assert.ok(event.detail.component.complete instanceof Set);
    assert.ok(
      event.detail.warnings.some(
        (warning: { id?: string }) => warning.id === "welcome-to-harthmere"
      )
    );
  });
});
