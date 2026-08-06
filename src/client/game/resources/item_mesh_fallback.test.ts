import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import { scenesForObject } from "@/client/game/renderers/scenes";
import { makeMissingItemMesh } from "@/client/game/resources/item_mesh";
import { BikkieIds } from "@/shared/bikkie/ids";
import { anItem } from "@/shared/game/item";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import assert from "assert";
import * as THREE from "three";

function assertRendererSafeFallback(itemId: number) {
  const factory = makeMissingItemMesh(anItem(itemId), "test fallback");
  const instance = factory();
  const playerRoot = new THREE.Group();
  playerRoot.userData.harthmerePlayerAvatarBasePassMaterialsVersion =
    "harthmere-player-avatar-base-pass-materials";
  playerRoot.add(instance.three);

  try {
    let meshCount = 0;
    playerRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshCount += 1;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        assert.ok(
          material instanceof BasePassMaterial,
          `${object.name || "procedural fallback"} used ${material.type}`
        );
        assert.equal(material instanceof THREE.MeshStandardMaterial, false);
      }
    });
    assert.ok(meshCount > 0);
    assert.deepEqual([...scenesForObject(playerRoot)], ["base"]);
  } finally {
    instance.dispose();
    factory.dispose();
  }
}

describe("procedural held-item renderer compatibility", () => {
  it("keeps the generic missing-item fallback in the player base pass", () => {
    const coreCellId = harthmereNativeBiomesIdForItemId(
      "item_augur9_core_cell"
    );
    assert.ok(coreCellId);
    assertRendererSafeFallback(coreCellId);
  });

  it("keeps every procedural Spikefish descendant in the player base pass", () => {
    assertRendererSafeFallback(BikkieIds.spikefish);
  });
});
