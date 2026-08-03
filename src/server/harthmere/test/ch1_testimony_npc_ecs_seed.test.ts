import assert from "assert";
import {
  buildHarthmereChapter1TestimonyNpcSeedProposedChanges,
  harthmereChapter1TestimonyNpcSeedEntityIds,
} from "@/server/harthmere/ch1_testimony_npc_ecs_seed";
import { CH1_TESTIMONY_NPC_BY_NAME } from "@/shared/harthmere/ch1_testimony_npcs";

describe("Chapter 1 testimony NPC ECS seed", () => {
  it("upserts every testimony NPC at its exact authored home", () => {
    const ids = harthmereChapter1TestimonyNpcSeedEntityIds();
    const changes = buildHarthmereChapter1TestimonyNpcSeedProposedChanges({
      nowSeconds: 1_000,
      existingIds: new Set(ids),
    });

    assert.equal(changes.length, 12);
    assert.ok(changes.every((change) => change.kind === "update"));
    for (const change of changes) {
      assert.notEqual(change.kind, "delete");
      assert.deepEqual(
        change.entity.npc_metadata?.spawn_position,
        change.entity.position?.v,
        `${change.entity.label?.text} has a jittered respawn anchor`
      );
    }
  });

  it("keeps deployed Grover on the west post away from Jackie", () => {
    const grover = CH1_TESTIMONY_NPC_BY_NAME.get("Grover");
    assert.ok(grover);
    const [change] = buildHarthmereChapter1TestimonyNpcSeedProposedChanges({
      nowSeconds: 1_000,
      existingIds: new Set([grover.entityId]),
    }).filter(
      (candidate) =>
        candidate.kind !== "delete" && candidate.entity.id === grover.entityId
    );

    assert.ok(change && change.kind !== "delete");
    assert.deepEqual(change.entity.position?.v, [477, 70, -143]);
    assert.deepEqual(
      change.entity.npc_metadata?.spawn_position,
      [477, 70, -143]
    );
  });
});
