// Tests for the server-authoritative quest step validator.
//
// These tests lock in the contract from the Harthmere quest bible and the
// v47 quest runtime: a claim-style step can only fire when the player is
// on the quest, when the step is a real claim leaf in this quest's
// trigger tree, when every earlier `seq` sibling has actually fired, when
// the step itself isn't already done, and when the entity in front of the
// player is the right one.
//
// The bug we're locking down is "the person can complete the quest just
// by going to the next dialogue" — i.e. claiming the final talk-step
// before the inspect / collect / combat objective in the middle has
// actually fired. The "talk → APPROACH → talk" tests below are the
// canonical regression cases.

import { validateClaimStep } from "@/server/logic/events/handlers/quest_step_validation";
import type {
  ClaimEntityIdentity,
  ReadonlyChallengeStateSlice,
} from "@/server/logic/events/handlers/quest_step_validation";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import assert from "assert";

// ---------------------------------------------------------------------------
// Test fixture helpers. Keep these tiny and explicit — no Bikkie, no ECS.
// ---------------------------------------------------------------------------

const id = (n: number): BiomesId => n as BiomesId;

// IDs used throughout. Anything non-zero is fine.
const QUEST_ID = id(1000);
const NPC_TYPE = id(2000); // a biscuit "NPC type" id (e.g. Father Aldren)
const NPC_INSTANCE = id(2001); // an actual entity instance of that type
const PAINTING_TYPE = id(2100);
const PAINTING_INSTANCE = id(2101);
const PLAYER = id(3000);
const PLAYERS_ROBOT = id(3100);
const OTHER_PLAYER_ROBOT = id(3200);

// Leaf trigger IDs (the step_id values the client sends).
const TALK_START = id(10);
const APPROACH = id(11);
const TALK_END = id(12);
const COLLECT = id(13);
const COMBAT_EVENT = id(14);
const ROBOT_TALK = id(15);
const NON_CLAIM_LEAF = id(16);

// Group IDs (the seq / all / any wrappers).
const SEQ_ROOT = id(100);
const ALL_ROOT = id(101);
const ANY_ROOT = id(102);
const NESTED_SEQ = id(103);

// Build a `seq: [talk_start, approach, talk_end]` quest. This is the
// canonical bug-shape: the player must approach the painting before they
// can turn the quest in at the NPC.
function makeTalkApproachTalkSeq(): StoredTriggerDefinition {
  return {
    kind: "seq",
    id: SEQ_ROOT,
    triggers: [
      {
        kind: "challengeClaimRewards",
        id: TALK_START,
        returnNpcTypeId: NPC_TYPE,
        allowDefaultNavigationAid: true,
      } as StoredTriggerDefinition,
      {
        kind: "approachPosition",
        id: APPROACH,
        pos: [0, 0, 0],
        allowDefaultNavigationAid: true,
      } as StoredTriggerDefinition,
      {
        kind: "challengeClaimRewards",
        id: TALK_END,
        returnNpcTypeId: NPC_TYPE,
        allowDefaultNavigationAid: true,
      } as StoredTriggerDefinition,
    ],
  };
}

// Build a state map where the listed trigger ids are "fired" (firedAt
// stored as a positive number — the simple wire form).
function firedState(...firedIds: BiomesId[]): Map<BiomesId, string | number> {
  const m = new Map<BiomesId, string | number>();
  let t = 1;
  for (const fid of firedIds) {
    m.set(fid, t++);
  }
  return m;
}

function challengesWith(opts: {
  inProgress?: BiomesId[];
  complete?: BiomesId[];
}): ReadonlyChallengeStateSlice {
  return {
    in_progress: new Set(opts.inProgress ?? []),
    complete: new Set(opts.complete ?? []),
  };
}

function entityNpcInstance(): ClaimEntityIdentity {
  return {
    entityId: NPC_INSTANCE,
    npcTypeId: NPC_TYPE,
    isMyRobot: false,
  };
}

function entityPaintingInstance(): ClaimEntityIdentity {
  return {
    entityId: PAINTING_INSTANCE,
    placeableItemId: PAINTING_TYPE,
    isMyRobot: false,
  };
}

function entityMyRobot(): ClaimEntityIdentity {
  return {
    entityId: PLAYERS_ROBOT,
    isMyRobot: true,
  };
}

