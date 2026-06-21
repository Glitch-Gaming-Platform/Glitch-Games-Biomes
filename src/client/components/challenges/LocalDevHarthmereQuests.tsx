import {
  combatActionsForHarthmereNpc,
  getHarthmereCombatNpcStatus,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  economyActionsForHarthmereNpc,
  recordHarthmereEconomicEvent,
} from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import {
  consumeHarthmereItemByItemId,
  grantHarthmereItem,
  grantHarthmereQuestInventoryReward,
  harthmereInventoryCountByItemId,
  inventoryActionsForHarthmereNpc,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { gatheringActionsForHarthmereNpc } from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { buildingActionsForHarthmereNpc } from "@/client/components/challenges/LocalDevHarthmereBuildingSystem";
import {
  BUILDING_SYSTEM_GROVE_STEWARD_NPC,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST,
} from "@/shared/harthmere/building_system";
import { guildActionsForHarthmereNpc } from "@/client/components/challenges/LocalDevHarthmereGuildSystem";
import { classSkillActionsForHarthmereNpc } from "@/client/components/challenges/LocalDevHarthmereClassSkillSystem";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  buildHarthmereDialogueLines,
  dialogueActionsForHarthmereNpc,
} from "@/client/components/challenges/LocalDevHarthmereDialogueSystem";
import {
  awardHarthmereQuestXp,
  levelingActionsForHarthmereNpc,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  readHarthmereReputationState,
  recordHarthmereQuestAccepted,
  recordHarthmereQuestStepCompleted,
  reputationActionsForHarthmereNpc,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  getHarthmereWorldMapBounds,
  shiftHarthmereAuthoredPositionToWorld,
} from "@/shared/harthmere/coordinate_transform";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import { readSnapshotGroveQuestState } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  BIOMES_GAME_NAME,
  BIOMES_HARTHMERE_TOWN_NAME,
} from "@/shared/biomes/display_names";
import {
  HARTHMERE_BIOMES_ECS_CHALLENGES_UPDATED_EVENT,
  createHarthmereBiomesEcsChallenges,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import {
  isHarthmereRepeatableQuestAvailable,
  recordHarthmereQuestEconomyCompletion,
} from "@/client/components/challenges/LocalDevHarthmereQuestEconomySystem";
import { HARTHMERE_JOBS_BOARD_OPEN_EVENT } from "@/client/components/challenges/harthmereEvents";
import type { BiomesId } from "@/shared/ids";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOCAL_DEV_NPC_ID_BASE = 8_810_000_000_010_000;
const LOCAL_DEV_NPC_ID_LIMIT = 8_810_000_000_020_000;
export const HARTHMERE_QUEST_STATE_KEY = "biomes.localDev.harthmere.questState";
export const HARTHMERE_MISSION_EVENTS_KEY =
  "biomes.localDev.harthmere.missionEvents";
export const SNAPSHOT_MARKET_BOARD_ACTIVATION_EVENT =
  "harthmere.market_board.activate";

export const HARTHMERE_READ_JOBS_BOARD_QUEST_ID = "read-the-jobs-board";
export const HARTHMERE_READ_JOBS_BOARD_TITLE = "Read the Jobs Board";
export const HARTHMERE_JOBS_BOARD_TARGET_OFFSET = 140_041;
export const HARTHMERE_JOBS_BOARD_MARKER_ID = "harthmere_market_posting_board";
export const HARTHMERE_JOBS_BOARD_READ_EVENT = "harthmere.jobs_board.read";

// HARTHMERE_QUEST_ITEM_FLOW:
// Quest steps can optionally grant an item when the step completes (e.g.,
// talking to an orchard worker can add a basket of apples) and/or require an item to
// be present in the player's inventory before completion is allowed (e.g.,
// "Return the apples to Maren"). Both fields are optional so existing
// dialogue-only steps keep working unchanged.
export interface HarthmereQuestStep {
  objective: string;
  targetOffset: number;
  completion: string;
  grantsItemId?: string;
  grantsQuantity?: number;
  requiresItemId?: string;
  requiresQuantity?: number;
  consumesOnComplete?: boolean;
}

export interface HarthmereQuestDefinition {
  id: string;
  title: string;
  giverOffsets: number[];
  boardListed?: boolean;
  repeatable?: boolean;
  summary: string;
  reward: string;
  steps: HarthmereQuestStep[];
}

export interface HarthmereQuestState {
  active: Record<string, number>;
  completed: string[];
}

const EMPTY_STATE: HarthmereQuestState = {
  active: {},
  completed: [],
};

const HARTHMERE_AUTOSTART_QUEST_IDS = [
  HARTHMERE_READ_JOBS_BOARD_QUEST_ID,
] as const;

export function createHarthmereStarterQuestState(): HarthmereQuestState {
  return {
    active: Object.fromEntries(
      HARTHMERE_AUTOSTART_QUEST_IDS.map((questId) => [questId, 0])
    ),
    completed: [],
  };
}

export function normalizeHarthmereQuestState(
  parsed: Partial<HarthmereQuestState> | undefined
): HarthmereQuestState {
  const parsedState = parsed ?? {};
  const rawActive =
    parsedState.active && typeof parsedState.active === "object"
      ? parsedState.active
      : {};
  const active: Record<string, number> = {};

  for (const [questId, rawStepIndex] of Object.entries(rawActive)) {
    const quest = QUESTS.find((entry) => entry.id === questId);
    if (!quest) {
      continue;
    }
    const numericStep = Number(rawStepIndex);
    active[questId] = Number.isFinite(numericStep)
      ? Math.max(0, Math.min(quest.steps.length - 1, Math.trunc(numericStep)))
      : 0;
  }

  const rawCompleted = Array.isArray(parsedState.completed)
    ? parsedState.completed
    : [];
  const completed = [
    ...new Set(
      rawCompleted.filter(
        (questId): questId is string =>
          typeof questId === "string" &&
          QUESTS.some((entry) => entry.id === questId)
      )
    ),
  ];

  for (const questId of HARTHMERE_AUTOSTART_QUEST_IDS) {
    if (!completed.includes(questId) && active[questId] === undefined) {
      active[questId] = 0;
    }
  }

  return { active, completed };
}

export const QUESTS: HarthmereQuestDefinition[] = [
  {
    id: HARTHMERE_READ_JOBS_BOARD_QUEST_ID,
    title: HARTHMERE_READ_JOBS_BOARD_TITLE,
    giverOffsets: [],
    boardListed: false,
    summary:
      "Find the Jobs Board so new players understand where public work, seeker tasks, and business requests live.",
    reward: "Jobs Board unlocked, public work routing, and first-job guidance.",
    steps: [
      {
        objective: "Read the Jobs Board.",
        targetOffset: HARTHMERE_JOBS_BOARD_TARGET_OFFSET,
        completion:
          "You read the Jobs Board. It lists town, guild, business, NPC, and player work that seekers can accept in person.",
      },
    ],
  },
  {
    id: BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId,
    title: BUILDING_SYSTEM_MIRA_INTRO_QUEST.displayName,
    giverOffsets: [BUILDING_SYSTEM_GROVE_STEWARD_NPC.idOffset],
    boardListed: true,
    summary:
      "Meet Mira in the Grove so new players can find the Building System, buy safe land, and understand voxel-only construction.",
    reward: "Building System guidance and Grove plot marker access.",
    steps: [
      {
        objective: BUILDING_SYSTEM_MIRA_INTRO_QUEST.objective,
        targetOffset: BUILDING_SYSTEM_GROVE_STEWARD_NPC.idOffset,
        completion:
          "Mira explains land claims, safe muck clearing, voxel construction, property permissions, taxes, repairs, upgrades, and demolition rules.",
      },
    ],
  },
  {
    id: "welcome-to-harthmere",
    title: "Welcome to Harthmere",
    giverOffsets: [41, 42, 1, 27],
    boardListed: true,
    summary:
      "Learn the starter town route from the market anchor: board, guide, services, gate, guard yard, then choose a road out.",
    reward:
      "New Arrival title, bread, a repair voucher, and a clear route through town.",
    steps: [
      {
        objective: "Read the Market Board beside the fountain.",
        targetOffset: 41,
        completion:
          "The board orients you around the fountain and points you to Mara Thistle in the square.",
      },
      {
        objective: "Speak with Mara Thistle in Market Square.",
        targetOffset: 28,
        completion:
          "I explain the beginner service loop: bread, bank, blade, blessing, then the gate.",
      },
      {
        objective: "Visit the Black Anvil and speak with Master Osric Vale.",
        targetOffset: 29,
        completion:
          "I explain repairs, crafting orders, and why the Guard always needs more hinges.",
      },
      {
        objective: "Visit Harthmere Bank and speak with Merl Voss.",
        targetOffset: 6,
        completion: "I show you the vault, lockboxes, and storage services.",
      },
      {
        objective: "Visit the Copper Kettle and speak with Elowen Pike.",
        targetOffset: 30,
        completion:
          "I show you where travelers rest, hear rumors, and find group work.",
      },
      {
        objective:
          "Light a candle at Temple Green by speaking with Father Aldren.",
        targetOffset: 31,
        completion:
          "I give you a road blessing and the first warning about the Missing Bell.",
      },
      {
        objective: "Speak with Sergeant Bram Holt at the North Gate.",
        targetOffset: 27,
        completion:
          "I check your name against the gate ledger and point you toward the Guard Yard.",
      },
      {
        objective: "Report to Drill Instructor Hal in the Guard Yard.",
        targetOffset: 44,
        completion: "I point out the training dummies and bounty board.",
      },
      {
        objective:
          "Return to the Market Board and choose a first route: Farms, Docks, or Old Drains.",
        targetOffset: 41,
        completion:
          "You now understand Harthmere's services and can choose your first adventure route.",
      },
    ],
  },
  {
    id: "apples-for-dawnloaf",
    title: "Apples for Dawnloaf",
    giverOffsets: [41, 5, 63],
    boardListed: true,
    summary: "Help the bakery restock apples from the orchard.",
    reward: "Apple tart, coin, and Dawn Loaf reputation.",
    steps: [
      {
        objective: "Ask Maren Dawnloaf what the bakery needs.",
        targetOffset: 5,
        completion: "I need clean orchard apples for road cakes.",
      },
      {
        // HARTHMERE_QUEST_ITEM_FLOW: Ren actually drops an apple basket
        // into the player's quest pouch on this step's completion.
        objective: "Speak with Apple Picker Ren in the orchard.",
        targetOffset: 63,
        completion:
          "I give you a basket of usable apples and warn you about the road after dark.",
        grantsItemId: "apple_basket",
        grantsQuantity: 1,
      },
      {
        // HARTHMERE_QUEST_ITEM_FLOW: Maren refuses the turn-in until the
        // apple basket is actually in the player's inventory, then consumes it
        // when the step is marked complete.
        objective: "Return the apples to Maren Dawnloaf.",
        targetOffset: 5,
        completion:
          "I set warm apple tarts on the counter and thank you for helping feed the road guards.",
        requiresItemId: "apple_basket",
        requiresQuantity: 1,
        consumesOnComplete: true,
      },
    ],
  },
  {
    id: "missing-lockbox",
    title: "Missing Lockbox",
    giverOffsets: [41, 6],
    boardListed: true,
    summary: "Track a missing bank lockbox through the market and Mudden Ward.",
    reward: "Coin, storage favor, and a clue about local thieves.",
    steps: [
      {
        objective: "Ask Banker Merl Voss about the missing lockbox.",
        targetOffset: 6,
        completion:
          "I admit the lockbox vanished between the counter and the courier desk.",
      },
      {
        objective: "Ask Courier Anwen whether she saw the lockbox.",
        targetOffset: 43,
        completion: "I remember a wet footprint near the delivery bags.",
      },
      {
        objective: "Ask Nessa Crowe about wet footprints in Mudden Ward.",
        targetOffset: 33,
        completion: "I say the print leads toward a drain, not a thief's room.",
      },
      {
        objective: "Return to Banker Merl Voss with the clue.",
        targetOffset: 6,
        completion: "I unlock a small storage favor and reluctantly thank you.",
      },
    ],
  },
  {
    id: "cold-iron-hot-temper",
    title: "Cold Iron, Hot Temper",
    giverOffsets: [41, 29, 7],
    boardListed: true,
    summary: "Help the smithy prepare training weapons for the Guard Yard.",
    reward: "Repair voucher and beginner weapon favor.",
    steps: [
      {
        objective: "Speak with Master Osric Vale at the Black Anvil.",
        targetOffset: 29,
        completion: "I list the missing nails, hinges, and cold iron scraps.",
      },
      {
        objective: "Ask Forge Apprentice Luth to prepare the scrap bundle.",
        targetOffset: 67,
        completion:
          "I get the scrap ready and promise not to overheat it this time.",
      },
      {
        objective: "Report to Drill Instructor Hal in the Guard Yard.",
        targetOffset: 44,
        completion: "I accept the training gear and update the Guard notice.",
      },
    ],
  },
  {
    id: "fever-tea",
    title: "Fever Tea",
    giverOffsets: [41, 8, 47, 46],
    boardListed: true,
    summary: "Gather local herb knowledge for the healer and chapel.",
    reward: "Healing salve, chapel favor, and a road blessing.",
    steps: [
      {
        objective: "Speak with Luma at the healing shop.",
        targetOffset: 8,
        completion: "I ask for willow bark, mint, and clean water.",
      },
      {
        objective: "Ask Ysabet Fenlow to prepare the fever tea.",
        targetOffset: 47,
        completion: "I mix the remedy and complain about imprecise spoons.",
      },
      {
        objective: "Deliver the fever tea to Sister Maelle at the chapel.",
        targetOffset: 46,
        completion:
          "I bless the delivery and note that sickness rises whenever the river floods.",
      },
    ],
  },
  {
    id: "rumor-has-it",
    title: "Rumor Has It",
    giverOffsets: [41, 11, 30],
    boardListed: true,
    summary: "Talk to tavern patrons and identify the useful rumor.",
    reward: "Tavern token and unlocked rumor-board flavor.",
    steps: [
      {
        objective: "Ask Garrick the bartender how tavern rumors work.",
        targetOffset: 11,
        completion: "I say every table has a rumor, but only one pays.",
      },
      {
        objective: "Ask Bela the Storyteller about the Missing Bell.",
        targetOffset: 13,
        completion: "I say the bell was buried, not stolen.",
      },
      {
        objective: "Ask Kip the Card Player about the docks.",
        targetOffset: 14,
        completion: "I say odd crates arrive when the ferry bell is quiet.",
      },
      {
        objective: "Report the useful rumor to Elowen Pike.",
        targetOffset: 30,
        completion:
          "I decide the buried bell rumor is dangerous enough to remember.",
      },
    ],
  },
  {
    id: "loose-chickens",
    title: "Loose Chickens",
    repeatable: true,
    giverOffsets: [41, 10],
    boardListed: true,
    summary:
      "Help Tilda count the chicken yard before the bakery loses its eggs.",
    reward: "Eggs, coin, and farm favor.",
    steps: [
      {
        objective: "Speak with Tilda Fen at the farm.",
        targetOffset: 10,
        completion:
          "I ask you to count the chickens and check the scarecrow fence.",
      },
      {
        objective:
          "Ask Pip the mascot whether the chickens escaped toward the market.",
        targetOffset: 4,
        completion: "I deny eating any evidence and point back to the farm.",
      },
      {
        objective: "Return to Tilda Fen with the count.",
        targetOffset: 10,
        completion:
          "I declare the flock mostly accounted for, which is close enough for chickens.",
      },
    ],
  },
  {
    id: "whispering-crate",
    title: "Whispering Crate",
    giverOffsets: [41, 34, 65],
    boardListed: true,
    summary: "Investigate a strange black crate on the docks.",
    reward: "Dock reputation or a River Knots hint.",
    steps: [
      {
        objective: "Ask Tovin Reed about the strange crate.",
        targetOffset: 34,
        completion:
          "I say the crate is nobody's problem, which means it is my problem.",
      },
      {
        objective: "Ask the River Knots Lookout what the crate is hiding.",
        targetOffset: 65,
        completion: "I say the crate was dry inside after three days in rain.",
      },
      {
        objective:
          "Return to the Market Board and choose whether to report or hide the clue.",
        targetOffset: 41,
        completion:
          "The clue is logged as a future branch between Watch trust and River Knots trust.",
      },
    ],
  },
  {
    id: "the-missing-bell",
    title: "The Missing Bell",
    giverOffsets: [41, 31, 62],
    boardListed: true,
    summary:
      "Start Harthmere's main mystery: chapel bell, old well, drains, and buried bronze.",
    reward: "Unlocks the Underways story route and future dungeon hook.",
    steps: [
      {
        objective: "Ask Father Aldren why the chapel has no bell.",
        targetOffset: 31,
        completion:
          "I admit the bell was hidden because it rang for things below the town.",
      },
      {
        objective: "Speak with Bell-Witness Ora near the Old Well.",
        targetOffset: 62,
        completion: "I heard the bell from beneath the square at dawn.",
      },
      {
        objective: "Ask Nessa Crowe about the drains under Mudden Ward.",
        targetOffset: 33,
        completion: "I say the drains lead to older stones and colder water.",
      },
      {
        objective:
          "Inspect the Underways entrance by speaking with the Echo near the bars.",
        targetOffset: 70,
        completion:
          "The old bronze marks answer the bell's name. The Underways should unlock in the next content pass.",
      },
    ],
  },
];

// HARTHMERE_PERF_AND_PLACEMENT — Mission target Y override map.
//
// The mission-audit current series repeatedly flagged "mission target Y looks
// wrong; target delta is -19 blocks" on the Whispering Crate marker. The cause
// is identical to the NPC bury bug: QUEST_TARGETS holds authored Y values
// (mostly y=58), but the live snapshot terrain at those XZ positions has
// raised structures that put feet at y=68, y=73, etc. current overrides Y at the
// transform boundary using the same cluster measurements the server uses for
// NPC placement, so markers, NPCs, and the audit all agree.
const HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y: Record<string, number> = {
  // Plaza fountain (audit-measured y=68)
  "Market Board": 68,
  "Master Osric Vale": 68,

  // Black Anvil smithy / Craftsman Row (y=68)
  "Weapons Teller": 68,
  "Forge Apprentice Luth": 68,

  // Bank / Services (audit-measured y=58)
  "Harthmere Bank": 58,
  "Courier Anwen": 58,

  // Copper Kettle tavern (audit-measured y=63)
  "Copper Kettle Bar": 63,
  "Elowen Pike": 63,
  "Bela the Storyteller": 63,
  "Kip the Card Player": 63,

  // River Docks (audit-measured y=73)
  "Tovin Reed": 73,
  "River Knots Lookout": 73,

  // Apothecary / Magic Shop belt (y=58)
  "Green Mortar Healer": 58,
  "Ysabet Fenlow": 58,
  "Wyrm & Candle Magic Shop": 58,

  // Mara Thistle moved with the market belt — authored at y=53 is correct
  "Mara Thistle": 53,
  "Pip, Harbor Mascot": 53,
  "Dawn Loaf Bakery": 53,

  // Chapel / Temple Green (y=53 already correct, kept explicit so any future
  // re-raise of the chapel terrain only needs editing one place)
  "Father Aldren": 53,
  "Sister Maelle": 53,

  // Guard Yard / North Gate
  "Sergeant Bram Holt": 58,
  "Drill Instructor Hal": 58,

  // Other anchors with measured/inferred clusters
  "Nessa Crowe": 53,
  "Apple Picker Ren": 53,
  "Bell-Witness Ora": 53,
  "Underways Echo": 53,
  "Farm and Chicken Yard": 53,
};

export const HARTHMERE_QUEST_TARGET_VERSION =
  "harthmere-quest-target-cluster-feet-y";

function harthmereQuestTargetFeetYForLabel(
  label: string | undefined,
  authoredY: number
) {
  if (!label) return authoredY;
  const override = HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y[label];
  return override === undefined ? authoredY : override;
}

export function getHarthmereQuestTargetWorldPos(
  target: HarthmereQuestTarget
): [number, number, number] {
  const overrideY = harthmereQuestTargetFeetYForLabel(
    target.label,
    target.pos[1]
  );
  const shifted = shiftHarthmereAuthoredPositionToWorld(target.pos);
  // Note: shifting preserves Y already; current just substitutes the cluster Y.
  return [shifted[0], overrideY, shifted[2]];
}

function harthmereQuestTargetGuide(step: HarthmereQuestStep | undefined) {
  if (!step) {
    return "No current objective is available.";
  }
  const target = QUEST_TARGETS[step.targetOffset];
  const targetCopy = target
    ? `Target: ${target.label} in ${target.district}.`
    : "Target: follow the active map marker.";
  return `${step.objective} ${targetCopy} Use the Harthmere Quest Map button to mark the exact stop.`;
}

function harthmereQuestNextLeadCopy(
  quest: HarthmereQuestDefinition,
  nextIndex: number
) {
  const nextStep = quest.steps[nextIndex];
  if (!nextStep) {
    return `Quest complete. Reward available: ${quest.reward}. Return to the Market Board for another route if you need a next lead.`;
  }
  return `Next lead: ${harthmereQuestTargetGuide(nextStep)}`;
}

const HARTHMERE_EXTRA_DIALOGUE: Record<number, string[]> = {
  5: [
    "I wipe flour from my hands before speaking; the oven is running hot and the road cakes are behind schedule.",
    "I keep glancing toward the orchard road, where the apple crates should have arrived by now.",
  ],
  6: [
    "I lower my voice when lockboxes are mentioned. A missing seal in a bank is never just a missing seal.",
    "The queue space in front of the counter stays clear; nobody is allowed to crowd the vault side.",
  ],
  7: [
    "I rest one hand on the counter, close enough to the practice blades to make the point without saying it.",
    "The weapons here are for training and town defense, not tavern boasting.",
  ],
  8: [
    "I check the shelf labels twice before answering, as if the wrong bottle could ruin someone's week.",
    "Clean cloth, fever tea, and quiet hands matter more here than heroic speeches.",
  ],
  9: [
    "I speak around the candlelight, careful not to disturb the open books on the stand.",
    "The old markings I study look uncomfortably close to the symbols near the well.",
  ],
  10: [
    "I keep the animals in sight while I talk; a loose gate can ruin a morning faster than rain.",
    "The farm's needs are simple: feed, water, fences, and enough quiet to finish the rows.",
  ],
  11: [
    "I hear the room without looking away from the bar. Rumors arrive here wearing wet boots and nervous smiles.",
    "If trouble starts, the regulars know which tables to push aside and which doors to use.",
  ],
  27: [
    "I point out the town route like someone who has watched too many travelers get lost before lunch.",
    "The North Gate opens toward the market fountain; from there, bread, bank, blade, blessing, and drill yard all branch cleanly.",
  ],
  28: [
    "I can name three vendors arguing, two guards pretending not to listen, and one child moving too quickly through the crowd.",
    "I say a newcomer should learn the square before chasing stories into the drains.",
  ],
  29: [
    "I let the forge answer first. When I do speak, it is plain and measured.",
    "I care about work that keeps people alive: hinges, nails, shields, and blades that do not fail in panic.",
  ],
  30: [
    "I make hospitality feel easy, but my eyes keep count of every exit and every stranger.",
    "I say the best rumors are the ones people repeat after pretending not to hear them.",
  ],
  31: [
    "My gaze moves briefly to the empty bell frame before returning to you.",
    "The chapel asks for candles, medicine, and patience more often than coin.",
  ],
  33: [
    "I stay half in shadow and half in the lane, close enough to vanish if the Watch rounds the corner.",
    "I know which drains flood, which doors stick, and which favors cost more than money.",
  ],
  34: [
    "I tap the cargo ledger once, then the pier rail, as if both can lie in different ways.",
    "Dock work is simple until a crate arrives with no owner and everyone pretends not to notice.",
  ],
  41: [
    "Map notes: North Gate to the north, Market at the center, Bank and Smithy east, Inn and Bakery west, Chapel north-east, Docks east, Farm south-west, Old Well near the square.",
    "The newest notices point newcomers toward a safe town route before sending them to farms, docks, or drains.",
  ],
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function harthmereAvailableQuestIdsForBiomesEcs(state: HarthmereQuestState) {
  return QUESTS.filter((quest) => {
    if (state.active[quest.id] !== undefined) {
      return false;
    }
    if (!state.completed.includes(quest.id)) {
      return true;
    }
    return quest.repeatable && isHarthmereRepeatableQuestAvailable(quest.id);
  }).map((quest) => quest.id);
}

function dispatchHarthmereQuestBiomesEcsProjection(state: HarthmereQuestState) {
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_BIOMES_ECS_CHALLENGES_UPDATED_EVENT, {
      detail: createHarthmereBiomesEcsChallenges({
        active: Object.fromEntries(
          Object.keys(state.active).map((questId) => [
            questId,
            { startedAtMs: 0 },
          ])
        ),
        completed: Object.fromEntries(
          state.completed.map((questId) => [questId, 0])
        ),
        available: harthmereAvailableQuestIdsForBiomesEcs(state),
      }),
    })
  );
}

