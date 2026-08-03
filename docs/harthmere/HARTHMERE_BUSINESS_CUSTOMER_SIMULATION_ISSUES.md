# Harthmere Business Customer Simulation Issues

This log records reproducible native-ECS/Anima defects found while validating
the in-world customer-service simulation. Add the exact runtime topology,
artifact, observed authoritative state, source fix, and focused retest result.
Do not replace failed live evidence with source-contract or UI-only evidence.

## 2026-08-03 — All combined business interiors render outside the shell

Status: **shared source fix and all-asset contracts green; exact-image browser
retest pending**

User evidence:

- `/Users/devindixon/Downloads/www.glitch.fun-1785749415716.log`
- `/Users/devindixon/Downloads/www.glitch.fun-1785749415716.har`
- `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 4.26.15 AM.png`
- `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 4.29.01 AM.png`
- `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 4.29.06 AM.png`
- `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 4.29.25 AM.png`
- `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 4.29.51 AM.png`

Observed behavior:

- The user reached a persisted business shell, but the combined shelves,
  tables, bed, counter equipment, and profession machine rendered outside the
  building footprint. The Dye-O-Matic appeared on the exterior/roof-side
  surface while the real interior remained mostly empty.
- Browser logging did not show a combined-interior load failure. This was a
  placement transform defect, not a missing GLB or HTTP failure.
- The supplied HAR is truncated inside a response-body string and cannot be
  parsed as complete JSON. Screenshots, the browser log, the generated
  manifest, and direct inspection of all compressed GLBs were sufficient to
  identify the deterministic transform error.

Root cause and shared fix:

- The authored contract uses Blender `+Y` as depth into the building and
  native world `+Z` as that same depth direction.
- Blender's glTF Y-up export emitted authored `+Y` depth as negative glTF Z.
  The runtime translated each GLB to `assetWorldAnchor` but did not reflect its
  Z axis, so all 19 LOD0 and LOD1 interiors extended toward negative world Z,
  outside the positive-Z building shell.
- Both combined-interior LOD roots now receive one `scale.z *= -1` reflection
  at the southwest asset anchor. The LOD center, native interaction anchors,
  manifest fixtures, collision proxies, and ECS authority remain unchanged.
- The live debug bridge now exposes actual LOD0/LOD1 world bounds. The browser
  matrix requires those bounds to remain inside each audited width, depth,
  floor, and upper-floor envelope before it accepts the row.

Focused batched gates:

- Six renderer/runtime/placement contracts passed in one Mocha process.
- The asset validator parsed all 38 compressed GLBs and verified their real
  node/accessor bounds after the runtime reflection: 19 businesses, 211
  fixtures, 178 collision boxes, 2,197,880 bytes, maximum 106,248 bytes,
  maximum nine draws, zero overlaps/intrusions, and 239 navigation routes.
- The 19-row live-browser runner contract and Node syntax gate passed.

Testing lesson:

- Manifest coordinates and Blender previews do not prove that an exported GLB
  uses the same signed axes in the runtime renderer. Asset acceptance must
  inspect the actual compressed GLB node/accessor bounds, apply the exact
  runtime transform, and verify the resulting world AABB against every native
  shell. Live browser evidence must assert those real world bounds as well as
  save screenshots.
- A standalone validator that reads `process.argv[2]` as a repository root is
  not a Mocha test file. Run it with `node scripts/...`; passing it through
  `t.sh file` makes it consume Mocha's `--config` argument and produces a test
  harness error rather than product evidence.

## 2026-08-03 — Routed native customer remains stationary outside Ashline

Status: **fix implemented; focused browser retest pending**

Runtime topology:

- Web/Logic/Sync/Shim/Bikkie: `harthmere-final-minigames-app`, web `3417`,
  sync `5307`, image
  `sha256:ad179c40f10687a5e874777536e549a0d1605fc6db94a31bc831bcb2437b8881`,
  mounted build `npc-fixes-20260803`.
- Redis: `harthmere-final-minigames-redis`, host port `6493`, literal `PONG`,
  340,395 keys at preflight.
