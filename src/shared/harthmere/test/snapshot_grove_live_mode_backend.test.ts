import assert from "assert";

import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "@/shared/harthmere/live_mode_readiness";
import { SNAPSHOT_STRUCTURED_REWARDS } from "@/shared/harthmere/snapshot_complete_port";
import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS,
  snapshotGroveObjectiveInventoryRequirement,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";

const NOW_MS = 1_800_000_000_000;
const ACTOR_ID = "snapshot-grove-backend-test-player";
let sequence = 0;

function freshState() {
  return defaultHarthmereLiveModeBackendState(ACTOR_ID, NOW_MS);
}

function applyQuestMutation(
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  const actionKind: HarthmereLiveModeActionKind = "request_quest_state_update";
  const envelope: HarthmereLiveModeAuthorityEnvelope = {
    requestId: `snapshot-grove-request-${++sequence}`,
    idempotencyKey: `snapshot-grove-idempotency-${sequence}`,
    actorId: ACTOR_ID,
    actionKind,
    subsystem: "quest",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: sequence,
    actorEntityVersion: sequence,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
    serverActorItemCounts: { ...state.inventory.items },
    serverActorPosition: { x: 496, y: 70, z: -126 },
    ...overrides,
  };
  return reduceHarthmereLiveModeBackendState(state, envelope, NOW_MS);
}

function snapshotQuestPayload(
  questId: string,
  objectiveIndex: number,
  progress: number,
  completed = false
) {
  const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === questId);
  assert.ok(quest, `missing Snapshot Grove quest ${questId}`);
  return {
    questId,
    source: "snapshot_grove",
    stepId: `${questId}:${objectiveIndex}:${quest.triggers[objectiveIndex]}`,
    objectiveIndex,
    progress,
    completed,
  };
}

