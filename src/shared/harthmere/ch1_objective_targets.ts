// CHAPTER_1_OBJECTIVE_TARGETS
//
// Browser/server-shared world targets for the native Chapter 1 objective
// bridge. Native challenge triggers contain exact quest/step identities, but
// their writer-facing targetLabel strings are not positions. This resolver
// ties those labels to shipped Grove landmarks, real Chapter 1 NPC spawns, and
// walkable samples inside both canonical dungeon terrain contracts.

import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
  type Ch1DungeonTerrainDef,
  type Ch1DungeonVolume,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import { CH1_ANCHORS, type Ch1Vec3 } from "@/shared/harthmere/ch1_ids";
import {
  CH1_QUESTS,
  type Ch1QuestDef,
  type Ch1QuestStep,
  type Ch1StepTrigger,
} from "@/shared/harthmere/ch1_quests";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";

export interface Ch1ObjectiveTarget {
  questId: string;
  stepId: string;
  label: string;
  position: Ch1Vec3;
  interactionRadius: number;
  trigger: Ch1StepTrigger;
  actionLabel: string;
  entityId?: BiomesId;
  source: "dungeon" | "npc" | "landmark" | "alias" | "district";
}

function normalized(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function vec3(value: readonly [number, number, number]): Ch1Vec3 {
  return [value[0], value[1], value[2]];
}

function ch1CastPosition(key: string): Ch1Vec3 | undefined {
  const member = CH1_NEW_CAST.find((candidate) => candidate.key === key);
  if (!member) return undefined;
  if (member.placement) return vec3(member.placement);
  switch (member.key) {
    case "iris_fen":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 344,
        y: -21,
        z: -56,
      });
    case "marrow":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 350,
        y: -21,
        z: -52,
      });
    case "nadia_sorrel":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 308,
        y: 1,
        z: -88,
      });
    case "hallr_ironmouth":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 384,
        y: 1,
        z: -88,
      });
  }
}

const LANDMARKS = SNAPSHOT_GROVE_LANDMARKS.map((landmark) => ({
  label: landmark.label,
  normalized: normalized(landmark.label),
  position: vec3(landmark.position),
}));

const TARGET_ALIASES = new Map<string, Ch1Vec3>([
  ["bed", CH1_ANCHORS.jackie_post],
  ["tea", CH1_ANCHORS.jackie_post],
  ["journal", CH1_ANCHORS.fountain_lesson_board],
  ["grove residents", CH1_ANCHORS.jackie_post],
  ["grove suppliers", CH1_ANCHORS.fountain_lesson_board],
  ["provisioning checklist", CH1_ANCHORS.ranger_jane],
  ["the fence line seam", CH1_ANCHORS.gate_fence_sighting],
  ["the old wood aperture", CH1_ANCHORS.gate_desert],
  ["greenlamp walk in clinic", CH1_ANCHORS.greenlamp_clinic],
  ["ashline containment works", CH1_ANCHORS.ashline_containment_works],
  ["containment lattice", CH1_ANCHORS.ashline_refinery_intake],
  ["jackies kettle", CH1_ANCHORS.jackie_post],
  ["dented tea tin", CH1_ANCHORS.jackie_post],
  ["corettas ledger", CH1_ANCHORS.fountain_lesson_board],
  ["a letter addressed to no one", CH1_ANCHORS.grove_watch_house],
  ["bell iron token", CH1_ANCHORS.harthmere_bridge_center],
  ["a coat button", CH1_ANCHORS.shutter_cove_photo_marker],
  ["sergeant bram holt", [2086, 54, -277]],
  ["return aperture", CH1_ANCHORS.gate_prime],
  ["the grove", CH1_ANCHORS.jackie_post],
  ["—", CH1_ANCHORS.grove_watch_house],
]);

const DISTRICT_FALLBACKS: Readonly<Record<string, Ch1Vec3>> = {
  "the grove": CH1_ANCHORS.jackie_post,
  "shutter cove": CH1_ANCHORS.shutter_cove_photo_marker,
  mosslawn: CH1_ANCHORS.mosslawn_song_stones,
  greenlamp: CH1_ANCHORS.greenlamp_clinic,
  "old wood copse": CH1_ANCHORS.gate_desert,
  "old bridge": CH1_ANCHORS.harthmere_bridge_center,
  "ashline containment works": CH1_ANCHORS.ashline_containment_works,
  "fracture gate the dry mouth": CH1_ANCHORS.gate_desert,
  "fracture gate the long winter mouth": CH1_ANCHORS.gate_winter,
};

const DUNGEON_STEP_VOLUMES: Readonly<Record<string, readonly string[]>> = {
  ch1_a3_d1_the_sand_that_remembers: [
    "dune_threshold",
    "salt_market",
    "cistern_stair_head",
    "hall_of_weights",
    "sun_court",
    "seed_vault",
    "seed_vault",
    "the_long_flat",
  ],
  ch1_a5_d2_the_long_winter_mouth: [
    "ice_shelf_landing",
    "drowned_longhouse",
    "hanged_wood",
    "whale_road",
    "sorrels_camp",
    "sorrels_camp",
    "ash_hall",
    "ash_hall",
    "breaking_year_return",
  ],
};

function dungeonForQuest(questId: string): Ch1DungeonTerrainDef | undefined {
  if (questId === "ch1_a3_d1_the_sand_that_remembers") {
    return CH1_DUNGEON_TERRAIN.find(
      (candidate) => candidate.dungeonId === "ch1_dungeon_desert"
    );
  }
  if (questId === "ch1_a5_d2_the_long_winter_mouth") {
    return CH1_DUNGEON_TERRAIN.find(
      (candidate) => candidate.dungeonId === "ch1_dungeon_winter"
    );
  }
}