- Same-world Anima: `harthmere-final-combat-anima-r8`, image
  `sha256:b547e86d89f6ad6f3e5a2402f07cf2663ee425e3a22e21e150871c8b386d2547`,
  `ANIMA_HFC_WRITES=1`, `/ready` returned `OK`.
- All three containers had `RestartCount=0` and `OOMKilled=false` before and
  after the attempt.
- The August 3 grouped retest used app image
  `sha256:0b9d58d9041b1c029202d0ad305003fb9c2a3870b8f6ed9b6e474beb1fe41be0`,
  mounted/configured build `e7cfc90bfff45227cdcab8e908a767c744435128`,
  the same Redis at 340,661 keys, and the same-world Anima bundle. App, Redis,
  and Anima again had `RestartCount=0`, `OOMKilled=false`, literal `PONG`,
  `/ready=OK`, and `HFC Bootstrap complete` before Chromium started.

Artifact:

- `artifacts/harthmere-business-live-browser/1785726637310-56551-report.json`
- `artifacts/harthmere-business-live-browser/01-outpost_refinery_ashline-failure.png`
- `artifacts/harthmere-business-live-browser/1785742853825-53100-report.json`

Observed authoritative behavior:

- A real session-only ECS customer was created as local-dev human entity
  `8812001040901246` at `[671.9, 67, -65]`.
- Anima consumed the entity and repeatedly authored a valid A* path through the
  real Ashline entrance toward the protected counter aisle. The path search
  timestamp advanced, proving that this was not a web-only or missing-Anima
  fixture.
- The customer remained in phase `entering` for the full 120-second acceptance
  window. Authoritative position stayed `[671.9, 67, -65]`, orientation stayed
  `[0, 0]`, and rigid-body velocity stayed `[0, 0, 0]`.
- The first attempted correction converted the business route's authored m/s
  pace with `horizontalForceForTargetSpeed`. Its focused contract passed, but
  live movement still failed. Therefore force-unit conversion alone is not the
  complete cause; the remaining defect is at the route-result to shared
  orientation/physics boundary or the spawn collision/grounding boundary.
- In the grouped retest, the new customer moved from the authored spawn and had
  a valid A* route, but then remained near `[672.85, 67.4, -61.53]` with native
  rigid-body velocity `[0, 10, 0]`. The exact `10` is the collision escape
  force, not a route speed or jump animation.

Confirmed root causes and source fixes:

- Focused probes confirmed the healthy simulator uses a 100 ms fixed interval
  (`dtSecs=0.1`). `NpcTicker` now validates the global interval and captures one
  interval/duration pair per generated batch so a config reload cannot split
  fixed-tick accounting from its physics delta.
- Two previously aborted test sessions still had eight ECS customers. Their
  economy tickets correctly said `cancelled`, but the materializer wrote the
  updated `npc_state` into regular ECS while Anima's stale `npc_state` remained
  in HFC and won every merged read. The stale customers therefore remained in
  phase `entering`, overlapped the later session's exterior lanes, and triggered
  collision-escape motion instead of the authored route.
- Business-customer updates are now partitioned explicitly: `npc_state`,
  `emote`, movement, and other HFC components go to HFC; `expires` and regular
  components go to RC; creates/deletes keep their normal HybridWorldApi path.
  A focused contract proves a cancelled update cannot be submitted as one
  mixed RC/HFC write.
- A late-created customer could receive `dtSecs=0` at the final per-NPC tick
  boundary even though the enclosing batch had captured the healthy 100 ms
  interval. The ticker now validates the duration again at that last boundary;
  invalid, zero, or negative values use the validated 0.1-second duration.
- The first HFC view of a just-created NPC can be partial. `SimulatedNpc` had
  cached the fallback NPC type and size from that partial view and never
  refreshed them, so later complete ECS state could still use the wrong
  locomotion profile. External-state refresh now updates both authoritative
  type metadata and size before behavior/physics evaluation.
- A customer used to spawn facing world-forward and depend on its first Anima
  tick to turn toward the first route waypoint. The materializer now authors
  the initial yaw directly toward that waypoint and disables ambient spawn
  jitter for this audited route source.
