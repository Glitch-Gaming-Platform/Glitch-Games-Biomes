import {
  isTouchDevice,
  supportsPointerLock,
} from "@/client/components/contexts/PointerLockContext";
import type { ObserverMode } from "@/client/game/util/observer";
import {
  probeWebGpuSupport,
  type WebGpuProbeResult,
} from "@/client/renderer/webgpu_probe";
import type {
  MobileDeviceClass,
  MobileGraphicsClamps,
} from "@/client/game/util/mobile_device_profile";
import {
  classifyMobileDevice,
  mobileGraphicsClampsForClass,
  readMobileDeviceSignals,
} from "@/client/game/util/mobile_device_profile";
import type { GraphicsQuality } from "@/client/util/typed_local_storage";
import { zGraphicsQuality } from "@/client/util/typed_local_storage";
import type { Vec2f } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { GaussianDistribution } from "@/shared/math/gaussian";
import type { BiomesResourceCapacities } from "@/shared/resources/biomes";
import { makeCvalHook } from "@/shared/util/cvals";
import type { JSONable } from "@/shared/util/type_helpers";
import type { Vec3f } from "@/shared/wasm/types/common";
import { ok } from "assert";
import type { GetGPUTier, TierResult } from "detect-gpu";
import { cloneDeep, includes } from "lodash";
import { UAParser } from "ua-parser-js";
import { simd } from "wasm-feature-detect";

export enum WasmSimd {
  Normal = "normal",
  Simd = "simd",
}

// The desktop Harthmere runtime needs enough distance to keep nearby landmarks
// legible, but 192m retained too much terrain and synchronized ECS state for a
// CPU-bound combat scene to recover. The adaptive controller still owns values
// above this floor; explicit Low/Safe settings remain fixed and mobile removes
// the desktop floor entirely.
export const HARTHMERE_DESKTOP_DYNAMIC_MIN_DRAW_DISTANCE = 128;

export interface WasmBinary {
  simd: WasmSimd;
}

export type InitConfigOptions = {
  forceLowMemory?: boolean;
  startCoordinates?: Vec3f;
  startOrientation?: Vec2f;
  observerMode?: ObserverMode;
  bikkieTrayId?: BiomesId;
  allowSoftwareWebGL?: boolean;
  primaryCTA?: "discord" | "login";
  displayName?: string;
};

export type ClientConfig = typeof BASE_CLIENT_CONFIG;

const BASE_CLIENT_CONFIG = {
  dev: false,
  showVirtualJoystick: false,
  mobileDevice: false,
  forceCharacterSetup: false,
  lowMemory: false,
  unsupportedBrowser: false,
  skipBikkieReactInvalidate: false,
  oldTextures: false,
  primaryCTA: "login" as "discord" | "login" | undefined,
  displayName: undefined as string | undefined,
  initialObserverMode: undefined as ObserverMode | undefined,
  startCoordinates: undefined as Vec3f | undefined,
  startOrientation: undefined as Vec2f | undefined,
  hideChrome: false,
  // Harthmere no longer uses the legacy Biomes cloud Sync fleet. The web
  // origin owns/proxies Sync in production and local stacks, so the safe
  // default is always same-origin. Explicit trusted local overrides are
  // applied below for focused browser tests.
  syncBaseUrl: "/",
  useProdSync: true,
  useWorker: false,
  sharedArrayBufferSupported: true,
  // Client-side value only used for UI flavoring when trying to pick up items with a full inventory
  // Should match the sernver value.
  gameDropPickupDistance: 4,
  // Server-validated in server config. This value should always be less than the server gameDropDistance
  gameDropDistance: 5,
  gameThrowDistance: 8,
  wasmBinary: { releaseType: "release", simd: "normal" } as WasmBinary,
  // This should be less than the server's CONFIG.gamePlayerExpirationSecs
  keepAliveIntervalMs: 5000,
  wasmMemoryTracing: false,
  // Applies an artificial latency to client websocket communications.
  // This is round trip latency (so send lag + receive lag), and is sampled
  // from a Gaussian (default variance such that 95% of samples will be within
  // 50% of the mean).
  artificialLagMs: undefined as GaussianDistribution | undefined,
  clientResourceCapacity: {
    count: 140_000,
    labels: {
      blockMeshes: 1300,
    },
  } satisfies BiomesResourceCapacities,
  voxelooMemoryMb: 1024,
  useIdbForEcs: false,
  gpuTier: 0,
  gpuName: "Unknown",
  webGpu: {
    status: "unsupported",
    available: false,
  } as WebGpuProbeResult,
  forceDrawDistance: undefined as number | undefined,
  minDrawDistance: undefined as number | undefined,
  dynamicMinDrawDistance: undefined as number | undefined,
  forceRenderScale: undefined as number | undefined,
  forceGraphicsQuality: undefined as GraphicsQuality | undefined,
  allowSoftwareWebGL: false,
  // HARTHMERE_MOBILE_DEVICE_PROFILE (2026-08-04 mobile audit, items 3 and 9).
  // Populated only when `mobileDevice` is true. `undefined` everywhere else,
  // and every consumer treats `undefined` as "no clamping" -- so desktop
  // render scale and draw distance behave exactly as they did before.
  mobileDeviceClass: undefined as MobileDeviceClass | undefined,
  mobileGraphicsClamps: undefined as MobileGraphicsClamps | undefined,
};

