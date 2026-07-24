// SNAPSHOT_GROVE_LIGHTWEIGHT_IDS
//
// Browser-safe Grove identity and elevation constants. Keep these independent
// from the full lore/quest/building catalogue so small client tools (cutscene
// preview, capture, map probes) do not initialize terrain asset definitions.

import type { BiomesId } from "@/shared/ids";

export const SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE =
  8_810_000_000_010_000 as BiomesId;
export const SNAPSHOT_GROVE_NPC_ID_OFFSET_BASE = 9300;
export const SNAPSHOT_GROVE_JACKIE_ID_OFFSET = 9301;
export const SNAPSHOT_GROVE_JACKIE_ENTITY_ID = (Number(
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE
) + SNAPSHOT_GROVE_JACKIE_ID_OFFSET) as BiomesId;

export const SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y = 69;
export const SNAPSHOT_GROVE_LIVE_NPC_FEET_Y =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y + 1;
export const SNAPSHOT_GROVE_LIVE_MARKER_Y =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y + 2;
