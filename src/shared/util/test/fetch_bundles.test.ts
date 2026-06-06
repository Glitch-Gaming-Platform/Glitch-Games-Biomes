/// <reference types="mocha" />

import {
  orderedNullablePostBatchResponse,
  zPostBatchResponse,
} from "@/shared/util/fetch_bundles";
import assert from "assert";

describe("fetch bundle schemas", () => {
  it("accepts null posts in batched post responses", () => {
    assert.deepEqual(zPostBatchResponse.parse({ posts: [null] }), {
      posts: [null],
    });
  });

  it("orders batched posts and returns null for missing ids", () => {
    assert.deepEqual(
      orderedNullablePostBatchResponse([1 as any, 2 as any, 3 as any], [
        { id: 3 as any, label: "third" },
        undefined,
        { id: 1 as any, label: "first" },
      ]),
      {
        posts: [
          { id: 1, label: "first" },
          null,
          { id: 3, label: "third" },
        ],
      }
    );
  });
});
