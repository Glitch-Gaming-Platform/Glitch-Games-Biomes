import { emitHarthmereNativeNpcAttackContact } from "@/client/game/interact/helpers";
import { HARTHMERE_PROJECTILE_VISUAL_EVENT } from "@/shared/harthmere/projectile_visual_manifest";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { Item } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const CONTACT_EVENT = "biomes:harthmere-native-npc-attack-contact";

class TestCustomEvent<T> extends Event {
  readonly detail: T;

  constructor(type: string, init: { detail: T }) {
    super(type);
    this.detail = init.detail;
  }
}

function withTestWindow(run: (target: EventTarget) => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousCustomEvent = Object.getOwnPropertyDescriptor(
    globalThis,
    "CustomEvent"
  );
  const target = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: target,
  });
  Object.defineProperty(globalThis, "CustomEvent", {
    configurable: true,
    writable: true,
    value: TestCustomEvent,
  });
  try {
    run(target);
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (previousCustomEvent) {
      Object.defineProperty(globalThis, "CustomEvent", previousCustomEvent);
    } else {
      delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
    }
  }
}

function tool(itemId: string) {
  return {
    id: harthmereNativeBiomesIdForItemId(itemId),
  } as Item;
}

describe("Harthmere native attack projectile dispatch", () => {
  it("shows a ranged projectile when the attack misses every entity", () => {
    withTestWindow((target) => {
      const projectiles: Array<Record<string, unknown>> = [];
      const contacts: Array<Record<string, unknown>> = [];
      target.addEventListener(HARTHMERE_PROJECTILE_VISUAL_EVENT, (event) => {
        projectiles.push(
          (event as TestCustomEvent<Record<string, unknown>>).detail
        );
      });
      target.addEventListener(CONTACT_EVENT, (event) => {
        contacts.push(
          (event as TestCustomEvent<Record<string, unknown>>).detail
        );
      });

      emitHarthmereNativeNpcAttackContact({
        attackedEntities: [],
        tool: tool("hunter_bow"),
      });

      assert.equal(contacts.length, 0);
      assert.equal(projectiles.length, 1);
      assert.equal(projectiles[0].projectileVisualId, "hunter_bow_shot");
      assert.equal(projectiles[0].result, "miss");
      assert.equal(projectiles[0].source, "native_ecs_attack_miss");
      assert.equal(projectiles[0].targetPoint, undefined);
    });
  });

  it("shows the exact projectile and contact target when a ranged attack hits", () => {
    withTestWindow((target) => {
      const projectiles: Array<Record<string, unknown>> = [];
      const contacts: Array<Record<string, unknown>> = [];
      target.addEventListener(HARTHMERE_PROJECTILE_VISUAL_EVENT, (event) => {
        projectiles.push(
          (event as TestCustomEvent<Record<string, unknown>>).detail
        );
      });
      target.addEventListener(CONTACT_EVENT, (event) => {
        contacts.push(
          (event as TestCustomEvent<Record<string, unknown>>).detail
        );
      });
      const entity = {
        id: 91_100 as BiomesId,
        position: { v: [8, 0, 1] },
        health: { hp: 100, maxHp: 100 },
        npc_metadata: { type_id: 91_101 as BiomesId },
        label: { text: "Projectile Test Target" },
      } as unknown as ReadonlyEntity;

      emitHarthmereNativeNpcAttackContact({
        attackedEntities: [entity],
        tool: tool("steel_dart"),
      });

      assert.equal(contacts.length, 1);
      assert.equal(projectiles.length, 1);
      assert.equal(projectiles[0].projectileVisualId, "ranged_shot");
      assert.equal(projectiles[0].result, "hit");
      assert.equal(projectiles[0].nativeTargetEntityId, entity.id);
      assert.deepEqual(projectiles[0].targetPoint, [8, 0.9, 1]);
    });
  });
});
