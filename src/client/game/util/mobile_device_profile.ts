// HARTHMERE_MOBILE_DEVICE_PROFILE (2026-08-04 mobile audit, items 3 and 9).
//
// Before this module every phone got byte-identical graphics settings: a hard
// `forceRenderScale = 0.5` pin plus a fixed 64m `veryLow` draw distance. Two
// things were wrong with that.
//
//  1. `forceRenderScale` short-circuits `computeRenderScale` *before* the
//     `dynamic` branch, so the whole `DynamicSettingsUpdater` ladder was
//     bypassed on phones. A phone still over budget at 0.5 could not fall to
//     the 0.3 target the ladder exists to reach, and a phone with headroom
//     could never climb. That is exactly the failure mode finding 13 of the
//     2026-08-03 render audit fixed for desktop ("a struggling client had no
//     lever at all"), reintroduced for the device class that needs it most.
//  2. An iPhone 15 Pro and a 2 GB Android were treated identically, because
//     the only device signal consulted was the user agent.
//
// So: classify the phone once at boot, then hand the dynamic ladder a clamped
// range instead of a fixed pin. The *starting* values for the middle class are
// deliberately identical to the old hard pin (0.5 render scale / 64m), which
// is the profile validated on the physical iPhone 12 mini -- this change can
// therefore only make a phone session better or leave it where it was, never
// start it somewhere new and unvalidated.
//
// Nothing in this module is consulted unless `mobileDevice` is true. Desktop
// render scale, draw distance, and the dynamic ladder are untouched.

/**
 * How much graphics budget we think this phone can carry.
 *
 * - `constrained`: low RAM or few cores, or a GPU the mobile benchmark set
 *   ranks at the bottom. Starts below today's profile.
 * - `standard`: the validated iPhone-12-mini-class default. Starts exactly at
 *   today's profile.
 * - `capable`: recent flagship. Allowed to climb, but never past a ceiling
 *   that would reintroduce the WebContent memory high-water problem.
 */
export type MobileDeviceClass = "constrained" | "standard" | "capable";

export interface MobileDeviceSignals {
  /**
   * `navigator.deviceMemory`, in GiB. Chrome/Android only -- iOS Safari does
   * not implement it, which is why it can only ever *downgrade* a device here
   * and never gate an upgrade.
   */
  deviceMemoryGb?: number;
  /** `navigator.hardwareConcurrency`. Widely available, including iOS. */
  hardwareConcurrency?: number;
  /**
   * The `detect-gpu` tier. This is the strongest signal we already collect:
   * since the 2026-08-03 remediation the client ships the complete 5.0.28
   * benchmark set, which includes the mobile GPU datasets.
   */
  gpuTier?: number;
}

export interface MobileGraphicsClamps {
  /** Lower bound the dynamic ladder may reduce render scale to. */
  minRenderScale: number;
  /** Upper bound the dynamic ladder may raise render scale to. */
  maxRenderScale: number;
  /** Render scale used before the ladder has enough samples to decide. */
  startRenderScale: number;
  /** Lower bound the dynamic ladder may reduce draw distance to, in metres. */
  minDrawDistance: number;
  /** Upper bound the dynamic ladder may raise draw distance to, in metres. */
  maxDrawDistance: number;
  /** Draw distance used before the ladder has enough samples to decide. */
  startDrawDistance: number;
}

// Below these the device is treated as constrained regardless of GPU tier.
// 3 GiB and 4 cores are the boundaries where the 128 MB Voxeloo reservation
// plus decoded assets stops leaving useful headroom in a phone browser
// process.
const CONSTRAINED_DEVICE_MEMORY_GB = 3;
const CONSTRAINED_HARDWARE_CONCURRENCY = 4;

// detect-gpu tier 3 against the *mobile* benchmark set means a recent
// flagship-class GPU, not a desktop-class one.
const CAPABLE_GPU_TIER = 3;

