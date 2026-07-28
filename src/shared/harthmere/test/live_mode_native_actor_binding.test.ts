import assert from "assert";
import {
  bindHarthmereNativeEcsMaterializationPlansToActorForTest,
  createHarthmereInventoryLootClientSnapshotFromBackend,
  defaultHarthmereLiveModeBackendState,
  projectHarthmereNativeEcsPlansOntoClientStateForTest,
  reduceHarthmereLiveModeBackendState,
  type HarthmereNativeEcsMaterializationPlan,
} from "@/shared/harthmere/live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";

const NOW_MS = 1_700_000_000_000;
const DURABLE_ACTOR_ID = "install:e4c81804-d210-40c2-8186-0690ada7e1e3";
const NATIVE_ACTOR_ID = 8290811499731977 as any;

function envelope(
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: "native-actor-binding",
    idempotencyKey: "native-actor-binding",
    actorId: DURABLE_ACTOR_ID,
    serverActorEntityId: NATIVE_ACTOR_ID,
    actionKind: "request_quest_state_update",
    subsystem: "quest",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: NOW_MS,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

describe("Harthmere stable save actor -> native ECS binding", () => {
  it("binds all current-player native plan actor fields without changing replay keys", () => {
    const plans: HarthmereNativeEcsMaterializationPlan[] = [
      {
        kind: "inventory_exchange",
        materializationKey: `parcel:${DURABLE_ACTOR_ID}`,
        actorId: DURABLE_ACTOR_ID,
        position: { x: 1, y: 2, z: 3 },
        consumeItemStacks: {},
        rewardItemStacks: { sealed_package: 1 },
        expiresAtMs: NOW_MS + 60_000,
        sourceKind: "parcel_test",
      },
      {
        kind: "drop",
        materializationKey: `drop:${DURABLE_ACTOR_ID}`,
        position: { x: 1, y: 2, z: 3 },
        itemStacks: { rough_stone: 1 },
        ownerActorIds: [DURABLE_ACTOR_ID],
        expiresAtMs: NOW_MS + 60_000,
        mined: false,
        sourceKind: "drop_test",
      },
    ];
    const bound = bindHarthmereNativeEcsMaterializationPlansToActorForTest(
      plans,
      DURABLE_ACTOR_ID,
      NATIVE_ACTOR_ID
    );
    assert.equal((bound[0] as any).actorId, String(NATIVE_ACTOR_ID));
    assert.deepEqual((bound[1] as any).ownerActorIds, [
      String(NATIVE_ACTOR_ID),
    ]);
    assert.equal(bound[0].materializationKey, plans[0].materializationKey);
  });

  it("repairs an already-active Billy quest with numeric accept and progress plans", () => {
    const questId = "econ_billys_lost_lunch_pail";
    const state = defaultHarthmereLiveModeBackendState(
      DURABLE_ACTOR_ID,
      NOW_MS
    );
    state.quests.active[questId] = {
      stepId: `${questId}:1:near_location`,
      progress: 2,
      source: "snapshot_grove",
    };
    const reduced = reduceHarthmereLiveModeBackendState(
      state,
      envelope({
        questId,
        source: "snapshot_grove",
        stepId: `${questId}:1:near_location`,
        progress: 2,
        objectiveIndex: 1,
      }),
      NOW_MS
    );
    const plans = reduced.summary.nativeEcsMaterializationPlans ?? [];
    const accept = plans.find((plan) => plan.kind === "quest_accept") as any;
    const progress = plans.find(
      (plan) => plan.kind === "quest_progress"
    ) as any;
    assert.equal(accept?.actorId, String(NATIVE_ACTOR_ID));
    assert.equal(progress?.actorId, String(NATIVE_ACTOR_ID));
  });

  it("creates a native accept plan for giver-less hidden bible quests", () => {
    const questId = "harthmere_sq_041_the_doorway_that_wasnt";
    const state = defaultHarthmereLiveModeBackendState(
      DURABLE_ACTOR_ID,
      NOW_MS
    );
    state.classMagic.skills.character_level = { xp: 0, level: 6 };
    const reduced = reduceHarthmereLiveModeBackendState(
      state,
      envelope({ operation: "bible_quest_accept", questId }),
      NOW_MS
    );
    const accept = reduced.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "quest_accept"
    );
    assert.ok(accept, "hidden discovery must begin its native challenge");
    assert.equal((accept as any).giverEntityId, undefined);
    assert.equal((accept as any).actorId, String(NATIVE_ACTOR_ID));
  });

  it("projects a successful native parcel exchange into the immediate frontend snapshot", () => {
    const state = defaultHarthmereLiveModeBackendState(
      DURABLE_ACTOR_ID,
      NOW_MS
    );
    const plan: HarthmereNativeEcsMaterializationPlan = {
      kind: "inventory_exchange",
      materializationKey: `parcel:${DURABLE_ACTOR_ID}`,
      actorId: String(NATIVE_ACTOR_ID),
      position: { x: 1, y: 2, z: 3 },
      consumeItemStacks: {},
      rewardItemStacks: { sealed_package: 1 },
      expiresAtMs: NOW_MS + 60_000,
      sourceKind: "parcel_test",
    };
    const projected = projectHarthmereNativeEcsPlansOntoClientStateForTest(
      state,
      envelope(
        { operation: "pickup_delivery_parcel" },
        {
          actionKind: "request_jobs_board_mutation",
          subsystem: "jobs",
          serverActorItemCounts: {},
          serverActorGold: 0,
        }
      ),
      [plan]
    );
    assert.equal(
      createHarthmereInventoryLootClientSnapshotFromBackend(projected).actor
        ?.items.sealed_package,
      1
    );
  });
});
