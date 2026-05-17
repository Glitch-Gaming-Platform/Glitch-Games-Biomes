import { log } from "@/shared/logging";
import { zChaseAttackComponent } from "@/shared/npc/behavior/chase_attack";
import { zDamageReactionComponent } from "@/shared/npc/behavior/damage_reaction";
import { zDrownComponent } from "@/shared/npc/behavior/drown";
import { zFarFromHomeComponent } from "@/shared/npc/behavior/far_from_home";
import { zMeanderComponent } from "@/shared/npc/behavior/meander";
import { zReturnHomeComponent } from "@/shared/npc/behavior/return_home";
import { zRotateTargetComponent } from "@/shared/npc/behavior/rotate_target";
import { zPatrolComponent } from "@/shared/npc/behavior/patrol";
import { zSocializeComponent } from "@/shared/npc/behavior/socialize";
import { zNpcScheduleComponent } from "@/shared/npc/behavior/schedule";
import { zNpcMemoryComponent } from "@/shared/npc/memory";
import { zThreatTableComponent } from "@/shared/npc/threat";
import { pack, unpack } from "msgpackr";
import { z } from "zod";

// Keep the runtime parser fully composed, but deliberately break TypeScript's
// deep generic inference chain. The v37 additions made this schema large enough
// that a normal .merge(...).merge(...).default({}) export can hit TS2589 and,
// with this repo's zod typings, even fail assignment to ZodTypeAny. Starting the
// chain from `any` keeps the runtime behavior identical while making the type
// surface intentionally shallow.
const zNpcStateBaseV40: any = z.object({});

export const zDeserializedNpcState = zNpcStateBaseV40
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

export type DeserializedNpcState = Record<string, unknown>;

export function deserializeNpcCustomState(
  encoded: Uint8Array | undefined,
  options?: { propagateParseError?: boolean }
): DeserializedNpcState {
  if (encoded === undefined) {
    return zDeserializedNpcState.parse(undefined);
  }

  try {
    return zDeserializedNpcState.parse(unpack(encoded));
  } catch (error) {
    if (options?.propagateParseError) {
      throw error;
    }
    // If an error occurs while deserializing, just return the default.
    log.warn(
      `Resetting state to default due to error while parsing NPC state: ${error}`
    );
    return zDeserializedNpcState.parse(undefined);
  }
}

export function serializeNpcCustomState(decoded: DeserializedNpcState) {
  return pack(decoded);
}
