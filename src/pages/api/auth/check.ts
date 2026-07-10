import {
  checkCallbackFailedCookie,
  clearAuthCookies,
} from "@/server/shared/auth/cookies";
import { findByUID } from "@/server/web/db/users_fetch";
import { okOrAPIError } from "@/server/web/errors";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zBiomesId } from "@/shared/ids";
import { z } from "zod";

export const zAuthCheckResponse = z.object({
  userId: zBiomesId.optional(),
});

export type AuthCheckResponse = z.infer<typeof zAuthCheckResponse>;

export function shouldVerifyUserDocumentForAuthCheck(
  env: NodeJS.ProcessEnv = process.env
) {
  return (
    env.NODE_ENV !== "production" ||
    env.GLITCH_VERIFY_AUTH_USER_DOCUMENT === "1"
  );
}

export default biomesApiHandler(
  {
    auth: "optional",
    response: zAuthCheckResponse,
  },
  async ({ context: { db }, auth, unsafeRequest, unsafeResponse }) => {
    if (auth?.userId) {
      // In production the authenticated session is authoritative. Glitch can
      // route consecutive requests to different replicas whose local/sparse
      // document views do not agree; invalidating a valid shared session from
      // that secondary lookup causes alternating 200/401 auth checks and SSR
      // hydration loops. Keep document verification for development and as an
      // explicit production diagnostic only.
      if (shouldVerifyUserDocumentForAuthCheck()) {
        const user = await findByUID(db, auth.userId);
        if (!user) {
          clearAuthCookies(unsafeResponse, unsafeRequest);
          okOrAPIError(undefined, "unauthorized", "Stale local auth session");
        }
      }

      return {
        userId: auth.userId,
      };
    }
    checkCallbackFailedCookie(unsafeRequest);
    clearAuthCookies(unsafeResponse, unsafeRequest);
    okOrAPIError(auth, "unauthorized");
    return {};
  }
);
