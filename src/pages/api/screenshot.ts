import {
  biomesApiHandler,
  zQueryNumbers,
} from "@/server/web/util/api_middleware";
import { APIError } from "@/shared/api/errors";
import { log } from "@/shared/logging";
import type { Vec2, Vec3 } from "@/shared/math/types";
import { sample } from "lodash";
import { z } from "zod";

const SCREENSHOT_TIMEOUT_MS = 30_000;

function screenshotsDisabledForRuntime() {
  return (
    process.env.GLITCH_ENABLE_CAMERA_SERVICE !== "1" &&
    (process.env.GLITCH_RUNTIME === "1" || !!process.env.GLITCH_TITLE_ID)
  );
}

async function withScreenshotTimeout<T>(work: Promise<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new APIError("overloaded", "Screenshot service timed out."));
    }, SCREENSHOT_TIMEOUT_MS);
  });
  work.catch((error) => {
    log.warn("Screenshot request failed after route timeout", { error });
  });
  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    query: z.object({
      position: zQueryNumbers,
      orientation: zQueryNumbers,
      width: z.coerce.number().int().min(320).max(4096).default(1920),
      height: z.coerce.number().int().min(240).max(4096).default(1080),
    }),
    response: z.instanceof(Buffer),
  },
  async ({
    context: { cameraClient },
    query: { position, orientation, width, height },
    unsafeResponse,
  }) => {
    if (screenshotsDisabledForRuntime()) {
      throw new APIError(
        "killswitched",
        "Screenshot service is unavailable in this runtime."
      );
    }

    const [startPosition, startOrientation] = sample(
      CONFIG.playerStartPositions
    )!;
    if (position.length !== 3) {
      position = [...startPosition];
    }
    if (orientation.length !== 2) {
      orientation = [...startOrientation];
    }
    const image = await withScreenshotTimeout(
      cameraClient.takeScreenshot({
        position: position as Vec3,
        orientation: orientation as Vec2,
        width,
        height,
      })
    );
    unsafeResponse.setHeader("Content-Type", "image/png");
    unsafeResponse.setHeader(
      "Content-Disposition",
      `attachment; filename=Biomes-${new Date().toISOString()}.png`
    );
    unsafeResponse.setHeader(
      "Cache-Control",
      `public,max-age=${5 * 60},immutable`
    );
    return image;
  }
);
