import type { BiomesId } from "@/shared/ids";

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

/** Native quest-giver props always use ECS dialogue/reward handling. */
export function nativeQuestGiverUsesEcsDialogue(questGiver: unknown) {
  return nativeBiomesEcsAuthorityEnabled() && Boolean(questGiver);
}

const NATIVE_ROAD_AHEAD_QUEST_OBJECT_LABELS = new Set([
  "clothing crate",
  "billy's toolbag",
  "billys toolbag",
  "billy's bag",
  "billys bag",
]);

/**
 * These objects are `challengeClaimRewards` quest givers in the snapshot, not
 * generic loot containers.  Native dialogue must choose the reward and publish
 * `CompleteQuestStepAtEntityEvent`; opening a parallel local crate bypasses the
 * ordered trigger, gives the wrong items, and leaves Road Ahead incomplete.
 */
export function isNativeRoadAheadQuestObjectLabel(label?: string | null) {
  return NATIVE_ROAD_AHEAD_QUEST_OBJECT_LABELS.has(
    String(label ?? "")
      .trim()
      .toLowerCase()
  );
}

export function isNativeRoadAheadQuestId(id: unknown) {
  return Number(id) === Number(NATIVE_ROAD_AHEAD_QUEST_ID);
}