/**
 * Classify a phone from the signals available in the browser.
 *
 * The rule is deliberately asymmetric: RAM/core signals may only *downgrade*
 * a device, because `deviceMemory` is missing on iOS entirely and a missing
 * signal must never be read as "this device is weak". GPU tier is the only
 * thing that can promote a device to `capable`.
 */
export function classifyMobileDevice(
  signals: MobileDeviceSignals
): MobileDeviceClass {
  const constrainedByMemory =
    typeof signals.deviceMemoryGb === "number" &&
    Number.isFinite(signals.deviceMemoryGb) &&
    signals.deviceMemoryGb > 0 &&
    signals.deviceMemoryGb <= CONSTRAINED_DEVICE_MEMORY_GB;
  const constrainedByCores =
    typeof signals.hardwareConcurrency === "number" &&
    Number.isFinite(signals.hardwareConcurrency) &&
    signals.hardwareConcurrency > 0 &&
    signals.hardwareConcurrency <= CONSTRAINED_HARDWARE_CONCURRENCY;
  // Tier 0 is "unsupported/unclassified" rather than "slow", so only an
  // explicit tier 1 counts as a weak GPU here.
  const constrainedByGpu = signals.gpuTier === 1;

  if (constrainedByMemory || constrainedByCores || constrainedByGpu) {
    return "constrained";
  }
  if (
    typeof signals.gpuTier === "number" &&
    signals.gpuTier >= CAPABLE_GPU_TIER
  ) {
    return "capable";
  }
  return "standard";
}

// The ranges below are intentionally conservative at the top end. The physical
// iPhone sessions that produced JETSAM_REASON_MEMORY_HIGHWATER were running a
// 96m draw radius; nothing here is allowed to reach that again, because draw
// distance drives retained terrain meshes and therefore WebContent footprint,
// not just frame time. Render scale is the cheap lever (it costs render-target
// pixels, which are freed on resize), so it gets the wider range.
const MOBILE_GRAPHICS_CLAMPS: Record<MobileDeviceClass, MobileGraphicsClamps> =
  {
    constrained: {
      minRenderScale: 0.3,
      maxRenderScale: 0.5,
      startRenderScale: 0.4,
      minDrawDistance: 48,
      maxDrawDistance: 64,
      startDrawDistance: 48,
    },
    standard: {
      // Identical starting point to the retired hard pin. A `standard` phone
      // therefore begins exactly where the validated build began and only
      // moves once the ladder has real samples.
      minRenderScale: 0.3,
      maxRenderScale: 0.7,
      startRenderScale: 0.5,
      minDrawDistance: 48,
      maxDrawDistance: 80,
      startDrawDistance: 64,
    },
    capable: {
      minRenderScale: 0.35,
      maxRenderScale: 0.8,
      startRenderScale: 0.6,
      minDrawDistance: 48,
      maxDrawDistance: 96,
      startDrawDistance: 64,
    },
  };

export function mobileGraphicsClampsForClass(
  deviceClass: MobileDeviceClass
): MobileGraphicsClamps {
  return { ...MOBILE_GRAPHICS_CLAMPS[deviceClass] };
}

export function mobileGraphicsClampsForSignals(
  signals: MobileDeviceSignals
): MobileGraphicsClamps {
  return mobileGraphicsClampsForClass(classifyMobileDevice(signals));
}

/** Read the device signals from `navigator`, tolerating every absence. */
export function readMobileDeviceSignals(gpuTier?: number): MobileDeviceSignals {
  if (typeof navigator === "undefined") {
    return { gpuTier };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  return {
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    gpuTier,
  };
}

/**
 * Clamp a candidate value into an inclusive range.
 *
 * Exported because both the initial resource generation and the dynamic
 * updater must apply the *same* clamp; if only one of them did, the ladder
 * would keep proposing values the other silently rejected and the change
 * counters would log churn that never took effect.
 */
export function clampToRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
