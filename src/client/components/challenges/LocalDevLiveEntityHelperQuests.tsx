import {
  HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1,
  getHarthmereCombatNpcStatus,
  performHarthmereCombatAttack,
  readHarthmereCombatState,
  resetHarthmereCombatNpc,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  consumeHarthmereItemByItemIdV141,
  grantHarthmereItem,
  harthmereInventoryCountByItemIdV141,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { awardHarthmereXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  LIVE_ENTITY_HELPER_QUEST_EVENT_V1,
  liveEntityHelperQuestDialogKeyV1,
  liveEntityHelperQuestRecordV1,
  readLiveEntityHelperQuestStateV1,
  writeLiveEntityHelperQuestStateV1,
  type LiveEntityHelperQuestStateV1,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import {
  LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1,
  liveEntityRobotEnergyDisplayForPositionV1,
  rechargeLocalDevLiveEntityRobotForPositionV1,
} from "@/client/components/challenges/LocalDevLiveEntityRobotEnergyState";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  canCompleteLiveEntityHelperQuestV1,
  getLiveEntityHelperQuestForEntityV1,
  liveEntityHelperQuestDeltasV1,
  type LiveEntityHelperQuestEntityContextV1,
  type LiveEntityHelperQuestInstanceV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import {
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1,
  liveEntityRobotRechargeRewardTextV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";
import type { BiomesId } from "@/shared/ids";
import { maybeIdToNpcType } from "@/shared/npc/bikkie";
import { useCallback, useEffect, useMemo, useState } from "react";

const HARTHMERE_INVENTORY_EVENT = "biomes:harthmere-inventory-changed";
const HARTHMERE_COMBAT_EVENT = "biomes:harthmere-combat-changed";

function textBlock(text: string) {
  return `<text>${text}</text>`;
}

function grantRobotRechargeRewardV1() {
  for (const item of LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1) {
    grantHarthmereItem(item.itemId, item.quantity, "Robot recharge reward");
  }
  awardHarthmereXp({
    source: "quest",
    label: "Robot Recharge",
    baseXp: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.baseXp,
    sourceLevel: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.sourceLevel,
    difficulty: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.difficulty,
    detail: "Restored a robot protection field with Stabilized Exotic Matter.",
  });
}

function hasActiveHardBossQuest(state: LiveEntityHelperQuestStateV1) {
  return Object.values(state.active).some(
    (record) => record.kind === "hard_boss"
  );
}

function hardBossDefeatCount() {
  const status = getHarthmereCombatNpcStatus(
    HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1
  );
  const combat = readHarthmereCombatState();
  const killCredit =
    combat.killCredit[
      String(HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1)
    ] ?? 0;
  return status.dead && killCredit > 0 ? 1 : 0;
}

function completionEvidence(quest: LiveEntityHelperQuestInstanceV1) {
  const inventory: Record<string, number> = {};
  for (const item of quest.requirements.items ?? []) {
    inventory[item.itemId] = harthmereInventoryCountByItemIdV141(item.itemId);
  }
  return {
    inventory,
    hardBossDefeats: hardBossDefeatCount(),
  };
}

function acceptQuest(quest: LiveEntityHelperQuestInstanceV1) {
  const state = readLiveEntityHelperQuestStateV1();
  if (state.completed[quest.questId]) {
    return;
  }
  if (quest.kind === "hard_boss" && !hasActiveHardBossQuest(state)) {
    resetHarthmereCombatNpc(HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1);
  }
  writeLiveEntityHelperQuestStateV1({
    ...state,
    active: {
      ...state.active,
      [quest.questId]: liveEntityHelperQuestRecordV1(quest),
    },
  });
}

function completeQuest(quest: LiveEntityHelperQuestInstanceV1) {
  const existingState = readLiveEntityHelperQuestStateV1();
  if (
    existingState.completed[quest.questId] ||
    !existingState.active[quest.questId]
  ) {
    return false;
  }
  const evidence = completionEvidence(quest);
  const check = canCompleteLiveEntityHelperQuestV1(quest, evidence);
  if (!check.ok) {
    return false;
  }
  const deltas = liveEntityHelperQuestDeltasV1(quest);
  for (const [itemId, quantity] of Object.entries(deltas.consumedItems)) {
    const consumed = consumeHarthmereItemByItemIdV141(
      itemId,
      quantity,
      `${quest.title} turn-in`
    );
    if (consumed < quantity) {
      return false;
    }
  }
  for (const item of quest.rewards.items) {
    grantHarthmereItem(item.itemId, item.quantity, `${quest.title} reward`);
  }
  awardHarthmereXp({
    source: "quest",
    label: quest.title,
    baseXp: quest.rewards.baseXp,
    sourceLevel: quest.rewards.sourceLevel,
    difficulty: quest.rewards.difficulty,
    detail: `Completed a live-entity helper quest for ${quest.giverName}.`,
  });

  const state = readLiveEntityHelperQuestStateV1();
  const active = { ...state.active };
  delete active[quest.questId];
  writeLiveEntityHelperQuestStateV1({
    active,
    completed: {
      ...state.completed,
      [quest.questId]: liveEntityHelperQuestRecordV1(quest),
    },
  });
  return true;
}

export function contextForLiveEntityHelperQuestV1(input: {
  entityId: BiomesId;
  label?: string;
  position?: readonly number[];
  robotComponent?: unknown;
  appearanceComponent?: unknown;
  npcMetadata?: { type_id?: BiomesId } | undefined;
  playerStatus?: unknown;
  iced?: unknown;
}): LiveEntityHelperQuestEntityContextV1 {
  const npcType = input.npcMetadata?.type_id
    ? maybeIdToNpcType(input.npcMetadata.type_id)
    : undefined;
  const isRobotLike =
    Boolean(input.robotComponent) ||
    Boolean(npcType?.isRobot) ||
    input.npcMetadata?.type_id === BikkieIds.biomesRobot ||
    input.npcMetadata?.type_id === BikkieIds.adminRobot;
  return {
    entityId: input.entityId,
    label: input.label,
    position: input.position,
    hasRobotComponent: Boolean(input.robotComponent),
    hasAppearanceComponent: Boolean(input.appearanceComponent),
    hasNpcMetadata: Boolean(input.npcMetadata),
    hasPlayerStatus: Boolean(input.playerStatus),
    isRobotLike,
    iced: Boolean(input.iced),
  };
}

export function useLiveEntityHelperQuestDialogV1(talkingToNPCId: BiomesId) {
  const { reactResources } = useClientContext();
  const [
    label,
    position,
    robotComponent,
    appearanceComponent,
    npcMetadata,
    playerStatus,
    iced,
  ] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/position", talkingToNPCId],
    ["/ecs/c/robot_component", talkingToNPCId],
    ["/ecs/c/appearance_component", talkingToNPCId],
    ["/ecs/c/npc_metadata", talkingToNPCId],
    ["/ecs/c/player_status", talkingToNPCId],
    ["/ecs/c/iced", talkingToNPCId]
  );
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const refresh = () => setRefreshToken((old) => old + 1);
    window.addEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT_V1, refresh);
    window.addEventListener(LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1, refresh);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    window.addEventListener(HARTHMERE_COMBAT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT_V1, refresh);
      window.removeEventListener(LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1, refresh);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      window.removeEventListener(HARTHMERE_COMBAT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const quest = useMemo(
    () =>
      getLiveEntityHelperQuestForEntityV1(
        contextForLiveEntityHelperQuestV1({
          entityId: talkingToNPCId,
          label: label?.text,
          position: position?.v,
          robotComponent,
          appearanceComponent,
          npcMetadata,
          playerStatus,
          iced,
        })
      ),
    [
      appearanceComponent,
      iced,
      label?.text,
      npcMetadata,
      playerStatus,
      position?.v,
      robotComponent,
      talkingToNPCId,
    ]
  );

  const state = useMemo(
    () => readLiveEntityHelperQuestStateV1(),
    [refreshToken]
  );
  const robotEnergyDisplay = useMemo(
    () => liveEntityRobotEnergyDisplayForPositionV1(position?.v),
    [position?.v, refreshToken]
  );

  const complete = useCallback(
    (activeQuest: LiveEntityHelperQuestInstanceV1) => {
      if (completeQuest(activeQuest)) {
        setRefreshToken((old) => old + 1);
      }
    },
    []
  );

  if (!quest) {
    return undefined;
  }

  const isCompleted = Boolean(state.completed[quest.questId]);
  const isActive = Boolean(state.active[quest.questId]);
  const evidence = completionEvidence(quest);
  const completionCheck = canCompleteLiveEntityHelperQuestV1(quest, evidence);
  const missingText = completionCheck.missing.join(", ");
  const actions: TalkDialogStepAction[] = [];

  if (!isCompleted && !isActive) {
    actions.push({
      name: quest.buttonName,
      type: "primary",
      tooltip: quest.taskHint,
      followUpText: textBlock(quest.activeText),
      onPerformed: () => {
        acceptQuest(quest);
        setRefreshToken((old) => old + 1);
      },
    });
  }

  if (
    !isCompleted &&
    isActive &&
    quest.kind === "hard_boss" &&
    !completionCheck.ok
  ) {
    actions.push({
      name: "Fight the Muck-Scarred Helix",
      type: "primary",
      tooltip:
        "Engage the Muck-Scarred Helix at the active breach marker. Return after the boss is defeated.",
      followUpText: textBlock(
        "The Muck-Scarred Helix rises at the West Muck Breach. Keep fighting until it is defeated, then return for the reward."
      ),
      onPerformed: () =>
        performHarthmereCombatAttack(
          HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1,
          "heavy"
        ),
    });
  }

  if (!isCompleted && isActive) {
    actions.push({
      name: `Complete: ${quest.title}`,
      type: completionCheck.ok ? "primary" : undefined,
      disabled: !completionCheck.ok,
      tooltip: completionCheck.ok
        ? `Claim ${quest.rewards.baseXp} base XP and quest rewards.`
        : `Missing: ${missingText}`,
      followUpText: textBlock(quest.completionText),
      onPerformed: () => complete(quest),
    });
  }

  if (
    robotEnergyDisplay?.needsRechargeText &&
    harthmereInventoryCountByItemIdV141(
      LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1
    ) >= LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1
  ) {
    actions.push({
      name: "Recharge Robot",
      type: "primary",
      tooltip: `Use ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1} Stabilized Exotic Matter to restore the protection field. ${liveEntityRobotRechargeRewardTextV1()}`,
      followUpText: textBlock(
        `The robot hums back to life. The shield line brightens and the Muck edge pulls back. ${liveEntityRobotRechargeRewardTextV1()}`
      ),
      onPerformed: () => {
        const consumed = consumeHarthmereItemByItemIdV141(
          LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
          LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1,
          "Robot recharge"
        );
        if (consumed >= LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1) {
          rechargeLocalDevLiveEntityRobotForPositionV1(position?.v);
          grantRobotRechargeRewardV1();
          setRefreshToken((old) => old + 1);
        }
      },
    });
  }

  const questStatusText = isCompleted
    ? `Completed: ${quest.title}. ${quest.completionText}`
    : isActive
    ? completionCheck.ok
      ? quest.readyText
      : quest.activeText
    : quest.offerText;
  const robotEnergyText = robotEnergyDisplay
    ? ` Robot charge: [${robotEnergyDisplay.barText}] ${robotEnergyDisplay.statusText}${
        robotEnergyDisplay.needsRechargeText
          ? ` ${robotEnergyDisplay.needsRechargeText}`
          : ""
      }${robotEnergyDisplay.rewardText ? ` ${robotEnergyDisplay.rewardText}` : ""}`
    : "";
  const statusText = `${questStatusText}${robotEnergyText}`;

  return {
    id: liveEntityHelperQuestDialogKeyV1(
      quest.questId,
      isActive,
      isCompleted,
      refreshToken
    ),
    dialogText: textBlock(statusText),
    actions,
    quest,
  };
}