export function readHarthmereQuestState(): HarthmereQuestState {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_QUEST_STATE_KEY);
    if (!raw) {
      return createHarthmereStarterQuestState();
    }
    return normalizeHarthmereQuestState(
      JSON.parse(raw) as Partial<HarthmereQuestState>
    );
  } catch {
    return createHarthmereStarterQuestState();
  }
}

export function writeHarthmereQuestState(state: HarthmereQuestState) {
  if (!isBrowser()) {
    return;
  }
  const normalized = normalizeHarthmereQuestState(state);
  window.localStorage.setItem(
    HARTHMERE_QUEST_STATE_KEY,
    JSON.stringify(normalized)
  );
  dispatchHarthmereQuestBiomesEcsProjection(normalized);
  window.dispatchEvent(new Event("biomes:harthmere-quest-state-changed"));
}

function readQuestState(): HarthmereQuestState {
  return readHarthmereQuestState();
}

function writeQuestState(state: HarthmereQuestState) {
  writeHarthmereQuestState(state);
}

function entityOffset(entityId: BiomesId) {
  const numericId = Number(entityId);
  if (
    numericId < LOCAL_DEV_NPC_ID_BASE ||
    numericId >= LOCAL_DEV_NPC_ID_LIMIT
  ) {
    return undefined;
  }
  return numericId - LOCAL_DEV_NPC_ID_BASE;
}

