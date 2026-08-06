import * as THREE from "three";

export const HARTHMERE_PLAYER_HELD_ITEM_ANCHOR_VERSION =
  "harthmere-held-item-anchor-v2" as const;

/**
 * Finds the authored held-item socket without depending on GLTF traversal
 * order. Generated player rigs place Equipped_Attach beneath Tool and R_Hand;
 * older/fallback rigs may expose only one of those nodes.
 */
export function findPlayerHeldItemAttachmentParent(
  root: THREE.Object3D
): THREE.Object3D | undefined {
  let equippedAttach: THREE.Object3D | undefined;
  let tool: THREE.Object3D | undefined;
  let exactHand: THREE.Object3D | undefined;
  let fuzzyHand: THREE.Object3D | undefined;
  let exactArm: THREE.Object3D | undefined;

  root.traverse((child) => {
    if (child.name === "Equipped_Attach") {
      equippedAttach = child;
    } else if (child.name === "Tool") {
      tool = child;
    } else if (child.name === "R_Hand" || child.name === "RightHand") {
      exactHand = child;
    } else if (
      /righthand/i.test(child.name) ||
      /right_hand/i.test(child.name) ||
      /hand_r/i.test(child.name)
    ) {
      fuzzyHand = child;
    } else if (child.name === "R_Arm" || child.name === "RightArm") {
      exactArm = child;
    }
  });

  return equippedAttach ?? tool ?? exactHand ?? fuzzyHand ?? exactArm;
}

export function playerHeldItemAttachmentParent(root: THREE.Object3D) {
  return findPlayerHeldItemAttachmentParent(root) ?? root;
}
