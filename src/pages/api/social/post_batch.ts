import { fetchFeedPostBundlesByIds } from "@/server/web/db/social";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  orderedNullablePostBatchResponse,
  zPostBatchRequest,
  zPostBatchResponse,
} from "@/shared/util/fetch_bundles";

export default biomesApiHandler(
  {
    auth: "optional",
    body: zPostBatchRequest,
    response: zPostBatchResponse,
  },
  async ({ context: { db, worldApi }, auth, body: { ids } }) => {
    const posts = await fetchFeedPostBundlesByIds(
      db,
      worldApi,
      ids,
      auth?.userId
    );
    return orderedNullablePostBatchResponse(ids, posts);
  }
);
