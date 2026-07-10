import assert from "assert";
import {
  GlitchCloudSaveAdapter,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  RestDatabaseAdapter,
  type BlobSaveTransport,
  type KeyValueTransport,
  type WebStorageLike,
} from "../adapters";
import { LayeredStorage } from "../layered_storage";
import type { StorageAdapter } from "../types";

// ---- Test doubles ---------------------------------------------------------

/** A minimal in-memory Web Storage, optionally configured to throw (blocked). */
class FakeWebStorage implements WebStorageLike {
  private readonly map = new Map<string, string>();
  constructor(private readonly blocked = false) {}
  getItem(key: string): string | null {
    if (this.blocked) throw new Error("SecurityError");
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.blocked) throw new Error("SecurityError");
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    if (this.blocked) throw new Error("SecurityError");
    this.map.delete(key);
  }
  key(index: number): string | null {
    if (this.blocked) throw new Error("SecurityError");
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    if (this.blocked) throw new Error("SecurityError");
    return this.map.size;
  }
}

function flush(): Promise<void> {
  // Let queued microtasks (fire-and-forget write-through) settle.
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---- MemoryStorageAdapter -------------------------------------------------

describe("MemoryStorageAdapter", () => {
  it("stores, reads, lists and clears", async () => {
    const a = new MemoryStorageAdapter();
    assert.equal(await a.isAvailable(), true);
    assert.equal(a.durable, false);
    assert.equal(await a.get("k"), null);
    await a.set("k", "v");
    assert.equal(await a.get("k"), "v");
    assert.deepEqual(await a.keys(), ["k"]);
    await a.remove("k");
    assert.equal(await a.get("k"), null);
    await a.set("x", "1");
    await a.clear();
    assert.deepEqual(await a.keys(), []);
  });
});

// ---- LocalStorageAdapter --------------------------------------------------

describe("LocalStorageAdapter", () => {
  it("uses the backing store when available", async () => {
    const a = new LocalStorageAdapter(new FakeWebStorage());
    assert.equal(await a.isAvailable(), true);
    await a.set("k", "v");
    assert.equal(await a.get("k"), "v");
    assert.deepEqual(await a.keys(), ["k"]);
  });

  it("reports unavailable and never throws when storage is blocked", async () => {
    const a = new LocalStorageAdapter(new FakeWebStorage(true));
    assert.equal(await a.isAvailable(), false);
    // None of these should throw despite the backing store throwing.
    await a.set("k", "v");
    assert.equal(await a.get("k"), null);
    assert.deepEqual(await a.keys(), []);
    await a.remove("k");
    await a.clear();
  });

  it("respects a keyPredicate for keys()/clear()", async () => {
    const backing = new FakeWebStorage();
    backing.setItem("mine:1", "a");
    backing.setItem("other", "b");
    const a = new LocalStorageAdapter(backing, {
      keyPredicate: (k) => k.startsWith("mine:"),
    });
    assert.deepEqual(await a.keys(), ["mine:1"]);
    await a.clear();
    assert.equal(backing.getItem("mine:1"), null);
    assert.equal(backing.getItem("other"), "b"); // untouched
  });
});

// ---- GlitchCloudSaveAdapter ----------------------------------------------

describe("GlitchCloudSaveAdapter", () => {
  function makeTransport(initial: Record<string, string> | null = null) {
    const state = { stored: initial, storeCalls: 0, ready: true };
    const transport: BlobSaveTransport = {
      isReady: async () => state.ready,
      load: async () => state.stored,
      store: async (snap) => {
        state.storeCalls++;
        state.stored = { ...snap };
      },
    };
    return { transport, state };
  }

  it("loads an existing blob and serves per-key reads", async () => {
    const { transport } = makeTransport({ a: "1", b: "2" });
    const adapter = new GlitchCloudSaveAdapter(transport, { debounceMs: 5 });
    assert.equal(await adapter.get("a"), "1");
    assert.equal(await adapter.get("missing"), null);
    assert.deepEqual((await adapter.keys()).sort(), ["a", "b"]);
  });

  it("debounces a burst of writes into one snapshot store", async () => {
    const { transport, state } = makeTransport({});
    const adapter = new GlitchCloudSaveAdapter(transport, { debounceMs: 5 });
    await adapter.set("a", "1");
    await adapter.set("b", "2");
    await adapter.set("c", "3");
    assert.equal(state.storeCalls, 0, "not stored yet (debounced)");
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(state.storeCalls, 1, "one coalesced store");
    assert.deepEqual(state.stored, { a: "1", b: "2", c: "3" });
  });

  it("isAvailable follows transport readiness and never throws", async () => {
    const transport: BlobSaveTransport = {
      isReady: async () => {
        throw new Error("boom");
      },
      load: async () => null,
      store: async () => undefined,
    };
    const adapter = new GlitchCloudSaveAdapter(transport);
    assert.equal(await adapter.isAvailable(), false);
  });
});

// ---- RestDatabaseAdapter --------------------------------------------------

describe("RestDatabaseAdapter", () => {
  it("passes through to the transport and swallows transport errors", async () => {
    const db = new Map<string, string>();
    const transport: KeyValueTransport = {
      isReady: async () => true,
      get: async (k) => db.get(k) ?? null,
      set: async (k, v) => void db.set(k, v),
      remove: async (k) => void db.delete(k),
      keys: async () => [...db.keys()],
    };
    const a = new RestDatabaseAdapter(transport);
    await a.set("k", "v");
    assert.equal(await a.get("k"), "v");
    assert.deepEqual(await a.keys(), ["k"]);
    await a.clear();
    assert.deepEqual(await a.keys(), []);

    const boom: KeyValueTransport = {
      isReady: async () => true,
      get: async () => {
        throw new Error("net");
      },
      set: async () => {
        throw new Error("net");
      },
      remove: async () => undefined,
      keys: async () => {
        throw new Error("net");
      },
    };
    const b = new RestDatabaseAdapter(boom);
    assert.equal(await b.get("k"), null); // never throws
    await b.set("k", "v"); // never throws
    assert.deepEqual(await b.keys(), []);
  });
});

// ---- LayeredStorage -------------------------------------------------------

describe("LayeredStorage", () => {
  it("serves synchronous reads from the localStorage mirror immediately", () => {
    const mirror = new FakeWebStorage();
    mirror.setItem("k", "persisted");
    const store = new LayeredStorage([new MemoryStorageAdapter()], {
      syncMirror: mirror,
    });
    // No hydrate() yet: value still available synchronously via the mirror.
    assert.equal(store.getItem("k"), "persisted");
  });

  it("writes through to the mirror and to async adapters", async () => {
    const mirror = new FakeWebStorage();
    const adapter = new MemoryStorageAdapter();
    const store = new LayeredStorage([adapter], { syncMirror: mirror });
    store.setItem("k", "v");
    assert.equal(store.getItem("k"), "v"); // cache
    assert.equal(mirror.getItem("k"), "v"); // sync mirror
    await flush();
    assert.equal(await adapter.get("k"), "v"); // async adapter
  });

  it("treats an available mirror as authoritative over a stale cache", () => {
    const mirror = new FakeWebStorage();
    const store = new LayeredStorage([new MemoryStorageAdapter()], {
      syncMirror: mirror,
    });
    store.setItem("k", "cached");

    mirror.setItem("k", "external-update");
    assert.equal(store.getItem("k"), "external-update");

    mirror.removeItem("k");
    assert.equal(store.getItem("k"), null);
  });

  it("keeps working when the mirror is blocked (iframe)", async () => {
    const blocked = new FakeWebStorage(true);
    const adapter = new MemoryStorageAdapter();
    const store = new LayeredStorage([adapter], { syncMirror: blocked });
    // Must not throw even though every mirror call throws.
    store.setItem("k", "v");
    assert.equal(store.getItem("k"), "v"); // from in-memory cache
    await flush();
    assert.equal(await adapter.get("k"), "v"); // persisted to the async adapter
  });

  it("hydrates from adapters with highest-priority winning on conflict", async () => {
    const high = new MemoryStorageAdapter();
    const low = new MemoryStorageAdapter();
    await high.set("shared", "HIGH");
    await high.set("onlyHigh", "h");
    await low.set("shared", "LOW");
    await low.set("onlyLow", "l");
    // Priority = order; `high` first.
    const store = new LayeredStorage([high, low]);
    await store.hydrate();
    assert.equal(store.getItem("shared"), "HIGH");
    assert.equal(store.getItem("onlyHigh"), "h");
    assert.equal(store.getItem("onlyLow"), "l");
  });

  it("skips unavailable adapters on hydrate and write", async () => {
    const down: StorageAdapter = {
      name: "down",
      durable: true,
      isAvailable: async () => false,
      get: async () => {
        throw new Error("should not be read");
      },
      set: async () => {
        throw new Error("should not be written");
      },
      remove: async () => undefined,
      keys: async () => {
        throw new Error("should not be listed");
      },
      clear: async () => undefined,
    };
    const up = new MemoryStorageAdapter();
    const store = new LayeredStorage([down, up]);
    await store.hydrate(); // must not throw despite `down` throwing if used
    store.setItem("k", "v");
    await flush();
    assert.equal(await up.get("k"), "v");
  });

  it("namespaces keys in the backends", async () => {
    const mirror = new FakeWebStorage();
    const store = new LayeredStorage([new MemoryStorageAdapter()], {
      namespace: "user42",
      syncMirror: mirror,
    });
    store.setItem("stamina", "100");
    assert.equal(mirror.getItem("user42:stamina"), "100");
    assert.equal(store.getItem("stamina"), "100");
  });

  it("clear() only removes owned keys from the mirror", () => {
    const mirror = new FakeWebStorage();
    mirror.setItem("unrelated", "keep");
    const store = new LayeredStorage([new MemoryStorageAdapter()], {
      syncMirror: mirror,
    });
    store.setItem("a", "1");
    store.setItem("b", "2");
    store.clear();
    assert.equal(store.length, 0);
    assert.equal(mirror.getItem("a"), null);
    assert.equal(mirror.getItem("unrelated"), "keep"); // untouched
  });

  it("asLocalStorage() exposes a working Web Storage shape", () => {
    const store = new LayeredStorage([new MemoryStorageAdapter()], {
      syncMirror: new FakeWebStorage(),
    });
    const ls = store.asLocalStorage();
    ls.setItem("a", "1");
    ls.setItem("b", "2");
    assert.equal(ls.getItem("a"), "1");
    assert.equal(ls.length, 2);
    assert.ok(["a", "b"].includes(ls.key(0) as string));
    ls.removeItem("a");
    assert.equal(ls.getItem("a"), null);
    assert.equal(ls.length, 1);
    ls.clear();
    assert.equal(ls.length, 0);
  });

  it("throws only for a genuinely empty adapter list", () => {
    assert.throws(() => new LayeredStorage([]));
  });
});
