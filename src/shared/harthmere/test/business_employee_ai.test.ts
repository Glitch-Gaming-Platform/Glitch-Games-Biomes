/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS,
  getHarthmereBusinessServiceAnimationCueSpec,
} from "../business_customer_simulator";
import {
  HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS,
  HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS,
  createHarthmereBusinessEmployeeTaskFlow,
  generateHarthmereBusinessEmployeeCandidates,
  interviewHarthmereBusinessEmployeeCandidate,
  negotiateHarthmereBusinessEmployeeCandidate,
  normalizeHarthmereBusinessEmployeeTaskId,
  renderHarthmereBusinessEmployeeAiVisualAuditHtml,
  simulateHarthmereBusinessEmployeeTaskRun,
  validateHarthmereBusinessEmployeeAiVisualAudit,
  validateHarthmereBusinessEmployeeAssignedTask,
  type HarthmereBusinessEmployeeAutomationRole,
} from "../business_employee_ai";
import type { HarthmereEconomyEmployeeRecord } from "../mmo_economy_authority";

const NOW_MS = 1_800_000_000_000;

function employee(
  overrides: Partial<HarthmereEconomyEmployeeRecord> = {}
): HarthmereEconomyEmployeeRecord {
  return {
    employeeId: "employee_test",
    businessId: "business_test",
    npcId: "generated_worker:test",
    role: "Server",
    skill: 3,
    wageGoldPerDay: 12,
    morale: 70,
    loyalty: 55,
    assignedTask: "front_counter",
    hiredAtMs: NOW_MS,
    lastPaidAtMs: NOW_MS,
    ...overrides,
  };
}

