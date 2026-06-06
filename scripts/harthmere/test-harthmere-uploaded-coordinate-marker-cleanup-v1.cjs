#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const { createNewScenes } = require("../../src/client/game/renderers/scenes");
const {
  HARTHMERE_QUEST_OBJECT_MARKERS_V145,
  HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY_V146,
  makeHarthmereQuestObjectMarkersRendererV145,
} = require("../../src/client/game/renderers/local_dev/harthmere_quest_object_markers_v145");
const {
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority_v1");

const reportedProductionCoordinates = [
  { coord: [502.88384366119976, 70.5, -126.15055725255803] },
  { coord: [503.9002534604286, 69.875, -121.73357661985989] },
  { coord: [505.6902987785366, 69.875, -121.01353435079503] },
  { coord: [493.1333636378383, 69.875, -125.12448462045509] },
  { coord: [493.11811232266956, 69.875, -122.04491326171234] },
  { coord: [492.06089566201985, 69.875, -121.88038131859605] },
  { coord: [488.2517270448635, 69.875, -122.00613420667908] },
  { coord: [486.0663381737527, 69.875, -120.01241981895568] },
  { coord: [499.9583978752843, 69, -139.72897404951524] },
  { coord: [527.9694072798106, 70, -152.07775039439758] },
  { coord: [523.7424461188757, 69, -154.1793703067409] },
  // The Greenlamp frontage audit points are historical uploaded prop
  // coordinates. Their canonical jobs-board markers now live at the clinic ECS
  // outpost/owner anchors, which are farther back in the same building footprint.
  { coord: [665.1302257049798, 65, -168.0914691219139], maxDistance: 25 },
  { coord: [665.0414534892493, 65, -159.8637924113891], maxDistance: 25 },
];

function nearestMarker(coord) {
  const [x, , z] = coord;
  return [...HARTHMERE_QUEST_OBJECT_MARKERS_V145]
    .map((marker) => ({
      marker,
      distance: Math.hypot(marker.position[0] - x, marker.position[2] - z),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

const renderer = makeHarthmereQuestObjectMarkersRendererV145();
const scenes = createNewScenes();
renderer.draw(scenes, 0.016);
const root = scenes.three.children.find((child) =>
  child.name.includes("harthmere-quest-object-marker-v145")
);
assert.ok(root, "quest object marker root should attach to the scene");

for (const audit of reportedProductionCoordinates) {
  const coord = audit.coord;
  const maxDistance = audit.maxDistance ?? 15;
  const nearest = nearestMarker(coord);
  assert.ok(nearest, `expected a registry marker near ${coord.join(",")}`);
  assert.ok(
    nearest.distance < maxDistance,
    `expected an audited marker within ${maxDistance}m of ${coord.join(",")}, got ${nearest.distance.toFixed(2)}m`
  );
  const markerGroup = root.children.find(
    (child) =>
      child.userData.harthmereQuestObjectMarkerId === nearest.marker.id
  );
  assert.ok(markerGroup, `renderer should still register ${nearest.marker.id}`);
  assert.equal(
    markerGroup.visible,
    false,
    `${nearest.marker.id} must not render a passive primitive body at uploaded production coordinate ${coord.join(",")}`
  );
  assert.equal(
    markerGroup.userData.harthmereQuestObjectMarkerRenderPolicy,
    HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY_V146
  );
  assert.equal(
    markerGroup.children.length,
    1,
    `${nearest.marker.id} should only carry a hidden active beacon in production`
  );
  console.log(
    `OK ${coord.map((n) => Math.round(n * 1000) / 1000).join(",")} -> ${nearest.marker.id} hidden (${nearest.distance.toFixed(2)}m)`
  );
}

assert.equal(
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  3.25,
  "jobs board radius should stay tightened so the prompt does not reach the fountain"
);

console.log("\nRESULT: PASS");
