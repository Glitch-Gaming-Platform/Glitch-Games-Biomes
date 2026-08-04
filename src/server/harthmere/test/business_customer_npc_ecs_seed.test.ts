import assert from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildHarthmereBusinessCustomerNpcSeedChanges,
  harthmereBusinessCustomerAppearance,
} from "../business_customer_npc_ecs_seed";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS,
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION,
} from "@/shared/harthmere/business_customer_npc_seed";
import { deserializeNpcCustomState } from "@/shared/npc/serde";

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

  it("registers every persistent patron for native ECS without making the shop run for the door", () => {
    const changes = buildHarthmereBusinessCustomerNpcSeedChanges({
      tick: 1,
      nowSeconds: 1000,
    });
    assert.equal(changes.length, 57);
    for (const change of changes) {
      assert.ok(change.kind === "create");
      for (const component of [
        "npc_metadata",
        "npc_state",
        "orientation",
        "position",
        "rigid_body",
        "size",
        "health",
      ] as const) {
        assert.ok(
          change.entity[component],
          `${change.entity.id} missing ${component}`
        );
      }
      const state = deserializeNpcCustomState(
        change.entity.npc_state?.data
      ).businessCustomer;
      assert.equal(state?.phase, "patron_wandering");
      assert.deepEqual(state?.waypoints, [change.entity.position?.v]);
    }
  });

  it("keeps patrons and business physics authoritative when additive terrain is disabled", () => {
    assert.equal(
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION,
      "harthmere-business-customer-npc-seed-v2"
    );
    const shim = readFileSync(
      resolve(process.cwd(), "src/server/shim/main.ts"),
      "utf8"
    );
    assert.match(shim, /buildHarthmereBusinessCustomerNpcSeedChanges/);
    assert.doesNotMatch(shim, /makeRetiredBusinessCustomerNpcChanges/);
    assert.match(
      shim,
      /const runtimeContentEnabled = shouldSeedHarthmereRuntimeContent\(\)/
    );
    assert.match(
      shim,
      /if \(runtimeContentEnabled\) \{[\s\S]*seedMissingLocalDevContentIntoExistingWorld\(service, worldApi\)/
    );
    assert.match(
      shim,
      /candidateIds\.every\(\(id\) => existingIds\.has\(id\)\)/
    );
  });

  it("gives all 57 patrons distinct clothing, face, and accessory combinations", () => {
    const signatures = new Set<string>();
    for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
      const appearance = harthmereBusinessCustomerAppearance(seed);
      const signature = JSON.stringify({
        clothing: appearance.clothing,
        faceAccessory: appearance.face.accessory,
        facialHair: appearance.face.facialHair,
      });
      assert.ok(
        !signatures.has(signature),
        `${seed.customerNpcId} repeats ${signature}`
      );
      signatures.add(signature);
    }
    assert.equal(signatures.size, 57);
  });
});
