import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { RulesetToggleable } from "@/client/components/RulsetToggleable";
import { QuestsHUD } from "@/client/components/challenges/QuestsHUD";
import { HarthmereBuildingHUD } from "@/client/components/challenges/LocalDevHarthmereBuildingSystem";
import { HarthmereCombatHUD } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { HarthmereClassSkillHUD } from "@/client/components/challenges/LocalDevHarthmereClassSkillSystem";
import { HarthmereDeathHUD } from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
import { HarthmereEconomyHUD } from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import { HarthmereGatheringHUD } from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { HarthmereGuildHUD } from "@/client/components/challenges/LocalDevHarthmereGuildSystem";
import { HarthmereInventoryHUD } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HarthmereLevelingHUD } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { HarthmereQuestMapHUD } from "@/client/components/challenges/LocalDevHarthmereQuests";
import { HarthmereMissionTrackerHUD } from "@/client/components/challenges/LocalDevHarthmereMissionSystem";
import { HarthmereMultiplayerCombatHUD } from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import { HarthmereReputationHUD } from "@/client/components/challenges/LocalDevHarthmereReputation";

export const QuestsAndMiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  return (
    <div className="absolute bottom-0.8 right-0.8 flex flex-col items-end gap-2">
      <RulesetToggleable name="challenges">
        <QuestsHUD />
      </RulesetToggleable>
      {process.env.NODE_ENV !== "production" && (
        <>
          <HarthmereDeathHUD />
          <HarthmereLevelingHUD />
          <HarthmereInventoryHUD />
          <HarthmereEconomyHUD />
          <HarthmereGatheringHUD />
          <HarthmereBuildingHUD />
          <HarthmereGuildHUD />
          <HarthmereClassSkillHUD />
          <HarthmereMultiplayerCombatHUD />
          <HarthmereCombatHUD />
          <HarthmereReputationHUD />
          <HarthmereMissionTrackerHUD />
          <HarthmereQuestMapHUD />
        </>
      )}
      <RulesetToggleable name="minimap">
        <MiniMapHUD />
      </RulesetToggleable>
    </div>
  );
};
