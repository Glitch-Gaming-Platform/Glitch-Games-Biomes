import type { HarthmereCombatStats } from "@/client/components/challenges/LocalDevHarthmereCombat";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_LEVELING_STATE_KEY =
  "biomes.localDev.harthmere.levelingState.v1";
const HARTHMERE_LEVELING_EVENT = "biomes:harthmere-leveling-changed";

const LEVEL_CAP = 50;
const BASE_XP = 100;
const GROWTH_RATE = 1.6;

const ATTRIBUTE_NAMES = [
  "strength",
  "dexterity",
  "intelligence",
  "wisdom",
  "constitution",
  "charisma",
  "perception",
  "willpower",
  "luck",
] as const;

type HarthmereAttribute = (typeof ATTRIBUTE_NAMES)[number];

type HarthmereNpcRank =
  | "critter"
  | "civilian"
  | "normal"
  | "strong"
  | "elite"
  | "mini_boss"
  | "dungeon_boss"
  | "world_boss";

type HarthmereXpSource =
  | "quest"
  | "quest_step"
  | "combat"
  | "exploration"
  | "training"
  | "admin";

export type HarthmereAttributes = Record<HarthmereAttribute, number>;

interface HarthmereLevelingLogEntry {
  id: string;
  at: number;
  label: string;
  detail: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface HarthmereLevelingState {
  version: 1;
  level: number;
  xpCurrent: number;
  attributePointsUnspent: number;
  talentPointsUnspent: number;
  attributes: HarthmereAttributes;
  unlockedAbilities: string[];
  discoveredZones: string[];
  recent: HarthmereLevelingLogEntry[];
}

export interface HarthmereDerivedStats {
  maxHp: number;
  maxMana: number;
  maxStamina: number;
  attackPoints: number;
  spellPower: number;
  healingPower: number;
  defense: number;
  armor: number;
  magicResistance: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalDamage: number;
  movementSpeed: number;
  carryCapacity: number;
  controlResistance: number;
}

interface HarthmereXpGrantInput {
  source: HarthmereXpSource;
  label: string;
  baseXp: number;
  sourceLevel?: number;
  difficulty?: HarthmereMissionDifficulty;
  rank?: HarthmereNpcRank;
  repeatKey?: string;
  detail?: string;
}

type HarthmereMissionDifficulty =
  | "trivial"
  | "easy"
  | "normal"
  | "hard"
  | "elite"
  | "group"
  | "dungeon"
  | "raid";

const DIFFICULTY_MULTIPLIERS: Record<HarthmereMissionDifficulty, number> = {
  trivial: 0.25,
  easy: 0.75,
  normal: 1,
  hard: 1.25,
  elite: 1.75,
  group: 2,
  dungeon: 2.5,
  raid: 5,
};

const NPC_RANK_MULTIPLIERS: Record<
  HarthmereNpcRank,
  { hp: number; attack: number; defense: number; xp: number }
> = {
  critter: { hp: 0.1, attack: 0.1, defense: 0.1, xp: 0.05 },
  civilian: { hp: 0.5, attack: 0.3, defense: 0.4, xp: 0 },
  normal: { hp: 1, attack: 1, defense: 1, xp: 1 },
  strong: { hp: 1.5, attack: 1.25, defense: 1.2, xp: 1.3 },
  elite: { hp: 3, attack: 1.75, defense: 1.5, xp: 2.5 },
  mini_boss: { hp: 8, attack: 2.5, defense: 2, xp: 8 },
  dungeon_boss: { hp: 30, attack: 4, defense: 3, xp: 25 },
  world_boss: { hp: 500, attack: 10, defense: 5, xp: 100 },
};

const DEFAULT_ATTRIBUTES: HarthmereAttributes = {
  strength: 10,
  dexterity: 10,
  intelligence: 8,
  wisdom: 8,
  constitution: 12,
  charisma: 8,
  perception: 10,
  willpower: 9,
  luck: 5,
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function levelingEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_LEVELING_EVENT));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function xpRequiredForLevel(level: number) {
  if (level >= LEVEL_CAP) {
    return 0;
  }
  if (level <= 1) {
    return 100;
  }
  return Math.round((BASE_XP * Math.pow(level, GROWTH_RATE)) / 50) * 50;
}

