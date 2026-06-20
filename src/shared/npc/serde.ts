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
import type { BiomesId } from "@/shared/ids";
import { zNpcMemoryComponent } from "@/shared/npc/memory";
import { zThreatTableComponent } from "@/shared/npc/threat";
import { pack, unpack } from "msgpackr";
import { z } from "zod";

// Keep the runtime parser fully composed, but deliberately break TypeScript's
// deep generic inference chain. The v37 additions made this schema large enough
// that a normal .merge(...).merge(...).default({}) export can hit TS2589.
const zNpcStateBase: any = z.object({});

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
    state: "with-friend" | "moving-towards-friend" | "friendless" | "finding-a-path";
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