- Rapidly restarting a shift while the previous shift's customers are still
  leaving can place two native bodies at the same authored spawn. The
  materializer now detects only existing business-customer entities within
  1.25 metres of the intended source and defers that new create until the
  source clears. It does not treat players, fixtures, terrain, or unrelated
  world entities as blockers.
- The grouped economy read exposed seven retained Ashline sessions. Session 7
  was correctly marked `expired`, but its waiting tickets still said
  `approaching_counter`/`queued`. Those native bodies remained on the exact
  entrance route, overlapped session 8, and sent physics into the upward
  escape path. Expiry, tick-expiry, and manual end now share one authoritative
  queue-close helper that marks every waiting ticket `left`/`cancelled`, clears
  the current ticket, records `endedAtMs`, and preserves already-served or
  already-departing tickets.
- ECS materialization defensively treats any non-active persisted session as
  cancelled even when old economy data still contains a queued phase. A new
  session now defers its entire create batch while another session for the same
  outpost still has a customer anywhere on the route; it no longer protects
  only the exact spawn point.
- Focused affected gates after this grouped fix: 31 customer economy/ECS tests
  passed in one batch, the 19-row browser-runner contract passed, runner syntax
  passed, and whole-worktree `git diff --check` passed.
- Exact r2 Ashline evidence
  `artifacts/harthmere-business-live-browser/1785747076322-89455-report.json`
  proved the remaining obstruction was no longer a stale session or missing
  Anima route. Session 11 created four native customers at once; all four
  converged on the same doorway and protected aisle. The lead reached roughly
  `[673.26, 67.30, -61.72]` with a valid A* route but could not progress while
  the followers occupied the same approach. The failure screenshot visibly
  contains the clustered customers and the report retained zero browser
  console failures.
- Queue materialization is now ordered instead of burst-created. The lead
  ticket materializes first. A follower can materialize only after its
  immediately preceding customer is authoritatively `queued` or `serving` (or
  has already completed), so one customer enters the shared doorway/aisle at a
  time. Later followers still exist as real session tickets and are admitted
  in queue order; no queue node teleport was introduced.
- A newly materialized follower whose authoritative phase is already `queued`
  now walks through native Anima/A* locomotion until it reaches its audited
  `queueTarget`; only then does the queued phase hold position. This closes the
  former behavior where a queued follower created outside could be marked
  stationary before physically joining the queue.
- The combined affected batch after the ordered-admission fix is 45 passing in
  two minutes. It covers all 19 lead spawns, ordered follower admission,
  queued movement/holding, restart deferral, expiry/abort cleanup, economy
  conservation, native serialization, and Anima runtime configuration.

Testing lesson:

- A changing Anima path/search timestamp is proof that the simulator owns the
  entity, but it is not proof of locomotion. Acceptance must require changing
  authoritative position, finite non-zero motion while entering, arrival at
  the exact customer point, and later departure through the real exit.
- Run only the Ashline smoke while this issue is open. Do not launch the other
  18 browser rows or replay already-green original mini-games until Ashline
  completes entrance, service, departure, and safe off-screen despawn.
- Anima `/ready` can precede completion of its HFC bootstrap on a loaded warm
  world. Browser preflight must require both `/ready=OK` and an explicit HFC
  bootstrap-complete signal before creating a session; otherwise initial
  customer state can be observed before the simulator owns the HFC half.
- Preserve the failed row and restart it only after its old session customers
  have left or been safely removed. Recreating the session immediately can
  turn a deterministic route test into a native rigid-body overlap test.
- Do not create every ticket in a spatial queue during the same materialization
  pass. A valid A* path for each individual is insufficient when all bodies
  converge on one doorway before any preceding customer has settled. Gate
  follower creation on authoritative progress of the previous ticket, then
  fill the queue one position at a time.
- When a movement failure reports vertical velocity exactly `10`, inspect all
  retained customer sessions before changing terrain or pathfinding. In this
  topology that value identifies native collision escape; stale customers on
  the same route are a higher-probability cause than a missing A* path.

Build/tooling lesson:

