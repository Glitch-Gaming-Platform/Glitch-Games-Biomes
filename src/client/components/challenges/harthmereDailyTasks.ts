import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";

export const HARTHMERE_DAILY_TASK_COMPLETED_EVENT =
  "biomes:harthmere-daily-task-completed" as const;

export type HarthmereDailyTaskActivityId =
  | "check_in"
  | "jobs_board"
  | "eat_meal"
  | "main_quest"
  | "talk_neighbor"
  | "forage_walk"
  | "garden_care"
  | "home_care";

const inFlightDailyTaskCompletions = new Set<string>();

function dispatchHarthmereDailyTaskCompletedEvent(
  activityId: HarthmereDailyTaskActivityId,
  body?: unknown
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_DAILY_TASK_COMPLETED_EVENT, {
      detail: { activityId, body },
    })
  );
}

export async function completeHarthmereDailyTask(
  activityId: HarthmereDailyTaskActivityId,
  options: { fetchImpl?: typeof fetch; requestId?: string } = {}
) {
  if (inFlightDailyTaskCompletions.has(activityId)) {
    return undefined;
  }
  inFlightDailyTaskCompletions.add(activityId);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const requestId =
      options.requestId ??
      `harthmere_daily_${activityId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
    const response = await fetchHarthmereLiveWithTimeout(
      fetchImpl,
      "/api/harthmere/live_mode",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          idempotencyKey: requestId,
          actionKind: "request_care_loop_action",
          subsystem: "care",
          actorEntityVersion: 1,
          zoneId: "the_grove",
          payload: {
            operation: "daily_task_completed",
            targetId: activityId,
          },
          clientClaims: {},
        }),
      }
    );
    const body = await response.json();
    if (!response.ok || body?.ok === false) {
      throw new Error(
        body?.error ??
          body?.validation?.errors?.join(",") ??
          `daily_task_completion_failed:${activityId}`
      );
    }
    dispatchHarthmereDailyTaskCompletedEvent(activityId, body);
    return body;
  } finally {
    inFlightDailyTaskCompletions.delete(activityId);
  }
}

// HARTHMERE_DAILY_TASK_HOT_PATH_THROTTLE (2026-07-07): the fire-and-forget
// `...Soon` variant is wired to high-frequency gameplay events — every mined
// block fires `forage_walk`, every placed voxel fires `home_care`, every meal
// fires `eat_meal`, etc. Each fire POSTs a `request_care_loop_action` to
// live_mode, and on the production container those mutations take 11-29s and run
// a read-modify-write over the shared per-actor state blob under a redis WATCH
// retry loop. Firing one per mine/place meant the care-loop mutation ran
// CONCURRENTLY with the block's own inventory mutation, so both thrashed the
// WATCH loop and ballooned to 20-29s — the root cause of "placed blocks don't
// decrement" and the general inventory/hotbar lag (the count did eventually
// settle correctly, just ~25s later). These are DAILY tasks, so completing one
// more than once per local day is wasted work. Guard the hot path so each
// activity fires at most once per day, and debounce the fire a few seconds off
// the triggering action so it never overlaps that action's own mutation.
const HOT_PATH_DEBOUNCE_MS = 4000;

function harthmereDailyTaskDayKey(nowMs = Date.now()): string {
  const date = new Date(nowMs);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const completedTodayFallback = { day: "", ids: new Set<string>() };
const pendingHotPathTimers = new Map<HarthmereDailyTaskActivityId, unknown>();

function dailyTaskCompletionStorageKey(nowMs = Date.now()): string {
  return `harthmere.dailyTaskCompleted.${harthmereDailyTaskDayKey(nowMs)}`;
}

function readCompletedTodayIds(nowMs = Date.now()): Set<string> {
  const day = harthmereDailyTaskDayKey(nowMs);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(
        dailyTaskCompletionStorageKey(nowMs)
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map((value) => String(value)));
        }
      }
      return new Set();
    }
  } catch {
    // Fall through to the in-memory fallback when storage is unavailable.
  }
  if (completedTodayFallback.day !== day) {
    completedTodayFallback.day = day;
    completedTodayFallback.ids = new Set();
  }
  return new Set(completedTodayFallback.ids);
}

export function harthmereDailyTaskCompletedToday(
  activityId: HarthmereDailyTaskActivityId,
  nowMs = Date.now()
): boolean {
  return readCompletedTodayIds(nowMs).has(activityId);
}

function markHarthmereDailyTaskCompletedToday(
  activityId: HarthmereDailyTaskActivityId,
  nowMs = Date.now()
) {
  const ids = readCompletedTodayIds(nowMs);
  ids.add(activityId);
  const day = harthmereDailyTaskDayKey(nowMs);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        dailyTaskCompletionStorageKey(nowMs),
        JSON.stringify([...ids])
      );
      return;
    }
  } catch {
    // Fall through to in-memory tracking.
  }
  completedTodayFallback.day = day;
  completedTodayFallback.ids = ids;
}

// Test seam: reset the per-day completion guard so specs don't leak state.
export function resetHarthmereDailyTaskHotPathThrottleForTest() {
  for (const timer of pendingHotPathTimers.values()) {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  }
  pendingHotPathTimers.clear();
  completedTodayFallback.day = "";
  completedTodayFallback.ids = new Set();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(dailyTaskCompletionStorageKey());
    }
  } catch {
    // Ignore storage cleanup failures in tests.
  }
}

export function completeHarthmereDailyTaskSoon(
  activityId: HarthmereDailyTaskActivityId
) {
  // Already done today (or a completion is scheduled/in-flight): do nothing so
  // repeated mines/places don't spam the slow care-loop mutation.
  if (harthmereDailyTaskCompletedToday(activityId)) {
    return;
  }
  if (pendingHotPathTimers.has(activityId)) {
    return;
  }
  if (typeof setTimeout !== "function") {
    void completeHarthmereDailyTask(activityId)
      .then((body) => {
        if (body) markHarthmereDailyTaskCompletedToday(activityId);
      })
      .catch(() => {});
    return;
  }
  const timer = setTimeout(() => {
    pendingHotPathTimers.delete(activityId);
    if (harthmereDailyTaskCompletedToday(activityId)) {
      return;
    }
    void completeHarthmereDailyTask(activityId)
      .then((body) => {
        // Only mark on a real success body; the in-flight dedupe returns
        // `undefined`, in which case the owning call marks completion itself.
        if (body) {
          markHarthmereDailyTaskCompletedToday(activityId);
        }
        return body;
      })
      .catch(() => {
        // Network/timeout: leave unmarked so a later action can retry the
        // once-per-day completion.
      });
  }, HOT_PATH_DEBOUNCE_MS);
  pendingHotPathTimers.set(activityId, timer);
}
