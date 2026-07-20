// Native ECS always owns crop yield. Deployment flags must never suppress the
// plant container's GrabBag or move the grant into an HTTP/Redis side channel.
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

describe("native harvest drop authority", () => {
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

  it("ignores the retired live-mode override and still creates the native drop", () => {
    process.env.HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE = "1";
    const { ticker, context, cleared, entitiesToCreate } = makeTickerHarness();
    (ticker as any).destroy(context, true);
    assert.equal(
      entitiesToCreate.length,
      1,
      "Harthmere harvest must preserve the ECS GrabBag"
    );
    assert.equal(cleared.value, false);
  });
});