function textBlocks(lines: string[]) {
  return lines
    .map((line) => (line.includes("<text>") ? line : `<text>${line}</text>`))
    .join("{break}");
}

function recordMissionEvent(kind: string, title: string, detail: string) {
  if (!isBrowser()) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_MISSION_EVENTS_KEY);
    const events = raw ? (JSON.parse(raw) as unknown[]) : [];
    const next = [
      {
        at: Date.now(),
        kind,
        title,
        detail,
      },
      ...events,
    ].slice(0, 12);
    window.localStorage.setItem(
      HARTHMERE_MISSION_EVENTS_KEY,
      JSON.stringify(next)
    );
    window.dispatchEvent(new Event("biomes:harthmere-mission-event"));
  } catch {
    // Ignore malformed local-dev mission event history.
  }
}

function activeObjectiveLines(state: HarthmereQuestState) {
  return QUESTS.flatMap((quest) => {
    const stepIndex = state.active[quest.id];
    if (stepIndex === undefined) {
      return [];
    }
    const step = quest.steps[stepIndex];
    if (!step) {
      return [];
    }
    return [`Active: ${quest.title} — ${step.objective}`];
  });
}

function availableQuestsForOffset(offset: number, state: HarthmereQuestState) {
  return QUESTS.filter((quest) => {
    if (state.completed.includes(quest.id)) {
      if (!quest.repeatable) {
        return false;
      }
      if (!isHarthmereRepeatableQuestAvailable(quest.id)) {
        return false;
      }
    }
    if (state.active[quest.id] !== undefined) {
      return false;
    }
    if (isHarthmereJobsBoardOffset(offset) && quest.boardListed) {
      return true;
    }
    return quest.giverOffsets.includes(offset);
  });
}

function matchingActiveQuests(offset: number, state: HarthmereQuestState) {
  return QUESTS.filter((quest) => {
    const stepIndex = state.active[quest.id];
    if (stepIndex === undefined) {
      return false;
    }
    return quest.steps[stepIndex]?.targetOffset === offset;
  });
}

function completeStep(
  state: HarthmereQuestState,
  quest: HarthmereQuestDefinition
): HarthmereQuestState {
  const stepIndex = state.active[quest.id] ?? 0;
  const nextStep = stepIndex + 1;
  const active = { ...state.active };
  let completed = [...state.completed];
  if (nextStep >= quest.steps.length) {
    delete active[quest.id];
    if (!completed.includes(quest.id)) {
      completed = [...completed, quest.id];
    }
  } else {
    active[quest.id] = nextStep;
  }
  return { active, completed };
}

function acceptQuest(
  state: HarthmereQuestState,
  quest: HarthmereQuestDefinition,
  acceptingOffset?: number
): HarthmereQuestState {
  const activeStepIndex = initialQuestStepIndexOnAccept(quest, acceptingOffset);
  return {
    ...state,
    active: {
      ...state.active,
      [quest.id]: activeStepIndex,
    },
  };
}

function initialQuestStepIndexOnAccept(
  quest: HarthmereQuestDefinition,
  acceptingOffset?: number
) {
  if (acceptingOffset === undefined || quest.steps.length <= 1) {
    return 0;
  }
  return quest.steps[0]?.targetOffset === acceptingOffset ? 1 : 0;
}

export function completeHarthmereJobsBoardReadQuest(
  reason = HARTHMERE_JOBS_BOARD_READ_EVENT
) {
  if (!isBrowser()) {
    return { changed: false, reason: "not_browser" as const };
  }

  const quest = QUESTS.find(
    (entry) => entry.id === HARTHMERE_READ_JOBS_BOARD_QUEST_ID
  );
  if (!quest) {
    return { changed: false, reason: "missing_quest" as const };
  }

  const current = readQuestState();
  if (current.completed.includes(HARTHMERE_READ_JOBS_BOARD_QUEST_ID)) {
    return { changed: false, reason: "already_completed" as const };
  }

  const next: HarthmereQuestState = {
    active: { ...current.active },
    completed: [...current.completed, HARTHMERE_READ_JOBS_BOARD_QUEST_ID],
  };
  delete next.active[HARTHMERE_READ_JOBS_BOARD_QUEST_ID];

  writeQuestState(next);
  recordMissionEvent(
    "completed",
    quest.title,
    `${quest.steps[0]?.completion ?? "Jobs Board read."} · ${reason}`
  );
  recordHarthmereQuestStepCompleted(
    quest.id,
    quest.title,
    HARTHMERE_JOBS_BOARD_TARGET_OFFSET,
    true
  );
  awardHarthmereQuestXp(quest.id, quest.title, true);
  grantHarthmereQuestInventoryReward(quest.id, quest.title);

  return { changed: true, reason: "completed" as const };
}

