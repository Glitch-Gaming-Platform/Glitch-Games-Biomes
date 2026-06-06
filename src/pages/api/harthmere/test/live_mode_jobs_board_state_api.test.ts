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

  it("includes active law bounties in the jobs-board snapshot for wanted boards", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.law.standing.city_guard = {
      likeability: -10,
      legal: -500,
      notoriety: 850,
      notorietyFloor: 0,
    };
    backend.law.fines.city_guard = 35;
    backend.law.crimeRecords.push({
      id: "wanted_crime_api_1",
      actorId: ACTOR,
      kind: "murder",
      zoneId: "harthmere_market",
      factionId: "city_guard",
      itemIds: [],
      severity: 900,
      valueGold: 600,
      witnessLevel: "witnessed",
      witnesses: 2,
      detected: true,
      detectionScore: 100,
      response: "combat",
      fineGold: 0,
      bountyGold: 900,
      confiscatedItemIds: [],
      evidenceExpiresAtMs: NOW_MS + 86_400_000,
      status: "wanted",
      createdAtMs: NOW_MS,
    });
    const redis = {
      primary: {
        get: async (key: string) =>
          key === harthmereLiveModePlayerStateKeyV1(ACTOR)
            ? JSON.stringify(backend)
            : null,
      },
    };

    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal((snapshot as any).lawSummary.actorId, ACTOR);
    assert.equal((snapshot as any).lawSummary.standing.legal, -500);
    assert.equal((snapshot as any).lawSummary.fines.city_guard, 35);
    assert.equal((snapshot as any).lawSummary.activeBounties.length, 1);
    assert.equal(
      (snapshot as any).lawSummary.activeBounties[0].id,
      "wanted_crime_api_1"
    );
    assert.equal((snapshot as any).lawSummary.totalBountyGold, 900);
  });

  it("uses one Redis MGET for actor and shared jobs-board state when available", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const mgetCalls: string[][] = [];
    const getCalls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          getCalls.push(key);
          return null;
        },
        mget: async (...keys: string[]) => {
          mgetCalls.push(keys);
          return keys.map((key) =>
            key === harthmereLiveModePlayerStateKeyV1(ACTOR)
              ? JSON.stringify(backend)
              : null
          );
        },
      },
    };

    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(mgetCalls, [[
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      harthmereLiveModeSharedWorldStateKeyV1(),
    ]]);
    assert.deepEqual(getCalls, []);
    assert.equal(snapshot.actorId, ACTOR);
  });

  it("auto-seeds local/default jobs on read without writing by default", async () => {
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
    assert.equal(writes.length, 0, "plain reads should not contend with live mutations");
  });

  it("can explicitly persist auto-seeded read side effects for compatibility", async () => {
    const writes: Array<{ key: string; value: string }> = [];
    const redis = {
      primary: {
        get: async () => null,
        set: async (key: string, value: string) => {
          writes.push({ key, value });
        },
      },
    };
    await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      persistReadSideEffects: true,
    });

    assert.equal(writes.length, 1, "explicit compatibility mode still persists seeded jobs");
    assert.equal(writes[0]?.key, harthmereLiveModeSharedWorldStateKeyV1());
  });

  it("expires stale shared auto jobs on read before returning clickable open jobs", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendStateV1(
      "shared_board",
      NOW_MS,
    );
    sharedBackend.jobsBoard.postings.expired_shared_auto = {
      jobId: "expired_shared_auto",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Expired shared public job",
      description: "This stale job must not remain clickable.",
      kind: "delivery",
      requirements: [{ itemId: "road_ration", count: 1 }],
      rewardGold: 25,
      escrowGold: 25,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS - 86_400_000,
      deadlineAtMs: NOW_MS - 1,
      failurePenaltyGold: 2,
      requiresFieldWork: true,
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    sharedBackend.jobsBoard.issuerOpenJobIds["town:harthmere_grove"] = [
      "expired_shared_auto",
    ];
    const actorBackend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const writes: Array<{ key: string; value: string }> = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          if (key === harthmereLiveModePlayerStateKeyV1(ACTOR)) {
            return JSON.stringify(actorBackend);
          }
          if (key === harthmereLiveModeSharedWorldStateKeyV1()) {
            return JSON.stringify(
              createHarthmereLiveModeSharedWorldStateV1(sharedBackend, NOW_MS),
            );
          }
          return null;
        },
        set: async (key: string, value: string) => {
          writes.push({ key, value });
        },
      },
    };

    const snapshot = await readHarthmereLiveModeJobsBoardStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
      persistReadSideEffects: true,
    });

    assert.ok(
      !snapshot.openJobs.some((job) => job.jobId === "expired_shared_auto"),
      "expired shared jobs should not be returned as open/clickable",
    );
    assert.ok(
      snapshot.openJobs.some(
        (job) => job.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      ),
      "the read path should replace expired auto jobs with current board work",
    );
    assert.equal(writes.length, 1, "expired shared jobs should be persisted");
    const persisted = JSON.parse(writes[0].value);
    assert.equal(
      persisted.jobsBoard.postings.expired_shared_auto.status,
      "expired",
    );
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

  it("returns the actor's accepted shared jobs as quest-board todos", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendStateV1("shared_board", NOW_MS);
    sharedBackend.jobsBoard.postings.shared_accepted_job = {
      jobId: "shared_accepted_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Clear the Muckwad Patch",
      description: "Accepted job visible through the live jobs board state read path.",
      kind: "hunt",
      requirements: [
        {
          targetId: "mucker_elite",
          targetName: "Elite Mucker",
          mapMarkerId: "muckwad_patch",
        },
      ],
      rewardGold: 1200,
      escrowGold: 1200,
      reputationDelta: 12,
      status: "active",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      acceptedAtMs: NOW_MS + 1_000,
      acceptedByActorId: ACTOR,
      failurePenaltyGold: 120,
      requiresFieldWork: true,
      mapMarkerId: "muckwad_patch",
      targetId: "mucker_elite",
      abuseFlags: [],
      logs: ["accepted"],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    sharedBackend.jobsBoard.todos.harthmere_job_todo_42 = {
      todoId: "harthmere_job_todo_42",
      jobId: "shared_accepted_job",
      actorId: ACTOR,
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      title: "Clear the Muckwad Patch",
      todoText: "Go to the marked location and complete: Clear the Muckwad Patch",
      status: "active",
      kind: "hunt",
      mapMarkerId: "muckwad_patch",
      targetId: "mucker_elite",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS + 1_000,
      dueAtMs: NOW_MS + 86_400_000,
      questBoardTodo: true,
    };
    sharedBackend.jobsBoard.actorAcceptedJobIds[ACTOR] = ["shared_accepted_job"];

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

    assert.ok(
      snapshot.myAcceptedJobs.some((job) => job.jobId === "shared_accepted_job"),
      "accepted shared jobs should appear in the actor's My Jobs list",
    );
    const todo = snapshot.myTodos.find(
      (entry) => entry.todoId === "harthmere_job_todo_42",
    );
    assert.ok(todo, "accepted shared jobs should keep their quest-board todo");
    assert.equal(todo?.mapMarkerId, "muckwad_patch");
  });
});
