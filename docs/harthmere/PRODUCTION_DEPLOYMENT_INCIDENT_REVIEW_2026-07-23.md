# Harthmere Production Deployment Incident Review — July 21-23, 2026

## Purpose

This is the durable handoff for the multi-attempt Harthmere production rollout.
It records what actually failed, what was only a policy gate, what recovered
without code changes, and what the deployment wrapper must prove automatically.
It is deliberately separate from live revision names and current traffic state;
those are operational facts that change after every deployment.

The one-shot entry point remains:

```bash
scripts/glitch/deploy-production-local-redis-smoke.sh --push --tag <immutable-tag>
```

If that exact image is already in ACR and only the rollout needs to resume:

```bash
IMAGE_WAS_PUSHED=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh \
  --skip-build \
  --push \
  --tag <same-immutable-tag>
```

Never reuse `IMAGE_WAS_PUSHED=1` unless the complete image manifest is present
in ACR. An interrupted Buildx push is not a completed image upload.

## What happened

### Runtime and simulation isolation

The original production stack co-located web, Anima, and Gaia. Native-worker
memory brought a 16 GiB public replica close to exhaustion and caused unhealthy
starts. Commit `8b6dd8f6` isolated Anima/Gaia into
`biomes-simulation-vnet`; later startup and sparse-terrain changes were added in
`4e054c8e`, `04be893f`, `c4ec6996`, `513b3d52`, and `98015ff9`.

Permanent rule: the web role runs with Anima and Gaia disabled, the simulation
role has its own D4 replica and explicit memory budgets, and both roles must use
the same immutable image tag.

### Private Redis and reconciliation placement

The workstation and GitHub-hosted runner could not reliably execute production
world reconciliation against private Redis. Commits `f5ff57e6` and `7e096637`
moved the operation into a temporary Container Apps job in the production VNet
and packaged its narrow TypeScript runtime.

Permanent rule: do not make Redis public for deployment. Use the in-VNet job,
delete it on success or failure, and reserve workload-profile capacity before
creating it.

### Terrain maintenance memory and startup behavior

An unbounded terrain rebuild accumulated too much serialized state. Commit
`5ec5bd77` changed terrain construction and application to 16-shard batches.
A maintenance web revision then collided with Azure's combined revision-name
limit, fixed by `3e3f3c53`. A complete terrain rebuild also exceeded the web
startup-probe window, so `b75e1daa` moved it to a Container Apps job.

The first job command was serialized incorrectly by Azure CLI because a
dash-prefixed Node argument was parsed as an Azure option. Commit `85c7464b`
base64-wrapped the eval command into one argument.

Permanent rule: terrain maintenance is a job, not a web startup side effect;
the job uses 16-shard batches, a bounded revision/job name, a correctly encoded
command, a long explicit timeout, and a completion marker followed by a full
read-back audit.

### The apparent pre-terrain stall

The terrain job repeatedly initialized Redis/Bikkie without reaching terrain
progress logs. The expensive preflight inspected a retired 10,000-ID band using
sequential 500-entity `worldApi.get()` batches and later issued a large
`worldApi.has(ids)` call. That made the operation look hung and made diagnosis
depend on inference instead of direct progress evidence.

The path was changed to bounded Redis/component inspection, chunked existence
checks, and explicit batch progress. Retired terrain cleanup remains required:
the retired ID band can overlap legitimate NPC records, so cleanup removes only
terrain-shaped records and must never blindly delete the whole band.

Permanent rule: every long preflight reports bounded progress, and an audit
must distinguish stale terrain from overlapping non-terrain entities.

### Azure revision reuse and capacity

After a failed validation and rollback, a later `az containerapp update` could
return the same candidate revision in an inactive state. The wrapper then
waited for replicas that Azure would never start. Separately, stale active
zero-traffic revisions consumed D4 cores and caused `Maximum Allowed Cores`
errors when maintenance jobs were created.

Permanent rule: explicitly activate the returned candidate before waiting, and
deactivate active zero-traffic revisions before allocating maintenance jobs.
Never deactivate the serving revision or the new candidate during this step.

### Browser crashes that local checks missed

Production reached a client-side exception even though source-level checks and
server health probes passed. The deployment needed the real install-to-player
browser path against the concrete revision, not only root HTML or API health.
Commit `d0c5506e` repaired production client boot and terrain maintenance;
`35eb9806` refined the browser E2E for a benign aborted vitals request.

A synthetic install ID produced an upstream 404 despite a healthy candidate.
A known non-secret test install is now the default. One candidate also returned
`loading-stalled` during first cold execution and passed the same E2E unchanged
after warmup.

Permanent rule: use a real test install, require auth, sync, client context, and
rendered player state against the revision FQDN, retain artifacts per attempt,
and permit exactly one delayed warmup retry. A second failure is real.

### Reconciliation gates that were not catastrophic failures

