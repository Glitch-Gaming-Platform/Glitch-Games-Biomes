/// <reference types="mocha" />

import {
  miniPhonePostDetailLoadState,
  type MiniPhonePostDetailLoadState,
} from "@/client/components/social/MiniPhonePostDetailState";
import type { FeedPostBundle } from "@/shared/types";
import assert from "assert";

describe("MiniPhonePostDetailPage", () => {
  it("distinguishes loading from a missing photo", () => {
    const cases: Array<{
      post: FeedPostBundle | null | undefined;
      expected: MiniPhonePostDetailLoadState;
    }> = [
      { post: undefined, expected: "loading" },
      { post: null, expected: "missing" },
      { post: {} as FeedPostBundle, expected: "ready" },
    ];

    for (const { post, expected } of cases) {
      assert.equal(miniPhonePostDetailLoadState(post), expected);
    }
  });
});