function adjustConfigForLowMemory(clientConfig: ClientConfig) {
  makeCvalHook({
    path: ["game", "capabilities", "lowMemory"],
    help: "Running in low-memory mode, e.g. because a 32-bit browser is detected.",
    collect: () => clientConfig.lowMemory,
  });
  if (!clientConfig.lowMemory) {
    return;
  }

  // On low memory or 32-bit systems it can be difficult to allocate a large
  // chunk of contiguous memory, so in low memory mode we allocate a smaller
  // chunk for voxeloo memory.
  const memoryScale = lowMemoryScaleForDevice(clientConfig.mobileDevice);
  clientConfig.voxelooMemoryMb *= memoryScale;

  // With less voxeloo memory, we must reduce our resource capacity
  // proportionally, since most resources require voxeloo memory.
  scaleResourceCapacity(clientConfig, memoryScale);
  clientConfig.clientResourceCapacity = capLowMemoryResourceNodesForDevice(
    clientConfig.clientResourceCapacity,
    clientConfig.mobileDevice
  );
}

const VOXELOO_MEMORY_SCALE = 0.5;
// A physical iPhone 12 mini reached Safari's 1,536 MB WebContent high-water
// limit with the previous 256 MB reservation even though Voxeloo itself used
// only about 30 MB. WebKit also retains decoded assets, compiled WASM code,
// Three.js resources, and compressed pages in that same process. Keep enough
// native heap for nearby terrain while reserving another 128 MB of process
// headroom for the rest of the game. Desktop low-memory mode stays unchanged.
const MOBILE_VOXELOO_MEMORY_SCALE = 0.125;
// Physical iPhone acceptance showed that the proportional 17,500-node limit
// retained too much startup work. The first 4,000-node clamp exposed a second
// failure after the avatar fan-out was fixed, and sustained real-device play
// later measured a normal Grove movement working set around 6,400 nodes. A
// 6,000 cap forced fifteen full resource rebuilds in roughly nine minutes and
// grew WebContent by about 120 MB through allocation/compression churn. Keep
// enough headroom for that measured set while remaining far below desktop's
// 140,000-node budget. The independently scaled block-mesh label is unchanged.
const MOBILE_RESOURCE_NODE_CAP = 8_000;

export function lowMemoryScaleForDevice(mobileDevice: boolean) {
  return mobileDevice ? MOBILE_VOXELOO_MEMORY_SCALE : VOXELOO_MEMORY_SCALE;
}

export function capLowMemoryResourceNodesForDevice<
  T extends BiomesResourceCapacities,
>(capacity: T, mobileDevice: boolean): T {
  if (!mobileDevice) {
    return capacity;
  }
  return {
    ...capacity,
    count: Math.min(capacity.count, MOBILE_RESOURCE_NODE_CAP),
  } as T;
}

function scaleResourceCapacity(clientConfig: ClientConfig, scale: number) {
  clientConfig.clientResourceCapacity = {
    count: clientConfig.clientResourceCapacity.count * scale,
    labels: Object.fromEntries(
      Object.entries(clientConfig.clientResourceCapacity.labels).map(
        ([k, v]) => [k, v ? v * scale : undefined]
      )
    ) as any,
  };
}

