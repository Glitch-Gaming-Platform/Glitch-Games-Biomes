import { NpcControllerService } from "@/server/anima/npc_controller_service";
import type { LogicApi } from "@/server/shared/api/logic";
import type { NpcTickerTable } from "@/shared/npc/environment";
import { HybridWorldApi } from "@/server/shared/world/hfc/hybrid";
import type { WorldApi } from "@/server/shared/world/api";
import type { ChangeToApply } from "@/shared/api/transaction";
import type { AsDelta, Npc } from "@/shared/ecs/gen/entities";
import type { AnyEvent } from "@/shared/ecs/gen/events";
import type { BiomesId } from "@/shared/ids";
import { AnimaId } from "@/shared/ecs/ids";
import { TickUpdates } from "@/shared/npc/updates";
import type { TypedResources } from "@/shared/resources/types";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

function makeService(
  logicApi: LogicApi,
  worldApi: WorldApi,
  shardIds: () => ReadonlySet<number> = () => new Set(),
  npcsForShard: (shardId: number) => ReadonlySet<BiomesId> | undefined = () =>
    new Set()
) {
  return new NpcControllerService(
    {} as VoxelooModule,
    {} as NpcTickerTable,
    {} as TypedResources<any>,
    shardIds,
    npcsForShard,
    logicApi,
    worldApi
  );
}

function delta(id: number, components: Record<string, unknown> = {}) {
  return { id: id as BiomesId, ...components } as AsDelta<Npc>;
}

