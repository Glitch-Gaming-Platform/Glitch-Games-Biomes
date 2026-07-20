import {
  seededHarthmereNativeContainerInventoryForTest,
  staticHarthmereNativeContainerLandmarkForTest,
  withinHarthmereNativeContainerRangeForTest,
} from "@/pages/api/harthmere/native_container";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import assert from "assert";

describe("native Harthmere generic containers", () => {
  it("seeds exact ECS item identities into container_inventory", () => {
    const inventory =
      seededHarthmereNativeContainerInventoryForTest("Road Kit Crate");
    const populated = inventory.items.filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry)
    );
    const counts = new Map(
      populated.map((entry) => [entry.item.id, Number(entry.count)])
    );

    assert.equal(counts.get(harthmereItemIdToBiomesId("woodcutters_axe")!), 1);
    assert.equal(counts.get(harthmereItemIdToBiomesId("rough_stone")!), 3);
    assert.equal(counts.get(harthmereItemIdToBiomesId("scrap_metal")!), 2);
    assert.equal(populated.length, 3);
    assert.equal(inventory.items.length, 16);
  });

  it("accepts only server-authored static container landmarks", () => {
    const crate =
      staticHarthmereNativeContainerLandmarkForTest("grove_tool_crate");
    assert.equal(crate?.label, "Road Kit Crate");
    assert.equal(
      staticHarthmereNativeContainerLandmarkForTest("client_invented_crate"),
      undefined
    );
  });

  it("uses a three-dimensional server range check", () => {
    assert.equal(
      withinHarthmereNativeContainerRangeForTest([0, 0, 0], [4, 4, 4]),
      true
    );
    assert.equal(
      withinHarthmereNativeContainerRangeForTest([0, 0, 0], [0, 9, 0]),
      false
    );
    assert.equal(
      withinHarthmereNativeContainerRangeForTest(undefined, [0, 0, 0]),
      false
    );
  });
});
