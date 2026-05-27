// InboxTab — transmissions feed (system, ally, faction).
import * as React from "react";

interface Message { id: string; from: string; subject: string; preview: string; at: string; unread: boolean; kind: "system" | "ally" | "faction" }
interface InboxAdapter { getMessages?: () => Message[] }

const PLACEHOLDER: Message[] = [
  { id: "m1", from: "Jackie", subject: "Marker placed", preview: "I marked the first road marker for you. Reach it.", at: "00:02", unread: true, kind: "ally" },
  { id: "m2", from: "Singularity Bureau", subject: "Anomaly drift report", preview: "Rift drift up 4.1% this cycle. Stay alert near unstable plots.", at: "01:30", unread: false, kind: "system" },
  { id: "m3", from: "The Stabilizers", subject: "Weekly sweep", preview: "Friday 8pm. Bring exotic charge.", at: "Yesterday", unread: false, kind: "faction" },
];

export const InboxTab: React.FunctionComponent<{ adapter?: InboxAdapter }> = ({ adapter }) => {
  const msgs = adapter?.getMessages?.() ?? PLACEHOLDER;
  const [activeId, setActive] = React.useState<string | null>(msgs[0]?.id ?? null);
  const focused = msgs.find((m) => m.id === activeId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, minHeight: 360 }}>
      <ul role="listbox" aria-label="Messages" style={{ listStyle: "none", padding: 0, margin: 0 }}
        onKeyDown={(e) => {
          if (msgs.length === 0) return;
          const idx = msgs.findIndex((m) => m.id === activeId);
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(msgs[Math.min(msgs.length - 1, idx + 1)].id); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive(msgs[Math.max(0, idx - 1)].id); }
        }}
      >
        {msgs.map((m) => (
          <li key={m.id} role="option" aria-selected={activeId === m.id} tabIndex={0}
            onClick={() => setActive(m.id)} onFocus={() => setActive(m.id)}
            style={{ padding: 10, marginBottom: 3, background: activeId === m.id ? "rgba(74,222,255,0.08)" : "var(--biomes-bg-glass)",
              border: "1px solid var(--biomes-edge-cyan-soft)", borderLeft: m.unread ? "3px solid var(--biomes-edge-magenta)" : "3px solid transparent",
              cursor: "pointer", outline: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 12 }}>{m.from}</strong>
              <span style={{ fontSize: 10, color: "var(--biomes-fg-dim)" }}>{m.at}</span>
            </div>
            <div style={{ fontSize: 11 }}>{m.subject}</div>
            <div style={{ fontSize: 10, color: "var(--biomes-fg-muted)" }}>{m.preview}</div>
          </li>
        ))}
      </ul>
      <section aria-label="Message detail" style={{ padding: 12, background: "var(--biomes-bg-glass)",
        border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 }}>
        {focused ? (
          <>
            <h3 style={{ margin: 0, fontSize: 14 }}>{focused.subject}</h3>
            <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)", marginBottom: 8 }}>
              from <strong>{focused.from}</strong> — {focused.at} — {focused.kind}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>{focused.preview}</p>
          </>
        ) : (
          <div style={{ color: "var(--biomes-fg-muted)" }}>No messages.</div>
        )}
      </section>
    </div>
  );
};
