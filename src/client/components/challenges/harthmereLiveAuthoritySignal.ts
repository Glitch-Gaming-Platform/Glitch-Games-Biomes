// Single source of truth for "is the live server authoritative right now?"
//
// The 43 LocalDevHarthmere* client simulations double as (a) the offline /
// local-dev mode and (b) the immediate-feedback layer in live mode. When a live
// server snapshot has recently arrived, the server owns the runtime values
// (HP, stamina, mana, gold, ...) and the client simulations must stop
// *independently* ticking/owning them — otherwise two owners fight over the same
// value and produce the flicker / double-death dual-source bugs.
//
// This module records the last time a server-authored snapshot was observed.
// `playerStatusAdapter` marks it whenever the server player-status poll or a
// server-fed status event lands (that poll runs every 5s in live mode), so
// `harthmereLiveSnapshotPresent()` is true in live mode and false offline.

export const HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS = 30_000;

let lastLiveSnapshotAtMs = 0;
let liveSnapshotEverSeen = false;

export function markHarthmereLiveSnapshotSeen(
  nowMs: number = Date.now()
): void {
  if (Number.isFinite(nowMs)) {
    if (nowMs > lastLiveSnapshotAtMs) {
      lastLiveSnapshotAtMs = nowMs;
    }
    liveSnapshotEverSeen = true;
  }
}

export function harthmereLiveSnapshotPresent(
  nowMs: number = Date.now(),
  freshnessMs: number = HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS
): boolean {
  return (
    lastLiveSnapshotAtMs > 0 &&
    Number.isFinite(nowMs) &&
    nowMs - lastLiveSnapshotAtMs <= freshnessMs
  );
}

// HARTHMERE_LIVE_AUTHORITY_STICKY (2026-07-05): "was a snapshot seen in the
// last 30s" is the WRONG question for deciding whether the client simulations
// may re-take ownership of server-owned values. In production the live_mode
// server routinely takes 10-15s+ per request; a few consecutive slow/timed-out
// polls made `harthmereLiveSnapshotPresent()` flip false, the client stamina
// sim woke up against a stale local clock, instantly "starved" the player
// ("random dying and reviving"), and the local inventory/HP sims started
// fighting the server again (HUD stats flipping in/out of combat, item counts
// jumping). Once a server snapshot has been seen this session, the server IS
// the authority — a transient poll gap must never hand ownership back to the
// client sims. Genuine offline/local-dev mode never sees a snapshot, so it is
// entirely unaffected.
export function harthmereLiveServerAuthoritative(
  nowMs: number = Date.now(),
  freshnessMs: number = HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS
): boolean {
  return (
    liveSnapshotEverSeen || harthmereLiveSnapshotPresent(nowMs, freshnessMs)
  );
}

export function lastHarthmereLiveSnapshotAtMsForTest(): number {
  return lastLiveSnapshotAtMs;
}

export function resetHarthmereLiveSnapshotForTest(): void {
  lastLiveSnapshotAtMs = 0;
  liveSnapshotEverSeen = false;
}
