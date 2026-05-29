// InboxTab — real direct messages and activity feed. No placeholder messages.
import * as React from "react";
import type { Envelope } from "@/shared/chat/types";
import type { BiomesId } from "@/shared/ids";

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  at: string;
  unread: boolean;
  kind: "system" | "ally" | "faction" | "direct";
}

export interface InboxThread {
  id: string;
  peerId: BiomesId;
  peerName: string;
  messages: Envelope[];
  lastAt: number;
  unread?: boolean;
}

export interface InboxAdapter {
  getMessages?: () => InboxMessage[];
  getThreads?: () => InboxThread[];
  resolveUserName?: (username: string) => Promise<{ id: BiomesId; username: string } | undefined>;
  sendDirectMessage?: (toUserId: BiomesId, content: string) => Promise<void>;
}

function formatEnvelopePreview(envelope: Envelope): string {
  const message = envelope.message as any;
  if (message?.kind === "text") return String(message.content ?? "");
  return String(message?.kind ?? "message").replace(/_/g, " ");
}

function formatEnvelopeTime(envelope: Envelope): string {
  const timestamp = Number(envelope.createdAt ?? Date.now());
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "now";
  }
}

const EmptyState: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: 14,
      border: "1px dashed var(--biomes-edge-cyan-soft)",
      background: "rgba(0,0,0,0.18)",
      color: "var(--biomes-fg-muted)",
      fontSize: 12,
    }}
  >
    {children}
  </div>
);

