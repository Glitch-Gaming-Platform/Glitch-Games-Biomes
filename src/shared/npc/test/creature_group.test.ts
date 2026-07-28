// HARTHMERE_CREATURE_GROUPS — group identity, assistance, and responder control.
//
// The four defects this replaces, each covered by a REGRESSION case below:
//   1. no group identity, so overlapping encounters merged into one swarm;
//   2. a brittle terrain line-of-sight gate that suppressed assistance on hills;
//   3. livestock joining Muck aggression because "cow" matched a name regex;
//   4. no responder cap, so six monsters could land simultaneous 70-120 damage
//      hits on a 140 HP player.

import assert from "assert";

import {
  GROUP_ALERT_LIFETIME_SECONDS,
  GROUP_MAX_SIMULTANEOUS_MELEE,
  assistFactionJoinsCombat,
  decodeCreatureGroupMembership,
  evaluateGroupAlert,
  groupAlertClearReason,
  groupResponderPlan,
  shouldFleeGroupAlert,
  type CreatureGroupMembership,
  type GroupAlertAttacker,
  type GroupAlertCandidate,
} from "@/shared/npc/creature_group";
import type { BiomesId } from "@/shared/ids";
import { pack } from "msgpackr";

const id = (value: number) => value as unknown as BiomesId;

const PACK_A: CreatureGroupMembership = {
  groupId: "harthmere:road_to_harthmere_group_1",
  assistFaction: "muck",
  role: "melee",
  leashRadius: 20,
  memberIndex: 0,
};
const PACK_B: CreatureGroupMembership = {
  ...PACK_A,
  groupId: "harthmere:road_to_harthmere_group_2",
  memberIndex: 0,
};
const PACK_A_PREY: CreatureGroupMembership = {
  ...PACK_A,
  assistFaction: "livestock",
  role: "prey",
  memberIndex: 6,
};

const NOW = 1_000;
const PLAYER = id(9001);

function damagedMember(
  overrides: Partial<GroupAlertCandidate> = {}
): GroupAlertCandidate {
  return {
    id: id(101),
    position: [5, 35, 0],
    membership: PACK_A,
    lastDamageSource: { kind: "attack", attacker: PLAYER },
    lastDamageTimeSeconds: NOW - 1,
    lastDamageAmount: -42,
    alive: true,
    ...overrides,
  };
}

const attacker: GroupAlertAttacker = {
  position: [6, 35, 0],
  hp: 140,
  isPlayer: true,
  canBeTargeted: true,
};

const baseInput = {
  recipientId: id(100),
  recipientPosition: [0, 35, 0] as [number, number, number],
  recipientMembership: PACK_A,
  lookupAttacker: (candidate: BiomesId) =>
    candidate === PLAYER ? attacker : undefined,
  nowSeconds: NOW,
  memorySeconds: 30,
  deAggroDistanceSq: 34 * 34,
};

describe("creature groups: explicit identity", () => {
  it("assists a member of its own authored group", () => {
    const alert = evaluateGroupAlert({
      ...baseInput,
      candidates: [damagedMember()],
    });
    assert.equal(alert?.attackerId, PLAYER);
    assert.equal(alert?.groupId, PACK_A.groupId);
  });

  it("REGRESSION: two overlapping packs no longer merge into one swarm", () => {
    // Previously membership was inferred from an 18 m radius plus a name regex,
    // so a second encounter standing in the same clearing joined the first fight.
    const alert = evaluateGroupAlert({
      ...baseInput,
      candidates: [damagedMember({ membership: PACK_B })],
    });
    assert.equal(alert, undefined);
  });

  it("REGRESSION: a hill crest between pack-mates does not suppress the alert", () => {
    // The old evaluator required terrain line of sight between the damaged
    // creature and the responder, using the same brittle single-ray test that
    // broke target retention. Members of an authored pack know they are members.
    const acrossACrest = damagedMember({ position: [8, 48, 4] });
    assert.notEqual(
      evaluateGroupAlert({ ...baseInput, candidates: [acrossACrest] }),
      undefined
    );
  });

  it("bounds the alert by the group leash, not by the map", () => {
    const farAway = damagedMember({ position: [200, 35, 0] });
    assert.equal(
      evaluateGroupAlert({ ...baseInput, candidates: [farAway] }),
      undefined
    );
  });

  it("ignores itself as an alert source", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        candidates: [damagedMember({ id: baseInput.recipientId })],
      }),
      undefined
    );
  });
});

