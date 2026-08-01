import { harthmereLocalStorage } from "@/client/util/storage";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  applyHarthmereReputationChange,
  type HarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { readHarthmereLevelingState } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  getHarthmereNpcCurrentRouteLine,
  getHarthmereNpcSocialResponse,
} from "@/client/components/challenges/LocalDevHarthmereNpcBehaviorSystem";
import React, { useEffect, useMemo, useState } from "react";
import { snapshotHarthmereBibleLines } from "@/shared/harthmere/snapshot_complete_port";
import { harthmereAdditiveTownNpcDialogueForOffset } from "@/shared/harthmere/additive_town_npc_dialogue";

const HARTHMERE_DIALOGUE_MEMORY_KEY =
  "biomes.localDev.harthmere.dialogueMemory";
const HARTHMERE_DIALOGUE_EVENT = "biomes:harthmere-dialogue-changed";

export type HarthmereDialogueChoiceKind =
  | "ask"
  | "friendly"
  | "rude"
  | "threaten"
  | "bribe"
  | "persuade"
  | "perception"
  | "report"
  | "guide"
  | "reset";

interface HarthmereDialogueMemoryEntry {
  id: string;
  at: number;
  npcOffset: number;
  npcName: string;
  kind: HarthmereDialogueChoiceKind;
  label: string;
  summary: string;
  consequence?: string;
}

interface HarthmereDialogueMemoryState {
  version: 1;
  greeted: Record<number, number>;
  choices: HarthmereDialogueMemoryEntry[];
}

interface HarthmereDialogueContext {
  offset: number;
  defaultDialog: string;
  isBoard: boolean;
  activeObjectiveLines: string[];
  activeObjective?: string;
  availableQuestTitles: string[];
  completedQuestTitles: string[];
  matchingQuestTitle?: string;
  matchingQuestObjective?: string;
  extraLines?: string[];
  reputationState: HarthmereReputationState;
}

const EMPTY_DIALOGUE_MEMORY: HarthmereDialogueMemoryState = {
  version: 1,
  greeted: {},
  choices: [],
};

const HARTHMERE_JOBS_BOARD_TARGET_OFFSET = 140_041;

const NPC_NAMES: Record<number, string> = {
  1: "Mira, Town Guide",
  5: "Maren Dawnloaf",
  6: "Banker Merl Voss",
  7: "Brann, Weapons Teller",
  8: "Luma, Healer",
  9: "Edrin Starling",
  10: "Tilda Fen",
  11: "Garrick, Bartender",
  13: "Bela the Storyteller",
  14: "Kip the Card Player",
  27: "Sergeant Bram Holt",
  28: "Mara Thistle",
  29: "Master Osric Vale",
  30: "Elowen Pike",
  31: "Father Aldren",
  33: "Nessa Crowe",
  34: "Tovin Reed",
  39: "Rusk, Toll Clerk",
  40: "Sable, Smuggler",
  41: "Harthmere Market Board",
  [HARTHMERE_JOBS_BOARD_TARGET_OFFSET]: "Jobs Board",
  43: "Courier Anwen",
  44: "Drill Instructor Hal",
  45: "Bounty Clerk Rowan",
  46: "Sister Maelle",
  47: "Ysabet Fenlow",
  56: "Guard Quartermaster Tarrow",
  57: "Traveling Merchant Ossa",
  59: "Guild Registrar Wyne",
  60: "Auction Clerk Pellam",
  61: "Rat Catcher Dima",
  62: "Bell-Witness Ora",
  63: "Apple Picker Ren",
  64: "Stablehand Corin",
  65: "River Knots Lookout",
  67: "Forge Apprentice Luth",
  68: "Bakery Apprentice Noll",
  69: "Market Guard Sen",
  70: "Underways Echo",
};

