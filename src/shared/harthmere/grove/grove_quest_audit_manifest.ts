// GROVE_QUEST_AUDIT_MANIFEST
//
// One generated evidence row for every authored Grove objective. This is the
// pre-browser contract: the slow visual runner may consume these rows, but it
// must never invent a marker, event, item, recipe, NPC, reward, or authority
// expectation independently.

import { CH1_GROVE_SUPPLIER_ROUTE } from "@/shared/harthmere/ch1_objective_routes";
import { GROVE_ITEM_VISUAL_ASSETS } from "@/shared/harthmere/grove_item_visual_assets";
import { HARTHMERE_GROVE_QUEST_OBJECT_ASSET_URLS } from "@/shared/harthmere/grove_quest_visual_assets";
import {
  groveNativeQuestId,
  groveNativeStepId,
} from "@/shared/harthmere/grove/grove_quest_ids";
import { GROVE_QUEST_CATALOG } from "@/shared/harthmere/grove/grove_quest_catalog";
import {
  groveQuestGiverId,
  groveStepRequiredCount,
  groveStepTargetMarkerIds,
  type GroveQuestArc,
  type GroveQuestCategory,
  type GroveTrigger,
} from "@/shared/harthmere/grove/grove_quest_schema";
import {
  groveLandmark,
  groveMarkerWorldPosition,
} from "@/shared/harthmere/grove/grove_waypoints";
import {
  HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST,
} from "@/shared/harthmere/harthmere_native_quest_manifest";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeBiomesIdForRecipeId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { harthmereObjectInteractionForLabel } from "@/shared/harthmere/object_interaction_semantics";
import {
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS,
  snapshotGroveObjectiveCompletionFixture,
  snapshotGrovePracticeItemFixtureForObjective,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";
import {
  SNAPSHOT_STRUCTURED_REWARDS,
  type SnapshotStructuredReward,
} from "@/shared/harthmere/snapshot_complete_port";
import type { Vec3 } from "@/shared/math/types";

export const GROVE_QUEST_AUDIT_MANIFEST_VERSION = 1 as const;

export type GroveAuditPresentationKind =
  | "native_npc"
  | "authored_glb"
  | "procedural_world_object"
  | "world_landmark"
  | "hud_surface";

export type GroveAuditHudSurface =
  | "Bag"
  | "Craft"
  | "Map"
  | "Quests"
  | "Mail"
  | "Chat"
  | "Guild"
  | "World";

export interface GroveQuestAuditObjectiveRow {
  readonly key: string;
  readonly questIndex: number;
  readonly questId: string;
  readonly questTitle: string;
  readonly arc: GroveQuestArc;
  readonly category: GroveQuestCategory;
  readonly connectorToHarthmere: boolean;
  readonly giverId: string;
  readonly giverEntityId: number;
  readonly objectiveIndex: number;
  readonly objectiveId: string;
  readonly objective: string;
  readonly trigger: GroveTrigger;
  readonly nativeQuestId: number;
  readonly nativeStepId: number;
  readonly markerId: string;
  readonly markerLabel: string;
  readonly markerKind: SnapshotGroveLandmark["kind"];
  readonly markerNpcId?: string;
  readonly markerPosition: Vec3;
  readonly targetMarkerIds: readonly string[];
  readonly targetMarkerPositions: readonly Vec3[];
  readonly requiredCount: number;
  readonly completionEventKinds: readonly string[];
  readonly primaryCompletionEvent: Readonly<Record<string, unknown>>;
  readonly worldInteractionKind?: string;
  readonly signedWorldReceiptRequired: boolean;
  readonly practiceItem?: {
    readonly itemId: string;
    readonly nativeItemId: number;
    readonly quantity: number;
    readonly label: string;
    readonly assetUrl?: string;
  };
  readonly craft?: {
    readonly recipeId: string;
    readonly nativeRecipeId: number;
    readonly outputItemId: string;
    readonly nativeOutputItemId: number;
  };
  readonly inventoryRequirement?: {
    readonly itemId: string;
    readonly nativeItemId: number;
    readonly count: number;
    readonly consumeOnComplete: boolean;
  };
  readonly presentationKind: GroveAuditPresentationKind;
  readonly authoredAssetUrl?: string;
  readonly hudSurface: GroveAuditHudSurface;
  readonly exactMapPinRequired: true;
  readonly nativeEcsEvidenceRequired: true;
  readonly cloudSaveEvidenceRequired: true;
  readonly synchronizedFrontendEvidenceRequired: true;
  readonly currentScreenshotRequired: true;
  readonly completedScreenshotRequired: true;
  readonly chapter1DialoguePolicy:
    | "not_npc"
    | "target_scoped_precedence_and_release";
  readonly chapter1SupplierOverlap: boolean;
  readonly completionAcknowledgement?: string;
  readonly structuredReward?: SnapshotStructuredReward;
}

const legacyQuestById = new Map(
  SNAPSHOT_GROVE_QUESTS.map((quest) => [quest.id, quest])
);
const rewardByQuestId = new Map(
  SNAPSHOT_STRUCTURED_REWARDS.map((reward) => [reward.questId, reward])
);
const itemAssetById = new Map(
  GROVE_ITEM_VISUAL_ASSETS.map((asset) => [asset.itemId, asset.assetUrl])
);

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const chapter1SupplierNames = new Set(
  CH1_GROVE_SUPPLIER_ROUTE.map((stop) => normalizedName(stop.label))
);

function isChapter1SupplierNpc(npcId: string | undefined) {
  if (!npcId) return false;
  const row = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
    npcId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
  ];
  return Boolean(row && chapter1SupplierNames.has(normalizedName(row.displayName)));
}

