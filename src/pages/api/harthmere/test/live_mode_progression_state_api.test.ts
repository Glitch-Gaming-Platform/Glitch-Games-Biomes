import assert from "assert";
import { readHarthmereLiveModeProgressionStateForActor } from "../live_mode_progression_state";
import {
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
} from "@/shared/harthmere/live_mode_backend";

const ACTOR = "player_api_progression_001";
const NOW_MS = 1_700_200_000_000;

describe("live_mode_progression_state API route integration", () => {
  it("reads Redis state and returns the progression snapshot for the actor", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.classMagic.classId = "bard";
    backend.classMagic.specializationId = "maestro";
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

    const snapshot = await readHarthmereLiveModeProgressionStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [
      harthmereLiveModePlayerStateKey(ACTOR),
      harthmereLiveModeSharedWorldStateKey(),
    ]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.currentClassId, "bard");
    assert.equal(snapshot.currentSpecializationId, "maestro");
    assert.ok(
      snapshot.skills.some(
        (skill) => skill.id === "performance" && skill.level === 2
      )
    );
    assert.ok(
      snapshot.collections.some(
        (entry) => entry.id === "npc:jackie" && entry.discovered
      )
    );
    assert.deepEqual(Object.keys(snapshot.questState.active).sort(), [
      "building_system_intro_talk_to_mira",
      "read-the-jobs-board",
    ]);
  });

  it("uses one Redis MGET for actor and shared progression state when available", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.classMagic.classId = "mage";
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

    const snapshot = await readHarthmereLiveModeProgressionStateForActor({
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
    assert.equal(snapshot.currentClassId, "mage");
  });

  it("returns default progression state when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModeProgressionStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.currentClassId, "warrior");
    assert.ok(snapshot.classes.length >= 9);
    assert.ok(
      snapshot.abilities.some(
        (ability) => ability.id === "basic_strike" && ability.known
      )
    );
    assert.deepEqual(Object.keys(snapshot.questState.active).sort(), [
      "building_system_intro_talk_to_mira",
      "read-the-jobs-board",
    ]);
  });
});
