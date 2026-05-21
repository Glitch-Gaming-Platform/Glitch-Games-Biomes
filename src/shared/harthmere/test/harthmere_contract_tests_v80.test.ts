// HARTHMERE_AND_GROVE_CONTRACT_TESTS_V80
//
// One concentrated test file that locks in the positioning/layout/mission
// contracts described in the design bibles. These run under the existing
// mocha-style harness (see `.mocharc.json`).
//
// Coverage summary:
//   - Grove NPC positions, no-clustering, in-bounds, and v78 floater grounding
//   - Harthmere connected-world bounds (same ground Y as Grove)
//   - Harthmere district layout (no overlaps, anchors in bounds, etc)
//   - Every named NPC has a home and walks to it daily
//   - Every NPC residence in the bible layout points at a real NPC
//   - Mission chain has no cycles, all prerequisites resolve, every giver
//     resolves to a known NPC, every quest grants something
//
// If any of these fail, the failure message tells the developer exactly
// what data is wrong and why.

import assert from "assert";

import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_NPC_FEET_Y_V75,
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_WORLD_GROUND_Y_V75,
  snapshotGroveMarkerPositionV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import {
  SNAPSHOT_GROVE_LIVE_BOUNDS_V78,
  SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78,
  SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y_V78,
  snapshotGroundLiveNpcPositionV78,
  snapshotIsLiveFloatingGroveNpcCandidateV78,
  snapshotPointInBoundsV78,
} from "@/shared/harthmere/snapshot_live_debug_v78";
import {
  HARTHMERE_BIBLE_DISTRICTS_V80,
  HARTHMERE_BIBLE_NPC_RESIDENCES_V80,
  HARTHMERE_LAYOUT_GROUND_Y_V80,
  HARTHMERE_TOWN_LAYOUT_BOUNDS_V80,
  validateHarthmereLayoutV80,
} from "@/shared/harthmere/harthmere_district_bible_layout_v80";
import {
  harthmereNamedNpcIdsV80,
  validateHarthmereNpcResidencesV80,
} from "@/shared/harthmere/harthmere_npc_residence_contract_v80";
import {
  buildHarthmereQuestChainV80,
  nextSuggestedHarthmereQuestV80,
  validateHarthmereQuestChainV80,
} from "@/shared/harthmere/harthmere_quest_chain_validator_v80";

describe("Grove NPC positions (snapshot_grove_content_v75)", () => {
  it("every Grove NPC has feet at the canonical ground Y", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
      assert.strictEqual(
        npc.authoredPosition[1],
        SNAPSHOT_GROVE_NPC_FEET_Y_V75,
        `${npc.displayName} (${npc.id}) is off-ground at y=${npc.authoredPosition[1]} (expected ${SNAPSHOT_GROVE_NPC_FEET_Y_V75}). ` +
          `Authoring this above ground bakes a floating NPC into the snapshot.`,
      );
    }
  });

  it("every Grove NPC sits inside the Grove or Harthmere live bounds", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
      const inGrove = snapshotPointInBoundsV78(
        npc.authoredPosition,
        SNAPSHOT_GROVE_LIVE_BOUNDS_V78,
      );
      const inHarthmere = snapshotPointInBoundsV78(
        npc.authoredPosition,
        SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78,
      );
      assert.ok(
        inGrove || inHarthmere,
        `${npc.displayName} (${npc.id}) at ${JSON.stringify(npc.authoredPosition)} is in neither Grove nor Harthmere bounds`,
      );
    }
  });

  it("no two Grove NPCs share the same authored XZ", () => {
    const seen = new Map<string, string>();
    for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
      const key = `${npc.authoredPosition[0]},${npc.authoredPosition[2]}`;
      const prior = seen.get(key);
      assert.ok(
        !prior,
        `${npc.displayName} and ${prior} share authored XZ ${key} — players see them spawned on top of each other`,
      );
      seen.set(key, npc.displayName);
    }
  });

  it("Grove NPC markers sit above ground (HUD chevrons don't clip into terrain)", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
      const marker = snapshotGroveMarkerPositionV75(npc.authoredPosition);
      assert.ok(
        marker[1] > SNAPSHOT_GROVE_WORLD_GROUND_Y_V75,
        `Marker for ${npc.displayName} at y=${marker[1]} is at or below ground ${SNAPSHOT_GROVE_WORLD_GROUND_Y_V75}`,
      );
    }
  });

  it("Grove landmarks referencing NPCs point at real Grove NPCs", () => {
    const npcIds = new Set(SNAPSHOT_GROVE_NPCS_V75.map((npc) => npc.id));
    for (const landmark of SNAPSHOT_GROVE_LANDMARKS_V75) {
      if (!landmark.npcId) continue;
      if (landmark.area === "harthmere") continue;
      assert.ok(
        npcIds.has(landmark.npcId),
        `Landmark ${landmark.id} references missing Grove NPC '${landmark.npcId}'`,
      );
    }
  });
});

