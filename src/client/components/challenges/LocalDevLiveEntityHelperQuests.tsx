import {
  HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET,
  getHarthmereCombatNpcStatus,
  performHarthmereCombatAttack,
  readHarthmereCombatState,
  resetHarthmereCombatNpc,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  consumeHarthmereItemByItemId,
  grantHarthmereItem,
  harthmereInventoryCanAcceptItems,
  harthmereInventoryCountByItemId,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { awardHarthmereXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  LIVE_ENTITY_HELPER_QUEST_EVENT,
  liveEntityHelperQuestDialogKey,
  liveEntityHelperQuestDialogPhase,
  liveEntityHelperQuestRecord,
  readLiveEntityHelperQuestState,
  writeLiveEntityHelperQuestState,
  type LiveEntityHelperQuestState,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import {
  LIVE_ENTITY_ROBOT_ENERGY_EVENT,
  liveEntityRobotEnergyDisplayForEntity,
  rechargeLocalDevLiveEntityRobotForPosition,
  syncLocalDevLiveEntityRobotEnergyFromComponent,
} from "@/client/components/challenges/LocalDevLiveEntityRobotEnergyState";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  canCompleteLiveEntityHelperQuest,
  getLiveEntityHelperQuestForEntity,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  liveEntityHelperQuestDeltas,
  liveEntityHelperQuestEvidenceSinceBaseline,
  liveEntityHelperQuestObjectiveBaseline,
  liveEntityHelperQuestOfferedForEntity,
  liveEntityHelperQuestRewardText,
  type LiveEntityHelperQuestEntityContext,
  type LiveEntityHelperQuestInstance,
  type LiveEntityHelperQuestObjectiveBaseline,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP,
  liveEntityRobotRechargeRewardText,
} from "@/shared/harthmere/live_entity_robot_energy_protection";
import {
  isLiveEntityHelperLiveModeRejectionError,
  liveEntityHelperLiveSnapshotHasRejection,
  readLiveEntityHelperQuestLiveModeState,
  submitLiveEntityHelperQuestMutation,
  submitLiveEntityRobotRechargeMutation,
  type LiveEntityHelperQuestLiveSnapshot,
} from "@/client/components/challenges/liveEntityHelperQuestLiveAdapter";
import type { BiomesId } from "@/shared/ids";
import {
  maybeIdToNpcType,
  relevantBiscuitForEntityId,
} from "@/shared/npc/bikkie";
import { HARTHMERE_INVENTORY_EVENT } from "@/client/components/challenges/harthmereEvents";
import { readHarthmereNativeCombatProgression } from "@/shared/harthmere/harthmere_native_combat";
import { HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED } from "@/shared/harthmere/live_entity_production_seed";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { useCallback, useEffect, useMemo, useState } from "react";

const HARTHMERE_COMBAT_EVENT = "biomes:harthmere-combat-changed";

function textBlock(text: string) {
  return `<text>${text}</text>`;
}

function grantRobotRechargeReward() {
  for (const item of LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS) {
    grantHarthmereItem(item.itemId, item.quantity, "Robot recharge reward");
  }
  awardHarthmereXp({
    source: "quest",
    label: "Robot Recharge",
    baseXp: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.baseXp,
    sourceLevel: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.sourceLevel,
    difficulty: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.difficulty,
    detail: "Restored a robot protection field with Stabilized Exotic Matter.",
  });
}

function hasActiveHardBossQuest(state: LiveEntityHelperQuestState) {
  return Object.values(state.active).some(
    (record) => record.kind === "hard_boss"
  );
}

function hardBossDefeatCount() {
  const status = getHarthmereCombatNpcStatus(
    HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET
  );
  const combat = readHarthmereCombatState();
  const killCredit =
    combat.killCredit[String(HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET)] ??
    0;
  return status.dead && killCredit > 0 ? 1 : 0;
}

function liveInventoryCount(
  liveSnapshot: LiveEntityHelperQuestLiveSnapshot | undefined,
  itemId: string
) {
  return Math.max(
    0,
    Math.trunc(Number(liveSnapshot?.inventoryItems[itemId] ?? 0) || 0)
  );
}

function hardBossDefeatCountFromLiveSnapshot(
  quest: LiveEntityHelperQuestInstance,
  liveSnapshot: LiveEntityHelperQuestLiveSnapshot | undefined
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
export function liveEntityHelperQuestRecordReadyToTurnIn(record: {
  kind: LiveEntityHelperQuestInstance["kind"];
  questId: string;
  entityId: string;
  giverName: string;
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaseline;
}): boolean {
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
  if (!definition) {
    return false;
  }
  const instance: LiveEntityHelperQuestInstance = {
    ...definition,
    questId: record.questId,
    entityId: record.entityId,
    giverName: record.giverName,
  };
  return canCompleteLiveEntityHelperQuest(
    instance,
    completionEvidence(instance, undefined, record.objectiveBaseline)
  ).ok;
}

// The player's RAW progress (total items held / boss defeats) right now, before
// any accept-time baseline is taken out. Used both to snapshot the baseline at
// accept and as the input to completionEvidence.
function currentRawEvidence(
  quest: LiveEntityHelperQuestInstance,
  liveSnapshot?: LiveEntityHelperQuestLiveSnapshot,
  nativeBossDefeats = 0
) {
  const inventory: Record<string, number> = {};
  for (const item of quest.requirements.items ?? []) {
    inventory[item.itemId] = Math.max(
      harthmereInventoryCountByItemId(item.itemId),
      liveInventoryCount(liveSnapshot, item.itemId)
    );
  }
  return {
    inventory,
    hardBossDefeats: Math.max(
      hardBossDefeatCount(),
      hardBossDefeatCountFromLiveSnapshot(quest, liveSnapshot),
      nativeBossDefeats
    ),
  };
}

// Evidence that counts ONLY what was gathered / killed after the quest was
// accepted: raw progress minus the accept-time baseline. With no baseline (older
// in-flight records) this is the raw progress, preserving prior behavior.
function completionEvidence(
  quest: LiveEntityHelperQuestInstance,
  liveSnapshot?: LiveEntityHelperQuestLiveSnapshot,
  baseline?: LiveEntityHelperQuestObjectiveBaseline,
  nativeBossDefeats = 0
) {
  return liveEntityHelperQuestEvidenceSinceBaseline(
    currentRawEvidence(quest, liveSnapshot, nativeBossDefeats),
    baseline
  );
}

function markQuestActiveLocally(
  quest: LiveEntityHelperQuestInstance,
  giverPosition?: readonly number[] | null,
  nativeBossDefeats = 0
) {
  const state = readLiveEntityHelperQuestState();
  if (state.completed[quest.questId]) {
    return;
  }
  if (
    quest.kind === "hard_boss" &&
    !nativeBiomesEcsAuthorityEnabled() &&
    !hasActiveHardBossQuest(state)
  ) {
    resetHarthmereCombatNpc(HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET);
  }
  // Snapshot what the player already holds toward this quest AFTER any boss
  // reset, so completion later requires NEW items / a fresh kill and the quest
  // is never instantly "done" on accept (e.g. the default Road Rations).
  const objectiveBaseline = liveEntityHelperQuestObjectiveBaseline(
    quest,
    currentRawEvidence(quest, undefined, nativeBossDefeats)
  );
  writeLiveEntityHelperQuestState({
    ...state,
    active: {
      ...state.active,
      [quest.questId]: liveEntityHelperQuestRecord(quest, {
        giverPosition,
        objectiveBaseline,
      }),
    },
  });
}

function markQuestCompletedLocally(quest: LiveEntityHelperQuestInstance) {
  const state = readLiveEntityHelperQuestState();
  const active = { ...state.active };
  delete active[quest.questId];
  writeLiveEntityHelperQuestState({
    active,
    completed: {
      ...state.completed,
      [quest.questId]: liveEntityHelperQuestRecord(quest),
    },
  });
}

async function acceptQuest(
  quest: LiveEntityHelperQuestInstance,
  context: LiveEntityHelperQuestEntityContext,
  nativeBossDefeats = 0
) {
  try {
    const snapshot = await submitLiveEntityHelperQuestMutation(
      "live_entity_helper_accept",
      quest,
      context
    );
    markQuestActiveLocally(quest, context.position, nativeBossDefeats);
    return snapshot;
  } catch (error) {
    if (isLiveEntityHelperLiveModeRejectionError(error)) {
      return undefined;
    }
    markQuestActiveLocally(quest, context.position, nativeBossDefeats);
    return undefined;
  }
}

function storedObjectiveBaseline(
  questId: string
): LiveEntityHelperQuestObjectiveBaseline | undefined {
  return readLiveEntityHelperQuestState().active[questId]?.objectiveBaseline;
}

function completeQuestLocally(quest: LiveEntityHelperQuestInstance) {
  const existingState = readLiveEntityHelperQuestState();
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
  const check = canCompleteLiveEntityHelperQuest(quest, evidence);
  if (!check.ok) {
    return false;
  }
  // HARTHMERE_REWARD_INVENTORY_FIT: refuse the turn-in if the reward items
  // would not fit, BEFORE consuming the objective items — otherwise a full
  // backpack silently drops the reward while the quest is marked complete. The
  // quest stays active and claimable once the player frees space.
  if (!harthmereInventoryCanAcceptItems(quest.rewards.items)) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("harthmere-quest-reward-blocked-full-inventory", {
          detail: { questId: quest.questId, title: quest.title },
        })
      );
    }
    return false;
  }
  const deltas = liveEntityHelperQuestDeltas(quest);
  for (const [itemId, quantity] of Object.entries(deltas.consumedItems)) {
    const consumed = consumeHarthmereItemByItemId(
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

  markQuestCompletedLocally(quest);
  return true;
}

async function completeQuest(
  quest: LiveEntityHelperQuestInstance,
  context: LiveEntityHelperQuestEntityContext,
  liveSnapshot: LiveEntityHelperQuestLiveSnapshot | undefined,
  nativeBossDefeats = 0
) {
  const evidence = completionEvidence(
    quest,
    liveSnapshot,
    storedObjectiveBaseline(quest.questId),
    nativeBossDefeats
  );
  const check = canCompleteLiveEntityHelperQuest(quest, evidence);
  if (!check.ok) {
    return { ok: false, liveSnapshot: undefined };
  }

  try {
    let latestSnapshot = liveSnapshot;
    const bossKillCredit = Math.max(hardBossDefeatCount(), nativeBossDefeats);
    if (quest.kind === "hard_boss" && bossKillCredit > 0) {
      latestSnapshot = await submitLiveEntityHelperQuestMutation(
        "live_entity_helper_record_boss_defeat",
        quest,
        context,
        {
          extraPayload: {
            bossDefeated: true,
            bossKillCredit,
            bossEntityId: String(
              HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED.entityId
            ),
          },
        }
      );
    }
    latestSnapshot = await submitLiveEntityHelperQuestMutation(
      "live_entity_helper_complete",
      quest,
      context
    );
    if (!liveEntityHelperLiveSnapshotHasRejection(latestSnapshot)) {
      markQuestCompletedLocally(quest);
      return { ok: true, liveSnapshot: latestSnapshot };
    }
  } catch (error) {
    if (isLiveEntityHelperLiveModeRejectionError(error)) {
      return { ok: false, liveSnapshot: undefined };
    }
  }

  return { ok: completeQuestLocally(quest), liveSnapshot: undefined };
}

export function contextForLiveEntityHelperQuest(input: {
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
  // current: optional explicit exclusions so callers that know the entity is
  // a muck monster, jobs board, or mount-only interaction can declare it
  // without relying on the label regex backstop.
  isMuckMonster?: unknown;
  isJobsBoard?: unknown;
  isMountOnly?: unknown;
}): LiveEntityHelperQuestEntityContext {
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
  // current: derive "mount-only" — the entity has no other talkable signal
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
    // current: any entity flagged as an authored quest giver in ECS already has a
    // quest of its own (Grove/Harthmere NPCs incl. Billy Rhodes, shop owners),
    // so it must never also offer a generic helper quest.
    hasQuestGiverComponent: Boolean(input.questGiver),
  };
}

