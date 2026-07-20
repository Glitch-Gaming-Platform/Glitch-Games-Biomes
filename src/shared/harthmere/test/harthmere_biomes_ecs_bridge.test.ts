import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  createHarthmereBiomesEcsComponentsProjection,
  createHarthmereBiomesEcsChallenges,
  createHarthmereBiomesEcsHealth,
  createHarthmereBiomesEcsInventory,
  HARTHMERE_GOLD_ECS_CURRENCY_ID,
  harthmereItemIdToBiomesId,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import type { BiomesId } from "@/shared/ids";

describe("Harthmere Biomes ECS bridge", () => {
  it("clamps Harthmere combat values into a valid ECS Health component", () => {
    const projected = createHarthmereBiomesEcsHealth({
      hp: 999,
      maxHp: 240,
      lastDamageAmount: -42,
    });

    assert.equal(projected.component.hp, 240);
    assert.equal(projected.component.maxHp, 240);
    assert.equal(projected.component.lastDamageAmount, -42);
    assert.deepEqual(projected.warnings, []);
  });

  it("projects Harthmere gold into the Biomes ECS currency bag", () => {
    const projected = createHarthmereBiomesEcsInventory({
      gold: 37,
      items: {},
    });
    const currency = projected.component.currencies.get(
      String(HARTHMERE_GOLD_ECS_CURRENCY_ID)
    );

    assert.equal(HARTHMERE_GOLD_ECS_CURRENCY_ID, BikkieIds.bling);
    assert.equal(currency?.item.id, BikkieIds.bling);
    assert.equal(currency?.count, 37n);
    assert.deepEqual(projected.warnings, []);
  });

  it("projects every non-empty Harthmere string as an exact native item id", () => {
    const projected = createHarthmereBiomesEcsInventory({
      gold: 0,
      items: {
        iron_longsword: 1,
        harthmere_only: 1,
        [String(BikkieIds.lumber)]: 4,
      },
    });

    assert.equal(projected.component.items.length, 3);
    assert.ok(
      projected.component.items.some(
        (itemAndCount) =>
          itemAndCount?.item.id === harthmereItemIdToBiomesId("iron_longsword")
      )
    );
    assert.ok(
      projected.component.items.some(
        (itemAndCount) =>
          itemAndCount?.item.id === harthmereItemIdToBiomesId("harthmere_only")
      )
    );
    assert.ok(
      projected.component.items.some(
        (itemAndCount) =>
          itemAndCount?.item.id === BikkieIds.lumber &&
          itemAndCount?.count === 4n
      )
    );
    assert.deepEqual(projected.warnings, []);
  });

  it("projects quest state only through known Biomes challenge ids", () => {
    const welcomeId = 900_001 as BiomesId;
    const projected = createHarthmereBiomesEcsChallenges({
      active: {
        "welcome-to-harthmere": { startedAtMs: 2_000 },
        "unmapped-string-quest": { startedAtMs: 4_000 },
      },
      completed: {
        "b:900002": 6_000,
      },
      questIdMap: {
        "welcome-to-harthmere": welcomeId,
      },
    });

    assert.equal(projected.component.in_progress.has(welcomeId), true);
    assert.equal(projected.component.started_at.get(welcomeId), 2);
    assert.equal(projected.component.complete.has(900_002 as BiomesId), true);
    assert.equal(projected.component.finished_at.get(900_002 as BiomesId), 6);
    assert.equal(projected.warnings.length, 1);
    assert.equal(projected.warnings[0].id, "unmapped-string-quest");
  });

  it("projects a live-mode-shaped Harthmere state as one ECS component set", () => {
    const questId = 900_003 as BiomesId;
    const projected = createHarthmereBiomesEcsComponentsProjection({
      health: { hp: 12, maxHp: 90 },
      inventory: {
        gold: 5,
        items: { [String(BikkieIds.lumber)]: 2, harthmere_only: 1 },
      },
      challenges: {
        active: { "mapped-quest": { startedAtMs: 1_000 } },
        questIdMap: { "mapped-quest": questId },
      },
    });

    assert.equal(projected.health.hp, 12);
    assert.equal(
      projected.inventory.currencies.get(String(BikkieIds.bling))?.count,
      5n
    );
    assert.equal(projected.challenges.in_progress.has(questId), true);
    assert.deepEqual(projected.warnings, []);
  });
});
