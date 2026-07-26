import { useCanTalkToNpc } from "@/client/components/challenges/TalkToNPCDefaultDialog";
import { openHarthmereObjectContainer } from "@/client/components/challenges/harthmereObjectContainers";
import {
  completeHarthmereJobsBoardFieldObjectiveForObjectSoon,
  harthmereWorldObjectInteractionErrorMessage,
  performHarthmereObjectInteraction,
} from "@/client/components/challenges/harthmereObjectInteractions";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { MaybeError } from "@/client/components/system/MaybeError";
import { mergeInspectShortcutLayers } from "@/client/components/overlays/inspected/inspectShortcutOrdering";
import { ShortcutText } from "@/client/components/system/ShortcutText";
import type { InspectableOverlay } from "@/client/game/resources/overlays";
import type { GlobalKeyCode } from "@/client/game/util/keyboard";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import {
  harthmereObjectInteractionForLabel,
  isHarthmereContainerObjectLabel,
  isHarthmereNonLivingObjectLabel,
} from "@/shared/harthmere/object_interaction_semantics";
import { nativeQuestGiverUsesEcsDialogue } from "@/shared/harthmere/native_road_ahead_contract";
import { relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";

export type InspectShortcut = {
  title: string | JSX.Element;
  onKeyDown: () => unknown;
  disabled?: boolean;
  extraClassName?: string;
};

export type InspectShortcuts = InspectShortcut[];

export const CursorInspectionComponent: React.FunctionComponent<
  PropsWithChildren<{
    overlay?: InspectableOverlay;
    error?: string;
    extraClassName?: string;
    customHeader?: JSX.Element;
    title?: string | JSX.Element;
    subtitle?: string | JSX.Element;
    shortcuts?: InspectShortcuts;
    suppressTalkShortcut?: boolean;
    allowPlaceableObjectInteraction?: boolean;
    fade?: boolean;
  }>
> = ({
  overlay,
  error,
  extraClassName,
  customHeader,
  title,
  subtitle,
  shortcuts,
  suppressTalkShortcut,
  allowPlaceableObjectInteraction,
  fade,
  children,
}) => {
  const context = useClientContext();
  const { reactResources, resources, gardenHose } = context;
  const maybeEntityId = overlay?.entityId ?? INVALID_BIOMES_ID;
  const [tweaks, itemBuyer, label, entityDescription, questGiver] =
    reactResources.useAll(
      ["/tweaks"],
      ["/ecs/c/item_buyer", maybeEntityId],
      ["/ecs/c/label", maybeEntityId],
      ["/ecs/c/entity_description", maybeEntityId],
      ["/ecs/c/quest_giver", maybeEntityId]
    );

  const canTalk = useCanTalkToNpc(
    context,
    overlay?.entityId ?? INVALID_BIOMES_ID
  );
  const [openingContainer, setOpeningContainer] = useState(false);
  const [containerOpenError, setContainerOpenError] = useState<string>();
  const [objectInteractionPending, setObjectInteractionPending] =
    useState(false);
  const [objectInteractionError, setObjectInteractionError] =
    useState<string>();

  const item = relevantBiscuitForEntityId(resources, overlay?.entityId);
  const inspectText =
    item && item.customInspectText ? item.customInspectText : "Talk";
  // HARTHMERE_WORLD_OBJECT_INSPECT_OVERLAY: procedural world props are not ECS
  // entities, so they carry their label/description inline on the overlay rather
  // than via `/ecs/c/label`. Prefer the inline values when present.
  const harthmereObjectLabel =
    overlay?.kind === "harthmere_object" ? overlay.label : label?.text;
  const harthmereObjectDescription =
    overlay?.kind === "harthmere_object"
      ? overlay.entityDescription
      : entityDescription?.text;
  // For harthmere_object overlays the entityId is INVALID_BIOMES_ID when the
  // object is a static procedural beacon, but a REAL entity id when the overlay
  // was built from a live ECS world object (seeded chest/crate/...). Prefer the
  // real id so container de-dupe and interaction handlers target the instance.
  const harthmereObjectInteractionEntityId = overlay?.entityId;
  const harthmereObjectId =
    overlay?.kind === "harthmere_object" ? overlay.objectId : undefined;
  // Quest metadata may add progression, but it must never replace a physical
  // capability. Road Ahead's quest-giver frames are containers first; living
  // NPC quest givers continue to use the native dialogue path.
  const isNativeDialogueQuestObject = nativeQuestGiverUsesEcsDialogue(
    questGiver,
    harthmereObjectLabel
  );
  const canUseObjectSemantics =
    overlay?.kind !== "placeable" || allowPlaceableObjectInteraction;
  const isHarthmereObjectContainer =
    !isNativeDialogueQuestObject &&
    canUseObjectSemantics &&
    isHarthmereContainerObjectLabel({
      label: harthmereObjectLabel,
      entityDescription: harthmereObjectDescription,
    });
  const isHarthmereWorldObject =
    !isNativeDialogueQuestObject &&
    canUseObjectSemantics &&
    isHarthmereNonLivingObjectLabel({
      label: harthmereObjectLabel,
      entityDescription: harthmereObjectDescription,
    });
  const harthmereObjectInteraction = canUseObjectSemantics
    ? harthmereObjectInteractionForLabel({
        label: harthmereObjectLabel,
        entityDescription: harthmereObjectDescription,
      })
    : undefined;
  // Procedural world props use INVALID_BIOMES_ID (0, falsy), so a plain
  // `overlay?.entityId` truthiness gate would hide their prompt. Treat the
  // harthmere_object overlay as an actionable target explicitly.
  const harthmereObjectActionable = Boolean(
    overlay && (overlay.kind === "harthmere_object" || overlay.entityId)
  );

  const trueShortcuts = useMemo(() => {
    // Typed overlays own F. Supplemental actions are appended so a quest_giver
    // component cannot turn Move/Open/Read/Craft/Play into Talk, and an item
    // buyer cannot turn a station or shop into Sell.
    const typedActions = [...(shortcuts ?? [])];
    const objectActions: InspectShortcuts = [];
    const contextualActions: InspectShortcuts = [];
    if (
      !isHarthmereWorldObject &&
      !suppressTalkShortcut &&
      // Reward-dialogue quest props are placeables rather than living NPCs, so
      // useCanTalkToNpc can legitimately return false even though the exact ECS
      // entity owns quest_giver/default_dialog and is the authored return target.
      // Once nativeQuestGiverUsesEcsDialogue has classified that immutable
      // source, expose the same real talk modal without requiring NPC metadata.
      (canTalk || isNativeDialogueQuestObject) &&
      overlay?.entityId
    ) {
      contextualActions.push({
        title: inspectText,
        onKeyDown: () => {
          reactResources.update("/scene/local_player", (localPlayer) => {
            localPlayer.talkingToNpc = overlay.entityId;
          });
          reactResources.set("/game_modal", {
            kind: "talk_to_npc",
            talkingToNPCId: overlay.entityId,
          });
        },
      });
    }

    if (isHarthmereObjectContainer && harthmereObjectActionable) {
      objectActions.push({
        title: openingContainer
          ? "Opening…"
          : harthmereObjectInteraction?.title ?? "Open Container",
        disabled: openingContainer,
        onKeyDown: () => {
          setContainerOpenError(undefined);
          setOpeningContainer(true);
          void openHarthmereObjectContainer({
            entityId: harthmereObjectInteractionEntityId ?? INVALID_BIOMES_ID,
            objectId: harthmereObjectId,
            label: harthmereObjectLabel,
            resources,
          })
            .then((result) => {
              completeHarthmereJobsBoardFieldObjectiveForObjectSoon({
                objectId: harthmereObjectId,
                label: harthmereObjectLabel,
                interactionKind: "open_container",
                resources,
              });
              if (
                result.native &&
                result.containerId &&
                result.containerItemId
              ) {
                reactResources.set("/game_modal", {
                  kind: "generic_miniphone",
                  rootPayload: {
                    type: "container",
                    placeableId: result.containerId,
                    itemId: result.containerItemId,
                  },
                });
              }
            })
            .catch(() =>
              setContainerOpenError(
                "The container could not be opened. Move closer and try again."
              )
            )
            .finally(() => setOpeningContainer(false));
        },
      });
    }

    if (
      isHarthmereWorldObject &&
      !isHarthmereObjectContainer &&
      harthmereObjectActionable
    ) {
      objectActions.push({
        title: objectInteractionPending
          ? `${harthmereObjectInteraction?.title ?? "Inspect"}…`
          : harthmereObjectInteraction?.title ?? "Inspect",
        disabled: objectInteractionPending,
        onKeyDown: () => {
          setObjectInteractionError(undefined);
          setObjectInteractionPending(true);
          void performHarthmereObjectInteraction({
            entityId: harthmereObjectInteractionEntityId ?? INVALID_BIOMES_ID,
            objectId: harthmereObjectId,
            label: harthmereObjectLabel,
            interaction: harthmereObjectInteraction ?? {
              kind: "inspect",
              title: "Inspect",
              toastVerb: "Inspected",
            },
            resources,
            gardenHose,
          })
            .catch((error) =>
              setObjectInteractionError(
                harthmereWorldObjectInteractionErrorMessage(
                  error,
                  harthmereObjectLabel ?? "this object"
                )
              )
            )
            .finally(() => setObjectInteractionPending(false));
        },
      });
    }

    if (!isHarthmereWorldObject && itemBuyer && overlay?.entityId) {
      contextualActions.unshift({
        title: "Sell",
        onKeyDown: () => {
          reactResources.set("/game_modal", {
            kind: "generic_miniphone",
            rootPayload: {
              type: "item_buyer",
              entityId: overlay.entityId,
            },
          });
        },
      });
    }

    return mergeInspectShortcutLayers(
      typedActions,
      objectActions,
      contextualActions
    );
  }, [
    canTalk,
    harthmereObjectInteraction,
    harthmereObjectActionable,
    harthmereObjectInteractionEntityId,
    harthmereObjectId,
    harthmereObjectLabel,
    inspectText,
    isHarthmereObjectContainer,
    isHarthmereWorldObject,
    isNativeDialogueQuestObject,
    canUseObjectSemantics,
    openingContainer,
    objectInteractionPending,
    objectInteractionError,
    containerOpenError,
    label?.text,
    overlay?.entityId,
    itemBuyer,
    resources,
    gardenHose,
    shortcuts,
    suppressTalkShortcut,
    reactResources,
  ]);

  return (
    <div
      className={`inspect-overlay ${extraClassName} ${fade ? "fadeout" : ""}`}
    >
      {overlay && tweaks.showInspectedIds && (
        <span className="font-large">{overlay.entityId}</span>
      )}
      <div className="inspect">
        <>
          <MaybeError
            error={containerOpenError ?? objectInteractionError ?? error}
          />
          {customHeader}
          {(title || subtitle) && (
            <div className="title-subtitle">
              {title && <span>{title}&nbsp;</span>}
              {subtitle && <span className="subtitle">{subtitle}</span>}
            </div>
          )}
          {trueShortcuts.map((shortcut, i) => (
            <ShortcutText
              disabled={shortcut.disabled}
              shortcut={CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST[i].key}
              key={i}
              keyCode={
                CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST[i]
                  .keyCode as GlobalKeyCode
              }
              onKeyDown={shortcut.onKeyDown}
              worldInteractionCandidateId={
                i === 0 && overlay
                  ? `native:${overlay.kind}:${maybeEntityId}`
                  : undefined
              }
            >
              {shortcut.title}
            </ShortcutText>
          ))}
          {children}
        </>
      </div>
    </div>
  );
};
