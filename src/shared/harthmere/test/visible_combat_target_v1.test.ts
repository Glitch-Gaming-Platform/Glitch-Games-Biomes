/// <reference types="mocha" />
import assert from "assert";
import {
  harthmereLiveModeCombatTargetIdForVisibleActorV1,
  harthmereServerMuckCombatTargetIdForSeedV1,
  harthmereVisibleCombatTargetForActorV1,
} from "@/shared/harthmere/visible_combat_target_v1";
import {
  harthmereGroundedLivestockSeedsInTerritoryV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";

describe("harthmere visible combat target mapping", () => {
  it("maps a seeded live entity id directly to the server combat target id", () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritoryV1()[0];
    assert.ok(seed, "expected at least one grounded muck seed");

    const match = harthmereVisibleCombatTargetForActorV1({
      offset: Number(seed.entityId),
    });

    assert.equal(
      match?.targetId,
      harthmereServerMuckCombatTargetIdForSeedV1(seed)
    );
  });

  it("maps a seeded idOffset directly to the server combat target id", () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritoryV1()[0];
    assert.ok(seed, "expected at least one grounded muck seed");

    const match = harthmereVisibleCombatTargetForActorV1({
      offset: seed.idOffset,
    });

    assert.equal(
      match?.targetId,
      harthmereServerMuckCombatTargetIdForSeedV1(seed)
    );
  });

  it("maps a visible mucker mesh by family and world position when its offset is not seeded", () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritoryV1().find(
      (candidate) => candidate.combatKind !== "hex"
    );
    assert.ok(seed, "expected a mux/mucker seed");

    const match = harthmereVisibleCombatTargetForActorV1({
      offset: 9_999_999,
      label: seed.displayName,
      asset: "townsperson_undead",
      world: seed.position,
    });

    assert.equal(
      match?.targetId,
      harthmereServerMuckCombatTargetIdForSeedV1(seed)
    );
    assert.equal(match?.family, "mucker");
  });

  it("maps a visible hex mesh by label and world position", () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritoryV1().find(
      (candidate) => candidate.combatKind === "hex"
    );
    assert.ok(seed, "expected a hex seed");

    const match = harthmereVisibleCombatTargetForActorV1({
      offset: 9_999_998,
      label: seed.displayName,
      asset: "townsperson_undead",
      world: seed.position,
    });

    assert.equal(
      match?.targetId,
      harthmereServerMuckCombatTargetIdForSeedV1(seed)
    );
    assert.equal(match?.family, "hex");
  });

  it("maps a visible animal mesh by species and world position", () => {
    const seed = harthmereGroundedLivestockSeedsInTerritoryV1().find(
      (candidate) => candidate.species === "cow"
    );
    assert.ok(seed, "expected a cow livestock seed");

    const targetId = harthmereLiveModeCombatTargetIdForVisibleActorV1({
      offset: 9_999_997,
      label: seed.displayName,
      asset: "animal_cow",
      species: "cow",
      world: seed.position,
    });

    assert.equal(targetId, harthmereServerMuckCombatTargetIdForSeedV1(seed));
  });
});
