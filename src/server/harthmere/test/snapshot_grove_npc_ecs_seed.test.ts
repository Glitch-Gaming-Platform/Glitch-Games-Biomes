/// <reference types="mocha" />

import assert from "assert";
import {
  buildHarthmereSnapshotGroveNpcSeedProposedChanges,
  harthmereObsoleteSnapshotGroveNpcIds,
} from "../snapshot_grove_npc_ecs_seed";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import {
  SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_ORIENTATION,
  SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION,
  SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS,
} from "@/shared/harthmere/snapshot_grove_ids";

describe("snapshot Grove NPC ECS seed cosmetics", () => {
  it("keeps Jackie's shared ECS body at the original snapshot Road Ahead post", () => {
    const changes = buildHarthmereSnapshotGroveNpcSeedProposedChanges({
      nowSeconds: 1_800_000_000,
    });
    const jackie = changes.find(
      (change) =>
        change.kind === "create" && change.entity.label?.text === "Jackie"
    );
    assert.ok(jackie && jackie.kind === "create");
    assert.deepEqual(
      jackie.entity.position?.v,
      SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION
    );
    assert.deepEqual(
      jackie.entity.npc_metadata?.spawn_position,
      SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_POSITION
    );
    assert.deepEqual(
      jackie.entity.orientation?.v,
      SNAPSHOT_GROVE_JACKIE_ORIGINAL_SPAWN_ORIENTATION
    );
  });

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

  it("explicitly removes stale default cosmetics when no-asset Grove humans already exist", () => {
    const gus = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "gus_the_baker");
    assert.ok(gus);
    const entityId = snapshotGroveNpcEntityId(gus!);
    const changes = buildHarthmereSnapshotGroveNpcSeedProposedChanges({
      nowSeconds: 1_800_000_000,
      existingIds: new Set([entityId]),
    });
    const update = changes.find(
      (change) => change.kind === "update" && change.entity.id === entityId
    );
    assert.ok(update && update.kind === "update");
    assert.equal(update.entity.appearance_component, null);
    assert.equal(update.entity.wearing, null);
  });

  it("removes obsolete named NPC selves while protecting the canonical entity and real players", () => {
    const jackie = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "jackie");
    assert.ok(jackie);
    const canonicalJackie = snapshotGroveNpcEntityId(jackie!);
    assert.deepEqual(
      harthmereObsoleteSnapshotGroveNpcIds([
        {
          id: canonicalJackie,
          label: "Jackie",
          hasNpcMetadata: true,
        },
        {
          id: SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS.jackie,
          label: "Jackie",
          hasNpcMetadata: true,
        },
        {
          id: 7001 as any,
          label: "Jackie",
          hasNpcMetadata: false,
          hasPlayerStatus: true,
          hasRemoteConnection: true,
        },
        {
          id: 7002 as any,
          label: "Unrelated Jackie Fan",
          hasNpcMetadata: true,
        },
      ]),
      [SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS.jackie]
    );
  });
});
