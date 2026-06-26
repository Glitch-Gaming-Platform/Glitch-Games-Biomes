#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const {
  HARTHMERE_QUEST_CATALOG,
} = require("../../src/shared/harthmere/quest_compendium.ts");
const {
  SNAPSHOT_ROAD_AHEAD_MISSION,
} = require("../../src/shared/harthmere/snapshot_complete_port.ts");
const {
  QUESTS: LOCAL_HARTHMERE_QUESTS,
} = require("../../src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const {
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  getLiveEntityHelperQuestForEntity,
} = require("../../src/shared/harthmere/live_entity_helper_quests.ts");

const DEFAULT_BASE_URL =
  "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io";
const INSTALL_ID =
  process.env.HARTHMERE_INSTALL_ID ??
  process.argv[2] ??
  "25f687dd-9ebe-4c31-8810-719ddfafe66b";
const BASE_URL = (process.env.HARTHMERE_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/$/,
  ""
);
const RUN_ID = `live-full-${new Date()
  .toISOString()
  .replace(/[^0-9A-Za-z]+/g, "-")
  .replace(/-$/, "")}`;
const REPORT_PATH =
  process.env.HARTHMERE_LIVE_RUN_REPORT ??
  path.join(process.cwd(), `.harthmere-live-run-${INSTALL_ID}-${RUN_ID}.json`);
const ACCEPT_COOLDOWN_MS = Number(
  process.env.HARTHMERE_JOB_ACCEPT_SLEEP_MS ?? 3250
);
const REQUEST_SLEEP_MS = Number(process.env.HARTHMERE_REQUEST_SLEEP_MS ?? 20);
const SELECTED_PHASES = new Set(
  (process.env.HARTHMERE_LIVE_RUN_PHASES ?? "quests,helpers,jobs")
    .split(",")
    .map((phase) => phase.trim().toLowerCase())
    .filter(Boolean)
);

