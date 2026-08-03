// CHAPTER_1_OBJECTIVE_TARGETS
//
// Browser/server-shared world targets for the native Chapter 1 objective
// bridge. Native challenge triggers contain exact quest/step identities, but
// their writer-facing targetLabel strings are not positions. This resolver
// ties those labels to shipped Grove landmarks, real Chapter 1 NPC spawns, and
// walkable samples inside both canonical dungeon terrain contracts.

import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1DungeonMechanicForObjective } from "@/shared/harthmere/ch1_dungeon_mechanics";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
  type Ch1DungeonTerrainDef,
  type Ch1DungeonVolume,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import {
  CH1_ANCHORS,
  CH1_FLAGS,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";
import { ch1StageDirectionFor } from "@/shared/harthmere/ch1_staging";
import {
  CH1_QUESTS,
  type Ch1QuestDef,
  type Ch1QuestStep,
  type Ch1StepTrigger,
} from "@/shared/harthmere/ch1_quests";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import type { Ch1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import {
  CH1_GROVE_SUPPLIER_ROUTE,
  CH1_TESTIMONY_ROUTE,
  CH1_THREE_ANSWER_ROUTE,
  ch1NextRouteStop,
  ch1NextSupplierRouteStop,
  ch1RouteStopPosition,
} from "@/shared/harthmere/ch1_objective_routes";
import { CH1_SERGEANT_HOLT } from "@/shared/harthmere/ch1_returning_npcs";
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
  return (
    String(value ?? "")
      .toLowerCase()
      // Possessives first. "Coretta's ledger" and "Jackie's kettle" used to
      // normalize to "coretta s ledger" / "jackie s kettle", which matched no
      // alias key and silently fell through to the district fallback.
      .replace(/['’]s\b/g, "s")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

function tokens(value: string): string[] {
  return normalized(value).split(" ").filter(Boolean);
}

/**
 * Whole-token containment.
 *
 * The previous cast match was a bare `String.includes` in both directions,
 * which made any short target label a substring of any cast name. "Tea" is
 * inside "Teague Teak Morrow", so Act 1's breakfast objective resolved to Teak
 * Morrow's spawn 137m away in the Rat Crowns drain instead of Jackie's post —
 * the second objective in the chapter. Matching on token sequences instead of
 * raw characters keeps "Dr. Lucien Ardan" ~ "Lucien Ardan" working while
 * refusing "tea" ~ "teague".
 */
function containsTokenRun(haystack: string, needle: string): boolean {
  const a = tokens(haystack);
  const b = tokens(needle);
  if (b.length === 0 || b.length > a.length) return false;
  for (let i = 0; i + b.length <= a.length; i += 1) {
    let hit = true;
    for (let j = 0; j < b.length; j += 1) {
      if (a[i + j] !== b[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

/**
 * A cast member matches a target label only on a shared whole-token run, and
 * never on a single generic token. Requiring two tokens (or one distinctive
 * surname-length token) is what stops "Tea", "Doc" or "Kit" from binding to a
 * cast display name that merely spells them.
 */
function castMatchesTarget(displayName: string, target: string): boolean {
  const name = normalized(displayName);
  const want = normalized(target);
  if (!name || !want) return false;
  if (name === want) return true;
  const wantTokens = tokens(want);
  // Single-token targets must match a whole token of the name, not a prefix.
  if (wantTokens.length === 1) {
    return tokens(name).includes(wantTokens[0]) && wantTokens[0].length >= 4;
  }
  return containsTokenRun(name, want) || containsTokenRun(want, name);
}

function vec3(value: readonly [number, number, number]): Ch1Vec3 {
  return [value[0], value[1], value[2]];
}

function ch1CastPosition(
  key: string,
  context?: Ch1ObjectiveTargetContext,
  activeQuestId?: string,
  activeStepId?: string
): Ch1Vec3 | undefined {
  const member = CH1_NEW_CAST.find((candidate) => candidate.key === key);
  if (!member) return undefined;
  if (context?.runtime) {
    const direction = ch1StageDirectionFor(member.key, {
      flags: [...new Set([...context.runtime.flags, CH1_FLAGS.started])],
      ending: context.runtime.ending,
      hallrChoice: context.runtime.hallrChoice,
      activeQuestId,
      activeStepId,
    });
    if (direction?.place.kind === "absent") {
      return undefined;
    }
    if (direction?.place.kind === "anchor") {
      return vec3(CH1_ANCHORS[direction.place.anchor]);
    }
  }
  if (member.placement) return vec3(member.placement);
  switch (member.key) {
    case "iris_fen":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 386,
        y: -20,
        z: -56,
      });
    case "marrow":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 391,
        y: -20,
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

/**
 * GROUNDED, not just un-stranded.
 *
 * `groveLandmarkWorldPosition` lifts a landmark out of the retired Y=54 datum,
 * but it lifts it onto ONE FLAT PLANE (SNAPSHOT_GROVE_LIVE_MARKER_Y = 71). That
 * is correct for the fountain plaza and wrong everywhere else, because the Grove
 * is hilly: 48 at Mosslawn, 64 at Luis's cart, 73 at Shutter Cove, 80 at the
 * broken fence. Chapter 1 objectives at those landmarks pointed 21 blocks into
 * the air (Mosslawn Song Stones, Ranger Jane's provisioning post) or 9 blocks
 * underground (the fence line).
 *
 * docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md is explicit about
 * the rule and the remedy: "do not trust authored y=0, screenshots, or one-off
 * constants", and "prefer these helpers instead of reading the generated object
 * directly". `resolveHarthmereProductionMarkerPosition` is the documented path
 * for "jobs-board markers, business markers, helper landmarks, and other shared
 * marker ids", which is exactly what a Grove landmark is. It returns the scanned
 * feet-Y, so marker height is that plus one, matching CH1_ANCHORS.
 */
function groundedLandmarkPosition(landmark: SnapshotGroveLandmark): Ch1Vec3 {
  const fallback = groveLandmarkWorldPosition(landmark);
  const resolved = resolveHarthmereProductionMarkerPosition({
    markerId: landmark.id,
    fallback,
  });
  // Unresolved ids come back as the fallback untouched; do not add a marker
  // offset to a value that never went through the scan.
  const grounded = resolved === fallback ? fallback : resolved;
  const markerY =
    resolved === fallback ? grounded[1] : grounded[1] + CH1_MARKER_OFFSET_Y;
  return [grounded[0], markerY, grounded[2]];
}

/** Grove markers sit one block above the scanned surface feet-Y. */
const CH1_MARKER_OFFSET_Y = 1;

const LANDMARKS = SNAPSHOT_GROVE_LANDMARKS.map((landmark) => ({
  label: landmark.label,
  normalized: normalized(landmark.label),
  position: groundedLandmarkPosition(landmark),
}));

/**
 * Authored label -> world anchor.
 *
 * Keys are `normalized()` output, so possessives are spelled without the
 * apostrophe ("jackies kettle", "corettas ledger", "luiss repair cart").
 * ch1_objective_targets.test.ts asserts every key here is reachable, which is
 * how the two dead keys in the previous table were found.
 */
const TARGET_ALIASES = new Map<string, Ch1Vec3>([
  // The road-house. These were all `jackie_post` (the fountain centre), which
  // is why breakfast happened in a public square with no kettle.
  ["bed", CH1_ANCHORS.roadhouse_bed],
  ["tea", CH1_ANCHORS.roadhouse_table],
  ["jackies kettle", CH1_ANCHORS.roadhouse_hearth],
  ["dented tea tin", CH1_ANCHORS.roadhouse_stores],
  ["grove road house", CH1_ANCHORS.roadhouse_door],
  ["the grove road house", CH1_ANCHORS.roadhouse_door],

  ["journal", CH1_ANCHORS.fountain_lesson_board],
  ["grove residents", CH1_ANCHORS.jackie_post],
  ["grove suppliers", CH1_ANCHORS.fountain_lesson_board],
  ["provisioning checklist", CH1_ANCHORS.ranger_jane],
  ["the fence line seam", CH1_ANCHORS.gate_fence_sighting],
  ["the old wood aperture", CH1_ANCHORS.gate_desert],
  ["greenlamp walk in clinic", CH1_ANCHORS.greenlamp_clinic],
  ["ashline containment works", CH1_ANCHORS.ashline_containment_works],
  ["containment lattice", CH1_ANCHORS.ashline_refinery_intake],
  ["corettas ledger", CH1_ANCHORS.coretta_ledger_desk],
  ["coretta", CH1_ANCHORS.coretta_ledger_desk],
  ["a letter addressed to no one", CH1_ANCHORS.grove_watch_house],
  ["grove watch house", CH1_ANCHORS.grove_watch_house],
  ["bell iron token", CH1_ANCHORS.harthmere_bridge_center],
  ["a coat button", CH1_ANCHORS.shutter_cove_photo_marker],
  ["sergeant bram holt", CH1_ANCHORS.grove_watch_house],
  ["return aperture", CH1_ANCHORS.gate_prime],
  ["the grove", CH1_ANCHORS.jackie_post],
  ["mosslawn song stones", CH1_ANCHORS.mosslawn_song_stones],
  ["temple balance beam", CH1_ANCHORS.gate_desert],
  ["—", CH1_ANCHORS.grove_watch_house],
]);

/**
 * Steps whose authored label cannot be resolved by name.
 *
 * `ch1_a6_q03_consolidation` is written with `targetLabel: "—"` because the beat
 * is "he puts a hand on your shoulder" — there is no object to name. It sits
 * between `give_her_location` and `watch_him_go`, both of which are at Lou, so
 * it belongs at Lou.
 */
const STEP_TARGET_OVERRIDES: Readonly<
  Record<string, { anchor: keyof typeof CH1_ANCHORS; castKey?: string }>
> = {
  the_examination: { anchor: "greenlamp_lou_post", castKey: "lou_ardan" },
  not_this_small: { anchor: "gate_fence_sighting", castKey: "jackie" },
  the_flinch: { anchor: "gate_desert_jackie_post", castKey: "jackie" },
  say_the_sentence: {
    anchor: "gate_desert_rook_post",
    castKey: "halden_rook",
  },
  call_the_collapse: {
    anchor: "gate_desert_rook_post",
    castKey: "halden_rook",
  },
  rooks_rope: { anchor: "gate_winter", castKey: "halden_rook" },
  hear_him_out: { anchor: "returnstone_lou_post", castKey: "lou_ardan" },
  give_the_ledger: { anchor: "returnstone_lou_post", castKey: "lou_ardan" },
  give_her_location: {
    anchor: "returnstone_lou_post",
    castKey: "lou_ardan",
  },
  the_word: { anchor: "returnstone_lou_post", castKey: "lou_ardan" },
  watch_him_go: { anchor: "returnstone_lou_post", castKey: "lou_ardan" },
  did_he_take_it: {
    anchor: "grove_watch_house_jackie_post",
    castKey: "jackie",
  },
  the_whole_plan: {
    anchor: "grove_watch_house_jackie_post",
    castKey: "jackie",
  },
  the_final_choice: {
    anchor: "grove_watch_house_jackie_post",
    castKey: "jackie",
  },
};

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

/**
 * "Complete challenge" USED TO BE A LIE SEVEN TIMES OUT OF EIGHT.
 *
 * Only `the_procedure` has a real minigame UI (Chapter1ContainmentTriage). The
 * other seven `minigame` steps are dungeon-zone crossings, and the trigger is
 * deliberately `minigame` rather than `near_location` on all of them: see the
 * authored comments in ch1_quests.ts. A proximity trigger would complete in
 * native ECS without ever charging the water/fuel/light interval or the
 * stamina and health consequence, which is exactly the bypass the survival
 * mechanic exists to prevent. The TRIGGER is load-bearing and must not change.
 *
 * The LABEL is what was wrong. Three of those crossings ask the player to pick
 * a route, and four are a committed crossing that spends supplies. Both are
 * honest things to say; "Complete challenge" promised a minigame that does not
 * exist and set the wrong expectation at both dungeons' signature moments.
 */
function minigameActionLabel(step: Ch1QuestStep): string {
  if (step.id === "the_procedure") return "Complete challenge";
  // The zone mechanic config is already the authority on which crossings make
  // the player pick a route (`requiredChoice`), so the label reads off the same
  // record that enforces it rather than a second hand-maintained list.
  const mechanic = ch1DungeonMechanicForObjective(step.id);
  if (mechanic?.requiredChoice) return "Choose route";
  if (mechanic) return "Make the crossing";
  return "Complete challenge";
}

function actionLabel(step: Ch1QuestStep): string {
  if (step.id === "the_tea") return "Drink Jackie's breakfast tea";
  if (step.id === "kit_check") return "Let Jackie check your kit";
  switch (step.trigger) {
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
      return minigameActionLabel(step);
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
  if (
    step.id === "collect_testimonies" ||
    step.id === "the_three_answers" ||
    step.id === "meet_the_suppliers"
  ) {
    return 9;
  }
  if (/residents|suppliers/i.test(step.targetLabel ?? "")) return 20;
  return 9;
}

function targetPosition(
  quest: Ch1QuestDef,
  step: Ch1QuestStep,
  stepIndex: number,
  context?: Ch1ObjectiveTargetContext
): Pick<Ch1ObjectiveTarget, "position" | "source" | "entityId"> & {
  label?: string;
} {
  const dungeon = dungeonTarget(quest, stepIndex);
  if (dungeon) return { position: dungeon, source: "dungeon" };

  if (step.id === "collect_testimonies") {
    const next =
      ch1NextRouteStop(
        CH1_TESTIMONY_ROUTE,
        context?.runtime?.testimonies ?? []
      ) ?? CH1_TESTIMONY_ROUTE[CH1_TESTIMONY_ROUTE.length - 1];
    return {
      position: ch1RouteStopPosition(next),
      source: "npc",
      label: next.label,
      entityId: next.entityId,
    };
  }
  if (step.id === "the_three_answers") {
    const effectKey = `${quest.id}/${step.id}`;
    const next =
      ch1NextRouteStop(
        CH1_THREE_ANSWER_ROUTE,
        context?.runtime?.objectiveRouteProgress[effectKey] ?? []
      ) ?? CH1_THREE_ANSWER_ROUTE[CH1_THREE_ANSWER_ROUTE.length - 1];
    return {
      position: ch1RouteStopPosition(next),
      source: "npc",
      label: next.label,
    };
  }
  if (step.id === "meet_the_suppliers") {
    const next =
      ch1NextSupplierRouteStop(context?.vendorTransactions ?? {}) ??
      CH1_GROVE_SUPPLIER_ROUTE[CH1_GROVE_SUPPLIER_ROUTE.length - 1];
    if (next) {
      return {
        position: ch1RouteStopPosition(next),
        source: "npc",
        label: next.label,
      };
    }
  }
  if (step.id === "report_or_not") {
    return {
      position: vec3(CH1_SERGEANT_HOLT.position),
      source: "npc",
      label: "Grove Watch House",
      entityId: CH1_SERGEANT_HOLT.entityId,
    };
  }

  const target = normalized(step.targetLabel);

  // Steps whose authored targetLabel is "—" (an em-dash placeholder for a beat
  // with no named object). `normalized("—")` is the empty string, so the
  // TARGET_ALIASES entry for it was unreachable and these fell through to the
  // district fallback — which put Act 6's consolidation scene at the town
  // fountain instead of with Lou, between two other objectives that are both
  // at Lou.
  const explicit = STEP_TARGET_OVERRIDES[step.id];
  if (explicit) {
    const member = explicit.castKey
      ? CH1_NEW_CAST.find((candidate) => candidate.key === explicit.castKey)
      : undefined;
    return {
      position: CH1_ANCHORS[explicit.anchor],
      source: member ? "npc" : "alias",
      ...(member ? { entityId: member.entityId } : {}),
    };
  }

  // RESOLUTION ORDER. Authored intent first, inference last.
  //
  // Cast lookup used to run before the alias table, which meant a hand-written
  // alias could never win. `["tea", jackie_post]` was present and unreachable
  // because the cast scan matched "Tea" against "Teague Teak Morrow" first.
  // Exact landmark and alias are both authored statements about where a label
  // lives, so they now precede the inferred cast/fuzzy matches.
  const exactLandmark = LANDMARKS.find(
    (landmark) => landmark.normalized === target
  );
  if (exactLandmark) {
    return { position: exactLandmark.position, source: "landmark" };
  }

  const alias = TARGET_ALIASES.get(target);
  if (alias) {
    // An alias may name a real cast member's post (Jackie, Doc). Carry the
    // entity id when it does so the prompt and marker can bind the body.
    const aliasEntity = CH1_NEW_CAST.find((member) =>
      castMatchesTarget(member.displayName, target)
    );
    return {
      position: vec3(alias),
      source: "alias",
      ...(aliasEntity ? { entityId: aliasEntity.entityId } : {}),
    };
  }

  const cast = CH1_NEW_CAST.find((member) =>
    castMatchesTarget(member.displayName, target)
  );
  if (cast) {
    const position = ch1CastPosition(cast.key, context, quest.id, step.id);
    if (position) {
      return { position, source: "npc", entityId: cast.entityId };
    }
  }

  const fuzzyLandmark = LANDMARKS.find(
    (landmark) =>
      target.length >= 4 &&
      (containsTokenRun(landmark.normalized, target) ||
        containsTokenRun(target, landmark.normalized))
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
  stepIdOrIndex: string | number,
  context?: Ch1ObjectiveTargetContext
): Ch1ObjectiveTarget | undefined {
  const quest = CH1_QUESTS.find((candidate) => candidate.id === questId);
  if (!quest) return undefined;
  const stepIndex =
    typeof stepIdOrIndex === "number"
      ? stepIdOrIndex
      : quest.steps.findIndex((step) => step.id === stepIdOrIndex);
  const step = quest.steps[stepIndex];
  if (!step) return undefined;
  const resolved = targetPosition(quest, step, stepIndex, context);
  return {
    questId: quest.id,
    stepId: step.id,
    label: resolved.label ?? step.targetLabel ?? step.title,
    position: resolved.position,
    interactionRadius: radiusFor(step, resolved.source),
    trigger: step.trigger,
    actionLabel: actionLabel(step),
    entityId: resolved.entityId,
    source: resolved.source,
  };
}

export interface Ch1ObjectiveTargetContext {
  runtime?: Ch1LiveGateRuntimeState;
  vendorTransactions?: Readonly<Record<string, number>>;
}

export function allCh1ObjectiveTargets(): Ch1ObjectiveTarget[] {
  return CH1_QUESTS.flatMap((quest) =>
    quest.steps.map((_, stepIndex) => ch1ObjectiveTarget(quest.id, stepIndex)!)
  );
}
