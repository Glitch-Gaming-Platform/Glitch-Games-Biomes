import type { NavigationAid } from "@/shared/game/types";
import type { BiomesId } from "@/shared/ids";

/**
 * Native ECS contract for the original Biomes quests that follow Gimme
 * Shelter: Hoedown, Parcel Pursuit, Fish Food, In Storage, Bready Set Grow and
 * Battery Not Included.
 *
 * Source of truth: the Bikkie tray inside `snapshot_backup.json` from the
 * `data-snapshot-2026-05-16` release. Every id below was read out of that tray,
 * not invented here. As with `native_road_ahead_contract.ts` this file is
 * deliberately a table of ids plus a handful of narrow projections — it is NOT
 * a second quest reducer. The stock trigger engine still advances these quests
 * from authoritative ECS/firehose events.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Three classes of problem block these six quests in the restored world, and
 * all three are repaired by data/projection rather than by rewriting triggers:
 *
 *   1. Two snapshot leaves ship with NO authored `name`, so their objective row
 *      renders blank (In Storage step 1, Bready Set Grow step 1).
 *   2. One leaf names a world source that does not exist under that name
 *      ("Long Grass"); the item actually drops from Switch Grass.
 *   3. In Storage requires six Mucker Teeth from "Cobbled Mucklings", a family
 *      the restored Harthmere seed never materializes. That is a hard blocker
 *      and is repaired in `live_entity_production_seed.ts` by seeding a real,
 *      named Cobbled Muckling pack with a guaranteed Mucker Tooth drop; this
 *      file owns the marker that points at it.
 *
 * WHAT IS DELIBERATELY *NOT* DONE HERE
 * ------------------------------------
 * These quests are NOT added to the robot story's automatic-continuation table
 * (`isNativeRobotStoryAutoContinuationQuestId`). Every one of them has an
 * authored `questGiver`, so the stock `QuestExecutor` moves them to `available`
 * and the player accepts them from their robot transmission. Auto-starting six
 * quests the moment Gimme Shelter completes would bury the player's objective
 * list and take the choice of what to play next away from them.
 */

export const NATIVE_HOEDOWN_QUEST_ID = 570573099459937 as BiomesId;
export const NATIVE_PARCEL_PURSUIT_QUEST_ID = 5543792977197888 as BiomesId;
export const NATIVE_FISH_FOOD_QUEST_ID = 6367954120816499 as BiomesId;
export const NATIVE_IN_STORAGE_QUEST_ID = 1543579399492851 as BiomesId;
export const NATIVE_BREADY_SET_GROW_QUEST_ID = 4022264711963940 as BiomesId;
export const NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID =
  4902242789258042 as BiomesId;

/** Gimme Shelter, repeated here to avoid a circular contract import. */
const NATIVE_GIMME_SHELTER_QUEST_ID = 3741112749915015 as BiomesId;

export const NATIVE_POST_GIMME_QUEST_IDS = Object.freeze([
  NATIVE_HOEDOWN_QUEST_ID,
  NATIVE_PARCEL_PURSUIT_QUEST_ID,
  NATIVE_FISH_FOOD_QUEST_ID,
  NATIVE_IN_STORAGE_QUEST_ID,
  NATIVE_BREADY_SET_GROW_QUEST_ID,
  NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
]);

export function isNativePostGimmeQuestId(id: unknown) {
  return NATIVE_POST_GIMME_QUEST_IDS.some(
    (questId) => Number(questId) === Number(id)
  );
}

/**
 * Concrete ECS world entities the snapshot names as quest givers / return
 * targets. These are entity ids, not NPC *type* ids, despite the authored
 * attribute being called `returnNpcTypeId`; the server accepts entity id, NPC
 * type id or placeable item id, and every one of these resolves as an entity.
 * All were confirmed present and un-iced in the May 16 snapshot.
 */