function hudSurfaceForTrigger(
  trigger: GroveTrigger,
  objective: string
): GroveAuditHudSurface {
  switch (trigger) {
    case "open_tab": {
      const text = objective.toLowerCase();
      if (/mail|storage|recovery|inbox/.test(text)) return "Mail";
      if (/map|marker/.test(text)) return "Map";
      if (/quest|journal/.test(text)) return "Quests";
      if (/chat|channel|whisper|say/.test(text)) return "Chat";
      if (/recipe|craft/.test(text)) return "Craft";
      if (/guild|party/.test(text)) return "Guild";
      return "Bag";
    }
    case "inventory_change":
    case "item_use":
      return "Bag";
    case "craft":
      return "Craft";
    default:
      return "World";
  }
}

function presentationFor(
  landmark: SnapshotGroveLandmark,
  trigger: GroveTrigger
): { kind: GroveAuditPresentationKind; assetUrl?: string } {
  if (landmark.kind === "npc") return { kind: "native_npc" };
  const assetUrl = HARTHMERE_GROVE_QUEST_OBJECT_ASSET_URLS[landmark.id];
  if (assetUrl) return { kind: "authored_glb", assetUrl };
  if (["interact", "collect", "item_grant"].includes(trigger)) {
    return { kind: "procedural_world_object" };
  }
  if (trigger === "open_tab") return { kind: "hud_surface" };
  return { kind: "world_landmark" };
}

