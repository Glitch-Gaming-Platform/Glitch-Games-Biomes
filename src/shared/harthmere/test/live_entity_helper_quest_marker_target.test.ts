// Backend/pure tests for the live-entity helper quest marker resolver: markers
// point at the real target while the objective is incomplete, and flip back to
// the quest giver once it's met (item collected / monster defeated).

import {
  LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS,
  liveEntityHelperQuestObjectiveMet,
  liveEntityHelperResolveQuestMarker,
  type LiveEntityHelperQuestKind,
} from "@/shared/harthmere/live_entity_helper_quests";
import assert from "assert";

const ALL_KINDS: LiveEntityHelperQuestKind[] = [
  "exotic_matter",
  "food_water",
  "hard_boss",
];

describe("live-entity helper quest marker target resolver", () => {
  it("points at the real target site for every kind while objective is incomplete", () => {
    for (const kind of ALL_KINDS) {
      const r = liveEntityHelperResolveQuestMarker({ kind });
      assert.strictEqual(r.phase, "target", `${kind} should target`);
      assert.deepStrictEqual(
        r.position,
        [...LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS[kind].position],
        `${kind} marker at its real target`
      );
    }
  });

  it("uses danger kind for the monster quest and resource for the others", () => {
    assert.strictEqual(
      liveEntityHelperResolveQuestMarker({ kind: "hard_boss" }).kind,
      "danger"
    );
    assert.strictEqual(
      liveEntityHelperResolveQuestMarker({ kind: "exotic_matter" }).kind,
      "resource"
    );
    assert.strictEqual(
      liveEntityHelperResolveQuestMarker({ kind: "food_water" }).kind,
      "resource"
    );
  });

  it("every target has a visible (finite, surface-level) Y coordinate", () => {
    for (const kind of ALL_KINDS) {
      const y = LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS[kind].position[1];
      assert.ok(Number.isFinite(y), `${kind} Y is finite`);
      assert.ok(y > 0 && y < 200, `${kind} Y (${y}) is a plausible surface Y`);
    }
  });

  it("flips to the giver position once the objective is met (readyToTurnIn)", () => {
    const giverPosition = [496, 70, -126] as const;
    const r = liveEntityHelperResolveQuestMarker({
      kind: "exotic_matter",
      readyToTurnIn: true,
      giverPosition,
      giverName: "Jackie",
    });
    assert.strictEqual(r.phase, "return_to_giver");
    assert.deepStrictEqual(r.position, [496, 70, -126]);
    assert.strictEqual(r.label, "Return to Jackie");
  });

  it("uses a generic label when ready but the giver has no name", () => {
    const r = liveEntityHelperResolveQuestMarker({
      kind: "hard_boss",
      readyToTurnIn: true,
      giverPosition: [1, 2, 3],
    });
    assert.strictEqual(r.phase, "return_to_giver");
    assert.strictEqual(r.label, "Return to quest giver");
    assert.strictEqual(r.kind, "danger");
  });

  it("falls back to the target when ready but the giver position is missing/invalid", () => {
    for (const giverPosition of [
      undefined,
      null,
      [1, 2] as any,
      [NaN, 2, 3] as any,
    ]) {
      const r = liveEntityHelperResolveQuestMarker({
        kind: "food_water",
        readyToTurnIn: true,
        giverPosition,
        giverName: "Mara",
      });
      assert.strictEqual(
        r.phase,
        "target",
        `invalid giver ${JSON.stringify(giverPosition)} falls back to target`
      );
    }
  });

  it("stays on target when not yet ready even with a known giver position", () => {
    const r = liveEntityHelperResolveQuestMarker({
      kind: "exotic_matter",
      readyToTurnIn: false,
      giverPosition: [496, 70, -126],
      giverName: "Jackie",
    });
    assert.strictEqual(r.phase, "target");
  });
});

describe("live-entity helper quest objective-met check", () => {
  it("food_water: met only when both required items are collected", () => {
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("food_water", { inventory: {} }),
      false
    );
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("food_water", {
        inventory: { road_ration: 3 },
      }),
      false,
      "missing clean_water"
    );
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("food_water", {
        inventory: { road_ration: 3, clean_water: 2 },
      }),
      true
    );
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("food_water", {
        inventory: { road_ration: 5, clean_water: 9 },
      }),
      true,
      "surplus still counts"
    );
  });

  it("exotic_matter: met only with enough raw_exotic_matter", () => {
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("exotic_matter", {
        inventory: { raw_exotic_matter: 1 },
      }),
      false
    );
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("exotic_matter", {
        inventory: { raw_exotic_matter: 2 },
      }),
      true
    );
  });

  it("hard_boss: met only once the boss defeat is recorded", () => {
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("hard_boss", { hardBossDefeats: 0 }),
      false
    );
    assert.strictEqual(
      liveEntityHelperQuestObjectiveMet("hard_boss", { hardBossDefeats: 1 }),
      true
    );
  });

  it("objective-met agrees with the marker resolver (target before, giver after)", () => {
    const giverPosition = [10, 64, 20] as const;
    const incompleteEvidence = { inventory: {} };
    const met = liveEntityHelperQuestObjectiveMet(
      "food_water",
      incompleteEvidence
    );
    const marker = liveEntityHelperResolveQuestMarker({
      kind: "food_water",
      readyToTurnIn: met,
      giverPosition,
    });
    assert.strictEqual(met, false);
    assert.strictEqual(marker.phase, "target");

    const completeEvidence = {
      inventory: { road_ration: 3, clean_water: 2 },
    };
    const met2 = liveEntityHelperQuestObjectiveMet(
      "food_water",
      completeEvidence
    );
    const marker2 = liveEntityHelperResolveQuestMarker({
      kind: "food_water",
      readyToTurnIn: met2,
      giverPosition,
    });
    assert.strictEqual(met2, true);
    assert.strictEqual(marker2.phase, "return_to_giver");
    assert.deepStrictEqual(marker2.position, [10, 64, 20]);
  });
});
