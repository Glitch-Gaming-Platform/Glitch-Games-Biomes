import type { BiomesId } from "@/shared/ids";
import { BikkieIds } from "@/shared/bikkie/ids";

/**
 * Native ECS contract for the original Biomes onboarding quest.
 *
 * Source of truth: `snapshot_backup.json` from the
 * `data-snapshot-2026-05-16` release.  The backup stores "The Road Ahead" as
 * Bikkie quest 6193612340426932 with one ordered (`seq`) trigger tree.  The
 * trigger service advances this tree from authoritative ECS/firehose events;
 * NUX state machines only explain the current action to the player.
 *
 * This file intentionally contains IDs and short semantic labels rather than
 * another quest reducer.  Runtime code uses it to recognize the native quest,
 * protect its quest objects from Harthmere's generic container layer, and
 * migrate old client-only mirrors without inventing progress.
 */
export const NATIVE_ROAD_AHEAD_QUEST_ID = 6193612340426932 as BiomesId;
export const NATIVE_BUSTED_QUEST_ID = 7405046529843322 as BiomesId;
export const NATIVE_GET_THE_MUCK_OUT_QUEST_ID = 817959262145055 as BiomesId;
export const NATIVE_MUCK_VS_MACHINE_QUEST_ID = 5739496793885069 as BiomesId;

/**
 * The May 2026 Get the Muck Out biscuit requires six kills of the original
 * Mossy Muckling type. The restored Harthmere world uses dedicated native
 * combat types for its visible West Breach and Gravewood Muckling packs, so
 * this compatibility contract keeps that original quest completable without
 * weakening unrelated npcKilled objectives.
 */
export const NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID =
  4794743509650569 as BiomesId;
export const NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID =
  2992752380341653 as BiomesId;
export const NATIVE_GET_THE_MUCK_OUT_WEST_BREACH_MUCKLING_TYPE_ID =
  8700372047004309 as BiomesId;
export const NATIVE_GET_THE_MUCK_OUT_GRAVEWOOD_MUCKLING_TYPE_ID =
  8722418610125863 as BiomesId;

/**
 * HARTHMERE_MOSSY_MUCKLING_HUNT (2026-07-28): the restored world now seeds a real
 * six-strong "Mossy Muckling" pack, so the objective names an enemy the player
 * can actually find. Keyed here as its own restored type for the same reason as
 * the two packs above — it keeps its own stats, drops, respawn and visuals.
 * Manifest key `monster_mossy_muckling`.
 */
export const NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID =
  8722087466111637 as BiomesId;

/**
 * Map marker for the six-Muckling hunt.
 *
 * Was [334, 40, -389] — the Watchtower Muck Clearing, where the old map-wide
 * Muck redistribution had piled 32 hostiles from eight families and where no
 * creature was actually named "Mossy Muckling". It now points at the seeded
 * Mossy Muckling pack just east of the Grove/Harthmere safe ring. Keep this in
 * lockstep with `HARTHMERE_MOSSY_MUCKLING_ANCHOR` in
 * `live_entity_production_seed.ts`; `native_combat_quest_routing.test.ts` and
 * `nativeQuestNavAidMarkers.test.ts` assert the pairing.
 */
export const NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION = [
  531, 68, -33,
] as const;

const NATIVE_GET_THE_MUCK_OUT_COMPATIBLE_MUCKLING_TYPE_IDS = new Set<number>([
  Number(NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID),
  // The named restored pack the marker now points at.
  Number(NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID),
  // Restored production packs. These remain distinct native combat types for
  // stats, drops, respawn, and visuals; only this exact legacy quest leaf
  // treats them as the Mossy Muckling family it describes. Kept so a player
  // mid-quest who already found a West Breach or Gravewood pack still gets
  // credit.
  Number(NATIVE_GET_THE_MUCK_OUT_WEST_BREACH_MUCKLING_TYPE_ID),
  Number(NATIVE_GET_THE_MUCK_OUT_GRAVEWOOD_MUCKLING_TYPE_ID),
]);

export function isNativeGetTheMuckOutCompatibleMucklingTypeId(id: unknown) {
  return NATIVE_GET_THE_MUCK_OUT_COMPATIBLE_MUCKLING_TYPE_IDS.has(Number(id));
}

