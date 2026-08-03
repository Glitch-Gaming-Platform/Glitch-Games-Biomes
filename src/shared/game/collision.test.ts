import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { isCollidable } from "@/shared/game/collision";
import assert from "assert";

describe("entity collision eligibility", () => {
  it("does not collide with iced entities retained by a warm snapshot", () => {
    const iced = {
      id: 1,
      iced: {},
      collideable: {},
    } as ReadonlyEntity;

    assert.equal(isCollidable(iced), false);
  });

  it("keeps active collideable entities solid", () => {
    const active = {
      id: 2,
      collideable: {},
    } as ReadonlyEntity;

    assert.equal(isCollidable(active), true);
  });
});
