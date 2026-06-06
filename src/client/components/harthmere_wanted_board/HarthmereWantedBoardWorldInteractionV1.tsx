import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { usePointerLockUnlockWhileOpenActiveV1 } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActiveV1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141,
  nearestHarthmereJobsBoardPhysicalPromptV141,
  type HarthmereJobsBoardWorldContextV1,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  harthmereJobsBoardPlayerPositionV146,
  harthmereJobsBoardCameraPositionV146,
} from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import {
  closeHarthmereJobsBoardPointerLockV145,
  openHarthmereJobsBoardPointerLockV145,
} from "@/client/components/harthmere_jobs_board/jobsBoardPointerLockV145";
import { HARTHMERE_WANTED_BOARD_OPEN_EVENT_V1 } from "@/client/components/challenges/harthmereObjectInteractions";
import { HarthmereWantedBoardLiveContainerV1 } from "./HarthmereWantedBoardLiveContainerV1";
import { installHarthmereWantedBoardStylesV1 } from "./HarthmereWantedBoardStylesV1";

export const HARTHMERE_WANTED_BOARD_WORLD_INTERACTION_VERSION_V1 =
  "harthmere-wanted-board-world-interaction-v1" as const;

function wantedBoardIdFromLabelV1(
  label: string | undefined,
  fallbackBoardId: string | undefined
) {
  if (fallbackBoardId) return fallbackBoardId;
  const text = String(label ?? "").trim().toLowerCase();
  if (!text) return HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
  const match = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141.find((board) => {
    const base = board.displayName
      .replace(/\bjobs?\s+boards?\b/i, "")
      .trim()
      .toLowerCase();
    return Boolean(base && text.includes(base));
  });
  return match?.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
}

export function HarthmereWantedBoardWorldInteractionV1({
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
  const playerPosition = harthmereJobsBoardPlayerPositionV146(
    localPlayer,
    camera
  );
  const cameraPosition = harthmereJobsBoardCameraPositionV146(camera);
  const activePrompt = nearestHarthmereJobsBoardPhysicalPromptV141(playerPosition);
  const [openBoardId, setOpenBoardId] = React.useState<string | undefined>();

  const open = React.useCallback(
    (input: { source: string; label?: string; boardId?: string }) => {
      if (suppressPrompt && anyUiOpen && !openBoardId) return;
      installHarthmereWantedBoardStylesV1();
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
      setOpenBoardId(
        wantedBoardIdFromLabelV1(
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
    closeHarthmereJobsBoardPointerLockV145(
      pointerLockManager,
      shouldReturnPointerLock
    );
  }, [pointerLockManager]);

  React.useEffect(() => {
    installHarthmereWantedBoardStylesV1();
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
    window.addEventListener(HARTHMERE_WANTED_BOARD_OPEN_EVENT_V1, handler);
    return () =>
      window.removeEventListener(HARTHMERE_WANTED_BOARD_OPEN_EVENT_V1, handler);
  }, [open]);

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
      version: HARTHMERE_WANTED_BOARD_WORLD_INTERACTION_VERSION_V1,
      playerPosition,
      cameraPosition,
      activePrompt,
      open: (label?: string) =>
        open({ source: "debug_open", label, boardId: activePrompt?.boardId }),
      close,
    };
    (window as any).__harthmereWantedBoardDebugV1 = debug;
    return () => {
      if ((window as any).__harthmereWantedBoardDebugV1 === debug) {
        delete (window as any).__harthmereWantedBoardDebugV1;
      }
    };
  }, [activePrompt, cameraPosition, close, open, playerPosition]);

  const worldContext: HarthmereJobsBoardWorldContextV1 | undefined =
    React.useMemo(() => {
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
      {openBoardId && (
        <HarthmereWantedBoardLiveContainerV1
          boardId={openBoardId}
          worldContext={worldContext}
          onClose={close}
        />
      )}
    </>
  );
}

