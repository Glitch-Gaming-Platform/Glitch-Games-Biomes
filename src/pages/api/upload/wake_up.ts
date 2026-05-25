import type { NextApiRequest, NextApiResponse } from "next";

export type WakeUpScreenshotRequest = {
  clientCvals?: unknown;
  buildId?: string;
  buildTimestamp?: string | number;
  screenshotDataURI?: string;
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Glitch local-assets/no-GCP production path does not need wake-up screenshots.
  // Return success so the wake-up scene can continue even when old bundles still post here.
  return res.status(200).json({ ok: true, skipped: true, local_assets_noop: true });
}
