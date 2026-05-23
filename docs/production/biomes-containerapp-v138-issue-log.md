# Biomes Container Apps Production Issue Log — v138 Patch-Only

## Issues encountered and solved

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
