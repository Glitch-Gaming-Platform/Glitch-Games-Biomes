/// <reference types="mocha" />
import assert from "assert";
import {
  jobsBoardAcceptedJobLandmarksForBiomesUI,
  jobsBoardItemSourceLandmarksForBiomesUI,
  jobsBoardToolSourceLandmarksForBiomesUI,
  jobsBoardTrackableQuestsForBiomesUI,
  activeJobsBoardMissionStepsForBiomesUI,
  firstActiveJobsBoardLandmarkForBiomesUI,
  jobsBoardLandmarkForActivePinHandoffForTest,
  newlyAcceptedJobsBoardTodoIdForTest,
  jobsBoardTodoIdFromMarkerIdForTest,
  shouldClearStaleJobsBoardPin,
  BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE,
  BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE,
} from "../jobsBoardQuestMapAdapter";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import { HARTHMERE_TOOL_SOURCES } from "@/shared/harthmere/harthmere_job_objective";
import {
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  harthmereAutoSeedTemplateRequirementsObtainable,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES } from "@/shared/harthmere/jobs_board_business_templates";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import { buildBiomesUIMapAdapterForTest } from "../mapLiveAdapter";
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
        todoText:
          "Go to the marked location and complete: Clear the Muckwad Patch",
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
  it("shows repeated cleanup progress from authoritative post-accept receipts", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myAcceptedJobs = [
      {
        ...snapshot.myAcceptedJobs[0],
        kind: "cleanup",
        requirements: [
          {
            serviceKind: "cleanup_muck",
            serviceUnits: 5,
            targetId: "muckwad_patch",
            targetName: "Muckwad Patch",
            mapMarkerId: "muckwad_patch",
          },
        ],
        mapMarkerId: "muckwad_patch",
        targetId: "muckwad_patch",
      },
    ] as any;
    snapshot.myTodos = [
      {
        ...snapshot.myTodos[0],
        kind: "cleanup",
        mapMarkerId: "muckwad_patch",
        targetId: "muckwad_patch",
        serviceProgressBaseline: { muckwad_patch: 10 },
      },
    ] as any;
    (snapshot as any).serviceProgressCounts = { muckwad_patch: 14 };
    const [landmark] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.match(landmark.description, /4\/5/);
    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
    assert.match(quest.objective ?? "", /Clear 4\/5 muck/);
    const [step] = activeJobsBoardMissionStepsForBiomesUI(snapshot, NOW_MS);
    assert.match(step.objective, /4\/5/);
  });

  it("turns accepted jobs board todos into active quest entries and target map markers", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    const target = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID
    );
    assert.ok(
      target,
      "fixture marker should resolve through the shared marker registry"
    );

    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(landmarks.length, 1);
    assert.deepEqual(
      firstActiveJobsBoardLandmarkForBiomesUI(snapshot),
      landmarks[0]
    );
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
        itemSource: undefined,
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

  it("pins an escort's authoritative destination instead of its live companion", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    const escortEntityId = 8_810_000_000_088_900;
    snapshot.myAcceptedJobs = [
      {
        ...snapshot.myAcceptedJobs[0],
        jobId: "job_escort_newcomer",
        title: "Escort a Newcomer to the Road Post",
        kind: "escort",
        mapMarkerId: String(escortEntityId),
        targetId: String(escortEntityId),
        escortCompanion: {
          companionId: "escort_companion:job_escort_newcomer:player",
          entityId: escortEntityId,
          jobId: "job_escort_newcomer",
          actorId: "player_jobs_map_001",
          displayName: "Newcomer",
          status: "following",
          position: { x: 504.2, y: 70, z: -131.8 },
          destination: { x: 500, y: 69, z: -140 },
          destinationTargetId: "old_grove_road_post",
          destinationMarkerId: "old_grove_road_post",
          createdAtMs: NOW_MS,
          updatedAtMs: NOW_MS,
        },
      },
    ] as any;
    snapshot.myTodos = [
      {
        ...snapshot.myTodos[0],
        jobId: "job_escort_newcomer",
        title: "Escort a Newcomer to the Road Post",
        kind: "escort",
        mapMarkerId: String(escortEntityId),
        targetId: String(escortEntityId),
      },
    ] as any;

    const [marker] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.deepEqual(marker.position, [500, 69, -140]);
    assert.equal(marker.mapMarkerId, "old_grove_road_post");
    assert.equal(marker.targetId, "old_grove_road_post");
  });

  it("keeps every accepted posting paired with its exact returned todo identity", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myAcceptedJobs = [
      {
        ...snapshot.myAcceptedJobs[0],
        jobId: "harthmere_auto_5",
        title: "Bounty: Elite Mucker at the Muck Edge",
        kind: "hunt",
      },
      {
        ...snapshot.myAcceptedJobs[0],
        jobId: "harthmere_auto_3",
        title: "Plane Bench Planks for the Inn",
        kind: "craft",
        mapMarkerId: undefined,
        targetId: undefined,
      },
      {
        ...snapshot.myAcceptedJobs[0],
        jobId: "harthmere_auto_8",
        title: "Patch the Safe-Zone Fence",
        kind: "repair",
        mapMarkerId: "grove_repair_fence",
        targetId: undefined,
      },
    ] as any;
    snapshot.myTodos = [
      {
        ...snapshot.myTodos[0],
        todoId: "harthmere_job_todo_4",
        jobId: "harthmere_auto_5",
        title: "Bounty: Elite Mucker at the Muck Edge",
        kind: "hunt",
      },
      {
        ...snapshot.myTodos[0],
        todoId: "harthmere_job_todo_5",
        jobId: "harthmere_auto_3",
        title: "Plane Bench Planks for the Inn",
        kind: "craft",
        mapMarkerId: undefined,
        targetId: undefined,
      },
      {
        ...snapshot.myTodos[0],
        todoId: "harthmere_job_todo_6",
        jobId: "harthmere_auto_8",
        title: "Patch the Safe-Zone Fence",
        kind: "repair",
        mapMarkerId: "grove_repair_fence",
        targetId: undefined,
      },
    ] as any;

    const quests = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
    assert.deepEqual(
      quests.map((quest) => [quest.questId, quest.title, quest.kind]),
      [
        [
          "jobs_board:harthmere_job_todo_4",
          "Bounty: Elite Mucker at the Muck Edge",
          "hunt",
        ],
        [
          "jobs_board:harthmere_job_todo_5",
          "Plane Bench Planks for the Inn",
          "craft",
        ],
        [
          "jobs_board:harthmere_job_todo_6",
          "Patch the Safe-Zone Fence",
          "repair",
        ],
      ]
    );
    assert.deepEqual(
      jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot).map((marker) => [
        marker.jobsBoardTodoId,
        marker.jobsBoardJobId,
        marker.label,
      ]),
      [
        [
          "harthmere_job_todo_4",
          "harthmere_auto_5",
          "Bounty: Elite Mucker at the Muck Edge",
        ],
        [
          "harthmere_job_todo_5",
          "harthmere_auto_3",
          "Plane Bench Planks for the Inn",
        ],
        [
          "harthmere_job_todo_6",
          "harthmere_auto_8",
          "Patch the Safe-Zone Fence",
        ],
      ]
    );
  });

  it("projects every executable production job template back into an exact frontend quest and marker", () => {
    const snapshot = acceptedJobsBoardSnapshot() as any;
    snapshot.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID] = {
      ...snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID],
      boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      displayName: "Harthmere Town Jobs Board",
      townId: "harthmere",
      regionId: "harthmere_region",
      markerId: "harthmere_town_market_posting_board",
      location: {
        x: 2134,
        y: 53,
        z: -202,
        radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
        district: "Harthmere",
        landmarkId: "harthmere_town_market_posting_board",
      },
    };
    const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) =>
        harthmereAutoSeedTemplateRequirementsObtainable(template.requirements)
    );
    snapshot.myAcceptedJobs = templates.map((template, index) => {
      const boardId =
        template.boardScope === "harthmere"
          ? HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
          : HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
      const mapMarkerId =
        template.mapMarkerId ??
        template.requirements.find((requirement) => requirement.mapMarkerId)
          ?.mapMarkerId;
      const targetId =
        template.targetId ??
        template.requirements.find((requirement) => requirement.targetId)
          ?.targetId;
      return {
        ...acceptedJobsBoardSnapshot().myAcceptedJobs[0],
        jobId: `e2e_job_${index}`,
        boardId,
        templateId: template.templateId,
        issuerKind: template.issuerKind,
        issuerId: template.issuerId,
        title: template.title,
        description: template.description,
        kind: template.kind,
        requirements: template.requirements,
        rewardGold: template.rewardGold.min,
        escrowGold: template.rewardGold.min,
        townId:
          boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
            ? "harthmere"
            : "harthmere_grove",
        regionId:
          boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
            ? "harthmere_region"
            : "harthmere_grove_region",
        requiresFieldWork: template.requiresFieldWork,
        mapMarkerId,
        targetId,
      };
    });
    snapshot.myTodos = snapshot.myAcceptedJobs.map(
      (job: any, index: number) => ({
        ...acceptedJobsBoardSnapshot().myTodos[0],
        todoId: `e2e_todo_${index}`,
        jobId: job.jobId,
        boardId: job.boardId,
        title: job.title,
        todoText: `Go to the marked location and complete: ${job.title}`,
        kind: job.kind,
        mapMarkerId: job.mapMarkerId,
        targetId: job.targetId,
        townId: job.townId,
        regionId: job.regionId,
      })
    );

    const quests = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
    const markers = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(templates.length, 20);
    assert.equal(quests.length, templates.length);
    assert.equal(markers.length, templates.length);
    for (const [index, template] of templates.entries()) {
      const jobId = `e2e_job_${index}`;
      const todoId = `e2e_todo_${index}`;
      const quest = quests.find(
        (candidate) => candidate.questId === `jobs_board:${todoId}`
      );
      const marker = markers.find(
        (candidate) => candidate.jobsBoardJobId === jobId
      );
      assert.ok(quest, `${template.templateId} quest missing`);
      assert.ok(marker, `${template.templateId} marker missing`);
      assert.equal(quest.title, template.title);
      assert.equal(quest.kind, template.kind);
      assert.equal(marker.label, template.title);
      assert.ok(
        marker.position.every(Number.isFinite),
        `${template.templateId} marker coordinate invalid`
      );
    }
  });

  it("keeps a field-complete job active until the player claims the reward at the board", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myAcceptedJobs[0].kind = "delivery" as any;
    snapshot.myAcceptedJobs[0].title = "Deliver Medicine";
    snapshot.myAcceptedJobs[0].description = "Drop medicine at the lockbox.";
    snapshot.myAcceptedJobs[0].requirements = [
      {
        itemId: "sealed_package",
        count: 1,
        mapMarkerId: "clinic_lockbox_marker",
        targetName: "Clinic lockbox",
      },
    ] as any;
    (snapshot.myAcceptedJobs[0] as any).mapMarkerId = "clinic_lockbox_marker";
    snapshot.myTodos[0] = {
      ...snapshot.myTodos[0],
      title: "Deliver Medicine",
      todoText: "Deliver Sealed Package to Clinic lockbox.",
      status: "completed",
      kind: "delivery",
      mapMarkerId: "clinic_lockbox_marker",
    } as any;

    const landmarks = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "jobs_board_marker:harthmere_job_todo_7");
    assert.equal(landmarks[0].mapMarkerId, "harthmere_market_posting_board");
    assert.ok(landmarks[0].description.includes("Return to the jobs board"));

    const quests = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000);
    assert.equal(quests.length, 1);
    const quest = quests[0];
    assert.ok(quest);
    assert.equal(quest.status, "active");
    assert.equal(quest.firstMarkerId, "jobs_board_marker:harthmere_job_todo_7");
    assert.equal(quest.itemSource, undefined);
    assert.ok((quest.objective ?? "").includes("Return to the jobs board"));

    const steps = activeJobsBoardMissionStepsForBiomesUI(snapshot, 1000);
    assert.equal(steps.length, 1);
    assert.ok(steps[0].objective.includes("Return to the jobs board"));
  });

  it("uses the registered physical pickup label for Run the Coop", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myAcceptedJobs[0] = {
      ...snapshot.myAcceptedJobs[0],
      jobId: "job_coop_food",
      title: "Run the Coop Food Parcel",
      description: "Collect the parcel from the hen-yard crate.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          pickupMarkerId: "coop_supply_box",
          mapMarkerId: "grove_mail_bank_satchel",
        },
      ],
      mapMarkerId: "grove_mail_bank_satchel",
    } as any;
    snapshot.myTodos[0] = {
      ...snapshot.myTodos[0],
      todoId: "todo_coop_food",
      jobId: "job_coop_food",
      title: "Run the Coop Food Parcel",
      kind: "delivery",
      mapMarkerId: "grove_mail_bank_satchel",
    } as any;

    const [source] = jobsBoardItemSourceLandmarksForBiomesUI(snapshot);
    assert.equal(source.mapMarkerId, "coop_supply_box");
    assert.equal(source.label, "Get Sealed Package — Old Supply Box");
    assert.ok(!source.label.includes("_"));
    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
    assert.equal(quest.itemSource?.sourceName, "Old Supply Box");
  });

  it("keeps Run the Coop on delivery after a durable pickup receipt even when the inventory mirror is stale", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.inventoryItems = {};
    snapshot.myAcceptedJobs[0] = {
      ...snapshot.myAcceptedJobs[0],
      jobId: "job_coop_food",
      title: "Run the Coop Food Parcel",
      description: "Collect the parcel from the hen-yard crate.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          pickupMarkerId: "coop_supply_box",
          mapMarkerId: "grove_mail_bank_satchel",
        },
      ],
      mapMarkerId: "grove_mail_bank_satchel",
      logs: [
        "delivery_parcel_picked_up:sealed_package:1:coop_supply_box:1000",
      ],
    } as any;
    snapshot.myTodos[0] = {
      ...snapshot.myTodos[0],
      todoId: "todo_coop_food",
      jobId: "job_coop_food",
      title: "Run the Coop Food Parcel",
      kind: "delivery",
      mapMarkerId: "grove_mail_bank_satchel",
    } as any;

    const [marker] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    assert.equal(marker.mapMarkerId, "grove_mail_bank_satchel");
    assert.ok(marker.description.includes("Deliver"));
    assert.equal(jobsBoardItemSourceLandmarksForBiomesUI(snapshot).length, 0);
  });

  it("drops markers for fully completed todos, but surfaces completed AND failed in the tracker", () => {
    const snapshot = acceptedJobsBoardSnapshot();
    snapshot.myAcceptedJobs[0].status = "completed" as any;
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
    assert.deepEqual(
      quests.map((quest) => [quest.questId, quest.status]),
      [
        ["jobs_board:completed_todo", "completed"],
        ["jobs_board:failed_todo", "failed"],
      ]
    );
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
  it("detects a newly accepted todo without reselecting jobs during initial hydration", () => {
    const accepted = repairJobSnapshot();
    const before = {
      ...accepted,
      myAcceptedJobs: [],
      myTodos: [],
    };
    assert.equal(
      newlyAcceptedJobsBoardTodoIdForTest({
        previous: undefined,
        next: accepted,
      }),
      undefined
    );
    assert.equal(
      newlyAcceptedJobsBoardTodoIdForTest({ previous: before, next: accepted }),
      "repair_todo_1"
    );
    assert.equal(
      newlyAcceptedJobsBoardTodoIdForTest({
        previous: accepted,
        next: accepted,
      }),
      undefined
    );
  });

  it("hands a completed tool-buy phase back to the same accepted todo", () => {
    const snapshot = repairJobSnapshot();
    const [accepted] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    const [toolSource] = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });
    assert.equal(
      jobsBoardTodoIdFromMarkerIdForTest(toolSource.id),
      "repair_todo_1"
    );
    assert.equal(
      jobsBoardLandmarkForActivePinHandoffForTest({
        activePinMarkerId: toolSource.id,
        landmarks: [accepted],
      })?.id,
      accepted.id
    );
  });

  it("promotes an accepted field pin to the required tool vendor before work can begin", () => {
    const snapshot = repairJobSnapshot();
    const [accepted] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    const [toolSource] = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });
    assert.equal(
      jobsBoardLandmarkForActivePinHandoffForTest({
        activePinMarkerId: accepted.id,
        landmarks: [accepted, toolSource],
      })?.id,
      toolSource.id
    );
  });

  it("hands a completed tool-buy phase to the next unmet material source before the field target", () => {
    const snapshot = missingItemRepairJobSnapshot();
    const [accepted] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
    const [itemSource] = jobsBoardItemSourceLandmarksForBiomesUI(snapshot);
    const [toolSource] = jobsBoardToolSourceLandmarksForBiomesUI(snapshot, {
      repairToolOwned: false,
      cleanupToolOwned: false,
    });

    const handoff = jobsBoardLandmarkForActivePinHandoffForTest({
      activePinMarkerId: toolSource.id,
      landmarks: [accepted, itemSource],
    });

    assert.equal(handoff?.id, itemSource.id);
    assert.equal(
      handoff?.source,
      BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE
    );
  });

  it("points a tool-requiring job at the vendor when the tool is NOT equipped", () => {
    const snapshot = repairJobSnapshot();
    const vendorMarkerId = HARTHMERE_TOOL_SOURCES.repair.vendorMarkerId;
    const vendor =
      harthmereJobsBoardQuestMarkerRuntimePositionForId(vendorMarkerId);
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

function missingItemRepairJobSnapshot() {
  const snapshot = repairJobSnapshot();
  (snapshot as any).inventoryItems = { softwood_log: 1 };
  snapshot.myAcceptedJobs = [
    {
      ...snapshot.myAcceptedJobs[0],
      requirements: [
        {
          itemId: "softwood_log",
          count: 3,
          mapMarkerId: "grove_repair_fence",
          requiredToolAction: "repair",
        },
      ],
    },
  ] as any;
  return snapshot;
}

describe("BiomesUI jobs board item-source guidance", () => {
  it("points an accepted job at how and where to obtain missing requirement items", () => {
    const snapshot = missingItemRepairJobSnapshot();

    const landmarks = jobsBoardItemSourceLandmarksForBiomesUI(snapshot);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "jobs_board_item_source:repair_todo_1");
    assert.equal(
      landmarks[0].source,
      BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE
    );
    assert.equal(landmarks[0].mapMarkerId, "harthmere_orchard_softwood");
    assert.deepEqual(landmarks[0].position, [2068, 53, -118]);
    assert.ok(/Gather 2 Softwood Logs/i.test(landmarks[0].description));

    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000, {
      repairToolOwned: true,
    });
    assert.equal(quest.firstMarkerId, "jobs_board_item_source:repair_todo_1");
    assert.ok(quest.itemSource, "missing item should surface an item source");
    assert.equal(quest.itemSource!.itemId, "softwood_log");
    assert.equal(quest.itemSource!.missingCount, 2);
    assert.ok(
      quest.objectives?.some((objective) =>
        /Orchard Softwood Branches/i.test(objective)
      )
    );
  });

  it("does not show an item-source pin once inventory satisfies the requirement", () => {
    const snapshot = missingItemRepairJobSnapshot();
    (snapshot as any).inventoryItems = { softwood_log: 3 };
    assert.equal(jobsBoardItemSourceLandmarksForBiomesUI(snapshot).length, 0);
    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, 1000);
    assert.equal(quest.itemSource, undefined);
  });
});

