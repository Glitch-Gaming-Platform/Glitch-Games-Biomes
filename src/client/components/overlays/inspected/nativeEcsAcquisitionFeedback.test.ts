import {
  acquiredInventoryCountForBag,
  snapshotInventoryCountsForBag,
  totalItemCountInBag,
} from "@/client/components/overlays/inspected/nativeEcsAcquisitionFeedback";
import { BikkieIds } from "@/shared/bikkie/ids";
import { Inventory } from "@/shared/ecs/gen/components";
import { countOf, createBag } from "@/shared/game/items";
import assert from "assert";

describe("native ECS acquisition feedback", () => {
  it("only acknowledges an observed native inventory increase", () => {
    const bag = createBag(countOf(BikkieIds.carrotSeed, 2n));
    const beforeInventory = Inventory.create({
      items: [countOf(BikkieIds.carrotSeed, 1n)],
      hotbar: [],
    });
    const before = snapshotInventoryCountsForBag(beforeInventory, bag);
    assert.equal(
      acquiredInventoryCountForBag(before, beforeInventory, bag),
      0n
    );

    const afterInventory = Inventory.create({
      items: [countOf(BikkieIds.carrotSeed, 3n)],
      hotbar: [],
    });
    assert.equal(acquiredInventoryCountForBag(before, afterInventory, bag), 2n);
    assert.equal(totalItemCountInBag(bag), 2n);
  });

  it("counts hotbar changes because the hotbar is native inventory storage", () => {
    const bag = createBag(countOf(BikkieIds.muckerWard, 1n));
    const beforeInventory = Inventory.create({ items: [], hotbar: [] });
    const before = snapshotInventoryCountsForBag(beforeInventory, bag);
    const afterInventory = Inventory.create({
      items: [],
      hotbar: [countOf(BikkieIds.muckerWard, 1n)],
    });
    assert.equal(acquiredInventoryCountForBag(before, afterInventory, bag), 1n);
  });
});
