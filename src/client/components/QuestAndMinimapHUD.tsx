import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { HarthmereUnifiedHUD } from "@/client/components/challenges/HarthmereUnifiedHUD";
import { QuestsHUD } from "@/client/components/challenges/QuestsHUD";
import React from "react";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  if (process.env.NODE_ENV !== "production") {
    return <HarthmereUnifiedHUD />;
  }

  return (
    <div className="absolute bottom-0.8 right-0.8 flex flex-col items-end gap-2">
      <RulesetToggleable name="challenges">
        <QuestsHUD />
      </RulesetToggleable>
      <RulesetToggleable name="minimap">
        <MiniMapHUD />
      </RulesetToggleable>
    </div>
  );
};
