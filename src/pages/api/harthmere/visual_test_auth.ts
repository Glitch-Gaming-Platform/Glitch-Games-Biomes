import { ensurePlayerExists } from "@/server/logic/utils/players";
import { setAuthCookies } from "@/server/shared/auth/cookies";
import { GameEvent } from "@/server/shared/api/game_event";
import { getUserOrCreateIfNotExists } from "@/server/web/db/users";
import { usernameOrIdToUser } from "@/server/web/util/admin";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { LabelChangeEvent, PlayerInitEvent } from "@/shared/ecs/gen/events";
import { APIError } from "@/shared/api/errors";
import { safeParseBiomesId, zBiomesId, type BiomesId } from "@/shared/ids";
import { z } from "zod";

function requireVisualTestAuthEnabled() {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.HARTHMERE_VISUAL_TEST_AUTH === "1"
  ) {
    return;
  }
  throw new APIError("unauthorized", "Visual test auth is disabled.");
}

export const zHarthmereVisualTestAuthResponse = z.object({
  userId: zBiomesId,
  username: z.string().optional(),
  mode: z.literal("harthmere_visual_test_auth"),
});

export type HarthmereVisualTestAuthResponse = z.infer<
  typeof zHarthmereVisualTestAuthResponse
>;

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    query: z.object({
      usernameOrId: z.string().min(1).max(64),
    }),
    response: zHarthmereVisualTestAuthResponse,
  },
  async ({
    context: { db, idGenerator, logicApi, sessionStore, worldApi },
    query: { usernameOrId },
    unsafeRequest,
    unsafeResponse,
  }) => {
    requireVisualTestAuthEnabled();

    const existingUser = await usernameOrIdToUser(db, usernameOrId);
    const parsedId = safeParseBiomesId(usernameOrId);
    const userId: BiomesId =
      existingUser?.id ?? parsedId ?? (await idGenerator.next());
    const desiredUsername =
      existingUser?.username ?? (parsedId === undefined ? usernameOrId : undefined);
    const user = await getUserOrCreateIfNotExists(db, userId, desiredUsername);

    const editor = worldApi.edit();
    await ensurePlayerExists(editor, user.id, user.username ?? "VisualTestPlayer");
    await editor.commit();
    await logicApi.publish(
      new GameEvent(user.id, new PlayerInitEvent({ id: user.id })),
      new GameEvent(
        user.id,
        new LabelChangeEvent({
          id: user.id,
          text: user.username ?? desiredUsername ?? "VisualTestPlayer",
        })
      )
    );

    const session = await sessionStore.createSession(user.id);
    setAuthCookies(unsafeResponse, session, unsafeRequest);

    return {
      userId: user.id,
      username: user.username,
      mode: "harthmere_visual_test_auth" as const,
    };
  }
);
