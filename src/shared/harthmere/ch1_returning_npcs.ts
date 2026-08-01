// CHAPTER_1_RETURNING_NPCS
//
// Chapter 1 occasionally brings an established Harthmere character into the
// Grove. Keep one canonical ECS identity for that character and stage that
// identity at the location where the story actually asks the player to meet
// them. This avoids both an invisible remote expression target and a duplicate
// temporary NPC body.

import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";

export const CH1_RETURNING_NPC_SEED_VERSION =
  "chapter1-returning-native-player-mesh-v1" as const;

const HOLT = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST.sergeant_bram_holt;

export const CH1_SERGEANT_HOLT = Object.freeze({
  entityId: HOLT.entityId,
  displayName: HOLT.displayName,
  aliases: Object.freeze(["Sergeant Bramwell Holt"]),
  position: CH1_ANCHORS.grove_watch_house,
  role: "Town Watch sergeant taking the Chapter 1 statement",
});
