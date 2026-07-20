import assert from "assert";
import { CollectTrigger } from "@/server/shared/triggers/leaves/collect";
import { WearTrigger } from "@/server/shared/triggers/leaves/wear";
import { BikkieIds } from "@/shared/bikkie/ids";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";
import { anItem } from "@/shared/game/item";
import { countOf, createBag } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import type { BiomesId } from "@/shared/ids";
import type { TriggerContext } from "@/server/shared/triggers/core";
import type { MetaState } from "@/shared/triggers/base_schema";

function triggerContext(events: any[]): TriggerContext {
  const states = new Map<BiomesId, MetaState<any>>();
  return {
    entity: {} as any,
    events,
    rootId: 6193612340426932 as BiomesId,
    publish: () => {},
    updateState: (id, _schema, fn) => {
      const next = fn(states.get(id) ?? {});
      states.set(id, next);
      return next;
    },
    clearState: (id) => states.delete(id),
  };
}

describe("native Road Ahead inventory trigger events", () => {
  it("counts the exact native Muckwad item id from an ECS collect event", () => {
    const item = anItem(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID);
    const trigger = new CollectTrigger(
      { id: 3623277001113501 as BiomesId, kind: "collect" },
      item,
      6
    );
    const context = triggerContext([
      {
        kind: "collect",
        entityId: 1,
        mined: true,
        bag: itemBagToString(
          createBag(countOf(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID, 6n))
        ),
      },
    ]);

    assert.equal(trigger.update(context), true);
  });

  it("advances separate top and bottoms triggers from native wearing events", () => {
    const top = anItem(BikkieIds.grassyTop);
    const bottoms = anItem(BikkieIds.bellBottoms);
    const topTrigger = new WearTrigger(
      { id: 5660250530071909 as BiomesId, kind: "wear" },
      top,
      1
    );
    const bottomsTrigger = new WearTrigger(
      { id: 94406418638805 as BiomesId, kind: "wear" },
      bottoms,
      1
    );

    assert.equal(
      topTrigger.update(
        triggerContext([
          {
            kind: "wearing",
            entityId: 1,
            bag: itemBagToString(createBag(countOf(top, 1n))),
          },
        ])
      ),
      true
    );
    assert.equal(
      bottomsTrigger.update(
        triggerContext([
          {
            kind: "wearing",
            entityId: 1,
            bag: itemBagToString(createBag(countOf(bottoms, 1n))),
          },
        ])
      ),
      true
    );
  });
});
