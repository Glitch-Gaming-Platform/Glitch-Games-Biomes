/// <reference types="mocha" />
import assert from "assert";
import {
  createHarthmereJobsBoardAdapter,
  planHarthmereJobsBoardCompletionSteps,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { HarthmereQuestActionError } from "@/client/components/challenges/questActionError";

// HARTHMERE_JOBS_BOARD_COMPLETION_WIRING
// Locks the fix for the P0 where no job could ever be completed/paid: the client
// now drives the two server steps (verify the work, then claim the payout).

describe("planHarthmereJobsBoardCompletionSteps", () => {
  it("verifies the work THEN pays when the todo is not yet completed", () => {
    assert.deepStrictEqual(planHarthmereJobsBoardCompletionSteps("active"), [
      "complete_job_quest",
      "complete_job",
    ]);
    assert.deepStrictEqual(planHarthmereJobsBoardCompletionSteps(undefined), [
      "complete_job_quest",
      "complete_job",
    ]);
  });

  it("skips re-verifying when the todo is already completed", () => {
    assert.deepStrictEqual(planHarthmereJobsBoardCompletionSteps("completed"), [
      "complete_job",
    ]);
  });
});

// A fake fetch that records the operations the adapter posts and returns a
// minimal valid jobs-board response. Lets us assert ordering without a network.
function recordingFetch(opts: { rejectOps?: Set<string> } = {}) {
  const ops: string[] = [];
  const fetchImpl = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    const op = body.payload.operation as string;
    ops.push(op);
    if (opts.rejectOps?.has(op)) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: {
            warnings: ["jobs_board_rejected:missing_completion_item:iron_ore"],
          },
        }),
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ ok: true, jobsBoardState: {} }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { ops, fetchImpl };
}

describe("createHarthmereJobsBoardAdapter.completeJobFully", () => {
  it("sends complete_job_quest then complete_job for an unfinished todo", async () => {
    const { ops, fetchImpl } = recordingFetch();
    const adapter = createHarthmereJobsBoardAdapter(fetchImpl);
    await adapter.completeJobFully("job1", "board1", { todoStatus: "active" });
    assert.deepStrictEqual(ops, ["complete_job_quest", "complete_job"]);
  });

  it("sends only complete_job when the todo is already completed", async () => {
    const { ops, fetchImpl } = recordingFetch();
    const adapter = createHarthmereJobsBoardAdapter(fetchImpl);
    await adapter.completeJobFully("job1", "board1", {
      todoStatus: "completed",
    });
    assert.deepStrictEqual(ops, ["complete_job"]);
  });

  it("does NOT pay out when the work-verification step is rejected", async () => {
    const { ops, fetchImpl } = recordingFetch({
      rejectOps: new Set(["complete_job_quest"]),
    });
    const adapter = createHarthmereJobsBoardAdapter(fetchImpl);
    await assert.rejects(
      adapter.completeJobFully("job1", "board1", { todoStatus: "active" }),
      (error: unknown) =>
        error instanceof HarthmereQuestActionError &&
        error.warnings.some((warning) =>
          warning.includes("missing_completion_item")
        ) &&
        !error.message.includes("jobs_board_rejected")
    );
    // The payout step must never run after a rejected verification.
    assert.deepStrictEqual(ops, ["complete_job_quest"]);
  });

  it("forwards target/item evidence on the verification step only", async () => {
    const sentBodies: any[] = [];
    const fetchImpl = (async (_url: string, init: any) => {
      sentBodies.push(JSON.parse(init.body));
      return {
        ok: true,
        json: async () => ({ ok: true, jobsBoardState: {} }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const adapter = createHarthmereJobsBoardAdapter(fetchImpl);
    await adapter.completeJobFully("job1", "board1", {
      todoStatus: "active",
      completedTargetId: "refinery_intake",
      questTodoId: "todo-7",
    });
    const questStep = sentBodies.find(
      (b) => b.payload.operation === "complete_job_quest"
    );
    const payStep = sentBodies.find(
      (b) => b.payload.operation === "complete_job"
    );
    assert.strictEqual(questStep.payload.completedTargetId, "refinery_intake");
    assert.strictEqual(questStep.payload.questTodoId, "todo-7");
    assert.strictEqual(payStep.payload.completedTargetId, undefined);
  });
});
