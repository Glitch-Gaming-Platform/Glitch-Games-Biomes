/// <reference types="mocha" />

import assert from "assert";
import { preserveAuthoredCutsceneGhostMaterials } from "./ghost_materials";

describe("cutscene ghost materials", () => {
  it("preserves the authored palettes on animated and world-scale boss GLBs", () => {
    assert.equal(
      preserveAuthoredCutsceneGhostMaterials(
        "/assets/harthmere/glb/bosses/muck_scarred_helix.glb"
      ),
      true
    );
    assert.equal(
      preserveAuthoredCutsceneGhostMaterials(
        "/assets/harthmere/glb/bosses/ninth_winter_world.glb?capture=1"
      ),
      true
    );
  });

  it("keeps the player-material conversion boundary for unrelated GLTFs", () => {
    assert.equal(
      preserveAuthoredCutsceneGhostMaterials("/api/assets/player_mesh.glb"),
      false
    );
    assert.equal(
      preserveAuthoredCutsceneGhostMaterials("snapshot/player_mesh"),
      false
    );
  });
});
