import assert from "assert";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { Position, NpcState } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS,
  createHarthmereBusinessMiniGameDecisionForOffer,
} from "@/shared/harthmere/business_customer_simulator";
import { defaultHarthmereLiveModeBackendState } from "@/shared/harthmere/live_mode_backend";
import {
  defaultHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyBusinessTypeId,
  type HarthmereProductionEconomyState,
} from "@/shared/harthmere/mmo_economy_authority";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import {
  materializeHarthmereBusinessCustomersToEcs,
  readHarthmereBusinessCustomerNativeReadyForTest,
} from "../live_mode";

const ACTOR_ID = 8812999999000001 as any;
const NOW_MS = 1_800_000_000_000;

function mutate(
  state: HarthmereProductionEconomyState,
  operation: string,
  payload: Record<string, unknown> = {}
) {
  return reduceHarthmereEconomyMutation(
    state,
    {
      requestId: `business-native-e2e-${operation}-${Math.random()}`,
      actorId: String(ACTOR_ID),
      nowMs: NOW_MS,
      operation,
      ...payload,
    } as any,
    {
      actorGold: 50_000,
      actorInventoryItems: {},
      actorEntityId: ACTOR_ID,
      nativeBusinessCustomerRequired: true,
      allowNpcAdministration: false,
    }
  );
}

function openBusiness(typeId: HarthmereEconomyBusinessTypeId) {
  let state = defaultHarthmereProductionEconomyState();
  let result = mutate(state, "register_business", {
    businessType: typeId,
    name: `${typeId} Native E2E`,
  });
  assert.deepEqual(result.warnings, []);
  state = result.economy;
  const businessId = Object.keys(state.businesses)[0];
  const minLicense =
    typeId === "exotic_matter_refinery" ||
    typeId === "portal_transit_company"
      ? 3
      : typeId === "medical_doctor" ||
          typeId === "magic_goods" ||
          typeId === "teleport_owner"
        ? 2
        : 1;
  result = mutate(state, "issue_license", {
    businessId,
    licenseLevel: minLicense,
  });
  state = result.economy;
  result = mutate(state, "open_business", {
    businessId,
    propertyId: `property_${businessId}`,
    townId: "harthmere_grove",
  });
  assert.deepEqual(result.warnings, []);
  return { state: result.economy, businessId };
}

function sessions(state: HarthmereProductionEconomyState) {
  return Object.values(
    (state.businessSystems as any).customerSessions ?? {}
  ) as any[];
}

describe("native ECS business customer E2E matrix", function () {
  this.timeout(300_000);

  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    it(`${record.displayName}: native enter/service/reward/exit/reload`, async () => {
      const world = new InMemoryWorld();
      const worldApi = ShimWorldApi.createForWorld(world);
      const setup = openBusiness(
        record.businessType as HarthmereEconomyBusinessTypeId
      );
      let result = mutate(setup.state, "start_business_customer_session", {
        businessId: setup.businessId,
        count: 1,
      });
      assert.deepEqual(result.warnings, []);
      let session = sessions(result.economy)[0];
      const ticket = session.queue[0];
      const backend = defaultHarthmereLiveModeBackendState(
        String(ACTOR_ID),
        NOW_MS
      );
      backend.economy.production = result.economy;
      const materialized = await materializeHarthmereBusinessCustomersToEcs({
        worldApi,
        state: backend,
        nowSeconds: NOW_MS / 1000,
        actorId: String(ACTOR_ID),
        actorPosition: {
          x: record.deskWorldPivot[0],
          y: record.deskWorldPivot[1],
          z: record.deskWorldPivot[2],
        },
      });
      assert.equal(materialized.changeCount, 1);
      let entity = await worldApi.get(ticket.entityId);
      assert.ok(entity);
      let npcState = deserializeNpcCustomState(entity!.npcState()?.data)
        .businessCustomer!;
      assert.equal(npcState.phase, "entering");
      assert.deepEqual(npcState.waypoints[0],
        harthmereBusinessInteriorInteractionPoints(record).entrance
      );

      // This is the deterministic E2E stand-in for Anima completing the
      // authored route. The Anima unit lane owns the movement integration;
      // this native row proves the exact ECS state is what gates Logic/economy.
      npcState.phase = "serving";
      npcState.waypointIndex = npcState.waypoints.length;
      await worldApi.apply({
        changes: [
          {
            kind: "update",
            entity: {
              id: ticket.entityId,
              position: Position.create({ v: npcState.customer }),
              npc_state: NpcState.create({
                data: serializeNpcCustomState({ businessCustomer: npcState }),
              }),
            },
          },
        ],
      });
      assert.equal(
        await readHarthmereBusinessCustomerNativeReadyForTest({
          worldApi,
          operation: "serve_business_customer",
          customerEntityId: ticket.entityId,
          sessionId: session.sessionId,
          ticketId: ticket.ticketId,
        }),
        true
      );

      const offer = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[
        record.businessType as HarthmereEconomyBusinessTypeId
      ].offers.find((candidate) => candidate.offerId === ticket.requestedOfferId)!;
      for (const [itemId, count] of Object.entries(offer.requiredItems)) {
        result.economy.businesses[setup.businessId].inventory[itemId] = {
          itemId,
          count,
        };
      }
      const beforeGold =
        result.economy.businesses[setup.businessId].balanceGold;
      result = mutate(result.economy, "serve_business_customer", {
        businessId: setup.businessId,
        sessionId: session.sessionId,
        ticketId: ticket.ticketId,
        offerId: offer.offerId,
        nativeCustomerReady: true,
        minigameAction: createHarthmereBusinessMiniGameDecisionForOffer(
          record.businessType as HarthmereEconomyBusinessTypeId,
          offer.offerId
        ),
      });
      assert.deepEqual(result.warnings, []);
      assert.ok(result.inventoryGoldDelta > 0);
      assert.ok(
        result.economy.businesses[setup.businessId].balanceGold > beforeGold
      );
      session = sessions(result.economy)[0];
      assert.equal(session.status, "completed");
      assert.equal(session.queue[0].spatialPhase, "departing");
      assert.equal(session.queue[0].reaction, "payment");

      backend.economy.production = result.economy;
      await materializeHarthmereBusinessCustomersToEcs({
        worldApi,
        state: backend,
        nowSeconds: NOW_MS / 1000 + 1,
        actorId: String(ACTOR_ID),
        actorPosition: {
          x: record.deskWorldPivot[0],
          y: record.deskWorldPivot[1],
          z: record.deskWorldPivot[2],
        },
      });
      entity = await worldApi.get(ticket.entityId);
      npcState = deserializeNpcCustomState(entity!.npcState()?.data)
        .businessCustomer!;
      assert.equal(npcState.phase, "departing");
      assert.deepEqual(
        npcState.waypoints.at(-1),
        npcState.departure,
        `${record.outpostId}: exit route ends at departure`
      );
      assert.ok(entity!.expires());

      const reloaded = JSON.parse(JSON.stringify(result.economy));
      const reloadedSession = sessions(reloaded)[0];
      assert.equal(reloadedSession.sessionId, session.sessionId);
      assert.equal(reloadedSession.servedTicketIds[0], ticket.ticketId);
      const secondSessionRead = await worldApi.get(ticket.entityId);
      assert.equal(
        deserializeNpcCustomState(secondSessionRead!.npcState()?.data)
          .businessCustomer?.phase,
        "departing"
      );
    });
  }
});
