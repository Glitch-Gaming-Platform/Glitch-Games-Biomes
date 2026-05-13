import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { BiomesId } from "@/shared/ids";
import { useEffect, useMemo, useState } from "react";

const LOCAL_DEV_NPC_ID_BASE = 8_810_000_000_010_000;
const LOCAL_DEV_NPC_ID_LIMIT = 8_810_000_000_020_000;
const HARTHMERE_QUEST_STATE_KEY = "biomes.localDev.harthmere.questState.v1";

interface HarthmereQuestStep {
  objective: string;
  targetOffset: number;
  completion: string;
}

interface HarthmereQuestDefinition {
  id: string;
  title: string;
  giverOffsets: number[];
  boardListed?: boolean;
  repeatable?: boolean;
  summary: string;
  reward: string;
  steps: HarthmereQuestStep[];
}

interface HarthmereQuestState {
  active: Record<string, number>;
  completed: string[];
}

const EMPTY_STATE: HarthmereQuestState = {
  active: {},
  completed: [],
};

const QUESTS: HarthmereQuestDefinition[] = [
  {
    id: "welcome-to-harthmere",
    title: "Welcome to Harthmere",
    giverOffsets: [41, 42, 1, 27],
    boardListed: true,
    summary: "Learn the starter town route: gate, market, inn, smithy, bank, chapel, guard yard, then choose a road out.",
    reward: "New Arrival title, bread, a repair voucher, and a clear route through town.",
    steps: [
      {
        objective: "Speak with Sergeant Bram Holt at the North Gate.",
        targetOffset: 27,
        completion: "Bram checks your name against the gate ledger and points you toward the market fountain.",
      },
      {
        objective: "Read the Market Board beside the fountain.",
        targetOffset: 41,
        completion: "The board lists the town services and marks the next useful stop: Mara Thistle in the square.",
      },
      {
        objective: "Speak with Mara Thistle in Market Square.",
        targetOffset: 28,
        completion: "Mara explains the four beginner stops: bread, bank, blade, and blessing.",
      },
      {
        objective: "Visit the Copper Kettle and speak with Elowen Pike.",
        targetOffset: 30,
        completion: "Elowen shows you where travelers rest, hear rumors, and find group work.",
      },
      {
        objective: "Visit the Black Anvil and speak with Master Osric Vale.",
        targetOffset: 29,
        completion: "Osric explains repairs, crafting orders, and why the Guard always needs more hinges.",
      },
      {
        objective: "Visit Harthmere Bank and speak with Merl Voss.",
        targetOffset: 6,
        completion: "Merl shows you the vault, lockboxes, and storage services.",
      },
      {
        objective: "Light a candle at Temple Green by speaking with Father Aldren.",
        targetOffset: 31,
        completion: "Aldren gives you a road blessing and the first warning about the Missing Bell.",
      },
      {
        objective: "Report to Drill Instructor Hal in the Guard Yard.",
        targetOffset: 44,
        completion: "Hal points out the training dummies and bounty board.",
      },
      {
        objective: "Return to the Market Board and choose a first route: Farms, Docks, or Old Drains.",
        targetOffset: 41,
        completion: "You now understand Harthmere's services and can choose your first adventure route.",
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
        completion: "Maren asks for clean orchard apples for road cakes.",
      },
      {
        objective: "Speak with Apple Picker Ren in the orchard.",
        targetOffset: 63,
        completion: "Ren gives you a basket of usable apples and warns you about the road after dark.",
      },
      {
        objective: "Return the apples to Maren Dawnloaf.",
        targetOffset: 5,
        completion: "Maren sets warm apple tarts on the counter and thanks you for helping feed the road guards.",
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
        completion: "Merl admits the lockbox vanished between the counter and the courier desk.",
      },
      {
        objective: "Ask Courier Anwen whether she saw the lockbox.",
        targetOffset: 43,
        completion: "Anwen remembers a wet footprint near the delivery bags.",
      },
      {
        objective: "Ask Nessa Crowe about wet footprints in Mudden Ward.",
        targetOffset: 33,
        completion: "Nessa says the print leads toward a drain, not a thief's room.",
      },
      {
        objective: "Return to Banker Merl Voss with the clue.",
        targetOffset: 6,
        completion: "Merl unlocks a small storage favor and reluctantly thanks you.",
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
        completion: "Osric lists the missing nails, hinges, and cold iron scraps.",
      },
      {
        objective: "Ask Forge Apprentice Luth to prepare the scrap bundle.",
        targetOffset: 67,
        completion: "Luth gets the scrap ready and promises not to overheat it this time.",
      },
      {
        objective: "Report to Drill Instructor Hal in the Guard Yard.",
        targetOffset: 44,
        completion: "Hal accepts the training gear and updates the Guard notice.",
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
        completion: "Luma asks for willow bark, mint, and clean water.",
      },
      {
        objective: "Ask Ysabet Fenlow to prepare the fever tea.",
        targetOffset: 47,
        completion: "Ysabet mixes the remedy and complains about imprecise spoons.",
      },
      {
        objective: "Deliver the fever tea to Sister Maelle at the chapel.",
        targetOffset: 46,
        completion: "Maelle blesses the delivery and notes that sickness rises whenever the river floods.",
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
        completion: "Garrick says every table has a rumor, but only one pays.",
      },
      {
        objective: "Ask Bela the Storyteller about the Missing Bell.",
        targetOffset: 13,
        completion: "Bela says the bell was buried, not stolen.",
      },
      {
        objective: "Ask Kip the Card Player about the docks.",
        targetOffset: 14,
        completion: "Kip says odd crates arrive when the ferry bell is quiet.",
      },
      {
        objective: "Report the useful rumor to Elowen Pike.",
        targetOffset: 30,
        completion: "Elowen decides the buried bell rumor is dangerous enough to remember.",
      },
    ],
  },
  {
    id: "loose-chickens",
    title: "Loose Chickens",
    giverOffsets: [41, 10],
    boardListed: true,
    summary: "Help Tilda count the chicken yard before the bakery loses its eggs.",
    reward: "Eggs, coin, and farm favor.",
    steps: [
      {
        objective: "Speak with Tilda Fen at the farm.",
        targetOffset: 10,
        completion: "Tilda asks you to count the chickens and check the scarecrow fence.",
      },
      {
        objective: "Ask Pip the mascot whether the chickens escaped toward the market.",
        targetOffset: 4,
        completion: "Pip denies eating any evidence and points back to the farm.",
      },
      {
        objective: "Return to Tilda Fen with the count.",
        targetOffset: 10,
        completion: "Tilda declares the flock mostly accounted for, which is close enough for chickens.",
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
        completion: "Tovin says the crate is nobody's problem, which means it is his problem.",
      },
      {
        objective: "Ask the River Knots Lookout what the crate is hiding.",
        targetOffset: 65,
        completion: "The lookout says the crate was dry inside after three days in rain.",
      },
      {
        objective: "Return to the Market Board and choose whether to report or hide the clue.",
        targetOffset: 41,
        completion: "The clue is logged as a future branch between Watch trust and River Knots trust.",
      },
    ],
  },
  {
    id: "the-missing-bell",
    title: "The Missing Bell",
    giverOffsets: [41, 31, 62],
    boardListed: true,
    summary: "Start Harthmere's main mystery: chapel bell, old well, drains, and buried bronze.",
    reward: "Unlocks the Underways story route and future dungeon hook.",
    steps: [
      {
        objective: "Ask Father Aldren why the chapel has no bell.",
        targetOffset: 31,
        completion: "Aldren admits the bell was hidden because it rang for things below the town.",
      },
      {
        objective: "Speak with Bell-Witness Ora near the Old Well.",
        targetOffset: 62,
        completion: "Ora heard the bell from beneath the square at dawn.",
      },
      {
        objective: "Ask Nessa Crowe about the drains under Mudden Ward.",
        targetOffset: 33,
        completion: "Nessa says the drains lead to older stones and colder water.",
      },
      {
        objective: "Inspect the Underways entrance by speaking with the Echo near the bars.",
        targetOffset: 70,
        completion: "The old bronze marks answer the bell's name. The Underways should unlock in the next content pass.",
      },
    ],
  },
];


