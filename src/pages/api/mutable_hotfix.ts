import {
  glitchMutableHotfixCompatibility,
  glitchMutableHotfixEnabled,
  readGlitchMutableHotfixManifestFromRedis,
} from "@/server/glitch/mutable_hotfix";
import {
  glitchMutableHotfixClientDescriptor,
  renderGlitchMutableHotfixClientScript,
} from "@/server/glitch/mutable_hotfix_client";
import type { NextApiRequest, NextApiResponse } from "next";

const NO_STORE = "private, no-store, max-age=0";

function inactiveResponse() {
  return { active: false, pollMs: 30_000 } as const;
}

function sendScript(res: NextApiResponse, source: string, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", NO_STORE);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(source);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", NO_STORE);
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "bad_method" });
    return;
  }

  const wantsScript = String(req.query.asset ?? "") === "script";
  if (!glitchMutableHotfixEnabled()) {
    if (wantsScript) {
      sendScript(res, "/* Mutable hotfix support is disabled. */\n");
    } else {
      res.status(200).json(inactiveResponse());
    }
    return;
  }

  try {
    const manifest = await readGlitchMutableHotfixManifestFromRedis();
    if (!manifest || !glitchMutableHotfixCompatibility(manifest).applicable) {
      if (wantsScript) {
        sendScript(res, "/* No compatible mutable client hotfix. */\n");
      } else {
        res.status(200).json(inactiveResponse());
      }
      return;
    }

    const descriptor = glitchMutableHotfixClientDescriptor(manifest);
    if (!descriptor) {
      if (wantsScript) {
        sendScript(res, "/* No active mutable client hotfix. */\n");
      } else {
        res.status(200).json(inactiveResponse());
      }
      return;
    }

    if (!wantsScript) {
      res.status(200).json(descriptor);
      return;
    }

    const requestedVersion = String(req.query.version ?? "");
    const requestedHash = String(req.query.hash ?? "");
    const bootstrap = String(req.query.bootstrap ?? "") === "1";
    if (
      !bootstrap &&
      (requestedVersion !== descriptor.version ||
        requestedHash !== descriptor.hash)
    ) {
      sendScript(
        res,
        "throw new Error('mutable_hotfix_client_version_changed');\n",
        409
      );
      return;
    }
    sendScript(res, renderGlitchMutableHotfixClientScript(manifest));
  } catch (error) {
    // The public bootstrap must fail open. A Redis outage must not block the
    // immutable application bundle from loading.
    if (wantsScript) {
      sendScript(
        res,
        `console.error("Mutable hotfix bootstrap unavailable", ${JSON.stringify(
          error instanceof Error ? error.message : String(error)
        )});\n`
      );
    } else {
      res.status(200).json(inactiveResponse());
    }
  }
}
