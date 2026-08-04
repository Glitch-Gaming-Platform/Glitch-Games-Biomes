import type { BiomesId } from "@/shared/ids";
import { zVec3f, type Vec3 } from "@/shared/math/types";
import { zPathfindingComponent } from "@/shared/npc/behavior/pathfinding";
import { z } from "zod";

export const HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION =
  "harthmere-business-customer-behavior-v1" as const;

export const zBusinessCustomerPhase = z.enum([
  "patron_wandering",
  "spawning",
  "entering",
  "queued",
  "approaching_counter",
  "serving",
  "departing",
  "despawn_ready",
  "despawned",
  "cancelled",
]);

export const zBusinessCustomerReaction = z.enum([
  "neutral",
  "success",
  "incorrect",
  "timeout",
  "insufficient_stock",
  "payment",
]);

export const zBusinessCustomerState = z.object({
  version: z.literal(HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION),
  sessionId: z.string().min(1),
  ticketId: z.string().min(1),
  outpostId: z.string().min(1),
  businessType: z.string().min(1),
  actorEntityId: z.number().optional(),
  phase: zBusinessCustomerPhase,
  reaction: zBusinessCustomerReaction,
  entrance: zVec3f,
  queueTarget: zVec3f,
  customer: zVec3f,
  staff: zVec3f,
  departure: zVec3f,
  waypoints: z.array(zVec3f),
  waypointIndex: z.number().int().nonnegative(),
  pathfinding: zPathfindingComponent.optional(),
  lastPhaseChangedAtSeconds: z.number().finite(),
  reactionStartedAtSeconds: z.number().finite().optional(),
  audioCue: z.string().optional(),
  // Retained only for backward-compatible deserialization of customer state
  // written by the former terrain-A* implementation. The current authoritative
  // route follows the audited interior waypoints directly and does not consult
  // these values.
  progressPosition: zVec3f.optional(),
  progressAtSeconds: z.number().finite().optional(),
});

export const zBusinessCustomerComponent = z.object({
  businessCustomer: zBusinessCustomerState.optional(),
});

export type BusinessCustomerPhase = z.infer<typeof zBusinessCustomerPhase>;
export type BusinessCustomerReaction = z.infer<
  typeof zBusinessCustomerReaction
>;
export type BusinessCustomerState = z.infer<typeof zBusinessCustomerState> & {
  actorEntityId?: BiomesId;
  entrance: Vec3;
  queueTarget: Vec3;
  customer: Vec3;
  staff: Vec3;
  departure: Vec3;
  waypoints: Vec3[];
  progressPosition?: Vec3;
};
