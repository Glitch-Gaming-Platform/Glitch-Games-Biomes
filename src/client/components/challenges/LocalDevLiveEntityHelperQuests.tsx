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
  harthmereInventoryCanAcceptItemsV151,
  harthmereInventoryCountByItemIdV141,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { awardHarthmereXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  LIVE_ENTITY_HELPER_QUEST_EVENT_V1,
  liveEntityHelperQuestDialogKeyV1,
  liveEntityHelperQuestDialogPhaseV1,
  liveEntityHelperQuestRecordV1,
  readLiveEntityHelperQuestStateV1,
  writeLiveEntityHelperQuestStateV1,
  type LiveEntityHelperQuestStateV1,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import {
  LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1,
  liveEntityRobotEnergyDisplayForEntityV1,
  rechargeLocalDevLiveEntityRobotForPositionV1,
  syncLocalDevLiveEntityRobotEnergyFromComponentV1,
} from "@/client/components/challenges/LocalDevLiveEntityRobotEnergyState";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  canCompleteLiveEntityHelperQuestV1,
  getLiveEntityHelperQuestForEntityV1,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1,
  liveEntityHelperQuestDeltasV1,
  liveEntityHelperQuestEvidenceSinceBaselineV1,
  liveEntityHelperQuestObjectiveBaselineV1,
  liveEntityHelperQuestOfferedForEntityV1,
  liveEntityHelperQuestRewardTextV1,
  type LiveEntityHelperQuestEntityContextV1,
  type LiveEntityHelperQuestInstanceV1,
  type LiveEntityHelperQuestObjectiveBaselineV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import {
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1,
  liveEntityRobotRechargeRewardTextV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";
import {
  isLiveEntityHelperLiveModeRejectionErrorV1,
  liveEntityHelperLiveSnapshotHasRejectionV1,
  readLiveEntityHelperQuestLiveModeStateV1,
  submitLiveEntityHelperQuestMutationV1,
  submitLiveEntityRobotRechargeMutationV1,
  type LiveEntityHelperQuestLiveSnapshotV1,
} from "@/client/components/challenges/liveEntityHelperQuestLiveAdapter";
import type { BiomesId } from "@/shared/ids";
import {
  maybeIdToNpcType,
  relevantBiscuitForEntityId,
} from "@/shared/npc/bikkie";
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

function liveInventoryCountV1(
  liveSnapshot: LiveEntityHelperQuestLiveSnapshotV1 | undefined,
  itemId: string
) {
  return Math.max(
    0,
    Math.trunc(Number(liveSnapshot?.inventoryItems[itemId] ?? 0) || 0)
  );
}

function hardBossDefeatCountFromLiveSnapshotV1(
  quest: LiveEntityHelperQuestInstanceV1,
  liveSnapshot: LiveEntityHelperQuestLiveSnapshotV1 | undefined
) {
  if (quest.kind !== "hard_boss") {
    return 0;
  }
  const progress = Number(liveSnapshot?.quests.active[quest.questId]?.progress);
  return Number.isFinite(progress) && progress >= 1 ? 1 : 0;
}

// Live "ready to turn in" check for a stored active-quest record: rebuilds the
// quest instance from its kind and asks whether the objective (required items
// collected / boss defeated) is satisfied right now. Used by the map adapters so
// the marker flips from the target site back to the giver the moment the
// objective is met. Reads the same global inventory/combat state as turn-in, so
// it can never disagree with whether the quest is actually completable.
export function liveEntityHelperQuestRecordReadyToTurnInV1(record: {
  kind: LiveEntityHelperQuestInstanceV1["kind"];
  questId: string;
  entityId: string;
  giverName: string;
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaselineV1;
}): boolean {
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind];
  if (!definition) {
    return false;
  }
  const instance: LiveEntityHelperQuestInstanceV1 = {
    ...definition,
    questId: record.questId,
    entityId: record.entityId,
    giverName: record.giverName,
  };
  return canCompleteLiveEntityHelperQuestV1(
    instance,
    completionEvidence(instance, undefined, record.objectiveBaseline)
  ).ok;
}

// The player's RAW progress (total items held / boss defeats) right now, before
// any accept-time baseline is taken out. Used both to snapshot the baseline at
// accept and as the input to completionEvidence.
function currentRawEvidenceV1(
  quest: LiveEntityHelperQuestInstanceV1,
  liveSnapshot?: LiveEntityHelperQuestLiveSnapshotV1
) {
  const inventory: Record<string, number> = {};
  for (const item of quest.requirements.items ?? []) {
    inventory[item.itemId] = Math.max(
      harthmereInventoryCountByItemIdV141(item.itemId),
      liveInventoryCountV1(liveSnapshot, item.itemId)
    );
  }
  return {
    inventory,
    hardBossDefeats: Math.max(
      hardBossDefeatCount(),
      hardBossDefeatCountFromLiveSnapshotV1(quest, liveSnapshot)
    ),
  };
}

// Evidence that counts ONLY what was gathered / killed after the quest was
// accepted: raw progress minus the accept-time baseline. With no baseline (older
// in-flight records) this is the raw progress, preserving prior behavior.
function completionEvidence(
  quest: LiveEntityHelperQuestInstanceV1,
  liveSnapshot?: LiveEntityHelperQuestLiveSnapshotV1,
  baseline?: LiveEntityHelperQuestObjectiveBaselineV1
) {
  return liveEntityHelperQuestEvidenceSinceBaselineV1(
    currentRawEvidenceV1(quest, liveSnapshot),
    baseline
  );
}

function markQuestActiveLocallyV1(
  quest: LiveEntityHelperQuestInstanceV1,
  giverPosition?: readonly number[] | null
) {
  const state = readLiveEntityHelperQuestStateV1();
  if (state.completed[quest.questId]) {
    return;
  }
  if (quest.kind === "hard_boss" && !hasActiveHardBossQuest(state)) {
    resetHarthmereCombatNpc(HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1);
  }
  // Snapshot what the player already holds toward this quest AFTER any boss
  // reset, so completion later requires NEW items / a fresh kill and the quest
  // is never instantly "done" on accept (e.g. the default Road Rations).
  const objectiveBaseline = liveEntityHelperQuestObjectiveBaselineV1(
    quest,
    currentRawEvidenceV1(quest)
  );
  writeLiveEntityHelperQuestStateV1({
    ...state,
    active: {
      ...state.active,
      [quest.questId]: liveEntityHelperQuestRecordV1(quest, {
        giverPosition,
        objectiveBaseline,
      }),
    },
  });
}

function markQuestCompletedLocallyV1(quest: LiveEntityHelperQuestInstanceV1) {
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
}

async function acceptQuest(
  quest: LiveEntityHelperQuestInstanceV1,
  context: LiveEntityHelperQuestEntityContextV1
) {
  try {
    const snapshot = await submitLiveEntityHelperQuestMutationV1(
      "live_entity_helper_accept",
      quest,
      context
    );
    markQuestActiveLocallyV1(quest, context.position);
    return snapshot;
  } catch (error) {
    if (isLiveEntityHelperLiveModeRejectionErrorV1(error)) {
      return undefined;
    }
    markQuestActiveLocallyV1(quest, context.position);
    return undefined;
  }
}

function storedObjectiveBaselineV1(
  questId: string
): LiveEntityHelperQuestObjectiveBaselineV1 | undefined {
  return readLiveEntityHelperQuestStateV1().active[questId]?.objectiveBaseline;
}

function completeQuestLocallyV1(quest: LiveEntityHelperQuestInstanceV1) {
  const existingState = readLiveEntityHelperQuestStateV1();
  if (
    existingState.completed[quest.questId] ||
    !existingState.active[quest.questId]
  ) {
    return false;
  }
  const evidence = completionEvidence(
    quest,
    undefined,
    existingState.active[quest.questId]?.objectiveBaseline
  );
  const check = canCompleteLiveEntityHelperQuestV1(quest, evidence);
  if (!check.ok) {
    return false;
  }
  // HARTHMERE_REWARD_INVENTORY_FIT_V151: refuse the turn-in if the reward items
  // would not fit, BEFORE consuming the objective items — otherwise a full
  // backpack silently drops the reward while the quest is marked complete. The
  // quest stays active and claimable once the player frees space.
  if (!harthmereInventoryCanAcceptItemsV151(quest.rewards.items)) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("harthmere-quest-reward-blocked-full-inventory-v151", {
          detail: { questId: quest.questId, title: quest.title },
        })
      );
    }
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

  markQuestCompletedLocallyV1(quest);
  return true;
}

