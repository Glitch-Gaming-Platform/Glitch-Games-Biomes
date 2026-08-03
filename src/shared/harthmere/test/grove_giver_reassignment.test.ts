/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_GIVER_REASSIGNMENT
//
// Jackie's four fountain lessons moved to Rosalyn.
//
// THE POINT OF THIS FILE is the second half: proving the move did NOT touch
// Jackie's original-snapshot chain. Road Ahead, Busted, Get the Muck Out and
// Muck vs. Machine are Bikkie biscuits baked into `snapshot_backup.json` with
// engine-native trigger leaves (`npcKilled`, `inspect`, `collect`) and ids
// that live players are standing on. They are NOT Grove quests, the Grove
// catalog cannot express them, and nothing in this migration may reach them.
//
// A regression here would not throw. It would silently retarget or overwrite a
// shipped quest tree, and the first symptom would be a player unable to finish
// the opening of the game.

import assert from "assert";
import {
  GROVE_QUEST_CATALOG,
  groveQuest,
  groveQuestIdsForGiver,
} from "../grove/grove_quest_catalog";
import {
  groveNativeQuestId,
  groveNativeStepId,
} from "../grove/grove_quest_ids";
import {
  GROVE_PROTECTED_NATIVE_QUEST_IDS,
  groveValidateProtectedChainUntouched,
} from "../grove/grove_engine_contracts";
import { groveQuestGiverId } from "../grove/grove_quest_schema";
import { groveMarkerWorldPosition } from "../grove/grove_waypoints";
import { GROVE_GIVER_MAX_DISTANCE_FROM_QUEST_OPENING } from "../grove/grove_engine_contracts";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "../native_road_ahead_contract";
import {
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveLandmarkById,
} from "../snapshot_grove_content";
import {
  snapshotGroveObjectiveMarkerIdForProgress,
  snapshotGroveObjectiveTargetMarkerIds,
} from "../snapshot_grove_trigger_contract";

const REASSIGNED = [
  "fountain_buttons_first",
  "tools_before_treasure",
  "fountain_hotbar_and_dropping",
  "fountain_first_recipe_torch",
] as const;

const NEW_GIVER = "rosalyn";

describe("Grove giver reassignment — the four fountain lessons", () => {
  it("moves exactly the four named lessons to Rosalyn", () => {
    for (const questId of REASSIGNED) {
      const quest = groveQuest(questId);
      assert(quest, `${questId} is missing from the catalog`);
      assert.equal(
        groveQuestGiverId(quest),
        NEW_GIVER,
        `${questId} was not reassigned`
      );
    }
    assert.deepEqual(
      groveQuestIdsForGiver(NEW_GIVER)
        .filter((id) => (REASSIGNED as readonly string[]).includes(id))
        .sort(),
      [...REASSIGNED].sort()
    );
  });

  it("moves nothing else off Jackie", () => {
    const stillJackie = groveQuestIdsForGiver("jackie");
    // Jackie kept her four remaining Grove quests: the jobs-board intro, the
    // road-signs lesson, the north-gate letter, and the road graduation.
    assert.equal(stillJackie.length, 4);
    for (const questId of REASSIGNED) {
      assert(
        !stillJackie.includes(questId),
        `${questId} is still listed under Jackie`
      );
    }
  });

  it("keeps the reassigned lessons counting toward graduation", () => {
    // The graduation gates on a COUNT over the lesson set, not on who taught
    // them, so changing the giver must not change a player's progress.
    for (const questId of REASSIGNED) {
      assert.equal(groveQuest(questId)!.countsAsFountainLesson, true, questId);
    }
  });

  it("does not move a single native quest or step id", () => {
    // Reassignment changes `questGiver` on the biscuit. If it moved an id, an
    // in-flight player's Challenges/TriggerState would be orphaned.
    for (const questId of REASSIGNED) {
      const quest = groveQuest(questId)!;
      assert(groveNativeQuestId(questId) !== undefined, questId);
      for (const step of quest.steps) {
        assert(
          groveNativeStepId(questId, step.index) !== undefined,
          `${questId}/${step.index}`
        );
      }
    }
  });

  it("keeps the new giver AT the fountain, so no shared NPC was relocated", () => {
    // ANIMA RULE: Grove quest state is per-player, the NPC set is shared, so
    // reassigning to an NPC who would have to MOVE is forbidden.
    //
    // Area alone is not the test. Old Coop is also in `the_grove` but stands
    // 139 blocks from the fountain; Rosalyn is 4. An area-only check passed
    // Old Coop and would have made the game's first tutorial a long round
    // trip — which is why the contract now measures distance.
    const content = require("../snapshot_grove_content");
    const npc = content.SNAPSHOT_GROVE_NPCS.find(
      (row: { id: string }) => row.id === NEW_GIVER
    );
    assert(npc, `${NEW_GIVER} is not a seeded Grove NPC`);
    assert.equal(npc.homeArea, "the_grove");
    assert.equal(npc.seedServerNpc, true);

    const landmark = groveMarkerWorldPosition(`npc_${NEW_GIVER}`);
    assert(landmark, `${NEW_GIVER} has no map landmark`);
    const fountain = groveMarkerWorldPosition("npc_jackie")!; // fountain centre
    const distance = Math.hypot(
      landmark[0] - fountain[0],
      landmark[2] - fountain[2]
    );
    assert(
      distance <= GROVE_GIVER_MAX_DISTANCE_FROM_QUEST_OPENING,
      `${NEW_GIVER} stands ${Math.round(distance)} blocks from the fountain`
    );
  });

  it("retargets the prose and the map markers, not just the giver id", () => {
    // A reassignment that updates `start.giverNpcId` and leaves the authored
    // objectives pointing at `npc_jackie` produces a quest Rosalyn offers
    // while the map arrow sends the player to Jackie. That reads as broken.
    for (const questId of REASSIGNED) {
      const quest = groveQuest(questId)!;
      assert(
        !/jackie/i.test(JSON.stringify(quest)),
        `${questId} still mentions Jackie somewhere in its data`
      );
      assert.equal(
        quest.steps[0].markerId,
        `npc_${NEW_GIVER}`,
        `${questId}: the opening objective still points at the old giver`
      );
    }
  });
});