function entityOtherPlayersRobot(): ClaimEntityIdentity {
  return {
    entityId: OTHER_PLAYER_ROBOT,
    isMyRobot: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateClaimStep — quest step server-authoritative validation", () => {
  describe("seq quest: talk → approach → talk", () => {
    it("accepts the first talk step when the player is on the quest", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });

    // THE BUG: completing the final talk before the approach objective
    // must be rejected. This is the canonical "talk to the NPC and skip
    // going to the painting" regression case.
    it("REJECTS the final talk step before the approach is fired", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START), // approach NOT done
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });

    it("accepts the final talk step ONLY after the approach is fired", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START, APPROACH),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });

    it("rejects the approach itself as a claim step (it is not talkable)", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: APPROACH,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_is_not_a_claim_step"
      );
    });

    it("treats a duplicate completion as idempotent (step_already_completed)", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START, APPROACH, TALK_END),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_already_completed"
      );
    });
  });

  describe("challenge state preconditions", () => {
    it("rejects when the player is not on the quest", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({}), // not in_progress, not complete
        triggerStateForChallenge: undefined,
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "challenge_not_in_progress"
      );
    });

    it("reports step_already_completed (not _not_in_progress) when the quest is already complete", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ complete: [QUEST_ID] }),
        triggerStateForChallenge: undefined,
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_already_completed"
      );
    });

    it("rejects when the quest has no trigger tree", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: undefined,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: undefined,
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "missing_quest_trigger"
      );
    });

    it("rejects when the claimed step is not part of this quest's tree", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: id(99999),
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_not_in_quest"
      );
    });
  });

  describe("entity validation (which NPC / placeable / robot)", () => {
    it("accepts a claim step when the entity is the exact NPC type id", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: {
          entityId: NPC_INSTANCE,
          npcTypeId: NPC_TYPE,
          isMyRobot: false,
        },
      });
      assert.equal(result.ok, true);
    });

    it("accepts a claim step when returnNpcTypeId points at an entity id directly", () => {
      const trigger: StoredTriggerDefinition = {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: NPC_INSTANCE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: {
          entityId: NPC_INSTANCE,
          // No npcTypeId — the entity id is what's authored on the step.
          isMyRobot: false,
        },
      });
      assert.equal(result.ok, true);
    });

    it("accepts a placeable (a painting) as the matching entity", () => {
      const trigger: StoredTriggerDefinition = {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: PAINTING_TYPE, // authored against the placeable
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityPaintingInstance(),
      });
      assert.equal(result.ok, true);
    });

    it("rejects when the player is in front of the wrong NPC", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: {
          entityId: id(99000), // some random NPC
          npcTypeId: id(99001),
          isMyRobot: false,
        },
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "wrong_entity_for_step"
      );
    });

    it("accepts a robot-step when the entity is the player's own robot", () => {
      const trigger: StoredTriggerDefinition = {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "completeQuestStepAtMyRobot",
            id: ROBOT_TALK,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: ROBOT_TALK,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityMyRobot(),
      });
      assert.equal(result.ok, true);
    });

    it("rejects a robot-step when the entity is another player's robot", () => {
      const trigger: StoredTriggerDefinition = {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "completeQuestStepAtMyRobot",
            id: ROBOT_TALK,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: ROBOT_TALK,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityOtherPlayersRobot(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "wrong_entity_for_step"
      );
    });
  });

  describe("varied objective kinds in the middle of a seq", () => {
    function makeSeqWithMiddle(
      middle: StoredTriggerDefinition
    ): StoredTriggerDefinition {
      return {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
          middle,
          {
            kind: "challengeClaimRewards",
            id: TALK_END,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
    }

    it("blocks the turn-in until a `collect` objective has fired", () => {
      const trigger = makeSeqWithMiddle({
        kind: "collectType",
        id: COLLECT,
        typeId: id(5000),
        count: 3,
      } as StoredTriggerDefinition);
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START), // collect NOT done
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });

    it("allows the turn-in once the `collect` objective has fired", () => {
      const trigger = makeSeqWithMiddle({
        kind: "collectType",
        id: COLLECT,
        typeId: id(5000),
        count: 3,
      } as StoredTriggerDefinition);
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START, COLLECT),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });

    it("blocks the turn-in until a `defeat enemy` event objective has fired", () => {
      const trigger = makeSeqWithMiddle({
        kind: "event",
        id: COMBAT_EVENT,
        eventKind: "npcKilled",
        count: 1,
      } as StoredTriggerDefinition);
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START), // combat NOT done
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });

    it("blocks the turn-in until an `inspect`-style approach has fired", () => {
      // approachPosition is what the system uses for "go inspect <thing>"
      // objectives. The exact crack-pattern bug from
      // bellbound_q01_cracks_in_bridge is this shape.
      const trigger = makeSeqWithMiddle({
        kind: "approachPosition",
        id: APPROACH,
        pos: [476, 0, -212],
        allowDefaultNavigationAid: true,
      } as StoredTriggerDefinition);
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });
  });

  describe("nested seqs (a seq inside a seq)", () => {
    // seq:
    //   talk_start
    //   nested_seq:
    //     approach
    //     collect
    //   talk_end
    //
    // talk_end must wait for BOTH approach AND collect.
    function makeNestedSeq(): StoredTriggerDefinition {
      return {
        kind: "seq",
        id: SEQ_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
          {
            kind: "seq",
            id: NESTED_SEQ,
            triggers: [
              {
                kind: "approachPosition",
                id: APPROACH,
                pos: [0, 0, 0],
                allowDefaultNavigationAid: true,
              } as StoredTriggerDefinition,
              {
                kind: "collectType",
                id: COLLECT,
                typeId: id(5000),
                count: 1,
              } as StoredTriggerDefinition,
            ],
          },
          {
            kind: "challengeClaimRewards",
            id: TALK_END,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
    }

    it("blocks the final talk when only the inner approach is done", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeNestedSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        // Only approach fired; collect is not.
        triggerStateForChallenge: firedState(TALK_START, APPROACH),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });

    it("blocks the final talk when only the inner collect is marked (group not fully complete)", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeNestedSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        // collect leaf fired but approach didn't — should still be
        // rejected because the inner seq isn't truly done.
        triggerStateForChallenge: firedState(TALK_START, COLLECT),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "prior_step_incomplete"
      );
    });

    it("allows the final talk once the entire inner seq is done", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeNestedSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(
          TALK_START,
          APPROACH,
          COLLECT,
          NESTED_SEQ
        ),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });
  });

  describe("all / any groups (no ordering constraint)", () => {
    function makeAllGroup(): StoredTriggerDefinition {
      // all:
      //   talk_start (claim) -- this is the only claim leaf
      //   approach
      //   collect
      return {
        kind: "all",
        id: ALL_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
          {
            kind: "approachPosition",
            id: APPROACH,
            pos: [0, 0, 0],
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
          {
            kind: "collectType",
            id: COLLECT,
            typeId: id(5000),
            count: 1,
          } as StoredTriggerDefinition,
        ],
      };
    }

    it("allows the claim step in an `all` group regardless of sibling ordering", () => {
      // In `all`, no ordering is enforced — the framework already ensures
      // the QUEST won't complete until every sibling is fired, so the
      // claim step itself can fire whenever.
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: makeAllGroup(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(), // nothing else fired
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });

    it("allows the claim step in an `any` group regardless of sibling ordering", () => {
      const trigger: StoredTriggerDefinition = {
        kind: "any",
        id: ANY_ROOT,
        triggers: [
          {
            kind: "challengeClaimRewards",
            id: TALK_START,
            returnNpcTypeId: NPC_TYPE,
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
          {
            kind: "approachPosition",
            id: APPROACH,
            pos: [0, 0, 0],
            allowDefaultNavigationAid: true,
          } as StoredTriggerDefinition,
        ],
      };
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_START,
        questTrigger: trigger,
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, true);
    });
  });

  describe("`Click Talk` regression — stale step bundles", () => {
    // The companion bug: client-side, when the player just clicks Talk
    // on an NPC the React UI can pass in a stale step bundle. The server
    // is the safety net. These tests show that no matter what stale
    // step_id sneaks through, the validator catches it before the
    // firehose event is published.

    it("rejects when the client sends a step_id from a quest the player isn't on", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: TALK_END,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [id(9999)] }), // different quest
        triggerStateForChallenge: undefined,
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "challenge_not_in_progress"
      );
    });

    it("rejects when the client sends INVALID_BIOMES_ID as step_id", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: INVALID_BIOMES_ID,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_not_in_quest"
      );
    });

    it("rejects when the client points at a non-talk leaf (e.g. the approach itself)", () => {
      const result = validateClaimStep({
        challengeId: QUEST_ID,
        stepId: APPROACH,
        questTrigger: makeTalkApproachTalkSeq(),
        challenges: challengesWith({ inProgress: [QUEST_ID] }),
        triggerStateForChallenge: firedState(TALK_START),
        claimEntity: entityNpcInstance(),
      });
      assert.equal(result.ok, false);
      assert.equal(
        (result as { ok: false; reason: string }).reason,
        "step_is_not_a_claim_step"
      );
    });
  });
});
