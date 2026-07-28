// HARTHMERE_ESCORT — scheduler-to-Anima integration.
//
// Proves the ownership split the audit asked for: a scheduler ASSIGNS escort
// state and nothing else, and Anima executes it. The two regressions guarded here
// are the ones that made the committed jobs-board escort structurally unable to
// fight: it rebuilt the whole companion entity every second, and it hard-coded
// non-combatant combat fields into the reconstructed snapshot.

import assert from "assert";

import {
  JOBS_BOARD_ESCORT_ASSIGNMENT_PREFIX,
  JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY,
  buildHarthmereEscortCompanionNpcProposedChanges,
} from "@/server/harthmere/escort_companion_npc_ecs";
import {
  CH1_ESCORT_ASSIGNMENT_PREFIX,
  ch1EscortAssignmentFor,
  ch1EscortAssignmentIsCurrent,
} from "@/server/harthmere/ch1_escort_scheduler";
import type { HarthmereEscortCompanion } from "@/shared/harthmere/mmo_jobs_board_authority";
import type { BiomesId } from "@/shared/ids";
import { buildEscortState } from "@/shared/npc/behavior/escort";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

const id = (value: number) => value as unknown as BiomesId;
const LEADER = id(700);
const COMPANION = id(800);

function companion(
  overrides: Partial<HarthmereEscortCompanion> = {}
): HarthmereEscortCompanion {
  return {
    jobId: "job-1",
    companionId: "companion-1",
    entityId: COMPANION,
    actorId: "actor-1",
    actorEntityId: LEADER,
    displayName: "Wren",
    status: "following",
    position: { x: 10, y: 35, z: -400 },
    destination: { x: 60, y: 40, z: -410 },
    updatedAtMs: 0,
    ...overrides,
  } as unknown as HarthmereEscortCompanion;
}

function escortOf(change: { entity?: { npc_state?: { data?: Uint8Array } } }) {
  return deserializeNpcCustomState(change.entity?.npc_state?.data).escort;
}

describe("escort: jobs-board assignment", () => {
  it("creates a companion carrying a complete escort assignment", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      nowSeconds: 0,
    }) as any[];
    assert.equal(change.kind, "create");
    const escort = escortOf(change);
    assert.equal(escort?.leaderId, LEADER);
    assert.equal(escort?.combatPolicy, JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY);
    assert.equal(escort?.status, "following");
    assert.deepEqual(escort?.destination, [60, 40, -410]);
    assert.equal(
      escort?.assignmentId,
      `${JOBS_BOARD_ESCORT_ASSIGNMENT_PREFIX}:job-1`
    );
  });

  it("REGRESSION: an existing companion is PATCHED, never rebuilt wholesale", () => {
    // The old scheduler re-emitted the entire entity once a second — position,
    // health, appearance, dialog — from live-mode Redis. That is precisely why
    // the escort had to be a hard-coded non-combatant: any projection would have
    // clobbered the health, velocity, target, and Anima state that combat
    // produces, and the position was never terrain-grounded either.
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      existingIds: new Set([COMPANION]),
      nowSeconds: 0,
    }) as any[];
    assert.equal(change.kind, "update");
    assert.deepEqual(Object.keys(change.entity).sort(), ["id", "npc_state"]);
    assert.equal(change.entity.position, undefined);
    assert.equal(change.entity.health, undefined);
  });

  it("REGRESSION: merges into Anima's own live state instead of resetting it", () => {
    const existing = serializeNpcCustomState({
      escort: {
        ...buildEscortState({ leaderId: LEADER, combatPolicy: "defend_self" }),
        status: "fighting",
        pathFailingSinceSeconds: 42,
      },
      chaseAttack: { attackTarget: id(999) },
    });
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      existingIds: new Set([COMPANION]),
      existingNpcState: new Map([[COMPANION, existing]]),
      nowSeconds: 0,
    }) as any[];
    const decoded = deserializeNpcCustomState(change.entity.npc_state.data);
    // Anima keeps status and its recovery bookkeeping...
    assert.equal(decoded.escort?.status, "fighting");
    assert.equal(decoded.escort?.pathFailingSinceSeconds, 42);
    // ...and unrelated Anima state survives the patch entirely.
    assert.equal(decoded.chaseAttack?.attackTarget, id(999));
    // ...while the scheduler still owns the policy.
    assert.equal(
      decoded.escort?.combatPolicy,
      JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY
    );
  });

  it("emits no ECS write when the serialized assignment is already current", () => {
    const created = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      nowSeconds: 0,
    })[0] as any;
    const changes = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      existingIds: new Set([COMPANION]),
      existingNpcState: new Map([[COMPANION, created.entity.npc_state.data]]),
      nowSeconds: 1,
    });
    assert.deepEqual(changes, []);
  });

  it("allows a contract to raise the policy without touching the reducer", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion()],
      nowSeconds: 0,
      combatPolicyFor: () => "defend_self",
    }) as any[];
    assert.equal(escortOf(change)?.combatPolicy, "defend_self");
  });

  it("keeps the default civilian policy for a generic board posting", () => {
    // `fight_muck` belongs to authored story escorts, not to a posting a player
    // can accept repeatedly.
    assert.equal(JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY, "noncombatant");
  });

  it("deletes a companion once the job is no longer active", () => {
    const changes = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion({ status: "failed" as never })],
      existingIds: new Set([COMPANION]),
      nowSeconds: 0,
    }) as any[];
    assert.deepEqual(changes, [{ kind: "delete", id: COMPANION }]);
  });

  it("emits nothing for an inactive companion that was never created", () => {
    assert.deepEqual(
      buildHarthmereEscortCompanionNpcProposedChanges({
        companions: [companion({ status: "completed" as never })],
        nowSeconds: 0,
      }),
      []
    );
  });
});

