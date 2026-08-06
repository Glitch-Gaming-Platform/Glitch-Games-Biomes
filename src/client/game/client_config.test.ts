import {
  DESKTOP_GPU_TIERS,
  DETECT_GPU_BENCHMARK_VERSION,
  GPU_BENCHMARKS_URL,
  HARTHMERE_DESKTOP_DYNAMIC_MIN_DRAW_DISTANCE,
  capLowMemoryResourceNodesForDevice,
  genGPUTier,
  isLocalGameHostname,
  isMobileDeviceDescription,
  lowMemoryScaleForDevice,
  resolveGlitchLocalSyncBaseUrl,
  shouldResolveGlitchLocalSyncBaseUrl,
  shouldShowVirtualJoystick,
  trustedRuntimeSyncBaseUrlOverride,
} from "@/client/game/client_config";
import { browserSyncBaseUrl } from "@/client/game/context_managers/client_io";
import assert from "assert";
import { readFileSync, readdirSync } from "fs";
import path from "path";

describe("GPU tier detection", () => {
  it("runs real detection against same-origin benchmarks in every environment", async () => {
    let detectorCalls = 0;
    const detected = await genGPUTier(async (options) => {
      detectorCalls += 1;
      assert.equal(options?.benchmarksURL, GPU_BENCHMARKS_URL);
      assert.equal(options?.failIfMajorPerformanceCaveat, true);
      assert.deepEqual(options?.desktopTiers, DESKTOP_GPU_TIERS);
      return {
        gpu: "test gpu",
        isMobile: false,
        tier: 2,
        type: "BENCHMARK",
      };
    });

    assert.equal(detectorCalls, 1);
    assert.equal(detected.tier, 2);
    assert.equal(detected.gpu, "test gpu");
  });

  it("ships the complete version-matched detect-gpu benchmark set", () => {
    const packageJsonPath = require.resolve("detect-gpu/package.json");
    const packageVersion = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    ).version;
    assert.equal(DETECT_GPU_BENCHMARK_VERSION, packageVersion);

    const packageBenchmarkDirectory = path.join(
      path.dirname(packageJsonPath),
      "dist",
      "benchmarks"
    );
    const benchmarkDirectory = path.join(
      process.cwd(),
      "public",
      GPU_BENCHMARKS_URL.replace(/^\/assets\//, "assets/")
    );
    const packageFiles = readdirSync(packageBenchmarkDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort();
    const publicFiles = readdirSync(benchmarkDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort();
    assert.deepEqual(publicFiles, packageFiles);

    for (const file of packageFiles) {
      const contents = JSON.parse(
        readFileSync(path.join(benchmarkDirectory, file), "utf8")
      );
      assert.equal(contents[0], DETECT_GPU_BENCHMARK_VERSION, file);
      assert.ok(contents.length > 1, `${file} must contain benchmark rows`);
    }
  });
});

describe("Harthmere desktop performance floor", () => {
  it("retains landmarks without pinning CPU-bound combat to the former 192m radius", () => {
    assert.equal(HARTHMERE_DESKTOP_DYNAMIC_MIN_DRAW_DISTANCE, 96);
  });
});

describe("Glitch runtime sync URL resolution", () => {
  it("enables resolution for focused native-ECS tests in a production bundle", () => {
    assert.equal(
      shouldResolveGlitchLocalSyncBaseUrl({
        isGlitchLocalRuntime: false,
        nativeEcsE2E: true,
      }),
      true
    );
    assert.equal(
      shouldResolveGlitchLocalSyncBaseUrl({
        isGlitchLocalRuntime: false,
        nativeEcsE2E: false,
      }),
      false
    );
  });

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
        fallback: "http://127.0.0.1:3017",
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
        syncBaseUrl: "http://127.0.0.1:3017",
        reason: "runtime_e2e_override_is_remote",
        fallback: "http://127.0.0.1:3017",
      }
    );
  });

  it("treats loopback and private-LAN game origins as local runtimes", () => {
    assert.equal(isLocalGameHostname("127.0.0.1"), true);
    assert.equal(isLocalGameHostname("192.168.0.204"), true);
    assert.equal(isLocalGameHostname("10.20.30.40"), true);
    assert.equal(isLocalGameHostname("172.20.1.2"), true);
    assert.equal(isLocalGameHostname("api.biomes.gg"), false);
  });

  it("accepts only same-host or loopback Sync query overrides", () => {
    assert.equal(
      trustedRuntimeSyncBaseUrlOverride(
        "http://192.168.0.204:4907",
        "http://192.168.0.204:3047/at"
      ),
      "http://192.168.0.204:4907"
    );
    assert.equal(
      trustedRuntimeSyncBaseUrlOverride(
        "http://127.0.0.1:4907",
        "http://localhost:3017/at"
      ),
      "http://127.0.0.1:4907"
    );
    assert.equal(
      trustedRuntimeSyncBaseUrlOverride(
        "https://api.biomes.gg",
        "http://127.0.0.1:3017/at"
      ),
      undefined
    );
  });

  it("fails legacy cloud Sync defaults closed to the current web origin", () => {
    assert.equal(
      browserSyncBaseUrl("api", "http://127.0.0.1:3017/at"),
      "http://127.0.0.1:3017/"
    );
    assert.equal(
      browserSyncBaseUrl(
        "https://api4.biomes.gg",
        "http://192.168.0.204:3047/at"
      ),
      "http://192.168.0.204:3047/"
    );
    assert.equal(
      browserSyncBaseUrl(
        "http://192.168.0.204:4907",
        "http://192.168.0.204:3047/at"
      ),
      "http://192.168.0.204:4907"
    );
  });
});

describe("mobile control selection", () => {
  it("uses a phone-specific WASM/resource budget without changing desktop low-memory mode", () => {
    assert.equal(lowMemoryScaleForDevice(true), 0.125);
    assert.equal(lowMemoryScaleForDevice(false), 0.5);
  });

  it("caps only mobile resource nodes while preserving the block-mesh budget", () => {
    const proportionallyScaled = {
      count: 17_500,
      labels: { blockMeshes: 162.5 },
    };
    assert.deepEqual(
      capLowMemoryResourceNodesForDevice(proportionallyScaled, true),
      {
        count: 8_000,
        labels: { blockMeshes: 162.5 },
      }
    );
    assert.equal(
      capLowMemoryResourceNodesForDevice(proportionallyScaled, false),
      proportionallyScaled
    );
  });

  it("recognizes mobile operating systems even when UA device classification is missing", () => {
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "iOS" }),
      true
    );
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "Android" }),
      true
    );
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "macOS" }),
      false
    );
  });

  it("uses the virtual joystick on touch devices even when Pointer Lock exists", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: true,
        deviceType: "mobile",
        osName: "Android",
      }),
      true
    );
  });

  it("uses the virtual joystick for iPhone and iPad user agents", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: false,
        deviceType: "tablet",
        osName: "iOS",
      }),
      true
    );
  });

  it("keeps Pointer Lock controls on a desktop browser", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: false,
        deviceType: undefined,
        osName: "macOS",
      }),
      false
    );
  });

  it("keeps mobile-only controls off a pointerless desktop embed", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: false,
        touchDevice: false,
        deviceType: undefined,
        osName: "macOS",
      }),
      false
    );
  });
});
