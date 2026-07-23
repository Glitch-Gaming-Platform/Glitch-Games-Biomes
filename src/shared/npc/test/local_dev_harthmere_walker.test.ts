import assert from "assert";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  LOCAL_DEV_WALKER_NPC_TYPE_ID,
  getNpcBehavior,
  maybeIdToNpcType,
} from "@/shared/npc/bikkie";

describe("local-dev Harthmere walker NPC type", () => {
  it("uses native bounded meandering without moving stationary townspeople", () => {
    const stationary = maybeIdToNpcType(LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    const walker = maybeIdToNpcType(LOCAL_DEV_WALKER_NPC_TYPE_ID);

    assert.ok(stationary);
    assert.ok(walker);
    assert.equal(getNpcBehavior(stationary).meander, undefined);
    assert.deepEqual(getNpcBehavior(walker).meander, {
      stayDistanceFromSpawn: 14,
    });
    assert.equal(walker.isPlayerLikeAppearance, true);
    assert.ok((walker.walkSpeed ?? 0) > 0);
    assert.ok((walker.walkSpeed ?? Infinity) < (stationary.runSpeed ?? 0));
  });
});
