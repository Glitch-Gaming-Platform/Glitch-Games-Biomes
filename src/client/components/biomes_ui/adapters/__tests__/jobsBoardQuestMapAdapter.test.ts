/// <reference types="mocha" />
import assert from "assert";
import {
  jobsBoardAcceptedJobLandmarksForBiomesUI,
  jobsBoardToolSourceLandmarksForBiomesUI,
  jobsBoardTrackableQuestsForBiomesUI,
  activeJobsBoardMissionStepsForBiomesUI,
  firstActiveJobsBoardLandmarkForBiomesUI,
  shouldClearStaleJobsBoardPin,
  BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE,
} from "../jobsBoardQuestMapAdapter";
import { harthmereJobsBoardQuestMarkerPositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import { HARTHMERE_TOOL_SOURCES } from "@/shared/harthmere/harthmere_job_objective";
import {
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";

const NOW_MS = 1_700_500_000_000;

function acceptedJobsBoardSnapshot() {
  return {
    version: "harthmere-jobs-board-authority",
    actorId: "player_jobs_map_001",
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "town",
        issuerId: "harthmere_grove",
        title: "Clear the Muckwad Patch",
        description: "Clear the marked muck threat.",
        kind: "hunt",
        requirements: [
          {
            targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
            targetName: "Elite Mucker",
            mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
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
        mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
        targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
        abuseFlags: [],
        logs: [],
      },
    ],
    myTodos: [
      {
        todoId: "harthmere_job_todo_7",
        jobId: "job_muck_hunt",
        actorId: "player_jobs_map_001",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        title: "Clear the Muckwad Patch",
        todoText: "Go to the marked location and complete: Clear the Muckwad Patch",
        status: "active",
        kind: "hunt",
        mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
        targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
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
    const target = harthmereJobsBoardQuestMarkerPositionForId(
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID
    );
    assert.ok(target, "fixture marker should resolve through the shared marker registry");

    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(landmarks.length, 1);
    assert.deepEqual(firstActiveJobsBoardLandmarkForBiomesUI(snapshot), landmarks[0]);
    assert.equal(landmarks[0].id, "jobs_board_marker:harthmere_job_todo_7");
    assert.equal(landmarks[0].kind, "objective");
    assert.equal(landmarks[0].active, true);
    assert.equal(
      landmarks[0].mapMarkerId,
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID
    );
    assert.deepEqual(landmarks[0].position, target!.position);
    assert.ok(
      muckMonsterAreaForPosition(landmarks[0].position, 1.5),
      "accepted bounty map marker must be inside authored Muck territory"
    );

    // Give the accepted todo a known accept-window deadline + a fixed nowMs so the
    // countdown label (jobs are timed) is deterministic.
    (snapshot.myTodos[0] as any).dueAtMs = 1000 + 2 * 60 * 60 * 1000; // 2h after now
    const quests = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000);
    assert.deepEqual(quests, [
      {
        questId: "jobs_board:harthmere_job_todo_7",
        title: "Clear the Muckwad Patch",
        area: "The Grove",
        status: "active",
        firstMarkerId: "jobs_board_marker:harthmere_job_todo_7",
        reward: "1200 gold",
        timeRemaining: "2h 0m left",
        kind: "hunt",
        kindLabel: "Hunt",
        objective:
          "Go to the marked location and complete: Clear the Muckwad Patch",
        objectives: [
          "Go to the marked location and complete: Clear the Muckwad Patch",
        ],
        description: "Clear the marked muck threat.",
        // A hunt needs no tool, so there is no tool-source callout.
        toolSource: undefined,
      },
    ]);

    const steps = activeJobsBoardMissionStepsForBiomesUI(snapshot);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, "jobs_board:harthmere_job_todo_7");
    assert.equal(steps[0].done, false);
    assert.ok(steps[0].objective.includes("Clear the Muckwad Patch"));
  });

  it("drops markers for non-active todos, but surfaces completed AND failed in the tracker", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myTodos = [
      { ...snapshot.myTodos[0], todoId: "completed_todo", status: "completed" },
      { ...snapshot.myTodos[0], todoId: "failed_todo", status: "failed" },
      { ...snapshot.myTodos[0], todoId: "cancelled_todo", status: "cancelled" },
    ] as any;

    // No active todos -> no map markers (failed/completed/cancelled never show).
    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(landmarks.length, 0);

    // The tracker surfaces completed AND failed (so the player sees the outcome);
    // cancelled is dropped.
    const quests = jobsBoardTrackableQuestsForBiomesUI(snapshot);
    assert.deepEqual(quests.map((quest) => [quest.questId, quest.status]), [
      ["jobs_board:completed_todo", "completed"],
      ["jobs_board:failed_todo", "failed"],
    ]);
  });
});

