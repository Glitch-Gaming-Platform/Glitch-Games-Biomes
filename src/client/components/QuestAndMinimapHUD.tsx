import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { BiomesUIMount } from "@/client/components/biomes_ui/BiomesUIMount";
import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import { useBiomesHUDVisibilitySnapshot } from "@/client/components/biomes_ui/hudVisibilitySettings";
import { HarthmereUnifiedHUD } from "@/client/components/challenges/HarthmereUnifiedHUD";
import React from "react";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const hudVisibility = useBiomesHUDVisibilitySnapshot();

  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <HarthmereUnifiedHUD hideLegacyVisuals={replaceLegacy} />
        {hudVisibility.miniMap && (
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
      <HarthmereUnifiedHUD hideLegacyVisuals />
      {hudVisibility.miniMap && (
        <div className="absolute right-0.8 top-0.8 flex flex-col items-end gap-2">
          <RulesetToggleable name="minimap">
            <MiniMapHUD />
          </RulesetToggleable>
        </div>
      )}
      <BiomesUIMount forceEnabled={replaceLegacy} />
    </>
  );
};
