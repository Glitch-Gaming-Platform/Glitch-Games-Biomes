import assert from "assert";
import {
  describeHarthmereDeathInterfaceV1,
  describeHarthmereMultiplayerCombatInterfaceV1,
  getHarthmereCombatantActionBlockReasonV1,
  getHarthmereMultiplayerAttackDisabledReasonV1,
  HARTHMERE_COMBAT_INTERFACE_KEY_COPY_V1,
  harthmereRespawnDisabledReasonV1,
} from "./harthmereCombatDeathInterfaceRules";

function assertReasonMatches(
  reason: string | undefined,
  pattern: RegExp,
) {
  assert.match(reason ?? "", pattern);
}

describe("harthmere combat and death interface rules", () => {
  const now = 1_000_000;

  it("keeps combat key copy aligned with the installed H heavy-attack route", () => {
    assert.equal(HARTHMERE_COMBAT_INTERFACE_KEY_COPY_V1.basic, "B");
    assert.equal(HARTHMERE_COMBAT_INTERFACE_KEY_COPY_V1.heavy, "H");
    assert.equal(HARTHMERE_COMBAT_INTERFACE_KEY_COPY_V1.spark, "L");
  });

  it("allows the base PvE combat case while showing PvE reward policy", () => {
    const state = {
      safeZone: false,
      pvpFlag: "unflagged",
      mode: "solo",
      currentTargetOffset: 9001,
    };
    const player = { hp: 100, maxHp: 100, combatState: "idle" };

    const rules = describeHarthmereMultiplayerCombatInterfaceV1(
      state,
      player,
      now,
    );

    assert.equal(rules.canUseHostileActions, true);
    assert.equal(rules.pvpMode, "pve");
    assert.match(rules.rewardPolicySummary, /normal combat credit/i);
    assert.equal(
      getHarthmereMultiplayerAttackDisabledReasonV1(
        "basic",
        state,
        player,
        now,
      ),
      undefined,
    );
  });

  it("blocks combat actions while dead, downed, respawning, or protected", () => {
    for (const combatState of [
      "dead",
      "downed",
      "respawning",
      "protected_after_respawn",
      "invulnerable",
    ]) {
      assertReasonMatches(
        getHarthmereCombatantActionBlockReasonV1({
          hp: combatState === "protected_after_respawn" ? 100 : 0,
          maxHp: 100,
          combatState,
        }),
        /revive|respawn|protection/i,
      );
    }
  });

  it("shows safe-zone PvP boundaries without blocking ordinary NPC target combat", () => {
    const state = {
      safeZone: true,
      pvpFlag: "voluntary_pvp",
      mode: "solo",
      currentTargetOffset: 9003,
    };
    const player = { hp: 100, maxHp: 100, combatState: "idle" };

    const rules = describeHarthmereMultiplayerCombatInterfaceV1(
      state,
      player,
      now,
    );

    assert.equal(rules.canUseHostileActions, true);
    assert.equal(rules.pvpMode, "normal_pvp");
    assert.match(rules.pvpLegalitySummary, /Safe zone/i);
    assert.match(rules.rewardPolicySummary, /no item drop/i);
  });

  it("blocks spawn-protected attacks and surfaces the protection edge case", () => {
    const reason = getHarthmereMultiplayerAttackDisabledReasonV1(
      "heavy",
      {
        pvpFlag: "spawn_protected",
        currentTargetOffset: 9003,
      },
      { hp: 100, maxHp: 100, combatState: "idle" },
      now,
    );

      assertReasonMatches(reason, /Spawn protection/i);
  });

  it("describes duel and hardcore PvP reward/drop policy", () => {
    const duel = describeHarthmereMultiplayerCombatInterfaceV1(
      {
        mode: "duel",
        pvpFlag: "duel_flagged",
        currentTargetOffset: 9003,
      },
      { hp: 100, maxHp: 100, combatState: "idle" },
      now,
    );
    assert.equal(duel.pvpMode, "duel");
    assert.match(duel.rewardPolicySummary, /1 HP/i);
    assert.match(duel.rewardPolicySummary, /no item drop/i);

    const hardcore = describeHarthmereMultiplayerCombatInterfaceV1(
      {
        pvpFlag: "hardcore_pvp",
        currentTargetOffset: 9003,
      },
      { hp: 100, maxHp: 100, combatState: "idle" },
      now,
    );
    assert.equal(hardcore.pvpMode, "hardcore_pvp");
    assert.match(hardcore.rewardPolicySummary, /unbound trade goods/i);
    assert.match(hardcore.rewardPolicySummary, /quest/i);
  });

  it("allows only valid respawn choices for the current death record", () => {
    const death = {
      state: "dead",
      currentDeath: {
        killerType: "npc",
        availableRespawns: ["the_grove"],
      },
    };

    assert.equal(
      harthmereRespawnDisabledReasonV1(death, "the_grove"),
      undefined,
    );
    assertReasonMatches(
      harthmereRespawnDisabledReasonV1(death, "temple_green"),
      /not available/i,
    );
  });

  it("disables revive, release, and respawn controls outside their valid states", () => {
    const alive = describeHarthmereDeathInterfaceV1({ state: "alive" });

    assertReasonMatches(alive.reviveDisabledReason, /downed or dead/i);
    assertReasonMatches(alive.releaseDisabledReason, /downed/i);
    assertReasonMatches(
      harthmereRespawnDisabledReasonV1({ state: "alive" }, "the_grove"),
      /downed, dead, or ghosted/i,
    );
  });

  it("summarizes PvP death penalties and hardcore revive restrictions", () => {
    const normalPvp = describeHarthmereDeathInterfaceV1({
      state: "dead",
      currentDeath: {
        killerType: "player",
        availableRespawns: ["the_grove"],
      },
    });
    assert.equal(normalPvp.mode, "normal_pvp");
    assert.match(normalPvp.penaltySummary, /no item drop/i);
    assert.equal(normalPvp.reviveDisabledReason, undefined);

    const hardcore = describeHarthmereDeathInterfaceV1({
      state: "dead",
      currentDeath: {
        killerType: "player",
        pvpMode: "hardcore_pvp",
        inventoryDropPolicy:
          "drop_only_unbound_trade_goods_and_gathered_resources",
        availableRespawns: ["the_grove"],
      },
    });
    assert.equal(hardcore.mode, "hardcore_pvp");
    assert.match(hardcore.penaltySummary, /unbound trade goods/i);
    assertReasonMatches(hardcore.reviveDisabledReason, /hardcore PvP/i);
  });
});
