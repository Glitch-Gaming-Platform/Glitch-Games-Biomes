// HARTHMERE_GLITCH_CLOUD_SAVE_PAYLOAD
//
// Glitch's live 50 MB limit applies to decoded bytes, not the larger Base64
// request string. Keeping validation in one server-only module lets the proxy
// reject malformed compatibility-slot uploads before consuming an upstream
// request, while structured slot-0 snapshots use the exact same byte rules.

import crypto from "crypto";

export const HARTHMERE_GLITCH_CLOUD_SAVE_MAX_DECODED_BYTES = 50 * 1024 * 1024;

export class HarthmereCloudSavePayloadError extends Error {
  constructor(
    readonly code:
      | "CLOUD_SAVE_INVALID_BASE64"
      | "CLOUD_SAVE_CHECKSUM_MISMATCH"
      | "CLOUD_SAVE_PAYLOAD_TOO_LARGE",
    readonly status: 400 | 413
  ) {
    super(code);
    this.name = "HarthmereCloudSavePayloadError";
  }
}

function sha256Hex(bytes: Buffer) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertDecodedSize(bytes: Buffer) {
  if (bytes.byteLength > HARTHMERE_GLITCH_CLOUD_SAVE_MAX_DECODED_BYTES) {
    throw new HarthmereCloudSavePayloadError(
      "CLOUD_SAVE_PAYLOAD_TOO_LARGE",
      413
    );
  }
}

/** Encode a structured slot-0 snapshot and checksum the raw UTF-8 bytes. */
export function makeHarthmereCloudSavePayload(snapshot: unknown) {
  const bytes = Buffer.from(JSON.stringify(snapshot ?? {}), "utf8");
  assertDecodedSize(bytes);
  return {
    payload: bytes.toString("base64"),
    checksum: sha256Hex(bytes),
    size_bytes: bytes.byteLength,
  };
}

/**
 * Validate an already encoded slot-90 transport payload. Node's Base64 decoder
 * is permissive, so validate the alphabet/padding first and then recompute the
 * checksum over the decoded bytes.
 */
export function validateHarthmerePreEncodedCloudSavePayload(input: {
  payload: string;
  checksum: string;
}) {
  const payload = input.payload.trim();
  const bytes = Buffer.from(payload, "base64");
  // Re-encoding is a linear canonicality check and avoids a giant nested
  // regular expression overflowing the JS stack near the 50 MB boundary.
  const validBase64 =
    payload.length > 0 &&
    payload.length % 4 === 0 &&
    bytes.toString("base64") === payload;
  if (!validBase64) {
    throw new HarthmereCloudSavePayloadError("CLOUD_SAVE_INVALID_BASE64", 400);
  }
  assertDecodedSize(bytes);
  const checksum = input.checksum.trim();
  if (!/^[0-9a-f]{64}$/.test(checksum) || sha256Hex(bytes) !== checksum) {
    throw new HarthmereCloudSavePayloadError(
      "CLOUD_SAVE_CHECKSUM_MISMATCH",
      400
    );
  }
  return { payload, checksum, size_bytes: bytes.byteLength };
}
