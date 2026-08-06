/// <reference types="mocha" />
import {
  ParticleSystemMaterials,
  type ParticleSystemDynamics,
} from "@/client/game/resources/particles";
import assert from "assert";
import { DataArrayTexture, DataTexture } from "three";

// Regression coverage for the transparent fallback textures installed for
// sprite particles. These resources are created during ordinary player/NPC
// boot, before the live sprite texture has anything to do with terrain atlases.
describe("particle texture fallbacks", () => {
  it("constructs transparent RGBA placeholders without RGB expansion", () => {
    const dynamics: ParticleSystemDynamics = {
      numParticles: 1,
      spawnType: { kind: "point" },
      lifespanRange: [0, 1],
      velocityRange: [
        [0, 0, 0],
        [0, 0, 0],
      ],
      acceleration: [0, 0, 0],
      sizeRange: [1, 1],
      emissiveBoost: 0,
    };
    const materials = ParticleSystemMaterials.createTextureMaterials(
      dynamics,
      new DataTexture()
    );

    try {
      for (const uniformName of ["colorMap", "mreaMap"]) {
        const texture = materials.material.uniforms[uniformName]
          .value as DataArrayTexture;
        assert.ok(texture instanceof DataArrayTexture);
        assert.deepEqual(Array.from(texture.image.data), [0, 0, 0, 0]);
      }
    } finally {
      materials.dispose();
    }
  });
});
