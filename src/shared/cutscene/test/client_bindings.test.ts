import { buildCutsceneWorldIndex } from "@/client/game/cutscene/client_bindings";
import {
  clearChapter1PuppetOverrides,
  publishChapter1PuppetOverrides,
} from "@/shared/cutscene/puppets";
import assert from "assert";

describe("cutscene client bindings with Chapter 1 staging", () => {
  let previousWindow: PropertyDescriptor | undefined;

  beforeEach(() => {
    previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {},
    });
  });

  afterEach(() => {
    clearChapter1PuppetOverrides();
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  function world(entities: Array<Record<string, unknown>> = []) {
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const resources = {
      get(path: string, id?: number) {
        if (path === "/scene/player") {
          return { position: [0, 10, 0] };
        }
        if (path === "/ecs/entity") {
          return byId.get(id);
        }
        return undefined;
      },
    };
    const table = {
      scan() {
        return entities;
      },
    };
    return buildCutsceneWorldIndex(
      1 as never,
      resources as never,
      table as never
    );
  }

  it("binds a staged canonical actor whose ECS body is outside subscription", () => {
    publishChapter1PuppetOverrides([
      {
        id: 42,
        at: [10, 20, 30],
        yaw: 1.5,
        label: "Dr. Lucien Ardan",
        ghost: {
          family: "live_entity",
          asset: "townsperson_market",
          label: "Dr. Lucien Ardan",
        },
      },
    ]);

    const index = world();
    assert.deepStrictEqual(index.entity(42), {
      id: 42,
      alive: true,
      isNpc: true,
      position: [10, 20, 30],
      label: "Dr. Lucien Ardan",
      orientation: [0, 1.5],
    });
    assert.deepStrictEqual(
      index.npcsNear([10, 20, 30], 1).map((view) => view.id),
      [42]
    );
  });

  it("uses the staged position once when the subscribed ECS body is distant", () => {
    publishChapter1PuppetOverrides([
      { id: 42, at: [10, 20, 30], yaw: 1.5, label: "Staged Lou" },
    ]);
    const index = world([
      {
        id: 42,
        label: { text: "Base Lou" },
        position: { v: [900, 10, 900] },
        orientation: { v: [0, 0.25] },
        health: { hp: 20 },
        npc_metadata: { type_id: 100 },
      },
    ]);

    assert.deepStrictEqual(index.entity(42)?.position, [10, 20, 30]);
    assert.strictEqual(index.entity(42)?.label, "Staged Lou");
    assert.deepStrictEqual(
      index.npcsNear([10, 20, 30], 1).map((view) => view.id),
      [42],
      "table body and staged presentation must not duplicate"
    );
  });

  it("keeps hidden staged actors unavailable to exact and nearby binding", () => {
    publishChapter1PuppetOverrides([
      { id: 42, at: [10, 20, 30], yaw: 0, hidden: true },
    ]);
    const index = world([
      {
        id: 42,
        position: { v: [10, 20, 30] },
        npc_metadata: { type_id: 100 },
      },
    ]);

    assert.strictEqual(index.entity(42), undefined);
    assert.deepStrictEqual(index.npcsNear([10, 20, 30], 2), []);
  });
});
