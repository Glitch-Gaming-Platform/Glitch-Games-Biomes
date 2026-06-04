import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import type { PlaceableInspectOverlay } from "@/client/game/resources/overlays";

export const TextSignOverlayComponent: React.FunctionComponent<{
  overlay: PlaceableInspectOverlay;
}> = ({ overlay }) => {
  const { reactResources, authManager } = useClientContext();
  const creatorId = reactResources.use(
    "/ecs/c/created_by",
    overlay.entityId
  )?.id;
  const localPlayerId = reactResources.use("/scene/local_player")?.id;
  // Only the player who placed the sign (or an admin) may edit its text. Every
  // other player still gets the F prompt — pressing it shows the sign's text
  // clearly on screen (read-only) instead of opening the editor.
  const canChange =
    (creatorId !== undefined && creatorId === localPlayerId) ||
    authManager.currentUser.hasSpecialRole("admin");

  return (
    <CursorInspectionComponent
      overlay={overlay}
      shortcuts={[
        {
          title: canChange ? "Edit Text" : "Read Sign",
          onKeyDown: () => {
            reactResources.set("/game_modal", {
              kind: "text_sign_configure_modal",
              placeableId: overlay.entityId,
              readOnly: !canChange,
            });
          },
        },
      ]}
    />
  );
};
