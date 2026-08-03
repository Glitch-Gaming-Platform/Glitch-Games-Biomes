import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import { partitionDeltasToUpdates } from "@/server/shared/world/hfc/classify";
import { HybridWorldApi } from "@/server/shared/world/hfc/hybrid";
import type { WorldApi } from "@/server/shared/world/api";
import { npcEntity } from "@/server/spawn/spawn_npc";
import type { ProposedChange } from "@/shared/ecs/change";
import {
  Emote,
  EntityDescription,
  Expires,
  NpcState,
  Voice,
} from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  createHarthmereBusinessCustomerSpatialIntent,
  harthmereBusinessInteriorForType,
  type HarthmereBusinessCustomerReaction,
  type HarthmereBusinessCustomerWorldPhase,
} from "@/shared/harthmere/business_interior_runtime";
import {
  findHarthmereBusinessCustomerNpc,
  type HarthmereBusinessCustomerSession,
  type HarthmereBusinessCustomerTicket,
} from "@/shared/harthmere/business_customer_simulator";
import type { HarthmereProductionEconomyState } from "@/shared/harthmere/mmo_economy_authority";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import {
  HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
  type BusinessCustomerState,
} from "@/shared/npc/behavior/business_customer";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

export const HARTHMERE_BUSINESS_CUSTOMER_SESSION_ECS_VERSION =
  "harthmere-business-customer-session-ecs-v1" as const;

export function partitionHarthmereBusinessCustomerSessionNpcChanges(
  changes: readonly ProposedChange[]
) {
  const baseChanges = changes.filter((change) => change.kind !== "update");
  const updates = changes
    .filter((change) => change.kind === "update")
    .map((change) => change.entity);
  const { rcChanges, hfcChanges } = partitionDeltasToUpdates(updates);
  return { baseChanges, rcChanges, hfcChanges };
}

export async function applyHarthmereBusinessCustomerSessionNpcChanges(
  worldApi: WorldApi,
  changes: readonly ProposedChange[]
) {
  if (!(worldApi instanceof HybridWorldApi)) {
    return worldApi.apply({ changes: [...changes] });
  }

  const { baseChanges, rcChanges, hfcChanges } =
    partitionHarthmereBusinessCustomerSessionNpcChanges(changes);
  const results = await Promise.all([
    ...(baseChanges.length
      ? [worldApi.apply({ changes: baseChanges })]
      : []),
    ...(rcChanges.length
      ? [worldApi.rc.apply({ changes: rcChanges })]
      : []),
    ...(hfcChanges.length
      ? [worldApi.hfc.apply({ changes: hfcChanges })]
      : []),
  ]);
  const failed = results.find((result) => result.outcome !== "success");
  return { outcome: failed?.outcome ?? ("success" as const) };
}

type ExistingBusinessCustomerEntity = Pick<
  ReadonlyEntity,
  "id" | "position" | "npc_state"
>;

function customerSessions(state: HarthmereProductionEconomyState) {
  return Object.values(
    (state.businessSystems as any)?.customerSessions ?? {}
  ) as HarthmereBusinessCustomerSession[];
}

function reactionEmote(reaction: HarthmereBusinessCustomerReaction) {
  switch (reaction) {
    case "payment":
    case "success":
      return "gratitude" as const;
    case "incorrect":
      return "annoyance" as const;
    case "timeout":
      return "frustration" as const;
    case "insufficient_stock":
      return "uncertainty" as const;
    default:
      return undefined;
  }
}

function reactionAudio(reaction: HarthmereBusinessCustomerReaction) {
  switch (reaction) {
    case "payment":
    case "success":
      return "business_customer_success";
    case "incorrect":
      return "business_customer_incorrect";
    case "timeout":
      return "business_customer_timeout";
    case "insufficient_stock":
      return "business_customer_stock_blocked";
    default:
      return undefined;
  }
}

function desiredPhase(ticket: HarthmereBusinessCustomerTicket) {
  return ticket.spatialPhase;
}

