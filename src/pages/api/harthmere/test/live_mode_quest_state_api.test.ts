import assert from "assert";
import { readHarthmereLiveModeQuestStateForActor } from "../live_mode_quest_state";
import {
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
} from "@/shared/harthmere/live_mode_backend";

const ACTOR = "player_api_quest_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_quest_state API route integration", () => {
  it("returns only the allowed starter live-mode quests for a brand-new actor", async () => {
    const redis = {
      primary: {
        get: async () => null,
      },
    };

    const snapshot = await readHarthmereLiveModeQuestStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(Object.keys(snapshot.active).sort(), [
      "building_system_intro_talk_to_mira",
      "read-the-jobs-board",
    ]);
    assert.deepEqual(snapshot.completed, {});
  });

  it("uses one Redis MGET for actor and shared quest state when available", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.quests.active["api-test-quest"] = {
      progress: 1,
    };
    const mgetCalls: string[][] = [];
    const getCalls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          getCalls.push(key);
          return null;
        },
        mget: async (...keys: string[]) => {
          mgetCalls.push(keys);
          return keys.map((key) =>
            key === harthmereLiveModePlayerStateKey(ACTOR)
              ? JSON.stringify(backend)
              : null
          );
        },
      },
    };

    const snapshot = await readHarthmereLiveModeQuestStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(mgetCalls, [
      [
        harthmereLiveModePlayerStateKey(ACTOR),
        harthmereLiveModeSharedWorldStateKey(),
      ],
    ]);
    assert.deepEqual(getCalls, []);
    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.active["api-test-quest"]);
  });
});
