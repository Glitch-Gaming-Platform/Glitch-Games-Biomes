import { FarmingGrowthPlantTicker } from "@/server/gaia/simulations/farming/plant_growth_ticker";
import { harvestPlantEventHandler } from "@/server/logic/events/handlers/farming";
import { BikkieIds } from "@/shared/bikkie/ids";
import { TriggerState } from "@/shared/ecs/gen/components";
import { HarvestPlantEvent } from "@/shared/ecs/gen/events";
import { EventSerde } from "@/shared/ecs/gen/json_serde";
import {
  readHarthmereNativeSkillTotalXp,
  writeHarthmereNativeSkillTotalXp,
} from "@/shared/harthmere/harthmere_skill_progression";
import { harthmereSkillTotalXpCap } from "@/shared/harthmere/mmo_class_ability_collectibles";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

function fakeHarvestPlant({
  status = "fully_grown",
  seed = BikkieIds.raspberrySeed,
  position = [1, 2, 3],
  planter = generateTestId(),
  harvestCount = 10n,
}: {
  status?: string;
  seed?: number;
  position?: [number, number, number];
  planter?: ReturnType<typeof generateTestId>;
  harvestCount?: bigint;
} = {}) {
  const component = {
    planter,
    status,
    seed,
    player_actions: [] as Array<{ kind: string; timestamp: number }>,
  };
  const container = {
    items: [{ item: { id: BikkieIds.pumpkin }, count: harvestCount }],
  };
  const plant = {
    id: generateTestId(),
    position: () => ({ v: position }),
    staleOk: () => ({ position: () => ({ v: position }) }),
    mutableFarmingPlantComponent: () => component,
    mutableContainerInventory: () => container,
  };
  return { component, container, plant };
}

function fakeHarvestPlayer(position: [number, number, number] = [1, 2, 3]) {
  const triggerState = TriggerState.create();
  return {
    staleOk: () => ({ position: () => ({ v: position }) }),
    mutableTriggerState: () => triggerState,
    triggerState: () => triggerState,
  };
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

  it("queues harvest for fully grown non-tree plants", () => {
    const { component, plant } = fakeHarvestPlant();
    const player = fakeHarvestPlayer();
    harvestPlantEventHandler.apply(
      {
        plant,
        player,
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
    assert.equal(
      readHarthmereNativeSkillTotalXp(player.triggerState(), "farming"),
      12
    );
    assert.equal(
      readHarthmereNativeSkillTotalXp(player.triggerState(), "nature_magic"),
      4
    );
  });

  it("lets the planter harvest their own fully grown non-tree crop", () => {
    const playerId = generateTestId();
    const { component, plant } = fakeHarvestPlant({ planter: playerId });
    harvestPlantEventHandler.apply(
      {
        plant,
        player: fakeHarvestPlayer(),
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

  it("adds the Farming yield benefit before Gaia materializes the native crop drop", () => {
    const { component, container, plant } = fakeHarvestPlant();
    const player = fakeHarvestPlayer();
    writeHarthmereNativeSkillTotalXp(
      player.triggerState(),
      "farming",
      harthmereSkillTotalXpCap("farming")
    );

    harvestPlantEventHandler.apply(
      { plant, player } as any,
      new HarvestPlantEvent({
        id: generateTestId(),
        plant_id: plant.id,
        position: [1, 2, 3],
      }),
      {} as any
    );

    assert.equal(container.items[0].count, 12n);
    assert.equal(component.player_actions[0].kind, "harvest");
  });

  it("lets anyone harvest fully grown non-tree food when the F prompt appears", () => {
    const planterId = generateTestId();
    const harvesterId = generateTestId();
    const { component, plant } = fakeHarvestPlant({ planter: planterId });
    harvestPlantEventHandler.apply(
      {
        plant,
        player: fakeHarvestPlayer(),
      } as any,
      new HarvestPlantEvent({
        id: harvesterId,
        plant_id: plant.id,
        position: [1, 2, 3],
      }),
      {} as any
    );

    assert.equal(component.player_actions.length, 1);
    assert.equal(component.player_actions[0].kind, "harvest");
  });

  it("rejects immature and tree harvests", () => {
    for (const setup of [
      fakeHarvestPlant({ status: "growing" }),
      fakeHarvestPlant({ seed: BikkieIds.oakSeed }),
    ]) {
      assert.throws(() =>
        harvestPlantEventHandler.apply(
          {
            plant: setup.plant,
            player: fakeHarvestPlayer(),
          } as any,
          new HarvestPlantEvent({
            id: generateTestId(),
            plant_id: setup.plant.id,
            position: [1, 2, 3],
          }),
          {} as any
        )
      );
      assert.equal(setup.component.player_actions.length, 0);
    }
  });

  it("accepts a hit voxel that differs from a multi-block plant root", () => {
    const { component, plant } = fakeHarvestPlant({ position: [4, 5, 6] });
    harvestPlantEventHandler.apply(
      {
        plant,
        player: fakeHarvestPlayer([4, 5, 6]),
      } as any,
      new HarvestPlantEvent({
        id: generateTestId(),
        plant_id: plant.id,
        position: [4, 7, 6],
      }),
      {} as any
    );
    assert.equal(component.player_actions.length, 1);
    assert.equal(component.player_actions[0].kind, "harvest");
  });

  it("rejects a fully grown crop when the player is outside pickup range", () => {
    const { component, plant } = fakeHarvestPlant();
    assert.throws(() =>
      harvestPlantEventHandler.apply(
        {
          plant,
          player: fakeHarvestPlayer([100, 2, 100]),
        } as any,
        new HarvestPlantEvent({
          id: generateTestId(),
          plant_id: plant.id,
          position: [1, 2, 3],
        }),
        {} as any
      )
    );

    assert.equal(component.player_actions.length, 0);
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
