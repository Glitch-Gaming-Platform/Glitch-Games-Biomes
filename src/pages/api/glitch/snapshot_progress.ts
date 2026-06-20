// SNAPSHOT_PRODUCTION_PROGRESS_API
// Dual-mode snapshot progress endpoint. Local dev gets deterministic in-memory
// server state. Production can forward the exact same mutation contract to a
// durable Glitch backend by setting GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL.

import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

type JsonMap = Record<string, any>;

type StoreRecord = {
  identityKey: string;
  state: JsonMap;
  mutations: JsonMap[];
  createdAtMs: number;
  updatedAtMs: number;
};

const globalForSnapshotProgress = globalThis as typeof globalThis & {
  __snapshotProgressStore?: Map<string, StoreRecord>;
};

const store =
  globalForSnapshotProgress.__snapshotProgressStore ??
  (globalForSnapshotProgress.__snapshotProgressStore = new Map<string, StoreRecord>());

function envString(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function now() {
  return Date.now();
}

function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function identityFromRequest(req: NextApiRequest) {
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const identity = body.identity ?? {};
  const query = req.query ?? {};
  return {
    installId: stringFrom(identity.installId, body.install_id, query.install_id, req.headers["x-glitch-install-id"]),
    gameUserId: stringFrom(identity.gameUserId, body.game_user_id, query.game_user_id, req.headers["x-glitch-game-user-id"]),
    sessionId: stringFrom(identity.sessionId, body.session_id, query.session_id, req.headers["x-glitch-session-id"]),
    titleId: stringFrom(identity.titleId, body.title_id, query.title_id, process.env.GLITCH_TITLE_ID),
  };
}

function identityKey(input: ReturnType<typeof identityFromRequest>) {
  return (
    input.gameUserId ||
    input.installId ||
    input.sessionId ||
    `anonymous:${input.titleId ?? "unknown-title"}`
  );
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))];
}

function mergeState(oldState: JsonMap = {}, incoming: JsonMap = {}, mutations: JsonMap[] = []) {
  const completedMissionIds = unique([
    ...asArray(oldState.completedMissionIds),
    ...asArray(incoming.completedMissionIds),
    ...mutations.filter((m) => m.kind === "complete_mission").map((m) => m.missionId),
  ]);
  const completedStepIds = unique([
    ...asArray(oldState.completedStepIds),
    ...asArray(incoming.completedStepIds),
    ...mutations.filter((m) => m.kind === "complete_step").map((m) => m.stepId),
  ]);
  const grantedRewardIds = unique([
    ...asArray(oldState.grantedRewardIds),
    ...asArray(incoming.grantedRewardIds),
    ...mutations.filter((m) => m.kind === "grant_reward").map((m) => m.rewardId),
  ]);
  const grantedItemSymbols = unique([
    ...asArray(oldState.grantedItemSymbols),
    ...asArray(oldState.grantedItemIds),
    ...asArray(incoming.grantedItemSymbols),
    ...asArray(incoming.grantedItemIds),
    ...mutations.flatMap((m) => asArray(m.itemSymbols)),
  ]);
  const clearedMuckIds = unique([
    ...asArray(oldState.clearedMuckIds),
    ...asArray(incoming.clearedMuckIds),
    ...mutations.filter((m) => m.kind === "clear_muck").map((m) => m.markerId),
  ]);
  const photoProofIds = unique([
    ...asArray(oldState.photoProofIds),
    ...asArray(incoming.photoProofIds),
    ...mutations.filter((m) => m.kind === "photo_proof").map((m) => m.proofId),
  ]);
  const fishingCatchIds = unique([
    ...asArray(oldState.fishingCatchIds),
    ...asArray(incoming.fishingCatchIds),
    ...mutations.filter((m) => m.kind === "fishing_catch").map((m) => m.catchId),
  ]);
  const audioCueIds = unique([
    ...asArray(oldState.audioCueIds),
    ...asArray(oldState.audioLog),
    ...asArray(incoming.audioCueIds),
    ...asArray(incoming.audioLog),
    ...mutations.map((m) => m.audioCue),
  ]).slice(-60);

  return {
    ...oldState,
    ...incoming,
    version: "snapshot-production-port",
    v76Version: "snapshot-complete-port",
    acceptedMissionIds: unique([...asArray(oldState.acceptedMissionIds), ...asArray(incoming.acceptedMissionIds)]),
    activeMissionId: incoming.activeMissionId ?? oldState.activeMissionId,
    activeStepIndex: Math.max(Number(oldState.activeStepIndex ?? 0), Number(incoming.activeStepIndex ?? 0)),
    completedMissionIds,
    completedStepIds,
    grantedRewardIds,
    grantedItemSymbols,
    grantedBikkieItems: asArray(incoming.grantedBikkieItems ?? oldState.grantedBikkieItems),
    xp: Math.max(Number(oldState.xp ?? 0), Number(incoming.xp ?? 0)),
    bling: Math.max(Number(oldState.bling ?? 0), Number(incoming.bling ?? 0)),
    audioCueIds,
    photoProofIds,
    fishingCatchIds,
    clearedMuckIds,
    updatedAtMs: now(),
  };
}