const HARTHMERE_EXTRA_DIALOGUE: Record<number, string[]> = {
  5: [
    "Shop inventory: brown loaf, onion roll, apple tart, honey bun, hard biscuit, seed cake, flour sacks, and festival road cakes.",
    "Interior detail check: oven, chimney, bread racks, kneading table, counter, flour sacks, baskets, and exterior bread display should all be visible.",
    "Quest hint: Apples for Dawnloaf starts here or at the Market Board.",
  ],
  6: [
    "Services: bank storage, deposit ledgers, lockboxes, vault access, guild deposits, and missing-lockbox investigation.",
    "Interior detail check: teller counter, vault door, lockboxes, ledger desk, coin table, and queue rails should all be visible.",
    "Quest hint: Missing Lockbox routes from Merl to Courier Anwen, then to Nessa in Mudden Ward.",
  ],
  7: [
    "Shop inventory: training blade, cudgel, dagger, spearhead, shield, repair kit, iron nails, hinges, and guard weapon orders.",
    "Interior detail check: forge, anvil, weapon racks, shield wall, water trough, armor stand, and exterior anvil sign should all be visible.",
    "Quest hint: Cold Iron, Hot Temper starts here or at the Market Board.",
  ],
  8: [
    "Shop inventory: bandages, healing salve, fever tea, willow bark, antidote, blessing candle, clean cloth, and herb bundles.",
    "Interior detail check: treatment bed, herb shelves, potion shelves, mortar table, hanging herbs, and exterior remedy display should all be visible.",
    "Quest hint: Fever Tea connects the healing shop, Ysabet, and Sister Maelle at the chapel.",
  ],
  9: [
    "Shop inventory: blank scrolls, chalk, candles, crystal shards, apprentice wand, old map fragment, and arcane rumor notes.",
    "Interior detail check: book walls, scroll shelves, candle ring, glowing crystal, ritual rug, locked room marker, and exterior magic beacon should all be visible.",
    "Quest hint: The Missing Bell mystery eventually points back to the old symbols described here.",
  ],
  10: [
    "Farm goods: eggs, chicken feed, apple baskets, hay bales, clean water, crop bundles, and bakery delivery crates.",
    "Environment detail check: crop rows, fence, chickens, hay bales, water trough, scarecrow, shed props, and orchard route should all be visible.",
    "Quest hint: Loose Chickens starts here or at the Market Board.",
  ],
  11: [
    "Tavern services: ale, stew, cider, room rental, bard stage, rumor purchase, dice table, and group-finder flavor.",
    "Interior detail check: bar, bottles, kegs, tables, chairs, hearth, stage, kitchen props, and exterior kettle sign should all be visible.",
    "Quest hint: Rumor Has It asks you to speak with tavern patrons before reporting to Elowen.",
  ],
  27: [
    "Town route: North Gate -> Market Board -> Mara -> Inn -> Smithy -> Bank -> Chapel -> Guard Yard -> first road out.",
    "Map hint: the Market Board is south of this gate near the fountain. The persistent Harthmere Quest Map should point there.",
  ],
  28: [
    "Market services: quest board, daily writs, delivery jobs, gossip, price disputes, and the first route through town.",
    "Direction hint: bread, bank, blade, blessing. Visit the bakery, bank, Black Anvil, and chapel before leaving town.",
  ],
  29: [
    "Crafting services: repair, blacksmithing tutorial, work orders, guard equipment, and special weapon-skin rumors.",
    "Visual check: the forge glow should make Craftsman Row readable from the market path.",
  ],
  30: [
    "Inn services: rested/home flavor, food buffs, tavern games, group rumors, bard stage, and social hub roleplay.",
    "Quest hint: tavern rumors connect the Missing Bell, docks, and cellar stories.",
  ],
  31: [
    "Chapel services: blessing, resurrection flavor, charity errands, candle vigil, Missing Bell lore, and crypt warning.",
    "Visual check: chapel pews, altar, candle/gold highlights, and the empty bell frame should be visible.",
  ],
  33: [
    "Mudden Ward routes: rat-catching, hidden drains, laundry alleys, flood rescue, and social justice story hooks.",
    "Quest hint: if the Missing Bell sends you to the drains, Nessa knows the safest unsafe entrance.",
  ],
  34: [
    "Dock services: fishing work, cargo runs, ferry travel, smuggling choices, dock defense, and suspicious crate rumors.",
    "Visual check: piers, rope posts, cargo stacks, black crate, dock tables, and river edge should all be visible.",
  ],
  41: [
    "Map: North Gate is north, Market is center, Bank and Smithy are east, Inn and Bakery are west, Chapel is north-east, Docks are east, Farm is south-west, Old Well and Underways are near the square.",
    "Starter chain: Welcome to Harthmere -> Market Knows -> A Bed and a Bowl -> Tools of Trade -> Banker Ledger -> Candle for the Road -> A Guarded Peace -> Three Roads Out.",
  ],
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readQuestState(): HarthmereQuestState {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_QUEST_STATE_KEY);
    if (!raw) {
      return { active: {}, completed: [] };
    }
    const parsed = JSON.parse(raw) as HarthmereQuestState;
    return {
      active: parsed.active ?? {},
      completed: parsed.completed ?? [],
    };
  } catch {
    return { active: {}, completed: [] };
  }
}

