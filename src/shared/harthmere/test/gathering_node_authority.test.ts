import assert from "assert";
import {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
  HARTHMERE_GATHERING_NODE_INTERACTION_RADIUS,
  harthmereGatheringAuthorityNode,
  resolveHarthmereGatheringAuthorityAttempt,
} from "../gathering_node_authority";

describe("Harthmere gathering node authority", () => {
  const node = harthmereGatheringAuthorityNode("harthmere_north_iron_vein")!;

  it("keeps the complete authored node catalogue on the server", () => {
    assert.equal(HARTHMERE_GATHERING_AUTHORITY_NODES.length, 29);
    assert.equal(node.requiredTool, "rusty_pickaxe");
  });

  it("rejects unknown, unpositioned, remote, unequipped, and underskilled requests", () => {
    const base = {
      actorPosition: {
        x: node.position[0],
        y: node.position[1],
        z: node.position[2],
      },
      equippedItemIds: [node.requiredTool!],
      professionLevel: node.requiredSkill,
      nowMs: 1_700_000_000_000,
      randomSeed: "actor:request",
    };

    assert.deepEqual(
      resolveHarthmereGatheringAuthorityAttempt({
        ...base,
        nodeId: "missing_node",
      }),
      { ok: false, reason: "unknown_node" }
    );
    assert.deepEqual(
      resolveHarthmereGatheringAuthorityAttempt({
        ...base,
        nodeId: node.id,
        actorPosition: undefined,
      }),
      { ok: false, reason: "actor_position_unverified" }
    );
    assert.deepEqual(
      resolveHarthmereGatheringAuthorityAttempt({
        ...base,
        nodeId: node.id,
        actorPosition: {
          ...base.actorPosition,
          x: node.position[0] + HARTHMERE_GATHERING_NODE_INTERACTION_RADIUS + 1,
        },
      }),
      { ok: false, reason: "node_out_of_range" }
    );
    assert.deepEqual(
      resolveHarthmereGatheringAuthorityAttempt({
        ...base,
        nodeId: node.id,
        equippedItemIds: [],
      }),
      { ok: false, reason: "required_tool_missing:rusty_pickaxe" }
    );
    assert.deepEqual(
      resolveHarthmereGatheringAuthorityAttempt({
        ...base,
        nodeId: node.id,
        professionLevel: 0,
      }),
      { ok: false, reason: "profession_level_too_low:mining:1" }
    );
  });

  it("rolls yields and respawn deterministically from server-owned inputs", () => {
    const input = {
      nodeId: node.id,
      actorPosition: {
        x: node.position[0],
        y: node.position[1],
        z: node.position[2],
      },
      equippedItemIds: [node.requiredTool!],
      professionLevel: node.requiredSkill,
      nowMs: 1_700_000_000_000,
      randomSeed: "actor:request",
    };
    const first = resolveHarthmereGatheringAuthorityAttempt(input);
    const second = resolveHarthmereGatheringAuthorityAttempt(input);
    assert.deepEqual(second, first);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.ok(first.itemDeltas.iron_ore >= 2);
    assert.ok(first.itemDeltas.iron_ore <= 4);
    assert.ok(first.respawnAtMs > input.nowMs);
    assert.ok(first.respawnAtMs <= input.nowMs + 420_000);
  });
});