function attributePointsForLevel(level: number) {
  return 2 + (level % 5 === 0 ? 1 : 0);
}

function talentPointsForLevel(level: number) {
  return level % 2 === 0 ? 1 : 0;
}

function defaultLevelingState(): HarthmereLevelingState {
  return {
    version: 1,
    level: 1,
    xpCurrent: 0,
    attributePointsUnspent: 0,
    talentPointsUnspent: 0,
    attributes: { ...DEFAULT_ATTRIBUTES },
    unlockedAbilities: ["basic_strike"],
    discoveredZones: ["Harthmere"],
    recent: [],
  };
}

function normalizeAttributes(
  attributes: Partial<HarthmereAttributes> | undefined,
): HarthmereAttributes {
  return Object.fromEntries(
    ATTRIBUTE_NAMES.map((key) => [
      key,
      Math.max(1, Math.round(attributes?.[key] ?? DEFAULT_ATTRIBUTES[key])),
    ]),
  ) as HarthmereAttributes;
}

function unlocksForLevel(level: number) {
  const unlocks = new Set<string>(["basic_strike"]);
  if (level >= 2) unlocks.add("guarded_breath");
  if (level >= 3) unlocks.add("second_action_slot");
  if (level >= 5) unlocks.add("class_identity_ability");
  if (level >= 8) unlocks.add("interrupt_training");
  if (level >= 10) unlocks.add("talent_tree");
  if (level >= 15) unlocks.add("mount_training");
  if (level >= 20) unlocks.add("specialization");
  if (level >= 30) unlocks.add("advanced_dungeons");
  if (level >= 40) unlocks.add("ultimate_ability");
  if (level >= 50) unlocks.add("mastery_progression");
  return Array.from(unlocks);
}

function normalizeState(
  parsed: Partial<HarthmereLevelingState> | undefined,
): HarthmereLevelingState {
  const level = clamp(Math.round(parsed?.level ?? 1), 1, LEVEL_CAP);
  return {
    version: 1,
    level,
    xpCurrent: clamp(Math.round(parsed?.xpCurrent ?? 0), 0, 99_999_999),
    attributePointsUnspent: Math.max(
      0,
      Math.round(parsed?.attributePointsUnspent ?? 0),
    ),
    talentPointsUnspent: Math.max(
      0,
      Math.round(parsed?.talentPointsUnspent ?? 0),
    ),
    attributes: normalizeAttributes(parsed?.attributes),
    unlockedAbilities: Array.from(
      new Set([
        ...(parsed?.unlockedAbilities ?? []),
        ...unlocksForLevel(level),
      ]),
    ),
    discoveredZones: Array.from(
      new Set(["Harthmere", ...(parsed?.discoveredZones ?? [])]),
    ),
    recent: (parsed?.recent ?? []).slice(0, 12),
  };
}

function appendLog(
  state: HarthmereLevelingState,
  entry: Omit<HarthmereLevelingLogEntry, "id" | "at">,
): HarthmereLevelingState {
  return {
    ...state,
    recent: [
      {
        ...entry,
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
      },
      ...state.recent,
    ].slice(0, 12),
  };
}

export function readHarthmereLevelingState(): HarthmereLevelingState {
  if (!isBrowser()) {
    return defaultLevelingState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_LEVELING_STATE_KEY);
    if (!raw) {
      return defaultLevelingState();
    }
    return normalizeState(JSON.parse(raw) as Partial<HarthmereLevelingState>);
  } catch {
    return defaultLevelingState();
  }
}

export function writeHarthmereLevelingState(state: HarthmereLevelingState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_LEVELING_STATE_KEY,
    JSON.stringify(normalizeState(state)),
  );
  levelingEvent();
}

