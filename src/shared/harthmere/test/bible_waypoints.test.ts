/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_WAYPOINTS
//
// 312 of 340 authored waypoints carry Y=0. This suite is the cheap tier that
// covers the expensive failure: TESTING_FASTER section 4.12 records that
// shipping an authored zero strands the player below terrain and turns the row
// into a three-minute browser movement timeout.

import assert from "assert";
import { BIBLE_QUEST_CATALOG, bibleQuest } from "../bible/bible_quest_catalog";
import {
  biblePlacementPurpose,
  bibleGroundedWorldWaypoint,
  bibleQuestWorldWaypoint,
  bibleQuestWorldWaypoints,
  bibleStepWorldWaypoint,
} from "../bible/bible_waypoints";
import {
  BIBLE_DRAGON_QUEST_ID,
  BIBLE_Q12_OBJECTIVE_IDS,
  bibleThaedrynArenaWorldAnchor,
  bibleThaedrynWaypointOverride,
} from "../bible/bible_thaedryn";
import { HARTHMERE_EXTENSION_FEET_Y } from "../world_extension";

describe("Bible waypoints — grounding", () => {
  it("confirms the authored data really is mostly Y=0", () => {
    // If this ever drops to zero the suite below stops proving anything, so
    // the premise is asserted rather than assumed.
    const zeroes = BIBLE_QUEST_CATALOG.flatMap((quest) => quest.steps).filter(
      (step) => step.authoredWaypoint[1] === 0
    );
    assert.equal(zeroes.length, 312);
  });

  it("never resolves a shipped waypoint to Y=0", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      for (const [index, position] of bibleQuestWorldWaypoints(
        quest
      ).entries()) {
        const label = index === 0 ? "marker" : quest.steps[index - 1].id;
        assert.notEqual(position[1], 0, `${quest.id}/${label}`);
        assert(
          Number.isFinite(position[0] + position[1] + position[2]),
          `${quest.id}/${label}: non-finite`
        );
      }
    }
  });

  it("keeps every resolved height inside plausible world bounds", () => {
    // Catches a stale placement record from the retired +512 town terrain,
    // which would resolve to a height no terrain occupies.
    for (const quest of BIBLE_QUEST_CATALOG) {
      for (const position of bibleQuestWorldWaypoints(quest)) {
        assert(
          position[1] > -128 && position[1] < 256,
          `${quest.id}: implausible height ${position[1]}`
        );
      }
    }
  });

  it("places surface quests at the additive terrain feet height", () => {
    // The overwhelming majority of the catalog is above ground. Underground
    // arcs are the deliberate exception, asserted separately below.
    const surface = BIBLE_QUEST_CATALOG.filter(
      (quest) =>
        bibleQuestWorldWaypoint(quest)[1] === HARTHMERE_EXTENSION_FEET_Y
    );
    assert(
      surface.length > BIBLE_QUEST_CATALOG.length * 0.9,
      `only ${surface.length} of ${BIBLE_QUEST_CATALOG.length} quests are on ` +
        `the surface — a placement regression is likely`
    );
  });

  it("descends monotonically through the underground main arc", () => {
    // Q6 -> Q7 -> Q8 go deeper into the Bellward Halls. A depth that stops
    // descending usually means a placement record was lost and the quest
    // silently returned to the surface.
    const depths = [
      "bellbound_q06_hidden_door",
      "bellbound_q07_bellward_halls",
      "bellbound_q08_voices_in_stone",
    ].map((questId) => bibleQuestWorldWaypoint(bibleQuest(questId)!)[1]);
    for (const depth of depths)
      assert(depth < 0, `expected underground: ${depth}`);
    for (let index = 1; index < depths.length; index += 1) {
      assert(
        depths[index] < depths[index - 1],
        `depth did not descend: ${depths.join(" -> ")}`
      );
    }
  });
});

describe("Bible waypoints — Thaedryn arena", () => {
  // The authored catalog gave THREE different Wyrm's Bed locations and no test
  // caught it, because each was only ever checked against its own file.
  it("routes every Q12 objective to the one canonical anchor", () => {
    const quest = bibleQuest(BIBLE_DRAGON_QUEST_ID)!;
    const anchor = bibleThaedrynArenaWorldAnchor();
    for (const step of quest.steps) {
      assert.deepEqual(
        bibleStepWorldWaypoint(quest, step),
        anchor,
        `${step.id} does not resolve to the arena anchor — this is what ` +
          `produces player_too_far for someone standing at the dragon`
      );
    }
    assert.deepEqual(bibleQuestWorldWaypoint(quest), anchor);
  });

  it("puts the anchor on walkable ground, not at Y=0", () => {
    const anchor = bibleThaedrynArenaWorldAnchor();
    assert.notEqual(anchor[1], 0, "a Y=0 anchor soft-locks the encounter");
    assert.equal(anchor[1], HARTHMERE_EXTENSION_FEET_Y);
  });

  it("overrides only the four authored Q12 objectives", () => {
    for (const stepId of Object.values(BIBLE_Q12_OBJECTIVE_IDS)) {
      assert(bibleThaedrynWaypointOverride(BIBLE_DRAGON_QUEST_ID, stepId));
    }
    assert.equal(
      bibleThaedrynWaypointOverride(BIBLE_DRAGON_QUEST_ID, "not_an_objective"),
      undefined
    );
    assert.equal(
      bibleThaedrynWaypointOverride("bellbound_q01_cracks_in_bridge", "x"),
      undefined
    );
  });

  it("names the four objectives the catalog actually authored", () => {
    const quest = bibleQuest(BIBLE_DRAGON_QUEST_ID)!;
    assert.deepEqual(
      quest.steps.map((step) => step.id).sort(),
      Object.values(BIBLE_Q12_OBJECTIVE_IDS).sort()
    );
  });
});

describe("Bible waypoints — placement purpose", () => {
  it("maps every step type to a placement purpose", () => {
    assert.equal(biblePlacementPurpose("talk"), "npc");
    assert.equal(biblePlacementPurpose("combat"), "monster");
    assert.equal(biblePlacementPurpose("inspect"), "interactable");
    assert.equal(biblePlacementPurpose("choice"), "interactable");
  });

  it("grounds a raw Y=0 input directly", () => {
    const grounded = bibleGroundedWorldWaypoint({
      questId: "bellbound_q01_cracks_in_bridge",
      authored: [476, 0, -212],
      purpose: "quest_marker",
    });
    assert.notEqual(grounded[1], 0);
  });
});
