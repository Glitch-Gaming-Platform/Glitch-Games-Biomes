# Biomes Container Apps Production Issue Log

## 2026-08-06 — Dedicated workload profile had no replacement headroom

### Symptoms

- The Glitch play page loaded, but the embedded game could stall during
  bootstrap or appear not to load.
- The active web revision still reported `Healthy`, masking the loss and slow
  replacement of individual replicas.
- One client reported `ClientLongLoad` at `bootstrapping`.

### Root cause

The `d4-prod` profile had `minimumCount=3`, but production steady state already
consumed four full D4 nodes: three `biomes-node-vnet` replicas and one
`biomes-simulation-vnet` replica. The node-count metric sat at four, so there was
no warm replacement capacity.

Azure evicted three web pods within six minutes and emitted repeated
`AssigningReplicaFailed: Insufficient capacity on workload profile 'd4-prod'`
events while it scaled the node pool. Replacement pods were slow because the
image was about 4.9 GB and the multi-service web role needed additional startup
time after the pull.

### Fix

- Raised `d4-prod` to `minimumCount=6`, `maximumCount=10`.
- Reserved two full-node replacement slots beyond the four steady replicas.
- Added workflow defaults for the six-node floor.
- Added `ensure_azure_workload_profile_capacity` to the guarded deploy so every
  production update raises and verifies the live profile before creating the
  app revision.
- The guard now waits for `properties.currentCount` to reach the six-node floor;
  accepting only the configured minimum could start a revision while Azure was
  still provisioning the replacement nodes.
- Added a regression assertion to
  `scripts/glitch/test-production-deploy-local-redis-smoke.cjs`.
- Verified a fresh real Glitch launch completed the 1,002-change bootstrap and
  reached the gameplay HUD without browser errors.

Full diagnosis and recovery commands:
`docs/production/biomes-containerapp-workload-profile-capacity-20260806.md`.

### 15:04 UTC follow-up and client self-healing

- At `15:04:04 UTC`, one `live_mode` POST returned 500 after 25.048 seconds
  because the per-actor Redis authority lock timed out.
- At `15:04:29 UTC`, Azure reported `NodeNotReady` for a different replica. The
  browser also recorded a Sync keepalive timeout and a failed OOB-backed
  `/scene/placeable/mesh` update in the same interval.
- Azure evicted that pod at `15:09:29 UTC`; its replacement reported normal
  cold-start probe failures from `15:11:00` through `15:13:01 UTC` before it
  became ready. There were no new insufficient-capacity events or application
  5xx responses after `15:05 UTC` in the inspected window.
- `NodeCount` remained six and the app stayed at three replicas, so the raised
  floor prevented the earlier prolonged replacement-capacity collapse. It
  cannot prevent a request already pinned to a failing node from seeing a brief
  disconnect.
- Business mutations are now serialized in the browser before reaching the
  cross-replica actor lock, preventing one degraded request from creating a
  mutation pileup.
- Optional placeable metadata updates now fail soft: the existing mesh remains
  visible and later metadata updates continue, rather than caching a rejected
  mesh resource until the player reloads.
- The browser `unload` permissions-policy message, GPT deprecations, Twitch CSP
  rejection, and initial 409 launcher conflicts were not the land-loading root
  cause.

## v138 patch-only issues encountered and solved

1. Full-body `az rest --method put` against the Container App resource included Azure-returned fields that are not accepted in the request body, such as `targetPortHttpScheme`. This caused validation errors.

2. Container App revision management was complicated by single-revision mode. Traffic routing alone was not the safe recovery path.

3. Runtime config had to avoid unsupported runtime mode values that caused validation/string-literal errors.

4. Production Redis already exists as a VM: `biomes-redis-prod`, located in `eastus`, tagged as the production Redis for Biomes/Harthmere.

5. v137 correctly moved toward production Redis instead of local Redis. The observed Redis target was `10.0.0.12:6379`.

6. Web and sync startup were largely correct: web on `3000`, sync on `4900`, and same-origin `/sync` routing.

7. The remaining fatal issue was the stack treating OOB RPC readiness on `127.0.0.1:4704` as required. OOB RPC can lag or be unavailable while web/sync still serve the app.

## Final patch decision

Keep the existing stack startup flow, but make only the OOB RPC readiness check non-fatal.

Do not change Redis, shim, web, sync, logic, ports, ingress, Azure resources, or revision settings in this patch.

This is intentionally a tiny source patch only.