export function resetHarthmereLeveling() {
  writeHarthmereLevelingState(
    appendLog(defaultLevelingState(), {
      label: "Leveling reset",
      detail: "Local-dev level, XP, attributes, and unlocks were reset.",
      xp: 0,
      levelBefore: 1,
      levelAfter: 1,
    }),
  );
}

export function xpRequiredForNextHarthmereLevel(level: number) {
  return xpRequiredForLevel(level);
}

export function calculateHarthmereDerivedStats(
  state = readHarthmereLevelingState(),
): HarthmereDerivedStats {
  const a = state.attributes;
  const level = state.level;
  return {
    maxHp: Math.round(100 + level * 20 + a.constitution * 10),
    maxMana: Math.round(60 + level * 6 + a.intelligence * 5 + a.wisdom * 2),
    maxStamina: Math.round(
      80 + level * 5 + a.constitution * 3 + a.strength * 2,
    ),
    attackPoints: Math.round(
      10 + level * 4 + a.strength * 2 + a.dexterity * 0.75,
    ),
    spellPower: Math.round(8 + level * 3 + a.intelligence * 2),
    healingPower: Math.round(5 + a.wisdom * 1.5 + a.charisma * 0.5),
    defense: Math.round(level * 5 + a.constitution * 1.5 + a.willpower * 0.5),
    armor: Math.round(level * 5 + a.constitution * 2 + a.strength),
    magicResistance: Math.round(a.wisdom * 1.5 + a.willpower + level * 2),
    accuracy: Math.round(5 + a.dexterity * 0.5 + a.perception * 0.5),
    evasion: Number((a.dexterity * 0.4 + a.luck * 0.1).toFixed(1)),
    criticalChance: Number(
      clamp(0.03 + a.dexterity * 0.0005 + a.luck * 0.001, 0, 0.75).toFixed(3),
    ),
    criticalDamage: 1.5,
    movementSpeed: Number((4.2 + Math.min(0.4, a.dexterity * 0.01)).toFixed(2)),
    carryCapacity: Number(
      (40 + a.strength * 0.5 + a.constitution * 0.25).toFixed(1),
    ),
    controlResistance: Number(
      clamp(a.willpower * 0.003 + a.constitution * 0.001, 0, 0.6).toFixed(3),
    ),
  };
}

export function getHarthmereLevelSummary() {
  const state = readHarthmereLevelingState();
  const xpRequired = xpRequiredForLevel(state.level);
  const derived = calculateHarthmereDerivedStats(state);
  return { state, xpRequired, derived };
}

function levelDifferenceXpModifier(playerLevel: number, sourceLevel?: number) {
  if (!sourceLevel) {
    return 1;
  }
  const diff = sourceLevel - playerLevel;
  if (diff <= -10) return 0;
  if (diff <= -6) return 0.1;
  if (diff <= -3) return 0.4;
  if (diff <= -1) return 0.75;
  if (diff <= 0) return 1;
  if (diff <= 2) return 1.15;
  if (diff <= 5) return 1.4;
  return 1.75;
}

export function levelDamageModifier(
  attackerLevel: number,
  defenderLevel: number,
) {
  const diff = attackerLevel - defenderLevel;
  if (diff <= -10) return 0.25;
  if (diff <= -6) return 0.5;
  if (diff <= -3) return 0.75;
  if (diff <= 0) return 1;
  if (diff <= 2) return 1.1;
  if (diff <= 5) return 1.25;
  if (diff <= 9) return 1.5;
  return 2;
}

export function levelHitModifier(attackerLevel: number, defenderLevel: number) {
  const diff = attackerLevel - defenderLevel;
  if (diff <= -10) return -0.3;
  if (diff <= -6) return -0.2;
  if (diff <= -3) return -0.1;
  if (diff <= 0) return 0;
  if (diff <= 2) return 0.05;
  if (diff <= 5) return 0.1;
  return 0.15;
}

