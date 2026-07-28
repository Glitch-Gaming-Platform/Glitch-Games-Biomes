import { log } from "@/shared/logging";
import { zChaseAttackComponent } from "@/shared/npc/behavior/chase_attack";
import { zDamageReactionComponent } from "@/shared/npc/behavior/damage_reaction";
import { zDrownComponent } from "@/shared/npc/behavior/drown";
import { zFarFromHomeComponent } from "@/shared/npc/behavior/far_from_home";
import type { PathfindingComponent } from "@/shared/npc/behavior/pathfinding";
import { zMeanderComponent } from "@/shared/npc/behavior/meander";
import { zPatrolComponent } from "@/shared/npc/behavior/patrol";
import { zReturnHomeComponent } from "@/shared/npc/behavior/return_home";
import { zRotateTargetComponent } from "@/shared/npc/behavior/rotate_target";
import { zNpcScheduleComponent } from "@/shared/npc/behavior/schedule";
import { zSocializeComponent } from "@/shared/npc/behavior/socialize";
import { zEscortComponent } from "@/shared/npc/behavior/escort";
import type { EscortState } from "@/shared/npc/behavior/escort";
import type { BiomesId } from "@/shared/ids";
import { zNpcMemoryComponent } from "@/shared/npc/memory";
import { zThreatTableComponent } from "@/shared/npc/threat";
import { zCreatureProgressionComponent } from "@/shared/npc/creature_level";
import type { CreatureProgression } from "@/shared/npc/creature_level";
import { zCreatureGroupComponent } from "@/shared/npc/creature_group";
import type {
  CreatureGroupMembership,
  GroupAlert,
} from "@/shared/npc/creature_group";
import { pack, unpack } from "msgpackr";
import { z } from "zod";

// Keep the runtime parser fully composed, but deliberately break TypeScript's
// deep generic inference chain. The v37 additions made this schema large enough
// that a normal .merge(...).merge(...).default({}) export can hit TS2589.
const zNpcStateBase: any = z.object({
  cinematicPauseUntil: z.number().finite().optional(),
  chapter1Encounter: z
    .object({
      brokenPartIds: z.array(z.string()).optional(),
      cycleStartedAtMs: z.number().finite().optional(),
      loopCount: z.number().int().nonnegative().optional(),
      hearthFed: z.boolean().optional(),
      routeChoice: z.string().min(1).max(80).optional(),
    })
    .optional(),
});

export const zDeserializedNpcState = zNpcStateBase
  .merge(zRotateTargetComponent)
  .merge(zDrownComponent)
  .merge(zMeanderComponent)
  .merge(zFarFromHomeComponent)
  .merge(zChaseAttackComponent)
  .merge(zDamageReactionComponent)
  .merge(zReturnHomeComponent)
  .merge(zSocializeComponent)
  .merge(zNpcMemoryComponent)
  .merge(zThreatTableComponent)
  .merge(zNpcScheduleComponent)
  .merge(zPatrolComponent)
  // HARTHMERE_CREATURE_LEVELING / HARTHMERE_CREATURE_GROUPS / HARTHMERE_ESCORT:
  // per-entity progression, authored group membership + live alert, and the
  // unified escort assignment. All three are optional, so every pre-existing
  // serialized NPC state still parses unchanged and simply reads as level 1,
  // ungrouped, and unassigned.
  .merge(zCreatureProgressionComponent)
  .merge(zCreatureGroupComponent)
  .merge(zEscortComponent)
  .partial()
  .default({}) as z.ZodTypeAny;

export type NpcMemoryPerPlayerEntry = {
  lastEventId?: string;
  lastSpokenAt?: number;
  sentiment: number;
  witnessedCrime: boolean;
};

export type NpcMemoryState = {
  [key: string]: {} | undefined;
  perPlayer: Record<string, NpcMemoryPerPlayerEntry>;
  events?: {}[];
  rumors?: {}[];
};

export type DeserializedNpcState = {
  /** Refreshed by authorized shared cinematics; Anima holds authority until it expires. */
  cinematicPauseUntil?: number;
  /** Server-owned Chapter 1 boss state consumed by Anima and the story API. */
  chapter1Encounter?: {
    brokenPartIds?: string[];
    cycleStartedAtMs?: number;
    loopCount?: number;
    hearthFed?: boolean;
    routeChoice?: string;
  };
  rotateTarget?: number;
  drown?: {
    submergedSinceSeconds: number;
    previousDamageSeconds?: number;
  };
  meander?: {
    nextRotateSecs: number;
    destination?: [number, number, number];
    pathfinding?: PathfindingComponent;
  };
  farFromHome?: {
    lastNearTime?: number;
  };
  chaseAttack?: {
    attackTime?: number;
    attackTarget?: BiomesId;
    strikeTime?: number;
    pathfinding?: PathfindingComponent;
    pathfindingRetryTime?: number;
    /**
     * HARTHMERE_HILL_COMBAT: seconds-since-epoch of the last confirmed sighting
     * of the current target, plus where it was. Together these implement the
     * lost-sight grace window that replaced "one failed ray drops the target".
     */
    lastSeenTargetAtSeconds?: number;
    lastKnownTargetPosition?: [number, number, number];
    targetVisible?: boolean;
    /**
     * Rate limits full A* rebuilds while chasing a moving target, and records
     * where the last search actually routed to so tail repairs cannot compound.
     */
    lastPathSearchAtSeconds?: number;
    lastPathSearchDestination?: [number, number, number];
  };
  damageReaction?: {
    lastReactionTime?: number;
  };
  returnHome?: {
    lastHomeTime: number;
  };
  socialize?: {
    friend?: BiomesId;
    previousFriend?: BiomesId;
    meetingTime?: number;
    meetingDuration?: number;
    pathfinding?: PathfindingComponent;
    state:
      | "with-friend"
      | "moving-towards-friend"
      | "friendless"
      | "finding-a-path";
  };
  memory?: NpcMemoryState;
  threat?: {
    table: Record<string, number>;
    lastDecayAt?: number;
  };
  schedule?: {
    entries: {
      hour_of_day: number;
      action: string;
      anchor_id?: BiomesId;
    }[];
    last_applied_hour?: number;
  };
  patrol?: {
    currentWaypointIndex: number;
    pauseUntil?: number;
    direction: "forward" | "backward";
  };
  /** HARTHMERE_CREATURE_LEVELING: authoritative per-entity level. */
  creatureProgression?: CreatureProgression;
  /** HARTHMERE_CREATURE_GROUPS: runtime override of authored membership. */
  creatureGroup?: CreatureGroupMembership;
  /** HARTHMERE_CREATURE_GROUPS: the live alert this member has adopted. */
  groupAlert?: GroupAlert;
  /** HARTHMERE_ESCORT: the single unified escort assignment. */
  escort?: EscortState;
};

export function deserializeNpcCustomState(
  encoded: Uint8Array | undefined,
  options?: { propagateParseError?: boolean }
): DeserializedNpcState {
  if (encoded === undefined) {
    return zDeserializedNpcState.parse(undefined) as DeserializedNpcState;
  }

  try {
    return zDeserializedNpcState.parse(unpack(encoded)) as DeserializedNpcState;
  } catch (error) {
    if (options?.propagateParseError) {
      throw error;
    }
    log.warn(
      `Resetting state to default due to error while parsing NPC state: ${error}`
    );
    return zDeserializedNpcState.parse(undefined) as DeserializedNpcState;
  }
}

export function serializeNpcCustomState(decoded: DeserializedNpcState) {
  return pack(decoded);
}
