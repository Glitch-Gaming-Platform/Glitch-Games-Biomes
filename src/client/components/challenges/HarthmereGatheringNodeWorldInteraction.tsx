// HARTHMERE_GATHERING_NODE_WORLD_INTERACTION: walk up to a gathering node
// (rendered by harthmere_gathering_node_markers) and press F to harvest it.
// Before this, harvesting only existed in a HUD menu, so a quest marker pointed
// the player at empty ground. This closes the loop: real node body + real
// in-world harvest at the marked position. Mirrors the jobs-board / business /
// property-for-sale world-interaction prompts.
import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { harthmereJobsBoardPlayerPosition } from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import { installHarthmereJobsBoardStyles } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardStyles";
import {
  harthmereGatheringErrorMessage,
  submitHarthmereGatheringNode,
} from "@/client/components/challenges/harthmereGatheringLiveAuthority";
import {
  nearestHarthmereGatheringNodePrompt,
  type HarthmereGatheringNodePrompt,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { hasNativeInspectableWorldTarget } from "@/client/components/challenges/worldInteractionPriority";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";

export const HARTHMERE_GATHERING_NODE_WORLD_INTERACTION_VERSION =
  "harthmere-gathering-node-world-interaction" as const;

const GATHER_FEEDBACK_VISIBLE_MS = 4500;

function requirementLabel(prompt: HarthmereGatheringNodePrompt): string {
  if (prompt.profession === "fishing") {
    return `Equip any fishing rod · fishing ${prompt.requiredSkill}`;
  }
  const tool = prompt.requiredTool
    ? prompt.requiredTool.replaceAll("_", " ")
    : "no tool";
  const profession = prompt.profession.replaceAll("_", " ");
  return `Needs ${tool} · ${profession} ${prompt.requiredSkill}`;
}

export function HarthmereGatheringNodeWorldInteraction({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const overlays = reactResources.use("/overlays");
  const [feedback, setFeedback] = React.useState<
    { message: string; ok: boolean } | undefined
  >();
  const [pending, setPending] = React.useState(false);
  const feedbackTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const prompt = React.useMemo(
    () => nearestHarthmereGatheringNodePrompt(playerPosition),
    [playerPosition?.x, playerPosition?.y, playerPosition?.z]
  );
  const promptBlocked =
    suppressPrompt || hasNativeInspectableWorldTarget(overlays);

  React.useEffect(() => {
    installHarthmereJobsBoardStyles();
  }, []);

  const showFeedback = React.useCallback((message: string, ok: boolean) => {
    setFeedback({ message, ok });
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(
      () => setFeedback(undefined),
      GATHER_FEEDBACK_VISIBLE_MS
    );
  }, []);

  const harvest = React.useCallback(async () => {
    if (!prompt || pending) return;
    setPending(true);
    try {
      await submitHarthmereGatheringNode(prompt.id);
      showFeedback(`Harvested ${prompt.name}.`, true);
    } catch (error) {
      showFeedback(harthmereGatheringErrorMessage(error, prompt.name), false);
    } finally {
      setPending(false);
    }
  }, [pending, prompt, showFeedback]);

  React.useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const worldCandidate = React.useMemo(
    () =>
      prompt && !promptBlocked
        ? {
            id: `harthmere:gathering:${prompt.id}`,
            priority:
              WORLD_INTERACTION_PRIORITY.authoredGathering - prompt.distance,
            disabled: pending,
            onInteract: harvest,
          }
        : undefined,
    [harvest, pending, prompt, promptBlocked]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

  if (!prompt || promptBlocked || !ownsInteraction) {
    return null;
  }
  const detailState = feedback
    ? feedback.ok
      ? "success"
      : "error"
    : "requirement";

  return (
    <button
      type="button"
      disabled={pending}
      className="harthmere-jobs-prompt harthmere-gathering-node-prompt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        harvest();
      }}
      aria-label={`Harvest ${prompt.name}`}
      data-harthmere-gathering-node-world-prompt="active"
      data-testid="harthmere-gathering-node-world-prompt"
    >
      <span
        className="harthmere-gathering-node-prompt__key-group"
        aria-hidden="true"
      >
        <span className="harthmere-jobs-prompt__key">F</span>
        <span className="harthmere-gathering-node-prompt__key-hint">
          Action
        </span>
      </span>
      <span className="harthmere-gathering-node-prompt__body">
        <span className="harthmere-gathering-node-prompt__verb">
          {pending ? "Harvesting…" : "Harvest"}
        </span>
        <strong>{prompt.name}</strong>
        <small
          className={`harthmere-gathering-node-prompt__detail harthmere-gathering-node-prompt__detail--${detailState}`}
          data-state={detailState}
        >
          {feedback ? feedback.message : requirementLabel(prompt)}
        </small>
      </span>
    </button>
  );
}
