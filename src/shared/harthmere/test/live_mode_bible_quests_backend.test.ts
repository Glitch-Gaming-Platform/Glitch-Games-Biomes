/// <reference types="mocha" />
//
// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14) — integration
// tests for the live_mode backend branch that finally exposes the 85-quest
// bible catalog (accept/advance/complete/abandon/retry + Thaedryn boss
// events) through `request_quest_state_update`, including:
//   - journal mirroring into quests.active / quests.completed,
//   - reward application (xp, gold, item definitions registered),
//   - the Thaedryn combat entity snapshot lifecycle (seed → attack →
//     machine-authoritative hp → remove on turn-in).

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
  HARTHMERE_THAEDRYN_MAX_HP,
  harthmereThaedrynArenaWorldAnchor,
} from "../bible_quest_live_authority";
import { BIBLE_QUEST_CATALOG, bibleQuest } from "../bible/bible_quest_catalog";
import type {
  BibleQuestDef,
  BibleQuestStep,
} from "../bible/bible_quest_schema";
import { bibleStepWorldWaypoint } from "../bible/bible_waypoints";
import { getHarthmereItemDefinition } from "../mmo_inventory_authority";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";

const ACTOR = "player_bible_quests";
const NOW_MS = 1_702_100_000_000;
const Q1 = "bellbound_q01_cracks_in_bridge";

/**
 * Bible quests carry authored level bands (Q1 min 5, Q12 min 10) which the
 * activation rules enforce — a fresh level-1 character is correctly refused.
 * Tests therefore run a mid-band level-12 character.
 */
function leveledState(): HarthmereLiveModeBackendState {
  const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
  state.classMagic.skills["character_level"] = { xp: 0, level: 12 };
  return state;
}

