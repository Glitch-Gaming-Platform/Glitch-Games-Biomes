import {
  BikkieLoadResponseCache,
  shouldForceTrayRefresh,
} from "@/server/web/bikkie_load_response";
import {
  biomesApiHandler,
  zQueryOptionalBiomesId,
} from "@/server/web/util/api_middleware";
import { zBiomesId } from "@/shared/ids";
import { z } from "zod";

export const zBikkieLoadResponse = z.object({
  trayId: zBiomesId,
  encoded: z.tuple([zBiomesId, z.string(), z.array(z.number())]).array(),
  schemas: z.array(z.string()),
});

export type BikkieLoadResponse = z.infer<typeof zBikkieLoadResponse>;

// HARTHMERE_BIKKIE_LOAD_RESPONSE_CACHE: trays are immutable and identified by
// id, so the encode is memoised per process. Two slots so a publish or a rolling
// deploy -- when clients ask for the outgoing and incoming tray at once -- does
// not thrash.
const responseCache = new BikkieLoadResponseCache();

export default biomesApiHandler(
  {
    auth: "optional",
    query: z.object({
      expectedTrayId: zQueryOptionalBiomesId,
    }),
    response: zBikkieLoadResponse,
  },
  async ({
    context: { bikkieRefresher },
    query: { expectedTrayId },
    unsafeResponse,
  }) => {
    const currentTray = await bikkieRefresher.currentTray();
    // A forced refresh is a full Bikkie storage load plus a re-register of the
    // shared runtime. It is only worth doing when the client names a tray this
    // process does not have; a cold client sends no expectation at all, and
    // forcing for those meant paying that cost once per player boot.
    const tray = shouldForceTrayRefresh(expectedTrayId, currentTray.id)
      ? await bikkieRefresher.force()
      : currentTray;
    if (expectedTrayId === tray.id) {
      // Trays are immutable.
      unsafeResponse.setHeader(
        "Cache-Control",
        `public,max-age=${365 * 24 * 60 * 60},immutable`
      );
    }
    return responseCache.encode(tray);
  }
);
