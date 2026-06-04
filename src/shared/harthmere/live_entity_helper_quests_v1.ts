import { isHarthmereNonLivingObjectLabelV1 } from "@/shared/harthmere/object_interaction_semantics_v1";

export const LIVE_ENTITY_HELPER_QUESTS_VERSION_V1 =
  "live-entity-helper-quests-v1" as const;

export const LIVE_ENTITY_HELPER_QUEST_STATE_KEY_V1 =
  "biomes.localDev.liveEntityHelperQuests.v1";

export const LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1 = 9014;

export type LiveEntityHelperQuestKindV1 =
  | "exotic_matter"
  | "food_water"
  | "hard_boss";

export type LiveEntityHelperQuestDifficultyV1 = "normal" | "hard" | "elite";

export interface LiveEntityHelperBoundsV1 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LiveEntityHelperMuckAreaV1 extends LiveEntityHelperBoundsV1 {
  id: string;
  label: string;
  groundY: number;
}

export interface LiveEntityHelperQuestEntityContextV1 {
  entityId: string | number;
  label?: string;
  position?: readonly number[];
  hasRobotComponent?: boolean;
  hasAppearanceComponent?: boolean;
  hasNpcMetadata?: boolean;
  hasPlayerStatus?: boolean;
  hasTalkableDialog?: boolean;
  isRobotLike?: boolean;
  iced?: boolean;
  // V148: explicit exclusions — muck monsters are quest TARGETS, not quest
  // givers; the Jobs Board has its own quest pipeline; mount-only entities
  // get a special "Sing Song" interaction and shouldn't hand out helper
  // quests unless they are also valid talk entities (handled by other
  // signals). The flags let callers be explicit; the label regex below is
  // a backstop so older call sites still get the right behavior.
  isMuckMonster?: boolean;
  isJobsBoard?: boolean;
  isMountOnly?: boolean;
}

export interface LiveEntityHelperQuestItemRequirementV1 {
  itemId: string;
  itemName: string;
  quantity: number;
  consumesOnComplete: boolean;
}

export interface LiveEntityHelperQuestRequirementsV1 {
  items?: LiveEntityHelperQuestItemRequirementV1[];
  hardBossDefeats?: number;
}