/**
 * Original May 16 main-story order, ending with the assembled robot reward.
 * Road Ahead is giver-less and already auto-starts in the stock trigger
 * engine. Busted and Get the Muck Out have Jackie as their authored giver, but
 * this restored build deliberately continues them without a second acceptance
 * click so the onboarding story cannot appear to stop between chapters.
 */
export const NATIVE_ROBOT_STORY_QUEST_IDS = Object.freeze([
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
]);

const NATIVE_ROBOT_STORY_AUTO_CONTINUATION_IDS = new Set<BiomesId>([
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
]);

export function isNativeRobotStoryAutoContinuationQuestId(id: BiomesId) {
  return NATIVE_ROBOT_STORY_AUTO_CONTINUATION_IDS.has(id);
}

export function nativeRobotStoryQuestOrder(id: unknown) {
  return NATIVE_ROBOT_STORY_QUEST_IDS.findIndex(
    (questId) => Number(questId) === Number(id)
  );
}

export function nativeRobotStoryPredecessorQuestId(id: unknown) {
  const order = nativeRobotStoryQuestOrder(id);
  return order > 0 ? NATIVE_ROBOT_STORY_QUEST_IDS[order - 1] : undefined;
}

/** Server-only marker placed on invisible, per-player quest inventories. */
export const NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION =
  "native-road-ahead-private-container-v1";

export const NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID = 4603863378554668 as BiomesId;

/**
 * The original Busted quest uses the sunken-ship chest as a physical reward
 * claim. Keep its world identity and reward identity together so the container
 * API, inventory transaction, and trigger claim cannot drift independently.
 */
export const NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC = Object.freeze({
  labels: ["chest the grove underwater main"],
  sourceEntityId: 4149747832010135 as BiomesId,
  placeableItemId: 5979991977107628 as BiomesId,
  position: [528.5, 59, -96.5] as const,
  stepId: 6798640337192760 as BiomesId,
  itemId: 7077725005403292 as BiomesId,
  returnNpcTypeId: 2345000310921173 as BiomesId,
});

/**
 * Original-snapshot crates that LOOK like containers but complete their quest
 * leaf through the stock ECS dialogue/reward flow. They must not be added to
 * `isNativeQuestContainerLabel`: doing so would replace their authored
 * `CompleteQuestStepAtEntityEvent` action with generic storage and strand the
 * player at the reward objective.
 *
 * Busted deliberately has two physical routes to the same leaf: the restored
 * underwater chest uses private native inventory, while the authored Muck
 * Buster Crate remains a direct reward-dialogue target. Trigger idempotency
 * prevents claiming both. Get the Muck Out's Spare Robot Parts crate is the
 * only authored source of the Robot Power Supply.
 */
export const NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS = Object.freeze({
  bustedMuckBusterCrate: {
    questId: NATIVE_BUSTED_QUEST_ID,
    stepId: 6798640337192760 as BiomesId,
    sourceEntityId: 2345000310921173 as BiomesId,
    label: "Muck Buster Crate",
    placeableItemId: 6720083171323032 as BiomesId,
    position: [846.5, 28, 319.5] as const,
    rewardItemId: 7077725005403292 as BiomesId,
    acceptText: "Collect Water-logged Muck Buster",
  },
  getTheMuckOutSpareRobotParts: {
    questId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
    stepId: 3822426307564741 as BiomesId,
    sourceEntityId: 7814370709884466 as BiomesId,
    label: "Spare Robot Parts",
    placeableItemId: 6720083171323032 as BiomesId,
    position: [772.5, 32, -71.5] as const,
    rewardItemId: 8767393169474251 as BiomesId,
    acceptText: "Collect Robot Power Supply",
  },
} as const);

export function isNativeRobotStoryCrateDialogueLabel(label?: string | null) {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();
  return Object.values(NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS).some(
    (spec) => spec.label.toLowerCase() === normalized
  );
}

const NATIVE_BUSTED_UNDERWATER_PRIOR_STEPS = Object.freeze([
  310783173745175 as BiomesId,
  859994236864492 as BiomesId,
  3346948724689018 as BiomesId,
]);

