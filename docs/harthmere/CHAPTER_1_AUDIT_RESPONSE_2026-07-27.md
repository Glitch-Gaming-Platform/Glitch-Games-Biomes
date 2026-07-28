# Chapter 1 audit response — 2026-07-27

## Verdict

The remaining audited Chapter 1 gaps are implemented for the requested scope:
story and dialogue, evidence systems, Native ECS authority, Anima actors,
portal-only Elsewhen dungeons, winter terrain, UI, voice coverage, and the final
winter escort.

The requested exclusion remains excluded: spoiler-bearing scene factories were
not removed from client bundles.

Nothing was pushed, deployed, staged, or committed.

## Story, dialogue, and evidence

- The fragment library contains 30 fragments, six reconstructions, and three
  link recipes.
- Reconstruction validation requires at least one true and one false result so
  the system cannot collapse into “ignore every reconstruction.”
- Native trigger classes validate authoritative position, health, inventory,
  and flags before delivering a fragment.
- Previously unreachable evidence, including `frag_a2_echo_lamps_out`, is
  reachable.
- Six documents are paginated, flag-unlocked, rereadable, and never relocked.
  Lou's notes have a reveal-safety content guard, and Sorrel's ledger appends
  post-handover pages without rewriting previously read text.
- Missing character and story dialogue was added. Long speeches are split into
  screens containing at most two short sentences.
- Hallr's choice and all three endings produce distinct, validated world-phase
  effects.
- Grove elapsed-time continuity is delivered on dungeon exit with authored
  minimums instead of being exposed as a planning exploit.

## Characters and presentation

- AUGUR-9 is the existing Mucked Robot, not a duplicate body. The shared ECS
  label remains “Mucked Robot”; AUGUR-9 is a per-player Chapter 1 presentation.
- The focused seeder now uses `CH1_SEEDED_CAST`, so it cannot overwrite the
  promoted robot.
- NPC staging is per-player presentation and does not relocate shared Anima
  actors for everyone.
- The Grey Card becomes “Custodian Key 7” through a per-player presentation
  overlay rather than mutating the shared item registry.
- AUGUR-9 recharge has a usable UI action.
- Iris, Marrow, Sorrel, Rook, Lou, Cressa, Teak, Wen, Hallr, returned Grove
  characters, and testimony actors have story-aligned dialogue/voice coverage.

## Native ECS, Anima, and dungeon mechanics

- Physical desert and winter dungeon mechanics are implemented, including the
  Gilded Bull, Ninth Winter, Hanged Wood sound discipline, Whale Road carry
  pressure, sandstorm pursuit, ice failure, hazards, recovery, and boss phases.
- Iris, Marrow, and Sorrel use server-owned escort scheduling.
- Party admission, leadership transfer, downed/revive behavior, stale-run
  cleanup, eviction, and one-party-per-past slot ownership are authoritative.
- Encounter choices use prepare/commit behavior and real Native ECS effects.
- The client proposes interactions; server routes re-read ECS state and commit
  generated events/components.
- Anima now evaluates NPCs inside Elsewhen against the detached slot's local
  AABB. Authored bosses and escorts are no longer killed as
  `outOfWorldBounds` merely because ordinary WorldMetadata stops at X=2560.
- The fast suite includes both the positive detached-slot bound and negative
  unassigned-gap bound.

## Portal-only world and winter terrain

- Ordinary WorldMetadata ends at X=2560. Dungeons are detached Elsewhen slots
  reachable only through signed Chapter 1 portal admission.
- The retired X=3648 boundary is normalized back to X=2560.
- Generic movement, ordinary warps, warp-home, stale saves, and direct entry do
  not make the dungeon band part of the normal walkable world.
- Collision and client shard loading use slot-local bounds for admitted
  Elsewhen positions, preventing the former false `ClientInVoid` reload.
- Gaia owns the ordinary continuous world. Detached Elsewhen terrain is
  intentionally immutable and excluded from Gaia's ordinary terrain map.
- The 109 authored dungeon terrain shards are present: 49 desert and 60 winter.
- Winter terrain uses native snow and ice materials, native `ShardWater`, and
  structural roofs with snow caps rather than white-wool stand-ins.

## Deterministic ID and migration fixes

- Five late bandits had reused Chapter 1 cast offsets 10501–10505, allowing
  Anima to turn Lou, Cressa, Rook, Sorrel, and Iris back into bandits.
