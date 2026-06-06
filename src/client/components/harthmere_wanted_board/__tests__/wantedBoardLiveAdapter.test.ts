import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  normalizeHarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardSnapshotV1,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  buildHarthmereWantedBoardViewV1,
  isHarthmereWantedBoardJobV1,
  submitHarthmereWantedBoardClearBountyV1,
} from "../wantedBoardLiveAdapter";

const NOW = 1_800_000_000_000;

function sampleSnapshot(): HarthmereJobsBoardSnapshotV1 {
  return normalizeHarthmereJobsBoardSnapshotV1({
    version: "harthmere-jobs-board-authority-v1",
    actorId: "player_wanted",
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
        },
        acceptedKinds: ["hunt", "security", "repair"],
        requiresPhysicalInteraction: true,
      },
    },
    openJobs: [
      {
        jobId: "hunt_alpha",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        issuerKind: "town",
        issuerId: "city_guard",
        title: "Alpha Mucker Bounty",
        description: "Stop the Alpha Mucker near the old wood.",
        kind: "hunt",
        requirements: [
          {
            targetId: "muck_bounty_alpha_mucker",
            targetName: "Alpha Mucker",
            mapMarkerId: "muck_bounty_alpha_mucker_marker",
          },
        ],
        rewardGold: 300,
        escrowGold: 300,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 86_400_000,
        requiresFieldWork: true,
        mapMarkerId: "muck_bounty_alpha_mucker_marker",
        targetId: "muck_bounty_alpha_mucker",
        abuseFlags: [],
        logs: [],
      },
      {
        jobId: "repair_pump",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        issuerKind: "business",
        issuerId: "inn",
        title: "Repair Pump",
        description: "Normal work order.",
        kind: "repair",
        requirements: [{ targetId: "pump" }],
        rewardGold: 50,
        escrowGold: 50,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 86_400_000,
        requiresFieldWork: true,
        abuseFlags: [],
        logs: [],
      },
      {
        jobId: "security_patrol",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        issuerKind: "town",
        issuerId: "city_guard",
        title: "Road Patrol",
        description: "Patrol for outlaws near the road.",
        kind: "security",
        requirements: [{ serviceKind: "security", serviceUnits: 1 }],
        rewardGold: 125,
        escrowGold: 125,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 86_400_000,
        requiresFieldWork: true,
        abuseFlags: [],
        logs: [],
      },
    ],
    activeJobs: [],
    myAcceptedJobs: [
      {
        jobId: "my_hex",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        issuerKind: "town",
        issuerId: "city_guard",
        title: "Hex Wraith Bounty",
        description: "Finish the Hex Wraith warrant.",
        kind: "hunt",
        requirements: [{ targetName: "Hex Wraith" }],
        rewardGold: 450,
        escrowGold: 450,
        status: "active",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 86_400_000,
        acceptedByActorId: "player_wanted",
        requiresFieldWork: true,
        abuseFlags: [],
        logs: [],
      },
    ],
    myTodos: [],
    myPostedJobs: [],
    audit: [],
    cooldown: { abuseScore: 0 },
    safety: { requiresPhysicalBoardInteraction: true },
    lawSummary: {
      actorId: "player_wanted",
      standing: { scopeId: "city_guard", likeability: 0, legal: -250, notoriety: 500 },
      fines: { city_guard: 25 },
      flags: { city_lockdown: true },
      activeBounties: [
        {
          id: "crime_1",
          actorId: "player_wanted",
          kind: "murder",
          zoneId: "harthmere_market",
          factionId: "city_guard",
          severity: 900,
          valueGold: 600,
          witnesses: 2,
          detected: true,
          response: "combat",
          fineGold: 0,
          bountyGold: 900,
          status: "wanted",
          evidenceExpiresAtMs: NOW + 10_000,
          createdAtMs: NOW,
        },
      ],
      myActiveBounties: [],
      totalBountyGold: 900,
      myTotalBountyGold: 900,
      recentCrimeRecords: [],
    },
  });
}

describe("Harthmere wanted board live adapter", () => {
  it("filters live jobs into wanted notices and keeps ordinary work orders out", () => {
    const snapshot = sampleSnapshot();
    assert.equal(isHarthmereWantedBoardJobV1(snapshot.openJobs[0]), true);
    assert.equal(isHarthmereWantedBoardJobV1(snapshot.openJobs[1]), false);
    assert.equal(isHarthmereWantedBoardJobV1(snapshot.openJobs[2]), true);

    const view = buildHarthmereWantedBoardViewV1(snapshot, undefined, NOW);
    assert.deepEqual(
      view.openNotices.map((notice) => notice.jobId).sort(),
      ["hunt_alpha", "security_patrol"]
    );
    assert.deepEqual(view.myNotices.map((notice) => notice.jobId), ["my_hex"]);
    assert.equal(view.lawNotices.length, 1);
    assert.equal(view.lawNotices[0].canClear, true);
    assert.equal(view.law.finesGold, 25);
    assert.equal(view.law.activeBountyGold, 900);
  });

  it("keeps Muck bounty targets as a watchlist only when no active posting covers them", () => {
    const view = buildHarthmereWantedBoardViewV1(sampleSnapshot(), undefined, NOW);
    assert.ok(
      !view.watchlistNotices.some(
        (notice) => notice.targetId === "muck_bounty_alpha_mucker"
      ),
      "active Alpha Mucker posting should cover that watch target"
    );
    assert.ok(
      view.watchlistNotices.some(
        (notice) => notice.targetId === "muck_bounty_elite_mucker"
      ),
      "inactive known bounty targets should stay visible as watch notices"
    );
  });

  it("submits clear-bounty through the live law mutation endpoint", async () => {
    const calls: Array<{ url: string; init: any; body: any }> = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({ ok: true, backendMutation: { warnings: [] } }),
      };
    }) as any;

    await submitHarthmereWantedBoardClearBountyV1({
      factionId: "city_guard",
      fetchImpl,
      requestId: "clear_test",
      locationSearch: "?install_id=abc 123",
    });

    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=abc%20123"
    );
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["X-Glitch-Install-Id"], "abc 123");
    assert.equal(calls[0].body.actionKind, "request_clear_bounty");
    assert.equal(calls[0].body.subsystem, "law");
    assert.equal(calls[0].body.payload.factionId, "city_guard");
  });
});

