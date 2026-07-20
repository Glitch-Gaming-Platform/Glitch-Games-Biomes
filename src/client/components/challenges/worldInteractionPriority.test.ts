import { hasNativeInspectableWorldTarget } from "@/client/components/challenges/worldInteractionPriority";
import type { OverlayMap } from "@/client/game/resources/overlays";
import assert from "assert";

describe("world interaction F-key priority", () => {
  it("lets native plants, containers, quest objects, and grab bags block bespoke capture listeners", () => {
    for (const overlay of [
      { kind: "plant", key: "plant", entityId: 1 },
      { kind: "placeable", key: "container", entityId: 2 },
      { kind: "harthmere_object", key: "quest", entityId: 3 },
      { kind: "grab_bag", key: "drop", entityId: 4 },
    ]) {
      assert.equal(
        hasNativeInspectableWorldTarget(
          new Map([[overlay.key, overlay]]) as OverlayMap
        ),
        true
      );
    }
  });

  it("does not block on projected labels or loot notification overlays", () => {
    assert.equal(
      hasNativeInspectableWorldTarget(
        new Map([
          [
            "name",
            {
              kind: "name",
              key: "name",
              entityId: 1,
              name: "Crate",
            },
          ],
          ["loot", { kind: "loot", key: "loot", posX: 0 }],
        ]) as OverlayMap
      ),
      false
    );
  });
});
