import assert from "assert";
import {
  createHarthmereLiveModeBuildingClientSnapshot,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";
import { harthmereGatheringAuthorityNode } from "../gathering_node_authority";
import {
  buildingSystemBlueprintById,
  buildingSystemPlotById,
  createBuildingSystemPropertyRecord,
} from "../building_system";

const NOW = 1_700_000_000_000;

function envelope(
  actorId: string,
  actionKind: HarthmereLiveModeAuthorityEnvelope["actionKind"],
  payload: Record<string, unknown>,
  serverActorPosition?: { x: number; y: number; z: number }
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `${actorId}:${actionKind}:${JSON.stringify(payload)}`,
    idempotencyKey: `${actorId}:${actionKind}:${JSON.stringify(payload)}`,
    actorId,
    actionKind,
    subsystem: "building",
    source: "client_request",
    serverActorPosition,
    serverReceivedAtMs: NOW,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

describe("Harthmere shared-world authority regressions", () => {
  it("does not resurrect deleted world objects from stale actor persistence", () => {
    const stale = defaultHarthmereLiveModeBackendState("stale_actor", NOW);
    stale.inventoryLoot.lootDrops.stale_drop = {
      dropId: "stale_drop",
      sourceKind: "test",
      sourceId: "test",
      position: { x: 0, y: 0, z: 0 },
      itemStacks: { health_potion: 1 },
      instanceIds: [],
      ownerActorIds: ["stale_actor"],
      pickupToken: "stale_token",
      createdAtMs: NOW,
      expiresAtMs: NOW + 60_000,
      status: "available",
      abuseFlags: [],
    };
    stale.placeableWorld.placed.stale_object = {
      objectId: "stale_object",
      itemId: "bench",
      ownerId: "stale_actor",
      position: { x: 1, y: 1, z: 1 },
      rotationDegrees: 0,
      footprint: { width: 1, depth: 1, height: 1 },
      surface: "floor",
      placedAtMs: NOW,
    };
    const cleanShared = createHarthmereLiveModeSharedWorldState(
      defaultHarthmereLiveModeBackendState("world_writer", NOW),
      NOW
    );
    const merged = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      stale,
      cleanShared,
      NOW
    );
    assert.equal(merged.inventoryLoot.lootDrops.stale_drop, undefined);
    assert.equal(merged.placeableWorld.placed.stale_object, undefined);
  });

  it("shares positioned custom drops and rejects remote pickup", () => {
    const ownerId = "drop_owner";
    const claimerId = "drop_claimer";
    const owner = defaultHarthmereLiveModeBackendState(ownerId, NOW);
    owner.inventoryLoot.lootDrops.drop_1 = {
      dropId: "drop_1",
      sourceKind: "npc",
      sourceId: "npc_1",
      position: { x: 10, y: 5, z: 10 },
      itemStacks: { health_potion: 1 },
      instanceIds: [],
      ownerActorIds: [claimerId],
      pickupToken: "pickup_drop_1",
      createdAtMs: NOW,
      expiresAtMs: NOW + 60_000,
      status: "available",
      abuseFlags: [],
    };

    const shared = createHarthmereLiveModeSharedWorldState(owner, NOW);
    const claimer = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      defaultHarthmereLiveModeBackendState(claimerId, NOW),
      shared,
      NOW
    );
    assert.equal(claimer.inventoryLoot.lootDrops.drop_1.status, "available");

    const remote = reduceHarthmereLiveModeBackendState(
      claimer,
      envelope(
        claimerId,
        "request_loot_claim",
        { dropId: "drop_1", pickupToken: "pickup_drop_1" },
        { x: 100, y: 5, z: 100 }
      ),
      NOW
    );
    assert.ok(
      remote.summary.warnings.includes(
        "loot_rejected:pickup_distance_too_large"
      )
    );
    assert.equal(
      remote.state.inventoryLoot.lootDrops.drop_1.status,
      "available"
    );

    const nearby = reduceHarthmereLiveModeBackendState(
      remote.state,
      envelope(
        claimerId,
        "request_loot_claim",
        { dropId: "drop_1", pickupToken: "pickup_drop_1" },
        { x: 10, y: 5, z: 10 }
      ),
      NOW
    );
    assert.equal(nearby.state.inventoryLoot.lootDrops.drop_1.status, "claimed");
    assert.equal(nearby.state.inventory.items.health_potion, 1);

    const ownerAfterClaim = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      owner,
      createHarthmereLiveModeSharedWorldState(nearby.state, NOW),
      NOW
    );
    assert.equal(
      ownerAfterClaim.inventoryLoot.lootDrops.drop_1.status,
      "claimed"
    );
  });

  it("shares gathering-node depletion across actors", () => {
    const node = harthmereGatheringAuthorityNode("harthmere_north_iron_vein")!;
    const position = {
      x: node.position[0],
      y: node.position[1],
      z: node.position[2],
    };
    const firstActor = defaultHarthmereLiveModeBackendState("gather_a", NOW);
    firstActor.inventory.equipment.main_hand = node.requiredTool!;
    const gathered = reduceHarthmereLiveModeBackendState(
      firstActor,
      envelope(
        "gather_a",
        "request_farming_action",
        { operation: "gather_node", nodeId: node.id },
        position
      ),
      NOW
    );
    assert.equal(gathered.state.inventory.items.iron_ore ?? 0, 0);
    const nativeDrop = gathered.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "drop"
    );
    assert.ok(nativeDrop);
    assert.ok((nativeDrop.itemStacks.iron_ore ?? 0) >= 2);
    assert.deepEqual(nativeDrop.ownerActorIds, ["gather_a"]);
    assert.ok(gathered.summary.touchedModels.includes("gathering_nodes"));

    const secondActor = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      defaultHarthmereLiveModeBackendState("gather_b", NOW),
      createHarthmereLiveModeSharedWorldState(gathered.state, NOW),
      NOW
    );
    secondActor.inventory.equipment.main_hand = node.requiredTool!;
    const blocked = reduceHarthmereLiveModeBackendState(
      secondActor,
      envelope(
        "gather_b",
        "request_farming_action",
        { operation: "gather_node", nodeId: node.id },
        position
      ),
      NOW
    );
    assert.ok(
      blocked.summary.warnings.some((warning) =>
        warning.startsWith("gathering_rejected:node_depleted:")
      )
    );
  });

  it("prevents cross-actor plot claims through the shared owner ledger", () => {
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot")!;
    const firstActor = defaultHarthmereLiveModeBackendState("builder_a", NOW);
    firstActor.inventory.gold = 1_000;
    const claimed = reduceHarthmereLiveModeBackendState(
      firstActor,
      envelope("builder_a", "request_property_building_mutation", {
        buildingAction: "claim_plot",
        plotId: plot.plotId,
      }),
      NOW
    );
    assert.equal(claimed.state.building.plotOwners[plot.plotId], "builder_a");

    const secondActor = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      defaultHarthmereLiveModeBackendState("builder_b", NOW),
      createHarthmereLiveModeSharedWorldState(claimed.state, NOW),
      NOW
    );
    secondActor.inventory.gold = 1_000;
    const rejected = reduceHarthmereLiveModeBackendState(
      secondActor,
      envelope("builder_b", "request_property_building_mutation", {
        buildingAction: "claim_plot",
        plotId: plot.plotId,
      }),
      NOW
    );
    assert.ok(
      rejected.summary.warnings.includes(
        "plot_claim_rejected:plot_owned_by_another_actor"
      )
    );
    assert.equal(rejected.state.inventory.gold, 1_000);
  });

  it("moves properties, decorations, and plot ownership to the recipient", () => {
    const ownerId = "property_owner";
    const recipientId = "property_recipient";
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot")!;
    const blueprint = buildingSystemBlueprintById(
      "grove_voxel_cottage_tier_1"
    )!;
    const propertyId = `property_${plot.plotId}`;
    const owner = defaultHarthmereLiveModeBackendState(ownerId, NOW);
    owner.building.plotOwners[plot.plotId] = ownerId;
    owner.building.ownedPlots = [plot.plotId];
    owner.property.owned[propertyId] = createBuildingSystemPropertyRecord({
      propertyId,
      ownerId,
      plot,
      blueprint,
      nowMs: NOW,
    });
    owner.homeDecoration.placed.decoration_1 = {
      decorationId: "decoration_1",
      propertyId,
      ownerId,
      itemId: "bench",
      displayName: "Bench",
      kind: "comfort",
      position: {
        x: plot.bounds.xMin,
        y: plot.groundY + 1,
        z: plot.bounds.zMin,
      },
      rotationDegrees: 0,
      condition: 1,
      installedAtMs: NOW,
      updatedAtMs: NOW,
      powered: true,
    };

    const transferred = reduceHarthmereLiveModeBackendState(
      owner,
      envelope(ownerId, "request_property_building_mutation", {
        buildingAction: "transfer_property",
        propertyId,
        newOwnerId: recipientId,
      }),
      NOW
    );
    assert.equal(
      transferred.state.building.plotOwners[plot.plotId],
      recipientId
    );
    assert.equal(
      transferred.state.homeDecoration.placed.decoration_1.ownerId,
      recipientId
    );

    const recipient = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      defaultHarthmereLiveModeBackendState(recipientId, NOW),
      createHarthmereLiveModeSharedWorldState(transferred.state, NOW),
      NOW
    );
    assert.ok(recipient.building.ownedPlots.includes(plot.plotId));
    assert.equal(recipient.property.owned[propertyId].ownerId, recipientId);
    assert.ok(
      createHarthmereLiveModeBuildingClientSnapshot(recipient)
        .completedProperties[propertyId]
    );
  });
});
