/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
} from "../../../../shared/harthmere/business_customer_simulator_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  buildHarthmereJobsBoardPostPayloadV1,
  displayNameForHarthmereJobsBoardV145,
  createHarthmereJobsBoardAdapterV1,
  fetchHarthmereJobsBoardStateV1,
  harthmereJobsBoardMutationUrlV151,
  harthmereJobsBoardStateUrlV146,
  getHarthmereAvailableJobsPanelV1,
  getHarthmereJobsBoardPromptV1,
  getHarthmereJobsBoardSafetyPanelV1,
  getHarthmereJobsBoardTabsV1,
  getHarthmereMyJobsPanelV1,
  getHarthmerePostedJobsPanelV1,
  isHarthmereJobsBoardAvailableV1,
  nearestHarthmereJobsBoardPhysicalPromptV141,
  normalizeHarthmereJobsBoardSnapshotV1,
  submitHarthmereDailyTaskCompletedV1,
  submitHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardSnapshotV1,
} from "../jobsBoardLiveAdapter";

const NOW = 1_800_000_000_000;

function sampleSnapshot(): HarthmereJobsBoardSnapshotV1 {
  return normalizeHarthmereJobsBoardSnapshotV1({
    version: "harthmere-jobs-board-authority-v1",
    actorId: "player_a",
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    boards: {
      [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]: {
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        displayName: "Jobs Board",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        markerId: "harthmere_market_posting_board",
        location: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
          radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
    const state = await fetchHarthmereJobsBoardStateV1(fetchImpl);
    assert.equal(calls[0].url, "/api/harthmere/live_mode_jobs_board_state");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(
      state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1].markerId,
      "harthmere_market_posting_board"
    );
    assert.equal(
      displayNameForHarthmereJobsBoardV145(
        state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]
      ),
      "Jobs Board"
    );
  });

  it("passes the embedded Glitch install id to the read-only state endpoint", () => {
    assert.equal(
      harthmereJobsBoardStateUrlV146(
        "?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
      ),
      "/api/harthmere/live_mode_jobs_board_state?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
    assert.equal(
      harthmereJobsBoardStateUrlV146("?installId=install with spaces"),
      "/api/harthmere/live_mode_jobs_board_state?install_id=install%20with%20spaces"
    );
  });

  it("passes the embedded Glitch install id to jobs board writes", async () => {
    assert.equal(
      harthmereJobsBoardMutationUrlV151(
        "?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
      ),
      "/api/harthmere/live_mode?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
    assert.equal(
      harthmereJobsBoardMutationUrlV151("?installId=install with spaces"),
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
    await submitHarthmereJobsBoardMutationV1(
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
    assert.equal(calls[0].init.headers["X-Glitch-Install-Id"], "install-123");
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
    await submitHarthmereJobsBoardMutationV1(
      "accept_job",
      { jobId: "job_1" },
      { fetchImpl, requestId: "fixed_request" }
    );
    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.actionKind, "request_jobs_board_mutation");
    assert.equal(envelope.subsystem, "jobs");
    assert.equal(envelope.targetId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
    assert.equal(
      envelope.payload.interactionTargetId,
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1
    );
    assert.equal(envelope.payload.operation, "accept_job");
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
        submitHarthmereJobsBoardMutationV1(
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
    await submitHarthmereDailyTaskCompletedV1("jobs_board", {
      fetchImpl,
      requestId: "read_jobs_board",
    });
    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.actionKind, "request_care_loop_action");
    assert.equal(envelope.subsystem, "care");
    assert.equal(envelope.payload.operation, "daily_task_completed");
    assert.equal(envelope.payload.targetId, "jobs_board");
  });

  it("builds the Grove prompt only when the player is physically at the board", () => {
    const snapshot = sampleSnapshot();
    assert.equal(isHarthmereJobsBoardAvailableV1(snapshot, {}), false);
    assert.equal(
      isHarthmereJobsBoardAvailableV1(snapshot, {
        playerPosition: { x: -1000, y: 66, z: -1000 },
      }),
      false
    );
    assert.equal(
      isHarthmereJobsBoardAvailableV1(snapshot, {
        playerPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }),
      true
    );
    assert.equal(
      isHarthmereJobsBoardAvailableV1(snapshot, {
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      }),
      true
    );
    const prompt = getHarthmereJobsBoardPromptV1(snapshot, {
      playerPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
    });
    assert.equal(prompt!.key, "E");
    assert.equal(prompt!.markerId, "harthmere_market_posting_board");
  });

  it("builds physical prompts for business outpost starter-job boards", () => {
    const outpost = HARTHMERE_BUSINESS_OUTPOSTS_V1[0];
    const boardId = `${outpost.outpostId}_jobs_board`;
    const boardPosition = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
    assert.ok(HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141.some((board) => board.boardId === boardId));
    const prompt = nearestHarthmereJobsBoardPhysicalPromptV141(boardPosition);
    assert.equal(prompt?.boardId, boardId);
    assert.equal(prompt?.displayName, `${outpost.displayName} Jobs Board`);
  });

  it("normalizes available jobs, accepted jobs, posted jobs, tabs, and safety panel", () => {
    const snapshot = sampleSnapshot();
    const available = getHarthmereAvailableJobsPanelV1(snapshot);
    assert.equal(available[0].jobId, "job_1");
    assert.equal(available[0].requiresFieldWork, true);
    assert.equal(available[1].warning, "Flagged for review");
    const mine = getHarthmereMyJobsPanelV1(snapshot);
    assert.equal(mine[0].todo!.questBoardTodo, true);
    assert.equal(mine[0].canComplete, true);
    snapshot.myTodos[0].status = "active";
    assert.equal(getHarthmereMyJobsPanelV1(snapshot)[0].canComplete, false);
    snapshot.myTodos = [];
    assert.equal(getHarthmereMyJobsPanelV1(snapshot)[0].canComplete, false);
    const posted = getHarthmerePostedJobsPanelV1(snapshot);
    assert.equal(posted[0].canCancel, true);
    assert.deepEqual(
      getHarthmereJobsBoardTabsV1(snapshot).map((tab) => tab.id),
      ["available", "accepted", "posted", "post", "safety"]
    );
    const safety = getHarthmereJobsBoardSafetyPanelV1(snapshot);
    assert.equal(safety.requiresBoard, true);
    assert.equal(safety.abuseScore, 1);
  });

  it("builds valid post payloads for business/entity job givers", () => {
    const payload = buildHarthmereJobsBoardPostPayloadV1({
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
    assert.equal(payload.boardId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
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
    const adapter = createHarthmereJobsBoardAdapterV1(fetchImpl);
    await adapter.fetchState();
    await adapter.completeDailyTask("jobs_board", "daily_req");
    await adapter.postJob(
      buildHarthmereJobsBoardPostPayloadV1({
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
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      "accept_req"
    );
    await adapter.completeJob(
      "job_1",
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      "complete_req"
    );
    await adapter.cancelJob(
      "job_1",
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
