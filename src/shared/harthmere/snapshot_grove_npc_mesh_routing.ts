import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcIdFromEntityId,
} from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION =
  "snapshot-grove-npc-asset-key";

export const SNAPSHOT_GROVE_NPC_ASSET_KEYS: Partial<Record<string, string>> = {
  jackie: "npcs/jackie",
  ranger_jane: "npcs/ranger_jane",
  luis: "npcs/luis",
  taye: "npcs/taye",
  alexis: "npcs/alexis",
  sil: "npcs/sil",
  dimmi: "npcs/dimmi",
  doc: "npcs/doc",
  old_coop: "npcs/oldCoop",
  buddy: "npcs/buddy",
  mucked_robot: "npcs/mucked_robot",
};

export const SNAPSHOT_GROVE_ROBOT_LIKE_LABEL_REGEX =
  /\b(robots?|bots?|sentinels?|sententials?|sentientals?)\b/i;

function normalizedNpcLabel(label?: string) {
  return (label ?? "").trim().toLowerCase();
}

export function snapshotGroveNpcAssetKeyForEntity(
  id: BiomesId,
  label?: string
): string | undefined {
  const explicitId = snapshotGroveNpcIdFromEntityId(id);
  const normalizedLabel = normalizedNpcLabel(label);
  const labelMatchedId = SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.displayName.toLowerCase() === normalizedLabel
  )?.id;
  const matchedAsset =
    SNAPSHOT_GROVE_NPC_ASSET_KEYS[explicitId ?? labelMatchedId ?? ""];
  if (matchedAsset) {
    return matchedAsset;
  }
  if (SNAPSHOT_GROVE_ROBOT_LIKE_LABEL_REGEX.test(normalizedLabel)) {
    return SNAPSHOT_GROVE_NPC_ASSET_KEYS.buddy;
  }
  return undefined;
}
