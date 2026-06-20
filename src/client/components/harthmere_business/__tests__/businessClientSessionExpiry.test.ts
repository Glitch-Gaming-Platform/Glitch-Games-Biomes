/// <reference types="mocha" />

// HARTHMERE_BUSINESS_CLIENT_SESSION_EXPIRY_GUARD
//
// Regression coverage for the "mini-game just spins on the current customer"
// bug. The economy snapshot the server ships keeps customer sessions verbatim,
// including ones whose `expiresAtMs` has already elapsed but whose `status` is
// still "active" (the backend only flips them on the next mutation). The live
// in-world panel used to treat any `status === "active"` session as live, which
// disabled "Start Shift" and made every serve_business_customer call reject with
// economy_rejected:business_customer_session_not_active.
//
// Layers exercised here:
//   - frontend: the pure client selectors + the live adapter's submit recovery.
//   - SSR boundary: the authoritative -> client economy snapshot round-trip
//     (createHarthmereProductionEconomyClientSnapshot) preserves expiresAtMs so
//     the client time check can run.

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereBusinessInterfacePanel } from "../HarthmereBusinessInterfacePanel";
import {
  activeHarthmereBusinessClientCustomerSession,
  createHarthmereBusinessInterfaceAdapter,
  getHarthmereBusinessCustomerMiniGame,
  type HarthmereBusinessEconomySnapshot,
} from "@/client/components/harthmere_business/businessInterfaceLiveAdapter";
import {
  createHarthmereProductionEconomyClientSnapshot,
  defaultHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyMutationRequest,
  type HarthmereProductionEconomyState,
} from "@/shared/harthmere/mmo_economy_authority";

const NOW_MS = 1_800_000_000_000;
const BUSINESS_TYPE = "medical_doctor";

function clinicSnapshot(
  sessionOverrides: Record<string, unknown> = {}
): HarthmereBusinessEconomySnapshot {
  const businessId = "biz_clinic";
  const session = {
    sessionId: "session_1",
    businessId,
    typeId: BUSINESS_TYPE,
    status: "active",
    startedAtMs: NOW_MS - 10,
    expiresAtMs: NOW_MS + 1_000,
    currentTicketId: "ticket_1",
    queue: [
      {
        ticketId: "ticket_1",
        status: "waiting",
        npcId: "npc_1",
        requestedOfferId: "offer_1",
        patience: 72,
        patienceRemaining: 72,
        arrivedAtMs: NOW_MS,
        difficulty: 1,
        askId: "ask_1",
        askLine: "Help please",
        rewardGold: 5,
        needDelta: 0,
      },
    ],
    servedTicketIds: [],
    failedTicketIds: [],
    streak: 0,
    satisfaction: 50,
    earnedGold: 0,
    progressPoints: 0,
    dailyBonusGold: 10,
    notes: [],
    ...sessionOverrides,
  };
  return {
    businesses: {
      [businessId]: { businessId, typeId: BUSINESS_TYPE, status: "open" },
    },
    businessSystems: {
      customerSessions: { [session.sessionId]: session },
      customerStats: {},
    },
    regions: {},
    businessTypes: {},
  } as unknown as HarthmereBusinessEconomySnapshot;
}

