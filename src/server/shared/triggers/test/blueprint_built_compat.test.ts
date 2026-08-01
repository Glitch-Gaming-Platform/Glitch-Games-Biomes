import type { TriggerContext } from "@/server/shared/triggers/core";
import {
  BlueprintBuiltTrigger,
  blueprintBuiltTriggerMatchesEventForTest,
} from "@/server/shared/triggers/leaves/blueprintBuilt";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { Challenges, TriggerState } from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { NATIVE_GIMME_SHELTER_QUEST_ID } from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import assert from "assert";

describe("BlueprintBuiltTrigger compatibility", () => {
  const gimmeShelterWorkbenchStepId = 6556766958076032 as BiomesId;
  let priorRuntime: BikkieRuntime | undefined;

  beforeEach(() => {
    priorRuntime = global.bikkieRuntime;
    global.bikkieRuntime = new BikkieRuntime();
    global.bikkieRuntime.registerBiscuits(
      new Map([
        [
          BikkieIds.blueprintWorkbench,
          {
            id: BikkieIds.blueprintWorkbench,
            name: "blueprintWorkbench",
            displayName: "Blueprint: Workbench",
            turnsInto: BikkieIds.workbench,
          } as Biscuit,
        ],
        [
          BikkieIds.workbench,
          {
            id: BikkieIds.workbench,
            name: "workbench",
            displayName: "Workbench",
          } as Biscuit,
        ],
        [
          NATIVE_GIMME_SHELTER_QUEST_ID,
          {
            id: NATIVE_GIMME_SHELTER_QUEST_ID,
            name: "Gimme Shelter",
            displayName: "Gimme Shelter",
            isQuest: true,
            questCategory: "main",
            repeatableCadence: "never",
          } as Biscuit,
        ],
      ])
    );
  });

  afterEach(() => {
    if (priorRuntime) {
      global.bikkieRuntime = priorRuntime;
    } else {
      delete (global as { bikkieRuntime?: BikkieRuntime }).bikkieRuntime;
    }
  });

  const workbenchBuilt = {
    kind: "blueprintBuilt",
    entityId: 1,
    blueprint: BikkieIds.blueprintWorkbench,
    position: [0, 0, 0],
  } as FirehoseEvent;

  const finishedWorkbenchBuilt = {
    ...workbenchBuilt,
    blueprint: BikkieIds.workbench,
  } as FirehoseEvent;

  function contextFor(events: FirehoseEvent[]) {
    const states = new Map<BiomesId, MetaState<any>>();
    return {
      states,
      context: {
        entity: new EntityBackedDelta({
          id: 1 as BiomesId,
          challenges: Challenges.create({}),
          trigger_state: TriggerState.create(),
        } as Entity),
        events,
        rootId: NATIVE_GIMME_SHELTER_QUEST_ID,
        publish: () => undefined,
        updateState: (
          id: BiomesId,
          _schema: unknown,
          fn: (state: MetaState<any>) => MetaState<any>
        ) => {
          const next = fn(states.get(id) ?? {});
          states.set(id, next);
          return next;
        },
        clearState: (id: BiomesId) => states.delete(id),
      } as unknown as TriggerContext,
    };
  }

  it("matches the exact authored blueprint item", () => {
    assert.equal(
      blueprintBuiltTriggerMatchesEventForTest(
        BikkieIds.blueprintWorkbench,
        workbenchBuilt
      ),
      true
    );
  });

  it("matches an objective authored against the finished Workbench item", () => {
    assert.equal(
      blueprintBuiltTriggerMatchesEventForTest(
        BikkieIds.workbench,
        workbenchBuilt
      ),
      true
    );
  });

  it("matches Gimme Shelter's authored blueprint when completion reports the finished Workbench", () => {
    assert.equal(
      blueprintBuiltTriggerMatchesEventForTest(
        BikkieIds.blueprintWorkbench,
        finishedWorkbenchBuilt
      ),
      true
    );
  });

  it("fires the real Gimme Shelter Workbench leaf and persists its receipt", () => {
    const trigger = BlueprintBuiltTrigger.deserialize({
      kind: "blueprintBuilt",
      id: gimmeShelterWorkbenchStepId,
      name: "Build a Workbench using it's blueprint",
      blueprint: BikkieIds.blueprintWorkbench,
      count: 1,
    });
    const { context, states } = contextFor([finishedWorkbenchBuilt]);

    assert.equal(trigger.update(context), true);
    assert.ok(states.get(gimmeShelterWorkbenchStepId)?.firedAt);
  });
});
