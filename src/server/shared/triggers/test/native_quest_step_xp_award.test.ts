import { QuestExecutor } from "@/server/shared/triggers/roots/quest";
import { BaseStatelessTrigger } from "@/server/shared/triggers/trigger";
import type { TriggerContext } from "@/server/shared/triggers/core";
import { BikkieRuntime } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  Challenges,
  Health,
  Inventory,
  TriggerState,
} from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { FirehoseEvent } from "@/shared/firehose/events";
import {
  harthmereNativeXpForNextLevel,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import {
  NATIVE_QUEST_COMPLETION_BONUS_XP,
  NATIVE_QUEST_STEP_XP_TIERS,
} from "@/shared/harthmere/native_quest_step_xp";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import assert from "assert";

/**
 * End-to-end proof that a native quest STEP moves ECS progression.
 *
 * The unit tests in shared/ cover the reward table and the ECS writes in
 * isolation; this one drives the real `BaseTrigger.update` edge so a future
 * refactor of the trigger engine cannot silently drop the award — the exact
 * failure mode being fixed, where twenty-one Busted steps produced zero XP.
 */

const unrelatedQuestId = 7000000000000001 as BiomesId;

/** A leaf that fires on demand, standing in for craft/collect/talk leaves. */
class TestLeaf extends BaseStatelessTrigger {
  public readonly kind: string;
  private readonly shouldFire: () => boolean;
  constructor(id: BiomesId, kind: string, shouldFire: () => boolean) {
    super({ id, kind } as StoredTriggerDefinition);
    this.kind = kind;
    this.shouldFire = shouldFire;
  }
  protected tick(): boolean {
    return this.shouldFire();
  }
  serialize(): StoredTriggerDefinition {
    return { id: this.spec.id, kind: this.kind } as StoredTriggerDefinition;
  }
}

function player() {
  const inventory = Inventory.create();
  inventory.items.length = 25;
  return new EntityBackedDelta({
    id: 1 as BiomesId,
    challenges: Challenges.create({}),
    trigger_state: TriggerState.create(),
    health: Health.create({ hp: 100, maxHp: 100 }),
    inventory,
  } as Entity);
}

function contextFor(entity: EntityBackedDelta, rootId: BiomesId) {
  const states = new Map<BiomesId, MetaState<any>>();
  const published: FirehoseEvent[] = [];
  return {
    published,
    context: {
      entity,
      events: [],
      rootId,
      publish: (event: FirehoseEvent) => published.push(event),
      updateState: (id: BiomesId, _schema: unknown, fn: (s: any) => any) => {
        const next = fn(states.get(id) ?? {});
        states.set(id, next);
        return next;
      },
      clearState: (id: BiomesId) => states.delete(id),
    } as unknown as TriggerContext,
  };
}

describe("native quest step XP in the trigger engine", () => {
  let priorRuntime: BikkieRuntime | undefined;

  beforeEach(() => {
    priorRuntime = global.bikkieRuntime;
    global.bikkieRuntime = new BikkieRuntime();
    global.bikkieRuntime.registerBiscuits(
      new Map(
        [NATIVE_ROAD_AHEAD_QUEST_ID, NATIVE_BUSTED_QUEST_ID, unrelatedQuestId].map(
          (id) => [
            id,
            {
              id,
              name: `Quest ${id}`,
              displayName: `Quest ${id}`,
              isQuest: true,
              questCategory: "main",
              repeatableCadence: "never",
            } as Biscuit,
          ]
        )
      )
    );
  });

  afterEach(() => {
    if (priorRuntime) {
      global.bikkieRuntime = priorRuntime;
    } else {
      delete (global as { bikkieRuntime?: BikkieRuntime }).bikkieRuntime;
    }
  });

  it("pays a leaf the first time it fires and never again", () => {
    const entity = player();
    const { context } = contextFor(entity, NATIVE_BUSTED_QUEST_ID);
    const leaf = new TestLeaf(900 as BiomesId, "craft", () => true);

    assert.equal(leaf.update(context), true);
    assert.equal(
      readHarthmereNativeCombatProgression(entity.triggerState()).xp,
      NATIVE_QUEST_STEP_XP_TIERS.effort
    );

    // Replayed tick / retried transaction: the leaf is already fired, so the
    // award edge must not run a second time.
    assert.equal(leaf.update(context), true);
    assert.equal(
      readHarthmereNativeCombatProgression(entity.triggerState()).xp,
      NATIVE_QUEST_STEP_XP_TIERS.effort
    );
  });

  it("pays nothing while a leaf has not fired", () => {
    const entity = player();
    const { context } = contextFor(entity, NATIVE_BUSTED_QUEST_ID);
    const leaf = new TestLeaf(901 as BiomesId, "craft", () => false);

    assert.equal(leaf.update(context), false);
    assert.equal(
      readHarthmereNativeCombatProgression(entity.triggerState()).xp,
      0
    );
  });

  it("pays nothing for a quest outside the onboarding chain", () => {
    const entity = player();
    const { context } = contextFor(entity, unrelatedQuestId);
    const leaf = new TestLeaf(902 as BiomesId, "craft", () => true);

    assert.equal(leaf.update(context), true);
    assert.equal(
      readHarthmereNativeCombatProgression(entity.triggerState()).xp,
      0
    );
  });

  it("pays the chapter bonus on the completed transition", () => {
    const entity = player();
    const { context, published } = contextFor(entity, NATIVE_BUSTED_QUEST_ID);
    const quest = new QuestExecutor(
      NATIVE_BUSTED_QUEST_ID,
      undefined,
      undefined,
      undefined
    );

    quest.transitionState(context, "completed");
    // 150 XP crosses the level-1 threshold (100), so the progression root
    // stores level 2 with the 50 XP remainder — `xp` is progress toward the
    // NEXT level, not a lifetime total.
    const progression = readHarthmereNativeCombatProgression(
      entity.triggerState()
    );
    assert.equal(progression.level, 2);
    assert.equal(
      progression.xp,
      NATIVE_QUEST_COMPLETION_BONUS_XP - harthmereNativeXpForNextLevel(1)
    );
    assert.ok(
      published.some((event) => event.kind === "challengeCompleted"),
      "the stock completion event is still published"
    );
    assert.ok(
      published.some(
        (event) =>
          event.kind === "skillLevelUp" &&
          event.skill === "character_level" &&
          event.level === 2
      ),
      "a level-up is announced so leaderboards and the HUD can react"
    );
    assert.equal(entity.health()?.maxHp, harthmereNativeLevelStats(2).maxHp);
  });

  it("derives stats from progression already mutated in the same Delta", () => {
    const entity = player();
    writeHarthmereNativeCombatProgression(entity.mutableTriggerState(), {
      level: 2,
      xp: 185,
    });
    const { context } = contextFor(entity, NATIVE_ROAD_AHEAD_QUEST_ID);
    const quest = new QuestExecutor(
      NATIVE_ROAD_AHEAD_QUEST_ID,
      undefined,
      undefined,
      undefined
    );

    quest.transitionState(context, "completed");
    const progression = readHarthmereNativeCombatProgression(
      entity.triggerState()
    );
    assert.deepEqual(
      { level: progression.level, xp: progression.xp },
      { level: 3, xp: 62 }
    );
    assert.equal(entity.health()?.maxHp, harthmereNativeLevelStats(3).maxHp);
  });

  it("leaves an unrelated quest's completion unpaid", () => {
    const entity = player();
    const { context } = contextFor(entity, unrelatedQuestId);
    const quest = new QuestExecutor(
      unrelatedQuestId,
      undefined,
      undefined,
      undefined
    );

    quest.transitionState(context, "completed");
    assert.equal(
      readHarthmereNativeCombatProgression(entity.triggerState()).xp,
      0
    );
  });
});
