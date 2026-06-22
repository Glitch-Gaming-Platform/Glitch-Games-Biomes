import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcIdFromEntityId,
} from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION =
  "snapshot-grove-npc-asset-key";
export const SNAPSHOT_GROVE_GENERATED_VOXEL_NPC_VERSION =
  "snapshot-grove-generated-voxel-npc-player-mesh-fallback";

export const SNAPSHOT_GROVE_NPC_ASSET_KEYS: Partial<Record<string, string>> = {
  jackie: "npcs/jackie",
  ranger_jane: "npcs/ranger_jane",
  luis: "npcs/luis",
  taye: "npcs/taye",
  alexis: "npcs/alexis",
  dimmi: "npcs/dimmi",
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

export function snapshotGroveGeneratedVoxelNpcIdForEntity(
  id: BiomesId,
  label?: string
): string | undefined {
  const explicitId = snapshotGroveNpcIdFromEntityId(id);
  if (explicitId) {
    return explicitId;
  }
  const normalizedLabel = normalizedNpcLabel(label);
  if (!normalizedLabel) {
    return undefined;
  }
  const exactLabelId = SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.displayName.toLowerCase() === normalizedLabel
  )?.id;
  if (exactLabelId) {
    return exactLabelId;
  }
  // Live data can carry a fuller label than the snapshot seed, e.g. Billy
  // Rhodes. Keep the named no-asset Grove locals on the visible voxel path.
  if (/^billy\b/.test(normalizedLabel)) {
    return "billy";
  }
  if (/^sil\b/.test(normalizedLabel)) {
    return "sil";
  }
  if (/^doc\b|field medic|muck researcher/.test(normalizedLabel)) {
    return "doc";
  }
  if (/rosalyn/.test(normalizedLabel)) {
    return "rosalyn";
  }
  if (/nia.*guild clerk|guild clerk.*nia/.test(normalizedLabel)) {
    return "guild_clerk_nia";
  }
  if (/merl/.test(normalizedLabel)) {
    return "grove_banker_merl";
  }
  if (/mira|land steward/.test(normalizedLabel)) {
    return "mira_grove_land_steward";
  }
  if (/gus.*baker|^gus\b/.test(normalizedLabel)) {
    return "gus_the_baker";
  }
  if (/fern.*grower|^fern\b/.test(normalizedLabel)) {
    return "fern_the_grower";
  }
  if (/kit.*courier|^kit\b/.test(normalizedLabel)) {
    return "kit_the_courier";
  }
  if (/mel.*handyman|^mel\b/.test(normalizedLabel)) {
    return "mel_the_handyman";
  }
  if (/rin.*forager|^rin\b/.test(normalizedLabel)) {
    return "rin_the_forager";
  }
  if (/carlo.*cook|^carlo\b/.test(normalizedLabel)) {
    return "carlo_the_cook";
  }
  return undefined;
}

export function shouldUseSnapshotGroveGeneratedVoxelNpc(
  id: BiomesId,
  label?: string
): boolean {
  const groveNpcId = snapshotGroveGeneratedVoxelNpcIdForEntity(id, label);
  return !!groveNpcId && !SNAPSHOT_GROVE_NPC_ASSET_KEYS[groveNpcId];
}
