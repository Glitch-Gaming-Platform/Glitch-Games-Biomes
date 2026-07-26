import assert from "assert";
import crypto from "crypto";
import {
  HARTHMERE_GLITCH_CLOUD_SAVE_MAX_DECODED_BYTES,
  makeHarthmereCloudSavePayload,
  validateHarthmerePreEncodedCloudSavePayload,
} from "../glitch_cloud_save_payload";

describe("Harthmere Glitch Cloud Save payload rules", () => {
  it("checksums the decoded UTF-8 bytes", () => {
    const encoded = makeHarthmereCloudSavePayload({ quest: "Identity" });
    const bytes = Buffer.from(encoded.payload, "base64");
    assert.equal(
      encoded.checksum,
      crypto.createHash("sha256").update(bytes).digest("hex")
    );
    assert.equal(encoded.size_bytes, bytes.byteLength);
  });

  it("accepts a valid pre-encoded compatibility payload", () => {
    const bytes = Buffer.from('{"inventory":"saved"}', "utf8");
    const result = validateHarthmerePreEncodedCloudSavePayload({
      payload: bytes.toString("base64"),
      checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
    assert.equal(result.size_bytes, bytes.byteLength);
  });

  it("rejects invalid Base64 and decoded-byte checksum mismatches", () => {
    assert.throws(
      () =>
        validateHarthmerePreEncodedCloudSavePayload({
          payload: "%%%not-base64%%%",
          checksum: "0".repeat(64),
        }),
      /CLOUD_SAVE_INVALID_BASE64/
    );
    const payload = Buffer.from("raw bytes", "utf8").toString("base64");
    assert.throws(
      () =>
        validateHarthmerePreEncodedCloudSavePayload({
          payload,
          checksum: "0".repeat(64),
        }),
      /CLOUD_SAVE_CHECKSUM_MISMATCH/
    );
  });

  it("enforces the live 50 MB decoded limit", () => {
    const oversized = Buffer.alloc(
      HARTHMERE_GLITCH_CLOUD_SAVE_MAX_DECODED_BYTES + 1,
      1
    );
    assert.throws(
      () =>
        validateHarthmerePreEncodedCloudSavePayload({
          payload: oversized.toString("base64"),
          checksum: crypto.createHash("sha256").update(oversized).digest("hex"),
        }),
      /CLOUD_SAVE_PAYLOAD_TOO_LARGE/
    );
  });
});
