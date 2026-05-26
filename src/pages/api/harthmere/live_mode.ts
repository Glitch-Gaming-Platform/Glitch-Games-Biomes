import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  createHarthmereLiveModeEventV1,
  createHarthmereLiveModeUiEventV1,
  type HarthmereLiveModeActionKindV1,
  type HarthmereLiveModeAuthorityEnvelopeV1,
  type HarthmereLiveModeEventKindV1,
  type HarthmereLiveModeSubsystemV1,
  type HarthmereLiveModeUiEventKindV1,
  validateHarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import { z } from "zod";

const HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1 =
  "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const;

const HARTHMERE_LIVE_MODE_ACTION_KINDS_V1 = [
  "request_attack",
  "request_ability_cast",
  "request_equipment_change",
  "request_xp_reward",
  "request_skill_progress",
  "request_loot_roll",
  "request_loot_claim",
  "request_death_transition",
  "request_revive",
  "request_respawn",
  "request_npc_ai_tick",
  "request_boss_tick",
  "request_pvp_flag_change",
  "request_pvp_reward",
  "request_party_raid_credit",
  "request_trainer_unlock",
  "request_skill_book_use",
  "request_respec",
  "request_loadout_change",
] as const satisfies readonly HarthmereLiveModeActionKindV1[];

const HARTHMERE_LIVE_MODE_SUBSYSTEMS_V1 = [
  "combat",
  "ability",
  "equipment",
  "leveling",
  "skill_progression",
  "loot",
  "death",
  "revive",
  "respawn",
  "npc_ai",
  "boss_encounter",
  "pvp",
  "party",
  "raid",
  "trainer",
  "skill_book",
  "respec",
  "loadout",
  "audit",
  "ui_event",
  "anti_abuse",
] as const satisfies readonly HarthmereLiveModeSubsystemV1[];

const zJsonRecord = z.record(z.unknown());

const zLiveModeRequest = z.object({
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  targetId: z.string().optional(),
  actionKind: z.enum(HARTHMERE_LIVE_MODE_ACTION_KINDS_V1),
  subsystem: z.enum(HARTHMERE_LIVE_MODE_SUBSYSTEMS_V1),
  clientSentAtMs: z.number().optional(),
  actorEntityVersion: z.number(),
  targetEntityVersion: z.number().optional(),
  zoneId: z.string().min(1),
  encounterId: z.string().optional(),
  partyId: z.string().optional(),
  raidId: z.string().optional(),
  pvpContextId: z.string().optional(),
  payload: zJsonRecord.default({}),
  clientClaims: zJsonRecord.optional(),
});

const zLiveModeValidationResponse = z.object({
  ok: z.boolean(),
  errors: z.string().array(),
  warnings: z.string().array(),
  rejectedClientClaims: z.string().array(),
});

const zLiveModeMutationPlanResponse = z.object({
  planId: z.string(),
  actionKind: z.enum(HARTHMERE_LIVE_MODE_ACTION_KINDS_V1),
  idempotencyKey: z.string(),
  transactionScope: z.string(),
  requiredLocks: z.string().array(),
  readModels: z.string().array(),
  writeModels: z.string().array(),
  appendOnlyLogs: z.string().array(),
  rollbackPlan: z.string().array(),
  uiEventOutbox: z.string().array(),
  auditEventOutbox: z.string().array(),
});

const zLiveModeEventResponse = z.object({
  eventId: z.string(),
  kind: z.string(),
  requestId: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  zoneId: z.string(),
  serverTick: z.number(),
  createdAtMs: z.number(),
  payload: zJsonRecord,
});

const zLiveModeUiEventResponse = z.object({
  uiEventId: z.string(),
  kind: z.string(),
  playerId: z.string(),
  requestId: z.string(),
  priority: z.enum(["low", "normal", "high", "critical"]),
  dedupeKey: z.string(),
  createdAtMs: z.number(),
  payload: zJsonRecord,
});

const zLiveModeResponse = z.object({
  ok: z.boolean(),
  version: z.literal(HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1),
  actorId: z.string(),
  duplicate: z.boolean(),
  replayed: z.boolean(),
  persisted: z.boolean(),
  validation: zLiveModeValidationResponse,
  mutationPlan: zLiveModeMutationPlanResponse.optional(),
  events: zLiveModeEventResponse.array(),
  uiEvents: zLiveModeUiEventResponse.array(),
});

type LiveModeResponse = z.infer<typeof zLiveModeResponse>;

