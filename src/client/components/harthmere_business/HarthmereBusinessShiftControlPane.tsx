import * as React from "react";
import { HARTHMERE_BUSINESS_CUSTOMERS_PER_SHIFT } from "@/shared/harthmere/business_customer_simulator";

import {
  formatHarthmereBusinessPlayerWarning,
  type HarthmereBusinessInterfaceAdapter,
} from "./businessInterfaceLiveAdapter";

// Dependency-light dashboard control. Keep this separate from the spatial HUD:
// rendered panel tests should not have to bundle ClientContext, THREE, NPC
// pathfinding, or msgpack merely to prove that a real shift can start/end.
export function HarthmereBusinessShiftControlPane({
  adapter,
  businessId,
  onShiftStarted,
}: {
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
  onShiftStarted?: () => void;
}) {
  const panel = adapter.getCustomerMiniGame(businessId);
  const session = panel.activeSession;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const startShift = React.useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await adapter.startCustomerSession(
        businessId,
        HARTHMERE_BUSINESS_CUSTOMERS_PER_SHIFT
      );
      onShiftStarted?.();
    } catch (cause) {
      setError(
        formatHarthmereBusinessPlayerWarning(
          cause instanceof Error ? cause.message : String(cause)
        )
      );
    } finally {
      setPending(false);
    }
  }, [adapter, businessId, onShiftStarted, pending]);

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
        same exit. After starting, close this dashboard and stay behind the
        counter. When the front customer arrives, talk to them: their business
        service choices replace ordinary NPC dialogue for that conversation.
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
          disabled={pending}
          onClick={() => void startShift()}
        >
          {pending ? "Starting shift…" : "Start customer shift"}
        </button>
      )}
      {error ? (
        <p role="alert" style={{ margin: "10px 0 0", color: "#ffb3a7" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
