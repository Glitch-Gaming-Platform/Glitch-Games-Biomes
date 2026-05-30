import * as React from "react";
import { HarthmereHomeConsolePanel } from "./HarthmereHomeConsolePanel";
import { HarthmereHomeConsolePrompt } from "./HarthmereHomeConsolePrompt";
import {
  createHarthmereHomeConsoleAdapterV1,
  fetchHarthmereHomeConsoleBuildingStateV1,
  nearestHarthmereHomeConsoleWorldContextV1,
  submitHarthmereHomeDecorationMutationV1,
  type HarthmereHomeConsoleClientSnapshotV1,
  type HarthmereHomeConsoleSubmitPayloadV1,
  type HarthmereHomeConsoleWorldContextV1,
  type HarthmereHomeConsoleWorldPointV1,
} from "./homeConsoleLiveAdapter";

export interface HarthmereHomeConsoleLiveContainerProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  playerPosition?: HarthmereHomeConsoleWorldPointV1;
  worldContext?: HarthmereHomeConsoleWorldContextV1;
  initialState?: Partial<HarthmereHomeConsoleClientSnapshotV1>;
}

export function HarthmereHomeConsoleLiveContainer({
  open = false,
  onOpen,
  onClose,
  playerPosition,
  worldContext,
  initialState,
}: HarthmereHomeConsoleLiveContainerProps) {
  const [state, setState] = React.useState<
    HarthmereHomeConsoleClientSnapshotV1 | undefined
  >(() =>
    initialState
      ? createHarthmereHomeConsoleAdapterV1({ state: initialState }).getSnapshot()
      : undefined
  );
  const [loading, setLoading] = React.useState(!initialState);
  const [error, setError] = React.useState<string | undefined>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await fetchHarthmereHomeConsoleBuildingStateV1();
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
      nearestHarthmereHomeConsoleWorldContextV1(state, playerPosition, 5),
    [playerPosition, state, worldContext]
  );

  const submit = React.useCallback(
    async (payload: HarthmereHomeConsoleSubmitPayloadV1) => {
      const result = await submitHarthmereHomeDecorationMutationV1(payload);
      if (result.buildingState) {
        setState(
          createHarthmereHomeConsoleAdapterV1({
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
      createHarthmereHomeConsoleAdapterV1({
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

  React.useEffect(() => {
    if (!open || !state || adapter.isAvailable(context)) return;
    onClose?.();
  }, [adapter, context, onClose, open, state]);

  React.useEffect(() => {
    if (!prompt.visible || open || !onOpen || typeof window === "undefined") {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.code === "KeyF" || event.code === "KeyE") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onOpen, open, prompt.visible]);

  if (!state && (loading || !error)) return null;

  return (
    <>
      <HarthmereHomeConsolePrompt
        adapter={adapter}
        context={promptContext}
        onInteract={() => onOpen?.()}
      />
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
