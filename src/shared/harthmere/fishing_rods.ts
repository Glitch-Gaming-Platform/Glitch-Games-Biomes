import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";

// The May 16 snapshot ships five real fishing rods. Harthmere adds one
// semantic starter rod whose generated Bikkie biscuit joins the same native
// fishing action. Keep the identities in one place so vendor inventory,
// gathering-node authority, and the native hotbar cannot disagree about what
// counts as a rod.
export const SNAPSHOT_FISHING_RODS = [
  {
    key: "training_rod",
    displayName: "Training Rod",
    id: 5_920_729_553_733_598 as BiomesId,
  },
  {
    key: "fishing_rod",
    displayName: "Fishing Rod",
    id: 2_913_506_116_529_081 as BiomesId,
  },
  {
    key: "polished_rod",
    displayName: "Polished Rod",
    id: 239_116_987_339_293 as BiomesId,
  },
  {
    key: "diamond_rod",
    displayName: "Diamond Rod",
    id: 8_462_122_779_311_978 as BiomesId,
  },
  {
    key: "peerless_rod",
    displayName: "Peerless Rod",
    id: 6_491_302_653_185_275 as BiomesId,
  },
] as const;

export const HARTHMERE_SIMPLE_FISHING_ROD_ITEM_ID =
  "simple_fishing_rod" as const;
export const HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID =
  HARTHMERE_NATIVE_ITEM_ID_MANIFEST.simple_fishing_rod;

export const ALL_FISHING_ROD_BIOMES_IDS = new Set<BiomesId>([
  ...SNAPSHOT_FISHING_RODS.map((rod) => rod.id),
  HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID,
]);

export function isFishingRodItemId(
  itemId: string | number | undefined
): boolean {
  if (itemId === undefined) return false;
  const key = String(itemId).trim();
  if (!key) return false;
  if (key.toLowerCase() === HARTHMERE_SIMPLE_FISHING_ROD_ITEM_ID) {
    return true;
  }
  const parsed = safeParseBiomesId(key);
  return parsed !== undefined && ALL_FISHING_ROD_BIOMES_IDS.has(parsed);
}

export function hasFishingRodIdentity(input: {
  itemIds?: readonly (string | number)[];
  biomesItemIds?: readonly BiomesId[];
}): boolean {
  return (
    input.itemIds?.some(isFishingRodItemId) === true ||
    input.biomesItemIds?.some((id) => ALL_FISHING_ROD_BIOMES_IDS.has(id)) ===
      true
  );
}