export const NATIVE_POST_GIMME_GIVER_ENTITY_IDS = Object.freeze({
  BUDD_SOWER: 5061424414825022 as BiomesId,
  PETUNIA_FRUIT_BUYER: 5834592310458689 as BiomesId,
  ANNE_CHOVEIGH: 742847586011759 as BiomesId,
  GOLDIE_FISH_BUYER: 2737786140252038 as BiomesId,
  OL_COOP: 8997551883502310 as BiomesId,
  LAURIEL: 2774997429348050 as BiomesId,
  LAWTO: 7383684493514220 as BiomesId,
  NICO_BALLATO: 6514731983358245 as BiomesId,
  SOPHIA: 7976997825186729 as BiomesId,
});

/** Snapshot Bikkie item ids these quests move through player inventory. */
export const NATIVE_POST_GIMME_ITEM_IDS = Object.freeze({
  RASPBERRY_SEED: 7539420629350033 as BiomesId,
  RASPBERRY: 4732724694489497 as BiomesId,
  WOOD_SIGN: 1534621126189418 as BiomesId,
  WOOD_TEXT_SIGN: 1167331920870018 as BiomesId,
  MAILBOX: 3324897590409143 as BiomesId,
  TRAINING_ROD: 5920729553733598 as BiomesId,
  KOI: 7539420629350012 as BiomesId,
  CLOWNFISH: 1534621126189355 as BiomesId,
  MACKEREL: 4537020877769598 as BiomesId,
  LED: 4537020877769811 as BiomesId,
  MUCKER_TOOTH: 1534621126189454 as BiomesId,
  SMALL_CHEST_RECIPE: 1534621126189442 as BiomesId,
  SMALL_CHEST: 7539420629350138 as BiomesId,
  WHEAT_SEED: 1534621126189364 as BiomesId,
  WHEAT: 4647276549161506 as BiomesId,
  SWITCH_GRASS: 7539420629350336 as BiomesId,
  BLING: 1534621126189715 as BiomesId,
  EMPTY_POWER_CELL: 456182840394405 as BiomesId,
  POWER_CELL: 3272526146499364 as BiomesId,
});

export const NATIVE_HOEDOWN_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_BUDD: 5527943724403210 as BiomesId,
  PLANT_NINE_SEEDS: 6403098116074364 as BiomesId,
  GROW_NINE_SEEDS: 7900507953161025 as BiomesId,
  HARVEST_NINE_RASPBERRIES: 642928383815041 as BiomesId,
  DELIVER_RASPBERRY_TO_BUDD: 150912450227071 as BiomesId,
  TALK_WITH_BUDD: 1017797666542679 as BiomesId,
  ASK_BUDD_ABOUT_SELLING: 2219584484713446 as BiomesId,
  SELL_RASPBERRIES_TO_PETUNIA: 2059024663248979 as BiomesId,
  RETURN_TO_BUDD_FOR_SIGN: 4126318501836925 as BiomesId,
  PLACE_WOOD_SIGN: 6525068452552904 as BiomesId,
  CHECK_IN_WITH_ROBOT: 1844026104036511 as BiomesId,
});

export const NATIVE_PARCEL_PURSUIT_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_SOPHIA: 7734435348155291 as BiomesId,
});

export const NATIVE_FISH_FOOD_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_ANNE: 1726879453181138 as BiomesId,
  MEET_ANNE_AT_THE_GROVE: 2602033844849937 as BiomesId,
  CATCH_THREE_FISH: 1363724835535755 as BiomesId,
  CATCH_KOI: 8009385428659277 as BiomesId,
  CATCH_CLOWNFISH: 2509005622115490 as BiomesId,
  CATCH_MACKEREL: 4638318275863083 as BiomesId,
  RETURN_TO_ANNE_WITH_FISH: 3887890612454850 as BiomesId,
  SELL_FISH_TO_GOLDIE: 3626033392900162 as BiomesId,
  RETURN_TO_ANNE: 7325800266031323 as BiomesId,
  FEED_YOUR_ROBOT: 3637058960040560 as BiomesId,
  VIEW_ROBOT_LED_MESSAGE: 4077392547659762 as BiomesId,
  PLACE_TWO_LEDS: 3889268808348908 as BiomesId,
  COLLECT_DYES: 7992847077951929 as BiomesId,
});

