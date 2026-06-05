import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { BiomesUIMount } from "@/client/components/biomes_ui/BiomesUIMount";
import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import { useBiomesHUDVisibilitySnapshotV1 } from "@/client/components/biomes_ui/hudVisibilitySettings";
import { HarthmereUnifiedHUD } from "@/client/components/challenges/HarthmereUnifiedHUD";
import { QuestsHUD } from "@/client/components/challenges/QuestsHUD";
import React from "react";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const hudVisibility = useBiomesHUDVisibilitySnapshotV1();

  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <HarthmereUnifiedHUD hideLegacyVisuals={replaceLegacy} />
        {replaceLegacy && hudVisibility.miniMap && (
          <div className="absolute right-0.8 top-0.8 flex flex-col items-end gap-2">
            <RulesetToggleable name="minimap">
              <MiniMapHUD />
            </RulesetToggleable>
          </div>
        )}
        <BiomesUIMount forceEnabled={replaceLegacy} />
      </>
    );
  }

  return (
    <>
      {!replaceLegacy ? (
        <div className="absolute bottom-0.8 right-0.8 flex flex-col items-end gap-2">
          {hudVisibility.objectives && (
            <RulesetToggleable name="challenges">
              <QuestsHUD />
            </RulesetToggleable>
          )}
          {hudVisibility.miniMap && (
            <RulesetToggleable name="minimap">
              <MiniMapHUD />
            </RulesetToggleable>
          )}
        </div>
      ) : (
        hudVisibility.miniMap && (
          <div className="absolute right-0.8 top-0.8 flex flex-col items-end gap-2">
            <RulesetToggleable name="minimap">
              <MiniMapHUD />
            </RulesetToggleable>
          </div>
        )
      )}
      <BiomesUIMount forceEnabled={replaceLegacy} />
    </>
  );
};
