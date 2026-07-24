import assert from "assert";
import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { Challenges, TriggerState } from "@/shared/ecs/gen/components";
import {
  harthmereNativeQuestId,
  harthmereNativeQuestStepId,
} from "@/shared/harthmere/harthmere_native_quests";

function questMaterializationFixture(actorId: number) {
  let challenges = Challenges.create();
  let triggerState = TriggerState.create();
  const receipts = new Map<string, string>();
  const actor = {
    challenges: () => challenges,
    triggerState: () => triggerState,
  };
  const worldApi = {
    get: async (id: number) => (id === actorId ? actor : undefined),
    apply: async ({ changes }: any) => {
      const update = changes.find(
        (change: any) =>
          change.kind === "update" && change.entity.id === actorId
      );
      if (update?.entity.challenges) challenges = update.entity.challenges;
      if (update?.entity.trigger_state) {
        triggerState = update.entity.trigger_state;
      }
      return { outcome: "success" };
    },
  } as any;
  const redisPrimary = {
    get: async (key: string) => receipts.get(key) ?? null,
    set: async (key: string, value: string) => {
      receipts.set(key, value);
    },
    del: async (key: string) => {
      receipts.delete(key);
    },
  };
  return {
    state: () => ({ challenges, triggerState }),
    worldApi,
    redisPrimary,
  };
}

describe("native hidden quest materialization", () => {
  it("starts a server-approved giver-less quest without a fake NPC", async () => {
    const actorId = 8290811499731977 as any;
    const questId = "harthmere_sq_041_the_doorway_that_wasnt";
    const challengeId = harthmereNativeQuestId("bible", questId)!;
    const fixture = questMaterializationFixture(actorId);

    const result = await materializeHarthmereNativeEcsPlans({
      redisPrimary: fixture.redisPrimary,
      worldApi: fixture.worldApi,
      idGenerator: {} as any,
      plans: [
        {
          kind: "quest_accept",
          materializationKey: "hidden-quest-accept-test",
          actorId: String(actorId),
          questSource: "bible",
          questId,
          sourceKind: "test_hidden_discovery",
        },
      ],
    });

    assert.equal(result.created, 1);
    const { challenges } = fixture.state();
    assert.ok(challenges.in_progress.has(challengeId));
    assert.ok(!challenges.available.has(challengeId));
    assert.ok(challenges.started_at.has(challengeId));
  });

  it("starts a visible-giver quest without a logic-replica race", async () => {
    const actorId = 8290811499731978 as any;
    const questId = "bellbound_q01_cracks_in_bridge";
    const challengeId = harthmereNativeQuestId("bible", questId)!;
    const fixture = questMaterializationFixture(actorId);

    await materializeHarthmereNativeEcsPlans({
      redisPrimary: fixture.redisPrimary,
      worldApi: fixture.worldApi,
      idGenerator: {} as any,
      plans: [
        {
          kind: "quest_accept",
          materializationKey: "visible-quest-accept-test",
          actorId: String(actorId),
          questSource: "bible",
          questId,
          giverEntityId: 8810000000010032 as any,
          sourceKind: "test_visible_giver",
        },
      ],
    });

    assert.ok(fixture.state().challenges.in_progress.has(challengeId));
  });

  it("atomically records every Bible objective and completes the challenge", async () => {
    const actorId = 8290811499731979 as any;
    const questId = "bellbound_q01_cracks_in_bridge";
    const challengeId = harthmereNativeQuestId("bible", questId)!;
    const objectiveIds = [
      "bellbound_q01_cracks_in_bridge_obj_01",
      "bellbound_q01_cracks_in_bridge_obj_02",
      "bellbound_q01_cracks_in_bridge_obj_03",
      "bellbound_q01_cracks_in_bridge_obj_04",
    ];
    const fixture = questMaterializationFixture(actorId);

    await materializeHarthmereNativeEcsPlans({
      redisPrimary: fixture.redisPrimary,
      worldApi: fixture.worldApi,
      idGenerator: {} as any,
      plans: objectiveIds.map((objectiveId) => ({
        kind: "quest_progress" as const,
        materializationKey: `bible-progress:${objectiveId}`,
        actorId: String(actorId),
        questSource: "bible" as const,
        questId,
        objectiveIdOrIndex: objectiveId,
        sourceKind: "test_bible_progress",
      })),
    });

    const { challenges, triggerState } = fixture.state();
    assert.ok(challenges.complete.has(challengeId));
    assert.ok(!challenges.in_progress.has(challengeId));
    assert.ok(challenges.finished_at.has(challengeId));
    assert.ok(!triggerState.by_root.has(challengeId));
  });

  it("records and completes a Grove objective even when accept needs repair", async () => {
    const actorId = 8290811499731980 as any;
    const questId = "read-the-jobs-board";
    const challengeId = harthmereNativeQuestId("grove", questId)!;
    const stepId = harthmereNativeQuestStepId("grove", questId, 0)!;
    const fixture = questMaterializationFixture(actorId);

    await materializeHarthmereNativeEcsPlans({
      redisPrimary: fixture.redisPrimary,
      worldApi: fixture.worldApi,
      idGenerator: {} as any,
      plans: [
        {
          kind: "quest_progress",
          materializationKey: "grove-progress:read-jobs-board",
          actorId: String(actorId),
          questSource: "grove",
          questId,
          objectiveIdOrIndex: 0,
          sourceKind: "test_grove_progress",
        },
      ],
    });

    const { challenges, triggerState } = fixture.state();
    assert.ok(challenges.complete.has(challengeId));
    assert.ok(challenges.finished_at.has(challengeId));
    assert.ok(!triggerState.by_root.has(challengeId));
    assert.ok(stepId);
  });
});
