// HARTHMERE_AND_GROVE_CONTRACT_TESTS
//
// One concentrated test file that locks in the positioning/layout/mission
// contracts described in the design bibles. These run under the existing
// mocha-style harness (see `.mocharc.json`).
//
// Coverage summary:
//   - Grove NPC positions, no-clustering, in-bounds, and current floater grounding
//   - Harthmere connected-world bounds (same ground Y as Grove)
//   - Harthmere district layout (no overlaps, anchors in bounds, etc)
//   - Every named NPC has a home and walks to it daily
//   - Every NPC residence in the bible layout points at a real NPC
//   - Mission chain has no cycles, all prerequisites resolve, every giver
//     resolves to a known NPC, every quest grants something
//   - The current resolver returns the right Y for each terrain mode (patch 05)
//
// Authored vs runtime Y convention
// --------------------------------
// SNAPSHOT_GROVE_WORLD_GROUND_Y (=52) is the AUTHORED bible value.
// SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y (=69) is what the production
// snapshot terrain actually loads. Both exist on purpose: authored data
// (NPC positions in source) is checked against _; runtime grounding
// (where the NPC actually stands at play time) uses _. The resolver
// (resolveSnapshotGroveGroundY) is the single source of truth for
// "which Y am I supposed to use right now?" — see
// README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md for the full positioning rules.
//
// If any of these fail, the failure message tells the developer exactly
// what data is wrong and why.

import assert from "assert";

import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_WORLD_GROUND_Y,
  snapshotGroveMarkerPosition,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_LIVE_BOUNDS,
  SNAPSHOT_HARTHMERE_LIVE_BOUNDS,
  SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y,
  snapshotGroundLiveNpcPosition,
  snapshotIsLiveFloatingGroveNpcCandidate,
  snapshotPointInBounds,
} from "@/shared/harthmere/snapshot_live_debug";
import {
  HARTHMERE_BIBLE_DISTRICTS,
  HARTHMERE_BIBLE_NPC_RESIDENCES,
  HARTHMERE_LAYOUT_GROUND_Y,
  HARTHMERE_TOWN_LAYOUT_BOUNDS,
  validateHarthmereLayout,
} from "@/shared/harthmere/harthmere_district_bible_layout";
import {
  harthmereNamedNpcIds,
  validateHarthmereNpcResidences,
} from "@/shared/harthmere/harthmere_npc_residence_contract";
import {
  buildHarthmereQuestChain,
  nextSuggestedHarthmereQuest,
  validateHarthmereQuestChain,
} from "@/shared/harthmere/harthmere_quest_chain_validator";
import {
  resolveSnapshotGroveGroundY,
  resolveSnapshotGroveTerrainMode,
} from "@/shared/harthmere/snapshot_backend_resolver";
import { HARTHMERE_EXTENSION_ROAD } from "@/shared/harthmere/world_extension";

describe("Grove NPC positions (snapshot_grove_content)", () => {
  it("every Grove NPC has feet at the canonical ground Y", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      assert.strictEqual(
        npc.authoredPosition[1],
        SNAPSHOT_GROVE_NPC_FEET_Y,
        `${npc.displayName} (${npc.id}) is off-ground at y=${npc.authoredPosition[1]} (expected ${SNAPSHOT_GROVE_NPC_FEET_Y}). ` +
          `Authoring this above ground bakes a floating NPC into the snapshot.`
      );
    }
  });

  it("every Grove NPC sits inside the Grove or Harthmere live bounds", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      const inGrove = snapshotPointInBounds(
        npc.authoredPosition,
        SNAPSHOT_GROVE_LIVE_BOUNDS
      );
      const inHarthmere = snapshotPointInBounds(
        npc.authoredPosition,
        SNAPSHOT_HARTHMERE_LIVE_BOUNDS
      );
      assert.ok(
        inGrove || inHarthmere,
        `${npc.displayName} (${npc.id}) at ${JSON.stringify(
          npc.authoredPosition
        )} is in neither Grove nor Harthmere bounds`
      );
    }
  });

  it("no two Grove NPCs share the same authored XZ", () => {
    const seen = new Map<string, string>();
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      const key = `${npc.authoredPosition[0]},${npc.authoredPosition[2]}`;
      const prior = seen.get(key);
      assert.ok(
        !prior,
        `${npc.displayName} and ${prior} share authored XZ ${key} — players see them spawned on top of each other`
      );
      seen.set(key, npc.displayName);
    }
  });

  it("Grove NPC markers sit above ground (HUD chevrons don't clip into terrain)", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      const marker = snapshotGroveMarkerPosition(npc.authoredPosition);
      assert.ok(
        marker[1] > SNAPSHOT_GROVE_WORLD_GROUND_Y,
        `Marker for ${npc.displayName} at y=${marker[1]} is at or below ground ${SNAPSHOT_GROVE_WORLD_GROUND_Y}`
      );
    }
  });

  it("Grove landmarks referencing NPCs point at real Grove NPCs", () => {
    const npcIds = new Set(SNAPSHOT_GROVE_NPCS.map((npc) => npc.id));
    for (const landmark of SNAPSHOT_GROVE_LANDMARKS) {
      if (!landmark.npcId) continue;
      if (landmark.area === "harthmere") continue;
      assert.ok(
        npcIds.has(landmark.npcId),
        `Landmark ${landmark.id} references missing Grove NPC '${landmark.npcId}'`
      );
    }
  });
});

