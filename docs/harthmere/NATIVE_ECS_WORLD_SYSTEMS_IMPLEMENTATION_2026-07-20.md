# Native ECS World Systems Implementation — 2026-07-20

This document records the implementation pass following the jobs, loot,
farming, harvesting, NPC/living-entity, and house-building native-ECS audit.
It compares the repaired ownership model with the original
`data-snapshot-2026-05-16` behavior and records the exact-item/container
migration that closes the previously documented data-authoring boundary. No
production deployment is performed by these changes.

## Authority outcomes

| System                   | Implemented authority and safeguards                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NPC combat               | Every seeded NPC uses native ECS `Health`. Native death produces native drops and `npcKilled` events. Client Redis attack/AI bridges are disabled in native mode, authenticated legacy combat HTTP mutations are rejected, and the server rejects melee damage beyond 5.5 entity-center units.                                                                                                                                                                      |
| Creature respawn         | The native NPC death transaction records the fixed seed id in the seed reconciler's one-hour respawn registry. ECS corpse expiry can no longer cause an immediate seed recreation.                                                                                                                                                                                                                                                                                  |
| Robot living state       | The scheduled shared protection ledger synchronizes charge/capacity/time into each sentinel's native `RobotComponent` after the Redis transaction. Native world subscriptions therefore receive battery changes without waiting for a REST poll.                                                                                                                                                                                                                    |
| Native crops             | The client publishes one `HarvestPlantEvent`. The server checks plant status and player distance; Gaia always converts the crop container into a native `GrabBag`. The client now distinguishes request pending, world-applied/drop-ready, and inventory-acquired states by observing synchronized ECS plant and inventory components. The former HTTP inventory grant is rejected while native authority is enabled.                                               |
| Authored gathering nodes | Node id is the only client choice. Server code owns node coordinates, exact equipped-tool Bikkie evidence, profession level, deterministic yield, legality warning, and shared absolute respawn time. All 29 nodes now emit exact items into one idempotent native ECS `GrabBag`; no Redis inventory grant or custom collect event runs in native mode.                                                                                                             |
| Custom loot              | Positioned source metadata stays in the shared reducer as a durable materialization outbox, but physical loot is an exact native ECS `GrabBag`. Stable Redis allocation/done keys make retries and process restarts idempotent; the native client projection hides the legacy polling claim and authenticated legacy claim mutations reject.                                                                                                                        |
| Generic containers       | Frame-backed and static procedural containers are server-validated for label, authored identity, position, and interaction range, then materialized as native `container_inventory` entities. Seed contents use exact Bikkie ids. Road Ahead quest props remain native quest-giver reward objects and cannot fall through to this generic path.                                                                                                                     |
| Jobs                     | Field completion requires a resolvable authored marker and a server-read actor position within eight blocks. Repair/cleanup completion requires both the requested action and authoritative equipped-tool evidence. Failed/cancelled/expired todos cannot be resurrected by a completion request.                                                                                                                                                                   |
| Property/building        | Plot ownership, active projects, completed properties, progress, structures, access records, decoration state, and free-world placeables are shared world state. Cross-player double claims and foreign-plot placeables are rejected. Transfers update the global owner ledger, structures, and decorations.                                                                                                                                                        |
| Terrain materialization  | Solid plans write terrain diff and placer ECS components in one version-checked world transaction. Occupancy, unexpected overwrite, and destructive expected-value conflicts defer the plan. Redis marks a structure materialized only after the ECS transaction succeeds; reads retry unacknowledged plans without charging materials again.                                                                                                                       |
| UI latency/world loading | Native health is read directly from synchronized ECS resources. Initial sync prioritizes nearby terrain and retains bootstrap overflow for subsequent websocket batches. A production-shaped 2,500-entity canary drains repeated small batches without loss. Browser-random particle canvases mount only after hydration, preventing the React 425/423 remount that interrupted the sync loader. Async controls display pending labels and disable duplicate input. |
| World interaction input  | Native cursor shortcuts, jobs/business/home stations, gathering nodes, and custom loot now register candidates with one process-wide F/E dispatcher. Native ECS targets have the highest priority; only the selected custom prompt renders, and a disabled selected target consumes the key instead of activating an object behind it.                                                                                                                              |

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

