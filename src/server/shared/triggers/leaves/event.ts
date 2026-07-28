import type { TriggerContext } from "@/server/shared/triggers/core";
import { BaseTrigger } from "@/server/shared/triggers/trigger";
import type { FirehoseEvent } from "@/shared/firehose/events";
import type { BiomesId } from "@/shared/ids";
import type {
  BaseStoredTriggerDefinition,
  MetaState,
} from "@/shared/triggers/base_schema";
import { matches } from "@/shared/triggers/matcher";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import { zEventStoredTriggerDefinition } from "@/shared/triggers/schema";
import {
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID,
  isNativeGetTheMuckOutCompatibleMucklingTypeId,
} from "@/shared/harthmere/native_road_ahead_contract";
import { nativeLegacyCombatQuestCanonicalNpcTypeId } from "@/shared/harthmere/native_combat_quest_routing";
import type { ZodNumber } from "zod";
import { z } from "zod";

export abstract class BaseEventTrigger extends BaseTrigger<ZodNumber> {
  abstract kind: string;
  public readonly schema = z.number();

  constructor(
    spec: BaseStoredTriggerDefinition,
    public readonly count: number
  ) {
    super(spec);
  }

  protected abstract countForEvent(
    context: TriggerContext,
    event: FirehoseEvent
  ): number;

  tick(context: TriggerContext, state: MetaState<number>): boolean {
    state.payload = context.events.reduce(
      (acc, event) => acc + this.countForEvent(context, event),
      state.payload ?? 0
    );
    return state.payload >= this.count;
  }

  abstract serialize(): StoredTriggerDefinition;
}

export class EventTrigger extends BaseEventTrigger {
  public readonly kind = "event";

  constructor(
    spec: BaseStoredTriggerDefinition,
    public readonly eventKind: FirehoseEvent["kind"],
    count: number,
    public readonly predicate?: Matcher
  ) {
    super(spec, count);
  }

  protected countForEvent(
    context: TriggerContext,
    event: FirehoseEvent
  ): number {
    return eventTriggerMatchesEventForTest(
      {
        questId: context.rootId,
        triggerId: this.spec.id,
        eventKind: this.eventKind,
        predicate: this.predicate,
      },
      event
    )
      ? 1
      : 0;
  }

  static deserialize(data: any): EventTrigger {
    const spec = zEventStoredTriggerDefinition.parse(data);
    return new EventTrigger(spec, spec.eventKind, spec.count, spec.predicate);
  }

  serialize(): StoredTriggerDefinition {
    return {
      ...this.spec,
      kind: "event",
      eventKind: this.eventKind,
      count: this.count,
      predicate: this.predicate,
    };
  }
}

/**
 * Match a firehose event against an authored event leaf.
 *
 * Original combat quests predate the restored Harthmere native NPC families
 * and name exact legacy Bikkie ids. For a narrowly routed quest+leaf pair,
 * retry its unchanged authored predicate with the corresponding legacy id.
 * This avoids duplicate npcKilled events (which would double-count generic
 * kill objectives) while preserving exact matching everywhere else.
 */
export function eventTriggerMatchesEventForTest(
  trigger: {
    questId: BiomesId;
    triggerId: BiomesId;
    eventKind: FirehoseEvent["kind"];
    predicate?: Matcher;
  },
  event: FirehoseEvent
) {
  if (event.kind !== trigger.eventKind) return false;
  if (trigger.predicate === undefined || matches(trigger.predicate, event)) {
    return true;
  }
  if (
    Number(trigger.questId) !== Number(NATIVE_GET_THE_MUCK_OUT_QUEST_ID) ||
    Number(trigger.triggerId) !==
      Number(NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID) ||
    event.kind !== "npcKilled" ||
    !isNativeGetTheMuckOutCompatibleMucklingTypeId(event.npcTypeId)
  ) {
    if (event.kind !== "npcKilled") return false;
    const canonicalNpcTypeId = nativeLegacyCombatQuestCanonicalNpcTypeId({
      questId: trigger.questId,
      triggerId: trigger.triggerId,
      npcTypeId: event.npcTypeId,
    });
    return canonicalNpcTypeId === undefined
      ? false
      : matches(trigger.predicate!, {
          ...event,
          npcTypeId: canonicalNpcTypeId,
        });
  }
  return matches(trigger.predicate, {
    ...event,
    npcTypeId: NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID,
  });
}
