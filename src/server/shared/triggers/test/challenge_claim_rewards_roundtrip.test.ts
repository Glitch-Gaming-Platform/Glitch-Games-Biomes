import assert from "assert";
import { ChallengeClaimRewardsTrigger } from "@/server/shared/triggers/leaves/challengeClaimRewards";
import { anItem } from "@/shared/game/item";
import { countOf, createBag } from "@/shared/game/items";
import type { BiomesId } from "@/shared/ids";

describe("ChallengeClaimRewardsTrigger serialization", () => {
  it("preserves rewards, selected return target, and required turn-in items", () => {
    const rewardId = 1445038393184935 as BiomesId;
    const requiredId = 7077725005403292 as BiomesId;
    const targetId = 5995152131921980 as BiomesId;
    const trigger = new ChallengeClaimRewardsTrigger(
      {
        id: 1250712772360777 as BiomesId,
        kind: "challengeClaimRewards",
        name: "Deliver the Water-logged Muck Buster to Doc",
      },
      targetId,
      true,
      [createBag(countOf(rewardId, 1n))],
      [[requiredId, 1]]
    );

    const serialized = trigger.serialize();
    assert.equal(serialized.kind, "challengeClaimRewards");
    assert.equal(serialized.returnNpcTypeId, targetId);
    assert.deepEqual(serialized.itemsToTake, [[requiredId, 1]]);
    assert.equal(
      serialized.rewardsList?.[0]?.get(String(rewardId))?.item.id,
      anItem(rewardId).id
    );

    const roundTripped = ChallengeClaimRewardsTrigger.deserialize(serialized);
    assert.deepEqual(roundTripped.serialize().itemsToTake, [[requiredId, 1]]);
  });
});
