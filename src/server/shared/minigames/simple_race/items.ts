import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";

// The May 2026 world used two themed checkpoint placeables in addition to the
// ordinary race checkpoint. Their Bikkie presentation is preserved in the
// snapshot, but bootstrap reconciliation cannot depend on the active tray
// having already populated inferred `isCheckpoint` attributes.
const SIMPLE_RACE_CHECKPOINT_ITEM_IDS = new Set<BiomesId>([
  BikkieIds.simpleRaceCheckpoint,
  3058905783180606 as BiomesId,
  7878456818884249 as BiomesId,
]);

export function isSimpleRaceCheckpointItemId(itemId: BiomesId) {
  return SIMPLE_RACE_CHECKPOINT_ITEM_IDS.has(itemId);
}