function gatherRoadRationsSnapshot(
  inventoryItems: Record<string, number> = {}
) {
  const snapshot = acceptedJobsBoardSnapshot();
  (snapshot as any).inventoryItems = inventoryItems;
  snapshot.myAcceptedJobs = [
    {
      ...snapshot.myAcceptedJobs[0],
      jobId: "job_road_rations",
      templateId: "town_gather_road_rations",
      title: "Stock the Road Rations Crate",
      description:
        "Grove travellers leave hungry. Gather 6 wild berries for the road rations crate at the fountain.",
      kind: "gather",
      requirements: [
        {
          itemId: "wild_berries",
          count: 6,
          mapMarkerId: "grove_garden_edge_berries",
        },
      ],
      mapMarkerId: "grove_garden_edge_berries",
      targetId: undefined,
    },
  ] as any;
  snapshot.myTodos = [
    {
      ...snapshot.myTodos[0],
      todoId: "road_rations_todo",
      jobId: "job_road_rations",
      title: "Stock the Road Rations Crate",
      todoText:
        "Go to the marked location and complete: Stock the Road Rations Crate",
      kind: "gather",
      mapMarkerId: "grove_garden_edge_berries",
      targetId: undefined,
      status: "active",
    },
  ] as any;
  return snapshot;
}

