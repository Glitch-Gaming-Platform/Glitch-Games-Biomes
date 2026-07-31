import { LazyEntity, LazyEntityDelta } from "@/server/shared/ecs/gen/lazy";
import { makeLazyChange } from "@/server/shared/ecs/lazy";
import {
  type LeaderboardApi,
  type SubscriptionConfig,
  WorldApi,
  type WorldUpdate,
} from "@/server/shared/world/api";
import {
  WorldEditConflictError,
  WorldEditor,
} from "@/server/shared/world/editor";
import { FilterContext } from "@/server/shared/world/filter_context";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { batchedGet, readWorldChanges } from "@/server/shared/world/util";
import type { ApplyStatus, ChangeToApply } from "@/shared/api/transaction";
import { materializeLazyChange } from "@/server/shared/ecs/lazy";
import type { FirehoseEvent } from "@/shared/firehose/events";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const ID_A = 701 as BiomesId;
const ID_B = 702 as BiomesId;

class TestWorldApi extends WorldApi {
  readonly states = new Map<BiomesId, [number, LazyEntity | undefined]>();
  readonly gets: BiomesId[][] = [];
  readonly applies: ChangeToApply[][] = [];
  nextOutcomes: ApplyStatus[] = ["success"];
  updates: WorldUpdate[] = [];

  async healthy() {
    return true;
  }

  leaderboard(): LeaderboardApi {
    return {} as LeaderboardApi;
  }

  subscribe(config: SubscriptionConfig = {}) {
    void config;
    const updates = this.updates;
    return (async function* () {
      yield* updates;
    })() as ReturnType<WorldApi["subscribe"]>;
  }

  protected async _getWithVersion(ids: BiomesId[]) {
    this.gets.push(ids);
    return ids.map<[number, LazyEntity | undefined]>(
      (id) => this.states.get(id) ?? [0, undefined]
    );
  }

  protected async _apply(changesToApply: ChangeToApply[]) {
    this.applies.push(changesToApply);
    return { outcomes: this.nextOutcomes, changes: [] };
  }
}

describe("native ECS WorldApi base contracts", () => {
  it("normalizes single, batch, empty, and existence reads", async () => {
    const world = new TestWorldApi();
    world.states.set(ID_A, [3, LazyEntity.forDecoded({ id: ID_A })]);

    assert.equal((await world.get(ID_A))?.id, ID_A);
    assert.deepEqual(
      (await world.get([ID_A, ID_B])).map((entity) => entity?.id),
      [ID_A, undefined]
    );
    assert.deepEqual(await world.get([]), []);
    assert.deepEqual(await world.getWithVersion(ID_A), world.states.get(ID_A));
    assert.deepEqual(await world.getWithVersion([]), []);
    assert.equal(await world.has(ID_A), ID_A);
    assert.equal(await world.has(ID_B), undefined);
    assert.deepEqual(await world.has([ID_A, ID_B]), [ID_A]);
  });

  it("normalizes single, batch, and empty applies and creates editors", async () => {
    const world = new TestWorldApi();
    const change: ChangeToApply = {
      changes: [{ kind: "delete", id: ID_A }],
    };

    assert.deepEqual(await world.apply(change), {
      outcome: "success",
      changes: [],
    });
    world.nextOutcomes = ["success", "aborted"];
    assert.deepEqual(await world.apply([change, change]), {
      outcomes: ["success", "aborted"],
      changes: [],
    });
    assert.deepEqual(await world.apply([]), { outcomes: [], changes: [] });
    assert.ok(world.edit() instanceof WorldEditor);
    await world.stop();
  });
});

