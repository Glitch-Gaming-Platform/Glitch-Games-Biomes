import type { RendererController } from "@/client/game/renderers/renderer_controller";
import type {
  ReportFlowTarget,
  ReportRequest,
} from "@/pages/api/upload/report";
import type { WakeUpScreenshotRequest } from "@/pages/api/upload/wake_up";
import { buildTimestamp } from "@/shared/build";
import { log } from "@/shared/logging";
import { collectAll, defaultCvalDatabase } from "@/shared/util/cvals";
import { jsonPost } from "@/shared/util/fetch_helpers";

function shouldSkipWakeUpScreenshotUpload() {
  return (
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_DISABLE_GCP === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1"
  );
}

export async function makeWakeUpScreenshot(
  deps: {
    rendererController?: RendererController;
  },
  report: WakeUpScreenshotRequest
) {
  if (shouldSkipWakeUpScreenshotUpload()) {
    return { ok: true, skipped: true };
  }

  let dataURI: string | undefined;
  if (deps.rendererController) {
    dataURI = deps.rendererController.captureScreenshot()?.screenshotDataUri;
  }
  return jsonPost("/api/upload/wake_up", {
    clientCvals:
      report.clientCvals ??
      getClientCvals({
        kind: "wakeUp",
      }),
    buildId: process.env.BUILD_ID,
    buildTimestamp: buildTimestamp(),
    screenshotDataURI: dataURI,
  } as WakeUpScreenshotRequest);
}

export async function makeReport(
  deps: {
    rendererController?: RendererController;
  },
  report: ReportRequest
) {
  log.debug(`Logging report of kind: ${report.target.kind}`);
  let dataURI: string | undefined;
  if (deps.rendererController) {
    dataURI = deps.rendererController.captureScreenshot()?.screenshotDataUri;
  }
  return jsonPost("/api/upload/report", {
    target: report.target,
    reason: report.reason,
    otherReason: report.otherReason,
    clientCvals: report.clientCvals ?? getClientCvals(report.target),
    buildId: process.env.BUILD_ID,
    buildTimestamp: buildTimestamp(),
    screenshotDataURI: dataURI,
  } as ReportRequest);
}

function getClientCvals(target: ReportFlowTarget) {
  if (target.kind !== "bug" && target.kind !== "wakeUp") {
    return undefined;
  } else {
    return collectAll(defaultCvalDatabase());
  }
}