export interface LiveEntityHelperQuestRewardItemV1 {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface LiveEntityHelperQuestRewardV1 {
  baseXp: number;
  sourceLevel: number;
  difficulty: LiveEntityHelperQuestDifficultyV1;
  items: LiveEntityHelperQuestRewardItemV1[];
}

export interface LiveEntityHelperQuestDefinitionV1 {
  kind: LiveEntityHelperQuestKindV1;
  title: string;
  buttonName: string;
  offerText: string;
  activeText: string;
  readyText: string;
  completionText: string;
  taskHint: string;
  requirements: LiveEntityHelperQuestRequirementsV1;
  rewards: LiveEntityHelperQuestRewardV1;
}

export interface LiveEntityHelperQuestInstanceV1
  extends LiveEntityHelperQuestDefinitionV1 {
  questId: string;
  entityId: string;
  giverName: string;
}

export interface LiveEntityHelperQuestEvidenceV1 {
  inventory?: Record<string, number>;
  hardBossDefeats?: number;
}

export interface LiveEntityHelperQuestCompletionCheckV1 {
  ok: boolean;
  missing: string[];
}

export interface LiveEntityHelperQuestDeltasV1 {
  consumedItems: Record<string, number>;
  rewardItems: Record<string, number>;
  xp: LiveEntityHelperQuestRewardV1;
}

export interface LiveEntityHelperQuestTargetMarkerV1 {
  id: string;
  label: string;
  kind: "resource" | "danger";
  position: [number, number, number];
  groundY: number;
  questKinds: readonly LiveEntityHelperQuestKindV1[];
  areaId: string;
  areaLabel: string;
}

export interface LiveEntityHelperQuestRecordLikeV1 {
  kind: LiveEntityHelperQuestKindV1;
  at?: number;
}

export interface LiveEntityHelperQuestServerItemCopyV1 {
  itemId: string;
  displayName: string;
  description: string;
  maxStackSize: number;
  baseValue: number;
  binding: "none" | "on_pickup" | "on_equip" | "quest";
  isQuestItem: boolean;
  isConsumable: boolean;
  isCraftingMaterial: boolean;
  tradeable: boolean;
}

export const LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1: Record<
  string,
  LiveEntityHelperQuestServerItemCopyV1
> = {
  raw_exotic_matter: {
    itemId: "raw_exotic_matter",
    displayName: "Raw Exotic Matter",
    description:
      "Unstable Biome fuel drawn from Muck-adjacent anomalies. Best handled before it starts humming.",
    maxStackSize: 50,
    baseValue: 90,
    binding: "none",
    isQuestItem: false,
    isConsumable: false,
    isCraftingMaterial: true,
    tradeable: true,
  },
  stabilized_exotic_matter: {
    itemId: "stabilized_exotic_matter",
    displayName: "Stabilized Exotic Matter",
    description:
      "Contained Exotic Matter suitable for emergency robots, Biome stabilizers, and high-risk repairs.",
    maxStackSize: 50,
    baseValue: 180,
    binding: "none",
    isQuestItem: false,
    isConsumable: false,
    isCraftingMaterial: true,
    tradeable: true,
  },
  mana_crystal_shard: {
    itemId: "mana_crystal_shard",
    displayName: "Mana Crystal Shard",
    description:
      "Rare magical harvesting material used by mages and enchanters.",
    maxStackSize: 50,
    baseValue: 55,
    binding: "none",
    isQuestItem: false,
    isConsumable: false,
    isCraftingMaterial: true,
    tradeable: true,
  },
  road_ration: {
    itemId: "road_ration",
    displayName: "Road Ration",
    description:
      "Hard bread, dried fruit, and enough salt to survive a wet road.",
    maxStackSize: 50,
    baseValue: 3,
    binding: "none",
    isQuestItem: false,
    isConsumable: true,
    isCraftingMaterial: false,
    tradeable: true,
  },
  clean_water: {
    itemId: "clean_water",
    displayName: "Clean Water",
    description: "Water for alchemy, cooking, farming, and temple aid.",
    maxStackSize: 200,
    baseValue: 1,
    binding: "none",
    isQuestItem: false,
    isConsumable: false,
    isCraftingMaterial: true,
    tradeable: true,
  },
  minor_healing_salve: {
    itemId: "minor_healing_salve",
    displayName: "Minor Healing Salve",
    description:
      "Clean cloth packed with willow and mint. Usable during combat.",
    maxStackSize: 20,
    baseValue: 8,
    binding: "none",
    isQuestItem: false,
    isConsumable: true,
    isCraftingMaterial: false,
    tradeable: true,
  },
  repair_voucher: {
    itemId: "repair_voucher",
    displayName: "Black Anvil Repair Voucher",
    description: "Redeemable at the Black Anvil for trusted field repairs.",
    maxStackSize: 20,
    baseValue: 18,
    binding: "on_pickup",
    isQuestItem: false,
    isConsumable: false,
    isCraftingMaterial: false,
    tradeable: false,
  },
  muck_boss_trophy: {
    itemId: "muck_boss_trophy",
    displayName: "Muck Boss Trophy",
    description:
      "Proof that a hard Muck breach threat was fully defeated, not merely scratched.",
    maxStackSize: 20,
    baseValue: 125,
    binding: "on_pickup",
    isQuestItem: true,
    isConsumable: false,
    isCraftingMaterial: false,
    tradeable: false,
  },
};

export function liveEntityHelperQuestItemCopyForIdV1(itemId: string) {
  return LIVE_ENTITY_HELPER_QUEST_ITEM_COPY_V1[itemId];
}

export const LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS_V1: LiveEntityHelperBoundsV1 =
  {
    minX: 300,
    maxX: 650,
    minZ: -360,
    maxZ: -40,
  };

// Harthmere is authored in town coordinates and shifted east in the snapshot
// world. Use a deliberately broad exclusion so local Harthmere people do not
// receive the live-entity helper quests by accident.
export const LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS_V1: LiveEntityHelperBoundsV1 =
  {
    minX: 704,
    maxX: 1280,
    minZ: -512,
    maxZ: 192,
  };

export const LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1: LiveEntityHelperMuckAreaV1 =
  {
    id: "west_muck_breach",
    label: "West Muck Breach",
    minX: 180,
    maxX: 292,
    minZ: -560,
    maxZ: -460,
    groundY: 54,
  };

export const LIVE_ENTITY_HELPER_EXOTIC_MATTER_MARKER_ID_V1 =
  "live_helper_old_well_exotic_residue" as const;

export const LIVE_ENTITY_HELPER_FOOD_WATER_MARKER_ID_V1 =
  "live_helper_bluewater_supply_route" as const;

export const LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1 =
  "live_helper_muck_scarred_helix" as const;

export const LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1: readonly LiveEntityHelperQuestTargetMarkerV1[] =
  [
    {
      id: LIVE_ENTITY_HELPER_EXOTIC_MATTER_MARKER_ID_V1,
      label: "Old Well Residue",
      kind: "resource",
      position: [428, 53, -160],
      groundY: 53,
      questKinds: ["exotic_matter"],
      areaId: "old_well_underways",
      areaLabel: "Old Well",
    },
    {
      id: LIVE_ENTITY_HELPER_FOOD_WATER_MARKER_ID_V1,
      label: "Bluewater Supply Route",
      kind: "resource",
      position: [604, 53, -168],
      groundY: 53,
      questKinds: ["food_water"],
      areaId: "bluewater_docks",
      areaLabel: "River Docks",
    },
    {
      id: LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
      label: "Muck-Scarred Helix",
      kind: "danger",
      position: [
        232,
        LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1.groundY,
        -506,
      ],
      groundY: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1.groundY,
      questKinds: ["hard_boss"],
      areaId: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1.id,
      areaLabel: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1.label,
    },
  ];

export const LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1: Record<
  LiveEntityHelperQuestKindV1,
  LiveEntityHelperQuestDefinitionV1
> = {
  exotic_matter: {
    kind: "exotic_matter",
    title: "Exotic Matter Stabilizer",
    buttonName: "Help with Exotic Matter",
    offerText:
      "Their Biome stabilizer is flickering. They need raw Exotic Matter before the pocket edge collapses.",
    activeText:
      "Bring 2 Raw Exotic Matter. The Old Well residue yields it — but only to an Arcane Extractor, and only once you've trained the extraction skill. Get the tool first, then work the residue.",
    readyText:
      "You have enough Raw Exotic Matter to stabilize their emergency cell.",
    completionText:
      "You hand over the raw Exotic Matter. They seal it in a containment sleeve and the Biome edge steadies.",
    taskHint:
      "Get an Arcane Extractor and extraction skill, then draw 2 Raw Exotic Matter from the Old Well residue.",
    requirements: {
      items: [
        {
          itemId: "raw_exotic_matter",
          itemName: "Raw Exotic Matter",
          quantity: 2,
          consumesOnComplete: true,
        },
      ],
    },
    rewards: {
      baseXp: 120,
      sourceLevel: 8,
      difficulty: "hard",
      items: [
        {
          itemId: "stabilized_exotic_matter",
          itemName: "Stabilized Exotic Matter",
          quantity: 1,
        },
        {
          itemId: "mana_crystal_shard",
          itemName: "Mana Crystal Shard",
          quantity: 1,
        },
      ],
    },
  },
  food_water: {
    kind: "food_water",
    title: "Remote Biome Supply Drop",
    buttonName: "Help with Food and Water",
    offerText:
      "Their supply courier missed the last window. They need food and clean water before the Biome locks down.",
    activeText:
      "Bring 3 Road Rations and 2 Clean Water. The farms, fishing pools, and supply caches can cover the shortage.",
    readyText:
      "You have the food and clean water needed for the remote Biome supply drop.",
    completionText:
      "You pass over the rations and clean water. They mark your name as someone who keeps remote Biomes alive.",
    taskHint: "Turn in 3 Road Rations and 2 Clean Water.",
    requirements: {
      items: [
        {
          itemId: "road_ration",
          itemName: "Road Ration",
          quantity: 3,
          consumesOnComplete: true,
        },
        {
          itemId: "clean_water",
          itemName: "Clean Water",
          quantity: 2,
          consumesOnComplete: true,
        },
      ],
    },
    rewards: {
      baseXp: 90,
      sourceLevel: 6,
      difficulty: "normal",
      items: [
        {
          itemId: "minor_healing_salve",
          itemName: "Minor Healing Salve",
          quantity: 2,
        },
        {
          itemId: "repair_voucher",
          itemName: "Black Anvil Repair Voucher",
          quantity: 1,
        },
      ],
    },
  },
  hard_boss: {
    kind: "hard_boss",
    title: "Muck Breach Boss",
    buttonName: "Help with a Muck Boss",
    offerText:
      "A Muck breach has pushed a hard threat toward their Biome perimeter. They need proof the boss is gone.",
    activeText:
      "Defeat the Muck-Scarred Helix at the West Muck Breach. Damage alone does not count; the boss must be fully defeated.",
    readyText:
      "The Muck-Scarred Helix is defeated and your kill credit is recorded.",
    completionText:
      "You bring back proof that the Muck breach boss is down. Their emergency beacon drops from red to green.",
    taskHint: "Defeat the Muck-Scarred Helix boss.",
    requirements: {
      hardBossDefeats: 1,
    },
    rewards: {
      baseXp: 180,
      sourceLevel: 12,
      difficulty: "elite",
      items: [
        {
          itemId: "muck_boss_trophy",
          itemName: "Muck Boss Trophy",
          quantity: 1,
        },
        {
          itemId: "stabilized_exotic_matter",
          itemName: "Stabilized Exotic Matter",
          quantity: 1,
        },
        {
          itemId: "repair_voucher",
          itemName: "Black Anvil Repair Voucher",
          quantity: 2,
        },
      ],
    },
  },
};

export function liveEntityHelperQuestRewardSummaryV1(
  reward: LiveEntityHelperQuestRewardV1
) {
  const pluralizeRewardItemName = (name: string, count: number) => {
    if (count === 1 || /\b(Water|Matter)\b$/i.test(name)) return name;
    if (/y$/i.test(name)) return `${name.slice(0, -1)}ies`;
    if (/s$/i.test(name)) return name;
    return `${name}s`;
  };
  const itemText = reward.items
    .map((item) => {
      const count = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      return `${count} ${pluralizeRewardItemName(item.itemName, count)}`;
    })
    .join(", ");
  return `${reward.baseXp} XP${itemText ? `, ${itemText}` : ""}`;
}

export function liveEntityHelperQuestRewardTextV1(
  quest: Pick<LiveEntityHelperQuestDefinitionV1, "rewards">
) {
  return `Reward: ${liveEntityHelperQuestRewardSummaryV1(quest.rewards)}.`;
}

export function liveEntityHelperQuestIdV1(
  entityId: string | number,
  kind: LiveEntityHelperQuestKindV1
) {
  return `live-helper:${String(entityId)}:${kind}`;
}

export function isPositionInsideLiveEntityHelperBoundsV1(
  position: readonly number[] | undefined,
  bounds: LiveEntityHelperBoundsV1
) {
  if (!position || position.length < 3) {
    return false;
  }
  const [x, , z] = position;
  return (
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
  );
}

export function isLiveEntityHelperQuestExcludedPositionV1(
  position: readonly number[] | undefined
) {
  return (
    isPositionInsideLiveEntityHelperBoundsV1(
      position,
      LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS_V1
    ) ||
    isPositionInsideLiveEntityHelperBoundsV1(
      position,
      LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS_V1
    )
  );
}

export function isLiveEntityHelperQuestTargetMarkerGroundedV1(
  marker: LiveEntityHelperQuestTargetMarkerV1
) {
  const clearance = marker.position[1] - marker.groundY;
  return clearance >= 0 && clearance <= 0.5;
}

export function liveEntityHelperQuestTargetMarkerForKindV1(
  kind: LiveEntityHelperQuestKindV1
) {
  return LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1.find((marker) =>
    marker.questKinds.includes(kind)
  );
}

export function liveEntityHelperQuestTargetMarkerIdForKindV1(
  kind: LiveEntityHelperQuestKindV1
) {
  return liveEntityHelperQuestTargetMarkerForKindV1(kind)?.id;
}

// HARTHMERE_LIVE_ENTITY_HELPER_MARKER_TARGET_V1
// The EXACT real-world spot each quest kind points the player to while the
// objective is still incomplete — not the old per-kind "area" centroid. These
// are sourced from the real content: the Old Well exotic-matter descent, the
// West Muck Breach monster cluster center, and the Bluewater supply source. Y is
// surface-level so the map/compass pin is visible (never buried/floating); the
// in-world 3D beacon grounds precisely on top (see harthmere_entity_grounding).
export const LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS_V1: Record<
  LiveEntityHelperQuestKindV1,
  {
    position: readonly [number, number, number];
    label: string;
    areaLabel: string;
  }
> = {
  // Old Well descent entrance — HARTHMERE_EXOTIC_MATTER_CAVES_V1 old_well_descent_room.
  exotic_matter: {
    position: [400, 53, -235],
    label: "Exotic Matter — Old Well",
    areaLabel: "Old Well",
  },
  // West Muck Breach monster cluster center — HARTHMERE_LIVE_ENTITY_MUCK_MONSTER
  // _LAYOUTS_V1 west_muck_breach.center.
  hard_boss: {
    position: [236, 54, -506],
    label: "Muck-Scarred Helix",
    areaLabel: "West Muck Breach",
  },
  // Bluewater supply source (food / clean water).
  food_water: {
    position: [604, 53, -168],
    label: "Food & Water Supply",
    areaLabel: "River Docks",
  },
};

export type LiveEntityHelperQuestMarkerPhaseV1 = "target" | "return_to_giver";

export interface LiveEntityHelperResolvedQuestMarkerV1 {
  phase: LiveEntityHelperQuestMarkerPhaseV1;
  position: [number, number, number];
  label: string;
  areaLabel: string;
  kind: "resource" | "danger";
}

function isFiniteVec3LikeV1(
  v: readonly number[] | null | undefined
): v is readonly [number, number, number] {
  return (
    !!v &&
    v.length >= 3 &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

// Resolve where a quest's map marker should point RIGHT NOW:
//  - objective incomplete -> the real TARGET site (cave / monster / supply), so
//    the player heads straight to it.
//  - objective met (item collected / monster defeated, readyToTurnIn) -> back to
//    the QUEST GIVER so the player returns to hand it in.
// Falls back to the target site when readyToTurnIn but the giver position is
// unknown, so a marker is never dropped.
export function liveEntityHelperResolveQuestMarkerV1(input: {
  kind: LiveEntityHelperQuestKindV1;
  readyToTurnIn?: boolean;
  giverPosition?: readonly number[] | null;
  giverName?: string | null;
}): LiveEntityHelperResolvedQuestMarkerV1 {
  const target = LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS_V1[input.kind];
  const markerKind: "resource" | "danger" =
    input.kind === "hard_boss" ? "danger" : "resource";
  if (input.readyToTurnIn && isFiniteVec3LikeV1(input.giverPosition)) {
    const g = input.giverPosition;
    return {
      phase: "return_to_giver",
      position: [g[0], g[1], g[2]],
      label: input.giverName
        ? `Return to ${input.giverName}`
        : "Return to quest giver",
      areaLabel: target.areaLabel,
      kind: markerKind,
    };
  }
  return {
    phase: "target",
    position: [target.position[0], target.position[1], target.position[2]],
    label: target.label,
    areaLabel: target.areaLabel,
    kind: markerKind,
  };
}

// True when the player has satisfied a quest kind's objective (collected the
// required items / recorded the boss defeat) given the supplied evidence. Pure
// wrapper over canCompleteLiveEntityHelperQuestV1 so the map layer can decide
// "ready to turn in" (flip marker home) without duplicating requirement logic.
export function liveEntityHelperQuestObjectiveMetV1(
  kind: LiveEntityHelperQuestKindV1,
  evidence: LiveEntityHelperQuestEvidenceV1
): boolean {
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[kind];
  if (!definition) {
    return false;
  }
  return canCompleteLiveEntityHelperQuestV1(definition, evidence).ok;
}

export function isLiveEntityHelperPositionInMuckBreachAreaV1(
  position: readonly number[] | undefined
) {
  return isPositionInsideLiveEntityHelperBoundsV1(
    position,
    LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA_V1
  );
}

export function isLiveEntityHelperMuckBossSpawnMarkerV1(
  marker: LiveEntityHelperQuestTargetMarkerV1 | undefined
) {
  return Boolean(
    marker &&
      marker.id === LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1 &&
      marker.kind === "danger" &&
      marker.questKinds.includes("hard_boss") &&
      isLiveEntityHelperPositionInMuckBreachAreaV1(marker.position) &&
      isLiveEntityHelperQuestTargetMarkerGroundedV1(marker)
  );
}

export function liveEntityHelperActiveQuestTargetMarkerIdsV1(
  active: Record<string, LiveEntityHelperQuestRecordLikeV1>
) {
  const ids = new Set<string>();
  for (const record of Object.values(active)) {
    const markerId = liveEntityHelperQuestTargetMarkerIdForKindV1(record.kind);
    if (markerId) {
      ids.add(markerId);
    }
  }
  return ids;
}

export function liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1(
  active: Record<string, LiveEntityHelperQuestRecordLikeV1>
) {
  const activeRecords = Object.values(active).sort(
    (left, right) => (right.at ?? 0) - (left.at ?? 0)
  );
  const bossRecord = activeRecords.find(
    (record) => record.kind === "hard_boss"
  );
  const selectedRecord = bossRecord ?? activeRecords[0];
  return selectedRecord
    ? liveEntityHelperQuestTargetMarkerIdForKindV1(selectedRecord.kind)
    : undefined;
}

// V148: Muck monster label heuristic. Matches the seeded names ("Mucker",
// "Muckling", "Muck Beast", "Muck-Scarred Helix") and similar variants
// without ever matching the robot sentinels whose label simply contains
// the word "Muck" as part of an area name (e.g. "West Muck Breach
// Sentinel"). We intentionally require monster-shaped tokens, not bare
// "muck", and we exclude any label that also reads as a robot or sentinel
// so a sentinel placed in a muck area is never accidentally classified as
// a monster.
const LIVE_ENTITY_HELPER_MUCK_MONSTER_LABEL_REGEX_V148 =
  /\b(muck(?:ling|er|s)?(?:[\s-]?(monster|beast|creature|spawn|brood|swarm|horror|breacher|scarred|infested))?|mucker|muckling|muck[- ]scarred|muck[- ]monster|muck[- ]beast|muck[- ]creature)\b/i;

// V148: Jobs board label heuristic. The jobs board has its own quest
// pipeline; if a board entity is ever talkable for any reason it must not
// generate a helper quest. Match common board names and bulletin-style
// labels.
const LIVE_ENTITY_HELPER_JOBS_BOARD_LABEL_REGEX_V148 =
  /\b(jobs?\s*board|town\s*board|posting\s*board|bulletin(?:\s*board)?|notice\s*board|kiosk)\b/i;

// V148: Robot label heuristic. Used both to accept a robot as a quest
// giver and to keep the muck-monster filter from misclassifying sentinels
// whose label contains "Muck" because their area name does. Same rules as
// before — exposed as a helper so the exclusion check can call it too.
const LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX_V148 =
  /\b(robot|bot|sentinel|construct|automaton|drone|android)\b/i;

export function isLiveEntityHelperLabelMuckMonsterV148(
  label: string | undefined
) {
  if (!label) return false;
  if (LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX_V148.test(label)) {
    // A sentinel/robot label whose area name happens to include "Muck" is
    // a robot, not a monster.
    return false;
  }
  return LIVE_ENTITY_HELPER_MUCK_MONSTER_LABEL_REGEX_V148.test(label);
}

export function isLiveEntityHelperLabelJobsBoardV148(
  label: string | undefined
) {
  if (!label) return false;
  return LIVE_ENTITY_HELPER_JOBS_BOARD_LABEL_REGEX_V148.test(label);
}

export function isLiveEntityHelperQuestEligibleEntityV1(
  context: LiveEntityHelperQuestEntityContextV1
) {
  if (context.iced || !context.position || context.position.length < 3) {
    return false;
  }
  if (isLiveEntityHelperQuestExcludedPositionV1(context.position)) {
    return false;
  }
  // V148: explicit + heuristic exclusions for entity classes that the
  // talk system may accept but the helper-quest spec forbids. Muck
  // monsters must remain quest TARGETS; the Jobs Board has its own quest
  // pipeline; mount-only entities have their own "Sing Song" path.
  if (
    context.isMuckMonster ||
    isLiveEntityHelperLabelMuckMonsterV148(context.label)
  ) {
    return false;
  }
  if (
    context.isJobsBoard ||
    isLiveEntityHelperLabelJobsBoardV148(context.label)
  ) {
    return false;
  }
  if (context.isMountOnly) {
    return false;
  }
  if (isHarthmereNonLivingObjectLabelV1({ label: context.label })) {
    return false;
  }
  const isRobotLabel = LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX_V148.test(
    context.label ?? ""
  );
  const isRobot = Boolean(
    context.isRobotLike || context.hasRobotComponent || isRobotLabel
  );
  const isPerson = Boolean(
    context.hasAppearanceComponent &&
      (context.hasNpcMetadata || context.hasPlayerStatus)
  );
  const isTalkableLiveEntity = Boolean(
    context.hasTalkableDialog && context.label?.trim()
  );
  return isRobot || isPerson || isTalkableLiveEntity;
}

export function liveEntityHelperQuestKindForEntityV1(
  entityId: string | number,
  label = ""
): LiveEntityHelperQuestKindV1 {
  const source = `${String(entityId)}:${label}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const kinds: LiveEntityHelperQuestKindV1[] = [
    "exotic_matter",
    "food_water",
    "hard_boss",
  ];
  return kinds[Math.abs(hash) % kinds.length];
}

export function getLiveEntityHelperQuestForEntityV1(
  context: LiveEntityHelperQuestEntityContextV1
): LiveEntityHelperQuestInstanceV1 | undefined {
  if (!isLiveEntityHelperQuestEligibleEntityV1(context)) {
    return undefined;
  }
  const kind = liveEntityHelperQuestKindForEntityV1(
    context.entityId,
    context.label
  );
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[kind];
  return {
    ...definition,
    questId: liveEntityHelperQuestIdV1(context.entityId, kind),
    entityId: String(context.entityId),
    giverName: context.label?.trim() || "Someone beyond the Grove",
  };
}

export function missingLiveEntityHelperQuestRequirementsV1(
  quest: LiveEntityHelperQuestDefinitionV1,
  evidence: LiveEntityHelperQuestEvidenceV1
) {
  const missing: string[] = [];
  const inventory = evidence.inventory ?? {};
  for (const item of quest.requirements.items ?? []) {
    const have = Math.max(0, Math.floor(inventory[item.itemId] ?? 0));
    if (have < item.quantity) {
      missing.push(`${item.itemName} ${have}/${item.quantity}`);
    }
  }
  const neededBossDefeats = quest.requirements.hardBossDefeats ?? 0;
  if (neededBossDefeats > 0) {
    const defeats = Math.max(0, Math.floor(evidence.hardBossDefeats ?? 0));
    if (defeats < neededBossDefeats) {
      missing.push(
        `Muck-Scarred Helix defeated ${defeats}/${neededBossDefeats}`
      );
    }
  }
  return missing;
}

export function canCompleteLiveEntityHelperQuestV1(
  quest: LiveEntityHelperQuestDefinitionV1,
  evidence: LiveEntityHelperQuestEvidenceV1
): LiveEntityHelperQuestCompletionCheckV1 {
  const missing = missingLiveEntityHelperQuestRequirementsV1(quest, evidence);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function liveEntityHelperQuestDeltasV1(
  quest: LiveEntityHelperQuestDefinitionV1
): LiveEntityHelperQuestDeltasV1 {
  const consumedItems: Record<string, number> = {};
  for (const item of quest.requirements.items ?? []) {
    if (item.consumesOnComplete) {
      consumedItems[item.itemId] =
        (consumedItems[item.itemId] ?? 0) + item.quantity;
    }
  }
  const rewardItems: Record<string, number> = {};
  for (const item of quest.rewards.items) {
    rewardItems[item.itemId] = (rewardItems[item.itemId] ?? 0) + item.quantity;
  }
  return {
    consumedItems,
    rewardItems,
    xp: quest.rewards,
  };
}
