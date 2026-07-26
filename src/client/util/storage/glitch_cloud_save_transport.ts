// HARTHMERE PORTABLE STORAGE — Glitch Cloud Save transport
//
// Implements the `BlobSaveTransport` used by `GlitchCloudSaveAdapter` against the
// Glitch Cloud Save API (Developer Integration Guide). Cloud Save is PER-PLAYER
// (keyed by install_id) cross-device progress — stamina, inventory, quests, crate
// contents, tutorial state, etc.
//
// IMPORTANT scope boundary: world-altering, shared state (buildings, plots,
// homes, terrain edits) does NOT belong here — that is server-owned world state
// written through the sync/live-mode authority into Redis so every player sees it
// and it survives migrations. Cloud Save is only the current player's own save.
//
// The two classic API bugs the guide warns about are handled explicitly:
//   * the SHA-256 checksum is computed over the RAW payload, not the Base64 text;
//   * the returned `version` is stored and sent back as `base_version` next time;
//   * a 409 pauses this compatibility-slot writer until a fresh load, rather
//     than silently choosing server/client state on the player's behalf.
//
// The whole key/value store is serialized to ONE reserved save slot as a JSON
// blob (Base64 payload), which matches the blob-snapshot model of
// `GlitchCloudSaveAdapter`.

import type { BlobSaveTransport } from "./adapters";

/** Slot reserved for the Harthmere portable key/value store blob. */
export const HARTHMERE_KV_CLOUD_SAVE_SLOT = 90;

/** One Cloud Save slot record (subset of the documented response we use). */
export interface CloudSaveSlotRecord {
  id: string;
  slot_index: number;
  version: number;
  payload?: string | null;
  checksum?: string;
}

/**
 * HTTP surface for the Glitch save API, injected so the transport is testable
 * without a network and decoupled from the concrete fetch/`requestGlitch` path.
 * `op` maps to the game-server proxy operations ("listSaves", "storeSave")
 * which forward to the documented REST endpoints.
 */
export interface CloudSaveHttp {
  request<T = any>(
    op: string,
    body: Record<string, unknown>
  ): Promise<{ status: number; json: T }>;
}

export interface GlitchCloudSaveConfig {
  titleId: string;
  installId: string;
  /** Reserved slot for the kv blob (default HARTHMERE_KV_CLOUD_SAVE_SLOT). */
  slotIndex?: number;
  /** Cloud Save requires a real (non-guest) signed-in user. */
  isAuthenticated: () => boolean;
  /** Injectable clock/crypto/base64 for tests; default to browser globals. */
  now?: () => string;
  sha256Hex?: (raw: string) => Promise<string>;
  base64Encode?: (raw: string) => string;
  base64Decode?: (b64: string) => string;
}

export class GlitchCloudSaveConflictError extends Error {
  constructor(
    readonly conflictId: string | undefined,
    readonly saveId: string | undefined,
    readonly serverVersion: number | undefined
  ) {
    super("Cloud Save conflict requires an explicit restore or resolution");
    this.name = "GlitchCloudSaveConflictError";
  }
}

