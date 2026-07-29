/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_LIVE_SLICE
//
// The residual non-ECS state and the one-time migration reader.
//
// The reader runs against real player data on first load, so its failure mode
// is "a live player's Q7 disappears". Every branch is covered, including the
// ones that deliberately DROP data.

import assert from "assert";
import {
  BIBLE_SLICE_MIGRATION_VERSION,
  defaultBibleLiveSlice,
  migrateRetiredBibleQuestState,
  normalizeBibleLiveSlice,
} from "../bible/bible_live_slice";

const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);

describe("Bible live slice — normalizer", () => {
  it("returns defaults for absent or non-object input", () => {
    for (const input of [undefined, null, 7, "x", []]) {
      const slice = normalizeBibleLiveSlice(input);
      assert.deepEqual(slice.flags, []);
      assert.deepEqual(slice.reputation, {});
      assert.deepEqual(slice.lastCompletedAtMs, {});
    }
  });

  it("drops garbage rather than trusting a hostile client", () => {
    const slice = normalizeBibleLiveSlice({
      reputation: { watch: 10, bogus: "not a number", nan: NaN },
      flags: ["real", 42, null, "also_real"],
      titles: "not an array",
      lastCompletedAtMs: { q: 1, bad: {} },
      choices: { q: "path_a", bad: 5 },
      thaedryn: "not an object",
      townPhase: 9,
    });
    assert.deepEqual(slice.reputation, { watch: 10 });
    assert.deepEqual(slice.flags, ["real", "also_real"]);
    assert.deepEqual(slice.titles, []);
    assert.deepEqual(slice.lastCompletedAtMs, { q: 1 });
    assert.deepEqual(slice.choices, { q: "path_a" });
    assert.equal(slice.thaedryn, undefined);
    assert.equal(slice.townPhase, undefined);
  });

  it("carries valid nested state through unchanged", () => {
    const thaedryn = { phase: "wing", hp: 2200, startedAtMs: NOW };
    const slice = normalizeBibleLiveSlice({ thaedryn, townPhase: "bellbound" });
    assert.deepEqual(slice.thaedryn, thaedryn);
    assert.equal(slice.townPhase, "bellbound");
  });

  it("does not carry a runtime state machine any more", () => {
    const slice = normalizeBibleLiveSlice({
      runtime: { some_quest: { state: "active" } },
      grantedRewardIds: ["grant_1"],
    }) as unknown as Record<string, unknown>;
    assert.equal(slice.runtime, undefined);
    assert.equal(slice.grantedRewardIds, undefined);
  });
});

