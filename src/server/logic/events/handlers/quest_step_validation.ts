// Server-authoritative validation for "complete a quest step at an entity".
//
// Bug this exists to defend against:
//   The previous handler (completeQuestStepAtEntityEventHandler) accepted any
//   client-supplied {challenge_id, step_id, entity_id} and immediately
//   published the corresponding firehose event. That made it possible to:
//     1. Skip intermediate objectives in a quest (e.g. "go inspect the
//        painting") by talking to an NPC and matching the FINAL claim step.
//     2. Cause a quest to "suddenly complete or change" when the player just
//        clicked Talk on an NPC, because a stale step_id from the React UI
//        could be replayed against the server which would happily honour it.
//
// The Harthmere quest bible and the current quest runtime both require the same
// contract:
//
//   locked -> available -> active -> ready_to_complete -> completed
//
// where the `active -> ready_to_complete` transition only happens once every
// authored objective has been satisfied. This module is the gate that
// enforces that contract for the legacy trigger-based quest system; callers
// (the event handler) must refuse to publish a `completeQuestStepAtEntity`
// firehose event when validation fails, so that downstream trigger leaves
// such as `ChallengeClaimRewardsTrigger.findEvent` never see a spurious
// match.
//
// This module is intentionally a pure function with no game-engine
// dependencies so it can be unit-tested directly.

import type { BiomesId } from "@/shared/ids";
import { harthmereRequestBoardEntityIdsEquivalent } from "@/shared/harthmere/native_request_boards";
import { snapshotGroveNpcEntityIdsEquivalent } from "@/shared/harthmere/snapshot_grove_ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import { deserializeTriggerState } from "@/shared/triggers/state";
import type {
  StoredTriggerDefinition,
  ChallengeClaimRewardsTriggerDefinition,
  CompleteQuestStepAtMyRobotTriggerDefinition,
} from "@/shared/triggers/schema";
import { z } from "zod";

// Reason codes are stable strings so handler tests, telemetry, and the v47
// runtime telemetry layer can match on them.
export type QuestStepValidationFailureReason =
  | "challenge_not_in_progress"
  | "step_not_in_quest"
  | "step_is_not_a_claim_step"
  | "prior_step_incomplete"
  | "step_already_completed"
  | "wrong_entity_for_step"
  | "missing_quest_trigger";

export interface QuestStepValidationOk {
  ok: true;
  // The matched leaf definition. Useful for the handler to forward
  // returnNpcTypeId / allowDefaultNavigationAid when publishing the
  // downstream firehose event.
  leaf:
    | ChallengeClaimRewardsTriggerDefinition
    | CompleteQuestStepAtMyRobotTriggerDefinition;
}

export interface QuestStepValidationErr {
  ok: false;
  reason: QuestStepValidationFailureReason;
  details?: string;
}

export type QuestStepValidationResult =
  | QuestStepValidationOk
  | QuestStepValidationErr;

/**
 * Identity recorded in the firehose event after validation. Claim-reward
 * leaves compare against their authored return id, while robot claims retain
 * the concrete robot instance id.
 */
export function canonicalClaimFromEntityId(
  validation: QuestStepValidationOk,
  concreteEntityId: BiomesId
) {
  return validation.leaf.kind === "challengeClaimRewards"
    ? validation.leaf.returnNpcTypeId
    : concreteEntityId;
}

// Identity facts about the entity the player claims to be talking to. The
// handler resolves these from the ECS Delta (npc_metadata.type_id /
// placeable_component.item_id / robotComponent + createdBy.id).
export interface ClaimEntityIdentity {
  entityId: BiomesId;
  // If the entity is an NPC, the NPC type id (a biscuit id).
  npcTypeId?: BiomesId;
  // If the entity is a placeable, the placeable item id (a biscuit id).
  placeableItemId?: BiomesId;
  // True if and only if the entity is a robot AND that robot's creator is
  // the acting player. The robot path is the only one that doesn't go
  // through `returnNpcTypeId`.
  isMyRobot: boolean;
}

// The minimum surface area we need from the player's persisted challenge
// state. The handler can pass `player.challenges()` directly.
export interface ReadonlyChallengeStateSlice {
  readonly in_progress: ReadonlySet<BiomesId>;
  readonly complete: ReadonlySet<BiomesId>;
}

export interface ValidateClaimStepInput {
  challengeId: BiomesId;
  stepId: BiomesId;
  // The quest's `trigger` attribute (the whole tree). Pass the StoredTriggerDefinition
  // off the Biscuit — we walk it raw, no need to deserialize into Trigger classes.
  questTrigger: StoredTriggerDefinition | undefined;
  // The player's `challenges` component slice.
  challenges: ReadonlyChallengeStateSlice | undefined;
  // The player's `triggerState.by_root.get(challengeId)` — the per-spec-id
  // map of MetaState serialized values (number = firedAt, string = packed).
  // May be undefined if no triggers have ever been ticked for this quest.
  triggerStateForChallenge: ReadonlyMap<BiomesId, string | number> | undefined;
  // Identity of the entity in the CompleteQuestStepAtEntity event.
  claimEntity: ClaimEntityIdentity;
}

