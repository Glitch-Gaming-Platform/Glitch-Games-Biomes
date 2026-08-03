import { AnchorIndex } from "@/shared/npc/anchor_system";
import { drownTick } from "@/shared/npc/behavior/drown";
import { farFromHomeTick } from "@/shared/npc/behavior/far_from_home";
import { patrolTick, type PatrolRoute } from "@/shared/npc/behavior/patrol";
import { returnHomeTick } from "@/shared/npc/behavior/return_home";
import { rotateTargetTick } from "@/shared/npc/behavior/rotate_target";
import { gameHourOfDay, scheduleTick } from "@/shared/npc/behavior/schedule";
import { scheduleFollowTick } from "@/shared/npc/behavior/schedule_follow";
import {
  getBlockAndBoundRepellingDirection,
  getDirectionAwayFromAABBIntersection,
  getDirectionTowardsAABBIntersection,
  getRandomDirection,
  getVolumeTakenByBox,
  towardsCurrentDirection,
} from "@/shared/npc/behavior/shared_actions";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, idToNpcType } from "@/shared/npc/bikkie";
import { getDuplicates, ensureUniqueValues } from "@/shared/npc/config_helpers";
import { pickGreeting, recordConversationEvent } from "@/shared/npc/dialog";
import { recordNpcMemoryEvent, zNpcMemoryComponent } from "@/shared/npc/memory";
import {
  reactionFor,
  shouldDefendAlly,
  standingTier,
} from "@/shared/npc/npc_reaction";
import {
  satisfiesNumericalConstraint,
  zSpawnConstraints,
} from "@/shared/npc/spawn_events";
import { TickUpdates } from "@/shared/npc/updates";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import sinon from "sinon";
import { z } from "zod";

function mutableNpc(overrides: Record<string, unknown> = {}) {
  const state: Record<string, any> = {};
  const npc: Record<string, any> = {
    id: 90_001 as BiomesId,
    type: idToNpcType(LOCAL_DEV_HUMAN_NPC_TYPE_ID),
    label: "Test NPC",
    position: [0, 0, 0],
    orientation: [0, 0],
    velocity: [0, 0, 0],
    hp: 20,
    health: { maxHp: 20 },
    state,
    metadata: {
      spawn_position: [0, 0, 0],
      spawn_orientation: [0, 0],
    },
    mutableState: () => state,
    setPosition: (position: number[]) => {
      npc.position = position;
    },
    setOrientation: (orientation: number[]) => {
      npc.orientation = orientation;
    },
    setVelocity: (velocity: number[]) => {
      npc.velocity = velocity;
    },
    kill: sinon.spy(),
    damage: sinon.spy(),
    ...overrides,
  };
  return npc;
}

describe("Anima anchor integration contracts", () => {
  it("indexes, filters, ranks, claims, releases, and removes anchors", () => {
    const index = new AnchorIndex();
    index.add({
      id: 1 as BiomesId,
      anchor_type: "work",
      position: [10, 0, 0],
      allowed_roles: ["smith"],
      blocked_if_combat: true,
      max_users: 1,
    });
    index.add({
      id: 2 as BiomesId,
      anchor_type: "work",
      position: [2, 0, 0],
      allowed_roles: [],
      blocked_if_combat: false,
      max_users: 2,
    });

    assert.equal(index.findFreeAnchor({ type: "missing" }), undefined);
    assert.equal(index.findFreeAnchor({ type: "work", near: [0, 0, 0] }), 2);
    assert.equal(
      index.findFreeAnchor({ type: "work", role: "farmer", near: [9, 0, 0] }),
      2
    );
    assert.equal(
      index.findFreeAnchor({
        type: "work",
        role: "smith",
        near: [9, 0, 0],
        inCombatZone: true,
      }),
      2
    );

    index.claim(2 as BiomesId);
    index.claim(2 as BiomesId);
    assert.equal(
      index.findFreeAnchor({ type: "work", role: "farmer" }),
      undefined
    );
    index.release(2 as BiomesId);
    assert.equal(index.findFreeAnchor({ type: "work", role: "farmer" }), 2);
    index.release(2 as BiomesId);
    index.release(2 as BiomesId);
    index.remove(2 as BiomesId);
    assert.equal(index.positionOf(2 as BiomesId), undefined);
    index.remove(999 as BiomesId);
  });
});