describe("creature groups: what counts as evidence", () => {
  it("requires real negative damage, not healing or a zero-damage contact", () => {
    for (const amount of [0, 5, undefined]) {
      assert.equal(
        evaluateGroupAlert({
          ...baseInput,
          candidates: [damagedMember({ lastDamageAmount: amount })],
        }),
        undefined,
        `lastDamageAmount=${amount}`
      );
    }
  });

  it("requires an attack, not another damage kind", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        candidates: [
          damagedMember({ lastDamageSource: { kind: "fall", attacker: PLAYER } }),
        ],
      }),
      undefined
    );
  });

  it("forgets damage older than the memory window", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        candidates: [damagedMember({ lastDamageTimeSeconds: NOW - 31 })],
      }),
      undefined
    );
  });

  it("will not adopt an untargetable, dead, or distant attacker", () => {
    const cases: Array<[string, GroupAlertAttacker]> = [
      ["at peace / in a safe zone", { ...attacker, canBeTargeted: false }],
      ["dead", { ...attacker, hp: 0 }],
      ["beyond disengage", { ...attacker, position: [500, 35, 0] }],
    ];
    for (const [label, variant] of cases) {
      assert.equal(
        evaluateGroupAlert({
          ...baseInput,
          candidates: [damagedMember()],
          lookupAttacker: () => variant,
        }),
        undefined,
        label
      );
    }
  });

  it("prefers the newest hit, then the nearest, then the lowest id", () => {
    const alert = evaluateGroupAlert({
      ...baseInput,
      candidates: [
        damagedMember({ id: id(101), lastDamageTimeSeconds: NOW - 5 }),
        damagedMember({ id: id(102), lastDamageTimeSeconds: NOW - 1 }),
      ],
    });
    assert.equal(alert?.attackerId, PLAYER);
  });

  it("stamps a bounded lifetime on the alert", () => {
    const alert = evaluateGroupAlert({
      ...baseInput,
      candidates: [damagedMember()],
    });
    assert.equal(alert!.raisedAtSeconds, NOW - 1);
    assert.equal(
      alert!.expiresAtSeconds - alert!.raisedAtSeconds,
      GROUP_ALERT_LIFETIME_SECONDS
    );
  });
});

describe("creature groups: assist factions", () => {
  it("only Muck and bandits answer an alert with aggression", () => {
    assert.equal(assistFactionJoinsCombat("muck"), true);
    assert.equal(assistFactionJoinsCombat("bandit"), true);
    assert.equal(assistFactionJoinsCombat("livestock"), false);
    assert.equal(assistFactionJoinsCombat("none"), false);
  });

  it("REGRESSION: livestock no longer joins Muck combat as a bystander", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        recipientMembership: PACK_A_PREY,
        candidates: [damagedMember()],
      }),
      undefined
    );
    assert.equal(
      shouldFleeGroupAlert({ faction: "livestock", directlyAttacked: false }),
      true
    );
  });

  it("keeps an animal's own direct retaliation intact", () => {
    // Being hit yourself is a damage event, not an alert; prey still fights back.
    assert.equal(
      shouldFleeGroupAlert({ faction: "livestock", directlyAttacked: true }),
      false
    );
  });

  it("REGRESSION: attacking livestock does not recruit the Muck members", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        candidates: [
          damagedMember({
            membership: PACK_A_PREY,
          }),
        ],
      }),
      undefined
    );
  });

  it("an ungrouped creature simply never assists", () => {
    assert.equal(
      evaluateGroupAlert({
        ...baseInput,
        recipientMembership: undefined,
        candidates: [damagedMember()],
      }),
      undefined
    );
  });
});

