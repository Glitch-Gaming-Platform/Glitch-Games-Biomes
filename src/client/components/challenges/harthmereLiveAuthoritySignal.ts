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

export function markHarthmereLiveSnapshotSeen(
  nowMs: number = Date.now()
): void {
  if (Number.isFinite(nowMs) && nowMs > lastLiveSnapshotAtMs) {
    lastLiveSnapshotAtMs = nowMs;
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

export function lastHarthmereLiveSnapshotAtMsForTest(): number {
  return lastLiveSnapshotAtMs;
}

export function resetHarthmereLiveSnapshotForTest(): void {
  lastLiveSnapshotAtMs = 0;
}
