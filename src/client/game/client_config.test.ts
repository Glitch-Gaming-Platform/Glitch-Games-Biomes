import { resolveGlitchLocalSyncBaseUrl } from "@/client/game/client_config";
import assert from "assert";

describe("Glitch runtime sync URL resolution", () => {
  it("lets a trusted focused-E2E query override a stale production build URL", () => {
    assert.deepEqual(
      resolveGlitchLocalSyncBaseUrl({
        installIdInUrl: false,
        runtimeOverride: "http://127.0.0.1:4907",
        explicit: "https://biomes-node-vnet.example.azurecontainerapps.io",
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3017",
        href: "http://127.0.0.1:3017/at?harthmere_native_ecs_e2e=1",
      }),
      {
        syncBaseUrl: "http://127.0.0.1:4907",
        reason: "trusted_runtime_e2e_override",
        fallback: "http://127.0.0.1:3018",
      }
    );
  });

  it("refuses a remote runtime query override", () => {
    assert.deepEqual(
      resolveGlitchLocalSyncBaseUrl({
        installIdInUrl: false,
        runtimeOverride: "https://untrusted.example",
        explicit: undefined,
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3017",
        href: "http://127.0.0.1:3017/at?harthmere_native_ecs_e2e=1",
      }),
      {
        syncBaseUrl: "http://127.0.0.1:3018",
        reason: "runtime_e2e_override_is_remote",
        fallback: "http://127.0.0.1:3018",
      }
    );
  });
});