- The server webpack configuration loads TypeScript through Webpack and now
  requires Node 22.6 or newer. A host Node 20 invocation fails before compiling
  source. Use the workspace runtime by prefixing the build with
  `PATH=/Users/devindixon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`;
  do not retry the same command under the older host runtime.
- Docker Desktop on this Apple Silicon host defaults an unqualified build to
  ARM64, while `Dockerfile.biomes` deliberately installs AMD64 Bazelisk and
  native runtime dependencies. The first r3 package attempt stopped at
  `bazel --version` with Rosetta unable to open the x86-64 loader, before the
  image copied `.next` or `dist`. The valid retry explicitly used
  `--platform linux/amd64`, matched the accepted r2 architecture, and completed
  the in-image artifact-current and 1,079-runtime-import gates. Always inspect
  the accepted image architecture before packaging this Dockerfile.

Resolution artifact: pending. Mark closed only after Ashline and then the
failed-ID/all-19 serial matrix prove entrance, service, departure, and safe
off-screen cleanup with restart-zero/OOM-false lifecycle evidence.

## 2026-08-03 — Combined interiors outside shells, roof machines, and missing fixture collision

Status: **source fixes and focused contracts green; exact-image browser matrix pending**

User evidence:

- HAR/log bundle: `/Users/devindixon/Downloads/www.glitch.fun-1785749415716.har`
  and `/Users/devindixon/Downloads/www.glitch.fun-1785749415716.log`.
- Screenshots at 04:26–04:29 showed shelves, counters, and beds outside the
  business shell and a Dye-O-Matic rendered on the roof.

Root causes and fixes:

- The compressed GLBs use glTF depth in the opposite sign from the manifest's
  Blender +Y depth convention. The business-interior root now reflects Z once,
  and both the asset validator and live debug bridge assert actual transformed
  LOD0/LOD1 world bounds inside every audited shell.
- The procedural business shells were smaller than the 24x20/28x22 generated
  interiors. The active authored-table remediation now derives exact manifest
  footprints/floors, uses the manifest door/counter anchors, widens all doors
  to three voxels, and carves a final graded approach lane. The all-19 route,
  shell, and building batch is green.
- The 178 generated collision boxes were validation-only. They now materialize
  as deterministic, non-rendering native ECS entities with `position`, `size`,
  `orientation`, and `collideable`. Blender `(width, depth, height)` is reordered
  to native `(X width, Y height, Z depth)`, with Position at box bottom-center.
  The same collideable selector is consumed by player physics and same-world
  Anima NPC physics; no triangle collision or Gaia tick was added.
- The 19 crafting stations duplicated machines already present in the combined
  GLB, and the generic indoor terrain probe could move those visible copies to
  a roof. They are now exact manifest primary-station interaction anchors,
  explicitly non-collidable on warm update, excluded from the placeable
  renderer, and excluded from terrain grounding. The combined GLB owns visuals
  and the generated proxy owns collision exactly once.
- The detached `CustomerMiniGamePane` was removed from the panel. The physical
  counter opens the dependency-light `In-World Shift` control; starting closes
  the dashboard and service choices remain in the projected spatial HUD beside
  the authoritative ECS customer.

Focused evidence retained:

- 80 passing route/building/interior/station/collision/renderer contracts in
  one fast batch.
- 73 passing business UI/adapter/render contracts in one bootstrapped batch,
  plus the one previously failed embedded-browser row passing after the shift
  control was extracted from the heavy game-context HUD module.
- `git diff --check` clean after the source batch.

Testing lessons:

- Do not unit-test a simple dashboard button by importing a module that also
  owns `ClientContext`, THREE projection, NPC pathfinding, and msgpack. Extract
  the dependency-light control, keep the spatial HUD separate, and test both at
  their correct boundary.
- For generated interior assets, fixture-coordinate tests alone cannot catch a
  whole-catalogue axis reflection. Parse real compressed GLB bounds and repeat
  the exact runtime transform in the browser assertion.
- A visible authored machine embedded in a combined GLB must not also be a
  visible/collidable placeable. Preserve native interaction through an invisible
  anchor and give physics to one manifest-derived proxy only.

### Exact-image Ashline collision preflight false negative

