import {
  describeHotbarPrimaryAction,
  isHotbarActionableItem,
} from "@/client/components/biomes_ui/hotbar/hotbarAction";
import assert from "assert";

describe("describeHotbarPrimaryAction", () => {
  it("keeps voxel placement separate from throwing", () => {
    assert.deepEqual(
      describeHotbarPrimaryAction({ action: "place", isBlock: true }),
      {
        kind: "place",
        label: "Place",
        holdDurationMs: 350,
      }
    );
  });

  it("labels native weapons, tools, magic, and consumables", () => {
    assert.equal(describeHotbarPrimaryAction({ dps: 10 }).label, "Attack");
    assert.equal(
      describeHotbarPrimaryAction({ isTool: true }).label,
      "Use Tool"
    );
    assert.equal(describeHotbarPrimaryAction({ action: "wand" }).label, "Cast");
    assert.equal(describeHotbarPrimaryAction({ action: "eat" }).label, "Eat");
  });

  it("holds channelled native actions long enough to complete", () => {
    assert.equal(
      describeHotbarPrimaryAction({ action: "drink" }).holdDurationMs,
      1150
    );
    assert.equal(
      describeHotbarPrimaryAction({ action: "warpHome" }).holdDurationMs,
      1150
    );
  });

  it("allows authored magic/camera actions even when they are not generic tools", () => {
    assert.equal(isHotbarActionableItem({ action: "wand" }), true);
    assert.equal(isHotbarActionableItem({ action: "waypointCam" }), true);
    assert.equal(
      isHotbarActionableItem({ isQuest: true, action: "wand" }),
      false
    );
  });
});