export function buildGroveQuestAuditManifest(): GroveQuestAuditObjectiveRow[] {
  return GROVE_QUEST_CATALOG.flatMap((quest, questIndex) => {
    const giverId = groveQuestGiverId(quest);
    const giver = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
      giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
    ];
    const legacyQuest = legacyQuestById.get(quest.id);
    if (!giver || !legacyQuest) return [];

    return quest.steps.flatMap((step) => {
      const landmark = groveLandmark(step.markerId);
      const markerPosition = groveMarkerWorldPosition(step.markerId);
      const nativeQuestId = groveNativeQuestId(quest.id);
      const nativeStepId = groveNativeStepId(quest.id, step.index);
      const primaryCompletionEvent = snapshotGroveObjectiveCompletionFixture(
        legacyQuest,
        step.index
      );
      const targetMarkerIds = [...groveStepTargetMarkerIds(step)];
      const targetMarkerPositions = targetMarkerIds.flatMap((markerId) => {
        const position = groveMarkerWorldPosition(markerId);
        return position ? [position] : [];
      });
      if (
        !landmark ||
        !markerPosition ||
        nativeQuestId === undefined ||
        nativeStepId === undefined ||
        !primaryCompletionEvent
      ) {
        return [];
      }

      const practiceItem = snapshotGrovePracticeItemFixtureForObjective(
        legacyQuest,
        step.index
      );
      const practiceNativeId = practiceItem
        ? harthmereNativeBiomesIdForItemId(practiceItem.itemId)
        : undefined;
      const nativeRecipeId = step.craft
        ? harthmereNativeBiomesIdForRecipeId(step.craft.recipeId)
        : undefined;
      const nativeOutputItemId = step.craft
        ? harthmereNativeBiomesIdForItemId(step.craft.outputItemId)
        : undefined;
      const nativeRequiredItemId = step.inventory
        ? harthmereNativeBiomesIdForItemId(step.inventory.itemId)
        : undefined;
      const presentation = presentationFor(landmark, step.trigger);
      const targetNpcId = landmark.npcId;
      const interaction = harthmereObjectInteractionForLabel({
        label: landmark.label,
      });

      return [
        {
          key: `${quest.id}:${step.index}`,
          questIndex,
          questId: quest.id,
          questTitle: quest.title,
          arc: quest.arc,
          category: quest.category,
          connectorToHarthmere: quest.connectorToHarthmere,
          giverId,
          giverEntityId: Number(giver.entityId),
          objectiveIndex: step.index,
          objectiveId: step.id,
          objective: step.label,
          trigger: step.trigger,
          nativeQuestId: Number(nativeQuestId),
          nativeStepId: Number(nativeStepId),
          markerId: step.markerId,
          markerLabel: landmark.label,
          markerKind: landmark.kind,
          markerNpcId: targetNpcId,
          markerPosition,
          targetMarkerIds,
          targetMarkerPositions,
          requiredCount: groveStepRequiredCount(step),
          completionEventKinds:
            SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS[step.trigger],
          primaryCompletionEvent: primaryCompletionEvent as unknown as Readonly<
            Record<string, unknown>
          >,
          worldInteractionKind: interaction?.kind,
          signedWorldReceiptRequired:
            landmark.kind !== "npc" &&
            ["interact", "collect", "item_grant"].includes(step.trigger),
          practiceItem:
            practiceItem && practiceNativeId !== undefined
              ? {
                  ...practiceItem,
                  nativeItemId: Number(practiceNativeId),
                  assetUrl: itemAssetById.get(practiceItem.itemId),
                }
              : undefined,
          craft:
            step.craft &&
            nativeRecipeId !== undefined &&
            nativeOutputItemId !== undefined
              ? {
                  ...step.craft,
                  nativeRecipeId: Number(nativeRecipeId),
                  nativeOutputItemId: Number(nativeOutputItemId),
                }
              : undefined,
          inventoryRequirement:
            step.inventory && nativeRequiredItemId !== undefined
              ? {
                  ...step.inventory,
                  nativeItemId: Number(nativeRequiredItemId),
                }
              : undefined,
          presentationKind: presentation.kind,
          authoredAssetUrl: presentation.assetUrl,
          hudSurface: hudSurfaceForTrigger(step.trigger, step.label),
          exactMapPinRequired: true,
          nativeEcsEvidenceRequired: true,
          cloudSaveEvidenceRequired: true,
          synchronizedFrontendEvidenceRequired: true,
          currentScreenshotRequired: true,
          completedScreenshotRequired: true,
          chapter1DialoguePolicy:
            landmark.kind === "npc"
              ? "target_scoped_precedence_and_release"
              : "not_npc",
          chapter1SupplierOverlap: isChapter1SupplierNpc(targetNpcId ?? giverId),
          completionAcknowledgement:
            step.index === quest.steps.length - 1
              ? `${quest.title} is handled.`
              : undefined,
          structuredReward:
            step.index === quest.steps.length - 1
              ? rewardByQuestId.get(quest.id)
              : undefined,
        } satisfies GroveQuestAuditObjectiveRow,
      ];
    });
  });
}

export const GROVE_QUEST_AUDIT_MANIFEST: readonly GroveQuestAuditObjectiveRow[] =
  Object.freeze(buildGroveQuestAuditManifest());

export function groveQuestAuditTriggerKinds(): GroveTrigger[] {
  return [
    ...new Set(GROVE_QUEST_AUDIT_MANIFEST.map((row) => row.trigger)),
  ].sort() as GroveTrigger[];
}