export function trustedRuntimeSyncBaseUrlOverride(
  value: string,
  href: string
): string | undefined {
  try {
    const current = new URL(href);
    const candidate = new URL(value, current);
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return undefined;
    }
    const isLoopback = (hostname: string) =>
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1";
    if (
      candidate.hostname !== current.hostname &&
      !(isLoopback(candidate.hostname) && isLoopback(current.hostname))
    ) {
      return undefined;
    }
    return candidate.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function doURLOverrides(clientConfig: ClientConfig) {
  const params = new URLSearchParams(window.location.search);

  const applyParam = (name: string, fn: (value: string) => void) => {
    const param = params.get(name);
    if (param !== null) {
      fn(param);
    }
  };
  applyParam("syncBaseUrl", (val) => {
    const trusted = trustedRuntimeSyncBaseUrlOverride(
      val,
      window.location.href
    );
    if (trusted) {
      clientConfig.syncBaseUrl = trusted;
    } else {
      log.error(`Rejected untrusted syncBaseUrl override: ${val}`);
    }
  });

  applyParam("lowMemory", (val) => {
    clientConfig.lowMemory = val === "1";
  });

  // Make config adjustments now before they could be overridden with even
  // more specific URL params.
  adjustConfigForLowMemory(clientConfig);

  applyParam("resourceCapacityScale", (val) => {
    const scale = parseFloat(val);
    if (isNaN(scale) || scale < 0) {
      log.error(`Invalid value ${val} for resourceCapacityScale.`);
    } else {
      scaleResourceCapacity(clientConfig, scale);
    }
  });
  applyParam("forceDrawDistance", (val) => {
    const forceDrawDistance = parseInt(val);
    if (isNaN(forceDrawDistance) || forceDrawDistance < 0) {
      log.error(`Invalid value ${val} for forceDrawDistance.`);
    } else {
      clientConfig.forceDrawDistance = forceDrawDistance;
    }
  });
  applyParam("minDrawDistance", (val) => {
    const minDrawDistance = parseInt(val);
    if (isNaN(minDrawDistance) || minDrawDistance < 0) {
      log.error(`Invalid value ${val} for minDrawDistance.`);
    } else {
      clientConfig.minDrawDistance = minDrawDistance;
    }
  });
  applyParam("dynamicMinDrawDistance", (val) => {
    const dynamicMinDrawDistance = parseInt(val);
    if (isNaN(dynamicMinDrawDistance) || dynamicMinDrawDistance < 0) {
      log.error(`Invalid value ${val} for dynamicMinDrawDistance.`);
    } else {
      clientConfig.dynamicMinDrawDistance = dynamicMinDrawDistance;
    }
  });
  applyParam("forceRenderScale", (val) => {
    const forceRenderScale = parseFloat(val);
    if (isNaN(forceRenderScale) || forceRenderScale < 0) {
      log.error(`Invalid value ${val} for forceRenderScale.`);
    } else {
      clientConfig.forceRenderScale = forceRenderScale;
    }
  });
  applyParam("forceGraphicsQuality", (val) => {
    const parsed = zGraphicsQuality.safeParse(val);
    if (!parsed.success) {
      log.error(`Invalid value ${val} for forceGraphicsQuality.`);
    } else {
      clientConfig.forceGraphicsQuality = parsed.data;
    }
  });
  applyParam("prodSync", (val) => {
    clientConfig.useProdSync = val === "1";
  });
  applyParam("dev", (val) => {
    clientConfig.dev = val === "1";
  });
  applyParam("hideChrome", (val) => {
    clientConfig.hideChrome = val === "1";
  });
  applyParam("useWorker", (val) => {
    clientConfig.useWorker = val === "1";
  });

  applyParam("forceCharacterSetup", (val) => {
    clientConfig.forceCharacterSetup = val === "1";
  });

  applyParam("skipBikkieReactInvalidate", (val) => {
    clientConfig.skipBikkieReactInvalidate = val === "1";
  });

  applyParam("wasmMemoryTracing", (val) => {
    // Tracing won't work in release mode, so force us into the next fastest
    // mode that supports tracing.
    clientConfig.wasmMemoryTracing = val === "1";
  });
  applyParam("wasmSimd", (val) => {
    ok(includes(WasmSimd, val), `Invalid wasm SIMD: '${val}'`);
    clientConfig.wasmBinary.simd = val as WasmSimd;
  });
  applyParam("artificialLagMs", (val) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      log.error(`Invalid artificial lag: '${val}'`);
    } else {
      clientConfig.artificialLagMs = {
        mean: num,
        // Make sure ~95% of samples fall within 50% of the mean.
        variance: (num / 6) ** 2,
      };
    }
  });
  applyParam("idb", (val) => {
    clientConfig.useIdbForEcs = val === "1";
  });
  applyParam("gpuTier", (val) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      log.error(
        `Invalid value, ${val}, for gpuTier parameter. Must be a non-negative number.`
      );
    } else {
      clientConfig.gpuTier = num;
    }
  });
  applyParam("allowSoftwareWebGL", (val) => {
    clientConfig.allowSoftwareWebGL = val === "1";
  });
}

