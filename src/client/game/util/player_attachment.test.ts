import {
  findPlayerHeldItemAttachmentParent,
  playerHeldItemAttachmentParent,
} from "@/client/game/util/player_attachment";
import assert from "assert";
import * as THREE from "three";

function node(name: string) {
  const value = new THREE.Object3D();
  value.name = name;
  return value;
}

describe("player held-item attachment parent", () => {
  it("prefers the authored Equipped_Attach socket independent of traversal order", () => {
    const root = new THREE.Group();
    const arm = node("R_Arm");
    const hand = node("R_Hand");
    const tool = node("Tool");
    const equipped = node("Equipped_Attach");
    root.add(arm);
    arm.add(hand);
    hand.add(tool);
    tool.add(equipped);

    assert.strictEqual(findPlayerHeldItemAttachmentParent(root), equipped);
  });

  it("falls back through Tool, hand, then arm instead of attaching early to R_Arm", () => {
    const toolRoot = new THREE.Group();
    const toolArm = node("R_Arm");
    const tool = node("Tool");
    toolRoot.add(toolArm, tool);
    assert.strictEqual(findPlayerHeldItemAttachmentParent(toolRoot), tool);

    const handRoot = new THREE.Group();
    const handArm = node("R_Arm");
    const hand = node("RightHand");
    handRoot.add(handArm, hand);
    assert.strictEqual(findPlayerHeldItemAttachmentParent(handRoot), hand);

    const armRoot = new THREE.Group();
    const arm = node("RightArm");
    armRoot.add(arm);
    assert.strictEqual(findPlayerHeldItemAttachmentParent(armRoot), arm);
  });

  it("uses the root only when the rig exposes no usable hand anchor", () => {
    const root = new THREE.Group();
    assert.strictEqual(findPlayerHeldItemAttachmentParent(root), undefined);
    assert.strictEqual(playerHeldItemAttachmentParent(root), root);
  });
});
