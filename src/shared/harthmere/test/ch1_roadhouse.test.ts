/// <reference types="mocha" />
//
// CHAPTER_1_ROADHOUSE
//
// The Grove road-house, watch-house, and their physical props.
//
// WHY THIS EXISTS
// Act 1 was authored as a domestic scene — wake up, eat what Jackie put in front
// of you, drink the tea, let her look through your pack — and none of those
// objects existed. Every one aliased to `jackie_post`, which is the town fountain
// centre, and "Tea" additionally collided with "Teague Teak Morrow" in the cast
// resolver and pointed 137 metres away at a detained courier in a muck drain.
//
// These assertions pin the three properties that made that possible:
//   1. the road-house site is clear of existing Grove landmarks,
//   2. every prop uses the full 3D floor anchor assigned to its room,
//   3. the Act 1 interior beats resolve INTO the road-house and not to the plaza.

import assert from "assert";
import { CH1_ANCHORS, type Ch1Vec3 } from "@/shared/harthmere/ch1_ids";
import {
  CH1_PROPS,
  ch1ChapterOpeningPosition,
} from "@/shared/harthmere/ch1_prop_seed";
import { CH1_MAP_LANDMARKS } from "@/shared/harthmere/ch1_map_landmarks";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";

const ROADHOUSE_ANCHORS: Array<[string, Ch1Vec3]> = [
  ["roadhouse_door", CH1_ANCHORS.roadhouse_door],
  ["roadhouse_sign", CH1_ANCHORS.roadhouse_sign],
  ["roadhouse_table", CH1_ANCHORS.roadhouse_table],
  ["roadhouse_jackie_post", CH1_ANCHORS.roadhouse_jackie_post],
  ["roadhouse_hearth", CH1_ANCHORS.roadhouse_hearth],
  ["roadhouse_bed", CH1_ANCHORS.roadhouse_bed],
  ["roadhouse_stores", CH1_ANCHORS.roadhouse_stores],
  ["coretta_ledger_desk", CH1_ANCHORS.coretta_ledger_desk],
];

function occupiedGroveColumns(): Map<string, string> {
  const taken = new Map<string, string>();
  for (const landmark of SNAPSHOT_GROVE_LANDMARKS) {
    const position = groveLandmarkWorldPosition(landmark);
    taken.set(
      `${Math.round(position[0])}:${Math.round(position[2])}`,
      landmark.label
    );
  }
  return taken;
}