export function doBrowserOverrides(ret: ClientConfig) {
  const uaParser = new UAParser(window.navigator.userAgent);
  const deviceType = uaParser.getDevice().type?.toLowerCase();
  const osName = uaParser.getOS().name?.toLowerCase() ?? "";
  const mobileDevice = isMobileDeviceDescription({ deviceType, osName });
  ret.mobileDevice = mobileDevice;

  ret.showVirtualJoystick = shouldShowVirtualJoystick({
    pointerLockSupported: supportsPointerLock(),
    touchDevice: isTouchDevice(),
    deviceType,
    osName,
  });

  if (mobileDevice) {
    log.info("Mobile device detected, forcing low memory config.");
    ret.lowMemory = true;

    // HARTHMERE_MOBILE_DEVICE_PROFILE (2026-08-04 mobile audit, items 3 and 9).
    //
    // This used to be a flat `ret.forceRenderScale = 0.5`. That kept phones at
    // half resolution from the first frame, which was the right instinct --
    // the phone WebContent process shares its budget with JS, WASM, decoded
    // assets, render targets and iframe/media overhead, so it must not
    // allocate full-size targets before dynamic quality has samples. But
    // `forceRenderScale` short-circuits `computeRenderScale` *before* the
    // `dynamic` branch, so it also disabled the entire adaptive ladder on
    // phones: a struggling device could never reach 0.3, and a fast device
    // could never climb.
    //
    // Now the phone is classified once and the ladder is handed a clamped
    // range. The `standard` class starts at exactly 0.5 / 64m -- the profile
    // validated on the physical iPhone 12 mini -- so nothing starts anywhere
    // new. An explicit `forceRenderScale` URL parameter still wins below,
    // because `doURLOverrides` runs after this and diagnostics must stay
    // authoritative.
    const deviceClass = classifyMobileDevice(
      readMobileDeviceSignals(ret.gpuTier)
    );
    ret.mobileDeviceClass = deviceClass;
    ret.mobileGraphicsClamps = mobileGraphicsClampsForClass(deviceClass);
    log.info(
      `Mobile graphics profile: ${JSON.stringify({
        deviceClass,
        clamps: ret.mobileGraphicsClamps,
      })}`
    );

    // The 128m Harthmere landmark floor is useful on desktop, but it prevents
    // dynamic graphics from reaching its 64m emergency target on iOS/Android.
    // Mobile Safari can otherwise spend startup continuously building and
    // evicting distant terrain meshes while the loading screen remains up.
    // URL overrides are applied after this, so an explicit diagnostic value
    // still wins when a test intentionally requests one.
    if (ret.dynamicMinDrawDistance !== undefined) {
      log.info(
        "Mobile device detected, allowing dynamic draw distance below the desktop Harthmere floor."
      );
      ret.dynamicMinDrawDistance = undefined;
    }
  }

  if (ret.showVirtualJoystick) {
    log.info("Touch/mobile controls detected, forcing virtual joystick.");
  }

  const browserName = uaParser.getBrowser().name?.toLowerCase() ?? "";
  if (browserName.includes("firefox")) {
    ret.unsupportedBrowser = true;
  }

  if (browserName.includes("safari")) {
    // At the time of this change, Safari (16.5) seems to have some bugs when
    // interpreting SIMD instructions.
    //   https://linear.app/ill-inc/issue/GI-3562/terrain-collisions-arent-working-on-safari
    ret.wasmBinary.simd = WasmSimd.Normal;
  }
}