export function awardHarthmereXp(input: HarthmereXpGrantInput) {
  let state = readHarthmereLevelingState();
  const levelBefore = state.level;
  const difficultyMultiplier = input.difficulty
    ? DIFFICULTY_MULTIPLIERS[input.difficulty]
    : 1;
  const levelModifier = levelDifferenceXpModifier(
    state.level,
    input.sourceLevel,
  );
  const rankModifier = input.rank ? NPC_RANK_MULTIPLIERS[input.rank].xp : 1;
  const xp = Math.max(
    0,
    Math.round(
      input.baseXp * difficultyMultiplier * levelModifier * rankModifier,
    ),
  );

  if (state.level >= LEVEL_CAP) {
    writeHarthmereLevelingState(
      appendLog(state, {
        label: input.label,
        detail:
          input.detail ??
          "You are at the current level cap. Future XP should feed mastery progression.",
        xp: 0,
        levelBefore,
        levelAfter: levelBefore,
      }),
    );
    return { xp: 0, levelBefore, levelAfter: levelBefore, leveled: false };
  }

  state = { ...state, xpCurrent: state.xpCurrent + xp };
  let levelAfter = state.level;
  let attributePoints = state.attributePointsUnspent;
  let talentPoints = state.talentPointsUnspent;
  let remainingXp = state.xpCurrent;

  while (levelAfter < LEVEL_CAP) {
    const required = xpRequiredForLevel(levelAfter);
    if (required <= 0 || remainingXp < required) {
      break;
    }
    remainingXp -= required;
    levelAfter += 1;
    attributePoints += attributePointsForLevel(levelAfter);
    talentPoints += talentPointsForLevel(levelAfter);
  }

  state = {
    ...state,
    level: levelAfter,
    xpCurrent: levelAfter >= LEVEL_CAP ? 0 : remainingXp,
    attributePointsUnspent: attributePoints,
    talentPointsUnspent: talentPoints,
    unlockedAbilities: unlocksForLevel(levelAfter),
  };

  const leveled = levelAfter > levelBefore;
  writeHarthmereLevelingState(
    appendLog(state, {
      label: input.label,
      detail:
        input.detail ??
        (leveled
          ? `You reached level ${levelAfter}. Spend new attribute points from the Leveling menu.`
          : `${input.source} XP gained.`),
      xp,
      levelBefore,
      levelAfter,
    }),
  );

  return { xp, levelBefore, levelAfter, leveled };
}

export function awardHarthmereQuestXp(
  questId: string,
  title: string,
  completed: boolean,
) {
  const difficulty: HarthmereMissionDifficulty = questId.includes("bell")
    ? "hard"
    : questId.includes("whisper") || questId.includes("lockbox")
      ? "normal"
      : "easy";
  return awardHarthmereXp({
    source: completed ? "quest" : "quest_step",
    label: completed ? `Completed ${title}` : `Advanced ${title}`,
    baseXp: completed ? 140 : 35,
    difficulty,
    sourceLevel: completed && difficulty === "hard" ? 5 : 2,
    detail: completed
      ? `Quest completed. XP was awarded for the mission outcome and difficulty.`
      : `Objective progress recorded. Small XP was awarded for advancing the mission.`,
  });
}

export function awardHarthmereCombatXp(target: HarthmereCombatStats) {
  const rank: HarthmereNpcRank =
    target.behavior === "hostile"
      ? target.maxHp >= 350
        ? "strong"
        : "normal"
      : target.behavior === "training_dummy"
        ? "critter"
        : "civilian";
  const baseXp =
    target.behavior === "training_dummy"
      ? 5
      : target.behavior === "hostile"
        ? Math.max(20, target.level * 18)
        : 0;
  return awardHarthmereXp({
    source: target.behavior === "training_dummy" ? "training" : "combat",
    label: `Defeated ${target.name}`,
    baseXp,
    sourceLevel: target.level,
    rank,
    detail:
      target.behavior === "hostile"
        ? `Combat XP was based on ${target.name}'s level and rank.`
        : "No meaningful XP is awarded for civilians or harmless targets.",
  });
}

