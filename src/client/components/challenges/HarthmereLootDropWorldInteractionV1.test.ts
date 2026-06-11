/// <reference types="mocha" />

import assert from "assert";
import { nearestAvailableHarthmereLootDropV1 } from "./HarthmereLootDropWorldInteractionV1";
import type { HarthmereInventoryLootDropV1 } from "@/shared/harthmere/mmo_inventory_loot_authority_v1";

function drop(
  dropId: string,
  position: { x: number; y: number; z: number },
  overrides: Partial<HarthmereInventoryLootDropV1> = {}
): HarthmereInventoryLootDropV1 {
  return {
    dropId,
    sourceKind: "live_entity:animal",
    sourceId: "cow",
    position,
    itemStacks: { raw_meat: 12 },
    instanceIds: [],
    ownerActorIds: ["player"],
    pickupToken: `${dropId}:token`,
    createdAtMs: 1_700_000_000_000,
    expiresAtMs: 1_700_000_060_000,
    status: "available",
    abuseFlags: [],
    ...overrides,
  };
}

describe("HarthmereLootDropWorldInteractionV1", () => {
  it("selects the nearest unexpired available loot drop for the F salvage prompt", () => {
    const nearest = nearestAvailableHarthmereLootDropV1(
      [
        drop("far", { x: 20, y: 54, z: 0 }),
        drop("expired", { x: 1, y: 54, z: 0 }, { expiresAtMs: 1 }),
        drop("claimed", { x: 0.5, y: 54, z: 0 }, { status: "claimed" }),
        drop("near", { x: 2, y: 54, z: 0 }),
      ],
      { x: 0, y: 53, z: 0 },
      1_700_000_000_100
    );

    assert.equal(nearest?.dropId, "near");
    assert.equal(nearest?.distance, 2);
  });
});
