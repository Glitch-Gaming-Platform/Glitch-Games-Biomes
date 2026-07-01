import assert from "assert";
import {
  GlitchCloudSaveBlobTransport,
  HARTHMERE_KV_CLOUD_SAVE_SLOT,
  type CloudSaveHttp,
} from "../glitch_cloud_save_transport";

// Deterministic injected crypto/base64 so the tests are environment-independent
// and can assert the "hash the RAW payload, not the Base64" rule precisely.
const deps = {
  now: () => "2026-07-01T00:00:00.000Z",
  sha256Hex: async (raw: string) => `sha(${raw})`,
  base64Encode: (raw: string) => `b64(${raw})`,
  base64Decode: (b64: string) => b64.replace(/^b64\(/, "").replace(/\)$/, ""),
};

function recordingHttp(
  handlers: Partial<
    Record<string, (body: any) => { status: number; json: any }>
  >
): { http: CloudSaveHttp; calls: Array<{ op: string; body: any }> } {
  const calls: Array<{ op: string; body: any }> = [];
  const http: CloudSaveHttp = {
    async request(op, body) {
      calls.push({ op, body });
      const handler = handlers[op];
      if (!handler) {
        return { status: 404, json: {} };
      }
      return handler(body) as any;
    },
  };
  return { http, calls };
}

describe("GlitchCloudSaveBlobTransport", () => {
  const config = {
    titleId: "title-1",
    installId: "install-1",
    isAuthenticated: () => true,
    ...deps,
  };

  it("isReady requires title, install and authentication", async () => {
    const { http } = recordingHttp({});
    assert.equal(await new GlitchCloudSaveBlobTransport(http, config).isReady(), true);
    assert.equal(
      await new GlitchCloudSaveBlobTransport(http, {
        ...config,
        isAuthenticated: () => false,
      }).isReady(),
      false
    );
    assert.equal(
      await new GlitchCloudSaveBlobTransport(http, {
        ...config,
        installId: "",
      }).isReady(),
      false
    );
  });

  it("loads and decodes the reserved-slot blob and records its version", async () => {
    const blob = JSON.stringify({ stamina: "100" });
    const { http } = recordingHttp({
      listSaves: () => ({
        status: 200,
        json: {
          data: [
            { id: "s1", slot_index: HARTHMERE_KV_CLOUD_SAVE_SLOT, version: 7, payload: `b64(${blob})` },
            { id: "other", slot_index: 1, version: 3, payload: "b64({})" },
          ],
        },
      }),
    });
    const t = new GlitchCloudSaveBlobTransport(http, config);
    assert.deepEqual(await t.load(), { stamina: "100" });
  });

  it("uploads with base_version and a checksum of the RAW payload", async () => {
    const stored: any[] = [];
    const { http, calls } = recordingHttp({
      listSaves: () => ({
        status: 200,
        json: { data: [{ id: "s1", slot_index: HARTHMERE_KV_CLOUD_SAVE_SLOT, version: 7, payload: "b64({})" }] },
      }),
      storeSave: (body) => {
        stored.push(body);
        return { status: 201, json: { data: { id: "s1", version: 8 } } };
      },
    });
    const t = new GlitchCloudSaveBlobTransport(http, config);
    await t.load(); // learns version 7
    await t.store({ hp: "50" });

    const raw = JSON.stringify({ hp: "50" });
    const sent = stored[0];
    assert.equal(sent.slot_index, HARTHMERE_KV_CLOUD_SAVE_SLOT);
    assert.equal(sent.payload, `b64(${raw})`);
    assert.equal(sent.checksum, `sha(${raw})`, "checksum must hash raw payload");
    assert.notEqual(sent.checksum, `sha(b64(${raw}))`, "must NOT hash base64");
    assert.equal(sent.base_version, 7, "sends last loaded version as base_version");

    // After success the version advances to the returned value for the next save.
    await t.store({ hp: "60" });
    assert.equal(calls.filter((c) => c.op === "storeSave")[1].body.base_version, 8);
  });

  it("uses base_version 0 for a brand-new slot", async () => {
    const { http } = recordingHttp({
      listSaves: () => ({ status: 200, json: { data: [] } }),
      storeSave: (body) => {
        assert.equal(body.base_version, 0);
        return { status: 201, json: { data: { id: "new", version: 1 } } };
      },
    });
    const t = new GlitchCloudSaveBlobTransport(http, config);
    await t.load();
    await t.store({ a: "1" });
  });

  it("resolves a 409 conflict with keep_server instead of retrying blindly", async () => {
    const { http, calls } = recordingHttp({
      listSaves: () => ({
        status: 200,
        json: { data: [{ id: "s1", slot_index: HARTHMERE_KV_CLOUD_SAVE_SLOT, version: 4, payload: "b64({})" }] },
      }),
      storeSave: () => ({
        status: 409,
        json: {
          status: "conflict",
          conflict_id: "c-1",
          save_id: "s1",
          server_version: 5,
          client_version: 4,
        },
      }),
      resolveSave: () => ({ status: 200, json: { data: { version: 5 } } }),
    });
    const t = new GlitchCloudSaveBlobTransport(http, config);
    await t.load();
    await t.store({ a: "1" }); // must NOT throw on 409
    const resolve = calls.find((c) => c.op === "resolveSave");
    assert.ok(resolve, "resolve endpoint was called");
    assert.equal(resolve!.body.choice, "keep_server");
    assert.equal(resolve!.body.conflict_id, "c-1");
  });

  it("throws on unexpected error status so the adapter can retry", async () => {
    const { http } = recordingHttp({
      listSaves: () => ({ status: 200, json: { data: [] } }),
      storeSave: () => ({ status: 500, json: { code: "SAVE_FAILED" } }),
    });
    const t = new GlitchCloudSaveBlobTransport(http, config);
    await t.load();
    await assert.rejects(() => t.store({ a: "1" }));
  });

  it("never throws from load() when the API is unreachable", async () => {
    const http: CloudSaveHttp = {
      async request() {
        throw new Error("network down");
      },
    };
    const t = new GlitchCloudSaveBlobTransport(http, config);
    assert.equal(await t.load(), null);
  });
});
