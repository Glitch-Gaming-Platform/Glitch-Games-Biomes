/// <reference types="mocha" />
import assert from "assert";
import {
  readSnapshotCompletePortState,
  SNAPSHOT_COMPLETE_PORT_EVENT,
  writeSnapshotCompletePortState,
} from "./LocalDevSnapshotCompletePort";

describe("snapshot complete port durable writes", () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    const values = new Map<string, string>();
    const eventTarget = new EventTarget() as EventTarget &
      Record<string, unknown>;
    eventTarget.localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    };
    eventTarget.location = {
      hostname: "localhost",
      search: "?install_id=snapshot-write-test",
    };
    (globalThis as any).window = eventTarget;
  });

  afterEach(() => {
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  });

  it("does not dispatch another state-changed event for updatedAt-only echoes", () => {
    let events = 0;
    window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, () => {
      events += 1;
    });
    const state = readSnapshotCompletePortState();

    assert.equal(writeSnapshotCompletePortState(state), true);
    const stored = readSnapshotCompletePortState();
    assert.equal(
      writeSnapshotCompletePortState({ ...stored, updatedAt: Date.now() + 1 }),
      false
    );
    assert.equal(events, 1);
  });
});