export function discoverHarthmereZone(zone: string, xp = 25) {
  const state = readHarthmereLevelingState();
  if (state.discoveredZones.includes(zone)) {
    return;
  }
  writeHarthmereLevelingState({
    ...appendLog(
      {
        ...state,
        discoveredZones: [...state.discoveredZones, zone],
      },
      {
        label: `Discovered ${zone}`,
        detail: "Exploration XP was awarded for finding a new Harthmere area.",
        xp,
        levelBefore: state.level,
        levelAfter: state.level,
      },
    ),
  });
  awardHarthmereXp({
    source: "exploration",
    label: `Explored ${zone}`,
    baseXp: xp,
    detail: "Exploration matters, but only the first discovery grants XP.",
  });
}

export function applyHarthmereLevelingToPlayerCombatStats(
  stats: HarthmereCombatStats,
): HarthmereCombatStats {
  const state = readHarthmereLevelingState();
  const derived = calculateHarthmereDerivedStats(state);
  const hpRatio = stats.maxHp > 0 ? clamp(stats.hp / stats.maxHp, 0, 1) : 1;
  const maxHp = derived.maxHp;
  return {
    ...stats,
    level: state.level,
    hp:
      stats.combatState === "dead"
        ? 0
        : Math.max(1, Math.round(maxHp * hpRatio)),
    maxHp,
    attackPoints: derived.attackPoints,
    defense: derived.defense,
    armor: derived.armor,
    magicResistance: derived.magicResistance,
    accuracy: derived.accuracy,
    evasion: derived.evasion,
    criticalChance: derived.criticalChance,
    criticalDamage: derived.criticalDamage,
    movementSpeed: derived.movementSpeed,
  };
}

function npcRankForCombatStats(stats: HarthmereCombatStats): HarthmereNpcRank {
  if (stats.behavior === "training_dummy") return "critter";
  if (
    ["passive", "merchant", "defensive", "quest_anchor"].includes(
      stats.behavior,
    )
  ) {
    return "civilian";
  }
  if (stats.behavior === "guard") return "elite";
  if (stats.behavior === "hostile" && stats.maxHp >= 350) return "strong";
  return "normal";
}

export function scaleHarthmereNpcCombatStats(
  stats: HarthmereCombatStats,
  _offset?: number,
): HarthmereCombatStats {
  const rank = npcRankForCombatStats(stats);
  const rankMultiplier = NPC_RANK_MULTIPLIERS[rank];
  const levelMultiplier = 1 + stats.level * 0.15;
  if (stats.behavior === "training_dummy") {
    return stats;
  }
  const maxHp = Math.max(
    stats.behavior === "guard" ? 800 : 1,
    Math.round(stats.maxHp * (levelMultiplier / 2) * rankMultiplier.hp),
  );
  return {
    ...stats,
    hp: Math.min(
      maxHp,
      Math.max(1, Math.round(stats.hp * (maxHp / stats.maxHp))),
    ),
    maxHp,
    attackPoints: Math.round(
      stats.attackPoints * (levelMultiplier / 2) * rankMultiplier.attack,
    ),
    defense: Math.round(
      stats.defense * (levelMultiplier / 2) * rankMultiplier.defense,
    ),
    armor: Math.round(
      stats.armor * (levelMultiplier / 2) * rankMultiplier.defense,
    ),
    magicResistance: Math.round(
      stats.magicResistance * (levelMultiplier / 2) * rankMultiplier.defense,
    ),
    accuracy: Math.round(stats.accuracy + stats.level * 0.4),
  };
}

function spendAttributePoint(attribute: HarthmereAttribute) {
  const state = readHarthmereLevelingState();
  if (state.attributePointsUnspent <= 0) {
    writeHarthmereLevelingState(
      appendLog(state, {
        label: "No attribute points",
        detail: "Gain a level before spending more attribute points.",
        xp: 0,
        levelBefore: state.level,
        levelAfter: state.level,
      }),
    );
    return;
  }
  writeHarthmereLevelingState(
    appendLog(
      {
        ...state,
        attributePointsUnspent: state.attributePointsUnspent - 1,
        attributes: {
          ...state.attributes,
          [attribute]: state.attributes[attribute] + 1,
        },
      },
      {
        label: `+1 ${attribute}`,
        detail: `${attribute} increased. Derived combat and world stats were recalculated.`,
        xp: 0,
        levelBefore: state.level,
        levelAfter: state.level,
      },
    ),
  );
}

