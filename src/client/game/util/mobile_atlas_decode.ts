// HARTHMERE_ATLAS_BASE64_DECODE (2026-08-04 mobile audit, item 6).
//
// Base64 decoding for the atlas/material payloads that ship as strings inside
// JSON. Two separate concerns live here:
//
//   `decodeBase64Bytes`      -- shared, correct, used on every platform.
//   `takeAtlasBase64Field`   -- adds a mobile-only payload release on top.
//
// (The file name predates the correctness fix below, when this module was
// mobile-only. It now hosts the shared decoder as well.)
//
// ## Why the shared decoder exists
//
// Five call sites independently wrote this expression:
//
//     new Uint8Array(Buffer.from(data, "base64").buffer)
//
// It is wrong. `.buffer` returns the *backing* ArrayBuffer and discards
// `byteOffset` and `byteLength`, so the result is only correct when the
// allocation happens to be exact and zero-offset. Under Node -- tests, SSR,
// any tooling -- `Buffer` allocates small buffers out of a shared 8 KiB pool,
// so the expression returns a view over the whole pool starting at byte 0:
// neighbouring, unrelated bytes. A unit test written during this audit caught
// it decoding fragments of a previously allocated JSON string instead of the
// atlas payload.
//
// In the browser it happened to be correct: `Buffer` is the browserify
// polyfill, whose `fromString` allocates an exact-size `Uint8Array` with no
// pooling. So the shipped client was fine -- by coincidence of a dependency's
// internals, not by construction. That is a bad thing to keep relying on: it
// would break silently on a polyfill change, on any bundler that maps `Buffer`
// to something else, and it already breaks in Node.
//
// The fix is to prefer `atob` (native, exact allocation, already the precedent
// in `makeBufferTextureFromBase64`) and to respect `byteOffset`/`byteLength`
// in the `Buffer` fallback. Both branches now produce identical, correct
// bytes, so this is a no-op for the shipped browser client and a correctness
// fix everywhere else.
//
// ## Why the mobile release helper exists
//
// The atlases are large: `blocks.json` is 1.43 MB of base64, `florae.json`
// 1.22 MB, plus glass -- roughly 2.65 MB, decoded synchronously on the main
// thread during exactly the window in which iOS was firing
// JETSAM_REASON_MEMORY_HIGHWATER. The parsed JSON object holds every payload
// alive at once, so peak footprint is the sum of all of them plus the decoded
// output. `takeAtlasBase64Field` drops each ~1 MB string as it is consumed.
//
// That release is mobile-only, because it mutates the caller's config object
// and only matters where process memory is the binding constraint.
//
// The real remedy for item 6 -- not shipping base64-in-JSON at all (raw `.bin`
// plus a shape sidecar, expanded in a worker or pre-expanded in Galois) -- is
// an asset-pipeline change and remains open.

/**
 * Decode base64 into an exactly sized byte array.
 *
 * Correct on every platform. Prefers the engine's native `atob`, which is both
 * faster than the browserify `Buffer` polyfill and allocates exactly; falls
 * back to `Buffer` with `byteOffset`/`byteLength` honoured.
 */
export function decodeBase64Bytes(data: string): Uint8Array {
  if (typeof atob === "function") {
    return decodeBase64Native(data);
  }
  const buffer = Buffer.from(data, "base64");
  // `buffer.buffer` may be a larger pooled ArrayBuffer, and `buffer` may start
  // partway into it. Slice the exact window rather than viewing the whole pool.
  return new Uint8Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    )
  );
}

/**
 * Native base64 -> bytes, allocating exactly one right-sized buffer.
 *
 * `atob` returns a binary string; reading it with `charCodeAt` into a
 * pre-sized `Uint8Array` avoids both the pure-JS polyfill decoder and the
 * pooled-ArrayBuffer retention described in the header.
 */
export function decodeBase64Native(data: string): Uint8Array {
  const binary = atob(data);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode base64 into an `ArrayBuffer`, for consumers that want the buffer
 * rather than a view (the GLB loader, for one).
 */
export function decodeBase64ArrayBuffer(data: string): ArrayBuffer {
  const bytes = decodeBase64Bytes(data);
  // `decodeBase64Bytes` always returns an exact, zero-offset array, so the
  // backing buffer is exactly the payload and needs no further slicing.
  return bytes.buffer as ArrayBuffer;
}

/**
 * Decode one atlas field, optionally releasing the source string.
 *
 * `releasePayload` is `clientConfig.mobileDevice` at every call site. When it
 * is true the base64 string is cleared from `config` so the engine can reclaim
 * roughly a megabyte per field mid-boot instead of only after the whole
 * texture set is built. Mutating `config` is safe because the fetched JSON
 * object is owned by the caller and discarded immediately afterwards.
 *
 * When false the config is left completely intact.
 */
export function takeAtlasBase64Field<T extends object>(
  config: T,
  field: keyof T & string,
  releasePayload: boolean
): Uint8Array {
  const payload = config[field] as { data: string };
  const decoded = decodeBase64Bytes(payload.data);
  if (releasePayload) {
    (payload as { data?: string }).data = undefined;
  }
  return decoded;
}