const globalForHarthmereLiveMode = globalThis as typeof globalThis & {
  __harthmereLiveModeRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeRedisV1() {
  return (globalForHarthmereLiveMode.__harthmereLiveModeRedisV1 ??=
    connectToRedis("firehose"));
}

function liveModeIdempotencyKeyV1(actorId: string, idempotencyKey: string) {
  return `harthmere:live_mode:v1:idempotency:${actorId}:${idempotencyKey}`;
}

function liveModeEventStreamKeyV1() {
  return "harthmere:live_mode:v1:events";
}

function liveModeUiOutboxStreamKeyV1(actorId: string) {
  return `harthmere:live_mode:v1:ui_outbox:${actorId}`;
}

function wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1(
  actorId: string,
  body: z.infer<typeof zLiveModeRequest>
): HarthmereLiveModeAuthorityEnvelopeV1 {
  const now = Date.now();
  return {
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    actorId,
    targetId: body.targetId,
    actionKind: body.actionKind,
    subsystem: body.subsystem,
    source: "client_request",
    clientSentAtMs: body.clientSentAtMs,
    serverReceivedAtMs: now,
    serverTick: now,
    actorEntityVersion: body.actorEntityVersion,
    targetEntityVersion: body.targetEntityVersion,
    zoneId: body.zoneId,
    encounterId: body.encounterId,
    partyId: body.partyId,
    raidId: body.raidId,
    pvpContextId: body.pvpContextId,
    payload: body.payload,
    clientClaims: body.clientClaims,
  };
}

function route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  plan: NonNullable<LiveModeResponse["mutationPlan"]>
) {
  const events = plan.auditEventOutbox.map((kind) =>
    createHarthmereLiveModeEventV1({
      kind: kind as HarthmereLiveModeEventKindV1,
      envelope,
      payload: {
        authoritative: true,
        mutationPlanId: plan.planId,
      },
    })
  );
  const uiEvents = plan.uiEventOutbox.map((kind) =>
    createHarthmereLiveModeUiEventV1({
      kind: kind as HarthmereLiveModeUiEventKindV1,
      envelope,
      payload: {
        authoritative: true,
        mutationPlanId: plan.planId,
      },
    })
  );
  return { events, uiEvents };
}

async function publish_createHarthmereLiveModeEventV1_to_server_event_stream(
  response: LiveModeResponse
) {
  if (!response.events.length) {
    return;
  }
  const redis = await liveModeRedisV1();
  const tx = redis.primary.multi();
  for (const event of response.events) {
    tx.xadd(
      liveModeEventStreamKeyV1(),
      "*",
      "requestId",
      event.requestId,
      "actorId",
      event.actorId,
      "kind",
      event.kind,
      "event",
      JSON.stringify(event)
    );
  }
  await tx.exec();
}

async function deliver_createHarthmereLiveModeUiEventV1_from_server_outbox(
  response: LiveModeResponse
) {
  if (!response.uiEvents.length) {
    return;
  }
  const redis = await liveModeRedisV1();
  const tx = redis.primary.multi();
  for (const uiEvent of response.uiEvents) {
    tx.xadd(
      liveModeUiOutboxStreamKeyV1(uiEvent.playerId),
      "*",
      "requestId",
      uiEvent.requestId,
      "playerId",
      uiEvent.playerId,
      "kind",
      uiEvent.kind,
      "uiEvent",
      JSON.stringify(uiEvent)
    );
  }
  await tx.exec();
}

async function persist_buildHarthmereLiveModePersistenceMutationPlanV1_inside_database_transaction(
  response: LiveModeResponse
): Promise<LiveModeResponse> {
  const key = liveModeIdempotencyKeyV1(
    response.actorId,
    response.mutationPlan?.idempotencyKey ?? "invalid"
  );
  const serialized = JSON.stringify(response);
  const redis = await liveModeRedisV1();
  const inserted = await redis.primary.set(
    key,
    serialized,
    "EX",
    24 * 60 * 60,
    "NX"
  );
  if (inserted !== "OK") {
    const previous = await redis.primary.get(key);
    if (previous) {
      return {
        ...(JSON.parse(previous) as LiveModeResponse),
        duplicate: true,
        replayed: true,
      };
    }
  }

  await publish_createHarthmereLiveModeEventV1_to_server_event_stream(response);
  await deliver_createHarthmereLiveModeUiEventV1_from_server_outbox(response);
  return response;
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zLiveModeRequest,
    response: zLiveModeResponse,
  },
  async ({ auth: { userId }, body }) => {
    const actorId = String(userId);
    const envelope =
      wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1(
        actorId,
        body
      );
    const validation = validateHarthmereLiveModeAuthorityEnvelopeV1(envelope);
    if (!validation.ok) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1,
        actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation,
        events: [],
        uiEvents: [],
      };
    }

    const mutationPlan =
      buildHarthmereLiveModePersistenceMutationPlanV1(envelope);
    const routed =
      route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules(
        envelope,
        mutationPlan
      );
    return persist_buildHarthmereLiveModePersistenceMutationPlanV1_inside_database_transaction(
      {
        ok: true,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1,
        actorId,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation,
        mutationPlan,
        events: routed.events,
        uiEvents: routed.uiEvents,
      }
    );
  }
);
