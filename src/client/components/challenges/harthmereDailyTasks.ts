import { fetchHarthmereLiveWithTimeoutV1 } from "@/client/components/harthmere_live_fetch";

export const HARTHMERE_DAILY_TASK_COMPLETED_EVENT_V1 =
  "biomes:harthmere-daily-task-completed-v1" as const;

export type HarthmereDailyTaskActivityIdV1 =
  | "check_in"
  | "jobs_board"
  | "eat_meal"
  | "main_quest"
  | "talk_neighbor"
  | "forage_walk"
  | "garden_care"
  | "home_care";

const inFlightDailyTaskCompletionsV1 = new Set<string>();

function dispatchHarthmereDailyTaskCompletedEventV1(
  activityId: HarthmereDailyTaskActivityIdV1,
  body?: unknown
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_DAILY_TASK_COMPLETED_EVENT_V1, {
      detail: { activityId, body },
    })
  );
}

export async function completeHarthmereDailyTaskV1(
  activityId: HarthmereDailyTaskActivityIdV1,
  options: { fetchImpl?: typeof fetch; requestId?: string } = {}
) {
  if (inFlightDailyTaskCompletionsV1.has(activityId)) {
    return undefined;
  }
  inFlightDailyTaskCompletionsV1.add(activityId);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const requestId =
      options.requestId ??
      `harthmere_daily_${activityId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
    const response = await fetchHarthmereLiveWithTimeoutV1(
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
    dispatchHarthmereDailyTaskCompletedEventV1(activityId, body);
    return body;
  } finally {
    inFlightDailyTaskCompletionsV1.delete(activityId);
  }
}

export function completeHarthmereDailyTaskSoonV1(
  activityId: HarthmereDailyTaskActivityIdV1
) {
  void completeHarthmereDailyTaskV1(activityId).catch(() => {});
}
