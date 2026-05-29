import assert from "assert";
import {
  persistHarthmereLiveModeResponseV1,
  readServerActorPositionForLiveModeV145,
} from "../live_mode";
import {
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  createHarthmereLiveModeEventV1,
  createHarthmereLiveModeUiEventV1,
  type HarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";

const ACTOR = "player_live_api_persist_001";
const NOW_MS = 1_700_400_000_000;

class FakeRedisPrimary {
  readonly store = new Map<string, string>();
  readonly watched: string[][] = [];
  readonly txOps: string[][] = [];

  async watch(...keys: string[]) {
    this.watched.push(keys);
  }

  async unwatch() {}

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  multi() {
    const ops: Array<() => void> = [];
    return {
      set: (key: string, value: string) => {
        this.txOps.push(["set", key]);
        ops.push(() => this.store.set(key, value));
        return this;
      },
      xadd: (key: string) => {
        this.txOps.push(["xadd", key]);
        ops.push(() => {});
        return this;
      },
      exec: async () => {
        for (const op of ops) op();
        return [];
      },
    };
  }

  async set(key: string, value: string) {
    this.txOps.push(["direct_set", key]);
    this.store.set(key, value);
    return "OK";
  }

  async xadd() {
    return "1-0";
  }
}

function envelope(): HarthmereLiveModeAuthorityEnvelopeV1 {
  return {
    requestId: "live-api-persist-req-1",
    idempotencyKey: "live-api-persist-idem-1",
    actorId: ACTOR,
    actionKind: "request_xp_reward",
    subsystem: "leveling",
    source: "server_scheduled_tick",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload: {
      skillId: "combat",
      baseXp: 100,
      sourceLevel: 1,
      contributionScore: 1,
    },
  };
}

describe("live_mode API Redis persistence", () => {
  it("reads the server-side actor position for jobs board proximity without trusting client claims", async () => {
    const position = await readServerActorPositionForLiveModeV145(
      {
        get: async () => ({
          position: () => ({ v: [501.59, 70, -133.35] }),
        }),
      } as any,
      1 as any,
    );
    assert.deepEqual(position, { x: 501.59, y: 70, z: -133.35 });

    const missing = await readServerActorPositionForLiveModeV145(
      { get: async () => ({ position: () => ({ v: [Number.NaN, 70, -133.35] }) }) } as any,
      1 as any,
    );
    assert.equal(missing, undefined);
  });

  it("uses WATCH/MULTI and records idempotency only with the state mutation", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const env = envelope();
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlanV1(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: { ok: true, errors: [], warnings: [], rejectedClientClaims: [] },
      mutationPlan,
      events: [
        createHarthmereLiveModeEventV1({
          kind: "xp_reward_resolved",
          envelope: env,
        }),
      ],
      uiEvents: [
        createHarthmereLiveModeUiEventV1({
          kind: "level_up_toast",
          envelope: env,
        }),
      ],
    };

    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    const playerKey = harthmereLiveModePlayerStateKeyV1(ACTOR);
    assert.deepEqual(redisPrimary.watched[0], [
      "harthmere:live_mode:v1:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
      playerKey,
    ]);
    const firstSet = redisPrimary.txOps.find((op) => op[0] === "set");
    assert.equal(firstSet?.[1], playerKey);
    assert.equal(redisPrimary.txOps.some((op) => op[0] === "direct_set"), false);
    assert.equal(persisted.backendMutation?.warnings.length, 0);
    assert.equal((persisted.playerStatusState as any)?.combat?.hp, 100);
    assert.equal((persisted.playerStatusState as any)?.level, 1);

    const rawState = redisPrimary.store.get(playerKey);
    const state = parseHarthmereLiveModeBackendStateV1(rawState, ACTOR, NOW_MS);
    assert.equal(state.classMagic.skills.combat?.xp, 100);

    const replay = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });
    assert.equal(replay.duplicate, true);
    assert.equal(replay.replayed, true);
  });
});
