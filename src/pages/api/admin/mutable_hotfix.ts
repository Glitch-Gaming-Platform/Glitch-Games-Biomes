import {
  applyAndPersistGlitchMutableHotfixManifest,
  applyConfiguredGlitchMutableHotfix,
  applyGlitchMutableHotfixManifest,
  clearGlitchMutableHotfixManifestFromRedis,
  decodeGlitchMutableHotfixManifestBase64,
  getGlitchMutableHotfixStatus,
  glitchMutableHotfixEnabled,
  loadGlitchMutableHotfixManifestFromUrl,
  normalizeGlitchMutableHotfixManifest,
  persistGlitchMutableHotfixManifestToRedis,
  readGlitchMutableHotfixManifestFromRedis,
} from "@/server/glitch/mutable_hotfix";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

function bearerToken(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (!auth) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1];
}

function hotfixToken(req: NextApiRequest) {
  const header = req.headers["x-glitch-mutable-hotfix-token"];
  return (
    (Array.isArray(header) ? header[0] : header) ??
    bearerToken(req) ??
    String(req.query.token ?? "")
  );
}

function isAuthorized(req: NextApiRequest) {
  if (!glitchMutableHotfixEnabled()) return false;
  if (process.env.GLITCH_MUTABLE_HOTFIX_OPEN === "1") return true;
  const expected = process.env.GLITCH_MUTABLE_HOTFIX_TOKEN;
  return Boolean(expected && hotfixToken(req) === expected);
}

async function manifestFromBody(body: any) {
  if (body?.manifestBase64) {
    return decodeGlitchMutableHotfixManifestBase64(String(body.manifestBase64));
  }
  if (body?.manifestUrl) {
    return loadGlitchMutableHotfixManifestFromUrl(String(body.manifestUrl));
  }
  return normalizeGlitchMutableHotfixManifest(body?.manifest);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!isAuthorized(req)) {
    res.status(glitchMutableHotfixEnabled() ? 401 : 404).json({
      ok: false,
      error: glitchMutableHotfixEnabled()
        ? "mutable_hotfix_unauthorized"
        : "mutable_hotfix_disabled",
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const manifest = await readGlitchMutableHotfixManifestFromRedis().catch(
        () => undefined
      );
      res.status(200).json({
        ok: true,
        status: getGlitchMutableHotfixStatus(),
        persistedManifest: manifest
          ? {
              version: manifest.version,
              description: manifest.description,
              operationCount: manifest.operations.length,
            }
          : undefined,
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "bad_method" });
      return;
    }

    const action = String(req.body?.action ?? "apply");
    if (action === "status") {
      res
        .status(200)
        .json({ ok: true, status: getGlitchMutableHotfixStatus() });
      return;
    }

    if (action === "clear") {
      const clear = await clearGlitchMutableHotfixManifestFromRedis(
        req.body?.redisKey
      );
      res.status(200).json({
        ok: true,
        clear,
        status: getGlitchMutableHotfixStatus(),
      });
      return;
    }

    if (action === "reload") {
      const result = await applyConfiguredGlitchMutableHotfix({
        force: Boolean(req.body?.force),
      });
      res.status(200).json({
        ok: true,
        result,
        status: getGlitchMutableHotfixStatus(),
      });
      return;
    }

    const manifest = await manifestFromBody(req.body);
    let persisted;
    let result;
    if (action === "apply_and_persist") {
      ({ persisted, result } = await applyAndPersistGlitchMutableHotfixManifest(
        manifest,
        {
          force: Boolean(req.body?.force),
          redisKey: req.body?.redisKey,
        }
      ));
    } else if (action === "persist") {
      persisted = await persistGlitchMutableHotfixManifestToRedis(
        manifest,
        req.body?.redisKey
      );
    } else if (action === "apply") {
      result = await applyGlitchMutableHotfixManifest(manifest, {
        force: Boolean(req.body?.force),
      });
    } else {
      res.status(400).json({ ok: false, error: "bad_action" });
      return;
    }

    res.status(200).json({
      ok: true,
      persisted,
      result,
      status: getGlitchMutableHotfixStatus(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status: getGlitchMutableHotfixStatus(),
    });
  }
}
