# Native ECS World Systems Implementation — 2026-07-20

This document records the implementation pass following the jobs, loot,
farming, harvesting, NPC/living-entity, and house-building native-ECS audit.
It compares the repaired ownership model with the original
`data-snapshot-2026-05-16` behavior and identifies the remaining data-authoring
boundary. No production deployment is performed by these changes.

## Authority outcomes

| System                   | Implemented authority and safeguards                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NPC combat               | Every seeded NPC uses native ECS `Health`. Native death produces native drops and `npcKilled` events. Client Redis attack/AI bridges are disabled in native mode, authenticated legacy combat HTTP mutations are rejected, and the server rejects melee damage beyond 5.5 entity-center units.                                                                                                                        |
| Creature respawn         | The native NPC death transaction records the fixed seed id in the seed reconciler's one-hour respawn registry. ECS corpse expiry can no longer cause an immediate seed recreation.                                                                                                                                                                                                                                    |
| Robot living state       | The scheduled shared protection ledger synchronizes charge/capacity/time into each sentinel's native `RobotComponent` after the Redis transaction. Native world subscriptions therefore receive battery changes without waiting for a REST poll.                                                                                                                                                                      |
| Native crops             | The client publishes one `HarvestPlantEvent`. The server checks plant status and player distance; Gaia always converts the crop container into a native `GrabBag`. The client now distinguishes request pending, world-applied/drop-ready, and inventory-acquired states by observing synchronized ECS plant and inventory components. The former HTTP inventory grant is rejected while native authority is enabled. |
| Authored gathering nodes | Node id is the only client choice. Server code owns node coordinates, required tool, profession level, deterministic yield, carry-weight validation, legality warning, and shared absolute respawn time. Production browser code cannot execute the local random/localStorage grant path.                                                                                                                             |
| Custom loot              | Positioned non-Bikkie drops, drop instances, pickup tokens, and counters are shared once per world. Claims require a server-read actor position within five blocks. Claimed/deleted drops cannot be restored by a stale actor blob.                                                                                                                                                                                   |
| Jobs                     | Field completion requires a resolvable authored marker and a server-read actor position within eight blocks. Repair/cleanup completion requires both the requested action and authoritative equipped-tool evidence. Failed/cancelled/expired todos cannot be resurrected by a completion request.                                                                                                                     |
| Property/building        | Plot ownership, active projects, completed properties, progress, structures, access records, decoration state, and free-world placeables are shared world state. Cross-player double claims and foreign-plot placeables are rejected. Transfers update the global owner ledger, structures, and decorations.                                                                                                          |
| Terrain materialization  | Solid plans write terrain diff and placer ECS components in one version-checked world transaction. Occupancy, unexpected overwrite, and destructive expected-value conflicts defer the plan. Redis marks a structure materialized only after the ECS transaction succeeds; reads retry unacknowledged plans without charging materials again.                                                                         |
| UI latency/world loading | Native health is read directly from synchronized ECS resources. Initial sync prioritizes nearby terrain and retains bootstrap overflow for subsequent websocket batches. Async inventory/container/dialog/gathering controls display pending labels and disable duplicate input. Native GrabBag pickup reports success only after its ECS `Acquisition` component confirms the actor.                                 |
| World interaction input  | Native cursor shortcuts, jobs/business/home stations, gathering nodes, and custom loot now register candidates with one process-wide F/E dispatcher. Native ECS targets have the highest priority; only the selected custom prompt renders, and a disabled selected target consumes the key instead of activating an object behind it.                                                                                |

## Shared-world migration

`sharedAuthoritySchemaVersion: 2` establishes the new ownership boundary.

- Version 0/1 shared records merge legacy actor copies once so a rolling deploy
  does not discard existing properties, decorations, placeables, or drops.
- The next successful shared write emits version 2.
- Version 2 replaces actor copies instead of unioning them. This is essential:
  a union would resurrect a transferred property, removed decoration, claimed
  drop, or removed placeable from an old player record.
- Player persistence version 4 omits all shared branches and keeps only private
  actor data plus private jobs-board objective markers.

## Original snapshot alignment

The May 16 snapshot relied on native ECS for the parts of gameplay that are
already modeled by Biomes: health/death, NPC damage, inventory/wearing/hotbar,
challenge triggers, plant harvests, terrain edits, placer metadata, and world
sync. The repaired code follows that same rule instead of mirroring those
components into browser state or actor Redis records.

Harthmere systems with no native schema—dynamic job contracts, production
economy, property finance, and some authored custom resources—remain server
reducers. Their multiplayer portions are now one shared transaction rather
than one private world per actor.

## Native quest and item ids

All authored story quests should use native challenge ids and exact Bikkie item
ids. The Road Ahead does this now, including native collect and wearing trigger
events.

Dynamic jobs-board todos should **not** fabricate native challenge ids. They are
runtime contracts whose ids are created after deployment; the correct model is
the shared jobs ledger plus a BiomesUI projection. If a job becomes authored
story content, it should be promoted to a real Bikkie challenge.

