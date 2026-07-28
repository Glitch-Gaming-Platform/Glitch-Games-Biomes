import {
  HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER,
  createHarthmereServerMuckCombatEntitySnapshots,
} from "@/shared/harthmere/live_mode_backend";
import {
  HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS,
  HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS,
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
  HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS,
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS,
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_TERRAIN_PROBE_REVISION,
  HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS,
  HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntityIsOpenWildsMixedGroup,
  harthmereLiveEntityIsTownLivestock,
  harthmereOpenWildsMixedGroupPositionIsValid,
  harthmereOpenWildsTerrainFeetYForOffset,
} from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP } from "@/shared/harthmere/generated/production_terrain_placement_map";
import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE,
  MIXED_CREATURE_GROUP_ALERT_RADIUS,
} from "@/shared/npc/behavior/chase_attack";
import {
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  isHarthmereExtensionWorldPosition,
} from "@/shared/harthmere/world_extension";
import assert from "assert";

const SPECIES = ["cow", "sheep", "rabbit"] as const;

describe("Muck-area wildlife (cows, sheep, rabbits)", () => {
  it("seeds every species across multiple muck areas", () => {
    const byAreaSpecies = new Map<string, number>();
    const speciesSeen = new Set<string>();
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS) {
      speciesSeen.add(String(seed.species));
      const key = `${seed.areaId}:${seed.species}`;
      byAreaSpecies.set(key, (byAreaSpecies.get(key) ?? 0) + 1);
    }
    for (const species of SPECIES) {
      assert.ok(speciesSeen.has(species), `expected ${species} seeds`);
    }
    assert.ok(byAreaSpecies.size >= 12, "expected wildlife across many areas");
  });

  it("adds the requested guarded herds across four new map locations", () => {
    assert.equal(HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.length, 4);
    assert.equal(HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS.length, 20);
    const speciesCounts = Object.fromEntries(
      SPECIES.map((species) => [
        species,
        HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS.filter(
          (seed) => seed.species === species
        ).length,
      ])
    );
    assert.deepEqual(speciesCounts, { cow: 4, sheep: 6, rabbit: 10 });
    for (const location of HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS) {
      const animals = HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS.filter(
        (seed) => seed.areaId === location.areaId
      );
      assert.equal(animals.length, 5, `${location.areaId} animal count`);
      for (const animal of animals) {
        if (
          location.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID
        ) {
          // HARTHMERE_MUCK_PACK_RELOCATION (2026-07-28): this pocket used to sit
          // 25 blocks from the centre of the Watchtower Muck Clearing, putting a
          // second four-Mucker guard pack inside the clearing the player is sent
          // to for their first fight. Herd and guards moved out together, so this
          // one pocket is deliberately OUTSIDE Muck territory — and must be, or
          // the open-Wilds gate would drop it.
          assert.ok(
            !muckMonsterAreaForPosition(animal.position, 1.5),
            `${animal.seedId} must be clear of Muck territory`
          );
          assert.ok(
            harthmereOpenWildsMixedGroupPositionIsValid(animal.position),
            `${animal.seedId} must be a valid open-Wilds position`
          );
          continue;
        }
        assert.ok(
          muckMonsterAreaForPosition(animal.position, 1.5),
          `${animal.seedId} must remain in Muck territory`
        );
      }
    }
  });

  it("keeps every guarded herd and guard pack inside one native group-alert envelope", () => {
    const animals = harthmereGroundedLivestockSeedsInTerritory();
    const monsters = harthmereGroundedMuckMonsterSeedsInTerritory();
    for (const location of HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS) {
      const encounter = [...animals, ...monsters].filter(
        (seed) => seed.areaId === location.areaId
      );
      assert.equal(encounter.length, 9, `${location.areaId} encounter size`);
      for (const source of encounter) {
        for (const responder of encounter) {
          if (source.entityId === responder.entityId) {
            continue;
          }
          const horizontalDistance = Math.hypot(
            source.position[0] - responder.position[0],
            source.position[2] - responder.position[2]
          );
          const verticalDistance = Math.abs(
            source.position[1] - responder.position[1]
          );
          assert.ok(
            horizontalDistance <= MIXED_CREATURE_GROUP_ALERT_RADIUS,
            `${source.seedId} is ${horizontalDistance.toFixed(2)}m from ${
              responder.seedId
            }`
          );
          assert.ok(
            verticalDistance <=
              MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE,
            `${source.seedId} is ${verticalDistance.toFixed(
              2
            )}m vertically from ${responder.seedId}`
          );
        }
      }
    }
  });

  it("adds four exact open-Wilds groups on production-sampled land away from existing encounters", () => {
    assert.equal(
      HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.length,
      4
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS.length,
      28
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_MONSTER_SEEDS.length,
      24
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_OPEN_WILDS_TERRAIN_PROBE_REVISION,
      "biomes-node-vnet--0000193"
    );

    const outdoorPoints = new Set(
      HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.outdoorSpawnPoints.map(
        ({ position }) => position.join(":")
      )
    );
    const existingSeeds = [
      ...HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.filter(
        (seed) => !harthmereLiveEntityIsOpenWildsMixedGroup(seed)
      ),
    ];

    for (const location of HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS) {
      assert.ok(
        outdoorPoints.has(location.center.join(":")),
        `${location.areaId} center must be a production-scanned outdoor land point`
      );
      const animals =
        HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS.filter(
          (seed) => seed.areaId === location.areaId
        );
      const monsters =
        HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_MONSTER_SEEDS.filter(
          (seed) => seed.areaId === location.areaId
        );
      assert.deepEqual(
        Object.fromEntries(
          SPECIES.map((species) => [
            species,
            animals.filter((seed) => seed.species === species).length,
          ])
        ),
        { cow: 1, sheep: 2, rabbit: 4 }
      );
      assert.equal(
        monsters.filter((seed) => seed.combatKind === "mux").length,
        5
      );
      assert.equal(
        monsters.filter((seed) => seed.combatKind === "hex").length,
        1
      );

      const encounter = [...animals, ...monsters];
      assert.equal(encounter.length, 13);
      for (const seed of encounter) {
        assert.equal(
          seed.position[1],
          harthmereOpenWildsTerrainFeetYForOffset(seed.idOffset),
          `${seed.seedId} must use its individual production-probed feet Y`
        );
        assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(seed.position));
        assert.equal(muckMonsterAreaForPosition(seed.position, 1.5), undefined);
        assert.ok(
          seed.position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
          `${seed.seedId} must remain outside additive Harthmere`
        );
        const nearestExisting = Math.min(
          ...existingSeeds.map((existing) =>
            Math.hypot(
              seed.position[0] - existing.position[0],
              seed.position[2] - existing.position[2]
            )
          )
        );
        assert.ok(
          nearestExisting >= 70,
          `${seed.seedId} is only ${nearestExisting.toFixed(
            2
          )}m from an existing creature area`
        );
      }
      for (const source of encounter) {
        for (const responder of encounter) {
          assert.ok(
            Math.hypot(
              source.position[0] - responder.position[0],
              source.position[2] - responder.position[2]
            ) <= MIXED_CREATURE_GROUP_ALERT_RADIUS
          );
          assert.ok(
            Math.abs(source.position[1] - responder.position[1]) <=
              MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE
          );
        }
      }
    }

    for (
      let index = 0;
      index < HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.length;
      index += 1
    ) {
      for (
        let otherIndex = index + 1;
        otherIndex <
        HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.length;
        otherIndex += 1
      ) {
        const left =
          HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS[index];
        const right =
          HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS[otherIndex];
        assert.ok(
          Math.hypot(
            left.center[0] - right.center[0],
            left.center[2] - right.center[2]
          ) >= 200,
          `${left.areaId} overlaps ${right.areaId}`
        );
      }
    }
  });

  it("grounds original-map wildlife on hills and keeps a separate Harthmere herd", () => {
    const grounded = harthmereGroundedLivestockSeedsInTerritory();
    assert.equal(grounded.length, HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS.length);
    assert.equal(HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS.length, 12);
    assert.equal(HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS.length, 44);
    const wildElevations = new Set<number>();
    for (const seed of grounded) {
      if (harthmereLiveEntityIsTownLivestock(seed)) {
        assert.equal(seed.position[1], HARTHMERE_EXTENSION_FEET_Y);
        assert.ok(isHarthmereExtensionWorldPosition(seed.position));
      } else if (harthmereLiveEntityIsOpenWildsMixedGroup(seed)) {
        wildElevations.add(seed.position[1]);
        assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(seed.position));
        assert.equal(muckMonsterAreaForPosition(seed.position, 1.5), undefined);
      } else {
        wildElevations.add(seed.position[1]);
        assert.ok(seed.position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X);
        assert.ok(
          muckMonsterAreaForPosition(seed.position, 1.5),
          `${seed.seedId} is not inside a muck area`
        );
      }
    }
    assert.ok(wildElevations.size > 5, "expected varied original-map hills");
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
