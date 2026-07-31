import { NpcTicker } from "@/server/anima/npc_ticker";
import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { LockedInPlace } from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { isDayTime, sunInclination } from "@/shared/game/sun_moon_position";
import type { NpcTickerTable } from "@/shared/npc/environment";
import { SimulatedNpc } from "@/shared/npc/simulated";
import { zSpawnConstraints } from "@/shared/npc/spawn_events";
import { TickUpdates } from "@/shared/npc/updates";
import type { TypedResources } from "@/shared/resources/types";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";
import sinon from "sinon";
import { performance } from "perf_hooks";

function makeTicker(players: unknown[] = []) {
  const table = {
    metaIndex: {},
    get: () => undefined,
    scan: () => players,
  } as unknown as NpcTickerTable;
  const resources = {
    get: () => ({ aabb: { v0: [-100, -100, -100], v1: [100, 100, 100] } }),
  } as unknown as TypedResources<any>;
  return new NpcTicker({} as VoxelooModule, table, resources, () => new Set());
}

describe("Anima NpcTicker scheduling", () => {
  let originalTickByDistance: typeof CONFIG.animaTickByDistance;
  let originalFarRatio: number;

  beforeEach(() => {
    originalTickByDistance = CONFIG.animaTickByDistance;
    originalFarRatio = CONFIG.animaFarFromPlayerTickRatio;
    CONFIG.animaTickByDistance = [
      [10, 1],
      [20, 4],
    ];
    CONFIG.animaFarFromPlayerTickRatio = 64;
  });

  afterEach(() => {
    CONFIG.animaTickByDistance = originalTickByDistance;
    CONFIG.animaFarFromPlayerTickRatio = originalFarRatio;
  });

  it("uses the nearest relevant player to choose an NPC tick rate", () => {
    const ticker = makeTicker([
      { position: { v: [18, 0, 0] } },
      { position: { v: [5, 0, 0] } },
    ]);
    const npc = { position: [0, 0, 0], type: { name: "baseline" } };

    assert.equal((ticker as any).determineTickRate(npc), 1);
  });

  it("uses the far-from-player ratio when no relevant player is nearby", () => {
    const ticker = makeTicker([
      { position: undefined },
      { position: { v: [25, 0, 0] } },
    ]);
    const npc = { position: [0, 0, 0], type: { name: "baseline" } };

    assert.equal((ticker as any).determineTickRate(npc), 64);
  });

  it("spreads fixed-rate NPC work across ticks using the entity id", () => {
    const ticker = makeTicker();
    const marker = { state: [], events: [] };
    const calls: Array<[unknown, number]> = [];
    (ticker as any).tickCount = 1;
    (ticker as any).determineTickRate = () => 4;
    (ticker as any).tickNpcMultipleTimes = (npc: unknown, count: number) => {
      calls.push([npc, count]);
      return marker;
    };
    const scheduled = {
      id: 3,
      hp: 10,
      type: { name: "baseline" },
    } as SimulatedNpc;
    const unscheduled = {
      id: 2,
      hp: 10,
      type: { name: "baseline" },
    } as SimulatedNpc;

    assert.strictEqual((ticker as any).tickNpc(scheduled, 2), marker);
    assert.equal((ticker as any).tickNpc(unscheduled, 2), undefined);
    assert.deepEqual(calls, [[scheduled, 2]]);
  });

  it("never runs behavior logic for dead NPCs", () => {
    const ticker = makeTicker();
    let ticked = false;
    (ticker as any).determineTickRate = () => 1;
    (ticker as any).tickNpcMultipleTimes = () => {
      ticked = true;
    };
    const npc = {
      id: 1,
      hp: 0,
      type: { name: "baseline" },
    } as SimulatedNpc;

    assert.equal((ticker as any).tickNpc(npc, 3), undefined);
    assert.equal(ticked, false);
  });

  it("exposes the exact environment dependencies supplied to the ticker", () => {
    const table = {
      metaIndex: { marker: "meta" },
      get: () => undefined,
      scan: () => [],
    } as unknown as NpcTickerTable;
    const metadata = {
      aabb: { v0: [-1, -1, -1], v1: [1, 1, 1] },
    };
    const resources = {
      get: (path: string) => (path === "/ecs/metadata" ? metadata : undefined),
    } as unknown as TypedResources<any>;
    const voxeloo = {} as VoxelooModule;
    const ticker = new NpcTicker(voxeloo, table, resources, () => new Set());

    assert.strictEqual(ticker.env.voxeloo, voxeloo);
    assert.strictEqual(ticker.env.table, table);
    assert.strictEqual(ticker.env.resources, resources);
    assert.strictEqual(ticker.env.ecsMetaIndex, table.metaIndex);
    assert.strictEqual(ticker.env.worldMetadata, metadata);
  });

  it("adds newly managed NPCs, refreshes external state, and removes unmanaged NPCs", () => {
    const firstId = 7_001 as BiomesId;
    const secondId = 7_002 as BiomesId;
    const entities = new Map<BiomesId, any>();
    const managed = new Set<BiomesId>([firstId]);
    entities.set(
      firstId,
      npcEntity(
        { id: firstId, typeId: BikkieIds.dMucker, position: [0, 0, 0] },
        1
      )
    );
    const table = {
      metaIndex: {},
      get: (id: BiomesId) => entities.get(id),
      scan: () => [],
    } as unknown as NpcTickerTable;
    const ticker = new NpcTicker(
      {} as VoxelooModule,
      table,
      { get: () => ({}) } as unknown as TypedResources<any>,
      () => managed
    );
    assert.deepEqual(
      (ticker as any).npcs.map((npc: SimulatedNpc) => npc.id),
      [firstId]
    );

    entities.set(
      firstId,
      npcEntity(
        { id: firstId, typeId: BikkieIds.dMucker, position: [5, 0, 0] },
        1
      )
    );
    (ticker as any).updateManagedNpcs();
    assert.deepEqual((ticker as any).npcs[0].position, [5, 0, 0]);

    managed.delete(firstId);
    managed.add(secondId);
    entities.set(
      secondId,
      npcEntity(
        { id: secondId, typeId: BikkieIds.dMucker, position: [9, 0, 0] },
        1
      )
    );
    (ticker as any).updateManagedNpcs();
    assert.deepEqual(
      (ticker as any).npcs.map((npc: SimulatedNpc) => npc.id),
      [secondId]
    );
  });

  it("generates and merges the fixed ticks produced by every managed NPC", async () => {
    const ticker = makeTicker();
    const first = { id: 1 };
    const second = { id: 2 };
    (ticker as any).npcs.push(first, second);
    (ticker as any).lastTickTime = 100;
    (ticker as any).fixedRateTicker.advanceClock = () => 3;
    (ticker as any).tickNpc = (npc: { id: number }, count: number) =>
      new TickUpdates([{ id: npc.id, marker: count } as any]);

    const updates = await (ticker as any).generateUpdates();

    assert.deepEqual(updates.state, [
      { id: 1, marker: 3 },
      { id: 2, marker: 3 },
    ]);
  });

  it("records tick timestamps and durations around managed-NPC refresh and generation", async () => {
    const ticker = makeTicker();
    const now = sinon.stub(performance, "now");
    now.onFirstCall().returns(1000);
    now.onSecondCall().returns(1007);
    const calls: string[] = [];
    (ticker as any).updateManagedNpcs = () => calls.push("refresh");
    (ticker as any).generateUpdates = async () => {
      calls.push("generate");
      return new TickUpdates();
    };
    try {
      await ticker.tick();
    } finally {
      now.restore();
    }

    assert.deepEqual(calls, ["refresh", "generate"]);
    assert.equal(ticker.lastTickTime, 1000);
    assert.equal(ticker.lastTickDuration, 7);
  });

  it("finishes locked NPCs without running movement or combat behavior", () => {
    const entity = Npc.from({
      ...npcEntity(
        {
          id: 8_001 as BiomesId,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        1
      ),
      locked_in_place: LockedInPlace.create(),
    });
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);
    const ticker = makeTicker();

    assert.equal(ticker.tickNpcMultipleTimes(npc, 3), undefined);
    assert.deepEqual(npc.position, entity.position!.v);
  });

  it("kills time-constrained spawn-event NPCs when the world is in the opposite phase", () => {
    const spawnEventId = 8_991_002 as BiomesId;
    const currentIsDay = isDayTime(sunInclination(secondsSinceEpoch()));
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          spawnEventId,
          {
            id: spawnEventId,
            name: "animaTickerPhaseSpawn",
            npcBag: [[BikkieIds.dMucker, 1]],
            spawnConstraints: zSpawnConstraints.parse({
              terrainType: ["grass"],
              timeOfDay: currentIsDay ? "night" : "day",
            }),
            density: 1,
            enabled: true,
          } as any,
        ],
      ])
    );
    const entity = Npc.from(
      npcEntity(
        {
          id: 8_002 as BiomesId,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
          spawnEvent: {
            id: 8_003 as BiomesId,
            typeId: spawnEventId,
            position: [0, 0, 0],
          },
        },
        1
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);

    const updates = makeTicker().tickNpcMultipleTimes(npc, 1);

    assert.equal(updates?.state[0]?.health?.hp, 0);
  });
});