export function isMobileDeviceDescription({
  deviceType,
  osName,
}: {
  deviceType?: string;
  osName?: string;
}) {
  const normalizedDeviceType = deviceType?.toLowerCase();
  const normalizedOsName = osName?.toLowerCase() ?? "";
  return (
    normalizedDeviceType === "mobile" ||
    normalizedDeviceType === "tablet" ||
    normalizedOsName.includes("android") ||
    normalizedOsName.includes("ios") ||
    normalizedOsName.includes("ipad") ||
    normalizedOsName.includes("iphone")
  );
}

export function shouldShowVirtualJoystick({
  pointerLockSupported,
  touchDevice,
  deviceType,
  osName,
}: {
  pointerLockSupported: boolean;
  touchDevice: boolean;
  deviceType?: string;
  osName?: string;
}) {
  // Pointer Lock availability is an input-capture capability, not a device
  // class. Desktop embeds and headless/managed browsers can lack Pointer Lock
  // while still using mouse and keyboard. BiomesView already supports that
  // pointerless desktop path; mounting the touch HUD here would also switch the
  // hotbar, prompts, crouch button, and Menu/Recipes controls to mobile mode.
  void pointerLockSupported;
  const normalizedDeviceType = deviceType?.toLowerCase();
  const normalizedOsName = osName?.toLowerCase() ?? "";
  return (
    touchDevice ||
    isMobileDeviceDescription({
      deviceType: normalizedDeviceType,
      osName: normalizedOsName,
    })
  );
}

export const DETECT_GPU_BENCHMARK_VERSION = "5.0.28";
export const GPU_BENCHMARKS_URL = `/assets/glitch/gpu-benchmarks/detect-gpu-${DETECT_GPU_BENCHMARK_VERSION}`;
export const DESKTOP_GPU_TIERS = [
  0, // Tier 0: unsupported.
  10, // Tier 1: low end but supported.
  60, // Tier 2: mid range.
  400, // Tier 3: high end.
] as const;

type GpuTierDetector = (options?: GetGPUTier) => Promise<TierResult>;

export async function genGPUTier(detector?: GpuTierDetector) {
  // `detect-gpu` reads `window.navigator` while its module is imported. Keep
  // that browser-only dependency out of server/test module initialization.
  const getGPUTier = detector ?? (await import("detect-gpu")).getGPUTier;
  return getGPUTier({
    // Glitch production is served from Azure with GCP disabled. Keep the
    // complete, version-matched detector data on the game origin so iframe
    // classification never depends on cross-origin CORS or a cloud service.
    benchmarksURL: GPU_BENCHMARKS_URL,
    // Match the renderer's hardware-acceleration requirement. A software-only
    // context must not be mistaken for a supported low-end GPU.
    failIfMajorPerformanceCaveat: true,
    desktopTiers: [...DESKTOP_GPU_TIERS],
  });
}

