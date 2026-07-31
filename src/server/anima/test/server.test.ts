import {
  AnimaServer,
  changesToSharderUpdates,
  registerAnimaServer,
} from "@/server/anima/server";
import type { LogicApi } from "@/server/shared/api/logic";
import type { AnimaReplica } from "@/server/shared/npc/table";
import type { WorldApi } from "@/server/shared/world/api";
import { NpcMetadata } from "@/shared/ecs/gen/components";
import type { Change } from "@/shared/ecs/change";
import type { BiomesId } from "@/shared/ids";
import { allNpcs } from "@/shared/npc/bikkie";
import type { RegistryLoader } from "@/shared/registry";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("AnimaServer change sharding", () => {
  it("converts create/update/delete metadata changes and ignores unrelated updates", () => {
    const typeId = allNpcs()[0].id;
    const metadata = NpcMetadata.create({
      type_id: typeId,
      spawn_position: [0, 0, 0],
      spawn_orientation: [0, 0],
    });
    const changes = [
      {
        kind: "create",
        tick: 1,
        entity: { id: 1 as BiomesId, npc_metadata: metadata },
      },
      {
        kind: "update",
        tick: 2,
        entity: { id: 2 as BiomesId, npc_metadata: null },
      },
      {
        kind: "update",
        tick: 3,
        entity: { id: 3 as BiomesId, position: { v: [0, 0, 0] } },
      },
      { kind: "delete", tick: 4, id: 4 as BiomesId },
    ] as Change[];

    assert.deepEqual(changesToSharderUpdates(changes), [
      { id: 1, npc_metadata: metadata },
      { id: 2, npc_metadata: null },
      { id: 4, npc_metadata: null },
    ]);
  });
});

describe("AnimaServer lifecycle", () => {
  function server() {
    return new AnimaServer(
      {} as VoxelooModule,
      {
        table: { get: () => undefined },
        stop: async () => {},
      } as unknown as AnimaReplica,
      { ping: async () => {}, publish: async () => {} },
      {} as WorldApi
    );
  }

  it("tracks and untracks NPCs as held shard values change", () => {
    const typeId = allNpcs()[0].id;
    const npcId = 101 as BiomesId;
    const metadata = NpcMetadata.create({
      type_id: typeId,
      spawn_position: [0, 0, 0],
      spawn_orientation: [0, 0],
    });
    const instance = server() as any;
    instance.shardManager = { total: 10 };
    instance.replica.table.get = () => ({ id: npcId, npc_metadata: metadata });
    instance.initializeShardTracking();
    instance.npcSharder.addHeldShards([Number(npcId) % 10]);

    instance.npcSharder.update([{ id: npcId, npc_metadata: metadata }]);
    assert.equal(instance.managedNpcs.npcs(typeId).has(npcId), true);
    instance.npcSharder.update([{ id: npcId, npc_metadata: null }]);
    assert.equal(instance.managedNpcs.npcs(typeId).has(npcId), false);
    instance.npcSharderSubscription.off();
  });

  it("reports per-shard weights and totals missing durations as zero", () => {
    const instance = server() as any;
    const reports: Array<[number, number]> = [];
    instance.shardManager = {
      held: new Set([1, 2]),
      reportWeight: (shard: number, weight: number) =>
        reports.push([shard, weight]),
    };
    instance.npcControllerService = {
      tickDurationForShard: (shard: number) => (shard === 1 ? 12 : undefined),
    };

    instance.refreshShardManagerParams();

    assert.deepEqual(reports, [
      [1, 12],
      [2, 0],
    ]);
    assert.equal(instance.totalNpcTickTimeMs(), 12);
  });

  it("stops resources, shard ownership, timers, controller, replica, and subscriptions", async () => {
    const calls: string[] = [];
    const instance = server() as any;
    instance.cleanUps = [
      () => calls.push("cleanup-one"),
      async () => calls.push("cleanup-two"),
    ];
    instance.shardManager = { stop: async () => calls.push("sharder.stop") };
    instance.controller = {
      abortAndWait: async () => calls.push("background.stop"),
    };
    instance.npcControllerService = {
      stop: async () => calls.push("controller.stop"),
    };
    instance.replica.stop = async () => calls.push("replica.stop");
    instance.shardManagerSubscription = {
      off: () => calls.push("sharder.subscription.off"),
    };
    instance.npcSharderSubscription = {
      off: () => calls.push("npc.subscription.off"),
    };

    await instance.stop();

    assert.deepEqual(calls, [
      "cleanup-two",
      "cleanup-one",
      "sharder.stop",
      "background.stop",
      "controller.stop",
      "replica.stop",
      "sharder.subscription.off",
      "npc.subscription.off",
    ]);
    assert.deepEqual(instance.cleanUps, []);
  });

  it("registers an AnimaServer from all required registry dependencies", async () => {
    const dependencies = {
      voxeloo: {} as VoxelooModule,
      replica: { table: {} } as AnimaReplica,
      logicApi: { ping: async () => {}, publish: async () => {} } as LogicApi,
      worldApi: {} as WorldApi,
    };
    const requested: string[] = [];
    const loader = {
      get: async (key: keyof typeof dependencies) => {
        requested.push(key);
        return dependencies[key];
      },
    } as RegistryLoader<any>;

    const registered = await registerAnimaServer(loader);

    assert.ok(registered instanceof AnimaServer);
    assert.deepEqual(new Set(requested), new Set(Object.keys(dependencies)));
  });
});
