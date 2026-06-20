import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
  normalizeHarthmereJobsBoardPoint,
  type HarthmereJobsBoardPoint,
  type HarthmereJobsBoardWorldContext,
} from "./jobsBoardLiveAdapter";
import { HarthmereJobsBoardLiveContainer } from "./HarthmereJobsBoardLiveContainer";
import { installHarthmereJobsBoardStyles } from "./HarthmereJobsBoardStyles";
import {
  closeHarthmereJobsBoardPointerLock,
  openHarthmereJobsBoardPointerLock,
} from "./jobsBoardPointerLock";

export const HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION =
  "harthmere-jobs-board-world-interaction" as const;

export const HARTHMERE_JOBS_BOARD_OPEN_EVENT =
  "biomes:harthmere-jobs-board-open" as const;

function pointFromMaybeMethod(value: unknown): HarthmereJobsBoardPoint | undefined {
  if (typeof value === "function") {
    try {
      return normalizeHarthmereJobsBoardPoint(value());
    } catch {
      return undefined;
    }
  }
  return normalizeHarthmereJobsBoardPoint(value);
}

export function harthmereJobsBoardPlayerPosition(
  localPlayer: unknown,
  camera: unknown
): HarthmereJobsBoardPoint | undefined {
  const player = localPlayer as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPoint(player?.position) ??
    normalizeHarthmereJobsBoardPoint(player?.player && (player.player as any).position) ??
    normalizeHarthmereJobsBoardPoint(player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.pos) ??
    harthmereJobsBoardCameraPosition(camera)
  );
}

export function harthmereJobsBoardCameraPosition(
  camera: unknown
): HarthmereJobsBoardPoint | undefined {
  const record = camera as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPoint(record?.pos) ??
    pointFromMaybeMethod((record as any)?.pos) ??
    normalizeHarthmereJobsBoardPoint(record?.position)
  );
}

function eventStartedInEditable(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable)
  );
}

function dispatchJobsBoardOpen(source: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_JOBS_BOARD_OPEN_EVENT, {
      detail: { source, version: HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION },
    })
  );
}

export function HarthmereJobsBoardWorldInteraction({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const pointerLockManager = usePointerLockManager();
  const anyUiOpen = usePointerLockUnlockWhileOpenActive();
  const { reactResources } = useClientContext();
  const shouldReturnPointerLock = React.useRef(false);
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const [openBoardId, setOpenBoardId] = React.useState<string | undefined>();
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const cameraPosition = harthmereJobsBoardCameraPosition(camera);
  const prompt = nearestHarthmereJobsBoardPhysicalPrompt(playerPosition);
  const activePrompt = prompt;
  const promptBlocked = suppressPrompt || (anyUiOpen && !openBoardId);

  const open = React.useCallback(
    (_source: string) => {
      if (!activePrompt) return;
      installHarthmereJobsBoardStyles();
      openHarthmereJobsBoardPointerLock(
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
      closeHarthmereJobsBoardPointerLock(
        pointerLockManager,
        shouldReturnPointerLock
      );
    },
    [pointerLockManager]
  );

  React.useEffect(() => {
    installHarthmereJobsBoardStyles();
  }, []);

  React.useEffect(() => {
    if (!activePrompt || promptBlocked || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        eventStartedInEditable(event)
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
        eventStartedInEditable(event)
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
      closeHarthmereJobsBoardPointerLock(
        pointerLockManager,
        shouldReturnPointerLock
      );
    };
  }, [pointerLockManager]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION,
      playerPosition,
      cameraPosition,
      prompt,
      activePrompt,
      boards: HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
      open: () => open("debug_open"),
      close,
      dispatchOpen: () => dispatchJobsBoardOpen("debug_dispatch"),
    };
    (window as any).__harthmereJobsBoardDebug = debug;
    return () => {
      if ((window as any).__harthmereJobsBoardDebug === debug) {
        delete (window as any).__harthmereJobsBoardDebug;
      }
    };
  }, [activePrompt, cameraPosition, close, open, playerPosition, prompt]);

  const worldContext: HarthmereJobsBoardWorldContext | undefined = React.useMemo(() => {
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
          data-testid="harthmere-jobs-board-world-prompt"
        >
          <span className="harthmere-jobs-prompt__key">F</span>
          <span>
            <strong>{activePrompt.displayName}</strong>
            <small>Click or press F to read jobs posted here.</small>
          </span>
        </button>
      )}
      {openBoardId && worldContext && (
        <HarthmereJobsBoardLiveContainer
          boardId={openBoardId}
          worldContext={worldContext}
          onClose={close}
        />
      )}
    </>
  );
}
