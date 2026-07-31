/// <reference types="mocha" />

import assert from "assert";
import type {
  QuestBundle,
  TriggerProgress,
} from "@/client/game/resources/challenges";
import type { NavigationAid as ClientNavigationAid } from "@/client/game/helpers/navigation_aids";
import type { BiomesId } from "@/shared/ids";
import {
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS,
  NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION,
} from "@/shared/harthmere/native_road_ahead_contract";
import { SNAPSHOT_GROVE_JACKIE_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";
import {
  NATIVE_LEGACY_COMBAT_QUEST_IDS,
  NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS,
  NATIVE_LEGACY_COMBAT_STEP_IDS,
} from "@/shared/harthmere/native_combat_quest_routing";
import {
  NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION,
  NATIVE_IN_STORAGE_QUEST_ID,
  NATIVE_IN_STORAGE_STEP_IDS,
  NATIVE_POST_GIMME_GIVER_ENTITY_IDS,
} from "@/shared/harthmere/native_post_gimme_contract";
import {
  nativeQuestInferredNavigationAidForTest,
  nativeQuestLocationlessAnchorAidForTest,
  nativeQuestMapMarkers,
  nativeQuestTrackableQuests,
} from "../nativeQuestMapAdapter";
import {
  buildNativeQuestNavAidResolver,
  nativeQuestNavigationAidsRevisionForTest,
} from "../nativeQuestNavAidResolver";

/**
 * Regression coverage for the 2026-07-26 live report: "the steps don't seem to
 * have map markers like the other quests", "if I switch up a quest the marker
 * disappears", and "for Busted I cannot set nor remove as the quest, and I
 * can[not] use center on map to see where to go".
 *
 * All three shared one root cause — only `kind: "position"` navigation aids
 * produced markers, so npc/entity objectives and location-less crafting steps
 * produced none, which in turn disabled Set Main and Center.
 */

function leaf(
  id: number,
  objective: string,
  progressPercentage: number,
  navigationAid?: TriggerProgress["navigationAid"]
): TriggerProgress {
  return {
    id,
    payload: { kind: "collect" },
    progressString: objective,
    progressPercentage,
    navigationAid,
  } as TriggerProgress;
}

function seq(
  id: number,
  children: TriggerProgress[],
  progressPercentage: number
): TriggerProgress {
  return {
    id,
    payload: { kind: "seq" },
    progressString: "",
    progressPercentage,
    children,
  } as TriggerProgress;
}

function quest(
  id: number,
  progress: TriggerProgress,
  questGiver?: number
): QuestBundle {
  return {
    challengeDeps: [],
    biscuit: {
      id,
      isQuest: true,
      displayName: `Quest ${id}`,
      questCategory: "main",
      questGiver,
    } as QuestBundle["biscuit"],
    progress,
    state: "in_progress",
  };
}

function aid(
  id: number,
  pos: [number, number, number],
  challengeId?: number
): ClientNavigationAid {
  return {
    id,
    pos,
    kind: "quest",
    autoremoveWhenNear: false,
    challengeId: challengeId as BiomesId | undefined,
    target: { kind: "position", position: pos },
  } as ClientNavigationAid;
}

describe("native quest nav-aid map markers", () => {
  it("routes Gimme Shelter robot placement outside the Grove reserve", () => {
    const placement = leaf(
      NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.PLACE_ROBOT_IN_MUCK,
      "Place your Robot in the marked Muck clearing outside the Grove",
      0,
      {
        kind: "position",
        pos: [512, 54, -152],
      }
    );
    placement.payload = { kind: "event" };

    assert.deepStrictEqual(
      nativeQuestInferredNavigationAidForTest(
        NATIVE_GIMME_SHELTER_QUEST_ID,
        placement
      ),
      {
        kind: "position",
        pos: [...NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION],
      }
    );
    assert.deepStrictEqual(
      nativeQuestMapMarkers([
        quest(NATIVE_GIMME_SHELTER_QUEST_ID, seq(189, [placement], 0)),
      ])[0].worldPosition,
      [...NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION]
    );
  });

  it("points the unaided Mossy Muckling hunt at the seeded Mossy Muckling pack", () => {
    const hunt = leaf(
      4794743509650569,
      "Defeat 0/6 Mossy Mucklings with your Whacker",
      0
    );
    hunt.payload = { kind: "event" };
    const bundle = quest(
      817959262145055,
      seq(190, [hunt], 0),
      SNAPSHOT_GROVE_JACKIE_ENTITY_ID
    );

    assert.deepStrictEqual(
      nativeQuestInferredNavigationAidForTest(
        817959262145055 as BiomesId,
        hunt
      ),
      { kind: "position", pos: [531, 68, -33] }
    );
    const markers = nativeQuestMapMarkers([bundle]);
    assert.equal(
      markers[0].id,
      "native_quest:817959262145055:4794743509650569"
    );
    assert.deepStrictEqual(markers[0].worldPosition, [531, 68, -33]);
    assert.match(markers[0].label, /Mossy Mucklings/);
  });

  it("routes the four legacy combat quests to populated restored enemy packs", () => {
    const rows = [
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.NUTHIN_TO_MUCK_WITH,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.COBBLED_MUCKLING,
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.COBBLED_PACK,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.SEEDY_SAPPERS,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.SEEDY_PACK,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.JUGGEMENT_DAY,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.EIGHT_JUGGERMUCKERS,
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_NORTH,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.COMBAT_JUGGMENT_DAY,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_THREE,
      },
    ] as const;

    for (const row of rows) {
      const combat = leaf(row.stepId, "Defeat the marked enemies", 0);
      combat.payload = { kind: "event" };
      assert.deepStrictEqual(
        nativeQuestInferredNavigationAidForTest(row.questId, combat),
        { kind: "position", pos: [...row.position] }
      );
      assert.deepStrictEqual(
        nativeQuestMapMarkers([quest(row.questId, seq(191, [combat], 0))])[0]
          .worldPosition,
        [...row.position]
      );
    }
  });

  it("moves the eight-Juggermucker marker between two verified four-packs", () => {
    const combat = leaf(
      NATIVE_LEGACY_COMBAT_STEP_IDS.EIGHT_JUGGERMUCKERS,
      "Defeat 4/8 Juggermuckers",
      4 / 8
    );
    combat.payload = { kind: "event" };
    assert.deepStrictEqual(
      nativeQuestInferredNavigationAidForTest(
        NATIVE_LEGACY_COMBAT_QUEST_IDS.JUGGEMENT_DAY,
        combat
      ),
      {
        kind: "position",
        pos: [...NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_SOUTH],
      }
    );
  });

  it("does not infer a route from the duplicated combat step id without the matching quest", () => {
    const combat = leaf(
      NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
      "Defeat an enemy",
      0
    );
    combat.payload = { kind: "event" };
    assert.equal(
      nativeQuestInferredNavigationAidForTest(999 as BiomesId, combat),
      undefined
    );
  });

  it("resolves an npc objective that carries no authored position", () => {
    // "Talk to Jackie" is an npc aid. Before the fix this produced no marker.
    const bundle = quest(
      7405046529843322,
      seq(
        100,
        [
          leaf(101, "Talk to Jackie", 0, {
            kind: "npc",
            npcTypeId: 555 as BiomesId,
          }),
        ],
        0
      )
    );
    const resolve = buildNativeQuestNavAidResolver({
      // MapManager already resolved the NPC location under the trigger id.
      navigationAids: new Map([[101, aid(101, [640, 64, -268])]]),
    });

    const markers = nativeQuestMapMarkers([bundle], resolve);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].id, "native_quest:7405046529843322:101");
    assert.deepStrictEqual(markers[0].worldPosition, [640, 64, -268]);
    assert.equal(markers[0].label, "Talk to Jackie");
  });

  it("falls back to any aid registered for the same quest", () => {
    const bundle = quest(
      817959262145055,
      seq(200, [leaf(201, "Deliver the logs to Doc", 0)], 0)
    );
    // Registered under the seq node's id, not the leaf's — a real shape,
    // because StepSideEffects registers aids for aggregate nodes too.
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map([[200, aid(200, [12, 3, 4], 817959262145055)]]),
    });

    const markers = nativeQuestMapMarkers([bundle], resolve);
    assert.equal(markers.length, 1);
    assert.deepStrictEqual(markers[0].worldPosition, [12, 3, 4]);
  });

  it("anchors a location-less crafting step on the quest giver", () => {
    // Exactly the reported case: Busted, "Handcraft 0/8 Muck Busters".
    const askHuck = leaf(299, "Ask Huck how to make Muck Busters", 1);
    askHuck.payload = {
      kind: "challengeClaimRewards",
      returnQuestGiverId: 3282862615696657 as BiomesId,
      allowDefaultNavigationAid: true,
    };
    const returnToHuck = leaf(302, "Head back to Huck", 0);
    returnToHuck.payload = {
      kind: "challengeClaimRewards",
      returnQuestGiverId: 3282862615696657 as BiomesId,
      allowDefaultNavigationAid: true,
    };
    const bundle = quest(
      7405046529843322,
      seq(
        300,
        [askHuck, leaf(301, "Handcraft 0/8 Muck Busters", 0), returnToHuck],
        0
      ),
      // The real original-snapshot Busted giver has no beamPosition, which is
      // why the old quest-giver-only fallback still produced no map marker.
      SNAPSHOT_GROVE_JACKIE_ENTITY_ID
    );
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map(),
      questBundles: [bundle],
      questGiverBeamPosition: () => undefined,
      npcTypePosition: (npcTypeId) =>
        Number(npcTypeId) === 3282862615696657 ? [842, 29, 318] : undefined,
    });

    const markers = nativeQuestMapMarkers([bundle], resolve);
    assert.equal(markers.length, 1);
    // Anchor markers key on the quest id so trackable-quest parsing is unchanged.
    assert.equal(
      markers[0].id,
      "native_quest:7405046529843322:7405046529843322"
    );
    assert.deepStrictEqual(markers[0].worldPosition, [842, 29, 318]);
    assert.equal(markers[0].label, "Handcraft 0/8 Muck Busters");
    assert.deepStrictEqual(
      nativeQuestLocationlessAnchorAidForTest(
        bundle.biscuit.id,
        bundle.progress!,
        bundle.progress!.children![1]
      ),
      { kind: "npc", npcTypeId: 3282862615696657 }
    );

    // ...which is what re-enables Center for that quest row.
    assert.equal(
      nativeQuestTrackableQuests([bundle], resolve)[0].firstMarkerId,
      "native_quest:7405046529843322:7405046529843322"
    );
  });

  it("uses the player as an honest final anchor when no NPC location is synchronized", () => {
    const bundle = quest(
      7405046529843322,
      seq(350, [leaf(351, "Handcraft 0/8 Muck Busters", 0)], 0),
      SNAPSHOT_GROVE_JACKIE_ENTITY_ID
    );
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map(),
      questBundles: [bundle],
      questGiverBeamPosition: () => undefined,
      npcTypePosition: () => undefined,
      fallbackPosition: () => [12, 34, 56],
    });
    assert.deepStrictEqual(
      nativeQuestMapMarkers([bundle], resolve)[0].worldPosition,
      [12, 34, 56]
    );
  });

  it("changes revision when MapManager resolves an in-place navigation aid", () => {
    const aids = new Map<number, ClientNavigationAid>([
      [101, aid(101, [0, 0, 0], 7405046529843322)],
    ]);
    const before = nativeQuestNavigationAidsRevisionForTest(aids);
    aids.set(101, aid(101, [640, 64, -268], 7405046529843322));
    const after = nativeQuestNavigationAidsRevisionForTest(aids);
    assert.notEqual(after, before);
  });

  it("still produces nothing when the client cannot resolve anything", () => {
    const bundle = quest(123, seq(400, [leaf(401, "Do a thing", 0)], 0));
    assert.deepStrictEqual(nativeQuestMapMarkers([bundle]), []);
    assert.equal(
      nativeQuestTrackableQuests([bundle])[0].firstMarkerId,
      undefined
    );
  });

  it("prefers the authored position over any resolved aid", () => {
    const bundle = quest(
      55,
      seq(
        500,
        [
          leaf(501, "Place a Muck Buster", 0, {
            kind: "position",
            pos: [1, 2, 3],
          }),
        ],
        0
      )
    );
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map([[501, aid(501, [9, 9, 9])]]),
    });
    assert.deepStrictEqual(
      nativeQuestMapMarkers([bundle], resolve)[0].worldPosition,
      [1, 2, 3]
    );
  });

  it("keeps markers for every in-progress quest, not just the tracked one", () => {
    // "if I switch up a quest, the marker on where to go disappears": the map
    // layer must keep emitting markers for all in-progress quests so switching
    // the tracked quest is purely a highlight change.
    const busted = quest(
      7405046529843322,
      seq(600, [leaf(601, "Head back to Huck", 0)], 0)
    );
    const muckOut = quest(
      817959262145055,
      seq(700, [leaf(701, "Find the Robot Power Supply", 0)], 0)
    );
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map([
        [601, aid(601, [10, 0, 10])],
        [701, aid(701, [20, 0, 20])],
      ]),
    });
    assert.deepStrictEqual(
      nativeQuestMapMarkers([busted, muckOut], resolve).map((m) => m.id),
      ["native_quest:7405046529843322:601", "native_quest:817959262145055:701"]
    );
  });

  /**
   * HARTHMERE_COBBLED_MUCKLING_HUNT: "Collect 6 Mucker Teeth" is an
   * `inventoryHas` leaf. The snapshot cannot author navigation on that leaf
   * kind at all, so before the Cobbled Muckling pack existed the objective
   * pointed nowhere AND named a creature the world did not contain.
   */
  it("points In Storage's Mucker Teeth objective at the Cobbled Muckling pack", () => {
    const teeth = leaf(
      NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH,
      "Collect 0/6 Mucker Teeth from the Cobbled Mucklings up Muckerhorn",
      0
    );
    teeth.payload = { kind: "inventoryHas" };
    const bundle = quest(
      Number(NATIVE_IN_STORAGE_QUEST_ID),
      seq(800, [teeth], 0),
      Number(NATIVE_POST_GIMME_GIVER_ENTITY_IDS.OL_COOP)
    );

    assert.deepStrictEqual(
      nativeQuestInferredNavigationAidForTest(
        NATIVE_IN_STORAGE_QUEST_ID,
        teeth
      ),
      {
        kind: "position",
        pos: [...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION],
      }
    );
    const markers = nativeQuestMapMarkers([bundle]);
    assert.deepStrictEqual(markers[0].worldPosition, [
      ...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION,
    ]);
    assert.match(markers[0].label, /Mucker Teeth/);
  });
});