async function completeQuest(
  quest: LiveEntityHelperQuestInstanceV1,
  context: LiveEntityHelperQuestEntityContextV1,
  liveSnapshot: LiveEntityHelperQuestLiveSnapshotV1 | undefined
) {
  const evidence = completionEvidence(
    quest,
    liveSnapshot,
    storedObjectiveBaselineV1(quest.questId)
  );
  const check = canCompleteLiveEntityHelperQuestV1(quest, evidence);
  if (!check.ok) {
    return { ok: false, liveSnapshot: undefined };
  }

  try {
    let latestSnapshot = liveSnapshot;
    if (quest.kind === "hard_boss" && hardBossDefeatCount() > 0) {
      latestSnapshot = await submitLiveEntityHelperQuestMutationV1(
        "live_entity_helper_record_boss_defeat",
        quest,
        context,
        {
          extraPayload: {
            bossDefeated: true,
            bossKillCredit: hardBossDefeatCount(),
            bossEntityId: String(
              HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1
            ),
          },
        }
      );
    }
    latestSnapshot = await submitLiveEntityHelperQuestMutationV1(
      "live_entity_helper_complete",
      quest,
      context
    );
    if (!liveEntityHelperLiveSnapshotHasRejectionV1(latestSnapshot)) {
      markQuestCompletedLocallyV1(quest);
      return { ok: true, liveSnapshot: latestSnapshot };
    }
  } catch (error) {
    if (isLiveEntityHelperLiveModeRejectionErrorV1(error)) {
      return { ok: false, liveSnapshot: undefined };
    }
  }

  return { ok: completeQuestLocallyV1(quest), liveSnapshot: undefined };
}

