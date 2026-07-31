/// <reference types="mocha" />

import assert from "assert";
import {
  buildChapter1PropSeedChanges,
  chapter1PropSeedIds,
} from "@/server/harthmere/ch1_prop_ecs_seed";
import { CH1_PROPS } from "@/shared/harthmere/ch1_prop_seed";

describe("Chapter 1 prop ECS migration", () => {
  it("reconciles v1 transforms and item identities without replacing the stores", () => {
    const changes = buildChapter1PropSeedChanges({
      tick: 7,
      nowSeconds: 10,
      existingIds: new Set(chapter1PropSeedIds()),
    });
    assert.equal(changes.length, CH1_PROPS.length);
    for (const [index, change] of changes.entries()) {
      assert.equal(change.kind, "update");
      if (change.kind !== "update") continue;
      const prop = CH1_PROPS[index];
      assert.deepEqual(change.entity.position?.v, prop.position);
      assert.equal(change.entity.placeable_component?.item_id, prop.itemId);
      if (prop.key === "roadhouse_stores") {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            change.entity,
            "container_inventory"
          ),
          false,
          "the stores inventory is preserved"
        );
      }
      if (
        ["roadhouse_table", "roadhouse_bed", "coretta_ledger_desk"].includes(
          prop.key
        )
      ) {
        assert.equal(
          change.entity.container_inventory,
          null,
          `${prop.key} must stop behaving like its v1 wood container stand-in`
        );
      }
    }
  });
});
