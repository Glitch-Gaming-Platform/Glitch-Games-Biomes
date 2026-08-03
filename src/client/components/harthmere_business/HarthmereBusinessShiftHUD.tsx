import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { HarthmereBusinessInterfaceAdapter } from "./businessInterfaceLiveAdapter";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import type { BiomesId } from "@/shared/ids";
import * as React from "react";
import * as THREE from "three";
import {
  clearHarthmereBusinessCustomerTalkTarget,
  publishHarthmereBusinessCustomerTalkTarget,
  publishHarthmereBusinessCustomerTalkTargets,
} from "./harthmereBusinessCustomerTalkState";
import {
  HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER,
  harthmereBusinessMinigameMusicTrack,
} from "./businessMinigameMusic";

export const HARTHMERE_BUSINESS_SHIFT_HUD_VERSION =
  "harthmere-business-spatial-shift-hud-v1" as const;

function useProjectedEntityPosition(entityId: BiomesId) {
  const { reactResources } = useClientContext();
  const entity = reactResources.use("/ecs/entity", entityId);
  const camera = reactResources.use("/scene/camera");
  const [screen, setScreen] = React.useState<{
    left: number;
    top: number;
    visible: boolean;
  }>({ left: 0, top: 0, visible: false });

  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      const position = entity?.position?.v;
      if (!position || typeof window === "undefined") {
        setScreen((prior) =>
          prior.visible ? { ...prior, visible: false } : prior
        );
      } else {
        const projected = new THREE.Vector3(
          position[0],
          position[1] + 2.35,
          position[2]
        ).project(camera.three);
        const visible = projected.z >= -1 && projected.z <= 1;
        setScreen({
          left: (projected.x * 0.5 + 0.5) * window.innerWidth,
          top: (-projected.y * 0.5 + 0.5) * window.innerHeight,
          visible,
        });
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [camera.three, entity?.position?.v]);

  const customerState = React.useMemo(() => {
    if (!entity?.npc_state?.data) return undefined;
    return deserializeNpcCustomState(entity.npc_state.data).businessCustomer;
  }, [entity?.npc_state?.data]);
  return { entity, customerState, screen };
}