describe("Bible live slice — migration reader", () => {
  const legacy = {
    runtime: {
      bellbound_q01_cracks_in_bridge: {
        state: "completed",
        objectiveProgress: {},
      },
      bellbound_q02_whispers_at_well: {
        state: "active",
        chosenPath: "tell_the_reeve",
        objectiveProgress: {
          bellbound_q02_whispers_at_well_obj_01: { completed: true },
          bellbound_q02_whispers_at_well_obj_02: { completed: false },
        },
      },
      bellbound_q03_dreams_of_drowning: { state: "abandoned" },
      bellbound_q04_sisters_letters: { state: "failed" },
      bellbound_q05_beneath_the_stones: { state: "available" },
    },
    grantedRewardIds: ["grant_q1"],
    flags: ["significant_cracks_highlighted"],
    titles: ["Bridgewalker"],
    completedAtMs: { bellbound_q01_cracks_in_bridge: NOW - 86_400_000 },
  };

  it("moves completed quests into native challenge completion", () => {
    const result = migrateRetiredBibleQuestState(legacy, NOW);
    assert.equal(result.migrated, true);
    assert.deepEqual(result.nativeProgress.completedQuestIds, [
      "bellbound_q01_cracks_in_bridge",
    ]);
  });

  it("moves active quests to in_progress with only their fired steps", () => {
    const result = migrateRetiredBibleQuestState(legacy, NOW);
    assert.deepEqual(result.nativeProgress.inProgressQuestIds, [
      "bellbound_q02_whispers_at_well",
    ]);
    assert.deepEqual(
      result.nativeProgress.firedStepIdsByQuestId
        .bellbound_q02_whispers_at_well,
      ["bellbound_q02_whispers_at_well_obj_01"],
      "an incomplete objective must not be seeded as fired"
    );
  });

  // Neither state is observable to a player as distinct: the retired runtime
  // let both be re-accepted from scratch, and no authored quest can fail.
  it("collapses failed and abandoned to not-started", () => {
    const result = migrateRetiredBibleQuestState(legacy, NOW);
    const seeded = [
      ...result.nativeProgress.completedQuestIds,
      ...result.nativeProgress.inProgressQuestIds,
    ];
    assert(!seeded.includes("bellbound_q03_dreams_of_drowning"));
    assert(!seeded.includes("bellbound_q04_sisters_letters"));
    assert(!seeded.includes("bellbound_q05_beneath_the_stones"));
  });

  it("preserves choices, flags, titles and completion stamps", () => {
    const { slice } = migrateRetiredBibleQuestState(legacy, NOW);
    assert.equal(slice.choices.bellbound_q02_whispers_at_well, "tell_the_reeve");
    assert(slice.flags.includes("significant_cracks_highlighted"));
    assert(slice.titles.includes("Bridgewalker"));
    assert.equal(
      slice.lastCompletedAtMs.bellbound_q01_cracks_in_bridge,
      NOW - 86_400_000
    );
  });

  // Native step completion is idempotent by construction: TriggerState.by_root
  // records a step id once, so a re-submit sets a value that is already set.
  // A completed challenge already means "granted".
  it("discards the reward-grant ledger", () => {
    const { slice } = migrateRetiredBibleQuestState(legacy, NOW);
    assert.equal(
      (slice as unknown as Record<string, unknown>).grantedRewardIds,
      undefined
    );
  });

  it("is idempotent — a second run seeds nothing", () => {
    const first = migrateRetiredBibleQuestState(legacy, NOW);
    assert.equal(first.slice.migratedVersion, BIBLE_SLICE_MIGRATION_VERSION);
    const second = migrateRetiredBibleQuestState(first.slice, NOW);
    assert.equal(second.migrated, false);
    assert.deepEqual(second.nativeProgress.completedQuestIds, []);
    assert.deepEqual(second.nativeProgress.inProgressQuestIds, []);
    // Already-migrated state survives the no-op pass unchanged.
    assert.equal(
      second.slice.choices.bellbound_q02_whispers_at_well,
      "tell_the_reeve"
    );
  });

  it("handles a player who has never touched a bible quest", () => {
    const result = migrateRetiredBibleQuestState(undefined, NOW);
    assert.equal(result.migrated, true);
    assert.deepEqual(result.nativeProgress.completedQuestIds, []);
    assert.deepEqual(result.slice.flags, []);
  });

  it("survives a malformed runtime record without throwing", () => {
    const result = migrateRetiredBibleQuestState(
      { runtime: { a: null, b: "x", c: 5, d: { state: "active" } } },
      NOW
    );
    assert.deepEqual(result.nativeProgress.inProgressQuestIds, ["d"]);
  });

  it("seeds a cadence stamp for a completed quest that had none", () => {
    // Repeatables previously had NO cooldown enforcement, so a legacy record
    // may carry a completion with no timestamp. Falling back to `now` starts
    // the cooldown rather than granting a free extra cycle.
    const result = migrateRetiredBibleQuestState(
      { runtime: { repeatable_watch_patrol_routes: { state: "completed" } } },
      NOW
    );
    assert.equal(
      result.slice.lastCompletedAtMs.repeatable_watch_patrol_routes,
      NOW
    );
  });

  it("starts from a clean default slice", () => {
    const slice = defaultBibleLiveSlice();
    assert.deepEqual(slice.flags, []);
    assert.equal(slice.migratedVersion, undefined);
  });
});
