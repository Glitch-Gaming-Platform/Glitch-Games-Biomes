import * as React from "react";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { HarthmereHomeConsolePanel } from "./HarthmereHomeConsolePanel";
import { HarthmereHomeConsolePrompt } from "./HarthmereHomeConsolePrompt";
import {
  createHarthmereHomeConsoleAdapter,
  fetchHarthmereHomeConsoleBuildingState,
  nearestHarthmereHomeConsoleWorldContext,
  submitHarthmereHomeDecorationMutation,
  type HarthmereHomeConsoleClientSnapshot,
  type HarthmereHomeConsoleSubmitPayload,
  type HarthmereHomeConsoleWorldContext,
  type HarthmereHomeConsoleWorldPoint,
} from "./homeConsoleLiveAdapter";
import { harthmereWorldTargetIsFaced } from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";

export interface HarthmereHomeConsoleLiveContainerProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  playerPosition?: HarthmereHomeConsoleWorldPoint;
  worldContext?: HarthmereHomeConsoleWorldContext;
  camera?: unknown;
  initialState?: Partial<HarthmereHomeConsoleClientSnapshot>;
}

export function HarthmereHomeConsoleLiveContainer({
  open = false,
  onOpen,
  onClose,
  playerPosition,
  worldContext,
  camera,
  initialState,
}: HarthmereHomeConsoleLiveContainerProps) {
  const [state, setState] = React.useState<
    HarthmereHomeConsoleClientSnapshot | undefined
  >(() =>
    initialState
      ? createHarthmereHomeConsoleAdapter({ state: initialState }).getSnapshot()
      : undefined
  );
  const [loading, setLoading] = React.useState(!initialState);
  const [error, setError] = React.useState<string | undefined>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await fetchHarthmereHomeConsoleBuildingState();
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialState) void refresh();
  }, [initialState, refresh]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = () => void refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const context = React.useMemo(
    () =>
      worldContext ??
      nearestHarthmereHomeConsoleWorldContext(state, playerPosition, 5),
    [playerPosition, state, worldContext]
  );

  const submit = React.useCallback(
    async (payload: HarthmereHomeConsoleSubmitPayload) => {
      const result = await submitHarthmereHomeDecorationMutation(payload);
      if (result.buildingState) {
        setState(
          createHarthmereHomeConsoleAdapter({
            state: result.buildingState,
          }).getSnapshot()
        );
      }
      return result;
    },
    []
  );

  const adapter = React.useMemo(
    () =>
      createHarthmereHomeConsoleAdapter({
        state,
        context,
        hydrated: !loading,
        setState,
        submit,
      }),
    [context, loading, state, submit]
  );
  const promptContext = React.useMemo(
    () => ({ ...context, interactionKeyLabel: "F" }),
    [context]
  );
  const prompt = React.useMemo(
    () => adapter.getInteractionPrompt(promptContext),
    [adapter, promptContext]
  );
  const targetFaced = context.interactionPosition
    ? harthmereWorldTargetIsFaced(camera, context.interactionPosition)
    : true;

  React.useEffect(() => {
    if (!open || !state || adapter.isAvailable(context)) return;
    onClose?.();
  }, [adapter, context, onClose, open, state]);

  const worldCandidate = React.useMemo(
    () =>
      prompt.visible && targetFaced && !open && onOpen
        ? {
            id: `harthmere:home:${context.nearbyPropertyId ?? "nearby"}`,
            priority: WORLD_INTERACTION_PRIORITY.authoredStation,
            keyCodes: ["KeyF", "KeyE"],
            onInteract: onOpen,
          }
        : undefined,
    [context.nearbyPropertyId, onOpen, open, prompt.visible, targetFaced]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

  if (!state && (loading || !error)) return null;

  return (
    <>
      {ownsInteraction ? (
        <HarthmereHomeConsolePrompt
          adapter={adapter}
          context={promptContext}
          onInteract={() => onOpen?.()}
        />
      ) : null}
      {open ? (
        <HarthmereHomeConsolePanel
          adapter={adapter}
          context={context}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}
