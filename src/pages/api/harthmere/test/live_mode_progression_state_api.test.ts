import assert from "assert";
import {
  readHarthmereLiveModeProgressionStateForActorV1,
} from "../live_mode_progression_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_progression_001";
const NOW_MS = 1_700_200_000_000;

describe("live_mode_progression_state API route integration", () => {
  it("reads Redis state and returns the progression snapshot for the actor", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.classMagic.classId = "bard";
    backend.classMagic.skills.performance = { xp: 120, level: 2 };
    backend.collections.discovered["npc:jackie"] = NOW_MS - 1000;
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return JSON.stringify(backend);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeProgressionStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [harthmereLiveModePlayerStateKeyV1(ACTOR)]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.currentClassId, "bard");
    assert.ok(snapshot.skills.some((skill) => skill.id === "performance" && skill.level === 2));
    assert.ok(snapshot.collections.some((entry) => entry.id === "npc:jackie" && entry.discovered));
  });

  it("returns default progression state when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModeProgressionStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.currentClassId, "warrior");
    assert.ok(snapshot.classes.length >= 9);
    assert.ok(snapshot.abilities.some((ability) => ability.id === "basic_strike" && ability.known));
  });
});