The first exact-image Ashline smoke on 2026-08-03 stopped before gameplay with
`must materialize every manifest collision proxy`, while the same startup log
proved all 178 business collision seeds had been created/reconciled. The
product lifecycle remained healthy: app, Redis, and Anima all had
`RestartCount=0`, `OOMKilled=false`, Redis returned `PONG`, and the exact image
and BUILD_ID matched.

Root cause: the native E2E bridge's `getAuthoritative(ids)` wraps
`/api/admin/ecs/get_with_version`, whose rows are `[version, entity]` in the
same order as the requested IDs. The business runner incorrectly interpreted
the first tuple member as the entity ID. Several proxies can share the same
version, so inserting them into a Map collapsed valid rows and produced a false
missing-proxy failure.

Fix: associate each returned row with `ids[offset]`, retain the tuple's second
member as the entity payload, and add the exact mapping to the browser-runner
contract. No ECS seed, Redis, shell, collision, or image change was required.
The failed smoke artifact is
`artifacts/harthmere-business-live-browser/1785760376287-74546-report.json`;
it is harness evidence only and must not be counted as a product failure.

### Exact-image Ashline customers existed in regular ECS but not HFC

After the authority-map harness correction, Ashline passed its full interior,
collision-proxy, and crafting-anchor preflight, then timed out with all four
customers still in `entering`. Direct HFC inspection showed zero fields for all
four ticket entity IDs, and Anima emitted no first-physics probe for those IDs.

Root cause: `applyHarthmereBusinessCustomerSessionNpcChanges` correctly split
updates, but treated creates as an unsplit base change and called
`HybridWorldApi.apply`. Hybrid creates are written to regular ECS; they do not
automatically populate the separate HFC hash. The customer therefore rendered
from regular ECS but Anima never acquired the high-frequency `position`,
`npc_state`, orientation, or rigid-body state needed for locomotion.

Fix: for a HybridWorldApi, apply the complete create to regular ECS first, then
publish the create's HFC components as an ordered HFC update. Apply deletes to
both stores explicitly. A focused regression test now proves RC-create precedes
HFC publication and that the HFC update contains position, NPC state, and
orientation while excluding regular-only NPC metadata.

The same smoke exposed a cleanup harness typo: it compared
`String(session.actorId)` with a numeric `actorId`, so retained sessions were
never ended. The comparison now normalizes both sides. Before the post-fix
browser run, clean all retained active sessions for the two historical business
test actors so old NPCs cannot consume Anima work or contaminate route evidence.

Bulk cleanup also has to obey the product's normal business proximity rule.
The live-mode route can return HTTP 200/`ok: true` while placing
`economy_rejected:business_proximity_required` in backend mutation warnings.
The runner now moves the actor to each session's audited staff point before
ending it and treats any `economy_rejected:*` backend warning as a cleanup
failure. This preserves normal authority instead of adding a cleanup bypass.

The product-failure artifact is
`artifacts/harthmere-business-live-browser/1785760616349-75414-report.json`.
Do not run the remaining 18 rows against the pre-fix image; this create-path
defect is shared by every business.

### Exact-image Ashline blocked by persistent NPC posts in the protected aisle

Status: **fix implemented in authored seed data; browser retest pending**

After the RC→HFC create fix, Ashline's customer existed in both authorities,
Anima acquired it, authored a valid A* path, and moved it several metres. It
then stalled short of the door. Live spatial inspection found two collidable
Chapter 1 actors standing in the protected entrance aisle at roughly `z=-57`
and `z=-55`.

Root cause, in two independent families:

- `ownerPositionForSafeSite` placed every one of the 19 business owners at the
  centre of its building footprint. That centre _is_ the customer lane, so each
  shop's own owner was a collidable one-metre body parked across the route its
  customers have to walk.
- Chapter 1, Grove and additive-town NPCs are authored in their own tables with
  no knowledge of which business shell they stand inside. The outposts only grew
  to their audited 24x20 / 28x22 footprints later, so previously-open ground
  became someone's entrance aisle.

The asset pipeline reports zero protected-aisle intrusions, and that remains
true — it only ever validated _fixtures_. Nothing validated bodies.

