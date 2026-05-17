// HARTHMERE_SCHEDULE_FOLLOW_V2
// Drives an NPC along its scheduled route. Reads npc.state.schedule
// (zNpcScheduleComponent), picks the entry whose hour_of_day is current,
// resolves its anchor_id to a world position, and returns the forwardSpeed
// + rotateTarget needed to walk there. This is what was missing — schedules
// were being stored but nothing was consuming them.
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { distSq, length, sub, yaw } from "@/shared/math/linear";
import type { ReadonlyVec3 } from "@/shared/math/types";
import { gameHourOfDay } from "@/shared/npc/behavior/schedule";
import type { Environment } from "@/shared/npc/environment";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { SimulatedNpc } from "@/shared/npc/simulated";

// How close before we consider the NPC "arrived" at the scheduled anchor.
const ARRIVE_RADIUS_SQ = 2.5 * 2.5;
// If we're farther than this from the schedule target, walk at full pace.
const RUN_DIST_SQ = 12 * 12;
// Slow-walk fraction for the last few meters so NPCs ease into anchor.
const SLOW_FRACTION = 0.55;

export function scheduleFollowTick(
  env: Environment,
  npc: SimulatedNpc,
  now = secondsSinceEpoch(),
): { forwardSpeed: number; targetReached: boolean } {
  const out = { forwardSpeed: 0, targetReached: true };
  const schedule = (npc.state as any).schedule as
    | undefined
    | {
        entries: { hour_of_day: number; action: string; anchor_id?: number }[];
        last_applied_hour?: number;
        cached_target?: ReadonlyVec3;
      };
  if (!schedule || !schedule.entries || schedule.entries.length === 0) {
    return out;
  }
  const hour = gameHourOfDay(now);
  let current = schedule.entries[0];
  for (const entry of schedule.entries) {
    if (entry.hour_of_day <= hour) current = entry;
    else break;
  }
  if (!current.anchor_id) return out;

  // Look up the anchor position via the entity store. Fall back to the
  // cached target if the lookup fails (e.g. the entity is paged out).
  let target: ReadonlyVec3 | undefined;
  try {
    const entity = env.resources.get("/ecs/entity", current.anchor_id as any);
    if (entity?.position) target = entity.position.v;
  } catch {
    // ignore — fall through to cache or last_known
  }
  if (!target) target = schedule.cached_target;
  if (!target) return out;

  schedule.cached_target = target;
  schedule.last_applied_hour = current.hour_of_day;

  const delta = sub(target, npc.position);
  const d2 = delta[0] * delta[0] + delta[2] * delta[2]; // ignore Y
  if (d2 <= ARRIVE_RADIUS_SQ) {
    return { forwardSpeed: 0, targetReached: true };
  }
  // Face the target.
  npc.mutableState().rotateTarget = yaw(delta);
  // Distance-based speed pacing.
  const baseSpeed = getNpcRunSpeed(npc.type);
  const speed = d2 >= RUN_DIST_SQ ? baseSpeed : baseSpeed * SLOW_FRACTION;
  return { forwardSpeed: speed, targetReached: false };
}

export const HARTHMERE_SCHEDULE_FOLLOW_VERSION_V2 =
  "harthmere-schedule-follow-v2" as const;
