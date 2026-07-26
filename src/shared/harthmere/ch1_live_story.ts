// CHAPTER_1_LIVE_STORY
//
// Pure, idempotent reducers for the production Chapter 1 seam. Native ECS
// challenges own objective ordering; this module applies the authored durable
// consequences that the generic challenge trigger cannot represent: fragment
// recovery, latent skills, item rewards, Auggie charge, testimony totals, and
// the two carry-forward choices. Keeping this pure lets the HTTP authority
// roll state back if publishing the corresponding ECS progress event fails.

import {
  ch1Augur9PlayLog,
  ch1Augur9Recharge,
} from "@/shared/harthmere/ch1_augur9";
import {
  CH1_TESTIMONIES,
  CH1_TESTIMONY_REWARD_FRAGMENT,
} from "@/shared/harthmere/ch1_cast";
import {
  ch1AdjustTrack,
  ch1ChooseEnding,
  ch1RecordHallrChoice,
  ch1SetFlag,
  type Ch1PlayerState,
} from "@/shared/harthmere/ch1_chapter";
import {
  ch1ApplyConsolidation,
  ch1Fragment,
  ch1FragmentDeliveryEnabled,
  ch1LinkRecipeFor,
  ch1RecoverFragment,
} from "@/shared/harthmere/ch1_fragment_ledger";
import {
  CH1_ENDINGS,
  CH1_FLAGS,
  type Ch1Ending,
} from "@/shared/harthmere/ch1_ids";
import {
  ch1UnlockLatentSkill,
  type Ch1LatentSkillId,
} from "@/shared/harthmere/ch1_latent_skills";
import type { Ch1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import type {
  Ch1QuestDef,
  Ch1QuestStep,
} from "@/shared/harthmere/ch1_quests";

export interface Ch1ObjectiveChoiceOption {
  id: string;
  label: string;
  description?: string;
}

export interface Ch1ObjectiveChoiceSpec {
  title: string;
  prompt: string;
  options: readonly Ch1ObjectiveChoiceOption[];
  /** Closing the prompt leaves the objective active indefinitely. */
  cancellable: boolean;
}

const IMPORTANT_CHOICES: Readonly<Record<string, Ch1ObjectiveChoiceSpec>> = {
  d1_salt_market: {
    title: "The Salt Market",
    prompt: "The awnings are rotten enough to drop. How do you cross the bazaar?",
    options: [
      {
        id: "drop_awnings",
        label: "Drop the awnings",
        description: "Use the market itself against the Salt-Cured Muckers.",
      },
      {
        id: "fight_open",
        label: "Fight in the open",
        description: "Faster to understand, harder on health and stamina.",
      },
    ],
    cancellable: true,
  },
  d1_cistern_stair: {
    title: "The Cistern Stair",
    prompt: "The lit stair is longer. The flooded shortcut has no air pockets.",
    options: [
      {
        id: "lit_stair",
        label: "Take the lit stair",
        description: "Spend three torches and keep air overhead.",
      },
      {
        id: "no_air_shortcut",
        label: "Try the shortcut",
        description: "Save time and accept the drowning-risk penalty.",
      },
    ],
    cancellable: true,
  },
  ch1_a3_d1_hall_of_weights: {
    title: "The Hall of Weights",
    prompt:
      "Three instruments disagree. The temple asks for an exact mass against its own standard.",
    options: [
      { id: "modern_scale_a", label: "Trust instrument A" },
      { id: "modern_scale_b", label: "Trust instrument B" },
      {
        id: "temple_balance",
        label: "Use the temple balance",
        description: "Compare the unknown directly to the local reference mass.",
      },
    ],
    cancellable: true,
  },
  d1_sun_court: {
    title: "The Gilded Bull",
    prompt: "It has not noticed you. The pillars can break its horns if it charges.",
    options: [
      {
        id: "stealth_bypass",
        label: "Slip past it",
        description: "Avoid the fight; the Bull's Core remains behind.",
      },
      {
        id: "break_horns",
        label: "Use the pillars",
        description: "Fight all three phases and recover the Bull's Core.",
      },
    ],
    cancellable: true,
  },
  d2_hanged_wood: {
    title: "The Hanged Wood",
    prompt: "The things between the trees hunt by sound.",
    options: [
      {
        id: "silent_path",
        label: "Move quietly",
        description: "Slow, deliberate movement is the intended route.",
      },
      {
        id: "fight_through",
        label: "Force a path",
        description: "Combat is possible, loud, and expensive.",
      },
    ],
    cancellable: true,
  },
  d2_ash_hall: {
    title: "The Hearth Fails",
    prompt: "The Ninth Winter is extinguishing the room around you.",
    options: [
      {
        id: "feed_hearth",
        label: "Feed the hearth",
        description: "Burn the carried fuel needed to see the fight through.",
      },
      {
        id: "fight_dark",
        label: "Fight in darkness",
        description: "The fuel interval remains lost to exposure and the fight becomes brutal.",
      },
    ],
    cancellable: true,
  },
  choose_a_name: {
    title: "A Name for the Board",
    prompt: "Tell Taye what to paint. Your chosen profile name remains yours.",
    options: [{ id: "keep_name", label: "Use my current name" }],
    cancellable: false,
  },
  d2_the_oath: {
    title: "The Condition",
    prompt:
      "Promise Nadia Sorrel that the field ledger will never go to the Collective, under any circumstance.",
    options: [
      {
        id: "swear_oath",
        label: "I swear it",
        description: "It does not go to the Collective. Ever.",
      },
    ],
    cancellable: false,
  },
  d2_hallrs_choice: {
    title: "Hallr's Choice",
    prompt: "Neither answer is scored. Both carry into Chapter 2.",
    options: [
      {
        id: "let_run",
        label: "Let the year run",
        description: "End the stall and let nine years arrive.",
      },
      {
        id: "hold_stall",
        label: "Hold the stall",
        description: "Keep the people alive and leave the wound open.",
      },
    ],
    cancellable: false,
  },
  give_the_ledger: {
    title: "Give the Field Ledger?",
    prompt: "You told Nadia Sorrel this would never go to the Collective.",
    options: [
      { id: "give", label: "Give it to him" },
      {
        id: "not_yet",
        label: "Not yet",
        description: "There is no timer. The game will wait.",
      },
    ],
    cancellable: true,
  },
  give_her_location: {
    title: "Tell Him Where She Is?",
    prompt: "Sorrel needs a doctor. Lou represents the Collective.",
    options: [{ id: "tell", label: "Tell him" }],
    cancellable: true,
  },
  the_final_choice: {
    title: "Decide",
    prompt: "None of these is the good ending, and none is canon.",
    options: [
      { id: "confess", label: "Confess" },
      { id: "contain", label: "Contain" },
      { id: "bargain", label: "Bargain" },
    ],
    cancellable: false,
  },
};

export function ch1ObjectiveChoiceSpec(
  step: Ch1QuestStep
): Ch1ObjectiveChoiceSpec | undefined {
  return IMPORTANT_CHOICES[step.id];
}

export function ch1RuntimePlayerState(
  runtime: Ch1LiveGateRuntimeState
): Ch1PlayerState {
  return {
    flags: [...runtime.flags],
    tracks: { ...runtime.tracks },
    ledger: runtime.ledger,
    latentSkills: runtime.latentSkills,
    testimonies: [...runtime.testimonies],
    activeDungeonRunId: runtime.activeDungeonRunId,
    activeRunStartedMs: runtime.activeRunStartedMs,
    ending: runtime.ending,
  };
}

function runtimeWithPlayerState(
  runtime: Ch1LiveGateRuntimeState,
  player: Ch1PlayerState
): Ch1LiveGateRuntimeState {
  return {
    ...runtime,
    flags: [...player.flags],
    tracks: { ...player.tracks },
    ledger: player.ledger,
    latentSkills: player.latentSkills,
    testimonies: [...player.testimonies],
    ending: player.ending,
  };
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

export function ch1BeginLiveStory(
  runtime: Ch1LiveGateRuntimeState
): Ch1LiveGateRuntimeState {
  const player = ch1SetFlag(ch1RuntimePlayerState(runtime), CH1_FLAGS.started);
  return runtimeWithPlayerState(runtime, player);
}

export function ch1RecoverLiveFragment(
  runtime: Ch1LiveGateRuntimeState,
  fragmentId: string,
  nowMs: number
): Ch1LiveGateRuntimeState {
  const fragment = ch1Fragment(fragmentId);
  if (!fragment) throw new Error(`unknown Chapter 1 fragment: ${fragmentId}`);
  if (fragment.type === "playback") {
    return {
      ...runtime,
      availablePlaybackIds: addUnique(runtime.availablePlaybackIds, fragmentId),
    };
  }
  if (!ch1FragmentDeliveryEnabled(runtime.flags)) return runtime;
  return {
    ...runtime,
    ledger: ch1RecoverFragment(runtime.ledger, fragmentId, nowMs),
  };
}

export function ch1ReviseLiveFragment(
  runtime: Ch1LiveGateRuntimeState,
  fragmentId: string,
  nowMs: number
): Ch1LiveGateRuntimeState {
  const existing = runtime.ledger.entries.find(
    (entry) => entry.fragmentId === fragmentId
  );
  const ledger = existing
    ? {
        ...runtime.ledger,
        entries: runtime.ledger.entries.map((entry) =>
          entry.fragmentId === fragmentId ? { ...entry, revised: true } : entry
        ),
      }
    : ch1RecoverFragment(runtime.ledger, fragmentId, nowMs);
  return {
    ...runtime,
    ledger: {
      ...ledger,
      entries: ledger.entries.map((entry) =>
        entry.fragmentId === fragmentId ? { ...entry, revised: true } : entry
      ),
    },
  };
}

export function ch1ConsolidateLiveStory(
  runtime: Ch1LiveGateRuntimeState
): Ch1LiveGateRuntimeState {
  let player = ch1RuntimePlayerState(runtime);
  player = ch1SetFlag(player, CH1_FLAGS.act6TruthKnown);
  player = ch1SetFlag(player, CH1_FLAGS.jackieTrueIdentityKnown);
  player = { ...player, ledger: ch1ApplyConsolidation(player.ledger) };
  return runtimeWithPlayerState(runtime, player);
}

export type Ch1LiveStoryActionResult =
  | { ok: true; runtime: Ch1LiveGateRuntimeState; consumedItemId?: string }
  | { ok: false; runtime: Ch1LiveGateRuntimeState; reason: string };

export function ch1PlayLiveLog(
  runtime: Ch1LiveGateRuntimeState,
  fragmentId: string,
  nowMs: number
): Ch1LiveStoryActionResult {
  if (!runtime.availablePlaybackIds.includes(fragmentId)) {
    return { ok: false, runtime, reason: "That playback has not been recovered." };
  }
  const played = ch1Augur9PlayLog(runtime.augur9, fragmentId);
  if (!played.ok) return { ok: false, runtime, reason: played.reason };
  return {
    ok: true,
    runtime: {
      ...runtime,
      augur9: played.state,
      ledger: ch1RecoverFragment(runtime.ledger, fragmentId, nowMs),
    },
  };
}

export function ch1RechargeLiveAugur9(
  runtime: Ch1LiveGateRuntimeState,
  itemId: string
): Ch1LiveStoryActionResult {
  try {
    return {
      ok: true,
      runtime: { ...runtime, augur9: ch1Augur9Recharge(runtime.augur9, itemId) },
      consumedItemId: itemId,
    };
  } catch (error) {
    return {
      ok: false,
      runtime,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function ch1LinkLiveFragments(
  runtime: Ch1LiveGateRuntimeState,
  fragmentIds: readonly string[],
  nowMs: number
): Ch1LiveStoryActionResult {
  if (!runtime.ledger.linkingUnlocked) {
    return { ok: false, runtime, reason: "Fragment linking is not unlocked." };
  }
  if (
    fragmentIds.some(
      (fragmentId) =>
        !runtime.ledger.entries.some((entry) => entry.fragmentId === fragmentId)
    )
  ) {
    return { ok: false, runtime, reason: "A source fragment is missing." };
  }
  const recipe = ch1LinkRecipeFor(fragmentIds);
  if (!recipe) {
    return { ok: false, runtime, reason: "Those fragments do not form a valid link." };
  }
  const sorted = [...recipe.sources].sort();
  const linkPairs = sorted.slice(1).map(
    (fragmentId) => [sorted[0], fragmentId] as const
  );
  const existing = new Set(
    runtime.ledger.links.map((pair) => [...pair].sort().join("|"))
  );
  return {
    ok: true,
    runtime: {
      ...runtime,
      ledger: {
        ...ch1RecoverFragment(runtime.ledger, recipe.derives, nowMs),
        links: [
          ...runtime.ledger.links,
          ...linkPairs.filter(
            (pair) => !existing.has([...pair].sort().join("|"))
          ),
        ],
      },
    },
  };
}

export interface Ch1ObjectiveEffectsResult {
  runtime: Ch1LiveGateRuntimeState;
  itemGrants: string[];
  itemConsumes: string[];
}

function acceptedChoice(step: Ch1QuestStep, choice: string | undefined) {
  const spec = ch1ObjectiveChoiceSpec(step);
  if (!spec) return true;
  if (step.id === "give_the_ledger" && choice === "not_yet") return false;
  return spec.options.some((option) => option.id === choice);
}

export function ch1ApplyLiveObjectiveEffects(args: {
  runtime: Ch1LiveGateRuntimeState;
  quest: Ch1QuestDef;
  step: Ch1QuestStep;
  stepIndex: number;
  choice?: string;
  nowMs: number;
}): Ch1ObjectiveEffectsResult {
  const effectKey = `${args.quest.id}/${args.step.id}`;
  if (args.runtime.appliedObjectiveEffects.includes(effectKey)) {
    return { runtime: args.runtime, itemGrants: [], itemConsumes: [] };
  }
  if (!acceptedChoice(args.step, args.choice)) {
    throw new Error(
      args.step.id === "give_the_ledger" && args.choice === "not_yet"
        ? "The ledger remains in your hands."
        : "Choose a valid response before completing this objective."
    );
  }

  const storyWasStarted = args.runtime.flags.includes(CH1_FLAGS.started);
  let runtime = ch1BeginLiveStory(args.runtime);
  let player = ch1RuntimePlayerState(runtime);
  const itemGrants = [...(args.step.grants ?? [])].filter(
    (itemId) =>
      !(
        args.step.id === "d1_sun_court" &&
        args.choice === "stealth_bypass" &&
        itemId === "item_bulls_core"
      )
  );
  const itemConsumes: string[] = [];
  if (!storyWasStarted) {
    itemGrants.push("item_grey_card");
  }

  if (args.step.id === "collect_testimonies") {
    player = { ...player, testimonies: CH1_TESTIMONIES.map((entry) => entry.id) };
  }
  if (args.step.id === "put_it_together") {
    player = {
      ...player,
      ledger: ch1RecoverFragment(
        player.ledger,
        CH1_TESTIMONY_REWARD_FRAGMENT,
        args.nowMs
      ),
    };
  }
  if (args.step.id === "open_the_tab") {
    // This playback is authored as becoming available when the memory ledger
    // opens, but unlike the other logs it is not attached directly to a quest
    // step's fragmentId. Keep that content trigger explicit here so normal
    // play and reconstructed E2E checkpoints produce the same linkable set.
    runtime = {
      ...runtime,
      availablePlaybackIds: addUnique(
        runtime.availablePlaybackIds,
        "frag_a2_play_the_ninth_signature"
      ),
    };
  }
  if (args.step.id === "d2_hallrs_choice") {
    player = ch1RecordHallrChoice(
      player,
      args.choice as "let_run" | "hold_stall"
    );
    runtime = { ...runtime, hallrChoice: args.choice as "let_run" | "hold_stall" };
  }
  if (args.step.id === "the_final_choice") {
    player = ch1ChooseEnding(player, args.choice as Ch1Ending);
  }
  if (args.step.id === "give_the_ledger") {
    itemConsumes.push("item_sorrel_field_ledger");
  }
  if (args.step.id === "resume_dosing") {
    itemConsumes.push("item_ch1_compound_b");
  }
  if (args.step.id === "d1_the_long_walk") {
    itemGrants.push("item_marrow_collar");
  }

  for (const flag of args.step.setsFlags ?? []) {
    player = ch1SetFlag(player, flag);
  }
  if (args.step.latentSkillId) {
    player = {
      ...player,
      latentSkills: ch1UnlockLatentSkill(
        player.latentSkills,
        args.step.latentSkillId as Ch1LatentSkillId
      ),
    };
  }

  const isFinalStep = args.stepIndex === args.quest.steps.length - 1;
  if (isFinalStep) {
    for (const flag of args.quest.setsFlags ?? []) {
      player = ch1SetFlag(player, flag);
    }
    for (const delta of args.quest.trackDeltas ?? []) {
      player = ch1AdjustTrack(player, delta.track, delta.delta);
    }
  }

  if (player.flags.includes(CH1_FLAGS.act5Linking)) {
    player = {
      ...player,
      ledger: { ...player.ledger, linkingUnlocked: true },
    };
  }
  if (args.step.fragmentId && args.step.id !== "put_it_together") {
    const fragment = ch1Fragment(args.step.fragmentId);
    if (fragment?.type === "playback") {
      runtime = {
        ...runtime,
        availablePlaybackIds: addUnique(
          runtime.availablePlaybackIds,
          args.step.fragmentId
        ),
      };
    } else if (ch1FragmentDeliveryEnabled(player.flags)) {
      player = {
        ...player,
        ledger: ch1RecoverFragment(
          player.ledger,
          args.step.fragmentId,
          args.nowMs
        ),
      };
    }
  }
  if (player.flags.includes(CH1_FLAGS.act6TruthKnown)) {
    player = { ...player, ledger: ch1ApplyConsolidation(player.ledger) };
  }

  runtime = runtimeWithPlayerState(runtime, player);
  runtime = {
    ...runtime,
    ending: player.ending,
    appliedObjectiveEffects: addUnique(
      runtime.appliedObjectiveEffects,
      effectKey
    ),
  };
  if (!CH1_ENDINGS.includes(runtime.ending as Ch1Ending)) {
    runtime.ending = undefined;
  }
  return {
    runtime,
    itemGrants: [...new Set(itemGrants)],
    itemConsumes: [...new Set(itemConsumes)],
  };
}
