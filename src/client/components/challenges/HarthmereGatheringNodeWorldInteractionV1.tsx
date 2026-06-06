// HARTHMERE_GATHERING_NODE_WORLD_INTERACTION_V1: walk up to a gathering node
// (rendered by harthmere_gathering_node_markers_v1) and press F to harvest it.
// Before this, harvesting only existed in a HUD menu, so a quest marker pointed
// the player at empty ground. This closes the loop: real node body + real
// in-world harvest at the marked position. Mirrors the jobs-board / business /
// property-for-sale world-interaction prompts.
import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { harthmereJobsBoardPlayerPositionV146 } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import { installHarthmereJobsBoardStylesV141 } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardStylesV141";
import {
  nearestHarthmereGatheringNodePromptV1,
  performHarthmereGather,
  type HarthmereGatheringNodePromptV1,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";

export const HARTHMERE_GATHERING_NODE_WORLD_INTERACTION_VERSION_V1 =
  "harthmere-gathering-node-world-interaction-v1" as const;

const GATHER_FEEDBACK_VISIBLE_MS_V1 = 4500;

function eventStartedInEditableV1(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable)
  );
}

function requirementLabelV1(prompt: HarthmereGatheringNodePromptV1): string {
  const tool = prompt.requiredTool
    ? prompt.requiredTool.replaceAll("_", " ")
    : "no tool";
  const profession = prompt.profession.replaceAll("_", " ");
  return `Needs ${tool} · ${profession} ${prompt.requiredSkill}`;
}

export function HarthmereGatheringNodeWorldInteractionV1({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const [feedback, setFeedback] = React.useState<
    { message: string; ok: boolean } | undefined
  >();
  const feedbackTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const playerPosition = harthmereJobsBoardPlayerPositionV146(
    localPlayer,
    camera
  );
  const prompt = nearestHarthmereGatheringNodePromptV1(playerPosition);
  const promptBlocked = suppressPrompt;

  React.useEffect(() => {
    installHarthmereJobsBoardStylesV141();
  }, []);

  const showFeedback = React.useCallback((message: string, ok: boolean) => {
    setFeedback({ message, ok });
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(
      () => setFeedback(undefined),
      GATHER_FEEDBACK_VISIBLE_MS_V1
    );
  }, []);

  const harvest = React.useCallback(() => {
    if (!prompt) return;
    const result = performHarthmereGather(prompt.id);
    showFeedback(
      result.message ??
        (result.ok ? `Harvested ${prompt.name}.` : "Cannot harvest here."),
      result.ok
    );
  }, [prompt, showFeedback]);

  React.useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!prompt || promptBlocked || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        eventStartedInEditableV1(event)
      ) {
        return;
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        harvest();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [prompt, harvest, promptBlocked]);

  if (!prompt || promptBlocked) {
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
      className="harthmere-jobs-prompt harthmere-gathering-node-prompt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        harvest();
      }}
      aria-label={`Harvest ${prompt.name}`}
      data-testid="harthmere-gathering-node-world-prompt-v1"
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
        <span className="harthmere-gathering-node-prompt__verb">Harvest</span>
        <strong>{prompt.name}</strong>
        <small
          className={`harthmere-gathering-node-prompt__detail harthmere-gathering-node-prompt__detail--${detailState}`}
          data-state={detailState}
        >
          {feedback ? feedback.message : requirementLabelV1(prompt)}
        </small>
      </span>
    </button>
  );
}
