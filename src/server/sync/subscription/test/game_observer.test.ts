import { newPlayer } from "@/server/logic/utils/players";
import type { Firehose } from "@/server/shared/firehose/api";
import { InMemoryFirehose } from "@/server/shared/firehose/memory";
import type { BDB } from "@/server/shared/storage";
import { createBdb, createStorageBackend } from "@/server/shared/storage";
import type { WorldApi } from "@/server/shared/world/api";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import {
  bootstrapSyncPriorityForTest,
  Observer,
  localDevStarterWorldBootstrapCountsForTest,
  localDevStarterWorldEntityIdsForTest,
  localDevStarterWorldSeededGroveNpcIdsForTest,
} from "@/server/sync/subscription/game_observer";
import { Scanner } from "@/server/sync/subscription/scanner";
import { SyncIndex } from "@/server/sync/subscription/sync_index";
import type { SyncTarget } from "@/shared/api/sync";
import { zSyncChange } from "@/shared/api/sync";
import type { Update } from "@/shared/ecs/change";
import { Box, Iced, ShardSeed } from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { WorldMetadataId } from "@/shared/ecs/ids";
import type { VersionMap } from "@/shared/ecs/version";
import { SNAPSHOT_GROVE_NPCS } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import { yieldToOthers } from "@/shared/util/async";
import assert from "assert";

const USER_ID = 1234 as BiomesId;
const OTHER_USER_ID = 1235 as BiomesId;
const RANDOM_ENTITY_ID = 31337 as BiomesId;
const ID_A = 33 as BiomesId;
const ID_B = 44 as BiomesId;
const SYNC_RADIUS = 100;

