import { updateProfilePicture } from "@/server/web/db/users";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { z } from "zod";

export const zUpdateProfilePictureRequest = z.object({
  photoDataURI: z.string(),
  hash: z.string(),
});

export type UpdateProfilePictureRequest = z.infer<
  typeof zUpdateProfilePictureRequest
>;

export default biomesApiHandler(
  {
    auth: "required",
    body: zUpdateProfilePictureRequest,
  },
  async ({
    context: { db, worldApi },
    auth: { userId },
    body: { photoDataURI, hash },
  }) => {
    const player = await worldApi.get(userId);
    await updateProfilePicture(
      db,
      userId,
      photoDataURI,
      hash,
      player?.label()?.text
    );
  }
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};