let seq = 0;
function envelope(
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  seq += 1;
  return {
    requestId: `bible_test_${seq}`,
    idempotencyKey: `bible_test_${seq}`,
    actorId: ACTOR,
    actionKind: "request_quest_state_update",
    subsystem: "quest",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "harthmere",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

function reduce(
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope(payload, overrides),
    NOW_MS
  );
}

function requiredQuest(questId: string): BibleQuestDef {
  const quest = bibleQuest(questId);
  assert.ok(quest, `quest ${questId} must exist`);
  return quest;
}

/** Actor position standing exactly on a step's grounded world waypoint. */
function positionOnStep(quest: BibleQuestDef, step: BibleQuestStep) {
  const waypoint = bibleStepWorldWaypoint(quest, step);
  return { x: waypoint[0], y: waypoint[1], z: waypoint[2] };
}

/** Drive a quest from accept to ready_to_complete via real mutations. */
function acceptAndFinishObjectives(
  state: HarthmereLiveModeBackendState,
  questId: string
): HarthmereLiveModeBackendState {
  let current = reduce(state, {
    operation: "bible_quest_accept",
    questId,
  }).state;
  const quest = requiredQuest(questId);
  for (const step of quest.steps) {
    const reduced = reduce(
      current,
      {
        operation: "bible_quest_advance",
        questId,
        objectiveId: step.id,
        choice: step.type === "choice" ? "integration_choice" : undefined,
        combatResult: step.type === "combat" ? "encounter_cleared" : undefined,
      },
      { serverActorPosition: positionOnStep(quest, step) }
    );
    assert.ok(
      !reduced.summary.warnings.some((w: string) =>
        w.startsWith("bible_quest_rejected")
      ),
      `advance ${step.id}: ${reduced.summary.warnings.join(",")}`
    );
    current = reduced.state;
  }
  return current;
}

describe("Harthmere live-mode bible quest wiring", () => {
  it("accepts Q1 and mirrors it into the journal-facing quests.active", () => {
    const reduced = reduce(leveledState(), {
      operation: "bible_quest_accept",
      questId: Q1,
    });
    assert.ok(reduced.summary.touchedModels.includes("quest_state"));
    const active = reduced.state.quests.active[Q1];
    assert.ok(active, "accepted bible quest must appear in quests.active");
    assert.equal(active.source, "bible_catalog");
    assert.equal(active.title, "Cracks in the Bridge");
    assert.ok(active.giverPosition, "journal mirror needs a map position");
    assert.equal(active.stepId, requiredQuest(Q1).steps[0].id);
    assert.equal(active.progress, 0);
    assert.equal(
      (reduced.state.quests.bible as unknown as Record<string, unknown>)
        .runtime,
      undefined,
      "the retired Redis quest runtime must not be recreated"
    );
  });

  it("rejects advancing an objective from across the map (distance rule)", () => {
    let state = leveledState();
    state = reduce(state, {
      operation: "bible_quest_accept",
      questId: Q1,
    }).state;
    const quest = requiredQuest(Q1);
    const step = quest.steps[0];
    const reduced = reduce(
      state,
      {
        operation: "bible_quest_advance",
        questId: Q1,
        objectiveId: step.id,
      },
      // 10km away — far beyond the talk-objective 5m limit.
      { serverActorPosition: { x: 99_999, y: 0, z: 99_999 } }
    );
    assert.ok(
      reduced.summary.warnings.some((w: string) =>
        w.includes("player_too_far")
      ),
      reduced.summary.warnings.join(",")
    );
    assert.equal(reduced.state.quests.active[Q1]?.stepId, step.id);
    assert.equal(reduced.state.quests.active[Q1]?.progress, 0);
  });

  it("grants collection proof into the canonical live inventory", () => {
    const questId = "harthmere_sq_016_candles_for_the_forgotten";
    let state = leveledState();
    state.classMagic.skills["character_level"] = { xp: 0, level: 2 };
    state = reduce(state, {
      operation: "bible_quest_accept",
      questId,
    }).state;
    const quest = requiredQuest(questId);
    const step = quest.steps[0];
    const proofItemId = `quest_objective_item:${questId}:${step.id}`;

    const advanced = reduce(
      state,
      {
        operation: "bible_quest_advance",
        questId,
        objectiveId: step.id,
      },
      { serverActorPosition: positionOnStep(quest, step) }
    );
    assert.equal(advanced.state.inventory.items[proofItemId], 1);
    assert.equal(
      advanced.state.inventoryLoot.actors[ACTOR]?.items[proofItemId],
      1
    );
    assert.ok(getHarthmereItemDefinition(proofItemId)?.isQuestItem);
  });

  it("completes Q1: grants xp + gold, registers reward item definitions", () => {
    const ready = acceptAndFinishObjectives(leveledState(), Q1);
    assert.equal(ready.quests.active[Q1]?.stepId, undefined);
    assert.equal(ready.quests.active[Q1]?.progress, 1);
    const goldBefore = ready.inventory.gold;
    const xpBefore = ready.classMagic.skills["character_level"]?.xp ?? 0;
    const done = reduce(ready, {
      operation: "bible_quest_complete",
      questId: Q1,
    });
    assert.ok(
      !done.summary.warnings.some((w: string) =>
        w.startsWith("bible_quest_rejected")
      ),
      done.summary.warnings.join(",")
    );
    assert.ok(done.state.quests.completed[Q1], "completion must mirror");
    assert.equal(done.state.quests.active[Q1], undefined);
    assert.equal(done.state.quests.bible.lastCompletedAtMs[Q1], NOW_MS);
    const quest = requiredQuest(Q1);
    if (quest.rewards.silver > 0) {
      assert.ok(done.state.inventory.gold > goldBefore, "gold must grant");
    }
    if (quest.rewards.xp > 0) {
      assert.ok(
        (done.state.classMagic.skills["character_level"]?.xp ?? 0) > xpBefore,
        "xp must grant"
      );
    }
    for (const itemId of quest.rewards.items ?? []) {
      assert.ok(
        (done.state.inventory.items[itemId] ?? 0) >= 1,
        `reward item ${itemId} must be in inventory`
      );
      assert.ok(
        getHarthmereItemDefinition(itemId),
        `reward item ${itemId} must have a registered definition (audit gap)`
      );
    }
    // Idempotent double-complete: no duplicate grant.
    const dup = reduce(done.state, {
      operation: "bible_quest_complete",
      questId: Q1,
    });
    assert.equal(dup.state.inventory.gold, done.state.inventory.gold);
  });

  it("keeps the prerequisite chain: a quest gated on Q1 unlocks after it", () => {
    const dependent = BIBLE_QUEST_CATALOG.find(
      (quest) =>
        quest.start.kind === "after" &&
        quest.start.questId === Q1 &&
        !quest.hidden
    );
    assert.ok(dependent, "catalog must chain something off Q1");
    // Locked before...
    const locked = reduce(leveledState(), {
      operation: "bible_quest_accept",
      questId: dependent.id,
    });
    assert.ok(
      locked.summary.warnings.some((w: string) =>
        w.includes("missing_prerequisite")
      )
    );
    // ...unlocked after completing Q1 for real.
    const ready = acceptAndFinishObjectives(leveledState(), Q1);
    const done = reduce(ready, {
      operation: "bible_quest_complete",
      questId: Q1,
    }).state;
    const unlocked = reduce(done, {
      operation: "bible_quest_accept",
      questId: dependent.id,
    });
    assert.ok(
      !unlocked.summary.warnings.some((w: string) =>
        w.startsWith("bible_quest_rejected")
      ),
      unlocked.summary.warnings.join(",")
    );
    assert.equal(
      unlocked.state.quests.active[dependent.id]?.stepId,
      dependent.steps[0]?.id
    );
  });

  describe("thaedryn encounter through the combat loop", () => {
    function q12ActiveState(): HarthmereLiveModeBackendState {
      let state = leveledState();
      // Complete every main-chain prerequisite in the journal mirror consumed
      // by the typed gate.
      for (const quest of BIBLE_QUEST_CATALOG) {
        if (
          quest.category === "main" &&
          quest.id !== HARTHMERE_BIBLE_DRAGON_QUEST_ID
        ) {
          state.quests.completed[quest.id] = NOW_MS - 1;
        }
      }
      const accepted = reduce(state, {
        operation: "bible_quest_accept",
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
        bossMode: "solo_story",
      });
      assert.ok(
        !accepted.summary.warnings.some((w: string) =>
          w.startsWith("bible_quest_rejected")
        ),
        accepted.summary.warnings.join(",")
      );
      return accepted.state;
    }

    it("seeds the boss combat snapshot at the arena anchor on accept", () => {
      const state = q12ActiveState();
      const snapshot =
        state.combat.entitySnapshots[HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID];
      assert.ok(snapshot, "Q12 accept must seed the Thaedryn snapshot");
      assert.equal(snapshot.hp, HARTHMERE_THAEDRYN_MAX_HP);
      assert.equal(snapshot.isAttackable, true);
      const anchor = harthmereThaedrynArenaWorldAnchor();
      assert.deepEqual(
        [snapshot.position.x, snapshot.position.z],
        [anchor[0], anchor[2]],
        "boss must sit on the canonical (renderer-asset) arena anchor"
      );
    });

    it("a real request_attack damages the machine-authoritative boss hp", () => {
      const state = q12ActiveState();
      const anchor = harthmereThaedrynArenaWorldAnchor();
      const attacked = reduceHarthmereLiveModeBackendState(
        state,
        envelope(
          { abilityId: "basic_strike" },
          {
            actionKind: "request_attack",
            targetId: HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
            serverActorPosition: {
              x: anchor[0] + 2,
              y: anchor[1],
              z: anchor[2],
            },
            serverTargetPosition: {
              x: anchor[0],
              y: anchor[1],
              z: anchor[2],
            },
          }
        ),
        NOW_MS
      );
      const rejected = attacked.summary.warnings.filter((w: string) =>
        w.startsWith("combat_rejected")
      );
      assert.deepEqual(rejected, [], attacked.summary.warnings.join(","));
      const snapshot =
        attacked.state.combat.entitySnapshots[
          HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID
        ];
      const machine = attacked.state.quests.bible.thaedryn!;
      assert.ok(machine.healthPct < 100, "attack must reach the machine");
      assert.equal(
        snapshot.hp,
        Math.round((machine.healthPct / 100) * HARTHMERE_THAEDRYN_MAX_HP),
        "snapshot hp must be re-synced FROM the machine (machine wins)"
      );
    });

    it("slay resolution completes objectives, grants path rewards, turn-in removes the boss", () => {
      let state = q12ActiveState();
      const boss = (payload: Record<string, unknown>) => {
        const reduced = reduce(state, {
          operation: "bible_quest_boss_event",
          questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
          ...payload,
        });
        assert.ok(
          !reduced.summary.warnings.some((w: string) =>
            w.startsWith("thaedryn_rejected")
          ),
          reduced.summary.warnings.join(",")
        );
        state = reduced.state;
      };
      for (let i = 0; i < 4; i++) boss({ bossEventType: "break_chain" });
      boss({ bossEventType: "damage", bossEventAmount: 100 });
      boss({ bossEventType: "choose_path", bossEventPath: "slay" });
      const goldBefore = state.inventory.gold;
      boss({ bossEventType: "resolve" });
      // Path rewards granted (slay: 650 silver + trophy items).
      assert.ok(state.inventory.gold > goldBefore, "path silver must grant");
      assert.ok(
        (state.inventory.items["thaedryn_s_tooth"] ?? 0) >= 1,
        "slay trophy must land in inventory"
      );
      assert.equal(
        state.quests.active[HARTHMERE_BIBLE_DRAGON_QUEST_ID]?.stepId,
        undefined
      );
      assert.equal(
        state.quests.active[HARTHMERE_BIBLE_DRAGON_QUEST_ID]?.progress,
        1
      );
      // Turn in Q12: quest rewards on top, boss snapshot removed.
      const done = reduce(state, {
        operation: "bible_quest_complete",
        questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
      });
      assert.equal(
        done.state.combat.entitySnapshots[HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID],
        undefined,
        "encounter over: the boss snapshot must be removed"
      );
      assert.ok(done.state.quests.completed[HARTHMERE_BIBLE_DRAGON_QUEST_ID]);
      assert.ok(
        done.state.quests.bible.flags.includes("post_main_harthmere_state"),
        "Q12 unlock flags must persist"
      );
    });
  });
});
