import { compactHarthmereStoreSaveResponse } from "@/server/glitch/harthmere_store_save_response";
import assert from "assert";

describe("compactHarthmereStoreSaveResponse", () => {
  it("keeps save identity/version metadata and omits the echoed payload", () => {
    const response = compactHarthmereStoreSaveResponse({
      data: {
        id: "save-1",
        version: 7,
        slot_index: 0,
        size_bytes: 445_578,
        updated_at: "2026-08-02T12:00:00.000Z",
        payload: "x".repeat(595_000),
        checksum: "deadbeef",
      },
    });

    assert.deepStrictEqual(response, {
      ok: true,
      data: {
        id: "save-1",
        version: 7,
        slot_index: 0,
        size_bytes: 445_578,
        updated_at: "2026-08-02T12:00:00.000Z",
      },
    });
    assert.strictEqual("payload" in response.data, false);
    assert.ok(JSON.stringify(response).length < 200);
  });

  it("leaves non-object upstream bodies untouched", () => {
    assert.strictEqual(compactHarthmereStoreSaveResponse(undefined), undefined);
    assert.strictEqual(compactHarthmereStoreSaveResponse("ok"), "ok");
  });
});