const NATIVE_BUSTED_STEP_OBJECTIVES = new Map<BiomesId, string>([
  [310783173745175 as BiomesId, "Talk to Jackie"],
  [859994236864492 as BiomesId, "Meet with Doc"],
  [3346948724689018 as BiomesId, "Talk to Doc"],
]);

export const NATIVE_ROAD_AHEAD_STEP_IDS = {
  TALK_TO_JACKIE: 3960245896803219 as BiomesId,
  MEET_BILLY: 166072605041642 as BiomesId,
  FIND_MUCKWAD: 1360968443779085 as BiomesId,
  COLLECT_SIX_MUCKWAD: 3623277001113501 as BiomesId,
  RETURN_MUCKWAD_TO_BILLY: 5727093030853097 as BiomesId,
  FIND_CLOTHING_CRATE: 2644068819601552 as BiomesId,
  CHOOSE_TOP: 5660250530071909 as BiomesId,
  CHOOSE_BOTTOMS: 94406418638805 as BiomesId,
  WEAR_TOP_AND_BOTTOMS: 4273096364377975 as BiomesId,
  RETURN_TO_BILLY_DRESSED: 573329491246142 as BiomesId,
  OPEN_BILLYS_BAG: 7786806792035454 as BiomesId,
  RETURN_BILLYS_PICK: 7786117694089673 as BiomesId,
  RECEIVE_ROBOT_SHELL: 954400655493357 as BiomesId,
  RECEIVE_CAMERA: 5095190214192804 as BiomesId,
  TAKE_SELFIE_WITH_BILLY: 8903834562824062 as BiomesId,
  RETURN_ROBOT_SHELL_TO_JACKIE: 800042715544807 as BiomesId,
} as const;

export const NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS = Object.freeze([
  NATIVE_ROAD_AHEAD_STEP_IDS.TALK_TO_JACKIE,
  NATIVE_ROAD_AHEAD_STEP_IDS.MEET_BILLY,
  NATIVE_ROAD_AHEAD_STEP_IDS.FIND_MUCKWAD,
  NATIVE_ROAD_AHEAD_STEP_IDS.COLLECT_SIX_MUCKWAD,
  NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_MUCKWAD_TO_BILLY,
  NATIVE_ROAD_AHEAD_STEP_IDS.FIND_CLOTHING_CRATE,
  NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
  NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS,
  NATIVE_ROAD_AHEAD_STEP_IDS.WEAR_TOP_AND_BOTTOMS,
  NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_TO_BILLY_DRESSED,
  NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
  NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_BILLYS_PICK,
  NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_ROBOT_SHELL,
  NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_CAMERA,
  NATIVE_ROAD_AHEAD_STEP_IDS.TAKE_SELFIE_WITH_BILLY,
  NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_ROBOT_SHELL_TO_JACKIE,
]);

const NATIVE_ROAD_AHEAD_STEP_OBJECTIVES = new Map<BiomesId, string>([
  [NATIVE_ROAD_AHEAD_STEP_IDS.TALK_TO_JACKIE, "Talk to Jackie"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.MEET_BILLY, "Meet Billy"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.FIND_MUCKWAD, "Find Muckwad"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.COLLECT_SIX_MUCKWAD, "Collect six Muckwad"],
  [
    NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_MUCKWAD_TO_BILLY,
    "Return the Muckwad to Billy",
  ],
  [NATIVE_ROAD_AHEAD_STEP_IDS.FIND_CLOTHING_CRATE, "Find the clothing crate"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP, "Choose a top"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS, "Choose bottoms"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.WEAR_TOP_AND_BOTTOMS, "Wear a top and bottoms"],
  [
    NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_TO_BILLY_DRESSED,
    "Return to Billy dressed",
  ],
  [NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG, "Open Billy's bag"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_BILLYS_PICK, "Return Billy's pick"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_ROBOT_SHELL, "Receive the Robot Shell"],
  [NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_CAMERA, "Receive the camera"],
  [
    NATIVE_ROAD_AHEAD_STEP_IDS.TAKE_SELFIE_WITH_BILLY,
    "Take a selfie with Billy",
  ],
  [
    NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_ROBOT_SHELL_TO_JACKIE,
    "Bring the Robot Shell back to Jackie",
  ],
]);

