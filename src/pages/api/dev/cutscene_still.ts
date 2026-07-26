// LOCAL_CUTSCENE_STILL_SINK
//
// The cutscene renderer already owns the exact 1920x1080 engine frame and brand
// compositing. Persist it directly from the warm browser page so a 17-image
// sector batch does not copy hundreds of megabytes of base64 through browser
// automation or reboot the game once per still.

import type { NextApiRequest, NextApiResponse } from "next";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

function safePngFilename(value: unknown): string | undefined {
  const filename = path.basename(String(value ?? ""));
  return /^[a-z0-9][a-z0-9._-]*\.png$/i.test(filename) ? filename : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const focusedNativeE2E =
    process.env.HARTHMERE_NATIVE_ECS_E2E === "1" &&
    process.env.GLITCH_FOCUSED_NATIVE_E2E_STACK === "1";
  if (process.env.NODE_ENV === "production" && !focusedNativeE2E) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "bad_method" });
    return;
  }

  const filename = safePngFilename(req.body?.filename);
  const dataUri = String(req.body?.dataUri ?? "");
  const delimiter = ";base64,";
  const delimiterIndex = dataUri.indexOf(delimiter);
  if (
    !filename ||
    !dataUri.startsWith("data:image/png") ||
    delimiterIndex < 0
  ) {
    res.status(400).json({ ok: false, error: "bad_image_payload" });
    return;
  }

  const bytes = Buffer.from(
    dataUri.slice(delimiterIndex + delimiter.length),
    "base64"
  );
  if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) {
    res.status(400).json({ ok: false, error: "bad_image_size" });
    return;
  }

  const artifactDirectory = path.join(process.cwd(), "artifacts", "cutscenes");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(path.join(artifactDirectory, filename), bytes);
  res.status(200).json({ ok: true, filename, bytes: bytes.length });
}
