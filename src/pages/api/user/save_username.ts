import { invalidUsernameReason } from "@/client/util/auth";
import { GameEvent } from "@/server/shared/api/game_event";
import {
  getUserOrCreateIfNotExists,
  saveUsername,
} from "@/server/web/db/users";
import { findUniqueByUsername } from "@/server/web/db/users_fetch";
import { okOrAPIError } from "@/server/web/errors";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { APIError } from "@/shared/api/errors";
import { LabelChangeEvent, PlayerInitEvent } from "@/shared/ecs/gen/events";
import { z } from "zod";

export const zSaveUsernameRequest = z.object({
  username: z.string().min(1),
});

export type SaveUsernameRequest = z.infer<typeof zSaveUsernameRequest>;

export default biomesApiHandler(
  {
    auth: "required",
    body: zSaveUsernameRequest,
  },
  async ({
    context: { db, logicApi, worldApi },
    auth: { userId },
    body: { username },
  }) => {
    const invalidReason = invalidUsernameReason(username);
    okOrAPIError(!invalidReason, "bad_param", invalidReason);

    const player = await worldApi.get(userId);
    await getUserOrCreateIfNotExists(db, userId, player?.label()?.text);

    const otherUser = await findUniqueByUsername(db, username);
    if (otherUser && otherUser.id !== userId) {
      throw new APIError("bad_param", "That username is taken");
    }

    await saveUsername(db, userId, username);
    await logicApi.publish(
      new GameEvent(userId, new PlayerInitEvent({ id: userId })),
      new GameEvent(
        userId,
        new LabelChangeEvent({ id: userId, text: username })
      )
    );
  }
);
