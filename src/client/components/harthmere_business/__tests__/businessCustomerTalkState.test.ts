import {
  harthmereBusinessCustomerTalkTargetCount,
  publishHarthmereBusinessCustomerTalkTargets,
  clearHarthmereBusinessCustomerTalkTarget,
  harthmereBusinessCustomerTalkTargetForEntity,
  publishHarthmereBusinessCustomerTalkTarget,
  resetHarthmereBusinessCustomerTalkStateForTest,
} from "@/client/components/harthmere_business/harthmereBusinessCustomerTalkState";
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

describe("business customer talk routing", () => {
  afterEach(() => resetHarthmereBusinessCustomerTalkStateForTest());

  it("exposes only the active session customer by exact native entity id", () => {
    const target = {
      adapter: {} as any,
      businessId: "business_outpost_refinery_ashline",
      businessType: "exotic_matter_refinery" as const,
      sessionId: "session-1",
      ticketId: "ticket-1",
      entityId: 123 as any,
      customerName: "Customer",
      askLine: "I need containment help.",
      patienceRemaining: 20,
      requestedOfferId: "offer-1",
      phase: "serving",
      ready: true,
      offers: [],
    };
    publishHarthmereBusinessCustomerTalkTarget(target);
    assert.equal(harthmereBusinessCustomerTalkTargetForEntity(123 as any), target);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(124 as any),
      undefined
    );
    clearHarthmereBusinessCustomerTalkTarget(124 as any);
    assert.equal(harthmereBusinessCustomerTalkTargetForEntity(123 as any), target);
    clearHarthmereBusinessCustomerTalkTarget(123 as any);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(123 as any),
      undefined
    );
  });

  it("routes the active customer before quest and ordinary NPC dialogue", () => {
    const screen = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/challenges/TalkToNPCScreen.tsx"
      ),
      "utf8"
    );
    const businessBranch = screen.indexOf("if (businessCustomerTalk)");
    assert.ok(businessBranch >= 0, "business-customer branch missing");
    assert.ok(
      businessBranch < screen.indexOf("else if (queryingStep)"),
      "business service must precede quest/default routing"
    );
    assert.ok(
      screen.includes("<HarthmereBusinessCustomerTalkDialog"),
      "active customer must render the service-choice dialog"
    );
  });

  it("keeps service choices out of the always-visible spatial status card", () => {
    const hud = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    const dialog = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessCustomerTalkDialog.tsx"
      ),
      "utf8"
    );
    assert.ok(hud.includes("Talk to this customer to choose"));
    assert.equal(hud.includes("data-business-offer-id"), false);
    assert.ok(dialog.includes("additionalActions={serviceActions}"));
    assert.equal(dialog.includes('name: "Chit Chat"'), false);
    assert.equal(dialog.includes('name: "Ask about this place"'), false);
  });
});

describe("business customer talk registry covers the whole queue", () => {
  afterEach(() => resetHarthmereBusinessCustomerTalkStateForTest());

  const target = (entityId: number, ticketId: string, ready: boolean) => ({
    adapter: {} as any,
    businessId: "business_outpost_refinery_ashline",
    businessType: "exotic_matter_refinery" as const,
    sessionId: "session-1",
    ticketId,
    entityId: entityId as any,
    customerName: `customer-${ticketId}`,
    askLine: "I need containment help.",
    patienceRemaining: 20,
    requestedOfferId: "offer-1",
    phase: ready ? "serving" : "queued",
    ready,
    offers: [],
  });

  it("registers every queued customer, not just the one being served", () => {
    // The defect this replaces: only the front customer had business content
    // attached, so talking to anyone else in the queue fell through to the
    // ordinary "Chit Chat / Ask about this place" NPC dialogue from a person
    // standing in a shop queue holding a service request.
    publishHarthmereBusinessCustomerTalkTargets([
      target(101, "ticket-1", true),
      target(102, "ticket-2", false),
      target(103, "ticket-3", false),
    ]);
    for (const id of [101, 102, 103]) {
      assert.ok(
        harthmereBusinessCustomerTalkTargetForEntity(id as any),
        `entity ${id} is not talkable as a business customer`
      );
    }
    assert.equal(harthmereBusinessCustomerTalkTargetCount(), 3);
  });

  it("offers service only for the customer at the counter", () => {
    // A queued customer is real and talkable, but presenting offers for them
    // would let the player serve out of order and break the spatial queue.
    publishHarthmereBusinessCustomerTalkTargets([
      target(201, "ticket-1", true),
      target(202, "ticket-2", false),
    ]);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(201 as any)?.ready,
      true
    );
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(202 as any)?.ready,
      false
    );
  });

  it("drops served and departed customers on the next publish", () => {
    // A stale entry is worse than none: it would offer service to a customer
    // who has already walked out of the shop.
    publishHarthmereBusinessCustomerTalkTargets([
      target(301, "ticket-1", true),
      target(302, "ticket-2", false),
    ]);
    publishHarthmereBusinessCustomerTalkTargets([target(302, "ticket-2", true)]);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(301 as any),
      undefined
    );
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(302 as any)?.ready,
      true
    );
    assert.equal(harthmereBusinessCustomerTalkTargetCount(), 1);
  });

  it("clears the whole registry when the shift ends", () => {
    publishHarthmereBusinessCustomerTalkTargets([
      target(401, "ticket-1", true),
      target(402, "ticket-2", false),
    ]);
    clearHarthmereBusinessCustomerTalkTarget();
    assert.equal(harthmereBusinessCustomerTalkTargetCount(), 0);
  });

  it("keeps the shift HUD publishing the queue, not a single target", () => {
    // Source contract: the per-card effect may only refine the current customer.
    // If it regains a cleanup that deregisters on unmount, the customer the
    // player is walking up to talk to loses its business dialogue again.
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("publishHarthmereBusinessCustomerTalkTargets"),
      "shift HUD must publish the whole queue"
    );
    assert.ok(
      !/return \(\) => clearHarthmereBusinessCustomerTalkTarget\(entityId\)/.test(
        source
      ),
      "the per-card effect must not deregister the current customer"
    );
  });
});