describe("native ECS WorldEditor", () => {
  it("caches reads and commits component-aware updates", async () => {
    const world = new TestWorldApi();
    world.states.set(ID_A, [
      7,
      LazyEntity.forDecoded({
        id: ID_A,
        label: { text: "before" },
        position: { v: [1, 2, 3] },
      }),
    ]);
    const editor = new WorldEditor(world);

    const first = await editor.get(ID_A);
    const second = await editor.get(ID_A);
    assert.strictEqual(first, second);
    assert.equal(world.gets.length, 1);
    assert.equal(first?.label()?.text, "before");
    first!.mutableLabel().text = "after";
    await editor.commit();

    assert.equal(world.applies.length, 1);
    const transaction = world.applies[0][0];
    assert.equal(transaction.iffs?.[0][0], ID_A);
    assert.equal(transaction.iffs?.[0][1], 7);
    assert.ok((transaction.iffs?.[0].length ?? 0) > 2);
    assert.deepEqual(transaction.changes, [
      {
        kind: "update",
        entity: { id: ID_A, label: { text: "after" } },
      },
    ]);
  });

  it("creates absent entities with an existence iff and skips read-only commits", async () => {
    const world = new TestWorldApi();
    world.states.set(ID_A, [
      4,
      LazyEntity.forDecoded({ id: ID_A, label: { text: "A" } }),
    ]);

    const readOnly = new WorldEditor(world);
    assert.equal((await readOnly.get(ID_A))?.label()?.text, "A");
    await readOnly.commit();
    assert.equal(world.applies.length, 0);

    const create = new WorldEditor(world);
    assert.equal(await create.get(ID_B), undefined);
    create.create({ id: ID_B, label: { text: "new" } });
    await create.commit();
    assert.deepEqual(world.applies[0][0], {
      iffs: [[ID_B, 0]],
      changes: [
        {
          kind: "create",
          entity: { id: ID_B, label: { text: "new" } },
        },
      ],
    });
  });

  it("rejects duplicate creation and translates aborted applies into conflicts", async () => {
    const world = new TestWorldApi();
    world.states.set(ID_A, [1, LazyEntity.forDecoded({ id: ID_A })]);
    const duplicate = new WorldEditor(world);
    await duplicate.get(ID_A);
    assert.throws(() => duplicate.create({ id: ID_A }), /already fetched/);

    const conflict = new WorldEditor(world);
    conflict.create({ id: ID_B });
    world.nextOutcomes = ["aborted"];
    await assert.rejects(() => conflict.commit(), WorldEditConflictError);
  });
});

describe("native ECS filter context", () => {
  function redisWith(response: Array<[number, LazyEntity | undefined]>) {
    return {
      ecs: {
        filteredGet: async () => response,
      },
    } as any;
  }

  it("tracks create, unaffected update, exclusion, re-inclusion, delete, and clear transitions", async () => {
    const initial = LazyEntity.forDecoded({ id: ID_A, label: { text: "A" } });
    const context = new FilterContext(redisWith([]), { anyOf: ["label"] });

    assert.deepEqual(
      (
        await context.process([{ kind: "create", tick: 1, entity: initial }])
      ).map(materializeLazyChange),
      [{ kind: "create", tick: 1, entity: { id: ID_A, label: { text: "A" } } }]
    );

    const unaffected = {
      kind: "update",
      tick: 2,
      entity: LazyEntityDelta.forDecoded({
        id: ID_A,
        position: { v: [1, 2, 3] },
      }),
    } as const;
    assert.deepEqual(context.filter([unaffected]), [unaffected]);
    assert.deepEqual(await context.process([unaffected]), [unaffected]);

    const removal = {
      kind: "update",
      tick: 3,
      entity: LazyEntityDelta.forDecoded({ id: ID_A, label: null }),
    } as const;
    (context as any).redis = redisWith([[3, undefined]]);
    assert.deepEqual(
      (await context.process([removal])).map(materializeLazyChange),
      [{ kind: "delete", tick: 3, id: ID_A }]
    );
    assert.deepEqual(context.filter([unaffected]), []);

    const addition = {
      kind: "update",
      tick: 4,
      entity: LazyEntityDelta.forDecoded({
        id: ID_A,
        label: { text: "back" },
      }),
    } as const;
    (context as any).redis = redisWith([
      [4, LazyEntity.forDecoded({ id: ID_A, label: { text: "back" } })],
    ]);
    assert.deepEqual(
      (await context.process([addition])).map(materializeLazyChange),
      [
        {
          kind: "create",
          tick: 4,
          entity: { id: ID_A, label: { text: "back" } },
        },
      ]
    );
    assert.deepEqual(
      await context.process([{ kind: "delete", tick: 5, id: ID_A }]),
      [{ kind: "delete", tick: 5, id: ID_A }]
    );
    assert.deepEqual(
      await context.process([{ kind: "delete", tick: 6, id: ID_A }]),
      []
    );
    context.clear();
    assert.deepEqual(context.filter([unaffected]), []);
  });
});

