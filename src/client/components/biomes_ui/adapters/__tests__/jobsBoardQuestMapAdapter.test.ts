/// <reference types="mocha" />
import assert from "assert";
import {
  jobsBoardAcceptedJobLandmarksForBiomesUIV1,
  jobsBoardTrackableQuestsForBiomesUIV1,
  activeJobsBoardMissionStepsForBiomesUIV1,
} from "../jobsBoardQuestMapAdapter";
import { harthmereJobsBoardQuestMarkerPositionForIdV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";

const NOW_MS = 1_700_500_000_000;

function acceptedJobsBoardSnapshot() {
  return {
    version: "harthmere-jobs-board-authority-v1",
    actorId: "player_jobs_map_001",
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
        acceptedKinds: ["hunt"],
        requiresPhysicalInteraction: true,
      },
    },
    openJobs: [],
    activeJobs: [],
    myPostedJobs: [],
    myAcceptedJobs: [
      {
        jobId: "job_muck_hunt",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        issuerKind: "town",
        issuerId: "harthmere_grove",
        title: "Clear the Muckwad Patch",
        description: "Clear the marked muck threat.",
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
        status: "active",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW_MS,
        deadlineAtMs: NOW_MS + 86_400_000,
        acceptedByActorId: "player_jobs_map_001",
        requiresFieldWork: true,
        mapMarkerId: "muckwad_patch",
        targetId: "mucker_elite",
        abuseFlags: [],
        logs: [],
      },
    ],
    myTodos: [
      {
        todoId: "harthmere_job_todo_7",
        jobId: "job_muck_hunt",
        actorId: "player_jobs_map_001",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        title: "Clear the Muckwad Patch",
        todoText: "Go to the marked location and complete: Clear the Muckwad Patch",
        status: "active",
        kind: "hunt",
        mapMarkerId: "muckwad_patch",
        targetId: "mucker_elite",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW_MS,
        dueAtMs: NOW_MS + 86_400_000,
        questBoardTodo: true,
      },
    ],
    audit: [],
    cooldown: { abuseScore: 0 },
    safety: {
      minRewardGold: 5,
      maxRewardGold: 5000,
      maxActivePostingsPerIssuer: 12,
      maxActiveAcceptedPerSeeker: 6,
      requiresPhysicalBoardInteraction: true,
    },
  };
}

describe("BiomesUI jobs board quest map adapter", () => {
  it("turns accepted jobs board todos into active quest entries and target map markers", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    const target = harthmereJobsBoardQuestMarkerPositionForIdV1("muckwad_patch");
    assert.ok(target, "fixture marker should resolve through the shared marker registry");

    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUIV1(snapshot);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "jobs_board_marker:harthmere_job_todo_7");
    assert.equal(landmarks[0].kind, "objective");
    assert.equal(landmarks[0].active, true);
    assert.equal(landmarks[0].mapMarkerId, "muckwad_patch");
    assert.deepEqual(landmarks[0].position, target!.position);

    const quests = jobsBoardTrackableQuestsForBiomesUIV1(snapshot);
    assert.deepEqual(quests, [
      {
        questId: "jobs_board:harthmere_job_todo_7",
        title: "Clear the Muckwad Patch",
        area: "The Grove",
        status: "active",
        firstMarkerId: "jobs_board_marker:harthmere_job_todo_7",
        reward: "1200 gold",
      },
    ]);

    const steps = activeJobsBoardMissionStepsForBiomesUIV1(snapshot);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, "jobs_board:harthmere_job_todo_7");
    assert.equal(steps[0].done, false);
    assert.ok(steps[0].objective.includes("Clear the Muckwad Patch"));
  });

  it("does not keep stale cancelled or failed jobs on the active quest map", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myTodos = [
      { ...snapshot.myTodos[0], todoId: "completed_todo", status: "completed" },
      { ...snapshot.myTodos[0], todoId: "failed_todo", status: "failed" },
      { ...snapshot.myTodos[0], todoId: "cancelled_todo", status: "cancelled" },
    ] as any;

    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUIV1(snapshot);
    assert.equal(landmarks.length, 0);

    const quests = jobsBoardTrackableQuestsForBiomesUIV1(snapshot);
    assert.deepEqual(quests.map((quest) => [quest.questId, quest.status]), [
      ["jobs_board:completed_todo", "completed"],
    ]);
  });
});
