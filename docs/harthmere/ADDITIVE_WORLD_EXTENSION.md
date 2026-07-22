# Harthmere Additive World Extension

## Outcome

Harthmere is generated automatically in new map space east of the installed
production world. The extension does not flatten, delete, move, or reuse any
original production terrain shard.

The canonical layout is:

| Item                             | Coordinate / range      |
| -------------------------------- | ----------------------- |
| Original east map edge           | `X=1792`                |
| Expanded east map edge           | `X=2560`                |
| Authored-to-world town transform | `X + 1600`, unchanged Z |
| Extension terrain band           | `1792 <= X < 2560`      |
| Extension Z band                 | `-576 <= Z < 192`       |
| Flat terrain surface             | `Y=52`                  |
| Player/NPC/outdoor quest feet    | `Y=53`                  |
| Road start/map-boundary marker   | `(1792, 54, -209)`      |
| West Gate                        | `(1992, 54, -209)`      |
| North Gate road end              | `(2100, 54, -284)`      |

The +1600 offset is shard aligned (`1600 / 32 = 50`). Authored optimized
terrain begins at shard X=6, so its first shifted shard begins exactly at world
X=1792. Terrain IDs use a new reserved band beginning at
`8810000001000000`. IDs are derived from shard X/Y/Z, so adding a row cannot
remap an existing entity to a different box. The retired sequential range
`[8810000000030000, 8810000000040000)` has its terrain components removed only
when an entity is verified as terrain; overlapping escort-companion NPC data
is preserved instead of deleting the whole ECS record.

## Automatic enablement

The additive town is normal world content. Glitch image preparation, runtime
startup, data snapshots, client rendering, server seeding, map metadata, and
quest hints enable it by default. `BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0` is no
longer interpreted as a disable switch.

Emergency/legacy switches remain explicit:

- `BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1` disables the extension.
- `BIOMES_HARTHMERE_STANDALONE_TOWN=1` selects the unshifted legacy test town.
- `BIOMES_CREATE_LOCAL_DEV_TERRAIN=0` prevents terrain creation.

## Terrain completeness

The extension seeds every X/Z shard in `1792 <= X < 2560` and
`-576 <= Z < 192` from world Y=-64 through the surface shard ending at Y=63.
This full foundation prevents black void, floating slabs, and giant internal
cliffs anywhere inside the expanded map. It then adds only upper or deeper
shards that intersect authored structures and dungeons. This includes:

- the flat town, roads, plazas, walls, and surrounding near-wilds;
- upper floors, roofs, gate towers, and tall landmarks above Y=63;
- Old Well/Underways and a solid switchback chapel descent with landings at
  every authored Bellbound quest depth: Y=-6, -14, -26, and -60;
- the twelve bible districts and their generated buildings/services.

Only shifted shards beginning in `1792 <= X < 2560` are accepted. The seed
fails closed for supplemental/full-profile shards outside that band.

## Quest coordinate contract

All Harthmere quest coordinates are authored coordinates and use the shared
town transform at runtime:

- world X = authored X + 1600;
- world Z = authored Z;
- authored Y=0 means the outdoor feet plane Y=53;
- negative Y values remain unchanged for caves and the Underways.

The old production terrain placement map was measured against the retired
+512 layout. Quest resolution may retain its labels/purpose metadata, but its
old recommended coordinates are ignored. A contract test checks all 425 quest
and objective positions. Grove quest/NPC positions remain unshifted.

## Existing-world content reconciliation

Terrain completion and runtime-content completion are tracked separately. An
existing production world can already contain every extension shard while its
persisted NPCs, Muckers, livestock, robots, quest snapshots, or structural map
markers still use the retired unshifted or `+512` coordinates.

On startup, the runtime-content reconciler therefore:

- updates seeded Harthmere NPCs, Muckers, livestock, and sentinel robots to the
  `+1600` world transform;
- rewrites every additive town NPC/board to player-feet `Y=53`; old measured
  Plaza/Bank/Tavern/Docks Y bands are retained only for explicit standalone
  legacy mode;
- grounds outdoor creatures at player-feet `Y=53` instead of consulting the
  obsolete production placement map;
