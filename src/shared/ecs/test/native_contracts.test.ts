// Initialize Bikkie first so the historical Item/ECS CommonJS cycle follows
// the same order as the application bootstrap.
import "@/shared/bikkie/active";
import {
  ChangeBuffer,
  ProposedChangeBuffer,
  applyProposedChange,
  mergeProposedChange,
  stateToChange,
  type ProposedChange,
} from "@/shared/ecs/change";
import {
  defaultBiomesId,
  defaultItem,
  defaultItemAndCount,
  defaultShardId,
  defaultTriggerStateMap,
  deserializeBiomesId,
  deserializeItem,
  deserializeItemAndCount,
  deserializeShardId,
  deserializeTriggerStateMap,
  serializeBiomesId,
  serializeItem,
  serializeItemAndCount,
  serializeShardId,
  serializeTriggerStateMap,
} from "@/shared/ecs/extern";
import { LabelChangeEvent } from "@/shared/ecs/gen/events";
import { SerializeForServer } from "@/shared/ecs/gen/json_serde";
import { createComponentSelector } from "@/shared/ecs/selectors/helper";
import { AdaptTable, createTable, exportEntity } from "@/shared/ecs/table";
import {
  EntityVersion,
  EntityVersionStamper,
  TickVersionStamper,
  allComponentsAtTick,
  decodeVersionMap,
  encodeVersionMap,
  versionMapFromTable,
} from "@/shared/ecs/version";
import {
  WrappedChange,
  WrappedChangeFor,
  WrappedEntity,
  WrappedEntityFor,
  WrappedEvent,
  WrappedProposedChange,
  zChange,
  zEntity,
  zEvent,
  zProposedChange,
} from "@/shared/ecs/zod";
import { anItem } from "@/shared/game/item";
import { INVALID_BIOMES_ID, type BiomesId } from "@/shared/ids";
import { zrpcWebDeserialize } from "@/shared/zrpc/serde";
import assert from "assert";

const ID_A = 101 as BiomesId;
const ID_B = 102 as BiomesId;

describe("native ECS change buffers", () => {
  it("buffers, merges, peeks, partially pops, and clears versioned changes", () => {
    const buffer = new ChangeBuffer();
    assert.equal(buffer.empty, true);
    buffer.push([]);
    assert.equal(buffer.empty, true);

    buffer.push([
      {
        kind: "create",
        tick: 1,
        entity: { id: ID_A, label: { text: "before" } },
      },
      {
        kind: "update",
        tick: 2,
        entity: { id: ID_A, label: { text: "after" } },
      },
      { kind: "delete", tick: 3, id: ID_B },
    ]);

    assert.equal(buffer.size, 2);
    assert.equal(buffer.has(ID_A), true);
    assert.equal(buffer.peekMap().get(ID_A)?.kind, "create");
    assert.deepEqual(buffer.popSome(1), [
      {
        kind: "create",
        tick: 2,
        entity: { id: ID_A, label: { text: "after" } },
      },
    ]);
    assert.equal(buffer.size, 1);
    assert.deepEqual(buffer.popSome(10), [
      { kind: "delete", tick: 3, id: ID_B },
    ]);
    assert.equal(buffer.empty, true);
    assert.deepEqual(buffer.pop(), []);
  });

  it("builds changes from state and applies component additions and removals", () => {
    assert.deepEqual(stateToChange(ID_A, 4, { id: ID_A }), {
      kind: "create",
      tick: 4,
      entity: { id: ID_A },
    });
    assert.deepEqual(stateToChange(ID_A, 5), {
      kind: "delete",
      tick: 5,
      id: ID_A,
    });
    assert.deepEqual(
      applyProposedChange(
        {
          id: ID_A,
          label: { text: "old" },
          remote_connection: {},
        },
        {
          kind: "update",
          entity: {
            id: ID_A,
            label: null,
            position: { v: [1, 2, 3] },
          },
        }
      ),
      {
        id: ID_A,
        remote_connection: {},
        position: { v: [1, 2, 3] },
      }
    );
    assert.equal(
      applyProposedChange({ id: ID_A }, { kind: "delete", id: ID_A }),
      undefined
    );
    assert.deepEqual(
      applyProposedChange(undefined, {
        kind: "create",
        entity: { id: ID_A, label: { text: "new" } },
      }),
      { id: ID_A, label: { text: "new" } }
    );
  });

  it("merges and manages proposed changes independently per entity", () => {
    const create: ProposedChange = {
      kind: "create",
      entity: { id: ID_A, label: { text: "old" }, remote_connection: {} },
    };
    const update: ProposedChange = {
      kind: "update",
      entity: { id: ID_A, label: null, position: { v: [1, 2, 3] } },
    };
    assert.deepEqual(mergeProposedChange(create, update), {
      kind: "create",
      entity: {
        id: ID_A,
        remote_connection: {},
        position: { v: [1, 2, 3] },
      },
    });
    assert.deepEqual(
      mergeProposedChange({ kind: "delete", id: ID_A }, update),
      update
    );

    const buffer = new ProposedChangeBuffer();
    buffer.push([create, update, { kind: "delete", id: ID_B }]);
    assert.equal(buffer.size, 2);
    buffer.delete(ID_B);
    assert.equal(buffer.size, 1);
    assert.deepEqual(buffer.pop(), [mergeProposedChange(create, update)]);
    assert.equal(buffer.empty, true);
    buffer.clear();
  });
});

