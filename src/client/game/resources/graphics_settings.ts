import type { ClientContext } from "@/client/game/context";

import type { MobileGraphicsClamps } from "@/client/game/util/mobile_device_profile";
import { clampToRange } from "@/client/game/util/mobile_device_profile";
import type {
  ClientResourceDeps,
  ClientResources,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import type {
  ComputedRenderScale,
  DrawDistance,
  EntityDrawLimit,
  GraphicsQuality,
  PostprocessAA,
  PostprocessDebug,
  PostprocessSSAO,
  RenderScale,
  TypesafeLocalStorageSchema,
} from "@/client/util/typed_local_storage";
import {
  addTypedStorageChangeListener,
  getTypedStorageItem,
  removeTypedStorageChangeListener,
} from "@/client/util/typed_local_storage";
import { makeDisposable } from "@/shared/disposable";
import type { RegistryLoader } from "@/shared/registry";
import { assertNever } from "@/shared/util/type_helpers";
import { omitBy } from "lodash";

const LISTEN_SETTINGS: (keyof TypesafeLocalStorageSchema)[] = [
  "settings.graphics.renderScale",
  "settings.graphics.quality",
  "settings.graphics.postprocessing.aa",
  "settings.graphics.postprocessing.bloom",
  "settings.graphics.postprocessing.ssao",
  "settings.graphics.waterReflection",
  "settings.graphics.postprocessing.debug",
  "settings.graphics.drawDistance",
  "settings.graphics.entityDrawLimit",
  "settings.graphics.depthPrePass",
];

type LiteralPostProcesses = {
  bloom?: boolean;
  aa?: PostprocessAA;
  ssao?: PostprocessSSAO;
  debug?: PostprocessDebug;
  waterReflection?: boolean;
};

export type LiteralGraphicsSettings = {
  quality?: GraphicsQuality;
  renderScale?: RenderScale;
  entityDrawLimit?: EntityDrawLimit;
  drawDistance?: DrawDistance;
  postprocesses?: LiteralPostProcesses;
  floraQuality?: "low" | "high";
};

export type ResolvedGraphicsSettings = Required<LiteralGraphicsSettings> & {
  postprocesses: Required<LiteralPostProcesses>;
};

export type ComputedGraphicsSettings = {
  renderScale: ComputedRenderScale;
  entityDrawLimit: number;
  drawDistance: "dynamic" | number;
  postprocesses: Required<LiteralPostProcesses>;
  floraQuality: "low" | "high";
};

export type DynamicGraphicsSettings = Omit<
  ComputedGraphicsSettings,
  "renderScale" | "drawDistance"
> & {
  renderScale: number;
  drawDistance: number;
};

export function drawLimitValueWithTweak(
  resources: ClientResources,
  tweakValue: number
) {
  // This function is a bit of a hack to make it so that graphics settings
  // aren't invalidated every time tweaks change.
  const useTweak =
    resources.get("/settings/graphics/resolved").entityDrawLimit === "tweaks";
  return useTweak
    ? tweakValue
    : resources.get("/settings/graphics/dynamic").entityDrawLimit;
}

function genGraphicsSettingsLiteral(
  context: ClientContext,
  _deps: ClientResourceDeps
): LiteralGraphicsSettings {
  // Raw user settings, with defaults.
  const cleanups: (() => void)[] = [];
  const settingChangedCb = () =>
    context.resources.invalidate("/settings/graphics/literal");
  for (const setting of LISTEN_SETTINGS) {
    addTypedStorageChangeListener(setting, settingChangedCb);
    cleanups.push(() => {
      removeTypedStorageChangeListener(setting, settingChangedCb);
    });
  }
  const dispose = () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
  return makeDisposable(
    {
      quality: getTypedStorageItem("settings.graphics.quality") ?? undefined,
      renderScale:
        getTypedStorageItem("settings.graphics.renderScale") ?? undefined,
      entityDrawLimit:
        getTypedStorageItem("settings.graphics.entityDrawLimit") ?? undefined,
      drawDistance:
        getTypedStorageItem("settings.graphics.drawDistance") ?? undefined,
      postprocesses: {
        bloom:
          getTypedStorageItem("settings.graphics.postprocessing.bloom") ??
          undefined,
        aa:
          getTypedStorageItem("settings.graphics.postprocessing.aa") ??
          undefined,
        ssao:
          getTypedStorageItem("settings.graphics.postprocessing.ssao") ??
          undefined,
        waterReflection:
          getTypedStorageItem("settings.graphics.waterReflection") ?? undefined,
        debug:
          getTypedStorageItem("settings.graphics.postprocessing.debug") ??
          undefined,
      },
    },
    dispose
  );
}

function genGraphicsSettingsResolved(
  context: ClientContext,
  deps: ClientResourceDeps
): ResolvedGraphicsSettings {
  // Resolves user settings, which represents
  // inferred settings that a user could conceivably set themselves
  const literal = deps.get("/settings/graphics/literal");
  const quality = graphicsQualityForDevice({
    mobileDevice: context.clientConfig.mobileDevice,
    forcedQuality: context.clientConfig.forceGraphicsQuality,
    storedQuality: literal.quality,
  });
  // Dynamic render scale no longer requires a GPU timer -- see
  // HARTHMERE_DYNAMIC_RENDER_SCALE_WITHOUT_GPU_TIMER in computeRenderScale. The
  // old `{ kind: "resolution", res: [3840, 2160] }` fallback on `high` was
  // especially damaging: a client with no timer extension rendered at a fixed 4K
  // internal resolution for the entire session with no way to back off.
  const gpuTier = context.clientConfig.gpuTier;

  // Easy presets
  if (quality === "low") {
    return {
      quality: "low",
      renderScale: { kind: "dynamic" },
      entityDrawLimit: "low",
      // HARTHMERE_MOBILE_DYNAMIC_LADDER (2026-08-04 mobile audit, item 3).
      //
      // Desktop `low` keeps its fixed 96m: it is an explicit user choice and
      // must stay predictable. Phones instead go `dynamic` so the adaptive
      // ladder can move draw distance between the clamps in
      // `mobileGraphicsClamps`. The starting value is still 64m (see
      // `defaultDynamicDrawDistance` / `startDrawDistance`), so a phone begins
      // exactly where the old fixed `veryLow` tier put it.
      drawDistance: mobileDynamicDrawDistanceEnabled(context)
        ? "dynamic"
        : lowQualityDrawDistanceForDevice(context.clientConfig.mobileDevice),
      floraQuality: "low",
      postprocesses: {
        bloom: false,
        aa: "none",
        ssao: "none",
        waterReflection: false,
        debug: "none",
      },
    };
  }

  if (quality === "high") {
    return {
      quality: "high",
      renderScale: { kind: "dynamic" },
      entityDrawLimit: "high",
      drawDistance: "high",
      floraQuality: "high",
      postprocesses: {
        bloom: true,
        aa: "smaa",
        ssao: "ssao",
        waterReflection: true,
        debug: "none",
      },
    };
  }

  if (quality === "safeMode") {
    // Turn everything to the lowest settings and don't use dynamic adjustments.
    return {
      quality: "safeMode",
      renderScale: { kind: "scale", scale: 0.3 },
      entityDrawLimit: "low",
      drawDistance: "veryLow",
      floraQuality: "low",
      postprocesses: {
        bloom: false,
        aa: "none",
        ssao: "none",
        waterReflection: false,
        debug: "none",
      },
    };
  }

  // Auto presets.
  const autoQuality: ResolvedGraphicsSettings = {
    quality: "auto",
    renderScale: { kind: "dynamic" },
    entityDrawLimit: "auto",
    drawDistance: "dynamic",
    floraQuality: gpuTier > 2 ? "high" : "low",
    postprocesses: {
      bloom: gpuTier > 2,
      aa: gpuTier > 2 ? "smaa" : "none",
      ssao: gpuTier > 2 ? "ssao" : "none",
      waterReflection: gpuTier > 2,
      debug: "none",
    },
  };
  if (quality === "auto" || quality === undefined) {
    return autoQuality;
  }

  // Should only be custom beyond this point
  // Custom settings overwrite any auto settings
  if (quality !== "custom") {
    assertNever(quality);
  }
  const customQuality: ResolvedGraphicsSettings = {
    ...autoQuality,
    ...omitBy(literal, (v) => v === undefined),
    quality: "custom",
  };
  return customQuality;
}

/**
 * HARTHMERE_MOBILE_DYNAMIC_LADDER (2026-08-04 mobile audit, item 3).
 *
 * True only for a phone that carries a device profile. Kept as one predicate
 * so every site that has to distinguish "phone with clamps" from "desktop"
 * cannot drift apart. `safeMode` deliberately does not qualify: it is the
 * explicit escape hatch and must stay fixed and cheap.
 */
function mobileDynamicDrawDistanceEnabled(context: ClientContext) {
  return (
    context.clientConfig.mobileDevice &&
    context.clientConfig.mobileGraphicsClamps !== undefined &&
    context.clientConfig.forceDrawDistance === undefined
  );
}

export function lowQualityDrawDistanceForDevice(
  mobileDevice: boolean
): DrawDistance {
  // The desktop low preset keeps enough range for landmarks and mouse-driven
  // traversal. On a phone, 96m still makes Mobile Safari build and retain more
  // terrain than the 128 MB startup profile is intended to support. Keep the
  // phone preset at the existing very-low 64m tier; explicit URL diagnostics
  // continue to win by selecting a forced quality or forceDrawDistance.
  return mobileDevice ? "veryLow" : "low";
}

export function graphicsQualityForDevice({
  mobileDevice,
  forcedQuality,
  storedQuality,
}: {
  mobileDevice: boolean;
  forcedQuality?: GraphicsQuality;
  storedQuality?: GraphicsQuality;
}): GraphicsQuality {
  if (forcedQuality !== undefined) {
    return forcedQuality;
  }
  if (mobileDevice) {
    // Persisted desktop/high settings should never make a phone allocate the
    // high-quality postprocess chain. Preserve the even-cheaper safe mode,
    // while explicit URL diagnostics remain authoritative above.
    return storedQuality === "safeMode" ? "safeMode" : "low";
  }
  return storedQuality ?? "auto";
}

function genGraphicsSettingsComputed(
  context: ClientContext,
  deps: ClientResourceDeps
): ComputedGraphicsSettings {
  // Takes resolved render settings and translates them into more system-centric settings
  // i.e. resolves auto when applicable
  const resolvedSettings = deps.get("/settings/graphics/resolved");
  return {
    renderScale: computeRenderScale(context, resolvedSettings),
    entityDrawLimit: computeEntityDrawLimit(context, resolvedSettings),
    drawDistance: computeDrawDistance(context, resolvedSettings),
    postprocesses: resolvedSettings.postprocesses,
    floraQuality: resolvedSettings.floraQuality,
  };
}

function computeRenderScale(
  { rendererController, clientConfig }: ClientContext,
  resolved: ResolvedGraphicsSettings
): ComputedRenderScale {
  if (clientConfig.forceRenderScale !== undefined) {
    return { kind: "scale", scale: clientConfig.forceRenderScale };
  }

  if (resolved.renderScale.kind === "dynamic") {
    // HARTHMERE_DYNAMIC_RENDER_SCALE_WITHOUT_GPU_TIMER (2026-08-03 render perf
    // audit, finding 13).
    //
    // This used to require EXT_disjoint_timer_query_webgl2 and otherwise pin a
    // FIXED render scale for the whole session. That extension is routinely
    // unavailable in exactly the environments this game ships into -- embedded
    // iframes, hardened Chrome policies, VMs, many Linux/ANGLE configs -- so the
    // adaptive ladder never engaged for those players and a struggling client
    // stayed struggling for the entire session.
    //
    // `DynamicSettingsUpdater` already tolerates `gpuTimeMs === undefined`, and
    // `bottleneck()` now infers GPU pressure from render interval vs CPU time
    // when the timer is missing. So dynamic is always safe to select; it simply
    // adapts on a coarser signal. The tier-derived value below is still used as
    // the STARTING point via `genGraphicsSettingsDynamic`.
    return { kind: "dynamic" };
  } else if (resolved.renderScale.kind === "retina") {
    return { kind: "scale", scale: window.devicePixelRatio };
  } else if (resolved.renderScale.kind === "native") {
    return { kind: "scale", scale: 1.0 };
  }
  return resolved.renderScale;
}

export function initialDynamicRenderScaleForGpuTier(gpuTier: number) {
  if (gpuTier >= 3) {
    return 1.0;
  }
  if (gpuTier === 2) {
    return 0.8;
  }
  return 0.5;
}

const ENTITY_DRAW_LIMITS: {
  [key in Exclude<EntityDrawLimit, "auto" | "tweaks">]: number;
} = {
  low: 15,
  medium: 25,
  high: 35,
};

function computeEntityDrawLimit(
  { clientConfig }: ClientContext,
  resolved: ResolvedGraphicsSettings
) {
  if (
    resolved.entityDrawLimit === "auto" ||
    resolved.entityDrawLimit === "tweaks"
  ) {
    switch (clientConfig.gpuTier) {
      case 2:
        return ENTITY_DRAW_LIMITS["medium"];
      case 3:
        return ENTITY_DRAW_LIMITS["high"];
      default:
        return ENTITY_DRAW_LIMITS["low"];
    }
  }
  return ENTITY_DRAW_LIMITS[resolved.entityDrawLimit];
}

const DRAW_DISTANCES: {
  [key in Exclude<DrawDistance, "dynamic">]: number;
} = {
  veryLow: 64,
  low: 96,
  medium: 128,
  high: 256,
};

export function defaultDynamicDrawDistance(lowMemory: boolean) {
  // Low-memory mode is selected automatically for phones/tablets. Start at the
  // emergency target instead of waiting for 110 already-slow frames before the
  // dynamic updater is allowed to reduce terrain work.
  return lowMemory ? DRAW_DISTANCES.veryLow : DRAW_DISTANCES.low;
}

function computeDrawDistance(
  { clientConfig }: ClientContext,
  resolved: ResolvedGraphicsSettings
) {
  if (clientConfig.forceDrawDistance !== undefined) {
    return clientConfig.forceDrawDistance;
  }

  if (resolved.drawDistance === "dynamic") {
    return "dynamic";
  }
  return DRAW_DISTANCES[resolved.drawDistance];
}

export function applyMinimumDrawDistance(
  drawDistance: number,
  minDrawDistance: number | undefined
) {
  return Number.isFinite(minDrawDistance)
    ? Math.max(drawDistance, minDrawDistance as number)
    : drawDistance;
}

export function applyDrawDistanceFloors(
  drawDistance: number,
  options: {
    hardMinDrawDistance?: number;
    dynamicMinDrawDistance?: number;
    isDynamicDrawDistance: boolean;
  }
) {
  const hardFloored = applyMinimumDrawDistance(
    drawDistance,
    options.hardMinDrawDistance
  );
  return options.isDynamicDrawDistance
    ? applyMinimumDrawDistance(hardFloored, options.dynamicMinDrawDistance)
    : hardFloored;
}

function genGraphicsSettingsDynamic(
  context: ClientContext,
  deps: ClientResourceDeps
): DynamicGraphicsSettings {
  const computedSettings = deps.get("/settings/graphics/computed");
  const gpuTier = context.clientConfig.gpuTier;
  // HARTHMERE_MOBILE_DYNAMIC_LADDER: undefined on desktop, so every clamp
  // below is a no-op there.
  const mobileClamps = context.clientConfig.mobileGraphicsClamps;

  const rawRenderScale =
    computedSettings.renderScale.kind === "scale"
      ? computedSettings.renderScale.scale
      : (deps.get("/settings/graphics/dynamic_render_scale").value ??
        // On a phone the starting point comes from the device profile rather
        // than the desktop GPU-tier table, because the phone constraint is
        // process memory as much as GPU throughput.
        mobileClamps?.startRenderScale ??
        initialDynamicRenderScaleForGpuTier(gpuTier));
  const renderScale = applyMobileRenderScaleClamps(
    rawRenderScale,
    // An explicit diagnostic override must be honoured verbatim, including
    // values outside the profile range.
    context.clientConfig.forceRenderScale !== undefined
      ? undefined
      : mobileClamps
  );

  const isDynamicDrawDistance = computedSettings.drawDistance === "dynamic";
  const dynamicDrawDistance = isDynamicDrawDistance
    ? (() => {
        const value = deps.get(
          "/settings/graphics/dynamic_draw_distance"
        ).value;
        return typeof value === "number"
          ? value
          : (mobileClamps?.startDrawDistance ??
              defaultDynamicDrawDistance(context.clientConfig.lowMemory));
      })()
    : typeof computedSettings.drawDistance === "number"
      ? computedSettings.drawDistance
      : DRAW_DISTANCES.low;
  const flooredDrawDistance = applyDrawDistanceFloors(dynamicDrawDistance, {
    hardMinDrawDistance: context.clientConfig.minDrawDistance,
    dynamicMinDrawDistance: context.clientConfig.dynamicMinDrawDistance,
    isDynamicDrawDistance,
  });
  // The mobile ceiling is applied last and deliberately wins over the
  // `dynamicMinDrawDistance` floor: draw distance drives retained terrain
  // meshes, and the physical-iPhone jetsam sessions were all running the
  // longer radius. `forceDrawDistance`/`minDrawDistance` remain the explicit
  // escape hatches and are checked before the clamps are ever populated.
  const drawDistance = applyMobileDrawDistanceClamps(
    flooredDrawDistance,
    context.clientConfig.forceDrawDistance !== undefined
      ? undefined
      : mobileClamps
  );

  return {
    ...computedSettings,
    renderScale,
    drawDistance,
  };
}

/**
 * Clamp render scale into the phone's profile range. A `undefined` clamp set
 * (desktop, or an explicit URL override) returns the value untouched.
 */
export function applyMobileRenderScaleClamps(
  renderScale: number,
  clamps: MobileGraphicsClamps | undefined
) {
  if (!clamps) {
    return renderScale;
  }
  return clampToRange(
    renderScale,
    clamps.minRenderScale,
    clamps.maxRenderScale
  );
}

/**
 * Clamp draw distance into the phone's profile range. A `undefined` clamp set
 * (desktop, or an explicit URL override) returns the value untouched.
 */
export function applyMobileDrawDistanceClamps(
  drawDistance: number,
  clamps: MobileGraphicsClamps | undefined
) {
  if (!clamps) {
    return drawDistance;
  }
  return clampToRange(
    drawDistance,
    clamps.minDrawDistance,
    clamps.maxDrawDistance
  );
}

export function addGraphicsSettingsResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  // The graphics settings explicitly specified by the user's preferences.
  builder.add(
    "/settings/graphics/literal",
    loader.provide(genGraphicsSettingsLiteral)
  );
  // Graphics settings after all defaults are supplied for everything the user
  // didn't explicitly set.
  builder.add(
    "/settings/graphics/resolved",
    loader.provide(genGraphicsSettingsResolved)
  );
  // Graphics settings after all category enums have been converted to their
  // numerical values (e.g. "low" draw distance becomes 96m).
  builder.add(
    "/settings/graphics/computed",
    loader.provide(genGraphicsSettingsComputed)
  );
  // The final concrete current graphics settings, after dynamic runtime
  // changes are applied (e.g. render scale adjustments that depend on frame
  // rate). These are the final computed graphics settings and what most
  // consumers of graphics settings should be looking at.
  builder.add(
    "/settings/graphics/dynamic",
    loader.provide(genGraphicsSettingsDynamic)
  );
  // Referred to by "/settings/graphics/dynamic", expected to be set externally.
  builder.addGlobal("/settings/graphics/dynamic_render_scale", {
    value: undefined,
  });
  builder.addGlobal("/settings/graphics/dynamic_draw_distance", {
    value: undefined,
  });
}