export const NATIVE_ROBOT_STORY_ITEM_IDS = Object.freeze({
  ROBOT_SHELL: 5883518264640730 as BiomesId,
  ROBOT_MOTOR_UNIT: 1445038393184935 as BiomesId,
  ROBOT_POWER_SUPPLY: 8767393169474251 as BiomesId,
  ASSEMBLED_ROBOT: 567816707675895 as BiomesId,
});

/** Full trigger-node state fixtures used by the browser round-trip release gate. */
export const NATIVE_ROBOT_STORY_FINAL_HANDOFFS = Object.freeze({
  roadAhead: {
    questId: NATIVE_ROAD_AHEAD_QUEST_ID,
    finalStepId: NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_ROBOT_SHELL_TO_JACKIE,
    targetId: 8997551883502307 as BiomesId,
    prerequisiteTriggerIds: [
      NATIVE_ROAD_AHEAD_STEP_IDS.TALK_TO_JACKIE,
      NATIVE_ROAD_AHEAD_STEP_IDS.MEET_BILLY,
      NATIVE_ROAD_AHEAD_STEP_IDS.FIND_MUCKWAD,
      NATIVE_ROAD_AHEAD_STEP_IDS.COLLECT_SIX_MUCKWAD,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_MUCKWAD_TO_BILLY,
      NATIVE_ROAD_AHEAD_STEP_IDS.FIND_CLOTHING_CRATE,
      NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
      NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS,
      5261262819224626 as BiomesId,
      5059357120988468 as BiomesId,
      NATIVE_ROAD_AHEAD_STEP_IDS.WEAR_TOP_AND_BOTTOMS,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_TO_BILLY_DRESSED,
      NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_BILLYS_PICK,
      NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_ROBOT_SHELL,
      NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_CAMERA,
      NATIVE_ROAD_AHEAD_STEP_IDS.TAKE_SELFIE_WITH_BILLY,
    ],
  },
  busted: {
    questId: NATIVE_BUSTED_QUEST_ID,
    finalStepId: 2564822555755950 as BiomesId,
    targetId: 8997551883502307 as BiomesId,
    prerequisiteTriggerIds: [
      310783173745175, 859994236864492, 3346948724689018, 6798640337192760,
      3106453541468841, 1250712772360777, 275639178491846, 6436863915440094,
      4588014125793446, 3014114416679179, 6113676978673631, 7852960194875109,
      7945988417612118, 2605479334585778, 8417331412810011, 1815083990296399,
      7368524338732157, 5355669237856170, 3488902901607828, 6548497782720315,
      1517393677536172, 6620853067071453, 7134920134933805,
    ] as BiomesId[],
  },
  getTheMuckOut: {
    questId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
    finalStepId: 3822426307564741 as BiomesId,
    targetId: 7814370709884466 as BiomesId,
    prerequisiteTriggerIds: [
      7850203803086744, 1488451563795571, 2465592451503042, 4794743509650569,
      2185129587403168, 2163078453122381, 8726047292702638, 8381498319603962,
      3688052208056569, 1177668390064029, 7507033025879660, 1467778625409403,
      7339582224957377, 6297666130307789,
    ] as BiomesId[],
  },
  muckVsMachine: {
    questId: NATIVE_MUCK_VS_MACHINE_QUEST_ID,
    finalStepId: 731822018871376 as BiomesId,
    targetId: 7976997825186729 as BiomesId,
    prerequisiteTriggerIds: [
      7515302201234813 as BiomesId,
      4851249541237155 as BiomesId,
    ],
  },
});

/**
 * Synthetic Road Ahead is retained only as an explicit developer diagnostic.
 * It must be opt-in because running it beside the native trigger tree creates
 * two quest authorities, grants symbolic rewards that are not ECS items, and
 * allows out-of-order local events to overwrite the real objective display.
 */
/**
 * Global ownership switch for the original Biomes ECS player model.
 *
 * Inventory, hotbar, wearing, health, challenges, and trigger state are one
 * synchronized ECS document.  A feature-specific diagnostic switch must never
 * disable that ownership boundary, otherwise unrelated systems can begin
 * projecting localStorage or Redis data into the synchronized client cache.
 */