describe("Anima NpcControllerService", () => {
  let originalBatchSize: number;
  let originalHfcWrites: string | undefined;
  let originalConfig: typeof globalThis.CONFIG | undefined;

  beforeEach(() => {
    originalConfig = globalThis.CONFIG;
    originalBatchSize = globalThis.CONFIG?.animaNpcTickBatchSize ?? 500;
    globalThis.CONFIG = {
      ...(globalThis.CONFIG ?? ({} as typeof globalThis.CONFIG)),
      animaNpcTickTimeMs: globalThis.CONFIG?.animaNpcTickTimeMs ?? 100,
      animaNpcTickBatchSize: originalBatchSize,
    } as typeof globalThis.CONFIG;
    originalHfcWrites = process.env.ANIMA_HFC_WRITES;
  });

  afterEach(() => {
    if (originalConfig === undefined) {
      delete (globalThis as { CONFIG?: typeof globalThis.CONFIG }).CONFIG;
    } else {
      globalThis.CONFIG = originalConfig;
    }
    if (originalHfcWrites === undefined) {
      delete process.env.ANIMA_HFC_WRITES;
    } else {
      process.env.ANIMA_HFC_WRITES = originalHfcWrites;
    }
  });

  it("chunks NPC state writes and wraps events with the Anima actor id", async () => {
    globalThis.CONFIG.animaNpcTickBatchSize = 2;
    process.env.ANIMA_HFC_WRITES = "0";
    const applied: ChangeToApply[][] = [];
    const published: any[] = [];
    const worldApi = {
      apply: async (changes: ChangeToApply[]) => {
        applied.push(changes);
        return { outcomes: changes.map(() => "success"), changes: [] };
      },
    } as unknown as WorldApi;
    const logicApi: LogicApi = {
      ping: async () => {},
      publish: async (...events) => {
        published.push(...events);
      },
    };
    const service = makeService(logicApi, worldApi);
    const state = [delta(1), delta(2), delta(3)];
    const events = [
      { kind: "baseline-event-one" },
      { kind: "baseline-event-two" },
    ] as unknown as AnyEvent[];

    await (service as any).applyTickUpdates(new TickUpdates(state, events));

    assert.equal(applied.length, 2);
    assert.deepEqual(
      applied.map((batch) => batch.map((transaction) => transaction.iffs)),
      [[[[1]], [[2]]], [[[3]]]]
    );
    assert.deepEqual(
      applied.flatMap((batch) =>
        batch.map((transaction) => transaction.changes?.[0])
      ),
      state.map((entity) => ({ kind: "update", entity }))
    );
    assert.deepEqual(
      published.map((event) => event.userId),
      [AnimaId, AnimaId]
    );
    assert.deepEqual(
      published.map((event) => event.event),
      events
    );
  });

  it("partitions regular and high-frequency components for hybrid world writes", async () => {
    process.env.ANIMA_HFC_WRITES = "1";
    const rcCalls: unknown[] = [];
    const hfcCalls: unknown[] = [];
    const rc = {
      apply: async (changes: unknown) => {
        rcCalls.push(changes);
        return { outcomes: ["success"], changes: [] };
      },
    } as unknown as WorldApi;
    const hfc = {
      apply: async (changes: unknown) => {
        hfcCalls.push(changes);
        return { outcome: "success", changes: [] };
      },
    } as any;
    const logicApi: LogicApi = {
      ping: async () => {},
      publish: async () => {},
    };
    const service = makeService(logicApi, new HybridWorldApi(rc, hfc));
    const state = [
      delta(7, {
        health: { hp: 10, maxHp: 10 },
        position: { v: [1, 2, 3] },
      }),
    ];

    await (service as any).applyTickUpdates(new TickUpdates(state));

    assert.deepEqual(rcCalls, [
      [
        {
          iffs: [[7]],
          changes: [
            {
              kind: "update",
              entity: { id: 7, health: { hp: 10, maxHp: 10 } },
            },
          ],
        },
      ],
    ]);
    assert.deepEqual(hfcCalls, [
      {
        changes: [
          {
            kind: "update",
            entity: { id: 7, position: { v: [1, 2, 3] } },
          },
        ],
      },
    ]);
  });

  it("uses the regular world path and clears stale HFC state when HFC writes are disabled", async () => {
    process.env.ANIMA_HFC_WRITES = "0";
    const rcCalls: unknown[] = [];
    const hfcCalls: unknown[] = [];
    const rc = {
      apply: async (changes: unknown) => {
        rcCalls.push(changes);
        return { outcomes: ["success"], changes: [] };
      },
    } as unknown as WorldApi;
    const hfc = {
      apply: async (changes: unknown) => {
        hfcCalls.push(changes);
        return { outcome: "success", changes: [] };
      },
    } as any;
    const service = makeService(
      { ping: async () => {}, publish: async () => {} },
      new HybridWorldApi(rc, hfc)
    );

    await (service as any).applyTickUpdates(
      new TickUpdates([delta(9, { position: { v: [1, 2, 3] } })])
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(rcCalls.length, 1);
    assert.deepEqual(hfcCalls, [{ changes: [{ kind: "delete", id: 9 }] }]);
  });

  it("attempts state and event delivery independently when either side fails", async () => {
    let stateAttempts = 0;
    let eventAttempts = 0;
    const service = makeService(
      {
        ping: async () => {},
        publish: async () => {
          eventAttempts += 1;
          throw new Error("event failure");
        },
      },
      {
        apply: async () => {
          stateAttempts += 1;
          throw new Error("state failure");
        },
      } as unknown as WorldApi
    );

    await (service as any).applyTickUpdates(
      new TickUpdates(
        [delta(1)],
        [{ kind: "baseline-event" } as unknown as AnyEvent]
      )
    );

    assert.equal(stateAttempts, 1);
    assert.equal(eventAttempts, 1);
  });

  it("commits NPC attack receipts before publishing their damage events", async () => {
    const order: string[] = [];
    let releaseState!: () => void;
    const stateApplied = new Promise<void>((resolve) => {
      releaseState = resolve;
    });
    const service = makeService(
      {
        ping: async () => {},
        publish: async () => {
          order.push("event");
          assert.deepEqual(order, ["state-start", "state-finish", "event"]);
        },
      },
      {
        apply: async () => {
          order.push("state-start");
          await stateApplied;
          order.push("state-finish");
          return { outcomes: ["success"], changes: [] };
        },
      } as unknown as WorldApi
    );

    const pending = (service as any).applyTickUpdates(
      new TickUpdates(
        [delta(1, { npc_state: { data: new Uint8Array([1]) } })],
        [{ kind: "melee-impact" } as unknown as AnyEvent]
      )
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ["state-start"]);
    releaseState();
    await pending;
    assert.deepEqual(order, ["state-start", "state-finish", "event"]);
  });

  it("merges updates from held shards and assigns the shared apply promise", async () => {
    const held = new Set([1, 2]);
    const service = makeService(
      { ping: async () => {}, publish: async () => {} },
      {} as WorldApi,
      () => held
    );
    const contexts = (service as any).shardContexts as Map<number, any>;
    contexts.set(1, {
      npcTicker: {
        tick: async () => new TickUpdates([delta(1)]),
        lastTickDuration: 5,
      },
      pendingApply: undefined,
    });
    contexts.set(2, {
      npcTicker: {
        tick: async () => new TickUpdates([delta(2)]),
        lastTickDuration: 7,
      },
      pendingApply: Promise.resolve(),
    });
    let captured: TickUpdates | undefined;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    (service as any).applyTickUpdates = (updates: TickUpdates) => {
      captured = updates;
      return applyPromise;
    };

    await (service as any).tick();

    assert.deepEqual(captured?.state, [delta(1), delta(2)]);
    assert.strictEqual(contexts.get(1).pendingApply, applyPromise);
    assert.strictEqual(contexts.get(2).pendingApply, applyPromise);
    assert.equal(service.tickDurationForShard(1), 5);
    resolveApply();
    await applyPromise;
  });

  it("starts and stops its repeating timer", async () => {
    const service = makeService(
      { ping: async () => {}, publish: async () => {} },
      {} as WorldApi
    );
    await service.start();
    assert.ok((service as any).tickTimer);
    await service.stop();
    assert.equal((service as any).tickTimer, undefined);
  });

  it("waits for pending shard writes before discarding an unheld shard context", async () => {
    const service = makeService(
      { ping: async () => {}, publish: async () => {} },
      {} as WorldApi
    );
    let resolvePending!: () => void;
    const pendingApply = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    const contexts = (service as any).shardContexts as Map<number, unknown>;
    contexts.set(4, { npcTicker: {}, pendingApply });

    let finished = false;
    const purge = (service as any)
      .purgeUnheldShardEntries(new Set())
      .then(() => {
        finished = true;
      });
    await Promise.resolve();

    assert.equal(finished, false);
    assert.equal(
      contexts.has(4),
      false,
      "the context is no longer schedulable"
    );
    resolvePending();
    await purge;
    assert.equal(finished, true);
  });
});
