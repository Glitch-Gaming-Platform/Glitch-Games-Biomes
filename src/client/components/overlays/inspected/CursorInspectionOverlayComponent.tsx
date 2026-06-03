import { useCanTalkToNpc } from "@/client/components/challenges/TalkToNPCDefaultDialog";
import { openHarthmereObjectContainerV1 } from "@/client/components/challenges/harthmereObjectContainers";
import { performHarthmereObjectInteractionV1 } from "@/client/components/challenges/harthmereObjectInteractions";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { MaybeError } from "@/client/components/system/MaybeError";
import { ShortcutText } from "@/client/components/system/ShortcutText";
import type { InspectableOverlay } from "@/client/game/resources/overlays";
import type { GlobalKeyCode } from "@/client/game/util/keyboard";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import {
  harthmereObjectInteractionForLabelV1,
  isHarthmereContainerObjectLabelV1,
  isHarthmereNonLivingObjectLabelV1,
} from "@/shared/harthmere/object_interaction_semantics_v1";
import { relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
const shortcutKeys = [
  { key: "F", keyCode: "KeyF" },
  { key: "G", keyCode: "KeyG" },
  { key: "H", keyCode: "KeyH" },
  { key: "J", keyCode: "KeyJ" },
  { key: "K", keyCode: "KeyK" },
];

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
  const isHarthmereObjectContainer =
    overlay?.kind !== "placeable" &&
    isHarthmereContainerObjectLabelV1({
      label: label?.text,
      entityDescription: entityDescription?.text,
    });
  const isHarthmereWorldObject =
    overlay?.kind !== "placeable" &&
    isHarthmereNonLivingObjectLabelV1({
      label: label?.text,
      entityDescription: entityDescription?.text,
    });
  const harthmereObjectInteraction =
    overlay?.kind !== "placeable"
      ? harthmereObjectInteractionForLabelV1({
          label: label?.text,
          entityDescription: entityDescription?.text,
        })
      : undefined;

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

    if (isHarthmereObjectContainer && overlay?.entityId) {
      ret.unshift({
        title: harthmereObjectInteraction?.title ?? "Open Container",
        onKeyDown: () => {
          openHarthmereObjectContainerV1({
            entityId: overlay.entityId,
            label: label?.text,
            resources,
          });
        },
      });
    }

    if (
      isHarthmereWorldObject &&
      !isHarthmereObjectContainer &&
      overlay?.entityId
    ) {
      ret.unshift({
        title: harthmereObjectInteraction?.title ?? "Inspect",
        onKeyDown: () => {
          performHarthmereObjectInteractionV1({
            entityId: overlay.entityId,
            label: label?.text,
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
              shortcut={shortcutKeys[i].key}
              key={i}
              keyCode={shortcutKeys[i].keyCode as GlobalKeyCode}
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