describe("Jackie's original-snapshot chain is untouched", () => {
  // These four ids are shipped in snapshot_backup.json. They are pinned here
  // as literals so a change to native_road_ahead_contract.ts cannot make this
  // test agree with a mistake.
  it("pins the four protected quest ids", () => {
    assert.equal(GROVE_PROTECTED_NATIVE_QUEST_IDS.roadAhead, 6193612340426932);
    assert.equal(GROVE_PROTECTED_NATIVE_QUEST_IDS.busted, 7405046529843322);
    assert.equal(
      GROVE_PROTECTED_NATIVE_QUEST_IDS.getTheMuckOut,
      817959262145055
    );
    assert.equal(
      GROVE_PROTECTED_NATIVE_QUEST_IDS.muckVsMachine,
      5739496793885069
    );
  });

  it("agrees with the shipped native contract", () => {
    assert.equal(
      Number(NATIVE_ROAD_AHEAD_QUEST_ID),
      GROVE_PROTECTED_NATIVE_QUEST_IDS.roadAhead
    );
    assert.equal(
      Number(NATIVE_BUSTED_QUEST_ID),
      GROVE_PROTECTED_NATIVE_QUEST_IDS.busted
    );
    assert.equal(
      Number(NATIVE_GET_THE_MUCK_OUT_QUEST_ID),
      GROVE_PROTECTED_NATIVE_QUEST_IDS.getTheMuckOut
    );
    assert.equal(
      Number(NATIVE_MUCK_VS_MACHINE_QUEST_ID),
      GROVE_PROTECTED_NATIVE_QUEST_IDS.muckVsMachine
    );
  });

  it("has no Grove quest claiming a protected id", () => {
    assert.deepEqual(groveValidateProtectedChainUntouched(), []);
  });

  it("has no Grove quest impersonating one of the four by name", () => {
    const protectedNames = [
      "road ahead",
      "busted",
      "get the muck out",
      "muck vs. machine",
      "muck vs machine",
    ];
    for (const quest of GROVE_QUEST_CATALOG) {
      const title = quest.title.toLowerCase();
      assert(
        !protectedNames.includes(title),
        `${quest.id} is titled "${quest.title}", which collides with a ` +
          `protected snapshot quest`
      );
    }
  });

  it("keeps every runtime marker surface on Rosalyn, not Jackie", () => {
    // THE CATALOG BEING RIGHT WAS NEVER ENOUGH.
    //
    // The sibling case above asserts the CATALOG no longer mentions Jackie, and
    // it passed while the game was still broken: the runtime reads the giver
    // from the catalog but resolved markers from the retired
    // `SNAPSHOT_GROVE_QUESTS` array, which still ships `npc_jackie` on the
    // opening and closing objective of all four reassigned lessons. Rosalyn
    // offered the lesson and every marker sent the player to Jackie.
    //
    // So this asserts the property through the RESOLVER the runtime actually
    // calls, starting from the retired row — the path the player experiences.
    for (const questId of REASSIGNED) {
      const shipped = SNAPSHOT_GROVE_QUESTS.find(
        (quest) => quest.id === questId
      );
      assert(shipped, `${questId} is missing from the retired array`);
      shipped.markerIds.forEach((_markerId, index) => {
        for (const resolved of snapshotGroveObjectiveTargetMarkerIds(
          shipped,
          index
        )) {
          assert(
            !/jackie/i.test(resolved),
            `${questId}[${index}] still resolves to "${resolved}" — Rosalyn ` +
              `offers this lesson but the map sends the player to Jackie`
          );
        }
        assert.equal(
          snapshotGroveObjectiveMarkerIdForProgress(shipped, index),
          snapshotGroveObjectiveTargetMarkerIds(shipped, index)[0],
          `${questId}[${index}]: the progress marker and the target list disagree`
        );
      });
      // The opening and closing objectives are the two that named the giver.
      const resolvedMarkers = shipped.markerIds.map(
        (_markerId, index) =>
          snapshotGroveObjectiveTargetMarkerIds(shipped, index)[0]
      );
      assert.equal(resolvedMarkers[0], `npc_${NEW_GIVER}`, questId);
      assert.equal(
        resolvedMarkers[resolvedMarkers.length - 1],
        `npc_${NEW_GIVER}`,
        questId
      );
    }
  });

  it("leaves every other quest's markers exactly as shipped", () => {
    // The retarget is keyed on the caller's marker matching the shipped row, so
    // it must be inert everywhere else. Without this, a broad delegation that
    // silently re-pointed the other 47 quests would look identical to a fix.
    for (const quest of SNAPSHOT_GROVE_QUESTS) {
      if ((REASSIGNED as readonly string[]).includes(quest.id)) continue;
      quest.markerIds.forEach((markerId, index) => {
        const resolved = snapshotGroveObjectiveTargetMarkerIds(quest, index);
        if (resolved.length !== 1) return; // authored multi-target objective
        assert.equal(
          resolved[0],
          markerId,
          `${quest.id}[${index}] drifted from its shipped marker`
        );
      });
    }
  });

  it("honours caller-supplied markers instead of the catalog", () => {
    // Map-adapter fixtures legitimately pass a quest whose markers differ from
    // the shipped ones. An earlier version of this resolver delegated wholesale
    // and returned catalog markers for a caller-supplied quest, moving the
    // first objective's marker onto the second one's. The retarget must only
    // fire when the caller is actually using shipped data.
    const custom = {
      id: "fountain_buttons_first",
      markerIds: ["custom_a", "custom_b", "custom_c", "custom_d", "custom_e"],
    };
    assert.deepEqual(
      custom.markerIds.map(
        (_markerId, index) =>
          snapshotGroveObjectiveTargetMarkerIds(custom, index)[0]
      ),
      custom.markerIds
    );
  });

  it("keeps every resolved marker pointing at a real landmark", () => {
    // A retarget that produced an unknown marker id would replace "wrong NPC"
    // with "no destination at all", which is harder to notice.
    for (const quest of SNAPSHOT_GROVE_QUESTS) {
      quest.markerIds.forEach((_markerId, index) => {
        for (const resolved of snapshotGroveObjectiveTargetMarkerIds(
          quest,
          index
        )) {
          assert(
            snapshotGroveLandmarkById(resolved),
            `${quest.id}[${index}] resolves to unknown marker "${resolved}"`
          );
        }
      });
    }
  });

  it("keeps the protected ids outside every Grove id band", () => {
    const groveIds = new Set(
      GROVE_QUEST_CATALOG.flatMap((quest) => [
        Number(groveNativeQuestId(quest.id)),
        ...quest.steps.map((step) =>
          Number(groveNativeStepId(quest.id, step.index))
        ),
      ])
    );
    for (const [name, id] of Object.entries(GROVE_PROTECTED_NATIVE_QUEST_IDS)) {
      assert(!groveIds.has(id), `Grove claims ${name} (${id})`);
    }
  });
});