// True if a trigger spec id has been "fired" (i.e. completed) in the
// player's trigger state. Both number-form (legacy firedAt-only) and
// string-form (packed MetaState with payload) are supported.
export function isTriggerFired(
  triggerStateForChallenge: ReadonlyMap<BiomesId, string | number> | undefined,
  triggerSpecId: BiomesId
): boolean {
  if (!triggerStateForChallenge) {
    return false;
  }
  const raw = triggerStateForChallenge.get(triggerSpecId);
  if (raw === undefined) {
    return false;
  }
  // A bare number is the wire form for "firedAt only, no payload". 0 is
  // the sentinel for "empty state" — see serializeTriggerState in
  // src/shared/triggers/state.ts.
  if (typeof raw === "number") {
    return raw > 0;
  }
  // String form: packed MetaState. Decode and check firedAt.
  try {
    const meta: MetaState = deserializeTriggerState(raw, z.any());
    return meta.firedAt !== undefined && meta.firedAt > 0;
  } catch {
    return false;
  }
}

// Walks the trigger tree to find the leaf definition with the given step
// id, returning the leaf and the chain of group ancestors (root-first).
// Returns `undefined` if no leaf with that id exists in the tree.
function findStepWithAncestors(
  root: StoredTriggerDefinition,
  stepId: BiomesId
):
  | { leaf: StoredTriggerDefinition; ancestors: StoredTriggerDefinition[] }
  | undefined {
  // DFS, recording the ancestor stack.
  const stack: StoredTriggerDefinition[] = [];

  const visit = (
    node: StoredTriggerDefinition
  ):
    | { leaf: StoredTriggerDefinition; ancestors: StoredTriggerDefinition[] }
    | undefined => {
    if (node.id === stepId) {
      // This node itself is the step.
      return { leaf: node, ancestors: [...stack] };
    }
    switch (node.kind) {
      case "all":
      case "any":
      case "seq":
      case "variant": {
        stack.push(node);
        for (const child of node.triggers ?? []) {
          const hit = visit(child);
          if (hit) {
            stack.pop();
            return hit;
          }
        }
        stack.pop();
        return undefined;
      }
      default:
        return undefined;
    }
  };

  return visit(root);
}

// Collect every leaf trigger that must be fired before a given step can
// legally fire. The rule:
//
//   - For each `seq` ancestor on the root-to-step path, every direct child
//     of that seq that appears strictly BEFORE the child on the path is a
//     prerequisite. All leaves under such a child must be fired.
//   - For `all` / `any` / `variant` ancestors, no ordering is implied.
//
// This matches the runtime semantics of SeqTrigger.tick (children are
// processed left-to-right and the seq does not advance past an incomplete
// child) and is what makes "go inspect the painting" actually block the
// final "talk to NPC" step.
function collectSeqPrerequisiteLeafIds(
  root: StoredTriggerDefinition,
  stepId: BiomesId
): BiomesId[] | undefined {
  const path = findStepPath(root, stepId);
  if (!path) {
    return undefined;
  }
  const prerequisites = new Set<BiomesId>();
  // path is [root, ..., leaf]. Walk it; whenever the current node is a seq,
  // every earlier sibling of the next node on the path is a prerequisite.
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    if (node.kind !== "seq") continue;
    const nextOnPath = path[i + 1];
    for (const sibling of node.triggers ?? []) {
      if (sibling.id === nextOnPath.id) break;
      // We also gate on the sibling's group spec id, not just its leaves,
      // since SeqTrigger advances by setting state.payload to the child's
      // spec id and firing the child itself.
      prerequisites.add(sibling.id);
      for (const leafId of collectAllLeafIds(sibling)) {
        prerequisites.add(leafId);
      }
    }
  }
  return [...prerequisites];
}