- clips extension-owned protection, helper, spawn, and Mucker containment
  coordinates inside `X=1792..2560` and `Z=-576..192`, so no wander path can
  cross onto the original hilly map or an unseeded terrain edge;
- migrates old combat snapshots when their canonical seed is now in the east
  extension, while preserving normal movement for already-migrated entities;
- forces the persisted Harthmere Town Jobs Board to its canonical position at
  `(2134, 53, -202)`; and
- makes the post-deploy world-sync repair use those same canonical positions
  instead of reapplying the retired placement map, then reads every repaired
  ECS entity back and fails the deployment if X/Y/Z did not persist; and
- rejects any legacy placement-map result west of X=1792 when the shared
  canonical fallback is already in the extension, covering helper quests,
  jobs-board targets, business markers, HUD pins, and building markers; and
- records a separate runtime-content fingerprint so the migration is
  idempotent and does not rebuild the extension terrain shards on every process
  restart.

Changing runtime entity coordinates must bump the runtime-content fingerprint,
even when the terrain fingerprint remains unchanged.

Snapshot combat hostiles are also part of deploy-time reconciliation. Every
authored Mucker is checked against the Grove, town-core, and safe-road radii;
the first combat encounter is at the watchtower clearing, not in the Grove.

## Grounding and coordinate-space contract

Grounding is intentionally different on the two sides of the connector:

- Additive Harthmere outdoor NPCs, boards, Muckers, Hexers, livestock, and
  sentinels use the deterministic flat feet plane `Y=53`.
- Original Grove/snapshot outdoor NPCs and hostiles keep their original X/Z and
  resolve Y from the real hilly production terrain with an open-sky probe.
- Roofed business owners, customers, and seeded crafting stations resolve the
  nearest indoor floor without requiring open sky.
- Bellbinder/Underways negative-Y positions are authored dungeon levels and are
  never flattened.
- Player-authored placeables retain their intentional Y.

The production deploy runs
`scripts/harthmere/probe-production-terrain-grounding.cjs` with repair enabled.
It covers town NPCs/boards, Grove NPCs, snapshot hostiles, robots, Muckers,
Hexers, livestock, business owners/customers, and seeded business objects. It
updates ECS position and NPC spawn position, reads every repair back, and fails
the deployment on missing terrain, missing standable floor, unsupported flat
extension terrain, or unresolved floating/buried placement.

Muckers, Hexes, and wildlife receive an additional persisted-ECS integrity
pass after every terrain writer has finished. The pass reads each creature's
actual Redis position rather than trusting its seed, samples the final terrain
under its complete body footprint, repairs floating/buried or out-of-zone X/Y/Z,
recreates missing/dead deployment records, restores species-specific size and
combat data, removes stale expiry, and pins `npc_metadata.spawn_position` to
the same grounded anchor. Readback must confirm all 100 hostile creatures and
24 animals are alive, body-supported, correctly sized, outside safe zones, and
inside real Muck containment. Native fixed-ID respawns use the same full entity
builder, so cows, sheep, rabbits, Muckers, and Hexes do not lose their authored
body size or respawn at a death-position terrain seam.

Normal three-replica web revisions keep `BIOMES_CREATE_LOCAL_DEV_TERRAIN=0`.
Before traffic promotion, the guarded deploy creates a temporary one-replica,
zero-traffic maintenance revision with terrain seeding forced on. Promotion is
blocked until `scripts/harthmere/audit-production-extension-terrain.cjs`
confirms all 2,304 foundation shards, all 576 surface shards, solid Y=52 in
every extension column, non-empty lower foundation tensors, correct shard
boxes, and zero retired terrain records.

## Physical player route contract

The route is continuous from the Grove trailhead to the additive town:

1. the protected route planner follows existing terrain from the Grove;
2. it builds the confirmed descent to the lower floor at `(903, 56, -209)`;
3. it follows building-safe terrain to `(1780, *, -209)`;
4. it creates a protected graded stair/causeway onto the extension boundary at
   `(1792, 52, -209)`; and
5. the generated additive road continues from the boundary to West Gate at
   `(1992, 52, -209)` and onward to North Gate.

