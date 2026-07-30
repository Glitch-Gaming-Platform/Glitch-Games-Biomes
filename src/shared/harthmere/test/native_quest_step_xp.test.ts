/// <reference types="mocha" />

import assert from "assert";
import type { TriggerState } from "@/shared/ecs/gen/components";
import { PLAYER_INVENTORY_SLOTS } from "@/shared/game/inventory";
import type { BiomesId } from "@/shared/ids";
import {
  NATIVE_QUEST_COMPLETION_BONUS_XP,
  NATIVE_QUEST_STEP_XP_TIERS,
  nativeQuestCompletionXp,
  nativeQuestStepXp,
  nativeQuestStepXpTier,
} from "@/shared/harthmere/native_quest_step_xp";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import {
  awardHarthmereNativeQuestCompletionXp,
  awardHarthmereNativeQuestStepXp,
} from "@/shared/harthmere/harthmere_native_quest_xp_award";
import {
  harthmereNativeHealingAmount,
  harthmereNativeLevelStats,
  syncHarthmereNativeLevelStats,
} from "@/shared/harthmere/harthmere_native_level_stats";
import {
  harthmereNativeXpForNextLevel,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";

function emptyTriggerState(): TriggerState {
  return { by_root: new Map() } as unknown as TriggerState;
}

/**
 * Minimal stand-in for the player `Delta` the trigger engine hands us.
 * `hp` is exposed separately from the `health()` accessor so assertions can
 * read the mutated record directly.
 */
function carrier(
  initialHealth?: { hp: number; maxHp: number },
  inventorySlots = PLAYER_INVENTORY_SLOTS
) {
  const state = emptyTriggerState();
  const hp = initialHealth ? { ...initialHealth } : undefined;
  const inventory = { items: new Array<unknown>(inventorySlots) };
  return {
    state,
    hp,
    inventoryState: inventory,
    triggerState: () => state,
    mutableTriggerState: () => state,
    inventory: () => inventory,
    mutableInventory: () => inventory,
    ...(hp
      ? {
          health: () => hp,
          mutableHealth: () => hp,
        }
      : {}),
  };
}

describe("native quest step XP", () => {
  it("tiers steps by what the player actually did", () => {
    assert.equal(nativeQuestStepXpTier({ triggerKind: "craft" }), "effort");
    assert.equal(nativeQuestStepXpTier({ triggerKind: "collect" }), "effort");
    assert.equal(
      nativeQuestStepXpTier({ triggerKind: "challengeClaimRewards" }),
      "narrative"
    );
    assert.equal(
      nativeQuestStepXpTier({
        triggerKind: "event",
        eventKind: "completeQuestStepAtEntity",
      }),
      "narrative"
    );
    assert.equal(
      nativeQuestStepXpTier({ triggerKind: "event", eventKind: "npcKilled" }),
      "combat"
    );
    // Bookkeeping leaves fire from another quest's state, not from the player.
    assert.equal(
      nativeQuestStepXpTier({ triggerKind: "challengeUnlocked" }),
      undefined
    );
  });

  it("pays only the four one-shot onboarding chapters", () => {
    for (const questId of [
      NATIVE_ROAD_AHEAD_QUEST_ID,
      NATIVE_BUSTED_QUEST_ID,
      NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      NATIVE_MUCK_VS_MACHINE_QUEST_ID,
    ]) {
      assert.equal(
        nativeQuestStepXp({ questId, triggerKind: "craft" }),
        NATIVE_QUEST_STEP_XP_TIERS.effort
      );
      assert.equal(
        nativeQuestCompletionXp(questId),
        NATIVE_QUEST_COMPLETION_BONUS_XP
      );
    }
    // A repeatable/unrelated quest clears its trigger root on reset, so paying
    // per-leaf XP there would be farmable.
    assert.equal(
      nativeQuestStepXp({ questId: 12345 as BiomesId, triggerKind: "craft" }),
      0
    );
    assert.equal(nativeQuestCompletionXp(12345 as BiomesId), 0);
  });

  it("never pays aggregate nodes", () => {
    assert.equal(
      nativeQuestStepXp({
        questId: NATIVE_BUSTED_QUEST_ID,
        triggerKind: "seq",
        isLeaf: false,
      }),
      0
    );
  });

  it("writes XP into the ECS progression root and reports the level", () => {
    const entity = carrier({ hp: 90, maxHp: 100 });
    const result = awardHarthmereNativeQuestStepXp(entity, {
      questId: NATIVE_BUSTED_QUEST_ID,
      triggerKind: "craft",
    });
    assert.ok(result);
    assert.equal(result.xpAwarded, NATIVE_QUEST_STEP_XP_TIERS.effort);
    assert.equal(
      readHarthmereNativeCombatProgression(entity.state).xp,
      NATIVE_QUEST_STEP_XP_TIERS.effort
    );
    assert.equal(result.leveledUp, false);
  });

  it("returns undefined for an ineligible step so no ECS write happens", () => {
    const entity = carrier();
    assert.equal(
      awardHarthmereNativeQuestStepXp(entity, {
        questId: 999 as BiomesId,
        triggerKind: "craft",
      }),
      undefined
    );
    assert.equal(entity.state.by_root.size, 0);
  });

  it("levels up and raises HP/mana/stamina ceilings together", () => {
    const entity = carrier({ hp: 100, maxHp: 100 });
    // One short of level 2.
    writeHarthmereNativeCombatProgression(entity.state, {
      xp: harthmereNativeXpForNextLevel(1) - 1,
    });
    const result = awardHarthmereNativeQuestCompletionXp(
      entity,
      NATIVE_BUSTED_QUEST_ID
    );
    assert.ok(result);
    assert.equal(result.leveledUp, true);
    assert.equal(result.levelAfter, 2);

    const expected = harthmereNativeLevelStats(2);
    assert.equal(result.maxHp, expected.maxHp);
    assert.equal(entity.hp!.maxHp, expected.maxHp);
    // The ceiling gain carries into the current value, so the fraction on the
    // HUD never regresses on level-up.
    assert.equal(entity.hp!.hp, expected.maxHp);

    const vitals = readHarthmereNativeVitals(entity.state);
    assert.equal(vitals.maxMana, expected.maxMana);
    assert.equal(vitals.maxStamina, expected.maxStamina);
  });

  it("keeps level 1 neutral while exposing the complete stat block", () => {
    const levelOne = harthmereNativeLevelStats(1);
    assert.equal(levelOne.maxHp, 100);
    assert.equal(levelOne.maxMana, 100);
    assert.equal(levelOne.maxStamina, 100);
    assert.equal(levelOne.strength, 10);
    assert.equal(levelOne.dexterity, 10);
    assert.equal(levelOne.intelligence, 10);
    assert.equal(levelOne.defense, 0);
    assert.equal(levelOne.armor, 0);
    assert.equal(levelOne.evasion, 0);
    assert.equal(levelOne.accuracy, 75);
    assert.equal(levelOne.criticalChance, 0);
    assert.equal(levelOne.spellPower, 0);
    assert.equal(levelOne.healingPower, 0);
    assert.equal(levelOne.movementSpeed, 1);
    assert.equal(levelOne.carryCapacity, 25);
    assert.equal(levelOne.inventorySlots, PLAYER_INVENTORY_SLOTS);
  });

  it("raises every requested attribute as level increases", () => {
    const low = harthmereNativeLevelStats(1);
    const high = harthmereNativeLevelStats(20);
    for (const key of [
      "strength",
      "dexterity",
      "intelligence",
      "defense",
      "armor",
      "evasion",
      "accuracy",
      "criticalChance",
      "spellPower",
      "healingPower",
      "movementSpeed",
      "carryCapacity",
      "inventorySlots",
    ] as const) {
      assert.ok(high[key] > low[key], `${key} should rise with level`);
    }
    assert.ok(harthmereNativeHealingAmount(20, 100) > 100);
  });

  it("re-syncing at the same level changes nothing", () => {
    const entity = carrier({ hp: 40, maxHp: 100 });
    assert.equal(syncHarthmereNativeLevelStats(entity).changed, false);
    assert.equal(entity.hp!.hp, 40);
    assert.equal(entity.hp!.maxHp, 100);
  });

  it("repairs a save that leveled before stats were wired up", () => {
    const entity = carrier({ hp: 100, maxHp: 100 });
    writeHarthmereNativeCombatProgression(entity.state, { level: 5 });
    const sync = syncHarthmereNativeLevelStats(entity);
    assert.equal(sync.changed, true);
    assert.equal(entity.hp!.maxHp, harthmereNativeLevelStats(5).maxHp);
  });

  it("expands the authoritative backpack at carry-capacity milestones", () => {
    const entity = carrier({ hp: 100, maxHp: 100 });
    writeHarthmereNativeCombatProgression(entity.state, { level: 5 });
    const sync = syncHarthmereNativeLevelStats(entity);
    assert.equal(sync.inventorySlotsGained, 1);
    assert.equal(
      entity.inventoryState.items.length,
      harthmereNativeLevelStats(5).inventorySlots
    );
  });

  it("repairs legacy 26-slot saves to the 40-slot native baseline", () => {
    const entity = carrier({ hp: 100, maxHp: 100 }, 26);
    const sync = syncHarthmereNativeLevelStats(entity);
    assert.equal(sync.inventorySlotsGained, PLAYER_INVENTORY_SLOTS - 26);
    assert.equal(entity.inventoryState.items.length, PLAYER_INVENTORY_SLOTS);
  });

  it("does not resurrect a dead player through a level-up", () => {
    const entity = carrier({ hp: 0, maxHp: 100 });
    writeHarthmereNativeCombatProgression(entity.state, { level: 3 });
    syncHarthmereNativeLevelStats(entity);
    assert.equal(entity.hp!.hp, 0);
    assert.equal(entity.hp!.maxHp, harthmereNativeLevelStats(3).maxHp);
  });
});
