import * as React from "react";
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

export interface HarthmereHomeConsoleLiveContainerProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  playerPosition?: HarthmereHomeConsoleWorldPoint;
  worldContext?: HarthmereHomeConsoleWorldContext;
  initialState?: Partial<HarthmereHomeConsoleClientSnapshot>;
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
        event.stopPropagation();
        event.stopImmediatePropagation();
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