export function contextForLiveEntityHelperQuestV1(input: {
  entityId: BiomesId;
  label?: string;
  position?: readonly number[];
  defaultDialog?: unknown;
  entityDescription?: unknown;
  questGiver?: unknown;
  robotComponent?: unknown;
  appearanceComponent?: unknown;
  npcMetadata?: { type_id?: BiomesId } | undefined;
  playerStatus?: unknown;
  relevantBiscuit?: {
    isRobot?: unknown;
    isPlayerLikeAppearance?: unknown;
    npcDefaultDialog?: unknown;
    isMount?: unknown;
  };
  iced?: unknown;
  // V148: optional explicit exclusions so callers that know the entity is
  // a muck monster, jobs board, or mount-only interaction can declare it
  // without relying on the label regex backstop.
  isMuckMonster?: unknown;
  isJobsBoard?: unknown;
  isMountOnly?: unknown;
}): LiveEntityHelperQuestEntityContextV1 {
  const npcType = input.npcMetadata?.type_id
    ? maybeIdToNpcType(input.npcMetadata.type_id)
    : undefined;
  const isRobotLike =
    Boolean(input.robotComponent) ||
    Boolean(input.relevantBiscuit?.isRobot) ||
    Boolean(npcType?.isRobot) ||
    input.npcMetadata?.type_id === BikkieIds.biomesRobot ||
    input.npcMetadata?.type_id === BikkieIds.adminRobot;
  const hasTalkableDialog = Boolean(
    input.defaultDialog ||
      input.entityDescription ||
      input.questGiver ||
      typeof input.relevantBiscuit?.npcDefaultDialog === "string" ||
      typeof npcType?.npcDefaultDialog === "string" ||
      input.relevantBiscuit?.isPlayerLikeAppearance ||
      npcType?.isPlayerLikeAppearance ||
      input.relevantBiscuit?.isRobot ||
      npcType?.isRobot
  );
  // V148: derive "mount-only" — the entity has no other talkable signal
  // besides being a mount. Mount-only entities use the "Sing Song" path
  // and should not generate helper quests. A mount that is ALSO a person
  // or robot stays eligible.
  const isMountOnly =
    Boolean(input.isMountOnly) ||
    (Boolean(input.relevantBiscuit?.isMount) &&
      !hasTalkableDialog &&
      !isRobotLike &&
      !input.appearanceComponent &&
      !input.npcMetadata &&
      !input.playerStatus);
  return {
    entityId: input.entityId,
    label: input.label,
    position: input.position,
    hasRobotComponent: Boolean(input.robotComponent),
    hasAppearanceComponent: Boolean(input.appearanceComponent),
    hasNpcMetadata: Boolean(input.npcMetadata),
    hasPlayerStatus: Boolean(input.playerStatus),
    hasTalkableDialog,
    isRobotLike,
    iced: Boolean(input.iced),
    isMuckMonster: Boolean(input.isMuckMonster),
    isJobsBoard: Boolean(input.isJobsBoard),
    isMountOnly,
    // V152: any entity flagged as an authored quest giver in ECS already has a
    // quest of its own (Grove/Harthmere NPCs incl. Billy Rhodes, shop owners),
    // so it must never also offer a generic helper quest.
    hasQuestGiverComponent: Boolean(input.questGiver),
  };
}