function preserveProgressedPhase(input: {
  desired: HarthmereBusinessCustomerWorldPhase;
  existing?: BusinessCustomerState;
}) {
  const existing = input.existing?.phase;
  if (!existing) return input.desired;
  if (
    input.desired === "entering" &&
    (existing === "queued" || existing === "serving")
  ) {
    return existing;
  }
  if (
    input.desired === "queued" &&
    (existing === "queued" || existing === "entering")
  ) {
    return existing;
  }
  if (
    input.desired === "approaching_counter" &&
    existing === "serving"
  ) {
    return existing;
  }
  if (
    (input.desired === "departing" || input.desired === "cancelled") &&
    existing === "despawn_ready"
  ) {
    return existing;
  }
  return input.desired;
}

function safeToDelete(input: {
  existing: ExistingBusinessCustomerEntity;
  actorPosition?: readonly [number, number, number];
}) {
  if (!input.existing.position) return true;
  if (!input.actorPosition) return false;
  const p = input.existing.position.v;
  return (
    Math.hypot(
      p[0] - input.actorPosition[0],
      p[1] - input.actorPosition[1],
      p[2] - input.actorPosition[2]
    ) >= 18
  );
}

function stateForTicket(input: {
  session: HarthmereBusinessCustomerSession;
  ticket: HarthmereBusinessCustomerTicket;
  nowSeconds: number;
  existing?: BusinessCustomerState;
}) {
  const record = harthmereBusinessInteriorForType(input.session.typeId);
  if (!record) return undefined;
  const phase = preserveProgressedPhase({
    desired: desiredPhase(input.ticket),
    existing: input.existing,
  });
  const intent = createHarthmereBusinessCustomerSpatialIntent({
    record,
    sessionId: input.session.sessionId,
    ticketId: input.ticket.ticketId,
    entityId: input.ticket.entityId,
    queueIndex: input.ticket.queueIndex,
    actorEntityId: input.session.actorEntityId,
    phase,
    reaction: input.ticket.reaction,
  });
  const preserveRoute =
    input.existing?.phase === phase &&
    (phase === "entering" ||
      (phase === "queued" &&
        Math.hypot(
          input.existing.queueTarget[0] - intent.queueTarget[0],
          input.existing.queueTarget[1] - intent.queueTarget[1],
          input.existing.queueTarget[2] - intent.queueTarget[2]
        ) < 0.1) ||
      phase === "serving" ||
      phase === "departing" ||
      phase === "despawn_ready");
  return {
    version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
    sessionId: intent.sessionId,
    ticketId: intent.ticketId,
    outpostId: intent.outpostId,
    businessType: intent.businessType,
    actorEntityId: intent.actorEntityId,
    phase,
    reaction: intent.reaction,
    entrance: intent.entrance,
    queueTarget: intent.queueTarget,
    customer: intent.customer,
    staff: intent.staff,
    departure: intent.departure,
    waypoints: preserveRoute ? input.existing!.waypoints : intent.waypoints,
    waypointIndex: preserveRoute ? input.existing!.waypointIndex : 0,
    pathfinding: preserveRoute ? input.existing!.pathfinding : undefined,
    lastPhaseChangedAtSeconds:
      preserveRoute && input.existing
        ? input.existing.lastPhaseChangedAtSeconds
        : input.nowSeconds,
    reactionStartedAtSeconds:
      input.existing?.reaction === intent.reaction
        ? input.existing.reactionStartedAtSeconds
        : input.nowSeconds,
    audioCue: reactionAudio(intent.reaction),
  } satisfies BusinessCustomerState;
}

function customerDescription(input: {
  entityId: BiomesId;
  displayName: string;
  role: string;
  description: string;
}) {
  const appearance = makeHarthmereNpcAppearanceConfig({
    id: input.entityId,
    name: input.displayName,
    roleHint: input.role,
    forwardAxis: "minusZ",
    source: HARTHMERE_BUSINESS_CUSTOMER_SESSION_ECS_VERSION,
  });
  return {
    appearance,
    description: withHarthmereAppearanceMarker(
      withHarthmereBodyAndFaceMarkers(
        `${HARTHMERE_BUSINESS_CUSTOMER_SESSION_ECS_VERSION} ${input.description}`,
        appearance.face,
        appearance.body
      ),
      appearance
    ),
  };
}

