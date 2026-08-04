# Asset loading performance audit — 2026-08-04

**Scope:** how assets get from the Galois pipeline / Bikkie / `public/` into the running
client: transport, formats, dedupe, caching, boot ordering, and memory. Complements
`HARTHMERE_RENDER_PERF_AUDIT_2026-08-03.md` (per-frame GPU/CPU) and
`HARTHMERE_MOBILE_OPTIMIZATION_AUDIT_2026-08-04.md` (device-specific). Every number below
was measured in this checkout against the `.next` build dated Aug 4 10:21.

**Short answer to the question asked.** Galois is being *used* correctly — logical paths,
`resolveAssetUrl`, content-addressed immutable objects, correct cache headers on
`/buckets/*`. Bikkie is also wired correctly. The losses are almost all in the **layers
around** them: HTTP compression is off in production, the Galois *exporter* writes binary
assets as pretty-printed base64 JSON, several runtime paths re-fetch and re-parse the same
GLB once per entity, and audio prefetches ~45 MB and decodes it all to PCM at boot. The
single biggest item is one line in `next.config.js`.

---

## Ranked findings

| # | Finding | Layer | Impact | Effort | Status |
|---|---------|-------|--------|--------|--------|
| 1 | `compress: !isProd` — HTTP compression disabled in production, no nginx in the ACA path | Transport | **Very high** (~20 MB/cold load) | Trivial | 🔲 OPEN |
| 2 | 6.88 MB service worker containing the entire Harthmere asset/voice manifest set | Boot | **Very high** | Low | 🔲 OPEN |
| 3 | Cayley WASM (5.74 MB) on the boot path for `positionHash` + land-claim boundaries | Boot | **High** | Low | 🔲 OPEN |
| 4 | 111 audio files prefetched on desktop; 10 music tracks decoded to PCM and left playing at gain 0 | Boot/RAM | **High** | Low | 🔲 OPEN |
| 5 | Galois exporter writes binary payloads as pretty-printed base64 JSON (`item_meshes` 55 MB, atlases 2.8 MB) | Pipeline | **High** | Med | 🔲 OPEN |
| 6 | Per-entity `loadGltf()` for boss / muck-creature / grove NPC meshes — no URL-keyed cache | Runtime | **High** | Low | 🔲 OPEN |
| 7 | 108 uncompressed `.gltf` (70 MB) and zero `.ktx2`; decode infra wired and idle | Pipeline | Med–High | Med | 🔲 OPEN (= render audit #15) |
| 8 | `asset_versions.json` — all 2 774 entries (353 KB / 74 KB gz) in the main bundle | Boot | Med | Med | 🔲 OPEN |
| 9 | 12.0 MB of JS on the game route, 44 render-blocking chunks | Boot | Med | Med | 🔲 OPEN |
| 10 | Content hash computed as `hash(buffer.toString())` — lossy UTF-8 decode of binary | Pipeline | Correctness | Trivial | 🔲 OPEN |
| 11 | First Bikkie load is deliberately uncacheable and re-serializes the whole tray server-side | Boot | Low–Med | Low | 🔲 OPEN |
| 12 | ~1.1 GB of source-format and marketing assets baked into the container image | Deploy | Med (ops) | Low | 🔲 OPEN |
| 13 | Base64-in-JSON atlas decode still synchronous on the main thread | Boot | Med | Med | 🔲 OPEN (= render audit #5) |

---

## 1. Compression is off in production (do this one first)

`next.config.js:42`

```js
compress: !isProd,
```

Production runs `next start` directly (`scripts/glitch/run-glitch-web.sh:47`), and
`Dockerfile.biomes` contains no nginx or other proxy — the Node process is the origin. The
`gzip on` block in `deploy/k8/nginx.conf:44` belongs to the retired GKE deployment, which is
almost certainly why this line was safe upstream and is not safe now. Azure Container Apps
ingress does not compress responses for you.

Measured, on the current build:

| Asset | Raw | gzip -6 | Ratio |
|---|---|---|---|
| `/at/[[...slug]]` JS (44 chunks) | 11.99 MB | 2.86 MB | 4.2× |
| `public/sw.js` | 6.88 MB | 1.93 MB | 3.6× |
| cayley `7d3804ad08c9dbf1.wasm` | 5.74 MB | 1.11 MB | 5.2× |
| voxeloo `wasm.1065719a.wasm` | 2.26 MB | 0.54 MB | 4.2× |
| 3 × atlas JSON | 2.80 MB | 0.19 MB | **14.7×** |
| `mapping/index.json` | 1.13 MB | 0.04 MB | **28×** |
| **Total above** | **30.8 MB** | **6.67 MB** | **4.6×** |

That is ~24 MB of avoidable transfer on every cold load, before a single item mesh, NPC GLB
or audio file. On cellular it is the difference between a slow start and a failed one, and
it makes every other loading finding in this document roughly 4× worse than it needs to be.

Note the atlases specifically: 2.80 MB → 0.19 MB. Finding #13 (ship the atlases as raw
binary) is still worth doing for the *decode* cost, but the *transfer* argument for it
mostly evaporates once gzip is on — base64 of image data is extremely compressible.

**Fix.** `compress: true` (or just delete the line; `true` is the Next default). Then verify
in one command:

```bash
curl -sI -H 'Accept-Encoding: gzip' https://<origin>/_next/static/chunks/1385-*.js | grep -i content-encoding
```

If that already reports `content-encoding: gzip`, something upstream is compressing and this
finding is void — but nothing in this repo does it. Brotli would be better still
(`shrink-ray-current`/`compression` in a tiny custom server, or enabling Front Door), but
gzip at level 6 captures most of the win for zero risk.

---

## 2. The service worker is 6.88 MB and ships the whole content catalogue

`src/client/service_worker.ts` exists to handle Firebase background push. It imports
`@/client/util/push_notifications` and `@/shared/logging`, and that import graph drags in the
entire shared Harthmere data layer. Verified by grepping the emitted `public/sw.js`:

```
harthmere                        13113 occurrences
assets/harthmere/glb               763
assets/harthmere/fbx               309
inventory_icons/generated          526
harthmere/voices                  2165
quaternius                        1103
asset_data/atlases                   6   ← asset_versions.json is in here too
```

It also bundles lodash, `buffer`, `assert`, `util`, `chalk`, `colors`, `prettyjson` and
`ua-parser-js` — Node-shaped logging dependencies that have no business in a push handler.

`registerPushManager` is bound in the **early** client context (`src/client/game/init.ts:152`),
and `push_manager.ts:103` calls `navigator.serviceWorker.register("/sw.js")`, so this
downloads during boot and re-downloads on every deploy (the SW script is revalidated
independently of the hashed bundles).

There is no upside here: `grep -c workbox public/sw.js` → **0**, so nothing is being
precached. It is 6.88 MB of dead weight for ~30 KB of Firebase glue.

**Fix.** Give the service worker its own minimal logging shim (`console.*`) and a
`push_notifications` entry point that does not reach into `@/shared/harthmere/*`. Add a
size guard test — `assert(statSync("public/sw.js").size < 512 * 1024)` — so this cannot
regress silently. Expected: 6.88 MB → well under 200 KB.

---

## 3. A 5.74 MB Rust WASM module is on the boot path for two small features

`.next/static/wasm/7d3804ad08c9dbf1.wasm` is `src/gen/cayley/impl/wasm_bundler_bg.wasm`,
referenced from chunk `9889`, which is in the `/at` page's chunk list. Its only two consumers
in the shipping client are:

- `src/client/game/resources/protection.ts:1-6` — `toQuads`, `buildQuadIndices`, `toLines`,
  `fromArray`, `makeArray`, `concat`, used to build land-claim / robot protection boundary
  geometry. Registered unconditionally at boot via `resources/init.ts:139`.
- `src/shared/game/terrain_helper.ts:1` — `positionHash`, which is **pure TypeScript**
  (`src/cayley/graphics/utils.ts:24-36`, a two-line integer hash). It only imports *types*
  from the numerics layer, so this one may already be free — confirm with the bundle
  analyzer rather than assuming.

Everything else under `@/cayley` is the `/art` tooling pages, which are already
`next/dynamic`.

**Fix.** Make the protection-boundary generator a dynamic `import()` inside the resource
generator, so the WASM downloads the first time a player actually looks at a protected
region — most sessions never will. 5.74 MB raw / 1.11 MB gzipped off the boot path.

---

## 4. Desktop prefetches 45 MB of audio and decodes ten music tracks into RAM

`audio_manager.ts:143-152`:

```ts
return mobileDevice ? [requestedTrack] : [...ALL_BACKGROUND_MUSIC_TRACKS];  // 10 tracks
export function shouldPrefetchAllAudioAssets(mobileDevice: boolean) { return !mobileDevice; }
```

`prefetchAudioAssets` (`:1053`) walks `audioFiles` — **111 entries** — and warms
`/audio/buffer` for each. The `asset_data/audio` tree is **44.8 MB across 119 files**, and it
includes `music-1` (8.2 MB), `muck-music-1` (8.3 MB) and `cave-music-loop` (6.4 MB). The
mp3 tracks under `public/assets/harthmere/audio/` add another 26.9 MB.

Two costs, and the second is the serious one:

1. **Transfer.** ~45 MB fetched at boot regardless of where the player is standing.
2. **Memory.** `fetchAudioBuffer` (`resources/audio.ts:41-56`) uses `THREE.AudioLoader`, i.e.
   `decodeAudioData` → fully decoded PCM resident in RAM. A 4.1 MB / ~4-minute 128 kbps loop
   decodes to roughly **80–90 MB** of Float32 PCM. Ten tracks preloaded — and each one is
   `.play()`ed immediately at `gain.value = 0` (`:400-407`) so it stays resident *and*
   processed by the audio graph — is on the order of half a gigabyte of decoded audio.

The mobile path already does the right thing (one track at a time, with
`releaseBackgroundMusicTracks()` invalidating the buffer). Desktop does not, and the mobile
audit's jetsam investigation attributed peak boot footprint to the 2.65 MB atlases — this is
two orders of magnitude larger and was not in scope there.

**Fix, in order:**

1. Preload **one** music track on desktop too, exactly as mobile does. The crossfade logic in
   `setBackgroundMusicTrack` already tolerates a not-yet-loaded target.
2. Play music through `THREE.Audio.setMediaElementSource(new Audio(url))` instead of a decoded
   `AudioBuffer`. Streaming media elements do not hold PCM; looping and gain still work. Keep
   `AudioBuffer` for short SFX, which is what it is good at.
3. Restrict `prefetchAudioAssets` to short SFX (say < 512 KB) and let ambience/music load on
   demand. Nothing in the frame path depends on a music buffer being warm.

---

## 5. Galois exports binary payloads as pretty-printed base64 JSON

`src/galois/js/assets/scripts/export.ts:86-88` is the fallback for every asset kind that is
not `Binary` / `PNG` / `GLTF` / `GLB` / `WEBM` / source:

```ts
private async exportJson(asset: l.Asset) {
  const data = await this.builder.buildUntyped(asset);
  return { extension: "json", data: JSON.stringify(data, null, 2) };
}
```

`ItemMesh` and the atlases land here, so what ships is: binary → base64 (+33%) → wrapped in
JSON → **indented with two spaces**. Measured:

| Family | Files | Size | Notes |
|---|---|---|---|
| `asset_data/item_meshes` | 732 | **55.2 MB** | `{"kind":"GLTFItemMesh", ... "data":{"kind":"GLB", "data":"<base64>"}}`; largest is `npcs/big_mucker` at 6.07 MB |
| `asset_data/atlases` | 3 | 2.80 MB | base64 colour/MREA arrays |
| `asset_data/*.json` total | 742 | 59.6 MB | |

The client then pays for the round trip in reverse: `jsonFetch` the whole document
(`resources/item_mesh.ts:325`), `JSON.parse` it, `decodeBase64ArrayBuffer` the payload
(`:347`), then hand the bytes to the GLB parser. All on the main thread.

Since the exporter *already* has a real `exportGLB` path (`:66`) that writes raw bytes, the
fix is mostly plumbing: teach the publisher to emit a sidecar — `foo.glb` for the payload plus
a small `foo.json` for `hand_attachment_transform` — or extend `ItemMeshData` so the client
fetches the GLB by URL. Expected ≈ 55 MB → ≈ 41 MB of transfer, minus the base64 decode and
the multi-MB `JSON.parse`, per item mesh.

Cheap intermediate step if the format change is too invasive right now: drop the `null, 2`
pretty-printing. It is free, it is a one-word diff, and on the small-and-numerous item meshes
(hundreds of files, each with a 16-element matrix printed one number per line) it is real.

---

## 6. NPC meshes are fetched and parsed once per entity, not once per asset

`resources/npcs.ts:6830` registers `/scene/npc/mesh` keyed by **entity id**. Inside
`makeNpcMesh` (`:6660`), three branches call the loader directly:

- `makeHarthmereBossNpcAssetMesh` → `loadGltfWithRetry(visual.assetUrl)` (`:6625`)
- `makeHarthmereMuckCreatureNpcAssetMesh` → `loadGltf(url)` (`:6596`)
- `makeSnapshotGroveNpcAssetMesh` → `loadGltfWithRetry(url)` (`:6553`)

So twenty muckers of the same species produce twenty `GLTFLoader` runs over the same URL:
twenty JSON/GLB parses, twenty sets of `BufferGeometry`, twenty texture uploads, twenty
animation-clip copies. The HTTP layer may serve those from cache (the `/buckets/*` immutable
header is correct), but **parse and VRAM are paid every time**. `alpha_mucker.glb` is 11.1 MB;
`thaedryn_bellbound.glb` is 12.3 MB.

The correct pattern already exists two functions up: `/scene/npc_type_mesh` (`:6829`) is keyed
by *type*, loaded once, and consumers clone it with `SkeletonUtils.clone` (`:3509`), which
shares geometry and materials. There is also an existing precedent for URL-keyed caching:
`"/scene/texture/url": PathDef<[string], Promise<Texture>>` (`resources/types.ts:476`).

**Fix.** Add `"/scene/gltf/url": PathDef<[string], Promise<Disposable<GLTF>>>`, route all three
branches through it, and have `makeNpcMesh` return `SkeletonUtils.clone(...)` of the shared
prototype. This is the highest value-per-line item in the document after finding #1, and it
reduces both hitching (parse) and VRAM (uploads) at the same time.

While in there: `gltf_helpers.ts:95` only coalesces in-flight fetches for
`/api/assets/player_mesh.glb`. Once a URL-keyed resource exists, that coalescing generalises
for free.

---

## 7. Still zero KTX2, still 70 MB of `.gltf` JSON

Unchanged since the 2026-08-03 render audit (#15) and the mobile audit (#7):

```
find public -name "*.ktx2" | wc -l   → 0
asset_data: 108 × .gltf = 70.0 MB     (big_mucker 15.5 MB, dragon_mucker 4.6 MB)
public/models: 78 PNG = 298.3 MB      (single baseColor textures up to 23.5 MB)
```

`gltf_helpers.ts:18-52` wires `MeshoptDecoder` and a `KTX2Loader` with a two-worker
transcoder pool, and `basis_transcoder.wasm` (527 KB) is *shipped in the build*. The client is
fully ready to consume compressed assets; nothing produces them. `assets:install-gltfpack`
already exists in `package.json`.

Note the shape of the loss: `exportGLTF` (`export.ts:61-64`) writes `.gltf` **JSON text** with
embedded base64 buffers (7 `data:application/octet-stream;base64` URIs in `big_mucker.gltf`).
Switching that one exporter to GLB, before any compression at all, removes the 33% base64
penalty and the JSON parse. `gltfpack -cc` with KTX2 output on top of that is typically
5–10× smaller again.

Start with the NPC family — that is where essentially all the size is — and measure
`renderer.game.threejs.info.memory.textures` separately from FPS, as the mobile audit
recommends.

---

## 8. `asset_versions.json` ships whole, in the entry bundle

`src/galois/js/interface/asset_paths.ts:1` does a static `import` of the generated index.
Webpack emits it as `JSON.parse('...')` inside chunk `9237` — which is in the chunk list for
**both** `/` and `/at/[[...slug]]`:

- 2 774 entries, 353 KB raw / **74 KB gzipped**
- Composition: 1 018 textures, 776 icons, 732 item meshes, 116 audio, 75 placeables, 42 NPCs

`JSON.parse` on a fingerprinted string is the fast path (better than an object literal), so
the parse cost is small — the issue is that the marketing/landing route `/` carries the entire
game asset index, and that the client holds a map of ~2 700 paths it will never resolve in a
session.

**Options, in increasing effort:** (a) split the index by namespace and import only the
namespaces a route uses; (b) serve it as a fetched JSON file with an immutable hashed URL and
resolve asynchronously during boot; (c) at minimum, keep it out of `/`. Worth doing after
compression is on, since gzip already takes it to 74 KB.

---

## 9. 12 MB of JavaScript on the game route

44 chunks, 11.99 MB raw / 2.86 MB gzipped. The largest modules, extracted from the emitted
chunks:

| Chunk | Raw | Dominant modules |
|---|---|---|
| `5810` | 2.40 MB | `npc_compendium.ts` 750 KB, `production_terrain_placement_map.ts` 663 KB, `bible_quest_catalog.ts` 295 KB, `business_customer_simulator.ts` 239 KB |
| `pages/at/[[...slug]]` | 2.13 MB | `BiomesView.tsx` **1.24 MB**, `LocalDevHarthmereQuests.tsx` 246 KB, `TalkDialogModalStep.tsx` 209 KB |
| `1385` | 2.21 MB | `renderers/bootstrap.ts` 800 KB (this is where the 37k-line `harthmere_assets.ts` lands after scope hoisting) |
| `9916` | 0.67 MB | `LocalDevHarthmereCombat.tsx` 100 KB, `LocalDevHarthmereInventorySystem.tsx` 88 KB |

Two things worth knowing:

- **The generated manifests are already tree-shaken.** `harthmereAssetManifest.generated.ts`
  (1.15 MB of source) and `medievalAssetManifest.generated.ts` (0.94 MB) do **not** appear in
  any chunk — `grep -l "farm_quaternius/Cow.fbx" .next/static/chunks/*.js` finds nothing. No
  action needed; do not "fix" this.
- **`harthmere_assets.ts` is not.** It is statically imported from `renderers/renderers.ts:19`
  and ships to every player even though `shouldRenderHarthmereRuntimeAssets()`
  (`harthmere_runtime_mode.ts`) is false everywhere except localhost and an opt-in
  localStorage key. Making that one `await import()` behind the gate is a contained change
  and takes a large slice of `1385` off the critical path — with the caveat from the render
  audit that some things behind that gate (combat VFX, weapon rig, terrain pre-warm) were
  *supposed* to run in production, so check what has been moved out from under it first.

`production_terrain_placement_map.ts` at 663 KB is also worth a look: if the client only needs
it for local seeding/verification and the world it describes is already in ECS, it does not
belong in the player bundle.

---

## 10. The publication content hash decodes binary as UTF-8

`src/galois/js/publish/static.ts:55`

```ts
const version = hash(result.data.toString());
```

For a `Buffer`, `.toString()` is a UTF-8 decode. Any byte sequence that is not valid UTF-8
becomes U+FFFD, so the hash is taken over a *lossy* projection of the asset. Two different
binaries that differ only in invalid-UTF-8 sequences hash identically — and because
publication treats a matching hash as "unchanged", the result is a silently stale asset behind
a reused content path. It also allocates a multi-megabyte JS string per asset during publish.

This has probably never fired, but it violates publication invariant #4 in
`docs/galois/publishing-and-serving.md`, and the fix is `hash.ArrayBuffer(...)` /
`createHash("md5").update(result.data)` over the raw bytes. Cheap insurance on a pipeline
whose whole correctness story is content addressing.

---

## 11. Bikkie: correct, with two rough edges

The client path (`client/game/util/bikkie.ts`) is well built — `LazyBiscuit` defers per-biscuit
decode, `asyncYieldForEach` keeps the main thread responsive with a 20 ms budget at boot and
5 ms on refresh, hashes are compared so unchanged biscuits are not re-registered, and the
whole thing is instrumented with `fetchMs` / `decodeMs` / `registerMs` cvals. Boot is properly
parallel: `registerBikkie` is one binding among a dozen in the early context
(`init.ts:155`), so it overlaps the WASM load and the sync connection.

Two things to improve, both server-side (`src/pages/api/bikkie.ts`):

1. **The first load is deliberately uncacheable.** The `immutable` header is only set when
   `expectedTrayId === tray.id` (`:37-44`). A cold client has no tray id, so the first request
   of every session is a full uncached payload. Since trays are immutable and content-addressed
   by id, the response could be served from a hashed URL (`/api/bikkie/<trayId>`) with a 302
   from the unversioned path, making even the first load CDN-cacheable after one round trip.
2. **The response is rebuilt per request.** `zrpcWebSerialize(biscuit)` runs for every biscuit
   and `conformsWith` runs for every (biscuit × schema) pair on *every* call, with no memoisation
   keyed on tray id. Trays are immutable — cache the encoded response body per tray id and this
   becomes a buffer write.

---

## 12. ~1.1 GB of source-format and marketing assets in the container image

`Dockerfile.biomes:305-320` copies the public tree in layers. What is in them:

| Path | Size | Comment |
|---|---|---|
| `public/splash` | 419 MB | `trailer-4k.mp4` 141 MB, `trailer-4k.webm` 88 MB, `hero-video.mov` **70 MB**, `hero-video.mp4` 62 MB, `trailer-poster.png` 15.6 MB — upstream Biomes marketing; only `b-logo.png`, `biomes.svg` and `black.png` are referenced from `src/` |
| `public/models` | 314 MB | 78 PNGs = 298 MB, including 23.5 MB and 19.2 MB single `baseColor` textures |
| `public/assets/harthmere/fbx` | 80 MB | source format, loaded only by the localhost renderer |
| `public/assets/harthmere/obj` | 48 MB | ditto, plus `.mtl` sidecars |
| `public/harthmere/voices` | 312 MB | generated voice lines |

None of this is on the player's critical path, but all of it is in every image pull, every
container start, and every `docker build` context. `hero-video.mov` in particular is a 70 MB
ProRes-ish source file sitting next to its own 62 MB mp4 export.

**Fix.** Drop `public/splash` to the handful of referenced files (or move the videos behind a
real CDN/blob URL), and stop shipping `fbx`/`obj` sources — the localhost renderer can read
them from the repo checkout. Expect the image to shrink by roughly half.

---

## What is already right (do not "fix" these)

- **Galois resolution.** `resolveAssetUrl` / `resolveAssetUrlUntyped` are used consistently;
  no call site concatenates bucket paths. Bikkie stores logical `galoisPath` values, not
  filenames, exactly as `docs/galois/publishing-and-serving.md` requires.
- **Cache headers.** `/buckets/:bucket/:path*` gets `max-age=31536000, immutable`
  (`next.config.js:79-90`), which is correct for content-addressed objects, and `/hud/*` and
  `/assets/harthmere/gltf/*` have sensible policies with the reasoning recorded in comments.
- **Same-origin static host.** `static_asset_host.json` → `/buckets/biomes-static/` avoids a
  cross-origin connection and the certificate problems the comment describes.
- **Boot parallelism.** The `RegistryBuilder` early/late split resolves independent
  dependencies concurrently; WASM, Bikkie, sync and resources overlap rather than serialise.
- **Player-mesh fetch discipline.** `gltf_fetch_coalescing.ts` dedupes identical semantic mesh
  URLs and caps concurrency at 4, with the HAR evidence for why in the comment. This is the
  pattern finding #6 should generalise.
- **Atlas mip fix landed.** `util/textures.ts:59-71` now sets `generateMipmaps = false` with the
  reasoning and the open visual question recorded. Render audit #14 is genuinely closed.
- **The base64 decode correctness fix landed.** `mobile_atlas_decode.ts` is used by all five
  former `Buffer.from(...).buffer` sites.
- **Resource-level caching.** `/scene/npc_type_mesh`, `/scene/texture/url`, `/audio/buffer` and
  `/scene/item/mesh` are all keyed and cached properly; the gap in #6 is three newer call
  sites that bypass the pattern, not a design flaw.

---

## Suggested order

**Today, minutes each:**

1. `compress: true` in `next.config.js`. Verify with `curl -I`. (~24 MB/cold load)
2. Drop `null, 2` from `exportJson`; switch the publish hash to raw bytes (#5, #10).
3. Desktop preloads one music track, not ten (#4, step 1).

**This week, contained:**

4. URL-keyed `/scene/gltf/url` resource + `SkeletonUtils.clone` for the three NPC branches (#6).
5. Slim the service worker and add a size-guard test (#2).
6. Dynamic-import the cayley numerics behind the protection resource (#3).
7. Music through `MediaElementSource`; restrict the SFX prefetch by size (#4, steps 2–3).
8. Dynamic-import `harthmere_assets.ts` behind its runtime gate (#9).

**A project:**

9. Item meshes as GLB + sidecar instead of base64-in-JSON (#5).
10. `gltfpack -cc` + KTX2 across the NPC assets, starting with `big_mucker` (#7).
11. Binary atlases with worker decode (#13 / render audit #5).
12. Split `asset_versions.json` by namespace (#8).
13. Trim the image: `public/splash`, `public/models`, fbx/obj sources (#12).

## How to verify each claim

```bash
# 1  compression
grep -n "compress:" next.config.js
curl -sI -H 'Accept-Encoding: gzip' https://<origin>/_next/static/chunks/1385-*.js | grep -i content-encoding

# 2  service worker
ls -la public/sw.js
grep -c workbox public/sw.js                      # expect 0 (nothing precached)
grep -o "assets/harthmere/glb" public/sw.js | wc -l

# 3  cayley wasm on the page
python3 -c "import json;print([f for f in json.load(open('.next/build-manifest.json'))['pages']['/at/[[...slug]]'] if '9889' in f])"
ls -la .next/static/wasm/

# 4  audio
sed -n '130,152p' src/client/game/context_managers/audio_manager.ts
du -sh public/buckets/biomes-static/asset_data/audio

# 5  export format
sed -n '86,88p' src/galois/js/assets/scripts/export.ts
head -c 200 public/buckets/biomes-static/asset_data/item_meshes/npcs/big_mucker.*.json

# 6  per-entity gltf loads
grep -n "loadGltf\|loadGltfWithRetry" src/client/game/resources/npcs.ts
grep -n 'builder.add("/scene/npc' src/client/game/resources/npcs.ts

# 7  compressed assets
find public -name "*.ktx2" | wc -l                # expect 0
ls -laS public/buckets/biomes-static/asset_data/npcs | head

# 9  bundle composition
ANALYZE=true yarn build                           # or re-run the module-size script in this audit

# 12 image contents
du -sh public/splash public/models public/assets/harthmere/{fbx,obj} public/harthmere/voices
```

In-session instrumentation that already exists and is worth watching before/after:
`game.bikkie.{fetchMs,decodeMs,registerMs}`, `renderer.game.threejs.info.memory.{textures,geometries}`,
`memory.voxeloo.*`, and the `performanceTiming:renderers:*` gauges.
