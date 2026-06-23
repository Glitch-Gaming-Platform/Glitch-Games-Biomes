import { useCanTalkToNpc } from "@/client/components/challenges/TalkToNPCDefaultDialog";
import { openHarthmereObjectContainer } from "@/client/components/challenges/harthmereObjectContainers";
import {
  completeHarthmereJobsBoardFieldObjectiveForObjectSoon,
  performHarthmereObjectInteraction,
} from "@/client/components/challenges/harthmereObjectInteractions";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { MaybeError } from "@/client/components/system/MaybeError";
import { ShortcutText } from "@/client/components/system/ShortcutText";
import type { InspectableOverlay } from "@/client/game/resources/overlays";
import type { GlobalKeyCode } from "@/client/game/util/keyboard";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import {
  harthmereObjectInteractionForLabel,
  isHarthmereContainerObjectLabel,
  isHarthmereNonLivingObjectLabel,
} from "@/shared/harthmere/object_interaction_semantics";
import { relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";

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
  fade,
  children,
}) => {
  const context = useClientContext();
  const { reactResources, resources, gardenHose } = context;
  const maybeEntityId = overlay?.entityId ?? INVALID_BIOMES_ID;
  const [tweaks, itemBuyer, label, entityDescription] = reactResources.useAll(
    ["/tweaks"],
    ["/ecs/c/item_buyer", maybeEntityId],
    ["/ecs/c/label", maybeEntityId],
    ["/ecs/c/entity_description", maybeEntityId]
  );

  const canTalk = useCanTalkToNpc(
    context,
    overlay?.entityId ?? INVALID_BIOMES_ID
  );

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
  const isHarthmereObjectContainer =
    overlay?.kind !== "placeable" &&
    isHarthmereContainerObjectLabel({
      label: harthmereObjectLabel,
      entityDescription: harthmereObjectDescription,
    });
  const isHarthmereWorldObject =
    overlay?.kind !== "placeable" &&
    isHarthmereNonLivingObjectLabel({
      label: harthmereObjectLabel,
      entityDescription: harthmereObjectDescription,
    });
  const harthmereObjectInteraction =
    overlay?.kind !== "placeable"
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
    const ret = [...(shortcuts ?? [])];
    if (
      !isHarthmereWorldObject &&
      !suppressTalkShortcut &&
      canTalk &&
      overlay?.entityId
    ) {
      ret.unshift({
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
      ret.unshift({
        title: harthmereObjectInteraction?.title ?? "Open Container",
        onKeyDown: () => {
          completeHarthmereJobsBoardFieldObjectiveForObjectSoon({
            objectId: harthmereObjectId,
            label: harthmereObjectLabel,
            interactionKind: "open_container",
            resources,
          });
          openHarthmereObjectContainer({
            entityId: harthmereObjectInteractionEntityId ?? INVALID_BIOMES_ID,
            label: harthmereObjectLabel,
            resources,
          });
        },
      });
    }

    if (
      isHarthmereWorldObject &&
      !isHarthmereObjectContainer &&
      harthmereObjectActionable
    ) {
      ret.unshift({
        title: harthmereObjectInteraction?.title ?? "Inspect",
        onKeyDown: () => {
          performHarthmereObjectInteraction({
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
          });
        },
      });
    }

    if (!isHarthmereWorldObject && itemBuyer && overlay?.entityId) {
      ret.unshift({
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

    return ret;
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
          <MaybeError error={error} />
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
