import * as React from "react";
import { HarthmereBusinessInterfacePanel } from "./HarthmereBusinessInterfacePanel";
import { HarthmereBusinessInteractionPrompt } from "./HarthmereBusinessInteractionPrompt";
import {
  createHarthmereBusinessInterfaceAdapterV1,
  fetchHarthmereBusinessEconomyStateV1,
  nearestHarthmereBusinessDashboardWorldContextV1,
  submitHarthmereBusinessEconomyMutationV1,
  type HarthmereBusinessEconomySnapshotV1,
  type HarthmereBusinessWorldContextV1,
  type HarthmereBusinessWorldPointV1,
} from "./businessInterfaceLiveAdapter";

export interface HarthmereBusinessLiveContainerProps {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  playerPosition?: HarthmereBusinessWorldPointV1;
  worldContext?: HarthmereBusinessWorldContextV1;
  initialState?: HarthmereBusinessEconomySnapshotV1;
}

function isTypingInBusinessInputV1(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  const tagName = element?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element?.isContentEditable === true
  );
}

export function HarthmereBusinessLiveContainer({
  open = false,
  onOpen,
  onClose,
  playerPosition,
  worldContext,
  initialState,
}: HarthmereBusinessLiveContainerProps) {
  const [state, setState] = React.useState<
    HarthmereBusinessEconomySnapshotV1 | undefined
  >(initialState);
  const [loading, setLoading] = React.useState(!initialState);
  const [error, setError] = React.useState<string | undefined>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await fetchHarthmereBusinessEconomyStateV1();
      setState(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialState) void refresh();
  }, [initialState, refresh]);

  const context = React.useMemo(
    () =>
      worldContext ??
      nearestHarthmereBusinessDashboardWorldContextV1(state, playerPosition, 6),
    [playerPosition, state, worldContext]
  );

  const adapter = React.useMemo(
    () =>
      createHarthmereBusinessInterfaceAdapterV1({
        state,
        hydrated: !loading,
        setState,
        refresh,
        submit: (operation, payload) =>
          submitHarthmereBusinessEconomyMutationV1(operation, payload),
      }),
    [loading, refresh, state]
  );

  const prompt = React.useMemo(
    () =>
      state
        ? adapter.getInteractionPrompt(context)
        : { visible: false, label: "", helper: "", keyLabel: "E" },
    [adapter, context, state]
  );

  React.useEffect(() => {
    if (!open || prompt.visible || !state) return;
    onClose?.();
  }, [onClose, open, prompt.visible, state]);

  React.useEffect(() => {
    if (!prompt.visible || open || !onOpen || typeof window === "undefined") {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInBusinessInputV1(event.target)
      ) {
        return;
      }
      if (event.code === "KeyE" || event.code === "KeyF") {
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
      <HarthmereBusinessInteractionPrompt
        adapter={adapter}
        context={context}
        onInteract={() => onOpen?.()}
      />
      {open ? (
        <HarthmereBusinessInterfacePanel
          adapter={adapter}
          nearbyBusinessId={context.nearbyBusinessId}
          context={context}
          initialTab="customers"
          onClose={onClose}
        />
      ) : null}
    </>
  );
}
