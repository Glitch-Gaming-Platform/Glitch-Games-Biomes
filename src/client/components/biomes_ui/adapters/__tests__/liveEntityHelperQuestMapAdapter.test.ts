/// <reference types="mocha" />

import assert from "assert";
import {
  activeLiveEntityHelperMissionStepsForBiomesUIV1,
  liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1,
  liveEntityHelperTrackableQuestsForBiomesUIV1,
} from "../liveEntityHelperQuestMapAdapter";
import {
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1,
  liveEntityHelperQuestTargetMarkerForKindV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";

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
    const marker = liveEntityHelperQuestTargetMarkerForKindV1("food_water");
    assert.ok(marker, "fixture marker should resolve");

    const landmarks =
      liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1(state);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, marker!.id);
    assert.equal(landmarks[0].active, true);
    assert.equal(landmarks[0].visibleOnWorldMap, true);
    assert.deepEqual(landmarks[0].position, marker!.position);
    assert.equal(
      landmarks[0].description,
      LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1.food_water.activeText
    );

    const quests = liveEntityHelperTrackableQuestsForBiomesUIV1(state);
    assert.deepEqual(quests, [
      {
        questId: "live-helper:boba:food_water",
        title: "Remote Biome Supply Drop",
        area: "Boba :) - River Docks",
        status: "active",
        firstMarkerId: marker!.id,
        reward: "90 XP, 2 Minor Healing Salves, 1 Black Anvil Repair Voucher",
      },
    ]);

    const steps = activeLiveEntityHelperMissionStepsForBiomesUIV1(state);
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
      liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1(state).length,
      0
    );
    assert.equal(
      activeLiveEntityHelperMissionStepsForBiomesUIV1(state).length,
      0
    );
    const quests = liveEntityHelperTrackableQuestsForBiomesUIV1(state);
    assert.equal(quests.length, 1);
    assert.equal(quests[0].status, "completed");
    assert.equal(quests[0].firstMarkerId, undefined);
    assert.ok(quests[0].reward?.includes("Stabilized Exotic Matter"));
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
      liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1(state).length,
      1
    );
    assert.equal(liveEntityHelperTrackableQuestsForBiomesUIV1(state).length, 2);
  });
});
