import {
  effectiveHarthmereDeathStateForRespawnV140,
  harthmereLivePlayerDeathSyncSummaryForTestV1,
  type HarthmereDeathState,
} from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
import { harthmereRespawnDisabledReasonV1 } from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import assert from "assert";

describe("Harthmere live death sync", () => {
  const aliveDeathState = (state?: Partial<HarthmereDeathState>) =>
    ({
      version: 1,
      state: "alive",
      deathCount: 0,
      recent: [],
      ...state,
    } satisfies HarthmereDeathState);

  it("treats live hp zero as dead even when the death state string is missing", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTestV1({
      combat: { hp: 0, maxHp: 100 },
    });

    assert.equal(summary.dead, true);
    assert.equal(summary.alive, false);
  });

  it("treats live positive hp and alive state as recovered", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTestV1({
      combat: { hp: 61, maxHp: 240, deathState: "alive" },
    });

    assert.equal(summary.dead, false);
    assert.equal(summary.alive, true);
  });

  it("does not let a dead live state look alive just because hp is stale positive", () => {
    const summary = harthmereLivePlayerDeathSyncSummaryForTestV1({
      combat: { hp: 61, maxHp: 240, deathState: "dead" },
    });

    assert.equal(summary.dead, true);
    assert.equal(summary.alive, false);
  });

  it("makes a local hp-zero player immediately respawnable at The Grove", () => {
    const effective = effectiveHarthmereDeathStateForRespawnV140({
      death: aliveDeathState(),
      combatHp: 0,
      combatMaxHp: 240,
      combatState: "idle",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.equal(effective.currentDeath?.cause, "HP reached zero");
    assert.equal(
      harthmereRespawnDisabledReasonV1(effective, "the_grove"),
      undefined
    );
  });

  it("makes a dead combat-state player respawnable even if hp has not caught up", () => {
    const effective = effectiveHarthmereDeathStateForRespawnV140({
      death: aliveDeathState(),
      combatHp: 61,
      combatMaxHp: 240,
      combatState: "dead",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.match(effective.currentDeath?.cause ?? "", /Combat state is dead/);
    assert.equal(
      harthmereRespawnDisabledReasonV1(effective, "the_grove"),
      undefined
    );
  });

  it("makes a live hp-zero player status respawnable before local storage catches up", () => {
    const effective = effectiveHarthmereDeathStateForRespawnV140({
      death: aliveDeathState(),
      combatHp: 240,
      combatMaxHp: 240,
      combatState: "idle",
      liveHp: 0,
      liveDeathState: "alive",
      nowMs: 1_800_000,
    });

    assert.equal(effective.state, "dead");
    assert.equal(effective.currentDeath?.cause, "HP reached zero");
    assert.equal(
      harthmereRespawnDisabledReasonV1(effective, "the_grove"),
      undefined
    );
  });

  it("preserves an existing locked death record instead of overwriting the recap", () => {
    const death = aliveDeathState({
      state: "downed",
      currentDeath: {
        deathId: "existing",
        state: "downed",
        zone: "Harthmere",
        position: [1, 2, 3],
        cause: "Mucker Bite reduced you to 0 HP",
        killerType: "npc",
        killerName: "Mucker",
        damageSummary: [],
        durabilityLossPercent: 5,
        xpDebt: 0,
        corpsePosition: [1, 2, 3],
        availableRespawns: ["the_grove"],
        createdAt: 1_700_000,
      },
    });

    const effective = effectiveHarthmereDeathStateForRespawnV140({
      death,
      combatHp: 0,
      combatMaxHp: 240,
      combatState: "dead",
      nowMs: 1_800_000,
    });

    assert.strictEqual(effective, death);
    assert.equal(effective.currentDeath?.deathId, "existing");
  });

  it("does not turn normal positive-hp combat into a death screen", () => {
    const death = aliveDeathState();
    const effective = effectiveHarthmereDeathStateForRespawnV140({
      death,
      combatHp: 240,
      combatMaxHp: 240,
      combatState: "idle",
      liveHp: 240,
      liveDeathState: "alive",
      nowMs: 1_800_000,
    });

    assert.strictEqual(effective, death);
  });
});
