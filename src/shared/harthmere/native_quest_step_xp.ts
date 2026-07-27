// NATIVE_QUEST_STEP_XP
//
// Per-step experience for the restored Biomes onboarding chain ("The Road
// Ahead" -> "Busted" -> "Get the Muck Out" -> "Muck vs. Machine").
//
// WHY THIS EXISTS
// ---------------
// The original snapshot's quests are pure trigger trees: a leaf fires, the
// journal ticks over, and nothing else happens until the final
// `challengeClaimRewards` hands out items. A player can spend an hour on the
// twenty-one Busted steps and stay Level 1, because the ONLY thing that ever
// wrote to the native progression root was an NPC kill
// (`awardHarthmereNativeCombatXp`, see harthmere_native_combat.ts).
//
// This module is the reward *table* only. It deliberately contains no state and
// no writes:
//
//   - the authority that decides a step is done is the native ECS trigger tree,
//   - the authority that stores the XP is the ECS TriggerState progression root,
//   - this file only answers "how much is that leaf worth?".
//
// Keeping it separate matters because the client renders the same journal rows.
// A client that wants to preview "+30 XP" must read the identical table the
// server pays out from, or the HUD and the ECS will disagree.
//
// IDEMPOTENCY
// -----------
// There is intentionally no claim ledger here. `BaseTrigger.update` only
// transitions a leaf from "no firedAt" to "firedAt" once, inside the same
// forked ECS delta that persists the award, so a step cannot pay twice. Adding
// a second ledger would create a second authority that could drift from the
// trigger tree.
//
// SCOPE
// -----
// Only the four robot-story quests are eligible. Repeatable quests
// (`repeatableCadence`) clear their trigger root on reset, so paying per-leaf
// XP for them would be farmable; the four onboarding chapters are one-shot.

import type { BiomesId } from "@/shared/ids";
import {
  NATIVE_ROBOT_STORY_QUEST_IDS,
  nativeRobotStoryQuestOrder,
} from "@/shared/harthmere/native_road_ahead_contract";

export const NATIVE_QUEST_STEP_XP_VERSION =
  "harthmere-native-quest-step-xp-v1" as const;

/**
 * Effort tiers. These are deliberately coarse: the writer-facing trigger kinds
 * describe *what the player did*, and that is the only signal available without
 * hand-authoring XP onto 60+ snapshot leaves that we do not own.
 */
export const NATIVE_QUEST_STEP_XP_TIERS = Object.freeze({
  /** Walk somewhere, talk to someone, hand something over, take a photo. */
  narrative: 15,
  /** Collect, craft, place, wear, build — the steps with a counter on them. */
  effort: 30,
  /** Kill something, or clear a boss/breach. */
  combat: 60,
});

export type NativeQuestStepXpTier = keyof typeof NATIVE_QUEST_STEP_XP_TIERS;

/** Paid once, on the quest's `completed` transition, on top of the last step. */
export const NATIVE_QUEST_COMPLETION_BONUS_XP = 150;

/**
 * The nominal level of this content. `computeHarthmereXpReward`-style grey-content
 * decay is NOT applied to story steps: the onboarding chain is a one-time,
 * un-farmable sequence, and silently paying zero to a returning high-level
 * player would look like the same "XP does nothing" bug this fixes.
 */
export const NATIVE_QUEST_STEP_SOURCE_LEVEL = 1;

/**
 * Trigger kinds whose completion represents player effort with a counter.
 * Mirrors `StoredTriggerDefinition["kind"]` — kept as strings so this module
 * stays importable from the client without pulling in the server trigger serde.
 */
const EFFORT_TRIGGER_KINDS = new Set<string>([
  "collect",
  "collectType",
  "everCollect",
  "everCollectType",
  "craft",
  "craftType",
  "everCraft",
  "everCraftType",
  "inventoryHas",
  "inventoryHasType",
  "place",
  "wear",
  "wearType",
  "blueprintBuilt",
]);

const NARRATIVE_TRIGGER_KINDS = new Set<string>([
  "challengeClaimRewards",
  "completeQuestStepAtMyRobot",
  "approachPosition",
  "mapBeam",
  "cameraPhoto",
]);

