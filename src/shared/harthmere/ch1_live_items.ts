// CHAPTER_1_LIVE_ITEMS
//
// Registers the narrative item catalogue with the same inventory authority
// used by vendors, drops, bank storage, and Glitch persistence. Without this
// bridge a quest reward fell back to a generic tradeable item definition,
// allowing plot-critical objects such as the Grey Card or field ledger to be
// dropped, sold, or mislabelled after reconnect.

import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { registerHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";

let registered = false;

export function registerCh1LiveItemDefinitions(): void {
  if (registered) return;
  registered = true;
  for (const item of CH1_ITEMS) {
    const consumable =
      item.id === "item_augur9_core_cell" ||
      item.id === "item_bulls_core" ||
      item.id === "item_ch1_compound_b";
    registerHarthmereItemDefinition({
      itemId: item.id,
      displayName: item.name,
      description: item.description,
      maxStackSize: consumable ? 99 : 1,
      baseValue: 0,
      binding: item.droppable ? "none" : "quest",
      isQuestItem: !item.droppable,
      isCurrency: false,
      isConsumable: consumable,
      isCraftingMaterial: false,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: item.sellable,
      category: "quest",
      weight: item.id === "item_sorrel_field_ledger" ? 2 : 0.1,
    });
  }
}
