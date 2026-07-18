/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostJobsBoardPosition,
} from "../../../../shared/harthmere/business_customer_simulator";
import { HARTHMERE_LIVE_INVENTORY_SYNC_EVENT } from "../../challenges/harthmereEvents";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  buildHarthmereJobsBoardPostPayload,
  displayNameForHarthmereJobsBoard,
  createHarthmereJobsBoardAdapter,
  fetchHarthmereJobsBoardState,
  harthmereJobsBoardMutationUrl,
  harthmereJobsBoardStateUrl,
  getHarthmereAvailableJobsPanel,
  getHarthmereJobsBoardPrompt,
  getHarthmereJobsBoardSafetyPanel,
  getHarthmereJobsBoardTabs,
  getHarthmereMyJobsPanel,
  getHarthmerePostedJobsPanel,
  isHarthmereJobsBoardAvailable,
  nearestHarthmereJobsBoardPhysicalPrompt,
  nearestPhysicalHarthmereJobsBoardId,
  normalizeHarthmereJobsBoardSnapshot,
  submitHarthmereDailyTaskCompleted,
  submitHarthmereJobsBoardMutation,
  type HarthmereJobsBoardSnapshot,
} from "../jobsBoardLiveAdapter";

const NOW = 1_800_000_000_000;

async function withGlitchInstallLocation<T>(
  callback: () => Promise<T> | T
): Promise<T> {
  const globalAny = global as any;
  const oldWindow = globalAny.window;
  const oldCustomEvent = globalAny.CustomEvent;
  globalAny.CustomEvent ??= class {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  globalAny.window = {
    ...(oldWindow ?? {}),
    location: {
      ...(oldWindow?.location ?? {}),
      href: "https://www.glitch.fun/games/test/play?install_id=test-install",
      search: "?install_id=test-install",
    },
    dispatchEvent: oldWindow?.dispatchEvent ?? (() => true),
  };
  try {
    return await callback();
  } finally {
    globalAny.window = oldWindow;
    globalAny.CustomEvent = oldCustomEvent;
  }
}

function sampleSnapshot(): HarthmereJobsBoardSnapshot {
  return normalizeHarthmereJobsBoardSnapshot({
    version: "harthmere-jobs-board-authority",
    actorId: "player_a",
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    boards: {
      [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]: {
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        displayName: "Jobs Board",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        markerId: "harthmere_market_posting_board",
        location: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
          radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
          district: "The Grove",
          landmarkId: "harthmere_market_posting_board",
          voxelAssetHint: "procedural_jobs_board_kiosk",
        },
        acceptedKinds: [
          "gather",
          "delivery",
          "repair",
          "cleanup",
          "hunt",
          "escort",
          "craft",
          "medical",
          "exploration",
          "construction",
          "security",
          "service",
        ],
        requiresPhysicalInteraction: true,
      },
    },
    openJobs: [
      {
        jobId: "job_1",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "business",
        issuerId: "business_1",
        title: "Repair the inn pump",
        description: "Fix the pump near the inn.",
        kind: "repair",
        requirements: [
          {
            itemId: "repair_part",
            count: 2,
            targetId: "pump_1",
            targetName: "Inn Pump",
            mapMarkerId: "pump_marker",
          },
        ],
        rewardGold: 120,
        escrowGold: 120,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 10000,
        requiresFieldWork: true,
        mapMarkerId: "pump_marker",
        targetId: "pump_1",
        abuseFlags: [],
        logs: [],
      },
      {
        jobId: "job_2",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "player",
        issuerId: "poster",
        title: "Gather herbs",
        description: "Bring herbs back to board.",
        kind: "gather",
        requirements: [{ itemId: "herb_bundle", count: 4 }],
        rewardGold: 40,
        escrowGold: 40,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 10000,
        requiresFieldWork: false,
        abuseFlags: ["suspicious_text"],
        logs: [],
      },
    ],
    activeJobs: [],
    myAcceptedJobs: [
      {
        jobId: "job_accepted",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "town",
        issuerId: "harthmere_grove",
        title: "Clean spill",
        description: "Clean contamination spill.",
        kind: "cleanup",
        requirements: [
          { serviceKind: "cleanup", serviceUnits: 1, targetId: "spill_1" },
        ],
        rewardGold: 90,
        escrowGold: 90,
        status: "active",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 10000,
        acceptedByActorId: "player_a",
        requiresFieldWork: true,
        mapMarkerId: "spill_marker",
        targetId: "spill_1",
        abuseFlags: [],
        logs: [],
      },
    ],
    myPostedJobs: [
      {
        jobId: "job_posted",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "player",
        issuerId: "player_a",
        title: "Bring seeds",
        description: "Need rare seeds.",
        kind: "gather",
        requirements: [{ itemId: "rare_seed", count: 1 }],
        rewardGold: 50,
        escrowGold: 50,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 10000,
        requiresFieldWork: false,
        abuseFlags: [],
        logs: [],
      },
    ],
    myTodos: [
      {
        todoId: "todo_1",
        jobId: "job_accepted",
        actorId: "player_a",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        title: "Clean spill",
        todoText: "Go to the marked location and clean the spill.",
        status: "completed",
        kind: "cleanup",
        mapMarkerId: "spill_marker",
        targetId: "spill_1",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        dueAtMs: NOW + 10000,
        questBoardTodo: true,
      },
    ],
    audit: [],
    cooldown: { abuseScore: 1 },
    safety: {
      minRewardGold: 5,
      maxRewardGold: 5000,
      maxActivePostingsPerIssuer: 12,
      maxActiveAcceptedPerSeeker: 6,
      requiresPhysicalBoardInteraction: true,
    },
  });
}

