import {
  HARTHMERE_CARE_DAILY_ACTIVITIES,
  HARTHMERE_DAILY_TASK_MIN_GOLD,
  harthmereDailyTaskXpReward,
} from "@/shared/harthmere/mmo_care_loops";

export interface DailyTodoReward {
  gold?: number;
  xp?: number;
  items?: Array<{ id: string; name: string; count: number }>;
  townCare?: string;
}

export interface DailyTodoItem {
  id: string;
  activityId: string;
  title: string;
  description: string;
  category: "check_in" | "quest" | "community" | "harvest" | "home";
  reward: DailyTodoReward;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
  actionLabel: string;
}

export interface DailyTodoAdapter {
  isHydrated: () => boolean;
  getTasks: () => DailyTodoItem[];
  getStreak?: () => number;
  getProgress?: () => { completed: number; total: number };
  claim: (activityId: string) => void | Promise<void>;
}

interface DailyTodoRule {
  activityId: string;
  title: string;
  description: string;
  category: DailyTodoItem["category"];
  reward: DailyTodoReward;
}

export const DAILY_TODO_RULES: DailyTodoRule[] = [
  {
    activityId: "check_in",
    title: "Check in for the day",
    description: "Start your visit and collect a small welcome gift.",
    category: "check_in",
    reward: { gold: 5, xp: 10, townCare: "Town trust" },
  },
  {
    activityId: "jobs_board",
    title: "Read the jobs board",
    description: "See who needs help around the Grove or Harthmere.",
    category: "community",
    reward: { gold: 3, xp: 6, townCare: "Safer routes" },
  },
  {
    activityId: "eat_meal",
    title: "Eat something",
    description: "Keep your stamina steady before you wander too far.",
    category: "home",
    reward: { xp: 5, townCare: "Food habit" },
  },
  {
    activityId: "main_quest",
    title: "Move the main quest forward",
    description: "Follow your active marker and help the town change a little.",
    category: "quest",
    reward: { gold: 4, xp: 12, townCare: "Story progress" },
  },
  {
    activityId: "talk_neighbor",
    title: "Talk with a neighbor",
    description:
      "Check in on someone nearby and learn what the day feels like.",
    category: "community",
    reward: { gold: 2, xp: 8, townCare: "Friendship" },
  },
  {
    activityId: "forage_walk",
    title: "Take a foraging walk",
    description: "Look for berries, seeds, or useful scraps near the paths.",
    category: "harvest",
    reward: {
      xp: 8,
      items: [{ id: "wild_berries", name: "Wild Berries", count: 1 }],
    },
  },
  {
    activityId: "garden_care",
    title: "Tend a garden spot",
    description: "Water, plant, or gather from a small patch.",
    category: "harvest",
    reward: {
      xp: 8,
      items: [{ id: "seed_carrot", name: "Carrot Seed", count: 1 }],
    },
  },
  {
    activityId: "home_care",
    title: "Improve a place",
    description:
      "Repair, decorate, or help a town project feel more cared for.",
    category: "home",
    reward: { gold: 2, xp: 6, townCare: "Better shelter" },
  },
];

export interface DailyTodoCareSnapshot {
  streak?: number;
  claimedToday?: Record<string, unknown>;
  completedToday?: Record<string, unknown>;
  skills?: Record<string, { xp?: number; level?: number }>;
}

function dailyTodoRewardForRule(
  rule: DailyTodoRule,
  snapshot: DailyTodoCareSnapshot | undefined
): DailyTodoReward {
  const backendReward = HARTHMERE_CARE_DAILY_ACTIVITIES[rule.activityId];
  const actorLevel = Number(snapshot?.skills?.care?.level ?? 1);
  return {
    ...rule.reward,
    gold: Math.max(
      HARTHMERE_DAILY_TASK_MIN_GOLD,
      backendReward?.gold ?? rule.reward.gold ?? 0
    ),
    xp:
      backendReward?.xp ??
      harthmereDailyTaskXpReward({
        actorLevel: Number.isFinite(actorLevel) ? actorLevel : 1,
      }),
  };
}

export function dailyTodoTasksFromCareSnapshotForTest(
  snapshot: DailyTodoCareSnapshot | undefined
): DailyTodoItem[] {
  const claimed = snapshot?.claimedToday ?? {};
  const completed = snapshot?.completedToday ?? {};
  return DAILY_TODO_RULES.map((rule) => ({
    id: `daily:${rule.activityId}`,
    activityId: rule.activityId,
    title: rule.title,
    description: rule.description,
    category: rule.category,
    reward: dailyTodoRewardForRule(rule, snapshot),
    completed:
      rule.activityId === "check_in" ||
      Boolean(completed[rule.activityId]) ||
      Boolean(claimed[rule.activityId]),
    claimed: Boolean(claimed[rule.activityId]),
    claimable:
      rule.activityId === "check_in" ||
      Boolean(completed[rule.activityId]) ||
      Boolean(claimed[rule.activityId]),
    actionLabel: Boolean(claimed[rule.activityId])
      ? "Done today"
      : rule.activityId === "check_in" || Boolean(completed[rule.activityId])
      ? "Claim reward"
      : "Do this first",
  }));
}

export function dailyTodoProgressForTest(tasks: DailyTodoItem[]) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  return { completed, total };
}
