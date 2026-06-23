/// <reference types="mocha" />

import assert from "assert";
import {
  activeLiveEntityHelperMissionStepsForBiomesUI,
  liveEntityHelperAcceptedQuestLandmarksForBiomesUI,
  liveEntityHelperQuestStateFromLiveQuestStateForBiomesUI,
  liveEntityHelperTrackableQuestsForBiomesUI,
} from "../liveEntityHelperQuestMapAdapter";
import {
  LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  liveEntityHelperQuestTargetMarkerForKind,
} from "@/shared/harthmere/live_entity_helper_quests";

const NOW_MS = 1_700_600_000_000;

function helperState() {
  return {
    active: {
      "live-helper:boba:food_water": {
        questId: "live-helper:boba:food_water",
        kind: "food_water",
        entityId: "boba",
        giverName: "Boba :)",
        at: NOW_MS,
      },
    },
    completed: {},
  };
}

describe("BiomesUI live-entity helper quest map adapter", () => {
  it("projects accepted helper quests into the quest list, mission steps, and active map markers", () => {
    const state = helperState();
    const marker = liveEntityHelperQuestTargetMarkerForKind("food_water");
    assert.ok(marker, "fixture marker should resolve");

    const landmarks = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, marker!.id);
    assert.equal(landmarks[0].active, true);
    assert.equal(landmarks[0].visibleOnWorldMap, true);
    assert.deepEqual(landmarks[0].position, marker!.position);
    assert.equal(
      landmarks[0].description,
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water.activeText
    );

    const quests = liveEntityHelperTrackableQuestsForBiomesUI(state);
    assert.deepEqual(quests, [
      {
        questId: "live-helper:boba:food_water",
        title: "Remote Biome Supply Drop",
        area: "Boba :) - River Docks",
        status: "active",
        firstMarkerId: marker!.id,
        reward: "90 XP, 2 Minor Healing Salves, 1 Black Anvil Repair Voucher",
        kind: "food_water",
        kindLabel: "Helper Quest",
        objective: LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water.activeText,
        objectives: [
          LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water.activeText,
        ],
        description: LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water.offerText,
      },
    ]);

    const steps = activeLiveEntityHelperMissionStepsForBiomesUI(state);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, "live-helper:boba:food_water");
    assert.equal(steps[0].done, false);
    assert.ok(steps[0].objective.includes("Boba :)"));
    assert.ok(steps[0].objective.includes("Road Rations"));

    const playerText = JSON.stringify({
      markerLabel: landmarks[0].label,
      markerDescription: landmarks[0].description,
      questTitle: quests[0].title,
      questArea: quests[0].area,
      questReward: quests[0].reward,
      stepObjective: steps[0].objective,
    });
    assert.equal(
      /road_ration|clean_water|live_entity_helper|debug|server/i.test(
        playerText
      ),
      false
    );
  });

  it("keeps completed helper quests in the list without stale active markers", () => {
    const state = {
      active: {},
      completed: {
        "live-helper:frogberry:exotic_matter": {
          questId: "live-helper:frogberry:exotic_matter",
          kind: "exotic_matter",
          entityId: "frogberry",
          giverName: "Frogberry",
          at: NOW_MS - 10,
        },
      },
    };

    assert.equal(
      liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state).length,
      0
    );
    assert.equal(
      activeLiveEntityHelperMissionStepsForBiomesUI(state).length,
      0
    );
    const quests = liveEntityHelperTrackableQuestsForBiomesUI(state);
    assert.equal(quests.length, 1);
    assert.equal(quests[0].status, "completed");
    assert.equal(quests[0].firstMarkerId, undefined);
    assert.ok(quests[0].reward?.includes("Stabilized Exotic Matter"));
  });

  it("points exotic-matter and monster markers at the REAL target site (not a per-kind area centroid)", () => {
    for (const kind of ["exotic_matter", "hard_boss"] as const) {
      const state = {
        active: {
          [`live-helper:x:${kind}`]: {
            questId: `live-helper:x:${kind}`,
            kind,
            entityId: "x",
            giverName: "Mara",
            at: NOW_MS,
          },
        },
        completed: {},
      };
      const landmarks =
        liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state);
      assert.equal(landmarks.length, 1, `${kind} produces a marker`);
      assert.deepEqual(
        landmarks[0].position,
        [...LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS[kind].position],
        `${kind} marker points at its real target site`
      );
      assert.equal(
        landmarks[0].kind,
        kind === "hard_boss" ? "danger" : "resource"
      );
      // Y must be a visible, finite surface coordinate.
      assert.ok(Number.isFinite(landmarks[0].position[1]));
    }
  });

  it("flips the marker to the giver position once the stored readyToTurnIn flag is set", () => {
    const state = {
      active: {
        "live-helper:jackie:exotic_matter": {
          questId: "live-helper:jackie:exotic_matter",
          kind: "exotic_matter",
          entityId: "jackie",
          giverName: "Jackie",
          at: NOW_MS,
          giverPosition: [496, 70, -126],
          readyToTurnIn: true,
        },
      },
      completed: {},
    };
    const landmarks = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state);
    assert.equal(landmarks.length, 1);
    assert.equal(
      landmarks[0].id,
      "live_entity_helper_return:live-helper:jackie:exotic_matter"
    );
    assert.deepEqual(landmarks[0].position, [496, 70, -126]);
    assert.equal(landmarks[0].label, "Return to Jackie");
    assert.ok(landmarks[0].description.includes("return to Jackie"));

    const [quest] = liveEntityHelperTrackableQuestsForBiomesUI(state);
    assert.equal(quest.firstMarkerId, landmarks[0].id);
    assert.ok(quest.objective?.includes("Return to Jackie"));
    assert.ok(
      quest.objective?.includes(
        LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.exotic_matter.readyText
      )
    );

    const [step] = activeLiveEntityHelperMissionStepsForBiomesUI(state);
    assert.ok(step.objective.includes("Return to Jackie"));
  });

  it("projects server-backed helper quest state into missions, quests, and map markers", () => {
    const questId = "live-helper:8810000000019752:hard_boss";
    const state = liveEntityHelperQuestStateFromLiveQuestStateForBiomesUI({
      version: "harthmere-live-mode-quest-state",
      actorId: "player_old_coop",
      active: {
        [questId]: {
          stepId: "live_helper_muck_scarred_helix",
          progress: 0,
          source: "live_entity_helper",
          title: "Defeat the Muck-Scarred Helix",
          questKind: "hard_boss",
          entityId: "8810000000019752",
          giverName: "Old Coop",
          giverPosition: [380, 71, -202],
        },
      },
      completed: {},
      updatedAtMs: NOW_MS,
    });

    assert.equal(state.active[questId]?.giverName, "Old Coop");

    const quests = liveEntityHelperTrackableQuestsForBiomesUI(state);
    assert.equal(quests.length, 1);
    assert.equal(quests[0].questId, questId);
    assert.equal(quests[0].status, "active");
    assert.equal(quests[0].title, "Muck Breach Boss");
    assert.equal(quests[0].area, "Old Coop - West Muck Breach");

    const steps = activeLiveEntityHelperMissionStepsForBiomesUI(state);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, questId);
    assert.ok(steps[0].objective.includes("Old Coop"));
    assert.ok(steps[0].objective.includes("Muck-Scarred Helix"));

    const landmarks = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state);
    assert.equal(landmarks.length, 1);
    assert.equal(
      landmarks[0].id,
      liveEntityHelperQuestTargetMarkerForKind("hard_boss")!.id
    );
    assert.equal(landmarks[0].active, true);
  });

  it("uses the injected isReadyToTurnIn resolver over the stored flag (live objective check)", () => {
    const state = {
      active: {
        "live-helper:jackie:hard_boss": {
          questId: "live-helper:jackie:hard_boss",
          kind: "hard_boss",
          entityId: "jackie",
          giverName: "Jackie",
          at: NOW_MS,
          giverPosition: [10, 64, 20],
          readyToTurnIn: false,
        },
      },
      completed: {},
    };
    // Objective NOT met -> stays on target.
    const onTarget = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state, {
      isReadyToTurnIn: () => false,
    });
    assert.deepEqual(onTarget[0].position, [
      ...LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS.hard_boss.position,
    ]);
    // Objective met -> flips to giver even though the stored flag is false.
    const home = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state, {
      isReadyToTurnIn: () => true,
    });
    assert.deepEqual(home[0].position, [10, 64, 20]);
    assert.equal(home[0].label, "Return to Jackie");

    const [quest] = liveEntityHelperTrackableQuestsForBiomesUI(state, {
      isReadyToTurnIn: () => true,
    });
    assert.equal(quest.firstMarkerId, home[0].id);
    assert.ok(quest.objective?.includes("Return to Jackie"));

    const [step] = activeLiveEntityHelperMissionStepsForBiomesUI(state, {
      isReadyToTurnIn: () => true,
    });
    assert.ok(step.objective.includes("Return to Jackie"));
  });

  it("keeps a shared target marker while separating ready turn-in markers by quest", () => {
    const marker = liveEntityHelperQuestTargetMarkerForKind("food_water");
    assert.ok(marker, "fixture marker should resolve");
    const state = {
      active: {
        "live-helper:ready:food_water": {
          questId: "live-helper:ready:food_water",
          kind: "food_water",
          entityId: "ready",
          giverName: "Ready Helper",
          at: NOW_MS,
          giverPosition: [10, 64, 20],
          readyToTurnIn: true,
        },
        "live-helper:target:food_water": {
          questId: "live-helper:target:food_water",
          kind: "food_water",
          entityId: "target",
          giverName: "Target Helper",
          at: NOW_MS - 1,
        },
      },
      completed: {},
    };

    const landmarks = liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state);
    assert.equal(landmarks.length, 2);
    assert.ok(landmarks.some((landmark) => landmark.id === marker!.id));
    assert.ok(
      landmarks.some(
        (landmark) =>
          landmark.id ===
          "live_entity_helper_return:live-helper:ready:food_water"
      )
    );

    const quests = liveEntityHelperTrackableQuestsForBiomesUI(state);
    assert.equal(
      quests.find((quest) => quest.questId === "live-helper:ready:food_water")
        ?.firstMarkerId,
      "live_entity_helper_return:live-helper:ready:food_water"
    );
    assert.equal(
      quests.find((quest) => quest.questId === "live-helper:target:food_water")
        ?.firstMarkerId,
      marker!.id
    );
  });

  it("deduplicates map markers when two helpers point at the same target", () => {
    const state: any = helperState();
    state.active["live-helper:another:food_water"] = {
      questId: "live-helper:another:food_water",
      kind: "food_water",
      entityId: "another",
      giverName: "Another Traveler",
      at: NOW_MS - 1,
    };

    assert.equal(
      liveEntityHelperAcceptedQuestLandmarksForBiomesUI(state).length,
      1
    );
    assert.equal(liveEntityHelperTrackableQuestsForBiomesUI(state).length, 2);
  });
});
