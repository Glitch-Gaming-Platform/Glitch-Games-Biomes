import assert from "assert";

import type { TriggerContext } from "@/server/shared/triggers/core";
import { QuestExecutor } from "@/server/shared/triggers/roots/quest";
import { deserializeTrigger } from "@/server/shared/triggers/serde";
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
import { anItem } from "@/shared/game/item";
import { countOf, createBag } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { NATIVE_GIMME_SHELTER_QUEST_ID } from "@/shared/harthmere/native_road_ahead_contract";
import {
  NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
  NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS,
  NATIVE_BREADY_SET_GROW_QUEST_ID,
  NATIVE_BREADY_SET_GROW_STEP_IDS,
  NATIVE_FISH_FOOD_QUEST_ID,
  NATIVE_FISH_FOOD_STEP_IDS,
  NATIVE_HOEDOWN_QUEST_ID,
  NATIVE_HOEDOWN_STEP_IDS,
  NATIVE_IN_STORAGE_QUEST_ID,
  NATIVE_IN_STORAGE_STEP_IDS,
  NATIVE_PARCEL_PURSUIT_QUEST_ID,
  NATIVE_PARCEL_PURSUIT_STEP_IDS,
  NATIVE_POST_GIMME_GIVER_ENTITY_IDS,
  NATIVE_POST_GIMME_ITEM_IDS,
  NATIVE_POST_GIMME_ORDERED_STEP_IDS,
  NATIVE_POST_GIMME_SEED_PLANT_UNLOCK_COUNT,
} from "@/shared/harthmere/native_post_gimme_contract";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";

/**
 * End-to-end progression coverage for the six original-snapshot quests that
 * follow Gimme Shelter.
 *
 * This drives the REAL trigger engine — `deserializeTrigger`, the real leaf
 * classes, `SeqTrigger`, and `QuestExecutor` — over the authored trigger trees
 * transcribed verbatim from the `data-snapshot-2026-05-16` Bikkie tray. Nothing
 * about progression is re-implemented here; the fixtures below are exactly what
 * the tray stores, minus reward bags (which belong to the inventory subsystem
 * and are covered separately by `challenge_claim_rewards_roundtrip.test.ts`).
 *
 * It is deliberately a pure in-memory test: no Redis, no ECS backend, no
 * browser. The whole file runs in milliseconds so it can gate every change to
 * the post-Gimme arc.
 */

const G = NATIVE_POST_GIMME_GIVER_ENTITY_IDS;
const I = NATIVE_POST_GIMME_ITEM_IDS;
const PLAYER_ID = 1 as BiomesId;
const ROBOT_ID = 999 as BiomesId;
const MUCKERHORN_MINES_MINIGAME_ID = 5221984236294250 as BiomesId;

function robotStep(id: BiomesId, name: string): StoredTriggerDefinition {
  return {
    kind: "completeQuestStepAtMyRobot",
    id,
    name,
    allowDefaultNavigationAid: true,
  } as StoredTriggerDefinition;
}

function claimStep(
  id: BiomesId,
  name: string,
  returnNpcTypeId: BiomesId
): StoredTriggerDefinition {
  return {
    kind: "challengeClaimRewards",
    id,
    name,
    allowDefaultNavigationAid: true,
    returnNpcTypeId,
  } as StoredTriggerDefinition;
}

function seq(
  id: number,
  ...triggers: StoredTriggerDefinition[]
): StoredTriggerDefinition {
  return { kind: "seq", id: id as BiomesId, triggers } as StoredTriggerDefinition;
}

