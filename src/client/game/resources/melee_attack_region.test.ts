/// <reference types="mocha" />
import {
  canTraceCursorEntity,
  canAttackFilter,
  isNativeEcsAttackTarget,
  shouldAddCrosshairMeleeTarget,
  traceNpcMetadataCursorHits,
} from "@/client/game/resources/melee_attack_region";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("harthmere melee attack entity filtering", () => {
  const ruleset = {
    canAttackPlayer: () => false,
  } as any;

  it("allows health-backed muckers without NPC metadata", () => {
    const mucker = {
      id: 101 as BiomesId,
      health: { hp: 10, maxHp: 10 },
      label: { text: "Old Wood Mucker 10" },
      position: { v: [0, 0, 0] },
      robot_component: {},
    } as any;

    assert.equal(canAttackFilter(ruleset, false, undefined, mucker), true);
    assert.equal(
      isNativeEcsAttackTarget(mucker),
      false,
      "presentation compatibility must not masquerade as a native ECS NPC"
    );
  });

  it("does not turn non-living world objects with health into attack targets", () => {
    const jobsBoard = {
      id: 102 as BiomesId,
      health: { hp: 10, maxHp: 10 },
      label: { text: "Harthmere Town Jobs Board" },
      position: { v: [0, 0, 0] },
    } as any;

    assert.equal(canAttackFilter(ruleset, false, undefined, jobsBoard), false);
  });

  it("allows real Harthmere muckers even when their NPC type says attackable=false", () => {
    const mucker = {
      id: 103 as BiomesId,
      health: { hp: 20, maxHp: 20 },
      npc_metadata: { type_id: BikkieIds.dMucker },
      label: { text: "Old Wood Mucker" },
      position: { v: [0, 0, 0] },
      size: { v: [1, 1.2, 1] },
      collideable: {},
    } as any;

    assert.equal(canAttackFilter(ruleset, false, undefined, mucker), true);
    assert.equal(isNativeEcsAttackTarget(mucker), true);
  });

  it("allows real Harthmere animals even when they reuse the dMucker NPC type", () => {
    const cow = {
      id: 104 as BiomesId,
      health: { hp: 20, maxHp: 20 },
      npc_metadata: { type_id: BikkieIds.dMucker },
      label: { text: "Muckmeadow Cow" },
      position: { v: [0, 0, 0] },
      size: { v: [1.3, 1.5, 2] },
      collideable: {},
    } as any;

    assert.equal(canAttackFilter(ruleset, false, undefined, cow), true);
  });
});

// The cursor fallback helps visible NPCs without collideable metadata, but it
// must remain inside combat melee reach instead of inheriting voxel-edit reach.
describe("crosshair melee target inclusion", () => {
  const PLAYER_ID = 1 as BiomesId;
  const MUCKER_ID = 42 as BiomesId;
  const REACH = 3.5;
  const base = {
    hasEntityHit: true,
    distance: REACH - 0.5,
    reach: REACH,
    targetId: MUCKER_ID,
    playerId: PLAYER_ID,
    alreadyIncludedIds: [] as BiomesId[],
    canAttack: true,
  };

  it("adds an aimed, attackable creature within melee reach", () => {
    assert.equal(shouldAddCrosshairMeleeTarget(base), true);
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, distance: 7.0 }),
      false
    );
  });

  it("does not add a target beyond the shared reach", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, distance: REACH + 0.01 }),
      false
    );
  });

  it("does not add when nothing is under the crosshair", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, hasEntityHit: false }),
      false
    );
  });

  it("does not add a non-attackable hit (peaceful NPC / placeable / protected)", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, canAttack: false }),
      false
    );
  });

  it("never targets the attacking player themselves", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, targetId: PLAYER_ID }),
      false
    );
  });

  it("dedupes a target the melee cone already included", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({
        ...base,
        alreadyIncludedIds: [MUCKER_ID],
      }),
      false
    );
  });

  it("rejects non-finite distances", () => {
    assert.equal(
      shouldAddCrosshairMeleeTarget({ ...base, distance: NaN }),
      false
    );
  });
});

describe("Harthmere NPC metadata cursor ray fallback", () => {
  const npc = {
    id: 501 as BiomesId,
    npc_metadata: { type_id: -1 },
    position: { v: [0, 0, 5] },
    size: { v: [1, 2, 1] },
    health: { hp: 10, maxHp: 10 },
    label: { text: "Old Wood Mucker" },
    // Intentionally no collideable component: this is the production failure
    // mode where the NPC renderer can see the entity but traceEntities() cannot.
  } as any;

  it("ray-tests positioned NPCs even when they are not in CollideableSelector", () => {
    const table = { scan: () => [npc] } as any;
    const hits = traceNpcMetadataCursorHits(table, [0, 1, 0], [0, 0, 1], {
      maxDistance: 8,
    });

    assert.equal(hits.length, 1);
    assert.equal(hits[0].entity.id, npc.id);
    assert.equal(hits[0].distance, 4.5);
  });

  it("honors filters and dedupes entities already found by the collideable trace", () => {
    const table = { scan: () => [npc] } as any;

    assert.deepEqual(
      traceNpcMetadataCursorHits(table, [0, 1, 0], [0, 0, 1], {
        maxDistance: 8,
        entityFilter: () => false,
      }),
      []
    );
    assert.deepEqual(
      traceNpcMetadataCursorHits(table, [0, 1, 0], [0, 0, 1], {
        maxDistance: 8,
        excludeIds: new Set([npc.id]),
      }),
      []
    );
  });

  it("keeps native NPCs eligible for the metadata trace that replaces the generic trace", () => {
    assert.equal(
      canTraceCursorEntity({
        entity: npc,
        playerId: 1 as BiomesId,
        nativeEcsAuthority: true,
        pass: "generic",
      }),
      false
    );
    assert.equal(
      canTraceCursorEntity({
        entity: npc,
        playerId: 1 as BiomesId,
        nativeEcsAuthority: true,
        pass: "native_npc_metadata",
      }),
      true
    );
  });

  it("does not manufacture a hit when the ray misses the NPC box", () => {
    const table = { scan: () => [npc] } as any;
    const hits = traceNpcMetadataCursorHits(table, [4, 1, 0], [0, 0, 1], {
      maxDistance: 8,
    });

    assert.deepEqual(hits, []);
  });

  it("ray-tests the latency-smoothed body that is actually rendered", () => {
    const authoritativeAhead = {
      ...npc,
      position: { v: [2, 0, 5] },
    } as any;
    const table = { scan: () => [authoritativeAhead] } as any;
    const hits = traceNpcMetadataCursorHits(table, [0, 1, 0], [0, 0, 1], {
      maxDistance: 8,
      aabbForEntity: (entity) => [
        [-0.5, entity.position.v[1], 4.5],
        [0.5, entity.position.v[1] + 2, 5.5],
      ],
    });

    assert.equal(hits.length, 1);
    assert.equal(hits[0].entity.id, npc.id);
    assert.equal(hits[0].distance, 4.5);
  });

  it("does not use a broad cone to pull in an off-crosshair bystander", () => {
    const table = { scan: () => [npc] } as any;
    const hits = traceNpcMetadataCursorHits(table, [0.65, 1, 0], [0, 0, 1], {
      maxDistance: 8,
    });

    assert.deepEqual(hits, []);
  });
});
