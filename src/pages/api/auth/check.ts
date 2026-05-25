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

function shouldVerifyUserDocumentForAuthCheck() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1"
  );
}

export default biomesApiHandler(
  {
    auth: "optional",
    response: zAuthCheckResponse,
  },
  async ({ context: { db }, auth, unsafeRequest, unsafeResponse }) => {
    if (auth?.userId) {
      // Local/Glitch runtimes use in-memory or sparse storage. A stateless
      // browser auth cookie can outlive the user document in that DB. Do not
      // report that user as logged in, because the install bootstrap should
      // recreate the user from install_id before the game mounts.
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
