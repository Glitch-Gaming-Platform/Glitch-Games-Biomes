import {
  harthmereHotbarHeldItemForAttachment,
  isHarthmereChapter1DisplayOnlyHeldItem,
  isHarthmereProtectedRegionVisibleHeldItem,
  readHarthmereCompatibilityHeldItemId,
  setHarthmereCompatibilityHeldItemId,
} from "@/client/game/resources/harthmere_held_item";
import { anItem } from "@/shared/game/item";
import { BikkieIds } from "@/shared/bikkie/ids";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import assert from "assert";

describe("Harthmere authoritative held-item bridge", () => {
  afterEach(() => setHarthmereCompatibilityHeldItemId(undefined));

  it("projects a mapped compatibility hotbar weapon into a native item", () => {
    setHarthmereCompatibilityHeldItemId("iron_longsword");
    const held = harthmereHotbarHeldItemForAttachment(undefined);
    assert.equal(held?.id, harthmereNativeBiomesIdForItemId("iron_longsword"));
    assert.equal(readHarthmereCompatibilityHeldItemId(), "iron_longsword");
  });

  it("keeps a populated native hotbar slot authoritative", () => {
    setHarthmereCompatibilityHeldItemId("iron_longsword");
    const native = anItem(harthmereNativeBiomesIdForItemId("hunter_bow")!);
    assert.strictEqual(harthmereHotbarHeldItemForAttachment(native), native);
  });

  it("does not manufacture an attachment for an unmapped compatibility id", () => {
    setHarthmereCompatibilityHeldItemId("not_a_real_tool");
    assert.equal(harthmereHotbarHeldItemForAttachment(undefined), undefined);
  });

  it("keeps every Chapter 1 display-only prop visible in protected regions", () => {
    for (const chapter1Item of CH1_ITEMS) {
      const nativeId = harthmereNativeBiomesIdForItemId(chapter1Item.id);
      assert(nativeId, `${chapter1Item.id} has no native item id`);
      assert.equal(
        isHarthmereChapter1DisplayOnlyHeldItem(anItem(nativeId)),
        true,
        chapter1Item.id
      );
    }
  });

  it("keeps Grove cleanup and repair tools visible when their action is protected", () => {
    for (const itemId of ["muck_rake", "repair_mallet"]) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert(nativeId, `${itemId} has no native item id`);
      assert.equal(
        isHarthmereProtectedRegionVisibleHeldItem(anItem(nativeId)),
        true,
        itemId
      );
    }
    assert.equal(
      isHarthmereProtectedRegionVisibleHeldItem(anItem(BikkieIds.dirt)),
      false
    );
  });
});