describe("Snapshot v78 live NPC grounding", () => {
  const groveCenter: [number, number, number] = [
    Math.round(
      (SNAPSHOT_GROVE_LIVE_BOUNDS_V78.min[0] +
        SNAPSHOT_GROVE_LIVE_BOUNDS_V78.max[0]) /
        2,
    ),
    SNAPSHOT_GROVE_NPC_FEET_Y_V75,
    Math.round(
      (SNAPSHOT_GROVE_LIVE_BOUNDS_V78.min[2] +
        SNAPSHOT_GROVE_LIVE_BOUNDS_V78.max[2]) /
        2,
    ),
  ];

  it("snaps a floating snapshot label down to canonical feet Y", () => {
    const floating: [number, number, number] = [
      groveCenter[0],
      SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y_V78 + 5,
      groveCenter[2],
    ];
    const grounded = snapshotGroundLiveNpcPositionV78(floating, "Allix");
    assert.strictEqual(grounded[0], floating[0]);
    assert.strictEqual(grounded[2], floating[2]);
    assert.strictEqual(grounded[1], SNAPSHOT_GROVE_NPC_FEET_Y_V75);
  });

  it("does not touch a Grove bible NPC even if floater-name-matched", () => {
    const candidate = snapshotIsLiveFloatingGroveNpcCandidateV78({
      label: "Jackie",
      position: groveCenter,
    });
    assert.strictEqual(candidate, false);
  });

  it("does not snap NPCs outside the Grove bounds (no silent teleport)", () => {
    const outside: [number, number, number] = [
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.max[0] + 50,
      120,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.max[2] + 50,
    ];
    const candidate = snapshotIsLiveFloatingGroveNpcCandidateV78({
      label: "Allix",
      position: outside,
    });
    assert.strictEqual(candidate, false);
  });
});

describe("Harthmere connected-world bounds", () => {
  it("Harthmere shares the same ground Y as the Grove (no Y-discontinuity)", () => {
    assert.strictEqual(
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.expectedFeetY,
      SNAPSHOT_GROVE_LIVE_BOUNDS_V78.expectedFeetY,
    );
    assert.strictEqual(
      HARTHMERE_LAYOUT_GROUND_Y_V80,
      SNAPSHOT_GROVE_WORLD_GROUND_Y_V75,
    );
  });

  it("v80 layout bounds match v78 live bounds (single source of truth)", () => {
    assert.strictEqual(HARTHMERE_TOWN_LAYOUT_BOUNDS_V80.minX, SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.min[0]);
    assert.strictEqual(HARTHMERE_TOWN_LAYOUT_BOUNDS_V80.maxX, SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.max[0]);
    assert.strictEqual(HARTHMERE_TOWN_LAYOUT_BOUNDS_V80.minZ, SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.min[2]);
    assert.strictEqual(HARTHMERE_TOWN_LAYOUT_BOUNDS_V80.maxZ, SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78.max[2]);
  });

  it("Grove publishes a connector landmark that's reachable from the east edge", () => {
    const connector = SNAPSHOT_GROVE_LANDMARKS_V75.find(
      (landmark) => landmark.id === "harthmere_connector",
    );
    assert.ok(connector, "Grove must publish a harthmere_connector landmark");
    assert.ok(
      connector.position[0] >= SNAPSHOT_GROVE_LIVE_BOUNDS_V78.min[0] &&
        connector.position[0] <= SNAPSHOT_GROVE_LIVE_BOUNDS_V78.max[0] + 200,
      `Connector at x=${connector.position[0]} is too far from the Grove east edge`,
    );
  });
});

