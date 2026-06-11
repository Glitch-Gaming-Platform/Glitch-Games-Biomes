import { RobotHelper } from "@/server/logic/utils/robot";
import {
  ContainerInventory,
  CreatedBy,
  NpcMetadata,
  RobotComponent,
} from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

function legacyRobotInventory(entity: Entity) {
  const delta = new EntityBackedDelta(entity);
  return {
    delta,
    queriedInventory: {
      delta: () => delta,
      inventory: {
        mutableInventory: () => entity.container_inventory!,
        find: () => undefined,
        set: () => {},
      },
    },
  };
}

describe("RobotHelper legacy user robot repair", () => {
  it("backfills missing battery metadata instead of asserting during robot expiry", () => {
    const { delta, queriedInventory } = legacyRobotInventory({
      id: 4589392321734904 as BiomesId,
      created_by: CreatedBy.create({
        id: 8521385202672298 as BiomesId,
        created_at: 0,
      }),
      npc_metadata: NpcMetadata.create({
        type_id: 123 as BiomesId,
      }),
      robot_component: RobotComponent.create({}),
      container_inventory: ContainerInventory.create({ items: [] }),
    } as Entity);

    const robot = RobotHelper.buildFromQueriedRobotInventory(
      queriedInventory as any
    );

    assert.ok(robot);
    assert.equal(robot.isAdminRobot(), false);
    assert.notEqual(
      delta.robotComponent()?.internal_battery_capacity,
      undefined
    );
    assert.notEqual(delta.robotComponent()?.internal_battery_charge, undefined);
    assert.notEqual(delta.robotComponent()?.last_update, undefined);
    assert.notEqual(delta.robotComponent()?.trigger_at, undefined);
  });
});