export const NATIVE_IN_STORAGE_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_OL_COOP: 6229445433632765 as BiomesId,
  VISIT_OL_COOP: 4581123146328907 as BiomesId,
  ASK_OL_COOP_ABOUT_HEALING: 7454661581970631 as BiomesId,
  COLLECT_SIX_MUCKER_TEETH: 5106215781331210 as BiomesId,
  RETURN_TEETH_TO_OL_COOP: 3825871797297435 as BiomesId,
  CLAIM_RING_FROM_OL_COOP: 6931636240808545 as BiomesId,
  TALK_WITH_OL_COOP_ABOUT_STORAGE: 3413791225472651 as BiomesId,
  ASK_LAURIEL_ABOUT_STORING: 6746268893281322 as BiomesId,
  RACE_THROUGH_MUCKERHORN_MINES: 6562968839593503 as BiomesId,
  COLLECT_RECIPE_FROM_LAWTO: 5872492697503026 as BiomesId,
  COLLECT_BLING_FROM_LAWTO: 3519223211240927 as BiomesId,
  CRAFT_SMALL_CHEST: 8692281493342059 as BiomesId,
  PLACE_SMALL_CHEST: 2609613922261616 as BiomesId,
  CHECK_IN_WITH_ROBOT: 6130215329381198 as BiomesId,
});

export const NATIVE_BREADY_SET_GROW_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_NICO: 7990090686166543 as BiomesId,
  HARVEST_SIXTEEN_WHEAT_SEEDS: 978519083611988 as BiomesId,
  GROW_SIXTEEN_WHEAT: 1362346639643668 as BiomesId,
  HARVEST_SIXTEEN_WHEAT: 2535191344071716 as BiomesId,
  DELIVER_WHEAT_TO_NICO: 8630262678183348 as BiomesId,
  RETURN_TO_NICO: 7565606351308905 as BiomesId,
  TALK_TO_NICO: 8448340820387796 as BiomesId,
});

export const NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS = Object.freeze({
  VIEW_TRANSMISSION_FROM_SOPHIA: 7442946916884818 as BiomesId,
  EARN_250_BLING: 3097495268168024 as BiomesId,
  GIVE_ITEMS_TO_SOPHIA: 2952095601518764 as BiomesId,
  COLLECT_POWER_CELL: 6839297116017197 as BiomesId,
  RETURN_TO_ROBOT: 3291131791049149 as BiomesId,
});

/**
 * Authored `seq` order for every post-Gimme quest.
 *
 * Used for client-side preflight only. The server repeats the complete
 * trigger-tree validation in `quest_step_validation.ts`
 * (`prior_step_incomplete`), so this table improves the message a player sees
 * when they talk to an NPC early — it never grants progress.
 */
export const NATIVE_POST_GIMME_ORDERED_STEP_IDS: ReadonlyMap<
  BiomesId,
  readonly BiomesId[]