function SpatialCustomerCard({
  adapter,
  businessId,
  sessionId,
  ticketId,
  entityId,
}: {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
  sessionId: string;
  ticketId: string;
  entityId: BiomesId;
}) {
  const { audioManager } = useClientContext();
  const panel = adapter.getCustomerMiniGame(businessId);
  const ticket = panel.activeSession?.queue.find(
    (candidate) => candidate.ticketId === ticketId
  );
  const { customerState, screen } = useProjectedEntityPosition(entityId);
  const ready = customerState?.phase === "serving";
  const customerName = panel.currentNpc?.displayName ?? "Customer";

  React.useEffect(() => {
    const reaction = customerState?.reaction;
    if (!reaction || reaction === "neutral") return;
    audioManager.playSound(
      reaction === "success" || reaction === "payment"
        ? "challenge_complete"
        : "forbidden"
    );
  }, [audioManager, customerState?.reaction]);

  React.useEffect(() => {
    publishHarthmereBusinessCustomerTalkTarget({
      adapter,
      businessId,
      businessType: panel.typeId,
      sessionId,
      ticketId,
      entityId,
      customerName,
      askLine: ticket?.askLine ?? "What can you do for me?",
      patienceRemaining: ticket?.patienceRemaining ?? 0,
      requestedOfferId: ticket?.requestedOfferId,
      phase: customerState?.phase,
      ready,
      offers: panel.offers,
    });
    // No cleanup here on purpose. The shift-level registry owns entry lifetime;
    // this effect only *refines* the current customer with its live ECS phase,
    // which is more accurate than the economy snapshot's `spatialPhase`.
    // Clearing on unmount would deregister the customer the player is walking
    // up to talk to, which is precisely the bug this registry exists to fix.
  }, [
    adapter,
    businessId,
    customerName,
    customerState?.phase,
    entityId,
    panel.offers,
    panel.typeId,
    ready,
    sessionId,
    ticket?.askLine,
    ticket?.patienceRemaining,
    ticket?.requestedOfferId,
    ticketId,
  ]);

  React.useEffect(() => {
    const debug = {
      version: HARTHMERE_BUSINESS_SHIFT_HUD_VERSION,
      businessId,
      sessionId,
      ticketId,
      entityId,
      phase: customerState?.phase,
      reaction: customerState?.reaction,
      ready,
      customerName,
      correctOfferId: ticket?.requestedOfferId,
      offers: panel.offers.map((offer) => offer.offerId),
      talkRequired: true,
    };
    (window as any).__harthmereBusinessShiftDebug = debug;
    return () => {
      if ((window as any).__harthmereBusinessShiftDebug === debug) {
        delete (window as any).__harthmereBusinessShiftDebug;
      }
    };
  }, [
    businessId,
    customerName,
    customerState?.phase,
    customerState?.reaction,
    entityId,
    panel.offers,
    ready,
    sessionId,
    ticket?.requestedOfferId,
    ticketId,
  ]);

  const position = screen.visible
    ? {
        left: Math.max(190, Math.min(window.innerWidth - 190, screen.left)),
        top: Math.max(130, Math.min(window.innerHeight - 210, screen.top)),
      }
    : { left: "50%", top: 150 };
  return (
    <aside
      data-harthmere-business-spatial-customer="true"
      data-native-customer-phase={customerState?.phase ?? "loading"}
      style={{
        position: "fixed",
        ...position,
        transform: "translate(-50%, -100%)",
        zIndex: 62,
        width: 360,
        maxWidth: "calc(100vw - 24px)",
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(244, 210, 142, 0.72)",
        background: "rgba(24, 20, 17, 0.9)",
        boxShadow: "0 10px 30px rgba(0,0,0,.38)",
        color: "#fff4db",
        pointerEvents: "none",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <strong>{customerName}</strong>
        <span style={{ color: ready ? "#9ee6a2" : "#e9c985" }}>
          {ready
            ? `${ticket?.patienceRemaining ?? 0}s`
            : customerState?.phase === "queued"
              ? "Waiting in queue"
              : customerState?.phase === "approaching_counter"
                ? "Walking to counter"
                : "Entering"}
        </span>
      </div>
      <p style={{ margin: "7px 0 10px", fontSize: 13, lineHeight: 1.35 }}>
        {ticket?.askLine ?? "The next customer is approaching."}
      </p>
      <p style={{ margin: 0, color: "#c9bda7", fontSize: 12 }}>
        {ready
          ? "Talk to this customer to choose the business service response."
          : "Stay behind the counter. The customer is using native pathing."}
      </p>
    </aside>
  );
}

export function HarthmereBusinessShiftHUD({
  adapter,
  businessId,
  insideBusiness = false,
}: {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId?: string;
  insideBusiness?: boolean;
}) {
  const { audioManager } = useClientContext();
  const panel = businessId
    ? adapter.getCustomerMiniGame(businessId)
    : undefined;
  const session = panel?.activeSession;
  const ticket = panel?.currentTicket;
  const minigameMusicTrack = harthmereBusinessMinigameMusicTrack({
    businessId,
    insideBusiness,
    sessionStatus: session?.status,
  });

  React.useEffect(() => {
    audioManager.setBackgroundMusicOverride(
      HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER,
      minigameMusicTrack
    );
    return () => {
      audioManager.setBackgroundMusicOverride(
        HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER,
        undefined
      );
    };
  }, [
    audioManager,
    businessId,
    insideBusiness,
    minigameMusicTrack,
    session?.sessionId,
    session?.status,
  ]);

  React.useEffect(() => {
    if (!businessId || !session || session.status !== "active") return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await adapter.tickCustomerSession(businessId, session.sessionId);
      } catch {
        // A tick is reconciliation, not a user-facing failure. The next poll or
        // exact-idempotency replay repairs a transient network miss.
      }
    };
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [adapter, businessId, session?.sessionId, session?.status]);

  // HARTHMERE_BUSINESS_TALK_TARGET_REGISTRY
  // Register every live customer of this shift, not only the one at the
  // counter. The projected card is proximity- and visibility-gated; talking is
  // not. Registering only the served customer meant anyone else in the queue
  // opened the ordinary NPC dialogue — "Chit Chat", "Ask about this place" —
  // from a person standing in a shop queue holding a service request.
  //
  // The registry is replaced wholesale so a served or departed ticket cannot
  // leave a stale entry behind, which would offer service to a customer who has
  // already walked out.
  React.useEffect(() => {
    if (!businessId || !panel || !session || session.status !== "active") {
      clearHarthmereBusinessCustomerTalkTarget();
      return;
    }
    publishHarthmereBusinessCustomerTalkTargets(
      session.queue
        .filter(
          (entry) => entry.entityId !== undefined && entry.status === "waiting"
        )
        .map((entry) => ({
          adapter,
          businessId,
          businessType: panel.typeId,
          sessionId: session.sessionId,
          ticketId: entry.ticketId,
          entityId: entry.entityId as BiomesId,
          customerName: entry.npcId,
          askLine: entry.askLine,
          patienceRemaining: entry.patienceRemaining,
          requestedOfferId: entry.requestedOfferId,
          phase: entry.spatialPhase,
          // Only the session's current ticket may be served. A queued customer
          // is real and talkable, but presenting offers for them would let the
          // player serve out of order and break the spatial queue contract.
          ready:
            entry.ticketId === session.currentTicketId &&
            entry.spatialPhase === "serving",
          offers: panel.offers,
        }))
    );
    return () => clearHarthmereBusinessCustomerTalkTarget();
  }, [adapter, businessId, panel, session]);

  if (!businessId || !session) return null;
  return (
    <>
      <div
        data-harthmere-business-shift-status="true"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 61,
          padding: "8px 10px",
          borderRadius: 9,
          background: "rgba(17,15,13,.82)",
          color: "#f5e6c8",
          fontSize: 12,
          pointerEvents: "auto",
        }}
      >
        {session.servedTicketIds.length}/{session.queue.length} served ·{" "}
        {session.earnedGold} gold
        <button
          type="button"
          onClick={() =>
            void adapter.endCustomerSession(businessId, session.sessionId)
          }
          style={{ marginLeft: 9 }}
        >
          End shift
        </button>
      </div>
      {ticket?.entityId ? (
        <SpatialCustomerCard
          adapter={adapter}
          businessId={businessId}
          sessionId={session.sessionId}
          ticketId={ticket.ticketId}
          entityId={ticket.entityId}
        />
      ) : null}
    </>
  );
}