Fix:

- `business_aisle_keep_out.ts` makes the manifest `protectedAisle` a first-class
  keep-out volume in world space, grown by half a body plus margin, with the
  customer/staff/entrance service points held clear as well. Relocation is
  lateral, so authored depth staging and facing are preserved and a displaced
  body stays in the same room.
- Business owners now derive their post from the audited staff-side anchor.
- `applyHarthmereBusinessAisleKeepOutToSeedChanges` corrects any persistent NPC
  seed that falls in an aisle _before it is written_, wired into `shim/main.ts`.
  Correcting in place means the world never contains the obstruction and a warm
  refresh converges with a cold seed.
- Position and `spawn_position` are always moved together. Moving position alone
  leaves the home anchor in the lane, and return-home/meander walks the body
  straight back — a reconciliation that appears to have done nothing.
- Session-only business customers are exempt; they belong in the aisle.

Contracts: `test/business_aisle_keep_out.test.ts` covers all 19 businesses plus
the reconciliation sweep (139 assertions), including that a genuinely collidable
counter separates the customer and staff points now that real collision proxies
are seeded.

Testing lesson:

- "Zero protected-aisle intrusions" from the asset validator is a statement about
  fixtures only. Any keep-out claim for the customer route has to be re-checked
  against **bodies** — owners, quest actors, residents — after world-space
  conversion, and re-checked again whenever an outpost footprint changes.

### Shift customer opened ordinary NPC dialogue instead of service choices

Status: **source fix and contracts green; exact-image browser matrix pending**

User evidence:

- HAR: `/Users/devindixon/Downloads/shift_start_2.har`.
- Screenshots:
  `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 9.55.30 AM.png` and
  `/Users/devindixon/Desktop/Screenshot 2026-08-03 at 9.56.21 AM.png`.

The HAR proves `start_business_customer_session` committed for Greenlamp, but
contains no `serve_business_customer` mutation. The follow-up screenshot shows
why: talking to the session customer entered the generic NPC surface (`Chit
Chat`, `Ask about this place`, relationship choices) instead of the business
minigame choices.

Fix:

- The spatial card is status-only. It never exposes offer buttons or number-key
  shortcuts while the player is merely looking at the customer.
- The active native customer entity is published as an exact-id talk target.
- `TalkToNPCScreen` checks that target before quest/default dialogue. During an
  active ticket, talking to the customer renders only the authoritative ask,
  patience and business service offers; ordinary ambient dialogue is absent.
- The service action still goes through the existing frontend adapter and the
  normal Logic authority path. The UI does not reveal `requestedOfferId` by
  highlighting the correct answer.
- Starting a shift closes the dashboard and explicitly tells the player to stay
  behind the counter, then talk to the front customer when they arrive.

Browser evidence now requires screenshots at the shift control, behind-counter
shift start, customer arrival, customer talk/service choices, authoritative
reaction/outcome, safe departure/despawn, and queue advance for each business.
It also asserts that `Chit Chat` and `Ask about this place` are absent from the
active-customer conversation and that every business-defined service option is
present exactly once.

### Repeated session materialization erased Anima movement progress

Status: **source fix and regression contract green; exact-image browser matrix pending**

The first exact-image Ashline retry proved that Anima acquired the native ECS
customer and moved it away from its spawn, but the body repeatedly stalled at
the same exterior coordinate. The slower customer-session materializer was
rewriting `npc_state` on every two-second UI tick. Its reconstructed state kept
the waypoint index and A* path but omitted Anima's `progressPosition` and
`progressAtSeconds`, so every ordinary economy tick erased the locomotion
controller's stall/progress history. It also restarted reaction emotes and
pushed the departure expiry forward on every pass.

Fix:

- unchanged session authority is now a true ECS no-op;
- route-preserving authority updates retain Anima-owned progress fields;
- phase/reaction changes still publish through HFC immediately;
- progress resets only when a genuinely new route phase begins; and
- reaction emotes and departure expiry are edge-triggered instead of being
  restarted indefinitely.

