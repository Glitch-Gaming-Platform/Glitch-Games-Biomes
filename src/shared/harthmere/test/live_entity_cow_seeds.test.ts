import {
  HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER,
  createHarthmereServerMuckCombatEntitySnapshots,
} from "@/shared/harthmere/live_mode_backend";
import {
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "@/shared/harthmere/live_entity_production_seed";
import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  getHarthmereProductionPlacementByKey,
  harthmereProductionPlacementKey,
} from "@/shared/harthmere/production_terrain_placement_map";
import assert from "assert";

const SPECIES = ["cow", "sheep", "rabbit"] as const;

describe("Muck-area wildlife (cows, sheep, rabbits)", () => {
  it("seeds every species across multiple muck areas, >=2 per area", () => {
    const byAreaSpecies = new Map<string, number>();
    const speciesSeen = new Set<string>();
    for (const seed of HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS) {
      speciesSeen.add(String(seed.species));
      const key = `${seed.areaId}:${seed.species}`;
      byAreaSpecies.set(key, (byAreaSpecies.get(key) ?? 0) + 1);
    }
    for (const species of SPECIES) {
      assert.ok(speciesSeen.has(species), `expected ${species} seeds`);
    }
    for (const [key, count] of byAreaSpecies) {
      assert.ok(count >= 2, `${key} should have >=2 animals`);
    }
  });

  it("grounds every animal inside a real muck territory", () => {
    const grounded = harthmereGroundedLivestockSeedsInTerritory();
    assert.ok(grounded.length >= 16, "expected the full wildlife herd");
    for (const seed of grounded) {
      const placement = getHarthmereProductionPlacementByKey(
        harthmereProductionPlacementKey("live_livestock", seed.seedId)
      );
      assert.ok(placement, `${seed.seedId} is missing a production placement`);
      assert.deepEqual(seed.position, placement.recommendedPosition);
      assert.ok(
        muckMonsterAreaForPosition(seed.position, 1.5),
        `${seed.seedId} is not inside a muck area`
      );
    }
  });

  it("routes each species label to its own mesh", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Muckmeadow Cow 1"),
      "npcs/cow"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Muckmeadow Sheep 3"),
      "npcs/sheep"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Muckmeadow Rabbit 5"),
      "npcs/rabbit"
    );
  });

  it("makes wildlife passive, attackable, retaliating, and meat-dropping", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshots(1000);
    const animals = Object.values(snapshots).filter(
      (entity) => (entity as { entityKind?: string }).entityKind === "animal"
    ) as Array<Record<string, any>>;
    assert.ok(animals.length >= 16, "expected wildlife combat snapshots");
    for (const animal of animals) {
      assert.equal(animal.isHostile, false);
      assert.equal(animal.isAttackable, true);
      assert.equal(animal.retaliatesWhenAttacked, true);
      assert.equal(animal.aggroRange, 0);
      assert.ok(
        Number(animal.lootDrops?.raw_meat ?? 0) >= 1,
        "every animal drops raw meat"
      );
    }
    // Muckers stay hostile so the world isn't pacified.
    const hostiles = Object.values(snapshots).filter(
      (entity) => (entity as { isHostile?: boolean }).isHostile === true
    );
    assert.ok(hostiles.length > 0, "muckers should remain hostile");
  });

  it("scales HP, hit, meat, and XP with body size (cow > sheep > rabbit)", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshots(1000);
    const bySpecies = (species: string) =>
      Object.values(snapshots).find(
        (entity) => (entity as { species?: string }).species === species
      ) as Record<string, any> | undefined;
    const cow = bySpecies("cow");
    const sheep = bySpecies("sheep");
    const rabbit = bySpecies("rabbit");
    assert.ok(cow && sheep && rabbit, "expected one of each species");

    // Exact tuned values.
    assert.equal(cow!.maxHp, 270);
    assert.equal(sheep!.maxHp, 110);
    assert.equal(rabbit!.maxHp, 22);

    assert.equal(cow!.lootDrops.raw_meat, 12);
    assert.equal(sheep!.lootDrops.raw_meat, 4);
    assert.equal(rabbit!.lootDrops.raw_meat, 1);

    assert.equal(cow!.attackDamage, 66);
    assert.equal(sheep!.attackDamage, 30);
    assert.equal(rabbit!.attackDamage, 15);

    assert.equal(cow!.killXp, 50);
    assert.equal(sheep!.killXp, 20);
    assert.equal(rabbit!.killXp, 5);

    // Monotonic by size as a guard against future edits.
    assert.ok(cow!.maxHp > sheep!.maxHp && sheep!.maxHp > rabbit!.maxHp);
    assert.ok(
      cow!.attackDamage > sheep!.attackDamage &&
        sheep!.attackDamage > rabbit!.attackDamage
    );
    assert.ok(
      cow!.bodyRadius > rabbit!.bodyRadius,
      "cow hitbox should be larger than rabbit"
    );
  });

  it("boosts Muckers and Hexes to the five-times production threat tier", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshots(1000);
    const seeds = harthmereGroundedMuckMonsterSeedsInTerritory();
    const firstMucker = seeds.find((seed) => seed.combatKind !== "hex");
    const firstHex = seeds.find((seed) => seed.combatKind === "hex");
    assert.ok(firstMucker && firstHex, "expected both mucker and hex seeds");

    const mucker = snapshots[
      `server-muck-combat:${firstMucker.seedId}:${firstMucker.idOffset}`
    ] as Record<string, any>;
    const hex = snapshots[
      `server-muck-combat:${firstHex.seedId}:${firstHex.idOffset}`
    ] as Record<string, any>;

    assert.equal(
      mucker.maxHp,
      (firstMucker.combatHp ?? 110) * HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER
    );
    assert.equal(
      hex.maxHp,
      (firstHex.combatHp ?? 120) * HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER
    );
    assert.ok(mucker.attackDamage >= 70);
    assert.ok(hex.attackDamage >= 90);
  });
});
