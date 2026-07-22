import assert from "assert";
import { buildHarthmereBusinessCustomerNpcSeedChanges } from "../business_customer_npc_ecs_seed";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";

describe("business customer NPC ECS seed cosmetics", () => {
  it("omits uniform cosmetics on create and explicitly removes them on update", () => {
    const first = HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS[0];
    const creates = buildHarthmereBusinessCustomerNpcSeedChanges({
      tick: 1,
      nowSeconds: 1000,
    });
    const created = creates.find(
      (change) =>
        change.kind === "create" && change.entity.id === first.entityId
    );
    assert.ok(created && created.kind === "create");
    assert.equal(created.entity.appearance_component, undefined);
    assert.equal(created.entity.wearing, undefined);

    const updates = buildHarthmereBusinessCustomerNpcSeedChanges({
      tick: 2,
      nowSeconds: 1000,
      existingIds: new Set([first.entityId]),
    });
    const updated = updates.find(
      (change) =>
        change.kind === "update" && change.entity.id === first.entityId
    );
    assert.ok(updated && updated.kind === "update");
    assert.equal(updated.entity.appearance_component, null);
    assert.equal(updated.entity.wearing, null);
  });
});