async function forwardToConfiguredBackend(req: NextApiRequest, identity: JsonMap, payload?: JsonMap) {
  const configured = envString("GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL");
  if (!configured) {
    return undefined;
  }
  const token = envString("GLITCH_TITLE_TOKEN");
  const url = new URL(configured);
  if (req.method === "GET") {
    for (const [key, value] of Object.entries(identity)) {
      if (typeof value === "string" && value) url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url.toString(), {
    method: req.method === "GET" ? "GET" : "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(req.method === "GET" ? {} : { "Content-Type": "application/json" }),
    },
    body: req.method === "GET" ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let json: any = undefined;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const identity = identityFromRequest(req);
  const key = identityKey(identity);
  const mode = stringFrom((req.body as any)?.mode, req.query.mode) ?? "auto";

  try {
    const forwardPayload = req.method === "POST" ? { ...(req.body as JsonMap), identity } : undefined;
    const forwarded = await forwardToConfiguredBackend(req, identity, forwardPayload);
    if (forwarded && forwarded.ok) {
      return res.status(200).json({
        ok: true,
        mode: "production_api",
        durable: true,
        forwarded: true,
        state: forwarded.json?.state ?? forwarded.json?.data ?? forwarded.json,
      });
    }
    if (forwarded && mode === "production_api") {
      return res.status(forwarded.status ?? 502).json({
        ok: false,
        mode: "production_api",
        durable: false,
        forwarded: true,
        error: forwarded.json?.error ?? "CONFIGURED_BACKEND_REJECTED_REQUEST",
      });
    }
  } catch (error: any) {
    if (mode === "production_api") {
      return res.status(502).json({
        ok: false,
        mode: "production_api",
        durable: false,
        error: error?.message ?? String(error),
      });
    }
  }

  const existing = store.get(key);
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      mode: "local_dev_in_memory",
      durable: false,
      identity,
      state: existing?.state ?? {
        version: "snapshot-production-port",
        v76Version: "snapshot-complete-port",
        acceptedMissionIds: [],
        activeStepIndex: 0,
        completedMissionIds: [],
        completedStepIds: [],
        grantedRewardIds: [],
        grantedItemSymbols: [],
        grantedBikkieItems: [],
        xp: 0,
        bling: 0,
        audioCueIds: [],
        photoProofIds: [],
        fishingCatchIds: [],
        clearedMuckIds: [],
        mutations: [],
        updatedAtMs: now(),
      },
    });
  }

  const body = typeof req.body === "object" && req.body ? (req.body as JsonMap) : {};
  const mutations = asArray(body.mutations).concat(body.mutation ? [body.mutation] : []);
  const state = mergeState(existing?.state, body.state ?? {}, mutations);
  const record: StoreRecord = {
    identityKey: key,
    state: {
      ...state,
      mutations: [...asArray(existing?.state?.mutations), ...mutations].slice(-250),
    },
    mutations: [...(existing?.mutations ?? []), ...mutations].slice(-250),
    createdAtMs: existing?.createdAtMs ?? now(),
    updatedAtMs: now(),
  };
  store.set(key, record);

  return res.status(200).json({
    ok: true,
    mode: "local_dev_in_memory",
    durable: false,
    identity,
    state: record.state,
    mutationCount: mutations.length,
  });
}