function writeQuestState(state: HarthmereQuestState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(HARTHMERE_QUEST_STATE_KEY, JSON.stringify(state));
}

function entityOffset(entityId: BiomesId) {
  const numericId = Number(entityId);
  if (numericId < LOCAL_DEV_NPC_ID_BASE || numericId >= LOCAL_DEV_NPC_ID_LIMIT) {
    return undefined;
  }
  return numericId - LOCAL_DEV_NPC_ID_BASE;
}

function textBlocks(lines: string[]) {
  return lines
    .map((line) => (line.includes("<text>") ? line : `<text>${line}</text>`))
    .join("{break}");
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
    if (state.completed.includes(quest.id) && !quest.repeatable) {
      return false;
    }
    if (state.active[quest.id] !== undefined) {
      return false;
    }
    if (offset === 41 && quest.boardListed) {
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

function completeStep(state: HarthmereQuestState, quest: HarthmereQuestDefinition): HarthmereQuestState {
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

function acceptQuest(state: HarthmereQuestState, quest: HarthmereQuestDefinition): HarthmereQuestState {
  return {
    ...state,
    active: {
      ...state.active,
      [quest.id]: 0,
    },
  };
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
  const [state, setState] = useState<HarthmereQuestState>(() => readQuestState());

  return useMemo(() => {
    if (offset === undefined) {
      return undefined;
    }

    const matching = matchingActiveQuests(offset, state);
    const available = availableQuestsForOffset(offset, state);
    const objectiveLines = activeObjectiveLines(state);
    const isBoard = offset === 41;
    const lines: string[] = [];

    if (isBoard) {
      lines.push("Harthmere Market Board");
      lines.push("Recommended first route: accept Welcome to Harthmere, then follow each objective in order.");
      lines.push(...(HARTHMERE_EXTRA_DIALOGUE[41] ?? []));
      if (objectiveLines.length) {
        lines.push(...objectiveLines.slice(0, 5));
      } else {
        lines.push("No active local-dev objectives yet. Pick a job below to start tracking it.");
      }
      const availableTitles = available.map((quest) => quest.title).join(", ");
      if (availableTitles) {
        lines.push(`Available jobs: ${availableTitles}.`);
      }
      const completedTitles = QUESTS.filter((quest) => state.completed.includes(quest.id))
        .map((quest) => quest.title)
        .join(", ");
      if (completedTitles) {
        lines.push(`Completed: ${completedTitles}.`);
      }
    } else {
      lines.push(defaultDialog);
      const extraDialogue = HARTHMERE_EXTRA_DIALOGUE[offset];
      if (extraDialogue?.length) {
        lines.push(...extraDialogue);
      }
      if (matching.length) {
        const quest = matching[0];
        const step = quest.steps[state.active[quest.id] ?? 0];
        lines.push(`Quest objective here: ${quest.title} — ${step.objective}`);
      } else if (objectiveLines.length) {
        lines.push(objectiveLines[0]);
      }
      if (available.length) {
        lines.push(`This character can start: ${available.map((quest) => quest.title).join(", ")}.`);
      }
    }

    const actions: TalkDialogStepAction[] = [];

    for (const quest of matching) {
      const step = quest.steps[state.active[quest.id] ?? 0];
      actions.push({
        name: `Complete: ${quest.title}`,
        type: "primary",
        tooltip: step?.objective,
        onPerformed: () => {
          const next = completeStep(readQuestState(), quest);
          writeQuestState(next);
          setState(next);
        },
      });
    }

    for (const quest of available.slice(0, isBoard ? 9 : 2)) {
      actions.push({
        name: `Accept: ${quest.title}`,
        tooltip: `${quest.summary} Reward: ${quest.reward}`,
        onPerformed: () => {
          const next = acceptQuest(readQuestState(), quest);
          writeQuestState(next);
          setState(next);
        },
      });
    }

    if (isBoard) {
      actions.push({
        name: "Reset local-dev quests",
        tooltip: "Clears only the Harthmere local-dev quest/objective state stored in this browser.",
        onPerformed: () => {
          writeQuestState({ active: {}, completed: [] });
          setState({ active: {}, completed: [] });
        },
      });
    }

    return {
      id: `harthmere-${talkingToNPCId}-${JSON.stringify(state)}`,
      dialogText: textBlocks(lines),
      actions,
    };
  }, [defaultDialog, offset, state, talkingToNPCId]);
}

type HarthmereQuestTarget = {
  label: string;
  district: string;
  pos: [number, number, number];
  icon: string;
};

const QUEST_TARGETS: Record<number, HarthmereQuestTarget> = {
  4: { label: "Pip, Harbor Mascot", district: "Market", pos: [441, 54, -202], icon: "•" },
  5: { label: "Dawn Loaf Bakery", district: "Bakery", pos: [434, 54, -192], icon: "B" },
  6: { label: "Harthmere Bank", district: "Services", pos: [550, 54, -222], icon: "$" },
  7: { label: "Weapons Teller", district: "Black Anvil", pos: [532, 54, -228], icon: "⚔" },
  8: { label: "Green Mortar Healer", district: "Healing", pos: [456, 54, -176], icon: "+" },
  10: { label: "Farm and Chicken Yard", district: "Farm", pos: [444, 54, -236], icon: "F" },
  11: { label: "Copper Kettle Bar", district: "Tavern", pos: [538, 54, -194], icon: "T" },
  13: { label: "Bela the Storyteller", district: "Tavern", pos: [554, 54, -190], icon: "R" },
  14: { label: "Kip the Card Player", district: "Tavern", pos: [546, 54, -186], icon: "R" },
  27: { label: "Sergeant Bram Holt", district: "North Gate", pos: [486, 54, -277], icon: "G" },
  28: { label: "Mara Thistle", district: "Market", pos: [440, 54, -200], icon: "M" },
  29: { label: "Master Osric Vale", district: "Craftsman Row", pos: [506, 54, -220], icon: "A" },
  30: { label: "Elowen Pike", district: "Copper Kettle", pos: [545, 54, -192], icon: "I" },
  31: { label: "Father Aldren", district: "Temple Green", pos: [477, 54, -139], icon: "C" },
  33: { label: "Nessa Crowe", district: "Mudden Ward", pos: [404, 54, -160], icon: "N" },
  34: { label: "Tovin Reed", district: "River Docks", pos: [579, 54, -183], icon: "D" },
  41: { label: "Market Board", district: "Market Square", pos: [503, 54, -211], icon: "!" },
  43: { label: "Courier Anwen", district: "Services", pos: [546, 54, -212], icon: "@" },
  44: { label: "Drill Instructor Hal", district: "Guard Yard", pos: [510, 54, -266], icon: "!" },
  46: { label: "Sister Maelle", district: "Temple Green", pos: [470, 54, -143], icon: "C" },
  47: { label: "Ysabet Fenlow", district: "Healing", pos: [462, 54, -172], icon: "+" },
  62: { label: "Bell-Witness Ora", district: "Old Well", pos: [490, 54, -190], icon: "?" },
  63: { label: "Apple Picker Ren", district: "Orchard", pos: [458, 54, -108], icon: "O" },
  65: { label: "River Knots Lookout", district: "Docks", pos: [600, 54, -176], icon: "D" },
  67: { label: "Forge Apprentice Luth", district: "Black Anvil", pos: [525, 54, -232], icon: "A" },
  70: { label: "Underways Echo", district: "Underways", pos: [400, 54, -235], icon: "?" },
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

export const HarthmereQuestMapHUD: React.FunctionComponent<{}> = () => {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const [state, setState] = useState<HarthmereQuestState>(() => readQuestState());

  useEffect(() => {
    const refresh = () => setState(readQuestState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
    };
  }, []);


  const active = firstActiveQuest(state);
  const target = active
    ? QUEST_TARGETS[active.step.targetOffset] ?? QUEST_TARGETS[41]
    : QUEST_TARGETS[41];
  const playerPos = localPlayer.player.position;
  const dx = target.pos[0] - playerPos[0];
  const dz = target.pos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirection(dx, dz);

  const majorMarkers = [
    QUEST_TARGETS[27], // Gate
    QUEST_TARGETS[41], // Board
    QUEST_TARGETS[30], // Inn
    QUEST_TARGETS[6], // Bank
    QUEST_TARGETS[29], // Smith
    QUEST_TARGETS[31], // Chapel
    QUEST_TARGETS[34], // Docks
    QUEST_TARGETS[33], // Mudden Ward
    QUEST_TARGETS[10], // Farm
    QUEST_TARGETS[70], // Underways
  ];

  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-yellow-200">
            Harthmere Quest Map
          </div>
          <div className="text-xs text-white/80">
            {active
              ? `${active.quest.title} — step ${active.stepIndex + 1}/${active.quest.steps.length}`
              : "No active quest — go to the Market Board"}
          </div>
        </div>
        <div className="rounded bg-yellow-300/20 px-1.5 py-0.5 text-xs font-semibold text-yellow-100">
          {distance}m {direction}
        </div>
      </div>
      <div className="mb-1 text-xs leading-snug text-white/90">
        <span className="font-semibold text-yellow-100">Next:</span>{" "}
        {active?.step.objective ?? "Read the Market Board beside the fountain."}
      </div>
      <div className="relative h-36 overflow-hidden rounded border border-white/10 bg-slate-900/80">
        <div className="absolute left-[8%] top-[8%] right-[8%] bottom-[8%] rounded border border-stone-400/40" />
        <div className="absolute left-[46%] top-[8%] bottom-[8%] w-[8%] bg-stone-500/30" />
        <div className="absolute left-[8%] right-[8%] top-[45%] h-[10%] bg-stone-500/30" />
        <div className="absolute left-[78%] top-[44%] h-[12%] w-[18%] bg-blue-500/30" />
        <div className="absolute left-[40%] top-[38%] h-[20%] w-[20%] rounded-full border border-yellow-300/40 bg-yellow-300/10" />
        {majorMarkers.map((marker) => {
          const left = mapPercent(marker.pos[0], 392, 608);
          const top = mapPercent(marker.pos[2], -288, -104);
          const isTarget = marker === target;
          return (
            <div
              key={`${marker.label}-${marker.pos.join(",")}`}
              className={`absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold ${
                isTarget
                  ? "bg-yellow-300 text-black ring-2 ring-white"
                  : "bg-black/70 text-white ring-1 ring-white/30"
              }`}
              style={{ left: `${left}%`, top: `${top}%` }}
              title={marker.label}
            >
              {marker.icon}
            </div>
          );
        })}
        <div
          className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-300 text-[9px] font-bold text-black ring-2 ring-white"
          style={{
            left: `${mapPercent(playerPos[0], 392, 608)}%`,
            top: `${mapPercent(playerPos[2], -288, -104)}%`,
          }}
          title="You"
        >
          Y
        </div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10px] leading-snug text-white/70">
        <div>Y = You</div>
        <div>! = Quest board/objective</div>
        <div>I = Inn</div>
        <div>A = Anvil / crafting</div>
        <div>C = Chapel</div>
        <div>D = Docks</div>
      </div>
    </div>
  );
};
