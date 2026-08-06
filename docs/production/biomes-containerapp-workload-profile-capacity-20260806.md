# Biomes Container Apps Workload-Profile Capacity Incident — 2026-08-06

## Summary

The Glitch play page could load while the embedded Biomes game stalled or took
long enough to appear unavailable. The serving Container App revision still
reported `Healthy`, so revision health alone hid the incident.

The failure was Azure dedicated-workload-profile capacity, not a Redis crash,
bad image, or failed HTTP ingress:

- `biomes-node-vnet` requires three D4 nodes because each public replica requests
  the full `4 CPU` / `16Gi` D4 allocation.
- `biomes-simulation-vnet` requires one more full D4 node.
- The `d4-prod` profile had `minimumCount=3`, while steady state already needed
  four nodes.
- The node-count metric sat at exactly four before the incident, leaving no
  replacement capacity.
- Azure tainted and evicted three public pods at `13:18:59`, `13:22:19`, and
  `13:24:59 UTC` on August 6, 2026.
- Replacement scheduling emitted repeated `AssigningReplicaFailed` events with
  `Insufficient capacity on workload profile 'd4-prod'` while the profile
  scaled out.
- The production image was about 4.9 GB and one observed pull took about 85
  seconds. The full multi-service web role then needed additional minutes to
  open public port `3000`, so replacement readiness lagged behind the evictions.

In the 24-hour window inspected during recovery, Azure logged 76 insufficient-
capacity assignment events, six taint-manager evictions, and 11 scale-up
triggers for the public app.

## User-visible and application signals

The browser could reach the Glitch shell and start the game iframe. Affected
sessions could connect to `/sync` and receive the initial entity-id stream but
remain on the loading screen while the selected replica or its node was being
replaced. One captured session reported:

```text
ClientLongLoad: Load screen stuck at "bootstrapping" for >= 10s.
```

This signal by itself does not prove an ECS bootstrap defect. Correlate its UTC
timestamp with Azure system events before changing the sync protocol. A later
launch on stable capacity completed the same 1,002-change bootstrap and entered
the game without browser errors.

The supplied HAR was truncated in the middle of a third-party Stripe response,
so it contained the launcher requests but not the later embedded-game requests.
When a HAR is incomplete, use its first request timestamp to bound the Azure
query instead of treating the absence of HTTP failures as proof that production
was healthy.

## Follow-up correlation at 15:04 UTC

A later captured session showed the shorter failure mode that remains possible
when an individual Azure node becomes unavailable even after replacement
headroom is provisioned:

- `15:04:04 UTC`: `/api/harthmere/live_mode` returned 500 after `25.048s` with
  `Harthmere live-mode actor authority lock timed out`.
- `15:04:29 UTC`: Container Apps emitted `NodeNotReady` for
  `biomes-node-vnet--0000233-5c56fbbb46-v9k2k`.
- `15:09:29 UTC`: Azure marked that pod for taint-manager eviction. The
  replacement pod's expected cold-start probes failed from `15:11:00` through
  `15:13:01 UTC` while the large image and multi-service role started.
- The browser recorded `/sync/keepAlive` cancellation, reconnected the
  WebSocket, and then logged `Failed to fetch` while refreshing
  `/scene/placeable/mesh` metadata.
- The D4 `NodeCount` stayed at six and the public app metric stayed at three
  replicas. This confirms the capacity floor prevented a replica-count collapse,
  while the already-routed client request still experienced the failed node.
- No new `AssigningReplicaFailed`/insufficient-capacity events or application
  5xx responses appeared after `15:05 UTC` in the inspected recovery window.

The permissions-policy `unload` warning, Google Publisher Tag deprecations,
Twitch frame CSP rejection, and launcher 409 responses are unrelated console
noise. The actionable chain is node degradation -> request/Sync interruption ->
actor-lock queueing and failed optional world-resource refresh.

Source mitigations now complement the Azure floor:

1. Production deployment waits for the workload profile's live
   `properties.currentCount`, not only its configured minimum.
2. Browser business mutations serialize before they reach the cross-replica
   actor lock, so one degraded request applies backpressure instead of creating
   more lock waiters.
3. Optional OOB-backed placeable metadata updates retain the existing mesh and
   continue later updates after a transient fetch failure, avoiding a manual
   reload to restore the object.

## Diagnosis commands

Set the production resource names once:

```bash
RG=openai-resource-group
ENV=glitch-prod-vnet-env
WEB_APP=biomes-node-vnet
SIM_APP=biomes-simulation-vnet
PROFILE=d4-prod
```

Inspect the configured workload-profile floor and ceiling:

```bash
az containerapp env show \
  --resource-group "$RG" \
  --name "$ENV" \
  --query "properties.workloadProfiles[?name=='$PROFILE'] | [0].{min:minimumCount,max:maximumCount,type:workloadProfileType}" \
  -o json
```

Confirm the two apps' steady full-node demand:

```bash
az containerapp show -g "$RG" -n "$WEB_APP" \
  --query '{profile:properties.workloadProfileName,minReplicas:properties.template.scale.minReplicas,maxReplicas:properties.template.scale.maxReplicas,resources:properties.template.containers[0].resources}' \
  -o json

az containerapp show -g "$RG" -n "$SIM_APP" \
  --query '{profile:properties.workloadProfileName,minReplicas:properties.template.scale.minReplicas,maxReplicas:properties.template.scale.maxReplicas,resources:properties.template.containers[0].resources}' \
  -o json
```

