import { fetchUserBundles, findByUID } from "@/server/web/db/users_fetch";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { avatarPlaceholderURL, resolveImageUrls } from "@/server/web/util/urls";
import { zSpecialRoles } from "@/shared/acl_types";
import type { UserBundle } from "@/shared/types";
import { zUserBundle } from "@/shared/types";
import { z } from "zod";

export const zSelfProfileResponse = z.object({
  user: zUserBundle,
  profilePicHash: z.string().optional(),
  roles: z.array(zSpecialRoles),
});

export type SelfProfileResponse = z.infer<typeof zSelfProfileResponse>;

export default biomesApiHandler(
  {
    auth: "required",
    response: zSelfProfileResponse,
  },
  async ({ context: { db, worldApi }, auth: { userId } }) => {
    const [user, userEntity] = await Promise.all([
      findByUID(db, userId),
      worldApi.get(userId),
    ]);

    const persistedBundle = user
      ? (await fetchUserBundles(db, user))[0]
      : undefined;

    // GLITCH_SELF_PROFILE_MEMORY_DB_FALLBACK:
    // In the Glitch/Harthmere runtime, social storage is forced to in-memory
    // (server_config chooses "memory" whenever GCP/Firestore is disabled), so an
    // authed player has no persisted "users" document and findByUID returns
    // undefined. The route previously responded 404 here, which broke the
    // profile / character / inventory screens for every logged-in Glitch player.
    // The player's live world entity always exists for an authed user, so
    // synthesize a minimal-but-valid profile from it (placeholder avatar, zeroed
    // social counters) and return 200 instead of 404. Real Firestore deployments
    // keep the persisted bundle and are unaffected.
    const userBundle: UserBundle =
      persistedBundle ?? {
        id: userId,
        createMs: 0,
        username: userEntity?.label()?.text,
        profilePicImageUrls: resolveImageUrls(
          "biomes-social",
          {},
          avatarPlaceholderURL()
        ),
        numFollowers: 0,
        numFollowing: 0,
        numPhotos: 0,
        disabled: false,
      };

    return {
      user: userBundle,
      profilePicHash: user?.profilePicHash,
      roles: [...(userEntity?.userRoles()?.roles ?? [])],
    };
  }
);
