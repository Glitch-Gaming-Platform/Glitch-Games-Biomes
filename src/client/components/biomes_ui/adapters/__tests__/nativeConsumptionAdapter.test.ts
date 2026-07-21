import { nativeConsumptionForBiomesUIForTest } from "@/client/components/biomes_ui/adapters/nativeConsumptionAdapter";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("BiomesUI native consumable adapter", () => {
  it("preserves the exact backpack or hotbar ref and native action", () => {
    const foodId = 8_650_000_000_000_001 as BiomesId;
    const manaId = 8_650_000_000_000_002 as BiomesId;
    const inventory = {
      items: [
        { item: { id: foodId, isConsumable: true, action: "eat" }, count: 2n },
      ],
      hotbar: [
        {
          item: { id: manaId, isConsumable: true, action: "drink" },
          count: 1n,
        },
      ],
    };

    assert.deepEqual(
      nativeConsumptionForBiomesUIForTest(inventory, {
        kind: "item",
        idx: 0,
      }),
      { itemId: foodId, ref: { kind: "item", idx: 0 }, action: "eat" }
    );
    assert.deepEqual(
      nativeConsumptionForBiomesUIForTest(inventory, {
        kind: "hotbar",
        idx: 0,
      }),
      { itemId: manaId, ref: { kind: "hotbar", idx: 0 }, action: "drink" }
    );
  });

  it("does not turn a non-consumable custom action into generic eating", () => {
    assert.equal(
      nativeConsumptionForBiomesUIForTest(
        {
          items: [
            {
              item: {
                id: 8_650_000_000_000_003 as BiomesId,
                isConsumable: false,
              },
              count: 1n,
            },
          ],
        },
        { kind: "item", idx: 0 }
      ),
      undefined
    );
  });
});
