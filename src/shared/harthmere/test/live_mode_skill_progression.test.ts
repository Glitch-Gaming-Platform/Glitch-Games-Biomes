import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  projectHarthmereNativeEcsPlansOntoClientStateForTest,
  reduceHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";
import { HARTHMERE_SKILL_IDS } from "@/shared/harthmere/harthmere_skill_progression";

const ACTOR = "8290811499733991";
const NOW = 1_785_000_000_000;

function nativeSkillXp(overrides: Record<string, number> = {}) {
  return Object.fromEntries(
    HARTHMERE_SKILL_IDS.filter((skillId) => skillId !== "character_level").map(
      (skillId) => [skillId, overrides[skillId] ?? 0]
    )
  );
}

function envelope(
  actionKind: HarthmereLiveModeAuthorityEnvelope["actionKind"],
  subsystem: HarthmereLiveModeAuthorityEnvelope["subsystem"],
  payload: Record<string, unknown>,
  skillXp: Record<string, number> = nativeSkillXp()
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `skills:${actionKind}:${NOW}`,
    idempotencyKey: `skills:${actionKind}:${NOW}`,
    actorId: ACTOR,
    serverActorEntityId: Number(ACTOR) as any,
    actionKind,
    subsystem,
    source: "client_request",
    serverActorSkillXp: skillXp,
    serverActorSkillProgressionInitialized: true,
    serverReceivedAtMs: NOW,
    serverTick: NOW,
    actorEntityVersion: 1,
    zoneId: "harthmere",
    payload,
    clientClaims: {},
  };
}

function skillPlan(
  result: ReturnType<typeof reduceHarthmereLiveModeBackendState>
) {
  return result.summary.nativeEcsMaterializationPlans?.find(
    (plan) => plan.kind === "skill_progress"
  );
}

describe("live-mode native ECS skill progression", () => {
  it("starts from the authoritative native total and emits an absolute magic plan", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    state.classMagic.knownAbilities = ["basic_attack"];
    state.classMagic.skills.arcane_literacy = { xp: 999, level: 50 };
    const env = envelope(
      "request_magic_progress",
      "ability",
      {
        abilityId: "basic_attack",
        magicSchoolId: "arcane",
        skillXpDelta: 10,
      },
      nativeSkillXp({ arcane_literacy: 20 })
    );
    const result = reduceHarthmereLiveModeBackendState(state, env, NOW);

    assert.equal(result.state.classMagic.skills.arcane_literacy.xp, 30);
    const plan = skillPlan(result);
    assert.equal(plan?.kind, "skill_progress");
    assert.deepEqual(
      plan?.kind === "skill_progress" ? plan.skillXp : undefined,
      { arcane_literacy: 30 }
    );
    const projected = projectHarthmereNativeEcsPlansOntoClientStateForTest(
      state,
      env,
      result.summary.nativeEcsMaterializationPlans ?? []
    );
    assert.equal(projected.classMagic.skills.arcane_literacy.xp, 30);
  });

  it("awards persuasion for a completed neighbor conversation", () => {
    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW),
      envelope("request_care_loop_action", "care", {
        operation: "daily_task_completed",
        targetId: "talk_neighbor",
      }),
      NOW
    );
    const plan = skillPlan(result);
    assert.equal(plan?.kind, "skill_progress");
    assert.equal(
      plan?.kind === "skill_progress" ? plan.skillXp.persuasion : undefined,
      6
    );
  });

  it("awards business operations for a validated market transaction", () => {
    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW),
      envelope("request_vendor_transaction", "vendor", {
        vendorId: "grove_market",
        transactionKind: "browse",
      }),
      NOW
    );
    const plan = skillPlan(result);
    assert.equal(plan?.kind, "skill_progress");
    assert.equal(
      plan?.kind === "skill_progress"
        ? plan.skillXp.business_operations
        : undefined,
      5
    );
  });

  it("lazily migrates legacy totals only when the native ledger is absent", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    state.classMagic.skills.care = { xp: 77, level: 1 };
    const env = envelope(
      "request_care_loop_action",
      "care",
      { operation: "daily_task_completed", targetId: "garden" },
      nativeSkillXp()
    );
    env.serverActorSkillProgressionInitialized = false;
    const result = reduceHarthmereLiveModeBackendState(state, env, NOW);
    const plan = skillPlan(result);
    assert.equal(plan?.kind, "skill_progress");
    assert.equal(
      plan?.kind === "skill_progress"
        ? Object.keys(plan.skillXp).length
        : undefined,
      HARTHMERE_SKILL_IDS.length - 1,
      "first migration plan must initialize the complete specialized ledger"
    );
    assert.equal(
      plan?.kind === "skill_progress" ? plan.skillXp.care : undefined,
      77
    );
  });
});
