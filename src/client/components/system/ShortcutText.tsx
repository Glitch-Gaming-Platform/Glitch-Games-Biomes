import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  invokeSelectedWorldInteractionForKey,
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { containMobileControlEvent } from "@/client/components/mobileControlEvents";
import type { KeyCode } from "@/client/game/util/keyboard";
import { cleanListener } from "@/client/util/helpers";
import { getTypedStorageItem } from "@/client/util/typed_local_storage";
import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import leftClickIcon from "/public/hud/icon-16-left-mouse.png";
import rightClickIcon from "/public/hud/icon-16-right-mouse.png";

export function getClickIcon(type: "primary" | "secondary") {
  const togglePrimaryClick = getTypedStorageItem(
    "settings.mouse.togglePrimaryClick"
  );
  let icon = "";
  switch (type) {
    case "primary":
      icon = togglePrimaryClick ? "right" : "left";
      break;
    case "secondary":
      icon = togglePrimaryClick ? "left" : "right";
      break;
  }
  return icon == "left" ? leftClickIcon.src : rightClickIcon.src;
}

export const ClickIcon: React.FunctionComponent<{
  type: "primary" | "secondary";
}> = ({ type }) => {
  const togglePrimaryClick = getTypedStorageItem(
    "settings.mouse.togglePrimaryClick"
  );
  let buttonSide = "";
  switch (type) {
    case "primary":
      buttonSide = togglePrimaryClick ? "Right" : "Left";
      break;
    case "secondary":
      buttonSide = togglePrimaryClick ? "Left" : "Right";
      break;
  }
  return <span className="yellow">{buttonSide} Click</span>;
};

export const ShortcutText: React.FunctionComponent<
  PropsWithChildren<{
    shortcut: string | JSX.Element;
    keyCode?: KeyCode;
    onKeyDown?: () => unknown;
    onShiftedKeyDown?: () => unknown;
    extraClassName?: string;
    progressPercent?: number;
    disabled?: boolean;
    worldInteractionCandidateId?: string;
    worldInteractionPriority?: number;
  }>
> = ({ ...props }) => {
  const [keydown, setKeydown] = useState(false);
  const { audioManager, clientConfig } = useClientContext();
  const pointerLockManager = usePointerLockManager();

  const runShortcut = useCallback(
    (event?: KeyboardEvent) => {
      if (props.disabled || !pointerLockManager.allowHUDInput()) return;
      if (props.onShiftedKeyDown && event?.shiftKey) {
        props.onShiftedKeyDown();
      } else {
        props.onKeyDown?.();
      }
      audioManager.playSound("button_click");
      setKeydown(true);
    },
    [
      audioManager,
      pointerLockManager,
      props.disabled,
      props.onKeyDown,
      props.onShiftedKeyDown,
    ]
  );
  const centralizedWorldCandidate = useMemo(
    () =>
      props.worldInteractionCandidateId && props.keyCode
        ? {
            id: props.worldInteractionCandidateId,
            priority:
              props.worldInteractionPriority ??
              WORLD_INTERACTION_PRIORITY.nativeEcs,
            keyCodes: [props.keyCode],
            disabled: props.disabled,
            canHandle: () => pointerLockManager.allowHUDInput(),
            onInteract: runShortcut,
          }
        : undefined,
    [
      pointerLockManager,
      props.disabled,
      props.keyCode,
      props.worldInteractionCandidateId,
      props.worldInteractionPriority,
      runShortcut,
    ]
  );
  useWorldInteractionCandidate(
    centralizedWorldCandidate,
    props.keyCode ?? "KeyF"
  );

  useEffect(() => {
    if (props.keyCode && !centralizedWorldCandidate) {
      return cleanListener(document, {
        keydown: (e: KeyboardEvent) => {
          if (
            !pointerLockManager.allowHUDInput() ||
            e.code !== props.keyCode ||
            e.repeat ||
            props.disabled
          ) {
            return;
          }

          runShortcut(e);
        },
        keyup: () => {
          setKeydown(false);
        },
      });
    }
  }, [centralizedWorldCandidate, props.disabled, props.keyCode, runShortcut]);

  const isMobileActionButton = Boolean(
    clientConfig.showVirtualJoystick && props.keyCode && props.onKeyDown
  );
  const mobileActionLabel = props.keyCode?.replace(/^Key/, "") ?? "Action";
  const activateMobileAction = useCallback(() => {
    if (centralizedWorldCandidate && props.keyCode) {
      invokeSelectedWorldInteractionForKey(props.keyCode);
    } else {
      runShortcut();
    }
    window.setTimeout(() => setKeydown(false), 120);
  }, [centralizedWorldCandidate, props.keyCode, runShortcut]);
  const keyContents = (
    <>
      {props.shortcut}
      {!!props.progressPercent && (
        <div
          className={`progress ${
            props.progressPercent >= 100 ? "complete" : ""
          }`}
          style={{ width: `${props.progressPercent}%` }}
        ></div>
      )}
    </>
  );

  return (
    <span
      className={`key-hint ${props.disabled ? "disabled" : ""} ${
        isMobileActionButton ? "key-hint-mobile-action" : ""
      }`.trim()}
    >
      {isMobileActionButton ? (
        <motion.button
          type="button"
          tabIndex={-1}
          disabled={props.disabled}
          aria-label={`Activate ${mobileActionLabel} action`}
          className={`key key-mobile-action ${props.extraClassName ?? ""}`}
          animate={{ scale: keydown ? 0.9 : 1 }}
          onPointerDown={(event) => {
            containMobileControlEvent(event);
            activateMobileAction();
          }}
          onClick={(event) => {
            containMobileControlEvent(event);
            if (event.detail === 0) activateMobileAction();
          }}
        >
          {keyContents}
        </motion.button>
      ) : (
        <motion.span
          className={`key ${props.extraClassName ?? ""}`}
          animate={{ scale: keydown ? 0.9 : 1 }}
        >
          {keyContents}
        </motion.span>
      )}{" "}
      {props.children}
    </span>
  );
};
