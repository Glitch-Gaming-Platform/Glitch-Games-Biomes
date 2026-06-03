import {
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { HARTHMERE_SKILL_XP_PER_LEVEL_V1 } from "@/shared/harthmere/mmo_class_ability_collectibles_v1";

export const HARTHMERE_CARE_LOOPS_VERSION_V1 =
  "harthmere-care-loops-v1" as const;
export const HARTHMERE_CARE_LOOP_DAY_MS_V1 = 24 * 60 * 60 * 1000;
export const HARTHMERE_DAILY_TASK_MIN_GOLD_V1 = 200;
export const HARTHMERE_DAILY_TASK_COUNT_V1 = 8;

export type HarthmereCareLoopKindV1 =
  | "daily_task_completed"
  | "daily_check_in"
  | "npc_talk"
  | "npc_gift"
  | "restore_project"
  | "production_sale"
  | "collection_donation"
  | "decorate_space"
  | "explore_forage"
  | "town_life_help"
  | "skill_mastery"
  | "seasonal_discovery";

export type HarthmereSeasonV1 = "spring" | "summer" | "autumn" | "winter";

export interface HarthmereNpcCareMemoryV1 {
  npcId: string;
  relationship: number;
  lastTalkDay?: number;
  lastGiftDay?: number;
  knownPreferences: string[];
  unlockedDialogue: string[];
}

export interface HarthmereCareProjectV1 {
  projectId: string;
  name: string;
  stage: number;
  maxStage: number;
  requiredItems: Record<string, number>;
  unlocked: string[];
  completedAtMs?: number;
}

export interface HarthmereCareLoopStateV1 {
  actorId: string;
  daily: {
    lastLoginDay?: number;
    completed: Record<string, number>;
    claimed: Record<string, number>;
    streak: number;
  };
  npcs: Record<string, HarthmereNpcCareMemoryV1>;
  projects: Record<string, HarthmereCareProjectV1>;
  collections: Record<string, { donatedAtMs: number; category: string }>;
  decorations: Record<string, { itemId: string; placedAtMs: number }>;
  townNeeds: Record<string, number>;
  skills: Record<string, { xp: number; level: number }>;
  seasonal: Record<string, number>;
}

export interface HarthmereCareLoopRequestV1 {
  requestId: string;
  actorId: string;
  operation: HarthmereCareLoopKindV1;
  nowMs: number;
  targetId?: string;
  itemId?: string;
  count?: number;
  season?: HarthmereSeasonV1;
  inventory?: Record<string, number>;
  actorLevel?: number;
}

export interface HarthmereCareLoopResultV1 {
  care: HarthmereCareLoopStateV1;
  warnings: string[];
  touchedModels: string[];
  itemDeltas: Record<string, number>;
  goldDelta: number;
  xpDelta: number;
  unlocked: string[];
}

export const HARTHMERE_CARE_NPC_PREFERENCES_V1: Record<string, string[]> = {
  gus_the_baker: ["field_wheat", "loaf_bread", "apple_tart"],
  jackie: ["road_ration", "wild_berries", "seed_carrot"],
  ranger_jane: ["wild_berries", "seed_muckroot", "river_trout"],
  sergeant_bram_holt: ["road_ration", "minor_healing_salve", "grilled_meat"],
  mara_thistle: ["field_wheat", "loaf_bread", "fresh_carrot"],
};

export const HARTHMERE_CARE_DAILY_ACTIVITIES_V1: Record<
  string,
  {
    rewardItems?: Record<string, number>;
    gold?: number;
    xp?: number;
  }
> = {
  check_in: { gold: 200 },
  talk: { gold: 2, xp: 5 },
  garden: { rewardItems: { seed_carrot: 1 }, xp: 8 },
  shop: { gold: 3 },
  rumor: { xp: 6 },
  forage: { rewardItems: { wild_berries: 1 }, xp: 8 },
  jobs_board: { gold: 200 },
  eat_meal: { gold: 200 },
  main_quest: { gold: 200 },
  talk_neighbor: { gold: 200 },
  forage_walk: { gold: 200, rewardItems: { wild_berries: 1 } },
  garden_care: { gold: 200, rewardItems: { seed_carrot: 1 } },
  home_care: { gold: 200 },
};

export function harthmereDailyTaskXpRewardV1(input: {
  actorLevel?: number;
  taskCount?: number;
}) {
  const taskCount = Math.max(
    1,
    Math.trunc(input.taskCount ?? HARTHMERE_DAILY_TASK_COUNT_V1)
  );
  const level = Math.max(1, Math.trunc(input.actorLevel ?? 1));
  const xpToNextLevel =
    HARTHMERE_SKILL_XP_PER_LEVEL_V1 * Math.max(1, Math.floor(Math.sqrt(level)));
  return Math.max(1, Math.ceil((xpToNextLevel * 0.5) / taskCount));
}

export interface HarthmereCareLoopClientSnapshotV1 {
  actorId: string;
  day: number;
  streak: number;
  claimedToday: Record<string, number>;
  completedToday: Record<string, number>;
  claimed: Record<string, number>;
  completed: Record<string, number>;
  townNeeds: Record<string, number>;
  skills: Record<string, { xp: number; level: number }>;
  projects: Record<string, HarthmereCareProjectV1>;
}

export function createHarthmereCareLoopClientSnapshotV1(
  state: HarthmereCareLoopStateV1,
  nowMs: number
): HarthmereCareLoopClientSnapshotV1 {
  const day = harthmereCareDayV1(nowMs);
  const prefix = `${day}:`;
  const claimedToday = Object.fromEntries(
    Object.entries(state.daily.claimed ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
  const completedToday = Object.fromEntries(
    Object.entries(state.daily.completed ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
  return {
    actorId: state.actorId,
    day,
    streak: state.daily.streak,
    claimedToday,
    completedToday,
    claimed: { ...state.daily.claimed },
    completed: { ...state.daily.completed },
    townNeeds: { ...state.townNeeds },
    skills: { ...state.skills },
    projects: { ...state.projects },
  };
}

export const HARTHMERE_CARE_SEASONAL_DISCOVERIES_V1: Record<
  HarthmereSeasonV1,
  string[]
> = {
  spring: ["seed_carrot", "wild_berries"],
  summer: ["river_trout", "fresh_carrot"],
  autumn: ["seed_wheat", "loaf_bread"],
  winter: ["road_ration", "grilled_meat"],
};

export function harthmereCareDayV1(nowMs: number): number {
  return Math.floor(nowMs / HARTHMERE_CARE_LOOP_DAY_MS_V1);
}

export function defaultHarthmereCareLoopStateV1(
  actorId: string,
  _nowMs: number
): HarthmereCareLoopStateV1 {
  return {
    actorId,
    daily: { completed: {}, claimed: {}, streak: 0 },
    npcs: {},
    projects: {
      grove_food_satchel: {
        projectId: "grove_food_satchel",
        name: "Fountain Food Satchel",
        stage: 0,
        maxStage: 2,
        requiredItems: { loaf_bread: 2, road_ration: 1 },
        unlocked: [],
      },
      old_grove_bridge: {
        projectId: "old_grove_bridge",
        name: "Old Grove Bridge",
        stage: 0,
        maxStage: 3,
        requiredItems: { softwood_log: 4, rough_stone: 2 },
        unlocked: [],
      },
    },
    collections: {},
    decorations: {},
    townNeeds: { food: 50, safety: 50, housing: 50, happiness: 50 },
    skills: {},
    seasonal: {},
  };
}

export function normalizeHarthmereCareLoopStateV1(
  raw: unknown,
  actorId: string,
  nowMs: number
): HarthmereCareLoopStateV1 {
  const defaults = defaultHarthmereCareLoopStateV1(actorId, nowMs);
  const parsed = typeof raw === "object" && raw !== null ? (raw as any) : {};
  return {
    actorId,
    daily: {
      lastLoginDay: Number.isFinite(parsed.daily?.lastLoginDay)
        ? Number(parsed.daily.lastLoginDay)
        : defaults.daily.lastLoginDay,
      completed:
        typeof parsed.daily?.completed === "object" &&
        parsed.daily.completed !== null
          ? parsed.daily.completed
          : {},
      claimed:
        typeof parsed.daily?.claimed === "object" &&
        parsed.daily.claimed !== null
          ? parsed.daily.claimed
          : {},
      streak: Math.max(0, Number(parsed.daily?.streak ?? 0) || 0),
    },
    npcs:
      typeof parsed.npcs === "object" && parsed.npcs !== null
        ? parsed.npcs
        : {},
    projects: {
      ...defaults.projects,
      ...(typeof parsed.projects === "object" && parsed.projects !== null
        ? parsed.projects
        : {}),
    },
    collections:
      typeof parsed.collections === "object" && parsed.collections !== null
        ? parsed.collections
        : {},
    decorations:
      typeof parsed.decorations === "object" && parsed.decorations !== null
        ? parsed.decorations
        : {},
    townNeeds: {
      ...defaults.townNeeds,
      ...(typeof parsed.townNeeds === "object" && parsed.townNeeds !== null
        ? parsed.townNeeds
        : {}),
    },
    skills:
      typeof parsed.skills === "object" && parsed.skills !== null
        ? parsed.skills
        : {},
    seasonal:
      typeof parsed.seasonal === "object" && parsed.seasonal !== null
        ? parsed.seasonal
        : {},
  };
}

function result(
  care: HarthmereCareLoopStateV1,
  warnings: string[] = [],
  touchedModels: string[] = [],
  itemDeltas: Record<string, number> = {},
  goldDelta = 0,
  xpDelta = 0,
  unlocked: string[] = []
): HarthmereCareLoopResultV1 {
  return {
    care,
    warnings,
    touchedModels,
    itemDeltas,
    goldDelta,
    xpDelta,
    unlocked,
  };
}

function addItems(
  items: Record<string, number>,
  deltas: Record<string, number>
) {
  const next = { ...items };
  for (const [itemId, delta] of Object.entries(deltas)) {
    next[itemId] = Math.max(0, (next[itemId] ?? 0) + delta);
    if (next[itemId] === 0) delete next[itemId];
  }
  return next;
}

function hasItems(
  inventory: Record<string, number>,
  needed: Record<string, number>
) {
  return Object.entries(needed).every(
    ([itemId, count]) => (inventory[itemId] ?? 0) >= count
  );
}

function negativeItems(needed: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(needed).map(([itemId, count]) => [itemId, -count])
  );
}

function bumpNeed(care: HarthmereCareLoopStateV1, need: string, delta: number) {
  return {
    ...care,
    townNeeds: {
      ...care.townNeeds,
      [need]: Math.max(0, Math.min(100, (care.townNeeds[need] ?? 50) + delta)),
    },
  };
}

function addSkillXp(
  care: HarthmereCareLoopStateV1,
  skillId: string,
  xp: number
) {
  const current = care.skills[skillId] ?? { xp: 0, level: 1 };
  const nextXp = current.xp + xp;
  return {
    ...care,
    skills: {
      ...care.skills,
      [skillId]: {
        xp: nextXp,
        level: Math.max(current.level, 1 + Math.floor(nextXp / 100)),
      },
    },
  };
}

function npcMemory(
  care: HarthmereCareLoopStateV1,
  npcId: string
): HarthmereNpcCareMemoryV1 {
  return (
    care.npcs[npcId] ?? {
      npcId,
      relationship: 0,
      knownPreferences: HARTHMERE_CARE_NPC_PREFERENCES_V1[npcId] ?? [],
      unlockedDialogue: [],
    }
  );
}

export function reduceHarthmereCareLoopV1(
  state: HarthmereCareLoopStateV1,
  request: HarthmereCareLoopRequestV1
): HarthmereCareLoopResultV1 {
  const day = harthmereCareDayV1(request.nowMs);
  const targetId = request.targetId ?? "";
  const inventory = request.inventory ?? {};
  let care = normalizeHarthmereCareLoopStateV1(
    state,
    request.actorId,
    request.nowMs
  );

  if (request.operation === "daily_task_completed") {
    const activity = targetId || "check_in";
    const key = `${day}:${activity}`;
    if (care.daily.completed[key]) {
      return result(
        care,
        ["care_rejected:daily_task_already_done"],
        ["care_daily_done_rejection"]
      );
    }
    care = {
      ...care,
      daily: {
        ...care.daily,
        completed: { ...care.daily.completed, [key]: request.nowMs },
      },
    };
    return result(care, [], ["care_daily_done", `care_daily_done:${activity}`]);
  }

  if (request.operation === "daily_check_in") {
    const activity = targetId || "check_in";
    const key = `${day}:${activity}`;
    if (care.daily.claimed[key])
      return result(
        care,
        ["care_rejected:daily_already_claimed"],
        ["care_daily_rejection"]
      );
    if (activity !== "check_in" && !care.daily.completed[key]) {
      return result(
        care,
        ["care_rejected:daily_task_not_done"],
        ["care_daily_rejection", `care_daily_rejection:${activity}`]
      );
    }
    const previousDay = care.daily.lastLoginDay;
    const streak =
      previousDay === undefined
        ? 1
        : previousDay === day - 1
        ? care.daily.streak + 1
        : previousDay === day
        ? care.daily.streak
        : 1;
    const reward = HARTHMERE_CARE_DAILY_ACTIVITIES_V1[activity] ?? {};
    const xpReward =
      reward.xp ??
      harthmereDailyTaskXpRewardV1({ actorLevel: request.actorLevel });
    const goldReward = Math.max(
      HARTHMERE_DAILY_TASK_MIN_GOLD_V1,
      reward.gold ?? 0
    );
    const needBump: Record<string, [string, number]> = {
      check_in: ["happiness", 2],
      jobs_board: ["safety", 2],
      eat_meal: ["food", 2],
      main_quest: ["safety", 3],
      talk_neighbor: ["happiness", 3],
      forage_walk: ["food", 3],
      garden_care: ["food", 4],
      home_care: ["housing", 3],
    };
    care = {
      ...care,
      daily: {
        lastLoginDay: day,
        streak,
        completed: {
          ...care.daily.completed,
          [key]: care.daily.completed[key] ?? request.nowMs,
        },
        claimed: { ...care.daily.claimed, [key]: request.nowMs },
      },
    };
    const [need, delta] = needBump[activity] ?? ["happiness", 1];
    care = bumpNeed(care, need, delta);
    care = addSkillXp(care, "care", xpReward);
    return result(
      care,
      [],
      ["care_daily", `care_daily:${activity}`],
      reward.rewardItems ?? {},
      goldReward,
      xpReward
    );
  }

  if (request.operation === "npc_talk") {
    if (!targetId)
      return result(
        care,
        ["care_rejected:missing_npc_id"],
        ["care_npc_rejection"]
      );
    const memory = npcMemory(care, targetId);
    if (memory.lastTalkDay === day)
      return result(
        care,
        ["care_rejected:npc_already_talked_today"],
        ["care_npc_rejection"]
      );
    const relationship = memory.relationship + 3;
    const unlocked =
      relationship >= 10 && !memory.unlockedDialogue.includes("trust_1")
        ? ["trust_1"]
        : [];
    care = {
      ...care,
      npcs: {
        ...care.npcs,
        [targetId]: {
          ...memory,
          relationship,
          lastTalkDay: day,
          unlockedDialogue: [...memory.unlockedDialogue, ...unlocked],
        },
      },
    };
    return result(
      care,
      [],
      ["care_npc_talk", "care_relationship"],
      {},
      1,
      6,
      unlocked
    );
  }

  if (request.operation === "npc_gift") {
    if (!targetId)
      return result(
        care,
        ["care_rejected:missing_npc_id"],
        ["care_npc_rejection"]
      );
    if (!request.itemId)
      return result(
        care,
        ["care_rejected:missing_gift_item"],
        ["care_npc_rejection"]
      );
    if ((inventory[request.itemId] ?? 0) < 1)
      return result(
        care,
        ["care_rejected:missing_gift_inventory"],
        ["care_npc_rejection"]
      );
    const memory = npcMemory(care, targetId);
    if (memory.lastGiftDay === day)
      return result(
        care,
        ["care_rejected:npc_already_gifted_today"],
        ["care_npc_rejection"]
      );
    const liked = (HARTHMERE_CARE_NPC_PREFERENCES_V1[targetId] ?? []).includes(
      request.itemId
    );
    const relationship = memory.relationship + (liked ? 10 : 2);
    const unlocked = [
      ...(relationship >= 10 && !memory.unlockedDialogue.includes("trust_1")
        ? ["trust_1"]
        : []),
      ...(relationship >= 25 &&
      !memory.unlockedDialogue.includes("personal_request")
        ? ["personal_request"]
        : []),
    ];
    care = {
      ...care,
      npcs: {
        ...care.npcs,
        [targetId]: {
          ...memory,
          relationship,
          lastGiftDay: day,
          unlockedDialogue: [...memory.unlockedDialogue, ...unlocked],
        },
      },
    };
    return result(
      care,
      [],
      [
        "care_npc_gift",
        liked ? "care_npc_liked_gift" : "care_npc_neutral_gift",
      ],
      { [request.itemId]: -1 },
      0,
      liked ? 10 : 3,
      unlocked
    );
  }

  if (request.operation === "restore_project") {
    const project = care.projects[targetId];
    if (!project)
      return result(
        care,
        ["care_rejected:unknown_project"],
        ["care_project_rejection"]
      );
    if (project.completedAtMs)
      return result(
        care,
        ["care_rejected:project_complete"],
        ["care_project_rejection"]
      );
    if (!hasItems(inventory, project.requiredItems))
      return result(
        care,
        ["care_rejected:missing_project_materials"],
        ["care_project_rejection"]
      );
    const nextStage = project.stage + 1;
    const completed = nextStage >= project.maxStage;
    const unlocked = completed
      ? [`project:${project.projectId}:complete`]
      : [`project:${project.projectId}:stage_${nextStage}`];
    care = bumpNeed(
      {
        ...care,
        projects: {
          ...care.projects,
          [targetId]: {
            ...project,
            stage: nextStage,
            completedAtMs: completed ? request.nowMs : undefined,
            unlocked: [...project.unlocked, ...unlocked],
          },
        },
      },
      project.projectId.includes("food") ? "food" : "happiness",
      completed ? 12 : 5
    );
    return result(
      care,
      [],
      ["care_restoration", "care_town_state"],
      negativeItems(project.requiredItems),
      0,
      completed ? 40 : 15,
      unlocked
    );
  }

  if (request.operation === "production_sale") {
    const itemId = request.itemId ?? "";
    const count = Math.max(1, Math.floor(request.count ?? 1));
    if ((inventory[itemId] ?? 0) < count)
      return result(
        care,
        ["care_rejected:missing_sale_inventory"],
        ["care_production_rejection"]
      );
    const isFood =
      Boolean(HARTHMERE_FOOD_DEFINITIONS_V1[itemId]) ||
      /food|meal|bread|meat|carrot|trout|berries|ration/i.test(itemId);
    care = bumpNeed(
      addSkillXp(care, isFood ? "cooking" : "trading", count * 8),
      isFood ? "food" : "happiness",
      isFood ? count : 1
    );
    return result(
      care,
      [],
      ["care_production_profit", isFood ? "care_food_market" : "care_market"],
      { [itemId]: -count },
      count * (isFood ? 5 : 3),
      count * 5
    );
  }

  if (request.operation === "collection_donation") {
    const itemId = request.itemId ?? "";
    if (!itemId)
      return result(
        care,
        ["care_rejected:missing_collection_item"],
        ["care_collection_rejection"]
      );
    if (care.collections[itemId])
      return result(
        care,
        ["care_rejected:collection_duplicate"],
        ["care_collection_rejection"]
      );
    if ((inventory[itemId] ?? 0) < 1)
      return result(
        care,
        ["care_rejected:missing_collection_inventory"],
        ["care_collection_rejection"]
      );
    const category = HARTHMERE_SEED_DEFINITIONS_V1[itemId]
      ? "seed_catalog"
      : HARTHMERE_FOOD_DEFINITIONS_V1[itemId]
      ? "food_catalog"
      : "town_archive";
    care = {
      ...care,
      collections: {
        ...care.collections,
        [itemId]: { donatedAtMs: request.nowMs, category },
      },
    };
    return result(
      care,
      [],
      ["care_collection", category],
      { [itemId]: -1 },
      0,
      12,
      [`collection:${category}:${itemId}`]
    );
  }

  if (request.operation === "decorate_space") {
    if (!targetId)
      return result(
        care,
        ["care_rejected:missing_decor_slot"],
        ["care_decor_rejection"]
      );
    if (!request.itemId)
      return result(
        care,
        ["care_rejected:missing_decor_item"],
        ["care_decor_rejection"]
      );
    if (care.decorations[targetId])
      return result(
        care,
        ["care_rejected:decor_slot_occupied"],
        ["care_decor_rejection"]
      );
    if ((inventory[request.itemId] ?? 0) < 1)
      return result(
        care,
        ["care_rejected:missing_decor_inventory"],
        ["care_decor_rejection"]
      );
    care = bumpNeed(
      {
        ...care,
        decorations: {
          ...care.decorations,
          [targetId]: { itemId: request.itemId, placedAtMs: request.nowMs },
        },
      },
      "happiness",
      4
    );
    return result(
      care,
      [],
      ["care_decor", "care_expression"],
      { [request.itemId]: -1 },
      0,
      8,
      [`decor:${targetId}`]
    );
  }

  if (request.operation === "explore_forage") {
    const itemId = request.itemId ?? "wild_berries";
    if (
      !HARTHMERE_FOOD_DEFINITIONS_V1[itemId] &&
      !HARTHMERE_SEED_DEFINITIONS_V1[itemId]
    ) {
      return result(
        care,
        ["care_rejected:unknown_forage"],
        ["care_exploration_rejection"]
      );
    }
    care = addSkillXp(care, "foraging", 10);
    return result(care, [], ["care_explore_forage"], { [itemId]: 1 }, 0, 10, [
      `forage:${itemId}`,
    ]);
  }

  if (request.operation === "town_life_help") {
    const need = targetId || "happiness";
    care = bumpNeed(addSkillXp(care, "community", 10), need, 6);
    return result(
      care,
      [],
      ["care_town_life", `care_need:${need}`],
      {},
      4,
      10,
      [`town_need:${need}`]
    );
  }

  if (request.operation === "skill_mastery") {
    const skillId = targetId || "farming";
    care = addSkillXp(care, skillId, Math.max(1, request.count ?? 12));
    return result(
      care,
      [],
      ["care_skill_mastery", `care_skill:${skillId}`],
      {},
      0,
      0,
      care.skills[skillId]?.level >= 2
        ? [`skill:${skillId}:level_${care.skills[skillId].level}`]
        : []
    );
  }

  if (request.operation === "seasonal_discovery") {
    const season = request.season ?? "spring";
    const itemId = request.itemId ?? "";
    if (!HARTHMERE_CARE_SEASONAL_DISCOVERIES_V1[season].includes(itemId)) {
      return result(
        care,
        ["care_rejected:item_not_in_season"],
        ["care_season_rejection"]
      );
    }
    const key = `${season}:${itemId}`;
    if (care.seasonal[key])
      return result(
        care,
        ["care_rejected:seasonal_duplicate"],
        ["care_season_rejection"]
      );
    care = {
      ...care,
      seasonal: { ...care.seasonal, [key]: request.nowMs },
    };
    return result(
      care,
      [],
      ["care_seasonal", `care_season:${season}`],
      { [itemId]: 1 },
      0,
      14,
      [`seasonal:${key}`]
    );
  }

  return result(
    care,
    ["care_rejected:unsupported_operation"],
    ["care_rejection"]
  );
}

export function applyHarthmereCareLoopInventoryDeltasV1(
  inventory: Record<string, number>,
  deltas: Record<string, number>
) {
  return addItems(inventory, deltas);
}
