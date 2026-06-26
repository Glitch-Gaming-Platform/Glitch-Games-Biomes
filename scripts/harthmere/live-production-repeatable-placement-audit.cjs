#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority.ts");
const {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
} = require("../../src/shared/harthmere/jobs_board_business_templates.ts");
const {
  HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS,
  harthmereJobsBoardMuckBountyTargetForId,
} = require("../../src/shared/harthmere/jobs_board_muck_bounty_targets.ts");
const {
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} = require("../../src/shared/harthmere/jobs_board_quest_marker_positions.ts");
const {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
} = require("../../src/shared/harthmere/live_entity_production_seed.ts");
const {
  muckMonsterAreaForPosition,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai.ts");
const {
  getHarthmereProductionPlacementByKey,
  harthmereProductionPlacementKey,
} = require("../../src/shared/harthmere/production_terrain_placement_map.ts");

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
const SAMPLE_COUNT = Math.max(
  1,
  Math.floor(Number(process.env.HARTHMERE_REPEATABLE_AUDIT_SAMPLES ?? 6))
);
const SAMPLE_SLEEP_MS = Math.max(
  0,
  Math.floor(Number(process.env.HARTHMERE_REPEATABLE_AUDIT_SAMPLE_SLEEP_MS ?? 250))
);
const GENERATE_LIVE_POSTINGS =
  process.env.HARTHMERE_REPEATABLE_AUDIT_GENERATE === "1";
const GENERATION_CYCLES = Math.max(
  1,
  Math.floor(Number(process.env.HARTHMERE_REPEATABLE_AUDIT_GENERATION_CYCLES ?? 12))
);
const GENERATION_STEP_MS = Math.max(
  8 * 24 * 60 * 60 * 1000,
  Math.floor(
    Number(
      process.env.HARTHMERE_REPEATABLE_AUDIT_GENERATION_STEP_MS ??
        31 * 24 * 60 * 60 * 1000
    )
  )
);
const REQUEST_SLEEP_MS = Math.max(
  0,
  Math.floor(Number(process.env.HARTHMERE_REPEATABLE_AUDIT_REQUEST_SLEEP_MS ?? 50))
);
const RUN_ID = `live-repeatable-placement-${new Date()
  .toISOString()
  .replace(/[^0-9A-Za-z]+/g, "-")
  .replace(/-$/, "")}`;
const REPORT_PATH =
  process.env.HARTHMERE_REPEATABLE_PLACEMENT_REPORT ??
  path.join(
    process.cwd(),
    `.harthmere-live-repeatable-placement-audit-${INSTALL_ID}-${RUN_ID}.json`
  );

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finiteVec3(position) {
  return (
    Array.isArray(position) &&
    position.length >= 3 &&
    position.every((value) => Number.isFinite(Number(value)))
  );
}

function vecKey(position) {
  return finiteVec3(position)
    ? position.map((value) => Number(value).toFixed(2)).join(",")
    : "missing";
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
    body = { parseError: text.slice(0, 800) };
  }
  if (!response.ok || body?.ok === false) {
    const error = new Error(
      body?.error ?? body?.parseError ?? `HTTP ${response.status}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

let sequence = 0;
function nextRequestId(label) {
  sequence += 1;
  return `${RUN_ID}:${String(sequence).padStart(4, "0")}:${label}`.slice(
    0,
    180
  );
}

async function postLive(actionKind, subsystem, payload, options = {}) {
  const requestId = options.requestId ?? nextRequestId(options.label ?? actionKind);
  const body = {
    requestId,
    idempotencyKey: requestId,
    targetId: options.targetId,
    actionKind,
    subsystem,
    actorEntityVersion: 1,
    targetEntityVersion: options.targetId ? 1 : undefined,
    zoneId: options.zoneId ?? "harthmere_live_repeatable_placement_audit",
    clientSentAtMs: Date.now(),
    payload,
    clientClaims: options.clientClaims ?? {},
  };
  const response = await jsonFetch("/api/harthmere/live_mode", {
    method: "POST",
    body: JSON.stringify(body),
  });
  await sleep(REQUEST_SLEEP_MS);
  return {
    requestId,
    warnings: response?.backendMutation?.warnings ?? response?.warnings ?? [],
    touchedModels: response?.backendMutation?.touchedModels ?? [],
  };
}

function isRepeatableHunt(job) {
  return (
    job?.monsterId === "mucker" ||
    job?.monsterId === "hex" ||
    Boolean(
      job?.mapMarkerId &&
        harthmereJobsBoardMuckBountyTargetForId(job.mapMarkerId)
    ) ||
    Boolean(
      job?.targetId && harthmereJobsBoardMuckBountyTargetForId(job.targetId)
    )
  );
}

function isRepeatableDelivery(job) {
  return (
    job?.kind === "delivery" &&
    (job.requirements ?? []).some((req) => Boolean(req.itemId))
  );
}

function markerForId(markerId, source) {
  if (!markerId) return undefined;
  const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(markerId);
  const placement =
    getHarthmereProductionPlacementByKey(
      harthmereProductionPlacementKey("jobs_board_marker", markerId)
    ) ??
    getHarthmereProductionPlacementByKey(
      harthmereProductionPlacementKey("live_muck_monster", markerId)
    );
  return {
    markerId,
    source,
    resolved: Boolean(marker),
    label: marker?.label,
    markerSource: marker?.source,
    position: marker?.position,
    positionKey: vecKey(marker?.position),
    productionPlacement: placement
      ? {
          key: placement.key,
          mode: placement.placementMode,
          purpose: placement.purpose,
          surfaceFeetY: placement.surfaceFeetY,
          nearestFeetY: placement.nearestFeetY,
          deltaY: placement.deltaY,
          notes: placement.notes,
        }
      : undefined,
  };
}

function requirementMarkers(requirements) {
  const markers = [];
  for (const req of requirements ?? []) {
    if (req.pickupMarkerId) {
      markers.push(markerForId(req.pickupMarkerId, "requirement_pickup"));
    }
    if (req.mapMarkerId) {
      markers.push(markerForId(req.mapMarkerId, "requirement_map"));
    }
    if (req.targetId && !req.mapMarkerId) {
      const targetMarker = markerForId(req.targetId, "requirement_target");
      if (targetMarker?.resolved) {
        markers.push(targetMarker);
      }
    }
    if (req.recipientNpcId) {
      markers.push(
        markerForId(`harthmere_owner:${req.recipientNpcId}`, "recipient_npc")
      );
    }
  }
  return markers.filter(Boolean);
}

function classifySourceTemplate(template, source) {
  const markers = [
    markerForId(template.mapMarkerId, "job_map"),
    ...requirementMarkers(template.requirements),
  ].filter(Boolean);
  if (template.targetId && !template.mapMarkerId) {
    const targetMarker = markerForId(template.targetId, "job_target");
    if (targetMarker?.resolved) {
      markers.push(targetMarker);
    }
  }
  const bounty = isRepeatableHunt(template)
    ? harthmereJobsBoardMuckBountyTargetForId(
        template.mapMarkerId ?? template.targetId
      )
    : undefined;
  return {
    source,
    templateId: template.templateId,
    kind: template.kind,
    monsterId: template.monsterId,
    monsterTier: template.monsterTier,
    mapMarkerId: template.mapMarkerId,
    targetId: template.targetId,
    requirements: template.requirements,
    markers,
    bounty: bounty
      ? {
          targetId: bounty.targetId,
          markerId: bounty.markerId,
          areaId: bounty.areaId,
          seedId: bounty.seedId,
          monsterId: bounty.monsterId,
          monsterTier: bounty.monsterTier,
          position: bounty.position,
          inMuckArea: Boolean(muckMonsterAreaForPosition(bounty.position, 1.5)),
        }
      : undefined,
  };
}

function classifyLiveJob(job, sampleIndex) {
  const markers = [
    markerForId(job.mapMarkerId, "job_map"),
    ...requirementMarkers(job.requirements),
  ].filter(Boolean);
  if (job.targetId && !job.mapMarkerId) {
    const targetMarker = markerForId(job.targetId, "job_target");
    if (targetMarker?.resolved) {
      markers.push(targetMarker);
    }
  }
  const bounty = isRepeatableHunt(job)
    ? harthmereJobsBoardMuckBountyTargetForId(job.mapMarkerId ?? job.targetId)
    : undefined;
  return {
    sampleIndex,
    jobId: job.jobId,
    boardId: job.boardId,
    templateId: job.templateId,
    kind: job.kind,
    status: job.status,
    monsterId: job.monsterId,
    monsterTier: job.monsterTier,
    mapMarkerId: job.mapMarkerId,
    targetId: job.targetId,
    createdAtMs: job.createdAtMs,
    deadlineAtMs: job.deadlineAtMs,
    logs: job.logs,
    requirements: job.requirements,
    markers,
    bounty: bounty
      ? {
          targetId: bounty.targetId,
          markerId: bounty.markerId,
          areaId: bounty.areaId,
          seedId: bounty.seedId,
          monsterId: bounty.monsterId,
          monsterTier: bounty.monsterTier,
          position: bounty.position,
          inMuckArea: Boolean(muckMonsterAreaForPosition(bounty.position, 1.5)),
        }
      : undefined,
  };
}

function addFailure(failures, subject, code, detail = {}) {
  failures.push({
    subject,
    code,
    detail,
  });
}

function auditRecord(record, failures, options = {}) {
  const subject =
    record.jobId ??
    record.templateId ??
    `${record.source ?? "unknown"}:${record.kind ?? "unknown"}`;
  for (const marker of record.markers ?? []) {
    if (!marker.resolved) {
      addFailure(failures, subject, "marker_unresolved", {
        markerId: marker.markerId,
        markerSource: marker.source,
      });
      continue;
    }
    if (!finiteVec3(marker.position)) {
      addFailure(failures, subject, "marker_position_invalid", {
        markerId: marker.markerId,
        markerSource: marker.source,
        position: marker.position,
      });
      continue;
    }
    if (Number(marker.position[1]) < 0) {
      addFailure(failures, subject, "marker_below_world_floor", {
        markerId: marker.markerId,
        markerSource: marker.source,
        position: marker.position,
      });
    }
  }

  if (isRepeatableHunt(record)) {
    if (!record.bounty) {
      addFailure(failures, subject, "hunt_missing_muck_bounty_target", {
        mapMarkerId: record.mapMarkerId,
        targetId: record.targetId,
      });
    } else {
      if (record.bounty.monsterId !== record.monsterId) {
        addFailure(failures, subject, "hunt_monster_id_mismatch", {
          jobMonsterId: record.monsterId,
          targetMonsterId: record.bounty.monsterId,
        });
      }
      if (!record.bounty.inMuckArea) {
        addFailure(failures, subject, "hunt_target_outside_muck_area", {
          markerId: record.bounty.markerId,
          position: record.bounty.position,
          areaId: record.bounty.areaId,
        });
      }
    }
  }

  if (isRepeatableDelivery(record)) {
    const deliveryReqs = (record.requirements ?? []).filter((req) => req.itemId);
    if (!deliveryReqs.length) {
      addFailure(failures, subject, "delivery_missing_item_requirement");
    }
    for (const req of deliveryReqs) {
      if (!req.mapMarkerId && !req.recipientNpcId) {
        addFailure(failures, subject, "delivery_missing_dropoff_marker", {
          requirement: req,
        });
      }
      if (options.requireDeliveryPickup !== false && !req.pickupMarkerId) {
        addFailure(failures, subject, "delivery_grants_on_accept_not_pickup", {
          itemId: req.itemId,
          mapMarkerId: req.mapMarkerId,
          recipientNpcId: req.recipientNpcId,
        });
      }
    }
  }
}

function summarizeRandomization(records) {
  const byTemplate = new Map();
  for (const record of records) {
    if (!record.templateId) continue;
    if (!isRepeatableHunt(record) && !isRepeatableDelivery(record)) continue;
    const entry = byTemplate.get(record.templateId) ?? {
      templateId: record.templateId,
      kind: record.kind,
      monsterId: record.monsterId,
      records: 0,
      markerIds: new Set(),
      positionKeys: new Set(),
      pickupMarkerIds: new Set(),
      pickupPositionKeys: new Set(),
    };
    entry.records += 1;
    for (const marker of record.markers ?? []) {
      if (marker.source === "requirement_pickup") {
        entry.pickupMarkerIds.add(marker.markerId);
        entry.pickupPositionKeys.add(marker.positionKey);
      }
      if (marker.source === "job_map" || marker.source === "requirement_map") {
        entry.markerIds.add(marker.markerId);
        entry.positionKeys.add(marker.positionKey);
      }
    }
    byTemplate.set(record.templateId, entry);
  }
  return [...byTemplate.values()].map((entry) => ({
    templateId: entry.templateId,
    kind: entry.kind,
    monsterId: entry.monsterId,
    records: entry.records,
    markerIds: [...entry.markerIds].sort(),
    uniqueMarkerCount: entry.markerIds.size,
    positionKeys: [...entry.positionKeys].sort(),
    uniquePositionCount: entry.positionKeys.size,
    pickupMarkerIds: [...entry.pickupMarkerIds].sort(),
    uniquePickupMarkerCount: entry.pickupMarkerIds.size,
    pickupPositionKeys: [...entry.pickupPositionKeys].sort(),
    uniquePickupPositionCount: entry.pickupPositionKeys.size,
  }));
}

function auditLiveRandomization(sourceTemplates, liveSummaries, failures) {
  const liveByTemplate = new Map(
    liveSummaries.map((summary) => [summary.templateId, summary])
  );
  for (const source of sourceTemplates) {
    const live = liveByTemplate.get(source.templateId);
    const subject = source.templateId;
    if (source.kind === "hunt" || source.monsterId) {
      if (!live || live.records < 2) {
        addFailure(failures, subject, "hunt_not_sampled_in_live_generations", {
          liveRecords: live?.records ?? 0,
        });
        continue;
      }
      if (live.uniquePositionCount <= 1) {
        addFailure(failures, subject, "hunt_not_randomized_per_generation", {
          liveUniquePositions: live.uniquePositionCount,
          liveMarkers: live.markerIds,
        });
      }
    }
    if (source.kind === "delivery") {
      if (!live || live.records < 2) {
        addFailure(failures, subject, "delivery_not_sampled_in_live_generations", {
          liveRecords: live?.records ?? 0,
        });
        continue;
      }
      if (live.uniquePositionCount <= 1) {
        addFailure(failures, subject, "delivery_dropoff_not_randomized_per_generation", {
          liveUniquePositions: live.uniquePositionCount,
          liveMarkers: live.markerIds,
        });
      }
      if (live.uniquePickupMarkerCount <= 1) {
        addFailure(failures, subject, "delivery_pickup_not_randomized_per_generation", {
          liveUniquePickupPositions: live.uniquePickupPositionCount,
          livePickupMarkers: live.pickupMarkerIds,
        });
      }
    }
  }
}

function auditMuckSeeds(failures) {
  const seedAudits = [];
  for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS) {
    const placement = getHarthmereProductionPlacementByKey(
      harthmereProductionPlacementKey("live_muck_monster", seed.seedId)
    );
    const position = placement?.recommendedPosition ?? seed.position;
    const inMuckArea = Boolean(muckMonsterAreaForPosition(position, 1.5));
    const audit = {
      seedId: seed.seedId,
      areaId: seed.areaId,
      combatKind: seed.combatKind,
      displayName: seed.displayName,
      position,
      inMuckArea,
      productionPlacement: placement
        ? {
            key: placement.key,
            mode: placement.placementMode,
            purpose: placement.purpose,
            surfaceFeetY: placement.surfaceFeetY,
            nearestFeetY: placement.nearestFeetY,
            deltaY: placement.deltaY,
          }
        : undefined,
    };
    seedAudits.push(audit);
    if (!finiteVec3(position)) {
      addFailure(failures, seed.seedId, "muck_seed_invalid_position", audit);
    }
    if (!inMuckArea) {
      addFailure(failures, seed.seedId, "muck_seed_outside_muck_area", audit);
    }
    if (!placement) {
      addFailure(failures, seed.seedId, "muck_seed_missing_production_placement", audit);
    }
  }
  return seedAudits;
}

async function main() {
  const report = {
    version: 1,
    runId: RUN_ID,
    baseUrl: BASE_URL,
    installId: INSTALL_ID,
    startedAt: new Date().toISOString(),
    sampleCount: SAMPLE_COUNT,
    generateLivePostings: GENERATE_LIVE_POSTINGS,
    generationCycles: GENERATE_LIVE_POSTINGS ? GENERATION_CYCLES : 0,
    sourceTemplates: [],
    liveSamples: [],
    liveRecords: [],
    generationActions: [],
    sourceRandomization: [],
    liveRandomization: [],
    muckSeedAudit: [],
    bountyTargetCount: HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.length,
    failures: [],
  };

  const sourceTemplates = [
    ...HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) => isRepeatableHunt(template) || isRepeatableDelivery(template)
    ).map((template) => classifySourceTemplate(template, "auto_seed_template")),
    ...HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.filter((template) =>
      isRepeatableDelivery(template)
    ).map((template) => classifySourceTemplate(template, "business_template")),
  ];
  report.sourceTemplates = sourceTemplates;
  for (const record of sourceTemplates) {
    auditRecord(record, report.failures, { requireDeliveryPickup: false });
  }

  async function collectLiveSample(sampleIndex) {
    let body;
    try {
      body = await jsonFetch("/api/harthmere/live_mode_jobs_board_state");
    } catch (error) {
      addFailure(report.failures, `sample:${sampleIndex}`, "live_sample_failed", {
        message: error instanceof Error ? error.message : String(error),
        status: error?.status,
        body: error?.body,
      });
      report.liveSamples.push({
        sampleIndex,
        at: new Date().toISOString(),
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const snapshot = body.jobsBoardState ?? {};
    const jobsById = new Map();
    for (const job of [
      ...(snapshot.openJobs ?? []),
      ...(snapshot.activeJobs ?? []),
      ...(snapshot.myAcceptedJobs ?? []),
    ]) {
      if (!job?.jobId) continue;
      if (job.status !== "open" && job.status !== "active") continue;
      jobsById.set(job.jobId, job);
    }
    const interesting = [...jobsById.values()].filter(
      (job) => isRepeatableHunt(job) || isRepeatableDelivery(job)
    );
    report.liveSamples.push({
      sampleIndex,
      at: new Date().toISOString(),
      openJobs: snapshot.openJobs?.length ?? 0,
      activeJobs: snapshot.activeJobs?.length ?? 0,
      myTodos: snapshot.myTodos?.length ?? 0,
      interestingJobs: interesting.length,
    });
    for (const job of interesting) {
      const record = classifyLiveJob(job, sampleIndex);
      report.liveRecords.push(record);
      auditRecord(record, report.failures);
    }
  }

  if (GENERATE_LIVE_POSTINGS) {
    const boardIds = [
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
    ];
    let baseNow = Date.now() + GENERATION_STEP_MS;
    try {
      const body = await jsonFetch("/api/harthmere/live_mode_jobs_board_state");
      const snapshot = body.jobsBoardState ?? {};
      const maxDeadline = [
        ...(snapshot.openJobs ?? []),
        ...(snapshot.activeJobs ?? []),
        ...(snapshot.myAcceptedJobs ?? []),
      ].reduce((max, job) => {
        if (job?.status !== "open" && job?.status !== "active") return max;
        const deadline = Number(job?.deadlineAtMs);
        return Number.isFinite(deadline) ? Math.max(max, deadline) : max;
      }, 0);
      baseNow = Math.max(baseNow, maxDeadline + 1_000);
    } catch (error) {
      addFailure(report.failures, "generation_base", "generation_base_probe_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    report.generationBaseNow = baseNow;
    for (let i = 0; i < GENERATION_CYCLES; i += 1) {
      const nowMs = baseNow + i * GENERATION_STEP_MS;
      for (const boardId of boardIds) {
        try {
          const action = await postLive(
            "request_jobs_board_mutation",
            "jobs",
            {
              operation: "economy_auto_seed_jobs",
              boardId,
              nowMs,
            },
            {
              label: `seed:${boardId}:${i}`,
            }
          );
          report.generationActions.push({
            cycle: i,
            boardId,
            nowMs,
            ...action,
          });
        } catch (error) {
          addFailure(
            report.failures,
            `${boardId}:${i}`,
            "generation_request_failed",
            {
              message: error instanceof Error ? error.message : String(error),
              body: error?.body,
            }
          );
        }
      }
      await collectLiveSample(i);
    }
  } else {
    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      await collectLiveSample(i);
      if (i + 1 < SAMPLE_COUNT) {
        await sleep(SAMPLE_SLEEP_MS);
      }
    }
  }

  report.sourceRandomization = summarizeRandomization(sourceTemplates);
  report.liveRandomization = summarizeRandomization(report.liveRecords);
  auditLiveRandomization(
    sourceTemplates,
    report.liveRandomization,
    report.failures
  );
  report.muckSeedAudit = auditMuckSeeds(report.failures);
  report.completedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;

  const tmp = `${REPORT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2));
  fs.renameSync(tmp, REPORT_PATH);

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        reportPath: REPORT_PATH,
        failures: report.failures.length,
        liveRecords: report.liveRecords.length,
        sourceTemplates: report.sourceTemplates.length,
        bountyTargetCount: report.bountyTargetCount,
      },
      null,
      2
    )
  );
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
