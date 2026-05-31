import { zSocialPostRequest } from "@/pages/api/social/post";
import { zUserGroupsCreatedRequest } from "@/pages/api/social/user_groups_created";
import assert from "assert";

describe("social API query id parsing", () => {
  it("accepts query-string IDs for post lookups", () => {
    const parsed = zSocialPostRequest.parse({
      postId: "7979754216961261",
    });

    assert.equal(parsed.postId, 7979754216961261);
  });

  it("accepts query-string IDs for user group feeds", () => {
    const parsed = zUserGroupsCreatedRequest.parse({
      userId: "7979754216961261",
      pagingToken: "next-page",
    });

    assert.equal(parsed.userId, 7979754216961261);
    assert.equal(parsed.pagingToken, "next-page");
  });

  it("rejects malformed IDs before touching backend services", () => {
    assert.throws(() =>
      zSocialPostRequest.parse({
        postId: "not-a-biomes-id",
      })
    );
    assert.throws(() =>
      zUserGroupsCreatedRequest.parse({
        userId: "not-a-biomes-id",
      })
    );
  });
});