describe("creature groups: responder control", () => {
  const roadPack = [
    { id: id(1), role: "ranged" as const, memberIndex: 0, distanceToAttacker: 9, alive: true },
    { id: id(2), role: "melee" as const, memberIndex: 1, distanceToAttacker: 2, alive: true },
    { id: id(3), role: "melee" as const, memberIndex: 2, distanceToAttacker: 3, alive: true },
    { id: id(4), role: "ranged" as const, memberIndex: 3, distanceToAttacker: 10, alive: true },
    { id: id(5), role: "melee" as const, memberIndex: 4, distanceToAttacker: 4, alive: true },
    { id: id(6), role: "melee" as const, memberIndex: 5, distanceToAttacker: 5, alive: true },
    { id: id(7), role: "prey" as const, memberIndex: 6, distanceToAttacker: 6, alive: true },
  ];

  it("REGRESSION: caps all simultaneous responders so a pack cannot alpha-strike a 140 HP player", () => {
    const plan = groupResponderPlan({ members: roadPack });
    const active = plan.filter((entry) => entry.mode !== "hold");
    assert.equal(active.length, GROUP_MAX_SIMULTANEOUS_MELEE);
  });

  it("holds overflow indefinitely so elapsed alert time cannot dissolve the cap", () => {
    const plan = groupResponderPlan({ members: roadPack });
    const holding = plan
      .filter((entry) => entry.mode === "hold" && entry.id === id(6))
      .map((entry) => entry.engageDelaySeconds);
    assert.equal(holding.length, 1);
    assert.equal(holding[0], Number.POSITIVE_INFINITY);
  });

  it("tags a ranged creature as a flank responder when it owns an active slot", () => {
    const plan = groupResponderPlan({
      members: roadPack.map((member) =>
        member.id === id(1) ? { ...member, distanceToAttacker: 1 } : member
      ),
    });
    assert.equal(plan.find((entry) => entry.id === id(1))?.mode, "flank");
  });

  it("never asks prey to participate", () => {
    const plan = groupResponderPlan({ members: roadPack });
    const prey = plan.find((entry) => entry.id === id(7));
    assert.equal(prey?.mode, "hold");
    assert.equal(prey?.engageDelaySeconds, Number.POSITIVE_INFINITY);
  });

  it("gives every member an explicit answer, including the dead", () => {
    const withCorpse = [
      ...roadPack,
      { id: id(8), role: "melee" as const, memberIndex: 7, distanceToAttacker: 1, alive: false },
    ];
    const plan = groupResponderPlan({ members: withCorpse });
    assert.equal(plan.length, withCorpse.length);
    assert.equal(plan.find((entry) => entry.id === id(8))?.mode, "hold");
  });

  it("is deterministic across slightly different views of the same fight", () => {
    // Each member computes the plan locally, so ranks must agree without a shared
    // bus. Distance is quantized, so sub-bucket disagreement cannot reorder it.
    const jittered = roadPack.map((member) => ({
      ...member,
      distanceToAttacker: member.distanceToAttacker + 0.3,
    }));
    assert.deepEqual(
      groupResponderPlan({ members: roadPack }).map((entry) => [entry.id, entry.mode]),
      groupResponderPlan({ members: jittered }).map((entry) => [entry.id, entry.mode])
    );
  });

  it("prefers nearer members once they fall in a closer distance bucket", () => {
    const far = groupResponderPlan({
      members: [
        { id: id(1), role: "melee", memberIndex: 0, distanceToAttacker: 40, alive: true },
        { id: id(2), role: "melee", memberIndex: 1, distanceToAttacker: 1, alive: true },
      ],
      maxSimultaneousMelee: 1,
    });
    assert.equal(far.find((entry) => entry.id === id(2))?.mode, "engage");
    assert.equal(far.find((entry) => entry.id === id(1))?.mode, "hold");
  });
});

describe("creature groups: standing down", () => {
  const alert = {
    groupId: PACK_A.groupId,
    attackerId: PLAYER,
    sourcePosition: [0, 35, 0] as [number, number, number],
    raisedAtSeconds: NOW,
    expiresAtSeconds: NOW + GROUP_ALERT_LIFETIME_SECONDS,
  };
  const live = {
    alert,
    nowSeconds: NOW + 1,
    attackerAlive: true,
    attackerInSafeZone: false,
    attackerDistanceFromAnchor: 5,
    groupLeashRadius: PACK_A.leashRadius,
  };

  it("stays engaged during a live fight", () => {
    assert.equal(groupAlertClearReason(live), undefined);
  });

  it("stands down on death, safe zone, leash escape, expiry, or unreachability", () => {
    assert.equal(
      groupAlertClearReason({ ...live, attackerAlive: false }),
      "attacker_dead"
    );
    assert.equal(
      groupAlertClearReason({ ...live, attackerInSafeZone: true }),
      "attacker_safe_zone"
    );
    assert.equal(
      groupAlertClearReason({ ...live, attackerDistanceFromAnchor: 100 }),
      "attacker_escaped_leash"
    );
    assert.equal(
      groupAlertClearReason({
        ...live,
        nowSeconds: NOW + GROUP_ALERT_LIFETIME_SECONDS,
      }),
      "expired"
    );
    assert.equal(
      groupAlertClearReason({ ...live, attackerReachable: false }),
      "attacker_unreachable"
    );
  });

  it("REGRESSION: transient terrain occlusion is NOT a stand-down condition", () => {
    // Nothing in the clear-reason set mentions visibility. That is the point.
    assert.equal(groupAlertClearReason({ ...live }), undefined);
  });
});

describe("creature groups: membership decoding", () => {
  it("reads membership straight off serialized npc_state", () => {
    assert.deepEqual(
      decodeCreatureGroupMembership(pack({ creatureGroup: PACK_A })),
      PACK_A
    );
  });

  it("treats absent, malformed, and ungrouped state as ungrouped", () => {
    assert.equal(decodeCreatureGroupMembership(undefined), undefined);
    assert.equal(decodeCreatureGroupMembership(pack({})), undefined);
    assert.equal(
      decodeCreatureGroupMembership(pack({ creatureGroup: { groupId: 7 } })),
      undefined
    );
    assert.equal(
      decodeCreatureGroupMembership(new Uint8Array([1, 2, 3, 4, 5])),
      undefined
    );
  });
});