describe("business_employee_ai", () => {
  it("creates per-business staff task flows for every service offer", () => {
    for (const [typeId, definition] of Object.entries(
      HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS
    )) {
      for (const offer of definition.offers) {
        const flow = createHarthmereBusinessEmployeeTaskFlow(
          typeId as any,
          offer.offerId
        );
        assert.equal(flow.typeId, typeId);
        assert.equal(flow.offerId, offer.offerId);
        assert.equal(flow.animationCue, offer.animationCue);
        assert.ok(flow.steps.length >= 5);
        assert.ok(
          flow.steps.some((step) => step.stepId === "fetch_required_stock")
        );
        assert.ok(
          flow.steps.some(
            (step) =>
              step.stepId === "perform_service" &&
              step.animationCue === offer.animationCue
          )
        );
        assert.ok(flow.physicalActions.length >= 8);
        assert.deepEqual(
          flow.physicalActions.filter((action) => action.requiredBeforeComplete)
            .length,
          flow.physicalActions.length
        );
        assert.ok(
          flow.physicalActions.some((action) => action.kind === "walk_to_node")
        );
        assert.ok(
          flow.physicalActions.some(
            (action) =>
              action.kind === "operate_station" &&
              action.animationCue === offer.animationCue
          )
        );
        assert.ok(
          flow.physicalActions.some(
            (action) => action.kind === "serve_customer"
          )
        );
        assert.ok(
          flow.physicalActions.some((action) => action.kind === "clean_station")
        );
      }
    }
  });

  it("uses bespoke physical sub-actions for restaurant service instead of a generic task label", () => {
    const flow = createHarthmereBusinessEmployeeTaskFlow(
      "food_service_restaurant",
      "serve_worker_meal"
    );
    assert.ok(
      flow.physicalActions.some(
        (action) =>
          action.objectRef === "oven" && action.label.includes("Open the oven")
      )
    );
    assert.ok(
      flow.physicalActions.some(
        (action) =>
          action.objectRef === "plating pass" &&
          action.label.includes("Cook, plate")
      )
    );
    assert.ok(
      flow.physicalActions.some(
        (action) =>
          action.objectRef === "service plate" &&
          action.label.includes("only after plating is complete")
      )
    );
    assert.ok(
      flow.physicalActions.some(
        (action) =>
          action.objectRef === "plating pass" && action.kind === "clean_station"
      )
    );
  });

  it("validates assignable staff tasks instead of accepting arbitrary strings", () => {
    assert.equal(
      normalizeHarthmereBusinessEmployeeTaskId("Front Counter"),
      "front_counter"
    );
    assert.equal(
      normalizeHarthmereBusinessEmployeeTaskId("kitchen"),
      "production_station"
    );
    assert.equal(
      validateHarthmereBusinessEmployeeAssignedTask("cleanup route")?.taskKind,
      "cleanup_route"
    );
    assert.equal(
      validateHarthmereBusinessEmployeeAssignedTask("debugNope"),
      undefined
    );
    assert.equal(
      Object.keys(HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS).length,
      8
    );
  });

  it("pathfinds staff and customers through counters, queue nodes, and service stations", () => {
    const run = simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "task_path_base",
      businessId: "business_test",
      typeId: "food_service_restaurant",
      employee: employee({
        assignedTask: "production_station",
        role: "Line Cook",
      }),
      offerId: "serve_worker_meal",
      nowMs: NOW_MS,
    });
    assert.equal(run.status, "completed");
    assert.ok(run.employeePath.length > 8);
    assert.ok(run.customerPath.length > 5);
    assert.equal(run.pathAudit.ok, true);
    assert.equal(run.pathAudit.unreachableNodes.length, 0);
    assert.equal(run.animationCue, "procedural_plate_slide_counter");
    assert.equal(run.animationSafety.noRootMotion, true);
    assert.equal(run.animationSafety.voxelSafe, true);
  });

  it("uses procedural service animations for employee actions", () => {
    const run = simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "task_animation",
      businessId: "business_test",
      typeId: "medical_doctor",
      employee: employee({
        role: "Clinic Aide",
        assignedTask: "quality_check",
      }),
      offerId: "urgent_treatment",
      nowMs: NOW_MS,
    });
    const spec = getHarthmereBusinessServiceAnimationCueSpec(run.animationCue);
    assert.ok(spec);
    assert.equal(run.animationFamily, spec!.family);
    assert.equal(run.animationFrameCount, 5);
    assert.deepEqual(run.animationSafety, {
      procedural: true,
      voxelSafe: true,
      noRootMotion: true,
      noSkeletonRequirement: true,
      rotationOnlyPose: true,
    });
  });

  it("recovers from blocked work objects by repathing or fallback pathing", () => {
    const run = simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "task_blocked",
      businessId: "business_test",
      typeId: "repair_maintenance_person",
      employee: employee({
        role: "Fix-It Apprentice",
        assignedTask: "production_station",
      }),
      offerId: "fixture_fix",
      blockedCells: [{ x: 10, y: 3, reason: "dropped tool crate" }],
      nowMs: NOW_MS,
    });
    assert.notEqual(run.status, "failed");
    assert.ok(run.pathAudit.repathCount > 0 || run.pathAudit.fallbackExitUsed);
    assert.ok(run.employeePath.length > 0);
  });

  it("resolves customer plus employee collision with sidestep recovery", () => {
    const run = simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "task_collision",
      businessId: "business_test",
      typeId: "courier",
      employee: employee({
        role: "Dispatch Runner",
        assignedTask: "dispatch_runner",
      }),
      offerId: "standard_parcel",
      forceSharedServiceLane: true,
      nowMs: NOW_MS,
    });
    assert.notEqual(run.status, "failed");
    assert.ok(run.collisionAudit.collisionCount > 0);
    assert.ok(run.collisionAudit.resolvedCollisions > 0);
    assert.ok(run.pathAudit.sidestepCount > 0);
  });

  it("turns very low morale into a failed staff action with slower service warnings", () => {
    const run = simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "task_low_morale",
      businessId: "business_test",
      typeId: "food_service_restaurant",
      employee: employee({ morale: 8, loyalty: 20 }),
      offerId: "serve_worker_meal",
      nowMs: NOW_MS,
    });
    assert.equal(run.status, "failed");
    assert.equal(run.failureReason, "employee_morale_too_low");
    assert.ok(run.qualityMultiplier < 0.5);
    assert.ok(run.warnings.includes("employee_morale_failure:rest_required"));
  });

  it("models candidate market, interview scores, wage negotiation, and withdrawal edge cases", () => {
    const candidates = generateHarthmereBusinessEmployeeCandidates({
      businessId: "business_test",
      typeId: "food_service_restaurant",
      nowMs: NOW_MS,
      count: 3,
      businessReputation: 25,
    });
    assert.equal(candidates.length, 3);
    assert.ok(
      candidates.every((candidate) => candidate.status === "available")
    );
    const interviewed = interviewHarthmereBusinessEmployeeCandidate(
      candidates[0],
      "friendly"
    );
    assert.equal(interviewed.status, "interviewed");
    assert.ok((interviewed.interviewScore ?? 0) > 0);
    const accepted = negotiateHarthmereBusinessEmployeeCandidate(
      interviewed,
      interviewed.wageAskGoldPerDay
    );
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.candidate.status, "offer_made");
    let declined = negotiateHarthmereBusinessEmployeeCandidate(
      interviewed,
      1
    ).candidate;
    declined = negotiateHarthmereBusinessEmployeeCandidate(
      declined,
      1
    ).candidate;
    const withdrawn = negotiateHarthmereBusinessEmployeeCandidate(declined, 1);
    assert.equal(withdrawn.accepted, false);
    assert.equal(withdrawn.candidate.status, "withdrawn");
  });

  it("has visible AI behavior definitions for every automation role", () => {
    const roles = Object.keys(
      HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS
    ) as HarthmereBusinessEmployeeAutomationRole[];
    assert.deepEqual(roles.sort(), [
      "branch_manager",
      "courier_dispatch",
      "front_counter",
      "purchasing_manager",
      "quality_inspector",
    ]);
    for (const role of roles) {
      const run = simulateHarthmereBusinessEmployeeTaskRun({
        taskRunId: `task_role_${role}`,
        businessId: "business_test",
        typeId: "food_service_restaurant",
        employee: employee({ role, skill: 4 }),
        automationRole: role,
        nowMs: NOW_MS,
      });
      assert.equal(run.automationRole, role);
      assert.equal(
        run.taskKind,
        HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS[role].taskKind
      );
      assert.notEqual(run.status, "failed");
      assert.ok(run.employeePath.length > 0);
    }
  });

  it("renders and validates the staff movement visual audit", () => {
    const html = renderHarthmereBusinessEmployeeAiVisualAuditHtml();
    const audit = validateHarthmereBusinessEmployeeAiVisualAudit();
    assert.equal(audit.ok, true, audit.warnings.slice(0, 10).join(", "));
    assert.equal(
      audit.businessCount,
      Object.keys(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS).length
    );
    assert.equal(audit.roleCount, 5);
    assert.equal(audit.edgeCaseCount, 3);
    assert.ok(html.includes("Business Employee AI Visual Audit"));
    assert.equal(html.includes("NaN"), false);
    assert.equal(html.includes("undefined"), false);
  });
});