describe("Anima memory, dialogue, and reaction contracts", () => {
  it("applies memory defaults, clamps sentiment, and evicts the oldest entries", () => {
    assert.deepEqual(zNpcMemoryComponent.parse({}), {
      memory: { perPlayer: {} },
    });
    const state: any = {};
    for (let i = 1; i <= 51; i += 1) {
      recordNpcMemoryEvent(state, i as BiomesId, `event-${i}`, 150, i);
    }
    assert.equal(Object.keys(state.memory.perPlayer).length, 50);
    assert.equal(state.memory.perPlayer["1"], undefined);
    assert.equal(state.memory.perPlayer["51"].sentiment, 100);
    recordNpcMemoryEvent(state, 51 as BiomesId, "loss", -250, 60);
    assert.equal(state.memory.perPlayer["51"].sentiment, -100);
  });

  it("selects fallback, reputation, and post-event greetings", () => {
    const player = { id: 7 as BiomesId } as any;
    assert.equal(
      pickGreeting(
        { id: 1, default_dialog: { text: "Fallback" } } as any,
        player,
        {
          likeability: 0,
          legal: 0,
          notoriety: 0,
        }
      ),
      "Fallback"
    );
    const npc: any = {
      id: 1,
      conversation: {
        greetings: {
          neutral: "Hello",
          liked: "Friend",
          outlaw: "Careful",
          hated: "Leave",
        },
        post_event_overrides: new Map([["saved", "My hero"]]),
      },
      npc_state: {
        memory: { perPlayer: { "7": { lastEventId: "saved" } } },
      },
    };
    assert.equal(
      pickGreeting(npc, player, { likeability: 0, legal: 0, notoriety: 0 }),
      "My hero"
    );
    npc.npc_state.memory.perPlayer["7"].lastEventId = "unknown";
    assert.equal(
      pickGreeting(npc, player, { likeability: 30, legal: 0, notoriety: 0 }),
      "Friend"
    );
    npc.conversation.greetings.liked = undefined;
    assert.equal(
      pickGreeting(npc, player, { likeability: 30, legal: 0, notoriety: 0 }),
      "Hello"
    );
  });

  it("records conversation state and clamps both sentiment bounds", () => {
    const clock = sinon.stub(Date, "now").returns(12_345_000);
    const state: any = {};
    try {
      recordConversationEvent(state, 8 as BiomesId, "helped", 150);
      assert.deepEqual(state.memory.perPlayer["8"], {
        lastEventId: "helped",
        lastSpokenAt: 12_345,
        sentiment: 100,
      });
      recordConversationEvent(state, 8 as BiomesId, "betrayed", -250);
      assert.equal(state.memory.perPlayer["8"].sentiment, -100);
    } finally {
      clock.restore();
    }
  });

  it("maps standing and NPC roles to all reaction policies", () => {
    assert.equal(standingTier(0, 0, 75), "hated");
    assert.equal(standingTier(0, 50, 0), "hated");
    assert.equal(standingTier(0, 10, 0), "outlaw");
    assert.equal(standingTier(25, 0, 0), "liked");
    assert.equal(standingTier(0, 0, 0), "neutral");

    assert.equal(reactionFor({ role: "guard" } as any, "hated"), "attack");
    assert.equal(reactionFor({ role: "guard" } as any, "outlaw"), "arrest");
    assert.equal(reactionFor({ role: "guard" } as any, "neutral"), "watch");
    assert.equal(reactionFor({ role: "guard" } as any, "liked"), "greet");
    assert.equal(reactionFor({ role: "merchant" } as any, "hated"), "warn");
    assert.equal(reactionFor({ role: "merchant" } as any, "outlaw"), "watch");
    assert.equal(reactionFor({ role: "merchant" } as any, "liked"), "trade");
    assert.equal(
      reactionFor(
        { role: "noble", personality: ["haughty"] } as any,
        "neutral"
      ),
      "ignore"
    );
    assert.equal(reactionFor({ role: "noble" } as any, "hated"), "warn");
    assert.equal(reactionFor({ role: "noble" } as any, "liked"), "greet");
    assert.equal(reactionFor({} as any, "outlaw"), "ignore");
    assert.equal(reactionFor({} as any, "neutral"), "greet");
  });

  it("defends same and allied factions, but not missing or hostile factions", () => {
    const relation = sinon.stub().returns(25);
    assert.equal(shouldDefendAlly({} as any, {} as any, relation), false);
    assert.equal(
      shouldDefendAlly(
        { factionId: 1 } as any,
        { factionId: 1 } as any,
        relation
      ),
      true
    );
    assert.equal(
      shouldDefendAlly(
        { factionId: 1 } as any,
        { factionId: 2 } as any,
        relation
      ),
      true
    );
    relation.returns(24);
    assert.equal(
      shouldDefendAlly(
        { factionId: 1 } as any,
        { factionId: 2 } as any,
        relation
      ),
      false
    );
  });
});

