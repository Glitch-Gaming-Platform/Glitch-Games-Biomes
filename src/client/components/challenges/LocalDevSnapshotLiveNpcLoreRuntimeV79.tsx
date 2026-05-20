// SNAPSHOT_LIVE_NPC_LORE_RUNTIME_V79
// Dialogue bridge for existing live snapshot NPC labels that lacked Grove bible backgrounds.
// This never creates NPCs and never applies to Harthmere NPCs.

import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_LIVE_NPC_BIBLE_VERSION_V79,
  snapshotLiveNpcBibleAuditV79,
  snapshotLiveNpcLoreForDialogV79,
  type SnapshotLiveNpcLoreV79,
} from "@/shared/harthmere/snapshot_live_npc_bible_v79";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_LIVE_NPC_LORE_RUNTIME_VERSION_V79 =
  "snapshot-live-npc-lore-runtime-v79" as const;

export type SnapshotLiveNpcLoreDialogModeV79 =
  | "greeting"
  | "background"
  | "work"
  | "motivation";

function textBlockV79(text: string) {
  return `<text>${text}</text>`;
}

function dialogTextForLiveNpcLoreV79(
  lore: SnapshotLiveNpcLoreV79,
  mode: SnapshotLiveNpcLoreDialogModeV79,
) {
  if (mode === "background") {
    return [
      textBlockV79(lore.extraLines[0] ?? lore.line),
      textBlockV79(lore.background),
    ].join("");
  }
  if (mode === "work") {
    return [
      textBlockV79(lore.extraLines[1] ?? lore.line),
      textBlockV79(lore.currentGoal),
    ].join("");
  }
  if (mode === "motivation") {
    return [
      textBlockV79(lore.extraLines[2] ?? lore.line),
      textBlockV79(lore.motivation),
    ].join("");
  }
  return [textBlockV79(lore.line), textBlockV79(lore.shortDescription)].join("");
}

export function useSnapshotLiveNpcLoreDialogV79(
  talkingToNPCId: BiomesId,
  initialDefaultDialog: string,
) {
  const { reactResources } = useClientContext();
  const [label, entityDescription] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/entity_description", talkingToNPCId],
  );
  const [mode, setMode] = useState<SnapshotLiveNpcLoreDialogModeV79>("greeting");

  const lore = useMemo(
    () =>
      snapshotLiveNpcLoreForDialogV79({
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
    id: `${SNAPSHOT_LIVE_NPC_LORE_RUNTIME_VERSION_V79}-${lore.id}-${mode}`,
    dialogText: dialogTextForLiveNpcLoreV79(lore, mode),
    actions,
    lore,
  };
}

export const SnapshotLiveNpcLoreStatusPanelV79: React.FunctionComponent = () => {
  const audit = snapshotLiveNpcBibleAuditV79();
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
      <div style={{ fontWeight: 800 }}>Snapshot NPC Bible v79</div>
      <div>{audit.count} existing live snapshot labels enriched</div>
      <div>No new NPC spawns. Harthmere excluded.</div>
    </div>
  );
};

export function installSnapshotLiveNpcLoreDebugV79() {
  if (typeof window === "undefined") return;
  const win = window as typeof window & {
    __snapshotLiveNpcBibleV79?: unknown;
  };
  win.__snapshotLiveNpcBibleV79 = {
    version: SNAPSHOT_LIVE_NPC_BIBLE_VERSION_V79,
    audit: snapshotLiveNpcBibleAuditV79,
  };
}
