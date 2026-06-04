// HARTHMERE_CONTAINER_DRAG_AND_KEYBOARD_V1: exhaustive edge-case coverage for the
// container panel's drag/keyboard decision logic.
import assert from "assert";

import {
  clampHarthmereContainerFocusV1,
  harthmereContainerEnterActionV1,
  moveHarthmereContainerFocusV1,
  parseHarthmereContainerDragPayloadV1,
  resolveHarthmereContainerTransferV1,
  serializeHarthmereContainerDragPayloadV1,
  type HarthmereContainerColumnCountsV1,
} from "@/client/components/challenges/harthmereContainerTransferInteractionV1";

const counts = (
  containerCount: number,
  inventoryCount: number
): HarthmereContainerColumnCountsV1 => ({ containerCount, inventoryCount });

describe("harthmere container transfer interaction (drag + keyboard)", () => {
  describe("resolve drop action", () => {
    it("container -> inventory takes; inventory -> container stores", () => {
      assert.equal(
        resolveHarthmereContainerTransferV1("container", "inventory"),
        "take"
      );
      assert.equal(
        resolveHarthmereContainerTransferV1("inventory", "container"),
        "store"
      );
    });
    it("dropping onto the same column is a no-op", () => {
      assert.equal(
        resolveHarthmereContainerTransferV1("container", "container"),
        "none"
      );
      assert.equal(
        resolveHarthmereContainerTransferV1("inventory", "inventory"),
        "none"
      );
    });
  });

  describe("enter/return action", () => {
    it("takes a container item, stores an inventory item", () => {
      assert.equal(harthmereContainerEnterActionV1("container"), "take");
      assert.equal(harthmereContainerEnterActionV1("inventory"), "store");
    });
  });

  describe("drag payload serialize/parse", () => {
    it("round-trips a valid payload", () => {
      const text = serializeHarthmereContainerDragPayloadV1({
        side: "container",
        itemId: "baker_apron",
      });
      assert.deepEqual(parseHarthmereContainerDragPayloadV1(text), {
        side: "container",
        itemId: "baker_apron",
      });
    });
    it("rejects junk, empty, null, wrong side, and missing fields", () => {
      assert.equal(parseHarthmereContainerDragPayloadV1(null), undefined);
      assert.equal(parseHarthmereContainerDragPayloadV1(""), undefined);
      assert.equal(parseHarthmereContainerDragPayloadV1("not json"), undefined);
      assert.equal(
        parseHarthmereContainerDragPayloadV1('{"side":"bogus","itemId":"x"}'),
        undefined
      );
      assert.equal(
        parseHarthmereContainerDragPayloadV1('{"side":"container"}'),
        undefined
      );
      assert.equal(
        parseHarthmereContainerDragPayloadV1('{"side":"container","itemId":""}'),
        undefined
      );
    });
  });

  describe("clamp focus", () => {
    it("returns undefined only when BOTH columns are empty", () => {
      assert.equal(
        clampHarthmereContainerFocusV1({ side: "container", index: 0 }, counts(0, 0)),
        undefined
      );
    });
    it("falls back to the non-empty column", () => {
      assert.deepEqual(
        clampHarthmereContainerFocusV1({ side: "container", index: 2 }, counts(0, 3)),
        { side: "inventory", index: 2 }
      );
      assert.deepEqual(
        clampHarthmereContainerFocusV1({ side: "inventory", index: 1 }, counts(4, 0)),
        { side: "container", index: 1 }
      );
    });
    it("clamps an out-of-range or negative index", () => {
      assert.deepEqual(
        clampHarthmereContainerFocusV1({ side: "container", index: 99 }, counts(3, 0)),
        { side: "container", index: 2 }
      );
      assert.deepEqual(
        clampHarthmereContainerFocusV1({ side: "container", index: -5 }, counts(3, 0)),
        { side: "container", index: 0 }
      );
    });
    it("defaults undefined focus to the first container row", () => {
      assert.deepEqual(clampHarthmereContainerFocusV1(undefined, counts(2, 2)), {
        side: "container",
        index: 0,
      });
    });
  });

  describe("arrow-key navigation", () => {
    it("Up/Down move within a column and clamp at the ends (no wrap)", () => {
      const c = counts(3, 0);
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 0 }, "ArrowUp", c),
        { side: "container", index: 0 }
      );
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 1 }, "ArrowDown", c),
        { side: "container", index: 2 }
      );
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 2 }, "ArrowDown", c),
        { side: "container", index: 2 }
      );
    });
    it("Left/Right switch columns preserving the row index", () => {
      const c = counts(4, 4);
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "inventory", index: 2 }, "ArrowLeft", c),
        { side: "container", index: 2 }
      );
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 3 }, "ArrowRight", c),
        { side: "inventory", index: 3 }
      );
    });
    it("Left/Right clamp the row index to the target column length", () => {
      // inventory has 5 rows, container has 2 — moving left from inv row 4 lands on container row 1.
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "inventory", index: 4 }, "ArrowLeft", counts(2, 5)),
        { side: "container", index: 1 }
      );
    });
    it("staying in the same column via Left/Right is a no-op", () => {
      const c = counts(3, 3);
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 1 }, "ArrowLeft", c),
        { side: "container", index: 1 }
      );
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "inventory", index: 1 }, "ArrowRight", c),
        { side: "inventory", index: 1 }
      );
    });
    it("Left/Right do nothing when the target column is empty", () => {
      // container empty: pressing Left from inventory keeps you in inventory.
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "inventory", index: 1 }, "ArrowLeft", counts(0, 3)),
        { side: "inventory", index: 1 }
      );
      // inventory empty: pressing Right from container keeps you in container.
      assert.deepEqual(
        moveHarthmereContainerFocusV1({ side: "container", index: 1 }, "ArrowRight", counts(3, 0)),
        { side: "container", index: 1 }
      );
    });
    it("navigating from undefined/stale focus first clamps to a valid cell", () => {
      assert.deepEqual(
        moveHarthmereContainerFocusV1(undefined, "ArrowDown", counts(2, 2)),
        { side: "container", index: 1 }
      );
      assert.equal(
        moveHarthmereContainerFocusV1(undefined, "ArrowDown", counts(0, 0)),
        undefined
      );
    });
  });
});