// A snapshot with a single ACTIVE repair job (which requires a repair tool).
function repairJobSnapshot() {
  const snapshot = acceptedJobsBoardSnapshot();
  snapshot.myAcceptedJobs = [
    {
      ...snapshot.myAcceptedJobs[0],
      jobId: "job_fence_repair",
      title: "Patch the Safe-Zone Fence",
      description: "Repair the broken fence on the marked structure.",
      kind: "repair",
    },
  ] as any;
  snapshot.myTodos = [
    {
      ...snapshot.myTodos[0],
      todoId: "repair_todo_1",
      jobId: "job_fence_repair",
      title: "Patch the Safe-Zone Fence",
      todoText: "Repair the marked fence with a repair tool.",
      kind: "repair",
    },
  ] as any;
  return snapshot;
}

describe("BiomesUI jobs board tool-source guidance", () => {
  it("points a tool-requiring job at the vendor when the tool is NOT equipped", () => {
    const snapshot = repairJobSnapshot();
    const vendorMarkerId = HARTHMERE_TOOL_SOURCES.repair.vendorMarkerId;
    const vendor = harthmereJobsBoardQuestMarkerPositionForId(vendorMarkerId);
    assert.ok(vendor, "repair vendor must resolve through the shared registry");

    const landmarks = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "jobs_board_tool_source:repair_todo_1");
    assert.equal(
      landmarks[0].source,
      BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE
    );
    assert.equal(landmarks[0].mapMarkerId, vendorMarkerId);
    assert.deepEqual(landmarks[0].position, vendor!.position);
    assert.equal(landmarks[0].visibleOnWorldMap, true);
    assert.equal(landmarks[0].visibleOnHudMap, true);
    assert.ok(
      landmarks[0].label.includes(HARTHMERE_TOOL_SOURCES.repair.toolName)
    );
  });

  it("shows NO tool-source pin once the player owns the tool", () => {
    const snapshot = repairJobSnapshot();
    const landmarks = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: true,
      cleanupToolOwned: true,
    });
    assert.equal(landmarks.length, 0);
  });

  it("shows NO tool-source pin when ownership is unknown (no false positives)", () => {
    const snapshot = repairJobSnapshot();
    // No options passed -> unknown equip state -> we must not nag the player.
    assert.equal(jobsBoardToolSourceLandmarksForBiomesUI(snapshot).length, 0);
  });

  it("never emits a tool-source pin for a job kind that needs no tool", () => {
    const snapshot = acceptedJobsBoardSnapshot(); // a hunt
    const landmarks = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });
    assert.equal(landmarks.length, 0);
  });

  it("attaches a tool-source detail to the trackable quest when the tool is missing", () => {
    const snapshot = repairJobSnapshot();
    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });
    assert.ok(quest.toolSource, "missing tool should surface a tool source");
    assert.equal(quest.toolSource!.action, "repair");
    assert.equal(
      quest.toolSource!.vendorMarkerId,
      HARTHMERE_TOOL_SOURCES.repair.vendorMarkerId
    );
    assert.equal(quest.kind, "repair");
    assert.equal(quest.kindLabel, "Repair");
    assert.ok(quest.toolSource!.hint.length > 0);

    const equipped = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000, {
      repairToolOwned: true,
      cleanupToolOwned: true,
    });
    assert.equal(equipped[0].toolSource, undefined);
  });
});

describe("shouldClearStaleJobsBoardPin", () => {
  it("clears a jobs-board pin whose job is no longer active", () => {
    assert.equal(
      shouldClearStaleJobsBoardPin({
        activePinMarkerId: "jobs_board_marker:done-todo",
        activeJobsBoardMarkerIds: ["jobs_board_marker:other-todo"],
      }),
      true
    );
  });

  it("keeps a jobs-board pin that is still active", () => {
    assert.equal(
      shouldClearStaleJobsBoardPin({
        activePinMarkerId: "jobs_board_marker:todo-1",
        activeJobsBoardMarkerIds: ["jobs_board_marker:todo-1"],
      }),
      false
    );
  });

  it("never clears a non-jobs-board pin (e.g. a located vendor/property)", () => {
    assert.equal(
      shouldClearStaleJobsBoardPin({
        activePinMarkerId: "vendor_marker:smith",
        activeJobsBoardMarkerIds: [],
      }),
      false
    );
  });

  it("does nothing when there is no active pin", () => {
    assert.equal(
      shouldClearStaleJobsBoardPin({
        activePinMarkerId: undefined,
        activeJobsBoardMarkerIds: [],
      }),
      false
    );
  });
});
