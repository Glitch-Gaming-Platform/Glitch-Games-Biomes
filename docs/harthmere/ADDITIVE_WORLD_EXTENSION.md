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
| Flat terrain surface             | `Y=52`                  |
| Player/NPC/outdoor quest feet    | `Y=53`                  |
| Road start/map-boundary marker   | `(1792, 54, -209)`      |
| West Gate                        | `(1992, 54, -209)`      |
| North Gate road end              | `(2100, 54, -284)`      |

The +1600 offset is shard aligned (`1600 / 32 = 50`). Authored optimized
terrain begins at shard X=6, so its first shifted shard begins exactly at world
X=1792. Terrain IDs use a new reserved band beginning at
`8810000000030000`; the legacy terrain entity band is never deleted or moved.

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

The extension seeds the complete surface layer across the town/near-wilds
band, then adds only upper or underground shards that intersect authored
structures and dungeons. The resulting content spans world Y `-64..95`
without generating empty air or featureless stone across five full copies of
the map. This includes:

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

## Verification

Run the focused contracts before deployment:

```bash
./b test -b -p "src/shared/harthmere/test/additive_world_extension.test.ts"
./b test -b -p "src/pages/api/world_map/test/harthmere_connector_landmarks.test.ts"
node scripts/harthmere/check-harthmere-extra-town-offset.cjs
node scripts/harthmere/check-harthmere-connected-town-design.cjs
node scripts/harthmere/test-harthmere-building-bible-coverage.cjs
```

The production source guardrails run the offset check before building. It
requires the Docker image, image-preparation script, one-container runtime,
Next build, and Azure revision environment to agree on automatic terrain
creation and the `+1600` server/client transform.

After deploying, verify `/api/world_map/metadata` ends at or beyond X=2560,
the extension pins are returned by `/api/world_map/landmarks`, and terrain
entities in the new ID band occupy only X=1792..2528 shard origins.
