import assert from "assert";
import {
  readHarthmereLiveModePlayerStatusStateForActorV1,
  shouldPersistHarthmerePlayerStatusStaminaTickV1,
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

  it("persists survival stamina drain only when gameplay is active", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.combat.resources.stamina = 108;
    backend.combat.maxResources.stamina = 108;
    backend.combat.lastStaminaTickMs = NOW_MS - 60 * 60 * 1000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.resources.stamina, 81);
    assert.equal(persisted.combat.resources.stamina, 81);
    assert.equal(persisted.combat.lastStaminaTickMs, NOW_MS);
    assert.equal(snapshot.combat.deathState, "alive");
  });

  it("uses a four-hour stamina clock for custom max stamina pools", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.combat.resources.stamina = 200;
    backend.combat.maxResources.stamina = 200;
    backend.combat.lastStaminaTickMs = NOW_MS - 60 * 60 * 1000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.resources.stamina, 150);
    assert.equal(persisted.combat.resources.stamina, 150);
    assert.equal(snapshot.combat.maxResources.stamina, 200);
    assert.equal(snapshot.combat.deathState, "alive");
  });

  it("marks live player status dead when active stamina reaches zero", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.combat.hp = 80;
    backend.combat.resources.stamina = 1;
    backend.combat.maxResources.stamina = 100;
    backend.combat.lastStaminaTickMs = NOW_MS - 10 * 60 * 1000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.hp, 0);
    assert.equal(snapshot.combat.deathState, "dead");
    assert.equal(snapshot.combat.resources.stamina, 0);
    assert.ok(persisted.combat.deadFromStaminaAtMs);
    assert.ok(Object.keys(persisted.combat.deathRecords).length > 0);
  });

  it("throttles tiny stamina polling writes without hiding death transitions", () => {
    assert.equal(
      shouldPersistHarthmerePlayerStatusStaminaTickV1({
        changed: true,
        deathTriggered: false,
        previousStamina: 100,
        nextStamina: 99.8,
        previousUpdatedAtMs: NOW_MS - 1000,
        nowMs: NOW_MS,
        throttleMs: 5000,
        meaningfulDelta: 1,
      }),
      false
    );
    assert.equal(
      shouldPersistHarthmerePlayerStatusStaminaTickV1({
        changed: true,
        deathTriggered: false,
        previousStamina: 100,
        nextStamina: 98.5,
        previousUpdatedAtMs: NOW_MS - 1000,
        nowMs: NOW_MS,
        throttleMs: 5000,
        meaningfulDelta: 1,
      }),
      true
    );
    assert.equal(
      shouldPersistHarthmerePlayerStatusStaminaTickV1({
        changed: true,
        deathTriggered: true,
        previousStamina: 1,
        nextStamina: 0,
        previousUpdatedAtMs: NOW_MS - 1000,
        nowMs: NOW_MS,
        throttleMs: 5000,
        meaningfulDelta: 1,
      }),
      true
    );
  });
});
