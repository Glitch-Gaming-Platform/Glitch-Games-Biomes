/// <reference types="mocha" />

import type { SocialManager } from "@/client/game/context_managers/social_manager";
import { subscribeUserInfoInvalidation } from "@/client/util/user_info_invalidation_broker";
import type { BiomesId } from "@/shared/ids";
import type { UserInfoBundle } from "@/shared/util/fetch_bundles";
import assert from "assert";
import { EventEmitter } from "events";

describe("user info invalidation broker", () => {
  it("uses one EventEmitter listener for hundreds of mounted user consumers", () => {
    const emitter = new EventEmitter();
    const socialManager = { emitter } as unknown as SocialManager;
    const received: number[] = [];
    const cleanups = Array.from({ length: 250 }, (_, index) =>
      subscribeUserInfoInvalidation(
        socialManager,
        (index + 1) as BiomesId,
        () => received.push(index + 1)
      )
    );

    assert.equal(emitter.listenerCount("invalidateUserInfo"), 1);
    emitter.emit(
      "invalidateUserInfo",
      137 as BiomesId,
      null as UserInfoBundle | null
    );
    assert.deepEqual(received, [137]);

    for (const cleanup of cleanups.slice(0, 249)) cleanup();
    assert.equal(emitter.listenerCount("invalidateUserInfo"), 1);
    cleanups[249]();
    assert.equal(emitter.listenerCount("invalidateUserInfo"), 0);
  });

  it("does not subscribe for an absent user id and cleanup is idempotent", () => {
    const emitter = new EventEmitter();
    const socialManager = { emitter } as unknown as SocialManager;
    const cleanup = subscribeUserInfoInvalidation(
      socialManager,
      undefined,
      () => assert.fail("absent user listener should never fire")
    );
    assert.equal(emitter.listenerCount("invalidateUserInfo"), 0);
    cleanup();
    cleanup();
  });
});
