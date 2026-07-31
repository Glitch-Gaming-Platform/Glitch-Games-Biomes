import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  createHarthmereCraftingStationClientSnapshotFromBackend,
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  HARTHMERE_CRAFTING_STATIONS,
  HARTHMERE_CRAFTING_TOOLS,
  ensureHarthmereProductionCraftingCatalogue,
} from "../mmo_crafting_catalogue";
import { registerHarthmereCraftingRecipe } from "../mmo_inventory_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const ACTOR = "craft_live_actor";
const NOW = 1770000000000;
let seq = 0;

function envelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  nowMs = NOW
): HarthmereLiveModeAuthorityEnvelope {
  seq += 1;
  return {
    requestId: `craft-live-${seq}`,
    idempotencyKey: `craft-live-idem-${seq}`,
    actorId: ACTOR,
    actionKind,
    subsystem: "crafting",
    source: "client_request",
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    clientClaims: {},
  };
}

function freshState(): HarthmereLiveModeBackendState {
  ensureHarthmereProductionCraftingCatalogue();
  const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
  state.classMagic.knownRecipes = ["harthmere_carpentry_wood_plank"];
  state.classMagic.skills = {
    character_level: { level: 5, xp: 0 },
    carpentry: { level: 2, xp: 0 },
  };
  state.inventory.items = {
    [HARTHMERE_CRAFTING_TOOLS.simpleAxe]: 1,
  };
  state.banking.materialStorage = {
    softwood_log: 4,
  };
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  nowMs = NOW
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope("request_crafting", payload, nowMs),
    nowMs
  );
}

