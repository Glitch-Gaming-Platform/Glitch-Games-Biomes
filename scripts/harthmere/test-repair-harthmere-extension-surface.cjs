#!/usr/bin/env node
const assert = require("assert");

const {
  creatureRegroundUpdate,
} = require("./repair-harthmere-extension-surface.cjs");

const actor = { id: 123, to: [2069, 53, -100] };

const ordinary = creatureRegroundUpdate(
  { hasNpcMetadata: () => false },
  actor
);
assert.deepStrictEqual(ordinary.position.v, actor.to);
assert.strictEqual(ordinary.npc_metadata, undefined);

const npc = creatureRegroundUpdate(
  {
    hasNpcMetadata: () => true,
    npcMetadata: () => ({
      type_id: 456,
      spawn_position: [1, 2, 3],
      spawn_orientation: [0, 1],
      created_time: 789,
      spawn_event_id: 1011,
      spawn_event_type_id: 1213,
    }),
  },
  actor
);
assert.deepStrictEqual(npc.position.v, actor.to);
assert.deepStrictEqual(npc.npc_metadata.spawn_position, actor.to);
assert.strictEqual(npc.npc_metadata.type_id, 456);
assert.deepStrictEqual(npc.npc_metadata.spawn_orientation, [0, 1]);

console.log("PASS extension surface repair actor update contract");