const ROLE_LINES: Record<number, string> = {
  5: "I check the bread rack, the apple basket, and the cooling ovens before I worry about gossip.",
  6: "I sort the bank ledger by hand: deposits, missing lockboxes, courier seals, and names that do not balance.",
  7: "I point to the training blades first. A weapon that cannot be controlled is a danger to everyone nearby.",
  8: "I keep clean cloth, bitter medicine, and a steady voice ready for whoever comes through the healer's door.",
  9: "I watch the blue lamps and keep dangerous books shut unless the question is worth opening them.",
  10: "I smell of hay, wet fence posts, and animals that need feeding before sunset.",
  11: "I keep cups full, rooms warm, and one ear open for trouble coming through the Copper Kettle door.",
  27: "I measure strangers by boots, weapons, and whether they listen before walking into trouble.",
  28: "I know where people gather, where they argue, and which alleys are worth avoiding after dusk.",
  29: "I name the broken part, the needed material, and the cost before I reach for a hammer.",
  30: "I weigh every rumor by who carried it, where it started, and who benefits if it spreads.",
  31: "I keep the chapel quiet, but my eyes move whenever the missing bell is mentioned.",
  33: "I answer carefully; in Mudden Ward, names travel faster than coin.",
  34: "I talk in cargo facts: origin, owner, wet marks, missing seals, and who touched the crate last.",
  41: "Fresh notices are pinned by trade, trouble, and distance from the market square.",
  44: "I watch footwork first. A sloppy swing is a lesson waiting to bruise someone.",
  46: "I offer water, bandages, and mercy in that order when someone arrives hurt.",
  47: "I name ingredients exactly. Guessing is how people drink the wrong bottle.",
  62: "I speak like someone remembering a sound nobody else wanted to hear.",
  70: "I carry old words through wet stone: bronze, bell, burial, and the thing that answered.",
};

const DISTRICT_DIRECTIONS: Record<number, string> = {
  5: "Dawn Loaf is west of the market. Follow the smell of warm bread and the yellow stall cloth.",
  6: "The bank is east of the square, near the courier desk and service counters.",
  7: "The weapons counter sits beside Black Anvil workspaces in Craftsman Row.",
  8: "The healer is north-west of Temple Green, marked by clean cloth, bottles, and quiet light.",
  9: "The magic shop is near the healer, where blue lamps and bookstands mark the door.",
  10: "The farm path leaves the market to the south-west. Keep the orchard on your left.",
  11: "The Copper Kettle sits west of the central route, where the warm lanterns gather people at dusk.",
  27: "From the North Gate, walk south to the market fountain. Every useful starter road branches from there.",
  29: "Craftsman Row is east of the market. Smoke, anvils, and red banners point the way.",
  31: "Temple Green is north-east of the square. The chapel is the quiet stone building with candles outside.",
  33: "Mudden Ward lies south-west of the square, where the roads tighten and the drains begin.",
  34: "The dock road runs east from the market. Follow the crates, ropes, and gulls.",
  41: "Use the market as your center: gate north, docks east, farm south-west, temple north-east, Mudden Ward south-west.",
  44: "The Guard Yard is north of Craftsman Row, with training dummies and blue Watch banners.",
  62: "The Old Well is near the market edge. The Underways clues pull south-west toward old stone and drains.",
  70: "The Underways are not a normal shop. Follow the cold bars and old bronze marks near the town's forgotten edge.",
};

const RUMORS: Record<number, string[]> = {
  5: [
    "I heard the orchard road went quiet before dawn. I think someone moved crates before the bakers arrived.",
    "My bakery rumor is practical: if the Guard goes hungry, everyone hears about it by noon.",
  ],
  6: [
    "I will not say 'thief' yet. I say 'chain of custody' because it sounds less embarrassing.",
    "A wet footprint near a lockbox means either docks, drains, or someone trying to look like both.",
  ],
  11: [
    "I say the best rumors come from people who pretend they are only asking for another cup.",
    "A card player swore a crate whispered on the docks, then immediately asked if anyone wanted to buy his silence.",
  ],
  27: [
    "I say newcomers who learn the square survive longer than newcomers who chase smoke into alleys.",
  ],
  30: [
    "I say the Missing Bell story is old enough that people call it nonsense when they are afraid it is true.",
  ],
  31: ["I say no bell was stolen. That is the part people keep getting wrong."],
  33: [
    "I say the drains remember every coin dropped in panic.",
    "Mudden Ward rumor: when the river rises, old doors below town breathe cold air.",
  ],
  34: ["I say crates with no owner usually have too many owners."],
  41: [
    "Newest board rumor: farms need hands, docks need eyes, and the chapel needs someone brave enough to ask about the bell.",
  ],
  62: ["I heard bronze under stone. I did not hear it with my ears alone."],
  70: [
    "I repeat only one useful thing: the bell was buried to keep something from answering.",
  ],
};

