import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { QuestsHUD } from "@/client/components/challenges/QuestsHUD";
import { HarthmereQuestMapHUD } from "@/client/components/challenges/LocalDevHarthmereQuests";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  return (
    <div className="absolute bottom-0.8 right-0.8 flex flex-col items-end gap-2">
      <RulesetToggleable name="challenges">
        <QuestsHUD />
      </RulesetToggleable>
      {process.env.NODE_ENV !== "production" && <HarthmereQuestMapHUD />}
      <RulesetToggleable name="minimap">
        <MiniMapHUD />
      </RulesetToggleable>
    </div>
  );
};