/**
 * Bookkeeping leaves. `challengeComplete`/`challengeUnlocked` fire from another
 * quest's state rather than from anything the player just did, and paying them
 * would award XP for merely having a quest unlock itself.
 */
const UNPAID_TRIGGER_KINDS = new Set<string>([
  "challengeComplete",
  "challengeUnlocked",
  "starter_location",
  "land",
]);

/**
 * `event` leaves are the snapshot's workhorse: talking to an NPC, killing a
 * mucker, and selling to a vendor are all `kind: "event"` with a different
 * `eventKind`. Tier them by the firehose event they wait on.
 */
const COMBAT_EVENT_KINDS = new Set<string>(["npcKilled"]);

const EFFORT_EVENT_KINDS = new Set<string>([
  "collect",
  "craft",
  "place",
  "blockDestroy",
  "shapeBlock",
  "blueprintBuilt",
  "fished",
  "growSeed",
  "plantSeed",
  "waterPlant",
  "purchase",
  "sell_to_entity",
]);

export interface NativeQuestStepXpInput {
  /** The quest (trigger root) the leaf belongs to. */
  questId: unknown;
  /** `StoredTriggerDefinition["kind"]` of the leaf that just fired. */
  triggerKind: string;
  /** For `kind: "event"` leaves, the firehose event kind it waited on. */
  eventKind?: string;
  /** False for `all`/`any`/`seq`/`variant` nodes — those are not journal rows. */
  isLeaf?: boolean;
}

export function isNativeQuestStepXpEligibleQuestId(questId: unknown): boolean {
  return nativeRobotStoryQuestOrder(questId) >= 0;
}

export function nativeQuestStepXpEligibleQuestIds(): readonly BiomesId[] {
  return NATIVE_ROBOT_STORY_QUEST_IDS;
}

/**
 * Classify a leaf. Returns undefined for nodes that should never pay (aggregate
 * nodes and pure bookkeeping leaves) so callers can distinguish "worth zero"
 * from "not a rewardable step".
 */
export function nativeQuestStepXpTier(
  input: Pick<NativeQuestStepXpInput, "triggerKind" | "eventKind">
): NativeQuestStepXpTier | undefined {
  const kind = String(input.triggerKind ?? "").trim();
  if (!kind || UNPAID_TRIGGER_KINDS.has(kind)) {
    return undefined;
  }
  if (kind === "event") {
    const eventKind = String(input.eventKind ?? "").trim();
    if (!eventKind) {
      // An event leaf with no declared event kind cannot be classified; pay the
      // conservative tier rather than nothing, so the step still registers.
      return "narrative";
    }
    if (COMBAT_EVENT_KINDS.has(eventKind)) return "combat";
    if (EFFORT_EVENT_KINDS.has(eventKind)) return "effort";
    return "narrative";
  }
  if (EFFORT_TRIGGER_KINDS.has(kind)) return "effort";
  if (NARRATIVE_TRIGGER_KINDS.has(kind)) return "narrative";
  // Unknown authored kinds still represent a journal row the player cleared.
  return "narrative";
}

/**
 * XP for one newly-completed step. Zero means "do not write" — callers should
 * skip the ECS mutation entirely so an ineligible quest never dirties the
 * progression root.
 */
export function nativeQuestStepXp(input: NativeQuestStepXpInput): number {
  if (input.isLeaf === false) return 0;
  if (!isNativeQuestStepXpEligibleQuestId(input.questId)) return 0;
  const tier = nativeQuestStepXpTier(input);
  return tier ? NATIVE_QUEST_STEP_XP_TIERS[tier] : 0;
}

/** XP for finishing an eligible quest, paid on the `completed` transition. */
export function nativeQuestCompletionXp(questId: unknown): number {
  return isNativeQuestStepXpEligibleQuestId(questId)
    ? NATIVE_QUEST_COMPLETION_BONUS_XP
    : 0;
}

/** Player-facing toast copy, shared by the HUD and the journal. */
export function nativeQuestStepXpLabel(xp: number): string {
  return `+${Math.max(0, Math.trunc(xp))} XP`;
}