/** Authored trigger trees, transcribed from the May 16 snapshot tray. */
const AUTHORED_TRIGGERS: ReadonlyMap<BiomesId, StoredTriggerDefinition> =
  new Map([
    [
      NATIVE_HOEDOWN_QUEST_ID,
      seq(
        3898227081645204,
        robotStep(
          NATIVE_HOEDOWN_STEP_IDS.VIEW_TRANSMISSION_FROM_BUDD,
          "View Transmission from Budd"
        ),
        {
          kind: "event",
          id: NATIVE_HOEDOWN_STEP_IDS.PLANT_NINE_SEEDS,
          name: "Plant {count}/{countTarget} Raspberry Seeds",
          eventKind: "plantSeed",
          count: 9,
          predicate: {
            kind: "object",
            fields: [
              ["seed", { kind: "anyItemEqual", bikkieId: I.RASPBERRY_SEED }],
            ],
          },
        } as unknown as StoredTriggerDefinition,
        {
          kind: "event",
          id: NATIVE_HOEDOWN_STEP_IDS.GROW_NINE_SEEDS,
          name: "Wait for {count}/{countTarget} Raspberry Seeds to grow",
          eventKind: "growSeed",
          count: 9,
          predicate: {
            kind: "object",
            fields: [
              ["seed", { kind: "anyItemEqual", bikkieId: I.RASPBERRY_SEED }],
            ],
          },
        } as unknown as StoredTriggerDefinition,
        {
          kind: "inventoryHas",
          id: NATIVE_HOEDOWN_STEP_IDS.HARVEST_NINE_RASPBERRIES,
          name: "Harvest {count}/{countTarget} Raspberry Bushes",
          item: { id: I.RASPBERRY },
          count: 9,
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_HOEDOWN_STEP_IDS.DELIVER_RASPBERRY_TO_BUDD,
          "Deliver a Raspberry to Budd Sower",
          G.BUDD_SOWER
        ),
        claimStep(
          NATIVE_HOEDOWN_STEP_IDS.TALK_WITH_BUDD,
          "Talk with Budd Sower",
          G.BUDD_SOWER
        ),
        claimStep(
          NATIVE_HOEDOWN_STEP_IDS.ASK_BUDD_ABOUT_SELLING,
          "Ask Budd about selling crops",
          G.BUDD_SOWER
        ),
        {
          kind: "event",
          id: NATIVE_HOEDOWN_STEP_IDS.SELL_RASPBERRIES_TO_PETUNIA,
          name: "Sell some Raspberries to Petunia",
          navigationAid: { kind: "entity", id: G.PETUNIA_FRUIT_BUYER },
          eventKind: "sell_to_entity",
          count: 1,
          predicate: {
            kind: "object",
            fields: [["bag", { kind: "anyItemEqual", bikkieId: I.RASPBERRY }]],
          },
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_HOEDOWN_STEP_IDS.RETURN_TO_BUDD_FOR_SIGN,
          "Return to Budd Sower",
          G.BUDD_SOWER
        ),
        {
          kind: "place",
          id: NATIVE_HOEDOWN_STEP_IDS.PLACE_WOOD_SIGN,
          name: "Place a Wood Sign at your home",
          item: { id: I.WOOD_SIGN },
          count: 1,
        } as unknown as StoredTriggerDefinition,
        robotStep(
          NATIVE_HOEDOWN_STEP_IDS.CHECK_IN_WITH_ROBOT,
          "Check in with your Robot"
        )
      ),
    ],
    [
      NATIVE_PARCEL_PURSUIT_QUEST_ID,
      seq(
        924080345886703,
        robotStep(
          NATIVE_PARCEL_PURSUIT_STEP_IDS.VIEW_TRANSMISSION_FROM_SOPHIA,
          "View Transmission from Sophia"
        )
      ),
    ],
    [
      NATIVE_FISH_FOOD_QUEST_ID,
      seq(
        6236336413092144,
        robotStep(
          NATIVE_FISH_FOOD_STEP_IDS.VIEW_TRANSMISSION_FROM_ANNE,
          "View Transmission from Sophia"
        ),
        claimStep(
          NATIVE_FISH_FOOD_STEP_IDS.MEET_ANNE_AT_THE_GROVE,
          "Meet with Anne Choveigh at The Grove",
          G.ANNE_CHOVEIGH
        ),
        {
          kind: "all",
          id: NATIVE_FISH_FOOD_STEP_IDS.CATCH_THREE_FISH,
          triggers: [
            {
              kind: "collect",
              id: NATIVE_FISH_FOOD_STEP_IDS.CATCH_KOI,
              name: "Catch {count}/{countTarget} Koi",
              item: { id: I.KOI },
              count: 1,
            },
            {
              kind: "collect",
              id: NATIVE_FISH_FOOD_STEP_IDS.CATCH_CLOWNFISH,
              name: "Catch {count}/{countTarget} Clownfish",
              item: { id: I.CLOWNFISH },
              count: 1,
            },
            {
              kind: "collect",
              id: NATIVE_FISH_FOOD_STEP_IDS.CATCH_MACKEREL,
              name: "Catch {count}/{countTarget} Mackerel",
              item: { id: I.MACKEREL },
              count: 1,
            },
          ],
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_FISH_FOOD_STEP_IDS.RETURN_TO_ANNE_WITH_FISH,
          "Return to Anne with your fish",
          G.ANNE_CHOVEIGH
        ),
        {
          kind: "event",
          id: NATIVE_FISH_FOOD_STEP_IDS.SELL_FISH_TO_GOLDIE,
          name: "Sell fish to Goldie",
          navigationAid: { kind: "entity", id: G.GOLDIE_FISH_BUYER },
          eventKind: "sell_to_entity",
          count: 1,
          // attributeId 265 is `isFish`.
          predicate: {
            kind: "object",
            fields: [["bag", { kind: "anyItemWith", attributeId: 265 }]],
          },
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_FISH_FOOD_STEP_IDS.RETURN_TO_ANNE,
          "Return to Anne",
          G.ANNE_CHOVEIGH
        ),
        {
          kind: "event",
          id: NATIVE_FISH_FOOD_STEP_IDS.FEED_YOUR_ROBOT,
          name: "Feed your Robot through it's Settings panel",
          navigationAid: { kind: "robot" },
          eventKind: "robotFeed",
          count: 1,
        } as unknown as StoredTriggerDefinition,
        robotStep(
          NATIVE_FISH_FOOD_STEP_IDS.VIEW_ROBOT_LED_MESSAGE,
          "View Message from Robot"
        ),
        {
          kind: "event",
          id: NATIVE_FISH_FOOD_STEP_IDS.PLACE_TWO_LEDS,
          name: "Place {count}/{countTarget} LEDs at your home",
          eventKind: "place",
          count: 2,
          predicate: {
            kind: "object",
            fields: [["item", { kind: "anyItemEqual", bikkieId: I.LED }]],
          },
        } as unknown as StoredTriggerDefinition,
        robotStep(
          NATIVE_FISH_FOOD_STEP_IDS.COLLECT_DYES,
          "Ask your Robot if it's bright enough"
        )
      ),
    ],
    [
      NATIVE_IN_STORAGE_QUEST_ID,
      seq(
        5614080967678434,
        // The snapshot ships this leaf with NO `name`; the projection in
        // native_post_gimme_contract.ts supplies one for every quest surface.
        {
          kind: "completeQuestStepAtMyRobot",
          id: NATIVE_IN_STORAGE_STEP_IDS.VIEW_TRANSMISSION_FROM_OL_COOP,
          allowDefaultNavigationAid: true,
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.VISIT_OL_COOP,
          "Visit Ol' Coop at Muckerhorn Basecamp",
          G.OL_COOP
        ),
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.ASK_OL_COOP_ABOUT_HEALING,
          "Ask Ol' Coop about healing",
          G.OL_COOP
        ),
        {
          kind: "inventoryHas",
          id: NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH,
          name: "Collect {count}/{countTarget} Mucker Teeth from Cobbled Mucklings",
          item: { id: I.MUCKER_TOOTH },
          count: 6,
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP,
          "Return to Ol' Coop",
          G.OL_COOP
        ),
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.CLAIM_RING_FROM_OL_COOP,
          "Claim reward from Ol' Coop",
          G.OL_COOP
        ),
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.TALK_WITH_OL_COOP_ABOUT_STORAGE,
          "Talk with Ol' Coop",
          G.OL_COOP
        ),
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.ASK_LAURIEL_ABOUT_STORING,
          "Ask Lauriel about storing materials",
          G.LAURIEL
        ),
        {
          kind: "event",
          id: NATIVE_IN_STORAGE_STEP_IDS.RACE_THROUGH_MUCKERHORN_MINES,
          name: "Race through Muckerhorn Mines",
          navigationAid: { kind: "entity", id: 2050066389949107 },
          eventKind: "minigame_simple_race_finish",
          count: 1,
          predicate: {
            kind: "object",
            fields: [
              [
                "minigameId",
                { kind: "value", value: MUCKERHORN_MINES_MINIGAME_ID },
              ],
            ],
          },
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.COLLECT_RECIPE_FROM_LAWTO,
          "Tell Lawto that Lauriel sent you",
          G.LAWTO
        ),
        claimStep(
          NATIVE_IN_STORAGE_STEP_IDS.COLLECT_BLING_FROM_LAWTO,
          "Tell Lawto that Lauriel sent you",
          G.LAWTO
        ),
        {
          kind: "event",
          id: NATIVE_IN_STORAGE_STEP_IDS.CRAFT_SMALL_CHEST,
          name: "Craft a Small Chest at your Workbench",
          eventKind: "craft",
          count: 1,
          predicate: {
            kind: "object",
            fields: [["bag", { kind: "anyItemEqual", bikkieId: I.SMALL_CHEST }]],
          },
        } as unknown as StoredTriggerDefinition,
        {
          kind: "event",
          id: NATIVE_IN_STORAGE_STEP_IDS.PLACE_SMALL_CHEST,
          name: "Place the Small Chest at your home",
          eventKind: "place",
          count: 1,
          predicate: {
            kind: "object",
            fields: [["item", { kind: "anyItemEqual", bikkieId: I.SMALL_CHEST }]],
          },
        } as unknown as StoredTriggerDefinition,
        robotStep(
          NATIVE_IN_STORAGE_STEP_IDS.CHECK_IN_WITH_ROBOT,
          "Check in with your Robot"
        )
      ),
    ],
    [
      NATIVE_BREADY_SET_GROW_QUEST_ID,
      seq(
        3519223211240123,
        // Also nameless in the snapshot.
        {
          kind: "completeQuestStepAtMyRobot",
          id: NATIVE_BREADY_SET_GROW_STEP_IDS.VIEW_TRANSMISSION_FROM_NICO,
          allowDefaultNavigationAid: true,
        } as unknown as StoredTriggerDefinition,
        {
          kind: "event",
          id: NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT_SEEDS,
          name: "Harvest {count}/{countTarget} Wheat Seeds from Long Grass",
          eventKind: "collect",
          count: 16,
          predicate: {
            kind: "object",
            fields: [["bag", { kind: "anyItemEqual", bikkieId: I.WHEAT_SEED }]],
          },
        } as unknown as StoredTriggerDefinition,
        {
          kind: "event",
          id: NATIVE_BREADY_SET_GROW_STEP_IDS.GROW_SIXTEEN_WHEAT,
          name: "Grow {count}/{countTarget} Wheat",
          eventKind: "growSeed",
          count: 16,
        } as unknown as StoredTriggerDefinition,
        {
          kind: "inventoryHas",
          id: NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT,
          name: "Head home and harvest {count}/{countTarget} Wheat",
          item: { id: I.WHEAT },
          count: 16,
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_BREADY_SET_GROW_STEP_IDS.DELIVER_WHEAT_TO_NICO,
          "Deliver 16 Wheat to Nico",
          G.NICO_BALLATO
        ),
        claimStep(
          NATIVE_BREADY_SET_GROW_STEP_IDS.RETURN_TO_NICO,
          "Return to Nico",
          G.NICO_BALLATO
        ),
        claimStep(
          NATIVE_BREADY_SET_GROW_STEP_IDS.TALK_TO_NICO,
          "Talk to Nico",
          G.NICO_BALLATO
        )
      ),
    ],
    [
      NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
      seq(
        5099324801869305,
        robotStep(
          NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.VIEW_TRANSMISSION_FROM_SOPHIA,
          "New Transmission from Jackie"
        ),
        {
          kind: "inventoryHas",
          id: NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.EARN_250_BLING,
          name: "Earn {count}/{countTarget} Bling to fill your Power Cell",
          item: { id: I.BLING },
          count: 250,
        } as unknown as StoredTriggerDefinition,
        claimStep(
          NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.GIVE_ITEMS_TO_SOPHIA,
          "Visit Sophia to fill your Power Cell",
          G.SOPHIA
        ),
        claimStep(
          NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.COLLECT_POWER_CELL,
          "Talk to Sophia",
          G.SOPHIA
        ),
        claimStep(
          NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.RETURN_TO_ROBOT,
          "Talk to Sophia",
          G.SOPHIA
        )
      ),
    ],
  ]);

