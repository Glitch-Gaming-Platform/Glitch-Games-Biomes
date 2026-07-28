import assert from "assert";
import {
  runHarthmereLiveModeEscortSchedulerTick,
  type HarthmereLiveModeEscortRedis,
} from "@/server/harthmere/live_mode_escort_scheduler";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { Position } from "@/shared/ecs/gen/components";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  reduceHarthmereJobsBoardMutation,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { harthmereJobsBoardQuestMarkerPositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";

const NOW = 1_800_000_000_000;
const ACTOR_ID = 1234 as any;
const DURABLE_ACTOR_ID = "install:e4c81804-d210-40c2-8186-0690ada7e1e3";

class FakeRedis implements HarthmereLiveModeEscortRedis {
  readonly store = new Map<string, string>();
  readonly primary = {
    get: async (key: string) => this.store.get(key) ?? null,
    watch: async (..._keys: string[]) => undefined,
    unwatch: async () => undefined,
    multi: () => {
      const writes: Array<() => void> = [];
      return {
        set: (key: string, value: string) => {
          writes.push(() => this.store.set(key, value));
        },
        exec: async () => {
          writes.forEach((write) => write());
          return [];
        },
      };
    },
  };
}

describe("Harthmere native escort scheduler", () => {
  it("mirrors Anima's ECS position to complete one shared escort", async () => {
    const target = harthmereJobsBoardQuestMarkerPositionForId(
      "old_grove_road_post"
    )!;
    const state = defaultHarthmereLiveModeBackendState(DURABLE_ACTOR_ID, NOW);
    state.jobsBoard.postings.escort_scheduler_job = {
      jobId: "escort_scheduler_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Escort to the Road Post",
      description: "Walk a newcomer to the road post.",
      kind: "escort",
      requirements: [
        {
          serviceKind: "escort",
          serviceUnits: 1,
          targetId: "old_grove_road_post",
          mapMarkerId: "old_grove_road_post",
        },
      ],
      rewardGold: 25,
      escrowGold: 25,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW,
      deadlineAtMs: NOW + 86_400_000,
      failurePenaltyGold: 0,
      requiresFieldWork: true,
      mapMarkerId: "old_grove_road_post",
      targetId: "old_grove_road_post",
      abuseFlags: [],
      logs: [],
    } as any;
    const accepted = reduceHarthmereJobsBoardMutation(
      state.jobsBoard,
      {
        requestId: "escort-scheduler-accept",
        actorId: DURABLE_ACTOR_ID,
        nowMs: NOW,
        operation: "accept_job",
        jobId: "escort_scheduler_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      },
      {
        actorGold: 100,
        actorInventoryItems: {},
        actorEntityId: ACTOR_ID,
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }
    );
    assert.deepEqual(accepted.warnings, []);
    state.jobsBoard = accepted.jobsBoard;
    const companion =
      state.jobsBoard.postings.escort_scheduler_job.escortCompanion!;
    companion.position = {
      x: target.position[0] + 6,
      y: target.position[1],
      z: target.position[2],
    };

    const redis = new FakeRedis();
    redis.store.set(
      harthmereLiveModeSharedWorldStateKey(),
      JSON.stringify(createHarthmereLiveModeSharedWorldState(state, NOW))
    );
    const world = new InMemoryWorld();
    world.applyChanges([
      {
        kind: "create",
        entity: {
          id: ACTOR_ID,
          position: Position.create({ v: target.position }),
        },
      },
    ]);
    const worldApi = ShimWorldApi.createForWorld(world);

    const created = await runHarthmereLiveModeEscortSchedulerTick({
      redis,
      worldApi,
      nowMs: NOW + 1_000,
    });
    assert.deepEqual(created.changedCompanionIds, [companion.entityId]);
    assert.equal(created.syncedEcsCount, 1);

    let shared = parseHarthmereLiveModeSharedWorldState(
      redis.store.get(harthmereLiveModeSharedWorldStateKey()),
      NOW + 1_000
    )!;
    assert.equal(
      shared.jobsBoard.postings.escort_scheduler_job.escortCompanion?.status,
      "following"
    );

    // Model the authoritative Anima movement. The scheduler must observe this
    // ECS position; it may not advance a second Redis-only companion ahead of it.
    world.applyChanges([
      {
        kind: "update",
        entity: {
          id: companion.entityId,
          position: Position.create({ v: target.position }),
        },
      },
    ]);

    const arrived = await runHarthmereLiveModeEscortSchedulerTick({
      redis,
      worldApi,
      nowMs: NOW + 2_000,
    });
    assert.deepEqual(arrived.changedCompanionIds, [companion.entityId]);
    assert.equal(arrived.syncedEcsCount, 0);

    shared = parseHarthmereLiveModeSharedWorldState(
      redis.store.get(harthmereLiveModeSharedWorldStateKey()),
      NOW + 2_000
    )!;
    assert.equal(
      shared.jobsBoard.postings.escort_scheduler_job.escortCompanion?.status,
      "arrived"
    );
    assert.equal(Object.values(shared.jobsBoard.todos)[0].status, "completed");
    assert.ok(world.table.get(companion.entityId)?.npc_metadata);
  });
});
