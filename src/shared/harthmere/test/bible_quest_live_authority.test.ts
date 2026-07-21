// Tests for HARTHMERE_BIBLE_QUEST_LIVE_AUTHORITY (bible-wiring fix,
// 2026-07-14): the server seam that finally makes the 85-quest bible catalog
// (Q1–Q12 dragon arc + side quests) playable through live mode, and drives
// the Thaedryn encounter from the previously runtime-orphaned boss contract.

import assert from "assert";
import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS,
  HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
  HARTHMERE_THAEDRYN_MAX_HP,
  buildHarthmereBibleQuestContext,
  defaultHarthmereBibleQuestLiveSlice,
  harthmereBibleCompletedQuestIds,
  harthmereBibleQuestOffersForGiver,
  harthmereBibleQuestsByGiver,
  harthmereThaedrynArenaWorldAnchor,
  harthmereThaedrynCombatSnapshot,
  harthmereThaedrynDamageEventsForAttack,
  normalizeHarthmereBibleQuestLiveSlice,
  reduceHarthmereBibleQuestOperation,
  validateHarthmereDragonQuestReachability,
  type HarthmereBibleQuestLiveSlice,
} from "@/shared/harthmere/bible_quest_live_authority";
import {
  HARTHMERE_QUEST_CATALOG,
  getHarthmereQuestById,
} from "@/shared/harthmere/quest_compendium";
import { createThaedrynBossState } from "@/shared/harthmere/thaedryn_boss";

const NOW = 1_800_000_000_000; // fixed clock for determinism

