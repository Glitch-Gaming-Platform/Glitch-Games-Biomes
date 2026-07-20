import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  nativeWearableSlotLabelForTest,
  nativeWearableSlotUiIdForTest,
} from "../useBiomesUILiveAdapters";

describe("native wearable BiomesUI slot mapping", () => {
  it("keeps every clothing layer in a distinct visible equipment slot", () => {
    const slots = [
      BikkieIds.hat,
      BikkieIds.hair,
      BikkieIds.top,
      BikkieIds.outerwear,
      BikkieIds.bottoms,
      BikkieIds.feet,
      BikkieIds.hands,
    ].map((slot) => nativeWearableSlotUiIdForTest(String(slot)));

    assert.deepEqual(slots, [
      "hat",
      "hair",
      "chest",
      "back",
      "legs",
      "feet",
      "hands",
    ]);
    assert.equal(new Set(slots).size, slots.length);
    assert.equal(
      nativeWearableSlotLabelForTest(String(BikkieIds.top)),
      "Chest"
    );
    assert.equal(
      nativeWearableSlotLabelForTest(String(BikkieIds.bottoms)),
      "Legs"
    );
  });
});
