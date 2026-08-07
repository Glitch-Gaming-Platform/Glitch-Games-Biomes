import * as React from "react";
import type { TabKey } from "./BiomesUITypes";

export interface SnapshotGroveTutorTarget {
  label: string;
  tab?: TabKey;
  action?: "recipes" | "chat";
  shortcut?: string;
}

const TARGETS: Readonly<Record<string, SnapshotGroveTutorTarget>> = {
  Bag: { label: "Bag", tab: "inventory", shortcut: "I" },
  Craft: { label: "Recipes", action: "recipes", shortcut: "R" },
  Map: { label: "Map", tab: "map", shortcut: "M" },
  Quests: { label: "Quests", tab: "quests", shortcut: "J" },
  Tasks: { label: "Tasks", tab: "quests", shortcut: "J" },
  Mail: { label: "Mail", tab: "inbox", shortcut: "V" },
  Notif: { label: "Today", tab: "daily" },
  Codex: { label: "Collections", tab: "collections", shortcut: "C" },
  Settings: { label: "Options", tab: "options" },
  Chat: { label: "Chat", action: "chat" },
};

export function snapshotGroveTutorTargetForLabelForTest(
  label: string
): SnapshotGroveTutorTarget | undefined {
  return TARGETS[label];
}

export function snapshotGroveTutorLabelForTabForTest(
  tab: TabKey
): string | undefined {
  return Object.entries(TARGETS).find(([, target]) => target.tab === tab)?.[0];
}

export const SnapshotGroveTutorPrompt: React.FunctionComponent<{
  labels: ReadonlySet<string>;
  onOpenTab: (tab: TabKey) => void;
  onOpenRecipes: () => void;
  onOpenChat: () => void;
}> = ({ labels, onOpenTab, onOpenRecipes, onOpenChat }) => {
  const targets = [...labels].flatMap((label) => {
    const target = snapshotGroveTutorTargetForLabelForTest(label);
    return target ? [{ key: label, ...target }] : [];
  });
  if (!targets.length) return null;
  return (
    <aside
      aria-label="Grove tutorial HUD guidance"
      data-snapshot-grove-tutor-prompt="visible"
      style={{
        position: "fixed",
        right: 18,
        bottom: 208,
        zIndex: 1080,
        display: "grid",
        gap: 8,
        width: "min(250px, calc(100vw - 36px))",
        padding: 10,
        border: "1px solid rgba(217,249,157,.7)",
        borderRadius: 12,
        background: "rgba(8,18,12,.94)",
        color: "white",
        boxShadow: "0 0 24px rgba(190,242,100,.28)",
        pointerEvents: "auto",
      }}
    >
      <style>{`@keyframes snapshotGroveReplacementTutorPulse {0%,100%{box-shadow:0 0 0 0 rgba(217,249,157,.85),0 0 16px rgba(190,242,100,.5);transform:translateY(0)}50%{box-shadow:0 0 0 7px rgba(217,249,157,0),0 0 26px rgba(190,242,100,.9);transform:translateY(-2px)}}`}</style>
      <div
        style={{
          color: "#d9f99d",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: ".13em",
          textTransform: "uppercase",
        }}
      >
        Open this next
      </div>
      {targets.map((target) => (
        <button
          key={target.key}
          type="button"
          aria-label={`Tutorial target: ${target.key}`}
          data-snapshot-grove-tutor-target={target.key}
          onClick={() => {
            if (target.tab) onOpenTab(target.tab);
            else if (target.action === "recipes") onOpenRecipes();
            else if (target.action === "chat") onOpenChat();
          }}
          style={{
            border: "1px solid rgba(217,249,157,.85)",
            borderRadius: 9,
            background: "rgba(190,242,100,.24)",
            color: "#f7fee7",
            padding: "9px 11px",
            textAlign: "left",
            fontSize: 12,
            fontWeight: 850,
            cursor: "pointer",
            animation: "snapshotGroveReplacementTutorPulse 1.15s ease-in-out infinite",
          }}
        >
          {`Open ${target.label}${target.shortcut ? ` (${target.shortcut})` : ""}`}
        </button>
      ))}
    </aside>
  );
};
