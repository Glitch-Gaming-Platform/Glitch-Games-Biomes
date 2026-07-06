import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { ProgressBar } from "@/client/components/HealthBarHUD";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { submitHarthmereNativePlantHarvestToLiveMode } from "@/client/components/overlays/inspected/nativePlantHarvestLiveModeBridge";
import { plantInspectionCanHarvest } from "@/client/components/overlays/inspected/plantInspectionShortcuts";
import { addToast } from "@/client/components/toast/helpers";
import type { PlantInspectOverlay } from "@/client/game/resources/overlays";
import { getBiscuit } from "@/shared/bikkie/active";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  AdminDestroyPlantEvent,
  HarvestPlantEvent,
} from "@/shared/ecs/gen/events";
import type { BiomesId } from "@/shared/ids";
import { fireAndForget } from "@/shared/util/async";
import { plantTimeString } from "@/shared/util/helpers";
import { useAnimationFrame } from "framer-motion";
import { compact } from "lodash";
import { useRef, useState } from "react";

export const PlantInspectionOverlayComponent: React.FunctionComponent<{
  overlay: PlantInspectOverlay;
}> = ({ overlay }) => {
  const { reactResources, resources, authManager, userId, events } =
    useClientContext();
  const harvestInFlightRef = useRef<Set<string>>(new Set());
  const plant = reactResources.use(
    "/ecs/c/farming_plant_component",
    overlay.entityId
  );
  const waterLevel = plant?.water_level;
  const name =
    reactResources.use("/ecs/c/label", overlay.entityId)?.text ?? undefined;
  const [curTime, setCurTime] = useState(secondsSinceEpoch());
  useAnimationFrame((_t) => {
    const newTime = secondsSinceEpoch();
    // Update at most once a second
    if (newTime - curTime > 1) {
      setCurTime(secondsSinceEpoch());
    }
  });
  const waterTime = plant?.water_at;
  const waterInSeconds = (waterTime && waterTime - curTime) ?? 0;
  const fullyGrownInSeconds =
    (plant?.fully_grown_at && plant?.fully_grown_at - curTime) ?? 0;
  const destroyPermitted =
    authManager.currentUser.hasSpecialRole("farmingAdmin");
  const adminDetails = authManager.currentUser.hasSpecialRole("farmingAdmin");
  // Only show growth time if less than water time, since the growth time will pause if unwatered.
  const showGrowthTime =
    waterTime === undefined || fullyGrownInSeconds < waterInSeconds;

  const plantBiscuit =
    plant && plant.seed ? getBiscuit(plant?.seed) : undefined;
  const harvestPermitted = plantInspectionCanHarvest(
    plant?.status,
    plantBiscuit?.farming?.kind
  );

  if (waterLevel === undefined) {
    return null;
  }

  const header = (
    <div className="water-details">
      {plant?.status === "fully_grown" &&
        plantBiscuit?.farming?.kind !== "tree" && <>{name} is fully grown</>}
      {plant?.status === "halted_water" && <>{name} needs water</>}
      {plant?.status === "halted_sun" && <>{name} needs sunlight</>}
      {plant?.status === "halted_shade" && <>{name} needs shade</>}
      {plant?.status === "growing" &&
        (showGrowthTime ? (
          <>
            {name} fully grown in{" "}
            {fullyGrownInSeconds > 60 ? (
              plantTimeString(fullyGrownInSeconds)
            ) : (
              <>less than a minute</>
            )}
          </>
        ) : waterTime ? (
          plant?.status === "growing" &&
          (waterInSeconds > 0 ? (
            <>
              {name} needs water in {plantTimeString(waterInSeconds)}
              <ProgressBar progress={waterLevel} />
            </>
          ) : (
            <>{name} needs water</>
          ))
        ) : (
          <>
            {name} doesn&apos;t need water
            <ProgressBar progress={1} />
          </>
        ))}
      {plant?.status === "dead" && <>{name} perished...</>}
      {plant?.status === "planted" && <>{name} is planted</>}
    </div>
  );

  const shortcuts: InspectShortcuts = [];
  if (harvestPermitted) {
    shortcuts.push({
      title: "Harvest",
      onKeyDown: () => {
        const plantId = String(overlay.entityId);
        if (harvestInFlightRef.current.has(plantId)) return;
        harvestInFlightRef.current.add(plantId);
        // HARTHMERE_HARVEST_INSTANT_FEEDBACK (2026-07-06): the live-mode grant
        // can take 10-30s server-side. The player must SEE the harvest happen
        // immediately, so:
        // 1. Publish the ECS terrain harvest NOW — the crop turns back into a
        //    reusable empty plot right away (this used to wait for the
        //    live-mode response, so the plant appeared untouched for ~30s and
        //    players re-harvested it).
        fireAndForget(
          events.publish(
            new HarvestPlantEvent({
              id: userId,
              plant_id: overlay.entityId,
              position: overlay.pos,
            })
          )
        );
        // 2. Acknowledge the pickup NOW. The authoritative "+N <item> added to
        //    your backpack" toast follows when the live inventory updates.
        try {
          addToast(resources, {
            kind: "basic",
            id: `harthmere-native-harvest:${plantId}`,
            message: `Harvested ${name ?? "plant"}.`,
          });
        } catch {
          // Feedback must never block the harvest itself.
        }
        // 3. Grant the item through live mode in the background.
        fireAndForget(
          (async () => {
            try {
              if (plant?.seed) {
                await submitHarthmereNativePlantHarvestToLiveMode({
                  plantId: overlay.entityId,
                  seedItemId: plant.seed,
                  plantStatus: plant.status,
                  farmingKind: plantBiscuit?.farming?.kind,
                  plantLabel: name,
                  position: overlay.pos,
                });
              }
            } finally {
              const clearInFlight = () => {
                harvestInFlightRef.current.delete(plantId);
              };
              if (typeof window !== "undefined") {
                window.setTimeout(clearInFlight, 750);
              } else {
                clearInFlight();
              }
            }
          })()
        );
      },
    });
  }
  if (destroyPermitted) {
    shortcuts.push({
      title: "[Admin] Destroy Plant",
      onKeyDown: () => {
        fireAndForget(
          events.publish(
            new AdminDestroyPlantEvent({
              id: userId,
              plant_id: overlay.entityId,
            })
          )
        );
      },
    });
  }

  return (
    <CursorInspectionComponent
      overlay={overlay}
      customHeader={header}
      shortcuts={shortcuts}
    >
      {adminDetails && (
        <PlantInspectionAdminDetails entityId={overlay.entityId} />
      )}
    </CursorInspectionComponent>
  );
};

export const PlantInspectionAdminDetails: React.FunctionComponent<{
  entityId: BiomesId;
}> = ({ entityId }) => {
  const { reactResources } = useClientContext();
  const loot = compact(
    reactResources.use("/ecs/c/container_inventory", entityId)?.items ?? []
  );
  return (
    <ul>
      {loot.length > 0 && (
        <li>
          Loot:{" "}
          {loot
            .map((itemCt) => {
              const count = itemCt.count;
              const name = itemCt.item.displayName;
              if (count === 1n) {
                return name;
              }
              return `${count}x ${name}`;
            })
            .join(", ")}
        </li>
      )}
    </ul>
  );
};