describe("Harthmere bible district layout v80", () => {
  it("layout validator passes (no overlaps, no escaping bounds, no id collisions)", () => {
    const result = validateHarthmereLayoutV80();
    assert.ok(result.ok, `layout invalid:\n${result.failures.join("\n")}`);
  });

  it("every district has at least one landmark", () => {
    for (const d of HARTHMERE_BIBLE_DISTRICTS_V80) {
      assert.ok(
        d.landmarks.length > 0,
        `district '${d.id}' has no landmarks — map will have no anchor here`,
      );
    }
  });

  it("the bible's nine canonical districts are all present", () => {
    const required = [
      "north_gate",
      "market_square",
      "player_services",
      "copper_kettle",
      "craftsman_row",
      "temple_green",
      "noble_rise",
      "river_docks",
      "mudden_ward",
      "old_well_underways",
    ] as const;
    const ids = new Set(HARTHMERE_BIBLE_DISTRICTS_V80.map((d) => d.id));
    for (const r of required) {
      assert.ok(ids.has(r), `bible district missing from layout: ${r}`);
    }
  });

  it("residential district exists for NPC housing overflow (bible §8.1)", () => {
    const residential = HARTHMERE_BIBLE_DISTRICTS_V80.find(
      (d) => d.id === "residential",
    );
    assert.ok(residential, "residential district must exist for ambient population");
  });
});

describe("Harthmere NPC residence contract v80", () => {
  it("every named NPC has a home, goesHomeDaily, and a home schedule entry", () => {
    const result = validateHarthmereNpcResidencesV80();
    assert.ok(
      result.ok,
      `NPC residence contract violated:\n${result.failures.slice(0, 25).join("\n")}` +
        (result.failures.length > 25 ? `\n... and ${result.failures.length - 25} more` : ""),
    );
  });

  it("every bible residence row references a real NPC", () => {
    const knownNpcIds = harthmereNamedNpcIdsV80();
    for (const r of HARTHMERE_BIBLE_NPC_RESIDENCES_V80) {
      assert.ok(
        knownNpcIds.has(r.npcId),
        `bible residence references unknown NPC '${r.npcId}'`,
      );
    }
  });
});

describe("Harthmere mission chain validator v80", () => {
  it("catalog itself passes the existing v46 validator", () => {
    const result = validateHarthmereQuestChainV80({
      knownNpcIds: harthmereNamedNpcIdsV80(),
    });
    assert.ok(
      result.ok,
      `quest chain failures (${result.failures.length}):\n` +
        result.failures.slice(0, 25).join("\n") +
        (result.failures.length > 25 ? `\n... and ${result.failures.length - 25} more` : ""),
    );
  });

  it("main chain Q1 → Q12 is connected by prerequisites with no cycles", () => {
    const chain = buildHarthmereQuestChainV80();
    assert.ok(
      chain.mainChain.length >= 12,
      `expected at least 12 main bible quests; got ${chain.mainChain.length}`,
    );
    // The chain construction algorithm refuses to add edges for missing
    // prereqs and would push a warning. Surface them.
    assert.deepStrictEqual(chain.warnings, [], `chain warnings: ${chain.warnings.join(", ")}`);
  });

  it("nextSuggestedHarthmereQuestV80 picks Q1 for a fresh player", () => {
    const suggestion = nextSuggestedHarthmereQuestV80({
      completedQuestIds: new Set<string>(),
      activeQuestIds: new Set<string>(),
    });
    assert.ok(suggestion, "must suggest something for a fresh player");
    assert.strictEqual(suggestion.reason, "next_main_chain");
    const chain = buildHarthmereQuestChainV80();
    assert.strictEqual(
      suggestion.questId,
      chain.mainChain[0],
      "first suggestion should be the head of the main bible chain",
    );
  });

  it("nextSuggestedHarthmereQuestV80 advances after a main quest is completed", () => {
    const chain = buildHarthmereQuestChainV80();
    const completed = new Set<string>([chain.mainChain[0]]);
    const suggestion = nextSuggestedHarthmereQuestV80({
      completedQuestIds: completed,
      activeQuestIds: new Set<string>(),
    });
    assert.ok(suggestion);
    // Either the next main chain quest, or — if Q2 has Q2.5 as a side
    // branch with the same prereqs — a side suggestion is acceptable as
    // long as we are still moving forward.
    assert.notStrictEqual(suggestion.questId, chain.mainChain[0]);
  });
});