The regression starts from a real materialized customer, injects
Anima-advanced waypoint/progress state, repeats the session tick, and requires
zero proposed changes. It then changes the ticket to `departing`, requires one
HFC state transition plus one regular-ECS expiry, and proves the next repeated
departure tick is again a no-op.

### Warm-snapshot iced placeable blocked the native entrance route

Status: **source fix and focused collision contract green; exact-image browser retry pending**

The next exact-image Ashline retry progressed normally under Anima from the
authored spawn to `[673.36, 67.02, -61.34]`, then remained in `entering` with
a current A* path and finite horizontal velocity. Terrain inspection proved
the route had only its expected floor support. The remaining nearby obstacle
was legacy placeable `8701928864590349`, an iced Muck Buster Redux at
`[677, 67, -63]`.

The misleading diagnostic was the entity's ECS `size: [0, 0, 0]`. Placeable
collision extents come from the Bikkie item, not that component, so zero ECS
size does not mean zero collision. `CollisionHelper` also failed to exclude
iced entities even though Sync treats iced entities as logically deleted and
does not project them to clients. The result was an invisible server-side
collision body in a warm snapshot world.

`isCollidable` now rejects iced entities before resolving placeable bounds. A
focused shared collision contract preserves active collision while proving an
iced retained entity is non-collidable.

Testing lesson:

- When a native NPC has a changing A* search timestamp, finite velocity, and a
  fixed position, inspect both terrain and collidable ECS entities around the
  exact stop point.
- For placeables, resolve `placeable_component.item_id` and inspect the Bikkie
  collision bounds. Never infer collision size from the optional ECS `size`
  component.
- Check `iced` explicitly. An iced entity can remain in Redis with its old
  collideable components even though the client correctly never renders it.

### Final 2026-08-03 acceptance status: incomplete

The source fix for the iced collision defect is implemented, its focused
contracts are green, and an exact-current image was produced:

- tag: `biomes-node:local-harthmere-business-overhaul-final-20260803-r5`;
- image: `sha256:28271bb328efb0bd28755569e228b860c143b871de054a9a6a8a26c6c97771ed`;
- packaged Next `BUILD_ID`: `business-iced-collision-20260803-r5`;
- warm Redis health before shutdown: literal `PONG`, `DBSIZE 336451`,
  `RestartCount=0`, `OOMKilled=false`;
- app and final Anima process both used the exact image with
  `RestartCount=0`, `OOMKilled=false`; and
- Anima eventually reached `/ready=OK` plus `HFC Bootstrap complete` with HFC
  writes enabled.

This is **not live-browser acceptance**. The r5 image was not taken through a
completed Ashline shift after the collision fix, and the other 18 businesses
were not run. The last retained browser report remains the pre-fix Ashline
failure at
`artifacts/harthmere-business-live-browser/1785779764709-4286-report.json`.
No r5 screenshots prove entrance, service choices, committed transaction,
departure, safe despawn, or queue advance. The all-19 live matrix therefore
remains unaccepted.

Operational failures that extended this pass:

1. The first r5 Next invocation omitted the testing guide's mandatory
   `--webpack` flag. Next 16 selected Turbopack and failed. Because that shell
   command was not fail-fast, it continued into server packaging until it was
   manually cancelled. A failed build stage must terminate the whole pipeline.
2. The runtime env file was sourced as shell code during a readiness attempt.
   Its quoted `NODE_OPTIONS` value is valid for Docker `--env-file` but not a
   safe shell script, producing `command not found: --trace-warnings`. Env files
   must be parsed as data or passed to Docker, never sourced.
3. The first separate Anima recreation copied the general env file but not the
   retained container's runtime-specific overrides. It inherited
   `SHIM_SERVICE_HOST=127.0.0.1` and waited on itself. The next attempt fixed
   service discovery but still omitted `GALOIS_STATIC_PREFIX`, so local asset
   URLs were relative and Anima exited during initialization. These should
   have been found by diffing the complete old/new container configuration once
   before starting anything.
4. The browser was correctly held until app lifecycle, Redis, and Anima HFC
   readiness were all green, so none of these startup attempts produced valid
   partial browser evidence. However, the repeated runtime setup prevented the
   required r5 live matrix from completing before the user ended the pass.