describe("Anima configuration and update contracts", () => {
  it("reports unique duplicate values and rejects duplicate schema entries", () => {
    assert.deepEqual(getDuplicates([1, 2, 1, 1, 3, 2]), [1, 2]);
    const schema = ensureUniqueValues(z.array(z.string()));
    assert.deepEqual(schema.parse(["a", "b"]), ["a", "b"]);
    assert.throws(() => schema.parse(["a", "a"]), /duplicates of \[a\]/);
  });

  it("evaluates every numerical comparison and optional transforms", () => {
    assert.equal(satisfiesNumericalConstraint(undefined, 10), true);
    assert.equal(satisfiesNumericalConstraint({ greaterThan: 10 }, 10), false);
    assert.equal(
      satisfiesNumericalConstraint({ greaterThanOrEqualTo: 10 }, 10),
      true
    );
    assert.equal(satisfiesNumericalConstraint({ lessThan: 10 }, 10), false);
    assert.equal(
      satisfiesNumericalConstraint({ lessThanOrEqualTo: 10 }, 10),
      true
    );
    assert.equal(
      satisfiesNumericalConstraint({ greaterThan: 4 }, 9, {
        constraintTransform: (value) => value * 2,
      }),
      true
    );
  });

  it("parses spawn defaults and rejects duplicate terrain and invalid ranges", () => {
    const parsed = zSpawnConstraints.parse({ terrainType: ["grass"] });
    assert.equal(parsed.timeOfDay, undefined);
    assert.equal(parsed.spawnEventMinDistance, undefined);
    assert.throws(
      () => zSpawnConstraints.parse({ terrainType: ["grass", "grass"] }),
      /unique values/
    );
    assert.throws(
      () =>
        zSpawnConstraints.parse({
          terrainType: ["grass"],
          distanceFromSky: { greaterThan: 16 },
        }),
      /less than or equal to 15/
    );
  });

  it("merges state and events without mutating either update", () => {
    const first = new TickUpdates(
      [{ id: 1 } as any],
      [{ kind: "first" } as any]
    );
    const second = new TickUpdates(
      [{ id: 2 } as any],
      [{ kind: "second" } as any]
    );
    assert.strictEqual(first.merge(), first);
    assert.deepEqual(first.merge(second), {
      state: [{ id: 1 }, { id: 2 }],
      events: [{ kind: "first" }, { kind: "second" }],
    });
    assert.equal(first.state.length, 1);
    assert.equal(second.events.length, 1);
  });
});

