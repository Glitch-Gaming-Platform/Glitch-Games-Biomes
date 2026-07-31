// HARTHMERE_TOWN_MAP_MARKERS
//
// WHY THIS FILE EXISTS
// The additive town of Harthmere (the +1600 east extension, see
// world_extension.ts) had no presence in the player-facing map feed. The Grove
// showed up because `SNAPSHOT_GROVE_LANDMARKS` is published on
// `window.__snapshotGrove`, and the 19 production business outposts showed up
// because `harthmereBusinessMapMarkers` injects them — but the town's people,
// its 57 authored buildings, and its bible districts were only ever data
// consumed by the renderer and the server shim. The result: a player standing
// in Market Square saw an empty map, could not find an NPC, and could not set
// any town location as an active destination pin.
//
// This module is the single derivation of "everything in the additive town that
// deserves a map pin", built from the SAME authored tables the world is
// generated from, so a pin can never drift from what is actually rendered:
//   - people      -> HARTHMERE_ALL_NPCS (npc_compendium.ts) `spawn`
//   - buildings   -> HARTHMERE_BUILDINGS (harthmere_town_buildings.ts) footprint
//   - locations   -> HARTHMERE_BIBLE_DISTRICTS anchors + authored landmarks
//
// COORDINATES
// Every authored table above is in authored/local town space. The runtime moves
// the whole town east as one unit, so this module converts once, at the
// boundary, with `shiftHarthmereAuthoredPositionToWorld` — exactly what
// harthmereMapTerrainRegions.ts already does for the terrain overlay drawn
// underneath these pins.

import {
  HARTHMERE_BIBLE_DISTRICTS,
  HARTHMERE_LAYOUT_FEET_Y,
  HARTHMERE_LAYOUT_MARKER_Y,
} from "@/shared/harthmere/harthmere_district_bible_layout";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import { HARTHMERE_ALL_NPCS } from "@/shared/harthmere/npc_compendium";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_TOWN_MAP_MARKERS_VERSION =
  "harthmere-additive-town-map-markers-v1" as const;

/**
 * Marker `source` tag. Consumers (the BiomesUI map adapter) use this to keep
 * these ids verbatim instead of running them through the Grove tutorial
 * `normalizeMarkerId` alias table, which would collapse distinct town people
 * onto shared Grove ids and break "set as active destination".
 */
export const HARTHMERE_TOWN_MARKER_SOURCE = "harthmere_additive_town" as const;

export type HarthmereTownMarkerKind =
  /** A living, talkable townsperson. */
  | "person"
  /** A hostile actor family that lives at a fixed anchor (muckers, bandits). */
  | "hostile"
  /** Ambient wildlife anchor. */
  | "animal"
  /** An authored structure from the town building table. */
  | "building"
  /** A district compass point ("Market Square"). */
  | "district"
  /** A named wayfinding landmark inside a district (gate stone, well, docks). */
  | "landmark";

export interface HarthmereTownMapMarker {
  /** Stable, globally unique marker id. Never renumbered. */
  id: string;
  label: string;
  kind: HarthmereTownMarkerKind;
  /** WORLD position (authored position already shifted east). */
  position: Vec3;
  /** Authored position, kept for debugging/regeneration. */
  authoredPosition: Vec3;
  district: string;
  description: string;
  source: typeof HARTHMERE_TOWN_MARKER_SOURCE;
  /** Present for `person`/`hostile`/`animal` markers. */
  npcId?: string;
  /** Present for `building` markers. */
  buildingName?: string;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function townMarker(input: {
  id: string;
  label: string;
  kind: HarthmereTownMarkerKind;
  authoredPosition: Vec3;
  district: string;
  description: string;
  npcId?: string;
  buildingName?: string;
}): HarthmereTownMapMarker {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    position: shiftHarthmereAuthoredPositionToWorld(input.authoredPosition),
    authoredPosition: [...input.authoredPosition] as Vec3,
    district: input.district,
    description: input.description,
    source: HARTHMERE_TOWN_MARKER_SOURCE,
    npcId: input.npcId,
    buildingName: input.buildingName,
  };
}

// NPC compendium rows are wide, hand-authored JSON-ish objects; only these
// fields matter here and they are read defensively so a future column rename
// degrades to "fewer pins", never to a crashed map tab.
interface TownNpcLike {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
  role?: unknown;
  category?: unknown;
  district?: unknown;
  faction?: unknown;
  spawn?: { x?: unknown; z?: unknown };
}

function npcMarkerKind(npc: TownNpcLike): HarthmereTownMarkerKind | undefined {
  const kind = String(npc.kind ?? "").toLowerCase();
  if (kind === "hostile") return "hostile";
  if (kind === "animal") return "animal";
  if (kind === "humanoid") return "person";
  // `historical_memory` and any future non-embodied row has no body to walk to.
  return undefined;
}

