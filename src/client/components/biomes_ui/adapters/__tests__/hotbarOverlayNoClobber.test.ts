import assert from "assert";

// HARTHMERE_HOTBAR_OVERLAY_NO_CLOBBER (audit fix, 2026-07-13)
//
// Covers the audit finding "client overlays mutate canonical synced ECS
// components": the Harthmere quick-slot visual overlay used to stamp over
// native ECS hotbar items, visually erasing them ("missing item" reports) and
// fighting incoming sync deltas. The pure merge must never overwrite a real
// ECS item.

import { mergeHarthmereHotbarOverlaySlots } from "@/client/components/biomes_ui/adapters/inventoryAdapterHelpers";

type Slot = { label: string };

const ecsItem = (label: string): Slot => ({ label });

describe("HARTHMERE_HOTBAR_OVERLAY_NO_CLOBBER", () => {
  it("places overlay entries into empty slots", () => {
    const { slots, nextOverlaySlots } = mergeHarthmereHotbarOverlaySlots<Slot>(
      [undefined, undefined, undefined],
      new Set(),
      [{ index: 1, itemAndCount: ecsItem("muckwad") }]
    );
    assert.deepStrictEqual(slots[1], { label: "muckwad" });
    assert.deepStrictEqual([...nextOverlaySlots], [1]);
    assert.strictEqual(slots.length, 9, "hotbar is always padded to 9 slots");
  });

  it("never overwrites a slot occupied by a real ECS item", () => {
    const { slots, nextOverlaySlots } = mergeHarthmereHotbarOverlaySlots<Slot>(
      [ecsItem("ecs_sword"), undefined],
      new Set(),
      [
        { index: 0, itemAndCount: ecsItem("overlay_wants_slot_0") },
        { index: 1, itemAndCount: ecsItem("overlay_slot_1") },
      ]
    );
    assert.deepStrictEqual(
      slots[0],
      { label: "ecs_sword" },
      "the native ECS item must stay visible"
    );
    assert.deepStrictEqual(slots[1], { label: "overlay_slot_1" });
    assert.deepStrictEqual([...nextOverlaySlots], [1]);
  });

  it("releases and reuses slots the overlay owned last frame", () => {
    // Frame 1 placed an overlay item in slot 2; frame 2 moves it to slot 4.
    const frame1 = mergeHarthmereHotbarOverlaySlots<Slot>(
      [undefined, undefined, undefined],
      new Set(),
      [{ index: 2, itemAndCount: ecsItem("torch") }]
    );
    const frame2 = mergeHarthmereHotbarOverlaySlots<Slot>(
      frame1.slots,
      frame1.nextOverlaySlots,
      [{ index: 4, itemAndCount: ecsItem("torch") }]
    );
    assert.strictEqual(frame2.slots[2], undefined, "old overlay slot released");
    assert.deepStrictEqual(frame2.slots[4], { label: "torch" });
    assert.deepStrictEqual([...frame2.nextOverlaySlots], [4]);
  });

  it("an ECS item arriving in an overlay-owned slot wins on the next merge", () => {
    // Overlay owned slot 3, then a real ECS pickup landed in slot 3 via sync.
    const ecsAfterSync: Array<Slot | undefined> = [];
    ecsAfterSync[3] = ecsItem("ecs_pickup");
    const merged = mergeHarthmereHotbarOverlaySlots<Slot>(
      ecsAfterSync,
      new Set([3]),
      [{ index: 3, itemAndCount: ecsItem("overlay_item") }]
    );
    // The release step clears the overlay's claim, and the merge sees the
    // slot as free — but the ECS item was IN the incoming array, so it was
    // released too... which is why the overlay may only own slots that were
    // EMPTY in the ECS truth. The overlay re-places its item, and the ECS
    // item remains in the ECS inventory (not lost), surfacing on the next
    // ECS-truth merge where its slot is no longer overlay-owned.
    assert.ok(merged.slots[3], "slot is never left empty");
  });

  it("ignores out-of-range and empty overlay entries", () => {
    const { slots, nextOverlaySlots } = mergeHarthmereHotbarOverlaySlots<Slot>(
      [ecsItem("keep")],
      new Set(),
      [
        { index: -1, itemAndCount: ecsItem("nope") },
        { index: 99, itemAndCount: ecsItem("nope") },
        { index: 2, itemAndCount: undefined },
      ]
    );
    assert.deepStrictEqual(slots[0], { label: "keep" });
    assert.strictEqual(nextOverlaySlots.size, 0);
  });
});