describe("native ECS world utility helpers", () => {
  it("reads and merges a finite bootstrap stream while dropping tombstones", async () => {
    const world = new TestWorldApi();
    world.updates = [
      {
        changes: [
          makeLazyChange({
            kind: "create",
            tick: 1,
            entity: { id: ID_A, label: { text: "before" } },
          }),
          makeLazyChange({ kind: "delete", tick: 1, id: ID_B }),
        ],
      },
      {
        changes: [
          makeLazyChange({
            kind: "update",
            tick: 2,
            entity: { id: ID_A, label: { text: "after" } },
          }),
        ],
        bootstrapped: true,
      },
    ];

    assert.deepEqual(
      (await readWorldChanges(world, new AbortController().signal)).map(
        materializeLazyChange
      ),
      [
        {
          kind: "create",
          tick: 2,
          entity: { id: ID_A, label: { text: "after" } },
        },
      ]
    );

    const aborted = new AbortController();
    aborted.abort();
    assert.deepEqual(await readWorldChanges(world, aborted.signal), []);
  });

  it("gets entities in 1000-item batches and stops before work when aborted", async () => {
    const world = new TestWorldApi();
    const ids = Array.from({ length: 2005 }, (_, i) => (i + 1) as BiomesId);
    for (const id of ids) {
      world.states.set(id, [1, LazyEntity.forDecoded({ id })]);
    }
    assert.equal(
      (await batchedGet(world, ids, new AbortController().signal)).length,
      ids.length
    );
    assert.deepEqual(
      world.gets.map((batch) => batch.length),
      [1000, 1000, 5]
    );

    const aborted = new AbortController();
    aborted.abort();
    assert.deepEqual(await batchedGet(world, ids, aborted.signal), []);
  });
});

describe("native ECS in-memory transaction authority", () => {
  it("applies successful transactions in order and suppresses aborted changes and events", () => {
    const world = new InMemoryWorld(false);
    const emittedChanges: unknown[] = [];
    const emittedEvents: FirehoseEvent[][] = [];
    world.on("tick", (changes) => emittedChanges.push(changes));
    world.on("events", (events) => emittedEvents.push(events));

    const event = {
      kind: "challengeUnlocked",
      entityId: ID_A,
      challenge: ID_B,
    } as FirehoseEvent;
    const [outcomes] = world.apply([
      {
        iffs: [[ID_A, 0]],
        changes: [
          { kind: "create", entity: { id: ID_A, label: { text: "first" } } },
        ],
        events: [event],
      },
      {
        iffs: [[ID_A, 0]],
        changes: [
          { kind: "update", entity: { id: ID_A, label: { text: "wrong" } } },
        ],
        events: [event],
      },
    ]);

    assert.deepEqual(outcomes, ["success", "aborted"]);
    assert.equal(world.table.get(ID_A)?.label?.text, "first");
    assert.equal(emittedChanges.length, 1);
    assert.deepEqual(emittedEvents, [[event]]);
  });

  it("returns catch-up state when an optimistic component iff conflicts", () => {
    const world = new InMemoryWorld(false);
    world.applyChanges([
      { kind: "create", entity: { id: ID_A, label: { text: "one" } } },
    ]);
    const oldTick = world.table.tick;
    world.applyChanges([
      { kind: "update", entity: { id: ID_A, label: { text: "two" } } },
    ]);

    const [outcomes, catchups] = world.apply([
      {
        iffs: [[ID_A, oldTick, 37]],
        catchups: [[ID_A, oldTick]],
        changes: [
          { kind: "update", entity: { id: ID_A, label: { text: "three" } } },
        ],
      },
    ]);

    assert.deepEqual(outcomes, ["aborted"]);
    assert.equal(catchups.length, 1);
    assert.deepEqual(catchups[0].change, {
      kind: "update",
      tick: world.table.tick,
      entity: { id: ID_A, label: { text: "two" } },
    });
  });
});