/** Authored `unlock` trees, transcribed from the May 16 snapshot tray. */
const AUTHORED_UNLOCKS: ReadonlyMap<BiomesId, StoredTriggerDefinition> =
  new Map([
    [
      NATIVE_HOEDOWN_QUEST_ID,
      {
        kind: "all",
        id: 7420206684657680 as BiomesId,
        triggers: [
          {
            kind: "challengeComplete",
            id: 8778418736615201,
            challenge: NATIVE_GIMME_SHELTER_QUEST_ID,
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
    [
      NATIVE_PARCEL_PURSUIT_QUEST_ID,
      {
        kind: "seq",
        id: 2057646467401208 as BiomesId,
        triggers: [
          {
            kind: "challengeComplete",
            id: 2812897816425039,
            challenge: NATIVE_GIMME_SHELTER_QUEST_ID,
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
    [
      NATIVE_FISH_FOOD_QUEST_ID,
      {
        kind: "seq",
        id: 517512557603525 as BiomesId,
        triggers: [
          {
            kind: "event",
            id: 3262878775254947,
            eventKind: "plantSeed",
            count: NATIVE_POST_GIMME_SEED_PLANT_UNLOCK_COUNT,
            predicate: {
              kind: "object",
              fields: [
                ["seed", { kind: "anyItemEqual", bikkieId: I.RASPBERRY_SEED }],
              ],
            },
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
    [
      NATIVE_IN_STORAGE_QUEST_ID,
      {
        kind: "seq",
        id: 2566200751649585 as BiomesId,
        triggers: [
          {
            kind: "event",
            id: 5213715060938479,
            eventKind: "plantSeed",
            count: NATIVE_POST_GIMME_SEED_PLANT_UNLOCK_COUNT,
            predicate: {
              kind: "object",
              fields: [
                ["seed", { kind: "anyItemEqual", bikkieId: I.RASPBERRY_SEED }],
              ],
            },
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
    [
      // Authored as a `seq`, deliberately kept as a `seq` here: the point of
      // the "any completion order" test below is that this shape does NOT
      // impose an ordering.
      NATIVE_BREADY_SET_GROW_QUEST_ID,
      {
        kind: "seq",
        id: 618120857751205 as BiomesId,
        triggers: [
          {
            kind: "challengeComplete",
            id: 8859043196322287,
            challenge: NATIVE_FISH_FOOD_QUEST_ID,
          },
          {
            kind: "challengeComplete",
            id: 554723846701568,
            challenge: NATIVE_IN_STORAGE_QUEST_ID,
          },
          {
            kind: "challengeComplete",
            id: 318363251156161,
            challenge: NATIVE_HOEDOWN_QUEST_ID,
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
    [
      NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
      {
        kind: "all",
        id: 1748930587459180 as BiomesId,
        triggers: [
          {
            kind: "challengeComplete",
            id: 5388745939272027,
            challenge: NATIVE_FISH_FOOD_QUEST_ID,
          },
          {
            kind: "challengeComplete",
            id: 8360825381220281,
            challenge: NATIVE_HOEDOWN_QUEST_ID,
          },
          {
            kind: "challengeComplete",
            id: 7511167613574941,
            challenge: NATIVE_IN_STORAGE_QUEST_ID,
          },
        ],
      } as unknown as StoredTriggerDefinition,
    ],
  ]);

const QUEST_GIVERS: ReadonlyMap<BiomesId, BiomesId> = new Map([
  [NATIVE_HOEDOWN_QUEST_ID, G.BUDD_SOWER],
  [NATIVE_PARCEL_PURSUIT_QUEST_ID, G.SOPHIA],
  [NATIVE_FISH_FOOD_QUEST_ID, G.SOPHIA],
  [NATIVE_IN_STORAGE_QUEST_ID, G.OL_COOP],
  [NATIVE_BREADY_SET_GROW_QUEST_ID, G.NICO_BALLATO],
  [NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID, G.SOPHIA],
]);

/**
 * One world of quest executors plus a persistent per-root trigger state store,
 * driven the way `TriggerEngine.processAllTriggers` drives them: every executor
 * sees every event batch.
 */
class PostGimmeWorld {
  readonly player: EntityBackedDelta;
  readonly published: FirehoseEvent[] = [];
  private readonly executors: QuestExecutor[] = [];
  private readonly states = new Map<string, MetaState<any>>();

  constructor() {
    const inventory = Inventory.create();
    inventory.items.length = 36;
    inventory.hotbar.length = 9;
    this.player = new EntityBackedDelta({
      id: PLAYER_ID,
      challenges: Challenges.create({
        complete: new Set([NATIVE_GIMME_SHELTER_QUEST_ID]),
      }),
      trigger_state: TriggerState.create(),
      health: Health.create({ hp: 100, maxHp: 100 }),
      inventory,
    } as Entity);

    for (const [questId, trigger] of AUTHORED_TRIGGERS) {
      this.executors.push(
        new QuestExecutor(
          questId,
          deserializeTrigger(AUTHORED_UNLOCKS.get(questId)!),
          deserializeTrigger(trigger),
          undefined
        )
      );
    }
  }

  private contextFor(rootId: BiomesId, events: FirehoseEvent[]): TriggerContext {
    const key = (id: BiomesId) => `${rootId}:${id}`;
    return {
      entity: this.player,
      events,
      rootId,
      publish: (event: FirehoseEvent) => this.published.push(event),
      updateState: (id: BiomesId, _schema: unknown, fn: (s: any) => any) => {
        const next = fn(this.states.get(key(id)) ?? {});
        this.states.set(key(id), next);
        return next;
      },
      clearState: (id: BiomesId) => this.states.delete(key(id)),
    } as unknown as TriggerContext;
  }

  /** One engine pass: every root sees the same batch, exactly like production. */
  tick(...events: FirehoseEvent[]) {
    for (const executor of this.executors) {
      executor.run(this.contextFor(executor.id, events));
    }
  }

  /** Accept an `available` offer, as the robot transmission screen does. */
  accept(questId: BiomesId) {
    const challenges = this.player.mutableChallenges();
    assert.ok(
      challenges.available.has(questId),
      `quest ${questId} was never offered`
    );
    challenges.available.delete(questId);
    challenges.in_progress.add(questId);
  }

  give(itemId: BiomesId, count: number) {
    const inventory = this.player.mutableInventory();
    const slot = inventory.items.findIndex((entry) => !entry);
    inventory.items[slot] = countOf(itemId, BigInt(count));
  }

  state(questId: BiomesId) {
    const challenges = this.player.challenges();
    if (challenges?.complete.has(questId)) return "complete";
    if (challenges?.in_progress.has(questId)) return "in_progress";
    if (challenges?.available.has(questId)) return "available";
    return "locked";
  }
}

function robotEvent(challenge: BiomesId, stepId: BiomesId): FirehoseEvent {
  return {
    kind: "completeQuestStepAtMyRobot",
    entityId: PLAYER_ID,
    challenge,
    stepId,
    robotId: ROBOT_ID,
  } as unknown as FirehoseEvent;
}

function claimEvent(
  challenge: BiomesId,
  stepId: BiomesId,
  claimFromEntityId: BiomesId
): FirehoseEvent {
  return {
    kind: "completeQuestStepAtEntity",
    entityId: PLAYER_ID,
    challenge,
    stepId,
    claimFromEntityId,
  } as unknown as FirehoseEvent;
}

function plantSeed(): FirehoseEvent {
  return {
    kind: "plantSeed",
    entityId: PLAYER_ID,
    seed: NATIVE_POST_GIMME_ITEM_IDS.RASPBERRY_SEED,
  } as unknown as FirehoseEvent;
}

function growSeed(seed: BiomesId): FirehoseEvent {
  return { kind: "growSeed", entityId: PLAYER_ID, seed } as unknown as FirehoseEvent;
}

function collect(itemId: BiomesId, count: number): FirehoseEvent {
  return {
    kind: "collect",
    entityId: PLAYER_ID,
    mined: false,
    bag: itemBagToString(createBag(countOf(itemId, BigInt(count)))),
  } as unknown as FirehoseEvent;
}

function placeEvent(itemId: BiomesId): FirehoseEvent {
  return {
    kind: "place",
    entityId: PLAYER_ID,
    // A real Item: the `anyItemEqual` matcher checks `isItem(value)` before
    // comparing ids, so a bare `{ id }` literal silently fails to match.
    item: anItem(itemId),
    position: [0, 0, 0],
  } as unknown as FirehoseEvent;
}

function sellToEntity(itemId: BiomesId): FirehoseEvent {
  return {
    kind: "sell_to_entity",
    entityId: PLAYER_ID,
    bag: itemBagToString(createBag(countOf(itemId, 1n))),
  } as unknown as FirehoseEvent;
}

function questBiscuit(id: BiomesId): Biscuit {
  return {
    id,
    name: `quest_${id}`,
    displayName: `Quest ${id}`,
    isQuest: true,
    questGiver: QUEST_GIVERS.get(id),
    repeatableCadence: "never",
  } as Biscuit;
}

describe("post-Gimme native quest progression", () => {
  let priorRuntime: BikkieRuntime | undefined;

  beforeEach(() => {
    priorRuntime = global.bikkieRuntime;
    global.bikkieRuntime = new BikkieRuntime();
    global.bikkieRuntime.registerBiscuits(
      new Map([
        ...[...AUTHORED_TRIGGERS.keys()].map(
          (id) => [id, questBiscuit(id)] as const
        ),
        [
          NATIVE_GIMME_SHELTER_QUEST_ID,
          questBiscuit(NATIVE_GIMME_SHELTER_QUEST_ID),
        ],
        ...Object.values(NATIVE_POST_GIMME_ITEM_IDS).map(
          (id) =>
            [
              id,
              {
                id,
                name: `item_${id}`,
                displayName: `Item ${id}`,
                stackable: 999n,
                // Fish need the attribute the Goldie sale predicate matches.
                ...(id === NATIVE_POST_GIMME_ITEM_IDS.KOI ||
                id === NATIVE_POST_GIMME_ITEM_IDS.CLOWNFISH ||
                id === NATIVE_POST_GIMME_ITEM_IDS.MACKEREL
                  ? { isFish: true }
                  : {}),
              } as Biscuit,
            ] as const
        ),
      ])
    );
  });

  afterEach(() => {
    if (priorRuntime) {
      global.bikkieRuntime = priorRuntime;
    } else {
      delete (global as { bikkieRuntime?: BikkieRuntime }).bikkieRuntime;
    }
  });

  it("offers Hoedown and Parcel Pursuit — and nothing else — once Gimme Shelter completes", () => {
    const world = new PostGimmeWorld();
    world.tick();

    assert.equal(world.state(NATIVE_HOEDOWN_QUEST_ID), "available");
    assert.equal(world.state(NATIVE_PARCEL_PURSUIT_QUEST_ID), "available");
    // The three-quest gate and the mid-Hoedown plant gate are still shut.
    assert.equal(world.state(NATIVE_FISH_FOOD_QUEST_ID), "locked");
    assert.equal(world.state(NATIVE_IN_STORAGE_QUEST_ID), "locked");
    assert.equal(world.state(NATIVE_BREADY_SET_GROW_QUEST_ID), "locked");
    assert.equal(world.state(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID), "locked");
  });

  it("never auto-starts a post-Gimme quest for the player", () => {
    const world = new PostGimmeWorld();
    // Several passes: a repair path that promoted an offer would show up here.
    world.tick();
    world.tick();
    world.tick();
    for (const questId of AUTHORED_TRIGGERS.keys()) {
      assert.notEqual(
        world.state(questId),
        "in_progress",
        `quest ${questId} started itself without the player accepting`
      );
    }
  });

  it("completes Parcel Pursuit from one robot transmission and grants nothing else", () => {
    const world = new PostGimmeWorld();
    world.tick();
    world.accept(NATIVE_PARCEL_PURSUIT_QUEST_ID);
    world.tick(
      robotEvent(
        NATIVE_PARCEL_PURSUIT_QUEST_ID,
        NATIVE_PARCEL_PURSUIT_STEP_IDS.VIEW_TRANSMISSION_FROM_SOPHIA
      )
    );
    assert.equal(world.state(NATIVE_PARCEL_PURSUIT_QUEST_ID), "complete");
    assert.equal(world.state(NATIVE_HOEDOWN_QUEST_ID), "available");
  });

  it("opens Fish Food and In Storage on Hoedown's eighth Raspberry Seed", () => {
    const world = new PostGimmeWorld();
    world.tick();
    world.accept(NATIVE_HOEDOWN_QUEST_ID);
    world.tick(
      robotEvent(
        NATIVE_HOEDOWN_QUEST_ID,
        NATIVE_HOEDOWN_STEP_IDS.VIEW_TRANSMISSION_FROM_BUDD
      )
    );

    for (let planted = 1; planted < 8; planted += 1) {
      world.tick(plantSeed());
      assert.equal(
        world.state(NATIVE_FISH_FOOD_QUEST_ID),
        "locked",
        `Fish Food opened early, after ${planted} plants`
      );
    }
    world.tick(plantSeed());
    assert.equal(world.state(NATIVE_FISH_FOOD_QUEST_ID), "available");
    assert.equal(world.state(NATIVE_IN_STORAGE_QUEST_ID), "available");
    // Hoedown itself still wants a ninth seed.
    assert.equal(world.state(NATIVE_HOEDOWN_QUEST_ID), "in_progress");
  });

  it("plays Hoedown end to end", () => {
    const world = new PostGimmeWorld();
    world.tick();
    world.accept(NATIVE_HOEDOWN_QUEST_ID);
    const q = NATIVE_HOEDOWN_QUEST_ID;
    const S = NATIVE_HOEDOWN_STEP_IDS;

    world.tick(robotEvent(q, S.VIEW_TRANSMISSION_FROM_BUDD));
    for (let i = 0; i < 9; i += 1) world.tick(plantSeed());
    for (let i = 0; i < 9; i += 1) world.tick(growSeed(I.RASPBERRY_SEED));
    world.give(I.RASPBERRY, 9);
    world.tick();
    world.tick(claimEvent(q, S.DELIVER_RASPBERRY_TO_BUDD, G.BUDD_SOWER));
    world.tick(claimEvent(q, S.TALK_WITH_BUDD, G.BUDD_SOWER));
    world.tick(claimEvent(q, S.ASK_BUDD_ABOUT_SELLING, G.BUDD_SOWER));
    world.tick(sellToEntity(I.RASPBERRY));
    world.tick(claimEvent(q, S.RETURN_TO_BUDD_FOR_SIGN, G.BUDD_SOWER));
    world.tick(placeEvent(I.WOOD_SIGN));
    world.tick(robotEvent(q, S.CHECK_IN_WITH_ROBOT));

    assert.equal(world.state(q), "complete");
  });

  it("plays Fish Food end to end", () => {
    const world = new PostGimmeWorld();
    world.tick();
    world.accept(NATIVE_HOEDOWN_QUEST_ID);
    world.tick(
      robotEvent(
        NATIVE_HOEDOWN_QUEST_ID,
        NATIVE_HOEDOWN_STEP_IDS.VIEW_TRANSMISSION_FROM_BUDD
      )
    );
    for (let i = 0; i < 8; i += 1) world.tick(plantSeed());
    world.accept(NATIVE_FISH_FOOD_QUEST_ID);

    const q = NATIVE_FISH_FOOD_QUEST_ID;
    const S = NATIVE_FISH_FOOD_STEP_IDS;
    world.tick(robotEvent(q, S.VIEW_TRANSMISSION_FROM_ANNE));
    world.tick(claimEvent(q, S.MEET_ANNE_AT_THE_GROVE, G.ANNE_CHOVEIGH));
    world.tick(collect(I.KOI, 1), collect(I.CLOWNFISH, 1), collect(I.MACKEREL, 1));
    world.tick(claimEvent(q, S.RETURN_TO_ANNE_WITH_FISH, G.ANNE_CHOVEIGH));
    world.tick(sellToEntity(I.KOI));
    world.tick(claimEvent(q, S.RETURN_TO_ANNE, G.ANNE_CHOVEIGH));
    world.tick({
      kind: "robotFeed",
      entityId: PLAYER_ID,
    } as unknown as FirehoseEvent);
    world.tick(robotEvent(q, S.VIEW_ROBOT_LED_MESSAGE));
    world.tick(placeEvent(I.LED));
    world.tick(placeEvent(I.LED));
    world.tick(robotEvent(q, S.COLLECT_DYES));

    assert.equal(world.state(q), "complete");
  });

  it("plays In Storage end to end, including the six Mucker Teeth", () => {
    const world = new PostGimmeWorld();
    world.tick();
    world.accept(NATIVE_HOEDOWN_QUEST_ID);
    world.tick(
      robotEvent(
        NATIVE_HOEDOWN_QUEST_ID,
        NATIVE_HOEDOWN_STEP_IDS.VIEW_TRANSMISSION_FROM_BUDD
      )
    );
    for (let i = 0; i < 8; i += 1) world.tick(plantSeed());
    world.accept(NATIVE_IN_STORAGE_QUEST_ID);

    const q = NATIVE_IN_STORAGE_QUEST_ID;
    const S = NATIVE_IN_STORAGE_STEP_IDS;
    world.tick(robotEvent(q, S.VIEW_TRANSMISSION_FROM_OL_COOP));
    world.tick(claimEvent(q, S.VISIT_OL_COOP, G.OL_COOP));
    world.tick(claimEvent(q, S.ASK_OL_COOP_ABOUT_HEALING, G.OL_COOP));

    // Five teeth is not enough: the leaf must stay shut. This is the exact
    // objective that was unreachable before the Cobbled Muckling pack existed.
    world.give(I.MUCKER_TOOTH, 5);
    world.tick();
    assert.equal(world.state(q), "in_progress");
    world.tick(claimEvent(q, S.RETURN_TEETH_TO_OL_COOP, G.OL_COOP));
    assert.equal(
      world.state(q),
      "in_progress",
      "a claim must not skip the incomplete inventory gate"
    );

    world.give(I.MUCKER_TOOTH, 1);
    world.tick();
    world.tick(claimEvent(q, S.RETURN_TEETH_TO_OL_COOP, G.OL_COOP));
    world.tick(claimEvent(q, S.CLAIM_RING_FROM_OL_COOP, G.OL_COOP));
    world.tick(claimEvent(q, S.TALK_WITH_OL_COOP_ABOUT_STORAGE, G.OL_COOP));
    world.tick(claimEvent(q, S.ASK_LAURIEL_ABOUT_STORING, G.LAURIEL));
    world.tick({
      kind: "minigame_simple_race_finish",
      entityId: PLAYER_ID,
      minigameId: MUCKERHORN_MINES_MINIGAME_ID,
    } as unknown as FirehoseEvent);
    world.tick(claimEvent(q, S.COLLECT_RECIPE_FROM_LAWTO, G.LAWTO));
    world.tick(claimEvent(q, S.COLLECT_BLING_FROM_LAWTO, G.LAWTO));
    world.tick({
      kind: "craft",
      entityId: PLAYER_ID,
      bag: itemBagToString(createBag(countOf(I.SMALL_CHEST, 1n))),
    } as unknown as FirehoseEvent);
    world.tick(placeEvent(I.SMALL_CHEST));
    world.tick(robotEvent(q, S.CHECK_IN_WITH_ROBOT));

    assert.equal(world.state(q), "complete");
  });

  it("unlocks Bready Set Grow and Battery Not Included only after all three", () => {
    const world = new PostGimmeWorld();
    const challenges = world.player.mutableChallenges();

    challenges.complete.add(NATIVE_HOEDOWN_QUEST_ID);
    world.tick();
    assert.equal(world.state(NATIVE_BREADY_SET_GROW_QUEST_ID), "locked");
    assert.equal(world.state(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID), "locked");

    challenges.complete.add(NATIVE_IN_STORAGE_QUEST_ID);
    world.tick();
    assert.equal(world.state(NATIVE_BREADY_SET_GROW_QUEST_ID), "locked");
    assert.equal(world.state(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID), "locked");

    challenges.complete.add(NATIVE_FISH_FOOD_QUEST_ID);
    world.tick();
    assert.equal(world.state(NATIVE_BREADY_SET_GROW_QUEST_ID), "available");
    assert.equal(world.state(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID), "available");
  });

  it("does not let Bready Set Grow's authored seq impose a completion order", () => {
    // The snapshot authors the three prerequisites inside a `seq`, listed
    // Fish Food -> In Storage -> Hoedown. A player finishing them in the
    // opposite order must still be offered the quest.
    const world = new PostGimmeWorld();
    const challenges = world.player.mutableChallenges();
    challenges.complete.add(NATIVE_HOEDOWN_QUEST_ID);
    world.tick();
    challenges.complete.add(NATIVE_IN_STORAGE_QUEST_ID);
    world.tick();
    challenges.complete.add(NATIVE_FISH_FOOD_QUEST_ID);
    world.tick();

    assert.equal(world.state(NATIVE_BREADY_SET_GROW_QUEST_ID), "available");
  });

  it("plays Bready Set Grow end to end", () => {
    const world = new PostGimmeWorld();
    const challenges = world.player.mutableChallenges();
    challenges.complete.add(NATIVE_HOEDOWN_QUEST_ID);
    challenges.complete.add(NATIVE_IN_STORAGE_QUEST_ID);
    challenges.complete.add(NATIVE_FISH_FOOD_QUEST_ID);
    world.tick();
    world.accept(NATIVE_BREADY_SET_GROW_QUEST_ID);

    const q = NATIVE_BREADY_SET_GROW_QUEST_ID;
    const S = NATIVE_BREADY_SET_GROW_STEP_IDS;
    world.tick(robotEvent(q, S.VIEW_TRANSMISSION_FROM_NICO));
    // This leaf is an `event` (not a `collect`) leaf, so it counts one per
    // HARVEST ACTION rather than per seed: sixteen swings at Switch Grass, not
    // one sixteen-seed bag. Asserted explicitly below.
    for (let i = 0; i < 16; i += 1) world.tick(collect(I.WHEAT_SEED, 1));
    for (let i = 0; i < 16; i += 1) world.tick(growSeed(I.WHEAT_SEED));
    world.give(I.WHEAT, 16);
    world.tick();
    world.tick(claimEvent(q, S.DELIVER_WHEAT_TO_NICO, G.NICO_BALLATO));
    world.tick(claimEvent(q, S.RETURN_TO_NICO, G.NICO_BALLATO));
    world.tick(claimEvent(q, S.TALK_TO_NICO, G.NICO_BALLATO));

    assert.equal(world.state(q), "complete");
  });

  it("plays Battery Not Included end to end", () => {
    const world = new PostGimmeWorld();
    const challenges = world.player.mutableChallenges();
    challenges.complete.add(NATIVE_HOEDOWN_QUEST_ID);
    challenges.complete.add(NATIVE_IN_STORAGE_QUEST_ID);
    challenges.complete.add(NATIVE_FISH_FOOD_QUEST_ID);
    world.tick();
    world.accept(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID);

    const q = NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID;
    const S = NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS;
    world.tick(robotEvent(q, S.VIEW_TRANSMISSION_FROM_SOPHIA));
    world.give(I.BLING, 249);
    world.tick();
    assert.equal(world.state(q), "in_progress");
    world.give(I.BLING, 1);
    world.tick();
    world.tick(claimEvent(q, S.GIVE_ITEMS_TO_SOPHIA, G.SOPHIA));
    world.tick(claimEvent(q, S.COLLECT_POWER_CELL, G.SOPHIA));
    world.tick(claimEvent(q, S.RETURN_TO_ROBOT, G.SOPHIA));

    assert.equal(world.state(q), "complete");
  });

  it("keeps the contract's ordered-step table in sync with the authored trees", () => {
    for (const [questId, trigger] of AUTHORED_TRIGGERS) {
      const ordered = NATIVE_POST_GIMME_ORDERED_STEP_IDS.get(questId);
      assert.ok(ordered, `no ordered step table for quest ${questId}`);
      const authored = (
        trigger as unknown as { triggers: StoredTriggerDefinition[] }
      ).triggers.map((child) => Number(child.id));
      assert.deepEqual(
        ordered!.map(Number),
        authored,
        `ordered step table drifted from the authored seq for quest ${questId}`
      );
    }
  });
});