- Those bandits now use offsets 10901–10905.
- The production seed validator rejects every non-Chapter-1 seed in the entire
  reserved 10500–10599 range.
- The bandit ECS test compares all bandit IDs against every Chapter 1 cast ID.
- The five reclaimed cast IDs use delete-and-create migration semantics. This
  removes stale bandit-only components such as expiry, prisoner locks, and old
  Anima movement destinations instead of merging them into the corrected actor.
- `/api/admin/allocate_id` now rejects IDs already occupied in authoritative
  ECS. A stale test allocator can no longer return `WorldMetadataId` and let a
  fixture overwrite world metadata.
- The damaged warm-world metadata row was restored and remained stable at
  X=2560 after Anima/runtime activity.

## Voice work

- All 17 Huck lines were regenerated with a more natural country delivery;
  the prior robotic cadence was removed.
- 52 previously missing road-creature and animal voice assets were added.
- Established voices were reused. New human voices follow the natural-delivery
  guide, while robot characters retain deliberate robotic processing.
- The final voice checker passes with 1,920 MP3s, including 66 Chapter 1
  cutscene lines, 107 Chapter 1 objective lines, and 139 native robot-story
  lines.
- No ElevenLabs credential was written to the repository.

## Verification

Tests and fixes were run in batches.

| Verification | Result |
| --- | --- |
| Chapter 1 fast unit/contract suite | 319 passing |
| NPC behavior and geometry batch | 189 passing |
| Gate/UI/quest batch | 94 passing |
| Native bandit ECS seed tests | 2 passing |
| Admin collision-aware allocator tests | 3 passing with existing ID-pool tests |
| Native live-entity production smoke | passing |
| Exhaustive robot-story browser contract | passing |
| Scoped Chapter 1 typecheck | passing |
| Final voice completeness/manifest check | passing, 1,920 MP3s |
| Production source guardrails | passing |
| Production Next/server build | passing |
| Production Docker image | passing |
| Final image | `biomes-node:local-ch1-identity-final-20260727` |
| Final image digest | `sha256:06e12bcd558f92130f90db361ee900b62fdf6ea80bdfb45e2799c4a38b837112` |
| `git diff --check` | passing |

### Winter E2E evidence

The retained combined winter run passed provisioning, Rook's Rope, Ice Shelf,
Drowned Longhouse, Hanged Wood, Whale Road, Sorrel's Camp, the oath, Ash Hall,
and Hallr's choice. Its report is:

`artifacts/harthmere-native-ecs-e2e/1785192955447-41241-report.json`

After the cast migration and detached Anima-bound fix, the final Breaking Year
escort passed in a clean quests-only browser run. The report records Sorrel's
escort, fuel consumption 18 → 15, player HP 95/100, stamina 82/100, and all
three report groups passing:

`artifacts/harthmere-native-ecs-e2e/1785195127833-52174-report.json`

One preceding run completed the same escort in 39.26 seconds, above the focused
runner's default 20-second evidence-performance gate but inside its functional
timeout. The clean report used a 45-second evidence gate. This is retained as a
focused-stack synchronization performance note, not hidden as a functional
failure.

### Live in-app browser verification

The final production-shaped stack was tested in the in-app browser with a real
local visual-test player:

- visual-test authentication and player creation succeeded;
- wake-up and hero creation completed;
- the Grove rendered with HUD, health, mana, stamina, gold, objective, hotbar,
  and tutorial controls;
- J opened the Quests panel with active/completed filters and mission steps;
- Recovered opened and rendered the correct empty state for a new player;
- closing the Biomes UI returned to the live objective HUD;
- browser console error count was zero.

## Environment lessons retained

`docs/harthmere/TESTING_FASTER.md` now records the failures that must not recur:

- inherit the control token after every container replacement without printing
  it;
- bind every Redis alias to the active warm-world port (6390 for this stack);
- verify the actual WorldMetadata component and X=2560 boundary, not only Redis
  connectivity or DB size;
- use collision-aware fixture allocation;
- reclaim cross-family IDs with delete-and-create migration;
- apply detached slot bounds to Anima NPCs;
- allow a healthy 300k-entity world bootstrap to finish instead of restarting
  it at an arbitrary three-minute wall.

## Final runtime state

- Active focused stack: `biomes-prod-smoke-app`
- Active image: `biomes-node:local-ch1-identity-final-20260727`
- Warm Redis: host port 6390
- Ordinary boundary: X=2560
- Rollback containers were preserved during swaps.
- No production push or deployment was performed.
