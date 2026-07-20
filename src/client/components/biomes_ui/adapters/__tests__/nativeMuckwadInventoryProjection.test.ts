import assert from "assert";
import { mergeInventoryAndHotbarForBiomesBackpackForTest } from "../inventoryAdapterHelpers";
import { anItem } from "@/shared/game/item";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";

describe("native Road Ahead Muckwad inventory projection", () => {
  it("shows the real hotbar stack count in inventory and reflects one throw", () => {
    const item = anItem(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID);
    const before = mergeInventoryAndHotbarForBiomesBackpackForTest(
      [],
      [{ item, count: 6n }]
    );
    const after = mergeInventoryAndHotbarForBiomesBackpackForTest(
      [],
      [{ item, count: 5n }]
    );

    assert.equal(before.length, 1);
    assert.equal(before[0].item.id, NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID);
    assert.equal(before[0].count, 6n);
    assert.equal(after[0].count, 5n);
  });
});