const DEFAULT_LOCAL_RUMORS = [
  "I say the quickest way to understand Harthmere is to notice what people run out of first.",
  "I say a quiet street, a closed shutter, or animals facing the same direction can tell you more than a loud rumor.",
];

const GUARD_OFFSETS = new Set([27, 39, 44, 45, 56, 69]);
const MERCHANT_OFFSETS = new Set([
  5, 6, 7, 8, 9, 11, 28, 29, 30, 34, 35, 36, 37, 43, 47, 48, 49, 50, 51, 54, 57,
  58, 59, 60, 63, 64, 67, 68,
]);
const TEMPLE_OFFSETS = new Set([31, 46, 62, 70]);
const CRIMINAL_OFFSETS = new Set([33, 40, 65, 70]);

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function dispatchDialogueEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_DIALOGUE_EVENT));
}

export function readHarthmereDialogueMemory(): HarthmereDialogueMemoryState {
  if (!isBrowser()) {
    return EMPTY_DIALOGUE_MEMORY;
  }
  try {
    const raw = harthmereLocalStorage.getItem(HARTHMERE_DIALOGUE_MEMORY_KEY);
    if (!raw) {
      return { ...EMPTY_DIALOGUE_MEMORY, greeted: {}, choices: [] };
    }
    const parsed = JSON.parse(raw) as Partial<HarthmereDialogueMemoryState>;
    return {
      version: 1,
      greeted: parsed.greeted ?? {},
      choices: parsed.choices ?? [],
    };
  } catch {
    return { ...EMPTY_DIALOGUE_MEMORY, greeted: {}, choices: [] };
  }
}

function writeHarthmereDialogueMemory(state: HarthmereDialogueMemoryState) {
  if (!isBrowser()) {
    return;
  }
  harthmereLocalStorage.setItem(
    HARTHMERE_DIALOGUE_MEMORY_KEY,
    JSON.stringify(state)
  );
  dispatchDialogueEvent();
}

export function resetHarthmereDialogueMemory() {
  writeHarthmereDialogueMemory({ version: 1, greeted: {}, choices: [] });
}

function npcName(offset: number) {
  return NPC_NAMES[offset] ?? `Harthmere local ${offset}`;
}

function updateGreeted(offset: number) {
  const state = readHarthmereDialogueMemory();
  writeHarthmereDialogueMemory({
    ...state,
    greeted: {
      ...state.greeted,
      [offset]: (state.greeted[offset] ?? 0) + 1,
    },
  });
}

function recordDialogueChoice(input: {
  npcOffset: number;
  kind: HarthmereDialogueChoiceKind;
  label: string;
  summary: string;
  consequence?: string;
}) {
  const state = readHarthmereDialogueMemory();
  const entry: HarthmereDialogueMemoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    npcOffset: input.npcOffset,
    npcName: npcName(input.npcOffset),
    kind: input.kind,
    label: input.label,
    summary: input.summary,
    consequence: input.consequence,
  };
  writeHarthmereDialogueMemory({
    version: 1,
    greeted: state.greeted,
    choices: [entry, ...state.choices].slice(0, 20),
  });
}

function firstRumor(offset: number) {
  const pool =
    RUMORS[offset] ??
    (offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET
      ? RUMORS[41]
      : DEFAULT_LOCAL_RUMORS);
  const memory = readHarthmereDialogueMemory();
  const count = memory.greeted[offset] ?? 0;
  return pool[count % pool.length];
}

