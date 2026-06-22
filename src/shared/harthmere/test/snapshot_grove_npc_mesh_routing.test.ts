/// <reference types="mocha" />
import assert from "assert";
import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_NPC_ASSET_KEYS,
  shouldUseSnapshotGroveGeneratedVoxelNpc,
  snapshotGroveGeneratedVoxelNpcIdForEntity,
  snapshotGroveNpcAssetKeyForEntity,
} from "@/shared/harthmere/snapshot_grove_npc_mesh_routing";

describe("snapshot Grove NPC mesh routing", () => {
  it("routes every no-asset Grove NPC to the visible generated voxel fallback", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      const entityId = snapshotGroveNpcEntityId(npc);
      const hasAuthoredAsset = !!SNAPSHOT_GROVE_NPC_ASSET_KEYS[npc.id];
      assert.equal(
        shouldUseSnapshotGroveGeneratedVoxelNpc(entityId, npc.displayName),
        !hasAuthoredAsset,
        `${npc.displayName} should ${
          hasAuthoredAsset
            ? "use its authored asset"
            : "use the visible fallback"
        }`
      );
    }
  });

  it("keeps Gus the Baker visible by matching both the seeded id and live label variants", () => {
    const gus = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "gus_the_baker");
    assert.ok(gus, "Gus the Baker should be seeded into the Grove cast");

    assert.equal(
      shouldUseSnapshotGroveGeneratedVoxelNpc(
        snapshotGroveNpcEntityId(gus!),
        gus!.displayName
      ),
      true
    );
    assert.equal(
      snapshotGroveGeneratedVoxelNpcIdForEntity(999 as BiomesId, "Gus Baker"),
      "gus_the_baker"
    );
    assert.equal(
      shouldUseSnapshotGroveGeneratedVoxelNpc(999 as BiomesId, "Gus Baker"),
      true
    );
  });

  it("keeps authored-asset NPCs off the generated fallback route", () => {
    const jackie = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "jackie");
    assert.ok(jackie, "Jackie should be seeded into the Grove cast");
    const jackieEntityId = snapshotGroveNpcEntityId(jackie!);

    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(jackieEntityId),
      "npcs/jackie"
    );
    assert.equal(
      shouldUseSnapshotGroveGeneratedVoxelNpc(jackieEntityId, "Jackie"),
      false
    );
  });
});
