/// <reference types="mocha" />
import {
  canAttackFilter,
  shouldAddCrosshairMeleeTargetV1,
} from "@/client/game/resources/melee_attack_region";
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
