import {
  HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID_V1,
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
  harthmereFarmingFoodItemDisplayNameV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { harthmereResolveBikkieVisualV1 } from "@/shared/harthmere/bikkie_visual_resolver_v1";
import type { HarthmereBikkieItemMetadataV1 } from "@/shared/harthmere/mmo_bikkie_farming_food_catalog_v1";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";

export function humanizeBiomesInventoryItemIdV1(
  itemId: string,
  fallback: string
): string {
  const knownName = harthmereFarmingFoodItemDisplayNameV1(itemId);
  if (knownName) return knownName;
  if (!itemId) return fallback;
  const parts = itemId.split("/").filter(Boolean);
  const tail = parts[parts.length - 1] ?? itemId;
  const readable = tail
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  if (/^[a-f0-9]{16,}$/i.test(tail)) {
    return `Asset ${tail.slice(0, 8)}`;
  }
  return readable || fallback;
}

const LOCAL_BIKKIE_VISUAL_ALIASES_V1: Record<
  string,
  HarthmereBikkieItemMetadataV1
> = {
  seed_carrot: {
    bikkieId: "4537020877769703",
    displayName: "Carrot Seed",
    category: "Seed",
    action: "plant",
    galoisPath: "items/seed_carrot",
    visualAsset: "items/seed_carrot",
  },
  seed_wheat: {
    bikkieId: "1534621126189364",
    displayName: "Wheat Seed",
    category: "Seed",
    action: "plant",
    galoisPath: "items/seed_wheat",
    visualAsset: "items/seed_wheat",
  },
  fresh_carrot: {
    bikkieId: "4938764980403185",
    displayName: "Fresh Carrot",
    category: "Vegetable",
    action: "eat",
    galoisPath: "items/carrot",
    visualAsset: "items/carrot",
  },
  loaf_bread: {
    bikkieId: "2071428426278062",
    displayName: "Loaf Bread",
    category: "Food",
    action: "eat",
    galoisPath: "items/bread",
    visualAsset: "items/bread",
  },
  grilled_meat: {
    bikkieId: "7539420629350042",
    displayName: "Grilled Meat",
    category: "Food",
    action: "eat",
    galoisPath: "items/mucker_meat_1",
    visualAsset: "items/mucker_meat_1",
  },
  river_trout: {
    bikkieId: "7539420629350036",
    displayName: "River Trout",
    category: "Fish",
    galoisPath: "npcs/fish",
    visualAsset: "npcs/fish",
  },
};

function bikkieInventoryMetadataForItemV1(itemId: string) {
  return (
    HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID_V1[itemId] ??
    LOCAL_BIKKIE_VISUAL_ALIASES_V1[itemId]
  );
}

export function biomesInventoryItemVisualV1(itemId: string) {
  const metadata = bikkieInventoryMetadataForItemV1(itemId);
  if (!metadata) return undefined;
  return harthmereResolveBikkieVisualV1({
    id: itemId,
    bikkieId: metadata.bikkieId,
    label: metadata.displayName,
    kind: metadata.category,
    galoisPath: metadata.galoisPath,
    visualAsset: metadata.visualAsset,
  });
}

export function biomesInventoryItemIconV1(itemId: string): string {
  const visual = biomesInventoryItemVisualV1(itemId);
  const imageUrl = visual?.iconAssetPath
    ? resolveAssetUrlUntyped(visual.iconAssetPath)
    : undefined;
  if (imageUrl) return imageUrl;
  if (visual?.glyph) return visual.glyph;
  if (itemId === "seed_muckroot") return "MR";
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[itemId];
  if (seed?.displayName.toLowerCase().includes("corn")) return "CS";
  if (seed?.displayName.toLowerCase().includes("wheat")) return "WS";
  if (seed?.displayName.toLowerCase().includes("carrot")) return "CS";
  if (seed) return "SE";
  const food = HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
  if (!food) return "◼";
  const foodName = food.displayName.toLowerCase();
  if (food.source === "animal" || food.source === "hunt") return "ME";
  if (food.source === "fish") return "FI";
  if (food.source === "drink") return "DR";
  if (foodName.includes("corn")) return "CO";
  if (foodName.includes("meat")) return "ME";
  if (
    foodName.includes("stew") ||
    foodName.includes("meal") ||
    foodName.includes("soup")
  )
    return "ST";
  if (foodName.includes("tart")) return "TA";
  if (foodName.includes("bread")) return "BR";
  if (foodName.includes("berries") || foodName.includes("berry")) return "BE";
  if (foodName.includes("carrot")) return "CA";
  if (foodName.includes("apple")) return "AP";
  if (foodName.includes("banana")) return "BA";
  return "◼";
}
