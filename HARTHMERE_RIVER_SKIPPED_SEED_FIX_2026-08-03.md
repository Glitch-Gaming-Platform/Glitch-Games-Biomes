# Why last deploy still had no river (2026-08-03)

## The finding

Your deploy command contains:

```
HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1
```

That returns early from `seed_production_harthmere_extension_terrain()`
(`deploy-production-local-redis-smoke.sh:2511`), which is where **all** of the
terrain work lives — including everything I did last session to make the river
survive a deploy. So with that flag set, none of it ran. The river could not
appear no matter how many times reconciliation ran.

Worse, my previous change made things actively worse under that flag:

- I taught the sunken-surface repair to treat authored-water columns as
  **protected**, so it would stop filling the channel with soil;
- but the repair is **add-only by design** — it fills holes, it cannot cut a
  channel;
- and the terrain seed, the only writer that can *remove* ground, was skipped.

So those columns were never carved into a river, and were now permanently exempt
from the one pass that would otherwise have levelled them. **Protection without
materialization leaves a hole.** If the ground there was sunken, my change kept
it sunken.

That is my error from last session, and it is the part I most needed to correct.

## What runs with your exact command

I traced it rather than assuming:

| Phase | Runs? | Why |
|---|---|---|
| `seed_production_harthmere_extension_terrain` | **NO** | `HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1` |
| `reconcile_production_world_sync` | **YES** | you set neither `HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION` nor `HARTHMERE_SKIP_RECONCILIATION_AFTER_TERRAIN` |
| → `run-harthmere-production-reconciliation.sh` | **YES** | via `run_azure_world_sync_job` (`HARTHMERE_WORLD_SYNC_RUNNER_MODE=azure-job`) |
| → `repair_extension_surface` | **YES** | `HARTHMERE_SKIP_EXTENSION_SURFACE_REPAIR` unset |
| → live-creature grounding | **NO** | `HARTHMERE_SKIP_LIVE_CREATURE_GROUNDING_RECONCILE=1` |

So the reconciliation **does** run. That is the path the fix has to live in.

## The fix

A new writer that can cut the channel, running in the reconciliation phase your
command executes, and deliberately **not** gated by the terrain-seed skip.

**`src/shared/harthmere/harthmere_authored_water_plan.ts`** — the per-column
plan: what to clear, what to place, what water level each voxel holds. Pure and
fully tested. Boxed in hard, because this is the only pass in reconciliation
that can delete a voxel:

- only columns inside the authored water footprint;
- never a voxel above the ground plane, so player builds and the authored bridge
  decks are out of reach;
- never below the authored bed — a genuine deep pit is reported, not excavated;
- idempotent by construction: every edit is a difference against a probe of the
  live world, so a second run over a correct river plans nothing;
- a voxel a player has edited (present in `shard_diff`) is never overwritten,
  the same rule the surface repair already follows.

**`scripts/harthmere/materialize-harthmere-authored-water.cjs`** — the writer.
Scans only the shards that carry authored water, plans each column, applies
terrain into `shard_seed` and levels into `shard_water`.

**Wired into `run-harthmere-production-reconciliation.sh`** immediately *before*
`repair_extension_surface`. The order is load-bearing: materialize the channel
first, then let the repair handle everything that is genuinely damaged. It also
runs in the `town-only` path, since that is used after targeted terrain
maintenance.

## The gate

Extended `test-harthmere-river-deploy-durability-contract.cjs` (already in the
no-browser contract phase of the native-ECS gate) with two checks:

- the reconciliation calls the materializer **immediately before** the surface
  repair, in both paths;
- the materializer is **not** gated by `HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED`.

I mutation-tested these rather than trusting them. The first version of the
ordering check **passed while the materializer was unwired** — an `indexOf` over
the raw file happily matched inside a commented-out call, and the town-only call
site satisfied "appears somewhere earlier". It is now a line-based check that
the call *immediately* preceding the repair is the materializer, and it fails
correctly when the main path is unwired.

## Tests

```sh
scripts/harthmere/t.sh water   # 99 passing  (was 84; +15 for the plan)
scripts/harthmere/t.sh boards  # 70
scripts/harthmere/t.sh boards:e2e  # 10
scripts/harthmere/t.sh postgimme   # 38
node scripts/harthmere/test-harthmere-river-deploy-durability-contract.cjs .
```

The plan suite covers materializing a paved-over channel, re-flooding a channel
that was carved but left dry (exactly what an ordinary deploy produced),
draining water that should not be there, laying a floor under a hollow bed, and
idempotence at every node of the course. Two of those tests initially failed on
my own fixtures — the probe did not model the plank decks where the wilds trails
cross the river — which is precisely what the idempotence test is for.

## What I could not determine, and what I need from you

**The black ground.** I could not diagnose it from the artifacts. Your HAR is
HTTP traffic only — terrain arrives over the sync WebSocket, which a HAR does
not capture — and the log shows a clean bootstrap (1002 changes, no terrain
errors) with only an FPS warning. The only Harthmere-space coordinates in the
HAR are **2134, 53, −202** (authored 534, −202, inside the walled town) and
**2452/2460, 53, 92–100** (authored 852/860, out in the back country). All at
Y=53, which is the normal feet plane — so nothing in the HAR actually shows
sunken ground.

Black usually means one of: a missing shard rendering as void, or sky-occlusion
/ irradiance never simulated for that shard so it renders unlit. Those have
different fixes, and I would be guessing.

To pin it down, either would settle it:

1. the coordinates you were standing at when you took that screenshot, or
2. `node scripts/harthmere/audit-production-extension-terrain.cjs` against the
   production Redis — it reports surface holes with exact positions.

**Unverified:** I cannot reach a Redis or run the game here, so the
materializer's write path — the Redis read, the `shard_water` load/save, the
`editor.commit()` — is not exercised. The plan it drives is thoroughly tested;
the I/O around it is code review only. I would run it once with `APPLY` unset
(it reports the plan and writes nothing) before letting the deploy apply it.