export function nativeBiomesEcsAuthorityEnabled() {
  return process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY !== "0";
}

/**
 * Native Harthmere resources recover only through authored consumables and
 * respawn transactions. The stock Biomes client health loop must not add a
 * second, timer-based recovery authority while native ECS owns the player.
 */
export function playerHealthAutoRegenerationEnabled() {
  return !nativeBiomesEcsAuthorityEnabled();
}

/**
 * Explicit opt-in for the retired, client-local Road Ahead simulator.
 *
 * This flag is intentionally separate from native ECS ownership. It is useful
 * for isolated diagnostics, but it must not make legacy combat, death,
 * inventory, or wearing state authoritative.
 */
export function legacySyntheticRoadAheadEnabled() {
  return process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD === "1";
}

export function nativeRoadAheadEcsAuthorityEnabled() {
  return (
    nativeBiomesEcsAuthorityEnabled() && !legacySyntheticRoadAheadEnabled()
  );
}

/**
 * Exact native identities authored by the May 16 snapshot.
 *
 * The two props are picture frames with `quest_giver`, but their physical
 * capability is container storage. `sourceEntityId` is the concrete ECS world
 * entity and is also the return identity authored into the quest trigger;
 * `placeableItemId` is the biscuit stored in that entity's
 * `placeable_component`. They are deliberately separate because treating one
 * as the other makes every legitimate production container look forged.
 */
export const NATIVE_ROAD_AHEAD_CONTAINER_SPECS = Object.freeze({
  clothingCrate: {
    labels: ["clothing crate"],
    sourceEntityId: 5165478204703095 as BiomesId,
    placeableItemId: 6720083171323032 as BiomesId,
    // Original May 16 snapshot transform. Browser release gates must interact
    // with this placed frame at its authored gravel-pile location; moving only
    // its Position component does not move the old placeable's rendered
    // occupancy and creates a false missing-prompt failure.
    position: [231.5, 67, -82.5] as const,
    choices: [
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
        seedItemId: 4537020877770135 as BiomesId,
        itemIds: [
          4537020877770135 as BiomesId,
          6561590643697708 as BiomesId,
          1152171766050944 as BiomesId,
        ],
        legacyItemIds: [BikkieIds.muckyTop],
      },
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS,
        seedItemId: 1534621126189793 as BiomesId,
        itemIds: [
          1534621126189793 as BiomesId,
          6407921801695863 as BiomesId,
          2512451111844299 as BiomesId,
        ],
        legacyItemIds: [BikkieIds.muckySkirt],
      },
    ],
  },
  billysToolbag: {
    labels: ["billy's toolbag", "billys toolbag", "billy's bag", "billys bag"],
    sourceEntityId: 5682301664350905 as BiomesId,
    placeableItemId: 6811733198167399 as BiomesId,
    // Original May 16 snapshot transform; see the Clothing Crate note above.
    position: [244.5, 58, -110.5] as const,
    choices: [
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
        seedItemId: 4155260615577796 as BiomesId,
        itemIds: [4155260615577796 as BiomesId],
        legacyItemIds: [],
      },
    ],
  },
} as const);

export type NativeRoadAheadContainerSpec =
  (typeof NATIVE_ROAD_AHEAD_CONTAINER_SPECS)[keyof typeof NATIVE_ROAD_AHEAD_CONTAINER_SPECS];

function normalizedQuestObjectLabel(label?: string | null) {
  return String(label ?? "")
    .trim()
    .toLowerCase();
}

export function isNativeBustedUnderwaterContainerLabel(label?: string | null) {
  return (
    NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.labels as readonly string[]
  ).includes(normalizedQuestObjectLabel(label));
}

