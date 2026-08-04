import assert from "assert";
import {
  createHarthmereBusinessCustomerSpatialIntent,
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerDeparturePoint,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import { dist } from "@/shared/math/linear";
import type { Vec2, Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
  type BusinessCustomerState,
} from "@/shared/npc/behavior/business_customer";
import { businessCustomerTick } from "@/shared/npc/behavior/business_customer_tick";
import { selectNpcLocomotion } from "@/shared/npc/logic";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

function state(phase: BusinessCustomerState["phase"]): BusinessCustomerState {
  return {
    version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
    sessionId: "session",
    ticketId: "ticket",
    outpostId: "outpost",
    businessType: "courier",
    actorEntityId: 42 as any,
    phase,
    reaction: "neutral",
    entrance: [0, 0, 0],
    queueTarget: [4, 0, 4],
    customer: [4, 0, 4],
    staff: [4, 0, 6],
    departure: [0, 0, -10],
    waypoints: [],
    waypointIndex: 0,
    lastPhaseChangedAtSeconds: 1,
  };
}

function npcFor(
  customer: BusinessCustomerState | undefined,
  initialPosition: Vec3 = [4, 0, 4],
  spawnPosition: Vec3 = initialPosition
) {
  const mutable: any = customer ? { businessCustomer: customer } : {};
  let position: Vec3 = [...initialPosition];
  let velocity: Vec3 = [0, 0, 0];
  let orientation: Vec2 = [0, 0];
  return {
    state: mutable,
    type: { runSpeed: 4.4 },
    metadata: {
      spawn_position: [...spawnPosition],
      spawn_orientation: [0, 0],
    },
    mutableState: () => mutable,
    get position() {
      return position;
    },
    set position(value: Vec3) {
      position = [...value];
    },
    get velocity() {
      return velocity;
    },
    get orientation() {
      return orientation;
    },
    setPosition(value: Vec3) {
      position = [...value];
    },
    setVelocity(value: Vec3) {
      velocity = [...value];
    },
    setOrientation(value: Vec2) {
      orientation = [...value];
    },
  } as any;
}

function stateFromIntent(
  intent: ReturnType<typeof createHarthmereBusinessCustomerSpatialIntent>
): BusinessCustomerState {
  const clone = (point: readonly [number, number, number]): Vec3 => [
    point[0],
    point[1],
    point[2],
  ];
  return {
    version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
    sessionId: intent.sessionId,
    ticketId: intent.ticketId,
    outpostId: intent.outpostId,
    businessType: intent.businessType,
    actorEntityId: intent.actorEntityId,
    phase: intent.phase,
    reaction: intent.reaction,
    entrance: clone(intent.entrance),
    queueTarget: clone(intent.queueTarget),
    customer: clone(intent.customer),
    staff: clone(intent.staff),
    departure: clone(intent.departure),
    waypoints: intent.waypoints.map(clone),
    waypointIndex: 0,
    lastPhaseChangedAtSeconds: 1,
  };
}

function tickUntil(
  npc: any,
  predicate: (result: ReturnType<typeof businessCustomerTick>) => boolean
) {
  const env = {
    resources: {
      get: () => ({ position: { v: [8, 0, 4] } }),
    },
  } as any;
  let result = businessCustomerTick(env, npc, 10, 0.1);
  for (let index = 1; index <= 1_000 && !predicate(result); index += 1) {
    result = businessCustomerTick(env, npc, 10 + index * 0.1, 0.1);
  }
  return result;
}

describe("Anima business customer locomotion", () => {
  it("gives business routes priority over schedules, meander, and escort", () => {
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: true,
        hasActiveSchedule: true,
        hasChaseAttack: false,
        hasAttackTarget: false,
        hasBusinessCustomerAssignment: true,
        hasEscortAssignment: true,
        canMeander: true,
        canSocialize: true,
      }),
      "businessCustomer"
    );
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: false,
        hasActiveSchedule: false,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasBusinessCustomerAssignment: true,
        canMeander: false,
        canSocialize: false,
      }),
      "chaseAttack"
    );
  });

  it("does not claim ordinary NPCs as kinematic business customers", () => {
    const result = businessCustomerTick(
      { resources: {} } as any,
      npcFor(undefined),
      10,
      0.1
    );
    assert.deepEqual(result, {
      forwardSpeed: 0,
      phase: "despawned",
      kinematic: false,
    });
  });

  it("restores persistent patrons to their authored posts and holds them", () => {
    const customer = state("patron_wandering");
    customer.waypoints = [
      [4, 0, 4],
      [7, 0, 4],
    ];
    customer.waypointIndex = 1;
    const npc = npcFor(customer, [7, 0, 4], [4, 0, 4]);
    const result = businessCustomerTick({ resources: {} } as any, npc, 10);
    assert.equal(result.phase, "patron_wandering");
    assert.equal(result.kinematic, true);
    assert.deepEqual(npc.position, [4, 0, 4]);
    assert.deepEqual(npc.velocity, [0, 0, 0]);
    assert.equal(customer.waypointIndex, 0);
    assert.equal(customer.pathfinding, undefined);
  });

  it("faces the player, snaps clear of furniture, and holds while serving", () => {
    const customer = state("serving");
    const npc = npcFor(customer, [4, 0, 4.6]);
    const result = businessCustomerTick(
      {
        resources: {
          get: () => ({ position: { v: [8, 0, 4] } }),
        },
      } as any,
      npc,
      10
    );
    assert.equal(result.phase, "serving");
    assert.equal(result.kinematic, true);
    assert.deepEqual(npc.position, customer.customer);
    assert.deepEqual(npc.velocity, [0, 0, 0]);
    assert.ok(Number.isFinite(npc.state.rotateTarget));
  });

  it("walks a queued follower to its own slot before holding position", () => {
    const customer = state("queued");
    customer.queueTarget = [8, 0, 4];
    customer.waypoints = [[8, 0, 4]];
    const npc = npcFor(customer);
    const first = businessCustomerTick({ resources: {} } as any, npc, 10, 0.25);
    assert.equal(first.kinematic, true);
    assert.ok(npc.position[0] > 4 && npc.position[0] < 8);
    assert.ok(npc.velocity[0] > 0);

    const settled = tickUntil(
      npc,
      () => dist(npc.position, customer.queueTarget) <= 0.05
    );
    assert.equal(settled.phase, "queued");
    assert.deepEqual(npc.position, customer.queueTarget);
    assert.deepEqual(npc.velocity, [0, 0, 0]);
  });

  it("completes every one of the 19 authored entrance-to-counter routes", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    for (const [index, record] of HARTHMERE_BUSINESS_INTERIORS.entries()) {
      const intent = createHarthmereBusinessCustomerSpatialIntent({
        record,
        sessionId: `session_${record.outpostId}`,
        ticketId: "ticket_1",
        entityId: (8_812_000_000_000_000 + index) as any,
        queueIndex: 0,
        actorEntityId: 42 as any,
        phase: "entering",
      });
      assert.deepEqual(
        harthmereBusinessCustomerSpawnPoint(record, 0),
        harthmereBusinessInteriorInteractionPoints(record).entrance,
        `${record.outpostId} lead customer must start at the audited door`
      );
      const customer = stateFromIntent(intent);
      const npc = npcFor(customer, [
        intent.spawn[0],
        intent.spawn[1],
        intent.spawn[2],
      ]);
      const result = tickUntil(npc, (next) => next.phase === "serving");
      assert.equal(result.phase, "serving", record.outpostId);
      assert.equal(result.kinematic, true, record.outpostId);
      assert.ok(
        dist(npc.position, intent.customer) <= 0.05,
        `${record.outpostId} stopped at ${npc.position.join(",")} instead of ${intent.customer.join(",")}`
      );
      assert.deepEqual(npc.velocity, [0, 0, 0], record.outpostId);
    }
  });

  it("completes every one of the 19 counter-to-safe-exit routes", () => {
    for (const [index, record] of HARTHMERE_BUSINESS_INTERIORS.entries()) {
      const points = harthmereBusinessInteriorInteractionPoints(record);
      const intent = createHarthmereBusinessCustomerSpatialIntent({
        record,
        sessionId: `session_${record.outpostId}`,
        ticketId: "ticket_1",
        entityId: (8_812_000_000_001_000 + index) as any,
        queueIndex: 0,
        actorEntityId: 42 as any,
        phase: "departing",
        reaction: "success",
      });
      const customer = stateFromIntent(intent);
      const npc = npcFor(customer, [
        points.customer[0],
        points.customer[1],
        points.customer[2],
      ]);
      const result = tickUntil(npc, (next) => next.phase === "despawn_ready");
      const departure = harthmereBusinessCustomerDeparturePoint(record, 0);
      assert.equal(result.phase, "despawn_ready", record.outpostId);
      assert.ok(
        dist(npc.position, departure) <= 0.05,
        `${record.outpostId} did not reach its safe departure anchor`
      );
      assert.ok(
        dist(npc.position, points.staff) >= 27,
        `${record.outpostId} departure remained inside the shop`
      );
    }
  });

  it("survives the native npc_state serialization round trip", () => {
    const encoded = serializeNpcCustomState({
      businessCustomer: state("departing"),
    });
    const decoded = deserializeNpcCustomState(encoded).businessCustomer!;
    assert.equal(decoded.phase, "departing");
    assert.equal(decoded.ticketId, "ticket");
    assert.deepEqual(decoded.departure, [0, 0, -10]);
  });
});
