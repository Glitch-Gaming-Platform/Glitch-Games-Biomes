import { requeueAfter, zSimulationName } from "@/server/gaia/simulations/api";
import {
  DelayQueue,
  makeChunkIndex,
  receptiveField,
  shardAndNeighbors,
  shardAndNeighborsOfDirs,
  terrainWasModified,
} from "@/server/gaia/simulations/utils";
import { Clock, minTimeUntil, registerClock } from "@/server/gaia/util/clock";
import { positionHash } from "@/server/gaia/util/hashing";
import type { Change } from "@/shared/ecs/change";
import {
  ShardDiff,
  ShardSeed,
  ShardWater,
} from "@/shared/ecs/gen/components";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import sinon from "sinon";

describe("Gaia simulation utilities", () => {
  it("constructs default and custom requeue results", () => {
    assert.deepEqual(requeueAfter(), {
      update: { kind: "requeue", afterDelayMs: 1000 },
    });
    assert.deepEqual(requeueAfter(25), {
      update: { kind: "requeue", afterDelayMs: 25 },
    });
  });

  it("keeps the simulation-name schema synchronized with the registered set", () => {
    assert.deepEqual(zSimulationName.options, [
      "farming",
      "flora_decay",
      "flora_growth",
      "flora_muck",
      "irradiance",
      "leaf_growth",
      "lifetime",
      "muck",
      "ore_growth",
      "restoration",
      "sky_occlusion",
      "tree_growth",
      "water",
    ]);
  });

  it("DelayQueue keeps the earliest schedule, exposes pending keys, and pops only ready work", () => {
    const queue = new DelayQueue<string>();
    queue.schedule("later", 20);
    queue.schedule("first", 10);
    queue.schedule("first", 15);
    queue.schedule("first", 5);

    assert.equal(queue.size, 2);
    assert.equal(queue.lwm, 5);
    assert.deepEqual(new Set(queue.peekAll()), new Set(["later", "first"]));
    assert.deepEqual(queue.pop(5), [], "the lower bound is exclusive");
    assert.deepEqual(queue.pop(6), ["first"]);
    assert.equal(queue.lwm, 20);
    queue.delete("later");
    assert.equal(queue.size, 0);
    assert.equal(queue.lwm, undefined);
  });

  it("computes receptive fields and rejects radii larger than half a shard", () => {
    assert.deepEqual(receptiveField([0, 0, 0], [0, 0, 0]), [
      voxelShard(0, 0, 0),
    ]);
    assert.equal(new Set(receptiveField([0, 0, 0], [16, 16, 16])).size, 8);
    assert.throws(() => receptiveField([0, 0, 0], [17, 0, 0]));
  });

  it("returns requested directional neighbors and all diagonal neighbors", () => {
    const directional = shardAndNeighborsOfDirs(
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    );
    assert.equal(directional.length, 3);
    assert.equal(directional[0], voxelShard(0, 0, 0));
    assert.equal(new Set(shardAndNeighbors([0, 0, 0])).size, 27);
  });

  it("creates stable, independent sparse indexes per entity", () => {
    const index = makeChunkIndex<number>();
    const first = index.get(1 as BiomesId);
    const same = index.get(1 as BiomesId);
    const second = index.get(2 as BiomesId);
    first.set([1, 2, 3], 42);

    assert.strictEqual(first, same);
    assert.notStrictEqual(first, second);
    assert.equal(same.get([1, 2, 3]), 42);
    assert.equal(second.get([1, 2, 3]), undefined);
  });

  it("recognizes only create/update terrain mutations", () => {
    const id = 1 as BiomesId;
    assert.equal(
      terrainWasModified({
        kind: "update",
        tick: 1,
        entity: { id, shard_diff: ShardDiff.create() },
      } as Change),
      true
    );
    assert.equal(
      terrainWasModified({
        kind: "create",
        tick: 1,
        entity: { id, shard_seed: ShardSeed.create() },
      } as Change),
      true
    );
    assert.equal(
      terrainWasModified({ kind: "delete", tick: 1, id } as Change),
      false
    );
    assert.equal(
      terrainWasModified({
        kind: "update",
        tick: 1,
        entity: { id, shard_water: ShardWater.create() },
      } as Change),
      false
    );
  });
});

describe("Gaia clock and hashing", () => {
  it("reports readiness, delays, fuzz, and minimum time", async () => {
    const fakeTime = sinon.useFakeTimers({ now: 1000 });
    const random = sinon.stub(Math, "random").returns(0.5);
    try {
      const clock = new Clock();
      assert.equal(clock.now(), 1000);
      assert.equal(clock.timeUntil(1250), 250);
      assert.equal(clock.ready(1000), true);
      assert.equal(clock.ready(1001), false);
      assert.equal(clock.delayedTime(100, 0.2), 1110);
      assert.equal(minTimeUntil(clock, [1400, 1200, 1300]), 200);
      assert.equal(minTimeUntil(clock, []), Infinity);
      assert.ok((await registerClock()) instanceof Clock);
    } finally {
      random.restore();
      fakeTime.restore();
    }
  });

  it("hashes positions deterministically and incorporates each axis", () => {
    const hash = positionHash([12, -4, 90]);
    assert.equal(positionHash([12, -4, 90]), hash);
    assert.notEqual(positionHash([13, -4, 90]), hash);
    assert.notEqual(positionHash([12, -3, 90]), hash);
    assert.notEqual(positionHash([12, -4, 91]), hash);
  });
});
