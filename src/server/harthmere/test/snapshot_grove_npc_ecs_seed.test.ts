/// <reference types="mocha" />

import assert from "assert";
import { buildHarthmereSnapshotGroveNpcSeedProposedChanges } from "../snapshot_grove_npc_ecs_seed";
import { SNAPSHOT_GROVE_NPCS } from "@/shared/harthmere/snapshot_grove_content";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

describe("snapshot Grove NPC ECS seed cosmetics", () => {
  it("drops uniform defaults for no-asset Grove humans so the player avatar renderer supplies distinct cosmetics", () => {
    const changes = buildHarthmereSnapshotGroveNpcSeedProposedChanges({
      nowSeconds: 1_800_000_000,
    });
    const byName = new Map();
    for (const change of changes) {
      if (change.kind === "create") {
        byName.set(change.entity.label?.text, change.entity);
      }
    }

    const billy = byName.get("Billy");
    const gus = byName.get("Gus the Baker");
    const jackie = byName.get("Jackie");
    const muckedRobot = byName.get("Mucked Robot");

    assert.equal(billy?.npc_metadata?.type_id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    assert.equal(gus?.npc_metadata?.type_id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    assert.equal(
      billy?.appearance_component,
      undefined,
      "Billy should use the player/Grove avatar mesh fallback, not a voxel NPC body"
    );
    assert.equal(billy?.wearing, undefined);
    assert.equal(gus?.appearance_component, undefined);
    assert.equal(gus?.wearing, undefined);

    assert.ok(
      SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "jackie")?.snapshotAsset,
      "Jackie keeps the original archived snapshot asset"
    );
    assert.ok(jackie?.appearance_component);
    assert.ok(jackie?.wearing);
    assert.notEqual(
      muckedRobot?.npc_metadata?.type_id,
      LOCAL_DEV_HUMAN_NPC_TYPE_ID
    );
  });
});
