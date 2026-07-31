import { LazyReplica } from "@/server/shared/replica/lazy_table";
import { Replica, materializeEcs } from "@/server/shared/replica/table";
import { centerOfTerrain } from "@/server/shared/replica/util";
import type {
  SubscriptionConfig,
  WorldApi,
  WorldUpdate,
} from "@/server/shared/world/api";
import { makeLazyChange } from "@/server/shared/ecs/lazy";
import { Box, ShardSeed } from "@/shared/ecs/gen/components";
import { createTable } from "@/shared/ecs/table";
import type { BiomesId } from "@/shared/ids";
import { nextImmediate } from "@/shared/util/async";
import assert from "assert";

const ID_A = 501 as BiomesId;

function worldWithUpdates(
  updates: WorldUpdate[],
  subscriptions: SubscriptionConfig[] = []
) {
  return {
    subscribe: (config: SubscriptionConfig = {}) => {
      subscriptions.push(config);
      return (async function* () {
        yield* updates;
      })();
    },
  } as unknown as WorldApi;
}

describe("native ECS Replica", () => {
  it("subscribes with its filter, materializes lazy changes, indexes state, and emits ticks", async () => {
    const subscriptions: SubscriptionConfig[] = [];
    const change = {
      kind: "create",
      tick: 3,
      entity: { id: ID_A, label: { text: "replicated" } },
    } as const;
    const replica = new Replica(
      "test-replica",
      worldWithUpdates(
        [{ changes: [makeLazyChange(change)], bootstrapped: true }],
        subscriptions
      ),
      { filter: { anyOf: ["label"] } }
    );
    const ticks: unknown[] = [];
    replica.on("tick", (changes) => ticks.push(changes));

    await replica.start();
    try {
      await nextImmediate();
      assert.deepEqual(subscriptions, [{ filter: { anyOf: ["label"] } }]);
      assert.deepEqual(replica.table.get(ID_A), change.entity);
      assert.deepEqual(ticks, [[change]]);
    } finally {
      await replica.stop();
    }
  });

  it("emits only effective local-only updates", async () => {
    const replica = new Replica("local-replica", worldWithUpdates([]), {});
    const ticks: unknown[] = [];
    replica.on("tick", (changes) => ticks.push(changes));
    const create = {
      kind: "create",
      tick: 5,
      entity: { id: ID_A, label: { text: "local" } },
    } as const;

    replica.localOnlyUpdate([create]);
    replica.localOnlyUpdate([
      {
        kind: "update",
        tick: 4,
        entity: { id: ID_A, label: { text: "stale" } },
      },
    ]);
    await nextImmediate();

    assert.deepEqual(replica.table.get(ID_A), create.entity);
    assert.deepEqual(ticks, [[create]]);
  });

  it("materializes a complete table and stops its temporary replica", async () => {
    const table = await materializeEcs(
      "materialized",
      worldWithUpdates([
        {
          changes: [
            makeLazyChange({
              kind: "create",
              tick: 8,
              entity: { id: ID_A, position: { v: [1, 2, 3] } },
            }),
          ],
          bootstrapped: true,
        },
      ]),
      {}
    );

    assert.deepEqual(table.get(ID_A), {
      id: ID_A,
      position: { v: [1, 2, 3] },
    });
  });
});

describe("native ECS LazyReplica", () => {
  it("bootstraps lazy entities and applies update and delete transitions", async () => {
    const replica = new LazyReplica(
      worldWithUpdates([
        {
          changes: [
            makeLazyChange({
              kind: "create",
              tick: 1,
              entity: { id: ID_A, label: { text: "before" } },
            }),
          ],
          bootstrapped: true,
        },
      ]),
      { filter: { anyOf: ["label"] } }
    );

    await replica.start();
    try {
      assert.deepEqual(replica.get(ID_A)?.materialize(), {
        id: ID_A,
        label: { text: "before" },
      });
      (replica as any).apply([
        makeLazyChange({
          kind: "update",
          tick: 2,
          entity: { id: ID_A, label: { text: "after" } },
        }),
      ]);
      assert.equal(replica.get(ID_A)?.label()?.text, "after");
      (replica as any).apply([
        makeLazyChange({ kind: "delete", tick: 3, id: ID_A }),
      ]);
      assert.equal(replica.get(ID_A), undefined);
    } finally {
      await replica.stop();
    }
  });
});

describe("native ECS replica utilities", () => {
  it("computes the average center of terrain shards and handles no terrain", () => {
    const empty = createTable({});
    assert.deepEqual(centerOfTerrain(empty), [0, 0, 0]);

    const table = createTable({});
    table.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: 601 as BiomesId,
          box: Box.create({ v0: [0, 0, 0], v1: [32, 32, 32] }),
          shard_seed: ShardSeed.create(),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: 602 as BiomesId,
          box: Box.create({ v0: [32, 32, 32], v1: [64, 64, 64] }),
          shard_seed: ShardSeed.create(),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: { id: 603 as BiomesId, box: Box.create() },
      },
    ]);

    assert.deepEqual(centerOfTerrain(table), [32, 32, 32]);
  });
});
