// SNAPSHOT_LIVE_NPC_LORE_RUNTIME
// Dialogue bridge for existing live snapshot NPC labels that lacked Grove bible backgrounds.
// This never creates NPCs and never applies to Harthmere NPCs.

import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_LIVE_NPC_BIBLE_VERSION,
  snapshotLiveNpcBibleAudit,
  snapshotLiveNpcLoreForDialog,
  type SnapshotLiveNpcLore,
} from "@/shared/harthmere/snapshot_live_npc_bible";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_LIVE_NPC_LORE_RUNTIME_VERSION =
  "snapshot-live-npc-lore-runtime" as const;

export type SnapshotLiveNpcLoreDialogMode =
  | "greeting"
  | "background"
  | "work"
  | "motivation";

function textBlock(text: string) {
  return `<text>${text}</text>`;
}

function dialogTextForLiveNpcLore(
  lore: SnapshotLiveNpcLore,
  mode: SnapshotLiveNpcLoreDialogMode,
) {
  if (mode === "background") {
    return [
      textBlock(lore.extraLines[0] ?? lore.line),
      textBlock(lore.background),
    ].join("");
  }
  if (mode === "work") {
    return [
      textBlock(lore.extraLines[1] ?? lore.line),
      textBlock(lore.currentGoal),
    ].join("");
  }
  if (mode === "motivation") {
    return [
      textBlock(lore.extraLines[2] ?? lore.line),
      textBlock(lore.motivation),
    ].join("");
  }
  return [textBlock(lore.line), textBlock(lore.shortDescription)].join("");
}

export function useSnapshotLiveNpcLoreDialog(
  talkingToNPCId: BiomesId,
  initialDefaultDialog: string,
) {
  const { reactResources } = useClientContext();
  const [label, entityDescription] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/entity_description", talkingToNPCId],
  );
  const [mode, setMode] = useState<SnapshotLiveNpcLoreDialogMode>("greeting");

  const lore = useMemo(
    () =>
      snapshotLiveNpcLoreForDialog({
        label: label?.text,
        entityDescriptionText: entityDescription?.text,
        defaultDialog: initialDefaultDialog,
      }),
    [label?.text, entityDescription?.text, initialDefaultDialog],
  );

  useEffect(() => {
    setMode("greeting");
  }, [lore?.id, talkingToNPCId]);

  if (!lore) {
    return undefined;
  }

  const actions: TalkDialogStepAction[] = [
    {
      name: "Ask about their story",
      onPerformed: () => setMode("background"),
    },
    {
      name: "Ask what they do here",
      onPerformed: () => setMode("work"),
    },
    {
      name: "Ask what matters to them",
      onPerformed: () => setMode("motivation"),
    },
    {
      name: "Say hello",
      onPerformed: () => setMode("greeting"),
    },
  ];

  return {
    id: `${SNAPSHOT_LIVE_NPC_LORE_RUNTIME_VERSION}-${lore.id}-${mode}`,
    dialogText: dialogTextForLiveNpcLore(lore, mode),
    actions,
    lore,
  };
}

export const SnapshotLiveNpcLoreStatusPanel: React.FunctionComponent = () => {
  const audit = snapshotLiveNpcBibleAudit();
  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 132,
        zIndex: 20,
        background: "rgba(0,0,0,0.72)",
        color: "white",
        padding: "8px 10px",
        borderRadius: 8,
        fontSize: 11,
        maxWidth: 260,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 800 }}>Snapshot NPC Bible</div>
      <div>{audit.count} existing live snapshot labels enriched</div>
      <div>No new NPC spawns. Harthmere excluded.</div>
    </div>
  );
};

export function installSnapshotLiveNpcLoreDebug() {
  if (typeof window === "undefined") return;
  const win = window as typeof window & {
    __snapshotLiveNpcBible?: unknown;
  };
  win.__snapshotLiveNpcBible = {
    version: SNAPSHOT_LIVE_NPC_BIBLE_VERSION,
    audit: snapshotLiveNpcBibleAudit,
  };
}