function compactHarthmereNpcActions(actions: TalkDialogStepAction[]) {
  // SNAPSHOT_MARKET_BOARD_PRIORITY_FIX:
  // The Market Board is a mission router before it is a vendor/dialogue utility.
  // Previously the generic utility actions could fill all four slots before
  // "Complete:" or "Accept:" appeared, so Jackie/Bram could send the player
  // to the market and the board would look inert. Always reserve first slots
  // for mission progression, then add useful systems.
  const unique = actions.filter(
    (action, index) =>
      actions.findIndex((entry) => entry.name === action.name) === index
  );
  const selected: TalkDialogStepAction[] = [];
  const take = (
    predicate: (action: TalkDialogStepAction) => boolean,
    limit = 4
  ) => {
    let takenFromGroup = 0;
    for (const action of unique) {
      if (selected.length >= 4 || takenFromGroup >= limit) {
        break;
      }
      if (
        predicate(action) &&
        !selected.some((entry) => entry.name === action.name)
      ) {
        selected.push(action);
        takenFromGroup += 1;
      }
    }
  };

  take((action) => action.name === "Open Jobs Board", 1);
  take((action) => action.name.startsWith("Complete:"), 2);
  take((action) => action.name.startsWith("Accept:"), 2);
  take((action) => action.type === "primary", 1);
  take((action) => action.name === "What needs doing here?", 1);
  take((action) => action.name === "How do I read the notices?", 1);
  take((action) => action.name === "Remind me where to go.", 1);
  take((action) => action.name === "Browse goods", 1);
  take((action) => action.name === "Sell goods", 1);
  take(
    (action) =>
      action.name === "Repair equipped gear" ||
      action.name === "Ready an owned weapon" ||
      action.name === "Deposit materials" ||
      action.name === "Sell junk",
    1
  );
  take(
    (action) =>
      action.name === "Heard anything useful?" ||
      action.name === "Your work matters here." ||
      action.name === "What are the local laws?" ||
      action.name === "I saw something suspicious.",
    1
  );
  take(() => true, 4);
  return selected.slice(0, 4);
}

export function isHarthmereJobsBoardOffset(offset: number) {
  return offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET;
}

export function useLocalDevHarthmereDialog(
  talkingToNPCId: BiomesId,
  defaultDialog: string
):
  | {
      id: string;
      dialogText: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const offset = entityOffset(talkingToNPCId);
  const [state, setState] = useState<HarthmereQuestState>(() =>
    readQuestState()
  );
  const [reputationState, setReputationState] = useState(() =>
    readHarthmereReputationState()
  );
  const [combatRevision, setCombatRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setReputationState(readHarthmereReputationState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener("biomes:harthmere-reputation-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "biomes:harthmere-reputation-changed",
        refresh
      );
    };
  }, []);

  const refreshReputation = useCallback(() => {
    setReputationState(readHarthmereReputationState());
  }, []);

  useEffect(() => {
    const refreshCombat = () => setCombatRevision((value) => value + 1);
    window.addEventListener("storage", refreshCombat);
    window.addEventListener("biomes:harthmere-combat-changed", refreshCombat);
    return () => {
      window.removeEventListener("storage", refreshCombat);
      window.removeEventListener(
        "biomes:harthmere-combat-changed",
        refreshCombat
      );
    };
  }, []);

  return useMemo(() => {
    if (offset === undefined) {
      return undefined;
    }

    const isBoard = isHarthmereJobsBoardOffset(offset);
    const combatStatus = getHarthmereCombatNpcStatus(offset);
    // harthmere-death-ai-dialog-render
    // Dead NPCs should stop behaving like conversational/quest/shop actors.
    // The body can stay visible as a corpse, but the interaction menu must not
    // offer normal living-NPC actions after combat says HP reached zero.
    if (!isBoard && combatStatus.dead) {
      return {
        id: `harthmere-dead-${talkingToNPCId}-${combatRevision}-${combatStatus.hp}-${combatStatus.combatState}`,
        dialogText: `${combatStatus.name} is dead. There is no conversation to continue. Reset combat or wait for the configured respawn before interacting again.`,
        actions: [],
      };
    }

    const matching = matchingActiveQuests(offset, state);
    const available = availableQuestsForOffset(offset, state);
    const objectiveLines = activeObjectiveLines(state);
    const completedQuestTitles = QUESTS.filter((quest) =>
      state.completed.includes(quest.id)
    ).map((quest) => quest.title);
    const firstMatching = matching[0];
    const firstMatchingStep = firstMatching
      ? firstMatching.steps[state.active[firstMatching.id] ?? 0]
      : undefined;
    const lines = buildHarthmereDialogueLines({
      offset,
      defaultDialog,
      isBoard,
      activeObjectiveLines: objectiveLines,
      activeObjective: objectiveLines[0],
      availableQuestTitles: available.map((quest) => quest.title),
      completedQuestTitles,
      matchingQuestTitle: firstMatching?.title,
      matchingQuestObjective: firstMatchingStep?.objective,
      extraLines: HARTHMERE_EXTRA_DIALOGUE[offset],
      reputationState,
    });

    const actions: TalkDialogStepAction[] = [];

    actions.push(
      ...dialogueActionsForHarthmereNpc(offset, {
        activeObjective: objectiveLines[0],
        availableQuestTitles: available.map((quest) => quest.title),
        completedQuestTitles,
        matchingQuestTitle: firstMatching?.title,
        matchingQuestObjective: firstMatchingStep?.objective,
        onRefresh: refreshReputation,
      })
    );

    for (const quest of matching) {
      const step = quest.steps[state.active[quest.id] ?? 0];
      // HARTHMERE_QUEST_ITEM_FLOW:
      // If the step requires the player to be carrying a quest item, gate the
      // Complete button on that item actually being in the inventory. The
      // tooltip explains why so the user is not just stuck on a disabled
      // button.
      const requiresItemId = step?.requiresItemId;
      const requiresQuantity = step?.requiresQuantity ?? 1;
      const heldQuantity = requiresItemId
        ? harthmereInventoryCountByItemId(requiresItemId)
        : 0;
      const missingRequiredItem =
        requiresItemId !== undefined && heldQuantity < requiresQuantity;
      const requirementTooltip = missingRequiredItem
        ? `You need ${requiresQuantity} x ${requiresItemId} in your bag or quest pouch before this step can be turned in.`
        : undefined;
      actions.push({
        name: `Complete: ${quest.title}`,
        type: "primary",
        disabled: missingRequiredItem,
        tooltip: requirementTooltip ?? step?.objective,
        followUpText: step
          ? `${step.completion} ${harthmereQuestNextLeadCopy(
              quest,
              (state.active[quest.id] ?? 0) + 1
            )}`
          : undefined,
        onPerformed: () => {
          const current = readQuestState();
          const stepIndex = current.active[quest.id] ?? 0;
          const justFinishedStep = quest.steps[stepIndex];
          const completedQuest = stepIndex + 1 >= quest.steps.length;
          // HARTHMERE_QUEST_ITEM_FLOW: re-verify the item requirement at
          // click time in case state changed between render and click.
          if (justFinishedStep?.requiresItemId) {
            const stillHas = harthmereInventoryCountByItemId(
              justFinishedStep.requiresItemId
            );
            if (stillHas < (justFinishedStep.requiresQuantity ?? 1)) {
              return;
            }
          }
          const next = completeStep(current, quest);
          writeQuestState(next);
          // HARTHMERE_QUEST_ITEM_FLOW: consume the required item now that
          // the step is being marked complete.
          if (
            justFinishedStep?.requiresItemId &&
            justFinishedStep.consumesOnComplete
          ) {
            consumeHarthmereItemByItemId(
              justFinishedStep.requiresItemId,
              justFinishedStep.requiresQuantity ?? 1,
              `${quest.title}: turned in`
            );
          }
          // HARTHMERE_QUEST_ITEM_FLOW: hand over an item if the step's
          // completion says the NPC gives the player something.
          if (justFinishedStep?.grantsItemId) {
            grantHarthmereItem(
              justFinishedStep.grantsItemId,
              justFinishedStep.grantsQuantity ?? 1,
              `${quest.title}: received from step ${stepIndex + 1}`
            );
          }
          recordMissionEvent(
            completedQuest ? "completed" : "updated",
            quest.title,
            `${harthmereQuestNextLeadCopy(
              quest,
              completedQuest ? quest.steps.length : next.active[quest.id] ?? 0
            )}${
              isBoard
                ? ` · Market Board activation cue: ${SNAPSHOT_MARKET_BOARD_ACTIVATION_EVENT}`
                : ""
            }`
          );
          recordHarthmereQuestStepCompleted(
            quest.id,
            quest.title,
            offset,
            completedQuest
          );
          awardHarthmereQuestXp(quest.id, quest.title, completedQuest);
          if (completedQuest) {
            grantHarthmereQuestInventoryReward(quest.id, quest.title);
            recordHarthmereQuestEconomyCompletion(quest.id, quest.title);
            recordHarthmereEconomicEvent(
              "source",
              "Quest Economy Reward",
              `${quest.title} paid rewards and moved goods through the local economy.`
            );
          }
          setState(next);
          refreshReputation();
        },
      });
    }

    for (const quest of available.slice(0, isBoard ? 9 : 2)) {
      const initialStepIndex = initialQuestStepIndexOnAccept(quest, offset);
      const initialStep = quest.steps[initialStepIndex] ?? quest.steps[0];
      actions.push({
        name: `Accept: ${quest.title}`,
        tooltip: `${quest.summary} Reward: ${quest.reward}`,
        followUpText: `Accepted: ${quest.title}. Step ${initialStepIndex + 1}/${
          quest.steps.length
        }: ${harthmereQuestTargetGuide(initialStep)}`,
        onPerformed: () => {
          const next = acceptQuest(readQuestState(), quest, offset);
          writeQuestState(next);
          recordMissionEvent(
            "accepted",
            quest.title,
            `Current objective: ${harthmereQuestTargetGuide(initialStep)}${
              isBoard
                ? ` · Market Board activation cue: ${SNAPSHOT_MARKET_BOARD_ACTIVATION_EVENT}`
                : ""
            }`
          );
          recordHarthmereQuestAccepted(quest.id, quest.title, offset);
          setState(next);
          refreshReputation();
        },
      });
    }

    actions.push(...inventoryActionsForHarthmereNpc(offset));

    actions.push(...economyActionsForHarthmereNpc(offset));

    actions.push(...gatheringActionsForHarthmereNpc(offset));

    actions.push(...buildingActionsForHarthmereNpc(offset));

    actions.push(...guildActionsForHarthmereNpc(offset));

    actions.push(...classSkillActionsForHarthmereNpc(offset));

    actions.push(...combatActionsForHarthmereNpc(offset));

    actions.push(...levelingActionsForHarthmereNpc(offset));

    actions.push(
      ...reputationActionsForHarthmereNpc(offset, refreshReputation)
    );

    if (isBoard) {
      actions.push({
        name: "Open Jobs Board",
        type: "primary",
        tooltip: "Open the live Harthmere Jobs Board.",
        followUpText:
          "You open the Jobs Board. It lists public work, business requests, guild tasks, and seeker contracts posted for Harthmere.",
        closeAfterPerformed: true,
        onPerformed: () => {
          completeHarthmereJobsBoardReadQuest("jobs_board_panel_opened");
          setState(readQuestState());
          window.dispatchEvent(
            new CustomEvent(HARTHMERE_JOBS_BOARD_OPEN_EVENT)
          );
        },
      });
      actions.push({
        name: "Reset local-dev quests",
        tooltip:
          "Clears only the Harthmere local-dev quest/objective state stored in this browser.",
        followUpText:
          "Local-dev mission progress reset. The Market Board is ready for a clean quest test pass.",
        onPerformed: () => {
          const resetState = createHarthmereStarterQuestState();
          writeQuestState(resetState);
          recordMissionEvent(
            "reset",
            "Harthmere mission state",
            "Local-dev mission progress was reset from the Market Board, then starter quests were re-assigned."
          );
          setState(resetState);
        },
      });
    }

    return {
      id: `harthmere-${talkingToNPCId}-${JSON.stringify(state)}`,
      dialogText: textBlocks(lines),
      actions: compactHarthmereNpcActions(actions),
    };
  }, [
    combatRevision,
    defaultDialog,
    offset,
    refreshReputation,
    reputationState,
    state,
    talkingToNPCId,
  ]);
}