function hasAttribute(
  name: keyof ReturnType<typeof readHarthmereLevelingState>["attributes"],
  value: number
) {
  try {
    return readHarthmereLevelingState().attributes[name] >= value;
  } catch {
    return false;
  }
}

function neutralRoleTone(offset: number) {
  if (GUARD_OFFSETS.has(offset)) {
    return "I keep a steady watch on the street while I wait to hear your business.";
  }
  if (MERCHANT_OFFSETS.has(offset)) {
    return "I am weighing your coin, your gear, and the goods closest to the counter.";
  }
  if (TEMPLE_OFFSETS.has(offset)) {
    return "I keep my voice low; chapel stones have a way of listening too.";
  }
  if (CRIMINAL_OFFSETS.has(offset)) {
    return "I choose each word carefully and keep one eye on the street behind you.";
  }
  if (offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET) {
    return "The newest notices are nailed over older work, with fresh ink marking the urgent jobs.";
  }
  return "I see the road dust on your boots, and I am waiting to learn what brought you to Harthmere.";
}

function relationTone(
  offset: number,
  reputationState: HarthmereReputationState
) {
  const behaviorResponse = getHarthmereNpcSocialResponse(
    offset,
    reputationState
  );
  if (behaviorResponse.reason !== "neutral_role_response") {
    return behaviorResponse.dialogueLine;
  }
  const personal = reputationState.personal[offset];
  const regional = reputationState.regions.harthmere;
  const likeability = personal?.likeability ?? regional.likeability;
  const legal = regional.legal;
  const notoriety = regional.notoriety;

  if (GUARD_OFFSETS.has(offset) && legal < -2000) {
    return "My hand stays close to the whistle while I decide whether this becomes an arrest.";
  }
  if (MERCHANT_OFFSETS.has(offset) && likeability < -1500) {
    return "I am keeping the counter between you and the better goods.";
  }
  if (likeability > 1200) {
    return "I recognize you, and I can let my guard drop a little.";
  }
  if (notoriety > 2500) {
    return "I have heard your name before, but I am still deciding whether that is good news.";
  }
  return neutralRoleTone(offset);
}

export function buildHarthmereDialogueLines(
  context: HarthmereDialogueContext
): string[] {
  const additiveTownProfile = harthmereAdditiveTownNpcDialogueForOffset(
    context.offset
  );
  // Additive-town first contact is intentionally one compact, character-led
  // greeting. Biography, district lore, route commentary, reputation state,
  // and quest details live behind explicit choices or in the HUD/journal.
  if (additiveTownProfile && !context.isBoard) {
    return [additiveTownProfile.intro];
  }

  const memory = readHarthmereDialogueMemory();
  const greetedCount = memory.greeted[context.offset] ?? 0;
  const lines: string[] = [];
  // SNAPSHOT_HARTHMERE_BIBLE_DIALOGUE:
  // Add Grove-style character-bible lines while preserving existing quest, vendor, combat, and reputation actions.
  const bibleLines = snapshotHarthmereBibleLines(context.offset);

  if (context.isBoard) {
    lines.push("Harthmere Market Board");
    lines.push(
      "Fresh ink marks urgent work first: guard trouble, market needs, missing goods, and road warnings."
    );
  } else if (greetedCount > 1) {
    lines.push("I remember you. Let's return to the matter at hand.");
  } else {
    lines.push(context.defaultDialog);
  }

  const roleLine = ROLE_LINES[context.offset];
  if (roleLine) {
    lines.push(roleLine);
  }
  if (bibleLines.length) {
    lines.push(...bibleLines.slice(0, 2));
  }
  const routeLine = getHarthmereNpcCurrentRouteLine(context.offset);
  if (routeLine) {
    lines.push(routeLine);
  }

  lines.push(relationTone(context.offset, context.reputationState));

  if (context.matchingQuestTitle && context.matchingQuestObjective) {
    lines.push(
      `I can point you toward ${context.matchingQuestTitle}: ${context.matchingQuestObjective}`
    );
  } else if (context.activeObjective) {
    lines.push(`The lead I know is this: ${context.activeObjective}`);
  } else if (context.availableQuestTitles.length) {
    lines.push(
      `I know of work nearby: ${context.availableQuestTitles
        .slice(0, 3)
        .join(", ")}.`
    );
  } else if (context.isBoard && context.activeObjectiveLines.length) {
    lines.push(...context.activeObjectiveLines.slice(0, 3));
  }

  if (context.completedQuestTitles.length && greetedCount > 0) {
    lines.push(
      `I remember what you already handled: ${context.completedQuestTitles
        .slice(0, 3)
        .join(", ")}.`
    );
  }

  if (context.extraLines?.length) {
    lines.push(context.extraLines[0]);
  }

  return lines.slice(0, context.isBoard ? 8 : 6);
}

