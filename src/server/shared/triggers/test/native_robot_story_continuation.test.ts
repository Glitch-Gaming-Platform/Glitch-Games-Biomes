import { ChallengeCompleteTrigger } from "@/server/shared/triggers/leaves/challengeComplete";
import { QuestExecutor } from "@/server/shared/triggers/roots/quest";
import { BikkieRuntime } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { Challenges, TriggerState } from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { FirehoseEvent } from "@/shared/firehose/events";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import assert from "assert";

const JACKIE_ID = 8997551883502307 as BiomesId;
const unrelatedQuestId = 7000000000000001 as BiomesId;

function questBiscuit(
  id: BiomesId,
  displayName: string,
  questGiver?: BiomesId
): Biscuit {
  return {
    id,
    name: displayName,
    displayName,
    isQuest: true,
    questCategory: "main",
    questGiver,
    repeatableCadence: "never",
  } as Biscuit;
}

function executor(id: BiomesId, predecessor: BiomesId) {
  return new QuestExecutor(
    id,
    new ChallengeCompleteTrigger(
      { id: (id - 1) as BiomesId, kind: "challengeComplete" },
      predecessor
    ),
    // Keep the newly started chapter active; these tests are about lifecycle,
    // not completing its authored objective tree.
    { update: () => false } as any,
    undefined
  );
}

function contextFor(entity: EntityBackedDelta, rootId: BiomesId) {
  const states = new Map<BiomesId, MetaState<any>>();
  const published: FirehoseEvent[] = [];
  return {
    published,
    context: {
      entity,
      events: [],
      rootId,
      publish: (event: FirehoseEvent) => published.push(event),
      updateState: (
        id: BiomesId,
        _schema: unknown,
        fn: (state: any) => any
      ) => {
        const next = fn(states.get(id) ?? {});
        states.set(id, next);
        return next;
      },
      clearState: (id: BiomesId) => states.delete(id),
    } as any,
  };
}

describe("native robot story automatic continuation", () => {
  let priorRuntime: BikkieRuntime | undefined;

  beforeEach(() => {
    priorRuntime = global.bikkieRuntime;
    global.bikkieRuntime = new BikkieRuntime();
    global.bikkieRuntime.registerBiscuits(
      new Map([
        [
          NATIVE_ROAD_AHEAD_QUEST_ID,
          questBiscuit(NATIVE_ROAD_AHEAD_QUEST_ID, "The Road Ahead"),
        ],
        [
          NATIVE_BUSTED_QUEST_ID,
          questBiscuit(NATIVE_BUSTED_QUEST_ID, "Busted", JACKIE_ID),
        ],
        [
          NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
          questBiscuit(
            NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
            "Get the Muck Out",
            JACKIE_ID
          ),
        ],
        [
          NATIVE_MUCK_VS_MACHINE_QUEST_ID,
          questBiscuit(NATIVE_MUCK_VS_MACHINE_QUEST_ID, "Muck vs. Machine"),
        ],
        [
          unrelatedQuestId,
          questBiscuit(unrelatedQuestId, "Unrelated Offer", JACKIE_ID),
        ],
      ])
    );
  });

  afterEach(() => {
    if (priorRuntime) {
      global.bikkieRuntime = priorRuntime;
    } else {
      delete (global as { bikkieRuntime?: BikkieRuntime }).bikkieRuntime;
    }
  });

  function playerWithCompleted(...complete: BiomesId[]) {
    return new EntityBackedDelta({
      id: 1 as BiomesId,
      challenges: Challenges.create({ complete: new Set(complete) }),
      trigger_state: TriggerState.create(),
    } as Entity);
  }

  it("starts every restored robot chapter immediately after its predecessor", () => {
    const player = playerWithCompleted(NATIVE_ROAD_AHEAD_QUEST_ID);
    const chain = [
      executor(NATIVE_BUSTED_QUEST_ID, NATIVE_ROAD_AHEAD_QUEST_ID),
      executor(NATIVE_GET_THE_MUCK_OUT_QUEST_ID, NATIVE_BUSTED_QUEST_ID),
      executor(
        NATIVE_MUCK_VS_MACHINE_QUEST_ID,
        NATIVE_GET_THE_MUCK_OUT_QUEST_ID
      ),
    ];

    for (const chapter of chain) {
      const { context, published } = contextFor(player, chapter.id);
      chapter.run(context);
      assert.equal(player.challenges()?.in_progress.has(chapter.id), true);
      assert.equal(player.challenges()?.available.has(chapter.id), false);
      assert.equal(
        published.some(
          (event) =>
            event.kind === "challengeUnlocked" && event.challenge === chapter.id
        ),
        true
      );
      chapter.transitionState(context, "completed");
      assert.equal(player.challenges()?.complete.has(chapter.id), true);
    }
  });

  it("repairs legacy available chapters without duplicating completed work", () => {
    const player = playerWithCompleted(NATIVE_ROAD_AHEAD_QUEST_ID);
    player.mutableChallenges().available.add(NATIVE_BUSTED_QUEST_ID);
    const busted = executor(NATIVE_BUSTED_QUEST_ID, NATIVE_ROAD_AHEAD_QUEST_ID);

    busted.run(contextFor(player, NATIVE_BUSTED_QUEST_ID).context);
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_BUSTED_QUEST_ID),
      true
    );
    assert.equal(
      player.challenges()?.available.has(NATIVE_BUSTED_QUEST_ID),
      false
    );

    busted.transitionState(
      contextFor(player, NATIVE_BUSTED_QUEST_ID).context,
      "completed"
    );
    const { context, published } = contextFor(player, NATIVE_BUSTED_QUEST_ID);
    busted.run(context);
    assert.equal(published.length, 0);
    assert.equal(
      player.challenges()?.complete.has(NATIVE_BUSTED_QUEST_ID),
      true
    );
  });

  it("does not promote a corrupt available chapter before its predecessor", () => {
    const player = playerWithCompleted();
    player.mutableChallenges().available.add(NATIVE_BUSTED_QUEST_ID);
    const busted = executor(NATIVE_BUSTED_QUEST_ID, NATIVE_ROAD_AHEAD_QUEST_ID);

    busted.run(contextFor(player, NATIVE_BUSTED_QUEST_ID).context);
    assert.equal(
      player.challenges()?.available.has(NATIVE_BUSTED_QUEST_ID),
      true
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_BUSTED_QUEST_ID),
      false
    );
  });

  it("does not auto-accept unrelated quest-giver offers", () => {
    const player = playerWithCompleted(NATIVE_ROAD_AHEAD_QUEST_ID);
    const unrelated = executor(unrelatedQuestId, NATIVE_ROAD_AHEAD_QUEST_ID);

    unrelated.run(contextFor(player, unrelatedQuestId).context);
    assert.equal(player.challenges()?.available.has(unrelatedQuestId), true);
    assert.equal(player.challenges()?.in_progress.has(unrelatedQuestId), false);
  });
});
