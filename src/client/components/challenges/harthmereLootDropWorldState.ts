// HARTHMERE_LOOT_DROP_WORLD_STATE (audit fix, 2026-07-13)
//
// Module-level store of the currently AVAILABLE live-mode loot drops, so the
// world renderer (`renderers/local_dev/harthmere_loot_drop_markers.ts`) can
// draw them without owning its own polling. Root cause it fixes: loot drops
// existed only as rows in the inventory UI tab — no world mesh, no way to see
// a drop before walking blindly into its 7.5-block F-prompt radius, and drops
// silently expired unseen ("missing items").
//
// `HarthmereLootDropWorldInteraction` (the F-prompt component) already polls
// `/api/harthmere/live_mode_inventory_loot_state` and refreshes on inventory
// events; it publishes every refresh here. The renderer only ever reads.

import type { HarthmereInventoryLootDrop } from "@/shared/harthmere/mmo_inventory_loot_authority";

let worldLootDrops: readonly HarthmereInventoryLootDrop[] = [];
let worldLootDropsRevision = 0;
const listeners = new Set<() => void>();

// Replace the known set of drops (the interaction component publishes the
// full refreshed list). Filters to renderable drops: available, positioned,
// unexpired.
export function publishHarthmereWorldLootDrops(
  drops: readonly HarthmereInventoryLootDrop[] | undefined,
  nowMs = Date.now()
) {
  worldLootDrops = (drops ?? []).filter(
    (drop) =>
      drop &&
      drop.status === "available" &&
      drop.expiresAtMs > nowMs &&
      Number.isFinite(drop.position?.x) &&
      Number.isFinite(drop.position?.z)
  );
  worldLootDropsRevision += 1;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Listeners must never break publishing.
    }
  }
}

// Current renderable drops (already filtered by publish).
export function getHarthmereWorldLootDrops(): readonly HarthmereInventoryLootDrop[] {
  return worldLootDrops;
}

// Monotonic revision so per-frame consumers can cheaply detect changes.
export function getHarthmereWorldLootDropsRevision(): number {
  return worldLootDropsRevision;
}

// Subscribe to changes; returns an unsubscribe function.
export function subscribeHarthmereWorldLootDrops(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Test-only reset.
export function resetHarthmereWorldLootDropsForTest() {
  worldLootDrops = [];
  worldLootDropsRevision = 0;
  listeners.clear();
}