export function dialogueActionsForHarthmereNpc(
  offset: number,
  context: {
    activeObjective?: string;
    availableQuestTitles: string[];
    matchingQuestTitle?: string;
    matchingQuestObjective?: string;
    completedQuestTitles: string[];
    onRefresh?: () => void;
  }
): TalkDialogStepAction[] {
  const actions: TalkDialogStepAction[] = [];
  const name = npcName(offset);
  const direction = DISTRICT_DIRECTIONS[offset] ?? DISTRICT_DIRECTIONS[41];
  const additiveTownProfile = harthmereAdditiveTownNpcDialogueForOffset(offset);
  const relevantActiveObjective = additiveTownProfile
    ? context.matchingQuestObjective
    : context.activeObjective;

  if (additiveTownProfile) {
    actions.push({
      name: "Tell me about yourself.",
      tooltip: "Ask for this person's longer background story.",
      followUpText: additiveTownProfile.story,
      onPerformed: () => {
        updateGreeted(offset);
        recordDialogueChoice({
          npcOffset: offset,
          kind: "ask",
          label: "Asked about their story",
          summary: additiveTownProfile.story,
        });
      },
    });

    actions.push({
      name: "What should I know about this place?",
      tooltip: "Ask for local knowledge grounded in this district.",
      followUpText: additiveTownProfile.location,
      onPerformed: () => {
        updateGreeted(offset);
        recordDialogueChoice({
          npcOffset: offset,
          kind: "guide",
          label: "Asked about the district",
          summary: additiveTownProfile.location,
        });
      },
    });
  }

  actions.push({
    name: "What needs doing here?",
    tooltip:
      "Ask for the most immediate local need without asking for a lecture.",
    followUpText:
      context.matchingQuestTitle && context.matchingQuestObjective
        ? `I can point you to ${context.matchingQuestTitle}: ${context.matchingQuestObjective}`
        : relevantActiveObjective
        ? `I can point you back to the active lead: ${relevantActiveObjective}`
        : context.availableQuestTitles.length
        ? `The useful work here is ${context.availableQuestTitles
            .slice(0, 3)
            .join(", ")}.`
        : "I do not have urgent work for you. Ask me about this place if you want something useful before you go.",
    onPerformed: () => {
      updateGreeted(offset);
      recordDialogueChoice({
        npcOffset: offset,
        kind: "ask",
        label: "Asked about local needs",
        summary: "Asked for what mattered most instead of old stories.",
      });
    },
  });

  actions.push({
    name: "Remind me where to go.",
    tooltip:
      "Ask for a useful direction without making them retell the whole story.",
    followUpText:
      relevantActiveObjective ?? direction
        ? `Here is a direction you can use: ${
            relevantActiveObjective ?? direction
          }`
        : "I would start back at the market square if you are lost.",
    onPerformed: () => {
      updateGreeted(offset);
      recordDialogueChoice({
        npcOffset: offset,
        kind: "ask",
        label: "Directions",
        summary:
          "Asked for repeatable directions instead of relying on memory.",
      });
    },
  });

  actions.push({
    name: "Heard anything useful?",
    tooltip: "Asks for a local rumor without forcing a quest accept.",
    followUpText: firstRumor(offset),
    onPerformed: () => {
      updateGreeted(offset);
      recordDialogueChoice({
        npcOffset: offset,
        kind: "ask",
        label: "Rumor",
        summary: firstRumor(offset),
      });
    },
  });

  actions.push({
    name: "Your work matters here.",
    tooltip: "Small relationship gain. No major consequence.",
    followUpText:
      "I appreciate hearing that. It is not a grand speech, but I remember respect when the town gets noisy.",
    onPerformed: () => {
      applyHarthmereReputationChange({
        label: "Respectful conversation",
        detail: `Treated ${name} with respect during conversation.`,
        npcOffset: offset,
        personal: { likeability: 8 },
      });
      recordDialogueChoice({
        npcOffset: offset,
        kind: "friendly",
        label: "Complimented work",
        summary:
          "Gave a respectful response that improved the personal relationship.",
        consequence: "Minor personal relationship gain.",
      });
      context.onRefresh?.();
    },
  });

  actions.push({
    name: "I need the answer, not the story.",
    tooltip:
      "Minor relationship loss. Useful when roleplaying an impatient character.",
    followUpText:
      "I will give you the useful answer, but do not expect much warmth with it.",
    onPerformed: () => {
      applyHarthmereReputationChange({
        label: "Abrupt conversation",
        detail: `Rushed ${name} through a conversation.`,
        npcOffset: offset,
        personal: { likeability: -10 },
      });
      recordDialogueChoice({
        npcOffset: offset,
        kind: "rude",
        label: "Rushed NPC",
        summary: "Chose a curt response. The answer came colder than before.",
        consequence: "Minor personal relationship loss.",
      });
      context.onRefresh?.();
    },
  });

  const canPersuade = hasAttribute("charisma", 12);
  actions.push({
    name: "Can you help me a little more?",
    disabled: !canPersuade,
    tooltip: canPersuade
      ? "Ask for extra help without turning this into a long conversation."
      : "You do not have the presence to make this land yet.",
    followUpText: canPersuade
      ? "You are worth the extra sentence. Take one more practical warning before you leave."
      : undefined,
    onPerformed: () => {
      if (!canPersuade) {
        return;
      }
      applyHarthmereReputationChange({
        label: "Persuasive conversation",
        detail: `Used Charisma to get better cooperation from ${name}.`,
        npcOffset: offset,
        personal: { likeability: 12 },
        harthmere: { likeability: 3 },
      });
      recordDialogueChoice({
        npcOffset: offset,
        kind: "persuade",
        label: "Asked for extra help",
        summary: "Used Charisma to get a more helpful response.",
        consequence: "Small relationship gain.",
      });
      context.onRefresh?.();
    },
  });

  const canNotice = hasAttribute("perception", 12);
  actions.push({
    name: "What are you not saying?",
    disabled: !canNotice,
    tooltip: canNotice
      ? "Look for the part they are carefully avoiding."
      : "You cannot read enough from them yet.",
    followUpText: canNotice
      ? "I am not saying the dangerous part directly, but you caught the gap: the safest answer and the true answer are not the same."
      : undefined,
    onPerformed: () => {
      if (!canNotice) {
        return;
      }
      recordDialogueChoice({
        npcOffset: offset,
        kind: "perception",
        label: "Read between the lines",
        summary:
          "Used Perception to notice the NPC was avoiding a detail. The clue is kept in dialogue memory.",
      });
    },
  });

  if (GUARD_OFFSETS.has(offset)) {
    actions.push({
      name: "What are the local laws?",
      tooltip: "Guard/legal dialogue. No penalty for asking.",
      followUpText:
        "I keep it simple: do not draw steel on citizens, do not steal from shops, do not enter restricted rooms, and do not use the temple as a shortcut from trouble.",
      onPerformed: () => {
        recordDialogueChoice({
          npcOffset: offset,
          kind: "ask",
          label: "Asked about local laws",
          summary: "Learned the basic legal boundaries in Harthmere.",
        });
      },
    });

    actions.push({
      name: "I saw something suspicious.",
      tooltip: "Lawful report. Small legal standing gain.",
      followUpText:
        "I will take the report without ceremony. If it proves useful, the Watch will remember who brought it in cleanly.",
      onPerformed: () => {
        applyHarthmereReputationChange({
          label: "Reported suspicious activity",
          detail:
            "Shared a clean report with the Watch instead of starting trouble.",
          harthmere: { legal: 20, likeability: 4, notoriety: 2 },
        });
        recordDialogueChoice({
          npcOffset: offset,
          kind: "report",
          label: "Reported suspicious activity",
          summary: "Chose a lawful route with the Watch.",
          consequence: "Small legal standing gain.",
        });
        context.onRefresh?.();
      },
    });
  }

  if (MERCHANT_OFFSETS.has(offset)) {
    actions.push({
      name: "What do people need most here?",
      tooltip: "Merchant conversation. No transaction required.",
      followUpText:
        "What moves fastest this week is road food, repair work, healing goods, river cargo, and anything that keeps a traveler moving after rain.",
      onPerformed: () => {
        recordDialogueChoice({
          npcOffset: offset,
          kind: "ask",
          label: "Asked about local prices",
          summary: "Learned what the local economy values right now.",
        });
      },
    });
  }

  if (TEMPLE_OFFSETS.has(offset)) {
    actions.push({
      name: "What does mercy cost here?",
      disabled: !hasAttribute("wisdom", 12),
      tooltip: hasAttribute("wisdom", 12)
        ? "Ask for a reflective answer."
        : "You are not ready to ask this well yet.",
      followUpText:
        "My answer is quiet: mercy costs time first, then pride, and sometimes coin last. The chapel prefers that order.",
      onPerformed: () => {
        if (!hasAttribute("wisdom", 12)) {
          return;
        }
        recordDialogueChoice({
          npcOffset: offset,
          kind: "ask",
          label: "Asked about mercy",
          summary: "Used Wisdom to unlock a spiritual conversation path.",
        });
      },
    });
  }

  if (CRIMINAL_OFFSETS.has(offset)) {
    actions.push({
      name: "The Watch is not watching.",
      tooltip:
        "Risky social choice. This can help with shady contacts but may hurt lawful trust if repeated.",
      followUpText:
        "I do not believe you fully, but I appreciate that you know when not to say everything out loud.",
      onPerformed: () => {
        applyHarthmereReputationChange({
          label: "Shady conversation",
          detail: `Used a suspicious line with ${name}.`,
          npcOffset: offset,
          personal: { likeability: 10 },
          harthmere: { legal: -8, notoriety: 4 },
        });
        recordDialogueChoice({
          npcOffset: offset,
          kind: "ask",
          label: "Used a shady line",
          summary: "Chose a criminal-coded response.",
          consequence: "Minor legal loss, minor personal gain with shady NPC.",
        });
        context.onRefresh?.();
      },
    });
  }

  actions.push({
    name: "Push for answers.",
    type: "destructive",
    tooltip:
      "Warning: hostile tone. This may damage personal trust and legal standing if witnessed.",
    followUpText:
      "I will give ground only as far as fear forces me. That kind of answer travels badly through town.",
    onPerformed: () => {
      applyHarthmereReputationChange({
        label: "Threatened in conversation",
        detail: `Threatened ${name} to force an answer.`,
        npcOffset: offset,
        personal: { likeability: -35 },
        harthmere: { likeability: -12, legal: -20, notoriety: 4 },
      });
      recordDialogueChoice({
        npcOffset: offset,
        kind: "threaten",
        label: "Threatened for answers",
        summary: "Used a hostile dialogue choice with a warned consequence.",
        consequence: "Personal trust loss and minor legal/social penalty.",
      });
      context.onRefresh?.();
    },
  });

  if (offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET) {
    actions.push({
      name: "How do I read the notices?",
      tooltip: "Ask how public work is posted around Harthmere.",
      followUpText:
        "I keep the notices plain: guard work near the top, market needs in the center, road warnings at the edge, and old notices marked in faded ink.",
      onPerformed: () => {
        recordDialogueChoice({
          npcOffset: offset,
          kind: "guide",
          label: "Read notices",
          summary: "Asked how Harthmere public notices are sorted.",
        });
      },
    });

    actions.push({
      name: "Clear remembered talks",
      tooltip:
        "Clears recent Harthmere conversation notes stored in this browser.",
      onPerformed: () => {
        resetHarthmereDialogueMemory();
      },
      followUpText: "Your recent conversation notes have been cleared.",
    });
  }

  const limited: TalkDialogStepAction[] = [];
  const take = (predicate: (action: TalkDialogStepAction) => boolean) => {
    const found = actions.find(
      (action) =>
        predicate(action) &&
        !limited.some((entry) => entry.name === action.name)
    );
    if (found) {
      limited.push(found);
    }
  };

  take((action) => action.name === "Tell me about yourself.");
  take((action) => action.name === "What should I know about this place?");
  take((action) => action.name === "What needs doing here?");
  take((action) => action.name === "Remind me where to go.");
  if (GUARD_OFFSETS.has(offset)) {
    take((action) => action.name === "What are the local laws?");
    take((action) => action.name === "I saw something suspicious.");
  } else if (MERCHANT_OFFSETS.has(offset)) {
    take((action) => action.name === "What do people need most here?");
  } else if (TEMPLE_OFFSETS.has(offset)) {
    take(
      (action) =>
        action.name === "What does mercy cost here?" && !action.disabled
    );
  } else if (CRIMINAL_OFFSETS.has(offset)) {
    take((action) => action.name === "The Watch is not watching.");
  } else if (offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET) {
    take((action) => action.name === "How do I read the notices?");
  }
  take((action) => action.name === "Heard anything useful?");
  take((action) => action.name === "Your work matters here.");
  take((action) => action.name === "Push for answers.");

  return limited.slice(0, 4);
}

