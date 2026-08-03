// CHAPTER_1_RETURNING_NPCS
//
// Chapter 1 occasionally brings an established Harthmere character into the
// Grove. Keep one canonical ECS identity for that character and stage that
// identity at the location where the story actually asks the player to meet
// them. This avoids both an invisible remote expression target and a duplicate
// temporary NPC body.

import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import type {
  Ch1StagedNpc,
  Ch1StagingInput,
} from "@/shared/harthmere/ch1_staging";

export const CH1_RETURNING_NPC_SEED_VERSION =
  "chapter1-returning-native-player-mesh-v2-per-player-staging" as const;

const HOLT = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST.sergeant_bram_holt;

export const CH1_SERGEANT_HOLT = Object.freeze({
  key: "sergeant_bram_holt",
  entityId: HOLT.entityId,
  displayName: HOLT.displayName,
  aliases: Object.freeze(["Sergeant Bramwell Holt"]),
  position: CH1_ANCHORS.grove_watch_house_holt_post,
  role: "Town Watch sergeant taking the Chapter 1 statement",
});

/**
 * Returning characters obey the same per-player staging rule as the new cast.
 * Holt's shared ECS body belongs at North Gate for every other player; only the
 * player currently giving the Act 4 statement sees that canonical identity in
 * the Grove watch house.
 */
export function ch1ReturningNpcStageDirections(
  input: Ch1StagingInput
): Ch1StagedNpc[] {
  const atWatchHouse = input.activeStepId === "report_or_not";
  return [
    {
      key: CH1_SERGEANT_HOLT.key,
      entityId: Number(CH1_SERGEANT_HOLT.entityId),
      displayName: CH1_SERGEANT_HOLT.displayName,
      present: true,
      ...(atWatchHouse
        ? {
            position: [...CH1_SERGEANT_HOLT.position] as [
              number,
              number,
              number,
            ],
          }
        : {}),
      useSeededBody: !atWatchHouse,
      activity: atWatchHouse
        ? "Taking the player's statement in the Grove watch house."
        : "Holding his canonical post at Harthmere's North Gate.",
    },
  ];
}