function npcDescription(
  npc: TownNpcLike,
  kind: HarthmereTownMarkerKind
): string {
  const district = String(npc.district ?? "Harthmere").trim();
  const role = titleCase(String(npc.role ?? npc.category ?? "").trim());
  const faction = String(npc.faction ?? "").trim();
  if (kind === "person") {
    return [
      role ? `${role} in ${district}.` : `Lives and works in ${district}.`,
      faction && faction.toLowerCase() !== "none"
        ? `Affiliation: ${faction}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (kind === "hostile") {
    return `Hostile presence around ${district}. Approach ready for a fight.`;
  }
  return `Wildlife around ${district}.`;
}

/**
 * People (and the hostile/wildlife anchors among them) of the additive town.
 *
 * Ids are derived from the compendium id, which is the same key the renderer,
 * dialogue router, and quest system use, so a pin and the body you walk up to
 * are guaranteed to be the same character.
 */
export const HARTHMERE_TOWN_NPC_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze(
    (HARTHMERE_ALL_NPCS as readonly any[]).flatMap((raw) => {
      const npc = raw as TownNpcLike;
      const npcId = String(npc.id ?? "").trim();
      const kind = npcMarkerKind(npc);
      const x = finiteNumber(npc.spawn?.x);
      const z = finiteNumber(npc.spawn?.z);
      if (!npcId || !kind || x === undefined || z === undefined) {
        return [];
      }
      const label = String(npc.name ?? "").trim() || titleCase(npcId);
      return [
        townMarker({
          id: `harthmere_town_npc_${npcId}`,
          label,
          kind,
          authoredPosition: [x, HARTHMERE_LAYOUT_FEET_Y, z],
          district: String(npc.district ?? "Harthmere").trim(),
          description: npcDescription(npc, kind),
          npcId,
        }),
      ];
    })
  );

/**
 * The 57 authored structures. The pin sits at the footprint centre so the
 * directional overlay walks the player to the building, and the label is the
 * humanised authored name ("north_gate_toll_booth" -> "North Gate Toll Booth").
 */
export const HARTHMERE_TOWN_BUILDING_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze(
    HARTHMERE_BUILDINGS.flatMap((building) => {
      const name = String(building.name ?? "").trim();
      const x0 = finiteNumber(building.x0);
      const x1 = finiteNumber(building.x1);
      const z0 = finiteNumber(building.z0);
      const z1 = finiteNumber(building.z1);
      if (
        !name ||
        x0 === undefined ||
        x1 === undefined ||
        z0 === undefined ||
        z1 === undefined
      ) {
        return [];
      }
      const district = String(building.district ?? "Harthmere").trim();
      const profile = String(building.profile ?? "building");
      return [
        townMarker({
          id: `harthmere_town_building_${name}`,
          label: titleCase(name),
          kind: "building",
          authoredPosition: [
            (x0 + x1) / 2,
            HARTHMERE_LAYOUT_FEET_Y,
            (z0 + z1) / 2,
          ],
          district,
          description: `${titleCase(profile)} in ${district}. Door on the ${
            building.doorSide
          } side.`,
          buildingName: name,
        }),
      ];
    })
  );

/**
 * District compass points plus every authored wayfinding landmark inside them.
 * These are the "locations" a player names out loud ("meet me at the Old Well")
 * and are what make the map legible before you know any building by name.
 */
export const HARTHMERE_TOWN_LOCATION_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze(
    HARTHMERE_BIBLE_DISTRICTS.flatMap((district) => {
      const anchor = townMarker({
        id: `harthmere_town_district_${district.id}`,
        label: district.label,
        kind: "district",
        authoredPosition: [
          district.anchor[0],
          HARTHMERE_LAYOUT_MARKER_Y,
          district.anchor[2],
        ],
        district: district.label,
        description: `${district.label} — ${district.bibleSection}. ${district.mood}`,
      });
      const landmarks = district.landmarks.map((landmark) =>
        townMarker({
          // Authored landmark ids are already globally unique and are what
          // quests reference, so they are used verbatim rather than prefixed.
          id: landmark.id,
          label: landmark.label,
          kind: "landmark",
          authoredPosition: [
            landmark.position[0],
            HARTHMERE_LAYOUT_MARKER_Y,
            landmark.position[2],
          ],
          district: district.label,
          description:
            landmark.label === district.label
              ? `Wayfinding landmark for ${district.label}.`
              : `${landmark.label} in ${district.label}.`,
        })
      );
      return [anchor, ...landmarks];
    })
  );

/** Talkable townsfolk only — the "people" half of the request. */
export const HARTHMERE_TOWN_PEOPLE_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze(
    HARTHMERE_TOWN_NPC_MAP_MARKERS.filter((marker) => marker.kind === "person")
  );

/**
 * Hostile and wildlife anchors are derived but deliberately NOT part of the
 * default map feed: they roam (see the wander/leash config in the renderer), so
 * a fixed pin would promise a body that is not there. The Grove makes the same
 * call — its `mucked_robot` landmark ships `visibleOnWorldMap: false`. Kept
 * exported so a future "threat overlay" can opt in without re-deriving them.
 */
export const HARTHMERE_TOWN_ROAMING_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze(
    HARTHMERE_TOWN_NPC_MAP_MARKERS.filter((marker) => marker.kind !== "person")
  );

/** The default map feed: locations, buildings, and people. */
export const HARTHMERE_TOWN_MAP_MARKERS: readonly HarthmereTownMapMarker[] =
  Object.freeze([
    ...HARTHMERE_TOWN_LOCATION_MAP_MARKERS,
    ...HARTHMERE_TOWN_BUILDING_MAP_MARKERS,
    ...HARTHMERE_TOWN_PEOPLE_MAP_MARKERS,
  ]);

export function getHarthmereTownMapMarkers(): readonly HarthmereTownMapMarker[] {
  return HARTHMERE_TOWN_MAP_MARKERS;
}

export function harthmereTownMapMarkerById(
  id: string
): HarthmereTownMapMarker | undefined {
  return HARTHMERE_TOWN_MAP_MARKERS.find((marker) => marker.id === id);
}