function formatWhen(at: number) {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (deltaSeconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.floor(minutes / 60)}h ago`;
}

export const HarthmereDialogueMenuPanel: React.FunctionComponent<{}> = () => {
  const [memory, setMemory] = useState<HarthmereDialogueMemoryState>(() =>
    readHarthmereDialogueMemory()
  );

  useEffect(() => {
    const refresh = () => setMemory(readHarthmereDialogueMemory());
    const interval = window.setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_DIALOGUE_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_DIALOGUE_EVENT, refresh);
    };
  }, []);

  const recent = useMemo(() => memory.choices.slice(0, 8), [memory.choices]);

  return (
    <div className="rounded-lg border-white/15 mb-2 w-[30rem] border bg-black/75 p-3 text-white shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sky-200 text-sm font-semibold uppercase tracking-wide">
            Harthmere Conversations
          </div>
          <div className="text-xs text-white/70">
            A record of who you spoke with and what changed afterward.
          </div>
        </div>
        <button
          className="rounded border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
          onClick={() => resetHarthmereDialogueMemory()}
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-white/10 bg-white/5 p-2">
          <div className="font-semibold text-white">Town Talk</div>
          <div className="mt-1 text-white/70">
            People answer from their work, their worries, and the place they
            belong in town.
          </div>
        </div>
        <div className="rounded border border-white/10 bg-white/5 p-2">
          <div className="font-semibold text-white">Tone</div>
          <div className="mt-1 text-white/70">
            Respect, impatience, threats, reports, and shady lines can change
            how people treat you.
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs font-semibold text-white/90">
        Recent Conversation Notes
      </div>
      <div className="rounded mt-1 max-h-56 overflow-auto border border-white/10 bg-black/30">
        {recent.length ? (
          recent.map((entry) => (
            <div
              key={entry.id}
              className="border-b border-white/10 p-2 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white">{entry.npcName}</div>
                <div className="text-white/45 text-[0.65rem] uppercase tracking-wide">
                  {entry.kind} · {formatWhen(entry.at)}
                </div>
              </div>
              <div className="text-white/75">{entry.summary}</div>
              {entry.consequence && (
                <div className="text-amber-200/80 mt-1">
                  Consequence: {entry.consequence}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-3 text-white/60">
            No conversation notes yet. Speak with Harthmere locals to build
            history.
          </div>
        )}
      </div>
    </div>
  );
};
