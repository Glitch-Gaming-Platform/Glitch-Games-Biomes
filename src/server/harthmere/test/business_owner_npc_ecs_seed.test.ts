import assert from "assert";

import { buildHarthmereBusinessOwnerNpcSeedChanges } from "@/server/harthmere/business_owner_npc_ecs_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import type { BiomesId } from "@/shared/ids";

describe("business owner NPC ECS seed builder", () => {
  it("creates one fully-formed NPC entity per business owner", () => {
    const changes = buildHarthmereBusinessOwnerNpcSeedChanges({
      tick: 1,
      nowSeconds: 1000,
    });
    assert.equal(changes.length, HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.length);

    const descriptions = new Set<string>();
    const ids = new Set<BiomesId>();
    for (const change of changes) {
      assert.equal(change.kind, "create");
      assert.ok(change.kind !== "delete");
      const entity = (change as { entity: any }).entity;
      const seed = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.find(
        (candidate) => candidate.entityId === entity.id
      );
      assert.ok(seed, `unexpected entity id ${entity.id}`);

      // Named, positioned, and talkable shopkeeper.
      assert.equal(entity.label?.text, seed!.displayName);
      assert.deepEqual(entity.position?.v, seed!.position);
      assert.ok(entity.npc_metadata, "owner needs npc_metadata to be an NPC");
      assert.ok(entity.health, "owner needs health to render");
      assert.ok(entity.quest_giver, "owner should be a quest giver");
      assert.ok(
        String(entity.default_dialog?.text ?? "").includes(seed!.line),
        "owner dialog should include its authored line"
      );

      // Unique generated appearance (embedded in the entity description markers).
      const description = String(entity.entity_description?.text ?? "");
      assert.ok(description.length > 0, "owner needs an appearance description");
      assert.ok(!descriptions.has(description), "owner appearances must be unique");
      descriptions.add(description);

      ids.add(entity.id);
    }
    assert.equal(ids.size, changes.length, "owner entity ids must be unique");
  });

  it("emits updates instead of creates for already-seeded owners", () => {
    const existingIds = new Set<BiomesId>([
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS[0].entityId,
    ]);
    const changes = buildHarthmereBusinessOwnerNpcSeedChanges({
      tick: 2,
      nowSeconds: 1000,
      existingIds,
    });
    const first = changes.find(
      (change) =>
        change.kind !== "delete" &&
        (change as { entity: any }).entity.id ===
          HARTHMERE_BUSINESS_OWNER_NPC_SEEDS[0].entityId
    );
    assert.ok(first);
    assert.equal(first!.kind, "update");
  });
});
