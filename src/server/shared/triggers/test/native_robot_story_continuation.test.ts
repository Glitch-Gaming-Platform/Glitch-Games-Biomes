import { ChallengeCompleteTrigger } from "@/server/shared/triggers/leaves/challengeComplete";
import { QuestExecutor } from "@/server/shared/triggers/roots/quest";
import { BikkieRuntime } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { Challenges, TriggerState } from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { NATIVE_CH1_FIRST_QUEST_ID } from "@/shared/harthmere/ch1_native_quests";
import {
  NATIVE_HOEDOWN_QUEST_ID,
  NATIVE_PARCEL_PURSUIT_QUEST_ID,
} from "@/shared/harthmere/native_post_gimme_contract";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import assert from "assert";

const JACKIE_ID = 8997551883502307 as BiomesId;
const SOPHIA_ID = 7976997825186729 as BiomesId;
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
          NATIVE_GIMME_SHELTER_QUEST_ID,
          questBiscuit(
            NATIVE_GIMME_SHELTER_QUEST_ID,
            "Gimme Shelter",
            SOPHIA_ID
          ),
        ],
        [
          NATIVE_CH1_FIRST_QUEST_ID,
          questBiscuit(NATIVE_CH1_FIRST_QUEST_ID, "The Morning After"),
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

    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true
    );
  });

  it("starts Chapter 1 and Gimme Shelter together when Muck vs. Machine completes", () => {
    const player = playerWithCompleted(NATIVE_GET_THE_MUCK_OUT_QUEST_ID);
    player.mutableChallenges().in_progress.add(NATIVE_MUCK_VS_MACHINE_QUEST_ID);
    const muckVsMachine = executor(
      NATIVE_MUCK_VS_MACHINE_QUEST_ID,
      NATIVE_GET_THE_MUCK_OUT_QUEST_ID
    );
    const { context, published } = contextFor(
      player,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    );

    muckVsMachine.transitionState(context, "completed");

    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true,
      "robot setup remains playable"
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true,
      "Chapter 1 starts in the same completion transaction"
    );
    assert.deepEqual(
      published
        .filter((event) => event.kind === "challengeUnlocked")
        .map((event) => event.challenge)
        .sort((left, right) => Number(left) - Number(right)),
      [NATIVE_GIMME_SHELTER_QUEST_ID, NATIVE_CH1_FIRST_QUEST_ID].sort(
        (left, right) => Number(left) - Number(right)
      )
    );

    const gimmeShelter = executor(
      NATIVE_GIMME_SHELTER_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    );
    gimmeShelter.transitionState(
      contextFor(player, NATIVE_GIMME_SHELTER_QUEST_ID).context,
      "completed"
    );
    assert.equal(
      player.challenges()?.complete.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true,
      "finishing robot setup must not consume or reset Chapter 1"
    );
  });

  it("repairs a saved player with completed Muck vs. Machine and active Gimme Shelter", () => {
    const player = playerWithCompleted(NATIVE_MUCK_VS_MACHINE_QUEST_ID);
    player.mutableChallenges().in_progress.add(NATIVE_GIMME_SHELTER_QUEST_ID);
    const chapterOne = executor(
      NATIVE_CH1_FIRST_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    );

    chapterOne.run(contextFor(player, NATIVE_CH1_FIRST_QUEST_ID).context);

    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true,
      "the next trigger pass repairs the missing Chapter 1 handoff"
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true,
      "repairing Chapter 1 preserves the active robot setup quest"
    );
  });

  it("repairs a legacy available Chapter 1 handoff without requiring acceptance", () => {
    const player = playerWithCompleted(NATIVE_MUCK_VS_MACHINE_QUEST_ID);
    player.mutableChallenges().in_progress.add(NATIVE_GIMME_SHELTER_QUEST_ID);
    player.mutableChallenges().available.add(NATIVE_CH1_FIRST_QUEST_ID);
    const chapterOne = executor(
      NATIVE_CH1_FIRST_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    );

    chapterOne.run(contextFor(player, NATIVE_CH1_FIRST_QUEST_ID).context);

    assert.equal(
      player.challenges()?.available.has(NATIVE_CH1_FIRST_QUEST_ID),
      false
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true
    );
  });

  it("repairs Chapter 1 after the player has completed Gimme Shelter and moved on", () => {
    const player = playerWithCompleted(
      NATIVE_MUCK_VS_MACHINE_QUEST_ID,
      NATIVE_GIMME_SHELTER_QUEST_ID,
      NATIVE_PARCEL_PURSUIT_QUEST_ID
    );
    player.mutableChallenges().in_progress.add(NATIVE_HOEDOWN_QUEST_ID);
    const chapterOne = executor(
      NATIVE_CH1_FIRST_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    );

    chapterOne.run(contextFor(player, NATIVE_CH1_FIRST_QUEST_ID).context);

    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_CH1_FIRST_QUEST_ID),
      true,
      "a player who moved beyond Gimme Shelter still receives Chapter 1"
    );
    assert.equal(
      player.challenges()?.complete.has(NATIVE_GIMME_SHELTER_QUEST_ID),
      true,
      "the recovery must preserve completed Gimme Shelter state"
    );
    assert.equal(
      player.challenges()?.complete.has(NATIVE_PARCEL_PURSUIT_QUEST_ID),
      true,
      "the recovery must preserve later completed Grove work"
    );
    assert.equal(
      player.challenges()?.in_progress.has(NATIVE_HOEDOWN_QUEST_ID),
      true,
      "the recovery must preserve later active Grove work"
    );
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