function respecAttributes() {
  const state = readHarthmereLevelingState();
  const spent = ATTRIBUTE_NAMES.reduce(
    (sum, key) =>
      sum + Math.max(0, state.attributes[key] - DEFAULT_ATTRIBUTES[key]),
    0,
  );
  writeHarthmereLevelingState(
    appendLog(
      {
        ...state,
        attributes: { ...DEFAULT_ATTRIBUTES },
        attributePointsUnspent: state.attributePointsUnspent + spent,
      },
      {
        label: "Attributes reset",
        detail: "Local-dev attribute points were refunded for testing.",
        xp: 0,
        levelBefore: state.level,
        levelAfter: state.level,
      },
    ),
  );
}

export function levelingActionsForHarthmereNpc(
  offset: number,
): TalkDialogStepAction[] {
  if (![29, 31, 41, 44, 59].includes(offset)) {
    return [];
  }
  const actions: TalkDialogStepAction[] = [];
  if (offset === 44 || offset === 41) {
    actions.push({
      name: "Ask for training work",
      tooltip: "Practice earns a small amount of local-dev XP.",
      onPerformed: () =>
        awardHarthmereXp({
          source: "training",
          label: "Guard Yard practice",
          baseXp: 20,
          sourceLevel: 1,
          detail:
            "Training XP is intentionally small so it cannot replace quests and real combat.",
        }),
    });
  }
  if (offset === 29 || offset === 59) {
    actions.push({
      name: "Ask about attributes",
      tooltip: "Opens guidance through a local-dev XP log entry.",
      onPerformed: () =>
        awardHarthmereXp({
          source: "admin",
          label: "Attribute guidance",
          baseXp: 0,
          detail:
            "Strength helps melee and carrying. Dexterity helps evasion and precision. Constitution helps HP. Charisma helps prices and persuasion.",
        }),
    });
  }
  if (offset === 31 || offset === 41) {
    actions.push({
      name: "Reset local-dev leveling",
      tooltip:
        "Clears only local-dev level, XP, and attributes in this browser.",
      onPerformed: () => resetHarthmereLeveling(),
    });
  }
  return actions;
}

function barPercent(current: number, max: number) {
  if (max <= 0) return 100;
  return clamp((current / max) * 100, 0, 100);
}

function formatUnlocks(unlocks: string[]) {
  return unlocks
    .map((unlock) => unlock.replaceAll("_", " "))
    .map((unlock) => unlock.charAt(0).toUpperCase() + unlock.slice(1))
    .join(", ");
}