describe("harthmere business client session expiry guard", function () {
  it("treats a live session as active", () => {
    const state = clinicSnapshot();
    const active = activeHarthmereBusinessClientCustomerSession(
      state,
      "biz_clinic",
      NOW_MS
    );
    assert.ok(active, "live session should be active");
  });

  it("filters a stale session whose expiresAtMs has elapsed even if status is still active", () => {
    const state = clinicSnapshot({ expiresAtMs: NOW_MS - 1 });
    const active = activeHarthmereBusinessClientCustomerSession(
      state,
      "biz_clinic",
      NOW_MS
    );
    assert.equal(
      active,
      undefined,
      "expired session must not count as active"
    );
  });

  it("does not surface a current customer for an expired session (keeps Start Shift usable)", () => {
    const state = clinicSnapshot({ expiresAtMs: NOW_MS - 1 });
    const panel = getHarthmereBusinessCustomerMiniGame(
      state,
      "biz_clinic",
      NOW_MS
    );
    assert.equal(panel.activeSession, undefined);
    assert.equal(panel.currentTicket, undefined);
  });

  it("SSR-renders an expired active-looking session as ready to start, not stuck on a customer", () => {
    const state = clinicSnapshot({ expiresAtMs: 1 });
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });

    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "biz_clinic",
        initialTab: "customers",
        compact: true,
      })
    );

    assert.ok(html.includes("Ready"));
    assert.ok(html.includes("Start Shift"));
    assert.ok(
      html.includes("Start a shift to bring customer-only NPCs to the counter.")
    );
    assert.equal(html.includes("Help please"), false);
    assert.equal(html.includes("Shift Live"), false);
  });

  it("surfaces the current customer for a live session", () => {
    const state = clinicSnapshot({ expiresAtMs: NOW_MS + 60_000 });
    const panel = getHarthmereBusinessCustomerMiniGame(
      state,
      "biz_clinic",
      NOW_MS
    );
    assert.ok(panel.activeSession);
    assert.ok(panel.currentTicket);
  });

  it("re-syncs client state when a mutation is rejected so the UI can recover", async () => {
    let refreshes = 0;
    const live = clinicSnapshot({ expiresAtMs: NOW_MS + 60_000 });
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state: live,
      hydrated: true,
      setState: () => {},
      refresh: async () => {
        refreshes += 1;
        return live;
      },
      submit: async () => {
        throw new Error(
          "economy_rejected:business_customer_session_not_active"
        );
      },
    });

    let threw = false;
    try {
      await adapter.serveCustomer("biz_clinic", "offer_1", "session_1", "ticket_1");
    } catch (error) {
      threw = true;
      assert.match(String(error), /business_customer_session_not_active/);
    }
    assert.ok(threw, "rejection should propagate to the caller");
    assert.ok(
      refreshes >= 1,
      "client must re-pull authoritative state after a rejection"
    );
  });

  it("SSR boundary: the authoritative->client economy snapshot preserves session expiry", () => {
    let state: HarthmereProductionEconomyState =
      defaultHarthmereProductionEconomyState();
    const mutate = (
      operation: string,
      payload: Partial<HarthmereEconomyMutationRequest> = {}
    ) => {
      const result = reduceHarthmereEconomyMutation(
        state,
        {
          requestId: `ssr-${operation}-${Math.random()}`,
          actorId: "ssr_owner",
          nowMs: NOW_MS,
          operation,
          ...payload,
        } as HarthmereEconomyMutationRequest,
        {
          actorGold: 50_000,
          actorInventoryItems: {},
          allowNpcAdministration: false,
        }
      );
      assert.deepEqual(result.warnings, [], `${operation} warnings`);
      state = result.economy;
    };

    mutate("register_business", {
      businessType: BUSINESS_TYPE,
      name: "Greenlamp Clinic",
    } as Partial<HarthmereEconomyMutationRequest>);
    const businessId = Object.keys(state.businesses)[0];
    mutate("issue_license", {
      businessId,
      licenseLevel: 2,
    } as Partial<HarthmereEconomyMutationRequest>);
    mutate("open_business", {
      businessId,
      propertyId: `property_${businessId}`,
      townId: "harthmere_grove",
    } as Partial<HarthmereEconomyMutationRequest>);
    mutate("start_business_customer_session", {
      businessId,
      count: 3,
    } as Partial<HarthmereEconomyMutationRequest>);

    // Serialize exactly as the SSR/live_mode path ships state to the client.
    const clientSnapshot = JSON.parse(
      JSON.stringify(
        createHarthmereProductionEconomyClientSnapshot(state, "ssr_owner")
      )
    ) as HarthmereBusinessEconomySnapshot;

    const persistedSession = Object.values(
      clientSnapshot.businessSystems.customerSessions ?? {}
    )[0] as { expiresAtMs?: number; status?: string } | undefined;
    assert.ok(persistedSession, "session survives the client snapshot");
    assert.equal(typeof persistedSession?.expiresAtMs, "number");
    assert.equal(persistedSession?.status, "active");

    // The client time check accepts it while live and rejects it once expired.
    assert.ok(
      activeHarthmereBusinessClientCustomerSession(
        clientSnapshot,
        businessId,
        NOW_MS
      )
    );
    assert.equal(
      activeHarthmereBusinessClientCustomerSession(
        clientSnapshot,
        businessId,
        (persistedSession!.expiresAtMs ?? NOW_MS) + 1
      ),
      undefined
    );
  });
});
