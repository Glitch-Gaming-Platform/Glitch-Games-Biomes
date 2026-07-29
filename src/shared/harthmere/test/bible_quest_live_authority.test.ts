/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_QUEST_LIVE_AUTHORITY
//
// The reducer after the Chapter 1-shape migration. Rewritten rather than
// patched because the CONTRACT changed, not just the implementation: there is
// no `runtime` record, no `grantedRewardIds` ledger and no seven-state machine
// left to assert against.
//
// What the reducer produces now is INSTRUCTIONS, and the property that matters
// is that objective progress leaves as a signed native publish instead of a
// Redis write.

import assert from "assert";
import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  HARTHMERE_RETIRED_BIBLE_OPERATIONS,
  buildHarthmereBibleQuestContext,
  defaultHarthmereBibleQuestLiveSlice,
  harthmereBibleNativeSnapshotFromMirror,
  harthmereBibleQuestOffersForGiver,
  harthmereBibleQuestPartyProgress,
  harthmereBibleQuestsByGiver,
  harthmereThaedrynArenaWorldAnchor,
  reduceHarthmereBibleQuestOperation,
  validateHarthmereDragonQuestReachability,
  type HarthmereBibleNativeSnapshot,
} from "../bible_quest_live_authority";
import { bibleQuest } from "../bible/bible_quest_catalog";
import { bibleNativeQuestId, bibleNativeStepId } from "../bible/bible_quest_ids";
import { bibleStepWorldWaypoint } from "../bible/bible_waypoints";

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);
const Q1 = bibleQuest("bellbound_q01_cracks_in_bridge")!;

function native(
  overrides: Partial<HarthmereBibleNativeSnapshot> = {}
): HarthmereBibleNativeSnapshot {
  return { inProgress: false, completed: false, firedStepIds: [], ...overrides };
}

function reduce(overrides: Record<string, unknown>) {
  return reduceHarthmereBibleQuestOperation({
    slice: defaultHarthmereBibleQuestLiveSlice(),
    actorId: "actor-1",
    playerLevel: Q1.gate.levelBand.min,
    completedQuests: {},
    nowMs: NOW,
    operation: "bible_quest_read",
    requestId: "req-1",
    ...overrides,
  } as any);
}

