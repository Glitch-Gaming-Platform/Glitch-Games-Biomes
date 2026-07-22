import { isHarthmereNonLivingObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import {
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "@/shared/harthmere/world_extension";

export const LIVE_ENTITY_HELPER_QUESTS_VERSION =
  "live-entity-helper-quests" as const;

export const LIVE_ENTITY_HELPER_QUEST_STATE_KEY =
  "biomes.localDev.liveEntityHelperQuests";

export const LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET = 9014;

export type LiveEntityHelperQuestKind =
  | "exotic_matter"
  | "food_water"
  | "hard_boss";

export type LiveEntityHelperQuestDifficulty = "normal" | "hard" | "elite";

export interface LiveEntityHelperBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LiveEntityHelperMuckArea extends LiveEntityHelperBounds {
  id: string;
  label: string;
  groundY: number;
}

export interface LiveEntityHelperQuestEntityContext {
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
  // current: explicit exclusions — muck monsters are quest TARGETS, not quest
  // givers; the Jobs Board has its own quest pipeline; mount-only entities
  // get a special "Sing Song" interaction and shouldn't hand out helper
  // quests unless they are also valid talk entities (handled by other
  // signals). The flags let callers be explicit; the label regex below is
  // a backstop so older call sites still get the right behavior.
  isMuckMonster?: boolean;
  isJobsBoard?: boolean;
  isMountOnly?: boolean;
  // current: the entity already owns authored quest content. Every seeded Grove /
  // Harthmere quest NPC and business owner carries an ECS `quest_giver`
  // component (Jackie, Billy Rhodes, the town givers, shop owners, ...). A
  // living entity that already has a quest must NOT also hand out a generic
  // "outside the Grove" helper quest — the helper quests are for the anonymous
  // wilds living entities that have no quest of their own.
  hasQuestGiverComponent?: boolean;
}

export interface LiveEntityHelperQuestItemRequirement {
  itemId: string;
  itemName: string;
  quantity: number;
  consumesOnComplete: boolean;
}

export interface LiveEntityHelperQuestRequirements {
  items?: LiveEntityHelperQuestItemRequirement[];
  hardBossDefeats?: number;
}

export interface LiveEntityHelperQuestRewardItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface LiveEntityHelperQuestReward {
  baseXp: number;
  sourceLevel: number;
  difficulty: LiveEntityHelperQuestDifficulty;
  items: LiveEntityHelperQuestRewardItem[];
}

export interface LiveEntityHelperQuestDefinition {
  kind: LiveEntityHelperQuestKind;
  title: string;
  buttonName: string;
  offerText: string;
  activeText: string;
  readyText: string;
  completionText: string;
  taskHint: string;
  requirements: LiveEntityHelperQuestRequirements;
  rewards: LiveEntityHelperQuestReward;
}

export interface LiveEntityHelperQuestInstance
  extends LiveEntityHelperQuestDefinition {
  questId: string;
  entityId: string;
  giverName: string;
}

export interface LiveEntityHelperQuestEvidence {
  inventory?: Record<string, number>;
  hardBossDefeats?: number;
}

export interface LiveEntityHelperQuestCompletionCheck {
  ok: boolean;
  missing: string[];
}

export interface LiveEntityHelperQuestDeltas {
  consumedItems: Record<string, number>;
  rewardItems: Record<string, number>;
  xp: LiveEntityHelperQuestReward;
}

export interface LiveEntityHelperQuestTargetMarker {
  id: string;
  label: string;
  kind: "resource" | "danger";
  position: [number, number, number];
  groundY: number;
  questKinds: readonly LiveEntityHelperQuestKind[];
  areaId: string;
  areaLabel: string;
}

export interface LiveEntityHelperQuestRecordLike {
  kind: LiveEntityHelperQuestKind;
  at?: number;
}

export interface LiveEntityHelperQuestServerItemCopy {
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

export const LIVE_ENTITY_HELPER_QUEST_ITEM_COPY: Record<
  string,
  LiveEntityHelperQuestServerItemCopy
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

export function liveEntityHelperQuestItemCopyForId(itemId: string) {
  return LIVE_ENTITY_HELPER_QUEST_ITEM_COPY[itemId];
}

export const LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS: LiveEntityHelperBounds =
  {
    minX: 300,
    maxX: 650,
    minZ: -360,
    maxZ: -40,
  };

// Harthmere is authored in town coordinates and shifted east in the snapshot
// world. Exclude the built district envelope, rather than the complete authored
// wilderness, so the surrounding Muck clearings remain valid combat/helper
// territory after the town moves into the additive extension.
export const LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS: LiveEntityHelperBounds =
  {
    // ADDITIVE_HARTHMERE_LIVE_HELPERS:
    // The bible's actual built districts occupy authored X=380..660 and
    // Z=-380..-100. Apply the same +1600 transform as terrain/NPCs while
    // intentionally leaving West Breach, Watchtower, Old Wood, and Gravewood
    // outside the settlement exclusion.
    minX: 1980,
    maxX: 2260,
    minZ: -380,
    maxZ: -100,
  };

export const LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA: LiveEntityHelperMuckArea =
  {
    id: "west_muck_breach",
    label: "West Muck Breach",
    minX: HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
    maxX: 1892,
    minZ: Math.max(-560, HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ),
    maxZ: -460,
    groundY: HARTHMERE_EXTENSION_FEET_Y,
  };

export const LIVE_ENTITY_HELPER_EXOTIC_MATTER_MARKER_ID =
  "live_helper_old_well_exotic_residue" as const;

export const LIVE_ENTITY_HELPER_FOOD_WATER_MARKER_ID =
  "live_helper_bluewater_supply_route" as const;

export const LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID =
  "live_helper_muck_scarred_helix" as const;

export const LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS: readonly LiveEntityHelperQuestTargetMarker[] =
  [
    {
      id: LIVE_ENTITY_HELPER_EXOTIC_MATTER_MARKER_ID,
      label: "Old Well Residue",
      kind: "resource",
      position: shiftHarthmereAuthoredPositionToWorld([
        428,
        HARTHMERE_EXTENSION_FEET_Y,
        -160,
      ]),
      groundY: HARTHMERE_EXTENSION_FEET_Y,
      questKinds: ["exotic_matter"],
      areaId: "old_well_underways",
      areaLabel: "Old Well",
    },
    {
      id: LIVE_ENTITY_HELPER_FOOD_WATER_MARKER_ID,
      label: "Bluewater Supply Route",
      kind: "resource",
      position: shiftHarthmereAuthoredPositionToWorld([
        604,
        HARTHMERE_EXTENSION_FEET_Y,
        -168,
      ]),
      groundY: HARTHMERE_EXTENSION_FEET_Y,
      questKinds: ["food_water"],
      areaId: "bluewater_docks",
      areaLabel: "River Docks",
    },
    {
      id: LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
      label: "Muck-Scarred Helix",
      kind: "danger",
      position: [
        LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.minX + 52,
        LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.groundY,
        -506,
      ],
      groundY: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.groundY,
      questKinds: ["hard_boss"],
      areaId: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.id,
      areaLabel: LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA.label,
    },
  ];

export const LIVE_ENTITY_HELPER_QUEST_DEFINITIONS: Record<
  LiveEntityHelperQuestKind,
  LiveEntityHelperQuestDefinition
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

export function liveEntityHelperQuestRewardSummary(
  reward: LiveEntityHelperQuestReward
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

export function liveEntityHelperQuestRewardText(
  quest: Pick<LiveEntityHelperQuestDefinition, "rewards">
) {
  return `Reward: ${liveEntityHelperQuestRewardSummary(quest.rewards)}.`;
}

export function liveEntityHelperQuestId(
  entityId: string | number,
  kind: LiveEntityHelperQuestKind
) {
  return `live-helper:${String(entityId)}:${kind}`;
}

export function isPositionInsideLiveEntityHelperBounds(
  position: readonly number[] | undefined,
  bounds: LiveEntityHelperBounds
) {
  if (!position || position.length < 3) {
    return false;
  }
  const [x, , z] = position;
  return (
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
  );
}

export function isLiveEntityHelperQuestExcludedPosition(
  position: readonly number[] | undefined
) {
  return (
    isPositionInsideLiveEntityHelperBounds(
      position,
      LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS
    ) ||
    isPositionInsideLiveEntityHelperBounds(
      position,
      LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS
    )
  );
}

export function isLiveEntityHelperQuestTargetMarkerGrounded(
  marker: LiveEntityHelperQuestTargetMarker
) {
  const clearance = marker.position[1] - marker.groundY;
  return clearance >= 0 && clearance <= 0.5;
}

export function liveEntityHelperQuestTargetMarkerForKind(
  kind: LiveEntityHelperQuestKind
) {
  return LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.find((marker) =>
    marker.questKinds.includes(kind)
  );
}

export function liveEntityHelperQuestTargetMarkerIdForKind(
  kind: LiveEntityHelperQuestKind
) {
  return liveEntityHelperQuestTargetMarkerForKind(kind)?.id;
}

// HARTHMERE_LIVE_ENTITY_HELPER_MARKER_TARGET
// The EXACT real-world spot each quest kind points the player to while the
// objective is still incomplete — not the old per-kind "area" centroid. These
// are sourced from the real content: the Old Well exotic-matter descent, the
// West Muck Breach monster cluster center, and the Bluewater supply source. Y is
// surface-level so the map/compass pin is visible (never buried/floating); the
// in-world 3D beacon grounds precisely on top (see harthmere_entity_grounding).
export const LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS: Record<
  LiveEntityHelperQuestKind,
  {
    position: readonly [number, number, number];
    label: string;
    areaLabel: string;
  }
> = {
  // Old Well descent entrance — HARTHMERE_EXOTIC_MATTER_CAVES old_well_descent_room.
  exotic_matter: {
    position: [400, 53, -235],
    label: "Exotic Matter — Old Well",
    areaLabel: "Old Well",
  },
  // West Muck Breach monster cluster center — HARTHMERE_LIVE_ENTITY_MUCK_MONSTER
  // _LAYOUTS west_muck_breach.center.
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

export type LiveEntityHelperQuestMarkerPhase = "target" | "return_to_giver";

export interface LiveEntityHelperResolvedQuestMarker {
  phase: LiveEntityHelperQuestMarkerPhase;
  position: [number, number, number];
  label: string;
  areaLabel: string;
  kind: "resource" | "danger";
}

function isFiniteVec3Like(
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
export function liveEntityHelperResolveQuestMarker(input: {
  kind: LiveEntityHelperQuestKind;
  readyToTurnIn?: boolean;
  giverPosition?: readonly number[] | null;
  giverName?: string | null;
}): LiveEntityHelperResolvedQuestMarker {
  const target = LIVE_ENTITY_HELPER_QUEST_ACTIVE_TARGETS[input.kind];
  const markerKind: "resource" | "danger" =
    input.kind === "hard_boss" ? "danger" : "resource";
  if (input.readyToTurnIn && isFiniteVec3Like(input.giverPosition)) {
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
// wrapper over canCompleteLiveEntityHelperQuest so the map layer can decide
// "ready to turn in" (flip marker home) without duplicating requirement logic.
export function liveEntityHelperQuestObjectiveMet(
  kind: LiveEntityHelperQuestKind,
  evidence: LiveEntityHelperQuestEvidence
): boolean {
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[kind];
  if (!definition) {
    return false;
  }
  return canCompleteLiveEntityHelperQuest(definition, evidence).ok;
}

// HARTHMERE_LIVE_ENTITY_HELPER_OBJECTIVE_BASELINE
// A snapshot of what the player ALREADY had toward a quest's requirements at the
// instant they accepted it: how many of each required item sat in their bags and
// how many boss defeats were already on the books. Completion is measured as
// progress made AFTER accepting (current - baseline), so a quest can never be
// "already done" the moment it is accepted just because the player happened to
// carry the items (e.g. the default Road Rations) or had previously killed the
// boss. This is what turns these into real "go fetch it / go kill it" quests.
export interface LiveEntityHelperQuestObjectiveBaseline {
  inventory: Record<string, number>;
  hardBossDefeats: number;
}

// Capture the accept-time baseline for a quest from the player's current state.
// Only the items the quest actually requires are recorded.
export function liveEntityHelperQuestObjectiveBaseline(
  quest: Pick<LiveEntityHelperQuestDefinition, "requirements">,
  current: LiveEntityHelperQuestEvidence
): LiveEntityHelperQuestObjectiveBaseline {
  const inventory: Record<string, number> = {};
  const currentInventory = current.inventory ?? {};
  for (const item of quest.requirements.items ?? []) {
    inventory[item.itemId] = Math.max(
      0,
      Math.floor(currentInventory[item.itemId] ?? 0)
    );
  }
  return {
    inventory,
    hardBossDefeats: Math.max(0, Math.floor(current.hardBossDefeats ?? 0)),
  };
}

// Subtract an accept-time baseline from the player's current evidence so only
// items collected / boss kills earned AFTER accepting count toward completion.
// A missing baseline (older record) means "count everything", preserving the
// previous behavior for in-flight quests.
export function liveEntityHelperQuestEvidenceSinceBaseline(
  current: LiveEntityHelperQuestEvidence,
  baseline: LiveEntityHelperQuestObjectiveBaseline | undefined
): LiveEntityHelperQuestEvidence {
  if (!baseline) {
    return current;
  }
  const currentInventory = current.inventory ?? {};
  const inventory: Record<string, number> = {};
  const itemIds = new Set([
    ...Object.keys(currentInventory),
    ...Object.keys(baseline.inventory ?? {}),
  ]);
  for (const itemId of itemIds) {
    const have = Math.max(0, Math.floor(currentInventory[itemId] ?? 0));
    const had = Math.max(0, Math.floor(baseline.inventory?.[itemId] ?? 0));
    inventory[itemId] = Math.max(0, have - had);
  }
  const defeats = Math.max(0, Math.floor(current.hardBossDefeats ?? 0));
  const baseDefeats = Math.max(0, Math.floor(baseline.hardBossDefeats ?? 0));
  return {
    inventory,
    hardBossDefeats: Math.max(0, defeats - baseDefeats),
  };
}

export function isLiveEntityHelperPositionInMuckBreachArea(
  position: readonly number[] | undefined
) {
  return isPositionInsideLiveEntityHelperBounds(
    position,
    LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA
  );
}

export function isLiveEntityHelperMuckBossSpawnMarker(
  marker: LiveEntityHelperQuestTargetMarker | undefined
) {
  return Boolean(
    marker &&
      marker.id === LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID &&
      marker.kind === "danger" &&
      marker.questKinds.includes("hard_boss") &&
      isLiveEntityHelperPositionInMuckBreachArea(marker.position) &&
      isLiveEntityHelperQuestTargetMarkerGrounded(marker)
  );
}

export function liveEntityHelperActiveQuestTargetMarkerIds(
  active: Record<string, LiveEntityHelperQuestRecordLike>
) {
  const ids = new Set<string>();
  for (const record of Object.values(active)) {
    const markerId = liveEntityHelperQuestTargetMarkerIdForKind(record.kind);
    if (markerId) {
      ids.add(markerId);
    }
  }
  return ids;
}

export function liveEntityHelperPrimaryActiveQuestTargetMarkerId(
  active: Record<string, LiveEntityHelperQuestRecordLike>
) {
  const activeRecords = Object.values(active).sort(
    (left, right) => (right.at ?? 0) - (left.at ?? 0)
  );
  const bossRecord = activeRecords.find(
    (record) => record.kind === "hard_boss"
  );
  const selectedRecord = bossRecord ?? activeRecords[0];
  return selectedRecord
    ? liveEntityHelperQuestTargetMarkerIdForKind(selectedRecord.kind)
    : undefined;
}

// current: Muck monster label heuristic. Matches the seeded names ("Mucker",
// "Muckling", "Muck Beast", "Muck-Scarred Helix") and similar variants
// without ever matching the robot sentinels whose label simply contains
// the word "Muck" as part of an area name (e.g. "West Muck Breach
// Sentinel"). We intentionally require monster-shaped tokens, not bare
// "muck", and we exclude any label that also reads as a robot or sentinel
// so a sentinel placed in a muck area is never accidentally classified as
// a monster.
const LIVE_ENTITY_HELPER_MUCK_MONSTER_LABEL_REGEX =
  /\b(muck(?:ling|er|s)?(?:[\s-]?(monster|beast|creature|spawn|brood|swarm|horror|breacher|scarred|infested))?|mucker|muckling|muck[- ]scarred|muck[- ]monster|muck[- ]beast|muck[- ]creature)\b/i;

// current: Jobs board label heuristic. The jobs board has its own quest
// pipeline; if a board entity is ever talkable for any reason it must not
// generate a helper quest. Match common board names and bulletin-style
// labels.
const LIVE_ENTITY_HELPER_JOBS_BOARD_LABEL_REGEX =
  /\b(jobs?\s*board|town\s*board|posting\s*board|bulletin(?:\s*board)?|notice\s*board|kiosk)\b/i;

// current: Robot label heuristic. Used both to accept a robot as a quest
// giver and to keep the muck-monster filter from misclassifying sentinels
// whose label contains "Muck" because their area name does. Same rules as
// before — exposed as a helper so the exclusion check can call it too.
const LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX =
  /\b(robots?|bots?|sentinels?|sententials?|sentientals?|constructs?|automatons?|drones?|androids?)\b/i;

export function isLiveEntityHelperLabelMuckMonster(label: string | undefined) {
  if (!label) return false;
  if (LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX.test(label)) {
    // A sentinel/robot label whose area name happens to include "Muck" is
    // a robot, not a monster.
    return false;
  }
  return LIVE_ENTITY_HELPER_MUCK_MONSTER_LABEL_REGEX.test(label);
}

export function isLiveEntityHelperLabelJobsBoard(label: string | undefined) {
  if (!label) return false;
  return LIVE_ENTITY_HELPER_JOBS_BOARD_LABEL_REGEX.test(label);
}

export function isLiveEntityHelperQuestEligibleEntity(
  context: LiveEntityHelperQuestEntityContext
) {
  if (context.iced || !context.position || context.position.length < 3) {
    return false;
  }
  if (isLiveEntityHelperQuestExcludedPosition(context.position)) {
    return false;
  }
  // current: an entity that already owns authored quest content (an ECS
  // `quest_giver` component) never hands out a helper quest. This is the robust,
  // identity-based rule the geographic Grove/Harthmere bounds only approximated:
  // Billy Rhodes and every other seeded quest NPC / shop owner carry the
  // component regardless of where they wander, so they stay out of the helper
  // pipeline even if they step outside the exclusion box.
  if (context.hasQuestGiverComponent) {
    return false;
  }
  // current: explicit + heuristic exclusions for entity classes that the
  // talk system may accept but the helper-quest spec forbids. Muck
  // monsters must remain quest TARGETS; the Jobs Board has its own quest
  // pipeline; mount-only entities have their own "Sing Song" path.
  if (
    context.isMuckMonster ||
    isLiveEntityHelperLabelMuckMonster(context.label)
  ) {
    return false;
  }
  if (context.isJobsBoard || isLiveEntityHelperLabelJobsBoard(context.label)) {
    return false;
  }
  if (context.isMountOnly) {
    return false;
  }
  if (isHarthmereNonLivingObjectLabel({ label: context.label })) {
    return false;
  }
  const isRobotLabel = LIVE_ENTITY_HELPER_ROBOT_LABEL_REGEX.test(
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

export function liveEntityHelperQuestKindForEntity(
  entityId: string | number,
  label = ""
): LiveEntityHelperQuestKind {
  const source = `${String(entityId)}:${label}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const kinds: LiveEntityHelperQuestKind[] = [
    "exotic_matter",
    "food_water",
    "hard_boss",
  ];
  return kinds[Math.abs(hash) % kinds.length];
}

// Roughly 70% of otherwise-eligible live entities actually hand out a helper
// quest; the rest are just regular talkable NPCs. The decision is a stable hash
// of the entity (NOT random), so the same NPC always behaves the same way across
// reloads — a given person either has a quest or they don't, they never flicker.
export const LIVE_ENTITY_HELPER_QUEST_OFFER_RATE_PERCENT = 70;

export function liveEntityHelperQuestOfferedForEntity(
  entityId: string | number,
  label = ""
): boolean {
  const source = `offer:${String(entityId)}:${label}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100 < LIVE_ENTITY_HELPER_QUEST_OFFER_RATE_PERCENT;
}

export function getLiveEntityHelperQuestForEntity(
  context: LiveEntityHelperQuestEntityContext
): LiveEntityHelperQuestInstance | undefined {
  if (!isLiveEntityHelperQuestEligibleEntity(context)) {
    return undefined;
  }
  const kind = liveEntityHelperQuestKindForEntity(
    context.entityId,
    context.label
  );
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[kind];
  return {
    ...definition,
    questId: liveEntityHelperQuestId(context.entityId, kind),
    entityId: String(context.entityId),
    giverName: context.label?.trim() || "Someone beyond the Grove",
  };
}

export function missingLiveEntityHelperQuestRequirements(
  quest: LiveEntityHelperQuestDefinition,
  evidence: LiveEntityHelperQuestEvidence
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

export function canCompleteLiveEntityHelperQuest(
  quest: LiveEntityHelperQuestDefinition,
  evidence: LiveEntityHelperQuestEvidence
): LiveEntityHelperQuestCompletionCheck {
  const missing = missingLiveEntityHelperQuestRequirements(quest, evidence);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function liveEntityHelperQuestDeltas(
  quest: LiveEntityHelperQuestDefinition
): LiveEntityHelperQuestDeltas {
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
