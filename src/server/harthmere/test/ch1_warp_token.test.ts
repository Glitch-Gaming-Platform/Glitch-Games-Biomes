import {
  authorizeCh1Warp,
  type Ch1WarpAuthorizationInput,
  validateCh1WarpAuthorization,
} from "@/server/harthmere/ch1_warp_token";
import { createRandomSecrets } from "@/server/shared/secrets";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

describe("Chapter One warp authorization", () => {
  let previousSecrets: unknown;

  before(() => {
    previousSecrets = (global as any)._global_secrets;
    (global as any)._global_secrets = createRandomSecrets(
      "chapter-one-warp-token-test"
    );
  });

  after(() => {
    if (previousSecrets === undefined) {
      delete (global as any)._global_secrets;
    } else {
      (global as any)._global_secrets = previousSecrets;
    }
  });

  function input(): Ch1WarpAuthorizationInput {
    return {
      id: generateTestId(),
      action: "enter",
      dungeon_id: "ch1_dungeon_desert",
      run_id: "run-1",
      party_id: "party-1",
      reset_encounters: true,
      position: [100.25, 72, -40.75],
      orientation: [0.02, 3.15],
    };
  }

  it("accepts event-transport changes to non-authoritative camera orientation", () => {
    const signed = input();
    const authorization = authorizeCh1Warp(signed);

    assert.equal(
      validateCh1WarpAuthorization(
        { ...signed, orientation: [0, 3] },
        authorization
      ),
      true
    );
  });

  it("still rejects changes to the authorized destination", () => {
    const signed = input();
    const authorization = authorizeCh1Warp(signed);

    assert.equal(
      validateCh1WarpAuthorization(
        { ...signed, position: [100.5, 72, -40.75] },
        authorization
      ),
      false
    );
  });

  it("still rejects changes to the authorized transition", () => {
    const signed = input();
    const authorization = authorizeCh1Warp(signed);

    assert.equal(
      validateCh1WarpAuthorization(
        { ...signed, action: "exit" },
        authorization
      ),
      false
    );
  });
});
