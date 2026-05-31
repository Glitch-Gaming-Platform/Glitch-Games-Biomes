import { fetchEnvironmentGroupsCreatorFeed } from "@/server/web/db/environment_groups";
import {
  biomesApiHandler,
  zQueryBiomesId,
} from "@/server/web/util/api_middleware";
import { zEnvironmentGroupBundleFeed } from "@/shared/types";
import { z } from "zod";

export const zUserGroupsCreatedRequest = z.object({
  userId: zQueryBiomesId,
  pagingToken: z.string().optional(),
});

export const zUserGroupsCreatedResponse = z.object({
  groupsFeed: zEnvironmentGroupBundleFeed,
});

export type UserGroupsCreatedResponse = z.infer<
  typeof zUserGroupsCreatedResponse
>;

export default biomesApiHandler(
  {
    auth: "optional",
    query: zUserGroupsCreatedRequest,
    response: zUserGroupsCreatedResponse,
  },
  async ({ context: { db, worldApi }, query: { userId, pagingToken } }) => {
    const [groupsFeed] = await Promise.all([
      fetchEnvironmentGroupsCreatorFeed(db, worldApi, userId, pagingToken),
    ]);
    return {
      groupsFeed,
    };
  }
);