export type HarthmereQuestTarget = {
  label: string;
  district: string;
  pos: [number, number, number];
  icon: string;
};

export const QUEST_TARGETS: Record<number, HarthmereQuestTarget> = {
  4: {
    label: "Pip, Harbor Mascot",
    district: "Market",
    pos: [444, 58, -202],
    icon: "•",
  },
  5: {
    label: "Dawn Loaf Bakery",
    district: "Bakery",
    pos: [444, 58, -196],
    icon: "B",
  },
  6: {
    label: "Harthmere Bank",
    district: "Services",
    pos: [545, 58, -223],
    icon: "$",
  },
  7: {
    label: "Weapons Teller",
    district: "Black Anvil",
    pos: [535, 58, -219],
    icon: "⚔",
  },
  8: {
    label: "Green Mortar Healer",
    district: "Healing",
    pos: [447, 58, -185],
    icon: "+",
  },
  9: {
    label: "Wyrm & Candle Magic Shop",
    district: "Magic Shop",
    pos: [453, 58, -167],
    icon: "✦",
  },
  10: {
    label: "Farm and Chicken Yard",
    district: "Farm",
    pos: [444, 53, -236],
    icon: "F",
  },
  11: {
    label: "Copper Kettle Bar",
    district: "Tavern",
    pos: [531, 63, -187],
    icon: "T",
  },
  13: {
    label: "Bela the Storyteller",
    district: "Tavern",
    pos: [543, 63, -187],
    icon: "R",
  },
  14: {
    label: "Kip the Card Player",
    district: "Tavern",
    pos: [539, 64, -179],
    icon: "R",
  },
  27: {
    label: "Sergeant Bram Holt",
    district: "North Gate",
    pos: [512, 68, -266],
    icon: "G",
  },
  28: {
    label: "Mara Thistle",
    district: "Market",
    pos: [444, 58, -200],
    icon: "M",
  },
  29: {
    label: "Master Osric Vale",
    district: "Craftsman Row",
    pos: [506, 58, -220],
    icon: "A",
  },
  30: {
    label: "Elowen Pike",
    district: "Copper Kettle",
    pos: [532, 63, -187],
    icon: "I",
  },
  31: {
    label: "Father Aldren",
    district: "Temple Green",
    pos: [478, 58, -126],
    icon: "C",
  },
  33: {
    label: "Nessa Crowe",
    district: "Mudden Ward",
    pos: [404, 54, -160],
    icon: "N",
  },
  34: {
    label: "Tovin Reed",
    district: "River Docks",
    pos: [587, 53, -214],
    icon: "D",
  },
  41: {
    label: "Market Board",
    district: "Market Square",
    pos: [503, 58, -211],
    icon: "!",
  },
  43: {
    label: "Courier Anwen",
    district: "Services",
    pos: [549, 58, -213],
    icon: "@",
  },
  44: {
    label: "Drill Instructor Hal",
    district: "Guard Yard",
    pos: [512, 68, -256],
    icon: "!",
  },
  46: {
    label: "Sister Maelle",
    district: "Temple Green",
    pos: [478, 58, -126],
    icon: "C",
  },
  47: {
    label: "Ysabet Fenlow",
    district: "Healing",
    pos: [453, 58, -167],
    icon: "+",
  },
  62: {
    label: "Bell-Witness Ora",
    district: "Old Well",
    pos: [490, 58, -190],
    icon: "?",
  },
  63: {
    label: "Apple Picker Ren",
    district: "Orchard",
    pos: [458, 58, -108],
    icon: "O",
  },
  65: {
    label: "River Knots Lookout",
    district: "Docks",
    pos: [592, 53, -214],
    icon: "D",
  },
  67: {
    label: "Forge Apprentice Luth",
    district: "Black Anvil",
    pos: [525, 58, -232],
    icon: "A",
  },
  70: {
    label: "Underways Echo",
    district: "Underways",
    pos: [402, 58, -235],
    icon: "?",
  },
  // HARTHMERE_JOBS_BOARD_GROVE_PLACEMENT:
  // Moved from the Harthmere market square to The Grove (just east of the
  // fountain). Position matches the SNAPSHOT_GROVE_LANDMARKS entry for
  // `harthmere_market_posting_board`, so the world map marker, the runtime
  // nav-aid pin (HarthmereQuestNavAidController), and the physical voxel
  // building all line up at the same coordinate. The Grove fountain center is
  // [496, ~70, -126]; (4, 6) puts the board at the east edge of the fountain
  // plaza where it's reachable from spawn.
  [HARTHMERE_JOBS_BOARD_TARGET_OFFSET]: {
    label: "Jobs Board",
    district: "The Grove",
    pos: [501.99486179104775, 70, -132.00350672753194],
    icon: "J",
  },
  [BUILDING_SYSTEM_GROVE_STEWARD_NPC.idOffset]: {
    label: BUILDING_SYSTEM_GROVE_STEWARD_NPC.displayName,
    district: "The Grove",
    pos: [501, 53, -132],
    icon: "⌂",
  },
};

function firstActiveQuest(state: HarthmereQuestState) {
  for (const quest of QUESTS) {
    const stepIndex = state.active[quest.id];
    if (stepIndex !== undefined) {
      const step = quest.steps[stepIndex];
      if (step) {
        return { quest, step, stepIndex };
      }
    }
  }
  return undefined;
}

function compassDirection(dx: number, dz: number) {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (absX < 4 && absZ < 4) {
    return "here";
  }
  const eastWest = dx > 0 ? "east" : "west";
  const northSouth = dz > 0 ? "south" : "north";
  if (absX > absZ * 1.7) {
    return eastWest;
  }
  if (absZ > absX * 1.7) {
    return northSouth;
  }
  return `${northSouth}-${eastWest}`;
}

function mapPercent(value: number, min: number, max: number) {
  return Math.max(4, Math.min(96, ((value - min) / (max - min)) * 100));
}

function mapLayerLabel(marker: HarthmereQuestTarget | undefined, y: number) {
  const district = `${marker?.district ?? ""} ${
    marker?.label ?? ""
  }`.toLowerCase();
  if (/underways|drain|dungeon|crypt|cellar/.test(district) || y < 55) {
    return "Lower level / underways";
  }
  if (/gate|guard|tavern|noble/.test(district) || y >= 62) {
    return "Raised terrace / upper street";
  }
  return "Town street level";
}

function verticalRelationLabel(playerY: number, targetY: number) {
  const delta = Math.round(targetY - playerY);
  if (Math.abs(delta) <= 1) {
    return "same level";
  }
  return delta > 0 ? `${delta}m above you` : `${Math.abs(delta)}m below you`;
}

type HudMapRegion = "grove" | "harthmere";

const GROVE_MAP_MARKERS = SNAPSHOT_GROVE_LANDMARKS.filter(
  (landmark) => landmark.area !== "harthmere"
);

const GROVE_BOUNDS = GROVE_MAP_MARKERS.reduce(
  (acc, landmark) => ({
    minX: Math.min(acc.minX, landmark.position[0]),
    maxX: Math.max(acc.maxX, landmark.position[0]),
    minZ: Math.min(acc.minZ, landmark.position[2]),
    maxZ: Math.max(acc.maxZ, landmark.position[2]),
  }),
  {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  }
);

export function hudMapRegionForPlayerPosition(
  playerPos: readonly [number, number, number] | undefined
): HudMapRegion {
  if (!playerPos) {
    return "harthmere";
  }
  const [x, , z] = playerPos;
  const padding = 88;
  if (
    x >= GROVE_BOUNDS.minX - padding &&
    x <= GROVE_BOUNDS.maxX + padding &&
    z >= GROVE_BOUNDS.minZ - padding &&
    z <= GROVE_BOUNDS.maxZ + padding
  ) {
    return "grove";
  }
  return "harthmere";
}

function groveMarkerGlyph(marker: SnapshotGroveLandmark) {
  if (marker.id === "quest_board") return "!";
  if (/smith|anvil|workshop/.test(marker.id)) return "A";
  if (/healer|apothecary/.test(marker.id)) return "+";
  if (/inn|bakery|kitchen|post/.test(marker.id)) return "B";
  if (/mail|bank/.test(marker.id)) return "@";
  if (/watchtower|checkpoint/.test(marker.id)) return "G";
  if (/docks|pond|water/.test(marker.id)) return "D";
  if (/chapel|shrine|spirit/.test(marker.id)) return "C";
  if (/grove/.test(marker.id)) return "G";
  return marker.label.charAt(0).toUpperCase();
}