export const InboxTab: React.FunctionComponent<{ adapter?: InboxAdapter }> = ({ adapter }) => {
  const threads = adapter?.getThreads?.() ?? [];
  const activityMessages = adapter?.getMessages?.() ?? [];
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(threads[0]?.id ?? null);
  const [newUsername, setNewUsername] = React.useState("");
  const [resolvedUser, setResolvedUser] = React.useState<{ id: BiomesId; username: string } | undefined>();
  const [resolveError, setResolveError] = React.useState<string | undefined>();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (activeThreadId && threads.some((thread) => thread.id === activeThreadId)) return;
    setActiveThreadId(threads[0]?.id ?? null);
  }, [activeThreadId, threads.map((thread) => thread.id).join("|")]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const updateDraft = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  };

  const resolveRecipient = async () => {
    const username = newUsername.trim();
    setResolvedUser(undefined);
    setResolveError(undefined);
    if (!username || !adapter?.resolveUserName) return;
    const result = await adapter.resolveUserName(username);
    if (!result) {
      setResolveError("No player found with that username.");
      return;
    }
    setResolvedUser(result);
    const existing = threads.find((thread) => thread.peerId === result.id);
    setActiveThreadId(existing?.id ?? `new:${result.id}`);
  };

  const sendTo = async (toUserId: BiomesId, draftKey: string) => {
    const content = (drafts[draftKey] ?? "").trim();
    if (!content || !adapter?.sendDirectMessage) return;
    setSending(true);
    try {
      await adapter.sendDirectMessage(toUserId, content);
      updateDraft(draftKey, "");
      setResolvedUser(undefined);
      setNewUsername("");
      setResolveError(undefined);
    } finally {
      setSending(false);
    }
  };

  const selectedRecipient = activeThread?.peerId ?? resolvedUser?.id;
  const selectedLabel = activeThread?.peerName ?? resolvedUser?.username;
  const selectedDraftKey = activeThread?.id ?? (resolvedUser ? `new:${resolvedUser.id}` : "new");
  const selectedDraft = drafts[selectedDraftKey] ?? "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, minHeight: 420 }}>
      <aside>
        <div style={{ marginBottom: 12, padding: 10, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>New message</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resolveRecipient();
            }}
          >
            <input
              type="text"
              value={newUsername}
              placeholder="Player username"
              onChange={(e) => {
                setNewUsername(e.target.value);
                setResolvedUser(undefined);
                setResolveError(undefined);
              }}
              style={{ width: "100%", fontSize: 12, padding: 8, marginBottom: 6 }}
            />
            <button type="submit" disabled={!newUsername.trim() || !adapter?.resolveUserName} style={{ fontSize: 12 }}>
              Find player
            </button>
            {resolvedUser && (
              <div style={{ marginTop: 6, color: "var(--biomes-fg)", fontSize: 11 }}>
                Ready to message <strong>{resolvedUser.username}</strong>
              </div>
            )}
            {resolveError && <div style={{ marginTop: 6, color: "#ff8a8a", fontSize: 11 }}>{resolveError}</div>}
          </form>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Direct messages</div>
        {threads.length === 0 ? (
          <EmptyState>No direct message threads yet. Search for a player above to start one.</EmptyState>
        ) : (
          <ul role="listbox" aria-label="Direct message threads" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {threads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return (
                <li
                  key={thread.id}
                  role="option"
                  aria-selected={activeThreadId === thread.id}
                  tabIndex={0}
                  onClick={() => setActiveThreadId(thread.id)}
                  onFocus={() => setActiveThreadId(thread.id)}
                  style={{
                    padding: 10,
                    marginBottom: 3,
                    background: activeThreadId === thread.id ? "rgba(74,222,255,0.08)" : "var(--biomes-bg-glass)",
                    border: "1px solid var(--biomes-edge-cyan-soft)",
                    borderLeft: thread.unread ? "3px solid var(--biomes-edge-magenta)" : "3px solid transparent",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 12 }}>{thread.peerName}</strong>
                    <span style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>
                      {lastMessage ? formatEnvelopeTime(lastMessage) : "new"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--biomes-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lastMessage ? formatEnvelopePreview(lastMessage) : "No messages yet."}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>Activity</div>
        {activityMessages.length === 0 ? (
          <EmptyState>No activity notifications.</EmptyState>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {activityMessages.map((m) => (
              <li
                key={m.id}
                style={{
                  padding: 10,
                  marginBottom: 3,
                  background: "var(--biomes-bg-glass)",
                  border: "1px solid var(--biomes-edge-cyan-soft)",
                  borderLeft: m.unread ? "3px solid var(--biomes-edge-magenta)" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12 }}>{m.from}</strong>
                  <span style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>{m.at}</span>
                </div>
                <div style={{ fontSize: 11 }}>{m.subject}</div>
                <div style={{ fontSize: 10, color: "var(--biomes-fg-muted)" }}>{m.preview}</div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section
        aria-label="Direct message detail"
        style={{ padding: 12, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 }}
      >
        {selectedRecipient && selectedLabel ? (
          <>
            <h3 style={{ margin: 0, fontSize: 14 }}>Message {selectedLabel}</h3>
            <div style={{ marginTop: 12, minHeight: 240, maxHeight: 300, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {(activeThread?.messages ?? []).map((envelope) => (
                <div key={envelope.id} style={{ padding: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 10, color: "var(--biomes-fg-muted)", marginBottom: 3 }}>
                    {formatEnvelopeTime(envelope)}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}>{formatEnvelopePreview(envelope)}</div>
                </div>
              ))}
              {!activeThread?.messages.length && <EmptyState>This conversation has no messages yet.</EmptyState>}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendTo(selectedRecipient, selectedDraftKey);
              }}
              style={{ display: "flex", gap: 8, marginTop: 12 }}
            >
              <input
                type="text"
                value={selectedDraft}
                placeholder={`Message ${selectedLabel}`}
                onChange={(e) => updateDraft(selectedDraftKey, e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: 8 }}
              />
              <button type="submit" disabled={sending || !selectedDraft.trim() || !adapter?.sendDirectMessage} style={{ fontSize: 12 }}>
                Send
              </button>
            </form>
          </>
        ) : (
          <EmptyState>Select a direct message thread or search for a player to start a real conversation.</EmptyState>
        )}
      </section>
    </div>
  );
};
