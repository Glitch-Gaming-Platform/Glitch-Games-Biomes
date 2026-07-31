import {
  HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID,
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
  harthmereFarmingFoodItemDisplayName,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { harthmereResolveBikkieVisual } from "@/shared/harthmere/bikkie_visual_resolver";
import type { HarthmereBikkieItemMetadata } from "@/shared/harthmere/mmo_bikkie_farming_food_catalog";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import { staticUrlForAttribute } from "@/shared/bikkie/schema/binary";
import { anItem } from "@/shared/game/item";
import { safeParseBiomesId } from "@/shared/ids";
import { resolveBinaryAttribute } from "@/shared/util/dye_helpers";
import { getHarthmerePremiumWeapon } from "@/shared/harthmere/premium_weapon_catalog";
import { harthmereGeneratedInventoryIconUrl } from "@/shared/harthmere/generated/harthmere_inventory_icon_manifest";

export function humanizeBiomesInventoryItemId(
  itemId: string,
  fallback: string
): string {
  const knownName = harthmereFarmingFoodItemDisplayName(itemId);
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

const LOCAL_BIKKIE_VISUAL_ALIASES: Record<string, HarthmereBikkieItemMetadata> =
  {
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

function bikkieInventoryMetadataForItem(itemId: string) {
  return (
    HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID[itemId] ??
    LOCAL_BIKKIE_VISUAL_ALIASES[itemId]
  );
}

function biomesBikkieItemIcon(itemId: string): string | undefined {
  const biomesId = safeParseBiomesId(itemId);
  if (!biomesId) return undefined;
  const item = anItem(biomesId);
  if (!item) return undefined;
  try {
    if (item.icon) {
      return staticUrlForAttribute(resolveBinaryAttribute(item.icon, item));
    }
    if (item.galoisIcon) {
      return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(item.galoisIcon)
        ? item.galoisIcon
        : resolveAssetUrlUntyped(`icons/${item.galoisIcon}`);
    }
    if (item.galoisPath) {
      return resolveAssetUrlUntyped(`icons/${item.galoisPath}`);
    }
    if (item.groupId) {
      return `/api/environment_group/${item.groupId}/thumbnail`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function fallbackInventoryGlyph(itemId: string) {
  const readable = humanizeBiomesInventoryItemId(itemId, itemId);
  const letters = readable.match(/[A-Za-z0-9]/g)?.join("") ?? "";
  return (letters.slice(0, 2).toUpperCase() || "IT").padEnd(2, " ");
}

export function biomesInventoryItemVisual(itemId: string) {
  const metadata = bikkieInventoryMetadataForItem(itemId);
  if (!metadata) return undefined;
  return harthmereResolveBikkieVisual({
    id: itemId,
    bikkieId: metadata.bikkieId,
    label: metadata.displayName,
    kind: metadata.category,
    galoisPath: metadata.galoisPath,
    visualAsset: metadata.visualAsset,
  });
}

export function biomesInventoryItemIcon(itemId: string): string {
  const premiumWeapon = getHarthmerePremiumWeapon(itemId);
  if (premiumWeapon) return premiumWeapon.inventoryIconUrl;
  const generatedIcon = harthmereGeneratedInventoryIconUrl(itemId);
  if (generatedIcon) return generatedIcon;
  const bikkieIcon = biomesBikkieItemIcon(itemId);
  if (bikkieIcon) return bikkieIcon;
  const visual = biomesInventoryItemVisual(itemId);
  const imageUrl = visual?.iconAssetPath
    ? resolveAssetUrlUntyped(visual.iconAssetPath)
    : undefined;
  if (imageUrl) return imageUrl;
  if (visual?.glyph) return visual.glyph;
  if (itemId === "seed_muckroot") return "MR";
  const seed = HARTHMERE_SEED_DEFINITIONS[itemId];
  if (seed?.displayName.toLowerCase().includes("corn")) return "CS";
  if (seed?.displayName.toLowerCase().includes("wheat")) return "WS";
  if (seed?.displayName.toLowerCase().includes("carrot")) return "CS";
  if (seed) return "SE";
  const food = HARTHMERE_FOOD_DEFINITIONS[itemId];
  if (!food) return fallbackInventoryGlyph(itemId);
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
  return fallbackInventoryGlyph(itemId);
}