describe("BiomesUI jobs board gather progression", () => {
  it("guides to the item source while missing items, then back to the Grove board once inventory satisfies the job", () => {
    const missing = gatherRoadRationsSnapshot({ wild_berries: 2 });
    const [fieldMarker] = jobsBoardAcceptedJobLandmarksForBiomesUI(missing);
    assert.equal(fieldMarker.mapMarkerId, "grove_garden_edge_berries");
    assert.deepEqual(fieldMarker.position, [486, 70, -120]);
    assert.ok(/Gather 2\/6 Wild Berries/i.test(fieldMarker.description));

    const ready = gatherRoadRationsSnapshot({ wild_berries: 6 });
    const [turnInMarker] = jobsBoardAcceptedJobLandmarksForBiomesUI(ready);
    const boardMarker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      "harthmere_market_posting_board"
    );
    assert.equal(turnInMarker.mapMarkerId, "harthmere_market_posting_board");
    assert.ok(boardMarker, "Grove jobs board marker must resolve");
    assert.deepEqual(turnInMarker.position, boardMarker!.position);
    assert.ok(/Return to the jobs board/i.test(turnInMarker.description));

    const [quest] = jobsBoardTrackableQuestsForBiomesUI(ready, NOW_MS);
    assert.equal(quest.firstMarkerId, "jobs_board_marker:road_rations_todo");
    assert.ok(quest.objective);
    assert.ok(/Return to the jobs board/i.test(quest.objective));
    assert.equal(jobsBoardItemSourceLandmarksForBiomesUI(ready).length, 0);
  });

  it("keeps business gather jobs on their physical hand-in target until the player interacts there", () => {
    for (const [templateId, inventoryItems] of [
      ["farm_crop_harvest", { crop_bundle: 3 }],
      ["design_studio_decor_materials", { tree_resin: 1, oak_branch: 2 }],
    ] as const) {
      const template = HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.find(
        (candidate) => candidate.templateId === templateId
      );
      assert.ok(template, `${templateId} fixture missing`);
      const snapshot = acceptedJobsBoardSnapshot() as any;
      snapshot.inventoryItems = inventoryItems;
      snapshot.myAcceptedJobs = [
        {
          ...snapshot.myAcceptedJobs[0],
          jobId: `job_${templateId}`,
          templateId,
          title: template!.title,
          description: template!.description,
          kind: template!.kind,
          requirements: template!.requirements,
          requiresFieldWork: true,
          mapMarkerId: template!.mapMarkerId,
          targetId: template!.targetId,
        },
      ];
      snapshot.myTodos = [
        {
          ...snapshot.myTodos[0],
          todoId: `todo_${templateId}`,
          jobId: `job_${templateId}`,
          title: template!.title,
          kind: template!.kind,
          mapMarkerId: template!.mapMarkerId,
          targetId: template!.targetId,
        },
      ];

      const [marker] = jobsBoardAcceptedJobLandmarksForBiomesUI(snapshot);
      assert.equal(marker.mapMarkerId, template!.mapMarkerId);
      assert.ok(/press F to complete the job/i.test(marker.description));
      assert.doesNotMatch(marker.description, /return to the jobs board/i);
      assert.equal(jobsBoardItemSourceLandmarksForBiomesUI(snapshot).length, 0);

      const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
      assert.equal(quest.firstMarkerId, `jobs_board_marker:todo_${templateId}`);
      assert.ok(/press F to complete the job/i.test(quest.objective ?? ""));
      assert.doesNotMatch(quest.objective ?? "", /return to the jobs board/i);
    }
  });

  it("guides each missing material in a multi-item business gather job before the physical hand-in", () => {
    const template = HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.find(
      (candidate) => candidate.templateId === "design_studio_decor_materials"
    );
    assert.ok(template);
    const snapshot = acceptedJobsBoardSnapshot() as any;
    snapshot.inventoryItems = { tree_resin: 1, oak_branch: 0 };
    snapshot.myAcceptedJobs = [
      {
        ...snapshot.myAcceptedJobs[0],
        jobId: "job_design_materials",
        templateId: template!.templateId,
        title: template!.title,
        description: template!.description,
        kind: template!.kind,
        requirements: template!.requirements,
        requiresFieldWork: true,
        mapMarkerId: template!.mapMarkerId,
        targetId: template!.targetId,
      },
    ];
    snapshot.myTodos = [
      {
        ...snapshot.myTodos[0],
        todoId: "todo_design_materials",
        jobId: "job_design_materials",
        title: template!.title,
        kind: template!.kind,
        mapMarkerId: template!.mapMarkerId,
        targetId: template!.targetId,
      },
    ];

    const [source] = jobsBoardItemSourceLandmarksForBiomesUI(snapshot);
    assert.equal(source.mapMarkerId, "harthmere_orchard_softwood");
    assert.match(source.description, /2 Oak Branches/i);
    const [quest] = jobsBoardTrackableQuestsForBiomesUI(snapshot, NOW_MS);
    assert.equal(
      quest.firstMarkerId,
      "jobs_board_item_source:todo_design_materials"
    );
    assert.equal(quest.itemSource?.itemId, "oak_branch");
    assert.match(quest.objective ?? "", /Gather all required materials/i);
    assert.doesNotMatch(quest.objective ?? "", /return to the jobs board/i);
  });
});