All 19 business outposts and ECS/shared-state repairs completed, but the final
connector check found one blocked-headroom cell at `(897, 62, -209)`. The
connector had already been materialized and the candidate itself remained
usable. A later grounding pass repaired 148 records and reported 12 unsupported
extension surfaces with zero unresolved records.

These outcomes exposed a distinction between write/read-back failure and a
policy gate. Automatic rollback after completed irreversible world writes made
the release harder to reason about without undoing those writes.

Permanent rules:

- Materialize all 19 outposts before the connector.
- The Grove-to-Harthmere connector is the final terrain writer.
- Do not rerun an already completed connector merely because a later app check
  failed; reconciliation must be idempotent and able to skip completed phases.
- Grounding is a hard failure when unresolved repairs remain. Unsupported
  surface classifications with zero unresolved repairs are recorded for
  follow-up and can be treated as a non-catastrophic policy result.
- Run creature reconciliation while simulation is paused so the read-back is
  not invalidated by concurrent movement.

### Gaia recontaminated correctly maintained terrain

Forced terrain maintenance passed with 2,304 expected foundation shards, 576
surface shards, and zero Muck. After the dedicated simulation restarted, the
same audit found atmospheric Muck across Harthmere. This proved the maintenance
writer and tensor persistence were working; the changing result came from the
active Gaia Muck simulation.

The Muck gradient normally increases Muck in shards without nearby unmuckers.
Harthmere extension shards therefore became contaminated after a successful
zero-Muck write. The fix in `src/server/gaia/simulations/muck.ts` suppresses
Muck inside the additive Harthmere X/Z bounds while preserving normal behavior
outside them.

Permanent rule: pause simulation before terrain/ECS writes, then restart the
matching simulation image and repeat the complete terrain audit after Gaia is
ready. The deployment is not complete until the active-Gaia audit still reports
zero atmospheric Muck.

## One-shot deployment contract

The wrapper now owns this sequence:

1. Run source guardrails and build artifacts once.
2. Build and upload one immutable image tag once.
3. Capture current web traffic for rollback.
4. Update the web candidate and explicitly activate it if Azure reused an
   inactive revision.
5. Free stale zero-traffic web revisions that consume capacity.
6. Pause the simulation app and remember its previously active revisions.
7. Run forced terrain maintenance and require
   `HARTHMERE_TERRAIN_MAINTENANCE_READY`.
8. Require 2,304 foundations, 576 surface shards, and zero missing, invalid,
   empty, holed, Muck, atmospheric Muck, and retired records.
9. Require 3/3 candidate replicas and zero restarts.
10. Run the revision-specific real-install browser E2E, with one warmup retry.
11. Reconcile outposts, ECS/shared state, connector, grounding, and creatures;
    require `HARTHMERE_PRODUCTION_RECONCILIATION_READY`.
12. Shift traffic to the verified candidate and validate public APIs/assets.
13. Deploy the same image to the simulation app; require
    `GLITCH_SIMULATION_ROLE_READY anima=1 gaia=1` and zero restarts.
14. Wait briefly for Gaia ticks, rerun the terrain audit, and require zero Muck.
15. Force Redis `BGSAVE` after that final audit.
16. Delete temporary jobs and deactivate stale revisions.

If a phase fails before the replacement simulation is ready, cleanup restores
the previously active simulation revision. Traffic rollback remains independent
and uses the traffic weights captured before the web update.

## Local verification before paying for a deployment

Run the complete local rehearsal for the exact source tree:

```bash
ELEVENLABS_API_KEY=... \
scripts/glitch/deploy-production-local-redis-smoke.sh --local-rehearsal
```

For lower-memory machines, run the deterministic source and wrapper checks
without booting the full production container:

```bash
bash -n scripts/glitch/deploy-production-local-redis-smoke.sh
node scripts/glitch/test-production-deploy-local-redis-smoke.cjs .
node scripts/harthmere/check-harthmere-extra-town-offset.cjs
git diff --check
```

The local rehearsal is allowed to use disposable local Redis. Production Redis
must remain private and must not be opened to the internet for testing.

## Operator rules

- Do not rebuild an existing immutable tag to recover a rollout failure.
- Do not infer a stall from repeated initialization logs; require phase and
  batch progress or inspect the exact blocked call.
- Do not use synthetic install IDs for the production browser gate.
- Do not run terrain or creature reconciliation concurrently with Gaia.
- Do not declare success from a pre-Gaia terrain audit.
- Do not flush Redis as a normal deployment step.
- Do not expose Redis publicly to make local testing easier.
- Do not delete overlapping retired-ID records without checking components.
- Do not let a known non-catastrophic policy warning erase completed world
  writes or automatically disqualify a healthy candidate.
- Do not clean up the last known-good revision until web, reconciliation,
  simulation, active-Gaia terrain audit, and Redis persistence have all passed.

