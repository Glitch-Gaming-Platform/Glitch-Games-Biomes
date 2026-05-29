import { GameEvent } from "@/server/shared/api/game_event";
import type { LogicApi } from "@/server/shared/api/logic";
import type { WorldApi } from "@/server/shared/world/api";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  harthmereLiveModeLedgerStreamKeyV1,
  harthmereLiveModePlayerStateKeyV1,
  createHarthmereLiveModeBuildingClientSnapshotV1,
  createHarthmereLiveModeBankingClientSnapshotV1,
  createHarthmereLiveModeGuildClientSnapshotFromBackendV1,
  createHarthmereInventoryLootClientSnapshotFromBackendV1,
  createHarthmereLiveModePlayerStatusClientSnapshotV1,
  createHarthmereProductionEconomyClientSnapshotFromBackendV1,
  createHarthmereJobsBoardClientSnapshotFromBackendV1,
  createHarthmereCareLoopClientSnapshotFromBackendV1,
  parseHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import type { BuildingSystemAnyMaterializationPlanV1 } from "@/shared/harthmere/building_system_v1";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  createHarthmereLiveModeEventV1,
  createHarthmereLiveModeUiEventV1,
  type HarthmereLiveModeActionKindV1,
  type HarthmereLiveModeAnySubsystemV1,
  type HarthmereLiveModeAuthorityEnvelopeV1,
  type HarthmereLiveModeEventKindV1,
  type HarthmereLiveModeUiEventKindV1,
  validateHarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import { EditEvent, PlaceGroupEvent } from "@/shared/ecs/gen/events";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
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
  "request_inventory_mutation",
  "request_vendor_transaction",
  "request_auction_post",
  "request_auction_settle",
  "request_bank_transaction",
  "request_mail_transaction",
  "request_guild_mutation",
  "request_economy_mutation",
  "request_jobs_board_mutation",
  "request_law_reputation_mutation",
  "request_magic_progress",
  "request_quest_state_update",
  "request_property_building_mutation",
  "request_crafting",
  "request_farming_action",
  "request_care_loop_action",
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
  "inventory",
  "economy",
  "jobs",
  "guild",
  "law",
  "magic",
  "quest",
  "vendor",
  "auction",
  "bank",
  "mail",
  "property",
  "crafting",
  "farming",
  "building",
  "care",
] as const satisfies readonly HarthmereLiveModeAnySubsystemV1[];

const zJsonRecord = z.record(z.unknown());
const zHarthmereCareLoopClientSnapshotResponse = z.object({
  actorId: z.string(),
  day: z.number(),
  streak: z.number(),
  claimedToday: z.record(z.number()),
  completedToday: z.record(z.number()),
  claimed: z.record(z.number()),
  completed: z.record(z.number()),
  townNeeds: z.record(z.number()),
  skills: z.record(z.object({ xp: z.number(), level: z.number() })),
  projects: z.record(z.unknown()),
});

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

