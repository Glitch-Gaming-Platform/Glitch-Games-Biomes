import {
  createHarthmereServerMuckCombatEntitySnapshotsV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS_V1,
  harthmereGroundedLivestockSeedsInTerritoryV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { harthmereMuckCreatureAssetKeyForLabelV1 } from "@/shared/harthmere/muck_creature_assets_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";
import assert from "assert";

const SPECIES = ["cow", "sheep", "rabbit"] as const;

describe("Muck-area wildlife (cows, sheep, rabbits)", () => {
  it("seeds every species across multiple muck areas, >=2 per area", () => {
    const byAreaSpecies = new Map<string, number>();
    const speciesSeen = new Set<string>();
    for (const seed of HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS_V1) {
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
    const grounded = harthmereGroundedLivestockSeedsInTerritoryV1();
    assert.ok(grounded.length >= 16, "expected the full wildlife herd");
    for (const seed of grounded) {
      assert.ok(
        muckMonsterAreaForPositionV1(seed.position, 1.5),
        `${seed.seedId} is not inside a muck area`
      );
    }
  });

  it("routes each species label to its own mesh", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Muckmeadow Cow 1"),
      "npcs/cow"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Muckmeadow Sheep 3"),
      "npcs/sheep"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Muckmeadow Rabbit 5"),
      "npcs/rabbit"
    );
  });

  it("makes wildlife passive, attackable, retaliating, and meat-dropping", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshotsV1(1000);
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
    const snapshots = createHarthmereServerMuckCombatEntitySnapshotsV1(1000);
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
});
