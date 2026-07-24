/// <reference types="mocha" />

import { shouldDeleteUnknownChallengeTriggerRoot } from "@/server/shared/triggers/engine";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("trigger engine stale-root cleanup", () => {
  const knownQuest = 101 as BiomesId;
  const removedQuest = 102 as BiomesId;
  const nativeVitals = 8_740_000_000_000_101 as BiomesId;

  it("preserves native extension roots while removing retired challenge roots", () => {
    const knownExecutors = new Set<BiomesId>([knownQuest]);
    const challengeBackedRoots = new Set<BiomesId>([knownQuest, removedQuest]);

    assert.equal(
      shouldDeleteUnknownChallengeTriggerRoot(
        nativeVitals,
        knownExecutors,
        challengeBackedRoots
      ),
      false
    );
    assert.equal(
      shouldDeleteUnknownChallengeTriggerRoot(
        knownQuest,
        knownExecutors,
        challengeBackedRoots
      ),
      false
    );
    assert.equal(
      shouldDeleteUnknownChallengeTriggerRoot(
        removedQuest,
        knownExecutors,
        challengeBackedRoots
      ),
      true
    );
  });
});