function standableDungeonPosition(
  terrain: Ch1DungeonTerrainDef,
  volume: Ch1DungeonVolume
): Ch1Vec3 {
  const centerX = Math.floor((volume.x0 + volume.x1) / 2);
  const centerZ = Math.floor((volume.z0 + volume.z1) / 2);
  const maxRadius = Math.max(volume.x1 - volume.x0, volume.z1 - volume.z0);
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (const dz of radius === 0 ? [0] : [-radius, radius]) {
        const x = centerX + dx;
        const z = centerZ + dz;
        if (
          x < volume.x0 ||
          x >= volume.x1 ||
          z < volume.z0 ||
          z >= volume.z1
        ) {
          continue;
        }
        for (let y = volume.y1 - 1; y > volume.y0; y -= 1) {
          if (
            ch1DungeonBlockAt(terrain.dungeonId, x, y - 1, z) !== undefined &&
            ch1DungeonBlockAt(terrain.dungeonId, x, y, z) === undefined &&
            ch1DungeonBlockAt(terrain.dungeonId, x, y + 1, z) === undefined
          ) {
            const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
              x,
              y,
              z,
            });
            return [world[0] + 0.5, world[1], world[2] + 0.5];
          }
        }
      }
    }
  }
  const fallback = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
    x: centerX,
    y: volume.y0 + 1,
    z: centerZ,
  });
  return [fallback[0] + 0.5, fallback[1], fallback[2] + 0.5];
}

function dungeonTarget(
  quest: Ch1QuestDef,
  stepIndex: number
): Ch1Vec3 | undefined {
  const volumeName = DUNGEON_STEP_VOLUMES[quest.id]?.[stepIndex];
  const terrain = dungeonForQuest(quest.id);
  const volume = terrain?.volumes.find(
    (candidate) => candidate.name === volumeName
  );
  return terrain && volume
    ? standableDungeonPosition(terrain, volume)
    : undefined;
}

function actionLabel(trigger: Ch1StepTrigger): string {
  switch (trigger) {
    case "talk_npc":
      return "Talk";
    case "near_location":
      return "Arrive";
    case "destroy":
    case "defeat":
      return "Finish encounter";
    case "collect":
      return "Collect";
    case "place":
      return "Place";
    case "use_item":
      return "Use item";
    case "escort":
      return "Finish escort";
    case "minigame":
      return "Complete challenge";
    case "dialogue_choice":
      return "Choose response";
    case "sleep":
      return "Sleep";
    case "give_item":
      return "Hand over item";
    case "interact":
      return "Interact";
  }
}

function radiusFor(
  step: Ch1QuestStep,
  source: Ch1ObjectiveTarget["source"]
): number {
  if (source === "dungeon") return 24;
  if (step.trigger === "near_location" || step.trigger === "escort") return 18;
  if (/residents|suppliers/i.test(step.targetLabel ?? "")) return 20;
  return 9;
}

function targetPosition(
  quest: Ch1QuestDef,
  step: Ch1QuestStep,
  stepIndex: number
): Pick<Ch1ObjectiveTarget, "position" | "source" | "entityId"> {
  const dungeon = dungeonTarget(quest, stepIndex);
  if (dungeon) return { position: dungeon, source: "dungeon" };

  const target = normalized(step.targetLabel);
  const cast = CH1_NEW_CAST.find((member) => {
    const name = normalized(member.displayName);
    return target === name || target.includes(name) || name.includes(target);
  });
  if (cast) {
    const position = ch1CastPosition(cast.key);
    if (position) {
      return { position, source: "npc", entityId: cast.entityId };
    }
  }

  const exactLandmark = LANDMARKS.find(
    (landmark) => landmark.normalized === target
  );
  if (exactLandmark) {
    return { position: exactLandmark.position, source: "landmark" };
  }
  const alias = TARGET_ALIASES.get(target);
  if (alias) return { position: vec3(alias), source: "alias" };

  const fuzzyLandmark = LANDMARKS.find(
    (landmark) =>
      target.length >= 4 &&
      (landmark.normalized.includes(target) ||
        target.includes(landmark.normalized))
  );
  if (fuzzyLandmark) {
    return { position: fuzzyLandmark.position, source: "landmark" };
  }

  return {
    position: vec3(
      DISTRICT_FALLBACKS[normalized(quest.district)] ?? CH1_ANCHORS.jackie_post
    ),
    source: "district",
  };
}

export function ch1ObjectiveTarget(
  questId: string,
  stepIdOrIndex: string | number
): Ch1ObjectiveTarget | undefined {
  const quest = CH1_QUESTS.find((candidate) => candidate.id === questId);
  if (!quest) return undefined;
  const stepIndex =
    typeof stepIdOrIndex === "number"
      ? stepIdOrIndex
      : quest.steps.findIndex((step) => step.id === stepIdOrIndex);
  const step = quest.steps[stepIndex];
  if (!step) return undefined;
  const resolved = targetPosition(quest, step, stepIndex);
  return {
    questId: quest.id,
    stepId: step.id,
    label: step.targetLabel || step.title,
    position: resolved.position,
    interactionRadius: radiusFor(step, resolved.source),
    trigger: step.trigger,
    actionLabel: actionLabel(step.trigger),
    entityId: resolved.entityId,
    source: resolved.source,
  };
}

export function allCh1ObjectiveTargets(): Ch1ObjectiveTarget[] {
  return CH1_QUESTS.flatMap((quest) =>
    quest.steps.map((_, stepIndex) => ch1ObjectiveTarget(quest.id, stepIndex)!)
  );
}
