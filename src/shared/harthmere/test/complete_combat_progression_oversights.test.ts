import assert from "assert";
import {
  selectHarthmereDeathDropItems,
  validateHarthmereAbilityUse,
  type HarthmerePlayerProgressionState,
} from "../complete_combat_progression";

const NOW = 1_700_000_000_000;

function state(
  overrides: Partial<HarthmerePlayerProgressionState> = {}
): HarthmerePlayerProgressionState {
  return {
    playerId: "p1",
    classId: "warrior",
    level: 10,
    xp: 0,
    attributes: {
      strength: 12,
      dexterity: 10,
      intelligence: 10,
      wisdom: 10,
      constitution: 12,
      charisma: 10,
      perception: 10,
      willpower: 10,
      luck: 10,
    },
    skills: {},
    knownAbilities: ["basic_strike"],
    loadoutAbilityIds: ["basic_strike"],
    resources: { stamina: 100, mana: 100 },
    cooldowns: {},
    equipment: {},
    combatState: "idle",
    serverEntityVersion: 4,
    ...overrides,
  };
}

describe("complete_combat_progression rule oversight fixes", () => {
  it("keeps the base ability validation path working", () => {
    const result = validateHarthmereAbilityUse({
      state: state(),
      abilityId: "basic_strike",
      targetType: "enemy",
      distance: 2,
      hasLineOfSight: true,
      hasFacing: true,
      equippedWeaponTypes: ["sword"],
      nowMs: NOW,
      serverEntityVersion: 4,
    });

    assert.equal(result.ok, true);
  });

  it("requires abilities to be known even when the class requirement matches", () => {
    const result = validateHarthmereAbilityUse({
      state: state({
        classId: "mage",
        level: 10,
        knownAbilities: [],
        skills: {
          fire_magic: { level: 25, xpCurrent: 0, xpRequiredNext: 100 },
        },
      }),
      abilityId: "fireball",
      targetType: "enemy",
      distance: 20,
      hasLineOfSight: true,
      hasFacing: true,
      equippedWeaponTypes: ["staff"],
      nowMs: NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "ability_not_known");
  });

  it("blocks dead, downed, respawning, and teleporting actors from casting", () => {
    for (const combatState of [
      "dead",
      "downed",
      "respawning",
      "teleporting",
    ] as const) {
      const result = validateHarthmereAbilityUse({
        state: state({ combatState }),
        abilityId: "basic_strike",
        targetType: "enemy",
        distance: 2,
        hasLineOfSight: true,
        hasFacing: true,
        equippedWeaponTypes: ["sword"],
        nowMs: NOW,
      });

      assert.equal(result.ok, false, combatState);
      assert.equal(
        result.reason,
        "dead_downed_or_transitioning_player_cannot_use_ability"
      );
    }
  });

  it("rejects target-type mismatches before range and damage resolution", () => {
    const result = validateHarthmereAbilityUse({
      state: state(),
      abilityId: "basic_strike",
      targetType: "ally",
      distance: 2,
      hasLineOfSight: true,
      hasFacing: true,
      equippedWeaponTypes: ["sword"],
      nowMs: NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalid_target_type");
  });

  it("does not drop inventory outside hardcore PvP", () => {
    const result = selectHarthmereDeathDropItems({
      mode: "pvp",
      candidates: [
        {
          itemId: "iron_ore",
          count: 5,
          category: "gathered_resource",
          binding: "none",
        },
      ],
    });

    assert.deepEqual(result.itemIds, []);
    assert.deepEqual(result.stacks, {});
    assert.ok(result.reasons.includes("normal_pvp_death_no_inventory_destroy"));
  });

  it("drops only unbound trade goods and gathered resources in hardcore PvP", () => {
    const result = selectHarthmereDeathDropItems({
      mode: "hardcore_pvp",
      candidates: [
        {
          itemId: "iron_ore",
          count: 5,
          category: "gathered_resource",
          binding: "none",
        },
        {
          itemId: "silk_bundle",
          count: 2,
          category: "trade_good",
          binding: "none",
        },
        {
          itemId: "bound_sword",
          count: 1,
          category: "weapon",
          binding: "on_pickup",
          boundToActorId: "p1",
        },
        {
          itemId: "story_key",
          count: 1,
          category: "keyring",
          binding: "quest",
          questItem: true,
        },
        {
          itemId: "festival_hat",
          count: 1,
          category: "cosmetic",
          binding: "none",
        },
        {
          itemId: "account_coin",
          count: 100,
          category: "currency",
          binding: "none",
        },
      ],
    });

    assert.deepEqual(result.stacks, { iron_ore: 5, silk_bundle: 2 });
    assert.deepEqual(result.itemIds.sort(), ["iron_ore", "silk_bundle"]);
    assert.ok(
      result.reasons.includes(
        "drop_only_unbound_trade_goods_and_gathered_resources"
      )
    );
    assert.ok(
      result.reasons.includes(
        "bound_quest_spellbook_mount_pet_cosmetic_keyring_protected"
      )
    );
    assert.ok(
      result.reasons.includes("non_trade_resource_death_drop_suppressed")
    );
  });
});