> = new Map([
  [
    NATIVE_HOEDOWN_QUEST_ID,
    Object.freeze([
      NATIVE_HOEDOWN_STEP_IDS.VIEW_TRANSMISSION_FROM_BUDD,
      NATIVE_HOEDOWN_STEP_IDS.PLANT_NINE_SEEDS,
      NATIVE_HOEDOWN_STEP_IDS.GROW_NINE_SEEDS,
      NATIVE_HOEDOWN_STEP_IDS.HARVEST_NINE_RASPBERRIES,
      NATIVE_HOEDOWN_STEP_IDS.DELIVER_RASPBERRY_TO_BUDD,
      NATIVE_HOEDOWN_STEP_IDS.TALK_WITH_BUDD,
      NATIVE_HOEDOWN_STEP_IDS.ASK_BUDD_ABOUT_SELLING,
      NATIVE_HOEDOWN_STEP_IDS.SELL_RASPBERRIES_TO_PETUNIA,
      NATIVE_HOEDOWN_STEP_IDS.RETURN_TO_BUDD_FOR_SIGN,
      NATIVE_HOEDOWN_STEP_IDS.PLACE_WOOD_SIGN,
      NATIVE_HOEDOWN_STEP_IDS.CHECK_IN_WITH_ROBOT,
    ]),
  ],
  [
    NATIVE_PARCEL_PURSUIT_QUEST_ID,
    Object.freeze([
      NATIVE_PARCEL_PURSUIT_STEP_IDS.VIEW_TRANSMISSION_FROM_SOPHIA,
    ]),
  ],
  [
    NATIVE_FISH_FOOD_QUEST_ID,
    Object.freeze([
      NATIVE_FISH_FOOD_STEP_IDS.VIEW_TRANSMISSION_FROM_ANNE,
      NATIVE_FISH_FOOD_STEP_IDS.MEET_ANNE_AT_THE_GROVE,
      NATIVE_FISH_FOOD_STEP_IDS.CATCH_THREE_FISH,
      NATIVE_FISH_FOOD_STEP_IDS.RETURN_TO_ANNE_WITH_FISH,
      NATIVE_FISH_FOOD_STEP_IDS.SELL_FISH_TO_GOLDIE,
      NATIVE_FISH_FOOD_STEP_IDS.RETURN_TO_ANNE,
      NATIVE_FISH_FOOD_STEP_IDS.FEED_YOUR_ROBOT,
      NATIVE_FISH_FOOD_STEP_IDS.VIEW_ROBOT_LED_MESSAGE,
      NATIVE_FISH_FOOD_STEP_IDS.PLACE_TWO_LEDS,
      NATIVE_FISH_FOOD_STEP_IDS.COLLECT_DYES,
    ]),
  ],
  [
    NATIVE_IN_STORAGE_QUEST_ID,
    Object.freeze([
      NATIVE_IN_STORAGE_STEP_IDS.VIEW_TRANSMISSION_FROM_OL_COOP,
      NATIVE_IN_STORAGE_STEP_IDS.VISIT_OL_COOP,
      NATIVE_IN_STORAGE_STEP_IDS.ASK_OL_COOP_ABOUT_HEALING,
      NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH,
      NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP,
      NATIVE_IN_STORAGE_STEP_IDS.CLAIM_RING_FROM_OL_COOP,
      NATIVE_IN_STORAGE_STEP_IDS.TALK_WITH_OL_COOP_ABOUT_STORAGE,
      NATIVE_IN_STORAGE_STEP_IDS.ASK_LAURIEL_ABOUT_STORING,
      NATIVE_IN_STORAGE_STEP_IDS.RACE_THROUGH_MUCKERHORN_MINES,
      NATIVE_IN_STORAGE_STEP_IDS.COLLECT_RECIPE_FROM_LAWTO,
      NATIVE_IN_STORAGE_STEP_IDS.COLLECT_BLING_FROM_LAWTO,
      NATIVE_IN_STORAGE_STEP_IDS.CRAFT_SMALL_CHEST,
      NATIVE_IN_STORAGE_STEP_IDS.PLACE_SMALL_CHEST,
      NATIVE_IN_STORAGE_STEP_IDS.CHECK_IN_WITH_ROBOT,
    ]),
  ],
  [
    NATIVE_BREADY_SET_GROW_QUEST_ID,
    Object.freeze([
      NATIVE_BREADY_SET_GROW_STEP_IDS.VIEW_TRANSMISSION_FROM_NICO,
      NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT_SEEDS,
      NATIVE_BREADY_SET_GROW_STEP_IDS.GROW_SIXTEEN_WHEAT,
      NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT,
      NATIVE_BREADY_SET_GROW_STEP_IDS.DELIVER_WHEAT_TO_NICO,
      NATIVE_BREADY_SET_GROW_STEP_IDS.RETURN_TO_NICO,
      NATIVE_BREADY_SET_GROW_STEP_IDS.TALK_TO_NICO,
    ]),
  ],
  [
    NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
    Object.freeze([
      NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.VIEW_TRANSMISSION_FROM_SOPHIA,
      NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.EARN_250_BLING,
      NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.GIVE_ITEMS_TO_SOPHIA,
      NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.COLLECT_POWER_CELL,
      NATIVE_BATTERY_NOT_INCLUDED_STEP_IDS.RETURN_TO_ROBOT,
    ]),
  ],
]);

