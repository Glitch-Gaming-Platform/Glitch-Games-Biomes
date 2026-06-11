/// <reference types="mocha" />
import {
  canAttackFilter,
  shouldAddCrosshairMeleeTargetV1,
  traceNpcMetadataCursorHitsV1,
} from "@/client/game/resources/melee_attack_region";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1 } from "@/shared/harthmere/combat_reach_v1";
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

// Root-cause regression: a left click breaks a voxel out to
// building.changeRadius (~8.78), but the melee cone that fed attackableEntities
// only reached combat.meleeAttackRegion.far (3.5). So a click landed the block
// break on a mucker 4-8 units away without ever counting it as a melee target --
// "the blocks break but they will not be hit." We now also feed the entity under
// the crosshair into the attack set, out to the same voxel-break reach.
describe("crosshair melee target inclusion (HARTHMERE_VOXEL_REACH_ATTACK_V1)", () => {
  const PLAYER_ID = 1 as BiomesId;
  const MUCKER_ID = 42 as BiomesId;
  const REACH = HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1;
  const base = {
    hasEntityHit: true,
    distance: REACH - 0.5,
    reach: REACH,
    targetId: MUCKER_ID,
    playerId: PLAYER_ID,
    alreadyIncludedIds: [] as BiomesId[],
    canAttack: true,
  };

  it("adds an aimed, attackable creature anywhere within voxel-break reach", () => {
    assert.equal(shouldAddCrosshairMeleeTargetV1(base), true);
    // ...including distances the old 3.5-unit melee cone always missed.
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, distance: 7.0 }),
      true
    );
  });

  it("does not add a target beyond the shared reach", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, distance: REACH + 0.01 }),
      false
    );
  });

  it("does not add when nothing is under the crosshair", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, hasEntityHit: false }),
      false
    );
  });

  it("does not add a non-attackable hit (peaceful NPC / placeable / protected)", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, canAttack: false }),
      false
    );
  });

  it("never targets the attacking player themselves", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, targetId: PLAYER_ID }),
      false
    );
  });

  it("dedupes a target the melee cone already included", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({
        ...base,
        alreadyIncludedIds: [MUCKER_ID],
      }),
      false
    );
  });

  it("rejects non-finite distances", () => {
    assert.equal(
      shouldAddCrosshairMeleeTargetV1({ ...base, distance: NaN }),
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
    const hits = traceNpcMetadataCursorHitsV1(
      table,
      [0, 1, 0],
      [0, 0, 1],
      { maxDistance: 8 }
    );

    assert.equal(hits.length, 1);
    assert.equal(hits[0].entity.id, npc.id);
    assert.equal(hits[0].distance, 4.5);
  });

  it("honors filters and dedupes entities already found by the collideable trace", () => {
    const table = { scan: () => [npc] } as any;

    assert.deepEqual(
      traceNpcMetadataCursorHitsV1(table, [0, 1, 0], [0, 0, 1], {
        maxDistance: 8,
        entityFilter: () => false,
      }),
      []
    );
    assert.deepEqual(
      traceNpcMetadataCursorHitsV1(table, [0, 1, 0], [0, 0, 1], {
        maxDistance: 8,
        excludeIds: new Set([npc.id]),
      }),
      []
    );
  });

  it("does not manufacture a hit when the ray misses the NPC box", () => {
    const table = { scan: () => [npc] } as any;
    const hits = traceNpcMetadataCursorHitsV1(
      table,
      [4, 1, 0],
      [0, 0, 1],
      { maxDistance: 8 }
    );

    assert.deepEqual(hits, []);
  });
});