Several custom gathering, crafting, decor, and economy item names still lack
real Bikkie ids. They intentionally remain string ids in the custom inventory
authority. Existing visual aliases are not valid substitutes—using “gold ore”
as the authoritative id for custom “iron ore,” for example, would corrupt
recipes and native triggers. Completing that final migration requires publishing
real Bikkie items/data, then replacing each string objective, reward, recipe,
vendor row, and saved inventory key with the authored id.

This is a release data dependency, not a safe TypeScript aliasing exercise.
Until those biscuits are authored, the code must not claim that all 29 custom
gathering yields are native ECS items. The live deployment acceptance checklist
therefore keeps authored-node ECS migration as an explicit unresolved gate.

The same boundary applies to generic authored frame-backed containers and
polling custom loot markers whose contents are string-id Harthmere items. The
Road Ahead Clothing Crate and Billy's Bag are now explicit native quest objects,
and real ECS containers use `container_inventory`; generic custom containers
must not be described as native until their contents have exact Bikkie ids and
the authored frames are materialized as ECS container entities. Their current
custom persistence path remains a migration item, not a second native source of
truth.

Run `./b script audit_snapshot_harthmere_items snapshot_backup.json` to audit
the installed source snapshot. The current snapshot has exact-name Bikkie
coverage for only 3 of the 79 gathering yield ids (`gold_ore`, `oak_log`, and
`silver_ore`), and no gathering node has every common and rare yield covered.
That is why the implementation does not reuse visual aliases for authoritative
inventory or quest-trigger identity.

## Regression coverage

The implementation adds or updates coverage for:

- native seeded-NPC damage, remote melee rejection, death, and delayed respawn;
- robot scheduler to native `RobotComponent` synchronization;
- native crop range checks and native Gaia drop creation;
- all 29 gathering nodes, required tools, profession gates, deterministic
  yields, shared cooldowns, and offline compatibility mode;
- cross-player drop visibility, pickup radius, eligibility, expiry, duplicate
  claims, carry weight, and stale-state resurrection;
- jobs marker validation, field range, equipped-tool proof, material storage,
  delivery, escort, gather, mining, cancellation, and payout routing;
- global plot claims, transfers, completed-property visibility, shared decor,
  shared placeables, foreign-land rejection, and stale actor migration;
- terrain materialization idempotency, placer metadata, overwrite conflicts,
  success acknowledgement, and retry state;
- native Road Ahead items, wearing layers, hotbar/inventory counts, atomic crate
  transfer, pending UI states, immediate native HUD health, and terrain-first
  bootstrap ordering.
- one F/E dispatcher across native inspection and authored world prompts, plus
  ECS-observed crop and GrabBag acquisition feedback.

## Verification completed

The final formatted tree was verified locally without deploying or mutating
production:

- `./b test`: `3361 passing`, `5 pending`, `0 failing`.
- `./b typecheck`: passed.
- Focused interaction/auth/harvest matrix: `23 passing`, `0 failing`.
- Production source guardrails and pre-Docker Next/server bundle build: passed;
  execution stopped before Docker image creation, push, or Azure deployment.
- Snapshot gathering-item audit: `3 / 79` exact Bikkie ids and `0 / 29`
  fully covered gathering nodes, confirming the remaining data-authoring gate.
- Rendered Chromium dialogue/pending-state flow: `1 passing`, `0 failing`.
- Prettier completed across every modified and new source/document file.
- `git diff --check`: passed.

The five pending tests are pre-existing repository-declared pending cases, not
failures from this implementation.

## Deployment acceptance checklist

Use a throwaway authenticated player after the next paid deployment:

1. Confirm terrain around spawn completes before distant scenery and no later
   batch silently disappears.
2. Damage the player and one seeded Mucker; verify the HUD and overhead health
   update from websocket ECS state without waiting for Redis polling.
3. Attempt a melee click outside range and a Muckwad throw near an NPC; neither
   may damage or aggro the NPC.
4. Kill a seeded creature; verify one native drop, one quest kill event, corpse
   expiry, and no early fixed-id respawn.
5. Harvest a native crop at range and in range; only the in-range request may
   create a native `GrabBag`.
6. Gather one authored node with/without the tool and from two accounts; yield
   and cooldown must be server-owned and shared. Do not mark native inventory
   migration complete until every yielded item has a dedicated Bikkie id and
   the resulting ECS inventory version/collect trigger is observed.
7. Throw and reclaim a custom positioned item from nearby; a remote account
   must not claim it from outside the pickup radius.
8. Accept repair, gather, delivery, escort, and mining jobs; remote field
   completion and unequipped-tool completion must reject, while valid completion
   routes the marker back to the physical board for payout.
9. Claim one plot, attempt a second-account claim, transfer the property, and
   verify ownership/decor visibility after reload on both accounts.
10. Materialize and demolish a throwaway structure; verify ECS terrain placer
    metadata, conflict deferral, success acknowledgement, and no duplicate
    material charge on retry.
