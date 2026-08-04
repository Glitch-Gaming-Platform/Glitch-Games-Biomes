/// <reference types="mocha" />
// HARTHMERE_ATLAS_BASE64_DECODE (2026-08-04 mobile audit, item 6).
import {
  decodeBase64ArrayBuffer,
  decodeBase64Bytes,
  decodeBase64Native,
  takeAtlasBase64Field,
} from "@/client/game/util/mobile_atlas_decode";
import assert from "assert";

// These tests run in Node, where `atob` may or may not be defined depending on
// the runtime. Both branches of `decodeBase64Bytes` must be exercised, so the
// helpers below install and remove `atob` explicitly.
function withAtob(fn: () => void) {
  const globals = globalThis as { atob?: (data: string) => string };
  const original = globals.atob;
  globals.atob = (data: string) =>
    Buffer.from(data, "base64").toString("binary");
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete globals.atob;
    } else {
      globals.atob = original;
    }
  }
}

function withoutAtob(fn: () => void) {
  const globals = globalThis as { atob?: (data: string) => string };
  const original = globals.atob;
  delete globals.atob;
  try {
    fn();
  } finally {
    if (original !== undefined) {
      globals.atob = original;
    }
  }
}

const SAMPLE = Uint8Array.from([0, 1, 2, 253, 254, 255, 128, 64]);
const SAMPLE_BASE64 = Buffer.from(SAMPLE).toString("base64");

describe("atlas base64 decode", () => {
  it("decodes the exact payload on the native path", () => {
    withAtob(() => {
      assert.deepEqual([...decodeBase64Bytes(SAMPLE_BASE64)], [...SAMPLE]);
    });
  });

  it("decodes the exact payload on the Buffer fallback path", () => {
    // This is the regression that motivated the fix. The old expression was
    // `new Uint8Array(Buffer.from(data, "base64").buffer)`, which discards
    // byteOffset/byteLength; under Node the backing buffer is pooled, so it
    // returned a view over the whole 8 KiB pool starting at byte 0 -- i.e.
    // neighbouring, unrelated bytes rather than the payload.
    withoutAtob(() => {
      assert.deepEqual([...decodeBase64Bytes(SAMPLE_BASE64)], [...SAMPLE]);
    });
  });

  it("agrees between the native and fallback paths", () => {
    let native: Uint8Array | undefined;
    let fallback: Uint8Array | undefined;
    withAtob(() => {
      native = decodeBase64Bytes(SAMPLE_BASE64);
    });
    withoutAtob(() => {
      fallback = decodeBase64Bytes(SAMPLE_BASE64);
    });
    assert.deepEqual([...native!], [...fallback!]);
  });

  it("never returns a view over a larger backing buffer", () => {
    // The whole class of bug is a view whose window does not match the
    // payload. Assert the invariant directly on both paths.
    for (const run of [withAtob, withoutAtob]) {
      run(() => {
        const bytes = decodeBase64Bytes(SAMPLE_BASE64);
        assert.equal(bytes.length, SAMPLE.length);
        assert.equal(bytes.byteOffset, 0);
        assert.equal(bytes.buffer.byteLength, SAMPLE.length);
      });
    }
  });

  it("survives a payload large enough to leave Node's Buffer pool", () => {
    // Node pools allocations under 4 KiB (Buffer.poolSize >>> 1) and allocates
    // larger ones exactly. Cover both sides of that boundary so the test would
    // have failed for small payloads and still passes for large ones.
    for (const size of [16, 8192]) {
      const payload = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) {
        payload[i] = i % 256;
      }
      const encoded = Buffer.from(payload).toString("base64");
      withoutAtob(() => {
        assert.deepEqual([...decodeBase64Bytes(encoded)], [...payload]);
      });
    }
  });

  it("handles high bytes without sign or unicode corruption", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) {
      all[i] = i;
    }
    const encoded = Buffer.from(all).toString("base64");
    withAtob(() => {
      assert.deepEqual([...decodeBase64Native(encoded)], [...all]);
    });
  });

  it("returns an exact ArrayBuffer for GLB consumers", () => {
    // The GLB path hands this straight to a parser that reads a header at byte
    // 0, so an offset or oversized buffer is not merely wasteful, it is wrong.
    withAtob(() => {
      const buffer = decodeBase64ArrayBuffer(SAMPLE_BASE64);
      assert.equal(buffer.byteLength, SAMPLE.length);
      assert.deepEqual([...new Uint8Array(buffer)], [...SAMPLE]);
    });
  });

  it("releases the payload string only when asked", () => {
    // Dropping the ~1MB base64 string as each field is consumed is the mobile
    // memory win: peak boot footprint becomes one payload, not all three.
    withAtob(() => {
      const releasing = { colors: { data: SAMPLE_BASE64 } };
      const decoded = takeAtlasBase64Field(releasing, "colors", true);
      assert.deepEqual([...decoded], [...SAMPLE]);
      assert.equal(releasing.colors.data, undefined);

      const retaining = { colors: { data: SAMPLE_BASE64 } };
      takeAtlasBase64Field(retaining, "colors", false);
      assert.equal(retaining.colors.data, SAMPLE_BASE64);
    });
  });
});
