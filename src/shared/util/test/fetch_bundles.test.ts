/// <reference types="mocha" />

import { zPostBatchResponse } from "@/shared/util/fetch_bundles";
import assert from "assert";

describe("fetch bundle schemas", () => {
  it("accepts null posts in batched post responses", () => {
    assert.deepEqual(zPostBatchResponse.parse({ posts: [null] }), {
      posts: [null],
    });
  });
});