describe("Snapshot Grove live-mode authority", () => {
  it("keeps counted-objective progress monotonic across stale cloud writes", () => {
    const state = freshState();
    state.quests.active.color_that_still_points_home = {
      source: "snapshot_grove",
      stepId: "color_that_still_points_home:1:destroy",
      progress: 2,
      objectiveProgress: {
        objectiveIndex: 1,
        count: 1,
        evidenceKeys: ["muckwad_pigment_clump_west"],
      },
    };

    const stale = applyQuestMutation(state, {
      questId: "color_that_still_points_home",
      source: "snapshot_grove",
      stepId: "color_that_still_points_home:0:collect",
      progress: 1,
      objectiveProgress: {
        objectiveIndex: 0,
        count: 0,
        evidenceKeys: [],
      },
    });

    assert.equal(
      stale.state.quests.active.color_that_still_points_home.progress,
      2
    );
    assert.equal(
      stale.state.quests.active.color_that_still_points_home.stepId,
      "color_that_still_points_home:1:destroy"
    );
    assert.deepEqual(
      stale.state.quests.active.color_that_still_points_home.objectiveProgress,
      {
        objectiveIndex: 1,
        count: 1,
        evidenceKeys: ["muckwad_pigment_clump_west"],
      }
    );
    assert.equal(
      stale.summary.nativeEcsMaterializationPlans?.some(
        (plan) => plan.kind === "quest_progress"
      ),
      false
    );
  });

  it("requires and consumes exact handoff inventory through native ECS", () => {
    const questId = "econ_carlo_festival_skewers";
    const state = freshState();
    state.quests.active[questId] = {
      source: "snapshot_grove",
      stepId: `${questId}:3:interact`,
      progress: 4,
    };
    const payload = snapshotQuestPayload(questId, 3, 5);

    const rejected = applyQuestMutation(state, payload, {
      serverActorItemCounts: {},
    });
    assert.ok(
      rejected.summary.warnings.includes(
        `snapshot_grove_quest_rejected:required_item:${SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer}`
      )
    );
    assert.equal(rejected.state.quests.active[questId].progress, 4);

    const withSkewer = freshState();
    withSkewer.quests.active[questId] = {
      source: "snapshot_grove",
      stepId: `${questId}:3:interact`,
      progress: 4,
    };
    withSkewer.inventory.items[
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer
    ] = 1;
    const accepted = applyQuestMutation(withSkewer, payload);

    assert.deepEqual(accepted.summary.warnings, []);
    assert.equal(accepted.state.quests.active[questId].progress, 5);
    assert.equal(
      accepted.state.inventory.items[
        SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer
      ] ?? 0,
      0
    );
    assert.ok(
      accepted.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "inventory_exchange" &&
          plan.consumeItemStacks[
            SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer
          ] === 1
      )
    );
  });

  it("does not double-consume final hand-in items during native reconciliation", () => {
    const questId = "econ_billys_lost_lunch_pail";
    const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === questId)!;
    const finalObjectiveIndex = quest.objectives.length - 1;
    const requirement = snapshotGroveObjectiveInventoryRequirement(
      quest,
      finalObjectiveIndex
    )!;
    const state = freshState();
    state.quests.active[questId] = {
      source: "snapshot_grove",
      stepId: `${questId}:${finalObjectiveIndex}:${quest.triggers[finalObjectiveIndex]}`,
      progress: quest.objectives.length,
    };
    state.inventory.items[requirement.itemId] = requirement.count;

    const completed = applyQuestMutation(
      state,
      snapshotQuestPayload(
        questId,
        finalObjectiveIndex,
        quest.objectives.length,
        true
      ),
      { serverActorGold: 0 }
    );
    const exchange = completed.summary.nativeEcsMaterializationPlans?.find(
      (plan) =>
        plan.kind === "inventory_exchange" &&
        plan.materializationKey.startsWith(`live_mode:${ACTOR_ID}:`)
    );
    assert.ok(exchange && exchange.kind === "inventory_exchange");
    assert.equal(
      exchange.consumeItemStacks[requirement.itemId],
      requirement.count
    );
  });

  it("does not double-grant Grove reward items during native reconciliation", () => {
    const questId = "road_signs_and_small_lies";
    const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === questId)!;
    const reward = SNAPSHOT_STRUCTURED_REWARDS.find(
      (entry) => entry.questId === questId
    )!;
    const finalObjectiveIndex = quest.objectives.length - 1;
    const state = freshState();
    state.quests.active[questId] = {
      source: "snapshot_grove",
      stepId: `${questId}:${finalObjectiveIndex}:${quest.triggers[finalObjectiveIndex]}`,
      progress: quest.objectives.length,
    };

    const completed = applyQuestMutation(
      state,
      snapshotQuestPayload(
        questId,
        finalObjectiveIndex,
        quest.objectives.length,
        true
      ),
      { serverActorGold: 0 }
    );
    const exchange = completed.summary.nativeEcsMaterializationPlans?.find(
      (plan) =>
        plan.kind === "inventory_exchange" &&
        plan.materializationKey.startsWith(`live_mode:${ACTOR_ID}:`)
    );
    assert.ok(exchange && exchange.kind === "inventory_exchange");
    for (const itemId of reward.items) {
      assert.equal(exchange.rewardItemStacks[itemId], 1);
    }
  });

  it("grants quest rewards once and materializes native progression", () => {
    const questId = "fountain_buttons_first";
    const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === questId)!;
    const reward = SNAPSHOT_STRUCTURED_REWARDS.find(
      (entry) => entry.questId === questId
    )!;
    const state = freshState();
    state.quests.active[questId] = {
      source: "snapshot_grove",
      stepId: `${questId}:${quest.objectives.length - 1}:talk_npc`,
      progress: quest.objectives.length,
    };

    const completed = applyQuestMutation(
      state,
      snapshotQuestPayload(
        questId,
        quest.objectives.length - 1,
        quest.objectives.length,
        true
      ),
      { serverActorGold: 0 }
    );

    assert.equal(completed.state.quests.active[questId], undefined);
    assert.ok(completed.state.quests.completed[questId]);
    assert.equal(completed.state.inventory.gold, reward.bling);
    assert.equal(
      completed.state.classMagic.skills.character_level?.xp,
      reward.xp
    );
    assert.equal(
      completed.state.economy.ledger.filter(
        (entry) => entry.id === `snapshot_grove_reward:${questId}`
      ).length,
      1
    );
    assert.ok(
      completed.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "quest_progress" &&
          plan.objectiveIdOrIndex === quest.objectives.length - 1
      )
    );
    assert.ok(
      completed.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "character_progress" &&
          plan.materializationKey ===
            `snapshot_grove_reward:${ACTOR_ID}:${questId}:xp` &&
          plan.xpDelta === reward.xp
      )
    );
    assert.ok(
      completed.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "inventory_exchange" &&
          plan.materializationKey.startsWith(`live_mode:${ACTOR_ID}:`) &&
          plan.goldDelta === reward.bling
      )
    );

    const replay = applyQuestMutation(
      completed.state,
      snapshotQuestPayload(
        questId,
        quest.objectives.length - 1,
        quest.objectives.length,
        true
      )
    );
    assert.equal(replay.state.inventory.gold, reward.bling);
    assert.equal(
      replay.state.economy.ledger.filter(
        (entry) => entry.id === `snapshot_grove_reward:${questId}`
      ).length,
      1
    );
  });

  const catalogE2E =
    process.env.HARTHMERE_GROVE_CATALOG_E2E === "1" ? it : it.skip;

  catalogE2E(
    "accepts and completes all 51 authored quests through the shared native authority path",
    function () {
      this.timeout(120_000);
      assert.equal(SNAPSHOT_GROVE_QUESTS.length, 51);

      for (const quest of SNAPSHOT_GROVE_QUESTS) {
        let state = freshState();
        const leadingTalkCompletesOnAcceptance =
          quest.triggers[0] === "talk_npc" && quest.objectives.length > 1;
        const accepted = leadingTalkCompletesOnAcceptance
          ? applyQuestMutation(state, snapshotQuestPayload(quest.id, 0, 2))
          : applyQuestMutation(state, {
              questId: quest.id,
              source: "snapshot_grove",
              stepId: `${quest.id}:0:${quest.triggers[0]}`,
              progress: 1,
            });
        assert.deepEqual(
          accepted.summary.warnings,
          [],
          `${quest.id}: acceptance failed`
        );
        state = accepted.state;
        assert.ok(
          accepted.summary.nativeEcsMaterializationPlans?.some(
            (plan) => plan.kind === "quest_accept" && plan.questId === quest.id
          ),
          `${quest.id}: native quest acceptance missing`
        );

        // Trigger-contract and runtime suites exercise every intermediate leaf.
        // Keep one reducer acceptance/completion pair per quest here so all 51
        // reward and lifecycle rows stay in the fast batch.
        const finalObjectiveIndex = quest.objectives.length - 1;
        state.quests.active[quest.id] = {
          ...state.quests.active[quest.id],
          source: "snapshot_grove",
          stepId: `${quest.id}:${finalObjectiveIndex}:${quest.triggers[finalObjectiveIndex]}`,
          progress: quest.objectives.length,
        };
        const finalRequirement = snapshotGroveObjectiveInventoryRequirement(
          quest,
          finalObjectiveIndex
        );
        if (finalRequirement) {
          state.inventory.items[finalRequirement.itemId] =
            finalRequirement.count;
        }
        const result = applyQuestMutation(
          state,
          snapshotQuestPayload(
            quest.id,
            finalObjectiveIndex,
            quest.objectives.length,
            true
          )
        );
        assert.deepEqual(
          result.summary.warnings,
          [],
          `${quest.id}[${finalObjectiveIndex}]: ${result.summary.warnings.join(
            ", "
          )}`
        );
        assert.ok(
          result.summary.nativeEcsMaterializationPlans?.some(
            (plan) =>
              plan.kind === "quest_progress" &&
              plan.questId === quest.id &&
              plan.objectiveIdOrIndex === finalObjectiveIndex
          ),
          `${quest.id}[${finalObjectiveIndex}]: native completion progress missing`
        );
        state = result.state;

        assert.equal(
          state.quests.active[quest.id],
          undefined,
          `${quest.id}: active record remained after completion`
        );
        assert.ok(
          state.quests.completed[quest.id],
          `${quest.id}: completed record missing`
        );
        assert.equal(
          state.economy.ledger.filter(
            (entry) => entry.id === `snapshot_grove_reward:${quest.id}`
          ).length,
          1,
          `${quest.id}: reward was not granted exactly once`
        );
      }
    }
  );
});
