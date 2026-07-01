import assert from "assert";
import {
  HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS,
  harthmereLiveSnapshotPresent,
  lastHarthmereLiveSnapshotAtMsForTest,
  markHarthmereLiveSnapshotSeen,
  resetHarthmereLiveSnapshotForTest,
} from "./harthmereLiveAuthoritySignal";

const NOW = 1_800_000_000_000;

describe("harthmereLiveAuthoritySignal", () => {
  // The module holds process-global state, so each test resets it first.
  beforeEach(() => resetHarthmereLiveSnapshotForTest());

  it("reports no live authority before any snapshot is seen (offline / local-dev)", () => {
    assert.equal(lastHarthmereLiveSnapshotAtMsForTest(), 0);
    assert.equal(harthmereLiveSnapshotPresent(NOW), false);
  });

  it("reports live authority present immediately after a snapshot is marked", () => {
    markHarthmereLiveSnapshotSeen(NOW);
    assert.equal(lastHarthmereLiveSnapshotAtMsForTest(), NOW);
    assert.equal(harthmereLiveSnapshotPresent(NOW), true);
  });

  it("keeps live authority present within the freshness window and expires after it", () => {
    markHarthmereLiveSnapshotSeen(NOW);
    // Just inside the window → still authoritative.
    assert.equal(
      harthmereLiveSnapshotPresent(NOW + HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS),
      true
    );
    // Just past the window → the server poll has gone silent, so the client
    // sim is allowed to resume ownership (offline fallback).
    assert.equal(
      harthmereLiveSnapshotPresent(
        NOW + HARTHMERE_LIVE_SNAPSHOT_FRESHNESS_MS + 1
      ),
      false
    );
  });

  it("only ever advances the last-seen timestamp forward (ignores stale marks)", () => {
    markHarthmereLiveSnapshotSeen(NOW);
    markHarthmereLiveSnapshotSeen(NOW - 10_000); // stale, must be ignored
    assert.equal(lastHarthmereLiveSnapshotAtMsForTest(), NOW);
    markHarthmereLiveSnapshotSeen(NOW + 10_000); // newer, must win
    assert.equal(lastHarthmereLiveSnapshotAtMsForTest(), NOW + 10_000);
  });

  it("ignores non-finite timestamps", () => {
    markHarthmereLiveSnapshotSeen(Number.NaN);
    assert.equal(lastHarthmereLiveSnapshotAtMsForTest(), 0);
    assert.equal(harthmereLiveSnapshotPresent(Number.NaN), false);
  });
});