describe("escort: Chapter 1 assignments", () => {
  it("gives Dr. Sorrel the combat-capable policy the audit found missing", () => {
    assert.equal(
      ch1EscortAssignmentFor("Dr. Nadia Sorrel", 0).combatPolicy,
      "fight_muck"
    );
  });

  it("lets Iris defend the player without starting fights", () => {
    assert.equal(
      ch1EscortAssignmentFor("Iris Fen", 0).combatPolicy,
      "defend_leader"
    );
  });

  it("keeps Marrow to self-defence", () => {
    assert.equal(
      ch1EscortAssignmentFor("Marrow", 1).combatPolicy,
      "defend_self"
    );
  });

  it("gives the desert pair distinct formation slots so they do not stack", () => {
    assert.notEqual(
      ch1EscortAssignmentFor("Iris Fen", 0).formationSlot,
      ch1EscortAssignmentFor("Marrow", 1).formationSlot
    );
  });

  it("REGRESSION: an unchanged assignment emits no ECS write", () => {
    // A scheduler that writes on every tick eventually races Anima's own state
    // updates. The previous implementation rewrote entities every second.
    const desired = buildEscortState({
      leaderId: LEADER,
      combatPolicy: "fight_muck",
      formationSlot: 0,
      assignmentId: `${CH1_ESCORT_ASSIGNMENT_PREFIX}:ch1_dungeon_winter:${COMPANION}`,
    });
    assert.equal(
      ch1EscortAssignmentIsCurrent({ ...desired, status: "fighting" }, desired),
      true
    );
  });

  it("rewrites when the leader, policy, slot, or assignment changes", () => {
    const desired = buildEscortState({
      leaderId: LEADER,
      combatPolicy: "fight_muck",
      formationSlot: 0,
      assignmentId: "a",
    });
    assert.equal(ch1EscortAssignmentIsCurrent(undefined, desired), false);
    assert.equal(
      ch1EscortAssignmentIsCurrent({ ...desired, leaderId: id(701) }, desired),
      false
    );
    assert.equal(
      ch1EscortAssignmentIsCurrent(
        { ...desired, combatPolicy: "noncombatant" },
        desired
      ),
      false
    );
    assert.equal(
      ch1EscortAssignmentIsCurrent({ ...desired, formationSlot: 3 }, desired),
      false
    );
    assert.equal(
      ch1EscortAssignmentIsCurrent({ ...desired, assignmentId: "b" }, desired),
      false
    );
  });
});

describe("escort: state round-trips through npc_state", () => {
  it("survives serialization without losing any field", () => {
    const state = buildEscortState({
      leaderId: LEADER,
      combatPolicy: "fight_muck",
      followDistance: 3.5,
      formationSlot: 2,
      leashDistance: 60,
      destination: [1, 2, 3],
      assignmentId: "round-trip",
    });
    assert.deepEqual(
      deserializeNpcCustomState(serializeNpcCustomState({ escort: state }))
        .escort,
      state
    );
  });

  it("REGRESSION: state written before escorts existed still parses", () => {
    // Every new component is optional, so a pre-existing serialized NPC reads as
    // ungrouped, level 1, and unassigned rather than failing to parse.
    const legacy = serializeNpcCustomState({
      rotateTarget: 1.2,
      chaseAttack: { attackTime: 5 },
    });
    const decoded = deserializeNpcCustomState(legacy);
    assert.equal(decoded.escort, undefined);
    assert.equal(decoded.creatureGroup, undefined);
    assert.equal(decoded.creatureProgression, undefined);
    assert.equal(decoded.rotateTarget, 1.2);
    assert.equal(decoded.chaseAttack?.attackTime, 5);
  });
});
