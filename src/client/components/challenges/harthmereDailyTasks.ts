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

export function completeHarthmereDailyTaskSoon(
  activityId: HarthmereDailyTaskActivityId
) {
  void completeHarthmereDailyTask(activityId).catch(() => {});
}
