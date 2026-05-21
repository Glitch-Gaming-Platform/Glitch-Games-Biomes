import type { NextApiRequest, NextApiResponse } from "next";

import {
  resolveSnapshotBackendEnvironmentV80,
  SNAPSHOT_BACKEND_RESOLVER_VERSION_V80,
} from "@/shared/harthmere/snapshot_backend_resolver_v80";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const snapshotBackend = resolveSnapshotBackendEnvironmentV80({
    NODE_ENV: process.env.NODE_ENV,
    GLITCH_SNAPSHOT_BACKEND_MODE: process.env.GLITCH_SNAPSHOT_BACKEND_MODE,
    GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL:
      process.env.GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL,
    GLITCH_SNAPSHOT_PROGRESS_ENDPOINT:
      process.env.GLITCH_SNAPSHOT_PROGRESS_ENDPOINT,
    GLITCH_SNAPSHOT_HEALTH_ENDPOINT: process.env.GLITCH_SNAPSHOT_HEALTH_ENDPOINT,
  });

  res.status(200).json({
    ok: true,
    version: SNAPSHOT_BACKEND_RESOLVER_VERSION_V80,
    snapshotBackend,
  });
}
