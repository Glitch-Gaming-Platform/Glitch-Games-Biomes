import * as React from "react";

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import {
  harthmereJobsBoardPlayerPosition,
  harthmereWorldTargetIsFaced,
} from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import { installHarthmereJobsBoardStyles } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardStyles";
import {
  WORLD_INTERACTION_PRIORITY,
  useWorldInteractionCandidate,
} from "@/client/components/challenges/worldInteractionDispatcher";
import {
  harthmereRequestBoardPhysicalPromptRecords,
  nearestHarthmereRequestBoardPhysicalPrompt,
} from "@/shared/harthmere/native_request_board_locations";
import type { HarthmereBoardCategory } from "@/shared/harthmere/native_request_boards";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_REQUEST_BOARD_WORLD_INTERACTION_VERSION =
  "harthmere-request-board-world-interaction-v1" as const;

function promptCopy(category: HarthmereBoardCategory) {
  switch (category) {
    case "fishing":
      return "Read fishing requests, accept a catch order, or turn fish in.";
    case "farming":
      return "Read crop and forage bounties or turn a completed order in.";
    case "industrial":
      return "Read material orders for stone, brick, ore, and metal.";
    case "research":
      return "Read Collective research requests and token rewards.";
  }
}

export function HarthmereRequestBoardWorldInteraction({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const { reactResources } = useClientContext();
  const anyUiOpen = usePointerLockUnlockWhileOpenActive();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const prompt = React.useMemo(
    () => nearestHarthmereRequestBoardPhysicalPrompt(playerPosition),
    [playerPosition?.x, playerPosition?.y, playerPosition?.z]
  );
  const targetFaced = harthmereWorldTargetIsFaced(camera, prompt?.position);
  const promptBlocked = suppressPrompt || anyUiOpen;

  const open = React.useCallback(
    (source: string) => {
      if (!prompt) return;
      const boardEntityId = prompt.boardEntityId as BiomesId;
      reactResources.update("/scene/local_player", (player) => {
        player.talkingToNpc = boardEntityId;
        // Request boards keep their native quest-giver identity, but their
        // legacy ECS body is suppressed by the dedicated board renderer. The
        // quay board is synthetic and has no subscribed NPC body at all. Set
        // this before opening the modal so the camera cannot race React and
        // try to track a missing entity on the next frame.
        player.talkingToNpcCameraDisabled = true;
      });
      reactResources.set("/game_modal", {
        kind: "talk_to_npc",
        talkingToNPCId: boardEntityId,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("biomes:harthmere-request-board-opened", {
            detail: {
              source,
              version: HARTHMERE_REQUEST_BOARD_WORLD_INTERACTION_VERSION,
              boardId: prompt.boardId,
              boardEntityId,
              category: prompt.category,
            },
          })
        );
      }
    },
    [prompt, reactResources]
  );

  React.useEffect(() => {
    installHarthmereJobsBoardStyles();
  }, []);

  const candidate = React.useMemo(
    () =>
      prompt && targetFaced && !promptBlocked
        ? {
            id: `harthmere:request-board:${prompt.boardId}`,
            // Request boards are authored stations. They must beat a native
            // NPC or bot standing beside them (the production Fishing Board
            // failure showed Pondy Bot's Feed action stealing F).
            priority: WORLD_INTERACTION_PRIORITY.jobsBoard - prompt.distance,
            keyCodes: ["KeyF", "KeyE"],
            onInteract: (event: KeyboardEvent) =>
              open(event.code === "KeyF" ? "keyboard_f" : "keyboard_e"),
          }
        : undefined,
    [open, prompt, promptBlocked, targetFaced]
  );
  const ownsInteraction = useWorldInteractionCandidate(candidate);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: HARTHMERE_REQUEST_BOARD_WORLD_INTERACTION_VERSION,
      playerPosition,
      prompt,
      targetFaced,
      boards: harthmereRequestBoardPhysicalPromptRecords(),
      open: () => open("debug_open"),
    };
    (window as any).__harthmereRequestBoardDebug = debug;
    return () => {
      if ((window as any).__harthmereRequestBoardDebug === debug) {
        delete (window as any).__harthmereRequestBoardDebug;
      }
    };
  }, [open, playerPosition, prompt, targetFaced]);

  if (!prompt || promptBlocked || !targetFaced || !ownsInteraction) {
    return null;
  }

  return (
    <button
      type="button"
      className="harthmere-jobs-prompt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        open("prompt_click");
      }}
      aria-label={`Open ${prompt.displayName}`}
      data-testid="harthmere-request-board-world-prompt"
      data-request-board-id={prompt.boardId}
      data-request-board-category={prompt.category}
    >
      <span className="harthmere-jobs-prompt__key">F</span>
      <span>
        <strong>{prompt.displayName}</strong>
        <small>{promptCopy(prompt.category)}</small>
      </span>
    </button>
  );
}
