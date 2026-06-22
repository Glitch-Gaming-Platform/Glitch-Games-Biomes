import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { MinigamePlaceableBundle } from "@/client/components/minigames/helpers";
import {
  defaultMinigameInspectShortcuts,
  useJoinShortcut,
} from "@/client/components/minigames/helpers";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { useError } from "@/client/components/system/MaybeError";
import { simpleRaceNotReadyReason } from "@/server/shared/minigames/simple_race/util";

export const SimpleRaceFinishOverlayComponent: React.FunctionComponent<{
  bundle: MinigamePlaceableBundle;
}> = ({ bundle }) => {
  const [error, setError] = useError();
  const clientContext = useClientContext();

  const notReadyReason =
    !bundle.minigameComponent.ready &&
    simpleRaceNotReadyReason(bundle.minigameComponent);

  const shortcuts: InspectShortcuts = [];

  const joinShortcut = useJoinShortcut(
    bundle.minigameId,
    "Go to Start",
    setError,
    bundle.minigameComponent.metadata.kind
  );

  if (
    bundle.userIsPlayingGame &&
    bundle.userCurrentInstance &&
    bundle.userCurrentMinigame
  ) {
    return <></>;
  }

  shortcuts.push(joinShortcut);
  shortcuts.push(...defaultMinigameInspectShortcuts(clientContext, bundle));

  const title = bundle.userIsPlayingGame
    ? undefined
    : `${bundle.minigameName} Finish Line`;

  return (
    <CursorInspectionComponent
      title={title}
      overlay={bundle.overlay}
      error={error ?? notReadyReason}
      shortcuts={shortcuts}
    />
  );
};
