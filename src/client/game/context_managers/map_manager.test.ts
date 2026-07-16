/// <reference types="mocha" />

import assert from "assert";
import { shouldPublishMapBeamRemoval } from "@/client/game/context_managers/map_manager";

describe("map beam removal throttling", () => {
  it("publishes the first removal and suppresses repeated removals in the window", () => {
    assert.equal(shouldPublishMapBeamRemoval(undefined, 1_000, 20_000), true);
    assert.equal(shouldPublishMapBeamRemoval(1_000, 1_001, 20_000), false);
    assert.equal(shouldPublishMapBeamRemoval(1_000, 20_999, 20_000), false);
  });

  it("allows the same beam to be removed again after the throttle expires", () => {
    assert.equal(shouldPublishMapBeamRemoval(1_000, 21_000, 20_000), true);
  });
});
