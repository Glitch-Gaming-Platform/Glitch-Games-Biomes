import { zBiscuit } from "@/shared/bikkie/schema/attributes";
import type { BiomesId } from "@/shared/ids";
import { zBehavior } from "@/shared/npc/npc_types";
import { zrpcWebDeserialize, zrpcWebSerialize } from "@/shared/zrpc/serde";
import assert from "assert";

const OBJECT_VALUED_BEHAVIORS = [
  "meander",
  "swim",
  "fly",
  "chaseAttack",
  "questGiver",
  "damageable",
  "sizeVariation",
  "hideNameOverlay",
  "socialize",
] as const;

describe("NPC behavior schema", () => {
  it("normalizes every legacy false behavior flag to an absent field", () => {
    const legacy = Object.fromEntries(
      OBJECT_VALUED_BEHAVIORS.map((key) => [key, false])
    );

    assert.deepEqual(zBehavior.parse(legacy), {});
  });

  it("normalizes every legacy true behavior flag to its default object", () => {
    const legacy = Object.fromEntries(
      OBJECT_VALUED_BEHAVIORS.map((key) => [key, true])
    );
    const parsed = zBehavior.parse(legacy);

    for (const key of OBJECT_VALUED_BEHAVIORS) {
      assert.ok(parsed[key], `${key} should be enabled`);
      assert.equal(typeof parsed[key], "object");
    }
  });

  it("still rejects invalid non-boolean behavior shorthands", () => {
    assert.equal(zBehavior.safeParse({ questGiver: "yes" }).success, false);
  });

  it("deserializes the production legacy questGiver payload", () => {
    const serialized = zrpcWebSerialize({
      id: 8_810_000_000_020_002 as BiomesId,
      name: "legacy_quest_giver_flag",
      behavior: {
        questGiver: false,
      },
    });

    const biscuit = zrpcWebDeserialize(serialized, zBiscuit);
    assert.deepEqual(biscuit.behavior, {});
  });
});