function craftBoardTurnInSnapshot(inventoryItems: Record<string, number> = {}) {
  const snapshot = acceptedJobsBoardSnapshot();
  (snapshot as any).inventoryItems = inventoryItems;
  snapshot.myAcceptedJobs = [
    {
      ...snapshot.myAcceptedJobs[0],
      jobId: "job_board_planks",
      templateId: "business_craft_torch",
      title: "Plane Bench Planks for the Inn",
      description:
        "The inn needs sturdy bench planks before dusk. Craft or buy 3 wood planks and turn them in at the board.",
      kind: "craft",
      requirements: [{ itemId: "wood_plank", count: 3 }],
      requiresFieldWork: false,
      mapMarkerId: undefined,
      targetId: undefined,
    },
  ] as any;
  snapshot.myTodos = [
    {
      ...snapshot.myTodos[0],
      todoId: "craft_planks_todo",
      jobId: "job_board_planks",
      title: "Plane Bench Planks for the Inn",
      todoText: "Complete board job: Plane Bench Planks for the Inn",
      kind: "craft",
      mapMarkerId: undefined,
      targetId: undefined,
      status: "active",
    },
  ] as any;
  return snapshot;
}

describe("BiomesUI jobs board item-only turn-in routing", () => {
  it("keeps item-only craft jobs on the source while missing items, then routes back to the board", () => {
    const missing = craftBoardTurnInSnapshot({ wood_plank: 1 });
    const [missingQuest] = jobsBoardTrackableQuestsForBiomesUI(missing, NOW_MS);
    assert.equal(
      missingQuest.firstMarkerId,
      "jobs_board_item_source:craft_planks_todo"
    );
    assert.ok(missingQuest.itemSource);
    assert.equal(missingQuest.itemSource!.missingCount, 2);
    const mapAdapter = buildBiomesUIMapAdapterForTest(
      1,
      [501.99, 70, -132],
      missing
    );
    const sourceMarker = mapAdapter
      .getMarkers()
      .find((marker) => marker.id === missingQuest.firstMarkerId);
    assert.ok(
      sourceMarker,
      "Show on map must resolve the exact synthetic item-source marker id"
    );
    assert.match(sourceMarker!.label, /Get Wood Plank.*Fountain Workbench/i);
    assert.ok(
      sourceMarker!.worldPosition,
      "source marker needs world coordinates"
    );

    const ready = craftBoardTurnInSnapshot({ wood_plank: 3 });
    const [turnInMarker] = jobsBoardAcceptedJobLandmarksForBiomesUI(ready);
    assert.equal(turnInMarker.mapMarkerId, "harthmere_market_posting_board");
    assert.ok(/Return to the jobs board/i.test(turnInMarker.description));

    const [readyQuest] = jobsBoardTrackableQuestsForBiomesUI(ready, NOW_MS);
    assert.equal(
      readyQuest.firstMarkerId,
      "jobs_board_marker:craft_planks_todo"
    );
    assert.equal(readyQuest.itemSource, undefined);
    assert.ok(/Required items are ready/i.test(readyQuest.objective ?? ""));

    const [step] = activeJobsBoardMissionStepsForBiomesUI(ready, NOW_MS);
    assert.ok(/Return to the jobs board/i.test(step.objective));
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
