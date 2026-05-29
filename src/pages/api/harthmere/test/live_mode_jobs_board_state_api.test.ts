import assert from "assert";
import {
  readHarthmereLiveModeJobsBoardStateForActorV1,
} from "../live_mode_jobs_board_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";

const ACTOR = "player_api_jobs_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_jobs_board_state API route integration", () => {
  it("reads Redis state and returns the actor's two physical jobs boards", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.jobsBoard.postings.harthmere_auto_1 = {
      jobId: "harthmere_auto_1",
      boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
      issuerKind: "town",
      issuerId: "harthmere_town",
      title: "Test Harthmere board job",
      description: "Route integration test job.",
      kind: "delivery",
      requirements: [{ itemId: "courier_pouch", count: 1 }],
      rewardGold: 75,
      escrowGold: 75,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_town",
      regionId: "harthmere_town_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 7,
      requiresFieldWork: true,
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return JSON.stringify(backend);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [harthmereLiveModePlayerStateKeyV1(ACTOR)]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141]);
    assert.equal(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141].location.x, 1046);
    assert.equal(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141].location.z, -202);
    assert.equal(snapshot.openJobs[0]?.boardId, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141);
    assert.equal(snapshot.openJobs[0]?.source, "economy_auto_seed");
  });

  it("returns an empty live jobs board registry from defaults when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141]);
    assert.deepEqual(snapshot.openJobs, []);
  });
});