let sequence = 0;
const startedAt = Date.now();
const report = {
  version: 1,
  runId: RUN_ID,
  baseUrl: BASE_URL,
  installId: INSTALL_ID,
  startedAt: new Date(startedAt).toISOString(),
  actorId: undefined,
  totals: {},
  failures: [],
  warnings: [],
  phases: [],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextRequestId(prefix) {
  sequence += 1;
  return `${RUN_ID}:${String(sequence).padStart(5, "0")}:${prefix}`.slice(
    0,
    180
  );
}

function liveUrl(pathname) {
  return `${BASE_URL}${pathname}?install_id=${encodeURIComponent(INSTALL_ID)}`;
}

async function jsonFetch(pathname, options = {}) {
  const response = await fetch(liveUrl(pathname), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Glitch-Install-Id": INSTALL_ID,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { parseError: text.slice(0, 400) };
  }
  if (!response.ok || body?.ok === false) {
    const message =
      body?.validation?.errors?.join(",") ??
      body?.error ??
      body?.parseError ??
      `HTTP ${response.status}`;
    const error = new Error(message || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function getQuestState() {
  return (await jsonFetch("/api/harthmere/live_mode_quest_state")).questState;
}

async function getJobsBoardState() {
  return (await jsonFetch("/api/harthmere/live_mode_jobs_board_state"))
    .jobsBoardState;
}

async function getInventoryState() {
  return (await jsonFetch("/api/harthmere/live_mode_inventory_loot_state"))
    .inventoryLootState;
}

async function postLive(actionKind, subsystem, payload, options = {}) {
  const requestId = options.requestId ?? nextRequestId(actionKind);
  const body = {
    requestId,
    idempotencyKey: requestId,
    targetId: options.targetId,
    actionKind,
    subsystem,
    actorEntityVersion: 1,
    targetEntityVersion: options.targetId ? 1 : undefined,
    zoneId: options.zoneId ?? "harthmere_live_full_run",
    clientSentAtMs: Date.now(),
    payload,
    clientClaims: options.clientClaims ?? {},
  };
  const response = await jsonFetch("/api/harthmere/live_mode", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const warnings = response?.backendMutation?.warnings ?? [];
  if (warnings.length) {
    report.warnings.push({ requestId, actionKind, subsystem, warnings });
  }
  await sleep(REQUEST_SLEEP_MS);
  return { requestId, response, warnings };
}

function phase(name) {
  const entry = {
    name,
    startedAt: new Date().toISOString(),
    completedAt: undefined,
    items: [],
  };
  report.phases.push(entry);
  console.log(`\n== ${name} ==`);
  return entry;
}

function finishPhase(entry) {
  entry.completedAt = new Date().toISOString();
  writeReport();
}

function writeReport() {
  const tmp = `${REPORT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2));
  fs.renameSync(tmp, REPORT_PATH);
}

function questTitle(quest) {
  return quest.title ?? quest.displayName ?? quest.id;
}

function catalogQuestObjectives(quest) {
  return (quest.objectives ?? []).map((objective, index) => ({
    id: objective.id ?? `${quest.id}:objective:${index + 1}`,
    label: objective.label ?? objective.targetName ?? `Objective ${index + 1}`,
    count: Math.max(1, Math.trunc(Number(objective.count ?? 1))),
  }));
}

function localQuestObjectives(quest) {
  return (quest.steps ?? []).map((step, index) => ({
    id: `${quest.id}:step:${index + 1}`,
    label: step.objective ?? `Step ${index + 1}`,
    count: 1,
  }));
}

function snapshotMissionObjectives(mission) {
  return mission.steps.map((step, index) => ({
    id: step.id ?? `${mission.id}:step:${index + 1}`,
    label: step.objective ?? step.title ?? `Step ${index + 1}`,
    count: 1,
  }));
}

function uniqueQuestSpecs() {
  const specs = [];
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    specs.push({
      source: "quest_compendium",
      id: quest.id,
      title: questTitle(quest),
      objectives: catalogQuestObjectives(quest),
    });
  }
  for (const quest of LOCAL_HARTHMERE_QUESTS) {
    specs.push({
      source: "local_harthmere_mission",
      id: quest.id,
      title: questTitle(quest),
      objectives: localQuestObjectives(quest),
    });
  }
  specs.push({
    source: "snapshot_road_ahead_mission",
    id: SNAPSHOT_ROAD_AHEAD_MISSION.id,
    title: SNAPSHOT_ROAD_AHEAD_MISSION.title,
    objectives: snapshotMissionObjectives(SNAPSHOT_ROAD_AHEAD_MISSION),
  });

  const seen = new Set();
  return specs.filter((spec) => {
    if (seen.has(spec.id)) return false;
    seen.add(spec.id);
    return true;
  });
}

async function executeQuestSpec(spec, phaseEntry) {
  const item = {
    id: spec.id,
    title: spec.title,
    source: spec.source,
    objectiveCount: spec.objectives.length,
    requests: [],
    completed: false,
    warnings: [],
  };
  phaseEntry.items.push(item);
  try {
    const first = spec.objectives[0];
    item.requests.push(
      await postLive("request_quest_state_update", "quest", {
        questId: spec.id,
        completed: false,
        stepId: first?.id ?? "accepted",
        progress: 0,
        source: spec.source,
        title: spec.title,
      })
    );
    for (let i = 0; i < spec.objectives.length; i += 1) {
      const objective = spec.objectives[i];
      for (let count = 1; count <= objective.count; count += 1) {
        item.requests.push(
          await postLive("request_quest_state_update", "quest", {
            questId: spec.id,
            completed: false,
            stepId: objective.id,
            progress: i + count / objective.count,
            source: spec.source,
            title: spec.title,
            objectiveId: objective.id,
            objectiveLabel: objective.label,
          })
        );
      }
    }
    item.requests.push(
      await postLive("request_quest_state_update", "quest", {
        questId: spec.id,
        completed: true,
        stepId: "complete",
        progress: spec.objectives.length,
        source: spec.source,
        title: spec.title,
      })
    );
    const questState = await getQuestState();
    item.completed = questState.completed?.[spec.id] !== undefined;
    if (!item.completed) {
      throw new Error("quest_not_present_in_live_completed_state");
    }
    console.log(`OK quest ${spec.id} (${spec.objectives.length} objectives)`);
  } catch (error) {
    const failure = {
      phase: "quests",
      id: spec.id,
      title: spec.title,
      error: String(error?.message ?? error),
      body: error?.body,
    };
    item.error = failure.error;
    report.failures.push(failure);
    console.log(`FAIL quest ${spec.id}: ${failure.error}`);
  } finally {
    writeReport();
  }
}

async function executeAllQuests() {
  const entry = phase("Live quest and mission state execution");
  const specs = uniqueQuestSpecs();
  report.totals.questSpecsPlanned = specs.length;
  report.totals.questObjectiveMutationsPlanned = specs.reduce(
    (sum, spec) =>
      sum +
      2 +
      spec.objectives.reduce((inner, objective) => inner + objective.count, 0),
    0
  );
  for (const spec of specs) {
    await executeQuestSpec(spec, entry);
  }
  finishPhase(entry);
}

async function grantItem(itemId, count, reason) {
  if (!itemId || count <= 0) return undefined;
  const needsBackpackGrant = String(reason).startsWith("live_entity_helper:");
  return postLive("request_loot_roll", "loot", {
    itemId,
    count,
    itemDeltas: needsBackpackGrant ? { [itemId]: count } : undefined,
    source: reason,
  });
}

function itemCountsFromInventoryState(state) {
  return {
    ...(state?.actor?.items ?? {}),
    ...(state?.materialStorage?.items ?? state?.materialStorage ?? {}),
  };
}

async function ensureItems(items, reason) {
  const inventory = await getInventoryState();
  const counts = itemCountsFromInventoryState(inventory);
  const grants = [];
  for (const [itemId, needed] of Object.entries(items)) {
    const have = Math.max(0, Math.trunc(Number(counts[itemId] ?? 0)));
    const deficit = Math.max(0, Math.trunc(Number(needed)) - have);
    if (deficit > 0) {
      grants.push(await grantItem(itemId, deficit, reason));
    }
  }
  return grants;
}

function completionPayloadForJob(job, todo) {
  const completionItemDeltas = {};
  let completedTargetId = job.targetId ?? todo?.targetId ?? job.mapMarkerId;
  let usedToolAction;
  for (const req of job.requirements ?? []) {
    if (req.itemId) {
      completionItemDeltas[req.itemId] = -Math.max(
        1,
        Math.trunc(Number(req.count ?? 1))
      );
    }
    if (req.targetId) {
      completedTargetId = req.targetId;
    }
    if (req.recipientNpcId) {
      completedTargetId = `harthmere_owner:${req.recipientNpcId}`;
    }
    if (req.requiredToolAction) {
      usedToolAction = req.requiredToolAction;
    }
  }
  return {
    completedTargetId,
    usedToolAction,
    completionItemDeltas:
      Object.keys(completionItemDeltas).length > 0
        ? completionItemDeltas
        : undefined,
  };
}

function jobTodoByStatus(todos, jobId, statuses) {
  const wanted = new Set(statuses);
  return (todos ?? []).find(
    (candidate) => candidate.jobId === jobId && wanted.has(candidate.status)
  );
}

async function seedEveryJobsBoard() {
  const entry = phase("Persist live jobs on every board");
  const initial = await getJobsBoardState();
  report.actorId = initial.actorId;
  for (const boardId of Object.keys(initial.boards ?? {})) {
    const item = { boardId, request: undefined, warnings: [] };
    entry.items.push(item);
    try {
      item.request = await postLive("request_jobs_board_mutation", "jobs", {
        operation: "economy_auto_seed_jobs",
        boardId,
      });
      item.warnings = item.request.warnings;
      console.log(`OK seed ${boardId}`);
    } catch (error) {
      const failure = {
        phase: "jobs_seed",
        id: boardId,
        error: String(error?.message ?? error),
        body: error?.body,
      };
      item.error = failure.error;
      report.failures.push(failure);
      console.log(`FAIL seed ${boardId}: ${failure.error}`);
    } finally {
      writeReport();
    }
  }
  finishPhase(entry);
}

async function acceptJob(job) {
  return postLive("request_jobs_board_mutation", "jobs", {
    operation: "accept_job",
    boardId: job.boardId,
    jobId: job.jobId,
  });
}

async function abandonJob(job) {
  return postLive("request_jobs_board_mutation", "jobs", {
    operation: "abandon_job",
    boardId: job.boardId,
    jobId: job.jobId,
  });
}

async function completeEscortIfNeeded(job, item) {
  if (job.kind !== "escort") return;
  let state = await getJobsBoardState();
  let current = [...(state.myAcceptedJobs ?? []), ...(state.activeJobs ?? [])]
    .filter((candidate) => candidate.jobId === job.jobId)
    .at(-1);
  const companion = current?.escortCompanion;
  if (!companion?.entityId || !companion.destination) {
    return;
  }
  for (let i = 0; i < 32; i += 1) {
    current = (await getJobsBoardState()).activeJobs?.find(
      (candidate) => candidate.jobId === job.jobId
    );
    if (!current || current.escortCompanion?.status === "arrived") {
      return;
    }
    const destination = current.escortCompanion.destination;
    const tick = await postLive(
      "request_npc_ai_tick",
      "npc_ai",
      {
        npcId: String(current.escortCompanion.entityId),
        thinkIntervalMs: 10_000,
      },
      {
        targetId: String(current.escortCompanion.entityId),
        clientClaims: {
          runtimePosition: {
            x: destination.x,
            y: destination.y,
            z: destination.z,
          },
        },
      }
    );
    item.requests.push(tick);
    if (
      tick.response?.jobsBoardState?.myTodos?.some(
        (todo) => todo.jobId === job.jobId && todo.status === "completed"
      )
    ) {
      return;
    }
  }
}

async function executeJob(job, phaseEntry) {
  const item = {
    jobId: job.jobId,
    templateId: job.templateId,
    title: job.title,
    kind: job.kind,
    boardId: job.boardId,
    requests: [],
    completed: false,
    warnings: [],
  };
  phaseEntry.items.push(item);
  try {
    await ensureItems(
      Object.fromEntries(
        (job.requirements ?? [])
          .filter((req) => req.itemId)
          .map((req) => [
            req.itemId,
            Math.max(1, Math.trunc(Number(req.count ?? 1))),
          ])
      ),
      `job_requirement:${job.jobId}`
    );
    let state = await getJobsBoardState();
    let currentAccepted = (state.myAcceptedJobs ?? []).find(
      (candidate) => candidate.jobId === job.jobId
    );
    let todo =
      jobTodoByStatus(state.myTodos, job.jobId, ["active", "completed"]) ??
      undefined;
    if (currentAccepted?.status === "active" && !todo) {
      item.requests.push(await abandonJob(currentAccepted));
      await sleep(ACCEPT_COOLDOWN_MS);
      currentAccepted = undefined;
      todo = undefined;
    }
    if (!currentAccepted && todo?.status !== "completed") {
      item.requests.push(await acceptJob(job));
      await sleep(ACCEPT_COOLDOWN_MS);
    }
    await completeEscortIfNeeded(job, item);
    state = await getJobsBoardState();
    todo =
      jobTodoByStatus(state.myTodos, job.jobId, ["active"]) ??
      jobTodoByStatus(state.myTodos, job.jobId, [
        "cancelled",
        "failed",
        "expired",
      ]);
    let currentJob =
      (state.activeJobs ?? []).find(
        (candidate) => candidate.jobId === job.jobId
      ) ??
      (state.myAcceptedJobs ?? []).find(
        (candidate) => candidate.jobId === job.jobId
      ) ??
      job;
    await ensureItems(
      Object.fromEntries(
        (currentJob.requirements ?? [])
          .filter((req) => req.itemId)
          .map((req) => [
            req.itemId,
            Math.max(1, Math.trunc(Number(req.count ?? 1))),
          ])
      ),
      `job_requirement:${currentJob.jobId}:current`
    );
    state = await getJobsBoardState();
    currentJob =
      (state.activeJobs ?? []).find(
        (candidate) => candidate.jobId === job.jobId
      ) ??
      (state.myAcceptedJobs ?? []).find(
        (candidate) => candidate.jobId === job.jobId
      ) ??
      currentJob;
    const completion = completionPayloadForJob(currentJob, todo);
    if (todo?.status !== "completed") {
      item.requests.push(
        await postLive("request_quest_state_update", "quest", {
          questId: `jobs_board:${todo?.todoId}`,
          completed: true,
          completedTargetId: completion.completedTargetId,
          completionNote: `live full runner completed ${job.jobId}`,
          completionItemDeltas: completion.completionItemDeltas,
          usedToolAction: completion.usedToolAction,
        })
      );
    }
    state = await getJobsBoardState();
    todo =
      jobTodoByStatus(state.myTodos, job.jobId, ["completed", "active"]) ??
      todo;
    item.requests.push(
      await postLive("request_jobs_board_mutation", "jobs", {
        operation: "complete_job",
        boardId: job.boardId,
        jobId: job.jobId,
        questTodoId: todo?.todoId,
        completionNote: `live full runner turned in ${job.jobId}`,
      })
    );
    state = await getJobsBoardState();
    const completedJob = [
      ...(state.myAcceptedJobs ?? []),
      ...(state.activeJobs ?? []),
      ...(state.myPostedJobs ?? []),
      ...(state.openJobs ?? []),
    ].find((candidate) => candidate.jobId === job.jobId);
    const completedTodo =
      jobTodoByStatus(state.myTodos, job.jobId, ["completed"]) ??
      jobTodoByStatus(state.myTodos, job.jobId, [
        "active",
        "failed",
        "expired",
        "cancelled",
      ]);
    item.completed =
      completedJob?.status === "completed" ||
      completedTodo?.status === "completed";
    if (!item.completed) {
      throw new Error(
        `job_not_completed:${completedJob?.status ?? "missing"}:${
          completedTodo?.status ?? "no_todo"
        }`
      );
    }
    console.log(`OK job ${job.jobId} ${job.title}`);
  } catch (error) {
    const failure = {
      phase: "jobs",
      id: job.jobId,
      title: job.title,
      kind: job.kind,
      boardId: job.boardId,
      error: String(error?.message ?? error),
      body: error?.body,
    };
    item.error = failure.error;
    report.failures.push(failure);
    console.log(`FAIL job ${job.jobId}: ${failure.error}`);
    await sleep(ACCEPT_COOLDOWN_MS);
  } finally {
    writeReport();
  }
}

async function executeAllOpenJobs() {
  if (process.env.HARTHMERE_LIVE_RUN_SKIP_SEED !== "1") {
    await seedEveryJobsBoard();
  }
  const entry = phase("Live jobs full accept/objective/turn-in execution");
  const state = await getJobsBoardState();
  const openJobs = (state.openJobs ?? []).filter(
    (job) => job.status === "open"
  );
  const acceptedJobs = (state.myAcceptedJobs ?? []).filter(
    (job) => job.status === "active"
  );
  const jobsById = new Map();
  for (const job of [...acceptedJobs, ...openJobs]) {
    jobsById.set(job.jobId, job);
  }
  const jobsToRun = [...jobsById.values()];
  report.totals.openJobsAfterSeeding = openJobs.length;
  report.totals.acceptedJobsBeforeExecution = acceptedJobs.length;
  report.totals.jobsPlannedForExecution = jobsToRun.length;
  for (const job of jobsToRun) {
    await executeJob(job, entry);
  }
  finishPhase(entry);
}

function helperContextForKind(kind) {
  for (let index = 0; index < 5000; index += 1) {
    const entityId = `live-audit-helper-${kind}-${index}`;
    const label = `Live Audit Helper ${kind} ${index}`;
    const context = {
      entityId,
      label,
      position: [160 + (index % 20), 54, -620 - Math.floor(index / 20)],
      hasTalkableDialog: true,
    };
    const quest = getLiveEntityHelperQuestForEntity(context);
    if (quest?.kind === kind) {
      return { context, quest };
    }
  }
  throw new Error(`could_not_find_helper_context:${kind}`);
}

async function executeHelperQuest(kind, phaseEntry) {
  const { context, quest } = helperContextForKind(kind);
  const item = {
    questId: quest.questId,
    kind,
    entityId: quest.entityId,
    title: quest.title,
    requests: [],
    completed: false,
  };
  phaseEntry.items.push(item);
  const basePayload = {
    questId: quest.questId,
    questKind: quest.kind,
    entityId: quest.entityId,
    entityLabel: quest.giverName,
    entityX: context.position[0],
    entityY: context.position[1],
    entityZ: context.position[2],
    hasTalkableDialog: true,
  };
  try {
    item.requests.push(
      await postLive(
        "request_quest_state_update",
        "quest",
        { ...basePayload, operation: "live_entity_helper_accept" },
        { targetId: quest.entityId }
      )
    );
    const itemNeeds = {};
    for (const req of quest.requirements.items ?? []) {
      itemNeeds[req.itemId] = req.quantity;
    }
    await ensureItems(itemNeeds, `live_entity_helper:${kind}`);
    if (kind === "hard_boss") {
      item.requests.push(
        await postLive(
          "request_quest_state_update",
          "quest",
          {
            ...basePayload,
            operation: "live_entity_helper_record_boss_defeat",
            bossDefeated: true,
            bossKillCredit: 1,
          },
          { targetId: quest.entityId }
        )
      );
    }
    item.requests.push(
      await postLive(
        "request_quest_state_update",
        "quest",
        { ...basePayload, operation: "live_entity_helper_complete" },
        { targetId: quest.entityId }
      )
    );
    const questState = await getQuestState();
    item.completed = questState.completed?.[quest.questId] !== undefined;
    if (!item.completed) {
      throw new Error("helper_quest_not_present_in_live_completed_state");
    }
    console.log(`OK helper ${kind} ${quest.questId}`);
  } catch (error) {
    const failure = {
      phase: "helper_quests",
      id: quest.questId,
      kind,
      error: String(error?.message ?? error),
      body: error?.body,
    };
    item.error = failure.error;
    report.failures.push(failure);
    console.log(`FAIL helper ${kind}: ${failure.error}`);
  } finally {
    writeReport();
  }
}

async function executeAllHelperQuests() {
  const entry = phase("Live entity helper subquest execution");
  const kinds = Object.keys(LIVE_ENTITY_HELPER_QUEST_DEFINITIONS);
  report.totals.helperQuestKindsPlanned = kinds.length;
  for (const kind of kinds) {
    await executeHelperQuest(kind, entry);
  }
  finishPhase(entry);
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Install ID: ${INSTALL_ID}`);
  console.log(`Report: ${REPORT_PATH}`);
  const questState = await getQuestState();
  report.actorId = questState.actorId;
  console.log(`Actor: ${report.actorId}`);
  if (SELECTED_PHASES.has("quests")) {
    await executeAllQuests();
  }
  if (SELECTED_PHASES.has("helpers")) {
    await executeAllHelperQuests();
  }
  if (SELECTED_PHASES.has("jobs")) {
    await executeAllOpenJobs();
  }
  const finalQuestState = await getQuestState();
  const finalJobsState = await getJobsBoardState();
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
  report.totals.completedQuestCount = Object.keys(
    finalQuestState.completed ?? {}
  ).length;
  report.totals.activeQuestCount = Object.keys(
    finalQuestState.active ?? {}
  ).length;
  report.totals.finalOpenJobCount = finalJobsState.openJobs?.length ?? 0;
  report.totals.finalAcceptedJobCount =
    finalJobsState.myAcceptedJobs?.length ?? 0;
  report.totals.finalTodoCount = finalJobsState.myTodos?.length ?? 0;
  report.totals.failureCount = report.failures.length;
  writeReport();
  console.log("\n== RESULT ==");
  console.log(JSON.stringify(report.totals, null, 2));
  if (report.failures.length) {
    console.log(`FAILURES: ${report.failures.length}`);
    console.log(
      report.failures
        .slice(0, 20)
        .map((failure) => `${failure.phase}:${failure.id}:${failure.error}`)
        .join("\n")
    );
    process.exitCode = 1;
  } else {
    console.log("PASS live full execution completed without recorded failures");
  }
}

main().catch((error) => {
  report.fatal = {
    error: String(error?.stack ?? error?.message ?? error),
    body: error?.body,
  };
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
  writeReport();
  console.error(error?.stack ?? error);
  process.exit(1);
});
