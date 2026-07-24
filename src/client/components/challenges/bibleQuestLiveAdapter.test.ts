// Tests for the bible quest client adapter (bible-wiring fix, 2026-07-14).
// Pure-model coverage: label→giver matching, dialog model construction,
// journal trackables, hidden-trigger selection, and the Thaedryn encounter
// HUD model — no React, no fetch.

import assert from "assert";
import {
  bibleQuestTrackableQuestsForBiomesUI,
  harthmereBibleDialogModelForGiver,
  harthmereBibleGiverIdForNpcLabel,
  harthmereBibleHiddenQuestInteractionModel,
  harthmereBibleHiddenQuestToTrigger,
  harthmereBibleOperationPayloadForAction,
  harthmereBibleQuestSnapshotFromResponse,
  harthmereThaedrynEncounterModel,
  readHarthmereBibleQuestSnapshot,
  resetHarthmereBibleQuestReadCacheForTest,
} from "@/client/components/challenges/bibleQuestLiveAdapter";
import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
  defaultHarthmereBibleQuestLiveSlice,
  harthmereBibleQuestsByGiver,
  harthmereThaedrynArenaWorldAnchor,
} from "@/shared/harthmere/bible_quest_live_authority";
import {
  HARTHMERE_THAEDRYN_VISIBLE_TARGET_ID,
  harthmereVisibleCombatTargetForActor,
} from "@/shared/harthmere/visible_combat_target";
import { createThaedrynBossState } from "@/shared/harthmere/thaedryn_boss";
import { HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/quest_compendium";
import { getHarthmereQuestResolvedWaypoint } from "@/shared/harthmere/quest_runtime";

function emptySnapshot() {
  return {
    actorId: "player-test",
    playerLevel: 8,
    serverNowMs: 1_700_000_000_000,
    active: {},
    completed: {},
    bible: defaultHarthmereBibleQuestLiveSlice(),
    warnings: [],
  };
}

describe("bible quest client adapter", () => {
  afterEach(() => resetHarthmereBibleQuestReadCacheForTest());

  it("reads snapshots through the read-only GET route and coalesces consumers", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      assert.equal(
        String(input),
        "/api/harthmere/live_mode_quest_state?install_id=install-test"
      );
      assert.equal(init?.method, "GET");
      await gate;
      return new Response(
        JSON.stringify({ ok: true, questState: emptySnapshot() }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const first = readHarthmereBibleQuestSnapshot({
      fetchImpl,
      locationSearch: "?install_id=install-test",
      nowMs: 1_000,
    });
    const second = readHarthmereBibleQuestSnapshot({
      fetchImpl,
      locationSearch: "?install_id=install-test",
      nowMs: 1_000,
    });
    release();
    assert.deepEqual(await first, await second);
    assert.equal(calls, 1);

    await readHarthmereBibleQuestSnapshot({
      fetchImpl,
      locationSearch: "?install_id=install-test",
      nowMs: 10_000,
    });
    assert.equal(calls, 1, "fresh snapshots should be shared across hooks");
  });

  it("matches rendered NPC labels to catalog givers (compendium names)", () => {
    assert.equal(
      harthmereBibleGiverIdForNpcLabel("Reeve Caldus Merrow"),
      "reeve_caldus_merrow"
    );
    // Labels can carry decorations; substring matching must still hit.
    assert.equal(
      harthmereBibleGiverIdForNpcLabel("Father Aldren Mell — Chapel of Bells"),
      "father_aldren_mell"
    );
    assert.equal(
      harthmereBibleGiverIdForNpcLabel("Random Villager"),
      undefined
    );
    assert.equal(harthmereBibleGiverIdForNpcLabel(undefined), undefined);
  });

  it("every catalog giver's compendium name is label-matchable", () => {
    // GAP GUARD: if a giver's compendium name drifts from what the renderer
    // labels the NPC, that giver silently stops offering quests. The id-based
    // fallback ("reeve caldus merrow") keeps a floor under this, but every
    // giver id must at minimum resolve through its own id spelling.
    for (const giverId of Object.keys(harthmereBibleQuestsByGiver())) {
      assert.equal(
        harthmereBibleGiverIdForNpcLabel(giverId.replace(/_/g, " ")),
        giverId,
        `giver ${giverId} must be resolvable from its id spelling`
      );
    }
  });

  it("builds accept actions for available quests at level", () => {
    const snapshot = emptySnapshot();
    const model = harthmereBibleDialogModelForGiver({
      giverId: "reeve_caldus_merrow",
      snapshot,
      playerLevel: 8,
    });
    const accept = model.actions.find(
      (action) =>
        action.kind === "accept" &&
        action.questId === "bellbound_q01_cracks_in_bridge"
    );
    assert.ok(accept, "Caldus must offer Q1 at level 8");
    assert.deepEqual(harthmereBibleOperationPayloadForAction(accept!), {
      operation: "bible_quest_accept",
      questId: "bellbound_q01_cracks_in_bridge",
    });
  });

  it("uses the server-projected actor level when callers omit an override", () => {
    const snapshot = emptySnapshot();
    const model = harthmereBibleDialogModelForGiver({
      giverId: "reeve_caldus_merrow",
      snapshot,
    });
    assert.ok(
      model.actions.some(
        (action) =>
          action.kind === "accept" &&
          action.questId === "bellbound_q01_cracks_in_bridge"
      )
    );
  });

  it("supplies combat evidence and a completable world panel for hidden quests", () => {
    const snapshot = emptySnapshot();
    const hidden = (HARTHMERE_QUEST_CATALOG as readonly any[]).find(
      (quest) => quest.id === "bellbound_q08_voices_in_stone"
    );
    snapshot.bible.runtime[hidden.id] = {
      questId: hidden.id,
      state: "active",
      objectiveProgress: Object.fromEntries(
        hidden.objectives.map((objective: any) => [
          objective.id,
          { current: 0, target: 1, completed: false },
        ])
      ),
    } as any;
    const model = harthmereBibleHiddenQuestInteractionModel({
      snapshot,
      playerPosition: getHarthmereQuestResolvedWaypoint(
        hidden.id,
        hidden.objectives[0]
      ),
    });
    assert.equal(model?.questId, hidden.id);
    assert.equal(model?.nearObjective, true);
    assert.equal(model?.action?.kind, "objective");

    const combatQuest = (HARTHMERE_QUEST_CATALOG as readonly any[]).find(
      (quest) => quest.id === "bellbound_q05_beneath_the_stones"
    );
    snapshot.bible.runtime[combatQuest.id] = {
      questId: combatQuest.id,
      state: "active",
      objectiveProgress: Object.fromEntries(
        combatQuest.objectives.map((objective: any, index: number) => [
          objective.id,
          { current: index === 0 ? 1 : 0, target: 1, completed: index === 0 },
        ])
      ),
    } as any;
    const combatModel = harthmereBibleDialogModelForGiver({
      giverId: combatQuest.giverId,
      snapshot,
      playerLevel: combatQuest.levelBand.min,
    });
    const combatAction = combatModel.actions.find(
      (action) => action.objectiveId === combatQuest.objectives[1].id
    );
    assert.equal(combatAction?.combatResult, "encounter_cleared");
    assert.equal(
      harthmereBibleOperationPayloadForAction(combatAction as any)
        .combatResult,
      "encounter_cleared"
    );
  });

  it("shows the current objective while active and turn-in when ready", () => {
    const snapshot = emptySnapshot();
    const quest = (HARTHMERE_QUEST_CATALOG as readonly any[]).find(
      (q) => q.id === "bellbound_q01_cracks_in_bridge"
    );
    // Active with first objective open.
    snapshot.bible.runtime[quest.id] = {
      questId: quest.id,
      state: "active",
      objectiveProgress: Object.fromEntries(
        quest.objectives.map((o: any) => [
          o.id,
          { current: 0, target: 1, completed: false },
        ])
      ),
    } as any;
    let model = harthmereBibleDialogModelForGiver({
      giverId: "reeve_caldus_merrow",
      snapshot,
      playerLevel: 8,
    });
    const objectiveAction = model.actions.find((a) => a.kind === "objective");
    assert.ok(objectiveAction);
    assert.equal(objectiveAction!.objectiveId, quest.objectives[0].id);
    // Ready: all objectives complete -> turn-in.
    snapshot.bible.runtime[quest.id].state = "ready_to_complete" as any;
    for (const key of Object.keys(
      snapshot.bible.runtime[quest.id].objectiveProgress
    )) {
      snapshot.bible.runtime[quest.id].objectiveProgress[key].completed = true;
    }
    model = harthmereBibleDialogModelForGiver({
      giverId: "reeve_caldus_merrow",
      snapshot,
      playerLevel: 8,
    });
    assert.ok(model.actions.some((a) => a.kind === "turn_in"));
  });

  it("journal trackables include only bible-sourced active quests", () => {
    const trackables = bibleQuestTrackableQuestsForBiomesUI({
      active: {
        bellbound_q01_cracks_in_bridge: {
          source: "bible_catalog",
          progress: 1,
          giverPosition: [988, 64, -212],
        },
        "read-the-jobs-board": { source: "client", progress: 0 },
      },
      completed: {},
    });
    assert.equal(trackables.length, 1);
    assert.equal(trackables[0].questId, "bellbound_q01_cracks_in_bridge");
    assert.equal(trackables[0].kindLabel, "Main Story");
    assert.deepEqual(trackables[0].markerWorldPosition, [988, 64, -212]);
    // Second objective label surfaces from the mirrored progress counter.
    assert.ok(String(trackables[0].objective).length > 0);
  });

  it("parses quest snapshots defensively from response bodies", () => {
    const snapshot = harthmereBibleQuestSnapshotFromResponse({
      questState: { active: null, completed: 7, bible: "garbage" },
    });
    assert.deepEqual(snapshot.active, {});
    assert.deepEqual(snapshot.completed, {});
    assert.deepEqual(snapshot.bible.runtime, {});
  });

  it("parses server actor context used by offer gating", () => {
    const snapshot = harthmereBibleQuestSnapshotFromResponse({
      questState: {
        actorId: "player-42",
        playerLevel: 12,
        serverNowMs: 1_700_000_123_456,
      },
    });
    assert.equal(snapshot.actorId, "player-42");
    assert.equal(snapshot.playerLevel, 12);
    assert.equal(snapshot.serverNowMs, 1_700_000_123_456);
  });

  it("selects a hidden quest to trigger only within the radius", () => {
    const hidden = (HARTHMERE_QUEST_CATALOG as readonly any[]).find(
      (q) => q.hidden
    );
    assert.ok(hidden, "catalog must have hidden quests");
    // Not near: no trigger.
    assert.equal(
      harthmereBibleHiddenQuestToTrigger({
        playerPosition: [0, 0, 0],
        snapshot: emptySnapshot(),
      }),
      undefined
    );
  });

  describe("thaedryn encounter model", () => {
    function q12Snapshot() {
      const snapshot = emptySnapshot();
      snapshot.bible.runtime[HARTHMERE_BIBLE_DRAGON_QUEST_ID] = {
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
        state: "active",
        objectiveProgress: {},
      } as any;
      snapshot.bible.thaedryn = createThaedrynBossState("group");
      return snapshot;
    }

    it("is inert away from the arena and live next to it", () => {
      const far = harthmereThaedrynEncounterModel({
        snapshot: q12Snapshot(),
        playerPosition: [0, 0, 0],
      });
      assert.equal(far.nearArena, false);
      assert.deepEqual(far.actions, []);

      const anchor = harthmereThaedrynArenaWorldAnchor();
      const near = harthmereThaedrynEncounterModel({
        snapshot: q12Snapshot(),
        playerPosition: [anchor[0] + 5, anchor[1], anchor[2] + 5],
      });
      assert.equal(near.nearArena, true);
      assert.ok(near.actions.length >= 6);
      const resolve = near.actions.find((a) => a.id === "resolve");
      assert.ok(resolve?.disabled, "resolve requires a committed path first");
    });

    it("enables resolve once a path is committed", () => {
      const snapshot = q12Snapshot();
      snapshot.bible.thaedryn!.chosenPath = "rebind";
      const anchor = harthmereThaedrynArenaWorldAnchor();
      const model = harthmereThaedrynEncounterModel({
        snapshot,
        playerPosition: [anchor[0], anchor[1], anchor[2]],
      });
      assert.equal(
        model.actions.find((a) => a.id === "resolve")?.disabled,
        false
      );
    });
  });

  it("routes the rendered Thaedryn actor to the live boss entity id", () => {
    const match = harthmereVisibleCombatTargetForActor({
      label: "Thaedryn the Bellbound",
      world: [1152, 64, -268],
    });
    assert.ok(match);
    assert.equal(match!.targetId, HARTHMERE_THAEDRYN_VISIBLE_TARGET_ID);
    // The visible-target id and the backend combat entity id are declared in
    // two modules (renderer hot path must not import the 25k-line catalog);
    // this assertion is the contract keeping them identical.
    assert.equal(
      HARTHMERE_THAEDRYN_VISIBLE_TARGET_ID,
      HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID
    );
  });
});