describe("Observer tests", () => {
  let db!: BDB;
  let world!: InMemoryWorld;
  let worldApi!: WorldApi;
  let firehose!: Firehose;
  let syncIndex!: SyncIndex;
  let scanner!: Scanner;
  let observer!: Observer;

  it("prioritizes nearby terrain during a capped initial bootstrap", () => {
    const nearbyTerrain = bootstrapSyncPriorityForTest("terrain", 16);
    const distantTerrain = bootstrapSyncPriorityForTest("terrain", 40_000);
    const nearbyNpc = bootstrapSyncPriorityForTest("npc", 16);

    assert.ok(nearbyTerrain > distantTerrain);
    assert.ok(
      nearbyTerrain > nearbyNpc,
      "ground shards must arrive before decorative/non-terrain entities"
    );
  });

  beforeEach(async () => {
    db = createBdb(await createStorageBackend("memory"));
    world = new InMemoryWorld();

    world.applyChanges([
      {
        kind: "create",
        entity: {
          ...newPlayer(USER_ID, "TestPlayer"),
          position: { v: [0, 0, 0] },
        },
      },
    ]);

    worldApi = ShimWorldApi.createForWorld(world);
    firehose = new InMemoryFirehose();
    syncIndex = new SyncIndex(worldApi);
    await syncIndex.start();
  });

  afterEach(async () => {
    await scanner?.stop();
    await syncIndex.stop();
  });

  const createObserverForSyncTarget = (
    syncTarget: SyncTarget,
    versionMap?: VersionMap
  ) => {
    scanner = new Scanner(
      db,
      syncIndex,
      syncTarget.kind === "entity" ? syncTarget.entityId : USER_ID,
      SYNC_RADIUS
    );
    observer = new Observer(
      {
        worldApi,
        syncIndex,
        firehose,
      },
      syncTarget,
      versionMap ?? new Map(),
      scanner
    );
  };

  const createLocalObserver = (versionMap?: VersionMap) => {
    createObserverForSyncTarget(
      {
        kind: "localUser",
        userId: USER_ID,
      },
      versionMap
    );
  };

  const pull = (count: number) => {
    const results = observer.pull(count);
    return results.map((r) => zSyncChange.parse(r).change);
  };

  const withLocalDevStarterSeedEnv = async (fn: () => Promise<void>) => {
    const prior = {
      SKIP_PROD_LOAD: process.env.SKIP_PROD_LOAD,
      BIOMES_FORCE_LOCAL_DEV_TOWN: process.env.BIOMES_FORCE_LOCAL_DEV_TOWN,
      BIOMES_CREATE_LOCAL_DEV_TERRAIN:
        process.env.BIOMES_CREATE_LOCAL_DEV_TERRAIN,
    };
    process.env.SKIP_PROD_LOAD = "true";
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN = "1";
    delete process.env.BIOMES_CREATE_LOCAL_DEV_TERRAIN;
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  };

  const idsFromBootstrap = (
    changes: Awaited<ReturnType<Observer["start"]>>
  ) => {
    return new Set(
      changes
        .map((c) => zSyncChange.parse(c).change)
        .flatMap((change) =>
          typeof change === "number"
            ? [change]
            : change.kind === "update"
            ? [change.entity.id]
            : []
        )
    );
  };

  it("Should include the player initially", async () => {
    createLocalObserver();

    const initial = await observer.start();
    assert.deepEqual(
      initial.map((c) => zSyncChange.parse(c).change),
      [
        {
          kind: "update",
          tick: 1,
          entity: {
            ...world.table.get(WorldMetadataId),
            synthetic_stats: {
              online_players: 1,
            },
          },
        },
        {
          kind: "update",
          tick: 2,
          entity: world.table.get(USER_ID),
        },
      ]
    );
  });

  it("includes every nearby connected player in the same observer bootstrap", async () => {
    world.applyChanges([
      {
        kind: "create",
        entity: {
          ...newPlayer(OTHER_USER_ID, "OtherPlayer"),
          position: { v: [1, 0, 0] },
        },
      },
    ]);
    await yieldToOthers();
    createLocalObserver();

    const bootstrap = await observer.start();
    const initial = bootstrap.map((change) => zSyncChange.parse(change).change);
    const ids = idsFromBootstrap(bootstrap);
    const updates = initial.filter(
      (change): change is Update =>
        typeof change !== "number" && change.kind === "update"
    );

    assert.equal(
      updates.find((change) => change.entity.id === WorldMetadataId)?.entity
        .synthetic_stats?.online_players,
      2
    );
    assert.ok(ids.has(USER_ID));
    assert.ok(ids.has(OTHER_USER_ID));
  });

  it("retains every entity beyond the capped first bootstrap batch", async function () {
    this.timeout(30_000);
    const nearbyIds = Array.from(
      { length: 1_025 },
      (_, index) => (100_000 + index) as BiomesId
    );
    world.applyChanges(
      nearbyIds.map((id, index) => ({
        kind: "create" as const,
        entity: {
          id,
          position: { v: [index % 20, 0, Math.floor(index / 20)] },
        },
      }))
    );
    await yieldToOthers();
    createLocalObserver();

    const initial = await observer.start();
    const initialIds = idsFromBootstrap(initial);
    const overflow = pull(100);
    const delivered = new Set([
      ...initialIds,
      ...overflow.flatMap((change) =>
        typeof change === "number"
          ? [change]
          : change.kind === "update"
          ? [change.entity.id]
          : []
      ),
    ]);

    for (const id of nearbyIds) {
      assert.ok(delivered.has(id), `bootstrap overflow lost entity ${id}`);
    }
    assert.equal(observer.pendingChanges, 0);
  });

  it("drains a production-sized mixed bootstrap without losing terrain", async function () {
    this.timeout(60_000);
    const terrainIds = Array.from(
      { length: 2_200 },
      (_, index) => (200_000 + index) as BiomesId
    );
    const decorationIds = Array.from(
      { length: 300 },
      (_, index) => (300_000 + index) as BiomesId
    );
    world.applyChanges([
      ...terrainIds.map((id, index) => {
        const x = (index % 20) - 10;
        const y = Math.floor(index / 400) - 2;
        const z = (Math.floor(index / 20) % 20) - 10;
        return {
          kind: "create" as const,
          entity: {
            id,
            box: Box.create({
              v0: [x, y, z],
              v1: [x + 1, y + 1, z + 1],
            }),
            shard_seed: ShardSeed.create(),
          },
        };
      }),
      ...decorationIds.map((id, index) => ({
        kind: "create" as const,
        entity: {
          id,
          position: {
            v: [(index % 20) - 10, 0, Math.floor(index / 20) - 7] as [
              number,
              number,
              number
            ],
          },
        },
      })),
    ]);
    await yieldToOthers();
    createLocalObserver();

    const initial = await observer.start();
    const delivered = idsFromBootstrap(initial);
    const firstBatchTerrainCount = terrainIds.filter((id) =>
      delivered.has(id)
    ).length;
    const firstBatchDecorationCount = decorationIds.filter((id) =>
      delivered.has(id)
    ).length;
    assert.ok(firstBatchTerrainCount > 0);
    assert.equal(
      firstBatchDecorationCount,
      0,
      "terrain should consume the capped bootstrap before decoration"
    );

    let pulls = 0;
    while (observer.pendingChanges > 0 && pulls < 200) {
      for (const change of pull(37)) {
        if (typeof change === "number") {
          delivered.add(change);
        } else if (change.kind === "update") {
          delivered.add(change.entity.id);
        }
      }
      pulls += 1;
    }

    assert.equal(observer.pendingChanges, 0);
    for (const id of [...terrainIds, ...decorationIds]) {
      assert.ok(delivered.has(id), `mixed bootstrap lost entity ${id}`);
    }
  });

  it("keeps fallback world metadata resident when a sparse backend is missing metadata", async () => {
    world.applyChanges([
      {
        kind: "delete",
        id: WorldMetadataId,
      },
    ]);
    await yieldToOthers();

    createLocalObserver(new Map([[WorldMetadataId, 99]]));

    const initial = await observer.start();
    const changes = initial.map((c) => zSyncChange.parse(c).change);
    assert.equal(
      changes.some(
        (change) => typeof change !== "number" && change.kind === "delete"
      ),
      false,
      "bootstrap should not delete the required world metadata entity"
    );
    const metadataUpdate = changes
      .filter(
        (change): change is Update =>
          typeof change !== "number" && change.kind === "update"
      )
      .find((change) => change.entity.id === WorldMetadataId);
    assert.ok(
      metadataUpdate?.entity.world_metadata,
      "bootstrap should include fallback world_metadata"
    );
  });

  it("Should deice players on load", async () => {
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: USER_ID,
          iced: Iced.create({}),
        },
      },
    ]);
    assert.ok(world.table.get(USER_ID)?.iced);
    createLocalObserver();

    const initial = await observer.start();
    assert.deepEqual(
      initial.map((c) => zSyncChange.parse(c).change),
      [
        {
          kind: "update",
          tick: 1,
          entity: {
            ...world.table.get(WorldMetadataId),
            synthetic_stats: {
              online_players: 1,
            },
          },
        },
        {
          kind: "update",
          tick: 3,
          entity: { ...world.table.get(USER_ID), iced: undefined },
        },
      ]
    );
  });

  it("Should synthesize entity when observe mode for entity", async () => {
    world.applyChanges([
      {
        kind: "create",
        entity: {
          id: RANDOM_ENTITY_ID,
          position: { v: [0, 0, 0] },
        },
      },
    ]);
    createObserverForSyncTarget({
      kind: "entity",
      entityId: RANDOM_ENTITY_ID,
    });

    const initial = await observer.start();
    assert.deepEqual(
      initial.map((c) => zSyncChange.parse(c).change),
      [
        {
          kind: "update",
          tick: 1,
          entity: {
            ...world.table.get(WorldMetadataId),
            synthetic_stats: {
              online_players: 1,
            },
          },
        },
        {
          kind: "update",
          tick: 3,
          entity: world.table.get(RANDOM_ENTITY_ID),
        },
        USER_ID,
      ]
    );
  });

  it("Should not deice entity when observe mode for entity", async () => {
    world.applyChanges([
      {
        kind: "create",
        entity: {
          id: RANDOM_ENTITY_ID,
          position: { v: [0, 0, 0] },
          iced: Iced.create({}),
        },
      },
    ]);
    createObserverForSyncTarget({
      kind: "entity",
      entityId: RANDOM_ENTITY_ID,
    });

    const initial = await observer.start();
    assert.deepEqual(
      initial.map((c) => zSyncChange.parse(c).change),
      [
        {
          kind: "update",
          tick: 1,
          entity: {
            ...world.table.get(WorldMetadataId),
            synthetic_stats: {
              online_players: 1,
            },
          },
        },
        {
          kind: "update",
          tick: 3,
          entity: world.table.get(RANDOM_ENTITY_ID),
        },
        USER_ID,
      ]
    );
  });

  it("Should sync only the item within the bubble", async () => {
    createLocalObserver();

    const include = {
      id: ID_A,
      label: { text: "Lost in the void" },
    } as Entity;
    const exclude = {
      id: ID_B,
      position: { v: [0, 1000, 0] },
      label: { text: "Far away" },
    } as Entity;

    await observer.start();

    world.applyChanges(
      [include, exclude].map((e) => ({ kind: "create", entity: e }))
    );
    await yieldToOthers();

    assert.deepEqual(pull(100), [ID_A]);
  });

  it("Should sync only the item within the bubble", async () => {
    createLocalObserver();

    const include = {
      id: ID_A,
      position: { v: [0, 1, 0] },
      label: { text: "A" },
    } as Entity;
    const exclude = {
      id: ID_B,
      position: { v: [0, 1000, 0] },
      label: { text: "B" },
    } as Entity;

    await observer.start();

    world.applyChanges(
      [include, exclude].map((e) => ({ kind: "create", entity: e }))
    );
    await yieldToOthers();

    assert.deepEqual(pull(100), [ID_A]);

    // Update A and B
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: ID_A,
          label: { text: "A2" },
        },
      },
      {
        kind: "update",
        entity: {
          id: ID_B,
          label: { text: "B2" },
        },
      },
    ]);
    await yieldToOthers();

    assert.deepEqual(pull(100), [
      {
        kind: "update",
        tick: 4,
        entity: {
          id: ID_A,
          label: { text: "A2" },
        },
      },
    ]);

    // Now move A out of range.
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: ID_A,
          position: { v: [0, 1000, 0] },
        },
      },
    ]);
    await yieldToOthers();

    assert.deepEqual(pull(100), [
      {
        kind: "delete",
        tick: 4,
        id: ID_A,
      },
    ]);

    // Move A and B into range.
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: ID_A,
          position: { v: [0, 50, 0] },
        },
      },
      {
        kind: "update",
        entity: {
          id: ID_B,
          position: { v: [50, 50, 0] },
        },
      },
    ]);
    await yieldToOthers();

    assert.deepEqual(pull(100), [ID_A, ID_B]);
  });

  it("Should support the bubble moving", async () => {
    createLocalObserver();

    const include = {
      id: ID_A,
      position: { v: [0, 1, 0] },
      label: { text: "A" },
    } as Entity;
    const exclude = {
      id: ID_B,
      position: { v: [0, 1000, 0] },
      label: { text: "B" },
    } as Entity;

    await observer.start();

    world.applyChanges(
      [include, exclude].map((e) => ({ kind: "create", entity: e }))
    );
    await yieldToOthers();

    assert.deepEqual(pull(100), [ID_A]);

    // Move the bubble.
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: USER_ID,
          position: { v: [0, 1000, 0] },
        },
      },
    ]);
    await yieldToOthers();

    // Note, A isn't deleted but is outside range.
    assert.deepEqual(pull(100), [
      ID_B,
      {
        kind: "update",
        tick: 4,
        entity: {
          id: USER_ID,
          position: { v: [0, 1000, 0] },
        },
      },
    ]);

    // Update A
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: ID_A,
          label: { text: "A2" },
        },
      },
    ]);
    await yieldToOthers();

    // A is now deleted.
    assert.deepEqual(pull(100), [
      {
        kind: "delete",
        tick: 3,
        id: ID_A,
      },
    ]);

    // Move back.
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: USER_ID,
          position: { v: [0, 0, 0] },
        },
      },
    ]);
    await yieldToOthers();

    assert.deepEqual(pull(100), [
      ID_A,
      {
        kind: "update",
        tick: 6,
        entity: {
          id: USER_ID,
          position: { v: [0, 0, 0] },
        },
      },
    ]);
  });

  it("eager local-dev bootstrap tracks every seeded Grove NPC", () => {
    const seededGroveNpcCount = SNAPSHOT_GROVE_NPCS.filter(
      (npc) => npc.seedServerNpc
    ).length;
    const counts = localDevStarterWorldBootstrapCountsForTest();

    assert.equal(counts.snapshotGroveNpcIds, seededGroveNpcCount);
    assert.ok(
      counts.snapshotGroveNpcIds > 12,
      "Grove bootstrap should not regress to the old hard-coded 12 NPC list"
    );
    assert.equal(
      counts.expectedIds,
      counts.terrainIds +
        counts.harthmereNpcIds +
        counts.snapshotGroveNpcIds +
        counts.snapshotCombatNpcIds +
        counts.liveEntityProductionSeedIds +
        counts.groveRaceMinigameSeedIds
    );
  });

  it("eager local-dev bootstrap preserves seeded NPCs across reconnects", async () => {
    await withLocalDevStarterSeedEnv(async () => {
      const seedIds = localDevStarterWorldEntityIdsForTest();
      const groveNpcIds = localDevStarterWorldSeededGroveNpcIdsForTest();

      world.applyChanges(
        seedIds.map((id) => ({
          kind: "create",
          entity: {
            id,
            label: { text: `seeded local-dev entity ${id}` },
            position: { v: [0, 0, 0] },
          } as Entity,
        }))
      );

      createLocalObserver();
      const firstBootstrapIds = idsFromBootstrap(await observer.start());
      for (const id of seedIds) {
        assert.equal(
          firstBootstrapIds.has(id),
          true,
          `initial local-dev bootstrap missed seeded entity ${id}`
        );
      }
      for (const id of groveNpcIds) {
        assert.equal(
          firstBootstrapIds.has(id),
          true,
          `initial local-dev bootstrap missed Grove NPC ${id}`
        );
      }
      assert.equal(groveNpcIds.length, 22);

      await scanner.stop();
      createLocalObserver();
      const reconnectBootstrapIds = idsFromBootstrap(await observer.start());

      for (const id of groveNpcIds) {
        assert.equal(
          reconnectBootstrapIds.has(id),
          true,
          `reconnect local-dev bootstrap missed Grove NPC ${id}`
        );
      }
      assert.equal(
        seedIds.filter((id) => reconnectBootstrapIds.has(id)).length,
        seedIds.length
      );
    });
  });
});
