import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import { containMobileControlEvent } from "@/client/components/mobileControlEvents";
import {
  createPlayerInvite,
  type PlayerInviteCreateResponse,
} from "@/client/game/invites/player_invites";
import React from "react";

export function playerInviteShareText(invite: PlayerInviteCreateResponse) {
  return invite.play_url;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("COPY_FAILED");
  }
}

export const PlayerInviteModal: React.FunctionComponent<{
  open: boolean;
  onClose: () => void;
  mobile?: boolean;
}> = ({ open, onClose, mobile = false }) => {
  const pointerLockManager = usePointerLockManager();
  const returnPointerLockRef =
    React.useRef<PointerLockUnlockWhileOpenReturnRef>({ current: false });
  const [invite, setInvite] = React.useState<PlayerInviteCreateResponse>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [copied, setCopied] = React.useState(false);
  const requestedForOpenRef = React.useRef(false);

  const loadInvite = React.useCallback(async (rotate = false) => {
    setLoading(true);
    setError(undefined);
    setCopied(false);
    try {
      setInvite(await createPlayerInvite(rotate));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Invites are temporarily unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      requestedForOpenRef.current = false;
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        returnPointerLockRef.current
      );
      return;
    }
    openPointerLockUnlockWhileOpen(
      pointerLockManager,
      returnPointerLockRef.current
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        returnPointerLockRef.current
      );
    };
  }, [onClose, open, pointerLockManager]);

  React.useEffect(() => {
    if (!open || requestedForOpenRef.current) return;
    requestedForOpenRef.current = true;
    void loadInvite();
  }, [loadInvite, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite friends"
      data-pointer-lock-policy="unlock-while-open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={backdropStyle}
    >
      <section className="biomes-ui-panel" style={panelStyle}>
        <header style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Play Together</div>
            <h2 style={{ margin: "3px 0 0", fontSize: 24 }}>
              Invite Friends To Play With You!
            </h2>
          </div>
          <button
            type="button"
            className="biomes-ui-tab"
            aria-label="Close invite"
            onPointerDown={(event) => {
              if (!mobile) {
                return;
              }
              // MOBILE_PLAYER_INVITE_CLOSE_TOUCH: use the same immediate phone
              // close policy as the HUD controls and BiomesUI overlays.
              containMobileControlEvent(event);
              onClose();
            }}
            onClick={(event) => {
              if (mobile) {
                containMobileControlEvent(event);
                if (event.detail !== 0) {
                  return;
                }
              }
              onClose();
            }}
          >
            Close
          </button>
        </header>

        <p style={helpStyle}>
          Send this Glitch invite link to your friend. The generated code is
          included in the URL, and the game will place them beside you after
          Wake Up automatically.
        </p>

        {error && (
          <div role="alert" style={errorStyle}>
            {error}
          </div>
        )}

        <div style={inviteBoxStyle}>
          <div style={fieldLabelStyle}>Glitch invite link</div>
          <input
            aria-label="Glitch invite link"
            readOnly
            value={invite?.play_url ?? (loading ? "Creating invite…" : "")}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="biomes-ui-tab"
              disabled={!invite || loading}
              onClick={() => {
                if (!invite) return;
                void copyText(playerInviteShareText(invite))
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError("Copy failed. Select the invite link manually.")
                  );
              }}
            >
              {copied ? "Copied" : "Copy Invite Link"}
            </button>
            <button
              type="button"
              className="biomes-ui-tab"
              disabled={loading}
              onClick={() => void loadInvite(true)}
            >
              New Code
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1120,
  display: "grid",
  placeItems: "center",
  padding: 18,
  background: "rgba(3, 7, 18, 0.76)",
  pointerEvents: "auto",
};

const panelStyle: React.CSSProperties = {
  width: "min(620px, 100%)",
  maxHeight: "86vh",
  overflow: "auto",
  padding: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 12,
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--biomes-cyan)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const helpStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--biomes-fg-muted)",
  fontSize: 12,
  lineHeight: 1.45,
};

const inviteBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 14,
  padding: 14,
  border: "1px solid rgba(106, 214, 255, 0.3)",
  borderRadius: 8,
  background: "rgba(6, 18, 36, 0.72)",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "var(--biomes-fg-muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  padding: "9px 10px",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 5,
  background: "rgba(0,0,0,0.38)",
  color: "var(--biomes-fg)",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "9px 11px",
  border: "1px solid rgba(255, 116, 116, 0.55)",
  borderRadius: 6,
  background: "rgba(97, 22, 28, 0.34)",
  color: "var(--biomes-fg)",
  fontSize: 12,
  fontWeight: 700,
};
