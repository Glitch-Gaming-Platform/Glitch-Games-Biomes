import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { tryExitPointerLock } from "@/client/components/contexts/PointerLockContext";
import { DialogButton } from "@/client/components/system/DialogButton";
import { reportClientError } from "@/client/util/request_helpers";
import { log } from "@/shared/logging";
import React, { useEffect, useRef, useState } from "react";

const INSTALL_DISCONNECT_SUPPRESSION_LOG_INTERVAL_MS = 30_000;

function isHarthmereInstallLaunch() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return !!params.get("install_id") || !!params.get("installId");
}

export const GameErrorOverlay: React.FunctionComponent<{}> = ({}) => {
  const { reactResources } = useClientContext();
  const currentModal = reactResources.use("/game_modal")?.kind;
  const socketStatus = reactResources.use("/server/socket");

  const [shouldDisplay, setShouldDisplay] = useState(false);
  const lastSuppressionLogAtRef = useRef(0);

  useEffect(() => {
    if (shouldDisplay) {
      document.body.classList.add("error-showing");
      tryExitPointerLock();
    } else {
      document.body.classList.remove("error-showing");
    }
  }, [shouldDisplay]);

  // In Glitch iframe/install_id launches, the sync client can briefly report the
  // old socket as disconnected during a valid lame-duck handoff. Do not block the
  // player with a duplicate disconnected screen; let the reconnect/handoff finish.
  const healthy = socketStatus.status === "ready";
  const suppressInstallDisconnectOverlay = isHarthmereInstallLaunch();
  useEffect(() => {
    if (
      healthy ||
      currentModal === "staleSession" ||
      suppressInstallDisconnectOverlay
    ) {
      if (suppressInstallDisconnectOverlay && !healthy) {
        const now = Date.now();
        if (
          now - lastSuppressionLogAtRef.current >=
          INSTALL_DISCONNECT_SUPPRESSION_LOG_INTERVAL_MS
        ) {
          lastSuppressionLogAtRef.current = now;
          log.warn("HARTHMERE_SUPPRESS_INSTALL_DISCONNECT_OVERLAY_V141", {
            socketStatus: socketStatus.status,
            currentModal,
          });
        }
      }
      setShouldDisplay(false);
      return;
    }
    const handle = setTimeout(() => {
      reportClientError("Disconnected", "Disconnected from game showing", {
        socketStatus: socketStatus.status,
        currentModal,
      });
      log.error("Showing disconnected from game");
      setShouldDisplay(true);
    }, 1500);
    return () => clearTimeout(handle);
  }, [
    healthy,
    currentModal,
    socketStatus.status,
    suppressInstallDisconnectOverlay,
  ]);

  if (!shouldDisplay) {
    return <></>;
  }

  return (
    <div className="biomes-box dialog game-error-overlay">
      <div className="title-bar">
        <div className="title">Disconnected</div>
      </div>
      <div className="dialog-contents">
        <p className="centered-text">
          You are disconnected from the game. We will try to automatically
          reconnect you.
        </p>
        <DialogButton
          onClick={() => {
            window.location.reload();
          }}
        >
          Reconnect Manually
        </DialogButton>
      </div>
    </div>
  );
};