// HARTHMERE_RUNTIME_SYNC_BASE_URL
// Resolve the sync base URL at runtime instead of trusting a build-time
// NEXT_PUBLIC_GLITCH_SYNC_BASE_URL value. The previous code blindly used the
// build-time env, which means a stale `.env.local` (e.g. one left over from a
// deploy session pointing at an Azure container app URL) could make a local
// Glitch playboot try to connect a WebSocket to a remote prod host. That fails
// with ERR_CONNECTION_RESET and the player never reaches in-game.
//
// Rules:
//   - If `install_id` is in window.location.search, the page is a local
//     Glitch playboot. The sync server is co-located with the web server on
//     the host the page was served from.
//   - In that case, only honor `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` if its
//     hostname matches the current origin (or is localhost/127.0.0.1).
//     Otherwise fall back to the same-host port mapping.
//   - Logs the resolved URL so the E2E test can verify the host is local.
export function resolveGlitchLocalSyncBaseUrl(input: {
  installIdInUrl: boolean;
  runtimeOverride?: string;
  explicit: string | undefined;
  protocol: string;
  hostname: string;
  port: string;
  href: string;
}): { syncBaseUrl: string; reason: string; fallback: string } {
  const isLocalHost = (host: string) =>
    host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";

  const sameOriginBase = `${input.protocol}//${input.hostname}${
    input.port ? `:${input.port}` : ""
  }`;

  const publicHttpsInstallRuntime =
    input.installIdInUrl &&
    input.protocol === "https:" &&
    !isLocalHost(input.hostname);

  // Current Harthmere web ingress proxies /sync, /beta-sync, and /ro-sync in
  // every supported environment. Falling back to a guessed legacy port (or to
  // api*.biomes.gg) can silently join the wrong world. Fail closed to the page
  // origin; focused tests may still provide a trusted same-host direct port.
  const fallback = sameOriginBase;

  // HARTHMERE_PROD_SAME_ORIGIN_SYNC_PROXY
  // Azure Container Apps reliably exposes the web ingress over the normal
  // HTTPS origin, but the browser cannot assume an external :4900 WebSocket
  // listener is reachable. In an install_id iframe served over public HTTPS,
  // force same-origin WebSockets and let the web process proxy /ro-sync,
  // /beta-sync, and /sync to the local sync process inside the container.
  if (publicHttpsInstallRuntime) {
    return {
      syncBaseUrl: sameOriginBase,
      reason: "public_https_install_runtime_using_same_origin_ws_proxy",
      fallback,
    };
  }

  // Focused native-ECS browser tests append an explicit `syncBaseUrl` query
  // after the production bundle has already been built. Honor that runtime
  // value only when it still points at this host (or another loopback spelling).
  // This prevents a stale Azure NEXT_PUBLIC value from mixing a local web/API
  // session with a remote world, while keeping arbitrary public query strings
  // from redirecting normal players to an untrusted sync server.
  if (input.runtimeOverride) {
    try {
      const overrideUrl = new URL(input.runtimeOverride, input.href);
      const overrideIsLocal =
        overrideUrl.hostname === input.hostname ||
        isLocalHost(overrideUrl.hostname);
      if (overrideIsLocal) {
        return {
          syncBaseUrl: overrideUrl.toString().replace(/\/$/, ""),
          reason: "trusted_runtime_e2e_override",
          fallback,
        };
      }
      return {
        syncBaseUrl: fallback,
        reason: "runtime_e2e_override_is_remote",
        fallback,
      };
    } catch {
      return {
        syncBaseUrl: fallback,
        reason: "runtime_e2e_override_unparseable",
        fallback,
      };
    }
  }

  if (!input.explicit) {
    return {
      syncBaseUrl: fallback,
      reason: "no_explicit_value_using_same_host_fallback",
      fallback,
    };
  }

  let explicitUrl: URL;
  try {
    explicitUrl = new URL(input.explicit, input.href);
  } catch {
    return {
      syncBaseUrl: fallback,
      reason: "explicit_value_unparseable_using_fallback",
      fallback,
    };
  }

  const explicitHost = explicitUrl.hostname;
  const explicitIsLocal =
    explicitHost === input.hostname || isLocalHost(explicitHost);

  if (input.installIdInUrl && !explicitIsLocal) {
    return {
      syncBaseUrl: fallback,
      reason: "explicit_points_to_remote_but_install_id_local",
      fallback,
    };
  }

  return {
    syncBaseUrl: input.explicit,
    reason: explicitIsLocal
      ? "explicit_is_local"
      : "explicit_no_install_id_override",
    fallback,
  };
}

export function shouldResolveGlitchLocalSyncBaseUrl(input: {
  isGlitchLocalRuntime: boolean;
  nativeEcsE2E: boolean;
}): boolean {
  return input.isGlitchLocalRuntime || input.nativeEcsE2E;
}

