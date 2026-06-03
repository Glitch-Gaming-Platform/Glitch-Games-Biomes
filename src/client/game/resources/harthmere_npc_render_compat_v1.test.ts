/// <reference types="mocha" />

import assert from "assert";
import {
  harthmereEnsureRenderableNpcEntityV1,
  isRenderNpcEntity,
} from "./harthmere_npc_render_compat_v1";

describe("Harthmere NPC render component compatibility", () => {
  it("fills display-only render defaults for positioned NPCs missing combat/render components", () => {
    const source = {
      id: 123,
      npc_metadata: { type_id: "not_a_known_npc_type" },
      position: { v: [10, 54, -20] },
      label: { text: "Billy Rhodes" },
    } as any;

    assert.equal(isRenderNpcEntity(source), false);
    const renderable = harthmereEnsureRenderableNpcEntityV1(source);

    assert.ok(renderable);
    assert.equal(renderable.id, source.id);
    assert.deepEqual(renderable.position, source.position);
    assert.deepEqual(renderable.rigid_body.velocity, [0, 0, 0]);
    assert.deepEqual(renderable.size.v, [1, 2, 1]);
    assert.deepEqual(renderable.orientation.v, [0, 0]);
    assert.equal(renderable.health.hp, 100);
    assert.equal(renderable.health.maxHp, 100);
    assert.equal(source.health, undefined, "source ECS entity is not mutated");
  });

  it("does not manufacture a render body when the entity has no NPC metadata or position", () => {
    assert.equal(harthmereEnsureRenderableNpcEntityV1({ id: 1 } as any), undefined);
    assert.equal(
      harthmereEnsureRenderableNpcEntityV1({
        id: 2,
        npc_metadata: { type_id: -1 },
      } as any),
      undefined
    );
    assert.equal(
      harthmereEnsureRenderableNpcEntityV1({
        id: 3,
        position: { v: [0, 0, 0] },
      } as any),
      undefined
    );
  });

  it("returns already-renderable NPCs unchanged", () => {
    const source = {
      id: 456,
      rigid_body: { velocity: [1, 0, 0] },
      npc_metadata: { type_id: -1 },
      position: { v: [1, 2, 3] },
      size: { v: [0.8, 1.7, 0.8] },
      orientation: { v: [0, 1] },
      health: { hp: 5, maxHp: 6 },
    } as any;

    assert.equal(isRenderNpcEntity(source), true);
    assert.equal(harthmereEnsureRenderableNpcEntityV1(source), source);
  });
});