export function useLiveEntityHelperQuestDialog(talkingToNPCId: BiomesId) {
  const { reactResources, resources, userId } = useClientContext();
  const nativeCombatState = reactResources.use("/ecs/c/trigger_state", userId);
  const nativeBossDefeats = nativeBiomesEcsAuthorityEnabled()
    ? readHarthmereNativeCombatProgression(nativeCombatState).bossKills
    : 0;
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
    LiveEntityHelperQuestLiveSnapshot | undefined
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
    window.addEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, refresh);
    window.addEventListener(LIVE_ENTITY_ROBOT_ENERGY_EVENT, refresh);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    window.addEventListener(HARTHMERE_COMBAT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, refresh);
      window.removeEventListener(LIVE_ENTITY_ROBOT_ENERGY_EVENT, refresh);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      window.removeEventListener(HARTHMERE_COMBAT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const questContext = useMemo(
    () =>
      contextForLiveEntityHelperQuest({
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
    const candidate = getLiveEntityHelperQuestForEntity(questContext);
    if (!candidate) {
      return undefined;
    }
    return liveEntityHelperQuestOfferedForEntity(
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
    readLiveEntityHelperQuestLiveModeState()
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
    syncLocalDevLiveEntityRobotEnergyFromComponent({
      position: position?.v,
      robotComponent,
      displayName: label?.text,
    });
  }, [label?.text, position?.v, robotComponent]);

  const state = useMemo(() => readLiveEntityHelperQuestState(), [refreshToken]);
  const robotEnergyDisplay = useMemo(
    () =>
      liveEntityRobotEnergyDisplayForEntity(
        position?.v,
        robotComponent,
        label?.text
      ),
    [label?.text, position?.v, robotComponent, refreshToken]
  );

  const complete = useCallback(
    (activeQuest: LiveEntityHelperQuestInstance) => {
      void completeQuest(
        activeQuest,
        questContext,
        liveQuestSnapshot,
        nativeBossDefeats
      ).then((result) => {
        if (result.liveSnapshot) {
          setLiveQuestSnapshot(result.liveSnapshot);
        }
        if (result.ok) {
          setRefreshToken((old) => old + 1);
        }
      });
    },
    [liveQuestSnapshot, nativeBossDefeats, questContext]
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
    state.active[quest.questId]?.objectiveBaseline,
    nativeBossDefeats
  );
  const completionCheck = canCompleteLiveEntityHelperQuest(quest, evidence);
  const missingText = completionCheck.missing.join(", ");
  const rewardText = liveEntityHelperQuestRewardText(quest);
  const actions: TalkDialogStepAction[] = [];

  if (!isCompleted && !isActive) {
    actions.push({
      name: quest.buttonName,
      type: "primary",
      tooltip: quest.taskHint,
      followUpText: textBlock(quest.activeText),
      onPerformed: () => {
        void acceptQuest(quest, questContext, nativeBossDefeats).then(
          (snapshot) => {
            if (snapshot) {
              setLiveQuestSnapshot(snapshot);
            }
            setRefreshToken((old) => old + 1);
          }
        );
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
      onPerformed: () => {
        if (!nativeBiomesEcsAuthorityEnabled()) {
          performHarthmereCombatAttack(
            HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET,
            "heavy"
          );
          return;
        }
        // Materialize the exact native boss; the player then fights it through
        // ordinary cursor -> UpdateNpcHealth -> Anima/ECS combat.
        void defaultHarthmereLiveFetch("/api/harthmere/native_combat_boss", {
          method: "POST",
          credentials: "same-origin",
        }).then(() => setRefreshToken((old) => old + 1));
      },
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
      harthmereInventoryCountByItemId(LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID),
      liveInventoryCount(liveQuestSnapshot, LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID)
    ) >= LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY
  ) {
    actions.push({
      name: "Recharge Robot",
      type: "primary",
      tooltip: `Use ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY} Stabilized Exotic Matter to restore the protection field. ${liveEntityRobotRechargeRewardText()}`,
      followUpText: textBlock(
        `The robot hums back to life. The shield line brightens and the Muck edge pulls back. ${liveEntityRobotRechargeRewardText()}`
      ),
      onPerformed: () => {
        void submitLiveEntityRobotRechargeMutation({
          entityId: talkingToNPCId,
          label: label?.text,
          position: position?.v,
        })
          .then((snapshot) => {
            setLiveQuestSnapshot(snapshot);
            rechargeLocalDevLiveEntityRobotForPosition(position?.v);
            setRefreshToken((old) => old + 1);
          })
          .catch((error) => {
            if (isLiveEntityHelperLiveModeRejectionError(error)) {
              return;
            }
            const consumed = consumeHarthmereItemByItemId(
              LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
              LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY,
              "Robot recharge"
            );
            if (consumed >= LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY) {
              rechargeLocalDevLiveEntityRobotForPosition(position?.v);
              grantRobotRechargeReward();
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
    id: liveEntityHelperQuestDialogKey(
      quest.questId,
      liveEntityHelperQuestDialogPhase(
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
