import assert from "assert";

import { localFallbackMapMetadata } from "@/pages/api/world_map/metadata";
import { HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";
import { zWorldMapMetadataResponse } from "@/shared/types";

function assertValidFallbackResponse(
  metadata: ReturnType<typeof localFallbackMapMetadata>
) {
  assert.equal(
    zWorldMapMetadataResponse.safeParse({
      ...metadata,
      socialData: {},
    }).success,
    true
  );
}

describe("world map metadata fallback", () => {
  it("uses both corners of the ECS world metadata AABB", () => {
    const metadata = localFallbackMapMetadata({
      aabb: [
        [-10, -1, -20],
        [30, 2, 40],
      ],
    } as any);

    assert.deepEqual(metadata.boundsStart, [-10, -20]);
    assert.deepEqual(metadata.boundsEnd, [30, 40]);
    assert.equal(metadata.fullImageWidth, 40);
    assert.equal(metadata.fullImageHeight, 60);
    assertValidFallbackResponse(metadata);
  });

  it("keeps finite default bounds when metadata is missing or malformed", () => {
    const missing = localFallbackMapMetadata(undefined);
    const malformed = localFallbackMapMetadata({ aabb: [0, 0, 0] } as any);

    for (const metadata of [missing, malformed]) {
      assert.deepEqual(metadata.boundsStart, [-2048, -2048]);
      assert.deepEqual(metadata.boundsEnd, [
        HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
        2048,
      ]);
      assert.equal(
        metadata.fullImageWidth,
        HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X + 2048
      );
      assert.equal(metadata.fullImageHeight, 4096);
      assertValidFallbackResponse(metadata);
    }
  });
});
