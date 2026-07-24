// LOCAL_CUTSCENE_VIDEO_SINK
//
// Browser MediaRecorder output is a data URI. Copying multi-megabyte payloads
// through browser automation is fragile, so local capture pages can persist the
// completed WebM directly into artifacts/cutscenes. This endpoint is disabled
// outside development and accepts filenames only, never arbitrary paths.

import type { NextApiRequest, NextApiResponse } from "next";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

function safeWebmFilename(value: unknown): string | undefined {
  const filename = path.basename(String(value ?? ""));
  return /^[a-z0-9][a-z0-9._-]*\.webm$/i.test(filename) ? filename : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "bad_method" });
    return;
  }
  const filename = safeWebmFilename(req.body?.filename);
  const dataUri = String(req.body?.dataUri ?? "");
  const delimiter = ";base64,";
  const delimiterIndex = dataUri.indexOf(delimiter);
  if (
    !filename ||
    !dataUri.startsWith("data:video/webm") ||
    delimiterIndex < 0
  ) {
    res.status(400).json({ ok: false, error: "bad_video_payload" });
    return;
  }

  const bytes = Buffer.from(
    dataUri.slice(delimiterIndex + delimiter.length),
    "base64"
  );
  if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) {
    res.status(400).json({ ok: false, error: "bad_video_size" });
    return;
  }

  const artifactDirectory = path.join(process.cwd(), "artifacts", "cutscenes");
  await mkdir(artifactDirectory, { recursive: true });
  const outputPath = path.join(artifactDirectory, filename);
  await writeFile(outputPath, bytes);
  res.status(200).json({ ok: true, filename, bytes: bytes.length });
}
