import { CONTAINER_ACCESS_ACL_ACTION } from "@/shared/game/container_access";
import assert from "assert";

describe("native container access contract", () => {
  it("uses interact independently from destroy permission", () => {
    assert.equal(CONTAINER_ACCESS_ACL_ACTION, "interact");
  });
});