The source result must be described as **fixes ready, browser acceptance
failed/incomplete**, not complete.

Final lane state: Redis `SAVE` completed before shutdown at `DBSIZE 336451`.
The retained container's `/data/dump.rdb` is 2,064,603,253 bytes; a verification
copy is at
`/tmp/harthmere-final-minigames-quiesced-1785783545.rdb`. The app, Anima,
Redis, logic forwarder, and Redis forwarder were stopped and retained. All had
`RestartCount=0` and `OOMKilled=false`; their non-zero app/Anima/forwarder exit
codes are stop-signal behavior, not accepted runtime evidence.

### Production HAR: shift runs from the wrong side, and the wrong dialogue opens

Status: **both fixes implemented with per-business contracts; live retest pending**

Evidence: `shift_start_2.har`, captured against production
(`biomes-node-vnet...azurecontainerapps.io`), 342 entries.

Two independent product defects, both visible in that capture.

**1. The shift is not played from behind the counter.**

The successful `start_business_customer_session` for Greenlamp carried
`businessInteractionPosition {"x":652,"y":65,"z":-178}`. That is the side
dashboard console — `dashboardAccessPoint`, derived from
`max(origin.x + 3, doorX - 4)` — not the audited staff point at
`(656.5, 65, -175)`.

`rejectEconomyMutationOutsideBusiness` only ever checked *distance* to the
counter, with a 4.25 m radius for the four customer operations. That radius is
satisfied just as well from the customer side, so a player could start, serve,
tick and end an entire shift while standing in the queue's own lane — facing the
wrong way and physically blocking the customers they were meant to serve.

Fix: `harthmereBusinessPointIsStaffSide` makes sidedness explicit, measured
along the room's depth axis (every audited interior places the entrance at low
local depth, the counter across the middle, and the staff point behind it). The
four counter operations now additionally require the actor to be on the staff
side, rejecting with `economy_rejected:business_staff_side_required`. Ordinary
business management — ledgers, storefront, licences — is deliberately still
reachable from anywhere near the building.

Contract: `test/business_staff_side_shift.test.ts`, 19 rows plus cross-business
resolution. Each row proves the staff point is accepted; the customer point,
every queue slot, the entrance and the spawn point are rejected; a step back
from the counter still serves but the far wall does not; and the collidable
counter actually sits on the staff/customer boundary, so "behind the counter" is
a physical fact rather than a label.

**2. Talking to a customer opened ordinary NPC dialogue.**

`HarthmereBusinessCustomerTalkDialog` and its routing in `TalkToNPCScreen` were
correct, but the talk target was a **single module-level variable** published
only by the projected `SpatialCustomerCard` for the *current* ticket. Two
consequences:

- Talking to any other customer in the queue found no target and fell through to
  the ordinary dialogue branch — "Chit Chat", "Ask about this place" — from a
  person standing in a shop queue holding a service request.
- The card's cleanup deregistered the current customer whenever it unmounted,
  which the proximity- and visibility-gated HUD does routinely.

Fix: the talk state is now a registry keyed by entity id, published wholesale
from the shift level for every waiting ticket, so removal of served or departed
customers is automatic and a stale entry cannot offer service to someone who has
already walked out. `ready` — and therefore the presence of service choices —
remains restricted to the session's current ticket in phase `serving`, so a
queued customer is talkable in character without letting the player serve out of
order. The per-card effect now only *refines* the current customer with its live
ECS phase and no longer deregisters on unmount.

Contract: `__tests__/businessCustomerTalkState.test.ts`, including a source
contract that fails if the per-card cleanup is ever restored.

Testing lesson:

- A correct dialogue branch proves nothing if the state it branches on is
  published by a component that unmounts for unrelated reasons. When routing
  depends on module-level state, the contract has to cover the *publisher's*
  lifetime, not just the reader's logic.
- The known embedded-browser bundler limitation (`esbuild` native binary
  unavailable in this environment) still fails one row of
  `businessInterfaceLiveAdapter.test.ts` before any assertion runs. That is a
  harness limitation, not a product failure; it belongs to the exact-image
  browser gate.
