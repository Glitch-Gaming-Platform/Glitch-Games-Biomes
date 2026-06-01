import * as React from "react";
import type { HarthmereQuestInviteAdapterV1 } from "../adapters/questInviteAdapter";

const QUEST_INVITE_HOTKEY_CODE_V1 = "KeyJ";

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    active.isContentEditable
  );
}

export const QuestInviteHUD: React.FunctionComponent<{
  adapter?: HarthmereQuestInviteAdapterV1;
}> = ({ adapter }) => {
  const [open, setOpen] = React.useState(false);
  const [busyInviteId, setBusyInviteId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const invites = adapter?.getPendingInvites() ?? [];

  React.useEffect(() => {
    if (!adapter || invites.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== QUEST_INVITE_HOTKEY_CODE_V1 || isTypingInInput()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [adapter, invites.length]);

  React.useEffect(() => {
    if (invites.length === 0) {
      setOpen(false);
    }
  }, [invites.length]);

  if (!adapter || invites.length === 0) {
    return null;
  }

  const respond = async (inviteId: string, response: "accept" | "deny") => {
    setBusyInviteId(inviteId);
    setError(undefined);
    try {
      if (response === "accept") {
        await adapter.acceptInvite(inviteId);
      } else {
        await adapter.denyInvite(inviteId);
      }
    } catch (caught: any) {
      setError(caught?.message ?? "Quest invite response failed.");
    } finally {
      setBusyInviteId(null);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes biomesQuestInviteBlinkV1 {
            0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
            35% { transform: translateY(-7px) scale(1.035); filter: brightness(1.45); }
            65% { transform: translateY(2px) scale(0.99); filter: brightness(1.15); }
          }
          @keyframes biomesQuestInvitePulseV1 {
            0%, 100% { box-shadow: 0 0 0 0 rgba(106, 214, 255, 0.35), 0 8px 24px rgba(0, 0, 0, 0.45); }
            50% { box-shadow: 0 0 0 6px rgba(106, 214, 255, 0.02), 0 12px 32px rgba(0, 0, 0, 0.58); }
          }
        `}
      </style>
      <button
        type="button"
        aria-label={`Invite Received, ${invites.length} pending`}
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          left: 16,
          top: "45%",
          zIndex: 1095,
          display: "grid",
          gap: 2,
          minWidth: 142,
          padding: "10px 12px",
          border: "1px solid rgba(106, 214, 255, 0.72)",
          borderRadius: 6,
          background: "rgba(6, 12, 28, 0.88)",
          color: "var(--biomes-fg)",
          textAlign: "left",
          textTransform: "uppercase",
          cursor: "pointer",
          animation:
            "biomesQuestInviteBlinkV1 900ms ease-in-out infinite, biomesQuestInvitePulseV1 1200ms ease-in-out infinite",
        }}
      >
        <strong style={{ fontSize: 12, letterSpacing: "0.08em" }}>
          Invite Received
        </strong>
        <span style={{ color: "var(--biomes-fg-muted)", fontSize: 10 }}>
          {invites.length} pending - press J
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Quest invites"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1110,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(3, 7, 18, 0.72)",
          }}
        >
          <section
            className="biomes-ui-panel"
            style={{
              width: "min(560px, 100%)",
              maxHeight: "78vh",
              overflow: "auto",
              padding: 18,
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--biomes-cyan)",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Quest Invites
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>
                  {invites.length} Pending
                </h2>
              </div>
              <button
                type="button"
                className="biomes-ui-tab"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </header>
            {error ? (
              <div
                role="alert"
                style={{
                  marginBottom: 12,
                  padding: "8px 10px",
                  border: "1px solid rgba(255, 116, 116, 0.55)",
                  borderRadius: 6,
                  background: "rgba(97, 22, 28, 0.34)",
                  color: "var(--biomes-fg)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 10 }}>
              {invites.map((invite) => {
                const busy = busyInviteId === invite.inviteId;
                return (
                  <article
                    key={invite.inviteId}
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      border: "1px solid rgba(106, 214, 255, 0.22)",
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: 15 }}>
                        {invite.questTitle}
                      </strong>
                      <span
                        style={{
                          color: "var(--biomes-fg-muted)",
                          fontSize: 12,
                        }}
                      >
                        From {invite.inviterActorId} - {invite.questArea}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--biomes-fg-muted)",
                        fontSize: 13,
                        lineHeight: 1.35,
                      }}
                    >
                      {invite.objectiveText}
                    </p>
                    {invite.reward ? (
                      <span
                        style={{
                          color: "var(--biomes-gold)",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Reward: {invite.reward}
                      </span>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="biomes-ui-tab"
                        disabled={busy}
                        onClick={() => void respond(invite.inviteId, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="biomes-ui-tab"
                        disabled={busy}
                        onClick={() => void respond(invite.inviteId, "deny")}
                      >
                        Deny
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
