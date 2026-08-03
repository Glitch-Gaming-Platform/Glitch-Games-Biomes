import { snapshotCombatNativeNpcTypeId } from "@/server/harthmere/snapshot_combat_npc_ecs_seed";
import { HARTHMERE_NATIVE_NPC_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import assert from "assert";

describe("snapshot combat NPC native types", () => {
  it("routes every imported Mucker family through an exact combat profile", () => {
    assert.equal(
      snapshotCombatNativeNpcTypeId("muckling"),
      HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_watchtower_muckling
    );
    assert.equal(
      snapshotCombatNativeNpcTypeId("mucker"),
      HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_watchtower_clearing_mucker
    );
    assert.equal(
      snapshotCombatNativeNpcTypeId("wild_mucker"),
      HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_old_wood_mucker
    );
  });
});
