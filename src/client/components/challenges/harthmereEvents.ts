// Canonical Harthmere browser event contracts.
//
// Keep event names here instead of duplicating string literals across HUD,
// object interactions, live adapters, and world-interaction panels.

export const HARTHMERE_INVENTORY_EVENT =
  "biomes:harthmere-inventory-changed" as const;
export const HARTHMERE_LIVE_INVENTORY_SYNC_EVENT =
  "biomes:harthmere-live-inventory-sync" as const;
export const HARTHMERE_LIVE_EQUIPMENT_EVENT =
  "biomes:harthmere-live-equipment-updated" as const;
export const HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT =
  "biomes:harthmere-business-inventory-loot-updated" as const;

export const HARTHMERE_JOBS_BOARD_OPEN_EVENT =
  "biomes:harthmere-jobs-board-open" as const;
export const HARTHMERE_WANTED_BOARD_OPEN_EVENT =
  "biomes:harthmere-wanted-board-open" as const;

export const HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT =
  "biomes:harthmere-close-talk-for-vendor" as const;