describe("Harthmere live-mode crafting backend", () => {
  it("seeds starter workbench recipes for fresh and existing live-mode saves", () => {
    const fresh = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    assert.ok(
      fresh.classMagic.knownRecipes.includes("harthmere_carpentry_wood_plank")
    );
    assert.ok(
      fresh.classMagic.knownRecipes.includes("harthmere_tool_hoe_recipe")
    );

    const existing = parseHarthmereLiveModeBackendState(
      JSON.stringify({
        actorId: ACTOR,
        classMagic: { knownRecipes: [] },
      }),
      ACTOR,
      NOW
    );
    const snapshot = createHarthmereCraftingStationClientSnapshotFromBackend(
      existing,
      HARTHMERE_CRAFTING_STATIONS.workbench,
      undefined,
      NOW
    );
    assert.ok(snapshot.knownRecipes.includes("harthmere_carpentry_wood_plank"));
    assert.ok(
      snapshot.knownRecipes.length >= 10,
      snapshot.knownRecipes.join(",")
    );
  });

  it("starts and completes timed server crafting jobs with reserved materials", () => {
    const start = reduce(freshState(), {
      recipeId: "harthmere_carpentry_wood_plank",
      jobAction: "start",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.simpleAxe],
      craftingJobId: "job_planks_1",
    });
    assert.ok(
      start.summary.touchedModels.includes("crafting_job"),
      JSON.stringify(start.summary)
    );
    assert.strictEqual(start.state.banking.materialStorage.softwood_log, 2);
    const jobId = Object.keys(start.state.crafting.activeJobs)[0];
    assert.ok(jobId, JSON.stringify(start.state.crafting));
    assert.notStrictEqual(jobId, "job_planks_1");

    const tooEarly = reduce(
      start.state,
      { jobAction: "complete", craftingJobId: jobId },
      NOW + 500
    );
    assert.ok(
      tooEarly.summary.warnings.includes("crafting_rejected:job_not_ready"),
      JSON.stringify(tooEarly.summary)
    );
    assert.strictEqual(tooEarly.state.inventory.items.wood_plank ?? 0, 0);

    const complete = reduce(
      tooEarly.state,
      { jobAction: "complete", craftingJobId: jobId },
      NOW + 2000
    );
    assert.strictEqual(complete.state.inventory.items.wood_plank, 3);
    assert.strictEqual(complete.state.crafting.activeJobs[jobId], undefined);
    assert.strictEqual(
      complete.state.crafting.history.at(-1)?.status,
      "completed"
    );
    assert.ok(
      (complete.state.classMagic.skills.carpentry?.xp ?? 0) > 0,
      JSON.stringify(complete.state.classMagic.skills)
    );
  });

  it("cancels active jobs and refunds reserved backpack, material, and wallet deltas", () => {
    const started = reduce(freshState(), {
      recipeId: "harthmere_carpentry_wood_plank",
      jobAction: "start",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.simpleAxe],
    }).state;
    const jobId = Object.keys(started.crafting.activeJobs)[0];
    const cancelled = reduce(started, {
      jobAction: "cancel",
      craftingJobId: jobId,
    });
    assert.strictEqual(cancelled.state.banking.materialStorage.softwood_log, 4);
    assert.strictEqual(cancelled.state.crafting.activeJobs[jobId], undefined);
    assert.strictEqual(
      cancelled.state.crafting.history.at(-1)?.status,
      "cancelled"
    );
  });

  it("cancels incomplete crafting jobs when the actor is dead", () => {
    const started = reduce(freshState(), {
      recipeId: "harthmere_carpentry_wood_plank",
      jobAction: "start",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.simpleAxe],
    }).state;
    const jobId = Object.keys(started.crafting.activeJobs)[0];
    started.combat.deathState = "dead";
    const result = reduce(
      started,
      { jobAction: "complete", craftingJobId: jobId },
      NOW + 500
    );
    assert.ok(
      result.summary.warnings.includes(
        "crafting_rejected:job_cancelled_by_death"
      )
    );
    assert.strictEqual(result.state.banking.materialStorage.softwood_log, 4);
    assert.strictEqual(result.state.crafting.activeJobs[jobId], undefined);
  });

  it("refunds reserved material storage when a timed craft fails on completion", () => {
    ensureHarthmereProductionCraftingCatalogue();
    registerHarthmereCraftingRecipe({
      recipeId: "craft_live_failed_timed_plank",
      outputItemId: "wood_plank",
      outputCount: 1,
      inputs: [{ itemId: "wood_log", count: 4 }],
      requiredLevel: 1,
      requiredStationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      successChance: 0,
      failureMaterialRefundPercent: 0.5,
      craftingTimeMs: 100,
      xpReward: 10,
    });
    const state = freshState();
    state.classMagic.knownRecipes = ["craft_live_failed_timed_plank"];
    state.banking.materialStorage = { wood_log: 4 };
    const started = reduce(state, {
      recipeId: "craft_live_failed_timed_plank",
      jobAction: "start",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
    }).state;
    assert.strictEqual(started.banking.materialStorage.wood_log ?? 0, 0);
    const jobId = Object.keys(started.crafting.activeJobs)[0];

    const completed = reduce(
      started,
      { jobAction: "complete", craftingJobId: jobId },
      NOW + 200
    );
    assert.strictEqual(completed.state.banking.materialStorage.wood_log, 2);
    assert.strictEqual(completed.state.inventory.items.wood_plank ?? 0, 0);
    assert.strictEqual(
      completed.state.crafting.history.at(-1)?.status,
      "failed"
    );
  });

  it("applies tool durability and rejects a craft once the selected tool is spent", () => {
    const state = freshState();
    state.classMagic.knownRecipes = ["harthmere_blacksmith_iron_sword"];
    state.classMagic.skills = {
      character_level: { level: 5, xp: 0 },
      smithing: { level: 3, xp: 0 },
      blacksmithing: { level: 3, xp: 0 },
    };
    state.inventory.gold = 10;
    state.inventory.items = {
      [HARTHMERE_CRAFTING_TOOLS.woodenFencer]: 1,
    };
    state.banking.materialStorage = {
      iron_ingot: 6,
      wood_plank: 2,
    };
    state.crafting.toolDurability[HARTHMERE_CRAFTING_TOOLS.woodenFencer] = 2;

    const crafted = reduce(state, {
      recipeId: "harthmere_blacksmith_iron_sword",
      jobAction: "instant",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.woodenFencer],
      qualitySeed: 10,
    });
    assert.ok(
      !crafted.summary.warnings.some((warning) =>
        warning.includes("crafting_rejected")
      ),
      JSON.stringify(crafted.summary)
    );
    assert.strictEqual(
      crafted.state.crafting.toolDurability[
        HARTHMERE_CRAFTING_TOOLS.woodenFencer
      ],
      0
    );

    const rejected = reduce(crafted.state, {
      recipeId: "harthmere_blacksmith_iron_sword",
      jobAction: "instant",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.woodenFencer],
      qualitySeed: 10,
    });
    assert.ok(
      rejected.summary.warnings.includes(
        `crafting_rejected:tool_durability_depleted:${HARTHMERE_CRAFTING_TOOLS.woodenFencer}`
      ),
      JSON.stringify(rejected.summary)
    );
  });

  it("restores target durability for repair crafting workflows", () => {
    const state = freshState();
    state.classMagic.knownRecipes = ["harthmere_blacksmith_repair_iron_sword"];
    state.classMagic.skills = {
      character_level: { level: 5, xp: 0 },
      smithing: { level: 2, xp: 0 },
      blacksmithing: { level: 2, xp: 0 },
    };
    state.inventory.gold = 10;
    state.inventory.items = {
      iron_sword: 1,
      repair_part: 1,
      [HARTHMERE_CRAFTING_TOOLS.woodenFencer]: 1,
    };
    state.crafting.itemDurability.iron_sword = 11;

    const repaired = reduce(state, {
      recipeId: "harthmere_blacksmith_repair_iron_sword",
      jobAction: "instant",
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
      toolItemIds: [HARTHMERE_CRAFTING_TOOLS.woodenFencer],
      targetItemId: "iron_sword",
    });
    assert.strictEqual(repaired.state.crafting.itemDurability.iron_sword, 120);
    assert.strictEqual(repaired.state.inventory.items.repair_part ?? 0, 0);
  });

  it("exposes a crafting station client snapshot for the separate station UI", () => {
    const state = freshState();
    const snapshot = createHarthmereCraftingStationClientSnapshotFromBackend(
      state,
      HARTHMERE_CRAFTING_STATIONS.workbench
    );
    assert.strictEqual(snapshot.stationName, "Workbench");
    assert.strictEqual(snapshot.materialStorage.softwood_log, 4);
    assert.ok(snapshot.knownRecipes.includes("harthmere_carpentry_wood_plank"));
  });

  it("normalizes placed Bikkie crafting station ids in the client snapshot", () => {
    const state = freshState();
    const snapshot = createHarthmereCraftingStationClientSnapshotFromBackend(
      state,
      BikkieIds.thermoblaster
    );
    assert.strictEqual(
      snapshot.stationId,
      HARTHMERE_CRAFTING_STATIONS.thermoblaster
    );
    assert.strictEqual(snapshot.stationName, "Thermoblaster");
  });
});