describe("Snapshot current live NPC grounding", () => {
  const groveCenter: [number, number, number] = [
    Math.round(
      (SNAPSHOT_GROVE_LIVE_BOUNDS.min[0] + SNAPSHOT_GROVE_LIVE_BOUNDS.max[0]) /
        2
    ),
    SNAPSHOT_GROVE_NPC_FEET_Y,
    Math.round(
      (SNAPSHOT_GROVE_LIVE_BOUNDS.min[2] + SNAPSHOT_GROVE_LIVE_BOUNDS.max[2]) /
        2
    ),
  ];

  it("snaps a floating snapshot label down to canonical feet Y", () => {
    const floating: [number, number, number] = [
      groveCenter[0],
      SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y + 5,
      groveCenter[2],
    ];
    const grounded = snapshotGroundLiveNpcPosition(floating, "Allix");
    assert.strictEqual(grounded[0], floating[0]);
    assert.strictEqual(grounded[2], floating[2]);
    assert.strictEqual(
      grounded[1],
      SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
      "snapshotGroundLiveNpcPosition grounds to the LIVE feet Y (current=70), " +
        "not the authored current value — see README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md"
    );
  });

  it("does not touch a Grove bible NPC even if floater-name-matched", () => {
    const candidate = snapshotIsLiveFloatingGroveNpcCandidate({
      label: "Jackie",
      position: groveCenter,
    });
    assert.strictEqual(candidate, false);
  });

  it("does not snap NPCs outside the Grove bounds (no silent teleport)", () => {
    const outside: [number, number, number] = [
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.max[0] + 50,
      120,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.max[2] + 50,
    ];
    const candidate = snapshotIsLiveFloatingGroveNpcCandidate({
      label: "Allix",
      position: outside,
    });
    assert.strictEqual(candidate, false);
  });
});

describe("Harthmere connected-world bounds", () => {
  it("Harthmere shares the same ground Y as the Grove (no Y-discontinuity)", () => {
    assert.strictEqual(
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.expectedFeetY,
      SNAPSHOT_GROVE_LIVE_BOUNDS.expectedFeetY
    );
    assert.strictEqual(
      HARTHMERE_LAYOUT_GROUND_Y,
      SNAPSHOT_GROVE_WORLD_GROUND_Y
    );
  });

  it("current layout bounds match current live bounds (single source of truth)", () => {
    assert.strictEqual(
      HARTHMERE_TOWN_LAYOUT_BOUNDS.minX,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.min[0]
    );
    assert.strictEqual(
      HARTHMERE_TOWN_LAYOUT_BOUNDS.maxX,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.max[0]
    );
    assert.strictEqual(
      HARTHMERE_TOWN_LAYOUT_BOUNDS.minZ,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.min[2]
    );
    assert.strictEqual(
      HARTHMERE_TOWN_LAYOUT_BOUNDS.maxZ,
      SNAPSHOT_HARTHMERE_LIVE_BOUNDS.max[2]
    );
  });

  it("publishes the connector at the additive map-boundary road start", () => {
    const connector = SNAPSHOT_GROVE_LANDMARKS.find(
      (landmark) => landmark.id === "harthmere_connector"
    );
    assert.ok(connector, "Grove must publish a harthmere_connector landmark");
    assert.deepEqual(
      [connector.position[0], connector.position[2]],
      HARTHMERE_EXTENSION_ROAD.worldStart,
      "connector marker must match the first generated extension road block"
    );
  });
});

