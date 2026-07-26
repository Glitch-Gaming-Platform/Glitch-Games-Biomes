import { ensurePlayerExists } from "@/server/logic/utils/players";
import { setAuthCookies } from "@/server/shared/auth/cookies";
import { GameEvent } from "@/server/shared/api/game_event";
import { getUserOrCreateIfNotExists } from "@/server/web/db/users";
import { usernameOrIdToUser } from "@/server/web/util/admin";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import { UserRoles } from "@/shared/ecs/gen/components";
import { LabelChangeEvent, PlayerInitEvent } from "@/shared/ecs/gen/events";
import { APIError } from "@/shared/api/errors";
import { safeParseBiomesId, zBiomesId, type BiomesId } from "@/shared/ids";
import { timingSafeEqual } from "crypto";
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

/**
 * The native-ECS browser suite needs authoritative inspection/fixture APIs,
 * which are deliberately admin-only.  This second gate is separate from the
 * ordinary visual-test login so enabling screenshots can never silently grant
 * an administrative role.  The token travels in a header rather than a URL so
 * it is not copied into browser history or normal access logs.
 */
export function harthmereE2EControlTokenMatches(
  configured: string | undefined,
  supplied: string | string[] | undefined
) {
  if (!configured || typeof supplied !== "string") {
    return false;
  }
  const configuredBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    configuredBytes.length === suppliedBytes.length &&
    timingSafeEqual(configuredBytes, suppliedBytes)
  );
}

function requireNativeEcsE2EAdmin(
  suppliedToken: string | string[] | undefined
) {
  if (
    process.env.HARTHMERE_NATIVE_ECS_E2E !== "1" ||
    !harthmereE2EControlTokenMatches(
      process.env.HARTHMERE_E2E_CONTROL_TOKEN,
      suppliedToken
    )
  ) {
    throw new APIError("unauthorized", "Native ECS E2E access is disabled.");
  }
}

export const zHarthmereVisualTestAuthResponse = z.object({
  userId: zBiomesId,
  username: z.string().optional(),
  /**
   * This endpoint is already test-gated. Returning its newly-created session
   * lets the same-origin visual-auth bridge install the auth mirror required
   * by the WebSocket client before `/at` mounts. Without it, HTTP looked
   * authenticated while sync still connected as observer user 0.
   */
  sessionId: z.string(),
  e2eAdmin: z.boolean().optional(),
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
      e2eAdmin: z.enum(["1"]).optional(),
    }),
    response: zHarthmereVisualTestAuthResponse,
  },
  async ({
    context: { db, idGenerator, logicApi, sessionStore, worldApi },
    query: { usernameOrId, e2eAdmin },
    unsafeRequest,
    unsafeResponse,
  }) => {
    requireVisualTestAuthEnabled();
    if (e2eAdmin === "1") {
      requireNativeEcsE2EAdmin(unsafeRequest.headers["x-harthmere-e2e-token"]);
    }

    const existingUser = await usernameOrIdToUser(db, usernameOrId);
    const parsedId = safeParseBiomesId(usernameOrId);
    const userId: BiomesId =
      existingUser?.id ?? parsedId ?? (await idGenerator.next());
    const desiredUsername =
      existingUser?.username ??
      (parsedId === undefined ? usernameOrId : undefined);
    const user = await getUserOrCreateIfNotExists(db, userId, desiredUsername);

    await editWorldWithRetry(worldApi, (editor) =>
      ensurePlayerExists(editor, user.id, user.username ?? "VisualTestPlayer")
    );
    if (e2eAdmin === "1") {
      await editWorldWithRetry(worldApi, async (editor) => {
        const player = await editor.get(user.id);
        if (!player) {
          throw new APIError("not_found", "E2E player was not created.");
        }
        const roles = new Set(player.userRoles()?.roles ?? []);
        roles.add("admin");
        player.setUserRoles(UserRoles.create({ roles }));
      });
    }
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
      sessionId: session.id,
      e2eAdmin: e2eAdmin === "1" ? true : undefined,
      mode: "harthmere_visual_test_auth" as const,
    };
  }
);
