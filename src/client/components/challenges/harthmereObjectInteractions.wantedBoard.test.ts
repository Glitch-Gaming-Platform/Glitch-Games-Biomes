import assert from "assert";

process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";
import {
  HARTHMERE_JOBS_BOARD_OPEN_EVENT,
  HARTHMERE_WANTED_BOARD_OPEN_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import {
  harthmereJobsBoardFieldCompletionRequestIdForTest,
  harthmereJobsBoardObjectMatchesFieldTarget,
  performHarthmereObjectInteraction,
} from "./harthmereObjectInteractions";

describe("harthmere object interactions wanted board dispatch", () => {
  it("dispatches marker context for jobs-board open interactions", () => {
    const originalWindow = (globalThis as any).window;
    const originalFetch = (globalThis as any).fetch;
    const windowTarget = new EventTarget() as EventTarget & {
      CustomEvent?: typeof CustomEvent;
    };
    (globalThis as any).window = windowTarget;
    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    });
    let detail: any;
    windowTarget.addEventListener(HARTHMERE_JOBS_BOARD_OPEN_EVENT, (event) => {
      detail = (event as CustomEvent).detail;
    });

    try {
      performHarthmereObjectInteraction({
        label: "Harthmere Market Posting Board",
        objectId: "jobs_board_marker:harthmere_market_posting_board",
        entityId: "jobs_board_entity",
        interaction: {
          kind: "open_jobs_board",
          title: "Open Jobs Board",
          toastVerb: "Opened",
        },
        resources: {} as any,
        gardenHose: { publish: () => {} },
      });
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).fetch = originalFetch;
    }

    assert.equal(detail?.source, "harthmere_object_interaction");
    assert.equal(
      detail?.objectId,
      "jobs_board_marker:harthmere_market_posting_board"
    );
    assert.equal(
      detail?.interactionTargetId,
      "jobs_board_marker:harthmere_market_posting_board"
    );
  });

  it("dispatches the wanted-board open event for F interactions", () => {
    const originalWindow = (globalThis as any).window;
    const originalFetch = (globalThis as any).fetch;
    const windowTarget = new EventTarget() as EventTarget & {
      CustomEvent?: typeof CustomEvent;
    };
    (globalThis as any).window = windowTarget;
    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    });
    let detail: any;
    windowTarget.addEventListener(
      HARTHMERE_WANTED_BOARD_OPEN_EVENT,
      (event) => {
        detail = (event as CustomEvent).detail;
      }
    );

    try {
      performHarthmereObjectInteraction({
        label: "Farming Wanted Board",
        entityId: "wanted_board_entity",
        interaction: {
          kind: "open_wanted_board",
          title: "Open Wanted Board",
          toastVerb: "Opened",
        },
        resources: {} as any,
        gardenHose: { publish: () => {} },
      });
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).fetch = originalFetch;
    }

    assert.equal(detail?.source, "harthmere_object_interaction");
    assert.equal(detail?.label, "Farming Wanted Board");
    assert.equal(detail?.entityId, "wanted_board_entity");
  });
});

describe("harthmere jobs board object target matching", () => {
  it("uses a distinct idempotency key for every repeated field interaction", () => {
    const base = {
      operation: "complete_job_quest" as const,
      jobId: "cleanup_job",
      todoId: "cleanup_todo",
      acceptedAtMs: 100,
    };
    const first = harthmereJobsBoardFieldCompletionRequestIdForTest({
      ...base,
      nonce: "interaction_1",
    });
    const second = harthmereJobsBoardFieldCompletionRequestIdForTest({
      ...base,
      nonce: "interaction_2",
    });

    assert.notEqual(first, second);
    assert.match(first, /cleanup_job:cleanup_todo:100:interaction_1$/);
    assert.match(second, /cleanup_job:cleanup_todo:100:interaction_2$/);
  });

  it("matches visible lockbox objects to delivery drop-off jobs by id or label", () => {
    const todo = {
      todoId: "todo_delivery",
      jobId: "job_delivery",
      actorId: "actor",
      boardId: "harthmere_grove_market_jobs_board",
      title: "Deliver Medicine",
      todoText: "Deliver medicine.",
      status: "active",
      kind: "delivery",
      mapMarkerId: "clinic_lockbox_marker",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      dueAtMs: 2,
      questBoardTodo: true,
    } as any;
    const job = {
      jobId: "job_delivery",
      boardId: "harthmere_grove_market_jobs_board",
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Deliver Medicine",
      description: "Drop off medicine.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          mapMarkerId: "clinic_lockbox_marker",
          targetName: "Clinic lockbox",
        },
      ],
      rewardGold: 1,
      escrowGold: 1,
      status: "active",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      deadlineAtMs: 2,
      acceptedByActorId: "actor",
      requiresFieldWork: true,
      mapMarkerId: "clinic_lockbox_marker",
      abuseFlags: [],
      logs: [],
    } as any;

    assert.equal(
      harthmereJobsBoardObjectMatchesFieldTarget({
        objectId: "clinic_lockbox_marker",
        label: "Clinic Lockbox",
        todo,
        job,
      }),
      true
    );
    assert.equal(
      harthmereJobsBoardObjectMatchesFieldTarget({
        objectId: "unrelated_crate",
        label: "Clothing Crate",
        todo,
        job,
      }),
      false
    );
  });

  it("does not treat a board-turn-in gather source as a field hand-in", () => {
    const todo = {
      todoId: "todo_berries",
      jobId: "job_berries",
      actorId: "actor",
      boardId: "harthmere_grove_market_jobs_board",
      title: "Stock the Road Rations Crate",
      todoText: "Gather berries.",
      status: "active",
      kind: "gather",
      mapMarkerId: "grove_garden_edge_berries",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      dueAtMs: 2,
      questBoardTodo: true,
    } as any;
    const job = {
      jobId: "job_berries",
      kind: "gather",
      status: "active",
      requiresFieldWork: false,
      mapMarkerId: "grove_garden_edge_berries",
      requirements: [
        {
          itemId: "wild_berries",
          count: 6,
          mapMarkerId: "grove_garden_edge_berries",
        },
      ],
    } as any;

    assert.equal(
      harthmereJobsBoardObjectMatchesFieldTarget({
        objectId: "grove_garden_edge_berries",
        label: "Garden Edge Berries",
        todo,
        job,
      }),
      false
    );
  });

  it("matches the authored Coop supply box as a delivery pickup", () => {
    const todo = {
      todoId: "todo_coop",
      jobId: "job_coop",
      actorId: "actor",
      boardId: "harthmere_grove_market_jobs_board",
      title: "Run the Coop Food Parcel",
      todoText: "Collect the parcel.",
      status: "active",
      kind: "delivery",
      mapMarkerId: "grove_mail_bank_satchel",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      dueAtMs: 2,
      questBoardTodo: true,
    } as any;
    const job = {
      jobId: "job_coop",
      kind: "delivery",
      status: "active",
      requiresFieldWork: true,
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          pickupMarkerId: "coop_supply_box",
          mapMarkerId: "grove_mail_bank_satchel",
        },
      ],
    } as any;

    assert.equal(
      harthmereJobsBoardObjectMatchesFieldTarget({
        objectId: "coop_supply_box",
        label: "Old Supply Box",
        todo,
        job,
      }),
      true
    );
  });
});