describe("Harthmere universal jobs board live adapter", () => {
  it("fetches the jobs board snapshot from the dedicated backend endpoint", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, jobsBoardState: sampleSnapshot() }),
      };
    }) as any;
    const state = await withGlitchInstallLocation(() =>
      fetchHarthmereJobsBoardState(fetchImpl)
    );
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode_jobs_board_state?install_id=test-install"
    );
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(
      state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID].markerId,
      "harthmere_market_posting_board"
    );
    assert.equal(
      displayNameForHarthmereJobsBoard(
        state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]
      ),
      "Jobs Board"
    );
  });

  it("passes the embedded Glitch install id to the read-only state endpoint", () => {
    assert.equal(
      harthmereJobsBoardStateUrl(
        "?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
      ),
      "/api/harthmere/live_mode_jobs_board_state?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
    assert.equal(
      harthmereJobsBoardStateUrl("?installId=install with spaces"),
      "/api/harthmere/live_mode_jobs_board_state?install_id=install%20with%20spaces"
    );
  });

  it("passes the embedded Glitch install id to jobs board writes", async () => {
    assert.equal(
      harthmereJobsBoardMutationUrl(
        "?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
      ),
      "/api/harthmere/live_mode?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
    assert.equal(
      harthmereJobsBoardMutationUrl("?installId=install with spaces"),
      "/api/harthmere/live_mode?install_id=install%20with%20spaces"
    );

    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          jobsBoardState: sampleSnapshot(),
          backendMutation: { warnings: [] },
        }),
      };
    }) as any;
    await submitHarthmereJobsBoardMutation(
      "accept_job",
      { jobId: "job_1" },
      {
        fetchImpl,
        requestId: "fixed_install_request",
        locationSearch: "?install_id=install-123",
      }
    );
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=install-123"
    );
    assert.equal(
      new Headers(calls[0].init.headers).get("X-Glitch-Install-Id"),
      "install-123"
    );
  });

  it("posts every write through request_jobs_board_mutation with the board as target", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          jobsBoardState: sampleSnapshot(),
          backendMutation: { warnings: [] },
        }),
      };
    }) as any;
    await withGlitchInstallLocation(() =>
      submitHarthmereJobsBoardMutation(
        "accept_job",
        { jobId: "job_1" },
        { fetchImpl, requestId: "fixed_request" }
      )
    );
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=test-install"
    );
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.actionKind, "request_jobs_board_mutation");
    assert.equal(envelope.subsystem, "jobs");
    assert.equal(envelope.targetId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
    assert.equal(
      envelope.payload.interactionTargetId,
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
    );
    assert.equal(envelope.payload.operation, "accept_job");
  });

  it("emits a jobs board state event after successful mutations so quest UI can refresh", async () => {
    const globalAny = global as any;
    const oldWindow = globalAny.window;
    const oldCustomEvent = globalAny.CustomEvent;
    const events: Array<{ type: string; detail: any }> = [];
    globalAny.CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    globalAny.window = {
      location: { search: "" },
      dispatchEvent: (event: { type: string; detail: any }) => {
        events.push(event);
        return true;
      },
    };
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        jobsBoardState: sampleSnapshot(),
        backendMutation: { warnings: [] },
      }),
    })) as any;

    try {
      await submitHarthmereJobsBoardMutation(
        "accept_job",
        { jobId: "job_1" },
        { fetchImpl, requestId: "event_bridge_request" }
      );
    } finally {
      globalAny.window = oldWindow;
      globalAny.CustomEvent = oldCustomEvent;
    }

    const stateEvents = events.filter(
      (event) => event.type === HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT
    );
    assert.equal(stateEvents.length, 1);
    assert.equal(stateEvents[0].detail.jobsBoardState.actorId, "player_a");
  });

  it("emits live inventory sync when a jobs board mutation grants items or gold", async () => {
    const globalAny = global as any;
    const oldWindow = globalAny.window;
    const oldCustomEvent = globalAny.CustomEvent;
    const events: Array<{ type: string; detail: any }> = [];
    globalAny.CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    globalAny.window = {
      location: { search: "" },
      dispatchEvent: (event: { type: string; detail: any }) => {
        events.push(event);
        return true;
      },
    };
    const inventoryLootState = {
      actor: {
        gold: 76,
        items: { sealed_package: 1 },
        instanceIds: [],
      },
    };
    const playerStatusState = { combat: { hp: 100, deathState: "alive" } };
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        jobsBoardState: sampleSnapshot(),
        inventoryLootState,
        playerStatusState,
        backendMutation: { warnings: [] },
      }),
    })) as any;

    try {
      await submitHarthmereJobsBoardMutation(
        "accept_job",
        { jobId: "delivery_job_1" },
        { fetchImpl, requestId: "inventory_sync_request" }
      );
    } finally {
      globalAny.window = oldWindow;
      globalAny.CustomEvent = oldCustomEvent;
    }

    const syncEvent = events.find(
      (event) => event.type === HARTHMERE_LIVE_INVENTORY_SYNC_EVENT
    );
    assert.ok(syncEvent);
    assert.deepEqual(syncEvent.detail.inventoryLootState, inventoryLootState);
    assert.deepEqual(syncEvent.detail.playerStatusState, playerStatusState);
    assert.deepEqual(
      syncEvent.detail.body.inventoryLootState,
      inventoryLootState
    );
  });

  it("throws when backend abuse or validation protections reject the mutation", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        jobsBoardState: sampleSnapshot(),
        backendMutation: { warnings: ["jobs_board_rejected:post_cooldown"] },
      }),
    })) as any;
    await assert.rejects(
      () =>
        submitHarthmereJobsBoardMutation(
          "create_job_posting",
          {},
          { fetchImpl }
        ),
      /post_cooldown/
    );
  });

  it("marks the jobs board daily task complete before rewards can be claimed", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          dailyState: { completedToday: { jobs_board: NOW } },
        }),
      };
    }) as any;
    await withGlitchInstallLocation(() =>
      submitHarthmereDailyTaskCompleted("jobs_board", {
        fetchImpl,
        requestId: "read_jobs_board",
      })
    );
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=test-install"
    );
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.actionKind, "request_care_loop_action");
    assert.equal(envelope.subsystem, "care");
    assert.equal(envelope.payload.operation, "daily_task_completed");
    assert.equal(envelope.payload.targetId, "jobs_board");
  });

  it("builds the Grove prompt only when the player is physically at the board", () => {
    const snapshot = sampleSnapshot();
    assert.equal(isHarthmereJobsBoardAvailable(snapshot, {}), false);
    assert.equal(
      isHarthmereJobsBoardAvailable(snapshot, {
        playerPosition: { x: -1000, y: 66, z: -1000 },
      }),
      false
    );
    assert.equal(
      isHarthmereJobsBoardAvailable(snapshot, {
        playerPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }),
      true
    );
    assert.equal(
      isHarthmereJobsBoardAvailable(snapshot, {
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }),
      true
    );
    assert.equal(
      nearestPhysicalHarthmereJobsBoardId(snapshot, {
        interactionTargetId: "jobs_board_marker:harthmere_market_posting_board",
      }),
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
    );
    assert.equal(
      nearestPhysicalHarthmereJobsBoardId(snapshot, {
        interactionTargetId: "harthmere_market_posting_board",
      }),
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
    );
    const prompt = getHarthmereJobsBoardPrompt(snapshot, {
      playerPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
    });
    assert.equal(prompt!.key, "E");
    assert.equal(prompt!.markerId, "harthmere_market_posting_board");
  });

  it("builds physical prompts for business outpost starter-job boards", () => {
    const outpost = HARTHMERE_BUSINESS_OUTPOSTS[0];
    const boardId = `${outpost.outpostId}_jobs_board`;
    const boardPosition = harthmereBusinessOutpostJobsBoardPosition(outpost);
    assert.ok(
      HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.some(
        (board) => board.boardId === boardId
      )
    );
    const prompt = nearestHarthmereJobsBoardPhysicalPrompt(boardPosition);
    assert.equal(prompt?.boardId, boardId);
    assert.equal(prompt?.displayName, `${outpost.displayName} Jobs Board`);
  });

  it("normalizes available jobs, accepted jobs, posted jobs, tabs, and safety panel", () => {
    const snapshot = sampleSnapshot();
    snapshot.openJobs[0].deadlineAtMs = NOW + 3 * 60 * 60 * 1000;
    snapshot.myAcceptedJobs[0].deadlineAtMs = NOW + 2 * 60 * 60 * 1000;
    const available = getHarthmereAvailableJobsPanel(
      snapshot,
      snapshot.defaultBoardId,
      NOW
    );
    assert.equal(available[0].jobId, "job_1");
    assert.equal(available[0].requiresFieldWork, true);
    assert.equal(available[0].timeRemaining, "3h 0m left");
    assert.equal(available[1].warning, "Flagged for review");
    const mine = getHarthmereMyJobsPanel(snapshot, NOW);
    assert.equal(mine[0].todo!.questBoardTodo, true);
    assert.equal(mine[0].canComplete, true);
    assert.equal(mine[0].timeRemaining, "2h 0m left");
    // HARTHMERE_JOBS_BOARD_COMPLETION_WIRING: an ACTIVE todo on an active job
    // is now turn-in-able (the two-step completion verifies + pays); the button
    // is no longer gated to only already-"completed" todos (which never happened
    // because the client never sent complete_job_quest).
    snapshot.myTodos[0].status = "active";
    assert.equal(getHarthmereMyJobsPanel(snapshot, NOW)[0].canComplete, true);
    // A failed/expired todo cannot be turned in.
    snapshot.myTodos[0].status = "failed";
    assert.equal(getHarthmereMyJobsPanel(snapshot, NOW)[0].canComplete, false);
    // No live todo at all -> cannot complete.
    snapshot.myTodos = [];
    assert.equal(getHarthmereMyJobsPanel(snapshot, NOW)[0].canComplete, false);
    const posted = getHarthmerePostedJobsPanel(snapshot);
    assert.equal(posted[0].canCancel, true);
    assert.deepEqual(
      getHarthmereJobsBoardTabs(snapshot).map((tab) => tab.id),
      ["available", "accepted", "posted", "post", "safety"]
    );
    const safety = getHarthmereJobsBoardSafetyPanel(snapshot);
    assert.equal(safety.requiresBoard, true);
    assert.equal(safety.abuseScore, 1);
  });

  it("builds valid post payloads for business/entity job givers", () => {
    const payload = buildHarthmereJobsBoardPostPayload({
      businessId: "business_repair",
      title: "Repair a door",
      description: "Door is stuck.",
      kind: "repair",
      requirements: [
        {
          serviceKind: "repair",
          targetId: "door_1",
          mapMarkerId: "door_marker",
        },
      ],
      rewardGold: 75,
      deadlineAtMs: Date.now() + 10_000,
      requiresFieldWork: true,
    });
    assert.equal(payload.issuerKind, "business");
    assert.equal(payload.businessId, "business_repair");
    assert.equal(payload.boardId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
    assert.equal(payload.requiresFieldWork, true);
  });

  it("adapter exposes fetch/post/accept/complete/cancel helpers", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          jobsBoardState: sampleSnapshot(),
          backendMutation: { warnings: [] },
        }),
      };
    }) as any;
    const adapter = createHarthmereJobsBoardAdapter(fetchImpl);
    await adapter.fetchState();
    await adapter.completeDailyTask("jobs_board", "daily_req");
    await adapter.postJob(
      buildHarthmereJobsBoardPostPayload({
        title: "Gather",
        description: "Gather herbs",
        kind: "gather",
        requirements: [{ itemId: "herb_bundle", count: 2 }],
        rewardGold: 25,
        deadlineAtMs: Date.now() + 10000,
      }),
      "post_req"
    );
    await adapter.acceptJob(
      "job_1",
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      "accept_req"
    );
    await adapter.completeJob(
      "job_1",
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      "complete_req"
    );
    await adapter.cancelJob(
      "job_1",
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      "cancel_req"
    );
    assert.equal(calls.length, 6);
    assert.equal(
      JSON.parse(calls[1].init.body).payload.operation,
      "daily_task_completed"
    );
    assert.equal(
      JSON.parse(calls[2].init.body).payload.operation,
      "create_job_posting"
    );
    assert.equal(
      JSON.parse(calls[3].init.body).payload.operation,
      "accept_job"
    );
    assert.equal(
      JSON.parse(calls[4].init.body).payload.operation,
      "complete_job"
    );
    assert.equal(
      JSON.parse(calls[5].init.body).payload.operation,
      "cancel_job"
    );
  });
});