/**
 * True for ANY label that names a physical native-quest container: the Road
 * Ahead crates/toolbag AND Busted's sunken-boat chest.
 *
 * WHY THIS EXISTS (live bug, 2026-07-25 session): the Busted chest ("chest
 * the grove underwater main") is an ORIGINAL-SNAPSHOT container placeable —
 * it has `placed_by` set and its item is a real container with its own aimed
 * overlay. The proximity F-prompt scanner deliberately skips such entities so
 * the richer cursor-ray overlay wins... but the chest sits underwater inside
 * the sunken hull, where the cursor ray hits the hull, the water, or the
 * terrain first. The aimed overlay never fires, the proximity path skips it,
 * and the player can never collect the Water-logged Muck Buster — Busted
 * (and every quest after it) becomes uncompletable.
 *
 * Road Ahead containers never hit this because they are authored frame
 * placeables with a quest_giver and no container overlay of their own.
 *
 * The proximity scanner uses this helper to keep quest containers in the
 * candidate set regardless of `placed_by` or their own-overlay status. The
 * server still enforces its authoritative range/step validation on open, so
 * this widens discovery only, not authority.
 */
export function isNativeQuestContainerLabel(label?: string | null) {
  const normalized = normalizedQuestObjectLabel(label);
  if (!normalized) {
    return false;
  }
  if (
    (
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.labels as readonly string[]
    ).includes(normalized)
  ) {
    return true;
  }
  for (const spec of Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS)) {
    if ((spec.labels as readonly string[]).includes(normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * A snapshot quest container with `placed_by` must not use the ordinary rich
 * placeable overlay. Those overlays assume the placeable owns its public
 * container inventory, while native quest rewards are materialized privately
 * per player by the Harthmere container API. This predicate is shared by the
 * direct-hit and proximity routes so neither cursor geometry can preempt the F
 * interaction again. Player-built storage remains on the ordinary path.
 */
export function shouldBypassGenericPlaceableOverlayForNativeQuestContainer(input: {
  label?: string | null;
  placedBy: unknown;
}) {
  return Boolean(input.placedBy) && isNativeQuestContainerLabel(input.label);
}

export function nativeBustedUnderwaterContainerClaimForItem(
  label: string | null | undefined,
  itemId: BiomesId
) {
  if (
    !isNativeBustedUnderwaterContainerLabel(label) ||
    itemId !== NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
  ) {
    return undefined;
  }
  return {
    challengeId: NATIVE_BUSTED_QUEST_ID,
    sourceEntityId: NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId,
    placeableItemId: NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId,
    stepId: NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId,
    chosenRewardIndex: 0,
  } as const;
}

/** Normalize every physical native quest reward into one client preflight. */
export function nativeQuestContainerClaimForItem(
  label: string | null | undefined,
  itemId: BiomesId
) {
  const roadAhead = nativeRoadAheadContainerClaimForItem(label, itemId);
  if (roadAhead) {
    return {
      ...roadAhead,
      challengeId: NATIVE_ROAD_AHEAD_QUEST_ID,
      questTitle: "The Road Ahead",
    } as const;
  }
  const busted = nativeBustedUnderwaterContainerClaimForItem(label, itemId);
  if (busted) {
    return { ...busted, questTitle: "Busted" } as const;
  }
  return undefined;
}

/**
 * Return player-facing prerequisite copy for any supported quest container.
 * The inventory handler still repeats full trigger-tree validation, so this
 * shared lookup improves feedback without becoming a second authority.
 */
export function nativeQuestContainerFirstIncompletePriorStep(
  triggerStateForChallenge: ReadonlyMap<BiomesId, unknown> | undefined,
  challengeId: BiomesId,
  claimStepId: BiomesId
) {
  if (challengeId === NATIVE_ROAD_AHEAD_QUEST_ID) {
    return nativeRoadAheadFirstIncompletePriorStep(
      triggerStateForChallenge,
      claimStepId
    );
  }
  if (
    challengeId === NATIVE_BUSTED_QUEST_ID &&
    claimStepId === NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId
  ) {
    for (const stepId of NATIVE_BUSTED_UNDERWATER_PRIOR_STEPS) {
      const raw = triggerStateForChallenge?.get(stepId);
      if (raw === undefined || raw === 0) {
        return {
          stepId,
          objective:
            NATIVE_BUSTED_STEP_OBJECTIVES.get(stepId) ??
            "the current Busted objective",
        };
      }
    }
  }
  return undefined;
}

/** Resolve a quest container without relying on the generic crate regex. */
export function nativeRoadAheadContainerSpecForLabel(
  label?: string | null
): NativeRoadAheadContainerSpec | undefined {
  const normalized = normalizedQuestObjectLabel(label);
  return Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS).find((spec) =>
    (spec.labels as readonly string[]).includes(normalized)
  );
}

/** These labels identify the snapshot's two quest-backed storage props. */
export function isNativeRoadAheadQuestObjectLabel(label?: string | null) {
  // Derive recognition from the same table used for ECS validation so adding
  // an authored alias cannot silently route it through the generic container.
  return Boolean(nativeRoadAheadContainerSpecForLabel(label));
}

/** Flattened authored choices used by each player's private native container. */
export function nativeRoadAheadContainerItemIds(label?: string | null) {
  return nativeRoadAheadContainerSpecForLabel(label)?.choices.flatMap(
    (choice) => choice.itemIds
  );
}

/**
 * Maps a transferred native item back to its exact claim step and reward
 * index.  The inventory handler uses this after validating ownership/range so
 * taking an item advances the original trigger without granting a duplicate.
 */
export function nativeRoadAheadContainerClaimForItem(
  label: string | null | undefined,
  itemId: BiomesId
) {
  const spec = nativeRoadAheadContainerSpecForLabel(label);
  if (!spec) return undefined;
  for (const choice of spec.choices) {
    const originalRewardIndex = (choice.itemIds as readonly BiomesId[]).indexOf(
      itemId
    );
    const legacyRewardIndex = (
      choice.legacyItemIds as readonly BiomesId[]
    ).indexOf(itemId);
    // Containers materialized before the snapshot-parity repair may still hold
    // Mucky Top/Skirt. Keep those claims valid as option zero while new crates
    // expose the snapshot's actual T-shirt and Jeans choices.
    const chosenRewardIndex =
      originalRewardIndex >= 0
        ? originalRewardIndex
        : legacyRewardIndex >= 0
        ? 0
        : -1;
    if (chosenRewardIndex >= 0) {
      return {
        sourceEntityId: spec.sourceEntityId,
        placeableItemId: spec.placeableItemId,
        stepId: choice.stepId,
        chosenRewardIndex,
      };
    }
  }
  return undefined;
}

/**
 * Client-side preflight for a private Road Ahead reward container.
 *
 * The server remains authoritative and performs the complete trigger-tree
 * validation. This lightweight ordered-leaf check exists so an interactable
 * quest container discovered early reports the actual progression gate rather
 * than publishing a transaction that the server rolls back and then appearing
 * to hang until the ECS-update timeout expires.
 */
export function nativeRoadAheadFirstIncompletePriorStep(
  triggerStateForChallenge: ReadonlyMap<BiomesId, unknown> | undefined,
  claimStepId: BiomesId
) {
  const claimIndex = NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS.indexOf(claimStepId);
  if (claimIndex <= 0) return undefined;
  for (const stepId of NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS.slice(
    0,
    claimIndex
  )) {
    const raw = triggerStateForChallenge?.get(stepId);
    if (raw === undefined || raw === 0) {
      return {
        stepId,
        objective:
          NATIVE_ROAD_AHEAD_STEP_OBJECTIVES.get(stepId) ??
          "the current Road Ahead objective",
      };
    }
  }
  return undefined;
}

/**
 * Quest-giver data supplements an object's capability. Every physical native
 * quest container must therefore route to its container UI rather than the
 * generic NPC dialogue fallback. This includes Busted's sunken chest: it owns
 * `quest_giver` in the original snapshot just like the Road Ahead frames, and
 * treating that marker as a living NPC suppresses the Open Container shortcut
 * even after proximity discovery succeeds.
 */
export function nativeQuestGiverUsesEcsDialogue(
  questGiver: unknown,
  label?: string | null
) {
  if (!nativeBiomesEcsAuthorityEnabled() || !questGiver) {
    return false;
  }
  // Keep the two crate-shaped reward props explicitly on dialogue authority.
  // Their label matches generic container semantics, so this named guard is a
  // regression contract against accidentally opening empty storage instead of
  // publishing the authored quest reward action.
  if (isNativeRobotStoryCrateDialogueLabel(label)) {
    return true;
  }
  return !isNativeQuestContainerLabel(label);
}

export function isNativeRoadAheadQuestId(id: unknown) {
  return Number(id) === Number(NATIVE_ROAD_AHEAD_QUEST_ID);
}
