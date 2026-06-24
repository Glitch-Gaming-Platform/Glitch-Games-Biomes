import assert from "assert";
import {
  readHarthmereLiveModePlayerStatusStateForActor,
  shouldPersistHarthmerePlayerStatusStaminaTick,
} from "../live_mode_player_status_state";
import {
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
} from "@/shared/harthmere/live_mode_backend";

const ACTOR = "player_api_status_001";
const NOW_MS = 1_700_200_000_000;

describe("live_mode_player_status_state API route integration", () => {
  it("returns live health, primary resource, level, gold, and standing", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
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

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [harthmereLiveModePlayerStateKey(ACTOR)]);
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
    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
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

  it("repairs stale active stamina backfill before draining", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
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

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.resources.stamina, 108);
    assert.equal(persisted.combat.resources.stamina, 108);
    assert.equal(persisted.combat.lastStaminaTickMs, NOW_MS);
    assert.equal(snapshot.backendAuthority.staminaPersisted, true);
    assert.equal(snapshot.combat.deathState, "alive");
  });

  it("persists gradual survival stamina drain during active gameplay polling", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.combat.resources.stamina = 108;
    backend.combat.maxResources.stamina = 108;
    backend.combat.lastStaminaTickMs = NOW_MS - 10_000;
    backend.updatedAtMs = NOW_MS - 10_000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    const stamina = snapshot.combat.resources.stamina ?? Number.NaN;
    assert.ok(Number.isFinite(stamina));
    assert.ok(
      stamina < 108 && stamina > 107,
      `expected a gradual stamina drain from 108, got ${stamina}`
    );
    assert.equal(persisted.combat.resources.stamina, stamina);
    assert.equal(persisted.combat.lastStaminaTickMs, NOW_MS);
    assert.equal(snapshot.backendAuthority.staminaPersisted, true);
  });

  it("counts material storage weight when applying stamina encumbrance", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.combat.resources.stamina = 108;
    backend.combat.maxResources.stamina = 108;
    backend.combat.lastStaminaTickMs = NOW_MS - 10_000;
    backend.updatedAtMs = NOW_MS - 10_000;
    backend.banking.materialStorage = { iron_ore: 1_400 };
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.ok(snapshot.combat.resources.stamina !== undefined);
    assert.ok(
      snapshot.combat.resources.stamina < 107,
      `expected encumbrance drain below base stamina, got ${snapshot.combat.resources.stamina}`
    );
    assert.equal(
      persisted.combat.resources.stamina,
      snapshot.combat.resources.stamina
    );
    assert.equal(snapshot.combat.deathState, "alive");
  });

  it("persists only the actor key and never WATCHes during status polling", async () => {
    const staleBackend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    staleBackend.inventory.gold = 1;
    staleBackend.combat.resources.stamina = 108;
    staleBackend.combat.maxResources.stamina = 108;
    staleBackend.combat.lastStaminaTickMs = NOW_MS - 60 * 60 * 1000;

    const watched: string[][] = [];
    const writes: Array<{ key: string; value: string }> = [];
    const redis = {
      primary: {
        get: async () => JSON.stringify(staleBackend),
        set: async (key: string, value: string) => {
          writes.push({ key, value });
        },
        watch: async (...keys: string[]) => {
          watched.push(keys);
        },
        unwatch: async () => {},
        multi: () => ({
          set: (_key: string, value: string) => {
            writes.push({ key: _key, value });
          },
          exec: async () => [],
        }),
      },
    };

    await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });

    assert.deepEqual(watched, []);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, harthmereLiveModePlayerStateKey(ACTOR));
    assert.equal(JSON.parse(writes[0].value).inventory.gold, 1);
  });

  it("uses a four-hour stamina clock for custom max stamina pools", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.combat.resources.stamina = 200;
    backend.combat.maxResources.stamina = 200;
    backend.combat.lastStaminaTickMs = NOW_MS - 20_000;
    backend.updatedAtMs = NOW_MS - 20_000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    const stamina = snapshot.combat.resources.stamina ?? Number.NaN;
    assert.ok(Number.isFinite(stamina));
    assert.ok(
      stamina < 200 && stamina > 199,
      `expected custom stamina pool to drain gradually, got ${stamina}`
    );
    assert.equal(persisted.combat.resources.stamina, stamina);
    assert.equal(snapshot.combat.maxResources.stamina, 200);
    assert.equal(snapshot.combat.deathState, "alive");
  });

  it("does not mark live player status dead when active status polling drains stamina to zero", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.combat.hp = 80;
    backend.combat.resources.stamina = 0.1;
    backend.combat.maxResources.stamina = 100;
    backend.combat.lastStaminaTickMs = NOW_MS - 20_000;
    backend.updatedAtMs = NOW_MS - 20_000;
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.hp, 80);
    assert.equal(snapshot.combat.deathState, "alive");
    assert.equal(snapshot.combat.resources.stamina, 0);
    assert.equal(persisted.combat.hp, 80);
    assert.equal(persisted.combat.deathState, "alive");
    assert.equal(persisted.combat.resources.stamina, 0);
    assert.equal(persisted.combat.deadFromStaminaAtMs, undefined);
    assert.equal(Object.keys(persisted.combat.deathRecords).length, 0);
  });

  it("repairs stale stamina deaths created by older status polling", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const deadAtMs = NOW_MS - 60_000;
    backend.combat.hp = 0;
    backend.combat.maxHp = 100;
    backend.combat.deathState = "dead";
    backend.combat.resources.stamina = 0;
    backend.combat.maxResources.stamina = 100;
    backend.combat.lastStaminaTickMs = deadAtMs;
    backend.combat.deadFromStaminaAtMs = deadAtMs;
    backend.combat.deathRecords[`stamina_depleted_${deadAtMs}`] = {
      deathId: `stamina_depleted_${deadAtMs}`,
      cause: "stamina_depleted",
      zoneId: "harthmere",
      atMs: deadAtMs,
      respawnAvailableAtMs: deadAtMs + 5_000,
    };
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.hp, 100);
    assert.equal(snapshot.combat.deathState, "alive");
    assert.equal(
      snapshot.combat.resources.stamina,
      snapshot.combat.maxResources.stamina
    );
    assert.equal(persisted.combat.hp, 100);
    assert.equal(persisted.combat.deathState, "alive");
    assert.equal(
      persisted.combat.resources.stamina,
      persisted.combat.maxResources.stamina
    );
    assert.equal(persisted.combat.deadFromStaminaAtMs, undefined);
  });

  it("persists zero-health alive snapshots as real deaths for the respawn overlay", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    backend.combat.hp = 0;
    backend.combat.maxHp = 100;
    backend.combat.deathState = "alive";
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: true,
    });
    const persisted = JSON.parse(stored);
    const deathRecords = Object.values(persisted.combat.deathRecords ?? {});

    assert.equal(snapshot.combat.hp, 0);
    assert.equal(snapshot.combat.deathState, "dead");
    assert.equal(persisted.combat.hp, 0);
    assert.equal(persisted.combat.deathState, "dead");
    assert.equal(deathRecords.length, 1);
    assert.ok(
      ["zero_hp_status_repair", "hp_zero_state_repaired"].includes(
        (deathRecords[0] as any).cause
      )
    );
  });

  it("does not revive non-stamina deaths during status polling", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const deadAtMs = NOW_MS - 60_000;
    backend.combat.hp = 0;
    backend.combat.maxHp = 100;
    backend.combat.deathState = "dead";
    backend.combat.deadFromStaminaAtMs = deadAtMs;
    backend.combat.deathRecords.fatal_fall_damage = {
      deathId: "fatal_fall_damage",
      cause: "fall_damage",
      zoneId: "harthmere",
      atMs: deadAtMs + 1,
      respawnAvailableAtMs: deadAtMs + 5_000,
    };
    let stored = JSON.stringify(backend);
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
      },
    };

    const snapshot = await readHarthmereLiveModePlayerStatusStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      gameplayActive: false,
    });
    const persisted = JSON.parse(stored);

    assert.equal(snapshot.combat.hp, 0);
    assert.equal(snapshot.combat.deathState, "dead");
    assert.equal(persisted.combat.hp, 0);
    assert.equal(persisted.combat.deathState, "dead");
  });

  it("throttles tiny stamina polling writes without hiding death transitions", () => {
    assert.equal(
      shouldPersistHarthmerePlayerStatusStaminaTick({
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
      shouldPersistHarthmerePlayerStatusStaminaTick({
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
      shouldPersistHarthmerePlayerStatusStaminaTick({
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
