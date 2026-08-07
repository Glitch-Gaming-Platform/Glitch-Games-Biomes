import {
  canDirectlyTalkToHarthmereBusinessCustomer,
  harthmereBusinessCustomerEffectivePhase,
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
  const owner = "routing-test";
  afterEach(() => resetHarthmereBusinessCustomerTalkStateForTest());

  it("offers direct F when either synchronized serving source is ready", () => {
    for (const ready of [
      {
        currentTicket: true,
        entityPresent: true,
        nativePhase: "serving",
        sessionSpatialPhase: "entering",
        visible: true,
      },
      {
        currentTicket: true,
        entityPresent: true,
        nativePhase: "entering",
        sessionSpatialPhase: "serving",
        visible: true,
      },
    ]) {
      assert.equal(canDirectlyTalkToHarthmereBusinessCustomer(ready), true);
    }
    for (const unavailable of [
      {
        currentTicket: false,
        entityPresent: true,
        nativePhase: "serving",
        sessionSpatialPhase: "serving",
        visible: true,
      },
      {
        currentTicket: true,
        entityPresent: false,
        nativePhase: "serving",
        sessionSpatialPhase: "serving",
        visible: true,
      },
      {
        currentTicket: true,
        entityPresent: true,
        nativePhase: "entering",
        sessionSpatialPhase: "entering",
        visible: true,
      },
      {
        currentTicket: true,
        entityPresent: true,
        nativePhase: "serving",
        sessionSpatialPhase: "serving",
        visible: false,
      },
    ]) {
      assert.equal(
        canDirectlyTalkToHarthmereBusinessCustomer(unavailable),
        false
      );
    }
  });

  it("presents one effective serving phase when ECS and economy disagree", () => {
    assert.equal(
      harthmereBusinessCustomerEffectivePhase({
        currentTicket: true,
        nativePhase: "entering",
        sessionSpatialPhase: "serving",
      }),
      "serving"
    );
    assert.equal(
      harthmereBusinessCustomerEffectivePhase({
        currentTicket: true,
        nativePhase: "serving",
        sessionSpatialPhase: "entering",
      }),
      "serving"
    );
    assert.equal(
      harthmereBusinessCustomerEffectivePhase({
        currentTicket: false,
        nativePhase: "queued",
        sessionSpatialPhase: "serving",
      }),
      "queued"
    );
  });

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
    publishHarthmereBusinessCustomerTalkTarget(owner, target);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(123 as any),
      target
    );
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(124 as any),
      undefined
    );
    clearHarthmereBusinessCustomerTalkTarget(owner, 124 as any);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(123 as any),
      target
    );
    clearHarthmereBusinessCustomerTalkTarget(owner, 123 as any);
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
    assert.ok(
      screen.includes('nativeBusinessCustomer.phase !== "patron_wandering"'),
      "a foreign session customer must not fall through to ordinary NPC dialogue"
    );
    assert.ok(
      screen.includes(
        "This customer is already part of an active business shift"
      )
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
    assert.ok(hud.includes("Talk to {customerName}"));
    assert.ok(hud.includes('shortcut="F"'));
    assert.equal(hud.includes("data-business-offer-id"), false);
    assert.ok(dialog.includes("additionalActions={serviceActions}"));
    assert.ok(
      dialog.includes("revealActionsImmediately={target.ready}"),
      "timed service choices must not wait for the shared NPC typewriter"
    );
    assert.ok(
      dialog.includes("`<text>${target.askLine} ${status}</text>`"),
      "a ready timed request and its actions must share one dialog step"
    );
    assert.ok(
      dialog.includes("frozenTarget.current ??= liveTarget ?? retainedTarget"),
      "an open request must not restart its typewriter on patience polling"
    );
    assert.ok(
      dialog.includes("createHarthmereBusinessCustomerServiceFeedback")
    );
    assert.ok(dialog.includes("data-business-customer-result="));
    assert.ok(dialog.includes("data-business-customer-gold-earned="));
    assert.ok(dialog.includes("data-business-customer-progress-earned="));
    assert.ok(dialog.includes("data-business-customer-result-message="));
    assert.ok(dialog.includes('role="status"'));
    assert.ok(dialog.includes("HARTHMERE_BUSINESS_RESULT_DISPLAY_MS = 3_000"));
    assert.ok(dialog.includes("Continue to next customer"));
    assert.ok(dialog.includes("Next customer in 3 seconds."));
    assert.ok(dialog.includes("window.setTimeout("));
    assert.ok(dialog.includes('key="business-customer-result"'));
    assert.ok(dialog.includes('followUpText: "Checking your answer…"'));
    assert.ok(
      dialog.includes("data-business-customer-target-source="),
      "an open business dialog must identify live versus retained routing"
    );
    assert.equal(dialog.includes('name: "Chit Chat"'), false);
    assert.equal(dialog.includes('name: "Ask about this place"'), false);
    assert.ok(
      dialog.includes(
        "`${target.askLine}{break}${status}{break}They will be ready"
      ),
      "the customer request must remain visible while they approach without repeating an unverified player-position instruction"
    );
    assert.equal(dialog.includes("Stay behind the counter"), false);
    assert.ok(
      hud.includes("The customer is walking to the service point."),
      "the spatial card must report customer progress rather than guessing the player's side"
    );
    assert.equal(
      (dialog.match(/focusCamera=\{false\}/g) ?? []).length,
      2,
      "question and result surfaces must keep a stable gameplay camera"
    );
  });

  it("formats backend codes before any business error reaches player UI", () => {
    for (const file of [
      "HarthmereBusinessCustomerTalkDialog.tsx",
      "HarthmereBusinessShiftControlPane.tsx",
      "HarthmereBusinessShiftHUD.tsx",
      "HarthmereBusinessLiveContainer.tsx",
      "HarthmereBusinessInterfacePanel.tsx",
    ]) {
      const source = readFileSync(
        path.join(
          process.cwd(),
          "src/client/components/harthmere_business",
          file
        ),
        "utf8"
      );
      assert.ok(
        source.includes("formatHarthmereBusinessPlayerWarning"),
        `${file} can display an unformatted backend code`
      );
      assert.equal(
        source.includes(
          "setError(cause instanceof Error ? cause.message : String(cause))"
        ),
        false,
        `${file} still displays Error.message verbatim`
      );
    }
    const panel = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessInterfacePanel.tsx"
      ),
      "utf8"
    );
    assert.ok(panel.includes('data-business-backend-error="true"'));
    assert.ok(panel.includes("void request.catch(() => undefined)"));
    const liveContainer = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessLiveContainer.tsx"
      ),
      "utf8"
    );
    assert.ok(
      liveContainer.includes('data-harthmere-business-load-error="true"')
    );

    const rootBoundary = readFileSync(
      path.join(process.cwd(), "src/client/components/RootErrorBoundary.tsx"),
      "utf8"
    );
    assert.ok(rootBoundary.includes("paused to protect your session"));
    assert.equal(rootBoundary.includes("messageFromError"), false);
    assert.equal(rootBoundary.includes("<MaybeError"), false);

    const modalController = readFileSync(
      path.join(process.cwd(), "src/client/components/GameModalController.tsx"),
      "utf8"
    );
    assert.ok(
      modalController.includes(
        "`death:${gameModalVersion}:${playerHealth?.lastDamageTime ?? 0}`"
      )
    );
  });
});