function findStepPath(
  root: StoredTriggerDefinition,
  stepId: BiomesId
): StoredTriggerDefinition[] | undefined {
  if (root.id === stepId) return [root];
  switch (root.kind) {
    case "all":
    case "any":
    case "seq":
    case "variant": {
      for (const child of root.triggers ?? []) {
        const sub = findStepPath(child, stepId);
        if (sub) return [root, ...sub];
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function collectAllLeafIds(node: StoredTriggerDefinition): BiomesId[] {
  switch (node.kind) {
    case "all":
    case "any":
    case "seq":
    case "variant": {
      const out: BiomesId[] = [];
      for (const child of node.triggers ?? []) {
        for (const id of collectAllLeafIds(child)) out.push(id);
      }
      return out;
    }
    default:
      // All leaf kinds have a BiomesId `id` (they extend
      // BaseStoredTriggerDefinition), but the wide union can confuse TS's
      // narrowing in the default branch. The cast is sound by schema.
      return [(node as { id: BiomesId }).id];
  }
}

// Returns the leaf if it's a claim-style step (one of the two kinds the
// completeQuestStepAtEntity firehose event is allowed to satisfy);
// otherwise undefined.
function asClaimStep(
  leaf: StoredTriggerDefinition
):
  | ChallengeClaimRewardsTriggerDefinition
  | CompleteQuestStepAtMyRobotTriggerDefinition
  | undefined {
  if (leaf.kind === "challengeClaimRewards") {
    return leaf;
  }
  if (leaf.kind === "completeQuestStepAtMyRobot") {
    return leaf;
  }
  return undefined;
}

// The handler asks: "Given the player's persisted state, is it legal to
// fire claim-step `stepId` of `challengeId` at this entity right now?"
//
// Returns `{ok: true, leaf}` on success — the handler should then publish
// the corresponding firehose event so the trigger engine can advance.
// Returns `{ok: false, reason}` on failure — the handler must NOT publish
// (and should RollbackError so the client gets clear feedback).
export function validateClaimStep(
  input: ValidateClaimStepInput
): QuestStepValidationResult {
  const {
    challengeId,
    stepId,
    questTrigger,
    challenges,
    triggerStateForChallenge,
    claimEntity,
  } = input;

  // 1. The player must actually be on this quest.
  if (!challenges?.in_progress.has(challengeId)) {
    // Idempotency: if the quest is already complete we silently accept the
    // event by reporting step_already_completed — the handler treats that
    // as "do not publish and do not roll back".
    if (challenges?.complete.has(challengeId)) {
      return { ok: false, reason: "step_already_completed" };
    }
    return { ok: false, reason: "challenge_not_in_progress" };
  }

  // 2. The quest must have a trigger tree.
  if (!questTrigger) {
    return { ok: false, reason: "missing_quest_trigger" };
  }

  // 3. The step must exist in this quest's trigger tree.
  const found = findStepWithAncestors(questTrigger, stepId);
  if (!found) {
    return { ok: false, reason: "step_not_in_quest" };
  }

  // 4. The step must be one of the two claim-step kinds.
  const claimLeaf = asClaimStep(found.leaf);
  if (!claimLeaf) {
    return { ok: false, reason: "step_is_not_a_claim_step" };
  }

  // 5. The step must not already be fired.
  if (isTriggerFired(triggerStateForChallenge, stepId)) {
    return { ok: false, reason: "step_already_completed" };
  }

  // 6. Every prior step in a `seq` ancestor must be fired. This is the
  //    fix for "the person can complete the quest just by going to the
  //    next dialogue" — even if the client sends a step_id for the final
  //    talk, we refuse to publish until the inspect/collect/combat
  //    objective in between has actually fired.
  const prereqIds = collectSeqPrerequisiteLeafIds(questTrigger, stepId) ?? [];
  for (const prereqId of prereqIds) {
    if (!isTriggerFired(triggerStateForChallenge, prereqId)) {
      return {
        ok: false,
        reason: "prior_step_incomplete",
        details: `${prereqId}`,
      };
    }
  }

  // 7. The entity in front of the player must be the right one for this
  //    step. Robot steps require the player's own robot. Claim-rewards
  //    steps require the entity (an NPC instance OR a placeable instance)
  //    to match `returnNpcTypeId` either as a direct entity id, the NPC
  //    type biscuit id, or the placeable item biscuit id (the latter two
  //    cover the "talk to any instance of <NPC type>" / "interact with
  //    the painting" cases).
  if (claimLeaf.kind === "completeQuestStepAtMyRobot") {
    if (!claimEntity.isMyRobot) {
      return { ok: false, reason: "wrong_entity_for_step" };
    }
  } else {
    const expected = claimLeaf.returnNpcTypeId;
    const matches =
      snapshotGroveNpcEntityIdsEquivalent(expected, claimEntity.entityId) ||
      harthmereRequestBoardEntityIdsEquivalent(
        expected,
        claimEntity.entityId
      ) ||
      (claimEntity.npcTypeId !== undefined &&
        expected === claimEntity.npcTypeId) ||
      (claimEntity.placeableItemId !== undefined &&
        expected === claimEntity.placeableItemId);
    if (!matches) {
      return { ok: false, reason: "wrong_entity_for_step" };
    }
  }

  return { ok: true, leaf: claimLeaf };
}
