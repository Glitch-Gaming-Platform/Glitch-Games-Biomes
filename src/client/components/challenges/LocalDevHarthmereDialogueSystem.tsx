import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  applyHarthmereReputationChange,
  type HarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { readHarthmereLevelingState } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_DIALOGUE_MEMORY_KEY =
  "biomes.localDev.harthmere.dialogueMemory.v1";
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
  5: "The bakery conversation starts with the problem first: bread, apples, and what must be done before the ovens cool.",
  6: "Merl keeps the useful facts near the top of the conversation: what is missing, where it moved, and who handled it last.",
  7: "Brann keeps weapons talk practical. Training blades first, boasting never.",
  8: "Luma speaks in short instructions because sick people do not need speeches.",
  9: "Edrin separates the useful warning from the optional lore. If you want the long version, ask for it.",
  10: "Tilda talks like someone with work waiting: animals, fences, feed, then payment.",
  11: "Garrick offers services quickly, then rumors if you want to linger.",
  27: "Bram gives directions before stories. Gate, market, services, then roads out.",
  28: "Mara is good at short answers. She knows where people gather, argue, hide, and trade.",
  29: "Osric says what is broken, what is needed, and what it will cost to fix.",
  30: "Elowen keeps rumors useful: who said it, where it points, and whether it is safe to follow.",
  31: "Aldren speaks gently, but he does not bury the warning: the missing bell matters.",
  33: "Nessa answers indirectly unless she trusts you. In Mudden Ward, names travel faster than coin.",
  34: "Tovin talks in cargo facts: origin, owner, wet marks, missing seals.",
  41: "The board keeps the short version visible: available work, tracked work, turn-ins, and first routes.",
  44: "Hal keeps training instructions brief. Pick a target, swing clean, do not crowd the lane.",
  46: "Maelle gives the compassionate answer first, then the spiritual one if asked.",
  47: "Ysabet names ingredients exactly. Guessing is how people drink the wrong bottle.",
  62: "Ora speaks like someone remembering a sound nobody else wanted to hear.",
  70: "The Echo answers in clues, but the journal should keep the usable instruction.",
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
    "Maren heard the orchard road went quiet before dawn. She thinks someone moved crates before the bakers arrived.",
    "The bakery rumor is practical: if the Guard goes hungry, everyone hears about it by noon.",
  ],
  6: [
    "Merl will not say 'thief' yet. He says 'chain of custody' because it sounds less embarrassing.",
    "A wet footprint near a lockbox means either docks, drains, or someone trying to look like both.",
  ],
  11: [
    "Garrick says the best rumors come from people who pretend they are only asking for another cup.",
    "A card player swore a crate whispered on the docks, then immediately asked if anyone wanted to buy his silence.",
  ],
  27: [
    "Bram says newcomers who learn the square survive longer than newcomers who chase smoke into alleys.",
  ],
  30: [
    "Elowen says the Missing Bell story is old enough that people call it nonsense when they are afraid it is true.",
  ],
  31: [
    "Aldren says no bell was stolen. That is the part people keep getting wrong.",
  ],
  33: [
    "Nessa says the drains remember every coin dropped in panic.",
    "Mudden Ward rumor: when the river rises, old doors below town breathe cold air.",
  ],
  34: ["Tovin says crates with no owner usually have too many owners."],
  41: [
    "Newest board rumor: farms need hands, docks need eyes, and the chapel needs someone brave enough to ask about the bell.",
  ],
  62: [
    "Ora heard bronze under stone. She did not hear it with her ears alone.",
  ],
  70: [
    "The Echo repeats only one useful thing: the bell was buried to keep something from answering.",
  ],
};

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
    const raw = window.localStorage.getItem(HARTHMERE_DIALOGUE_MEMORY_KEY);
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
  window.localStorage.setItem(
    HARTHMERE_DIALOGUE_MEMORY_KEY,
    JSON.stringify(state),
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
  const pool = RUMORS[offset] ?? RUMORS[41];
  const memory = readHarthmereDialogueMemory();
  const count = memory.greeted[offset] ?? 0;
  return pool[count % pool.length];
}

function hasAttribute(
  name: keyof ReturnType<typeof readHarthmereLevelingState>["attributes"],
  value: number,
) {
  try {
    return readHarthmereLevelingState().attributes[name] >= value;
  } catch {
    return false;
  }
}

function relationTone(
  offset: number,
  reputationState: HarthmereReputationState,
) {
  const personal = reputationState.personal[offset];
  const regional = reputationState.regions.harthmere;
  const likeability = personal?.likeability ?? regional.likeability;
  const legal = regional.legal;
  const notoriety = regional.notoriety;

  if (GUARD_OFFSETS.has(offset) && legal < -2000) {
    return "Their attention sharpens. They are not starting with a speech; they are deciding whether this becomes an arrest.";
  }
  if (MERCHANT_OFFSETS.has(offset) && likeability < -1500) {
    return "They keep the useful answer short and one hand near whatever counts as security here.";
  }
  if (likeability > 1200) {
    return "They recognize you warmly and skip the suspicion most strangers earn first.";
  }
  if (notoriety > 2500) {
    return "They know your name before you give it, but they are still deciding whether that is good news.";
  }
  return "They keep the conversation practical and leave room for you to ask more.";
}

