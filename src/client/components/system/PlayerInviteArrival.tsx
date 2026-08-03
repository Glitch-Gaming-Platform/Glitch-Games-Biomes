import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import {
  PLAYER_INVITE_STATUS_EVENT,
  PlayerInviteRequestError,
  clearPendingPlayerInviteCode,
  dispatchPlayerInviteStatus,
  joinPlayerInviteWithRetry,
  readPendingPlayerInviteCode,
  type PlayerInviteStatusDetail,
} from "@/client/game/invites/player_invites";
import React from "react";

const TERMINAL_INVITE_ERRORS = new Set([
  "INVITE_NOT_FOUND",
  "INVALID_INVITE_CODE",
  "INVITE_EXPIRED",
  "CANNOT_JOIN_OWN_INVITE",
  "INVITE_DESTINATION_UNAVAILABLE",
]);

export const PlayerInviteArrival: React.FunctionComponent = React.memo(() => {
  const { gardenHose, resources, userId } = useClientContext();
  const inFlightRef = React.useRef(false);
  const [notice, setNotice] = React.useState<PlayerInviteStatusDetail>();

  const attemptPendingInvite = React.useCallback(async () => {
    const code = readPendingPlayerInviteCode();
    if (!code || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const joined = await joinPlayerInviteWithRetry(code);
      clearPendingPlayerInviteCode();
      dispatchPlayerInviteStatus({
        kind: "success",
        message: joined.already_joined
          ? `You already used ${joined.inviter_name}'s invite.`
          : `You woke up beside ${joined.inviter_name}.`,
      });
    } catch (error) {
      if (
        error instanceof PlayerInviteRequestError &&
        TERMINAL_INVITE_ERRORS.has(error.code)
      ) {
        clearPendingPlayerInviteCode();
      }
      dispatchPlayerInviteStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The friend invite could not be completed.",
      });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      if (event.kind === "wake_up_complete") {
        void attemptPendingInvite();
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [attemptPendingInvite, gardenHose]);

  React.useEffect(() => {
    readPendingPlayerInviteCode();
    const interval = window.setInterval(() => {
      if (!readPendingPlayerInviteCode()) return;
      if (document.querySelector(".wake-up-container")) return;
      if (!resources.get("/ecs/c/position", userId)?.v) return;
      window.clearInterval(interval);
      void attemptPendingInvite();
    }, 250);
    return () => window.clearInterval(interval);
  }, [attemptPendingInvite, resources, userId]);

  React.useEffect(() => {
    let clearTimer: number | undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PlayerInviteStatusDetail>).detail;
      if (!detail?.message) return;
      setNotice(detail);
      if (clearTimer !== undefined) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setNotice(undefined), 5000);
    };
    window.addEventListener(PLAYER_INVITE_STATUS_EVENT, handler);
    return () => {
      window.removeEventListener(PLAYER_INVITE_STATUS_EVENT, handler);
      if (clearTimer !== undefined) window.clearTimeout(clearTimer);
    };
  }, []);

  if (!notice) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-player-invite-status={notice.kind}
      style={{
        position: "fixed",
        left: "50%",
        top: 18,
        zIndex: 1130,
        maxWidth: "min(32rem, calc(100vw - 2rem))",
        transform: "translateX(-50%)",
        padding: "9px 12px",
        border: `1px solid ${
          notice.kind === "success"
            ? "rgba(120, 224, 143, 0.65)"
            : notice.kind === "error"
              ? "rgba(239, 118, 122, 0.65)"
              : "rgba(106, 214, 255, 0.65)"
        }`,
        borderRadius: 7,
        background: "rgba(6, 12, 28, 0.94)",
        color: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        fontSize: 13,
        fontWeight: 750,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {notice.message}
    </div>
  );
});
