import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { MinigamePlaceableOverlay } from "@/client/components/minigames/MinigamePlaceableOverlay";
import { isMinigamePlaceableItem } from "@/client/components/minigames/helpers";
import { BlueprintPlacementOverlayComponent } from "@/client/components/overlays/BlueprintPlacementOverlayComponent";
import { FishMeterOverlayComponent } from "@/client/components/overlays/FishMeterOverlayComponent";
import { FishingOverlayComponent } from "@/client/components/overlays/FishingOverlayComponent";
import { LootEventOverlayComponent } from "@/client/components/overlays/LootEventOverlayComponent";
import { BlueprintOverlayComponent } from "@/client/components/overlays/inspected/BlueprintOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { GroupInspectionOverlayComponent } from "@/client/components/overlays/inspected/GroupInspectionOverlayComponent";
import { GrabBagInspectionOverlayComponent } from "@/client/components/overlays/inspected/GrabBagInspectionOverlayComponent";
import { NpcOverlayComponent } from "@/client/components/overlays/inspected/NpcOverlayComponent";
import { PlantInspectionOverlayComponent } from "@/client/components/overlays/inspected/PlantInspectionOverlayComponent";
import { PlayerInspectionOverlayComponent } from "@/client/components/overlays/inspected/PlayerInspectionOverlayComponent";
import { RobotInspectionOverlayComponent } from "@/client/components/overlays/inspected/RobotInspectionOverlayComponent";
import { ContainerOverlayComponent } from "@/client/components/overlays/inspected/placeables/ContainerOverlayComponent";
import { CraftingStationOverlayComponent } from "@/client/components/overlays/inspected/placeables/CraftingStationOverlayComponent";
import { isHarthmerePlacedCookStationItem } from "@/client/components/overlays/inspected/placeables/craftingStationCookRouting";
import { DoorOverlayComponent } from "@/client/components/overlays/inspected/placeables/DoorOverlayComponent";
import { FramePlaceableOverlayComponent } from "@/client/components/overlays/inspected/placeables/FramePlaceableOverlayComponent";
import { MailboxOverlayComponent } from "@/client/components/overlays/inspected/placeables/MailboxOverlayComponent";
import { OutfitStandOverlayComponent } from "@/client/components/overlays/inspected/placeables/OutfitStandOverlayComponent";
import { ShopOverlayComponent } from "@/client/components/overlays/inspected/placeables/ShopOverlayComponent";
import { SignOverlayComponent } from "@/client/components/overlays/inspected/placeables/SignOverlayComponent";
import { TextSignOverlayComponent } from "@/client/components/overlays/inspected/placeables/TextSignOverlayComponent";
import { VideoOverlayComponent } from "@/client/components/overlays/inspected/placeables/VideoOverlayComponent";
import { resolveNativePlaceableInteractionRole } from "@/client/components/overlays/inspected/interactionRoleResolver";
import { MinigameElementOverlayComponent } from "@/client/components/overlays/projected/MinigameElementOverlayComponent";
import { NameOverlayComponent } from "@/client/components/overlays/projected/NameOverlayComponent";
import { NavigationAidOverlayComponent } from "@/client/components/overlays/projected/NavigationAidOverlayComponent";
import { RestoredOverlayComponent } from "@/client/components/overlays/projected/RestoredOverlayComponent";
import type { Overlay } from "@/client/game/resources/overlays";
import { anItem } from "@/shared/game/item";
import { mapMap } from "@/shared/util/collections";
import React from "react";