describe("Anima schedule and movement behavior contracts", () => {
  it("maps real seconds into the repeating 24-hour game clock", () => {
    assert.equal(gameHourOfDay(0), 0);
    assert.equal(gameHourOfDay(60), 1);
    assert.equal(gameHourOfDay(1_439), 23);
    assert.equal(gameHourOfDay(1_440), 0);
  });

  it("selects the active schedule entry and resolves its anchor", () => {
    assert.deepEqual(scheduleTick({}, { positionOf: () => undefined }, 0), {});
    const state: any = {
      schedule: {
        entries: [
          { hour_of_day: 0, action: "sleep", anchor_id: 1 },
          { hour_of_day: 8, action: "work", anchor_id: 2 },
        ],
      },
    };
    assert.deepEqual(
      scheduleTick(state, { positionOf: (id) => [id, 0, 0] }, 8 * 60),
      { targetPosition: [2, 0, 0], action: "work" }
    );
    assert.equal(state.schedule.last_applied_hour, 8);
  });

  it("follows scheduled anchors at full, slow, and stopped speeds with cache fallback", () => {
    const npc = mutableNpc({ position: [0, 0, 0] });
    npc.state.schedule = {
      entries: [{ hour_of_day: 0, action: "work", anchor_id: 5 }],
    };
    const entity = { position: { v: [20, 0, 0] } };
    const env = { resources: { get: () => entity } } as any;
    const far = scheduleFollowTick(env, npc as any, 0);
    assert.equal(far.targetReached, false);
    assert.equal(far.forwardSpeed, npc.type.runSpeed);
    assert.equal(npc.state.schedule.cached_target, entity.position.v);

    npc.position = [10, 0, 0];
    const near = scheduleFollowTick(env, npc as any, 0);
    assert.equal(near.forwardSpeed, npc.type.runSpeed * 0.55);

    npc.position = [19, 0, 0];
    assert.deepEqual(scheduleFollowTick(env, npc as any, 0), {
      forwardSpeed: 0,
      targetReached: true,
    });
    env.resources.get = () => {
      throw new Error("paged out");
    };
    npc.position = [0, 0, 0];
    assert.equal(scheduleFollowTick(env, npc as any, 0).targetReached, false);
  });

  it("rotates by bounded steps and clears a reached target", () => {
    const npc = mutableNpc();
    rotateTargetTick(npc as any, 90, 1);
    assert.deepEqual(npc.orientation, [0, 0]);

    npc.state.rotateTarget = Math.PI;
    rotateTargetTick(npc as any, 90, 1);
    assert.ok(Math.abs(npc.orientation[1]) === Math.PI / 2);
    assert.equal(npc.state.rotateTarget, Math.PI);

    npc.state.rotateTarget = npc.orientation[1] + 0.1;
    rotateTargetTick(npc as any, 90, 1);
    assert.equal(npc.state.rotateTarget, undefined);
  });

  it("repairs malformed orientation and drops non-finite rotate targets", () => {
    const npc = mutableNpc({
      orientation: [NaN, Infinity],
      metadata: {
        spawn_position: [0, 0, 0],
        spawn_orientation: [0.25, -0.5],
      },
    });
    npc.state.rotateTarget = NaN;
    rotateTargetTick(npc as any, 90, 0.1);
    assert.deepEqual(npc.orientation, [0.25, -0.5]);
    assert.equal(npc.state.rotateTarget, undefined);
  });

  it("tracks time away from home, clears recovery near home, and expires strays", () => {
    const clock = sinon.stub(Date, "now").returns(20_000);
    const npc = mutableNpc({ position: [20, 0, 0] });
    try {
      farFromHomeTick(npc as any, [0, 0, 0], 5, 10);
      assert.equal(npc.state.farFromHome.lastNearTime, 20);
      npc.state.farFromHome.lastNearTime = 10;
      farFromHomeTick(npc as any, [0, 0, 0], 5, 10);
      assert.equal(npc.kill.calledOnce, true);
      npc.position = [0, 0, 0];
      farFromHomeTick(npc as any, [0, 0, 0], 5, 10);
      assert.equal(npc.state.farFromHome.lastNearTime, undefined);
    } finally {
      clock.restore();
    }
  });

  it("walks, faces, arrives, and eventually teleports a return-home NPC", () => {
    const clock = sinon.stub(Date, "now").returns(30_000);
    const npc = mutableNpc({ position: [5, 0, 0] });
    try {
      const moving = returnHomeTick(npc as any);
      assert.equal(moving.forwardSpeed, npc.type.walkSpeed);
      assert.equal(typeof npc.state.rotateTarget, "number");

      npc.position = [0, 0, 0];
      npc.orientation = [0, 1];
      assert.equal(returnHomeTick(npc as any).forwardSpeed, 0);
      assert.equal(npc.state.rotateTarget, 0);

      npc.orientation = [0, 0];
      assert.deepEqual(returnHomeTick(npc as any), {
        atDestination: true,
        forwardSpeed: 0,
      });
      assert.equal(npc.state.returnHome.lastHomeTime, 30);

      npc.position = [5, 0, 0];
      npc.state.returnHome.lastHomeTime = 0;
      returnHomeTick(npc as any);
      assert.deepEqual(npc.position, [0, 0, 0]);
      assert.deepEqual(npc.orientation, [0, 0]);
      assert.equal(npc.state.returnHome, undefined);
    } finally {
      clock.restore();
    }
  });

  it("initializes, pauses, advances, ping-pongs, and moves patrol routes", () => {
    const clock = sinon.stub(Date, "now").returns(40_000);
    const npc = mutableNpc();
    const forward: PatrolRoute = {
      waypoints: [
        { position: [0, 0, 0], pause_secs: 2, facing_yaw_rad: 1 },
        { position: [5, 0, 0], pause_secs: 0 },
      ],
      loop_behavior: "forward",
      walk_speed_modifier: 0.5,
    };
    try {
      assert.deepEqual(
        patrolTick(npc as any, { waypoints: [], loop_behavior: "forward" }),
        {
          forwardSpeed: 0,
        }
      );
      delete npc.state.patrol;
      assert.deepEqual(patrolTick(npc as any, forward), {
        forwardSpeed: 0,
        targetYaw: 1,
      });
      assert.equal(npc.state.patrol.pauseUntil, 42);
      assert.deepEqual(patrolTick(npc as any, forward), {
        forwardSpeed: 0,
        targetYaw: 1,
      });
      npc.state.patrol.pauseUntil = 39;
      patrolTick(npc as any, forward);
      assert.equal(npc.state.patrol.currentWaypointIndex, 1);
      const moving = patrolTick(npc as any, forward);
      assert.equal(moving.forwardSpeed, npc.type.walkSpeed * 0.5);

      npc.position = [5, 0, 0];
      npc.state.patrol = {
        currentWaypointIndex: 1,
        pauseUntil: 39,
        direction: "forward",
      };
      const pingPong = { ...forward, loop_behavior: "ping_pong" as const };
      patrolTick(npc as any, pingPong);
      assert.deepEqual(npc.state.patrol, {
        currentWaypointIndex: 0,
        pauseUntil: undefined,
        direction: "backward",
      });
    } finally {
      clock.restore();
    }
  });
});

