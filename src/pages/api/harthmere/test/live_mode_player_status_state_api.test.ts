import assert from "assert";
import {
  readHarthmereLiveModePlayerStatusStateForActorV1,
} from "../live_mode_player_status_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_status_001";
const NOW_MS = 1_700_200_000_000;

describe("live_mode_player_status_state API route integration", () => {
  it("returns live health, primary resource, level, gold, and standing", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.classMagic.classId = "mage";
    backend.classMagic.skills.character_level = { xp: 1250, level: 1 };
    backend.combat.hp = 44;
    backend.combat.maxHp = 120;
    backend.combat.resources.mana = 7;
    backend.combat.maxResources.mana = 130;
    backend.inventory.gold = 33;
    backend.law.standing.harthmere = {
      likeability: 30,
      legal: -15,
      notoriety: 24,
      notorietyFloor: 0,
    };
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return JSON.stringify(backend);
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [harthmereLiveModePlayerStateKeyV1(ACTOR)]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.classId, "mage");
    assert.equal(snapshot.level, 2);
    assert.equal(snapshot.xp.current, 250);
    assert.equal(snapshot.combat.hp, 44);
    assert.equal(snapshot.combat.primaryResource, "mana");
    assert.equal(snapshot.combat.resource, 7);
    assert.equal(snapshot.gold, 33);
    assert.deepEqual(snapshot.standing, {
      scopeId: "harthmere",
      likeability: 30,
      legal: -15,
      notoriety: 24,
      notorietyFloor: 0,
      legacyReputation: 0,
    });
  });

  it("returns a playable default status when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModePlayerStatusStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.classId, "warrior");
    assert.equal(snapshot.combat.hp, snapshot.combat.maxHp);
    assert.ok(snapshot.combat.resource > 0);
    assert.equal(snapshot.standing.likeability, 0);
  });
});
