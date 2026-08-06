import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  NpcMetadata,
  NpcState,
  Position,
  RigidBody,
  Size,
} from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  getNpcRotateSpeed,
  getNpcRunSpeed,
} from "@/shared/npc/bikkie";
import { SimulatedNpc } from "@/shared/npc/simulated";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import assert from "assert";

function businessCustomerState(
  phase: "entering" | "cancelled",
  progressAtSeconds: number,
  reaction: "neutral" | "payment" = "neutral"
) {
  return {
    version: "harthmere-business-customer-behavior-v1" as const,
    sessionId: "session-1",
    ticketId: "ticket-1",
    outpostId: "outpost_portal_eastgate",
    businessType: "portal_transit_company",
    phase,
    reaction,
    entrance: [0, 0, -4] as [number, number, number],
    queueTarget: [0, 0, 4] as [number, number, number],
    customer: [0, 0, 8] as [number, number, number],
    staff: [0, 0, 11] as [number, number, number],
    departure: [3, 0, -8] as [number, number, number],
    waypoints: [
      [0, 0, -4],
      [0, 0, 4],
    ] as [number, number, number][],
    waypointIndex: 0,
    lastPhaseChangedAtSeconds: 90,
    progressPosition: [0, 0, progressAtSeconds - 100] as [
      number,
      number,
      number,
    ],
    progressAtSeconds,
  };
}

function withBusinessCustomer(
  entity: NonNullable<ReturnType<typeof Npc.from>>,
  phase: "entering" | "cancelled",
  progressAtSeconds: number,
  reaction: "neutral" | "payment" = "neutral"
) {
  const state = deserializeNpcCustomState(entity.npc_state?.data);
  state.businessCustomer = businessCustomerState(
    phase,
    progressAtSeconds,
    reaction
  );
  return {
    ...entity,
    npc_state: NpcState.create({ data: serializeNpcCustomState(state) }),
  };
}

describe("SimulatedNpc external ECS refresh", () => {
  it("refreshes native type and size after a live partial-create view completes", () => {
    const id = 8_812_999_999_999_901 as BiomesId;
    const initial = Npc.from(
      npcEntity(
        {
          id,
          typeId: BikkieIds.dMucker,
          position: [10, 20, 30],
        },
        100
      )
    );
    assert.ok(initial);
    const npc = new SimulatedNpc(initial);
    assert.notEqual(npc.type.id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);

    npc.updateFromExternal({
      ...initial,
      npc_metadata: NpcMetadata.create({
        ...initial.npc_metadata,
        type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      }),
      size: Size.create({ v: [0.75, 1.8, 0.75] }),
    });

    assert.equal(npc.type.id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    assert.equal(getNpcRunSpeed(npc.type), 4.4);
    assert.equal(getNpcRotateSpeed(npc.type), 200);
    assert.deepEqual(npc.size, [0.75, 1.8, 0.75]);
  });

  it("does not rewind newer business route progress from a lagging HFC projection", () => {
    const id = 8_812_999_999_999_902 as BiomesId;
    const base = Npc.from(
      npcEntity(
        {
          id,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(base);
    const initial = Npc.from(withBusinessCustomer(base, "entering", 100));
    assert.ok(initial);
    const npc = new SimulatedNpc(initial);

    npc.setPosition([0, 0, 1]);
    npc.setVelocity([0, 0, 4]);
    const localState = npc.mutableState().businessCustomer!;
    localState.progressPosition = [0, 0, 1];
    localState.progressAtSeconds = 101;
    npc.finish();

    const lagging = withBusinessCustomer(base, "entering", 100, "payment");
    npc.updateFromExternal(lagging);
    assert.deepEqual(npc.position, [0, 0, 1]);
    assert.deepEqual(npc.velocity, [0, 0, 4]);
    assert.equal(npc.state.businessCustomer?.progressAtSeconds, 101);
    assert.deepEqual(npc.state.businessCustomer?.progressPosition, [0, 0, 1]);
    assert.equal(
      npc.state.businessCustomer?.reaction,
      "payment",
      "new external authority fields must still merge"
    );

    const phaseTransition = withBusinessCustomer(
      {
        ...base,
        position: Position.create({ v: [0, 0, 8] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      } as NonNullable<ReturnType<typeof Npc.from>>,
      "cancelled",
      102
    );
    npc.updateFromExternal(phaseTransition);
    assert.deepEqual(npc.position, [0, 0, 8]);
    assert.deepEqual(npc.velocity, [0, 0, 0]);
    assert.equal(npc.state.businessCustomer?.phase, "cancelled");
    assert.equal(npc.state.businessCustomer?.progressAtSeconds, 102);
  });
});
