import assert from "assert";
import { HybridWorldApi } from "@/server/shared/world/hfc/hybrid";
import { Expires, NpcState, Position } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessCustomerSessionEntityId,
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
  suffix = ""
) {
  const sessionId = `session_${record.outpostId}${suffix}`;
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

  it("admits each follower only after the preceding customer settles", () => {
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
      return {
        id: ticket.entityId,
        position: Position.create({
          v: harthmereBusinessCustomerSpawnPoint(record, ticketIndex),
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
    const firstFollower = leadServing.filter(
      (change) => change.kind === "create"
    );
    assert.equal(firstFollower.length, 1);
    assert.equal(
      firstFollower[0].kind === "create" && firstFollower[0].entity.id,
      session.queue[1].entityId
    );

    const followerQueued = buildHarthmereBusinessCustomerSessionNpcChanges({
      economy: economyFor(session),
      nowSeconds: 102,
      existingEntities: new Map([
        [session.queue[0].entityId, existingFor(0, "serving")],
        [session.queue[1].entityId, existingFor(1, "queued")],
      ]),
    });
    const secondFollower = followerQueued.filter(
      (change) => change.kind === "create"
    );
    assert.equal(secondFollower.length, 1);
    assert.equal(
      secondFollower[0].kind === "create" && secondFollower[0].entity.id,
      session.queue[2].entityId
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
