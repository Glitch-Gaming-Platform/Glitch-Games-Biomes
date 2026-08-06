import { HarthmereNpcStaggerEffect } from "@/client/game/renderers/npc_stagger_effect";
import assert from "assert";
import fs from "fs";
import path from "path";
import * as THREE from "three";

describe("NPC stagger graphics", () => {
  it("creates a directional poise-break ring and voxel burst", () => {
    const effect = new HarthmereNpcStaggerEffect(
      "heavy",
      10,
      12.15,
      [1, 0, 0],
      1.2
    );
    try {
      assert.equal(effect.three.name, "harthmere-npc-stagger-heavy");
      assert.equal(
        effect.three.userData.harthmereStaggerGraphics.voxelShards,
        12
      );
      assert.ok(effect.three.getObjectByName("stagger-poise-break-ring"));
      assert.equal(
        effect.three.children.filter((child) =>
          child.name.startsWith("stagger-voxel-shard-")
        ).length,
        12
      );
      assert.equal(effect.tick(10.25), true);
      assert.ok(
        effect.three.children.some((child) => child.position.lengthSq() > 0.001)
      );
      assert.equal(effect.tick(12.15), false);
      assert.ok(
        effect.three.quaternion.angleTo(new THREE.Quaternion()) > 0.5,
        "the impact graphic should face the incoming hit direction"
      );
    } finally {
      effect.dispose();
    }
  });

  it("exposes the live browser stagger probe with authority and graphics fields", () => {
    const npcRenderer = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    assert.match(npcRenderer, /__harthmereNpcStaggerDebug/);
    assert.match(npcRenderer, /graphicsVisible:/);
    assert.match(npcRenderer, /attackSuppressed:/);
    assert.match(npcRenderer, /poiseMax:/);
  });
});
