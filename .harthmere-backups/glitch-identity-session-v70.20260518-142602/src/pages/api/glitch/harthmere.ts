import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const DEFAULT_GLITCH_API_BASE_URL = "https://api.glitch.fun/api";
const DEFAULT_HARTHMERE_TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";

type JsonMap = Record<string, any>;
type GlitchProxyResponse = { ok: boolean; status?: number; json?: unknown; disabled?: boolean; reason?: string };

function envString(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function glitchApiBaseUrl() {
  return (envString("GLITCH_API_BASE_URL") ?? DEFAULT_GLITCH_API_BASE_URL).replace(/\/+$/, "");
}

function configuredTitleId() {
  return envString("GLITCH_TITLE_ID") ?? DEFAULT_HARTHMERE_TITLE_ID;
}

function configuredTitleToken() {
  return envString("GLITCH_TITLE_TOKEN");
}

function titleIdFromBody(body: JsonMap) {
  const requested = typeof body.title_id === "string" ? body.title_id.trim() : "";
  const configured = configuredTitleId();
  if (requested && requested !== configured) {
    throw new Error("TITLE_ID_MISMATCH");
  }
  return configured;
}

function installIdFromBody(body: JsonMap) {
  const installId = typeof body.install_id === "string" ? body.install_id.trim() : "";
  if (!installId) {
    throw new Error("MISSING_INSTALL_ID");
  }
  return installId;
}

function requireServerConfig() {
  const token = configuredTitleToken();
  if (!token) {
    return undefined;
  }
  return token;
}

async function callGlitchApi(
  path: string,
  options: { method?: string; body?: unknown; query?: URLSearchParams } = {},
): Promise<GlitchProxyResponse> {
  const token = requireServerConfig();
  if (!token) {
    return {
      ok: true,
      disabled: true,
      reason: "missing_server_title_token",
    };
  }

  const url = `${glitchApiBaseUrl()}${path}${options.query ? `?${options.query.toString()}` : ""}`;
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

function collectionData(raw: any): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.data)) {
    return raw.data;
  }
  return [];
}

function decodeSavePayload(save: any) {
  if (!save?.payload || typeof save.payload !== "string") {
    return undefined;
  }
  try {
    const text = Buffer.from(save.payload, "base64").toString("utf8");
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function makeSavePayload(snapshot: unknown) {
  const json = JSON.stringify(snapshot ?? {});
  const bytes = Buffer.from(json, "utf8");
  return {
    payload: bytes.toString("base64"),
    checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
    size_bytes: bytes.byteLength,
  };
}

function normalizeProgressionPayload(body: JsonMap) {
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  return {
    idempotency_key:
      typeof body.idempotency_key === "string" && body.idempotency_key.trim()
        ? body.idempotency_key.trim()
        : `harthmere-${Date.now()}-${crypto.randomUUID()}`,
    payload,
    trust_level: body.trust_level ?? "client",
    platform: body.platform ?? "web",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as JsonMap;
  const op = typeof body.op === "string" ? body.op : "";

  try {
    const titleId = titleIdFromBody(body);

    if (op === "config") {
      return res.status(200).json({
        ok: true,
        enabled: Boolean(configuredTitleToken()),
        title_id: titleId,
        api_base_url: glitchApiBaseUrl(),
      });
    }

    if (op === "validate") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/validate`,
        {
          method: "POST",
          body: {
            fingerprint_id: body.fingerprint_id,
            device_id: body.device_id,
            platform: body.platform ?? "web",
          },
        },
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    if (op === "listSaves") {
      const installId = installIdFromBody(body);
      const query = new URLSearchParams({ include_payload: "1" });
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/saves`,
        { query },
      );
      if (!response.ok || (response as any).disabled) {
        return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
      }
      const saves = collectionData(response.json).map((save) => ({
        ...save,
        decoded_payload: decodeSavePayload(save),
      }));
      return res.status(200).json({ ok: true, saves, raw: response.json });
    }

    if (op === "storeSave") {
      const installId = installIdFromBody(body);
      const encoded = makeSavePayload(body.snapshot ?? {});
      const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/saves`,
        {
          method: "POST",
          body: {
            slot_index: Number.isInteger(body.slot_index) ? body.slot_index : 0,
            payload: encoded.payload,
            checksum: encoded.checksum,
            base_version: Number.isInteger(body.base_version) ? body.base_version : 0,
            save_type: body.save_type ?? "auto",
            client_timestamp: new Date().toISOString(),
            slot_name: body.slot_name ?? "Harthmere Autosave",
            metadata,
            device_id: body.device_id ?? body.install_id,
            platform: body.platform ?? "web",
            game_version: body.game_version ?? "harthmere-glitch-v68",
            last_played_at: new Date().toISOString(),
            play_duration_seconds: Math.max(0, Math.floor(Number(body.play_duration_seconds ?? 0))),
          },
        },
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    if (op === "submitProgression") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/submit`,
        {
          method: "POST",
          body: normalizeProgressionPayload(body),
        },
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    if (op === "playerStats") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/stats`,
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    if (op === "playerAchievements") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(installId)}/achievements`,
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    if (op === "leaderboard") {
      const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
      if (!apiKey) {
        return res.status(422).json({ ok: false, error: "MISSING_LEADERBOARD_API_KEY" });
      }
      const query = new URLSearchParams();
      if (typeof body.install_id === "string" && body.install_id.trim()) {
        query.set("around_me", "1");
        query.set("install_id", body.install_id.trim());
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/leaderboards/${encodeURIComponent(apiKey)}`,
        { query },
      );
      return res.status(response.ok ? 200 : response.status || 500).json(response.json ?? response);
    }

    return res.status(422).json({ ok: false, error: "UNKNOWN_GLITCH_HARTHMERE_OP", op });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    const status = message === "TITLE_ID_MISMATCH" ? 403 : message === "MISSING_INSTALL_ID" ? 422 : 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
