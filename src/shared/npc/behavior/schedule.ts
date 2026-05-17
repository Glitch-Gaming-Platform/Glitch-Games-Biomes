import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3 } from "@/shared/math/types";
import { z } from "zod";

export const HARTHMERE_NPC_SCHEDULE_VERSION_V37 =
  "harthmere-npc-schedule-v37";

export const zNpcScheduleComponent = z.object({
  schedule: z
    .object({
      entries: z.array(
        z.object({
          hour_of_day: z.number().min(0).max(23),
          action: z.string(),
          anchor_id: z.number().optional(),
        })
      ),
      last_applied_hour: z.number().optional(),
    })
    .optional(),
});

export function gameHourOfDay(now: number = secondsSinceEpoch()): number {
  // Stable deterministic 24-hour cycle for local-dev NPC schedules.
  const secondsPerGameDay = 24 * 60;
  return Math.floor(((now % secondsPerGameDay) / secondsPerGameDay) * 24);
}

export function scheduleTick(
  npcState: any,
  anchorIndex: { positionOf: (id: BiomesId) => ReadonlyVec3 | undefined },
  now = secondsSinceEpoch()
): { targetPosition?: ReadonlyVec3; action?: string } {
  const schedule = npcState.schedule as
    | undefined
    | { entries: { hour_of_day: number; action: string; anchor_id?: BiomesId }[]; last_applied_hour?: number };
  if (!schedule || schedule.entries.length === 0) return {};
  const hour = gameHourOfDay(now);
  let current = schedule.entries[0];
  for (const entry of schedule.entries) {
    if (entry.hour_of_day <= hour) current = entry;
    else break;
  }
  if (schedule.last_applied_hour !== current.hour_of_day) {
    schedule.last_applied_hour = current.hour_of_day;
  }
  const targetPosition = current.anchor_id
    ? anchorIndex.positionOf(current.anchor_id)
    : undefined;
  return { targetPosition, action: current.action };
}