export function isLocalGameHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  ) {
    return true;
  }
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export async function initializeClientConfig(
  options?: InitConfigOptions
): Promise<ClientConfig> {
  const webGpuSmoke =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("webgpuProbe") === "1";
  const [gpuTier, simdSupported, webGpu] = await Promise.all([
    genGPUTier(),
    simd(),
    probeWebGpuSupport({ smokeRender: webGpuSmoke }),
  ]);
  log.info(`GPU Tier Info is ${JSON.stringify(gpuTier)}`);

  makeCvalHook({
    path: ["game", "capabilities", "webgpu"],
    help: "WebGPU availability and optional Three.js smoke result.",
    collect: () => JSON.parse(JSON.stringify(webGpu)) as JSONable,
  });
  makeCvalHook({
    path: ["game", "capabilities", "gpu"],
    help: "Information about the client's GPU capabilities.",
    collect: () => {
      return gpuTier;
    },
  });
  makeCvalHook({
    path: ["game", "capabilities", "simdSupported"],
    help: "Does the client support SIMD instructions.",
    collect: () => simdSupported,
  });

  const ret = cloneDeep(BASE_CLIENT_CONFIG);

  ret.primaryCTA = options?.primaryCTA;
  ret.displayName = options?.displayName;

  // HARTHMERE_RUNTIME_SYNC_BASE_URL
  // Docker runs Biomes with NODE_ENV=production, but local Glitch play must
  // not connect to wss://api*.biomes.gg or to a stale Azure host that leaked
  // into NEXT_PUBLIC_GLITCH_SYNC_BASE_URL via .env.local. Force the browser
  // to local sync whenever install_id is present in the URL.
  const installIdInUrl =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("install_id");
  const runtimeQuery =
    typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search);
  const nativeEcsE2E = runtimeQuery?.get("harthmere_native_ecs_e2e") === "1";

  const isGlitchLocalRuntime =
    process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    installIdInUrl ||
    (typeof window !== "undefined" &&
      isLocalGameHostname(window.location.hostname));

  if (
    shouldResolveGlitchLocalSyncBaseUrl({
      isGlitchLocalRuntime,
      nativeEcsE2E,
    }) &&
    typeof window !== "undefined"
  ) {
    // Harthmere is an open, landmark-driven world. Let dynamic graphics reduce
    // CPU-heavy terrain + sync distance under load while retaining a useful
    // landmark radius instead of collapsing to the 64m mobile emergency view.
    // Explicit low/safe user choices can still stay low; minDrawDistance remains
    // available as the hard URL/config override when that is wanted.
    ret.dynamicMinDrawDistance = HARTHMERE_DESKTOP_DYNAMIC_MIN_DRAW_DISTANCE;

    const resolved = resolveGlitchLocalSyncBaseUrl({
      installIdInUrl,
      runtimeOverride: nativeEcsE2E
        ? (runtimeQuery?.get("syncBaseUrl") ?? undefined)
        : undefined,
      explicit: process.env.NEXT_PUBLIC_GLITCH_SYNC_BASE_URL,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
      href: window.location.href,
    });

    ret.syncBaseUrl = resolved.syncBaseUrl;

    // Plain string in the message so the E2E test can grep for it without
    // unwrapping puppeteer's JSHandle@object boxing of the second arg.
    // eslint-disable-next-line no-console
    console.info(
      `HARTHMERE_SYNC_URL_RESOLVED syncBaseUrl=${resolved.syncBaseUrl} reason=${resolved.reason} fallback=${resolved.fallback} hostname=${window.location.hostname} port=${window.location.port} installIdInUrl=${installIdInUrl}`
    );
  }

  if (process.env.NODE_ENV !== "production") {
    // Enable "dev" mode by default if we're connecting to localhost.
    ret.syncBaseUrl = `http://${window.location.hostname ?? "127.0.0.1"}:${
      process.env.SYNC_PORT
    }/`;
    ret.dev = true;
  }
  ret.lowMemory = !!options?.forceLowMemory;
  ret.startCoordinates = options?.startCoordinates;
  ret.startOrientation = options?.startOrientation;
  ret.initialObserverMode = options?.observerMode;
  ret.allowSoftwareWebGL = options?.allowSoftwareWebGL ?? false;

  ret.gpuTier = gpuTier.tier;
  ret.gpuName = gpuTier.gpu || "Unknown";
  ret.webGpu = webGpu;
  ret.wasmBinary.simd = simdSupported ? WasmSimd.Simd : WasmSimd.Normal;
  ret.sharedArrayBufferSupported = window.crossOriginIsolated;

  doBrowserOverrides(ret);
  doURLOverrides(ret);

  log.info(
    `Selected Graphics Tier is ${JSON.stringify({
      detectedTier: gpuTier.tier,
      selectedTier: ret.gpuTier,
      detectionType: gpuTier.type,
      gpu: ret.gpuName,
    })}`
  );

  makeCvalHook({
    path: ["game", "capabilities", "gpuTier"],
    help: "The GPU tier used by this client, affected by URL parameters.",
    collect: () => {
      return ret.gpuTier;
    },
  });
  makeCvalHook({
    path: ["game", "capabilities", "simd"],
    help: "True if the client is using the simd wasm.",
    collect: () => (ret.wasmBinary.simd === WasmSimd.Simd ? true : false),
  });

  return ret;
}