function groveMapMarkerIsQuestItem(
  marker: SnapshotGroveLandmark,
  objective?: string
) {
  const text = `${marker.id} ${marker.label} ${marker.kind} ${
    objective ?? ""
  }`.toLowerCase();
  return (
    marker.kind === "resource" ||
    /food|ration|item|sample|root|berry|berries|stick|stone|bolt|key|crate|satchel|basket|bin|bandage|salve|medicine|workbench|drop/.test(
      text
    )
  );
}

function groveQuestMarkerRows(
  quest: (typeof SNAPSHOT_GROVE_QUESTS)[number] | undefined,
  activeObjectiveIndex: number
) {
  if (!quest) {
    return [];
  }
  const activeIndex = Math.max(
    0,
    Math.min(activeObjectiveIndex, quest.objectives.length - 1)
  );
  return quest.markerIds
    .map((markerId, stepIndex) => {
      const marker = SNAPSHOT_GROVE_LANDMARKS.find(
        (entry) => entry.id === markerId
      );
      if (!marker) {
        return undefined;
      }
      const objective = quest.objectives[stepIndex];
      return {
        marker,
        markerId,
        stepIndex,
        objective,
        isActive: stepIndex === activeIndex,
        isPast: stepIndex < activeIndex,
        isFuture: stepIndex > activeIndex,
        isItem: groveMapMarkerIsQuestItem(marker, objective),
      };
    })
    .filter(Boolean) as Array<{
    marker: SnapshotGroveLandmark;
    markerId: string;
    stepIndex: number;
    objective?: string;
    isActive: boolean;
    isPast: boolean;
    isFuture: boolean;
    isItem: boolean;
  }>;
}

// HARTHMERE_QUEST_NAV_AID:
// The Harthmere quest pipeline previously updated localStorage state and the
// in-panel HUD but never pinned a navigation aid for the active step. That
// meant accepting a multi-step quest from a quest giver left the map marker
// stuck on the giver — the player had no map cue for the destination step
// (item, repair, witness, etc.) or for the return-to-giver step. current adds a
// runtime controller that pins/repins the world-map nav aid every time the
// active step changes so the marker always points at the *next* place the
// quest expects the player to go.
export const HARTHMERE_QUEST_NAV_AID_ID = 760_141;

function pinHarthmereQuestStepMarker(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  targetPos: readonly [number, number, number]
) {
  mapManager.removeNavigationAid?.(HARTHMERE_QUEST_NAV_AID_ID);
  return mapManager.addNavigationAid(
    {
      kind: "quest",
      autoremoveWhenNear: false,
      target: {
        kind: "position",
        position: [...targetPos],
      },
    },
    HARTHMERE_QUEST_NAV_AID_ID
  );
}

function clearHarthmereQuestStepMarker(mapManager: {
  removeNavigationAid?: (id: number) => void;
}) {
  mapManager.removeNavigationAid?.(HARTHMERE_QUEST_NAV_AID_ID);
}

// HARTHMERE_TUTOR_HUD_HIGHLIGHT:
// Same channel-name pattern as the Grove broadcast. The unified HUD's
// useTutorHighlightedNavLabels merges both channels so neither overwrites
// the other. Labels here are the *NavSlot* labels visible on the bottom
// action bar — "Bag", "Map", "Quests", "Mail", etc. — and the matching slot
// pulses + drops a bouncing arrow when its label is broadcast.
export const HARTHMERE_TUTOR_HUD_HIGHLIGHT_EVENT =
  "biomes:harthmere-quest-tutor-hud-highlights";

function broadcastHarthmereTutorHudLabels(labels: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_TUTOR_HUD_HIGHLIGHT_EVENT, {
        detail: { labels },
      })
    );
  } catch {
    // Ignore in non-browser contexts.
  }
}

// HARTHMERE_TUTOR_HUD_HIGHLIGHT:
// Derive which NavSlot buttons should pulse for a given quest step. Each
// rule is a soft hint — the more matches we get, the more buttons light up,
// but we cap the set so the bar doesn't turn into a christmas tree.
//
// Heuristics:
//   - Any accepted quest with a real targetOffset → Map (so the player knows
//     a marker is pinned out there waiting for them).
//   - Step requires an item (requiresItemId set) → Bag (so the player checks
//     their pouch before trying to turn in).
//   - Step text mentions inventory / equipment / bag / hotbar → Bag.
//   - Step text mentions craft / recipe / repair / forge → Craft.
//   - Step text mentions mail / storage / letter / parcel / bank → Mail.
//   - Step text mentions quest journal / journal / log → Quests.
//   - Step text mentions notifications / alert → Notif.
//   - Step text mentions codex / lore / glossary → Codex.
//   - Step text mentions chat / whisper / channel → Chat.
//   - Step text mentions settings / options / preferences → Settings.
function harthmereStepHudLabels(
  quest: HarthmereQuestDefinition | undefined,
  step: HarthmereQuestStep | undefined
): string[] {
  if (!quest || !step) {
    return [];
  }
  const labels = new Set<string>();
  const objective = (step.objective ?? "").toLowerCase();
  const completion = (step.completion ?? "").toLowerCase();
  const text = `${objective} ${completion} ${quest.title.toLowerCase()}`;

  // The marker is always pinned for an active step, so always light up Map.
  labels.add("Map");

  if (step.requiresItemId) {
    labels.add("Bag");
  }
  if (/inventory|equip|bag|backpack|hotbar|gear|wear/.test(text)) {
    labels.add("Bag");
  }
  if (/craft|recipe|repair|forge|workbench|smithy|anvil/.test(text)) {
    labels.add("Craft");
  }
  if (
    /mail|letter|parcel|courier|storage|deposit|withdraw|bank|vault|lockbox/.test(
      text
    )
  ) {
    labels.add("Mail");
  }
  if (/jobs board|job board|public work/.test(text)) {
    labels.add("Jobs");
  }
  if (/journal|quest log|market board/.test(text)) {
    labels.add("Quests");
  }
  if (/notification|alert|warning/.test(text)) {
    labels.add("Notif");
  }
  if (/codex|lore|glossary|primer/.test(text)) {
    labels.add("Codex");
  }
  if (/chat|whisper|channel|say message|tavern talk/.test(text)) {
    labels.add("Chat");
  }
  if (/settings|options|preferences/.test(text)) {
    labels.add("Settings");
  }
  return [...labels].slice(0, 4);
}

export const HarthmereQuestNavAidController: React.FunctionComponent<{}> =
  () => {
    const { mapManager } = useClientContext();
    const [state, setState] = useState<HarthmereQuestState>(() =>
      readQuestState()
    );

    useEffect(() => {
      const refresh = () => setState(readQuestState());
      window.addEventListener("storage", refresh);
      window.addEventListener("biomes:harthmere-quest-state-changed", refresh);
      const interval = window.setInterval(refresh, 500);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("storage", refresh);
        window.removeEventListener(
          "biomes:harthmere-quest-state-changed",
          refresh
        );
      };
    }, []);

    // active is recomputed each render from state so it stays in lockstep with
    // whichever quest/step is current. The effect repins whenever the active
    // step's targetOffset changes.
    const active = firstActiveQuest(state);
    const targetOffset = active?.step.targetOffset;

    useEffect(() => {
      if (targetOffset === undefined) {
        clearHarthmereQuestStepMarker(mapManager);
        return;
      }
      const target = QUEST_TARGETS[targetOffset];
      if (!target) {
        clearHarthmereQuestStepMarker(mapManager);
        return;
      }
      pinHarthmereQuestStepMarker(
        mapManager,
        getHarthmereQuestTargetWorldPos(target)
      );
      return () => {
        clearHarthmereQuestStepMarker(mapManager);
      };
    }, [mapManager, targetOffset]);

    // HARTHMERE_TUTOR_HUD_HIGHLIGHT:
    // Broadcast the NavSlot labels the player should look at right now. This
    // depends on which active step they are on; "no active step" clears the
    // highlights so the bar goes calm again. Re-broadcast on quest/step
    // changes — note that we deliberately re-derive the *step object* per
    // render so step-level fields like requiresItemId pick up.
    useEffect(() => {
      if (!active) {
        broadcastHarthmereTutorHudLabels([]);
        return;
      }
      const labels = harthmereStepHudLabels(active.quest, active.step);
      broadcastHarthmereTutorHudLabels(labels);
      return () => {
        // Clear when the controller unmounts so the bar does not get stuck
        // pulsing for a stale step.
        broadcastHarthmereTutorHudLabels([]);
      };
    }, [active?.quest.id, active?.stepIndex]);

    return null;
  };

