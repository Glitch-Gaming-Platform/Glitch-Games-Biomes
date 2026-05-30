import assert from "assert";
import {
  readHarthmereLiveModeJobsBoardStateForActorV1,
} from "../live_mode_jobs_board_state";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
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

    assert.deepEqual(calls.sort(), [
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      harthmereLiveModeSharedWorldStateKeyV1(),
    ].sort());
    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141]);
    assert.equal(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141].location.x, 1046);
    assert.equal(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141].location.z, -202);
    const existingHarthmereJob = snapshot.openJobs.find(
      (job) => job.jobId === "harthmere_auto_1",
    );
    assert.equal(existingHarthmereJob?.boardId, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141);
    assert.equal(existingHarthmereJob?.source, "economy_auto_seed");
    assert.ok(
      snapshot.openJobs.some((job) => job.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1),
      "read path should top up the Grove board when it is empty",
    );
  });

  it("auto-seeds local/default jobs and persists them when Redis has no actor state", async () => {
    const writes: Array<{ key: string; value: string }> = [];
    const redis = {
      primary: {
        get: async () => null,
        set: async (key: string, value: string) => {
          writes.push({ key, value });
        },
      },
    };
    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]);
    assert.ok(snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141]);
    assert.ok(
      snapshot.openJobs.some((job) => job.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1),
      "fresh local players should see Grove jobs instead of a blank board",
    );
    assert.ok(
      snapshot.openJobs.some((job) => job.boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141),
      "fresh local players should see Harthmere town jobs too",
    );
    assert.ok(snapshot.openJobs.every((job) => job.source === "economy_auto_seed"));
    assert.equal(writes.length, 1, "auto-seeded jobs should be persisted to shared world state so accept/complete can use them");
    assert.equal(writes[0]?.key, harthmereLiveModeSharedWorldStateKeyV1());
  });

  it("prefers shared public board state over an empty actor-local board", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendStateV1("shared_board", NOW_MS);
    sharedBackend.jobsBoard.postings.shared_job_1 = {
      jobId: "shared_job_1",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Shared public job",
      description: "Visible to every actor.",
      kind: "delivery",
      requirements: [{ itemId: "road_ration", count: 1 }],
      rewardGold: 25,
      escrowGold: 25,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 2,
      requiresFieldWork: true,
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    const actorBackend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const redis = {
      primary: {
        get: async (key: string) => {
          if (key === harthmereLiveModePlayerStateKeyV1(ACTOR)) {
            return JSON.stringify(actorBackend);
          }
          if (key === harthmereLiveModeSharedWorldStateKeyV1()) {
            return JSON.stringify(createHarthmereLiveModeSharedWorldStateV1(sharedBackend, NOW_MS));
          }
          return null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.ok(snapshot.openJobs.some((job) => job.jobId === "shared_job_1"));
  });
});
