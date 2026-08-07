import type { ProjectionMap } from "@/client/game/resources/overlays";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const OVERLAY_OCCLUSION_CACHE_TTL_MS = 100;
export const OVERLAY_OCCLUSION_CACHE_SWEEP_MS = 5_000;
export const MAX_OVERLAY_OCCLUSION_MARCHES_PER_FRAME = 24;
// A physical iPhone 12 mini measured overlay reconstruction at 10.0 ms average
// / 19 ms p95, nearly half of the game's measured per-frame CPU work. Mobile
// rendering is capped at 30 FPS, while names, prompts and screen projections do
// not need a complete table scan every rendered frame. An 80 ms cadence keeps
// interaction feedback within one tenth of a second and prevents healthy phone
// sessions from spending roughly 300 ms of CPU per second on overlays alone.
// Desktop remains unthrottled.
export const MOBILE_OVERLAY_REFRESH_INTERVAL_MS = 80;
export const MOBILE_OVERLAY_EMERGENCY_REFRESH_INTERVAL_MS = 200;

export function mobileOverlayRefreshIntervalForFrameGap(frameGapMs?: number) {
  return typeof frameGapMs === "number" &&
    Number.isFinite(frameGapMs) &&
    frameGapMs >= 100
    ? MOBILE_OVERLAY_EMERGENCY_REFRESH_INTERVAL_MS
    : MOBILE_OVERLAY_REFRESH_INTERVAL_MS;
}

export function shouldRefreshOverlayFrame(input: {
  mobileDevice: boolean;
  nowMs: number;
  lastRefreshAtMs: number | undefined;
  refreshIntervalMs?: number;
}) {
  if (!input.mobileDevice) {
    return true;
  }
  if (
    input.lastRefreshAtMs === undefined ||
    !Number.isFinite(input.lastRefreshAtMs) ||
    !Number.isFinite(input.nowMs) ||
    input.nowMs < input.lastRefreshAtMs
  ) {
    return true;
  }
  return (
    input.nowMs - input.lastRefreshAtMs >=
    (input.refreshIntervalMs ?? MOBILE_OVERLAY_REFRESH_INTERVAL_MS)
  );
}

export type OverlayOcclusionRefresh = {
  key: string;
  camKey: string;
  pos: ReadonlyVec3;
  camPos: ReadonlyVec3;
  requestedAt: number;
};

type OverlayOcclusionCacheEntry = {
  occluded: boolean;
  at: number;
  camKey: string;
};

/**
 * FIFO refresh queue for overlay terrain visibility.
 *
 * A direct "first N calls per frame" budget permanently starves later
 * overlays at low FPS because the same early labels are stale again on every
 * frame. This queue deduplicates requests and drains them across frames, so
 * every visible label eventually receives a march while the per-frame cost
 * stays constant.
 */
export class OverlayOcclusionRefreshQueue {
  private readonly cache = new Map<string, OverlayOcclusionCacheEntry>();
  private readonly pending = new Map<string, OverlayOcclusionRefresh>();
  private readonly order: string[] = [];

  read(key: string, camKey: string, now: number) {
    const entry = this.cache.get(key);
    return {
      occluded: entry?.occluded,
      fresh:
        Boolean(entry) &&
        entry!.camKey === camKey &&
        now - entry!.at < OVERLAY_OCCLUSION_CACHE_TTL_MS,
    };
  }

  request(refresh: OverlayOcclusionRefresh) {
    if (!this.pending.has(refresh.key)) {
      this.order.push(refresh.key);
    }
    // Preserve FIFO position while replacing the sample with the newest camera
    // and target coordinates.
    this.pending.set(refresh.key, refresh);
  }

  take(limit: number): OverlayOcclusionRefresh[] {
    const taken: OverlayOcclusionRefresh[] = [];
    while (taken.length < limit && this.order.length > 0) {
      const key = this.order.shift()!;
      const refresh = this.pending.get(key);
      if (!refresh) continue;
      this.pending.delete(key);
      taken.push(refresh);
    }
    return taken;
  }

  commit(refresh: OverlayOcclusionRefresh, occluded: boolean, now: number) {
    this.cache.set(refresh.key, {
      occluded,
      at: now,
      camKey: refresh.camKey,
    });
  }

  sweep(now: number) {
    for (const [key, entry] of this.cache) {
      if (now - entry.at > OVERLAY_OCCLUSION_CACHE_SWEEP_MS) {
        this.cache.delete(key);
      }
    }
    for (const [key, entry] of this.pending) {
      if (now - entry.requestedAt > OVERLAY_OCCLUSION_CACHE_SWEEP_MS) {
        this.pending.delete(key);
      }
    }
  }

  get pendingCount() {
    return this.pending.size;
  }
}

export function overlayOcclusionKey(pos: ReadonlyVec3) {
  return `${Math.round(pos[0])}:${Math.round(pos[1])}:${Math.round(pos[2])}`;
}

/** Sub-pixel projection movement does not justify a React invalidation. */
export function overlayProjectionsEqual(a: ProjectionMap, b: ProjectionMap) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, next] of b) {
    const prev = a.get(key);
    if (!prev) {
      return false;
    }
    if (
      Math.abs(prev.loc[0] - next.loc[0]) > 0.5 ||
      Math.abs(prev.loc[1] - next.loc[1]) > 0.5 ||
      Math.abs(prev.loc[2] - next.loc[2]) > 0.5 ||
      Math.abs((prev.proximity ?? 0) - (next.proximity ?? 0)) > 0.01
    ) {
      return false;
    }
  }
  return true;
}
