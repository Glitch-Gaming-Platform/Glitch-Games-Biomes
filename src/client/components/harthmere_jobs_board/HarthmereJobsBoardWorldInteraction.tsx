import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
  type HarthmereJobsBoardWorldContext,
} from "./jobsBoardLiveAdapter";
import {
  harthmereJobsBoardCameraPosition,
  harthmereJobsBoardPlayerPosition,
} from "./harthmereJobsBoardPosition";
import { HARTHMERE_JOBS_BOARD_OPEN_EVENT } from "@/client/components/challenges/harthmereEvents";
import { HarthmereJobsBoardLiveContainer } from "./HarthmereJobsBoardLiveContainer";
import { installHarthmereJobsBoardStyles } from "./HarthmereJobsBoardStyles";
import {
  closeHarthmereJobsBoardPointerLock,
  openHarthmereJobsBoardPointerLock,
} from "./jobsBoardPointerLock";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";

export const HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION =
  "harthmere-jobs-board-world-interaction" as const;

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
      detail: {
        source,
        version: HARTHMERE_JOBS_BOARD_WORLD_INTERACTION_VERSION,
      },
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
  const prompt = React.useMemo(
    () => nearestHarthmereJobsBoardPhysicalPrompt(playerPosition),
    [playerPosition?.x, playerPosition?.y, playerPosition?.z]
  );
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

  const close = React.useCallback(() => {
    setOpenBoardId(undefined);
    closeHarthmereJobsBoardPointerLock(
      pointerLockManager,
      shouldReturnPointerLock
    );
  }, [pointerLockManager]);

  React.useEffect(() => {
    installHarthmereJobsBoardStyles();
  }, []);

  const worldCandidate = React.useMemo(
    () =>
      activePrompt && !promptBlocked
        ? {
            id: `harthmere:jobs-board:${activePrompt.boardId}`,
            priority:
              WORLD_INTERACTION_PRIORITY.authoredStation -
              activePrompt.distance,
            keyCodes: ["KeyF", "KeyE"],
            onInteract: (event: KeyboardEvent) =>
              open(event.code === "KeyF" ? "keyboard_f" : "keyboard_e"),
          }
        : undefined,
    [activePrompt, open, promptBlocked]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

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

  const worldContext: HarthmereJobsBoardWorldContext | undefined =
    React.useMemo(() => {
      if (!openBoardId && !playerPosition) return undefined;
      return {
        nearbyBoardId: openBoardId,
        interactionTargetId: openBoardId,
        playerPosition: playerPosition
          ? {
              x: playerPosition.x,
              y: playerPosition.y ?? 0,
              z: playerPosition.z,
            }
          : undefined,
      };
    }, [openBoardId, playerPosition]);

  return (
    <>
      {activePrompt && !openBoardId && !promptBlocked && ownsInteraction && (
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
