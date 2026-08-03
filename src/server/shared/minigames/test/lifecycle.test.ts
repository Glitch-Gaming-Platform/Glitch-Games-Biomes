import { validMinigameInstance } from "@/pages/api/minigames/active_instances";
import type { LazyEntity } from "@/server/shared/ecs/gen/lazy";
import { requiredDeathmatchPlayerCount } from "@/server/shared/minigames/deathmatch/util";
import { reachedAllCheckpoints } from "@/server/shared/minigames/simple_race/util";
import { requiredSpleefPlayerCount } from "@/server/shared/minigames/spleef/util";
import { eventTriggerMatchesEventForTest } from "@/server/shared/triggers/leaves/event";
import {
  MinigameComponent,
  MinigameInstance,
} from "@/shared/ecs/gen/components";
import type { FirehoseEvent } from "@/shared/firehose/events";
import {
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_RACE_MINIGAME_ID,
  NATIVE_GET_THE_MUCK_OUT_RACE_STEP_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("shared minigame lifecycle contracts", () => {
  it("requires the exact race checkpoint set, not merely the same count", () => {
    const checkpointA = 101 as BiomesId;
    const checkpointB = 102 as BiomesId;
    const forged = 999 as BiomesId;
    const game = MinigameComponent.create({
      metadata: {
        kind: "simple_race",
        start_ids: new Set([1 as BiomesId]),
        checkpoint_ids: new Set([checkpointA, checkpointB]),
        end_ids: new Set([2 as BiomesId]),
      },
    });
    const instance = MinigameInstance.create({
      minigame_id: 10 as BiomesId,
      state: {
        kind: "simple_race",
        player_state: "racing",
        reached_checkpoints: new Map([
          [checkpointA, { time: 1 }],
          [forged, { time: 2 }],
        ]),
        deaths: 0,
        started_at: 0,
        finished_at: undefined,
      },
    });
    assert.equal(reachedAllCheckpoints(game, instance), false);
    instance.state.kind === "simple_race" &&
      instance.state.reached_checkpoints.set(checkpointB, { time: 3 });
    assert.equal(reachedAllCheckpoints(game, instance), true);
  });

  it("makes persisted player thresholds explicit for Spleef and Deathmatch", () => {
    assert.equal(requiredSpleefPlayerCount({ minPlayers: 0 }), 1);
    assert.equal(requiredSpleefPlayerCount({ minPlayers: 1 }), 2);
    assert.equal(requiredDeathmatchPlayerCount({ minPlayers: 2 }), 2);
    assert.equal(requiredDeathmatchPlayerCount({ minPlayers: 3.8 }), 3);
  });

  it("does not advertise finished Deathmatch instances as joinable", () => {
    const fake = (state: unknown, finished = false, iced = false) =>
      ({
        minigameInstance: () => ({ finished, state }),
        hasIced: () => iced,
      }) as unknown as LazyEntity;
    assert.equal(
      validMinigameInstance(
        fake({
          kind: "deathmatch",
          instance_state: { kind: "waiting_for_players" },
        })
      ),
      true
    );
    assert.equal(
      validMinigameInstance(
        fake({
          kind: "deathmatch",
          instance_state: { kind: "finished", timestamp: 1 },
        })
      ),
      false
    );
    assert.equal(validMinigameInstance(fake({ kind: "spleef" }, true)), false);
    assert.equal(
      validMinigameInstance(fake({ kind: "spleef" }, false, true)),
      false
    );
  });

  it("pins Get the Muck Out's formerly unscoped race leaf to Mucker Den Dash", () => {
    const trigger = {
      questId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      triggerId: NATIVE_GET_THE_MUCK_OUT_RACE_STEP_ID,
      eventKind: "minigame_simple_race_finish" as const,
      predicate: undefined,
    };
    const event = (minigameId: BiomesId) =>
      ({
        kind: "minigame_simple_race_finish",
        entityId: 1 as BiomesId,
        minigameCreatorId: 2 as BiomesId,
        minigameId,
        minigameInstanceId: 3 as BiomesId,
        startTime: 0,
        finishTime: 1,
        duration: 1,
      }) as FirehoseEvent;
    assert.equal(
      eventTriggerMatchesEventForTest(
        trigger,
        event(NATIVE_GET_THE_MUCK_OUT_RACE_MINIGAME_ID)
      ),
      true
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        trigger,
        event(8063135068473629 as BiomesId)
      ),
      false
    );
  });
});
