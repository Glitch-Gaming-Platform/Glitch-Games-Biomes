import { loadGltf, loadGltfWithRetry } from "@/client/game/util/gltf_helpers";
import { log } from "@/shared/logging";
import { Cval } from "@/shared/util/cvals";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// HARTHMERE_GLTF_PROTOTYPE_CACHE (2026-08-04 asset loading audit, finding 6)
//
// WHAT THIS FIXES
//
// `/scene/npc/mesh` is keyed by *entity id*, and three of its branches (boss
// visuals, muck creatures, snapshot Grove NPCs) called `loadGltf(url)` directly.
// Twenty muckers of the same species therefore ran twenty GLTFLoader passes over
// the same URL: twenty parses, twenty sets of BufferGeometry, twenty texture
// uploads, twenty copies of the animation clips. `alpha_mucker.glb` is 11.1 MB
// and `thaedryn_bellbound.glb` is 12.3 MB. The HTTP layer could serve the bytes
// from cache (the /buckets/* immutable header is correct), but parse cost and
// VRAM were paid every single time.
//
// The same pattern appears in the player/NPC clothing pipeline, where every
// wearer of a garment re-parsed the same GLB.
//
// WHY SHARING IS SAFE HERE
//
// None of these consumers render the loaded GLTF. They all treat it as a
// *prototype* and immediately clone it:
//
//   * `makeMixedNpcMesh` (resources/npcs.ts) does `SkeletonUtils.clone(...)`
//     plus `cloneMaterials(...)`, so each entity gets its own transforms,
//     skeleton and materials while sharing geometry.
//   * `loadHarthmerePlayerClothingModel` (resources/player_mesh.ts) clones
//     immediately as well.
//
// That is exactly the contract `/scene/npc_type_mesh` has always used. These
// three call sites simply bypassed it.
//
// THE RULES FOR CALLERS (enforced by review, and by the tests next to this file)
//
//  1. Never add a cached prototype to a scene. Clone it.
//  2. Never mutate a prototype after load. One-time preparation that is a
//     property of the *asset* (material replacement, frustum-cull defaults,
//     asset-version userData) belongs in `prepare`, which runs exactly once per
//     cache entry. Anything that varies per entity belongs on the clone.
//  3. Never dispose a prototype. Prototypes outlive individual entities by
//     design, and clones share their geometry -- disposing one would blank out
//     every live NPC using it. This cache deliberately holds strong references
//     and is not disposable, which matches the previous behaviour of these call
//     sites exactly (they returned plain, non-disposable GLTFs).
//
// FAILURES ARE NOT CACHED. A rejected load is evicted so a later frame can retry;
// the old code got a fresh attempt per entity and callers still depend on that
// to recover from a transient 5xx or an overloaded service-worker bridge.

const gltfPrototypeLoads = new Cval({
  path: ["assets", "gltfPrototypes", "loads"],
  help: "Number of distinct GLTF prototypes actually fetched and parsed.",
  initialValue: 0,
});

const gltfPrototypeHits = new Cval({
  path: ["assets", "gltfPrototypes", "hits"],
  help: "Number of GLTF prototype requests served from the shared cache (parse and GPU upload avoided).",
  initialValue: 0,
});

const gltfPrototypeFailures = new Cval({
  path: ["assets", "gltfPrototypes", "failures"],
  help: "Number of GLTF prototype loads that failed and were evicted so they can be retried.",
  initialValue: 0,
});

const gltfPrototypeResident = new Cval({
  path: ["assets", "gltfPrototypes", "resident"],
  help: "Number of GLTF prototypes currently resident in the shared cache.",
  initialValue: 0,
});

export interface SharedGltfOptions {
  /**
   * Distinguishes two preparations of the same URL. Entries are keyed by
   * `variant|url`, so a caller that needs differently prepared copies of one
   * asset gets its own entry instead of silently inheriting another caller's
   * preparation.
   */
  variant?: string;
  /**
   * Loader override. Defaults to `loadGltf`; pass `loadGltfWithRetry` bound with
   * the attempt policy a call site needs. Also the seam the tests use.
   */
  load?: (url: string) => Promise<GLTF>;
  /**
   * One-time, asset-level preparation. Runs once per cache entry, immediately
   * after the load resolves and before any caller sees the prototype.
   */
  prepare?: (gltf: GLTF) => void;
}

const prototypes = new Map<string, Promise<GLTF>>();

function cacheKey(url: string, variant: string | undefined) {
  return `${variant ?? "default"}|${url}`;
}

/**
 * Load a GLTF once per (variant, url) and share it as a clone-only prototype.
 *
 * @throws whatever the underlying loader threw; the failed entry is evicted
 * first so the next caller retries the network rather than re-throwing forever.
 */
export async function loadSharedGltf(
  url: string,
  options: SharedGltfOptions = {}
): Promise<GLTF> {
  const key = cacheKey(url, options.variant);
  const existing = prototypes.get(key);
  if (existing) {
    gltfPrototypeHits.value += 1;
    return existing;
  }

  gltfPrototypeLoads.value += 1;
  const load = options.load ?? loadGltf;
  const pending = (async () => {
    const gltf = await load(url);
    options.prepare?.(gltf);
    return gltf;
  })();
  prototypes.set(key, pending);
  gltfPrototypeResident.value = prototypes.size;

  try {
    return await pending;
  } catch (error) {
    // Evict, but only if we are still the owner of this key: a concurrent reset
    // (or a retry that already succeeded) must not be clobbered.
    if (prototypes.get(key) === pending) {
      prototypes.delete(key);
      gltfPrototypeResident.value = prototypes.size;
    }
    gltfPrototypeFailures.value += 1;
    log.warn("Shared GLTF prototype load failed; evicted for retry", {
      url,
      variant: options.variant,
      error,
    });
    throw error;
  }
}

/**
 * `loadSharedGltf` with the retrying loader, for assets where a transient
 * failure used to be absorbed by a per-entity retry.
 */
export function loadSharedGltfWithRetry(
  url: string,
  options: SharedGltfOptions & { attempts?: number; delayMs?: number } = {}
): Promise<GLTF> {
  const { attempts, delayMs, load, ...rest } = options;
  return loadSharedGltf(url, {
    ...rest,
    // `load` is threaded into the retry policy rather than replaced by it, so a
    // caller (or a test) supplying its own loader still gets the retries it
    // asked for instead of silently reaching the network.
    load: (u) => loadGltfWithRetry(u, { attempts, delayMs, load }),
  });
}

/** Whether a prototype for this key is already resident (or in flight). */
export function hasSharedGltf(url: string, variant?: string) {
  return prototypes.has(cacheKey(url, variant));
}

/** Diagnostics for tests and the cval dump. */
export function sharedGltfCacheStats() {
  return {
    resident: prototypes.size,
    loads: gltfPrototypeLoads.value,
    hits: gltfPrototypeHits.value,
    failures: gltfPrototypeFailures.value,
  };
}

/**
 * Test-only. Drops every prototype WITHOUT disposing it -- see rule 3 above; the
 * cache never owns GPU lifetime.
 */
export function resetSharedGltfCacheForTest() {
  prototypes.clear();
  gltfPrototypeLoads.value = 0;
  gltfPrototypeHits.value = 0;
  gltfPrototypeFailures.value = 0;
  gltfPrototypeResident.value = 0;
}
