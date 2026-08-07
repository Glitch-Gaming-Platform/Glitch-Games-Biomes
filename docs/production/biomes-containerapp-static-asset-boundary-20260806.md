# Container App static asset boundary incident — 2026-08-06

## Summary

Production game startup and rendering failed because the web image contained a
new `src/galois/js/interface/gen/asset_versions.json` but did not contain seven
binary files referenced by that index. The shared failure was:

```text
/buckets/biomes-static/asset_data/wearables/animations.318bbbe77f5055a4d465e12ca61f133f.glb
```

The bucket proxy correctly searched the image, attempted its configured public
fallback, and returned `403` with:

```text
X-Glitch-Bucket-Asset-Proxy: GLITCH_LOCAL_BUCKET_ASSET_PROXY; source=remote-miss
```

That animation bundle is a dependency of player and NPC mesh construction, so
one missing file cascaded into repeated resource failures and unhandled promise
rejections even though authentication, Bikkie loading, and world sync were
healthy.

## Root cause

`public/buckets` is intentionally Git-ignored. Generated TypeScript and JSON
files are shared by Git, but hydrated/generated bucket bytes are local to each
worktree. The production image was built from a workspace whose bucket mirror
still had the original snapshot animation file while its tracked
`asset_versions.json` referenced newer Harthmere exports.

The release checks only required a coarse bucket file count and probed a fixed
set of historical hash URLs. Both checks could pass while a newly advanced
asset index referenced files missing from the image. The production asset probe
also ran after traffic promotion.

The public Google Cloud Storage fallback returned `403`, so it could not mask
the invalid image. Production is expected to serve these assets from packaged
local files; fallback availability is not a release-integrity substitute.

## Corrective controls

The deployment path now fails closed at three boundaries:

1. Before compilation, every `asset_versions.json` target must exist in the
   exact build workspace.
2. `Dockerfile.biomes` repeats that validation after copying `src`, `scripts`,
   and `public/buckets`, proving the immutable image contains the same boundary.
3. The zero-traffic Azure revision must serve dynamically resolved current
   runtime canaries with `source=local` before traffic promotion. The public
   production FQDN is checked again after promotion.

The canaries include the shared wearable animation bundle plus current
Harthmere audio and Indisworm render assets that were absent from the failed
image.

## Diagnosis

Check the live proxy response:

```bash
curl -sS -D - -o /tmp/asset-body \
  "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io/buckets/biomes-static/<asset-path>"
```

Interpret `X-Glitch-Bucket-Asset-Proxy` as follows:

- `source=local:*`: packaged image asset; expected for production canaries.
- `source=remote`: local image miss hidden by the fallback; investigate before
  the next release.
- `source=local-miss`: missing locally and remote fallback disabled.
- `source=remote-miss`: invalid image plus unavailable/missing remote object.

Validate a workspace or an already-loaded candidate image:

```bash
node scripts/harthmere/check-snapshot-asset-version-boundary.cjs .

docker run --rm --platform linux/amd64 \
  --entrypoint node <candidate-image> \
  scripts/harthmere/check-snapshot-asset-version-boundary.cjs /app
```

## Recovery

Hydrate or export all current generated bucket files in the same workspace used
for Docker, then build a new immutable image tag. Do not overwrite or resume the
invalid tag. For an asset-only incident that does not require world mutations,
use the guarded app-only rollout:

```bash
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push --tag <new-tag>
```

The deploy must stop before traffic if the concrete revision returns anything
other than `200` and `source=local` for the current canaries.
