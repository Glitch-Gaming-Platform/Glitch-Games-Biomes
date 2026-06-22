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

export const SimpleRaceStartOverlayComponent: React.FunctionComponent<{
  bundle: MinigamePlaceableBundle;
}> = ({ bundle }) => {
  const [error, setError] = useError();
  const clientContext = useClientContext();

  const title = bundle.userIsPlayingGame ? undefined : bundle.minigameName;
  const subtitle = bundle.userIsPlayingGame
    ? undefined
    : bundle.minigameCreator?.user.username;

  const joinShortcut = useJoinShortcut(
    bundle.minigameId,
    "Play",
    setError,
    bundle.minigameComponent.metadata.kind
  );

  const notReadyReason =
    !bundle.minigameComponent.ready &&
    simpleRaceNotReadyReason(bundle.minigameComponent);

  const shortcuts: InspectShortcuts = [];
  if (!bundle.userCurrentMinigame && !bundle.userIsPlayingGame) {
    shortcuts.push(joinShortcut);
  }

  shortcuts.push(...defaultMinigameInspectShortcuts(clientContext, bundle));

  return (
    <CursorInspectionComponent
      title={title}
      error={error ?? notReadyReason}
      subtitle={subtitle}
      overlay={bundle.overlay}
      shortcuts={shortcuts}
    />
  );
};