The production materializer treats placeables, groups, occupied voxels, water,
and unsafe materials as blocked. It validates every cut/fill/clearance edit and
the final collidable floor/headroom before writing, so the route cannot solve a
gap by destroying an existing building.

## World map contract

World metadata expands only its positive-X end to at least X=2560. Existing
minimum bounds, vertical limits, Z limits, and a pre-existing larger east bound
are preserved.

The world-map API always appends:

- the extension road start at the old/new boundary;
- the West Gate;
- the North Gate road end;
- every bible district anchor;
- every named bible landmark/building, including the chapel, forge, inn,
  services, warehouse, barracks, wells, residences, and civic buildings.

The BiomesUI map paints Harthmere's synthetic geography in the same shifted
east-side coordinates as the landmarks. Terrain is visible by default, the
Grove-to-Harthmere road is drawn continuously through both route endpoints,
and unrelated Harthmere roads/buildings retain distinct marker IDs. At lower
zoom levels, nonessential labels are hidden to keep the town from appearing as
one overlapping stack of names; focused, active, route, and town labels remain
visible.

## Verification

Run the focused contracts before deployment:

```bash
./b test -b -p "src/shared/harthmere/test/additive_world_extension.test.ts"
./b test -b -p "src/shared/harthmere/test/harthmere_connector_route.test.ts"
./b test -b -p "src/shared/harthmere/test/live_entity_muck_monster_gating.test.ts"
./b test -b -p "src/shared/harthmere/test/live_entity_robot_energy_protection.test.ts"
./b test -b -p "src/shared/harthmere/test/live_mode_backend.test.ts"
./b test -b -p "src/client/components/biomes_ui/adapters/__tests__/harthmereMapTerrainRegions.test.ts"
./b test -b -p "src/client/components/biomes_ui/adapters/__tests__/mapAdapter.test.ts"
./b test -b -p "src/pages/api/world_map/test/harthmere_connector_landmarks.test.ts"
node scripts/harthmere/test-harthmere-connector-route-materialization.cjs
node scripts/harthmere/check-harthmere-extra-town-offset.cjs
node scripts/harthmere/check-harthmere-connected-town-design.cjs
node scripts/harthmere/test-harthmere-building-bible-coverage.cjs
APPLY=0 node scripts/harthmere/probe-production-terrain-grounding.cjs
APPLY=0 node scripts/harthmere/reconcile-production-live-creature-grounding.cjs
node scripts/harthmere/audit-production-extension-terrain.cjs
```

The production source guardrails run the offset check before building. It
requires the Docker image, image-preparation script, one-container runtime,
Next build, and Azure revision environment to agree on automatic terrain
creation and the `+1600` server/client transform.

After deploying, verify all of the following—not only that a deployment became
healthy:

- `/api/world_map/metadata` ends at or beyond X=2560;
- `/api/world_map/landmarks` returns the boundary, West Gate, North Gate, every
  district, and every bible building in the shifted east-side coordinates;
- terrain entities in the new ID band occupy only X=1792..2528 shard origins;
- the extension terrain audit reports `2304` foundation shards, `576` surface
  shards, and zero missing, invalid, empty-foundation, surface-hole, or
  retired-terrain records;
- the Town Jobs Board resolves to `(2134, 53, -202)`, not the retired
  `(1046, 65, -202)` position;
- seeded Muckers, livestock, and robot sentinels are at `X>=1792`, on `Y=53`,
  and remain inside their shifted Muck/protection areas;
- the live-creature integrity pass reports all `100` Muckers/Hexes and `24`
  animals with zero unresolved missing, dead, floating, buried, wrong-size,
  expiring, unsafe, or unsupported-footprint records;
- snapshot combat Muckers remain outside the Grove/town safe radii, with the
  primer encounter in the watchtower danger clearing;
- the mandatory grounding gate reports every actor/object family with zero
  `noTerrainData`, `noSurface`, `unsupportedExtensionSurface`, and
  `unresolvedAfterRepair`;
- the map shows the town geography behind its pins with Terrain enabled and
  does not collapse multiple Harthmere roads/buildings into one marker; and
- connector reconciliation reports no failures and ends exactly at
  `(1792, 52, -209)` before the generated road continues to West Gate.
