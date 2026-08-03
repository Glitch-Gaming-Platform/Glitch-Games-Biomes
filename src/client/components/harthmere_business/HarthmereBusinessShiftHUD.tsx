import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { HarthmereBusinessInterfaceAdapter } from "./businessInterfaceLiveAdapter";
import { createHarthmereBusinessMiniGameDecisionForOffer } from "@/shared/harthmere/business_customer_simulator";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import type { BiomesId } from "@/shared/ids";
import * as React from "react";
import * as THREE from "three";

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
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string>();
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ready || pending || event.repeat) return;
      const index = Number(event.key) - 1;
      const offer = panel.offers[index];
      if (!offer) return;
      event.preventDefault();
      void serve(offer.offerId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const serve = React.useCallback(
    async (offerId: string) => {
      if (!ready || pending) return;
      setPending(true);
      setMessage(undefined);
      try {
        await adapter.serveCustomer(
          businessId,
          offerId,
          sessionId,
          ticketId,
          createHarthmereBusinessMiniGameDecisionForOffer(
            panel.typeId as any,
            offerId
          )
        );
        setMessage("Service committed");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setPending(false);
      }
    },
    [adapter, businessId, panel.typeId, pending, ready, sessionId, ticketId]
  );

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
      serveCorrect: () =>
        ticket?.requestedOfferId ? serve(ticket.requestedOfferId) : undefined,
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
    serve,
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
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
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
      {ready ? (
        <div style={{ display: "grid", gap: 6 }}>
          {panel.offers.map((offer, index) => (
            <button
              key={offer.offerId}
              data-business-offer-id={offer.offerId}
              type="button"
              disabled={pending}
              onClick={() => void serve(offer.offerId)}
              style={{
                border: "1px solid rgba(255,255,255,.18)",
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "left",
                color: "white",
                background: "rgba(255,255,255,.08)",
              }}
            >
              <b>{index + 1}.</b> {offer.label}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: "#c9bda7", fontSize: 12 }}>
          Keep the counter clear. The customer is using native pathing.
        </p>
      )}
      {message ? (
        <p style={{ margin: "8px 0 0", fontSize: 12 }}>{message}</p>
      ) : null}
    </aside>
  );
}

export function HarthmereBusinessShiftHUD({
  adapter,
  businessId,
}: {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId?: string;
}) {
  const panel = businessId
    ? adapter.getCustomerMiniGame(businessId)
    : undefined;
  const session = panel?.activeSession;
  const ticket = panel?.currentTicket;

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
        {session.servedTicketIds.length}/{session.queue.length} served · {session.earnedGold} gold
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

export function HarthmereBusinessShiftControlPane({
  adapter,
  businessId,
}: {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}) {
  const panel = adapter.getCustomerMiniGame(businessId);
  const session = panel.activeSession;
  return (
    <section
      data-harthmere-business-in-world-shift-control="true"
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.045)",
      }}
    >
      <h3 style={{ margin: "0 0 8px" }}>In-world customer shift</h3>
      <p style={{ margin: "0 0 12px", lineHeight: 1.45 }}>
        Customers now enter through this building&apos;s real door, form a
        spatial queue, approach the collidable counter, and leave through the
        same exit. Close this dashboard after starting; service choices stay
        beside the customer while normal third-person movement remains active.
      </p>
      {session ? (
        <div>
          <strong>
            Shift live: {session.servedTicketIds.length}/{session.queue.length}
          </strong>
          <button
            type="button"
            onClick={() =>
              void adapter.endCustomerSession(businessId, session.sessionId)
            }
            style={{ marginLeft: 10 }}
          >
            End safely
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void adapter.startCustomerSession(businessId)}
        >
          Start shift at counter
        </button>
      )}
    </section>
  );
}