/**
 * The authored unlock graph, transcribed verbatim from the snapshot.
 *
 * Note the two shapes the snapshot actually uses:
 *   * Hoedown / Parcel Pursuit unlock on `challengeComplete(Gimme Shelter)`.
 *   * Fish Food / In Storage unlock on EIGHT `plantSeed` events with a
 *     Raspberry Seed — i.e. partway through Hoedown, not after it.
 *   * Bready Set Grow / Battery Not Included require all three of Hoedown,
 *     Fish Food and In Storage complete.
 *
 * Bready Set Grow authors its three prerequisites inside a `seq`, which reads
 * like an ordering requirement. It is not one: `ChallengeCompleteTrigger` is
 * stateless and answers from the player's current `challenges.complete` set, so
 * a `seq` of three `challengeComplete` leaves passes in a single tick once all
 * three are done, in any completion order. `native_post_gimme_unlock.test.ts`
 * pins that behavior so a future engine change cannot silently make the
 * authored order load-bearing.
 */
export const NATIVE_POST_GIMME_QUEST_PREREQUISITES: ReadonlyMap<
  BiomesId,
  readonly BiomesId[]
> = new Map([
  [NATIVE_HOEDOWN_QUEST_ID, Object.freeze([NATIVE_GIMME_SHELTER_QUEST_ID])],
  [
    NATIVE_PARCEL_PURSUIT_QUEST_ID,
    Object.freeze([NATIVE_GIMME_SHELTER_QUEST_ID]),
  ],
  // Fish Food and In Storage have no challengeComplete prerequisite at all;
  // they open on Hoedown's eighth plantSeed. Recorded as an empty list so the
  // table stays exhaustive.
  [NATIVE_FISH_FOOD_QUEST_ID, Object.freeze([])],
  [NATIVE_IN_STORAGE_QUEST_ID, Object.freeze([])],
  [
    NATIVE_BREADY_SET_GROW_QUEST_ID,
    Object.freeze([
      NATIVE_FISH_FOOD_QUEST_ID,
      NATIVE_IN_STORAGE_QUEST_ID,
      NATIVE_HOEDOWN_QUEST_ID,
    ]),
  ],
  [
    NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
    Object.freeze([
      NATIVE_FISH_FOOD_QUEST_ID,
      NATIVE_HOEDOWN_QUEST_ID,
      NATIVE_IN_STORAGE_QUEST_ID,
    ]),
  ],
]);

/** Both quests the player may pick up the moment Gimme Shelter completes. */
export const NATIVE_POST_GIMME_HANDOFF_QUEST_IDS = Object.freeze([
  NATIVE_HOEDOWN_QUEST_ID,
  NATIVE_PARCEL_PURSUIT_QUEST_ID,
]);

/** Raspberry Seed plants that open Fish Food and In Storage mid-Hoedown. */
export const NATIVE_POST_GIMME_SEED_PLANT_UNLOCK_COUNT = 8;

export const NATIVE_POST_GIMME_UNLOCK_TRIGGER_IDS = Object.freeze({
  HOEDOWN_AFTER_GIMME: 8778418736615201 as BiomesId,
  PARCEL_PURSUIT_AFTER_GIMME: 2812897816425039 as BiomesId,
  FISH_FOOD_AFTER_EIGHT_PLANTS: 3262878775254947 as BiomesId,
  IN_STORAGE_AFTER_EIGHT_PLANTS: 5213715060938479 as BiomesId,
});

/**
 * HARTHMERE_COBBLED_MUCKLING_HUNT (2026-07-29)
 *
 * In Storage's only hard blocker. The quest asks for six Mucker Teeth and the
 * NPC dialogue sends the player "up Muckerhorn" to clobber Cobbled Mucklings,
 * but the restored Harthmere world seeds no creature of that name. The existing
 * `native_combat_quest_routing.ts` aliases are no help here: the objective is
 * `inventoryHas`, not `npcKilled`, so a kill-id alias never puts a tooth in the
 * player's bag.
 *
 * The repair mirrors the Mossy Muckling hunt: seed a real, named six-strong
 * Cobbled Muckling pack with a guaranteed Mucker Tooth drop, on the columns the
 * ORIGINAL snapshot placed Cobbled Mucklings on, up the Muckerhorn slope from
 * Ol' Coop. Keep this constant in lockstep with
 * `HARTHMERE_COBBLED_MUCKLING_ANCHOR` in `live_entity_production_seed.ts`;
 * `native_post_gimme_contract.test.ts` asserts the pairing.
 */
