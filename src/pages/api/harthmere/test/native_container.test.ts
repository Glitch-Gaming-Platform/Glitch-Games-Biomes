import {
  nativeBustedUnderwaterContainerRedisKeyForTest,
  nativeRoadAheadContainerRedisKeyForTest,
  seededNativeRoadAheadContainerInventoryForTest,
  seededHarthmereNativeContainerInventoryForTest,
  staticHarthmereNativeContainerLandmarkForTest,
  validateNativeRoadAheadContainerSourceForTest,
  validNativeBustedUnderwaterContainerSourceForTest,
  validNativeRoadAheadContainerSourceForTest,
  withinHarthmereNativeContainerRangeForTest,
} from "@/pages/api/harthmere/native_container";
import { BikkieIds } from "@/shared/bikkie/ids";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import {
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_ROAD_AHEAD_CONTAINER_SPECS,
} from "@/shared/harthmere/native_road_ahead_contract";
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
        [4537020877770135, 1n],
        [6561590643697708, 1n],
        [1152171766050944, 1n],
        [1534621126189793, 1n],
        [6407921801695863, 1n],
        [2512451111844299, 1n],
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

  it("seeds and isolates Busted's exact underwater quest reward", () => {
    const inventory = seededHarthmereNativeContainerInventoryForTest(
      "Chest The Grove Underwater Main"
    );
    const populated = inventory.items.filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry)
    );
    assert.deepEqual(
      populated.map((entry) => [entry.item.id, entry.count]),
      [
        [NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId, 1n],
        [harthmereItemIdToBiomesId("clean_water")!, 3n],
        [harthmereItemIdToBiomesId("river_trout")!, 2n],
      ]
    );
    const first = nativeBustedUnderwaterContainerRedisKeyForTest(
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId,
      101 as BiomesId
    );
    const second = nativeBustedUnderwaterContainerRedisKeyForTest(
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId,
      202 as BiomesId
    );
    assert.notEqual(first, second);
    assert.equal(
      first,
      "harthmere:native_busted_underwater_container:4149747832010135:101"
    );
  });

  it("accepts only the exact authored Busted underwater chest identity", () => {
    const spec = NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC;
    assert.equal(
      validNativeBustedUnderwaterContainerSourceForTest({
        entityId: spec.sourceEntityId,
        label: "Chest The Grove Underwater Main",
        questGiver: {},
        placeableItemId: spec.placeableItemId,
      }),
      true
    );
    assert.equal(
      validNativeBustedUnderwaterContainerSourceForTest({
        entityId: spec.sourceEntityId,
        label: "Chest The Grove Underwater Main",
        questGiver: undefined,
        placeableItemId: spec.placeableItemId,
      }),
      false
    );
    assert.equal(
      validNativeBustedUnderwaterContainerSourceForTest({
        entityId: spec.placeableItemId,
        label: "Chest The Grove Underwater Main",
        questGiver: {},
        placeableItemId: spec.sourceEntityId,
      }),
      false
    );
  });

  it("accepts every authored Road Ahead alias with exact native ECS identities", () => {
    for (const spec of Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS)) {
      for (const label of spec.labels) {
        const result = validateNativeRoadAheadContainerSourceForTest({
          entityId: spec.sourceEntityId,
          label,
          questGiver: {},
          placeableItemId: spec.placeableItemId,
        });
        assert.equal(result.ok, true, label);
        assert.equal(
          validNativeRoadAheadContainerSourceForTest({
            entityId: spec.sourceEntityId,
            label,
            questGiver: {},
            placeableItemId: spec.placeableItemId,
          }),
          true,
          label
        );
      }
    }
  });

  it("rejects every identity drift that could mint a forged quest container", () => {
    const clothing = NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate;
    const billy = NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag;
    const failureReason = (
      input: Parameters<typeof validateNativeRoadAheadContainerSourceForTest>[0]
    ) => {
      const result = validateNativeRoadAheadContainerSourceForTest(input);
      assert.equal(result.ok, false);
      return result.ok ? undefined : result.reason;
    };

    assert.equal(
      failureReason({
        entityId: clothing.placeableItemId,
        label: clothing.labels[0],
        questGiver: {},
        placeableItemId: clothing.sourceEntityId,
      }),
      "wrong_source_entity",
      "source entity and placeable biscuit must never be interchangeable"
    );
    assert.equal(
      failureReason({
        entityId: clothing.sourceEntityId,
        label: clothing.labels[0],
        questGiver: undefined,
        placeableItemId: clothing.placeableItemId,
      }),
      "missing_quest_giver"
    );
    assert.equal(
      failureReason({
        entityId: clothing.sourceEntityId,
        label: clothing.labels[0],
        questGiver: {},
        placeableItemId: BikkieIds.woodContainer,
      }),
      "wrong_placeable_item"
    );
    assert.equal(
      failureReason({
        entityId: clothing.sourceEntityId,
        label: clothing.labels[0],
        questGiver: {},
        placeableItemId: billy.placeableItemId,
      }),
      "wrong_placeable_item",
      "one Road Ahead prop cannot borrow the other prop's native archetype"
    );
    assert.equal(
      failureReason({
        entityId: clothing.sourceEntityId,
        label: "Invented Quest Crate",
        questGiver: {},
        placeableItemId: clothing.placeableItemId,
      }),
      "unknown_label"
    );
  });
});