const zLiveModeBackendMutationResponse = z.object({
  version: z.string(),
  applied: z.boolean(),
  actionKind: z.string(),
  subsystem: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  playerStateKey: z.string(),
  sharedStateKeys: z.string().array(),
  warnings: z.string().array(),
  touchedModels: z.string().array(),
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
  backendMutation: zLiveModeBackendMutationResponse.optional(),
  buildingState: zJsonRecord.optional(),
  bankingState: zJsonRecord.optional(),
  guildState: zJsonRecord.optional(),
  economyState: zJsonRecord.optional(),
  jobsBoardState: zJsonRecord.optional(),
  dailyState: zHarthmereCareLoopClientSnapshotResponse.optional(),
  inventoryLootState: zJsonRecord.optional(),
  playerStatusState: zJsonRecord.optional(),
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

function applyRouteRecordDeltaV1(record: Record<string, number>, itemId: string, delta: number) {
  const nextCount = Math.max(0, (record[itemId] ?? 0) + Math.trunc(delta));
  if (nextCount <= 0) {
    delete record[itemId];
  } else {
    record[itemId] = nextCount;
  }
}

async function redisUnwatchIfSupportedV1(redisPrimary: any) {
  if (typeof redisPrimary.unwatch === "function") {
    await redisPrimary.unwatch();
  }
}

function buildAuctionSellerSettlementV1(input: {
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  beforeState: ReturnType<typeof parseHarthmereLiveModeBackendStateV1>;
  afterState: ReturnType<typeof parseHarthmereLiveModeBackendStateV1>;
}) {
  if (input.envelope.actionKind !== "request_auction_settle") {
    return undefined;
  }
  const listingId =
    typeof input.envelope.payload.listingId === "string"
      ? input.envelope.payload.listingId
      : input.envelope.requestId;
  const beforeListing = input.beforeState.economy.auctionListings[listingId];
  const afterListing = input.afterState.economy.auctionListings[listingId];
  if (
    !beforeListing ||
    !afterListing ||
    beforeListing.status !== "active" ||
    afterListing.status !== "sold" ||
    afterListing.sellerId === input.envelope.actorId
  ) {
    return undefined;
  }
  return {
    listingId,
    sellerId: afterListing.sellerId,
    itemId: afterListing.itemId,
    count: Math.max(0, Math.trunc(afterListing.count)),
    sellerGoldDelta: Math.max(0, Math.trunc(afterListing.sellerNetGold ?? 0)),
  };
}

function applyAuctionSellerSettlementV1(input: {
  sellerState: ReturnType<typeof parseHarthmereLiveModeBackendStateV1>;
  settlement: NonNullable<ReturnType<typeof buildAuctionSellerSettlementV1>>;
  requestId: string;
  nowMs: number;
}) {
  applyRouteRecordDeltaV1(input.sellerState.inventory.items, input.settlement.itemId, -input.settlement.count);
  applyRouteRecordDeltaV1(input.sellerState.inventory.escrow, input.settlement.itemId, -input.settlement.count);
  input.sellerState.inventory.gold = Math.max(
    0,
    input.sellerState.inventory.gold + input.settlement.sellerGoldDelta
  );
  input.sellerState.economy.ledger.push({
    id: input.requestId,
    kind: "auction_sale_seller_settlement",
    amount: input.settlement.sellerGoldDelta,
    atMs: input.nowMs,
  });
  input.sellerState.updatedAtMs = input.nowMs;
}

function wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1(
  actorId: string,
  body: z.infer<typeof zLiveModeRequest>,
  serverActorPosition?: { x: number; y: number; z: number }
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
    serverActorPosition,
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

export async function readServerActorPositionForLiveModeV145(
  worldApi: WorldApi,
  userId: BiomesId
) {
  try {
    const entity = await worldApi.get(userId);
    const position = entity?.position()?.v;
    if (!Array.isArray(position) || position.length < 3) return undefined;
    const [x, y, z] = position.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return undefined;
    }
    return { x, y, z };
  } catch {
    return undefined;
  }
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


async function publishBuildingSystemMaterializationPlansToEcsV1(input: {
  logicApi: LogicApi;
  userId: BiomesId;
  plans: BuildingSystemAnyMaterializationPlanV1[] | undefined;
}) {
  if (!input.plans?.length) {
    return { editEventCount: 0, placeGroupEventCount: 0 };
  }
  const events: GameEvent[] = [];
  let editEventCount = 0;
  let placeGroupEventCount = 0;

  for (const plan of input.plans) {
    for (const edit of plan.edits) {
      events.push(
        new GameEvent(
          input.userId,
          new EditEvent({
            id: voxelShard(...edit.position) as unknown as BiomesId,
            position: edit.position,
            value: edit.value,
            user_id: input.userId,
          })
        )
      );
      editEventCount += 1;
    }

    if ("placeGroup" in plan && plan.placeGroup.groupId) {
      // Only publish a PlaceGroupEvent when the group id refers to a real,
      // pre-created ECS/DB group. Otherwise the voxel EditEvents above are the
      // authoritative materialization path for this generated building.
      events.push(
        new GameEvent(
          input.userId,
          new PlaceGroupEvent({
            id: plan.placeGroup.groupId,
            user_id: input.userId,
            name: plan.placeGroup.name,
            box: plan.placeGroup.box as any,
          })
        )
      );
      placeGroupEventCount += 1;
    }
  }

  await input.logicApi.publish(...events);
  return { editEventCount, placeGroupEventCount };
}

export async function persistHarthmereLiveModeResponseV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  response: LiveModeResponse,
  deps: { logicApi: LogicApi; userId: BiomesId }
): Promise<LiveModeResponse> {
  const key = liveModeIdempotencyKeyV1(
    response.actorId,
    response.mutationPlan?.idempotencyKey ?? "invalid"
  );
  const redis = await liveModeRedisV1();
  const playerStateKey = harthmereLiveModePlayerStateKeyV1(response.actorId);
  const supportsWatch = typeof (redis.primary as any).watch === "function";
  if (!supportsWatch) {
    throw new Error("Harthmere live-mode Redis client must support WATCH for transactional persistence");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const previous = await redis.primary.get(key);
    if (previous) {
      return {
        ...(JSON.parse(previous) as LiveModeResponse),
        duplicate: true,
        replayed: true,
      };
    }

    const watchKeys = [key, playerStateKey];
    const now = Date.now();
    if (supportsWatch) {
      await (redis.primary as any).watch(...watchKeys);
    }

    const watchedPrevious = await redis.primary.get(key);
    if (watchedPrevious) {
      await redisUnwatchIfSupportedV1(redis.primary);
      return {
        ...(JSON.parse(watchedPrevious) as LiveModeResponse),
        duplicate: true,
        replayed: true,
      };
    }

    let rawState = await redis.primary.get(playerStateKey);
    let currentState = parseHarthmereLiveModeBackendStateV1(
      rawState,
      response.actorId,
      now
    );
    let reduced = reduceHarthmereLiveModeBackendStateV1(
      currentState,
      envelope,
      now
    );
    let settlement = buildAuctionSellerSettlementV1({
      envelope,
      beforeState: currentState,
      afterState: reduced.state,
    });
    let sellerStateKey = settlement
      ? harthmereLiveModePlayerStateKeyV1(settlement.sellerId)
      : undefined;

    if (sellerStateKey && supportsWatch) {
      await redisUnwatchIfSupportedV1(redis.primary);
      await (redis.primary as any).watch(key, playerStateKey, sellerStateKey);
      const secondPrevious = await redis.primary.get(key);
      if (secondPrevious) {
        await redisUnwatchIfSupportedV1(redis.primary);
        return {
          ...(JSON.parse(secondPrevious) as LiveModeResponse),
          duplicate: true,
          replayed: true,
        };
      }
      rawState = await redis.primary.get(playerStateKey);
      currentState = parseHarthmereLiveModeBackendStateV1(
        rawState,
        response.actorId,
        now
      );
      reduced = reduceHarthmereLiveModeBackendStateV1(
        currentState,
        envelope,
        now
      );
      settlement = buildAuctionSellerSettlementV1({
        envelope,
        beforeState: currentState,
        afterState: reduced.state,
      });
      sellerStateKey = settlement
        ? harthmereLiveModePlayerStateKeyV1(settlement.sellerId)
        : undefined;
    }

    let sellerState: ReturnType<typeof parseHarthmereLiveModeBackendStateV1> | undefined;
    if (settlement && sellerStateKey) {
      const rawSellerState = await redis.primary.get(sellerStateKey);
      sellerState = parseHarthmereLiveModeBackendStateV1(
        rawSellerState,
        settlement.sellerId,
        now
      );
      applyAuctionSellerSettlementV1({
        sellerState,
        settlement,
        requestId: envelope.requestId,
        nowMs: now,
      });
      reduced.summary.warnings.push("auction_seller_account_settled_atomically");
    }

    const persistedResponse: LiveModeResponse = {
      ...response,
      backendMutation: reduced.summary,
      buildingState: createHarthmereLiveModeBuildingClientSnapshotV1(reduced.state),
      bankingState: createHarthmereLiveModeBankingClientSnapshotV1(reduced.state),
      guildState: createHarthmereLiveModeGuildClientSnapshotFromBackendV1(reduced.state),
      economyState: createHarthmereProductionEconomyClientSnapshotFromBackendV1(reduced.state),
      jobsBoardState: createHarthmereJobsBoardClientSnapshotFromBackendV1(reduced.state),
      dailyState: createHarthmereCareLoopClientSnapshotFromBackendV1(reduced.state, now),
      inventoryLootState: createHarthmereInventoryLootClientSnapshotFromBackendV1(reduced.state),
      playerStatusState: createHarthmereLiveModePlayerStatusClientSnapshotV1(reduced.state),
    };

    const tx = redis.primary.multi();
    tx.set(playerStateKey, JSON.stringify(reduced.state));
    if (sellerStateKey && sellerState) {
      tx.set(sellerStateKey, JSON.stringify(sellerState));
    }
    tx.xadd(
      harthmereLiveModeLedgerStreamKeyV1(response.actorId),
      "*",
      "requestId",
      persistedResponse.events[0]?.requestId ?? response.mutationPlan?.planId ?? key,
      "actorId",
      response.actorId,
      "actionKind",
      response.mutationPlan?.actionKind ?? "unknown",
      "mutation",
      JSON.stringify(reduced.summary)
    );
    tx.set(key, JSON.stringify(persistedResponse), "EX", 24 * 60 * 60);
    const txResult = await tx.exec();
    if (supportsWatch && txResult === null) {
      continue;
    }

    // Materialize server-approved building plans after the state/idempotency
    // commit succeeds. This keeps ECS side effects downstream of durable state.
    const materializationCounts = await publishBuildingSystemMaterializationPlansToEcsV1({
      logicApi: deps.logicApi,
      userId: deps.userId,
      plans: reduced.summary.buildingMaterializationPlans,
    });
    if (reduced.summary.buildingMaterializationPlans?.length) {
      persistedResponse.backendMutation?.warnings.push(
        `building_materialized:edit_events:${materializationCounts.editEventCount}:place_group_events:${materializationCounts.placeGroupEventCount}`
      );
      await redis.primary.set(key, JSON.stringify(persistedResponse), "EX", 24 * 60 * 60);
    }

    await publish_createHarthmereLiveModeEventV1_to_server_event_stream(
      persistedResponse
    );
    await deliver_createHarthmereLiveModeUiEventV1_from_server_outbox(
      persistedResponse
    );
    return persistedResponse;
  }

  throw new Error("Harthmere live-mode Redis transaction conflicted too many times");
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zLiveModeRequest,
    response: zLiveModeResponse,
  },
  async ({ context: { logicApi, worldApi }, auth: { userId }, body }) => {
    const actorId = String(userId);
    const serverActorPosition = await readServerActorPositionForLiveModeV145(
      worldApi,
      userId
    );
    const envelope =
      wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1(
        actorId,
        body,
        serverActorPosition
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
    return persistHarthmereLiveModeResponseV1(
      envelope,
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
      },
      { logicApi, userId }
    );
  }
);
