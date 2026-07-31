import { NpcTracker } from "@/server/shared/npc/npc_tracker";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { NpcMetadata } from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { allNpcs } from "@/shared/npc/bikkie";
import { zSpawnConstraints } from "@/shared/npc/spawn_events";
import assert from "assert";

describe("Anima NpcTracker", () => {
  it("indexes NPCs by type, globally, and by spawn event", () => {
    const tracker = new NpcTracker({ noLogging: {} });
    const npcId = 1001 as BiomesId;
    const spawnId = 1002 as BiomesId;
    const npcType = allNpcs()[0];
    const spawnEventId = 8_991_001 as BiomesId;
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          spawnEventId,
          {
            id: spawnEventId,
            name: "animaTrackerBaselineSpawn",
            npcBag: [[npcType.id, 1]],
            spawnConstraints: zSpawnConstraints.parse({
              terrainType: ["grass"],
            }),
            density: 1,
            enabled: true,
          } as any,
        ],
      ])
    );
    const metadata = NpcMetadata.create({
      type_id: npcType.id,
      spawn_event_type_id: spawnEventId,
      spawn_event_id: spawnId,
      spawn_position: [0, 0, 0],
      spawn_orientation: [0, 0],
    });

    tracker.trackNpc(npcId, metadata);

    assert.equal(tracker.npcs(undefined).has(npcId), true);
    assert.equal(tracker.npcs(npcType.id).has(npcId), true);
    assert.equal(
      tracker.spawnEvents(spawnEventId).get(spawnId).has(npcId),
      true
    );

    tracker.untrackNpc(npcId);
    assert.equal(tracker.npcs(undefined).has(npcId), false);
    assert.equal(tracker.npcs(npcType.id).has(npcId), false);
    assert.equal(tracker.spawnEvents(spawnEventId).has(spawnId), false);
    tracker.untrackNpc(npcId);
  });

  it("fires removable one-shot-style tracking hooks when the id is observed", () => {
    const tracker = new NpcTracker({ noLogging: {} });
    const npcId = 2001 as BiomesId;
    const npcType = allNpcs()[0];
    const metadata = NpcMetadata.create({
      type_id: npcType.id,
      spawn_position: [0, 0, 0],
      spawn_orientation: [0, 0],
    });
    let calls = 0;
    const hook = tracker.addTrackHook(npcId, () => {
      calls += 1;
    });

    tracker.trackNpc(npcId, metadata);
    assert.equal(calls, 1);
    tracker.removeTrackHook(hook);
    tracker.untrackNpc(npcId);
    tracker.trackNpc(npcId, metadata);
    assert.equal(calls, 1);
    assert.throws(() => tracker.removeTrackHook(hook));
  });
});
