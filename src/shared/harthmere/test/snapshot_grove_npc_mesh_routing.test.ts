/// <reference types="mocha" />
import assert from "assert";
import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_NPC_ASSET_KEYS,
  snapshotGroveNpcAssetKeyForEntity,
} from "@/shared/harthmere/snapshot_grove_npc_mesh_routing";

describe("snapshot Grove NPC mesh routing", () => {
  it("routes every authored snapshot NPC asset to its original snapshot GLB", () => {
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      if (!npc.snapshotAsset) {
        continue;
      }
      const entityId = snapshotGroveNpcEntityId(npc);
      assert.ok(
        snapshotGroveNpcAssetKeyForEntity(entityId, npc.displayName),
        `${npc.displayName} should use its archived snapshot asset`
      );
    }
  });

  it("lets no-asset Grove humans fall through to the player-like avatar renderer", () => {
    const gus = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "gus_the_baker");
    assert.ok(gus, "Gus the Baker should be seeded into the Grove cast");

    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(
        snapshotGroveNpcEntityId(gus!),
        gus!.displayName
      ),
      undefined
    );
    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(999 as BiomesId, "Gus Baker"),
      undefined
    );
  });

  it("keeps archived Grove assets complete, including Sil and Doc from the snapshot", () => {
    const jackie = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "jackie");
    const sil = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "sil");
    const doc = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "doc");
    assert.ok(jackie, "Jackie should be seeded into the Grove cast");
    assert.ok(sil, "Sil should be seeded into the Grove cast");
    assert.ok(doc, "Doc should be seeded into the Grove cast");
    const jackieEntityId = snapshotGroveNpcEntityId(jackie!);
    const silEntityId = snapshotGroveNpcEntityId(sil!);
    const docEntityId = snapshotGroveNpcEntityId(doc!);

    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(jackieEntityId),
      "npcs/jackie"
    );
    assert.equal(snapshotGroveNpcAssetKeyForEntity(silEntityId), "npcs/sil");
    assert.equal(snapshotGroveNpcAssetKeyForEntity(docEntityId), "npcs/doc");
    assert.equal(SNAPSHOT_GROVE_NPC_ASSET_KEYS.sil, "npcs/sil");
    assert.equal(SNAPSHOT_GROVE_NPC_ASSET_KEYS.doc, "npcs/doc");
  });

  it("uses the compact helping-robot mesh for every robot identity and helper label", () => {
    const buddy = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "buddy");
    assert.ok(buddy, "Buddy should be seeded into the Grove cast");

    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(
        snapshotGroveNpcEntityId(buddy!),
        buddy!.displayName
      ),
      "npcs/helping_robot"
    );
    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(
        998 as BiomesId,
        "Biomes Bot",
        { isRobot: true }
      ),
      "npcs/helping_robot"
    );
    assert.equal(
      snapshotGroveNpcAssetKeyForEntity(999 as BiomesId, "West Sentinel"),
      "npcs/helping_robot"
    );
  });
});
