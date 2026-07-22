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

/** Server-only marker placed on invisible, per-player quest inventories. */
export const NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION =
  "native-road-ahead-private-container-v1";

export const NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID = 4603863378554668 as BiomesId;

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
    choices: [
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
        seedItemId: BikkieIds.muckyTop,
        itemIds: [
          4537020877770135 as BiomesId,
          6561590643697708 as BiomesId,
          1152171766050944 as BiomesId,
        ],
      },
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS,
        seedItemId: BikkieIds.muckySkirt,
        itemIds: [
          1534621126189793 as BiomesId,
          6407921801695863 as BiomesId,
          2512451111844299 as BiomesId,
        ],
      },
    ],
  },
  billysToolbag: {
    labels: ["billy's toolbag", "billys toolbag", "billy's bag", "billys bag"],
    sourceEntityId: 5682301664350905 as BiomesId,
    placeableItemId: 6811733198167399 as BiomesId,
    choices: [
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
        seedItemId: 4155260615577796 as BiomesId,
        itemIds: [4155260615577796 as BiomesId],
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

/** Flattened seed list used by each player's private native ECS container. */
export function nativeRoadAheadContainerItemIds(label?: string | null) {
  return nativeRoadAheadContainerSpecForLabel(label)?.choices.map(
    (choice) => choice.seedItemId
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
    // The current native mesh uses Mucky Top/Skirt identities while the May 16
    // claim leaf lists older reward alternatives. Map the native migration item
    // to option zero; skipRewardGrant prevents the old item from being minted.
    const chosenRewardIndex =
      itemId === choice.seedItemId ? 0 : originalRewardIndex;
    if (chosenRewardIndex >= 0) {
      return {
        sourceEntityId: spec.sourceEntityId,
        placeableItemId: spec.placeableItemId,
        stepId: choice.stepId,
        chosenRewardIndex,
        siblingItemIds: [
          choice.seedItemId,
          ...(choice.itemIds as readonly BiomesId[]),
        ],
      };
    }
  }
  return undefined;
}

/**
 * Quest-giver data supplements an object's capability.  The two Road Ahead
 * storage props must therefore route to their container UI rather than the
 * generic NPC dialogue fallback.
 */
export function nativeQuestGiverUsesEcsDialogue(
  questGiver: unknown,
  label?: string | null
) {
  return (
    nativeBiomesEcsAuthorityEnabled() &&
    Boolean(questGiver) &&
    !isNativeRoadAheadQuestObjectLabel(label)
  );
}

export function isNativeRoadAheadQuestId(id: unknown) {
  return Number(id) === Number(NATIVE_ROAD_AHEAD_QUEST_ID);
}