describe("native ECS versions and compatibility maps", () => {
  it("implements tick and component-aware version stamper contracts", () => {
    const tick = new TickVersionStamper();
    assert.equal(tick.zero, 0);
    assert.equal(tick.createFor(3), 3);
    assert.equal(tick.tickFor(4), 4);
    assert.equal(tick.isAhead(5, 4), true);
    assert.equal(tick.isAtOrAhead(5, 5), true);
    assert.equal(tick.update(8, { kind: "delete", tick: 7, id: ID_A }), 8);

    const entityStamper = new EntityVersionStamper();
    assert.equal(entityStamper.tickFor(entityStamper.createFor(9)), 9);
    assert.equal(entityStamper.isAhead(new EntityVersion(10), 9), true);
    assert.equal(
      entityStamper.isAtOrAhead(new EntityVersion(10), new EntityVersion(10)),
      true
    );
    const created = entityStamper.update(undefined, {
      kind: "create",
      tick: 11,
      entity: { id: ID_A },
    });
    assert.deepEqual(created, new EntityVersion(11));
    assert.strictEqual(
      entityStamper.update(created, {
        kind: "update",
        tick: 12,
        entity: { id: ID_A, label: { text: "updated" } },
      }),
      created
    );
    assert.equal(created.tickByComponent?.label, 12);
  });

  it("round-trips compact version maps and excludes table tombstones", () => {
    const versions = new Map<BiomesId, number>([
      [105 as BiomesId, 7],
      [101 as BiomesId, 7],
      [500 as BiomesId, 9],
    ]);
    assert.deepEqual(decodeVersionMap(encodeVersionMap(versions)), versions);
    assert.deepEqual(decodeVersionMap(undefined), new Map());

    const table = createTable({});
    table.apply([
      { kind: "create", tick: 3, entity: { id: ID_A } },
      { kind: "create", tick: 4, entity: { id: ID_B } },
      { kind: "delete", tick: 5, id: ID_B },
    ]);
    assert.deepEqual(
      decodeVersionMap(versionMapFromTable(table)),
      new Map([[ID_A, 3]])
    );
  });

  it("initializes every generated component version at the requested tick", () => {
    const versions = allComponentsAtTick(42);
    assert.equal(versions.label, 42);
    assert.equal(versions.position, 42);
    assert.ok(Object.keys(versions).length > 100);
  });
});

describe("native ECS external and ZRPC serialization contracts", () => {
  it("round-trips IDs, shard IDs, items, counts, and trigger-state maps", () => {
    assert.equal(defaultBiomesId, INVALID_BIOMES_ID);
    assert.equal(deserializeBiomesId(serializeBiomesId(ID_A)), ID_A);
    assert.equal(defaultShardId, "");
    assert.equal(deserializeShardId(serializeShardId("1:2:3" as any)), "1:2:3");
    assert.throws(() => deserializeShardId(7));

    const item = anItem({ id: 99 as BiomesId });
    const decodedItem = deserializeItem(serializeItem(item));
    assert.equal(decodedItem.id, item.id);
    assert.equal(decodedItem.payload, undefined);
    assert.equal(defaultItem().id, INVALID_BIOMES_ID);
    const stack = { item, count: 1234567890123456789n };
    const decodedStack = deserializeItemAndCount(serializeItemAndCount(stack));
    assert.equal(decodedStack.item.id, stack.item.id);
    assert.equal(decodedStack.item.payload, undefined);
    assert.equal(decodedStack.count, stack.count);
    assert.equal(defaultItemAndCount().count, 0n);

    const triggerState = new Map<BiomesId, string | number>([
      [ID_A, "done"],
      [ID_B, 7],
    ]);
    assert.deepEqual(
      deserializeTriggerStateMap(serializeTriggerStateMap(triggerState)),
      triggerState
    );
    assert.deepEqual(defaultTriggerStateMap(), new Map());
  });

  it("prepares and parses event, entity, change, and proposed-change wrappers", () => {
    const event = new LabelChangeEvent({ id: ID_A, text: "hello" });
    const wrappedEvent = new WrappedEvent(event);
    assert.strictEqual(zEvent.parse(wrappedEvent), wrappedEvent);
    assert.deepEqual(zEvent.parse(wrappedEvent.prepareForZrpc()).event, event);

    const entity = { id: ID_A, label: { text: "hello" } };
    const wrappedEntity = WrappedEntity.for(entity)!;
    assert.strictEqual(zEntity.parse(wrappedEntity), wrappedEntity);
    assert.deepEqual(
      zEntity.parse(wrappedEntity.prepareForZrpc()).entity,
      entity
    );
    assert.equal(WrappedEntity.for(undefined), undefined);
    assert.deepEqual(
      new WrappedEntityFor(SerializeForServer, entity).prepareForZrpc(),
      wrappedEntity.prepareForZrpc()
    );

    const change = { kind: "delete", tick: 3, id: ID_A } as const;
    const wrappedChange = new WrappedChange(change);
    assert.strictEqual(zChange.parse(wrappedChange), wrappedChange);
    assert.deepEqual(
      zChange.parse(wrappedChange.prepareForZrpc()).change,
      change
    );
    assert.deepEqual(
      new WrappedChangeFor(SerializeForServer, change).prepareForZrpc(),
      wrappedChange.prepareForZrpc()
    );

    const proposed = { kind: "delete", id: ID_A } as const;
    const wrappedProposed = new WrappedProposedChange(proposed);
    assert.strictEqual(zProposedChange.parse(wrappedProposed), wrappedProposed);
    assert.deepEqual(
      zProposedChange.parse(wrappedProposed.prepareForZrpc()).change,
      proposed
    );
  });
});

