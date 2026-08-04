import assert from "assert";
import { HybridWorldApi } from "@/server/shared/world/hfc/hybrid";
import { Expires, NpcState, Position } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerQueueTarget,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessCustomerSessionEntityId,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  createHarthmereBusinessCustomerQueue,
  type HarthmereBusinessCustomerSession,
} from "@/shared/harthmere/business_customer_simulator";
import { defaultHarthmereProductionEconomyState } from "@/shared/harthmere/mmo_economy_authority";
import { yaw } from "@/shared/math/linear";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import {
  applyHarthmereBusinessCustomerSessionNpcChanges,
  buildHarthmereBusinessCustomerSessionNpcChanges,
  partitionHarthmereBusinessCustomerSessionNpcChanges,
} from "../business_customer_session_ecs";

function sessionFor(
  record: (typeof HARTHMERE_BUSINESS_INTERIORS)[number],
  suffix = "",
  actorId = "native_matrix_actor"
) {
  const sessionId = `session_${record.outpostId}${suffix}`;
  const queue = createHarthmereBusinessCustomerQueue({
    businessId: `business:${record.outpostId}`,
    typeId: record.businessType as any,
    sessionId,
    actorId,
    actorEntityId: 123456 as any,
    nowMs: 1000,
    count: 3,
    nextTicketNumber: 1,
  }).queue;
  return {
    sessionId,
    businessId: `business:${record.outpostId}`,
    typeId: record.businessType,
    actorId,
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
  it("creates the lead session-only NPC first for every audited business", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const session = sessionFor(record);
      const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
        economy: economyFor(session),
        nowSeconds: 100,
      });
      assert.equal(changes.length, 1, record.outpostId);
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
        const spawn = harthmereBusinessCustomerSpawnPoint(record, index);
        assert.deepEqual(change.entity.position?.v, spawn);
        assert.deepEqual(change.entity.npc_metadata?.spawn_position, spawn);
        const firstTarget = state.waypoints[0];
        assert.equal(
          change.entity.orientation?.v[1],
          yaw([firstTarget[0] - spawn[0], 0, firstTarget[2] - spawn[2]])
        );
      }
    }
  });

  it("materializes only the requesting actor while retaining foreign route occupancy", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const mine = sessionFor(record, "_mine", "actor_a");
    const theirs = sessionFor(record, "_theirs", "actor_b");
    const economy = defaultHarthmereProductionEconomyState();
    (economy.businessSystems as any).customerSessions = {
      [mine.sessionId]: mine,
      [theirs.sessionId]: theirs,
    };

    const foreignState = deserializeNpcCustomState(undefined);
    foreignState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: theirs.sessionId,
      ticketId: theirs.queue[0].ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "entering",
      reaction: "neutral",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [[1, 0, 1]],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    const occupied = new Map([
      [
        theirs.queue[0].entityId,
        {
          id: theirs.queue[0].entityId,
          position: Position.create({
            v: harthmereBusinessCustomerSpawnPoint(record, 0),
          }),
          npc_state: NpcState.create({
            data: serializeNpcCustomState(foreignState),
          }),
        },
      ],
    ]);
    assert.deepEqual(
      buildHarthmereBusinessCustomerSessionNpcChanges({
        economy,
        actorId: "actor_a",
        nowSeconds: 100,
        existingEntities: occupied,
      }),
      [],
      "a foreign customer on the route must defer, not be rewritten or overlapped"
    );
    const actorBChanges = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy,
      actorId: "actor_b",
      nowSeconds: 100,
      existingEntities: occupied,
    });
    assert.ok(
      actorBChanges.every(
        (change) =>
          change.kind !== "create" ||
          change.entity.id === theirs.queue[0].entityId
      ),
      "actor B must never materialize actor A's customer"
    );
  });

  it("does not let permanent ambient patrons block the real shift customer", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const patronState = deserializeNpcCustomState(undefined);
    patronState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: `persistent:${record.outpostId}`,
      ticketId: "ambient-patron",
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "patron_wandering",
      reaction: "neutral",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [[0, 0, 0]],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 100,
      existingEntities: new Map([
        [
          999 as any,
          {
            id: 999 as any,
            position: Position.create({ v: [0, 0, 0] }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(patronState),
            }),
          },
        ],
      ]),
    });
    assert.ok(
      changes.some(
        (change) =>
          change.kind === "create" &&
          change.entity.id === session.queue[0].entityId
      ),
      "ambient patrons must not count as a prior customer route"
    );
  });

  it("cleans an inactive foreign route without taking over an active foreign game", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const mine = sessionFor(record, "_mine_cleanup", "actor_a");
    const stale = sessionFor(record, "_stale_cleanup", "actor_b");
    stale.status = "expired";
    stale.currentTicketId = undefined;
    stale.queue[0].status = "left";
    stale.queue[0].spatialPhase = "cancelled";
    const economy = defaultHarthmereProductionEconomyState();
    (economy.businessSystems as any).customerSessions = {
      [mine.sessionId]: mine,
      [stale.sessionId]: stale,
    };
    const staleState = deserializeNpcCustomState(undefined);
    staleState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: stale.sessionId,
      ticketId: stale.queue[0].ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "entering",
      reaction: "neutral",
      entrance: [0, 0, 0],
      queueTarget: [0, 0, 0],
      customer: [0, 0, 0],
      staff: [0, 0, 0],
      departure: [0, 0, 0],
      waypoints: [[1, 0, 1]],
      waypointIndex: 0,
      lastPhaseChangedAtSeconds: 90,
    };
    const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy,
      actorId: "actor_a",
      nowSeconds: 100,
      existingEntities: new Map([
        [
          stale.queue[0].entityId,
          {
            id: stale.queue[0].entityId,
            position: Position.create({
              v: harthmereBusinessCustomerSpawnPoint(record, 0),
            }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(staleState),
            }),
          },
        ],
      ]),
    });
    const staleUpdate = changes.find(
      (change) =>
        change.kind === "update" && change.entity.id === stale.queue[0].entityId
    );
    assert.equal(staleUpdate?.kind, "update");
    assert.equal(
      deserializeNpcCustomState(
        staleUpdate?.kind === "update"
          ? staleUpdate.entity.npc_state?.data
          : undefined
      ).businessCustomer?.phase,
      "cancelled"
    );
  });

  it("materializes only the current ticket, then advances one customer at a time", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const existingFor = (
      ticketIndex: number,
      phase: "entering" | "queued" | "serving"
    ) => {
      const ticket = session.queue[ticketIndex];
      const decoded = deserializeNpcCustomState(undefined);
      decoded.businessCustomer = {
        version: "harthmere-business-customer-behavior-v1",
        sessionId: session.sessionId,
        ticketId: ticket.ticketId,
        outpostId: record.outpostId,
        businessType: record.businessType,
        actorEntityId: session.actorEntityId,
        phase,
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
      const position =
        phase === "serving"
          ? harthmereBusinessInteriorInteractionPoints(record).customer
          : phase === "queued"
            ? harthmereBusinessCustomerQueueTarget(record, ticketIndex)
            : harthmereBusinessCustomerSpawnPoint(record, ticketIndex);
      return {
        id: ticket.entityId,
        position: Position.create({
          v: position,
        }),
        npc_state: NpcState.create({
          data: serializeNpcCustomState(decoded),
        }),
      };
    };

    const leadEntering = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 100,
      existingEntities: new Map([
        [session.queue[0].entityId, existingFor(0, "entering")],
      ]),
    });
    assert.equal(
      leadEntering.filter((change) => change.kind === "create").length,
      0
    );

    const leadServing = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 101,
      existingEntities: new Map([
        [session.queue[0].entityId, existingFor(0, "serving")],
      ]),
    });
    assert.equal(
      leadServing.filter((change) => change.kind === "create").length,
      0,
      "a serving lead must not make the rest of the store run for the door"
    );

    session.queue[0].status = "served";
    session.queue[0].spatialPhase = "departing";
    session.servedTicketIds.push(session.queue[0].ticketId);
    session.currentTicketId = session.queue[1].ticketId;
    const firstFollowerActive = buildHarthmereBusinessCustomerSessionNpcChanges(
      {
        economy: economyFor(session),
        nowSeconds: 102,
        existingEntities: new Map([
          [session.queue[0].entityId, existingFor(0, "serving")],
        ]),
      }
    );
    const firstFollower = firstFollowerActive.filter(
      (change) => change.kind === "create"
    );
    assert.equal(firstFollower.length, 1);
    assert.equal(
      firstFollower[0].kind === "create" && firstFollower[0].entity.id,
      session.queue[1].entityId
    );

    const followerServing = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 103,
      existingEntities: new Map([
        [session.queue[0].entityId, existingFor(0, "serving")],
        [session.queue[1].entityId, existingFor(1, "serving")],
      ]),
    });
    assert.equal(
      followerServing.filter((change) => change.kind === "create").length,
      0,
      "the third customer remains an economy record until queue advance"
    );
  });

  it("defers a rapid-restart spawn while the prior shift still occupies it", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const prior = sessionFor(record, "_prior");
    prior.status = "aborted";
    for (const ticket of prior.queue) {
      ticket.status = "left";
      ticket.spatialPhase = "cancelled";
    }
    const next = sessionFor(record, "_next");
    const economy = defaultHarthmereProductionEconomyState();
    (economy.businessSystems as any).customerSessions = {
      [prior.sessionId]: prior,
      [next.sessionId]: next,
    };
    const oldState = deserializeNpcCustomState(undefined);
    oldState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: prior.sessionId,
      ticketId: prior.queue[0].ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "cancelled",
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
      economy,
      nowSeconds: 100,
      existingEntities: new Map([
        [
          prior.queue[0].entityId,
          {
            id: prior.queue[0].entityId,
            position: Position.create({
              v: harthmereBusinessCustomerSpawnPoint(record, 0),
            }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(oldState),
            }),
          },
        ],
      ]),
    });
    assert.equal(
      changes.some(
        (change) =>
          change.kind === "create" &&
          change.entity.id === next.queue[0].entityId
      ),
      false
    );
  });

  it("cancels persisted expired customers and defers the whole replacement route", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const prior = sessionFor(record, "_expired");
    prior.status = "expired";
    const next = sessionFor(record, "_replacement");
    const economy = defaultHarthmereProductionEconomyState();
    (economy.businessSystems as any).customerSessions = {
      [prior.sessionId]: prior,
      [next.sessionId]: next,
    };
    const oldState = deserializeNpcCustomState(undefined);
    oldState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: prior.sessionId,
      ticketId: prior.queue[0].ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "queued",
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
      economy,
      nowSeconds: 100,
      existingEntities: new Map([
        [
          prior.queue[0].entityId,
          {
            id: prior.queue[0].entityId,
            position: Position.create({
              v: harthmereBusinessCustomerSpawnPoint(record, 0),
            }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(oldState),
            }),
          },
        ],
      ]),
    });
    const priorUpdate = changes.find(
      (change) =>
        change.kind === "update" && change.entity.id === prior.queue[0].entityId
    );
    assert.equal(priorUpdate?.kind, "update");
    assert.equal(
      deserializeNpcCustomState(
        priorUpdate?.kind === "update"
          ? priorUpdate.entity.npc_state?.data
          : undefined
      ).businessCustomer?.phase,
      "cancelled"
    );
    assert.equal(
      changes.some(
        (change) =>
          change.kind === "create" &&
          next.queue.some((ticket) => ticket.entityId === change.entity.id)
      ),
      false
    );
  });

  it("deletes an inactive overlapped customer only when already safely off-screen", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const prior = sessionFor(record, "_safe_cleanup");
    prior.status = "expired";
    const oldState = deserializeNpcCustomState(undefined);
    oldState.businessCustomer = {
      version: "harthmere-business-customer-behavior-v1",
      sessionId: prior.sessionId,
      ticketId: prior.queue[0].ticketId,
      outpostId: record.outpostId,
      businessType: record.businessType,
      phase: "queued",
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
      economy: economyFor(prior),
      nowSeconds: 100,
      actorPosition: [0, 0, 0],
      existingEntities: new Map([
        [
          prior.queue[0].entityId,
          {
            id: prior.queue[0].entityId,
            position: Position.create({
              v: harthmereBusinessCustomerSpawnPoint(record, 0),
            }),
            npc_state: NpcState.create({
              data: serializeNpcCustomState(oldState),
            }),
          },
        ],
      ]),
    });
    assert.ok(
      changes.some(
        (change) =>
          change.kind === "delete" && change.id === prior.queue[0].entityId
      )
    );
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
      (change) =>
        change.kind === "update" && change.entity.id === first.entityId
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
          npc_state: NpcState.create({
            data: serializeNpcCustomState(decoded),
          }),
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
      (change) =>
        change.kind === "update" && change.entity.id === ticket.entityId
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

  it("does not overwrite Anima-owned route progress on repeated session ticks", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const session = sessionFor(record);
    const ticket = session.queue[0];
    const created = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 100,
    }).find((change) => change.kind === "create");
    assert.ok(created && created.kind === "create");

    const decoded = deserializeNpcCustomState(created.entity.npc_state?.data);
    const customer = decoded.businessCustomer!;
    customer.waypointIndex = 1;
    customer.progressPosition = [673.4, 67.02, -61.3];
    customer.progressAtSeconds = 104;
    const existing = new Map([
      [
        ticket.entityId,
        {
          id: ticket.entityId,
          position: Position.create({ v: customer.progressPosition }),
          npc_state: NpcState.create({
            data: serializeNpcCustomState(decoded),
          }),
        },
      ],
    ]);

    const repeated = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: existing,
      nowSeconds: 106,
    });
    assert.deepEqual(
      repeated,
      [],
      "a no-op economy tick must not erase or rewrite Anima movement state"
    );

    ticket.status = "served";
    ticket.spatialPhase = "departing";
    ticket.reaction = "payment";
    const transitioned = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: existing,
      nowSeconds: 108,
    });
    const update = transitioned.find(
      (change) =>
        change.kind === "update" && change.entity.id === ticket.entityId
    );
    assert.ok(update && update.kind === "update");
    const departingNpcState = update.entity.npc_state;
    assert.ok(departingNpcState);
    const departing = deserializeNpcCustomState(
      departingNpcState.data
    ).businessCustomer!;
    assert.equal(departing.phase, "departing");
    assert.equal(departing.reaction, "payment");
    assert.equal(departing.progressPosition, undefined);
    assert.equal(departing.progressAtSeconds, undefined);
    assert.deepEqual(
      update.entity.expires,
      Expires.create({ trigger_at: 198 })
    );
    assert.ok(update.entity.emote);

    const repeatedExisting = new Map([
      [
        ticket.entityId,
        {
          id: ticket.entityId,
          position: Position.create({ v: customer.progressPosition }),
          npc_state: departingNpcState,
        },
      ],
    ]);
    const repeatedDeparture = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      existingEntities: repeatedExisting,
      nowSeconds: 120,
    });
    assert.equal(
      repeatedDeparture.some(
        (change) =>
          (change.kind === "update" && change.entity.id === ticket.entityId) ||
          (change.kind === "delete" && change.id === ticket.entityId)
      ),
      false,
      "departure expiry and reaction emote must not restart every session tick"
    );
  });

  it("publishes new customer HFC components after the regular ECS create", async () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(sessionFor(record)),
      nowSeconds: 100,
    });
    const calls: Array<{
      store: "rc" | "hfc";
      changes: any[];
    }> = [];
    const success = { outcome: "success" as const };
    const rc = {
      apply: async ({ changes }: { changes: any[] }) => {
        calls.push({ store: "rc", changes });
        return success;
      },
    };
    const hfc = {
      apply: async ({ changes }: { changes: any[] }) => {
        calls.push({ store: "hfc", changes });
        return success;
      },
    };
    const hybrid = new HybridWorldApi(rc as any, hfc as any);

    const result = await applyHarthmereBusinessCustomerSessionNpcChanges(
      hybrid,
      changes
    );

    assert.equal(result.outcome, "success");
    assert.equal(calls[0].store, "rc");
    assert.equal(calls[0].changes[0].kind, "create");
    assert.ok(calls[0].changes[0].entity.position);
    const hfcCall = calls.find((call) => call.store === "hfc");
    assert.ok(hfcCall);
    const hfcCreate = hfcCall.changes.find(
      (change) =>
        change.kind === "update" &&
        change.entity.id === calls[0].changes[0].entity.id
    );
    assert.ok(hfcCreate?.entity.position);
    assert.ok(hfcCreate?.entity.npc_state);
    assert.ok(hfcCreate?.entity.orientation);
    assert.equal(hfcCreate?.entity.npc_metadata, undefined);
  });

  // HARTHMERE_BUSINESS_CUSTOMER_ANIMA_OWNERSHIP
  // Business customers are not a parallel simulation. They are ordinary native
  // NPC entities, which is what makes Anima pick them up: `NpcSelector` matches
  // on npc_metadata/npc_state/orientation/position/rigid_body/size/health, and
  // Anima's ticker then runs the same `npcTickLogic` every other NPC uses,
  // which dispatches to `businessCustomerTick`.
  //
  // If a future change drops one of those components the customer becomes an
  // inert prop: it exists in the world, the economy still advances its ticket,
  // and it never moves — the exact shape of the original live failure. This row
  // asserts the component set for every business so that regression is a unit
  // failure rather than nineteen timed-out browser rows.
  it("creates customers Anima will manage for every audited business", () => {
    const requiredForAnima = [
      "npc_metadata",
      "npc_state",
      "orientation",
      "position",
      "rigid_body",
      "size",
      "health",
    ] as const;
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const changes = buildHarthmereBusinessCustomerSessionNpcChanges({
        economy: economyFor(sessionFor(record)),
        nowSeconds: 100,
      });
      const created = changes.filter((change) => change.kind === "create");
      assert.ok(
        created.length >= 1,
        `${record.outpostId} materialized no customer`
      );
      for (const change of created) {
        for (const component of requiredForAnima) {
          assert.ok(
            (change as any).entity[component] !== undefined,
            `${record.outpostId} customer is missing ${component}; Anima would never simulate it`
          );
        }
      }
    }
  });
});
