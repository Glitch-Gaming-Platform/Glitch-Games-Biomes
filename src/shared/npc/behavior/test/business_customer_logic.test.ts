import assert from "assert";
import {
  npcGroundWalkingForceCoefficient,
  selectNpcLocomotion,
} from "@/shared/npc/logic";
import {
  HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
  type BusinessCustomerState,
} from "@/shared/npc/behavior/business_customer";
import { businessCustomerTick } from "@/shared/npc/behavior/business_customer_tick";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import { DEFAULT_ENVIRONMENT_PARAMS } from "@/shared/physics/environments";
import { horizontalForceForTargetSpeed } from "@/shared/physics/forces";

function state(
  phase: BusinessCustomerState["phase"]
): BusinessCustomerState {
  return {
    version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
    sessionId: "session",
    ticketId: "ticket",
    outpostId: "outpost",
    businessType: "courier",
    actorEntityId: 42 as any,
    phase,
    reaction: "neutral",
    entrance: [0, 0, 0],
    queueTarget: [4, 0, 4],
    customer: [4, 0, 4],
    staff: [4, 0, 6],
    departure: [0, 0, -10],
    waypoints: [],
    waypointIndex: 0,
    lastPhaseChangedAtSeconds: 1,
  };
}

function npcFor(customer: BusinessCustomerState) {
  const mutable: any = { businessCustomer: customer };
  return {
    state: mutable,
    position: [4, 0, 4],
    mutableState: () => mutable,
  } as any;
}

describe("Anima business customer locomotion", () => {
  it("gives business routes priority over schedules, meander, and escort", () => {
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: true,
        hasActiveSchedule: true,
        hasChaseAttack: false,
        hasAttackTarget: false,
        hasBusinessCustomerAssignment: true,
        hasEscortAssignment: true,
        canMeander: true,
        canSocialize: true,
      }),
      "businessCustomer"
    );
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: false,
        hasActiveSchedule: false,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasBusinessCustomerAssignment: true,
        canMeander: false,
        canSocialize: false,
      }),
      "chaseAttack"
    );
  });

  it("faces the player while serving and holds the counter position", () => {
    const customer = state("serving");
    const npc = npcFor(customer);
    const result = businessCustomerTick(
      {
        resources: {
          get: () => ({ position: { v: [8, 0, 4] } }),
        },
      } as any,
      npc,
      10
    );
    assert.equal(result.forwardSpeed, 0);
    assert.equal(result.phase, "serving");
    assert.ok(Number.isFinite(npc.state.rotateTarget));
  });

  it("advances an arrived entry route into service without teleporting", () => {
    const customer = state("entering");
    const npc = npcFor(customer);
    const result = businessCustomerTick({ resources: {} } as any, npc, 10);
    assert.equal(result.forwardSpeed, 0);
    assert.equal(result.phase, "serving");
    assert.equal(customer.phase, "serving");
    assert.equal(customer.lastPhaseChangedAtSeconds, 10);
  });

  it("converts the authored customer pace into a ground-physics force", () => {
    const forwardSpeed = 4.4 * 0.72;
    assert.equal(
      npcGroundWalkingForceCoefficient({
        locomotion: "businessCustomer",
        fightSpeedBoostEligible: false,
        forwardSpeed,
      }),
      horizontalForceForTargetSpeed(
        forwardSpeed,
        DEFAULT_ENVIRONMENT_PARAMS
      )
    );
    assert(
      npcGroundWalkingForceCoefficient({
        locomotion: "businessCustomer",
        fightSpeedBoostEligible: false,
        forwardSpeed,
      }) > forwardSpeed
    );
  });

  it("survives the native npc_state serialization round trip", () => {
    const encoded = serializeNpcCustomState({
      businessCustomer: state("departing"),
    });
    const decoded = deserializeNpcCustomState(encoded).businessCustomer!;
    assert.equal(decoded.phase, "departing");
    assert.equal(decoded.ticketId, "ticket");
    assert.deepEqual(decoded.departure, [0, 0, -10]);
  });
});
