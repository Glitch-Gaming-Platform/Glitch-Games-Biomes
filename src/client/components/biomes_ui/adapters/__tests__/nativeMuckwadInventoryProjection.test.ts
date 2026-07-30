import assert from "assert";
import {
  nativeBackpackGridItemsForBiomesUiForTest,
  nativeBackpackMaxSlotsForBiomesUiForTest,
} from "../inventoryAdapterHelpers";
import { anItem } from "@/shared/game/item";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";

describe("native Road Ahead Muckwad inventory projection", () => {
  it("does not count a native hotbar stack as a 41st backpack slot", () => {
    const backpack = Array.from({ length: 40 }, (_, index) => ({
      item: anItem(index + 1),
      count: 1n,
    }));
    const hotbar = [
      { item: anItem(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID), count: 6n },
    ];

    const projected = nativeBackpackGridItemsForBiomesUiForTest(
      backpack,
      hotbar
    );

    assert.equal(projected.length, 40);
    assert.equal(
      projected.some(
        (slot) => slot.item.id === NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID
      ),
      false
    );
    assert.equal(nativeBackpackMaxSlotsForBiomesUiForTest(40), 40);
  });

  it("preserves backpack capacity earned above the 40-slot baseline", () => {
    assert.equal(nativeBackpackMaxSlotsForBiomesUiForTest(42), 42);
  });
});