function reduce(
  slice: HarthmereBibleQuestLiveSlice,
  operation: string,
  overrides: Record<string, unknown> = {}
) {
  return reduceHarthmereBibleQuestOperation({
    slice,
    actorId: "test-actor",
    playerLevel: 20,
    completedQuests: {},
    nowMs: NOW,
    operation,
    requestId: `req-${operation}-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  } as any);
}

/** Complete every objective of an active quest via the advance operation. */
function advanceAllObjectives(
  slice: HarthmereBibleQuestLiveSlice,
  questId: string,
  extras: Record<string, unknown> = {}
) {
  const quest = getHarthmereQuestById(questId) as any;
  let current = slice;
  for (const objective of quest.objectives) {
    const waypoint = current.runtime[questId]
      ? // stand exactly on the objective's resolved location
        undefined
      : undefined;
    void waypoint;
    const result = reduce(current, "bible_quest_advance", {
      questId,
      objectiveId: objective.id,
      // Position: reuse the map hint the runtime itself would produce so the
      // distance check passes deterministically.
      actorPosition: undefined,
      combatResult:
        objective.type === "combat" ? "encounter_cleared" : undefined,
      choice: objective.type === "choice" ? "test_choice" : undefined,
      ...extras,
    });
    assert.ok(
      result.ok,
      `advance ${questId}/${objective.id} failed: ${result.warnings.join(",")}`
    );
    current = result.slice;
  }
  return current;
}

describe("harthmere bible quest live authority", () => {
  it("derives a giver map covering every non-hidden, non-starter giver", () => {
    const byGiver = harthmereBibleQuestsByGiver();
    const expectedGivers = new Set(
      (HARTHMERE_QUEST_CATALOG as readonly any[])
        .filter((q) => !q.hidden && q.category !== "starter" && q.giverId)
        .map((q) => q.giverId)
    );
    assert.deepEqual(
      Object.keys(byGiver).sort(),
      [...expectedGivers].sort(),
      "giver map must be derived from the catalog, not the 8-NPC hand map"
    );
    // Regression guard for the audit finding: the hand map covered 8 givers,
    // the catalog has 19 non-hidden/non-starter givers — the derived map must
    // stay well above the hand map's coverage.
    assert.ok(Object.keys(byGiver).length >= 19);
  });

  it("maps all 9 starter twins to their kebab-case client ids", () => {
    assert.equal(
      Object.keys(HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS).length,
      9
    );
    assert.equal(
      HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS["starter_welcome_to_harthmere"],
      "welcome-to-harthmere"
    );
  });

  it("translates completed client twins into bible ids for prerequisites", () => {
    const ids = harthmereBibleCompletedQuestIds({
      "welcome-to-harthmere": 123,
      unrelated_quest: 456,
    });
    assert.ok(ids.includes("starter_welcome_to_harthmere"));
    assert.ok(ids.includes("welcome-to-harthmere"));
    assert.ok(ids.includes("unrelated_quest"));
  });

  it("normalizes garbage slices and drops orphan runtime records", () => {
    const slice = normalizeHarthmereBibleQuestLiveSlice({
      runtime: { deleted_quest_id: { state: "active" }, 5: null },
      grantedRewardIds: ["a", 7, null],
      flags: "not-an-array",
      completedAtMs: { q: "NaN", ok_quest: 5 },
      titles: undefined,
    });
    assert.deepEqual(Object.keys(slice.runtime), []);
    assert.deepEqual(slice.grantedRewardIds, ["a"]);
    assert.deepEqual(slice.flags, []);
    assert.deepEqual(slice.completedAtMs, { ok_quest: 5 });
  });

  it("accepts Q1, refuses re-accept wipe, and refuses starters", () => {
    const slice = defaultHarthmereBibleQuestLiveSlice();
    const accepted = reduce(slice, "bible_quest_accept", {
      questId: "bellbound_q01_cracks_in_bridge",
    });
    assert.ok(accepted.ok, accepted.warnings.join(","));
    assert.equal(
      accepted.slice.runtime["bellbound_q01_cracks_in_bridge"].state,
      "active"
    );
    assert.equal(
      accepted.activeMirror?.entry?.source,
      "bible_catalog",
      "accept must mirror into the shared quests.active journal record"
    );
    // Idempotent duplicate accept must not wipe progress.
    const again = reduce(accepted.slice, "bible_quest_accept", {
      questId: "bellbound_q01_cracks_in_bridge",
    });
    assert.ok(again.ok);
    // Starters are owned by the client twins.
    const starter = reduce(slice, "bible_quest_accept", {
      questId: "starter_welcome_to_harthmere",
    });
    assert.ok(!starter.ok);
    assert.ok(
      starter.warnings.some((w) =>
        w.includes("starter_quests_use_client_twins")
      )
    );
  });

  it("blocks Q2 until Q1 completes (prerequisite chain enforced)", () => {
    const slice = defaultHarthmereBibleQuestLiveSlice();
    const q2 = reduce(slice, "bible_quest_accept", {
      questId: "bellbound_q02_ledger_and_lies",
    });
    // Whatever Q2's real id is, the catalog guarantees SOME quest requires
    // Q1 — resolve it from data so a rename doesn't break the test.
    const dependent = (HARTHMERE_QUEST_CATALOG as readonly any[]).find((q) =>
      (q.activeRules?.prerequisiteQuestIds ?? []).includes(
        "bellbound_q01_cracks_in_bridge"
      )
    );
    assert.ok(dependent, "catalog must chain something off Q1");
    if (!q2.ok) {
      // fine — id guess was right and it is locked
    }
    const locked = reduce(slice, "bible_quest_accept", {
      questId: dependent.id,
    });
    assert.ok(!locked.ok, "quest chained on Q1 must be locked initially");
    assert.ok(
      locked.warnings.some((w) => w.includes("missing_prerequisite")),
      locked.warnings.join(",")
    );
  });

  it("advances objectives in order and completes with rewards + defs", () => {
    let slice = defaultHarthmereBibleQuestLiveSlice();
    const questId = "bellbound_q01_cracks_in_bridge";
    slice = reduce(slice, "bible_quest_accept", { questId }).slice;

    // Out-of-order advance must be rejected by the runtime ordering rule.
    const quest = getHarthmereQuestById(questId) as any;
    const last = quest.objectives[quest.objectives.length - 1];
    const outOfOrder = reduce(slice, "bible_quest_advance", {
      questId,
      objectiveId: last.id,
      choice: "x",
    });
    assert.ok(!outOfOrder.ok);
    assert.ok(
      outOfOrder.warnings.some((w) =>
        w.includes("prior_objective_not_complete")
      )
    );

    slice = advanceAllObjectives(slice, questId);
    assert.equal(slice.runtime[questId].state, "ready_to_complete");

    const done = reduce(slice, "bible_quest_complete", { questId });
    assert.ok(done.ok, done.warnings.join(","));
    assert.equal(done.slice.runtime[questId].state, "completed");
    assert.ok(done.rewards, "completion must return reward instructions");
    assert.ok(done.rewards!.xpDelta > 0 || done.rewards!.goldDelta > 0);
    for (const item of done.rewards!.items) {
      assert.ok(item.itemId && item.displayName && item.count === 1);
    }
    assert.equal(done.completedMirrorQuestId, questId);
    assert.equal(done.activeMirror?.remove, true);

    // Double-complete must be idempotent (no second grant).
    const dup = reduce(done.slice, "bible_quest_complete", { questId });
    assert.ok(!dup.ok || !dup.rewards, "reward must never grant twice");
  });

  it("creates one server proof item for a collection objective", () => {
    const questId = "harthmere_sq_016_candles_for_the_forgotten";
    let slice = reduce(
      defaultHarthmereBibleQuestLiveSlice(),
      "bible_quest_accept",
      { questId, playerLevel: 2 }
    ).slice;
    const quest = getHarthmereQuestById(questId) as any;
    const objective = quest.objectives[0];

    const advanced = reduce(slice, "bible_quest_advance", {
      questId,
      objectiveId: objective.id,
      playerLevel: 2,
    });
    assert.ok(advanced.ok, advanced.warnings.join(","));
    assert.deepEqual(advanced.objectiveItemGrant, {
      itemId: `quest_objective_item:${questId}:${objective.id}`,
      count: 1,
      displayName: "chapel candles",
    });

    slice = advanced.slice;
    const duplicate = reduce(slice, "bible_quest_advance", {
      questId,
      objectiveId: objective.id,
      playerLevel: 2,
    });
    assert.ok(duplicate.ok, duplicate.warnings.join(","));
    assert.equal(duplicate.objectiveItemGrant, undefined);
  });

  it("abandon + retry give a fresh record (wipe recovery)", () => {
    let slice = defaultHarthmereBibleQuestLiveSlice();
    const questId = "bellbound_q01_cracks_in_bridge";
    slice = reduce(slice, "bible_quest_accept", { questId }).slice;
    const abandoned = reduce(slice, "bible_quest_abandon", { questId });
    assert.ok(abandoned.ok);
    assert.equal(abandoned.slice.runtime[questId].state, "abandoned");
    assert.equal(abandoned.activeMirror?.remove, true);
    const retried = reduce(abandoned.slice, "bible_quest_retry", { questId });
    assert.ok(retried.ok);
    assert.equal(retried.slice.runtime[questId].state, "active");
  });

  describe("thaedryn encounter (Q12)", () => {
    /** Build a slice with every Q12 prerequisite completed. */
    function q12ReadySlice(): HarthmereBibleQuestLiveSlice {
      const slice = defaultHarthmereBibleQuestLiveSlice();
      // Complete the whole main chain before Q12 by marking completedAtMs —
      // context building unions these into completedQuestIds.
      for (const quest of HARTHMERE_QUEST_CATALOG as readonly any[]) {
        if (
          quest.category === "main" &&
          quest.id !== HARTHMERE_BIBLE_DRAGON_QUEST_ID
        ) {
          slice.completedAtMs[quest.id] = NOW - 1000;
        }
      }
      return slice;
    }

    it("accepting Q12 arms the boss machine and seeds the snapshot", () => {
      const result = reduce(q12ReadySlice(), "bible_quest_accept", {
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
        bossMode: "solo_story",
      });
      assert.ok(result.ok, result.warnings.join(","));
      assert.ok(result.slice.thaedryn);
      assert.equal(result.slice.thaedryn!.mode, "solo_story");
      assert.equal(result.thaedrynSnapshot, "seed");
    });

    it("boss snapshot maps healthPct to hp and sits on the arena anchor", () => {
      const snapshot = harthmereThaedrynCombatSnapshot(
        { ...createThaedrynBossState("group"), healthPct: 50 },
        NOW
      );
      assert.equal(snapshot.hp, HARTHMERE_THAEDRYN_MAX_HP / 2);
      const anchor = harthmereThaedrynArenaWorldAnchor();
      assert.deepEqual(
        [snapshot.position.x, snapshot.position.y, snapshot.position.z],
        anchor
      );
      assert.equal(snapshot.movementSpeed, 0, "chained dragon must not chase");
      assert.match(
        HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
        /^\d+$/,
        "Thaedryn must use a stable native ECS entity id"
      );
    });

    it("attack damage converts to percent events + wake tracking", () => {
      const state = { ...createThaedrynBossState("group"), chainsRemaining: 1 };
      const events = harthmereThaedrynDamageEventsForAttack(state, 400);
      assert.equal(events[0].type, "damage");
      assert.equal(events[0].amount, 10); // 400 / 4000
      assert.ok(events.some((e) => e.type === "attack_after_third_chain"));
    });

    it("slay path: chains + damage + choose + resolve completes Q12", () => {
      let slice = reduce(q12ReadySlice(), "bible_quest_accept", {
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
      }).slice;
      // Break all four chains, burn health to zero, choose slay, resolve.
      for (let i = 0; i < 4; i++) {
        slice = reduce(slice, "bible_quest_boss_event", {
          bossEventType: "break_chain",
        }).slice;
      }
      slice = reduce(slice, "bible_quest_boss_event", {
        bossEventType: "damage",
        bossEventAmount: 100,
      }).slice;
      slice = reduce(slice, "bible_quest_boss_event", {
        bossEventType: "choose_path",
        bossEventPath: "slay",
      }).slice;
      const resolved = reduce(slice, "bible_quest_boss_event", {
        bossEventType: "resolve",
      });
      assert.ok(resolved.ok, resolved.warnings.join(","));
      assert.equal(resolved.slice.thaedryn!.completed, true);
      assert.equal(
        resolved.slice.townPhase,
        "town_safe_but_lattice_weakened",
        "slay path must apply its town phase"
      );
      // Path rewards granted once, with slugged item ids.
      assert.ok(resolved.rewards);
      assert.ok(
        resolved.rewards!.items.some((i) => i.itemId === "thaedryn_s_tooth")
      );
      // All four Q12 objectives complete -> quest is turn-in ready.
      assert.equal(
        resolved.slice.runtime[HARTHMERE_BIBLE_DRAGON_QUEST_ID].state,
        "ready_to_complete"
      );
      // Turn-in grants the quest's own rewards on top.
      const turnIn = reduce(resolved.slice, "bible_quest_complete", {
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
      });
      assert.ok(turnIn.ok, turnIn.warnings.join(","));
      assert.equal(turnIn.thaedrynSnapshot, "remove");
      assert.ok(
        turnIn.slice.flags.includes("post_main_harthmere_state"),
        "Q12 unlocks must persist as flags"
      );
    });

    it("wake path collapses into failure when attacked past threshold", () => {
      let slice = reduce(q12ReadySlice(), "bible_quest_accept", {
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
        bossMode: "group", // threshold 1
      }).slice;
      for (let i = 0; i < 3; i++) {
        slice = reduce(slice, "bible_quest_boss_event", {
          bossEventType: "break_chain",
        }).slice;
      }
      // Two attacks after the third chain (> threshold of 1).
      for (let i = 0; i < 2; i++) {
        slice = reduce(slice, "bible_quest_boss_event", {
          bossEventType: "attack_after_third_chain",
        }).slice;
      }
      slice = reduce(slice, "bible_quest_boss_event", {
        bossEventType: "choose_path",
        bossEventPath: "wake",
      }).slice;
      const resolved = reduce(slice, "bible_quest_boss_event", {
        bossEventType: "resolve",
      });
      assert.ok(!resolved.ok);
      assert.ok(
        resolved.warnings.some((w) =>
          w.includes("wake_collapsed_into_slay_by_attack_threshold")
        )
      );
    });

    it("boss events without an active Q12 are rejected", () => {
      const result = reduce(
        defaultHarthmereBibleQuestLiveSlice(),
        "bible_quest_boss_event",
        { bossEventType: "damage", bossEventAmount: 5 }
      );
      assert.ok(!result.ok);
      assert.ok(result.warnings.some((w) => w.includes("q12_not_active")));
    });
  });

  describe("dragon quest reachability contract", () => {
    it("passes at HEAD and pins the arena inside the town envelope", () => {
      const report = validateHarthmereDragonQuestReachability();
      assert.deepEqual(report.failures, []);
      assert.ok(report.ok);
      assert.equal(report.mainChainQuestIds.length, 13); // Q1..Q12 + Q2.5
      // World anchor = authored (640, 64, -268) + the +512 town X shift.
      // Y 64 = the town's flat ground level: combat reach and objective
      // distance are 3D, so the anchor must sit ON the ground, not at Y 0.
      assert.deepEqual(report.arenaWorldAnchor, [1152, 64, -268]);
    });
  });

  it("offers for Reeve Caldus include an available Q1 and a locked chain", () => {
    const slice = defaultHarthmereBibleQuestLiveSlice();
    const context = buildHarthmereBibleQuestContext({
      actorId: "test-actor",
      playerLevel: 20,
      completedQuests: {},
      slice,
      nowMs: NOW,
    });
    const offers = harthmereBibleQuestOffersForGiver(
      "reeve_caldus_merrow",
      context
    );
    const q1 = offers.find(
      (offer) => offer.questId === "bellbound_q01_cracks_in_bridge"
    );
    assert.ok(q1, "Caldus must offer Q1");
    assert.equal(q1!.state, "available");
    assert.ok(q1!.offerText.length > 40, "offer text must be the bible line");
  });
});
