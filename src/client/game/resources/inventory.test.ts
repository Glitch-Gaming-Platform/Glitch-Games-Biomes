import {
  cameraExitHotbarIndex,
  isCameraExitKey,
} from "@/client/game/resources/inventory";
import { Inventory } from "@/shared/ecs/gen/components";
import type { ItemAndCount } from "@/shared/ecs/gen/types";
import type { Item } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

function slot(id: number, action: string): ItemAndCount {
  return {
    item: { id: id as BiomesId, action } as Item,
    count: 1n,
  };
}

describe("camera hotbar exit selection", () => {
  it("recognizes X as a camera exit independently of pointer-lock state", () => {
    assert.equal(
      isCameraExitKey("KeyX", {
        kind: "camera",
        ref: { kind: "hotbar", idx: 0 },
        mode: { kind: "selfie", label: "Selfie", modeType: "selfie" },
      }),
      true
    );
    assert.equal(
      isCameraExitKey("KeyF", {
        kind: "camera",
        ref: { kind: "hotbar", idx: 0 },
        mode: { kind: "selfie", label: "Selfie", modeType: "selfie" },
      }),
      false
    );
    assert.equal(isCameraExitKey("KeyX", { kind: "hotbar", idx: 0 }), false);
  });

  it("returns to the nearest preceding non-camera tool", () => {
    const inventory = Inventory.create({
      hotbar: [
        slot(1, "destroy"),
        undefined,
        slot(2, "place"),
        slot(3, "photo"),
      ],
    });
    assert.equal(cameraExitHotbarIndex(inventory, 3), 2);
  });

  it("uses an empty slot when every occupied slot is a camera", () => {
    const inventory = Inventory.create({
      hotbar: [slot(1, "photo"), undefined, slot(2, "photo")],
    });
    assert.equal(cameraExitHotbarIndex(inventory, 2), 1);
  });

  it("returns -1 only when no hotbar exit exists", () => {
    const inventory = Inventory.create({
      hotbar: [slot(1, "photo"), slot(2, "photo")],
    });
    assert.equal(cameraExitHotbarIndex(inventory, 1), -1);
    assert.equal(cameraExitHotbarIndex(undefined, 0), -1);
  });
});
