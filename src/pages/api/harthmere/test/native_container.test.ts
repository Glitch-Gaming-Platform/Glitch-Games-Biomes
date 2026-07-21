import {
  nativeRoadAheadContainerRedisKeyForTest,
  seededNativeRoadAheadContainerInventoryForTest,
  seededHarthmereNativeContainerInventoryForTest,
  staticHarthmereNativeContainerLandmarkForTest,
  validNativeRoadAheadContainerSourceForTest,
  withinHarthmereNativeContainerRangeForTest,
} from "@/pages/api/harthmere/native_container";
import { BikkieIds } from "@/shared/bikkie/ids";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import type { BiomesId } from "@/shared/ids";
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

  it("seeds each player's Road Ahead inventory once with exact native items", () => {
    const clothing =
      seededNativeRoadAheadContainerInventoryForTest("Clothing Crate");
    const populated = clothing.items.filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry)
    );
    assert.deepEqual(
      populated.map((entry) => [entry.item.id, entry.count]),
      [
        [BikkieIds.muckyTop, 1n],
        [BikkieIds.muckySkirt, 1n],
      ]
    );
    assert.equal(clothing.items.length, 16);
    assert.throws(() =>
      seededNativeRoadAheadContainerInventoryForTest("Invented Quest Crate")
    );
  });

  it("isolates the same visible quest prop per player", () => {
    const source = 5165478204703095 as BiomesId;
    const first = nativeRoadAheadContainerRedisKeyForTest(
      source,
      101 as BiomesId
    );
    const second = nativeRoadAheadContainerRedisKeyForTest(
      source,
      202 as BiomesId
    );
    assert.notEqual(first, second);
    assert.equal(
      first,
      "harthmere:native_road_ahead_container:5165478204703095:101"
    );
  });

  it("rejects renamed or wrong-archetype quest-container spoofs", () => {
    assert.equal(
      validNativeRoadAheadContainerSourceForTest({
        label: "Clothing Crate",
        questGiver: {},
        placeableItemId: 5165478204703095 as BiomesId,
      }),
      true
    );
    assert.equal(
      validNativeRoadAheadContainerSourceForTest({
        label: "Clothing Crate",
        questGiver: undefined,
        placeableItemId: 5165478204703095 as BiomesId,
      }),
      false
    );
    assert.equal(
      validNativeRoadAheadContainerSourceForTest({
        label: "Clothing Crate",
        questGiver: {},
        placeableItemId: BikkieIds.woodContainer,
      }),
      false
    );
  });
});
