import { secondsSinceEpoch } from "@/shared/ecs/config";
import { dist, sub, yaw } from "@/shared/math/linear";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import { getNpcWalkSpeed } from "@/shared/npc/bikkie";
import { z } from "zod";

export const HARTHMERE_NPC_PATROL_ROUTE_VERSION_V37 =
  "harthmere-npc-patrol-route-v37";

export const zPatrolComponent = z.object({
  patrol: z
    .object({
      currentWaypointIndex: z.number().default(0),
      pauseUntil: z.number().optional(),
      direction: z.enum(["forward", "backward"]).default("forward"),
    })
    .default({ currentWaypointIndex: 0, direction: "forward" }),
});

export type PatrolRoute = {
  waypoints: { position: [number, number, number]; pause_secs: number; facing_yaw_rad?: number }[];
  loop_behavior: "forward" | "ping_pong";
  walk_speed_modifier?: number;
};

const WAYPOINT_REACHED_EPSILON = 0.6;

export function patrolTick(
  npc: SimulatedNpc,
  route: PatrolRoute
): { forwardSpeed: number; targetYaw?: number } {
  if (!npc.state.patrol) {
    npc.mutableState().patrol = { currentWaypointIndex: 0, direction: "forward" };
  }
  const state = npc.mutableState().patrol!;
  const wp = route.waypoints[state.currentWaypointIndex];
  if (!wp) return { forwardSpeed: 0 };
  const now = secondsSinceEpoch();
  if (state.pauseUntil !== undefined && now < state.pauseUntil) {
    return { forwardSpeed: 0, targetYaw: wp.facing_yaw_rad };
  }
  if (dist(wp.position, npc.position) < WAYPOINT_REACHED_EPSILON) {
    if (state.pauseUntil === undefined) {
      state.pauseUntil = now + wp.pause_secs;
      return { forwardSpeed: 0, targetYaw: wp.facing_yaw_rad };
    }
    let nextIndex = state.currentWaypointIndex;
    let nextDir = state.direction;
    if (route.loop_behavior === "forward") {
      nextIndex = (state.currentWaypointIndex + 1) % route.waypoints.length;
    } else if (nextDir === "forward") {
      nextIndex += 1;
      if (nextIndex >= route.waypoints.length) {
        nextDir = "backward";
        nextIndex = Math.max(0, route.waypoints.length - 2);
      }
    } else {
      nextIndex -= 1;
      if (nextIndex < 0) {
        nextDir = "forward";
        nextIndex = Math.min(1, route.waypoints.length - 1);
      }
    }
    npc.mutableState().patrol = {
      currentWaypointIndex: nextIndex,
      pauseUntil: undefined,
      direction: nextDir,
    };
    return { forwardSpeed: 0 };
  }
  npc.mutableState().rotateTarget = yaw(sub(wp.position, npc.position));
  return {
    forwardSpeed: getNpcWalkSpeed(npc.type) * (route.walk_speed_modifier ?? 1),
  };
}