export function buildHarthmereDialogueLines(
  context: HarthmereDialogueContext,
): string[] {
  const memory = readHarthmereDialogueMemory();
  const greetedCount = memory.greeted[context.offset] ?? 0;
  const lines: string[] = [];

  if (context.isBoard) {
    lines.push("Harthmere Market Board");
    lines.push(
      "Jobs are sorted by what helps a newcomer fastest: current work first, nearby opportunities second, rumors last.",
    );
  } else if (greetedCount > 1) {
    lines.push(
      `${npcName(context.offset)} recognizes you and gives the shorter version this time.`,
    );
  } else {
    lines.push(context.defaultDialog);
  }

  const roleLine = ROLE_LINES[context.offset];
  if (roleLine) {
    lines.push(roleLine);
  }

  lines.push(relationTone(context.offset, context.reputationState));

  if (context.matchingQuestTitle && context.matchingQuestObjective) {
    lines.push(
      `Important: ${context.matchingQuestTitle}. ${context.matchingQuestObjective}`,
    );
  } else if (context.activeObjective) {
    lines.push(`Current lead: ${context.activeObjective}`);
  } else if (context.availableQuestTitles.length) {
    lines.push(
      `Available work here: ${context.availableQuestTitles.slice(0, 3).join(", ")}.`,
    );
  } else if (context.isBoard && context.activeObjectiveLines.length) {
    lines.push(...context.activeObjectiveLines.slice(0, 3));
  }

  if (context.completedQuestTitles.length && greetedCount > 0) {
    lines.push(
      `They remember your finished work: ${context.completedQuestTitles.slice(0, 3).join(", ")}.`,
    );
  }

  if (context.extraLines?.length) {
    lines.push(context.extraLines[0]);
  }

  return lines.slice(0, context.isBoard ? 7 : 5);
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
  },
): TalkDialogStepAction[] {
  const actions: TalkDialogStepAction[] = [];
  const name = npcName(offset);
  const direction = DISTRICT_DIRECTIONS[offset] ?? DISTRICT_DIRECTIONS[41];

  actions.push({
    name: "[Ask] Give me the short version.",
    tooltip:
      "Summarizes the important information without repeating optional lore.",
    followUpText:
      context.matchingQuestTitle && context.matchingQuestObjective
        ? `${name} keeps it brief: ${context.matchingQuestTitle}. ${context.matchingQuestObjective}`
        : context.activeObjective
          ? `${name} points you back to the active lead: ${context.activeObjective}`
          : context.availableQuestTitles.length
            ? `${name} says the useful work here is ${context.availableQuestTitles.slice(0, 3).join(", ")}.`
            : `${name} says there is no urgent job here. The Market Board can point you to active work.`,
    onPerformed: () => {
      updateGreeted(offset);
      recordDialogueChoice({
        npcOffset: offset,
        kind: "ask",
        label: "Short version",
        summary: "Asked for the practical summary instead of optional lore.",
      });
    },
  });

  actions.push({
    name: "[Ask] Remind me where to go.",
    tooltip: "Gets a direction-style answer and leaves deeper lore optional.",
    followUpText:
      (context.activeObjective ?? direction)
        ? `${name} gives a direction you can use: ${context.activeObjective ?? direction}`
        : `${name} points back toward the market square. Start there if you are lost.`,
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
    name: "[Rumor] Heard anything useful?",
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
    name: "[Friendly] Compliment their work.",
    tooltip: "Small relationship gain. No major consequence.",
    followUpText: `${name} softens a little. It is not a grand speech, but they remember respect when the town gets noisy.`,
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
    name: "[Rude] Get to the point.",
    tooltip:
      "Minor relationship loss. Useful when roleplaying an impatient character.",
    followUpText: `${name} gives you the useful answer, but the warmth leaves the room.`,
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
        summary:
          "Chose a curt response. The conversation stayed functional, but less friendly.",
        consequence: "Minor personal relationship loss.",
      });
      context.onRefresh?.();
    },
  });

  const canPersuade = hasAttribute("charisma", 12);
  actions.push({
    name: "[Charisma] Ask for a little extra help.",
    disabled: !canPersuade,
    tooltip: canPersuade
      ? "Charisma check passed. This gives a small personal trust boost."
      : "Requires Charisma 12. The choice is visible so you know what kind of build unlocks it.",
    followUpText: canPersuade
      ? `${name} decides you are worth the extra sentence. They add one practical warning before you leave.`
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
    name: "[Perception] Watch what they avoid saying.",
    disabled: !canNotice,
    tooltip: canNotice
      ? "Perception check passed. Reveals a sharper clue without forcing a quest branch."
      : "Requires Perception 12.",
    followUpText: canNotice
      ? `${name} never says the dangerous part directly, but you catch the gap: the safest answer and the true answer are not the same.`
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
      name: "[Ask] What are the local laws?",
      tooltip: "Guard/legal dialogue. No penalty for asking.",
      followUpText:
        "The guard keeps it simple: do not draw steel on citizens, do not steal from shops, do not enter restricted rooms, and do not use the temple as a shortcut from trouble.",
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
      name: "[Report] Share suspicious activity.",
      tooltip: "Lawful report. Small legal standing gain.",
      followUpText:
        "The guard takes the report without ceremony. If it proves useful, the Watch will remember who brought it in cleanly.",
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
      name: "[Ask] What sells well here?",
      tooltip: "Merchant conversation. No transaction required.",
      followUpText:
        "They talk in practical categories: road food, repair work, healing goods, river cargo, and anything that keeps a traveler moving after rain.",
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
      name: "[Wisdom] Ask what mercy costs here.",
      disabled: !hasAttribute("wisdom", 12),
      tooltip: hasAttribute("wisdom", 12)
        ? "Wisdom check passed. Opens a reflective response."
        : "Requires Wisdom 12.",
      followUpText:
        "The answer is quiet: mercy costs time first, then pride, and sometimes coin last. The chapel prefers that order.",
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
      name: "[Lie] Say the Watch is not watching.",
      tooltip:
        "Risky social choice. This can help with shady contacts but may hurt lawful trust if repeated.",
      followUpText:
        "They do not believe you fully, but they appreciate that you know when not to say everything out loud.",
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
    name: "[Threaten] Push for answers.",
    type: "destructive",
    tooltip:
      "Warning: hostile tone. This may damage personal trust and legal standing if witnessed.",
    followUpText: `${name} gives ground only as far as fear forces them. That kind of answer travels badly through town.`,
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

  if (offset === 41) {
    actions.push({
      name: "[Guide] Explain dialogue choices.",
      tooltip: "Shows how Harthmere dialogue works.",
      followUpText:
        "Dialogue choices are labeled by intent: Ask, Friendly, Rude, Threaten, Report, Attribute, and so on. Serious consequences are warned. Basic instructions go into the mission journal so you do not have to memorize one-time lines.",
      onPerformed: () => {
        recordDialogueChoice({
          npcOffset: offset,
          kind: "guide",
          label: "Dialogue guide",
          summary: "Reviewed the Harthmere dialogue choice rules.",
        });
      },
    });

    actions.push({
      name: "Reset local-dev dialogue memory",
      tooltip: "Clears only Harthmere dialogue memory stored in this browser.",
      onPerformed: () => {
        resetHarthmereDialogueMemory();
      },
      followUpText:
        "Dialogue memory reset. NPCs will treat repeat conversations like first-time local-dev conversations again.",
    });
  }

  return actions;
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
    readHarthmereDialogueMemory(),
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
    <div className="mb-2 w-[30rem] rounded-lg border border-white/15 bg-black/75 p-3 text-white shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-sky-200">
            Harthmere Dialogue
          </div>
          <div className="text-xs text-white/70">
            Short conversations, clear choices, warned consequences, and memory.
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
          <div className="font-semibold text-white">Conversation Rules</div>
          <div className="mt-1 text-white/70">
            Important details first. Optional lore stays optional. Every NPC has
            a clean exit and repeatable directions.
          </div>
        </div>
        <div className="rounded border border-white/10 bg-white/5 p-2">
          <div className="font-semibold text-white">Choice Labels</div>
          <div className="mt-1 text-white/70">
            Ask, Friendly, Rude, Threaten, Report, Attribute, and Illegal labels
            tell you the intent before you click.
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs font-semibold text-white/90">
        Recent Dialogue Memory
      </div>
      <div className="mt-1 max-h-56 overflow-auto rounded border border-white/10 bg-black/30">
        {recent.length ? (
          recent.map((entry) => (
            <div
              key={entry.id}
              className="border-b border-white/10 p-2 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white">{entry.npcName}</div>
                <div className="text-[0.65rem] uppercase tracking-wide text-white/45">
                  {entry.kind} · {formatWhen(entry.at)}
                </div>
              </div>
              <div className="text-white/75">{entry.summary}</div>
              {entry.consequence && (
                <div className="mt-1 text-amber-200/80">
                  Consequence: {entry.consequence}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-3 text-white/60">
            No dialogue memory yet. Speak with Harthmere NPCs to build history.
          </div>
        )}
      </div>
    </div>
  );
};