describe("chapter 1 road-house", () => {
  it("sites every road-house column clear of existing Grove content", () => {
    const taken = occupiedGroveColumns();
    const errors: string[] = [];
    for (const [key, anchor] of ROADHOUSE_ANCHORS) {
      // One-block cordon: a prop must not be placed against an existing marker
      // either, or the F-interaction dispatcher has two candidates in range.
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const hit = taken.get(`${anchor[0] + dx}:${anchor[2] + dz}`);
          if (hit) {
            if (
              key === "roadhouse_jackie_post" &&
              hit === "Jackie" &&
              dx === 0 &&
              dz === 0
            ) {
              // This is the one canonical Snapshot Grove Jackie body, now
              // deliberately moved to the Chapter 1 road-house post.
              continue;
            }
            errors.push(`${key} is within one block of "${hit}"`);
          }
        }
      }
    }
    assert.deepEqual(errors, []);
  });

  it("keeps the road-house one walkable cluster", () => {
    // If the beats are scattered the scene stops reading as one room. Every
    // anchor must be within a short walk of the front door.
    const door = CH1_ANCHORS.roadhouse_door;
    for (const [key, anchor] of ROADHOUSE_ANCHORS) {
      const distance = Math.hypot(anchor[0] - door[0], anchor[2] - door[2]);
      assert.ok(
        distance <= 14,
        `${key} is ${distance.toFixed(1)}m from the road-house door`
      );
    }
  });

  it("places every prop at its authored room anchor", () => {
    const anchorByProp: Record<string, keyof typeof CH1_ANCHORS> = {
      roadhouse_sign: "roadhouse_sign",
      roadhouse_hearth: "roadhouse_hearth",
      roadhouse_table: "roadhouse_table",
      roadhouse_bed: "roadhouse_bed",
      roadhouse_stores: "roadhouse_stores",
      coretta_ledger_desk: "coretta_ledger_desk",
      grove_watch_house_post: "grove_watch_house_door",
    };
    for (const prop of CH1_PROPS) {
      const expected = CH1_ANCHORS[anchorByProp[prop.key]];
      assert.deepEqual(
        prop.position,
        expected,
        `${prop.key} drifted from its room`
      );
    }
    assert.equal(CH1_ANCHORS.roadhouse_bed[1], 74);
    assert.equal(CH1_ANCHORS.roadhouse_table[1], 70);
  });

  it("gives every prop a distinct id, column and player-facing label", () => {
    const ids = new Set(CH1_PROPS.map((prop) => String(prop.entityId)));
    assert.equal(ids.size, CH1_PROPS.length, "duplicate prop entity id");
    const columns = new Set(
      CH1_PROPS.map((prop) => `${prop.position[0]}:${prop.position[2]}`)
    );
    assert.equal(columns.size, CH1_PROPS.length, "two props share a column");
    for (const prop of CH1_PROPS) {
      assert.ok(prop.label.trim().length > 0, `${prop.key} needs a label`);
      assert.ok(
        !/^item_|_container$|^wood /i.test(prop.label),
        `${prop.key} label "${prop.label}" looks like an internal id`
      );
    }
  });

  it("keeps the Road-House sign outside the walkable entrance aperture", () => {
    const sign = CH1_PROPS.find((prop) => prop.key === "roadhouse_sign");
    assert.ok(sign);
    const [doorX, doorY, doorZ] = CH1_ANCHORS.roadhouse_door;
    assert.notDeepEqual(sign.position, CH1_ANCHORS.roadhouse_door);
    assert.ok(
      Math.hypot(sign.position[0] - doorX, sign.position[2] - doorZ) >= 2,
      "the sign must leave a full player-width approach beside the doorway"
    );
    assert.equal(sign.position[1], doorY);
  });

  it("separates Jackie and Coretta so their F prompts cannot compete", () => {
    const jackie = CH1_ANCHORS.roadhouse_jackie_post;
    const coretta = CH1_ANCHORS.coretta_ledger_desk;
    assert.ok(
      Math.hypot(jackie[0] - coretta[0], jackie[2] - coretta[2]) >= 6,
      "Jackie and Coretta need distinct interaction zones"
    );
    assert.ok(jackie[0] > CH1_ANCHORS.roadhouse_table[0]);
    assert.ok(coretta[0] < CH1_ANCHORS.roadhouse_table[0]);
    assert.deepEqual(CH1_ANCHORS.testimony_coretta, coretta);
  });

  it("resolves the Act 1 interior beats into the road-house", () => {
    const cases: Array<[string, string, Ch1Vec3]> = [
      ["ch1_a1_q01_morning_after", "wake_up", CH1_ANCHORS.roadhouse_bed],
      ["ch1_a1_q01_morning_after", "the_tea", CH1_ANCHORS.roadhouse_table],
      ["ch1_a4_q04_what_is_in_the_tea", "notice", CH1_ANCHORS.roadhouse_hearth],
      [
        "ch1_a4_q04_what_is_in_the_tea",
        "search_the_stores",
        CH1_ANCHORS.roadhouse_stores,
      ],
      [
        "ch1_a4_q07_ask_me_in_a_month",
        "sleep_alone",
        CH1_ANCHORS.roadhouse_bed,
      ],
      [
        "ch1_a5_q01_the_ledger_goes_quiet",
        "resume_dosing",
        CH1_ANCHORS.roadhouse_stores,
      ],
      [
        "ch1_a5_q01_the_ledger_goes_quiet",
        "check_corettas_ledger",
        CH1_ANCHORS.coretta_ledger_desk,
      ],
    ];
    for (const [questId, stepId, expected] of cases) {
      const target = ch1ObjectiveTarget(questId, stepId);
      assert.ok(target, `${questId}/${stepId} has no target`);
      assert.deepEqual(
        [...target.position],
        [...expected],
        `${questId}/${stepId} should resolve into the road-house cluster`
      );
    }
  });

  it("never resolves the tea to a cast member", () => {
    // The exact regression: normalized("Tea") is a substring of
    // normalized('Teague "Teak" Morrow').
    const tea = ch1ObjectiveTarget("ch1_a1_q01_morning_after", "the_tea")!;
    assert.notEqual(tea.source, "npc");
    assert.equal(tea.entityId, undefined);
  });

  it("pins every road-house and Chapter 1 location on the world map", () => {
    const pinned = new Set(CH1_MAP_LANDMARKS.map((landmark) => landmark.label));
    for (const label of [
      "Grove Road-House",
      "Grove Watch House",
      "Greenlamp Walk-In Clinic",
      "Ashline Containment Works",
      "The Old Wood Aperture",
      "The Cold Gate",
    ]) {
      assert.ok(pinned.has(label), `${label} is missing from the world map`);
    }
    // Spoiler discipline: the Act 6 epilogue aperture must not be named early.
    for (const landmark of CH1_MAP_LANDMARKS) {
      assert.notEqual(
        `${landmark.position[0]}:${landmark.position[2]}`,
        `${CH1_ANCHORS.gate_prime[0]}:${CH1_ANCHORS.gate_prime[2]}`,
        "gate_prime must not be pinned before Act 6"
      );
    }
  });

  it("opens the chapter beside the upstairs cot", () => {
    const opening = ch1ChapterOpeningPosition();
    assert.equal(opening[1], CH1_ANCHORS.roadhouse_bed[1]);
    assert.ok(
      Math.hypot(
        opening[0] - CH1_ANCHORS.roadhouse_bed[0],
        opening[2] - CH1_ANCHORS.roadhouse_bed[2]
      ) <= 3
    );
    assert.notDeepEqual(opening, CH1_ANCHORS.roadhouse_bed);
  });
});