export const OverlayComponent: React.FunctionComponent<{
  overlay: Overlay;
}> = React.memo(({ overlay }) => {
  const { reactResources } = useClientContext();
  const tweaks = reactResources.use("/tweaks");
  switch (overlay.kind) {
    case "hidden":
      if (tweaks.showHiddenInspects) {
        return (
          <>
            <OverlayComponent overlay={overlay.overlay} />
            (Inspection hidden)
          </>
        );
      }
      return <></>;

    //True Overlays:
    case "name":
      return <NameOverlayComponent overlay={overlay} />;
    case "navigation_aid":
      return <NavigationAidOverlayComponent overlay={overlay} />;
    case "minigame_element":
      return <MinigameElementOverlayComponent overlay={overlay} />;
    case "restored_placeable":
      return <RestoredOverlayComponent overlay={overlay} />;

    //Cursor Inspects:
    case "group":
      return <GroupInspectionOverlayComponent overlay={overlay} />;

    case "blueprint":
      return <BlueprintOverlayComponent overlay={overlay} />;

    case "placeable":
      const item = anItem(overlay.itemId);
      // Resolve one native role before rendering a shortcut. This prevents the
      // render order (or quest_giver metadata read later by CursorInspection)
      // from silently changing the handler behind the visible F prompt.
      switch (
        resolveNativePlaceableInteractionRole({
          isMailbox: item.isMailbox,
          isShopContainer: item.isShopContainer,
          isContainer: item.isContainer,
          isCraftingStation: item.isCraftingStation,
          isCookStation: isHarthmerePlacedCookStationItem(item),
          isDoor: item.isDoor,
          isReadable: Boolean(item.readable),
          isCustomizableTextSign: item.isCustomizableTextSign,
          isOutfitStand: item.isOutfitStand,
          isMediaPlayer: item.isMediaPlayer,
          isMinigame: isMinigamePlaceableItem(item),
          isFrame: item.isFrame,
        })
      ) {
        case "mailbox":
          return <MailboxOverlayComponent overlay={overlay} />;
        case "shop":
          return <ShopOverlayComponent overlay={overlay} />;
        case "container":
          return <ContainerOverlayComponent overlay={overlay} />;
        case "crafting_station":
          return <CraftingStationOverlayComponent overlay={overlay} />;
        case "door":
          return <DoorOverlayComponent overlay={overlay} />;
        case "readable":
          return <SignOverlayComponent overlay={overlay} />;
        case "text_sign":
          return <TextSignOverlayComponent overlay={overlay} />;
        case "outfit_stand":
          return <OutfitStandOverlayComponent overlay={overlay} />;
        case "media":
          return <VideoOverlayComponent overlay={overlay} />;
        case "minigame":
          return <MinigamePlaceableOverlay overlay={overlay} />;
        case "frame":
          return <FramePlaceableOverlayComponent overlay={overlay} />;
        case "inspect":
          return <CursorInspectionComponent overlay={overlay} />;
      }

    case "robot":
      return <RobotInspectionOverlayComponent overlay={overlay} />;

    case "npc":
      return <NpcOverlayComponent overlay={overlay} />;

    case "plant":
      return <PlantInspectionOverlayComponent overlay={overlay} />;

    case "grab_bag":
      return <GrabBagInspectionOverlayComponent overlay={overlay} />;

    case "harthmere_object":
      return <CursorInspectionComponent overlay={overlay} />;

    case "player":
      return <PlayerInspectionOverlayComponent overlay={overlay} />;

    // Non inspect nor projection
    case "loot":
      return <LootEventOverlayComponent overlay={overlay} />;

    // Tool Helper
    case "blueprint_placement":
      return <BlueprintPlacementOverlayComponent overlay={overlay} />;

    case "fish_meter":
      return <FishMeterOverlayComponent overlay={overlay} />;
  }
});

export const OverlayView: React.FunctionComponent<{}> = ({}) => {
  const { reactResources } = useClientContext();
  const [overlays, selection] = reactResources.useAll(
    ["/overlays"],
    ["/hotbar/selection"]
  );

  const action = selection.item?.action;

  return (
    <div
      className={`game-overlays ${
        selection.kind === "camera" ? "opacity-25" : ""
      }`}
    >
      <div className="cursor-overlays-container">
        {action === "fish" && <FishingOverlayComponent />}
        {mapMap(overlays, (overlay, key) => (
          <OverlayComponent overlay={overlay} key={key} />
        ))}
      </div>
    </div>
  );
};
