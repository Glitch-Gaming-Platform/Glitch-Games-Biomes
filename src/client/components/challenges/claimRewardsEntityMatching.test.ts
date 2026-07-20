import { claimRewardsStepMatchesEntity } from "@/client/components/challenges/helpers";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("native claim-rewards entity matching", () => {
  const entityId = 1001 as BiomesId;
  const npcTypeId = 2002 as BiomesId;
  const placeableItemId = 3003 as BiomesId;
  const resources = {
    get(path: string, id: BiomesId) {
      assert.equal(id, entityId);
      if (path === "/ecs/c/npc_metadata") {
        return { type_id: npcTypeId };
      }
      if (path === "/ecs/c/placeable_component") {
        return { item_id: placeableItemId };
      }
      return undefined;
    },
  } as any;

  it("matches concrete entity, NPC type, and placeable item ids", () => {
    assert.equal(
      claimRewardsStepMatchesEntity(resources, entityId, entityId),
      true
    );
    assert.equal(
      claimRewardsStepMatchesEntity(resources, entityId, npcTypeId),
      true
    );
    assert.equal(
      claimRewardsStepMatchesEntity(resources, entityId, placeableItemId),
      true
    );
    assert.equal(
      claimRewardsStepMatchesEntity(resources, entityId, 4004 as BiomesId),
      false
    );
  });
});