describe("Harthmere bible district layout current", () => {
  it("layout validator passes (no overlaps, no escaping bounds, no id collisions)", () => {
    const result = validateHarthmereLayout();
    assert.ok(result.ok, `layout invalid:\n${result.failures.join("\n")}`);
  });

  it("every district has at least one landmark", () => {
    for (const d of HARTHMERE_BIBLE_DISTRICTS) {
      assert.ok(
        d.landmarks.length > 0,
        `district '${d.id}' has no landmarks — map will have no anchor here`
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
    const ids = new Set(HARTHMERE_BIBLE_DISTRICTS.map((d) => d.id));
    for (const r of required) {
      assert.ok(ids.has(r), `bible district missing from layout: ${r}`);
    }
  });

  it("residential district exists for NPC housing overflow (bible §8.1)", () => {
    const residential = HARTHMERE_BIBLE_DISTRICTS.find(
      (d) => d.id === "residential"
    );
    assert.ok(
      residential,
      "residential district must exist for ambient population"
    );
  });
});

describe("Harthmere NPC residence contract current", () => {
  it("every named NPC has a home, goesHomeDaily, and a home schedule entry", () => {
    const result = validateHarthmereNpcResidences();
    assert.ok(
      result.ok,
      `NPC residence contract violated:\n${result.failures
        .slice(0, 25)
        .join("\n")}` +
        (result.failures.length > 25
          ? `\n... and ${result.failures.length - 25} more`
          : "")
    );
  });

  it("every bible residence row references a real NPC", () => {
    const knownNpcIds = harthmereNamedNpcIds();
    for (const r of HARTHMERE_BIBLE_NPC_RESIDENCES) {
      assert.ok(
        knownNpcIds.has(r.npcId),
        `bible residence references unknown NPC '${r.npcId}'`
      );
    }
  });
});

describe("Harthmere mission chain validator current", () => {
  it("catalog itself passes the existing current validator", () => {
    const result = validateHarthmereQuestChain({
      knownNpcIds: harthmereNamedNpcIds(),
    });
    assert.ok(
      result.ok,
      `quest chain failures (${result.failures.length}):\n` +
        result.failures.slice(0, 25).join("\n") +
        (result.failures.length > 25
          ? `\n... and ${result.failures.length - 25} more`
          : "")
    );
  });

  it("main chain Q1 → Q12 is connected by prerequisites with no cycles", () => {
    const chain = buildHarthmereQuestChain();
    assert.ok(
      chain.mainChain.length >= 12,
      `expected at least 12 main bible quests; got ${chain.mainChain.length}`
    );
    // The chain construction algorithm refuses to add edges for missing
    // prereqs and would push a warning. Surface them.
    assert.deepStrictEqual(
      chain.warnings,
      [],
      `chain warnings: ${chain.warnings.join(", ")}`
    );
  });

  it("nextSuggestedHarthmereQuest picks Q1 for a fresh player", () => {
    const suggestion = nextSuggestedHarthmereQuest({
      completedQuestIds: new Set<string>(),
      activeQuestIds: new Set<string>(),
    });
    assert.ok(suggestion, "must suggest something for a fresh player");
    assert.strictEqual(suggestion.reason, "next_main_chain");
    const chain = buildHarthmereQuestChain();
    assert.strictEqual(
      suggestion.questId,
      chain.mainChain[0],
      "first suggestion should be the head of the main bible chain"
    );
  });

  it("nextSuggestedHarthmereQuest advances after a main quest is completed", () => {
    const chain = buildHarthmereQuestChain();
    const completed = new Set<string>([chain.mainChain[0]]);
    const suggestion = nextSuggestedHarthmereQuest({
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

describe("current resolver Grove terrain Y (patch 05)", () => {
  // The resolver is the single runtime source of truth for "which Grove Y
  // should I be using right now?". See README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md
  // for the authored-vs-runtime split.

  it("defaults to live (what production snapshot terrain actually loads)", () => {
    const resolved = resolveSnapshotGroveGroundY({});
    assert.strictEqual(resolved.mode, "live");
    assert.strictEqual(
      resolved.worldGroundY,
      SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y
    );
    assert.strictEqual(resolved.npcFeetY, SNAPSHOT_GROVE_LIVE_NPC_FEET_Y);
    assert.strictEqual(resolved.markerY, SNAPSHOT_GROVE_LIVE_MARKER_Y);
  });

  it("returns authored values (matching the bible) when explicitly requested", () => {
    const resolved = resolveSnapshotGroveGroundY({
      GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE: "authored",
    });
    assert.strictEqual(resolved.mode, "authored");
    assert.strictEqual(resolved.worldGroundY, SNAPSHOT_GROVE_WORLD_GROUND_Y);
    assert.strictEqual(resolved.npcFeetY, SNAPSHOT_GROVE_NPC_FEET_Y);
  });

  it("accepts short aliases for terrain mode (current / current)", () => {
    assert.strictEqual(
      resolveSnapshotGroveTerrainMode({
        GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE: "authored",
      }),
      "authored"
    );
    assert.strictEqual(
      resolveSnapshotGroveTerrainMode({
        GLITCH_SNAPSHOT_GROVE_TERRAIN_MODE: "current",
      }),
      "live"
    );
  });

  it("authored and live constants stay distinct (no accidental drift)", () => {
    // The whole reason the resolver exists: these two values must NEVER
    // converge. If they do, NPCs are about to get buried.
    assert.notStrictEqual(
      SNAPSHOT_GROVE_NPC_FEET_Y,
      SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
      "Authored feet Y and live feet Y must stay distinct — see positioning README"
    );
  });
});
