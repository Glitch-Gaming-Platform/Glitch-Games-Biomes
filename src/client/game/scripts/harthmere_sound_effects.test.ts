import { GardenHose } from "@/client/events/api";
import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import { HarthmereSoundEffectsScript } from "@/client/game/scripts/harthmere_sound_effects";
import { HARTHMERE_SOUND_EFFECT_EVENT } from "@/shared/harthmere/sound_effect_manifest";
import { serializeNpcCustomState } from "@/shared/npc/serde";
import assert from "assert";

class TestCustomEvent<T> extends Event {
  constructor(
    type: string,
    readonly detail: T
  ) {
    super(type);
  }
}

function emptyTable() {
  return {
    contents: () => [],
    get: () => undefined,
    events: { on() {}, off() {} },
  } as any;
}

describe("HarthmereSoundEffectsScript", () => {
  const originalWindow = (globalThis as any).window;
  const originalCustomEvent = (globalThis as any).CustomEvent;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).CustomEvent = originalCustomEvent;
  });

  it("routes direct, positional, object, and equipment sounds", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;

    const played: Array<{
      path: string;
      position?: readonly number[];
      idempotent?: boolean;
    }> = [];
    const audioManager = {
      playPath(path: string, options?: { idempotent?: boolean }) {
        played.push({ path, idempotent: options?.idempotent });
      },
      playPathAt(path: string, position: readonly number[]) {
        played.push({ path, position });
      },
    } as unknown as AudioManager;
    const gardenHose = new GardenHose();
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      gardenHose,
      emptyTable()
    );

    windowTarget.dispatchEvent(
      new TestCustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
        id: "shield_bash",
        position: [1, 2, 3],
      })
    );
    windowTarget.dispatchEvent(
      new TestCustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
        id: "splash",
        idempotent: true,
      })
    );
    windowTarget.dispatchEvent(
      new TestCustomEvent("biomes:harthmere-world-object-interaction", {
        kind: "open_container",
        label: "Iron Strongbox",
      })
    );
    gardenHose.publish({
      kind: "equip",
      operation: "unequip",
      itemId: "iron_longsword",
      slot: "main_hand",
    });
    gardenHose.publish({
      kind: "equip",
      operation: "equip",
      itemId: "iron_helmet",
      slot: "head",
    });

    assert.deepEqual(played[0], {
      path: "/assets/harthmere/audio/sfx/shield_bash.webm",
      position: [1, 2, 3],
    });
    assert.deepEqual(played[1], {
      path: "audio/splash-1",
      idempotent: true,
    });
    assert.equal(
      played[2].path,
      "/assets/harthmere/audio/sfx/open_container_metal.webm"
    );
    assert.equal(
      played[3].path,
      "/assets/harthmere/audio/sfx/weapon_unequip.webm"
    );
    assert.equal(played.length, 4);

    script.clear();
  });

  it("prewarms cold explosion assets and forwards their production spatial profile", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;

    const preloaded: string[] = [];
    const played: Array<{
      path: string;
      position: readonly number[];
      options: Record<string, number | undefined>;
    }> = [];
    const audioManager = {
      preloadPath(path: string) {
        preloaded.push(path);
      },
      playPath() {},
      playPathAt(
        path: string,
        position: readonly number[],
        options: Record<string, number | undefined>
      ) {
        played.push({ path, position, options });
      },
    } as unknown as AudioManager;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      emptyTable()
    );

    windowTarget.dispatchEvent(
      new TestCustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
        id: "fireball_explosion",
        preloadOnly: true,
      })
    );
    windowTarget.dispatchEvent(
      new TestCustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
        id: "fireball_explosion",
        position: [7, 8, 9],
        durationSeconds: 1.35,
        fadeOutSeconds: 0.4,
        volumeMultiplier: 1.15,
        refDistance: 7,
        maxDistance: 96,
        rolloffFactor: 0.65,
      })
    );

    assert.deepEqual(preloaded, [
      "/assets/harthmere/audio/sfx/fireball_explosion.webm",
    ]);
    assert.deepEqual(played, [
      {
        path: "/assets/harthmere/audio/sfx/fireball_explosion.webm",
        position: [7, 8, 9],
        options: {
          durationSeconds: 1.35,
          fadeOutSeconds: 0.4,
          volumeMultiplier: 1.15,
          refDistance: 7,
          maxDistance: 96,
          rolloffFactor: 0.65,
        },
      },
    ]);
    script.clear();
  });

  it("holds short combat cues until Web Audio is running instead of dropping them", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;
    let running = false;
    const played: string[] = [];
    const audioManager = {
      isRunning: () => running,
      preloadPath() {},
      playPath() {},
      playPathAt(path: string) {
        played.push(path);
      },
    } as unknown as AudioManager;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      emptyTable()
    );

    windowTarget.dispatchEvent(
      new TestCustomEvent(HARTHMERE_SOUND_EFFECT_EVENT, {
        id: "fireball_explosion",
        position: [1, 2, 3],
        durationSeconds: 1.2,
      })
    );
    assert.deepEqual(played, []);
    assert.equal(
      (windowTarget as any).__harthmereSoundEffectsDebug.pendingRequestCount,
      1
    );

    running = true;
    script.tick();
    assert.deepEqual(played, [
      "/assets/harthmere/audio/sfx/fireball_explosion.webm",
    ]);
    assert.equal(
      (windowTarget as any).__harthmereSoundEffectsDebug.pendingRequestCount,
      0
    );
    script.clear();
  });

  it("uses authoritative player status transitions for down, death, and revive", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;

    const played: string[] = [];
    const audioManager = {
      playPath(path: string) {
        played.push(path);
      },
      playPathAt() {},
    } as unknown as AudioManager;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      emptyTable()
    );
    const status = (deathState: string) =>
      windowTarget.dispatchEvent(
        new TestCustomEvent("biomes:live-mode-player-status-updated", {
          combat: { deathState },
        })
      );

    status("ready");
    status("downed");
    status("dead");
    status("respawning");
    status("ready");

    assert.deepEqual(
      played.map((path) => path.split("/").pop()),
      ["player_downed.webm", "player_death.webm", "player_revive.webm"]
    );
    script.clear();
  });

  it("plays crop state sounds only after Gaia-backed ECS transitions", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;
    const played: Array<{ path: string; position: readonly number[] }> = [];
    const audioManager = {
      playPath() {},
      playPathAt(path: string, position: readonly number[]) {
        played.push({ path, position });
      },
    } as unknown as AudioManager;
    const entity = {
      id: 101,
      position: { v: [4, 5, 6] },
      farming_plant_component: { status: "growing" },
    };
    let postApply: ((changes: any[]) => void) | undefined;
    const table = {
      contents: () => [entity],
      get: () => entity,
      events: {
        on(_name: string, listener: (changes: any[]) => void) {
          postApply = listener;
        },
        off() {},
      },
    } as any;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      table
    );

    entity.farming_plant_component.status = "fully_grown";
    postApply?.([{ kind: "update", tick: 1, entity: { id: 101 } }]);
    entity.farming_plant_component.status = "dead";
    postApply?.([{ kind: "update", tick: 2, entity: { id: 101 } }]);

    assert.deepEqual(
      played.map((entry) => [entry.path.split("/").pop(), entry.position]),
      [
        ["crop_ready.webm", [4, 5, 6]],
        ["crop_failed.webm", [4, 5, 6]],
      ]
    );
    script.clear();
  });

  it("plays Native ECS energy specials from replicated NPC state exactly once", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;
    const played: Array<{ path: string; position: readonly number[] }> = [];
    const audioManager = {
      playPath() {},
      playPathAt(path: string, position: readonly number[]) {
        played.push({ path, position });
      },
    } as unknown as AudioManager;
    const entity: any = {
      id: 202,
      position: { v: [7, 8, 9] },
      npc_state: { data: serializeNpcCustomState({}) },
    };
    let postApply: ((changes: any[]) => void) | undefined;
    const table = {
      contents: () => [entity],
      get: () => entity,
      events: {
        on(_name: string, listener: (changes: any[]) => void) {
          postApply = listener;
        },
        off() {},
      },
    } as any;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      table
    );

    entity.npc_state.data = serializeNpcCustomState({
      energyWeapon: {
        lastEffect: {
          id: "singularity_gravity_collapse",
          source: 1 as any,
          atMs: Date.now(),
        },
      },
    });
    const change = [{ kind: "update", tick: 1, entity: { id: 202 } }];
    postApply?.(change);
    postApply?.(change);

    assert.deepEqual(played, [
      {
        path: "/assets/harthmere/audio/sfx/singularity_gravity_collapse.webm",
        position: [7, 8, 9],
      },
    ]);
    script.clear();
  });

  it("plays a confirmed player melee hit from the replicated ECS health mutation exactly once", () => {
    const windowTarget = new EventTarget();
    (globalThis as any).window = windowTarget;
    (globalThis as any).CustomEvent = TestCustomEvent;
    const played: Array<{
      path: string;
      position: readonly number[];
      options: Record<string, number | undefined>;
    }> = [];
    const audioManager = {
      playPath() {},
      playPathAt(
        path: string,
        position: readonly number[],
        options: Record<string, number | undefined>
      ) {
        played.push({ path, position, options });
      },
    } as unknown as AudioManager;
    const nowSeconds = Date.now() / 1000;
    const attacker: any = {
      id: 301,
      player_status: {},
      emote: {
        emote_type: "attack1",
        emote_start_time: nowSeconds - 0.2,
        emote_expiry_time: nowSeconds + 0.4,
      },
    };
    const target: any = {
      id: 302,
      position: { v: [11, 12, 13] },
      health: {},
    };
    let postApply: ((changes: any[]) => void) | undefined;
    const table = {
      contents: () => [attacker, target],
      get: (id: number) => (id === attacker.id ? attacker : target),
      events: {
        on(_name: string, listener: (changes: any[]) => void) {
          postApply = listener;
        },
        off() {},
      },
    } as any;
    const script = new HarthmereSoundEffectsScript(
      audioManager,
      new GardenHose(),
      table
    );

    target.health = {
      hp: 80,
      lastDamageTime: nowSeconds,
      lastDamageSource: {
        kind: "attack",
        attacker: attacker.id,
        dir: [1, 0, 0],
      },
    };
    const change = [{ kind: "update", tick: 1, entity: { id: target.id } }];
    postApply?.(change);
    postApply?.(change);

    assert.deepEqual(played, [
      {
        path: "/assets/harthmere/audio/sfx/melee_hit_unarmed_slap.webm",
        position: [11, 12, 13],
        options: {
          durationSeconds: 0.15,
          refDistance: 3,
          maxDistance: 48,
          rolloffFactor: 0.85,
        },
      },
    ]);
    assert.equal(
      (windowTarget as any).__harthmereSoundEffectsDebug
        .confirmedMeleeHitCount,
      1
    );
    assert.equal(
      (windowTarget as any).__harthmereSoundEffectsDebug.requestedPlayCount,
      1
    );
    script.clear();
    assert.equal(
      (windowTarget as any).__harthmereSoundEffectsDebug,
      undefined
    );
  });
});