export function buildHarthmereBusinessCustomerSessionNpcChanges(input: {
  economy: HarthmereProductionEconomyState;
  existingEntities?: ReadonlyMap<BiomesId, ExistingBusinessCustomerEntity>;
  nowSeconds: number;
  actorPosition?: readonly [number, number, number];
}): ProposedChange[] {
  const existingEntities = input.existingEntities ?? new Map();
  const changes: ProposedChange[] = [];

  for (const session of customerSessions(input.economy)) {
    for (const ticket of session.queue) {
      const existing = existingEntities.get(ticket.entityId);
      const decoded = existing?.npc_state?.data
        ? deserializeNpcCustomState(existing.npc_state.data)
        : undefined;
      const existingCustomer = decoded?.businessCustomer;
      if (
        existing &&
        existingCustomer?.phase === "despawn_ready" &&
        safeToDelete({ existing, actorPosition: input.actorPosition })
      ) {
        changes.push({ kind: "delete", id: ticket.entityId });
        continue;
      }

      const shouldCreate =
        session.status === "active" && ticket.status === "waiting";
      if (!existing && !shouldCreate) continue;

      const businessState = stateForTicket({
        session,
        ticket,
        nowSeconds: input.nowSeconds,
        existing: existingCustomer,
      });
      if (!businessState) continue;
      const state = decoded ?? deserializeNpcCustomState(undefined);
      state.businessCustomer = businessState;
      const npcState = NpcState.create({ data: serializeNpcCustomState(state) });
      const customer = findHarthmereBusinessCustomerNpc(ticket.npcId);
      const displayName = customer?.displayName ?? "Business Customer";
      const role = customer
        ? `${customer.temperament} customer`
        : "customer";
      const description = customer
        ? `${customer.temperament}; ${customer.appearance.outfit}; ${customer.appearance.accessory}. ${ticket.askLine}`
        : ticket.askLine;
      const presentation = customerDescription({
        entityId: ticket.entityId,
        displayName,
        role,
        description,
      });
      const emoteType = reactionEmote(ticket.reaction);
      const emote = emoteType
        ? Emote.create({
            emote_type: emoteType,
            emote_start_time: input.nowSeconds,
            emote_expiry_time: input.nowSeconds + 3.2,
            emote_nonce: input.nowSeconds,
          })
        : undefined;
      const expires =
        businessState.phase === "departing" ||
        businessState.phase === "cancelled" ||
        businessState.phase === "despawn_ready"
          ? Expires.create({ trigger_at: input.nowSeconds + 90 })
          : undefined;

      if (existing) {
        changes.push({
          kind: "update",
          entity: {
            id: ticket.entityId,
            npc_state: npcState,
            ...(emote ? { emote } : {}),
            ...(expires ? { expires } : {}),
          },
        });
        continue;
      }

      const record = harthmereBusinessInteriorForType(session.typeId)!;
      const intent = createHarthmereBusinessCustomerSpatialIntent({
        record,
        sessionId: session.sessionId,
        ticketId: ticket.ticketId,
        entityId: ticket.entityId,
        queueIndex: ticket.queueIndex,
        actorEntityId: session.actorEntityId,
        phase: ticket.spatialPhase,
        reaction: ticket.reaction,
      });
      const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
        npcEntity(
          {
            id: ticket.entityId,
            typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
            position: intent.spawn,
            orientation: [0, 0],
            velocity: [0, 0, 0],
            displayName,
            defaultDialog: `<text>${ticket.askLine}</text>`,
          },
          input.nowSeconds
        ),
        "create"
      );
      changes.push({
        kind: "create",
        entity: {
          ...base,
          npc_state: npcState,
          entity_description: EntityDescription.create({
            text: presentation.description,
          }),
          voice: Voice.create({
            voice: harthmereVoiceProfileForActor({
              source: "business_customer",
              id: ticket.npcId,
              entityId: ticket.entityId,
              displayName,
              role,
              kind: "humanoid",
              background: description,
            }).voiceParameterId,
          }),
          ...(emote ? { emote } : {}),
          ...(expires ? { expires } : {}),
        },
      });
    }
  }
  return changes;
}