describe("Anima drowning and steering contracts", () => {
  function resources(submerged: boolean) {
    return {
      get: () =>
        submerged
          ? {
              intersect: (_aabb: unknown, callback: (hit: any) => unknown) =>
                callback([
                  [-1, -1, -1],
                  [1, 1, 1],
                ]),
            }
          : undefined,
    } as any;
  }

  it("starts, clears, delays, repeats, and inverts drowning damage", () => {
    const clock = sinon.stub(Date, "now").returns(50_000);
    const npc = mutableNpc();
    const aabb = [
      [-0.5, 0, -0.5],
      [0.5, 1, 0.5],
    ] as any;
    try {
      assert.deepEqual(drownTick(resources(true), npc as any, aabb), []);
      assert.equal(npc.state.drown.submergedSinceSeconds, 50);
      npc.state.drown.submergedSinceSeconds = 30;
      drownTick(resources(true), npc as any, aabb, {
        damageStartSeconds: 10,
        damageMaxHpFraction: 0.25,
      });
      assert.equal(npc.damage.calledWith(5, { kind: "drown" }), true);
      npc.damage.resetHistory();
      npc.state.drown.previousDamageSeconds = 40;
      drownTick(resources(true), npc as any, aabb, {
        damageIntervalSeconds: 5,
      });
      assert.equal(npc.damage.calledOnce, true);
      drownTick(resources(false), npc as any, aabb);
      assert.equal(npc.state.drown, undefined);

      drownTick(resources(false), npc as any, aabb, { breathingType: "water" });
      assert.equal(npc.state.drown.submergedSinceSeconds, 50);
    } finally {
      clock.restore();
    }
  });

  it("calculates direction, intersection, repulsion, randomness, and occupied volume", () => {
    const npc = mutableNpc({ velocity: [3, 4, 0], position: [0, 0, 0] });
    assert.deepEqual(
      towardsCurrentDirection({ npc: npc as any, strength: 2 }),
      [2, 0, 0]
    );
    const towards = getDirectionTowardsAABBIntersection({
      point: [0, 0, 0],
      box1: [
        [-1, -1, -1],
        [1, 1, 1],
      ],
      box2: [
        [0, 0, 0],
        [2, 2, 2],
      ],
    });
    assert.deepEqual(towards, {
      direction: [0.5, 0.5, 0.5],
      length: Math.sqrt(0.75),
    });
    assert.deepEqual(
      getDirectionAwayFromAABBIntersection({
        point: [0, 0, 0],
        box1: [
          [-1, -1, -1],
          [1, 1, 1],
        ],
        box2: [
          [0, 0, 0],
          [2, 2, 2],
        ],
      }),
      { direction: [-0.5, -0.5, -0.5], length: Math.sqrt(0.75) }
    );
    assert.equal(
      getDirectionTowardsAABBIntersection({
        point: [0, 0, 0],
        box1: [
          [-1, -1, -1],
          [0, 0, 0],
        ],
        box2: [
          [1, 1, 1],
          [2, 2, 2],
        ],
      }),
      undefined
    );
    const repelling = getBlockAndBoundRepellingDirection({
      hit: [
        [-1, -1, -1],
        [1, 1, 1],
      ],
      collisionBox: [
        [0, 0, 0],
        [2, 2, 2],
      ],
      npc: npc as any,
      strength: 2,
    });
    assert.ok(repelling.every((value) => value < 0));

    const random = sinon.stub(Math, "random").returns(1);
    try {
      assert.deepEqual(getRandomDirection({ length: 2 }), [1, 1, 1]);
    } finally {
      random.restore();
    }

    const volume = getVolumeTakenByBox({
      aabb: [
        [0, 0, 0],
        [2, 2, 2],
      ],
      boxesIndex: () => ({
        intersect: (_aabb, callback) => {
          callback([
            [0, 0, 0],
            [1, 2, 2],
          ]);
          callback([
            [1, 0, 0],
            [2, 1, 1],
          ]);
        },
      }),
    });
    assert.equal(volume, 5);
  });
});
