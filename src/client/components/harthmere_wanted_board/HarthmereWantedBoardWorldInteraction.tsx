import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
  type HarthmereJobsBoardWorldContext,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  harthmereJobsBoardPlayerPosition,
  harthmereJobsBoardCameraPosition,
} from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import {
  closeHarthmereJobsBoardPointerLock,
  openHarthmereJobsBoardPointerLock,
} from "@/client/components/harthmere_jobs_board/jobsBoardPointerLock";
import { HARTHMERE_WANTED_BOARD_OPEN_EVENT } from "@/client/components/challenges/harthmereEvents";
import { HarthmereWantedBoardLiveContainer } from "./HarthmereWantedBoardLiveContainer";
import { installHarthmereWantedBoardStyles } from "./HarthmereWantedBoardStyles";

export const HARTHMERE_WANTED_BOARD_WORLD_INTERACTION_VERSION =
  "harthmere-wanted-board-world-interaction" as const;

function wantedBoardIdFromLabel(
  label: string | undefined,
  fallbackBoardId: string | undefined
) {
  if (fallbackBoardId) return fallbackBoardId;
  const text = String(label ?? "")
    .trim()
    .toLowerCase();
  if (!text) return HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
  const match = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.find((board) => {
    const base = board.displayName
      .replace(/\bjobs?\s+boards?\b/i, "")
      .trim()
      .toLowerCase();
    return Boolean(base && text.includes(base));
  });
  return match?.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
}

export function HarthmereWantedBoardWorldInteraction({
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
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const cameraPosition = harthmereJobsBoardCameraPosition(camera);
  const activePrompt = nearestHarthmereJobsBoardPhysicalPrompt(playerPosition);
  const [openBoardId, setOpenBoardId] = React.useState<string | undefined>();

  const open = React.useCallback(
    (input: { source: string; label?: string; boardId?: string }) => {
      if (suppressPrompt && anyUiOpen && !openBoardId) return;
      installHarthmereWantedBoardStyles();
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
      setOpenBoardId(
        wantedBoardIdFromLabel(
          input.label,
          input.boardId ?? activePrompt?.boardId
        )
      );
    },
    [
      activePrompt?.boardId,
      anyUiOpen,
      openBoardId,
      pointerLockManager,
      reactResources,
      suppressPrompt,
    ]
  );

  const close = React.useCallback(() => {
    setOpenBoardId(undefined);
    closeHarthmereJobsBoardPointerLock(
      pointerLockManager,
      shouldReturnPointerLock
    );
  }, [pointerLockManager]);

  React.useEffect(() => {
    installHarthmereWantedBoardStyles();
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail ?? {};
      open({
        source: String(detail.source ?? "harthmere_wanted_board_event"),
        label:
          detail.label === undefined || detail.label === null
            ? undefined
            : String(detail.label),
        boardId:
          detail.boardId === undefined || detail.boardId === null
            ? undefined
            : String(detail.boardId),
      });
    };
    window.addEventListener(HARTHMERE_WANTED_BOARD_OPEN_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_WANTED_BOARD_OPEN_EVENT, handler);
  }, [open]);

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
      version: HARTHMERE_WANTED_BOARD_WORLD_INTERACTION_VERSION,
      playerPosition,
      cameraPosition,
      activePrompt,
      open: (label?: string) =>
        open({ source: "debug_open", label, boardId: activePrompt?.boardId }),
      close,
    };
    (window as any).__harthmereWantedBoardDebug = debug;
    return () => {
      if ((window as any).__harthmereWantedBoardDebug === debug) {
        delete (window as any).__harthmereWantedBoardDebug;
      }
    };
  }, [activePrompt, cameraPosition, close, open, playerPosition]);

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
      {openBoardId && (
        <HarthmereWantedBoardLiveContainer
          boardId={openBoardId}
          worldContext={worldContext}
          onClose={close}
        />
      )}
    </>
  );
}
