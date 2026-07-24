import { HostPort } from "@/server/shared/ports";
import { makeClient } from "@/server/shared/zrpc/client";
import type { ZService } from "@/server/shared/zrpc/server_types";
import { zVec2f, zVec3f } from "@/shared/math/types";
import type { ZClient } from "@/shared/zrpc/core";
import { zservice } from "@/shared/zrpc/service";
import { z } from "zod";

export const zTakeScreenshotRequest = z.object({
  position: zVec3f,
  orientation: zVec2f,
  width: z.number().int().min(320).max(4096).default(1920),
  height: z.number().int().min(240).max(4096).default(1080),
});

export type TakeScreenshotRequest = z.infer<typeof zTakeScreenshotRequest>;

export const zCameraService = zservice("camera").addRpc(
  "takeScreenshot",
  zTakeScreenshotRequest,
  z.instanceof(Buffer)
);

export type CameraService = ZService<typeof zCameraService>;
export type CameraClient = ZClient<typeof zCameraService>;

export function createCameraClient() {
  return makeClient(zCameraService, HostPort.forCamera().rpc);
}