The baked May 16 data snapshot contains exact-name biscuits for only 3 of the
79 current gathering yield names. Visual aliases are still not valid
substitutes—using the `goldOre` identity for custom `iron_ore`, for example,
would corrupt recipes and native triggers.

The runtime now closes this gap without semantic aliasing. The Bikkie refresher
overlays one deterministic, collision-checked biscuit for every server-authored
Harthmere catalogue item before `/api/bikkie` serves the tray. Numeric and
`b:<id>` items retain their original snapshot ids. String items get stable
safe-integer ids derived from their exact item key; all 79 gathering yields and
all required tools are therefore independently addressable by native ECS.
Existing snapshot biscuits may donate presentation-only fields (`mesh`, `vox`,
`galoisPath`, icon, palette, and attachment transform), but never id, recipe,
drop, terrain, or trigger semantics. This keeps both clothing layers visible
and held tools recognizable without collapsing distinct items.

Generic containers use the same exact ids. The native container endpoint
converts a real frame-backed entity in place or creates a stable ECS placeable
for a server-authored static landmark, attaches `container_inventory`, and lets
the stock native inventory swap handler own taking/storing every slot. The
browser-provided label and item list are ignored. The old custom transfer path
is rejected for authenticated native requests.

Run `./b script audit_snapshot_harthmere_items snapshot_backup.json` to audit
the immutable source snapshot. Its expected result remains 3/79 exact-name
matches and 0/29 fully covered nodes. The native overlay regression test is the
runtime counterpart: it requires 79/79 unique exact ids and 29/29 fully covered
nodes. Keeping both numbers documents what came from the original release and
what this server adds, instead of pretending the source snapshot contained data
it did not.

## Regression coverage

The implementation adds or updates coverage for:

- native seeded-NPC damage, remote melee rejection, death, and delayed respawn;
- robot scheduler to native `RobotComponent` synchronization;
- native crop range checks and native Gaia drop creation;
- all 29 gathering nodes, required tools, profession gates, deterministic
  yields, exact native item identities, native `GrabBag` materialization,
  shared cooldowns, and offline compatibility mode;
- native materialization allocation/done-key idempotency, retry repair,
  owner-only pickup filters, expiry, and no recreation after acquisition;
- native generic container range/authorship checks, exact seeded contents, and
  stock `container_inventory` transfer behavior;
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
- deterministic empty particle SSR output and a production-sized mixed
  terrain/decor bootstrap drained through repeated 37-change websocket pulls.

## Verification completed

The formatted tree was verified locally without deploying or mutating
production. The full suite established the repository-wide baseline, followed
by focused reruns after the final restart/authentication hardening:

- `./b test --jobs 1`: `3372 passing`, `5 pending`, `0 failing`.
- `./b typecheck`: passed.
- Focused native-ECS/item/container/world-loading matrix: `89 passing`,
  `0 failing`.
- Final exact-item overlay, authenticated-drop, ECS actor-read, and native
  container guards: `11 passing`, `0 failing`.
- Production source guardrails and pre-Docker Next/server bundle build: passed;
  execution stopped before Docker image creation, push, or Azure deployment.
- Snapshot gathering-item audit: `3 / 79` source-snapshot exact-name matches and
  `0 / 29` source-snapshot fully covered nodes.
- Runtime native-overlay audit: `79 / 79` unique exact gathering ids and
  `29 / 29` fully covered nodes.
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
   and cooldown must be server-owned and shared. Verify the exact item ids enter
   one native GrabBag, then advance collect triggers only after pickup.
7. Materialize and open one frame-backed and one static generic container;
   verify every seeded slot can be taken/stored through native inventory swaps.
   Throw and reclaim a custom positioned item from nearby; a remote account
   must not claim it.
8. Accept repair, gather, delivery, escort, and mining jobs; remote field
   completion and unequipped-tool completion must reject, while valid completion
   routes the marker back to the physical board for payout.
9. Claim one plot, attempt a second-account claim, transfer the property, and
   verify ownership/decor visibility after reload on both accounts.
10. Materialize and demolish a throwaway structure; verify ECS terrain placer
    metadata, conflict deferral, success acknowledgement, and no duplicate
    material charge on retry.