/** SHA-256 hex of the RAW string (NOT the Base64), per the Cloud Save guide. */
async function defaultSha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  // `bytes.buffer` is a freshly-allocated, exactly-sized ArrayBuffer (TextEncoder
  // returns a right-sized view), and casting sidesteps the Uint8Array/BufferSource
  // generic mismatch across TS DOM lib versions.
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer as ArrayBuffer
  );
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/** Unicode-safe Base64 encode (handles non-Latin1 JSON). */
function defaultBase64Encode(raw: string): string {
  return btoa(unescape(encodeURIComponent(raw)));
}
function defaultBase64Decode(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export class GlitchCloudSaveBlobTransport implements BlobSaveTransport {
  private readonly slotIndex: number;
  private readonly now: () => string;
  private readonly sha256Hex: (raw: string) => Promise<string>;
  private readonly base64Encode: (raw: string) => string;
  private readonly base64Decode: (b64: string) => string;

  /** Latest server version we know about; sent back as `base_version`. */
  private version = 0;
  private saveId: string | undefined;
  private conflictPaused = false;

  constructor(
    private readonly http: CloudSaveHttp,
    private readonly config: GlitchCloudSaveConfig
  ) {
    this.slotIndex = config.slotIndex ?? HARTHMERE_KV_CLOUD_SAVE_SLOT;
    this.now = config.now ?? (() => new Date().toISOString());
    this.sha256Hex = config.sha256Hex ?? defaultSha256Hex;
    this.base64Encode = config.base64Encode ?? defaultBase64Encode;
    this.base64Decode = config.base64Decode ?? defaultBase64Decode;
  }

  async isReady(): Promise<boolean> {
    return Boolean(
      this.config.titleId &&
        this.config.installId &&
        this.config.isAuthenticated()
    );
  }

  private ids() {
    return { title_id: this.config.titleId, install_id: this.config.installId };
  }

  /** Load the kv blob from the reserved slot; track its version for conflict-safety. */
  async load(): Promise<Record<string, string> | null> {
    let result: { status: number; json: any };
    try {
      result = await this.http.request("listSaves", this.ids());
    } catch {
      return null;
    }
    if (result.status !== 200) {
      return null;
    }
    // The direct Glitch API returns `data`; the same-origin game proxy returns
    // decoded rows as `saves`. Accept both so the transport learns the real
    // slot version instead of treating every load as a brand-new save and
    // repeatedly uploading with base_version 0.
    const slots: CloudSaveSlotRecord[] =
      result.json?.saves ?? result.json?.data ?? [];
    const slot = slots.find((s) => s.slot_index === this.slotIndex);
    if (!slot) {
      // No blob yet; a brand-new slot uploads with base_version 0.
      this.version = 0;
      this.saveId = undefined;
      this.conflictPaused = false;
      return {};
    }
    this.version = slot.version ?? 0;
    this.saveId = slot.id;
    this.conflictPaused = false;
    if (!slot.payload) {
      return {};
    }
    try {
      const parsed = JSON.parse(this.base64Decode(slot.payload));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Persist the whole kv blob to the reserved slot with a correct checksum. */
  async store(snapshot: Record<string, string>): Promise<void> {
    if (this.conflictPaused) {
      throw new GlitchCloudSaveConflictError(
        undefined,
        this.saveId,
        this.version
      );
    }
    const raw = JSON.stringify(snapshot);
    const payload = this.base64Encode(raw);
    const checksum = await this.sha256Hex(raw); // RAW payload, not Base64.

    const { status, json } = await this.http.request("storeSave", {
      ...this.ids(),
      slot_index: this.slotIndex,
      payload,
      checksum,
      base_version: this.version, // 0 for a new slot; last known version otherwise.
      save_type: "auto",
      client_timestamp: this.now(),
      slot_name: "Harthmere State",
    });

    if (status === 201) {
      // Success: store the returned version for the next upload's base_version.
      this.version = json?.data?.version ?? this.version + 1;
      this.saveId = json?.data?.id ?? this.saveId;
      return;
    }

    if (status === 409) {
      // The Glitch contract requires an explicit player choice. Do not silently
      // discard local changes with keep_server or overwrite a newer device with
      // use_client. Pause until the next load/restore cycle.
      const serverVersion = Number.isFinite(Number(json?.server_version))
        ? Math.max(0, Math.floor(Number(json.server_version)))
        : undefined;
      if (serverVersion !== undefined) this.version = serverVersion;
      this.saveId = json?.save_id ?? this.saveId;
      this.conflictPaused = true;
      throw new GlitchCloudSaveConflictError(
        json?.conflict_id,
        this.saveId,
        serverVersion
      );
    }

    // Any other status: surface so GlitchCloudSaveAdapter keeps the snapshot dirty
    // and retries on the next flush.
    throw new Error(`Cloud Save storeSave failed with status ${status}`);
  }
}
