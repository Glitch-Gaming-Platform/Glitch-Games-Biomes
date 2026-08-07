import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { BiomesUIMount } from "@/client/components/biomes_ui/BiomesUIMount";
import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import { useBiomesHUDVisibilitySnapshot } from "@/client/components/biomes_ui/hudVisibilitySettings";
import { HarthmereUnifiedHUD } from "@/client/components/challenges/HarthmereUnifiedHUD";
import { useHarthmereCombatPresentation } from "@/client/components/challenges/useHarthmereCombatPresentation";
import { PlayerVoiceChat } from "@/client/components/system/PlayerVoiceChat";
import React from "react";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const hudVisibility = useBiomesHUDVisibilitySnapshot();
  const combatPresentation = useHarthmereCombatPresentation();
  const showMiniMap = hudVisibility.miniMap && !combatPresentation.suspended;

  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <HarthmereUnifiedHUD hideLegacyVisuals={replaceLegacy} />
        {hudVisibility.miniMap && (
          <div className="absolute right-0.8 top-0.8 flex flex-col items-end gap-2">
            {showMiniMap && (
              <RulesetToggleable name="minimap">
                <MiniMapHUD />
              </RulesetToggleable>
            )}
            <PlayerVoiceChat />
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
          {showMiniMap && (
            <RulesetToggleable name="minimap">
              <MiniMapHUD />
            </RulesetToggleable>
          )}
          <PlayerVoiceChat />
        </div>
      )}
      <BiomesUIMount forceEnabled={replaceLegacy} />
    </>
  );
};
