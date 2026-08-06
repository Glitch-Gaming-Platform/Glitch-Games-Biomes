// HARTHMERE_ATLAS_RGBA_EXPANSION (2026-08-04 asset loading audit, finding 13)
//
// The block, glass and flora atlases ship as RGB bytes and must be uploaded as
// RGBA: WebGL2 has no reliable unsized RGB path for `DataArrayTexture`, and
// three.js dropped `RGBFormat` in r137. So every boot expands ~2.65 MB of atlas
// into ~3.5 MB of RGBA on the main thread, in the same window in which the
// client is also parsing JSON, decoding base64, loading WASM and connecting
// sync.
//
// The expansion was written twice (`makeColorMap` and `makeColorMapArray`) as a
// byte-at-a-time loop: four bounds-checked byte writes and four index bumps per
// pixel. This module does the same job one 32-bit word per pixel, which is a
// single store instead of four and lets the engine keep the whole pixel in a
// register.
//
// Endianness is handled explicitly rather than assumed. Every mainstream
// browser platform is little-endian, but a wrong assumption here would swap red
// and blue in every terrain texture -- a spectacular, easily avoided bug -- so
// the byte order is probed once and a correct scalar fallback exists for the
// big-endian case.
//
// This is deliberately NOT a worker. Moving the expansion off-thread means
// transferring the buffer, and the texture upload has to happen on the main
// thread anyway; the measured cost that remains after this change did not
// justify the coordination. The real fix is still to stop shipping RGB atlases
// as base64-in-JSON at all (Galois-side change, tracked in the audit).

/**
 * Probe the platform byte order once.
 *
 * Exported for tests, which exercise both branches explicitly.
 */
export function isLittleEndian(): boolean {
  const probe = new ArrayBuffer(4);
  new Uint32Array(probe)[0] = 0x01020304;
  return new Uint8Array(probe)[0] === 0x04;
}

const LITTLE_ENDIAN = isLittleEndian();

/**
 * Expand tightly packed RGB bytes to RGBA with an opaque alpha.
 *
 * @param data RGB bytes; `data.length` must be a multiple of 3.
 * @param littleEndian override the platform probe (tests only).
 * @returns a newly allocated RGBA byte array of `data.length / 3 * 4` bytes.
 */
export function expandRgbToRgba(
  data: Uint8Array,
  littleEndian: boolean = LITTLE_ENDIAN
): Uint8Array {
  if (data.length % 3 !== 0) {
    throw new Error(
      `RGB byte length must be divisible by 3, received ${data.length}`
    );
  }
  const pixels = data.length / 3;
  const out = new Uint8Array(pixels * 4);

  // The fast path needs a 4-byte-aligned backing buffer, which a freshly
  // allocated Uint8Array always has. A big-endian host uses the scalar path;
  // that keeps the byte result identical and makes the test override honest on
  // the little-endian machines used in development and CI.
  if (littleEndian && out.byteOffset % 4 === 0) {
    const words = new Uint32Array(out.buffer, out.byteOffset, pixels);
    // Little-endian: byte 0 (R) is the least significant byte.
    for (let p = 0, i = 0; p < pixels; p += 1, i += 3) {
      words[p] =
        0xff000000 | (data[i + 2] << 16) | (data[i + 1] << 8) | data[i];
    }
    return out;
  }

  // Big-endian/defensive scalar fallback.
  for (let p = 0, i = 0, j = 0; p < pixels; p += 1) {
    out[j++] = data[i++];
    out[j++] = data[i++];
    out[j++] = data[i++];
    out[j++] = 255;
  }
  return out;
}
