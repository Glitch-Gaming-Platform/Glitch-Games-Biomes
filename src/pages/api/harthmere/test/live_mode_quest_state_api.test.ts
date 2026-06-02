import assert from "assert";
import { readHarthmereLiveModeQuestStateForActorV1 } from "../live_mode_quest_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_quest_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_quest_state API route integration", () => {
  it("uses one Redis MGET for actor and shared quest state when available", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.quests.active["api-test-quest"] = {
      questId: "api-test-quest",
      startedAtMs: NOW_MS,
      progress: { step: 1 },
      mapMarkers: [],
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
            key === harthmereLiveModePlayerStateKeyV1(ACTOR)
              ? JSON.stringify(backend)
              : null
          );
        },
      },
    };

    const snapshot = await readHarthmereLiveModeQuestStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(mgetCalls, [[
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      harthmereLiveModeSharedWorldStateKeyV1(),
    ]]);
    assert.deepEqual(getCalls, []);
    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.active["api-test-quest"]);
  });
});
