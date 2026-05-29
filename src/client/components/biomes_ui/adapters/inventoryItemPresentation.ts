import {
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";

export function humanizeBiomesInventoryItemIdV1(
  itemId: string,
  fallback: string,
): string {
  const knownFoodName = HARTHMERE_FOOD_DEFINITIONS_V1[itemId]?.displayName;
  if (knownFoodName) return knownFoodName;
  const knownSeedName = HARTHMERE_SEED_DEFINITIONS_V1[itemId]?.displayName;
  if (knownSeedName) return knownSeedName;
  if (!itemId || itemId === fallback) return fallback;
  const parts = itemId.split("/").filter(Boolean);
  const tail = parts[parts.length - 1] ?? itemId;
  const readable = tail
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  if (/^[a-f0-9]{16,}$/i.test(tail)) {
    return `Asset ${tail.slice(0, 8)}`;
  }
  return readable || fallback;
}

export function biomesInventoryItemIconV1(itemId: string): string {
  if (itemId === "seed_carrot") return "🥕";
  if (itemId === "seed_wheat") return "🌾";
  if (itemId === "seed_muckroot") return "✦";
  const food = HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
  if (!food) return "◼";
  if (food.source === "animal") return "🍖";
  if (food.source === "hunt") return "🐟";
  if (itemId.includes("bread")) return "🍞";
  if (itemId.includes("berries")) return "🫐";
  if (itemId.includes("carrot")) return "🥕";
  if (itemId.includes("apple")) return "🍎";
  return "◼";
}

