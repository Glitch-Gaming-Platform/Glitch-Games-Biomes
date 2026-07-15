// (foraging fix F-B, 2026-07-14): proves the gaia growth ticker suppresses the
// ECS yield-drop for a fully-grown harvest ONLY when the Harthmere live-mode
// deployment is authoritative (so live-mode is the single grant), and keeps the
// normal biomes drop otherwise.
import { FarmingGrowthPlantTicker } from "@/server/gaia/simulations/farming/plant_growth_ticker";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

function makeTickerHarness() {
  const cleared: { value: boolean } = { value: false };
  const entitiesToCreate: unknown[] = [];

  class TestTicker extends FarmingGrowthPlantTicker {
    // Neutralize terrain access — the drop path we exercise lives after this.
    override getGrowthTransition(): any {
      return { destroy() {} };
    }
    override terrainModifier(): any {
      return { destroy() {}, relinquish() {}, delete() {} };
    }
  }

  const ticker = new TestTicker({} as any, { stages: [] } as any);
  const context = {
    plant: {
      id: generateTestId(),
      entitiesToCreate,
      entity: {
        mutableFarmingPlantComponent: () => ({
          stage: 5,
          status: "fully_grown",
        }),
        position: () => ({ v: [10, 64, 10] }),
        mutableContainerInventory: () => ({
          items: [{ item: { id: 1 }, count: 3 }],
        }),
        clearContainerInventory: () => {
          cleared.value = true;
        },
      },
    },
  };
  return { ticker, context, cleared, entitiesToCreate };
}

describe("Harthmere harvest drop suppression (F-B)", () => {
  afterEach(() => {
    delete process.env.HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE;
    delete process.env.GLITCH_RUNTIME;
  });

  it("drops the container yield in a plain biomes deployment", () => {
    const { ticker, context, cleared, entitiesToCreate } = makeTickerHarness();
    (ticker as any).destroy(context, true);
    assert.equal(
      entitiesToCreate.length,
      1,
      "biomes harvest should create a world drop"
    );
    assert.equal(cleared.value, false);
  });

  it("suppresses the drop and clears the container when Harthmere live-mode is authoritative", () => {
    process.env.HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE = "1";
    const { ticker, context, cleared, entitiesToCreate } = makeTickerHarness();
    (ticker as any).destroy(context, true);
    assert.equal(
      entitiesToCreate.length,
      0,
      "Harthmere harvest must not double-grant via an ECS drop"
    );
    assert.equal(
      cleared.value,
      true,
      "the plant container should be cleared so no stale yield lingers"
    );
  });
});