describe("business customer talk registry covers the whole queue", () => {
  const owner = "queue-test";
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
    publishHarthmereBusinessCustomerTalkTargets(owner, [
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
    publishHarthmereBusinessCustomerTalkTargets(owner, [
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

  it("does not downgrade native serving readiness during an economy refresh", () => {
    publishHarthmereBusinessCustomerTalkTarget(
      owner,
      target(251, "ticket-1", true)
    );
    publishHarthmereBusinessCustomerTalkTargets(owner, [
      target(251, "ticket-1", false),
    ]);
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(251 as any)?.ready,
      true
    );
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(251 as any)?.phase,
      "serving"
    );
  });

  it("drops served and departed customers on the next publish", () => {
    // A stale entry is worse than none: it would offer service to a customer
    // who has already walked out of the shop.
    publishHarthmereBusinessCustomerTalkTargets(owner, [
      target(301, "ticket-1", true),
      target(302, "ticket-2", false),
    ]);
    publishHarthmereBusinessCustomerTalkTargets(owner, [
      target(302, "ticket-2", true),
    ]);
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
    publishHarthmereBusinessCustomerTalkTargets(owner, [
      target(401, "ticket-1", true),
      target(402, "ticket-2", false),
    ]);
    clearHarthmereBusinessCustomerTalkTarget(owner);
    assert.equal(harthmereBusinessCustomerTalkTargetCount(), 0);
  });

  it("does not let an inactive duplicate surface clear the active shift", () => {
    publishHarthmereBusinessCustomerTalkTargets("active-surface", [
      target(501, "ticket-1", true),
    ]);
    publishHarthmereBusinessCustomerTalkTargets("inactive-surface", [
      target(502, "ticket-2", false),
    ]);
    clearHarthmereBusinessCustomerTalkTarget("inactive-surface");
    assert.equal(
      harthmereBusinessCustomerTalkTargetForEntity(501 as any)?.ticketId,
      "ticket-1"
    );
    assert.equal(harthmereBusinessCustomerTalkTargetCount(), 1);
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

  it("hides the spatial card when the native customer is missing or off-screen", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.match(source, /if \(!entity \|\| !screen\.visible\) return null/);
    assert.equal(source.includes('{ left: "50%", top: 150 }'), false);
  });

  it("renders an authoritative patience bar for every materialized waiting customer", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(source.includes("<HarthmereBusinessPatienceBar"));
    assert.ok(source.includes("patience={patience}"));
    assert.ok(source.includes('entry.status === "waiting"'));
    assert.ok(source.includes(".map((entry) => ("));
  });

  it("keeps patience reconciliation alive across live-adapter identity changes", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(source.includes("const tickAdapter = React.useRef(adapter)"));
    assert.ok(source.includes("tickAdapter.current = adapter"));
    const tickEffect = source.slice(
      source.indexOf("const tick = async"),
      source.indexOf("const wasInside = previousInsideBusiness.current")
    );
    assert.ok(tickEffect.includes("void tick()"));
    assert.ok(tickEffect.includes("tickInFlight.current"));
    assert.ok(
      tickEffect.includes(
        "}, [businessId, session?.sessionId, session?.status]);"
      )
    );
    assert.equal(
      tickEffect.includes(
        "}, [adapter, businessId, session?.sessionId, session?.status]);"
      ),
      false
    );
  });

  it("sends exact current-customer ECS evidence with patience ticks", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/businessInterfaceLiveAdapter.ts"
      ),
      "utf8"
    );
    const tick = source.slice(
      source.indexOf("tickCustomerSession: (businessId, sessionId)"),
      source.indexOf("endCustomerSession:")
    );
    assert.ok(tick.includes("session.currentTicketId"));
    assert.ok(tick.includes("ticketId: ticket.ticketId"));
    assert.ok(tick.includes("customerEntityId: ticket.entityId"));
  });

  it("ends the actor-owned shift after the player remains outside the business", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(source.includes("previousInsideBusiness"));
    assert.ok(
      source.includes("endCustomerSession(businessId, session.sessionId)")
    );
    assert.ok(source.includes("}, 1000)"));
  });

  it("keeps one authoritative business runtime selected after the board closes", () => {
    const unified = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
      ),
      "utf8"
    );
    const biomesMount = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/biomes_ui/BiomesUIMount.tsx"
      ),
      "utf8"
    );
    assert.ok(unified.includes("selectedBusinessId ?? containingBusinessId"));
    assert.ok(unified.includes("setSelectedBusinessId(containingBusinessId)"));
    assert.ok(unified.includes("closeAndKeepSelection"));
    assert.ok(
      unified.includes(
        'data-harthmere-business-board-world-prompt={\n        projectedPrompt ? "projected" : "bottom"'
      )
    );
    assert.ok(
      unified.includes(
        "priority: WORLD_INTERACTION_PRIORITY.jobsBoard - prompt.distance"
      )
    );
    const businessPromptSource = unified.slice(
      unified.indexOf("function HarthmereBusinessBoardWorldPrompt"),
      unified.indexOf("function HarthmereJobsBoardWorldPrompt")
    );
    assert.equal(
      businessPromptSource.includes("prompt && projectedPrompt\n        ? {"),
      true,
      "the board may own F only while the player is actually facing it"
    );
    assert.equal(
      biomesMount.includes("<HarthmereBusinessWorldInteraction"),
      false
    );
  });

  it("routes real F to a registered shift customer before the nearby board", () => {
    const cursor = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/overlays/inspected/CursorInspectionOverlayComponent.tsx"
      ),
      "utf8"
    );
    const dispatcher = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/challenges/worldInteractionDispatcher.ts"
      ),
      "utf8"
    );
    const hud = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(cursor.includes("useHarthmereBusinessCustomerTalkTarget"));
    assert.ok(cursor.includes("isBusinessCustomerTalkShortcut"));
    assert.ok(
      cursor.includes("shortcut.title.trim().toLowerCase() ===") &&
        cursor.includes("inspectText.trim().toLowerCase()")
    );
    assert.ok(
      cursor.includes("WORLD_INTERACTION_PRIORITY.activeBusinessCustomer")
    );
    assert.ok(
      hud.includes("canDirectlyTalkToHarthmereBusinessCustomer({"),
      "the customer card must gate its own direct F interaction"
    );
    assert.ok(hud.includes('keyCode="KeyF"'));
    assert.ok(
      hud.includes(
        "worldInteractionCandidateId={`harthmere:business-customer:${entityId}`}"
      )
    );
    assert.ok(
      hud.includes("WORLD_INTERACTION_PRIORITY.activeBusinessCustomer")
    );
    assert.ok(hud.includes('reactResources.set("/game_modal", {'));
    assert.ok(hud.includes('kind: "talk_to_npc"'));
    assert.ok(hud.includes("Talk to {customerName}"));
    assert.ok(
      hud.includes("harthmereBusinessCustomerDisplayName(entry.npcId)")
    );
    assert.ok(dispatcher.includes("activeBusinessCustomer: 16_000"));
    assert.ok(dispatcher.includes("jobsBoard: 15_000"));
  });
});