export const HarthmereQuestMapHUD: React.FunctionComponent<{}> = () => {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const [state, setState] = useState<HarthmereQuestState>(() =>
    readQuestState()
  );
  const [groveQuestState, setGroveQuestState] = useState(() =>
    readSnapshotGroveQuestState()
  );

  useEffect(() => {
    const refresh = () => {
      setState(readQuestState());
      setGroveQuestState(readSnapshotGroveQuestState());
    };
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const playerPos = localPlayer.player.position;
  const region = hudMapRegionForPlayerPosition(playerPos);
  const active = firstActiveQuest(state);
  const targetOffset = active?.step.targetOffset ?? 41;
  const target = QUEST_TARGETS[targetOffset] ?? QUEST_TARGETS[41];
  const targetPos = getHarthmereQuestTargetWorldPos(target);
  const dx = targetPos[0] - playerPos[0];
  const dz = targetPos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirection(dx, dz);
  const bounds = getHarthmereWorldMapBounds();

  const majorMarkerOffsets = [
    targetOffset,
    41, // Market Board / central hub
    27, // North Gate
    5, // Bakery / food store
    30, // Inn
    6, // Bank
    43, // Mail / courier
    7, // Weapon shop
    29, // Smith / crafting
    8, // Healer
    47, // Apothecary
    9, // Magic shop
    31, // Chapel
    44, // Guard Yard
    34, // Docks
    33, // Mudden Ward
    10, // Farm
    63, // Orchard
    70, // Underways
  ];
  const markerEntries = [...new Set(majorMarkerOffsets)]
    .map((offset) => ({ offset, marker: QUEST_TARGETS[offset] }))
    .filter(
      (entry): entry is { offset: number; marker: HarthmereQuestTarget } =>
        Boolean(entry.marker)
    );
  const [selectedOffset, setSelectedOffset] = useState<number | undefined>(
    targetOffset
  );
  const activeGrove = useMemo(() => {
    const quest = SNAPSHOT_GROVE_QUESTS.find(
      (entry) => entry.id === groveQuestState.activeQuestId
    );
    if (!quest) {
      return undefined;
    }
    // SnapshotGroveQuest.objectives and .markerIds are parallel string[]
    // arrays — labels in one, marker ids in the other, indexed by objective.
    const objectiveIndex = Math.max(
      0,
      Math.min(
        groveQuestState.activeObjectiveIndex,
        quest.objectives.length - 1
      )
    );
    const objectiveLabel = quest.objectives[objectiveIndex];
    const markerId = quest.markerIds[objectiveIndex] ?? quest.markerIds[0];
    const marker = markerId
      ? GROVE_MAP_MARKERS.find((entry) => entry.id === markerId)
      : undefined;
    return {
      quest,
      objectiveIndex,
      objectiveLabel,
      marker,
    };
  }, [groveQuestState]);
  const nearestGroveMarker = useMemo(() => {
    return GROVE_MAP_MARKERS.reduce<SnapshotGroveLandmark | undefined>(
      (closest, marker) => {
        if (!closest) {
          return marker;
        }
        const currentDistance = Math.hypot(
          marker.position[0] - playerPos[0],
          marker.position[2] - playerPos[2]
        );
        const bestDistance = Math.hypot(
          closest.position[0] - playerPos[0],
          closest.position[2] - playerPos[2]
        );
        return currentDistance < bestDistance ? marker : closest;
      },
      undefined
    );
  }, [playerPos]);
  const [selectedGroveId, setSelectedGroveId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    setSelectedOffset(targetOffset);
  }, [targetOffset, active?.quest.id, active?.stepIndex]);

  useEffect(() => {
    setSelectedGroveId(
      activeGrove?.marker?.id ??
        nearestGroveMarker?.id ??
        GROVE_MAP_MARKERS[0]?.id
    );
  }, [activeGrove?.marker?.id, nearestGroveMarker?.id, region]);

  if (region === "grove") {
    const selectedGroveMarker =
      GROVE_MAP_MARKERS.find((entry) => entry.id === selectedGroveId) ??
      activeGrove?.marker ??
      nearestGroveMarker ??
      GROVE_MAP_MARKERS[0];
    const selectedPos = selectedGroveMarker?.position ?? playerPos;
    const selectedDx = selectedPos[0] - playerPos[0];
    const selectedDz = selectedPos[2] - playerPos[2];
    const selectedDistance = Math.round(Math.hypot(selectedDx, selectedDz));
    const selectedDirection = compassDirection(selectedDx, selectedDz);
    const selectedLayer = mapLayerLabel(undefined, selectedPos[1]);
    const playerLayer = mapLayerLabel(undefined, playerPos[1]);
    const currentObjectiveText =
      activeGrove?.objectiveLabel ??
      "Explore the Grove and follow nearby lesson markers instead of using the Harthmere town map.";
    const objectiveMarkerId = activeGrove?.marker?.id;
    const activeGroveMarkerRows = groveQuestMarkerRows(
      activeGrove?.quest,
      activeGrove?.objectiveIndex ?? 0
    );
    const activeGroveMarkerIds = new Set(
      activeGroveMarkerRows
        .filter((row) => !row.isPast)
        .map((row) => row.marker.id)
    );
    const activeGroveItemMarkerIds = new Set(
      activeGroveMarkerRows
        .filter((row) => !row.isPast && row.isItem)
        .map((row) => row.marker.id)
    );

    return (
      <div
        className="rounded-none bg-transparent pointer-events-auto mx-auto w-full border-0 p-0 text-white shadow-none"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
      >
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-emerald-200 text-sm font-semibold uppercase tracking-wide">
              {BIOMES_GAME_NAME} Map
            </div>
            <div className="text-xs text-white/80">
              The Grove field map · player layer: {playerLayer} · y{" "}
              {Math.round(playerPos[1])}
            </div>
          </div>
          <div className="rounded bg-emerald-300/20 text-emerald-100 px-2 py-1 text-xs font-semibold">
            Current area: The Grove · {selectedDistance}m {selectedDirection} ·{" "}
            {verticalRelationLabel(playerPos[1], selectedPos[1])}
          </div>
        </div>
        <div className="rounded-lg border-emerald-200/15 bg-black/35 mb-2 border p-2 text-xs leading-snug text-white/90">
          <span className="text-emerald-100 font-semibold">
            Current area objective:
          </span>{" "}
          {currentObjectiveText}
          <span className="text-white/55 ml-2">
            The map now follows the region the player is actually standing in,
            so The Grove uses Grove markers instead of the Harthmere town
            layout.
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-xl bg-slate-950/85 relative h-[min(60vh,32rem)] min-h-[20rem] overflow-hidden border border-white/10">
            <div className="border-emerald-300/20 bg-emerald-500/[0.04] absolute inset-[7%] rounded-[1.25rem] border" />
            <div className="absolute left-[14%] top-[18%] h-[18%] w-[22%] rounded-full border border-white/10 bg-white/[0.03]" />
            <div className="absolute left-[58%] top-[14%] h-[22%] w-[24%] rounded-full border border-white/10 bg-white/[0.03]" />
            <div className="border-emerald-300/20 bg-emerald-300/[0.08] absolute left-[44%] top-[44%] h-[18%] w-[20%] rounded-full border" />
            <div className="border-blue-300/20 bg-blue-300/[0.06] absolute left-[22%] top-[68%] h-[14%] w-[18%] rounded-full border" />
            <div className="border-amber-200/15 bg-amber-200/[0.05] absolute left-[65%] top-[64%] h-[12%] w-[14%] rounded-full border" />
            <div className="text-white/35 absolute left-[18%] top-[14%] text-[8px] font-semibold uppercase tracking-wide">
              Old Road
            </div>
            <div className="text-white/35 absolute left-[58%] top-[12%] text-[8px] font-semibold uppercase tracking-wide">
              Watchtower
            </div>
            <div className="text-white/35 absolute left-[43%] top-[63%] text-[8px] font-semibold uppercase tracking-wide">
              Temple
            </div>
            <div className="text-white/35 absolute left-[24%] top-[84%] text-[8px] font-semibold uppercase tracking-wide">
              Lower trail
            </div>
            {GROVE_MAP_MARKERS.map((marker) => {
              const left = mapPercent(
                marker.position[0],
                GROVE_BOUNDS.minX,
                GROVE_BOUNDS.maxX
              );
              const top = mapPercent(
                marker.position[2],
                GROVE_BOUNDS.minZ,
                GROVE_BOUNDS.maxZ
              );
              const isObjective = marker.id === objectiveMarkerId;
              const isSelected = marker.id === selectedGroveMarker?.id;
              const isLessonMarker = activeGroveMarkerIds.has(marker.id);
              const isLessonItemMarker = activeGroveItemMarkerIds.has(
                marker.id
              );
              return (
                <button
                  key={marker.id}
                  data-snapshot-grove-center-map-marker="true"
                  data-snapshot-grove-center-map-item={
                    isLessonItemMarker ? "true" : "false"
                  }
                  data-snapshot-grove-center-map-active={
                    isObjective ? "true" : "false"
                  }
                  className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white ${
                    isSelected
                      ? "bg-cyan-200 text-black ring-4 ring-white"
                      : isObjective
                      ? "bg-emerald-300 text-black shadow-[0_0_16px_rgba(190,242,100,0.85)] ring-2 ring-white"
                      : isLessonItemMarker
                      ? "bg-amber-300 ring-amber-100 text-black shadow-[0_0_14px_rgba(252,211,77,0.75)] ring-2"
                      : isLessonMarker
                      ? "bg-violet-300 ring-violet-100 text-black ring-2"
                      : "bg-black/75 text-white ring-1 ring-white/30"
                  }`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  title={`${marker.label} · ${marker.area.replaceAll(
                    "_",
                    " "
                  )}${
                    isLessonItemMarker ? " · tutorial item/pickup marker" : ""
                  }`}
                  onClick={() => setSelectedGroveId(marker.id)}
                >
                  {isObjective
                    ? "!"
                    : isLessonItemMarker
                    ? "I"
                    : groveMarkerGlyph(marker)}
                </button>
              );
            })}
            <div
              className="bg-cyan-300 absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold text-black ring-2 ring-white"
              style={{
                left: `${mapPercent(
                  playerPos[0],
                  GROVE_BOUNDS.minX,
                  GROVE_BOUNDS.maxX
                )}%`,
                top: `${mapPercent(
                  playerPos[2],
                  GROVE_BOUNDS.minZ,
                  GROVE_BOUNDS.maxZ
                )}%`,
              }}
              title={`You · ${playerLayer} · y ${Math.round(playerPos[1])}`}
            >
              Y
            </div>
          </div>
          <div className="rounded-xl bg-black/55 border border-white/10 p-3 text-xs leading-snug text-white/80">
            <div className="text-white/55 mb-2 text-[10px] font-bold uppercase tracking-wide">
              Selected marker
            </div>
            <div className="text-base font-bold text-white">
              {selectedGroveMarker?.label ?? "Unknown marker"}
            </div>
            <div className="text-emerald-100/75 text-[11px] uppercase tracking-wide">
              {selectedGroveMarker?.area.replaceAll("_", " ") ?? "Unknown area"}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded bg-white/5 p-2">
                <div className="text-white/45">Distance</div>
                <div className="font-semibold text-white">
                  {selectedDistance}m {selectedDirection}
                </div>
              </div>
              <div className="rounded bg-white/5 p-2">
                <div className="text-white/45">Terrain level</div>
                <div className="font-semibold text-white">
                  y {Math.round(selectedPos[1])}
                </div>
              </div>
            </div>
            <div className="rounded mt-2 bg-white/5 p-2">
              <div className="text-white/45">Layer</div>
              <div className="font-semibold text-white">{selectedLayer}</div>
              <div className="mt-1 text-white/60">
                {verticalRelationLabel(playerPos[1], selectedPos[1])}
              </div>
            </div>
            {selectedGroveMarker?.id === objectiveMarkerId && (
              <div className="rounded border-emerald-300/20 bg-emerald-300/10 mt-2 border p-2">
                <div className="text-emerald-100 font-semibold">
                  Active objective
                </div>
                <div>{currentObjectiveText}</div>
              </div>
            )}
            {!!activeGroveMarkerRows.length && (
              <div
                className="rounded border-amber-300/20 bg-amber-300/10 mt-2 border p-2"
                data-snapshot-grove-center-map-item-list="true"
              >
                <div className="text-amber-100 font-semibold">
                  Active lesson item stops
                </div>
                <div className="mt-1 space-y-1">
                  {activeGroveMarkerRows
                    .filter((row) => !row.isPast)
                    .map((row) => (
                      <button
                        key={`${row.marker.id}-${row.stepIndex}`}
                        type="button"
                        className={
                          row.isActive
                            ? "rounded bg-lime-300/20 text-lime-50 flex w-full items-center justify-between px-2 py-1 text-left"
                            : row.isItem
                            ? "rounded bg-amber-300/15 text-amber-50 flex w-full items-center justify-between px-2 py-1 text-left"
                            : "rounded flex w-full items-center justify-between bg-white/5 px-2 py-1 text-left text-white/70"
                        }
                        data-snapshot-grove-center-map-item-row={
                          row.isItem ? "true" : "false"
                        }
                        onClick={() => setSelectedGroveId(row.marker.id)}
                      >
                        <span>
                          {row.stepIndex + 1}. {row.marker.label}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {row.isActive ? "Now" : row.isItem ? "Item" : "Next"}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
            <div className="text-white/55 mt-2 text-[11px]">
              The map mirrors the region you are actually standing in, and shows
              the active lesson's selected marker, distance, and terrain layer.
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] leading-snug text-white/75 md:grid-cols-4">
          <div>
            <span className="text-cyan-200 font-bold">Y</span> = You
          </div>
          <div>
            <span className="text-emerald-200 font-bold">!</span> = Active
            objective
          </div>
          <div>
            <span className="text-amber-200 font-bold">I</span> = Lesson item /
            pickup
          </div>
          <div>
            <span className="font-bold">G</span> = Grove / guard / guide
          </div>
          <div>
            <span className="font-bold">A</span> = Smith / crafting
          </div>
          <div>
            <span className="font-bold">+</span> = Healer / apothecary
          </div>
          <div>
            <span className="font-bold">B</span> = Bakery / road post
          </div>
          <div>
            <span className="font-bold">C</span> = Chapel / shrine
          </div>
          <div>
            <span className="font-bold">D</span> = Docks / water route
          </div>
        </div>
      </div>
    );
  }

  const selectedEntry =
    markerEntries.find((entry) => entry.offset === selectedOffset) ??
    markerEntries.find((entry) => entry.offset === targetOffset) ??
    markerEntries[0];
  const selectedMarker = selectedEntry?.marker;
  const selectedPos = selectedMarker
    ? getHarthmereQuestTargetWorldPos(selectedMarker)
    : targetPos;
  const selectedDx = selectedPos[0] - playerPos[0];
  const selectedDz = selectedPos[2] - playerPos[2];
  const selectedDistance = Math.round(Math.hypot(selectedDx, selectedDz));
  const selectedDirection = compassDirection(selectedDx, selectedDz);
  const playerLayer = mapLayerLabel(undefined, playerPos[1]);
  const selectedLayer = mapLayerLabel(selectedMarker, selectedPos[1]);
  const selectedIsObjective = selectedEntry?.offset === targetOffset;

  return (
    <div
      className="rounded-none bg-transparent pointer-events-auto mx-auto w-full border-0 p-0 text-white shadow-none"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-yellow-200 text-sm font-semibold uppercase tracking-wide">
            {BIOMES_GAME_NAME} Map
          </div>
          <div className="text-xs text-white/80">
            {BIOMES_HARTHMERE_TOWN_NAME} town map · player layer: {playerLayer}{" "}
            · y {Math.round(playerPos[1])}
          </div>
        </div>
        <div className="rounded bg-yellow-300/20 text-yellow-100 px-2 py-1 text-xs font-semibold">
          Objective: {distance}m {direction} ·{" "}
          {verticalRelationLabel(playerPos[1], targetPos[1])}
        </div>
      </div>
      <div className="rounded-lg border-yellow-200/15 bg-black/35 mb-2 border p-2 text-xs leading-snug text-white/90">
        <span className="text-yellow-100 font-semibold">
          Current objective:
        </span>{" "}
        {active?.step.objective ?? "Read the Market Board beside the fountain."}
        <span className="text-white/55 ml-2">
          Click or press a map marker to inspect the location, objective,
          district, and terrain level.
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-xl bg-slate-900/80 relative h-[min(60vh,32rem)] min-h-[20rem] overflow-hidden border border-white/10">
          <div className="rounded border-stone-400/40 absolute bottom-[8%] left-[8%] right-[8%] top-[6%] border" />
          <div className="bg-stone-500/30 absolute bottom-[8%] left-[44%] top-[6%] w-[9%]" />
          <div className="bg-stone-500/30 absolute left-[8%] right-[8%] top-[42%] h-[11%]" />
          <div className="bg-blue-500/30 absolute left-[75%] top-[42%] h-[20%] w-[21%]" />
          <div className="border-yellow-300/40 bg-yellow-300/10 absolute left-[38%] top-[36%] h-[22%] w-[24%] rounded-full border" />
          <div className="rounded border-emerald-300/30 bg-emerald-300/10 absolute left-[72%] top-[8%] h-[18%] w-[18%] border" />
          <div className="rounded border-stone-700/50 bg-stone-700/30 absolute left-[6%] top-[60%] h-[20%] w-[18%] border" />
          <div className="rounded border-lime-300/30 bg-lime-300/10 absolute left-[16%] top-[78%] h-[14%] w-[24%] border" />
          <div className="absolute left-[40%] top-[58%] text-[8px] font-semibold uppercase tracking-wide text-white/40">
            Temple
          </div>
          <div className="absolute left-[72%] top-[27%] text-[8px] font-semibold uppercase tracking-wide text-white/40">
            Noble
          </div>
          <div className="absolute left-[79%] top-[64%] text-[8px] font-semibold uppercase tracking-wide text-white/40">
            Docks
          </div>
          <div className="absolute left-[10%] top-[55%] text-[8px] font-semibold uppercase tracking-wide text-white/40">
            Mudden
          </div>
          <div className="absolute left-[17%] top-[86%] text-[8px] font-semibold uppercase tracking-wide text-white/40">
            Lower
          </div>
          {markerEntries.map(({ offset, marker }) => {
            const markerPos = getHarthmereQuestTargetWorldPos(marker);
            const left = mapPercent(markerPos[0], bounds.minX, bounds.maxX);
            const top = mapPercent(markerPos[2], bounds.minZ, bounds.maxZ);
            const isTarget = offset === targetOffset;
            const isSelected = offset === selectedEntry?.offset;
            const markerLayer = mapLayerLabel(marker, markerPos[1]);
            return (
              <button
                key={`${offset}-${marker.label}-${marker.pos.join(",")}`}
                className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white ${
                  isSelected
                    ? "bg-cyan-200 text-black ring-4 ring-white"
                    : isTarget
                    ? "bg-yellow-300 text-black ring-2 ring-white"
                    : "bg-black/75 text-white ring-1 ring-white/30"
                }`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={`${marker.label} · ${marker.district} · ${markerLayer}`}
                onClick={() => setSelectedOffset(offset)}
              >
                {marker.icon}
              </button>
            );
          })}
          <div
            className="bg-cyan-300 absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold text-black ring-2 ring-white"
            style={{
              left: `${mapPercent(playerPos[0], bounds.minX, bounds.maxX)}%`,
              top: `${mapPercent(playerPos[2], bounds.minZ, bounds.maxZ)}%`,
            }}
            title={`You · ${playerLayer} · y ${Math.round(playerPos[1])}`}
          >
            Y
          </div>
        </div>
        <div className="rounded-xl bg-black/45 border border-white/10 p-3 text-xs leading-snug text-white/80">
          <div className="text-white/55 mb-2 text-[10px] font-bold uppercase tracking-wide">
            Selected marker
          </div>
          <div className="text-base font-bold text-white">
            {selectedMarker?.label ?? "Unknown marker"}
          </div>
          <div className="text-yellow-100/75 text-[11px] uppercase tracking-wide">
            {selectedMarker?.district ?? "Unknown district"}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded bg-white/5 p-2">
              <div className="text-white/45">Distance</div>
              <div className="font-semibold text-white">
                {selectedDistance}m {selectedDirection}
              </div>
            </div>
            <div className="rounded bg-white/5 p-2">
              <div className="text-white/45">Terrain level</div>
              <div className="font-semibold text-white">
                y {Math.round(selectedPos[1])}
              </div>
            </div>
          </div>
          <div className="rounded mt-2 bg-white/5 p-2">
            <div className="text-white/45">Layer</div>
            <div className="font-semibold text-white">{selectedLayer}</div>
            <div className="mt-1 text-white/60">
              {verticalRelationLabel(playerPos[1], selectedPos[1])}
            </div>
          </div>
          {selectedIsObjective && (
            <div className="rounded border-yellow-300/20 bg-yellow-300/10 mt-2 border p-2">
              <div className="text-yellow-100 font-semibold">
                Active objective
              </div>
              <div>
                {active?.step.objective ??
                  "Read the Market Board beside the fountain."}
              </div>
            </div>
          )}
          <div className="text-white/55 mt-2 text-[11px]">
            District labels and service icons stay on the map at all times. The
            selected marker holds your active objective, distance, and terrain
            layer.
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] leading-snug text-white/75 md:grid-cols-4">
        <div>
          <span className="text-cyan-200 font-bold">Y</span> = You
        </div>
        <div>
          <span className="text-yellow-200 font-bold">!</span> = Quest / board
        </div>
        <div>
          <span className="font-bold">⚔</span> = Weapon shop
        </div>
        <div>
          <span className="font-bold">✦</span> = Magic shop
        </div>
        <div>
          <span className="font-bold">A</span> = Smith / crafting
        </div>
        <div>
          <span className="font-bold">+</span> = Healer / apothecary
        </div>
        <div>
          <span className="font-bold">B/I</span> = Bakery / inn
        </div>
        <div>
          <span className="font-bold">$ / @</span> = Bank / mail
        </div>
        <div>
          <span className="font-bold">C/D/?</span> = Chapel / docks / lower
          route
        </div>
      </div>
    </div>
  );
};
