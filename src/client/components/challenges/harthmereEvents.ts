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
export const HARTHMERE_CRAFT_COMPLETED_EVENT =
  "biomes:harthmere-craft-completed" as const;
export const HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT =
  "biomes:harthmere-local-combat-npc-damage" as const;

export interface HarthmereLocalCombatNpcDamageEventDetail {
  targetOffset: number;
  targetId: number;
  targetName: string;
  damage: number;
  ability: string;
  targetDead: boolean;
}

export function dispatchHarthmereLocalCombatNpcDamage(
  detail: HarthmereLocalCombatNpcDamageEventDetail,
  target: EventTarget | undefined = typeof window === "undefined"
    ? undefined
    : window
): boolean {
  if (!target || typeof CustomEvent === "undefined") {
    return false;
  }
  target.dispatchEvent(
    new CustomEvent(HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT, { detail })
  );
  return true;
}

export const HARTHMERE_JOBS_BOARD_OPEN_EVENT =
  "biomes:harthmere-jobs-board-open" as const;
export const HARTHMERE_WANTED_BOARD_OPEN_EVENT =
  "biomes:harthmere-wanted-board-open" as const;

export const HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT =
  "biomes:harthmere-close-talk-for-vendor" as const;
