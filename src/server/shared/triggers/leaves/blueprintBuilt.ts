import type { TriggerContext } from "@/server/shared/triggers/core";
import { BaseEventTrigger } from "@/server/shared/triggers/leaves/event";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import type { BaseStoredTriggerDefinition } from "@/shared/triggers/base_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import { zBlueprintBuiltStoredTriggerDefinition } from "@/shared/triggers/schema";

export function blueprintBuiltTriggerMatchesEventForTest(
  authoredBlueprint: BiomesId,
  event: FirehoseEvent
): boolean {
  if (event.kind !== "blueprintBuilt") {
    return false;
  }
  if (event.blueprint === authoredBlueprint) {
    return true;
  }

  // A completed build can be identified by either the consumed blueprint or
  // the placeable it produced. Treat the two sides of Bikkie's `turnsInto`
  // relationship as one build identity so the quest does not strand a player
  // after the Workbench is already present in the world.
  const eventResult = anItem(event.blueprint).turnsInto;
  if (eventResult === authoredBlueprint) {
    return true;
  }
  return anItem(authoredBlueprint).turnsInto === event.blueprint;
}

export class BlueprintBuiltTrigger extends BaseEventTrigger {
  public readonly kind = "blueprintBuilt";

  constructor(
    spec: BaseStoredTriggerDefinition,
    public readonly blueprint: BiomesId,
    count: number
  ) {
    super(spec, count);
  }

  override countForEvent(
    context: TriggerContext,
    event: FirehoseEvent
  ): number {
    return blueprintBuiltTriggerMatchesEventForTest(this.blueprint, event)
      ? 1
      : 0;
  }

  static deserialize(data: any): BlueprintBuiltTrigger {
    const spec = zBlueprintBuiltStoredTriggerDefinition.parse(data);
    return new BlueprintBuiltTrigger(spec, spec.blueprint, spec.count);
  }

  serialize(): StoredTriggerDefinition {
    return {
      ...this.spec,
      kind: "blueprintBuilt",
      blueprint: this.blueprint,
      count: this.count,
    };
  }
}
