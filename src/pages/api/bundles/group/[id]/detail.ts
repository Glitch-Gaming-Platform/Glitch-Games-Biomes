import { zGroupById } from "@/pages/api/environment_group/[id]";
import { fetchGroupDetailBundle } from "@/server/web/db/environment_groups";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zGroupDetailBundle } from "@/shared/types";

// TODO(akarpenko): Combine api/environment_group/[id] with this.
export default biomesApiHandler(
  {
    auth: "optional",
    query: zGroupById,
    response: zGroupDetailBundle.nullable(),
  },
  async ({ context: { db, worldApi }, auth, query: { id: groupId } }) => {
    const groupBundle = await fetchGroupDetailBundle(db, worldApi, groupId, {
      queryingUserId: auth?.userId,
    });
    return groupBundle ?? null;
  }
);
