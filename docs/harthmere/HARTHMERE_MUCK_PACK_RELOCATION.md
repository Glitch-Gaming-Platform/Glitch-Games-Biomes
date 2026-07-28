# Muck pack relocation and the Mossy Muckling hunt (2026-07-28)

## The report

From `mukcig_movie.har`: the player was at `[349.4, 39, -378.7]`, died at
`[337.594, 26, -391.652]` to "a Old Wood Mucker", and reported two things about
that spot — far too many Mucker/Muckling/Hexer groups, and no sign of the six
Mossy Mucklings "Get the Muck Out" asks them to defeat with their Whacker.

Measured against the code before this change, **32 hostiles from eight different
families** stood within 60 blocks of that death column: Watchtower Mucker,
Watchtower Clearing Mucker, Watchtower Clearing Hexer, Old Wood Mucker, Old Wood
Copse Mucker, West Breach Muckling, Gravewood Pale Muckling and Road Muckwad.

## Root cause

`harthmereGroundedMuckMonsterSeedsInTerritory` pooled **all ~100 authored Muck
monsters** and scattered them at random across every non-safe Muck containment
area. That looks like an even spread over six areas. It is not:

| containment area           | centre        | radius |
| -------------------------- | ------------- | ------ |
| `watchtower_muck_patch`    | `[332, -390]` | 16     |
| `watchtower_muck_clearing` | `[332, -390]` | 34     |
| `old_wood_muck_patch`      | `[640, -455]` | 22     |
| `old_wood_mucker_copse`    | `[640, -455]` | 48     |
| `gravewood_pale_muck`      | `[640, 120]`  | 42     |
| `west_muck_breach`         | `[236, -506]` | 46     |

Two nested pairs share a centre, so six areas are only **four distinct points**,
and the pool collapsed onto them at ~25 monsters each.

A second, quieter half of the bug: the generated placement map
(`generated/production_terrain_placement_map.ts`) is keyed by `seedId`, and it had
already recorded a terrain-probed column for each seed _at its pooled position_.
Any fix that only changes the spread is silently overridden by that lookup.

Separately, no creature in the world was ever named "Mossy Muckling". The quest
leaf accepted West Breach and Gravewood Pale Mucklings as stand-ins and its marker
pointed at `[334, 40, -389]` — into the crowd above.

## What changed

**Each family now spreads inside its own territory.**
`harthmereOwnMuckContainmentAreaForSeed` replaces the map-wide random pick.

**The Watchtower clearing keeps exactly one pack, and it is Mucklings only.**
`watchtower_muck_patch` was renamed from "Watchtower Mucker" to **Watchtower
Muckling**, its Hexer removed (`hexEvery: 0`), and its fourteen members authored
individually on `HARTHMERE_WATCHTOWER_MUCKLING_AUTHORED_POSITIONS` — the exact
columns the June production terrain scan measured, centred on the HAR death
column. That ground spans feet Y 31–40 inside a 14-block radius, so one shared Y
would have buried or floated most of the pack.

**The three families with no territory of their own moved to the open Wilds.**

| family                                                           | count | new anchors (measured surface columns)                       |
| ---------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `road_muckwad_patch` (Grove-overlapping, never had a legal home) | 15    | `[643, 25, -905]`, `[1027, 37, 295]`, `[67, 37, -105]` — 3×5 |
| `watchtower_muck_clearing` (nested on the patch)                 | 14    | `[371, 48, 303]`, `[1419, 55, -489]` — 2×7                   |
| `old_wood_mucker_copse` (nested on the patch)                    | 14    | `[899, 38, -697]`, `[451, 39, -673]` — 2×7                   |

Plus the guarded pocket that sat 25 blocks from the clearing centre: its four
guards **and** its five-animal herd moved together to `[1115, 69, 31]`, renamed
`south_meadow_guarded_hollow`. The six ordinary Watchtower livestock (two cows,
two sheep and two rabbits) also moved out of the HAR fight area to
`[1163, 43, -585]`; only the fourteen-Muckling hostile pack remains there.

**The Mossy Muckling hunt is now real content.** A six-strong `Mossy Muckling`
pack at `[531, 68, -33]`, and `NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION`
points there. That is the closest eligible production-scanned outdoor point to
the Grove after excluding every authored safe zone, business safe site,
building plot, Muck territory and robot-protected area. It is west of the
additive Harthmere town/woods and clear of every other creature encounter.

