/// <reference types="mocha" />

import assert from "assert";
import type {
  QuestBundle,
  TriggerProgress,
} from "@/client/game/resources/challenges";
import type { NavigationAid as ClientNavigationAid } from "@/client/game/helpers/navigation_aids";
import type { BiomesId } from "@/shared/ids";
import { nativeQuestMapMarkers, nativeQuestTrackableQuests } from "../nativeQuestMapAdapter";
import { buildNativeQuestNavAidResolver } from "../nativeQuestNavAidResolver";

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
    const bundle = quest(
      7405046529843322,
      seq(300, [leaf(301, "Handcraft 0/8 Muck Busters", 0)], 0),
      999
    );
    const resolve = buildNativeQuestNavAidResolver({
      navigationAids: new Map(),
      questBundles: [bundle],
      questGiverBeamPosition: (npcTypeId) =>
        Number(npcTypeId) === 999 ? [500, 70, -120] : undefined,
    });

    const markers = nativeQuestMapMarkers([bundle], resolve);
    assert.equal(markers.length, 1);
    // Anchor markers key on the quest id so trackable-quest parsing is unchanged.
    assert.equal(
      markers[0].id,
      "native_quest:7405046529843322:7405046529843322"
    );
    assert.deepStrictEqual(markers[0].worldPosition, [500, 70, -120]);
    assert.equal(markers[0].label, "Handcraft 0/8 Muck Busters");

    // ...which is what re-enables Center for that quest row.
    assert.equal(
      nativeQuestTrackableQuests([bundle], resolve)[0].firstMarkerId,
      "native_quest:7405046529843322:7405046529843322"
    );
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
      [
        "native_quest:7405046529843322:601",
        "native_quest:817959262145055:701",
      ]
    );
  });
});