describe("native ECS selector, table export, and version adaptation contracts", () => {
  it("creates all, subset, key, point, and multi selector queries", () => {
    const selector = createComponentSelector("labelled", "label", "position");
    const indexes = selector.createIndexFor.all();
    const table = createTable(indexes);
    table.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_A,
          label: { text: "A" },
          position: { v: [0, 0, 0] },
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: { id: ID_B, label: { text: "B" } },
      },
    ]);

    assert.deepEqual([...table.scanIds(selector.query.all())], [ID_A]);
    assert.equal(table.count(selector.point(ID_A)), 1);
    assert.equal(table.count(selector.point(ID_B)), 0);
    assert.deepEqual(
      [...table.scan(selector.multi([ID_A, ID_B]))].map((entity) => entity.id),
      [ID_A]
    );

    const subset = selector.createIndexFor.subset(
      (entity) => entity?.label?.text === "A"
    );
    const subsetTable = createTable(subset);
    subsetTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_A,
          label: { text: "A" },
          position: { v: [0, 0, 0] },
        },
      },
    ]);
    assert.equal(subsetTable.count(selector.query.all()), 1);

    const keyedSelector = createComponentSelector("byLabel", "label");
    const keyed = keyedSelector.createIndexFor.key((entity, change) => {
      if (change?.entity.label === undefined) {
        return undefined;
      }
      return [entity.label!.text];
    });
    const keyedTable = createTable(keyed);
    keyedTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: { id: ID_A, label: { text: "A" } },
      },
    ]);
    assert.deepEqual(
      [...keyedTable.scanIds(keyedSelector.query.key("A"))],
      [ID_A]
    );
    assert.deepEqual(keyedSelector.inverse.idToKeys(keyed, ID_A), ["A"]);
  });

  it("exports selected components and adapts versions without changing entities or events", () => {
    const table = createTable({});
    table.apply([
      {
        kind: "create",
        tick: 5,
        entity: {
          id: ID_A,
          label: { text: "A" },
          position: { v: [1, 2, 3] },
        },
      },
    ]);
    const exported = zrpcWebDeserialize(
      exportEntity(table, ID_A, "label"),
      zEntity
    );
    assert.deepEqual(exported.entity, { id: ID_A, label: { text: "A" } });
    assert.throws(() => exportEntity(table, ID_B));

    const delegate = createTable({});
    delegate.apply([
      { kind: "create", tick: 5, entity: { id: ID_A, label: { text: "A" } } },
    ]);
    const adapted = new AdaptTable(delegate, (version) => `v${version}`);
    const events: string[] = [];
    adapted.events.on("preApply", () => events.push("pre"));
    adapted.events.on("postApply", () => events.push("post"));
    delegate.apply([
      {
        kind: "update",
        tick: 6,
        entity: { id: ID_A, label: { text: "B" } },
      },
    ]);
    assert.deepEqual(events, ["pre", "post"]);
    assert.deepEqual(adapted.getWithVersion(ID_A), [
      "v6",
      { id: ID_A, label: { text: "B" } },
    ]);
    assert.deepEqual(
      [...adapted.deltaSince()].map(([id, [version]]) => [id, version]),
      [[ID_A, "v6"]]
    );
    assert.equal(adapted.has(ID_A), true);
    assert.equal(adapted.recordSize, 1);
    adapted.stop();
  });
});