export const NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION = [
  115.5, 73, 121.5,
] as const;

/** Teeth required by the authored `inventoryHas` leaf. */
export const NATIVE_IN_STORAGE_MUCKER_TOOTH_COUNT = 6;

/**
 * Restored-world objective wording, projected from the canonical step id.
 *
 * Only three leaves are touched, and each for a concrete reason:
 *
 *   * In Storage / Bready Set Grow step 1 — the snapshot biscuit has NO `name`
 *     at all on these two `completeQuestStepAtMyRobot` leaves, so the journal,
 *     map row, and HUD all render an empty objective. The wording used here is
 *     the leaf's own authored `acceptText`, so nothing is invented.
 *   * Bready Set Grow's seed harvest — the snapshot says "from Long Grass", and
 *     no biscuit in the tray is called Long Grass. Wheat Seed drops from Switch
 *     Grass (biscuit 7539420629350336). Sending a player to look for a plant
 *     that does not exist is the same class of bug as the unnamed Mossy
 *     Muckling pack.
 *   * In Storage's tooth objective — names the creature family that the
 *     restored world actually seeds, and is paired with the marker below.
 *
 * The 1.2 GB immutable snapshot is never rewritten; every quest surface reads
 * through `computeTriggerProgress`, which consults this projection.
 */
const NATIVE_POST_GIMME_PROJECTED_TRIGGER_NAMES = new Map<number, string>([
  [
    Number(NATIVE_IN_STORAGE_STEP_IDS.VIEW_TRANSMISSION_FROM_OL_COOP),
    "Head to Ol' Coop at Muckerhorn Basecamp",
  ],
  [
    Number(NATIVE_BREADY_SET_GROW_STEP_IDS.VIEW_TRANSMISSION_FROM_NICO),
    "Gather Wheat Seeds for Nico",
  ],
  [
    Number(NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT_SEEDS),
    "Harvest {count}/{countTarget} Wheat Seeds from Switch Grass",
  ],
  [
    Number(NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH),
    "Collect {count}/{countTarget} Mucker Teeth from the Cobbled Mucklings up Muckerhorn",
  ],
]);

export function nativePostGimmeProjectedTriggerName(stepId: unknown) {
  return NATIVE_POST_GIMME_PROJECTED_TRIGGER_NAMES.get(Number(stepId));
}

/**
 * Navigation for leaves the original snapshot left without an aid.
 *
 * `inventoryHas` leaves cannot author navigation at all, which is why the
 * six-teeth objective had nowhere to point. Everything else in these quests
 * either carries an authored `navigationAid` (the two `sell_to_entity` leaves
 * and the mine race) or sets `allowDefaultNavigationAid`, so it already
 * resolves through the quest-giver anchor.
 */
export function nativePostGimmeProjectedNavigationAid(
  stepId: unknown
): NavigationAid | undefined {
  if (
    Number(stepId) ===
    Number(NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH)
  ) {
    return {
      kind: "position",
      pos: [...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION],
    };
  }
  return undefined;
}

/**
 * Player-facing copy for the first unfinished step of a post-Gimme quest.
 *
 * Mirrors `nativeRoadAheadFirstIncompletePriorStep`: a lightweight ordered-leaf
 * check so a claim step discovered early reports the real progression gate
 * instead of publishing a transaction the server rolls back.
 */
export function nativePostGimmeFirstIncompletePriorStep(
  triggerStateForChallenge: ReadonlyMap<BiomesId, unknown> | undefined,
  challengeId: BiomesId,
  claimStepId: BiomesId
) {
  const ordered = NATIVE_POST_GIMME_ORDERED_STEP_IDS.get(challengeId);
  if (!ordered) return undefined;
  const claimIndex = ordered.indexOf(claimStepId);
  if (claimIndex <= 0) return undefined;
  for (const stepId of ordered.slice(0, claimIndex)) {
    const raw = triggerStateForChallenge?.get(stepId);
    if (raw === undefined || raw === 0) {
      return { stepId };
    }
  }
  return undefined;
}