## Grounding rules used

No new terrain guesses were made. Two evidence standards, both asserted in
`test/muck_pack_relocation.test.ts`:

1. **In-Muck monsters** are seated on measured columns via
   `harthmereMeasuredMuckColumnPools()` — the placement map's probed columns,
   re-sorted into the territory each column physically sits in, then assigned by
   rank so the result is a permutation with no two monsters on one column. The
   seedId-keyed placement-map lookup is skipped for these seeds, because it is
   what pinned them to the old pooled positions.
2. **Relocated anchors** must be measured outdoor spawn columns outside every
   protected/business/building area and away from other creature encounters.
   The deploy-time live-creature grounding reconciler now recognizes these
   legal open-world groups, probes each member's complete body footprint within
   its compact encounter radius, and persists an exact supported position and
   respawn anchor. During that terrain search it reserves resolved
   Mucker/Hexer columns, so a relocated creature cannot be shifted onto one. It
   no longer incorrectly requires every creature to stand inside Muck
   territory.

`useProductionPlacementMap: false` still yields the flat
`HARTHMERE_MUCK_FLOOR_FEET_Y` plane, so the placement-map generator and local dev
(whose terrain is flat) are unaffected.

## Bookkeeping

- `HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT`: **200 → 206** (+6 Mossy
  Mucklings only). The relocation itself changes no counts.
- **Every relocated creature keeps its entity id.** Sub-packs reuse the original
  contiguous `idOffset` bands and display names, and their `hexEvery` reproduces
  the original Hexer counts exactly (15 @ 5 → 3 Hexers as 3×(5 @ 5); 14 @ 7 → 2
  Hexers as 2×(7 @ 7)). The deploy content-sync therefore repositions existing
  world entities rather than orphaning them.
- New NPC type ids: `monster_watchtower_muckling` `8722087466111636`,
  `monster_mossy_muckling` `8722087466111637`.
- Mossy Muckling id offsets: `10951–10956`.

## Files

| File                                                                                  | Role                                                                                               |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/shared/harthmere/live_entity_production_seed.ts`                                 | per-area spread, measured-column pools, authored Watchtower pack, relocated anchors, Mossy pack    |
| `scripts/harthmere/reconcile-production-live-creature-grounding.cjs`                  | accepts legal open-world groups while still rejecting protection, buildings and additive Harthmere |
| `src/shared/harthmere/harthmere_native_id_manifest.ts`                                | two new NPC type ids                                                                               |
| `src/shared/harthmere/native_road_ahead_contract.ts`                                  | hunt marker position, restored Mossy Muckling type in the quest's compatible set                   |
| `src/shared/harthmere/native_combat_quest_routing.ts`                                 | legacy combat route positions (all were old pooled coordinates)                                    |
| `src/shared/harthmere/jobs_board_muck_bounty_targets.ts`                              | Alpha Mucker bounty repointed to `old_wood_muck_patch`                                             |
| `src/shared/harthmere/snapshot_grove_content.ts`                                      | comment on the Silent Moss Muckling Nest marker                                                    |
| `src/shared/harthmere/test/muck_pack_relocation.test.ts`                              | new: 20 regression tests                                                                           |
| `src/shared/harthmere/test/live_entity_cow_seeds.test.ts`                             | the relocated guarded pocket is deliberately outside Muck                                          |
| `src/shared/harthmere/test/native_combat_quest_routing.test.ts`                       | route population bounds                                                                            |
| `src/client/components/biomes_ui/adapters/__tests__/nativeQuestNavAidMarkers.test.ts` | new hunt marker                                                                                    |

## Deploy note

Positions changed for 58 already-seeded world entities: 43 relocated hostiles,
the four guards and five animals in the guarded pocket, and the six ordinary
Watchtower livestock. Their entity ids did not, so the full production world
reconciler updates them in place; no `harthmereExcludedMuckMonsterSeedIds()`
deletions are involved. The six Mossy Mucklings are genuinely new seeds and need
one seeding pass. An app-only/missing-content boot is insufficient for the move
because it does not update positions of existing entities.