export const HarthmereLevelingHUD: React.FunctionComponent<{}> = () => {
  const [state, setState] = useState<HarthmereLevelingState>(() =>
    readHarthmereLevelingState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereLevelingState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_LEVELING_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_LEVELING_EVENT, refresh);
    };
  }, []);

  const xpRequired = xpRequiredForLevel(state.level);
  const latest = state.recent[0];

  return (
    <div className="pointer-events-none w-[18rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
            Harthmere Level
          </div>
          <div className="text-xs text-white/80">
            Level {state.level} {state.level >= LEVEL_CAP ? "— Cap" : ""}
          </div>
        </div>
        <div className="rounded bg-emerald-300/20 px-2 py-1 text-xs font-semibold text-emerald-100">
          {state.attributePointsUnspent} AP
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-white/10">
        <div
          className="h-full bg-emerald-300/80"
          style={{ width: `${barPercent(state.xpCurrent, xpRequired)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/70">
        <span>XP {state.xpCurrent}</span>
        <span>{xpRequired ? `${xpRequired} next` : "Mastery next"}</span>
      </div>
      {latest && (
        <div className="mt-1 text-[10px] leading-snug text-white/75">
          {latest.xp > 0 ? `+${latest.xp} XP — ` : ""}
          {latest.label}
        </div>
      )}
    </div>
  );
};

export const HarthmereLevelingMenuPanel: React.FunctionComponent<{}> = () => {
  const [state, setState] = useState<HarthmereLevelingState>(() =>
    readHarthmereLevelingState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereLevelingState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_LEVELING_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_LEVELING_EVENT, refresh);
    };
  }, []);

  const derived = useMemo(() => calculateHarthmereDerivedStats(state), [state]);
  const xpRequired = xpRequiredForLevel(state.level);

  return (
    <div className="mb-2 w-[34rem] rounded-lg border border-white/20 bg-black/85 p-3 text-white shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-emerald-200">
            Harthmere Leveling
          </div>
          <div className="text-xs leading-snug text-white/70">
            XP, attributes, derived stats, NPC scaling, and unlocks for the
            local-dev MMO loop.
          </div>
        </div>
        <div className="rounded bg-emerald-300/20 px-2 py-1 text-xs font-semibold text-emerald-100">
          Level {state.level}
        </div>
      </div>

      <div className="mb-3 rounded border border-white/10 bg-white/5 p-2">
        <div className="mb-1 flex justify-between text-xs text-white/80">
          <span>Experience</span>
          <span>
            {state.xpCurrent} / {xpRequired || "cap"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-white/10">
          <div
            className="h-full bg-emerald-300/80"
            style={{ width: `${barPercent(state.xpCurrent, xpRequired)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-white/10 bg-white/5 p-2">
          <div className="mb-1 font-semibold text-white">Attributes</div>
          <div className="mb-2 text-white/70">
            Unspent: {state.attributePointsUnspent} attribute points ·{" "}
            {state.talentPointsUnspent} talent points
          </div>
          <div className="grid grid-cols-3 gap-1">
            {ATTRIBUTE_NAMES.map((attribute) => (
              <button
                key={attribute}
                className="rounded border border-white/10 bg-black/30 px-1 py-1 text-left hover:bg-white/10 disabled:opacity-50"
                disabled={state.attributePointsUnspent <= 0}
                onClick={() => spendAttributePoint(attribute)}
              >
                <div className="capitalize text-white/80">{attribute}</div>
                <div className="font-semibold text-emerald-200">
                  {state.attributes[attribute]}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              onClick={() => respecAttributes()}
            >
              Respec attributes
            </button>
            <button
              className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              onClick={() => resetHarthmereLeveling()}
            >
              Reset leveling
            </button>
          </div>
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-2">
          <div className="mb-1 font-semibold text-white">Derived Stats</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-white/75">
            <div>Max HP: {derived.maxHp}</div>
            <div>Mana: {derived.maxMana}</div>
            <div>Attack: {derived.attackPoints}</div>
            <div>Defense: {derived.defense}</div>
            <div>Armor: {derived.armor}</div>
            <div>Magic Resist: {derived.magicResistance}</div>
            <div>Accuracy: {derived.accuracy}</div>
            <div>Evasion: {derived.evasion}</div>
            <div>Crit: {Math.round(derived.criticalChance * 1000) / 10}%</div>
            <div>Carry: {derived.carryCapacity}</div>
          </div>
          <div className="mt-2 text-white/70">
            Unlocked: {formatUnlocks(state.unlockedAbilities)}
          </div>
        </div>
      </div>

      <div className="mt-2 rounded border border-white/10 bg-white/5 p-2 text-xs text-white/75">
        <div className="font-semibold text-white">Recent XP</div>
        {state.recent.length ? (
          state.recent.slice(0, 5).map((entry) => (
            <div key={entry.id} className="mt-1 border-t border-white/5 pt-1">
              <span className="text-emerald-200">
                {entry.xp > 0 ? `+${entry.xp} XP` : "0 XP"}
              </span>{" "}
              — {entry.label}: {entry.detail}
            </div>
          ))
        ) : (
          <div>
            No XP events yet. Complete missions, defeat threats, and explore
            Harthmere.
          </div>
        )}
      </div>
    </div>
  );
};