describe("Bible reducer — accept", () => {
  it("instructs a native challenge start rather than writing a record", () => {
    const result = reduce({
      operation: "bible_quest_accept",
      questId: Q1.id,
      native: native(),
    });
    assert.equal(result.ok, true);
    assert.equal(
      result.nativeStart?.challengeId,
      Number(bibleNativeQuestId(Q1.id))
    );
    // The retired shape is gone, not merely unused.
    assert.equal((result.slice as any).runtime, undefined);
    assert.equal((result.slice as any).grantedRewardIds, undefined);
  });

  it("mirrors the journal entry at a GROUNDED giver position", () => {
    const result = reduce({
      operation: "bible_quest_accept",
      questId: Q1.id,
      native: native(),
    });
    const position = result.activeMirror?.entry?.giverPosition;
    assert(position, "no giver position mirrored");
    assert.notEqual(position[1], 0, "a Y=0 mirror strands the map marker");
  });

  it("refuses a quest whose gate fails", () => {
    const result = reduce({
      operation: "bible_quest_accept",
      questId: "bellbound_q02_whispers_at_well",
      playerLevel: 1,
      native: native(),
    });
    assert.equal(result.ok, false);
    assert(
      result.warnings.some((w) => w.includes("missing_prerequisite")),
      result.warnings.join(",")
    );
  });

  it("never offers a starter twin", () => {
    const starter = bibleQuest("starter_welcome_to_harthmere")!;
    const result = reduce({
      operation: "bible_quest_accept",
      questId: starter.id,
      native: native(),
    });
    assert.equal(result.ok, false);
    assert(
      result.warnings.some((w) => w.includes("starter_quests_use_client_twins"))
    );
  });

  it("leaves the slice untouched when it rejects", () => {
    const slice = defaultHarthmereBibleQuestLiveSlice();
    slice.flags.push("pre_existing");
    const result = reduceHarthmereBibleQuestOperation({
      slice,
      actorId: "a",
      playerLevel: 1,
      completedQuests: {},
      nowMs: NOW,
      operation: "bible_quest_accept",
      questId: "no_such_quest",
      requestId: "r",
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.slice, slice);
  });
});

describe("Bible reducer — advance", () => {
  const step = Q1.steps[0];

  it("emits a signed native progress instruction, not an ECS write", () => {
    const result = reduce({
      operation: "bible_quest_advance",
      questId: Q1.id,
      objectiveId: step.id,
      actorPosition: bibleStepWorldWaypoint(Q1, step),
      native: native({ inProgress: true }),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.nativeProgress, {
      challengeId: Number(bibleNativeQuestId(Q1.id)),
      stepId: Number(bibleNativeStepId(Q1.id, step.id)),
    });
  });

  it("rejects an advance on a quest that is not in progress", () => {
    const result = reduce({
      operation: "bible_quest_advance",
      questId: Q1.id,
      objectiveId: step.id,
      native: native({ inProgress: false }),
    });
    assert.equal(result.ok, false);
    assert(result.warnings.some((w) => w.includes("quest_not_in_progress")));
  });

  it("rejects a player standing too far from the grounded waypoint", () => {
    const target = bibleStepWorldWaypoint(Q1, step);
    const result = reduce({
      operation: "bible_quest_advance",
      questId: Q1.id,
      objectiveId: step.id,
      actorPosition: [target[0] + 500, target[1], target[2]],
      native: native({ inProgress: true }),
    });
    assert.equal(result.ok, false);
    assert(result.warnings.some((w) => w.includes("player_too_far")));
  });

  it("enforces objective order", () => {
    const later = Q1.steps[2];
    const result = reduce({
      operation: "bible_quest_advance",
      questId: Q1.id,
      objectiveId: later.id,
      actorPosition: bibleStepWorldWaypoint(Q1, later),
      native: native({ inProgress: true }),
    });
    assert.equal(result.ok, false);
    assert(
      result.warnings.some((w) => w.includes("prior_objective_not_complete"))
    );
  });

  // /sync reconnects cancel in-flight publishes, so clients legitimately
  // retry. A repeat must be a quiet no-op, not an error the HUD surfaces.
  it("treats a duplicate submission as success with no instruction", () => {
    const result = reduce({
      operation: "bible_quest_advance",
      questId: Q1.id,
      objectiveId: step.id,
      actorPosition: bibleStepWorldWaypoint(Q1, step),
      native: native({ inProgress: true, firedStepIds: [step.id] }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.nativeProgress, undefined);
  });

  it("emits physical proof items for collection steps", () => {
    const quest = bibleQuest("bellbound_q10_bellbinders_tomb")!;
    const step = quest.steps[1];
    const result = reduce({
      operation: "bible_quest_advance",
      questId: quest.id,
      objectiveId: step.id,
      actorPosition: bibleStepWorldWaypoint(quest, step),
      native: native({
        inProgress: true,
        firedStepIds: [quest.steps[0].id],
      }),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.objectiveItemGrant, {
      itemId: `quest_objective_item:${quest.id}:${step.id}`,
      count: 6,
      displayName: "six Bellbinder regalia pieces",
    });
  });
});

describe("Bible reducer — complete", () => {
  const allFired = Q1.steps.map((step) => step.id);

  it("grants rewards and stamps the cadence", () => {
    const result = reduce({
      operation: "bible_quest_complete",
      questId: Q1.id,
      native: native({ inProgress: true, firedStepIds: allFired }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.rewards?.xpDelta, Q1.rewards.xp);
    assert.equal(result.rewards?.goldDelta, Q1.rewards.silver);
    assert.equal(result.slice.lastCompletedAtMs[Q1.id], NOW);
    assert.equal(result.completedMirrorQuestId, Q1.id);
  });

  it("accumulates reputation into the residual slice", () => {
    const result = reduce({
      operation: "bible_quest_complete",
      questId: Q1.id,
      native: native({ inProgress: true, firedStepIds: allFired }),
    });
    for (const [faction, delta] of Object.entries(Q1.rewards.reputation)) {
      assert.equal(result.slice.reputation[faction], delta);
    }
  });

  it("refuses to complete with unfired objectives", () => {
    const result = reduce({
      operation: "bible_quest_complete",
      questId: Q1.id,
      native: native({ inProgress: true, firedStepIds: [allFired[0]] }),
    });
    assert.equal(result.ok, false);
    assert(result.warnings.some((w) => w.includes("objectives_incomplete")));
  });

  // Idempotency is structural now: a completed native challenge already means
  // "granted", which is why the grantedRewardIds ledger could be deleted.
  it("does not re-grant an already-completed challenge", () => {
    const result = reduce({
      operation: "bible_quest_complete",
      questId: Q1.id,
      native: native({ completed: true, firedStepIds: allFired }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.rewards, undefined);
  });
});

describe("Bible reducer — retired operations", () => {
  it("rejects bible_quest_retry instead of silently no-oping", () => {
    assert.deepEqual(
      [...HARTHMERE_RETIRED_BIBLE_OPERATIONS],
      ["bible_quest_retry"]
    );
    const result = reduce({ operation: "bible_quest_retry", questId: Q1.id });
    assert.equal(result.ok, false);
    assert(result.warnings.some((w) => w.includes("unknown_operation")));
  });
});

describe("Bible native snapshot from the journal mirror", () => {
  // The mirror carries ONE cursor; the fired set is reconstructed from it
  // because steps are strictly ordered. Nothing new is stored.
  it("reconstructs the fired set from the current step cursor", () => {
    const snapshot = harthmereBibleNativeSnapshotFromMirror({
      questId: Q1.id,
      activeStepId: Q1.steps[2].id,
      active: true,
      completed: false,
    });
    assert.equal(snapshot.inProgress, true);
    assert.deepEqual(snapshot.firedStepIds, [Q1.steps[0].id, Q1.steps[1].id]);
  });

  it("reports every step fired for a completed quest", () => {
    const snapshot = harthmereBibleNativeSnapshotFromMirror({
      questId: Q1.id,
      active: false,
      completed: true,
    });
    assert.equal(snapshot.completed, true);
    assert.equal(snapshot.firedStepIds.length, Q1.steps.length);
  });

  it("uses progress=1 to reconstruct a ready-to-complete active quest", () => {
    const snapshot = harthmereBibleNativeSnapshotFromMirror({
      questId: Q1.id,
      activeProgress: 1,
      active: true,
      completed: false,
    });
    assert.equal(snapshot.inProgress, true);
    assert.deepEqual(
      snapshot.firedStepIds,
      Q1.steps.map((step) => step.id)
    );
  });

  it("reports nothing for an untouched quest", () => {
    const snapshot = harthmereBibleNativeSnapshotFromMirror({
      questId: Q1.id,
      active: false,
      completed: false,
    });
    assert.equal(snapshot.inProgress, false);
    assert.deepEqual(snapshot.firedStepIds, []);
  });

  it("treats an unknown cursor as nothing fired rather than guessing", () => {
    const snapshot = harthmereBibleNativeSnapshotFromMirror({
      questId: Q1.id,
      activeStepId: "step_from_an_older_catalog",
      active: true,
      completed: false,
    });
    assert.deepEqual(snapshot.firedStepIds, []);
  });
});

describe("Bible party progress", () => {
  const step = Q1.steps[0];
  const at = bibleStepWorldWaypoint(Q1, step);

  it("publishes once per eligible member", () => {
    const result = harthmereBibleQuestPartyProgress({
      questId: Q1.id,
      objectiveId: step.id,
      members: [
        {
          actorId: "a",
          native: native({ inProgress: true }),
          actorPosition: at,
        },
        {
          actorId: "b",
          native: native({ inProgress: true }),
          actorPosition: at,
        },
      ],
    });
    assert.equal(result.publishes.length, 2);
    assert.deepEqual(result.skipped, []);
  });

  // The point of per-member eligibility: one player in the arena must not
  // complete an objective for a party sitting in town.
  it("skips a member who is out of range", () => {
    const result = harthmereBibleQuestPartyProgress({
      questId: Q1.id,
      objectiveId: step.id,
      members: [
        {
          actorId: "near",
          native: native({ inProgress: true }),
          actorPosition: at,
        },
        {
          actorId: "far",
          native: native({ inProgress: true }),
          actorPosition: [at[0] + 900, at[1], at[2]],
        },
      ],
    });
    assert.deepEqual(
      result.publishes.map((entry) => entry.actorId),
      ["near"]
    );
    assert.equal(result.skipped[0].actorId, "far");
    assert(result.skipped[0].reasons.includes("player_too_far"));
  });

  it("skips a member who has already fired the step", () => {
    const result = harthmereBibleQuestPartyProgress({
      questId: Q1.id,
      objectiveId: step.id,
      members: [
        {
          actorId: "done",
          native: native({ inProgress: true, firedStepIds: [step.id] }),
          actorPosition: at,
        },
      ],
    });
    assert.deepEqual(result.publishes, []);
    assert(result.skipped[0].reasons.includes("duplicate_submission"));
  });
});

describe("Bible givers and offers", () => {
  it("indexes more than the 8 givers the retired hand-written table had", () => {
    assert(Object.keys(harthmereBibleQuestsByGiver()).length > 8);
  });

  it("never leaks a prerequisite-locked quest into dialogue", () => {
    const context = buildHarthmereBibleQuestContext({
      actorId: "a",
      playerLevel: 1,
      completedQuests: {},
      slice: defaultHarthmereBibleQuestLiveSlice(),
      nowMs: NOW,
    });
    for (const giverId of Object.keys(harthmereBibleQuestsByGiver())) {
      for (const offer of harthmereBibleQuestOffersForGiver({
        giverId,
        context,
        inProgressQuestIds: new Set(),
      })) {
        assert(
          !(offer.blockedReasons ?? []).includes("missing_prerequisite"),
          `${offer.questId} leaked a locked quest into ${giverId}'s dialogue`
        );
      }
    }
  });

  it("does not re-offer a quest already in progress", () => {
    const context = buildHarthmereBibleQuestContext({
      actorId: "a",
      playerLevel: Q1.gate.levelBand.min,
      completedQuests: {},
      slice: defaultHarthmereBibleQuestLiveSlice(),
      nowMs: NOW,
    });
    const giverId = Object.keys(harthmereBibleQuestsByGiver()).find((id) =>
      harthmereBibleQuestsByGiver()[id].includes(Q1.id)
    )!;
    const offers = harthmereBibleQuestOffersForGiver({
      giverId,
      context,
      inProgressQuestIds: new Set([Q1.id]),
    });
    assert(!offers.some((offer) => offer.questId === Q1.id));
  });
});

describe("Bible dragon reachability", () => {
  it("keeps the arena reachable and grounded", () => {
    const report = validateHarthmereDragonQuestReachability();
    assert.deepEqual(report.failures, []);
    assert.notEqual(report.arenaWorldAnchor[1], 0);
  });

  it("walks the whole main chain back from Q12", () => {
    const report = validateHarthmereDragonQuestReachability();
    assert.equal(report.mainChainQuestIds[0], "bellbound_q01_cracks_in_bridge");
    assert.equal(
      report.mainChainQuestIds[report.mainChainQuestIds.length - 1],
      HARTHMERE_BIBLE_DRAGON_QUEST_ID
    );
  });

  it("routes every Q12 objective at the arena anchor", () => {
    const q12 = bibleQuest(HARTHMERE_BIBLE_DRAGON_QUEST_ID)!;
    const anchor = harthmereThaedrynArenaWorldAnchor();
    for (const step of q12.steps) {
      assert.deepEqual(bibleStepWorldWaypoint(q12, step), anchor);
    }
  });
});