export function useLiveEntityHelperQuestDialogV1(talkingToNPCId: BiomesId) {
  const { reactResources, resources } = useClientContext();
  const [
    label,
    defaultDialog,
    entityDescription,
    questGiver,
    position,
    robotComponent,
    appearanceComponent,
    npcMetadata,
    playerStatus,
  ] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/default_dialog", talkingToNPCId],
    ["/ecs/c/entity_description", talkingToNPCId],
    ["/ecs/c/quest_giver", talkingToNPCId],
    ["/ecs/c/position", talkingToNPCId],
    ["/ecs/c/robot_component", talkingToNPCId],
    ["/ecs/c/appearance_component", talkingToNPCId],
    ["/ecs/c/npc_metadata", talkingToNPCId],
    ["/ecs/c/player_status", talkingToNPCId]
  );
  const iced = reactResources.use("/ecs/c/iced", talkingToNPCId);
  const [refreshToken, setRefreshToken] = useState(0);
  const [liveQuestSnapshot, setLiveQuestSnapshot] = useState<
    LiveEntityHelperQuestLiveSnapshotV1 | undefined
  >(undefined);

  const relevantBiscuit = useMemo(() => {
    try {
      return relevantBiscuitForEntityId(resources, talkingToNPCId);
    } catch {
      return undefined;
    }
  }, [resources, talkingToNPCId]);

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

  const questContext = useMemo(
    () =>
      contextForLiveEntityHelperQuestV1({
        entityId: talkingToNPCId,
        label: label?.text,
        position: position?.v,
        defaultDialog: defaultDialog?.text,
        entityDescription: entityDescription?.text,
        questGiver,
        robotComponent,
        appearanceComponent,
        npcMetadata,
        playerStatus,
        relevantBiscuit,
        iced,
      }),
    [
      appearanceComponent,
      defaultDialog?.text,
      entityDescription?.text,
      iced,
      label?.text,
      npcMetadata,
      playerStatus,
      position?.v,
      questGiver,
      relevantBiscuit,
      robotComponent,
      talkingToNPCId,
    ]
  );

  // Only ~70% of otherwise-eligible entities actually hand out a helper quest;
  // the rest are just normal talkable NPCs. The decision is a stable hash of the
  // entity, so a given NPC always behaves the same way and an accepted quest
  // (which could only have been accepted from an offering NPC) still shows for
  // turn-in.
  const quest = useMemo(() => {
    const candidate = getLiveEntityHelperQuestForEntityV1(questContext);
    if (!candidate) {
      return undefined;
    }
    return liveEntityHelperQuestOfferedForEntityV1(
      questContext.entityId,
      questContext.label
    )
      ? candidate
      : undefined;
  }, [questContext]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    readLiveEntityHelperQuestLiveModeStateV1()
      .then((snapshot) => {
        if (!cancelled) {
          setLiveQuestSnapshot(snapshot);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveQuestSnapshot(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    syncLocalDevLiveEntityRobotEnergyFromComponentV1({
      position: position?.v,
      robotComponent,
      displayName: label?.text,
    });
  }, [label?.text, position?.v, robotComponent]);

  const state = useMemo(
    () => readLiveEntityHelperQuestStateV1(),
    [refreshToken]
  );
  const robotEnergyDisplay = useMemo(
    () =>
      liveEntityRobotEnergyDisplayForEntityV1(
        position?.v,
        robotComponent,
        label?.text
      ),
    [label?.text, position?.v, robotComponent, refreshToken]
  );

  const complete = useCallback(
    (activeQuest: LiveEntityHelperQuestInstanceV1) => {
      void completeQuest(activeQuest, questContext, liveQuestSnapshot).then(
        (result) => {
          if (result.liveSnapshot) {
            setLiveQuestSnapshot(result.liveSnapshot);
          }
          if (result.ok) {
            setRefreshToken((old) => old + 1);
          }
        }
      );
    },
    [liveQuestSnapshot, questContext]
  );

  if (!quest) {
    return undefined;
  }

  const isCompleted = Boolean(
    state.completed[quest.questId] ||
      liveQuestSnapshot?.quests.completed[quest.questId] !== undefined
  );
  const isActive = Boolean(
    state.active[quest.questId] ||
      liveQuestSnapshot?.quests.active[quest.questId] !== undefined
  );
  const evidence = completionEvidence(
    quest,
    liveQuestSnapshot,
    state.active[quest.questId]?.objectiveBaseline
  );
  const completionCheck = canCompleteLiveEntityHelperQuestV1(quest, evidence);
  const missingText = completionCheck.missing.join(", ");
  const rewardText = liveEntityHelperQuestRewardTextV1(quest);
  const actions: TalkDialogStepAction[] = [];

  if (!isCompleted && !isActive) {
    actions.push({
      name: quest.buttonName,
      type: "primary",
      tooltip: quest.taskHint,
      followUpText: textBlock(quest.activeText),
      onPerformed: () => {
        void acceptQuest(quest, questContext).then((snapshot) => {
          if (snapshot) {
            setLiveQuestSnapshot(snapshot);
          }
          setRefreshToken((old) => old + 1);
        });
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
        ? `Claim ${rewardText}`
        : `Missing: ${missingText}`,
      followUpText: textBlock(quest.completionText),
      onPerformed: () => complete(quest),
    });
  }

  if (
    robotEnergyDisplay?.needsRechargeText &&
    Math.max(
      harthmereInventoryCountByItemIdV141(
        LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1
      ),
      liveInventoryCountV1(
        liveQuestSnapshot,
        LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1
      )
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
        void submitLiveEntityRobotRechargeMutationV1({
          entityId: talkingToNPCId,
          label: label?.text,
          position: position?.v,
        })
          .then((snapshot) => {
            setLiveQuestSnapshot(snapshot);
            rechargeLocalDevLiveEntityRobotForPositionV1(position?.v);
            setRefreshToken((old) => old + 1);
          })
          .catch((error) => {
            if (isLiveEntityHelperLiveModeRejectionErrorV1(error)) {
              return;
            }
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
          });
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
    ? ` Robot charge: [${robotEnergyDisplay.barText}] ${
        robotEnergyDisplay.statusText
      }${
        robotEnergyDisplay.needsRechargeText
          ? ` ${robotEnergyDisplay.needsRechargeText}`
          : ""
      }${
        robotEnergyDisplay.rewardText ? ` ${robotEnergyDisplay.rewardText}` : ""
      }`
    : "";
  const statusText = `${questStatusText} ${rewardText}${robotEnergyText}`;

  return {
    id: liveEntityHelperQuestDialogKeyV1(
      quest.questId,
      liveEntityHelperQuestDialogPhaseV1(
        isActive,
        isCompleted,
        completionCheck.ok
      )
    ),
    dialogText: textBlock(statusText),
    actions,
    quest,
  };
}
