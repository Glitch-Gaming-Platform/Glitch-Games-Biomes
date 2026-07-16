import assert from "assert";
import { deserializeTrigger } from "@/server/shared/triggers/serde";
import { BikkieIds } from "@/shared/bikkie/ids";
import { anItem } from "@/shared/game/item";

describe("inventory-has trigger serialization", () => {
  it("round-trips exact-item inventory requirements without becoming collect triggers", () => {
    const stored = {
      kind: "inventoryHas" as const,
      id: 1,
      item: anItem(BikkieIds.dirt),
      count: 3,
    };
    const trigger = deserializeTrigger(stored);

    assert.equal(trigger.kind, "inventoryHas");
    assert.deepEqual(trigger.serialize(), stored);
  });

  it("reports the correct runtime kind for type-matching inventory requirements", () => {
    const stored = {
      kind: "inventoryHasType" as const,
      id: 2,
      typeId: BikkieIds.dirt,
      count: 2,
    };
    const trigger = deserializeTrigger(stored);

    assert.equal(trigger.kind, "inventoryHasType");
    assert.deepEqual(trigger.serialize(), stored);
  });
});