Pull recent system events directly:

```bash
az containerapp logs show \
  --resource-group "$RG" \
  --name "$WEB_APP" \
  --type system \
  --tail 300
```

For a historical window, query the environment's Log Analytics workspace:

```bash
WORKSPACE_ID="$(az containerapp env show \
  -g "$RG" -n "$ENV" \
  --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId \
  -o tsv)"

az monitor log-analytics query \
  -w "$WORKSPACE_ID" \
  --analytics-query '
ContainerAppSystemLogs_CL
| where TimeGenerated >= ago(24h)
| where ContainerAppName_s in ("biomes-node-vnet", "biomes-simulation-vnet")
| where Reason_s in ("AssigningReplicaFailed", "TriggeredScaleUp", "TaintManagerEviction", "ReplicaUnhealthy")
    or Log_s contains "Insufficient capacity"
| project TimeGenerated, ContainerAppName_s, RevisionName_s, ReplicaName_s, Reason_s, Log_s
| order by TimeGenerated asc
' \
  -o table
```

Inspect actual node count, not only the configured minimum:

```bash
ENV_ID="$(az containerapp env show -g "$RG" -n "$ENV" --query id -o tsv)"

az monitor metrics list \
  --resource "$ENV_ID" \
  --metric NodeCount \
  --filter "workloadProfileName eq '$PROFILE'" \
  --interval PT5M \
  --aggregation Minimum Average Maximum \
  -o table
```

`NodeCount=4` is the dangerous zero-headroom steady state for the current
topology. A temporary value above six is normal during replacement or scale-in.

## Live recovery

The live repair raised the dedicated D4 floor from three to six nodes while
leaving the existing ten-node ceiling unchanged:

```bash
az containerapp env workload-profile update \
  --resource-group openai-resource-group \
  --name glitch-prod-vnet-env \
  --workload-profile-name d4-prod \
  --min-nodes 6 \
  --max-nodes 10
```

Six nodes cover the four steady full-node replicas plus two replacement slots.
Two slots are required because the incident contained multiple evictions inside
one cold-start window.

This operation updates the managed environment, not the application revision.
The environment can report `Updating` for several minutes while the existing
web revision remains `Healthy` and continues receiving 100% traffic. Verify all
of the following before declaring recovery complete:

```bash
az containerapp env workload-profile list \
  -g openai-resource-group \
  -n glitch-prod-vnet-env \
  --query '[?name==`d4-prod`].{current:properties.currentCount,min:properties.minimumCount,max:properties.maximumCount}' \
  -o table

az containerapp env show -g openai-resource-group -n glitch-prod-vnet-env \
  --query '{state:properties.provisioningState,profile:properties.workloadProfiles[?name==`d4-prod`] | [0]}' \
  -o json

az containerapp revision list -g openai-resource-group -n biomes-node-vnet \
  --query '[?properties.active==`true`].{name:name,health:properties.healthState,provisioning:properties.provisioningState,replicas:properties.replicas,traffic:properties.trafficWeight}' \
  -o table

az containerapp revision list -g openai-resource-group -n biomes-simulation-vnet \
  --query '[?properties.active==`true`].{name:name,health:properties.healthState,provisioning:properties.provisioningState,replicas:properties.replicas}' \
  -o table
```

Then run a real Glitch launch and require the gameplay HUD to appear. Do not
stop at a `200` response from `/`; the launcher and static page can succeed while
game bootstrap is degraded.

## Permanent deployment guardrail

The production workflow and guarded deploy script now define:

```text
AZURE_WORKLOAD_PROFILE_NAME=d4-prod
AZURE_WORKLOAD_PROFILE_REPLACEMENT_HEADROOM_NODES=2
AZURE_WORKLOAD_PROFILE_MIN_NODES=6
AZURE_WORKLOAD_PROFILE_MAX_NODES=10
```

Before creating or updating the public revision,
`scripts/glitch/deploy-production-local-redis-smoke.sh` now:

1. Computes the required floor as public minimum replicas + simulation minimum
   replicas + replacement headroom.
2. Refuses a configured floor below that requirement.
3. Reads the live managed-environment profile.
4. Raises the live minimum or maximum when either is below the deployment
   contract.
5. Verifies the resulting values and waits until `currentCount` reaches the
   required warm-node floor before continuing to Redis checks or the Container
   App update.
6. Never lowers a larger manually configured floor or ceiling.

The regression assertion lives in
`scripts/glitch/test-production-deploy-local-redis-smoke.cjs`.

## Rules going forward

- Do not lower `d4-prod` below six nodes while production remains three web D4
  replicas plus one simulation D4 replica.
- Do not spend the two replacement slots on ordinary permanent workloads. Raise
  the floor first if another full-node app or replica is added.
- Keep `maximumCount` at least as large as `minimumCount`; the current ceiling is
  ten.
- Treat `TaintManagerEviction` plus `AssigningReplicaFailed` as an infrastructure
  availability incident even if the revision-level health label remains green.
- Correlate `ClientLongLoad` with Azure system events and node metrics before
  changing client bootstrap or Redis code.
- Verify a real game launch after capacity or revision changes.
- A lower floor is an emergency cost rollback only and knowingly restores the
  zero-headroom failure mode. Update the application topology first if the
  steady node requirement is expected to fall.
