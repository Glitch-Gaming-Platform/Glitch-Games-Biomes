import { FarmingGrowthPlantTicker } from "@/server/gaia/simulations/farming/plant_growth_ticker";
import { harvestPlantEventHandler } from "@/server/logic/events/handlers/farming";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HarvestPlantEvent } from "@/shared/ecs/gen/events";
import { EventSerde } from "@/shared/ecs/gen/json_serde";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

function fakeHarvestPlant({
  status = "fully_grown",
  seed = BikkieIds.raspberrySeed,
  position = [1, 2, 3],
  planter = generateTestId(),
}: {
  status?: string;
  seed?: number;
  position?: [number, number, number];
  planter?: ReturnType<typeof generateTestId>;
} = {}) {
  const component = {
    planter,
    status,
    seed,
    player_actions: [] as Array<{ kind: string; timestamp: number }>,
  };
  const plant = {
    id: generateTestId(),
    position: () => ({ v: position }),
    mutableFarmingPlantComponent: () => component,
  };
  return { component, plant };
}

describe("harvestPlantEventHandler", () => {
  it("serializes and deserializes harvest plant events", () => {
    const event = new HarvestPlantEvent({
      id: generateTestId(),
      plant_id: generateTestId(),
      position: [1, 2, 3],
    });

    const serialized = EventSerde.serialize(event);
    assert.deepEqual(serialized, {
      kind: "harvestPlantEvent",
      id: event.id,
      plant_id: event.plant_id,
      position: [1, 2, 3],
    });
    assert.deepEqual(EventSerde.deserialize(serialized), event);
  });

  it("queues harvest for fully grown non-tree plants when ACL allows destroy", () => {
    const { component, plant } = fakeHarvestPlant();
    harvestPlantEventHandler.apply(
      {
        plant,
        acl: { can: () => true },
      } as any,
      new HarvestPlantEvent({
        id: generateTestId(),
        plant_id: plant.id,
        position: [1, 2, 3],
      }),
      {} as any
    );

    assert.equal(component.player_actions.length, 1);
    assert.equal(component.player_actions[0].kind, "harvest");
  });

  it("lets the planter harvest their own fully grown non-tree crop in protected terrain", () => {
    const playerId = generateTestId();
    const { component, plant } = fakeHarvestPlant({ planter: playerId });
    harvestPlantEventHandler.apply(
      {
        plant,
        acl: { can: () => false },
      } as any,
      new HarvestPlantEvent({
        id: playerId,
        plant_id: plant.id,
        position: [1, 2, 3],
      }),
      {} as any
    );

    assert.equal(component.player_actions.length, 1);
    assert.equal(component.player_actions[0].kind, "harvest");
  });

  it("rejects immature, tree, stale-position, and ACL-blocked harvests", () => {
    for (const setup of [
      fakeHarvestPlant({ status: "growing" }),
      fakeHarvestPlant({ seed: BikkieIds.oakSeed }),
      fakeHarvestPlant({ position: [4, 5, 6] }),
    ]) {
      harvestPlantEventHandler.apply(
        {
          plant: setup.plant,
          acl: { can: () => true },
        } as any,
        new HarvestPlantEvent({
          id: generateTestId(),
          plant_id: setup.plant.id,
          position: [1, 2, 3],
        }),
        {} as any
      );
      assert.equal(setup.component.player_actions.length, 0);
    }

    const blocked = fakeHarvestPlant();
    harvestPlantEventHandler.apply(
      {
        plant: blocked.plant,
        acl: { can: () => false },
      } as any,
      new HarvestPlantEvent({
        id: generateTestId(),
        plant_id: blocked.plant.id,
        position: [1, 2, 3],
      }),
      {} as any
    );
    assert.equal(blocked.component.player_actions.length, 0);
  });
});

describe("FarmingGrowthPlantTicker harvest action", () => {
  it("consumes queued harvest actions before fully grown plants stop ticking", () => {
    class TestHarvestTicker extends FarmingGrowthPlantTicker {
      destroyedWithBlocks: boolean | undefined;

      override destroy(_context: any, destroyBlocks = false) {
        this.destroyedWithBlocks = destroyBlocks;
      }
    }

    const component = {
      status: "fully_grown",
      player_actions: [{ kind: "harvest", timestamp: 1 }],
    };
    const ticker = new TestHarvestTicker({} as any, { stages: [] } as any);
    const ticked = ticker.tick(
      {
        plant: {
          id: generateTestId(),
          entity: {
            mutableFarmingPlantComponent: () => component,
            position: () => ({ v: [1, 2, 3] }),
          },
        },
        changeBatcher: {},
        timeSeconds: 2,
      } as any,
      1
    );

    assert.equal(ticked, true);
    assert.equal(ticker.destroyedWithBlocks, true);
    assert.deepEqual(component.player_actions, []);
  });
});
