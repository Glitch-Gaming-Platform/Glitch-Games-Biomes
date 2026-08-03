import assert from "assert";
import { Expires, NpcState, Position } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerSessionEntityId,
} from "@/shared/harthmere/business_interior_runtime";
import {
  createHarthmereBusinessCustomerQueue,
  type HarthmereBusinessCustomerSession,
} from "@/shared/harthmere/business_customer_simulator";
import { defaultHarthmereProductionEconomyState } from "@/shared/harthmere/mmo_economy_authority";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import {
  buildHarthmereBusinessCustomerSessionNpcChanges,
  partitionHarthmereBusinessCustomerSessionNpcChanges,
} from "../business_customer_session_ecs";

function sessionFor(record: (typeof HARTHMERE_BUSINESS_INTERIORS)[number]) {
  const sessionId = `session_${record.outpostId}`;
  const queue = createHarthmereBusinessCustomerQueue({
    businessId: `business:${record.outpostId}`,
    typeId: record.businessType as any,
    sessionId,
    actorId: "native_matrix_actor",
    actorEntityId: 123456 as any,
    nowMs: 1000,
    count: 3,
    nextTicketNumber: 1,
  }).queue;
  return {
    sessionId,
    businessId: `business:${record.outpostId}`,
    typeId: record.businessType,
    actorId: "native_matrix_actor",
    actorEntityId: 123456 as any,
    status: "active",
    startedAtMs: 1000,
    expiresAtMs: 999999,
    currentTicketId: queue[0].ticketId,
    queue,
    servedTicketIds: [],
    failedTicketIds: [],
    streak: 0,
    satisfaction: 50,
    earnedGold: 0,
    progressPoints: 0,
    dailyBonusGold: 0,
    notes: [],
  } as HarthmereBusinessCustomerSession;
}

function economyFor(session: HarthmereBusinessCustomerSession) {
  const economy = defaultHarthmereProductionEconomyState();
  (economy.businessSystems as any).customerSessions = {
    [session.sessionId]: session,
  };
  return economy;
}

describe("native ECS business customer session materialization", () => {
  it("creates real session-only NPCs for every audited business", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const session = sessionFor(record);
      const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
        economy: economyFor(session),
        nowSeconds: 100,
      });
      assert.equal(changes.length, 3, record.outpostId);
      assert.ok(changes.every((change) => change.kind === "create"));
      for (const [index, change] of changes.entries()) {
        assert.equal(change.kind, "create");
        if (change.kind !== "create") continue;
        assert.equal(change.entity.id, session.queue[index].entityId);
        assert.ok(change.entity.npc_metadata);
        assert.ok(change.entity.position);
        const state = deserializeNpcCustomState(
          change.entity.npc_state?.data
        ).businessCustomer!;
        assert.equal(state.sessionId, session.sessionId);
        assert.equal(state.ticketId, session.queue[index].ticketId);
        assert.equal(state.phase, "entering");
        assert.equal(state.actorEntityId, 123456);
        assert.equal(state.waypoints.length, 3);
      }
    }
  });

  it("updates the current customer to depart and advances the queue without teleporting", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const first = session.queue[0];
    const existingState = deserializeNpcCustomState(undefined);
    existingState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: session.sessionId,
      ticketId: first.ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      actorEntityId: 123456 as any,
      phase: "serving",
      reaction: "neutral",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    first.status = "served";
    first.spatialPhase = "departing";
    first.reaction = "payment";
    session.servedTicketIds.push(first.ticketId);
    session.currentTicketId = session.queue[1].ticketId;
    session.queue[1].queueIndex = 0;
    session.queue[1].spatialPhase = "approaching_counter";
    const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 100,
      existingEntities: new Map([
        [
          first.entityId,
          {
            id: first.entityId,
            position: Position.create({ v: [674.5, 67, -39.9] }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(existingState),
            }),
          },
        ],
      ]),
    });
    const departing = changes.find(
      (change) => change.kind === "update" && change.entity.id === first.entityId
    );
    assert.ok(departing && departing.kind === "update");
    const departingState = deserializeNpcCustomState(
      departing.entity.npc_state?.data
    ).businessCustomer!;
    assert.equal(departingState.phase, "departing");
    assert.equal(departingState.reaction, "payment");
    assert.ok(departingState.waypoints.length >= 3);
    const next = changes.find(
      (change) =>
        change.kind === "create" &&
        change.entity.id === session.queue[1].entityId
    );
    assert.ok(next && next.kind === "create");
    const nextState = deserializeNpcCustomState(
      next.entity.npc_state?.data
    ).businessCustomer!;
    assert.equal(nextState.phase, "approaching_counter");
    assert.equal(nextState.waypoints.length, 1);
  });

  it("deletes only a safely departed off-screen customer", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const ticket = session.queue[0];
    ticket.status = "served";
    ticket.spatialPhase = "departing";
    const decoded = deserializeNpcCustomState(undefined);
    decoded.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: session.sessionId,
      ticketId: ticket.ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "despawn_ready",
      reaction: "payment",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    const existing = new Map([
      [
        ticket.entityId,
        {
          id: ticket.entityId,
          position: Position.create({ v: [100, 10, 100] }),
          npc_state: NpcState.create({ data: serializeNpcCustomState(decoded) }),
        },
      ],
    ]);
    const near = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: existing,
      nowSeconds: 100,
      actorPosition: [101, 10, 101],
    });
    assert.ok(!near.some((change) => change.kind === "delete"));
    const far = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: existing,
      nowSeconds: 100,
      actorPosition: [0, 10, 0],
    });
    assert.deepEqual(
      far.filter((change) => change.kind === "delete"),
      [{ kind: "delete", id: ticket.entityId }]
    );
    assert.equal(
      ticket.entityId,
      harthmereBusinessCustomerSessionEntityId({
        actorId: "native_matrix_actor",
        sessionId: session.sessionId,
        ticketId: ticket.ticketId,
      })
    );
  });

  it("routes cancelled state through HFC while keeping expiry in regular ECS", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const ticket = session.queue[0];
    session.status = "aborted";
    ticket.status = "left";
    ticket.spatialPhase = "cancelled";
    const decoded = deserializeNpcCustomState(undefined);
    decoded.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: session.sessionId,
      ticketId: ticket.ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "entering",
      reaction: "neutral",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: new Map([
        [
          ticket.entityId,
          {
            id: ticket.entityId,
            position: Position.create({ v: [674.5, 67, -60] }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(decoded),
            }),
          },
        ],
      ]),
      nowSeconds: 100,
    });
    const update = changes.find(
      (change) => change.kind === "update" && change.entity.id === ticket.entityId
    );
    assert.ok(update && update.kind === "update");
    assert.ok(update.entity.expires);
    assert.equal(
      deserializeNpcCustomState(update.entity.npc_state?.data).businessCustomer
        ?.phase,
      "cancelled"
    );

    const partitioned =
      partitionHarthmereBusinessCustomerSessionNpcChanges(changes);
    assert.equal(partitioned.hfcChanges.length, 1);
    assert.ok(partitioned.hfcChanges[0].entity.npc_state);
    assert.equal(partitioned.hfcChanges[0].entity.expires, undefined);
    assert.equal(partitioned.rcChanges.length, 1);
    assert.deepEqual(
      partitioned.rcChanges[0].entity.expires,
      Expires.create({ trigger_at: 190 })
    );
    assert.equal(partitioned.rcChanges[0].entity.npc_state, undefined);
  });
});
