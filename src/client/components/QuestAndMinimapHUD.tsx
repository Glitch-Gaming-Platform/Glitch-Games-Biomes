import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { BiomesUIMount } from "@/client/components/biomes_ui/BiomesUIMount";
import { HarthmereUnifiedHUD } from "@/client/components/challenges/HarthmereUnifiedHUD";
import { QuestsHUD } from "@/client/components/challenges/QuestsHUD";
import React from "react";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <HarthmereUnifiedHUD />
        {/* Additive: renders only when BIOMES_UI_ENABLED is set or
            localStorage.biomes_ui_enabled === "1". Toggle live with
            Shift+Alt+B. Does not replace HarthmereUnifiedHUD. */}
        <BiomesUIMount />
      </>
    );
  }

  return (
    <>
      <div className="absolute bottom-0.8 right-0.8 flex flex-col items-end gap-2">
        <RulesetToggleable name="challenges">
          <QuestsHUD />
        </RulesetToggleable>
        <RulesetToggleable name="minimap">
          <MiniMapHUD />
        </RulesetToggleable>
      </div>
      <BiomesUIMount />
    </>
  );
};
