import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { usePointerLockUnlockWhileOpenActiveV1 } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActiveV1";
import {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141,
  nearestHarthmereJobsBoardPhysicalPromptV141,
  normalizeHarthmereJobsBoardPointV146,
  type HarthmereJobsBoardPointV146,
  type HarthmereJobsBoardWorldContextV1,
} from "./jobsBoardLiveAdapter";
import { HarthmereJobsBoardLiveContainerV141 } from "./HarthmereJobsBoardLiveContainerV141";
import { installHarthmereJobsBoardStylesV141 } from "./HarthmereJobsBoardStylesV141";
import {
  closeHarthmereJobsBoardPointerLockV145,
  openHarthmereJobsBoardPointerLockV145,
} from "./jobsBoardPointerLockV145";

export const HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION_V146 =
  "harthmere-jobs-board-world-interaction-v146" as const;

export const HARTHMERE_JOBS_BOARD_OPEN_EVENT_V141 =
  "biomes:harthmere-jobs-board-open-v141" as const;

function pointFromMaybeMethod(value: unknown): HarthmereJobsBoardPointV146 | undefined {
  if (typeof value === "function") {
    try {
      return normalizeHarthmereJobsBoardPointV146(value());
    } catch {
      return undefined;
    }
  }
  return normalizeHarthmereJobsBoardPointV146(value);
}

export function harthmereJobsBoardPlayerPositionV146(
  localPlayer: unknown,
  camera: unknown
): HarthmereJobsBoardPointV146 | undefined {
  const player = localPlayer as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPointV146(player?.position) ??
    normalizeHarthmereJobsBoardPointV146(player?.player && (player.player as any).position) ??
    normalizeHarthmereJobsBoardPointV146(player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.pos) ??
    harthmereJobsBoardCameraPositionV146(camera)
  );
}

export function harthmereJobsBoardCameraPositionV146(
  camera: unknown
): HarthmereJobsBoardPointV146 | undefined {
  const record = camera as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPointV146(record?.pos) ??
    pointFromMaybeMethod((record as any)?.pos) ??
    normalizeHarthmereJobsBoardPointV146(record?.position)
  );
}

function eventStartedInEditableV146(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable)
  );
}

function dispatchJobsBoardOpenV146(source: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_JOBS_BOARD_OPEN_EVENT_V141, {
      detail: { source, version: HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION_V146 },
    })
  );
}

export function HarthmereJobsBoardWorldInteractionV146({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const pointerLockManager = usePointerLockManager();
  const anyUiOpen = usePointerLockUnlockWhileOpenActiveV1();
  const { reactResources } = useClientContext();
  const shouldReturnPointerLock = React.useRef(false);
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const [openBoardId, setOpenBoardId] = React.useState<string | undefined>();
  const playerPosition = harthmereJobsBoardPlayerPositionV146(localPlayer, camera);
  const cameraPosition = harthmereJobsBoardCameraPositionV146(camera);
  const prompt = nearestHarthmereJobsBoardPhysicalPromptV141(playerPosition);
  const activePrompt = prompt;
  const promptBlocked = suppressPrompt || (anyUiOpen && !openBoardId);

  const open = React.useCallback(
    (_source: string) => {
      if (!activePrompt) return;
      installHarthmereJobsBoardStylesV141();
      openHarthmereJobsBoardPointerLockV145(
        pointerLockManager,
        shouldReturnPointerLock
      );
      try {
        if (reactResources.get("/game_modal")?.kind !== "empty") {
          reactResources.set("/game_modal", {
            kind: "empty",
            returnPointerLock: false,
          });
        }
      } catch {}
      setOpenBoardId(activePrompt.boardId);
    },
    [activePrompt, pointerLockManager, reactResources]
  );

  const close = React.useCallback(
    () => {
      setOpenBoardId(undefined);
      closeHarthmereJobsBoardPointerLockV145(
        pointerLockManager,
        shouldReturnPointerLock
      );
    },
    [pointerLockManager]
  );

  React.useEffect(() => {
    installHarthmereJobsBoardStylesV141();
  }, []);

  React.useEffect(() => {
    if (!activePrompt || promptBlocked || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        eventStartedInEditableV146(event)
      ) {
        return;
      }
      if (event.code === "KeyF" || event.code === "KeyE") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        open(event.code === "KeyF" ? "keyboard_f" : "keyboard_e");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [activePrompt, open, promptBlocked]);

  React.useEffect(() => {
    if (!activePrompt || promptBlocked || typeof window === "undefined") return;
    const handler = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        eventStartedInEditableV146(event)
      ) {
        return;
      }
      const target = event.target as Element | null;
      const isCanvas =
        target?.tagName?.toLowerCase() === "canvas" ||
        Boolean(target?.closest?.("canvas"));
      if (!isCanvas) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open("canvas_click");
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, [activePrompt, open, promptBlocked]);

  React.useEffect(() => {
    return () => {
      closeHarthmereJobsBoardPointerLockV145(
        pointerLockManager,
        shouldReturnPointerLock
      );
    };
  }, [pointerLockManager]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION_V146,
      playerPosition,
      cameraPosition,
      prompt,
      activePrompt,
      boards: HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141,
      open: () => open("debug_open"),
      close,
      dispatchOpen: () => dispatchJobsBoardOpenV146("debug_dispatch"),
    };
    (window as any).__harthmereJobsBoardDebugV146 = debug;
    return () => {
      if ((window as any).__harthmereJobsBoardDebugV146 === debug) {
        delete (window as any).__harthmereJobsBoardDebugV146;
      }
    };
  }, [activePrompt, cameraPosition, close, open, playerPosition, prompt]);

  const worldContext: HarthmereJobsBoardWorldContextV1 | undefined = React.useMemo(() => {
    if (!openBoardId && !playerPosition) return undefined;
    return {
      nearbyBoardId: openBoardId,
      interactionTargetId: openBoardId,
      playerPosition: playerPosition
        ? { x: playerPosition.x, y: playerPosition.y ?? 0, z: playerPosition.z }
        : undefined,
    };
  }, [openBoardId, playerPosition]);

  return (
    <>
      {activePrompt && !openBoardId && !promptBlocked && (
        <button
          type="button"
          className="harthmere-jobs-prompt"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation?.();
            open("prompt_click");
          }}
          aria-label={`Open ${activePrompt.displayName}`}
          data-testid="harthmere-jobs-board-world-prompt-v146"
        >
          <span className="harthmere-jobs-prompt__key">F</span>
          <span>
            <strong>{activePrompt.displayName}</strong>
            <small>Click or press F to read jobs posted here.</small>
          </span>
        </button>
      )}
      {openBoardId && worldContext && (
        <HarthmereJobsBoardLiveContainerV141
          boardId={openBoardId}
          worldContext={worldContext}
          onClose={close}
        />
      )}
    </>
  );
}
